import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

export async function GET(req: NextRequest) {
  const batchId = req.nextUrl.searchParams.get('batchId')
  const type = req.nextUrl.searchParams.get('type') // 'csv' | 'log'

  if (!batchId || !type) {
    return NextResponse.json({ error: 'batchId y type son requeridos' }, { status: 400 })
  }

  try {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } })
    if (!batch) {
      return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
    }

    if (type === 'csv') {
      const comunas = await prisma.comuna.findMany({
        where: { batchId },
        orderBy: { createdAt: 'asc' },
      })
      const rows = ['original,normalizado', ...comunas.map((c: { original: string; normalized: string }) => `"${c.original}","${c.normalized}"`)]
      return new NextResponse(rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="comunas_${batchId}.csv"`,
        },
      })
    }

    if (type === 'log') {
      const logs = await prisma.logEntry.findMany({
        where: { batchId },
        orderBy: { lineNumber: 'asc' },
      })
      const header = `LOG DE NORMALIZACIÓN — Archivo: ${batch.fileName}\nFecha: ${new Date(batch.createdAt).toLocaleString('es-CL')}\n${'='.repeat(60)}\n`
      const lines = logs.map(
        (l) =>
          `Línea ${String(l.lineNumber).padStart(4, '0')} [${l.changeType.toUpperCase().padEnd(10)}] "${l.original}" → "${l.normalized}"${l.detail ? ` (${l.detail})` : ''}`,
      )
      const footer = `\n${'='.repeat(60)}\nTotal entrada: ${batch.totalInput} | Únicos: ${batch.totalOutput} | Duplicados: ${batch.duplicates} | Normalizados: ${batch.changes}`

      return new NextResponse(header + lines.join('\n') + footer, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="log_${batchId}.txt"`,
        },
      })
    }

    return NextResponse.json({ error: 'Tipo inválido. Usa csv o log' }, { status: 400 })
  } catch (error) {
    console.error('[download]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
