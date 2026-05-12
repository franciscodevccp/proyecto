/**
 * normalizer.ts
 * Lógica de normalización de nombres de comunas chilenas.
 * Aplica limpieza de texto, eliminación de tildes/eñes,
 * formato Title Case y detección de duplicados.
 */

/** Resultado individual de normalizar una línea del archivo */
export interface NormalizeResult {
  original: string
  normalized: string
  changeType: 'unchanged' | 'normalized' | 'duplicate'
  detail: string
  lineNumber: number
}

/** Resultado completo del procesamiento de un archivo */
export interface ProcessResult {
  comunas: { original: string; normalized: string }[]
  logs: NormalizeResult[]
  totalInput: number
  totalOutput: number
  duplicates: number
  changes: number
}

/**
 * Normaliza un texto aplicando los pasos del pipeline:
 * 1. Elimina espacios al inicio/fin y colapsa espacios múltiples
 * 2. Descompone caracteres Unicode (NFD) y elimina diacríticos (tildes, diéresis, etc.)
 * 3. Convierte a minúsculas y aplica Title Case (primera letra de cada palabra en mayúscula)
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')           // colapsa múltiples espacios en uno
    .normalize('NFD')               // descompone caracteres acentuados (á → a + ́)
    .replace(/[\u0300-\u036f]/g, '')          // elimina los diacríticos resultantes de la descomposición NFD
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase()) // Title Case: primera letra de cada palabra
}

/**
 * Procesa el contenido de un archivo .txt de comunas.
 * Itera línea por línea, normaliza cada nombre, detecta duplicados
 * y construye el log de cambios.
 *
 * @param content - Texto completo del archivo subido
 * @returns Objeto con comunas únicas normalizadas, log de cambios y estadísticas
 */
export function processFile(content: string): ProcessResult {
  // Separa el contenido en líneas, descartando líneas vacías
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const logs: NormalizeResult[] = []

  // Mapa para detectar duplicados: clave normalizada → número de línea original
  const seen = new Map<string, number>()

  const comunas: { original: string; normalized: string }[] = []

  let changes = 0    // cantidad de registros que sufrieron algún cambio
  let duplicates = 0 // cantidad de registros descartados por duplicado

  lines.forEach((line, idx) => {
    const normalized = normalizeText(line)

    // Clave en minúsculas para comparación insensible a mayúsculas
    const key = normalized.toLowerCase()

    // Si ya existe una versión normalizada igual, se marca como duplicado
    if (seen.has(key)) {
      duplicates++
      logs.push({
        original: line,
        normalized,
        changeType: 'duplicate',
        detail: `Duplicado de línea ${seen.get(key)! + 1}`,
        lineNumber: idx + 1,
      })
      return // no se agrega a la lista final
    }

    // Registrar la primera aparición de este valor normalizado
    seen.set(key, idx)

    // Detectar qué tipo de cambios se aplicaron para el log
    const details: string[] = []
    const trimmed = line.trim()

    if (trimmed !== line)
      details.push('espacios eliminados')
    if (/\s{2,}/.test(line))
      details.push('espacios múltiples normalizados')
    if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(line))
      details.push('tildes/eñes removidas')
    if (trimmed !== normalized && trimmed.toLowerCase() !== normalized.toLowerCase())
      details.push('capitalización normalizada')

    const changeType = normalized === line ? 'unchanged' : 'normalized'
    if (changeType === 'normalized') changes++

    logs.push({
      original: line,
      normalized,
      changeType,
      detail: details.length > 0 ? details.join(', ') : 'sin cambios',
      lineNumber: idx + 1,
    })

    comunas.push({ original: line, normalized })
  })

  return {
    comunas,
    logs,
    totalInput: lines.length,
    totalOutput: comunas.length,
    duplicates,
    changes,
  }
}
