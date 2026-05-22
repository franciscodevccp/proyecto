/**
 * api/wiki/route.ts
 * Proxy del servidor hacia la Wikipedia REST API.
 *
 * Ventajas frente a llamar a Wikipedia directamente desde el navegador:
 *   - Evita bloqueos CORS / CSP del browser
 *   - Permite cachear respuestas en memoria (TTL 1 hora) para que
 *     cargar el mismo batch no vuelva a golpear Wikipedia
 *   - El servidor añade un User-Agent válido que Wikipedia recomienda
 *
 * GET /api/wiki?nombre=Leonardo+Da+Vinci
 * Responde: { descripcion: string | null, foto: string | null }
 */

import { NextRequest, NextResponse } from 'next/server'

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Subconjunto de la respuesta de Wikipedia REST API page/summary */
interface WikiRawResponse {
  description?: string
  thumbnail?: { source?: string }
  type?: string
}

/** Estructura simplificada que devuelve este endpoint */
interface WikiEntry {
  descripcion: string | null
  foto:        string | null
}

// ─── Cache en memoria ─────────────────────────────────────────────────────────

/** Duración del cache por entrada (1 hora) */
const CACHE_TTL_MS = 60 * 60 * 1000

/** Cache: nombre normalizado → datos cacheados con timestamp de expiración */
const wikiCache = new Map<string, { data: WikiEntry; expiry: number }>()

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const nombre = req.nextUrl.searchParams.get('nombre')?.trim()
  if (!nombre) {
    return NextResponse.json({ error: 'Parámetro "nombre" requerido' }, { status: 400 })
  }

  // Clave de cache en minúsculas para unificar variaciones de mayúsculas
  const cacheKey = nombre.toLowerCase()

  // Devolver resultado cacheado si no ha expirado
  const cached = wikiCache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json(cached.data)
  }

  // Construir URL de Wikipedia usando el nombre tal cual (la API sigue redirects)
  const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(nombre)}`

  try {
    const res = await fetch(wikiUrl, {
      headers: {
        // Wikipedia pide un User-Agent descriptivo para evitar throttling
        'User-Agent': 'COMUNAS_NORM/1.0 (proyecto educativo; sin fines comerciales)',
        'Accept': 'application/json',
      },
      // Timeout de 8 segundos — Wikipedia responde normalmente en < 2 s
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      // Artículo no encontrado u otro error HTTP: cachear como "sin datos"
      const empty: WikiEntry = { descripcion: null, foto: null }
      wikiCache.set(cacheKey, { data: empty, expiry: Date.now() + CACHE_TTL_MS })
      return NextResponse.json(empty)
    }

    const raw = (await res.json()) as WikiRawResponse

    // Ignorar páginas de desambiguación (type = "disambiguation")
    const entry: WikiEntry = raw.type === 'disambiguation'
      ? { descripcion: null, foto: null }
      : {
          descripcion: raw.description ?? null,
          foto:        raw.thumbnail?.source ?? null,
        }

    wikiCache.set(cacheKey, { data: entry, expiry: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(entry)
  } catch {
    // Timeout, error de red, etc. — no cachear para que el próximo intento reintente
    return NextResponse.json({ descripcion: null, foto: null })
  }
}
