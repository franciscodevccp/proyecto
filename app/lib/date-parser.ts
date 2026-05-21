/**
 * date-parser.ts
 * Detecta y normaliza fechas de múltiples formatos al estándar DD-MM-YYYY.
 *
 * Formatos soportados:
 *   Numéricos  : YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
 *   Español    : "14 de marzo de 1879", "14 de marzo 1879", "marzo de 1879"
 *   Inglés     : "March 14, 1879", "March 14 1879", "14 March 1879"
 *   Abreviados : "14 mar 1879", "14 Mar. 1879"
 *   Solo año   : "1879"  →  aprox sin date
 *   Históricos : "356 a.C.", "ca. 100 a.C.", "siglo XIX"
 */

/** Resultado del parseo de una fecha */
export interface ParsedDate {
  normalizada: string | null  // "DD-MM-YYYY" o null si no es parseable
  aprox: string | null        // Texto libre para fechas aproximadas o históricas
  date: Date | null           // Objeto Date para cálculos de edad y cumpleaños
}

// ─── Tablas de meses ─────────────────────────────────────────────────────────

const MESES_ES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
  // abreviaturas de 3 letras
  ene: 1, feb: 2, mar: 3, abr: 4, jun: 6,
  jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
}

const MESES_EN: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // abreviaturas de 3 letras
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

/** Busca el número de mes en ambas tablas (español e inglés) */
function mesNum(palabra: string): number | null {
  const p = palabra.toLowerCase().replace(/\.$/, '') // quitar punto final si es abrev.
  return MESES_ES[p] ?? MESES_EN[p] ?? null
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Analiza una cadena de texto y retorna su fecha normalizada.
 * Devuelve `normalizada` en formato DD-MM-YYYY y un objeto Date cuando es posible.
 */
export function parseDate(raw: string): ParsedDate {
  const s = raw.trim()
  const sl = s.toLowerCase()

  // 0. Vacío
  if (!s) return { normalizada: null, aprox: null, date: null }

  // 1. Fechas históricas a.C. / alrededor / circa / siglo
  if (/a\.?c\.?/i.test(s) || /alrededor/i.test(s) || /\bca\.?\b/i.test(s) || /siglo/i.test(sl)) {
    return { normalizada: null, aprox: formatAprox(s), date: null }
  }

  // 2. Solo año: "1879"  (4 dígitos, rango razonable 100–2100)
  const soloAnio = s.match(/^(\d{3,4})$/)
  if (soloAnio) {
    const y = parseInt(soloAnio[1])
    if (y >= 100 && y <= 2100) return { normalizada: null, aprox: String(y), date: null }
  }

  // 3. YYYY-MM-DD o YYYY/MM/DD (ISO y variante con barra)
  const iso = s.match(/^(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})$/)
  if (iso) return buildResult(parseInt(iso[3]), parseInt(iso[2]), parseInt(iso[1]))

  // 4. DD-MM-YYYY o DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/)
  if (dmy) return buildResult(parseInt(dmy[1]), parseInt(dmy[2]), parseInt(dmy[3]))

  // 5. DD.MM.YYYY  (separador punto)
  const dots = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dots) return buildResult(parseInt(dots[1]), parseInt(dots[2]), parseInt(dots[3]))

  // 6. "14 de marzo de 1879"  /  "14 de marzo 1879"
  const esLong = s.match(/^(\d{1,2})\s+de\s+(\w+)(?:\s+de)?\s+(\d{4})$/i)
  if (esLong) {
    const mes = mesNum(esLong[2])
    if (mes) return buildResult(parseInt(esLong[1]), mes, parseInt(esLong[3]))
  }

  // 7. "14 marzo 1879"  (sin "de")
  const esCorto = s.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i)
  if (esCorto) {
    const mes = mesNum(esCorto[2])
    if (mes) return buildResult(parseInt(esCorto[1]), mes, parseInt(esCorto[3]))
  }

  // 8. "March 14, 1879"  /  "March 14 1879"
  const enMDY = s.match(/^(\w+\.?)\s+(\d{1,2}),?\s+(\d{4})$/i)
  if (enMDY) {
    const mes = mesNum(enMDY[1])
    if (mes) return buildResult(parseInt(enMDY[2]), mes, parseInt(enMDY[3]))
  }

  // 9. "14 March 1879"  (día primero, mes en inglés)
  const enDMY = s.match(/^(\d{1,2})\s+(\w+\.?)\s+(\d{4})$/i)
  if (enDMY) {
    const mes = mesNum(enDMY[2])
    if (mes) return buildResult(parseInt(enDMY[1]), mes, parseInt(enDMY[3]))
  }

  // 10. "marzo de 1879"  /  "marzo 1879"  (mes + año, sin día → aprox)
  const mesSoloEs = s.match(/^(\w+)(?:\s+de)?\s+(\d{4})$/i)
  if (mesSoloEs) {
    const mes = mesNum(mesSoloEs[1])
    if (mes) {
      const y = parseInt(mesSoloEs[2])
      const nombreMes = mesSoloEs[1].charAt(0).toUpperCase() + mesSoloEs[1].slice(1).toLowerCase()
      return { normalizada: null, aprox: `${nombreMes} de ${y}`, date: null }
    }
  }

  // 11. Formato con año al final, cualquier separador mixto ("14/03.1879", etc.)
  const mixto = s.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})$/)
  if (mixto) return buildResult(parseInt(mixto[1]), parseInt(mixto[2]), parseInt(mixto[3]))

  // 12. No reconocido
  return { normalizada: null, aprox: `sin fecha: ${s}`, date: null }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construye el resultado validando rangos numéricos */
function buildResult(d: number, m: number, y: number): ParsedDate {
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { normalizada: null, aprox: `fecha inválida: ${d}/${m}/${y}`, date: null }
  }
  const normalizada = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`
  // Para años históricos anteriores a 100, Date() no funciona bien — usarlo solo para >= 1900
  const date = y >= 1000 ? new Date(y, m - 1, d) : null
  if (date && y < 100) date.setFullYear(y) // corrección para fechas < 1970 en JS
  return { normalizada, aprox: null, date }
}

/** Convierte texto con fechas aproximadas a formato legible */
function formatAprox(s: string): string {
  // "ca. 356 a.C." / "alrededor del 69 a.C." / "siglo XIX"
  if (/siglo/i.test(s)) return `aprox. ${s}`
  const acMatch = s.match(/(\d+)\s*a\.?c\.?/i)
  if (acMatch) return `aprox. ${acMatch[1]} a.C.`
  const yearMatch = s.match(/\d{3,4}/)
  if (yearMatch) return `aprox. ${yearMatch[0]}`
  return `aprox.: ${s}`
}

// ─── Exports utilitarios ──────────────────────────────────────────────────────

/**
 * Calcula la edad en años completos desde una fecha de nacimiento hasta hoy.
 * Retorna null si la fecha no es válida.
 */
export function calcularEdad(date: Date | null): number | null {
  if (!date) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - date.getFullYear()
  const cumplioEsteAnio =
    hoy.getMonth() > date.getMonth() ||
    (hoy.getMonth() === date.getMonth() && hoy.getDate() >= date.getDate())
  if (!cumplioEsteAnio) edad--
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
