/**
 * famosos-parser.ts
 * Parsea el archivo de famosos línea por línea.
 * Formato esperado: "N. Nombre Completo - Fecha"
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
 * Procesa el contenido completo del archivo de famosos.
 * Detecta y elimina duplicados conservando la primera aparición.
 */
export function procesarFamosos(content: string): FamososResult {
  // Dividir en líneas, limpiar vacías
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  const famosos: FamosoRecord[] = []
  const duplicates: FamosoRecord[] = []
  const logs: string[] = []
  // Mapa de nombre normalizado → índice en el array famosos
  const seen = new Map<string, number>()

  lines.forEach((line, idx) => {
    // Soporta formato "N. Nombre - Fecha" o "Nombre - Fecha" directamente
    const match = line.match(/^(\d+\.)?\s*(.+?)\s*-\s*(.+)$/)
    if (!match) {
      logs.push(`Línea ${idx + 1}: no parseado — "${line}"`)
      return
    }

    const nombre = match[2].trim()
    const fechaOriginal = match[3].trim()
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
      lineNumber: idx + 1,
    }

    const key = normalizarNombre(nombre)

    // Detectar duplicado por nombre normalizado
    if (seen.has(key)) {
      duplicates.push(record)
      logs.push(`Línea ${idx + 1}: DUPLICADO de línea ${seen.get(key)! + 1} — "${nombre}"`)
      return
    }

    seen.set(key, idx)
    famosos.push(record)

    // Registrar resultado del parseo de fecha
    if (cumpleanos) {
      logs.push(`Línea ${idx + 1}: CUMPLEANOS HOY — "${nombre}"`)
    }
    if (parsed.normalizada) {
      logs.push(`Línea ${idx + 1}: "${fechaOriginal}" -> "${parsed.normalizada}"`)
    } else {
      logs.push(`Línea ${idx + 1}: fecha aproximada — "${parsed.aprox}"`)
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
