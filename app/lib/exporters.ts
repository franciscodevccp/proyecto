/**
 * exporters.ts
 * Funciones de exportacion para los datos normalizados.
 * Soporta tres formatos de salida:
 *   - SQL: script CREATE TABLE + INSERT para PostgreSQL, MySQL o SQLite
 *   - JSON: objeto con metadatos y array de resultados, listo para APIs
 *   - Excel (.xlsx): libro con dos hojas (datos + resumen)
 */

import * as XLSX from 'xlsx'

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

/** Dialectos SQL soportados */
export type SQLDialect = 'postgresql' | 'mysql' | 'sqlite'

/** Opciones de exportacion SQL */
export interface SQLExportOptions {
  /** Nombre de la tabla a crear (default: 'datos_norm') */
  tableName: string
  /** Motor de base de datos destino */
  dialect: SQLDialect
  /** Si incluir la columna 'original' ademas de 'normalizado' */
  includeOriginal: boolean
  /** Si agregar un indice sobre la columna 'normalizado' */
  includeIndex: boolean
}

/** Estadisticas del batch para incluir en los exportadores */
export interface BatchStats {
  fileName: string
  createdAt: Date
  totalInput: number
  totalOutput: number
  duplicates: number
  changes: number
}

// ─────────────────────────────────────────────
// SQL
// ─────────────────────────────────────────────

/**
 * Devuelve el tipo de dato VARCHAR equivalente segun el dialecto SQL.
 * PostgreSQL y MySQL usan VARCHAR(255), SQLite usa TEXT.
 */
function varcharType(dialect: SQLDialect): string {
  return dialect === 'sqlite' ? 'TEXT' : 'VARCHAR(255)'
}

/**
 * Escapa una cadena para usarla de forma segura dentro de un literal SQL.
 * Duplica las comillas simples para evitar inyeccion SQL.
 */
function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Genera el script SQL completo listo para ejecutar.
 * Incluye: encabezado con metadatos, DROP IF EXISTS, CREATE TABLE,
 * INSERT INTO en batches de 500 filas, e indice opcional.
 *
 * @param comunas - Lista de pares original/normalizado
 * @param options - Opciones de dialecto, tabla y columnas
 * @returns String con el script SQL completo
 */
export function generateSQL(
  comunas: { original: string; normalized: string }[],
  options: SQLExportOptions,
): string {
  const { tableName, dialect, includeOriginal, includeIndex } = options
  const now = new Date().toISOString()
  const varchar = varcharType(dialect)
  const lines: string[] = []

  // ── Encabezado ──────────────────────────────
  lines.push(`-- ============================================================`)
  lines.push(`-- Exportado por COMUNAS_NORM v2.0`)
  lines.push(`-- Fecha: ${now}`)
  lines.push(`-- Dialecto: ${dialect.toUpperCase()}`)
  lines.push(`-- Total de registros: ${comunas.length}`)
  lines.push(`-- ============================================================`)
  lines.push('')

  // ── DROP TABLE IF EXISTS ─────────────────────
  if (dialect === 'postgresql') {
    lines.push(`DROP TABLE IF EXISTS "${tableName}";`)
  } else {
    lines.push(`DROP TABLE IF EXISTS \`${tableName}\`;`)
  }
  lines.push('')

  // ── CREATE TABLE ─────────────────────────────
  if (dialect === 'postgresql') {
    lines.push(`CREATE TABLE "${tableName}" (`)
    lines.push(`  id SERIAL PRIMARY KEY,`)
    if (includeOriginal) lines.push(`  original ${varchar} NOT NULL,`)
    lines.push(`  normalizado ${varchar} NOT NULL`)
    lines.push(`);`)
  } else if (dialect === 'mysql') {
    lines.push(`CREATE TABLE \`${tableName}\` (`)
    lines.push(`  id INT AUTO_INCREMENT PRIMARY KEY,`)
    if (includeOriginal) lines.push(`  original ${varchar} NOT NULL,`)
    lines.push(`  normalizado ${varchar} NOT NULL`)
    lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
  } else {
    // SQLite
    lines.push(`CREATE TABLE IF NOT EXISTS "${tableName}" (`)
    lines.push(`  id INTEGER PRIMARY KEY AUTOINCREMENT,`)
    if (includeOriginal) lines.push(`  original TEXT NOT NULL,`)
    lines.push(`  normalizado TEXT NOT NULL`)
    lines.push(`);`)
  }
  lines.push('')

  // ── INSERT INTO (en batches de 500) ──────────
  const BATCH_SIZE = 500
  for (let i = 0; i < comunas.length; i += BATCH_SIZE) {
    const chunk = comunas.slice(i, i + BATCH_SIZE)
    const tablePart =
      dialect === 'postgresql'
        ? `"${tableName}"`
        : `\`${tableName}\``
    const cols = includeOriginal
      ? dialect === 'postgresql'
        ? `("original", "normalizado")`
        : `(\`original\`, \`normalizado\`)`
      : dialect === 'postgresql'
        ? `("normalizado")`
        : `(\`normalizado\`)`

    lines.push(`INSERT INTO ${tablePart} ${cols} VALUES`)
    const valueRows = chunk.map((c, idx) => {
      const norm = `'${escapeSql(c.normalized)}'`
      const orig = `'${escapeSql(c.original)}'`
      const vals = includeOriginal ? `(${orig}, ${norm})` : `(${norm})`
      return idx < chunk.length - 1 ? `  ${vals},` : `  ${vals}`
    })
    lines.push(...valueRows)
    lines.push(`;`)
    lines.push('')
  }

  // ── CREATE INDEX (opcional) ──────────────────
  if (includeIndex) {
    if (dialect === 'postgresql') {
      lines.push(`CREATE INDEX idx_${tableName}_normalizado ON "${tableName}" ("normalizado");`)
    } else if (dialect === 'mysql') {
      lines.push(`CREATE INDEX idx_${tableName}_normalizado ON \`${tableName}\` (\`normalizado\`);`)
    } else {
      lines.push(`CREATE INDEX idx_${tableName}_normalizado ON "${tableName}" ("normalizado");`)
    }
    lines.push('')
  }

  // ── Pie de pagina ────────────────────────────
  lines.push(`-- ============================================================`)
  lines.push(`-- Fin del script — ${comunas.length} registros insertados`)
  lines.push(`-- ============================================================`)

  return lines.join('\n')
}

