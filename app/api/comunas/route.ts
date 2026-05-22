/**
 * api/comunas/route.ts
 * Devuelve las comunas normalizadas de un batch con paginación.
 * M-05: se añadió paginación para evitar cargar todos los registros en memoria.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

export async function GET(req: NextRequest) {
  const batchId = req.nextUrl.searchParams.get('batchId')
  if (!batchId) {
    return NextResponse.json({ error: 'batchId requerido' }, { status: 400 })
  }

  const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page')  ?? '1',  10))
  const limit = Math.min(2000, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '500', 10)))

  try {
    const [comunas, total] = await Promise.all([
      prisma.comuna.findMany({
        where: { batchId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, original: true, normalized: true },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.comuna.count({ where: { batchId } }),
    ])
    return NextResponse.json({ comunas, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[comunas]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
