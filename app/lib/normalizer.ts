export interface NormalizeResult {
  original: string
  normalized: string
  changeType: 'unchanged' | 'normalized' | 'duplicate'
  detail: string
  lineNumber: number
}

export interface ProcessResult {
  comunas: { original: string; normalized: string }[]
  logs: NormalizeResult[]
  totalInput: number
  totalOutput: number
  duplicates: number
  changes: number
}

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function processFile(content: string): ProcessResult {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const logs: NormalizeResult[] = []
  const seen = new Map<string, number>()
  const comunas: { original: string; normalized: string }[] = []

  let changes = 0
  let duplicates = 0

  lines.forEach((line, idx) => {
    const normalized = normalizeText(line)
    const key = normalized.toLowerCase()

    if (seen.has(key)) {
      duplicates++
      logs.push({
        original: line,
        normalized,
        changeType: 'duplicate',
        detail: `Duplicado de línea ${seen.get(key)! + 1}`,
        lineNumber: idx + 1,
      })
      return
    }

    seen.set(key, idx)

    const details: string[] = []
    const trimmed = line.trim()

    if (trimmed !== line) details.push('espacios eliminados')
    if (/\s{2,}/.test(line)) details.push('espacios múltiples normalizados')
    if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(line)) details.push('tildes/eñes removidas')
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
