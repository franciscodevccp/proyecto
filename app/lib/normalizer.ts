/**
 * normalizer.ts
 * Logica de normalizacion de nombres de comunas chilenas.
 * Aplica limpieza de texto, eliminacion de tildes/enes,
 * formato Title Case, deteccion de duplicados y correccion ortografica opcional.
 */

import { findBestComuna } from './comunas-chile'

/** Resultado individual de normalizar una linea del archivo */
export interface NormalizeResult {
  original: string
  normalized: string
  changeType: 'unchanged' | 'normalized' | 'duplicate' | 'corrected'
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
  corrections: number
}

/**
 * Normaliza un texto aplicando los pasos del pipeline:
 * 1. Elimina espacios al inicio/fin y colapsa espacios multiples
 * 2. Descompone caracteres Unicode (NFD) y elimina diacriticos (tildes, dieresis, etc.)
 * 3. Convierte a minusculas y aplica Title Case (primera letra de cada palabra en mayuscula)
 */
function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Procesa el contenido de un archivo .txt de comunas.
 * Itera linea por linea, normaliza cada nombre, detecta duplicados
 * y opcionalmente aplica correccion ortografica por fuzzy matching.
 *
 * @param content - Texto completo del archivo subido
 * @param options.correct - Si true, intenta corregir typos contra la lista oficial INE
 * @returns Objeto con comunas unicas normalizadas, log de cambios y estadisticas
 */
export function processFile(
  content: string,
  options: { correct?: boolean } = {},
): ProcessResult {
  const { correct = false } = options

  // Separa el contenido en lineas, descartando lineas vacias
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const logs: NormalizeResult[] = []

  // Mapa para detectar duplicados: clave normalizada → numero de linea original
  const seen = new Map<string, number>()

  const comunas: { original: string; normalized: string }[] = []

  let changes = 0       // registros con cambio de formato
  let duplicates = 0    // registros descartados por duplicado
  let corrections = 0   // registros corregidos por fuzzy matching

  lines.forEach((line, idx) => {
    let normalized = normalizeText(line)
    let changeType: NormalizeResult['changeType'] = normalized === line ? 'unchanged' : 'normalized'
    const details: string[] = []

    // Detectar que tipos de cambios de formato se aplicaron
    if (line.trim() !== line) details.push('espacios eliminados')
    if (/\s{2,}/.test(line)) details.push('espacios multiples normalizados')
    if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(line)) details.push('tildes/enes removidas')
    if (line.trim() !== normalized && line.trim().toLowerCase() !== normalized.toLowerCase())
      details.push('capitalizacion normalizada')

    // Etapa opcional: correccion ortografica contra lista oficial INE
    if (correct) {
      const corrected = findBestComuna(normalized)
      if (corrected !== null && corrected !== normalized) {
        details.push(`typo corregido: "${normalized}" → "${corrected}"`)
        normalized = corrected
        changeType = 'corrected'
        corrections++
      }
    }

    // Clave en minusculas para comparacion insensible a mayusculas
    const key = normalized.toLowerCase()

    // Si ya existe una version normalizada igual, se marca como duplicado
    if (seen.has(key)) {
      duplicates++
      logs.push({
        original: line,
        normalized,
        changeType: 'duplicate',
        detail: `Duplicado de linea ${seen.get(key)! + 1}`,
        lineNumber: idx + 1,
      })
      return
    }

    seen.set(key, idx)

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
    corrections,
  }
}
