import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

export async function GET(req: NextRequest) {
  const batchId = req.nextUrl.searchParams.get('batchId')
  if (!batchId) {
    return NextResponse.json({ error: 'batchId requerido' }, { status: 400 })
  }

  try {
    const comunas = await prisma.comuna.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, original: true, normalized: true },
    })
    return NextResponse.json({ comunas })
  } catch (error) {
    console.error('[comunas]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