// ─────────────────────────────────────────────
// JSON
// ─────────────────────────────────────────────

/**
 * Genera un JSON estructurado listo para consumo de APIs externas.
 * Incluye metadatos del batch y el array de resultados de normalizacion.
 *
 * @param comunas - Lista de pares original/normalizado
 * @param batch - Metadatos del proceso (archivo, fecha, estadisticas)
 * @returns String JSON con indentacion de 2 espacios
 */
export function generateJSON(
  comunas: { original: string; normalized: string }[],
  batch: BatchStats,
): string {
  return JSON.stringify(
    {
      metadata: {
        source: batch.fileName,
        processedAt: batch.createdAt,
        totalInput: batch.totalInput,
        totalOutput: batch.totalOutput,
        duplicatesRemoved: batch.duplicates,
        recordsNormalized: batch.changes,
      },
      data: comunas.map((c) => ({
        original: c.original,
        normalizado: c.normalized,
      })),
    },
    null,
    2,
  )
}

// ─────────────────────────────────────────────
// EXCEL (.xlsx)
// ─────────────────────────────────────────────

/**
 * Genera un buffer de Excel (.xlsx) con dos hojas:
 *   - "Datos normalizados": tabla con columnas original y normalizado
 *   - "Resumen": estadisticas del proceso de normalizacion
 *
 * @param comunas - Lista de pares original/normalizado
 * @param stats - Estadisticas del batch para la hoja de resumen
 * @returns Buffer listo para descargar como .xlsx
 */
export function generateExcel(
  comunas: { original: string; normalized: string }[],
  stats: BatchStats,
): Buffer {
  const workbook = XLSX.utils.book_new()

  // ── Hoja 1: Datos normalizados ────────────────
  const dataRows = [
    ['Original', 'Normalizado'], // encabezado
    ...comunas.map((c) => [c.original, c.normalized]),
  ]
  const sheetData = XLSX.utils.aoa_to_sheet(dataRows)

  // Ancho de columnas (en caracteres)
  sheetData['!cols'] = [{ wch: 35 }, { wch: 35 }]

  XLSX.utils.book_append_sheet(workbook, sheetData, 'Datos normalizados')

  // ── Hoja 2: Resumen del proceso ───────────────
  const summaryRows = [
    ['Metrica', 'Valor'],
    ['Archivo procesado', stats.fileName],
    ['Fecha de procesamiento', stats.createdAt.toLocaleString('es-CL')],
    ['Registros ingresados', stats.totalInput],
    ['Registros unicos', stats.totalOutput],
    ['Duplicados eliminados', stats.duplicates],
    ['Registros normalizados', stats.changes],
    ['Tasa de deduplicacion (%)', Math.round((stats.duplicates / stats.totalInput) * 100)],
    ['Tasa de normalizacion (%)', Math.round((stats.changes / stats.totalOutput) * 100)],
  ]
  const sheetSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  sheetSummary['!cols'] = [{ wch: 30 }, { wch: 40 }]

  XLSX.utils.book_append_sheet(workbook, sheetSummary, 'Resumen')

  // Retornar como Buffer Node.js
  const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return xlsxBuffer
}
