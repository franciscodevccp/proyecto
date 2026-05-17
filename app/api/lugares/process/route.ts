/**
 * api/lugares/process/route.ts
 * Endpoint POST que recibe un archivo CSV separado por ";" de lugares turísticos,
 * lo procesa con procesarLugares() y persiste el resultado en PostgreSQL.
 *
 * El archivo usa encoding Windows-1252 → se lee con latin1 antes de procesar.
 * Duplicados: mismo nombre + misma georef (coords redondeadas a 3 decimales).
 * Soporta dryRun para previsualizar sin guardar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { procesarLugares } from '../../../lib/lugares-parser'

/**
 * POST /api/lugares/process
 * FormData esperado:
 *   - file:    archivo CSV separado por ";" (puede ser .txt o .csv)
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

    // Validar extension
    const nombre = file.name.toLowerCase()
    if (!nombre.endsWith('.txt') && !nombre.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos .txt o .csv para lugares' },
        { status: 400 },
      )
    }

    // Leer con latin1 para manejar encoding Windows-1252 del archivo original
    const buffer = await file.arrayBuffer()
    const content = Buffer.from(buffer).toString('latin1')

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
            nombre: l.nombre,
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
