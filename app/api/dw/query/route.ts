/**
 * /api/dw/query
 * Endpoint de SOLO LECTURA para el Data Warehouse poblado en SQLite (Nivel 3).
 *
 * - GET sin `op`            → resumen del DW (total de hechos) o estado "no poblado".
 * - GET con `op=<id>`       → ejecuta esa operación OLAP del catálogo cerrado.
 *
 * Solo se aceptan los ids del catálogo (CONSULTAS_OLAP); no hay SQL arbitrario,
 * por lo que no existe superficie de inyección. Si el DW no fue poblado (no hay
 * datawarehouse.db, p.ej. en desarrollo local sin acceso a la BD operacional),
 * se responde { ok:false, reason:'not_populated' } para degradar elegante.
 */

import { NextRequest, NextResponse } from 'next/server'
import { dwDisponible, ejecutarOlap, dwResumen } from '../../../lib/dw-sqlite'
import { CONSULTAS_OLAP, type OperacionId } from '../../../lib/dw-model'

// Lee un archivo en runtime: nunca se evalúa en build (evita cargar el binding nativo).
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Conjunto de operaciones permitidas (ids del catálogo). */
const OPS_PERMITIDAS = new Set<string>(CONSULTAS_OLAP.map((c) => c.id))

export async function GET(req: NextRequest) {
  if (!dwDisponible()) {
    return NextResponse.json({ ok: false, reason: 'not_populated' })
  }

  const op = req.nextUrl.searchParams.get('op')

  try {
    // Sin operación → resumen del DW.
    if (!op) {
      const resumen = await dwResumen()
      return NextResponse.json({ ok: true, ...resumen })
    }

    // Validación contra el catálogo cerrado.
    if (!OPS_PERMITIDAS.has(op)) {
      return NextResponse.json({ ok: false, reason: 'invalid_op' }, { status: 400 })
    }

    const resultado = await ejecutarOlap(op as OperacionId)
    return NextResponse.json({ ok: true, op, ...resultado })
  } catch (e) {
    return NextResponse.json(
      { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Error desconocido' },
      { status: 500 },
    )
  }
}
