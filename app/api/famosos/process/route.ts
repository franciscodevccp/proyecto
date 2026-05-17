/**
 * api/famosos/process/route.ts
 * Endpoint POST que recibe un archivo .txt de famosos,
 * lo procesa con procesarFamosos() y persiste el resultado en PostgreSQL.
 *
 * El archivo debe tener formato: "N. Nombre Completo - Fecha"
 * Soporta dryRun para previsualizar sin guardar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { procesarFamosos } from '../../../lib/famosos-parser'

/**
 * POST /api/famosos/process
 * FormData esperado:
 *   - file:    archivo .txt con la lista de famosos
 *   - dryRun: "true" para previsualizar sin guardar (opcional)
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const dryRun = form.get('dryRun') === 'true'

    if (!file) {
      return NextResponse.json({ error: 'No se recibio ningun archivo' }, { status: 400 })
    }

    // Solo se aceptan archivos .txt
    if (!file.name.toLowerCase().endsWith('.txt')) {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos .txt para famosos' },
        { status: 400 },
      )
    }

    const content = await file.text()
    if (!content.trim()) {
      return NextResponse.json({ error: 'El archivo esta vacio' }, { status: 400 })
    }

    // Ejecutar el parser de famosos
    const resultado = procesarFamosos(content)

    // En modo dryRun se retorna un preview sin guardar en la BD
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        fileName: file.name,
        totalInput: resultado.totalInput,
        totalOutput: resultado.totalOutput,
        duplicateCount: resultado.duplicateCount,
        cumpleanosCount: resultado.cumpleanosCount,
        // Primeros 20 para mostrar en la UI
        preview: resultado.famosos.slice(0, 20).map((f) => ({
          nombre: f.nombre,
          fechaOriginal: f.fechaOriginal,
          fechaNormalizada: f.fechaNormalizada,
          fechaAprox: f.fechaAprox,
          edad: f.edad,
          esCumpleanos: f.esCumpleanos,
        })),
        logs: resultado.logs.slice(0, 50),
      })
    }

    // Persistir batch + famosos en una sola transaccion
    const batch = await prisma.famosoBatch.create({
      data: {
        fileName: file.name,
        totalInput: resultado.totalInput,
        totalOutput: resultado.totalOutput,
        duplicates: resultado.duplicateCount,
        cumpleanos: resultado.cumpleanosCount,
        famosos: {
          create: resultado.famosos.map((f) => ({
            nombre: f.nombre,
            fechaOriginal: f.fechaOriginal,
            fechaNormalizada: f.fechaNormalizada,
            fechaAprox: f.fechaAprox,
            edad: f.edad,
            esCumpleanos: f.esCumpleanos,
          })),
        },
      },
    })

    return NextResponse.json({
      batchId: batch.id,
      fileName: batch.fileName,
      totalInput: batch.totalInput,
      totalOutput: batch.totalOutput,
      duplicateCount: batch.duplicates,
      cumpleanosCount: batch.cumpleanos,
      logs: resultado.logs,
    })
  } catch (error) {
    console.error('[famosos/process]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
