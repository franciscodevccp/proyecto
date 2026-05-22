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
// VALIDACIÓN DE SEGURIDAD
// ─────────────────────────────────────────────

/** Regex que acepta solo nombres de tabla válidos en SQL (sin caracteres peligrosos) */
const SAFE_TABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/

/**
 * Valida que un nombre de tabla sea seguro para insertar en SQL.
 * Lanza error si contiene caracteres que podrían usarse en inyección SQL.
 * Se llama al inicio de cada función generadora de SQL.
 * @param name - Nombre de tabla a validar
 * @throws Error si el nombre no es válido
 */
function assertSafeTableName(name: string): void {
  if (!SAFE_TABLE_NAME.test(name)) {
    throw new Error(
      `Nombre de tabla inválido: "${name}". Solo se permiten letras, números y guiones bajos.`,
    )
  }
}

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
  // Validar tableName antes de usarlo en cualquier string SQL
  assertSafeTableName(tableName)
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
    // SQLite — el DROP TABLE IF EXISTS anterior garantiza que no existe, por eso no se usa IF NOT EXISTS
    lines.push(`CREATE TABLE "${tableName}" (`)
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

// ─────────────────────────────────────────────
// SQL — FAMOSOS (1 tabla)
// ─────────────────────────────────────────────

/** Estructura mínima de un famoso necesaria para generar el SQL */
interface FamosoParaSQL {
  nombre: string
  fechaOriginal: string
  fechaNormalizada: string | null
  fechaAprox: string | null
  edad: number | null
  esCumpleanos: boolean
}

/** Opciones de exportacion SQL para el modulo de famosos */
export interface FamososSQLOptions {
  /** Nombre de la tabla destino (default: 'famosos_norm') */
  tableName?: string
  /** Motor de base de datos destino (default: 'postgresql') */
  dialect?: SQLDialect
}

