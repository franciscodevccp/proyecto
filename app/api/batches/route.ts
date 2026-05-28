/**
 * api/batches/route.ts
 * Endpoints para gestionar el historial de batches procesados.
 *   GET  /api/batches        → lista los ultimos 20 batches
 *   DELETE /api/batches?id=X → elimina un batch y todos sus datos (cascade)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

const BATCH_SELECT = {
  id: true,
  fileName: true,
  createdAt: true,
  totalInput: true,
  totalOutput: true,
  duplicates: true,
  changes: true,
  qualityBefore: true,
  noEncontrados: true,
} as const

/**
 * GET /api/batches?id=X   → retorna un batch especifico
 * GET /api/batches?page=1&limit=20  → lista paginada
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    try {
      const batch = await prisma.batch.findUnique({ where: { id }, select: BATCH_SELECT })
      if (!batch) return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
      return NextResponse.json({ batch })
    } catch (error) {
      console.error('[batches GET single]', error)
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
  }

  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)

  try {
    // Solicitar lista paginada y total en paralelo para una sola ida a la BD
    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: BATCH_SELECT,
      }),
      prisma.batch.count(),
    ])

    return NextResponse.json({
      batches,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('[batches GET]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/batches?id=X
 * Elimina el batch indicado junto con todas sus comunas y entradas de log
 * gracias al onDelete: Cascade definido en el schema de Prisma.
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
  }

  try {
    await prisma.batch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[batches DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar el batch' }, { status: 500 })
  }
}
