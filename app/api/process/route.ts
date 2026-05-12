import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { processFile } from '../../lib/normalizer'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    if (!file.name.endsWith('.txt')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos .txt' }, { status: 400 })
    }

    const content = await file.text()
    if (!content.trim()) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    const result = processFile(content)

    const batch = await prisma.batch.create({
      data: {
        fileName: file.name,
        totalInput: result.totalInput,
        totalOutput: result.totalOutput,
        duplicates: result.duplicates,
        changes: result.changes,
        comunas: {
          create: result.comunas.map((c) => ({
            original: c.original,
            normalized: c.normalized,
          })),
        },
        logs: {
          create: result.logs.map((l) => ({
            lineNumber: l.lineNumber,
            original: l.original,
            normalized: l.normalized,
            changeType: l.changeType,
            detail: l.detail,
          })),
        },
      },
    })

    return NextResponse.json({
      batchId: batch.id,
      fileName: batch.fileName,
      totalInput: batch.totalInput,
      totalOutput: batch.totalOutput,
      duplicates: batch.duplicates,
      changes: batch.changes,
    })
  } catch (error) {
    console.error('[process]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
