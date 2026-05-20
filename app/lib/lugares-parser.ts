/**
 * lugares-parser.ts
 * Parsea el archivo CSV de lugares turísticos.
 * Genera 3 entidades relacionadas: Lugar, Georeferencia, Direccion.
 *
 * Separadores de columna soportados: ";" | "|" | "\t"
 * El separador se detecta automáticamente leyendo las primeras 5 líneas de datos.
 * No se usa "," como separador de columnas porque las direcciones lo contienen.
 *
 * Encoding: se intenta detectar si el archivo es Windows-1252 (latin1) o UTF-8.
 *
 * Regla de duplicados: mismo nombre + misma georef (coords redondeadas a 3 decimales).
 * Ejemplo: Apple Park aparece 2 veces con coords distintas → AMBOS son válidos.
 */

/** Dirección postal parseada en componentes estructurados */
export interface DireccionParsed {
  nombreCalle: string | null
  numeroCalle: string | null
  ciudadEstadoProvincia: string | null
  pais: string | null
  rawDireccion: string  // Dirección original completa sin modificar
}

/** Coordenadas geográficas en grados decimales */
export interface GeorefParsed {
  latitud: number
  longitud: number
}

/** Un lugar turístico listo para guardar en la base de datos */
export interface LugarRecord {
  nombre: string
  direccion: DireccionParsed
  georef: GeorefParsed | null
  lineNumber: number
}

/** Resultado completo del procesamiento del archivo de lugares */
export interface LugaresResult {
  lugares: LugarRecord[]
  duplicates: { lineNumber: number; nombre: string; duplicadoDe: number }[]
  totalInput: number       // Registros de datos (sin contar el header)
  totalOutput: number      // Lugares únicos guardados
  duplicateCount: number   // Duplicados eliminados
  logs: string[]
}

/**
 * Detecta si un buffer leído como latin1 contiene secuencias de bytes que
 * indican que el archivo es realmente UTF-8 mal interpretado.
 * Los caracteres "Ã", "â€", "Â", "Ã©", etc. son el resultado típico de leer
 * UTF-8 con un encoding de un solo byte (latin1 / Windows-1252).
 *
 * @param buffer - Buffer crudo del archivo
 * @returns "utf8" si se detectan artefactos de UTF-8, "latin1" en caso contrario
 */
export function detectarEncoding(buffer: Buffer): string {
  const comoLatin1 = buffer.toString('latin1')
  // Patrones que aparecen cuando UTF-8 se lee como latin1
  const patronesUTF8 = /Ã|â€|Â|Ã©|Ã³|Ã±/
  return patronesUTF8.test(comoLatin1) ? 'utf8' : 'latin1'
}

/**
 * Detecta el separador de columnas predominante en un conjunto de líneas CSV.
 * Candidatos: ";" | "|" | "\t"
 * La coma NO es candidata porque las direcciones contienen comas.
 *
 * Estrategia: contar cuántas veces aparece cada candidato por línea;
 * elegir el primero que tenga un promedio ≥ 2 ocurrencias por línea
 * (formato mínimo de 3 columnas: nombre + dirección + georef).
 * Si ninguno supera el umbral se usa ";" como fallback.
 *
 * @param lineas - Primeras líneas de datos (sin header)
 * @returns El separador detectado
 */
export function detectarSeparadorCSV(lineas: string[]): string {
  // Tomar hasta las primeras 5 líneas para la muestra
  const muestra = lineas.slice(0, 5)
  if (muestra.length === 0) return ';'

  const candidatos = [';', '|', '\t']

  for (const sep of candidatos) {
    // Contar ocurrencias del separador en cada línea de muestra
    const conteos = muestra.map(l => l.split(sep).length - 1)
    const promedio = conteos.reduce((a, b) => a + b, 0) / conteos.length
    // Umbral: al menos 2 separadores por línea → al menos 3 columnas
    if (promedio >= 2) return sep
  }

  // Fallback: punto y coma (formato original del dataset)
  return ';'
}

/**
 * Limpia caracteres corruptos generados por la diferencia de encoding
 * entre Windows-1252 y UTF-8. Reemplaza los más comunes del archivo.
 */
export function fixEncoding(text: string): string {
  return text
    .replace(/�/g, '?')         // Carácter de reemplazo genérico (U+FFFD)
    .replace(/\xf3/g, 'o')           // ó → o
    .replace(/\xfc/g, 'u')           // ü → u
    .replace(/\xdf/g, 'ss')          // ß → ss (Neuschwansteinstrasse)
    .replace(/\xe9/g, 'e')           // é → e
    .replace(/\xe1/g, 'a')           // á → a
    .replace(/\xf1/g, 'n')           // ñ → n
    .replace(/[\x80-\x9f]/g, '')     // Eliminar caracteres de control de Windows
}

