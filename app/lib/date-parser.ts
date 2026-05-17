/**
 * date-parser.ts
 * Detecta y normaliza fechas de múltiples formatos al estándar DD-MM-YYYY.
 * Soporta: YYYY/MM/DD, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY.
 * Las fechas aproximadas o a.C. se guardan como texto descriptivo.
 */

/** Resultado del parseo de una fecha */
export interface ParsedDate {
  normalizada: string | null  // "DD-MM-YYYY" o null si no es parseable
  aprox: string | null        // Texto libre para fechas aproximadas o históricas
  date: Date | null           // Objeto Date para cálculos de edad y cumpleaños
}

/**
 * Analiza una cadena de texto y retorna su fecha normalizada.
 * Detecta automáticamente el formato entre los 4 soportados.
 */
export function parseDate(raw: string): ParsedDate {
  const s = raw.trim()

  // Fechas a.C. o con "alrededor" — no convertibles a Date estándar
  if (s.toLowerCase().includes('a.c') || s.toLowerCase().includes('alrededor')) {
    return { normalizada: null, aprox: formatAprox(s), date: null }
  }

  // Formato 1: YYYY/MM/DD o YYYY-MM-DD (año primero)
  const iso = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/)
  if (iso) {
    const [, y, m, d] = iso
    return buildResult(parseInt(d), parseInt(m), parseInt(y))
  }

  // Formato 2: DD/MM/YYYY o DD-MM-YYYY (día primero)
  const dmy = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (dmy) {
    const [, d, m, y] = dmy
    return buildResult(parseInt(d), parseInt(m), parseInt(y))
  }

  // Formato no reconocido
  return { normalizada: null, aprox: `sin fecha: ${s}`, date: null }
}

/** Construye el resultado validando rangos numéricos */
function buildResult(d: number, m: number, y: number): ParsedDate {
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { normalizada: null, aprox: `fecha inválida: ${d}/${m}/${y}`, date: null }
  }
  const normalizada = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`
  const date = new Date(y, m - 1, d)
  return { normalizada, aprox: null, date }
}

/** Convierte texto con fechas aproximadas a formato legible */
function formatAprox(s: string): string {
  // Detectar año con "a.C." explícito (ej: "100 a.C./07/12" o "alrededor del 69 a.C.")
  const acMatch = s.match(/(\d+)\s*a\.?c\.?/i)
  if (acMatch) return `aprox. ${acMatch[1]} a.C.`
  // Detectar solo año numérico
  const yearMatch = s.match(/\d{3,4}/)
  if (yearMatch) return `aprox. ${yearMatch[0]}`
  return `aprox.: ${s}`
}

/**
 * Calcula la edad en años completos desde una fecha de nacimiento hasta hoy.
 * Retorna null si la fecha no es válida.
 */
export function calcularEdad(date: Date | null): number | null {
  if (!date) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - date.getFullYear()
  // Verificar si ya cumplió años este año
  const cumplioEsteAno =
    hoy.getMonth() > date.getMonth() ||
    (hoy.getMonth() === date.getMonth() && hoy.getDate() >= date.getDate())
  if (!cumplioEsteAno) edad--
  return edad < 0 ? null : edad
}

/**
 * Retorna true si hoy coincide exactamente con el día y mes de nacimiento.
 */
export function esCumpleanos(date: Date | null): boolean {
  if (!date) return false
  const hoy = new Date()
  return hoy.getMonth() === date.getMonth() && hoy.getDate() === date.getDate()
}
