/**
 * api/wiki/route.ts
 * Proxy del servidor hacia Wikipedia para enriquecer famosos con foto y descripción.
 *
 * DISEÑO: usa la MediaWiki Action API (w/api.php) en lugar de la REST API
 * (rest_v1/page/summary) por dos razones decisivas:
 *
 *   1. BATCH: permite consultar hasta 50 títulos en UNA sola petición
 *      (titles=A|B|C...). Antes se hacían 50 peticiones separadas, lo que
 *      disparaba HTTP 429 (rate limit) y dejaba personas sin imagen.
 *
 *   2. REDIRECTS AUTOMÁTICOS: con redirects=1 resuelve CUALQUIER redirect
 *      genéricamente (ej: "Mozart" → "Wolfgang Amadeus Mozart",
 *      "Napoleon" → "Napoleon"), sin necesidad de listas hardcodeadas.
 *
 * Endpoints:
 *   GET  /api/wiki?nombre=Mozart           → un solo nombre
 *   POST /api/wiki  body { nombres: [...] } → lote de nombres (recomendado)
 *
 * Respuesta GET:  { descripcion: string | null, foto: string | null }
 * Respuesta POST: { resultados: { [nombre]: { descripcion, foto } } }
 */

import { NextRequest, NextResponse } from 'next/server'

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Estructura simplificada que devuelve este endpoint por cada nombre */
interface WikiEntry {
  descripcion: string | null
  foto:        string | null
}

/** Página individual en la respuesta de la MediaWiki Action API */
interface MWPage {
  pageid?:     number
  title:       string
  description?: string
  thumbnail?:  { source?: string; width?: number; height?: number }
  missing?:    string
}

/** Entrada de los arrays normalized/redirects de la Action API */
interface MWMapping {
  from: string
  to:   string
}

/** Respuesta completa de la MediaWiki Action API (query) */
interface MWResponse {
  query?: {
    normalized?: MWMapping[]
    redirects?:  MWMapping[]
    pages?:      Record<string, MWPage>
  }
}

// ─── Cache en memoria ─────────────────────────────────────────────────────────

/** Duración del cache para resultados exitosos (1 hora) */
const CACHE_TTL_MS = 60 * 60 * 1000

/** Duración del cache para nombres sin resultado (30 min, permite reintentar antes) */
const CACHE_NOT_FOUND_TTL_MS = 30 * 60 * 1000

/** Cache: clave normalizada (minúsculas) → datos cacheados con expiración */
const wikiCache = new Map<string, { data: WikiEntry; expiry: number }>()

// ─── Constantes ───────────────────────────────────────────────────────────────

const WIKI_HEADERS = {
  'User-Agent': 'COMUNAS_NORM/1.0 (proyecto educativo; sin fines comerciales)',
  'Accept': 'application/json',
}

/** Máximo de títulos por petición que acepta la Action API para usuarios anónimos */
const MAX_TITULOS_POR_PETICION = 50

/** Tamaño de la miniatura solicitada a Wikipedia (px) */
const THUMB_SIZE = 400

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clave de cache: minúsculas para unificar variaciones de mayúsculas */
function toCacheKey(nombre: string): string {
  return nombre.trim().toLowerCase()
}

/**
 * Corrige numerales romanos mal capitalizados por el normalizador Title Case.
 * El normalizador convierte "II" → "Ii", "VIII" → "Viii", etc. y Wikipedia
 * usa mayúsculas para numerales romanos en títulos.
 * Ejemplos: "Queen Elizabeth Ii" → "Queen Elizabeth II", "Henry Viii" → "Henry VIII"
 */
function corregirNumeralesRomanos(nombre: string): string {
  return nombre.replace(/\b([IVXLCDMivxlcdm]+)\b/g, (match) => {
    const upper = match.toUpperCase()
    if (
      match !== upper &&
      upper.length <= 8 &&
      /^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(upper)
    ) {
      return upper
    }
    return match
  })
}

/**
 * Consulta la MediaWiki Action API para un lote de títulos (máximo 50).
 * Devuelve un Map de título-enviado → WikiEntry, resolviendo automáticamente
 * la normalización de mayúsculas y los redirects de Wikipedia.
 *
 * @param titulos - Lista de títulos a consultar (ya con numerales corregidos)
 * @param signal  - AbortSignal para cancelar la petición
 */
