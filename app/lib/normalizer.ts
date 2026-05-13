/**
 * normalizer.ts
 * Pipeline de normalizacion de texto para datasets de comunas (y texto en general).
 * Recibe lineas ya parseadas y aplica las reglas ETL configuradas por el usuario.
 * Cada regla puede activarse o desactivarse individualmente via ETLRuleSet.
 */

import { findBestComuna } from './comunas-chile'
import { type ETLRuleSet, DEFAULT_RULESET, resolveRuleSet } from './etl-rules'
import { calculateQuality, calculateQualityAfter, type QualityBreakdown } from './quality-score'

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
  /** Score de calidad del dataset ANTES de normalizar */
  qualityBefore: QualityBreakdown
  /** Score de calidad del dataset DESPUES de normalizar */
  qualityAfter: QualityBreakdown
}

/**
 * Aplica las reglas de normalizacion habilitadas a un texto.
 * Solo se ejecutan las transformaciones cuya regla este activa en el ruleset.
 *
 * @param text - Texto crudo a normalizar
 * @param rules - Conjunto de reglas activas
 * @returns Texto normalizado segun las reglas
 */
function normalizeText(text: string, rules: ETLRuleSet): string {
  let result = text

  // Regla: eliminar espacios al inicio y al final
  if (rules['trim']) {
    result = result.trim()
  }

  // Regla: colapsar multiples espacios en uno
  if (rules['collapseSpaces']) {
    result = result.replace(/\s+/g, ' ')
  }

  // Regla: eliminar tildes y diacriticos (NFD + rango Unicode)
  if (rules['removeAccents']) {
    result = result
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
  }

  // Regla: aplicar formato Title Case
  if (rules['titleCase']) {
    result = result.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return result
}

/**
 * Procesa un array de lineas ya parseadas aplicando el pipeline ETL completo.
 * Calcula el quality score antes y despues, aplica las reglas configuradas,
 * detecta duplicados y opcionalmente corrige typos por fuzzy matching.
 *
 * @param lines - Array de strings ya extraidos por el parser
 * @param options.rules - Reglas ETL a aplicar (default: DEFAULT_RULESET)
 * @param options.correct - Alias para activar fuzzyCorrect (compatibilidad v1)
 * @returns ProcessResult con comunas, logs, estadisticas y quality scores
 */
export function processFile(
  lines: string[],
  options: {
    rules?: Partial<ETLRuleSet>
    correct?: boolean
  } = {},
): ProcessResult {
  // Resolver el ruleset: combinar defaults con las opciones del usuario
  const baseRules = resolveRuleSet(options.rules ?? DEFAULT_RULESET)

  // El parametro 'correct' de v1 activa la regla fuzzyCorrect
  if (options.correct) {
    baseRules['fuzzyCorrect'] = true
  }

  // Calcular calidad del dataset ANTES de normalizar
  const qualityBefore = calculateQuality(lines)

  const logs: NormalizeResult[] = []

  // Mapa para detectar duplicados: clave normalizada → numero de linea
  const seen = new Map<string, number>()
  const comunas: { original: string; normalized: string }[] = []

  let changes = 0       // registros con cambio de formato
  let duplicates = 0    // registros descartados por ser duplicados
  let corrections = 0   // registros corregidos por fuzzy matching

  lines.forEach((line, idx) => {
    // Aplicar reglas de normalizacion de texto
    let normalized = normalizeText(line, baseRules)
    let changeType: NormalizeResult['changeType'] = normalized === line ? 'unchanged' : 'normalized'
    const details: string[] = []

    // Registrar que tipos de cambios se aplicaron
    if (baseRules['trim'] && line !== line.trim()) details.push('espacios eliminados')
    if (baseRules['collapseSpaces'] && /\s{2,}/.test(line)) details.push('espacios multiples normalizados')
    if (baseRules['removeAccents'] && /[áéíóúüñÁÉÍÓÚÜÑ]/.test(line)) details.push('tildes/enes removidas')
    if (
      baseRules['titleCase'] &&
      line.trim() !== normalized &&
      line.trim().toLowerCase() !== normalized.toLowerCase()
    ) {
      details.push('capitalizacion normalizada')
    }

    // Regla: correccion ortografica por fuzzy matching contra lista INE
    if (baseRules['fuzzyCorrect']) {
      const corrected = findBestComuna(normalized)
      if (corrected !== null && corrected !== normalized) {
        details.push(`typo corregido: "${normalized}" → "${corrected}"`)
        normalized = corrected
        changeType = 'corrected'
        corrections++
      }
    }

    // Regla: eliminar lineas vacias post-normalizacion
    if (baseRules['removeEmpty'] && normalized.trim().length === 0) {
      return // descartar linea
    }

    // Clave para comparacion de duplicados: minusculas sin tildes
    const key = normalized.toLowerCase()

    // Regla: deduplicar
    if (baseRules['deduplicate'] && seen.has(key)) {
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

  // Calcular calidad del dataset DESPUES de normalizar
  const qualityAfter = calculateQualityAfter(comunas)

  return {
    comunas,
    logs,
    totalInput: lines.length,
    totalOutput: comunas.length,
    duplicates,
    changes,
    corrections,
    qualityBefore,
    qualityAfter,
  }
}
