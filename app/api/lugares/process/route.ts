/**
 * api/lugares/process/route.ts
 * Endpoint POST que recibe un archivo CSV de lugares turísticos,
 * lo procesa con procesarLugares() y persiste el resultado en PostgreSQL.
 *
 * Separadores soportados: ";" | "|" | "\t" (detectado automáticamente).
 * Encoding: se detecta automáticamente entre latin1 (Windows-1252) y UTF-8.
 * Duplicados: mismo nombre + misma georef (coords redondeadas a 3 decimales).
 * Soporta dryRun para previsualizar sin guardar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { procesarLugares, detectarEncoding } from '../../../lib/lugares-parser'
import { resolveRuleSet, type ETLRuleSet } from '../../../lib/etl-rules'

/**
 * Aplica las reglas ETL configuradas al texto del nombre del lugar.
 */
function aplicarReglas(texto: string, rules: ETLRuleSet): string {
  let s = texto
  if (rules['trim']) s = s.trim()
  if (rules['collapseSpaces']) s = s.replace(/\s+/g, ' ').trim()
  if (rules['removeAccents']) {
    // Usar escape Unicode explícito para evitar problemas de encoding en el fuente
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
  if (rules['titleCase']) {
    s = s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return s
}

/**
 * POST /api/lugares/process
 * FormData esperado:
 *   - file:    archivo CSV separado por ";" / "|" / tab (.txt, .csv o .tsv)
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

    // Se aceptan .txt, .csv y .tsv
    const nombre = file.name.toLowerCase()
    if (!nombre.endsWith('.txt') && !nombre.endsWith('.csv') && !nombre.endsWith('.tsv')) {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos .txt, .csv o .tsv para lugares' },
        { status: 400 },
      )
    }

    // Detectar encoding antes de decodificar:
    // Si el archivo es UTF-8 pero se leería como latin1, los acentos aparecerían como "Ã©", "Ã³", etc.
    const buffer = Buffer.from(await file.arrayBuffer())
    const encoding = detectarEncoding(buffer)
    const content = buffer.toString(encoding as BufferEncoding)

    if (!content.trim()) {
      return NextResponse.json({ error: 'El archivo esta vacio' }, { status: 400 })
    }

    // Ejecutar el parser de lugares
    const resultado = procesarLugares(content)

    // En modo dryRun se retorna un preview sin guardar en la BD
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        fileName: file.name,
        totalInput: resultado.totalInput,
        totalOutput: resultado.totalOutput,
        duplicateCount: resultado.duplicateCount,
        // Primeros 20 para mostrar en la UI
        preview: resultado.lugares.slice(0, 20).map((l) => ({
          nombre: l.nombre,
          rawDireccion: l.direccion.rawDireccion,
          pais: l.direccion.pais,
          latitud: l.georef?.latitud ?? null,
          longitud: l.georef?.longitud ?? null,
        })),
        logs: resultado.logs.slice(0, 50),
      })
    }

    // Persistir batch + lugares (con georef y direccion) en una sola transaccion
    const batch = await prisma.lugarBatch.create({
      data: {
        fileName: file.name,
        totalInput: resultado.totalInput,
        totalOutput: resultado.totalOutput,
        duplicates: resultado.duplicateCount,
        lugares: {
          create: resultado.lugares.map((l) => ({
            // Aplicar reglas ETL al nombre antes de guardar
            nombre: aplicarReglas(l.nombre, rules),
            // Georeferencia: solo si tiene coordenadas validas
            georef: l.georef
              ? {
                  create: {
                    latitud: l.georef.latitud,
                    longitud: l.georef.longitud,
                  },
                }
              : undefined,
            // Direccion: siempre se guarda (al menos el rawDireccion)
            direccion: {
              create: {
                nombreCalle: l.direccion.nombreCalle,
                numeroCalle: l.direccion.numeroCalle,
                ciudadEstadoProvincia: l.direccion.ciudadEstadoProvincia,
                pais: l.direccion.pais,
                rawDireccion: l.direccion.rawDireccion,
              },
            },
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
      logs: resultado.logs,
    })
  } catch (error) {
    console.error('[lugares/process]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