async function fetchLoteActionApi(
  titulos: string[],
  signal: AbortSignal,
): Promise<Map<string, WikiEntry>> {
  const resultado = new Map<string, WikiEntry>()
  if (titulos.length === 0) return resultado

  // Construir la URL de la Action API.
  // pilimit=max es CRÍTICO: sin él, pageimages solo devuelve thumbnail
  // para la primera página cuando se consultan múltiples títulos.
  const params = new URLSearchParams({
    action:       'query',
    format:       'json',
    prop:         'pageimages|description',
    piprop:       'thumbnail',
    pithumbsize:  String(THUMB_SIZE),
    pilimit:      'max',
    redirects:    '1',
    titles:       titulos.join('|'),
    origin:       '*',
  })
  const url = `https://en.wikipedia.org/w/api.php?${params.toString()}`

  const res = await fetch(url, { headers: WIKI_HEADERS, signal })
  if (!res.ok) {
    console.error(`[wiki] Action API → HTTP ${res.status} para ${titulos.length} títulos`)
    // Marcar todos como sin datos (no se cachean los errores aquí)
    return resultado
  }

  const data = (await res.json()) as MWResponse
  const query = data.query

  // ── Construir mapas de resolución de títulos ──────────────────────────────
  // normalized: corrige mayúsculas/formato del título enviado
  // redirects:  resuelve redirects (ej: "Mozart" → "Wolfgang Amadeus Mozart")
  const mapaNormalizado = new Map<string, string>()
  for (const n of query?.normalized ?? []) mapaNormalizado.set(n.from, n.to)

  const mapaRedirect = new Map<string, string>()
  for (const r of query?.redirects ?? []) mapaRedirect.set(r.from, r.to)

  // Indexar las páginas por su título final
  const paginasPorTitulo = new Map<string, MWPage>()
  for (const page of Object.values(query?.pages ?? {})) {
    paginasPorTitulo.set(page.title, page)
  }

  /**
   * Sigue la cadena de resolución de un título enviado hasta su título final:
   * enviado → normalizado → redirect (puede encadenar varios redirects).
   */
  function resolverTituloFinal(enviado: string): string {
    let actual = mapaNormalizado.get(enviado) ?? enviado
    // Seguir redirects encadenados (máximo 5 saltos por seguridad)
    for (let i = 0; i < 5; i++) {
      const siguiente = mapaRedirect.get(actual)
      if (!siguiente || siguiente === actual) break
      actual = siguiente
    }
    return actual
  }

  // ── Mapear cada título enviado a su resultado ─────────────────────────────
  for (const enviado of titulos) {
    const tituloFinal = resolverTituloFinal(enviado)
    const page = paginasPorTitulo.get(tituloFinal)

    const entry: WikiEntry = {
      descripcion: page?.description ?? null,
      foto:        page?.thumbnail?.source ?? null,
    }
    resultado.set(enviado, entry)
  }

  return resultado
}

/**
 * Obtiene los datos de Wikipedia para un conjunto de nombres, usando cache
 * y consultando solo los nombres no cacheados en lotes de 50.
 *
 * @param nombres - Nombres a enriquecer (tal como vienen del batch)
 * @param signal  - AbortSignal para cancelar
 * @returns Map de nombre-original → WikiEntry
 */
async function obtenerDatosWiki(
  nombres: string[],
  signal: AbortSignal,
): Promise<Map<string, WikiEntry>> {
  const resultado = new Map<string, WikiEntry>()
  const ahora = Date.now()

  // Separar los que están en cache de los que hay que pedir
  const porPedir: { original: string; corregido: string }[] = []
  for (const nombre of nombres) {
    const cacheKey = toCacheKey(nombre)
    const cached = wikiCache.get(cacheKey)
    if (cached && cached.expiry > ahora) {
      resultado.set(nombre, cached.data)
    } else {
      porPedir.push({ original: nombre, corregido: corregirNumeralesRomanos(nombre) })
    }
  }

  // Procesar los pendientes en lotes de MAX_TITULOS_POR_PETICION
  for (let i = 0; i < porPedir.length; i += MAX_TITULOS_POR_PETICION) {
    if (signal.aborted) break
    const lote = porPedir.slice(i, i + MAX_TITULOS_POR_PETICION)
    // Mapa título-corregido → nombre-original para devolver con la clave correcta
    const corregidoAOriginal = new Map<string, string>()
    for (const item of lote) corregidoAOriginal.set(item.corregido, item.original)

    try {
      const datosLote = await fetchLoteActionApi(
        lote.map((l) => l.corregido),
        signal,
      )

      for (const item of lote) {
        const entry = datosLote.get(item.corregido) ?? { descripcion: null, foto: null }
        resultado.set(item.original, entry)

        // Cachear: éxito 1 hora, sin-resultado 30 min
        const ttl = entry.foto || entry.descripcion ? CACHE_TTL_MS : CACHE_NOT_FOUND_TTL_MS
        wikiCache.set(toCacheKey(item.original), { data: entry, expiry: Date.now() + ttl })
      }
    } catch (e: unknown) {
      // Error de red/timeout en el lote: devolver vacío sin cachear (permite reintentar)
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[wiki] Error en lote: ${msg}`)
      for (const item of lote) {
        if (!resultado.has(item.original)) {
          resultado.set(item.original, { descripcion: null, foto: null })
        }
      }
    }
  }

  return resultado
}

// ─── Handler POST (lote, recomendado) ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !Array.isArray((body as { nombres?: unknown }).nombres)
  ) {
    return NextResponse.json({ error: 'Se requiere un array "nombres"' }, { status: 400 })
  }

  // Filtrar solo strings no vacíos y eliminar duplicados
  const nombresRaw = (body as { nombres: unknown[] }).nombres
  const nombres = Array.from(
    new Set(
      nombresRaw
        .filter((n): n is string => typeof n === 'string')
        .map((n) => n.trim())
        .filter((n) => n.length > 0),
    ),
  )

  if (nombres.length === 0) {
    return NextResponse.json({ resultados: {} })
  }

  // Timeout amplio: una sola petición batch responde en < 3 s normalmente
  const signal = AbortSignal.timeout(15000)

  try {
    const mapa = await obtenerDatosWiki(nombres, signal)
    const resultados: Record<string, WikiEntry> = {}
    for (const [nombre, entry] of mapa) resultados[nombre] = entry
    return NextResponse.json({ resultados })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[wiki POST] ${msg}`)
    return NextResponse.json({ resultados: {} })
  }
}

// ─── Handler GET (un solo nombre, compatibilidad) ───────────────────────────────

export async function GET(req: NextRequest) {
  const nombre = req.nextUrl.searchParams.get('nombre')?.trim()
  if (!nombre) {
    return NextResponse.json({ error: 'Parámetro "nombre" requerido' }, { status: 400 })
  }

  const signal = AbortSignal.timeout(15000)

  try {
    const mapa = await obtenerDatosWiki([nombre], signal)
    const entry = mapa.get(nombre) ?? { descripcion: null, foto: null }
    return NextResponse.json(entry)
  } catch {
    return NextResponse.json({ descripcion: null, foto: null })
  }
}