/** Devuelve el identificador entre las comillas correctas segun el dialecto */
function quoteIdent(name: string, dialect: SQLDialect): string {
  return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`
}

/**
 * Genera el script SQL completo para la tabla de famosos normalizados.
 * Soporta PostgreSQL, MySQL y SQLite.
 * Incluye: encabezado con fecha y totales, DROP TABLE IF EXISTS,
 * CREATE TABLE e INSERT INTO en batches de 500 filas.
 *
 * @param famosos  - Lista de famosos a insertar
 * @param options  - Dialecto SQL y nombre de tabla (opcionales)
 * @returns String con el script SQL listo para ejecutar
 */
export function generateFamososSQL(
  famosos: FamosoParaSQL[],
  options?: FamososSQLOptions,
): string {
  const tableName = options?.tableName?.trim() || 'famosos_norm'
  // Validar tableName antes de usarlo en cualquier string SQL
  assertSafeTableName(tableName)
  const dialect: SQLDialect = options?.dialect ?? 'postgresql'
  const q = (n: string) => quoteIdent(n, dialect)
  const now = new Date().toISOString()
  const lines: string[] = []

  // ── Encabezado ──────────────────────────────
  lines.push(`-- ============================================================`)
  lines.push(`-- Exportado por COMUNAS_NORM — Modulo Famosos`)
  lines.push(`-- Fecha: ${now}`)
  lines.push(`-- Dialecto: ${dialect.toUpperCase()}`)
  lines.push(`-- Tabla: ${tableName}`)
  lines.push(`-- Total de registros: ${famosos.length}`)
  lines.push(`-- ============================================================`)
  lines.push('')

  // ── DROP TABLE IF EXISTS ─────────────────────
  lines.push(`DROP TABLE IF EXISTS ${q(tableName)};`)
  lines.push('')

  // ── CREATE TABLE ─────────────────────────────
  if (dialect === 'postgresql') {
    lines.push(`CREATE TABLE ${q(tableName)} (`)
    lines.push(`  id                SERIAL PRIMARY KEY,`)
    lines.push(`  nombre            VARCHAR(255) NOT NULL,`)
    lines.push(`  fecha_original    VARCHAR(100) NOT NULL,`)
    lines.push(`  fecha_normalizada VARCHAR(20),`)
    lines.push(`  fecha_aprox       VARCHAR(100),`)
    lines.push(`  edad              INT,`)
    lines.push(`  es_cumpleanos     BOOLEAN DEFAULT FALSE`)
    lines.push(`);`)
  } else if (dialect === 'mysql') {
    lines.push(`CREATE TABLE ${q(tableName)} (`)
    lines.push(`  id                INT AUTO_INCREMENT PRIMARY KEY,`)
    lines.push(`  nombre            VARCHAR(255) NOT NULL,`)
    lines.push(`  fecha_original    VARCHAR(100) NOT NULL,`)
    lines.push(`  fecha_normalizada VARCHAR(20),`)
    lines.push(`  fecha_aprox       VARCHAR(100),`)
    lines.push(`  edad              INT,`)
    lines.push(`  es_cumpleanos     TINYINT(1) DEFAULT 0`)
    lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
  } else {
    // SQLite — el DROP TABLE IF EXISTS anterior garantiza que no existe, por eso no se usa IF NOT EXISTS
    lines.push(`CREATE TABLE ${q(tableName)} (`)
    lines.push(`  id                INTEGER PRIMARY KEY AUTOINCREMENT,`)
    lines.push(`  nombre            TEXT NOT NULL,`)
    lines.push(`  fecha_original    TEXT NOT NULL,`)
    lines.push(`  fecha_normalizada TEXT,`)
    lines.push(`  fecha_aprox       TEXT,`)
    lines.push(`  edad              INTEGER,`)
    lines.push(`  es_cumpleanos     INTEGER DEFAULT 0`)
    lines.push(`);`)
  }
  lines.push('')

  // ── INSERT INTO en batches de 500 filas ──────
  const BATCH_SIZE = 500
  for (let i = 0; i < famosos.length; i += BATCH_SIZE) {
    const chunk = famosos.slice(i, i + BATCH_SIZE)
    lines.push(`INSERT INTO ${q(tableName)}`)
    lines.push(`  (nombre, fecha_original, fecha_normalizada, fecha_aprox, edad, es_cumpleanos)`)
    lines.push(`VALUES`)
    chunk.forEach((f, idx) => {
      const nombre    = `'${escapeSql(f.nombre)}'`
      const fechaOrig = `'${escapeSql(f.fechaOriginal)}'`
      const fechaNorm = f.fechaNormalizada !== null ? `'${escapeSql(f.fechaNormalizada)}'` : 'NULL'
      const fechaAprx = f.fechaAprox !== null ? `'${escapeSql(f.fechaAprox)}'` : 'NULL'
      const edad      = f.edad !== null ? String(f.edad) : 'NULL'
      // PostgreSQL acepta TRUE/FALSE; MySQL y SQLite usan 1/0
      const cumple    = dialect === 'postgresql'
        ? (f.esCumpleanos ? 'TRUE' : 'FALSE')
        : (f.esCumpleanos ? '1' : '0')
      const coma      = idx < chunk.length - 1 ? ',' : ''
      lines.push(`  (${nombre}, ${fechaOrig}, ${fechaNorm}, ${fechaAprx}, ${edad}, ${cumple})${coma}`)
    })
    lines.push(`;`)
    lines.push('')
  }

  // ── Pie de pagina ────────────────────────────
  lines.push(`-- ============================================================`)
  lines.push(`-- Fin del script — ${famosos.length} registro(s) insertado(s)`)
  lines.push(`-- ============================================================`)

  return lines.join('\n')
}

// ─────────────────────────────────────────────
// SQL — LUGARES (3 tablas con FK)
// ─────────────────────────────────────────────

/** Estructura mínima de un lugar necesaria para generar el SQL */
interface LugarParaSQL {
  nombre: string
  georef: { latitud: number; longitud: number } | null
  direccion: {
    nombreCalle: string | null
    numeroCalle: string | null
    ciudadEstadoProvincia: string | null
    pais: string | null
    rawDireccion: string
  } | null
}

/** Opciones de exportacion SQL para el modulo de lugares (sin SQLite: FK hace mas sentido en PG/MySQL) */
export interface LugaresSQLOptions {
  /** Motor de base de datos destino (default: 'postgresql') */
  dialect?: 'postgresql' | 'mysql'
}

/**
 * Genera el script SQL completo para las 3 tablas de lugares turisticos:
 *   - lugares         (tabla principal con id y nombre)
 *   - georeferencias  (FK → lugares, solo registros con coordenadas)
 *   - direcciones     (FK → lugares, todos los registros)
 *
 * Soporta PostgreSQL y MySQL.
 * Las tablas hijas se eliminan primero para respetar las restricciones FK.
 * Los INSERT usan IDs correlativos comenzando en 1.
 *
 * @param lugares  - Lista de lugares a insertar
 * @param options  - Dialecto SQL (opcional, default postgresql)
 * @returns String con el script SQL listo para ejecutar
 */
export function generateLugaresSQL(
  lugares: LugarParaSQL[],
  options?: LugaresSQLOptions,
): string {
  const dialect: 'postgresql' | 'mysql' = options?.dialect ?? 'postgresql'
  // Validar los nombres de las 3 tablas fijas que se generan
  assertSafeTableName('lugares')
  assertSafeTableName('georeferencias')
  assertSafeTableName('direcciones')
  const q = (n: string) => quoteIdent(n, dialect)
  const now = new Date().toISOString()
  const lines: string[] = []

  // ── Encabezado ──────────────────────────────
  lines.push(`-- ============================================================`)
  lines.push(`-- Exportado por COMUNAS_NORM — Modulo Lugares Turisticos`)
  lines.push(`-- Fecha: ${now}`)
  lines.push(`-- Dialecto: ${dialect.toUpperCase()}`)
  lines.push(`-- Total de lugares: ${lugares.length}`)
  lines.push(`-- Tablas generadas: lugares, georeferencias, direcciones`)
  lines.push(`-- ============================================================`)
  lines.push('')

  // ── DROP TABLE IF EXISTS (hijas primero para respetar FK) ────
  lines.push(`-- Eliminar tablas hijas antes que la tabla padre`)
  lines.push(`DROP TABLE IF EXISTS ${q('direcciones')};`)
  lines.push(`DROP TABLE IF EXISTS ${q('georeferencias')};`)
  lines.push(`DROP TABLE IF EXISTS ${q('lugares')};`)
  lines.push('')

  // ── CREATE TABLE lugares ─────────────────────
  // La tabla padre no tiene FK, el alias simple alcanza para ambos dialectos
  const serialPK = dialect === 'mysql' ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'SERIAL PRIMARY KEY'
  const engineSuffix = dialect === 'mysql' ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : ''

  lines.push(`-- Tabla principal`)
  lines.push(`CREATE TABLE ${q('lugares')} (`)
  lines.push(`  id     ${serialPK},`)
  lines.push(`  nombre VARCHAR(255) NOT NULL`)
  lines.push(`)${engineSuffix};`)
  lines.push('')

  // ── CREATE TABLE georeferencias ──────────────
  // PostgreSQL: FK inline en columna.
  // MySQL: FK inline se parsea pero se ignora — usar CONSTRAINT tabla-nivel.
  lines.push(`-- Coordenadas geograficas (solo para lugares con georef)`)
  if (dialect === 'postgresql') {
    lines.push(`CREATE TABLE ${q('georeferencias')} (`)
    lines.push(`  id       SERIAL PRIMARY KEY,`)
    lines.push(`  lugar_id INT NOT NULL REFERENCES ${q('lugares')}(id) ON DELETE CASCADE,`)
    lines.push(`  latitud  DECIMAL(10,7) NOT NULL,`)
    lines.push(`  longitud DECIMAL(10,7) NOT NULL`)
    lines.push(`);`)
  } else {
    lines.push(`CREATE TABLE ${q('georeferencias')} (`)
    lines.push(`  id       INT AUTO_INCREMENT PRIMARY KEY,`)
    lines.push(`  lugar_id INT NOT NULL,`)
    lines.push(`  latitud  DECIMAL(10,7) NOT NULL,`)
    lines.push(`  longitud DECIMAL(10,7) NOT NULL,`)
    lines.push(`  CONSTRAINT fk_georef_lugar FOREIGN KEY (lugar_id) REFERENCES ${q('lugares')}(id) ON DELETE CASCADE`)
    lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
  }
  lines.push('')

  // ── CREATE TABLE direcciones ─────────────────
  lines.push(`-- Direccion postal estructurada de cada lugar`)
  if (dialect === 'postgresql') {
    lines.push(`CREATE TABLE ${q('direcciones')} (`)
    lines.push(`  id                      SERIAL PRIMARY KEY,`)
    lines.push(`  lugar_id                INT NOT NULL REFERENCES ${q('lugares')}(id) ON DELETE CASCADE,`)
    lines.push(`  nombre_calle            VARCHAR(255),`)
    lines.push(`  numero_calle            VARCHAR(50),`)
    lines.push(`  ciudad_estado_provincia VARCHAR(255),`)
    lines.push(`  pais                    VARCHAR(100),`)
    lines.push(`  raw_direccion           TEXT NOT NULL`)
    lines.push(`);`)
  } else {
    lines.push(`CREATE TABLE ${q('direcciones')} (`)
    lines.push(`  id                      INT AUTO_INCREMENT PRIMARY KEY,`)
    lines.push(`  lugar_id                INT NOT NULL,`)
    lines.push(`  nombre_calle            VARCHAR(255),`)
    lines.push(`  numero_calle            VARCHAR(50),`)
    lines.push(`  ciudad_estado_provincia VARCHAR(255),`)
    lines.push(`  pais                    VARCHAR(100),`)
    lines.push(`  raw_direccion           TEXT NOT NULL,`)
    lines.push(`  CONSTRAINT fk_dir_lugar FOREIGN KEY (lugar_id) REFERENCES ${q('lugares')}(id) ON DELETE CASCADE`)
    lines.push(`) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`)
  }
  lines.push('')

  // ── INSERT INTO lugares ──────────────────────
  const BATCH_SIZE = 500
  if (lugares.length > 0) {
    lines.push(`-- Insertar ${lugares.length} lugar(es) con IDs correlativos`)
    for (let i = 0; i < lugares.length; i += BATCH_SIZE) {
      const chunk = lugares.slice(i, i + BATCH_SIZE)
      lines.push(`INSERT INTO ${q('lugares')} (id, nombre) VALUES`)
      chunk.forEach((l, idx) => {
        const id     = i + idx + 1
        const nombre = `'${escapeSql(l.nombre)}'`
        const coma   = idx < chunk.length - 1 ? ',' : ''
        lines.push(`  (${id}, ${nombre})${coma}`)
      })
      lines.push(`;`)
      lines.push('')
    }
  }

  // ── INSERT INTO georeferencias ───────────────
  const conGeoref = lugares
    .map((l, i) => ({ l, id: i + 1 }))
    .filter(({ l }) => l.georef !== null)

  if (conGeoref.length > 0) {
    lines.push(`-- Insertar georeferencias (${conGeoref.length} de ${lugares.length} lugar(es))`)
    for (let i = 0; i < conGeoref.length; i += BATCH_SIZE) {
      const chunk = conGeoref.slice(i, i + BATCH_SIZE)
      lines.push(`INSERT INTO ${q('georeferencias')} (lugar_id, latitud, longitud) VALUES`)
      chunk.forEach(({ l, id }, idx) => {
        const lat  = l.georef!.latitud.toFixed(7)
        const lon  = l.georef!.longitud.toFixed(7)
        const coma = idx < chunk.length - 1 ? ',' : ''
        lines.push(`  (${id}, ${lat}, ${lon})${coma}`)
      })
      lines.push(`;`)
      lines.push('')
    }
  }

  // ── INSERT INTO direcciones ──────────────────
  if (lugares.length > 0) {
    lines.push(`-- Insertar direcciones (una por cada lugar)`)
    for (let i = 0; i < lugares.length; i += BATCH_SIZE) {
      const chunk = lugares.slice(i, i + BATCH_SIZE)
      lines.push(`INSERT INTO ${q('direcciones')}`)
      lines.push(`  (lugar_id, nombre_calle, numero_calle, ciudad_estado_provincia, pais, raw_direccion)`)
      lines.push(`VALUES`)
      chunk.forEach((l, idx) => {
        const lugarId = i + idx + 1
        const calle   = l.direccion?.nombreCalle ? `'${escapeSql(l.direccion.nombreCalle)}'` : 'NULL'
        const numero  = l.direccion?.numeroCalle ? `'${escapeSql(l.direccion.numeroCalle)}'` : 'NULL'
        const ciudad  = l.direccion?.ciudadEstadoProvincia ? `'${escapeSql(l.direccion.ciudadEstadoProvincia)}'` : 'NULL'
        const pais    = l.direccion?.pais ? `'${escapeSql(l.direccion.pais)}'` : 'NULL'
        const raw     = l.direccion ? `'${escapeSql(l.direccion.rawDireccion)}'` : `''`
        const coma    = idx < chunk.length - 1 ? ',' : ''
        lines.push(`  (${lugarId}, ${calle}, ${numero}, ${ciudad}, ${pais}, ${raw})${coma}`)
      })
      lines.push(`;`)
      lines.push('')
    }
  }

  // ── Pie de pagina ────────────────────────────
  lines.push(`-- ============================================================`)
  lines.push(`-- Fin del script — ${lugares.length} lugar(es) insertado(s)`)
  lines.push(`-- ============================================================`)

  return lines.join('\n')
}
