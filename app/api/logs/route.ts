import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

export async function GET(req: NextRequest) {
  const batchId = req.nextUrl.searchParams.get('batchId')
  if (!batchId) {
    return NextResponse.json({ error: 'batchId requerido' }, { status: 400 })
  }

  try {
    const logs = await prisma.logEntry.findMany({
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
    })
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('[logs]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
