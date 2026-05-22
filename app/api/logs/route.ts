/**
 * api/logs/route.ts
 * Devuelve el log de normalización de un batch con paginación.
 * M-06: se añadió paginación para evitar cargar todos los log entries en memoria.
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
    const [logs, total] = await Promise.all([
      prisma.logEntry.findMany({
        where: { batchId },
        orderBy: { lineNumber: 'asc' },
        select: {
          id: true,
          lineNumber: true,
          original: true,
          normalized: true,
          changeType: true,
          detail: true,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.logEntry.count({ where: { batchId } }),
    ])
    return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error('[logs]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