/**
 * Parsea una cadena "lat, lon" en números de punto flotante.
 * Retorna null si el formato no es reconocible.
 */
export function parsearGeoref(raw: string): GeorefParsed | null {
  const match = raw.trim().match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/)
  if (!match) return null
  return {
    latitud: parseFloat(match[1]),
    longitud: parseFloat(match[2]),
  }
}

/**
 * Parsea una dirección libre en sus componentes estructurados.
 * Estrategia: dividir por comas, el último fragmento es el país,
 * el penúltimo es ciudad/estado, el primero puede tener número de calle.
 */
export function parsearDireccion(raw: string): DireccionParsed {
  const partes = raw.split(',').map(p => p.trim()).filter(p => p.length > 0)

  // Sin datos suficientes
  if (partes.length === 0) {
    return { nombreCalle: null, numeroCalle: null, ciudadEstadoProvincia: null, pais: null, rawDireccion: raw }
  }

  // Solo un fragmento: tratarlo como nombre de calle
  if (partes.length === 1) {
    return { nombreCalle: partes[0], numeroCalle: null, ciudadEstadoProvincia: null, pais: null, rawDireccion: raw }
  }

  const pais = partes[partes.length - 1]
  const ciudadEstadoProvincia = partes.length >= 3 ? partes[partes.length - 2] : null
  const calleRaw = partes[0]

  // Detectar si el fragmento de calle comienza con número (ej: "1600 Amphitheatre Parkway")
  const numMatch = calleRaw.match(/^(\d+)\s+(.+)$/)
  const nombreCalle = numMatch ? numMatch[2] : calleRaw
  const numeroCalle = numMatch ? numMatch[1] : null

  return { nombreCalle, numeroCalle, ciudadEstadoProvincia, pais, rawDireccion: raw }
}

/**
 * Detecta si la primera línea del archivo es un encabezado de columnas.
 * Reconoce las palabras clave más habituales en español e inglés.
 */
function esLineaHeader(linea: string): boolean {
  const l = linea.toLowerCase()
  return (
    l.includes('nombre') ||
    l.includes('lugar')  ||
    l.includes('sitio')  ||
    l.includes('place')  ||
    l.includes('name')   ||
    l.includes('location') ||
    l.includes('direcci')  // "dirección", "direccion"
  )
}

/**
 * Procesa el contenido completo del archivo de lugares:
 * 1. Limpia encoding Windows-1252
 * 2. Detecta el separador de columnas automáticamente (";", "|" o tab)
 * 3. Detecta y elimina duplicados (mismo nombre + misma georef redondeada)
 * 4. Parsea dirección y georef de cada registro único
 */
export function procesarLugares(content: string): LugaresResult {
  const cleaned = fixEncoding(content)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  // Detectar si la primera línea es un encabezado de columnas
  const hasHeader = lines.length > 0 && esLineaHeader(lines[0])
  const dataLines = hasHeader ? lines.slice(1) : lines

  // Detectar separador de columnas con las primeras líneas de datos
  const sep = detectarSeparadorCSV(dataLines)

  const lugares: LugarRecord[] = []
  const duplicates: { lineNumber: number; nombre: string; duplicadoDe: number }[] = []
  const logs: string[] = []
  // Clave: "nombre_normalizado|lat.3decimales,lon.3decimales"
  const seen = new Map<string, number>()

  dataLines.forEach((line, idx) => {
    const lineNumber = idx + (hasHeader ? 2 : 1)
    const partes = line.split(sep).map(p => p.trim())
    if (partes.length < 1 || !partes[0]) return

    const nombre = partes[0]
    const rawDireccion = partes[1] ?? ''
    const rawGeoref = partes[2] ?? ''

    const georef = parsearGeoref(rawGeoref)
    const direccion = parsearDireccion(rawDireccion)

    // Normalizar nombre para comparación (sin tildes, minúsculas)
    const keyNombre = nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

    // Redondear coords a 3 decimales para detectar duplicados exactos
    const keyGeo = georef
      ? `${georef.latitud.toFixed(3)},${georef.longitud.toFixed(3)}`
      : 'sin-geo'
    const key = `${keyNombre}|${keyGeo}`

    if (seen.has(key)) {
      const duplicadoDe = seen.get(key)!
      duplicates.push({ lineNumber, nombre, duplicadoDe })
      logs.push(`Línea ${lineNumber}: DUPLICADO de línea ${duplicadoDe} — "${nombre}"`)
      return
    }

    seen.set(key, lineNumber)
    lugares.push({ nombre, direccion, georef, lineNumber })
    logs.push(`Línea ${lineNumber}: OK — "${nombre}" (${rawGeoref || 'sin georef'})`)
  })

  return {
    lugares,
    duplicates,
    totalInput: dataLines.length,
    totalOutput: lugares.length,
    duplicateCount: duplicates.length,
    logs,
  }
}
