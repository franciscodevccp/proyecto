/**
 * parser.ts
 * Detecta el formato del archivo subido y extrae la columna correcta.
 * Soporta: TXT (una columna por linea), CSV (coma o punto y coma), TSV (tabulacion).
 * Si el archivo tiene multiples columnas, devuelve los encabezados para que
 * el usuario elija cual normalizar desde la UI (ColumnSelector).
 */

/** Resultado del parsing de un archivo */
export interface ParseResult {
  /** Lineas limpias listas para pasar al normalizador */
  lines: string[]
  /** Formato detectado del archivo */
  format: 'txt' | 'csv' | 'tsv' | 'unknown'
  /** Nombres de columnas detectados (encabezados o "Columna N") */
  columns: string[]
  /** Indice de la columna seleccionada para normalizar */
  selectedColumn: number
  /** Total de filas antes de filtrar vacias */
  totalRaw: number
  /** Primeras 3 filas de datos (para preview en ColumnSelector) */
  preview: string[][]
}

/** Opciones de parsing configurables */
export interface ParseOptions {
  /** Cual columna extraer en archivos CSV/TSV (0-indexado, default 0) */
  columnIndex?: number
  /** Si la primera fila es encabezado (default: auto-detect) */
  hasHeader?: boolean
}

/**
 * Detecta el formato del contenido analizando el separador dominante.
 * Usa una muestra de los primeros 2000 caracteres para mayor eficiencia.
 *
 * @param content - Contenido completo del archivo
 * @returns Formato detectado: 'tsv', 'csv' o 'txt'
 */
export function detectFormat(content: string): 'txt' | 'csv' | 'tsv' | 'unknown' {
  // Analizar solo los primeros 2000 chars para evitar leer archivos grandes enteros
  const sample = content.slice(0, 2000)
  const newlineCount = (sample.match(/\n/g) ?? []).length

  // Evitar division por cero en archivos de una sola linea
  if (newlineCount === 0) return 'txt'

  const tabCount = (sample.match(/\t/g) ?? []).length
  const semicolonCount = (sample.match(/;/g) ?? []).length
  const commaCount = (sample.match(/,/g) ?? []).length

  // Si hay mas de 0.5 tabs por linea en promedio → TSV
  if (tabCount > newlineCount * 0.5) return 'tsv'

  // Si hay mas de 0.3 punto y coma o comas por linea → CSV
  if (semicolonCount > newlineCount * 0.3 || commaCount > newlineCount * 0.3) return 'csv'

  return 'txt'
}

/**
 * Detecta si la primera fila es un encabezado usando heuristica de palabras clave.
 * Si alguna celda de la primera fila coincide con nombres tipicos de columnas
 * (nombre, ciudad, region, id, etc.), se considera encabezado.
 *
 * @param rows - Todas las filas parseadas como arrays de celdas
 * @returns true si la primera fila parece ser un encabezado
 */
export function detectHeader(rows: string[][]): boolean {
  if (rows.length < 3) return false

  const headerKeywords =
    /^(id|nombre|name|ciudad|city|region|comuna|code|codigo|descripcion|description|valor|value|texto|text|columna|column|dato|data|campo|field)$/i

  return rows[0].some((cell) => headerKeywords.test(cell.trim()))
}

/**
 * Divide una linea CSV respetando valores entre comillas.
 * Maneja tanto coma como punto y coma como separador.
 *
 * @param line - Linea de texto CSV
 * @param separator - Separador a usar (',' o ';')
 * @returns Array de celdas sin comillas externas
 */
function splitCsvLine(line: string, separator: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes
    } else if (char === separator && !inQuotes) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

/**
 * Parsea el contenido del archivo segun su formato detectado.
 * Retorna las lineas de la columna elegida listas para normalizar,
 * junto con metadatos del parsing (columnas, preview, formato).
 *
 * @param content - Texto completo del archivo
 * @param options - Opciones: columnIndex, hasHeader
 * @returns ParseResult con lineas, columnas y datos de preview
 */
export function parseContent(content: string, options: ParseOptions = {}): ParseResult {
  const format = detectFormat(content)

  // Dividir en filas descartando lineas completamente vacias
  const rawRows = content
    .split('\n')
    .map((line) => line.replace(/\r$/, '')) // quitar \r en archivos Windows
    .filter((line) => line.trim().length > 0)

  const totalRaw = rawRows.length

  // Para TXT: cada linea es un valor, no hay columnas multiples
  if (format === 'txt' || format === 'unknown') {
    const lines = rawRows.map((l) => l.trim()).filter((l) => l.length > 0)
    return {
      lines,
      format: format === 'unknown' ? 'txt' : format,
      columns: ['valor'],
      selectedColumn: 0,
      totalRaw,
      preview: lines.slice(0, 3).map((l) => [l]),
    }
  }

  // Para CSV/TSV: detectar separador y parsear columnas
  const separator = format === 'tsv' ? '\t' : detectCsvSeparator(rawRows)
  const rows = rawRows.map((row) => splitCsvLine(row, separator))

  // Detectar si hay encabezado
  const hasHeader = options.hasHeader ?? detectHeader(rows)
  // M-01: se usa el índice `i` del map en lugar de indexOf para evitar que
  // columnas con encabezado vacío y el mismo valor de búsqueda reciban el
  // mismo número cuando hay encabezados duplicados o vacíos consecutivos.
  const headers = hasHeader
    ? rows[0].map((h, i) => h || `Columna ${i + 1}`)
    : rows[0].map((_, i) => `Columna ${i + 1}`)
  const dataRows = hasHeader ? rows.slice(1) : rows

  // Indice de columna a extraer (0 por defecto)
  const colIndex = options.columnIndex ?? 0

  // Extraer solo la columna seleccionada, descartar celdas vacias
  const lines = dataRows
    .map((row) => (row[colIndex] ?? '').trim())
    .filter((cell) => cell.length > 0)

  // Preview: primeras 3 filas completas para mostrar en ColumnSelector
  const preview = dataRows.slice(0, 3).map((row) =>
    headers.map((_, i) => (row[i] ?? '').trim()),
  )

  return {
    lines,
    format,
    columns: headers,
    selectedColumn: colIndex,
    totalRaw,
    preview,
  }
}

/**
 * Detecta si el CSV usa coma o punto y coma como separador,
 * contando cual aparece mas en las primeras filas.
 *
 * @param rows - Filas crudas del archivo
 * @returns ',' o ';'
 */
function detectCsvSeparator(rows: string[]): string {
  const sample = rows.slice(0, 5).join('\n')
  const semicolons = (sample.match(/;/g) ?? []).length
  const commas = (sample.match(/,/g) ?? []).length
  return semicolons >= commas ? ';' : ','
}
