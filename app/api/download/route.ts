/**
 * api/download/route.ts
 * Endpoint GET que genera y descarga archivos desde un batch.
 * Tipos soportados:
 *   - csv   → CSV con BOM UTF-8 y delimitador punto y coma (Excel espanol)
 *   - log   → TXT con el log detallado de cambios
 *   - json  → JSON estructurado con metadatos y array de resultados
 *   - xlsx  → Excel nativo con dos hojas (datos + resumen)
 *   - sql   → Script SQL para PostgreSQL, MySQL o SQLite
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { generateSQL, generateJSON, generateExcel, type SQLDialect } from '../../lib/exporters'

/**
 * GET /api/download?batchId=XXX&type=csv|log|json|xlsx|sql
 * Para SQL acepta parametros adicionales:
 *   - dialect: postgresql | mysql | sqlite (default: postgresql)
 *   - tableName: nombre de la tabla (default: datos_norm)
 *   - includeOriginal: true | false (default: true)
 *   - includeIndex: true | false (default: true)
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const batchId = p.get('batchId')
  const type = p.get('type')
  const sorted = p.get('sorted') === 'true'

  if (!batchId || !type) {
    return NextResponse.json({ error: 'batchId y type son requeridos' }, { status: 400 })
  }

  try {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } })
    if (!batch) {
      return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })
    }

    // ── CSV ───────────────────────────────────────────────────────────
    if (type === 'csv') {
      const comunas = await prisma.comuna.findMany({
        where: { batchId },
        orderBy: { createdAt: 'asc' },
      })
      if (sorted) comunas.sort((a, b) => a.normalized.localeCompare(b.normalized, 'es'))

      const bom = '﻿'
      const rows = [
        'original;normalizado',
        ...comunas.map(
          (c: { original: string; normalized: string }) =>
            `"${c.original}";"${c.normalized}"`,
        ),
      ]

      return new NextResponse(bom + rows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="comunas_norm.csv"`,
        },
      })
    }

    // ── LOG TXT ───────────────────────────────────────────────────────
    if (type === 'log') {
      const logs = await prisma.logEntry.findMany({
        where: { batchId },
        orderBy: { lineNumber: 'asc' },
      })

      const header = `LOG DE NORMALIZACION — Archivo: ${batch.fileName}\nFecha: ${new Date(batch.createdAt).toLocaleString('es-CL')}\n${'='.repeat(60)}\n`

      const lines = logs.map(
        (l) =>
          `Linea ${String(l.lineNumber).padStart(4, '0')} [${l.changeType.toUpperCase().padEnd(10)}] "${l.original}" → "${l.normalized}"${l.detail ? ` (${l.detail})` : ''}`,
      )

      const footer = `\n${'='.repeat(60)}\nTotal entrada: ${batch.totalInput} | Unicos: ${batch.totalOutput} | Duplicados: ${batch.duplicates} | Normalizados: ${batch.changes}`

      return new NextResponse('﻿' + header + lines.join('\n') + footer, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="log_normalizacion.txt"`,
        },
      })
    }

    // ── JSON ──────────────────────────────────────────────────────────
    if (type === 'json') {
      const comunas = await prisma.comuna.findMany({
        where: { batchId },
        orderBy: { createdAt: 'asc' },
      })
      if (sorted) comunas.sort((a, b) => a.normalized.localeCompare(b.normalized, 'es'))

      const json = generateJSON(comunas, {
        fileName: batch.fileName,
        createdAt: batch.createdAt,
        totalInput: batch.totalInput,
        totalOutput: batch.totalOutput,
        duplicates: batch.duplicates,
        changes: batch.changes,
      })

      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="comunas_norm.json"`,
        },
      })
    }

    // ── EXCEL (.xlsx) ─────────────────────────────────────────────────
    if (type === 'xlsx') {
      const comunas = await prisma.comuna.findMany({
        where: { batchId },
        orderBy: { createdAt: 'asc' },
      })
      if (sorted) comunas.sort((a, b) => a.normalized.localeCompare(b.normalized, 'es'))

      const buffer = generateExcel(comunas, {
        fileName: batch.fileName,
        createdAt: batch.createdAt,
        totalInput: batch.totalInput,
        totalOutput: batch.totalOutput,
        duplicates: batch.duplicates,
        changes: batch.changes,
      })

      // NextResponse requiere Uint8Array, no Buffer de Node.js
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="comunas_norm.xlsx"`,
        },
      })
    }

    // ── SQL ───────────────────────────────────────────────────────────
    if (type === 'sql') {
      const comunas = await prisma.comuna.findMany({
        where: { batchId },
        orderBy: { createdAt: 'asc' },
      })
      if (sorted) comunas.sort((a, b) => a.normalized.localeCompare(b.normalized, 'es'))

      const dialect = (p.get('dialect') ?? 'postgresql') as SQLDialect
      const tableName = p.get('tableName') ?? 'datos_norm'
      const includeOriginal = p.get('includeOriginal') !== 'false'
      const includeIndex = p.get('includeIndex') !== 'false'

      const sql = generateSQL(comunas, { dialect, tableName, includeOriginal, includeIndex })

      return new NextResponse(sql, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="comunas_norm_${dialect}.sql"`,
        },
      })
    }

    return NextResponse.json(
      { error: 'Tipo invalido. Usa: csv, log, json, xlsx, sql' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[download]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
