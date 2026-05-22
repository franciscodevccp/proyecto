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

// ─── Throttle server-side ─────────────────────────────────────────────────────

/**
 * Intervalo mínimo entre peticiones salientes a Wikipedia (ms).
 * Wikipedia permite ~200 req/s con User-Agent válido, pero en la práctica
 * manda 429 cuando llegan muchas peticiones en ráfaga desde la misma IP.
 * Con 300 ms entre peticiones hacemos máx. ~3 req/s → sin 429.
 */
const WIKI_DELAY_MS = 300

/** Timestamp en que se envió la última petición a Wikipedia */
let lastWikiRequest = 0

/**
 * Espera lo necesario para respetar WIKI_DELAY_MS entre peticiones.
 * Actualiza lastWikiRequest de forma atómica para que peticiones
 * concurrentes se encolen correctamente.
 */
function throttleWiki(): Promise<void> {
  const now = Date.now()
  const delay = Math.max(0, lastWikiRequest + WIKI_DELAY_MS - now)
  // Reservar el slot ANTES de esperar (evita race conditions)
  lastWikiRequest = now + delay
  if (delay === 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, delay))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Corrige numerales romanos mal capitalizados por el normalizador Title Case.
 * El normalizador convierte "II" → "Ii", "III" → "Iii", etc.
 * Wikipedia usa mayúsculas para numerales romanos en títulos de artículos.
 * Ejemplos: "Queen Elizabeth Ii" → "Queen Elizabeth II"
 *           "Henry Viii" → "Henry VIII"
 *           "Pope John Paul Ii" → "Pope John Paul II"
 */
function corregirNumeralesRomanos(nombre: string): string {
  // Patrón: palabra que solo contiene I, V, X, L, C, D, M (en cualquier case)
  // con al menos una vocal romana (I o V) para evitar falsos positivos
  return nombre.replace(/\b([IVXLCDMivxlcdm]+)\b/g, (match) => {
    const upper = match.toUpperCase()
    // Solo corregir si el original estaba en Title Case incorrecto (ej: "Ii", "Iii")
    // y la versión uppercase es un numeral romano válido (≤ 8 chars para evitar siglas)
    if (match !== upper && upper.length <= 8 && /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(upper)) {
      return upper
    }
    return match
  })
}

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
    // Respetar el intervalo mínimo entre peticiones para evitar 429
    await throttleWiki()
    if (signal.aborted) return null
    const res = await fetch(url, { headers: WIKI_HEADERS, signal })
    console.log(`[wiki] ${titulo} → HTTP ${res.status}`)

    // Retry automático si Wikipedia responde 429 (rate limit transitorio)
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000))
      if (signal.aborted) return null
      const retry = await fetch(url, { headers: WIKI_HEADERS, signal })
      console.log(`[wiki] ${titulo} → retry HTTP ${retry.status}`)
      if (!retry.ok) return { raw: {}, status: retry.status }
      const raw = (await retry.json()) as WikiRawResponse
      console.log(`[wiki] ${titulo} → type=${raw.type ?? 'standard'} thumb=${!!raw.thumbnail?.source}`)
      return { raw, status: retry.status }
    }

    if (!res.ok) return { raw: {}, status: res.status }
    const raw = (await res.json()) as WikiRawResponse
    console.log(`[wiki] ${titulo} → type=${raw.type ?? 'standard'} thumb=${!!raw.thumbnail?.source}`)
    return { raw, status: res.status }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[wiki] ${titulo} → ERROR: ${msg}`)
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

  // Corregir numerales romanos antes de buscar (Title Case convierte "II" → "Ii")
  const nombreCorregido = corregirNumeralesRomanos(nombre)

  // Timeout compartido de 15 segundos para todo el proceso (incluyendo retry 429)
  const signal = AbortSignal.timeout(15000)

  try {
    // ── Intento 1: nombre directo (con numerales corregidos) ─────────────────
    const resultado = await fetchSummary(nombreCorregido, signal)

    if (resultado === null) {
      // Error transitorio (timeout, red): NO cachear para que el próximo intento reintente
      return NextResponse.json({ descripcion: null, foto: null })
    }

    if (resultado.status === 404) {
      // ── Intento 2: buscar título canónico con opensearch ─────────────────
      // El nombre normalizado (Title Case) a veces no coincide exactamente
      // con el título del artículo de Wikipedia (ej: "Van Gogh" vs "van Gogh").
      const tituloCanon = await buscarTituloWiki(nombreCorregido, signal)

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
      const tituloCanon = await buscarTituloWiki(nombreCorregido, signal)
      if (tituloCanon && tituloCanon.toLowerCase() !== nombreCorregido.toLowerCase()) {
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
