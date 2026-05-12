/**
 * api/download/route.ts
 * Endpoint GET que genera y descarga archivos desde un batch:
 * - type=csv → CSV con BOM UTF-8 y delimitador punto y coma (compatible con Excel español)
 * - type=log → TXT con el log detallado de cambios
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

/**
 * GET /api/download?batchId=XXX&type=csv|log
 * Retorna el archivo como descarga directa con los headers correctos.
 */
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

      // Usar punto y coma como separador (estándar en Excel con configuración regional española)
      // Encerrar valores entre comillas para manejar posibles comas internas
      const rows = [
        'original;normalizado',
        ...comunas.map(
          (c: { original: string; normalized: string }) =>
            `"${c.original}";"${c.normalized}"`,
        ),
      ]

      // Agregar BOM UTF-8 (﻿) para que Excel reconozca correctamente la codificación
      const bom = '﻿'
      const csvContent = bom + rows.join('\n')

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="comunas_norm.csv"`,
        },
      })
    }

    if (type === 'log') {
      const logs = await prisma.logEntry.findMany({
        where: { batchId },
        orderBy: { lineNumber: 'asc' },
      })

      // Encabezado del log con metadatos del batch
      const header = `LOG DE NORMALIZACIÓN — Archivo: ${batch.fileName}\nFecha: ${new Date(batch.createdAt).toLocaleString('es-CL')}\n${'='.repeat(60)}\n`

      // Una línea por registro con: número, tipo de cambio, original y normalizado
      const lines = logs.map(
        (l) =>
          `Línea ${String(l.lineNumber).padStart(4, '0')} [${l.changeType.toUpperCase().padEnd(10)}] "${l.original}" → "${l.normalized}"${l.detail ? ` (${l.detail})` : ''}`,
      )

      // Pie de página con resumen estadístico
      const footer = `\n${'='.repeat(60)}\nTotal entrada: ${batch.totalInput} | Únicos: ${batch.totalOutput} | Duplicados: ${batch.duplicates} | Normalizados: ${batch.changes}`

      // BOM UTF-8 para que el bloc de notas y Excel lean correctamente los acentos
      const bom = '﻿'

      return new NextResponse(bom + header + lines.join('\n') + footer, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="log_normalizacion.txt"`,
        },
      })
    }

    return NextResponse.json({ error: 'Tipo inválido. Usa csv o log' }, { status: 400 })
  } catch (error) {
    console.error('[download]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
