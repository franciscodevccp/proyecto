/**
 * quality-score.ts
 * Calcula un score de calidad del dato (0-100) para un dataset de texto.
 * El score mide solo calidad de formato (tildes, capitalizacion, espacios).
 * Los duplicados se contabilizan e informan pero NO penalizan el score,
 * ya que son el problema esperado que la herramienta resuelve.
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

function scoreToGrade(score: number): QualityBreakdown['grade'] {
  if (score >= 90) return 'A'
  if (score >= 75) return 'B'
  if (score >= 55) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

function isTitleCase(text: string): boolean {
  return text
    .split(' ')
    .filter((w) => w.length > 0)
    .every((word) => word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase())
}

/**
 * Calcula el score de calidad del dataset.
 * Penaliza por problemas de formato de texto:
 *   - Tildes/enies:    hasta -50 puntos
 *   - Capitalizacion:  hasta -35 puntos
 *   - Espacios extra:  hasta -15 puntos
 * Los duplicados se detectan e informan en issues pero no afectan el score.
 */
export function calculateQuality(lines: string[]): QualityBreakdown {
  const total = lines.length

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

  const seen = new Map<string, boolean>()
  let duplicates = 0

  for (const line of lines) {
    if (line.trim().length === 0) {
      emptyLines++
      continue
    }

    if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(line)) {
      withAccents++
    }

    if (!isTitleCase(line.trim())) {
      wrongCase++
    }

    if (line !== line.trim() || /\s{2,}/.test(line)) {
      extraSpaces++
    }

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

  const pct = (n: number) => n / total

  const penaltyAccents = pct(withAccents) * 50
  const penaltyCase    = pct(wrongCase)   * 35
  const penaltySpaces  = pct(extraSpaces) * 15

  const score = Math.max(0, Math.round(100 - penaltyAccents - penaltyCase - penaltySpaces))

  return {
    score,
    totalRecords: total,
    issues: { withAccents, wrongCase, duplicates, extraSpaces, emptyLines },
    grade: scoreToGrade(score),
  }
}

/**
 * Calcula el score de calidad DESPUES de normalizar.
 */
export function calculateQualityAfter(
  comunas: { normalized: string }[],
): QualityBreakdown {
  return calculateQuality(comunas.map((c) => c.normalized))
}
