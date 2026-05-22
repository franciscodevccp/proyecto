/**
 * api/public/normalize/route.ts
 * Endpoint publico REST para normalizar texto sin necesidad de la UI.
 * Disenado para integracion con pipelines ETL externos, scripts y APIs.
 * No persiste datos en la base de datos.
 *
 * POST /api/public/normalize
 * Body JSON:
 * {
 *   "data": ["Santiago", "CONCEPCION", "valparaiso"],
 *   "rules": { "removeAccents": true, "titleCase": true }   // opcional
 * }
 *
 * Response:
 * {
 *   "results": [
 *     { "original": "Santiago", "normalized": "Santiago", "changed": false },
 *     { "original": "CONCEPCION", "normalized": "Concepcion", "changed": true }
 *   ],
 *   "stats": { "total": 2, "changed": 1, "duplicates": 0 }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { processFile } from '../../../lib/normalizer'
import { resolveRuleSet } from '../../../lib/etl-rules'

/** Límite de registros por llamada para evitar abusos */
const MAX_RECORDS = 10_000

// ─── Rate limiting en memoria (ventana deslizante) ────────────────────────────

/** Máximo de peticiones permitidas por IP en la ventana de tiempo */
const RATE_LIMIT_MAX = 10
/** Duración de la ventana de tiempo en milisegundos */
const RATE_LIMIT_WINDOW_MS = 60_000
/** Mapa IP → lista de timestamps dentro de la ventana activa */
const rateLimitMap = new Map<string, number[]>()

/**
 * Comprueba si la IP indicada puede realizar una petición.
 * Implementa ventana deslizante: solo se cuentan las peticiones
 * realizadas dentro del último minuto.
 *
 * @returns true si la petición está permitida, false si se superó el límite
 */
function checkRateLimit(ip: string): boolean {
  const ahora = Date.now()
  const ventanaInicio = ahora - RATE_LIMIT_WINDOW_MS
  const previos = (rateLimitMap.get(ip) ?? []).filter((t) => t > ventanaInicio)

  if (previos.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, previos)
    return false
  }

  previos.push(ahora)
  rateLimitMap.set(ip, previos)
  return true
}

/**
 * Headers CORS necesarios en todas las respuestas del endpoint público.
 * El preflight OPTIONS los devuelve, pero el POST también debe incluirlos
 * o el browser bloqueará la respuesta real tras el preflight exitoso.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const

/**
 * Crea una respuesta JSON con los headers CORS incluidos.
 * Usar en lugar de NextResponse.json() en todos los returns del handler POST.
 */
function corsJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  // Verificar rate limit antes de cualquier procesamiento
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return corsJson({ error: 'Demasiadas peticiones. Espera 60 segundos e intenta de nuevo.' }, 429)
  }

  try {
    const body = await req.json()

    // Validar que 'data' sea un array de strings
    if (!Array.isArray(body.data)) {
      return corsJson({ error: 'El campo "data" debe ser un array de strings' }, 400)
    }

    if (body.data.length > MAX_RECORDS) {
      return corsJson({ error: `Maximo ${MAX_RECORDS} registros por llamada` }, 400)
    }

    // A-01: Validar que cada elemento del array sea un string (no number, null, object…)
    const indexNoString = (body.data as unknown[]).findIndex((item) => typeof item !== 'string')
    if (indexNoString !== -1) {
      return corsJson(
        { error: `El elemento en el índice ${indexNoString} no es un string` },
        400,
      )
    }

    // Resolver reglas ETL (parciales o todas por defecto)
    const rules = resolveRuleSet(body.rules ?? {})

    // Ejecutar el pipeline sin persistir en BD
    const result = processFile(body.data as string[], { rules })

    // Construir el mapa original → normalizado para el response
    const normalizedMap = new Map(result.comunas.map((c) => [c.original, c.normalized]))

    // Armar los resultados individuales
    const results = (body.data as string[]).map((item: string) => {
      const normalized = normalizedMap.get(item) ?? item
      return {
        original: item,
        normalized,
        changed: item !== normalized,
      }
    })

    return corsJson({
      results,
      stats: {
        total: result.totalInput,
        changed: result.changes + result.corrections,
        duplicates: result.duplicates,
        qualityBefore: result.qualityBefore.score,
        qualityAfter: result.qualityAfter.score,
      },
    })
  } catch (error) {
    console.error('[public/normalize]', error)
    return corsJson({ error: 'Error interno del servidor' }, 500)
  }
}

/** Metodo OPTIONS para permitir CORS desde clientes externos */
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
