/**
 * api/process/route.ts
 * Endpoint POST que recibe un archivo de texto, lo parsea segun su formato,
 * ejecuta el pipeline ETL y persiste el resultado en PostgreSQL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { processFile } from '../../lib/normalizer'
import { parseContent } from '../../lib/parser'
import { resolveRuleSet } from '../../lib/etl-rules'

/**
 * POST /api/process
 * Espera un FormData con:
 *   - file:        archivo .txt, .csv o .tsv
 *   - correct:     "true" para activar correccion ortografica (opcional)
 *   - columnIndex: indice de columna a normalizar en CSV/TSV (default "0")
 *   - rules:       JSON con ETLRuleSet parcial (opcional)
 *   - dryRun:      "true" para procesar sin guardar en BD (opcional)
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const correct = form.get('correct') === 'true'
    const dryRun = form.get('dryRun') === 'true'
    const columnIndex = parseInt(form.get('columnIndex') as string ?? '0', 10) || 0

    // Parsear reglas ETL opcionales enviadas como JSON
    let partialRules = {}
    const rulesRaw = form.get('rules') as string | null
    if (rulesRaw) {
      try { partialRules = JSON.parse(rulesRaw) } catch { /* usar defaults */ }
    }

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

    // Validar extension permitida
    const validExtensions = ['.txt', '.csv', '.tsv']
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    if (!hasValidExt) {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos .txt, .csv o .tsv' },
        { status: 400 },
      )
    }

    const content = await file.text()
    if (!content.trim()) {
      return NextResponse.json({ error: 'El archivo esta vacio' }, { status: 400 })
    }

    // Parsear el archivo y extraer la columna correcta
    const parsed = parseContent(content, { columnIndex })

    // Resolver ruleset combinando defaults + opciones del usuario + flag correct
    const rules = resolveRuleSet({ ...partialRules, ...(correct ? { fuzzyCorrect: true } : {}) })

    // Ejecutar el pipeline ETL sobre las lineas ya parseadas
    const result = processFile(parsed.lines, { rules, correct })

    // En modo dryRun no se persiste nada en la BD
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        fileName: file.name,
        format: parsed.format,
        totalInput: result.totalInput,
        totalOutput: result.totalOutput,
        duplicates: result.duplicates,
        changes: result.changes,
        corrections: result.corrections,
        correctionMode: correct,
        qualityBefore: result.qualityBefore,
        qualityAfter: result.qualityAfter,
        // Preview: primeros 20 resultados para mostrar en la UI
        preview: result.logs.slice(0, 20).map((l) => ({
          original: l.original,
          normalized: l.normalized,
          changeType: l.changeType,
        })),
      })
    }

    // Persistir el batch con comunas y log en una sola transaccion
    const batch = await prisma.batch.create({
      data: {
        fileName: file.name,
        totalInput: result.totalInput,
        totalOutput: result.totalOutput,
        duplicates: result.duplicates,
        changes: result.changes,
        qualityBefore: result.qualityBefore.score,
        qualityAfter: result.qualityAfter.score,
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
      format: parsed.format,
      totalInput: batch.totalInput,
      totalOutput: batch.totalOutput,
      duplicates: batch.duplicates,
      changes: batch.changes,
      corrections: result.corrections,
      correctionMode: correct,
      qualityBefore: result.qualityBefore,
      qualityAfter: result.qualityAfter,
    })
  } catch (error) {
    console.error('[process]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
