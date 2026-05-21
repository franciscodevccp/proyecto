/**
 * api/famosos/process/route.ts
 * Endpoint POST que recibe un archivo de famosos,
 * lo procesa con procesarFamosos() y persiste el resultado en PostgreSQL.
 *
 * Formatos soportados: "N. Nombre - Fecha", "Nombre | Fecha", "Nombre, Fecha", etc.
 * El parser detecta el separador automáticamente.
 * Soporta dryRun para previsualizar sin guardar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { procesarFamosos } from '../../../lib/famosos-parser'
import { resolveRuleSet, type ETLRuleSet } from '../../../lib/etl-rules'
import { normalizeText } from '../../../lib/normalizer'

/**
 * POST /api/famosos/process
 * FormData esperado:
 *   - file:    archivo .txt, .csv o .tsv con la lista de famosos
 *   - rules:   JSON con ETLRuleSet parcial (opcional)
 *   - dryRun: "true" para previsualizar sin guardar (opcional)
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const dryRun = form.get('dryRun') === 'true'

    // Parsear reglas ETL opcionales enviadas como JSON
    let partialRules: Partial<ETLRuleSet> = {}
    const rulesRaw = form.get('rules') as string | null
    if (rulesRaw) {
      try { partialRules = JSON.parse(rulesRaw) } catch { /* usar defaults */ }
    }
    const rules = resolveRuleSet(partialRules)

    if (!file) {
      return NextResponse.json({ error: 'No se recibio ningun archivo' }, { status: 400 })
    }

    /** Tamaño máximo permitido por archivo: 10 MB */
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Archivo demasiado grande. Máximo permitido: 10 MB (recibido: ${(file.size / 1024 / 1024).toFixed(1)} MB)` },
        { status: 413 },
      )
    }

    // Se aceptan .txt, .csv y .tsv
    const nombre = file.name.toLowerCase()
    if (!nombre.endsWith('.txt') && !nombre.endsWith('.csv') && !nombre.endsWith('.tsv')) {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos .txt, .csv o .tsv para famosos' },
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
            // Aplicar reglas ETL al nombre antes de guardar
            nombre: normalizeText(f.nombre, rules),
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
