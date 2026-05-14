/**
 * quality-score.ts
 * Calcula un score de calidad del dato (0-100) para un dataset de texto.
 * Penaliza segun la frecuencia de problemas: tildes, capitalizacion incorrecta,
 * duplicados, espacios extra y lineas vacias.
 * Devuelve ademas una nota (A-F) y el detalle de cada problema encontrado.
 */

/** Desglose completo de la calidad de un dataset */
export interface QualityBreakdown {
  /** Puntaje final de calidad de 0 a 100 */
  score: number
  /** Total de registros analizados */
  totalRecords: number
  /** Conteo de registros con cada tipo de problema */
  issues: {
    /** Registros que contienen tildes, dieresis o enies */
    withAccents: number
    /** Registros con capitalizacion incorrecta (no Title Case) */
    wrongCase: number
    /** Registros duplicados (misma clave normalizada) */
    duplicates: number
    /** Registros con espacios al inicio, al final o multiples internos */
    extraSpaces: number
    /** Lineas vacias o que contienen solo espacios */
    emptyLines: number
  }
  /** Nota de calidad segun el score (A>=90, B>=75, C>=55, D>=35, F<35) */
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

/**
 * Convierte un score numerico en una nota de calidad al estilo academico.
 *
 * @param score - Valor entre 0 y 100
 * @returns Letra de calidad: A, B, C, D o F
 */
function scoreToGrade(score: number): QualityBreakdown['grade'] {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 55) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

/**
 * Verifica si un texto tiene el formato Title Case correcto.
 * Cada palabra debe comenzar con mayuscula y el resto ser minuscula.
 *
 * @param text - Texto a verificar
 * @returns true si el texto ya esta en Title Case
 */
function isTitleCase(text: string): boolean {
  return text
    .split(' ')
    .filter((w) => w.length > 0)
    .every((word) => word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase())
}

/**
 * Calcula el score de calidad del dataset ANTES de normalizar.
 * Analiza cada registro y penaliza segun los problemas encontrados.
 *
 * Pesos de penalizacion por cada 10% de registros afectados:
 *   - Duplicados:      -15 puntos
 *   - Tildes/enies:    -10 puntos
 *   - Capitalizacion:  -10 puntos
 *   - Espacios extra:   -5 puntos
 *
 * @param lines - Array de strings tal como vienen del archivo (sin normalizar)
 * @returns QualityBreakdown con score, issues y grade
 */
export function calculateQuality(lines: string[]): QualityBreakdown {
  const total = lines.length

  // Dataset vacio: calidad perfecta por convencion
  if (total === 0) {
    return {
      score: 100,
      totalRecords: 0,
      issues: { withAccents: 0, wrongCase: 0, duplicates: 0, extraSpaces: 0, emptyLines: 0 },
      grade: 'A',
    }
  }

  let withAccents = 0
  let wrongCase = 0
  let extraSpaces = 0
  let emptyLines = 0

  // Mapa para detectar duplicados (clave normalizada basica → primera aparicion)
  const seen = new Map<string, boolean>()
  let duplicates = 0

  for (const line of lines) {
    // Contar lineas vacias
    if (line.trim().length === 0) {
      emptyLines++
      continue
    }

    // Detectar tildes o enies en el texto
    if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(line)) {
      withAccents++
    }

    // Detectar capitalizacion incorrecta (no es Title Case)
    if (!isTitleCase(line.trim())) {
      wrongCase++
    }

    // Detectar espacios extra (inicio, fin o multiples internos)
    if (line !== line.trim() || /\s{2,}/.test(line)) {
      extraSpaces++
    }

    // Detectar duplicados usando clave en minusculas sin tildes basico
    const key = line
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (seen.has(key)) {
      duplicates++
    } else {
      seen.set(key, true)
    }
  }

  // Calcular penalizaciones como porcentaje de registros afectados
  // Cada 10% de afectados descuenta el peso correspondiente
  const pct = (n: number) => n / total // fraccion de 0 a 1

  const penaltyDuplicates = pct(duplicates) * 150   // peso 15 × 10
  const penaltyAccents = pct(withAccents) * 100      // peso 10 × 10
  const penaltyCase = pct(wrongCase) * 100           // peso 10 × 10
  const penaltySpaces = pct(extraSpaces) * 50        // peso  5 × 10

  const totalPenalty = penaltyDuplicates + penaltyAccents + penaltyCase + penaltySpaces
  const score = Math.max(0, Math.round(100 - totalPenalty))

  return {
    score,
    totalRecords: total,
    issues: { withAccents, wrongCase, duplicates, extraSpaces, emptyLines },
    grade: scoreToGrade(score),
  }
}

/**
 * Calcula el score de calidad DESPUES de normalizar.
 * Si el normalizador funciona correctamente el score deberia ser 100.
 * Se verifica que no queden tildes, que este en Title Case y sin duplicados.
 *
 * @param comunas - Array de comunas con campo 'normalized' ya procesado
 * @returns QualityBreakdown del estado post-normalizacion
 */
export function calculateQualityAfter(
  comunas: { normalized: string }[],
): QualityBreakdown {
  // Reusar la misma funcion pasando los valores normalizados
  return calculateQuality(comunas.map((c) => c.normalized))
}
