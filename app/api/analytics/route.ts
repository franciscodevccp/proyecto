/**
 * api/analytics/route.ts
 * Endpoint que retorna metricas agregadas de todos los batches historicos.
 * Usado por la pagina /analytics para mostrar KPIs globales y graficos.
 *
 * GET /api/analytics
 */

import { NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

export async function GET() {
  try {
    // Ejecutar las dos queries en paralelo para mayor eficiencia
    const [totals, batches] = await Promise.all([
      // Totales agregados de todos los batches
      prisma.batch.aggregate({
        _sum: {
          totalInput: true,
          totalOutput: true,
          duplicates: true,
          changes: true,
        },
        _count: { id: true },
        _avg: { qualityBefore: true },
      }),
      // Lista completa de batches para los graficos (del mas antiguo al mas reciente)
      prisma.batch.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          totalInput: true,
          totalOutput: true,
          duplicates: true,
          changes: true,
          qualityBefore: true,
          qualityAfter: true,
        },
      }),
    ])

    return NextResponse.json({ totals, batches })
  } catch (error) {
    console.error('[analytics]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
