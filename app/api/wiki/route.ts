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
  title?: string
}

/** Resultado de Wikipedia open-search (array de 4 elementos) */
type WikiSearchResult = [string, string[], string[], string[]]

/** Estructura simplificada que devuelve este endpoint */
interface WikiEntry {
  descripcion: string | null
  foto:        string | null
}

// ─── Cache en memoria ─────────────────────────────────────────────────────────

/** Duración del cache para resultados exitosos (1 hora) */
const CACHE_TTL_MS = 60 * 60 * 1000

/** Duración del cache para artículos verdaderamente no encontrados (404) */
const CACHE_NOT_FOUND_TTL_MS = 30 * 60 * 1000

/** Cache: nombre normalizado → datos cacheados con timestamp de expiración */
const wikiCache = new Map<string, { data: WikiEntry; expiry: number }>()

// ─── Headers compartidos ──────────────────────────────────────────────────────

const WIKI_HEADERS = {
  'User-Agent': 'COMUNAS_NORM/1.0 (proyecto educativo; sin fines comerciales)',
  'Accept': 'application/json',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Llama a la Wikipedia REST API page/summary para un título dado.
 * Devuelve la respuesta cruda o null si falla (timeout, red, etc.).
 * Solo devuelve null en errores transitorios — en 404 devuelve el objeto con status.
 */
async function fetchSummary(
  titulo: string,
  signal: AbortSignal,
): Promise<{ raw: WikiRawResponse; status: number } | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`
  try {
    const res = await fetch(url, { headers: WIKI_HEADERS, signal })
    if (!res.ok) return { raw: {}, status: res.status }
    const raw = (await res.json()) as WikiRawResponse
    return { raw, status: res.status }
  } catch {
    return null
  }
}

/**
 * Usa la Wikipedia opensearch API para encontrar el título canónico
 * de un artículo cuando el nombre exacto no lo resuelve.
 * Devuelve el primer título sugerido o null si no encuentra nada.
 */
async function buscarTituloWiki(
  nombre: string,
  signal: AbortSignal,
): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(nombre)}&limit=1&format=json&origin=*`
  try {
    const res = await fetch(url, { headers: WIKI_HEADERS, signal })
    if (!res.ok) return null
    const data = (await res.json()) as WikiSearchResult
    // data[1] es el array de títulos
    return Array.isArray(data[1]) && data[1].length > 0 ? data[1][0] : null
  } catch {
    return null
  }
}

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

  // Timeout compartido de 10 segundos para todo el proceso (incluyendo fallback)
  const signal = AbortSignal.timeout(10000)

  try {
    // ── Intento 1: nombre directo ────────────────────────────────────────────
    const resultado = await fetchSummary(nombre, signal)

    if (resultado === null) {
      // Error transitorio (timeout, red): NO cachear para que el próximo intento reintente
      return NextResponse.json({ descripcion: null, foto: null })
    }

    if (resultado.status === 404) {
      // ── Intento 2: buscar título canónico con opensearch ─────────────────
      // El nombre normalizado (Title Case) a veces no coincide exactamente
      // con el título del artículo de Wikipedia (ej: "Van Gogh" vs "van Gogh").
      const tituloCanon = await buscarTituloWiki(nombre, signal)

      if (tituloCanon && tituloCanon.toLowerCase() !== nombre.toLowerCase()) {
        const resultado2 = await fetchSummary(tituloCanon, signal)
        if (resultado2 && resultado2.status === 200 && resultado2.raw.type !== 'disambiguation') {
          const entry: WikiEntry = {
            descripcion: resultado2.raw.description ?? null,
            foto:        resultado2.raw.thumbnail?.source ?? null,
          }
          wikiCache.set(cacheKey, { data: entry, expiry: Date.now() + CACHE_TTL_MS })
          return NextResponse.json(entry)
        }
      }

      // Artículo verdaderamente no encontrado: cachear por 30 min (no 1 hora)
      // para que un cambio de nombre en el batch pueda reintentarlo antes
      const empty: WikiEntry = { descripcion: null, foto: null }
      wikiCache.set(cacheKey, { data: empty, expiry: Date.now() + CACHE_NOT_FOUND_TTL_MS })
      return NextResponse.json(empty)
    }

    if (resultado.status !== 200) {
      // Error del servidor de Wikipedia (429, 503, etc.): NO cachear
      // para que el próximo intento pueda reintentar
      return NextResponse.json({ descripcion: null, foto: null })
    }

    const raw = resultado.raw

    // Ignorar páginas de desambiguación (type = "disambiguation")
    if (raw.type === 'disambiguation') {
      // Intentar con opensearch para encontrar el artículo más relevante
      const tituloCanon = await buscarTituloWiki(nombre, signal)
      if (tituloCanon && tituloCanon.toLowerCase() !== nombre.toLowerCase()) {
        const resultado2 = await fetchSummary(tituloCanon, signal)
        if (resultado2 && resultado2.status === 200 && resultado2.raw.type !== 'disambiguation') {
          const entry: WikiEntry = {
            descripcion: resultado2.raw.description ?? null,
            foto:        resultado2.raw.thumbnail?.source ?? null,
          }
          wikiCache.set(cacheKey, { data: entry, expiry: Date.now() + CACHE_TTL_MS })
          return NextResponse.json(entry)
        }
      }
      const empty: WikiEntry = { descripcion: null, foto: null }
      wikiCache.set(cacheKey, { data: empty, expiry: Date.now() + CACHE_NOT_FOUND_TTL_MS })
      return NextResponse.json(empty)
    }

    const entry: WikiEntry = {
      descripcion: raw.description ?? null,
      foto:        raw.thumbnail?.source ?? null,
    }

    wikiCache.set(cacheKey, { data: entry, expiry: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(entry)

  } catch {
    // Timeout global u otro error inesperado: NO cachear
    return NextResponse.json({ descripcion: null, foto: null })
  }
}
