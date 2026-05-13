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

/** Limite de registros por llamada para evitar abusos */
const MAX_RECORDS = 10_000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validar que 'data' sea un array de strings
    if (!Array.isArray(body.data)) {
      return NextResponse.json(
        { error: 'El campo "data" debe ser un array de strings' },
        { status: 400 },
      )
    }

    if (body.data.length > MAX_RECORDS) {
      return NextResponse.json(
        { error: `Maximo ${MAX_RECORDS} registros por llamada` },
        { status: 400 },
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

    return NextResponse.json({
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
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
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
