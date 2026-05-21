/**
 * api/famosos/batch/route.ts
 * Endpoints para gestionar batches del modulo de famosos.
 *   GET    /api/famosos/batch          → lista los ultimos batches (paginado)
 *   GET    /api/famosos/batch?id=X     → obtiene un batch especifico con sus famosos
 *   DELETE /api/famosos/batch?id=X     → elimina un batch y todos sus famosos (cascade)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

/**
 * Calcula si un famoso cumple años HOY a partir de su fecha normalizada (DD-MM-YYYY).
 * Se evalúa en tiempo de consulta para que el valor sea siempre correcto
 * independientemente de cuándo se procesó el batch original.
 */
function cumpleHoy(fechaNormalizada: string | null): boolean {
  if (!fechaNormalizada) return false
  const partes = fechaNormalizada.split('-')
  if (partes.length !== 3) return false
  const dia = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10)
  if (isNaN(dia) || isNaN(mes) || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false
  const hoy = new Date()
  return mes === hoy.getMonth() + 1 && dia === hoy.getDate()
}

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
        esCumpleanos: cumpleHoy(f.fechaNormalizada),
      }))

      return NextResponse.json({ batch: { ...batch, famosos: famososActualizados } })
    } catch (error) {
      console.error('[famosos/batch GET single]', error)
      return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
  }

  // Listar batches paginados
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10)
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)

  try {
    const batches = await prisma.famosoBatch.findMany({
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
    })

    return NextResponse.json({ batches })
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
    console.error('[famosos/batch DELETE]', error)
    return NextResponse.json({ error: 'Error al eliminar el batch' }, { status: 500 })
  }
}
