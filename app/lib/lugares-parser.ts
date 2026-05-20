/**
 * lugares-parser.ts
 * Parsea el archivo CSV de lugares turísticos separado por ";".
 * Genera 3 entidades relacionadas: Lugar, Georeferencia, Direccion.
 *
 * IMPORTANTE: El archivo original usa encoding Windows-1252.
 * Leer con: Buffer.from(await file.arrayBuffer()).toString('latin1')
 * y luego pasar por fixEncoding() antes de procesar.
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
 * Limpia caracteres corruptos generados por la diferencia de encoding
 * entre Windows-1252 y UTF-8. Reemplaza los más comunes del archivo.
 */
export function fixEncoding(text: string): string {
  return text
    .replace(/�/g, '?')      // Carácter de reemplazo genérico
    .replace(/\xf3/g, 'o')        // ó → o
    .replace(/\xfc/g, 'u')        // ü → u
    .replace(/\xdf/g, 'ss')       // ß → ss (Neuschwansteinstrasse)
    .replace(/\xe9/g, 'e')        // é → e
    .replace(/\xe1/g, 'a')        // á → a
    .replace(/\xf1/g, 'n')        // ñ → n
    .replace(/[\x80-\x9f]/g, '')  // Eliminar caracteres de control de Windows
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
 * Procesa el contenido completo del archivo de lugares:
 * 1. Limpia encoding Windows-1252
 * 2. Parsea CSV separado por ";"
 * 3. Detecta y elimina duplicados (mismo nombre + misma georef redondeada)
 * 4. Parsea dirección y georef de cada registro único
 */
export function procesarLugares(content: string): LugaresResult {
  const cleaned = fixEncoding(content)
  const lines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  // Detectar si la primera línea es un encabezado
  const hasHeader =
    lines[0].toLowerCase().includes('nombre') ||
    lines[0].toLowerCase().includes('lugar') ||
    lines[0].toLowerCase().includes('direcci')
  const dataLines = hasHeader ? lines.slice(1) : lines

  const lugares: LugarRecord[] = []
  const duplicates: { lineNumber: number; nombre: string; duplicadoDe: number }[] = []
  const logs: string[] = []
  // Clave: "nombre_normalizado|lat.3decimales,lon.3decimales"
  const seen = new Map<string, number>()

  dataLines.forEach((line, idx) => {
    const lineNumber = idx + (hasHeader ? 2 : 1)
    const partes = line.split(';').map(p => p.trim())
    if (partes.length < 1 || !partes[0]) return

    const nombre = partes[0]
    const rawDireccion = partes[1] ?? ''
    const rawGeoref = partes[2] ?? ''

    const georef = parsearGeoref(rawGeoref)
    const direccion = parsearDireccion(rawDireccion)

    // Normalizar nombre para comparación
    const keyNombre = nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
