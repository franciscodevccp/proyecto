/**
 * api/famosos/download/route.ts
 * Endpoint GET que genera y descarga datos de un batch de famosos.
 * Formatos soportados:
 *   - csv  → CSV con BOM UTF-8 (compatible con Excel)
 *   - json → JSON estructurado con metadatos
 *   - txt  → Lista de texto plano con todos los famosos
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

/**
 * GET /api/famosos/download?batchId=XXX&type=csv|json|txt&sorted=true
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
    const batch = await prisma.famosoBatch.findUnique({ where: { id: batchId } })
    if (!batch) {
      return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
    }

    // Obtener famosos del batch, ordenados por fecha de creacion
    const famosos = await prisma.famoso.findMany({
      where: { batchId },
      orderBy: { createdAt: 'asc' },
    })

    // Ordenar alfabeticamente si se solicita
    if (sorted) {
      famosos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }

    const fechaExporto = new Date().toLocaleString('es-CL')

    // ── CSV ───────────────────────────────────────────────────────────
    if (type === 'csv') {
      const bom = '﻿'
      const filas = [
        'nombre;fecha_original;fecha_normalizada;fecha_aprox;edad;es_cumpleanos',
        ...famosos.map((f) =>
          [
            `"${f.nombre}"`,
            `"${f.fechaOriginal}"`,
            `"${f.fechaNormalizada ?? ''}"`,
            `"${f.fechaAprox ?? ''}"`,
            f.edad ?? '',
            f.esCumpleanos ? 'SI' : 'NO',
          ].join(';'),
        ),
      ]

      return new NextResponse(bom + filas.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="famosos_norm.csv"`,
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
          cumpleanos: batch.cumpleanos,
        },
        famosos: famosos.map((f) => ({
          nombre: f.nombre,
          fechaOriginal: f.fechaOriginal,
          fechaNormalizada: f.fechaNormalizada,
          fechaAprox: f.fechaAprox,
          edad: f.edad,
          esCumpleanos: f.esCumpleanos,
        })),
      }

      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="famosos_norm.json"`,
        },
      })
    }

    // ── TXT ───────────────────────────────────────────────────────────
    if (type === 'txt') {
      const encabezado = [
        `FAMOSOS NORMALIZADOS — Archivo: ${batch.fileName}`,
        `Exportado: ${fechaExporto}`,
        `Total: ${famosos.length} registros`,
        '='.repeat(60),
        '',
      ].join('\n')

      const lineas = famosos.map((f, i) => {
        const fecha = f.fechaNormalizada ?? f.fechaAprox ?? f.fechaOriginal
        const cumple = f.esCumpleanos ? ' 🎂' : ''
        return `${String(i + 1).padStart(3, '0')}. ${f.nombre} — ${fecha}${cumple}`
      })

      return new NextResponse('﻿' + encabezado + lineas.join('\n'), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="famosos_norm.txt"`,
        },
      })
    }

    return NextResponse.json(
      { error: 'Tipo invalido. Usa: csv, json, txt' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[famosos/download]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
