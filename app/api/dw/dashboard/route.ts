/**
 * /api/dw/dashboard
 * Endpoint de SOLO LECTURA para el dashboard ejecutivo (/dashboard).
 *
 * Mismo mecanismo de catálogo cerrado que /api/dw/query: el cliente elige una
 * operación por id (DASHBOARD_OPS) y envía filtros OPCIONALES por querystring.
 * Los filtros se validan contra una lista blanca y se pasan como parámetros
 * ligados; nunca se ejecuta SQL del cliente. Si el DW no fue poblado, degrada a
 * { ok:false, reason:'not_populated' }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { dwDisponible, ejecutarDashboard, DASHBOARD_OPS, type DashboardOp } from '../../../lib/dw-sqlite'

// Se lee el SQLite en runtime; nunca en build (evita cargar el binding nativo).
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Operaciones permitidas del dashboard (catálogo cerrado). */
const OPS_PERMITIDAS = new Set<string>(DASHBOARD_OPS)

export async function GET(req: NextRequest) {
  if (!dwDisponible()) {
    return NextResponse.json({ ok: false, reason: 'not_populated' })
  }

  const sp = req.nextUrl.searchParams
  const op = sp.get('op')

  // Validación contra el catálogo cerrado.
  if (!op || !OPS_PERMITIDAS.has(op)) {
    return NextResponse.json({ ok: false, reason: 'invalid_op' }, { status: 400 })
  }

  // Filtros crudos; se validan/tipan dentro de ejecutarDashboard (lista blanca).
  const raw = {
    id_modulo: sp.get('id_modulo'),
    id_fuente: sp.get('id_fuente'),
    fecha_desde: sp.get('fecha_desde'),
    fecha_hasta: sp.get('fecha_hasta'),
    region: sp.get('region'),
    pais: sp.get('pais'),
    limite: sp.get('limite'),
  }

  try {
    const data = await ejecutarDashboard(op as DashboardOp, raw)
    return NextResponse.json({ ok: true, op, data })
  } catch (e) {
    return NextResponse.json(
      { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'Error desconocido' },
      { status: 500 },
    )
  }
}
