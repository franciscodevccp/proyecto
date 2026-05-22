/**
 * api/lugares/batch/route.ts
 * Endpoints para gestionar batches del modulo de lugares turisticos.
 *   GET    /api/lugares/batch          → lista los ultimos batches (paginado)
 *   GET    /api/lugares/batch?id=X     → obtiene un batch especifico con sus lugares
 *   DELETE /api/lugares/batch?id=X     → elimina un batch y todos sus datos (cascade)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { Prisma } from '../../../generated/prisma/client'

/**
 * GET /api/lugares/batch
 * Con ?id=X retorna el batch con lugares, georef y direccion incluidos.
 * Sin ?id retorna los ultimos batches en orden descendente.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  // Obtener un batch especifico con todos sus datos relacionados
  if (id) {
    try {
      const batch = await prisma.lugarBatch.findUnique({
        where: { id },
        include: {
          lugares: {
            orderBy: { createdAt: 'asc' },
            include: {
              georef: true,
              direccion: true,
            },
          },
        },
      })
      if (!batch) {
        return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
      }
      return NextResponse.json({ batch })
    } catch (error) {
      console.error('[lugares/batch GET single]', error)
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
  }

  // Listar batches paginados
  const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page')  ?? '1',  10))
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)))

  try {
    // M-08: incluir total y totalPages para que los consumidores puedan paginar
    const [batches, total] = await Promise.all([
      prisma.lugarBatch.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          totalInput: true,
          totalOutput: true,
          duplicates: true,
        },
      }),
      prisma.lugarBatch.count(),
    ])

    return NextResponse.json({ batches, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[lugares/batch GET list]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/lugares/batch?id=X
 * Elimina el batch y todos sus lugares (con georef y direccion) via cascade.
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
  }

  try {
    await prisma.lugarBatch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    // M-04: capturar P2025 para devolver 404 cuando el batch no existe
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
    }
    console.error('[lugares/batch DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar el batch' }, { status: 500 })
  }
}
