/**
 * api/lugares/download/route.ts
 * Endpoint GET que genera y descarga datos de un batch de lugares turísticos.
 * Formatos soportados:
 *   - csv  → CSV con BOM UTF-8 (compatible con Excel)
 *   - json → JSON estructurado con metadatos, georef y direccion
 *   - txt  → Lista de texto plano con nombre y país
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { generateLugaresSQL } from '../../../lib/exporters'

/**
 * GET /api/lugares/download?batchId=XXX&type=csv|json|txt&sorted=true
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const batchId = p.get('batchId')
  const type = p.get('type') ?? 'csv'
  const sorted = p.get('sorted') === 'true'

  if (!batchId) {
    return NextResponse.json({ error: 'batchId es requerido' }, { status: 400 })
  }

  try {
    const batch = await prisma.lugarBatch.findUnique({ where: { id: batchId } })
    if (!batch) {
      return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
    }

    // Obtener lugares con sus relaciones incluidas
    const lugares = await prisma.lugar.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
      include: {
        georef: true,
        direccion: true,
      },
    })

    // Ordenar alfabeticamente por nombre si se solicita
    if (sorted) {
      lugares.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }

    const fechaExporto = new Date().toLocaleString('es-CL')

    // ── CSV ───────────────────────────────────────────────────────────
    if (type === 'csv') {
      const bom = '﻿'
      const filas = [
        'nombre;calle;numero;ciudad_estado;pais;latitud;longitud;direccion_raw',
        ...lugares.map((l) =>
          [
            `"${l.nombre}"`,
            `"${l.direccion?.nombreCalle ?? ''}"`,
            `"${l.direccion?.numeroCalle ?? ''}"`,
            `"${l.direccion?.ciudadEstadoProvincia ?? ''}"`,
            `"${l.direccion?.pais ?? ''}"`,
            l.georef?.latitud ?? '',
            l.georef?.longitud ?? '',
            `"${l.direccion?.rawDireccion ?? ''}"`,
          ].join(';'),
        ),
      ]

      return new NextResponse(bom + filas.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="lugares_turisticos.csv"`,
        },
      })
    }

    // ── JSON ──────────────────────────────────────────────────────────
    if (type === 'json') {
      const payload = {
        meta: {
          archivo: batch.fileName,
          exportado: fechaExporto,
          totalInput: batch.totalInput,
          totalOutput: batch.totalOutput,
          duplicados: batch.duplicates,
        },
        lugares: lugares.map((l) => ({
          nombre: l.nombre,
          georef: l.georef
            ? { latitud: l.georef.latitud, longitud: l.georef.longitud }
            : null,
          direccion: l.direccion
            ? {
                calle: l.direccion.nombreCalle,
                numero: l.direccion.numeroCalle,
                ciudadEstado: l.direccion.ciudadEstadoProvincia,
                pais: l.direccion.pais,
                raw: l.direccion.rawDireccion,
              }
            : null,
        })),
      }

      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="lugares_turisticos.json"`,
        },
      })
    }

    // ── TXT ───────────────────────────────────────────────────────────
    if (type === 'txt') {
      const encabezado = [
        `LUGARES TURÍSTICOS — Archivo: ${batch.fileName}`,
        `Exportado: ${fechaExporto}`,
        `Total: ${lugares.length} registros`,
        '='.repeat(60),
        '',
      ].join('\n')

      const lineas = lugares.map((l, i) => {
        const pais = l.direccion?.pais ?? 'País desconocido'
        const coords = l.georef
          ? ` [${l.georef.latitud.toFixed(4)}, ${l.georef.longitud.toFixed(4)}]`
          : ''
        return `${String(i + 1).padStart(3, '0')}. ${l.nombre} — ${pais}${coords}`
      })

      return new NextResponse('﻿' + encabezado + lineas.join('\n'), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="lugares_turisticos.txt"`,
        },
      })
    }

    // ── SQL (3 tablas con FK) ─────────────────────────────────────────
    if (type === 'sql') {
      const sql = generateLugaresSQL(lugares.map((l) => ({
        nombre: l.nombre,
        georef: l.georef
          ? { latitud: l.georef.latitud, longitud: l.georef.longitud }
          : null,
        direccion: l.direccion
          ? {
              nombreCalle:            l.direccion.nombreCalle,
              numeroCalle:            l.direccion.numeroCalle,
              ciudadEstadoProvincia:  l.direccion.ciudadEstadoProvincia,
              pais:                   l.direccion.pais,
              rawDireccion:           l.direccion.rawDireccion,
            }
          : null,
      })))

      return new NextResponse(sql, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="lugares_norm.sql"`,
        },
      })
    }

    return NextResponse.json(
      { error: 'Tipo invalido. Usa: csv, json, txt, sql' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[lugares/download]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
