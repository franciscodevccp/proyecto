/**
 * api/famosos/batch/route.ts
 * Endpoints para gestionar batches del modulo de famosos.
 *   GET    /api/famosos/batch          → lista los ultimos batches (paginado)
 *   GET    /api/famosos/batch?id=X     → obtiene un batch especifico con sus famosos
 *   DELETE /api/famosos/batch?id=X     → elimina un batch y todos sus famosos (cascade)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { Prisma } from '../../../generated/prisma/client'
import { esCumpleanosHoy } from '../../../lib/date-parser'

/**
 * GET /api/famosos/batch
 * Con ?id=X retorna el batch con la lista de famosos.
 * Sin ?id retorna los ultimos 20 batches ordenados por fecha descendente.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  // Obtener un batch especifico con sus famosos
  if (id) {
    try {
      const batch = await prisma.famosoBatch.findUnique({
        where: { id },
        include: {
          famosos: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })
      if (!batch) {
        return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
      }

      // Recalcular esCumpleanos en tiempo de consulta para que sea siempre
      // preciso, sin depender del valor almacenado al procesar el batch.
      const famososActualizados = batch.famosos.map((f) => ({
        ...f,
        esCumpleanos: esCumpleanosHoy(f.fechaNormalizada),
      }))

      return NextResponse.json({ batch: { ...batch, famosos: famososActualizados } })
    } catch (error) {
      console.error('[famosos/batch GET single]', error)
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
  }

  // Listar batches paginados
  const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get('page')  ?? '1',  10))
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)))

  try {
    // M-08: incluir total y totalPages en la respuesta de lista para que los
    // consumidores puedan paginar correctamente sin hacer una segunda petición.
    const [batches, total] = await Promise.all([
      prisma.famosoBatch.findMany({
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
          cumpleanos: true,
        },
      }),
      prisma.famosoBatch.count(),
    ])

    return NextResponse.json({ batches, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[famosos/batch GET list]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/famosos/batch?id=X
 * Elimina el batch y todos sus famosos via onDelete: Cascade del schema.
 */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id es requerido' }, { status: 400 })
  }

  try {
    await prisma.famosoBatch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    // M-04: capturar P2025 para devolver 404 en lugar de 500 cuando el batch no existe
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
    }
    console.error('[famosos/batch DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar el batch' }, { status: 500 })
  }
}
