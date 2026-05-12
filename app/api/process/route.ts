/**
 * api/process/route.ts
 * Endpoint POST que recibe un archivo .txt, ejecuta el pipeline de
 * normalizacion y persiste el resultado en la base de datos PostgreSQL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { processFile } from '../../lib/normalizer'

/**
 * POST /api/process
 * Espera un FormData con:
 *   - file: archivo .txt con los nombres de comunas
 *   - correct: "true" para activar correccion ortografica por fuzzy matching (opcional)
 * Devuelve el ID del batch creado y las estadisticas del procesamiento.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const correct = form.get('correct') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No se recibio ningun archivo' }, { status: 400 })
    }
    if (!file.name.endsWith('.txt')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos .txt' }, { status: 400 })
    }

    const content = await file.text()
    if (!content.trim()) {
      return NextResponse.json({ error: 'El archivo esta vacio' }, { status: 400 })
    }

    // Ejecutar el pipeline con la opcion de correccion ortografica
    const result = processFile(content, { correct })

    // Persistir el batch junto con las comunas y el log en una sola transaccion
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
      corrections: result.corrections,
      correctionMode: correct,
    })
  } catch (error) {
    console.error('[process]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
