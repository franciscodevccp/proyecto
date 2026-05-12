/**
 * api/process/route.ts
 * Endpoint POST que recibe un archivo .txt, ejecuta el pipeline de
 * normalización y persiste el resultado en la base de datos PostgreSQL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { processFile } from '../../lib/normalizer'

/**
 * POST /api/process
 * Espera un FormData con el campo "file" (archivo .txt).
 * Devuelve el ID del batch creado y las estadísticas del procesamiento.
 */
export async function POST(req: NextRequest) {
  try {
    // Leer el archivo desde el formulario multipart
    const form = await req.formData()
    const file = form.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
    }
    if (!file.name.endsWith('.txt')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos .txt' }, { status: 400 })
    }

    // Convertir el archivo a texto plano
    const content = await file.text()
    if (!content.trim()) {
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
    }

    // Ejecutar el pipeline de normalización sobre el contenido del archivo
    const result = processFile(content)

    // Persistir el batch junto con las comunas y el log en una sola transacción
    const batch = await prisma.batch.create({
      data: {
        fileName: file.name,
        totalInput: result.totalInput,
        totalOutput: result.totalOutput,
        duplicates: result.duplicates,
        changes: result.changes,
        // Crear todas las comunas normalizadas asociadas al batch
        comunas: {
          create: result.comunas.map((c) => ({
            original: c.original,
            normalized: c.normalized,
          })),
        },
        // Crear todas las entradas del log de cambios
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

    // Retornar el ID del batch y las estadísticas para el dashboard
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
