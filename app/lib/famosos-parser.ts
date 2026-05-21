/**
 * famosos-parser.ts
 * Parsea el archivo de famosos línea por línea.
 *
 * Formatos soportados (el número inicial es siempre opcional):
 *   "N. Nombre Completo - Fecha"   → separador " - "
 *   "N  Nombre Completo | Fecha"   → separador " | "
 *   "N. Nombre Completo : Fecha"   → separador " : "
 *   "Nombre Completo, Fecha"       → separador ","
 *
 * Detecta duplicados por nombre normalizado (sin tildes, minúsculas).
 * Normaliza fechas al estándar DD-MM-YYYY usando date-parser.ts.
 */

import { parseDate, calcularEdad, esCumpleanos } from './date-parser'

/** Datos de un famoso ya procesado y normalizado */
export interface FamosoRecord {
  nombre: string
  fechaOriginal: string
  fechaNormalizada: string | null
  fechaAprox: string | null
  edad: number | null
  esCumpleanos: boolean
  lineNumber: number
}

/** Resultado completo del procesamiento del archivo */
export interface FamososResult {
  famosos: FamosoRecord[]          // Registros únicos válidos
  duplicates: FamosoRecord[]       // Registros descartados por ser duplicados
  totalInput: number               // Total de líneas no vacías procesadas
  totalOutput: number              // Famosos únicos guardados
  duplicateCount: number           // Cantidad de duplicados eliminados
  cumpleanosCount: number          // Cuántos cumplen años hoy
  logs: string[]                   // Registro detallado de cada decisión
}

/**
 * Normaliza un nombre para comparación:
 * elimina tildes, convierte a minúsculas y colapsa espacios.
 * Usa escapes Unicode explícitos para el rango de diacríticos (U+0300–U+036F)
 * y evitar problemas de encoding en el archivo fuente.
 */
function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Eliminar diacríticos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Heurística para determinar si un fragmento de texto parece una fecha.
 * Acepta cualquier cadena que contenga dígitos (años, días, meses) o
 * palabras clave de fechas aproximadas o históricas.
 */
function pareceFecha(s: string): boolean {
  if (!s || s.trim().length === 0) return false
  // Si tiene al menos un dígito es muy probablemente una fecha
  if (/\d/.test(s)) return true
  // Palabras clave para fechas aproximadas, históricas o desconocidas
  if (/alrededor|circa|a\.C\.|a\.c\.|aprox|siglo|desconocida|desconocido|unknown/i.test(s)) {
    return true
  }
  return false
}

/**
 * Detecta automáticamente el separador entre nombre y fecha en una línea.
 * Prueba los separadores en orden de prioridad y valida que la parte
 * derecha parezca una fecha antes de aceptar el par.
 *
 * Prioridad: " - " > " | " > " : " > ","
 * La coma tiene menor prioridad para evitar partir mal nombres como
 * "Watson, Emma - 1990-04-15" cuando el separador real es " - ".
 *
 * @returns [nombre, fechaRaw] o null si ningún separador produce un par válido
 */
function detectarSeparador(linea: string): [string, string] | null {
  const separadores = [' - ', ' | ', ' : ', ',']

  for (const sep of separadores) {
    const idx = linea.indexOf(sep)
    if (idx === -1) continue

    const nombre = linea.slice(0, idx).trim()
    const fechaRaw = linea.slice(idx + sep.length).trim()

    // Solo aceptar si el nombre no está vacío y la parte derecha parece una fecha
    if (nombre.length > 0 && pareceFecha(fechaRaw)) {
      return [nombre, fechaRaw]
    }
  }

  return null
}

/**
 * Procesa el contenido completo del archivo de famosos.
 * Detecta y elimina duplicados conservando la primera aparición.
 */
export function procesarFamosos(content: string): FamososResult {
  // Dividir en líneas, normalizar saltos de línea Windows/Unix y limpiar vacías
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const famosos: FamosoRecord[] = []
  const duplicates: FamosoRecord[] = []
  const logs: string[] = []
  // Mapa de nombre normalizado → número de línea (1-base) de la primera aparición
  const seen = new Map<string, number>()

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1

    // Eliminar número de línea al inicio: "1. Nombre", "1 Nombre" o "Nombre"
    // El patrón ^\d+\.?\s+ acepta con punto ("1. ") y sin punto ("1 "),
    // pero requiere al menos un espacio para no truncar nombres que empiezan con número.
    const sinNumero = line.replace(/^\d+\.?\s+/, '')

    // Detectar separador entre nombre y fecha automáticamente
    const par = detectarSeparador(sinNumero)
    if (!par) {
      logs.push(`Línea ${lineNumber}: no parseado — "${line}"`)
      return
    }

    const [nombre, fechaOriginal] = par
    const parsed = parseDate(fechaOriginal)
    const edad = calcularEdad(parsed.date)
    const cumpleanos = esCumpleanos(parsed.date)

    const record: FamosoRecord = {
      nombre,
      fechaOriginal,
      fechaNormalizada: parsed.normalizada,
      fechaAprox: parsed.aprox,
      edad,
      esCumpleanos: cumpleanos,
      lineNumber,
    }

    const key = normalizarNombre(nombre)

    // Detectar duplicado por nombre normalizado
    if (seen.has(key)) {
      duplicates.push(record)
      logs.push(`Línea ${lineNumber}: DUPLICADO de línea ${seen.get(key)!} — "${nombre}"`)
      return
    }

    // Registrar primera aparición con número de línea 1-base
    seen.set(key, lineNumber)
    famosos.push(record)

    // Registrar resultado del parseo de fecha
    if (cumpleanos) {
      logs.push(`Línea ${lineNumber}: CUMPLEAÑOS HOY — "${nombre}"`)
    }
    if (parsed.normalizada) {
      logs.push(`Línea ${lineNumber}: "${fechaOriginal}" -> "${parsed.normalizada}"`)
    } else {
      logs.push(`Línea ${lineNumber}: fecha aproximada — "${parsed.aprox}"`)
    }
  })

  return {
    famosos,
    duplicates,
    totalInput: lines.length,
    totalOutput: famosos.length,
    duplicateCount: duplicates.length,
    cumpleanosCount: famosos.filter(f => f.esCumpleanos).length,
    logs,
  }
}
