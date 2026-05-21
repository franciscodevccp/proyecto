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

/**
 * Construye el resultado de parseo validando rangos numéricos.
 * Corrige el umbral anterior (>= 1000) que dejaba sin objeto Date
 * a los años históricos entre 100 y 999 d.C.
 *
 * Para años 0-99 no se crea Date porque JS los interpreta como 1900+año,
 * lo que produciría objetos incorrectos sin posibilidad de corrección segura.
 */
function buildResult(d: number, m: number, y: number): ParsedDate {
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return { normalizada: null, aprox: `fecha inválida: ${d}/${m}/${y}`, date: null }
  }
  const normalizada = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`

  // Date() maneja correctamente años >= 100 d.C.
  // Para y < 100 la API añade 1900 al valor — esas fechas históricas no necesitan Date.
  const date = y >= 100 ? new Date(y, m - 1, d) : null

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
 * Recibe un objeto Date (resultado de parseDate).
 */
export function esCumpleanos(date: Date | null): boolean {
  if (!date) return false
  const hoy = new Date()
  return hoy.getMonth() === date.getMonth() && hoy.getDate() === date.getDate()
}

/**
 * Determina si una fecha normalizada (DD-MM-YYYY) corresponde al día de hoy.
 * Evalúa solo día y mes, ignora el año (es un cumpleaños, no una fecha exacta).
 * Versión centralizada que reemplaza `cumpleHoy()` en batch/route y download/route,
 * y `esHoy()` en FamososBirthdayBanner.
 * @param fechaNormalizada - Fecha en formato DD-MM-YYYY
 */
export function esCumpleanosHoy(fechaNormalizada: string | null): boolean {
  if (!fechaNormalizada) return false
  const partes = fechaNormalizada.split('-')
  if (partes.length !== 3) return false
  const dia = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10)
  if (isNaN(dia) || isNaN(mes) || mes < 1 || mes > 12 || dia < 1 || dia > 31) return false
  const hoy = new Date()
  return mes === hoy.getMonth() + 1 && dia === hoy.getDate()
}

/**
 * Calcula cuántos días faltan para el próximo cumpleaños (día y mes).
 * Si el cumpleaños ya pasó este año, devuelve los días hasta el año siguiente.
 * Versión centralizada que reemplaza las funciones `diasHasta()` locales.
 * @param mes - Número de mes (1-12)
 * @param dia - Número de día (1-31)
 */
export function diasHastaProximoCumpleanos(mes: number, dia: number): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  let proximo = new Date(hoy.getFullYear(), mes - 1, dia)
  proximo.setHours(0, 0, 0, 0)
  if (proximo.getTime() <= hoy.getTime()) {
    proximo = new Date(hoy.getFullYear() + 1, mes - 1, dia)
  }
  return Math.round((proximo.getTime() - hoy.getTime()) / 86_400_000)
}
