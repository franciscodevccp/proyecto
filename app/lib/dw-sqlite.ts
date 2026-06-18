/**
 * dw-sqlite.ts
 * Acceso de SOLO LECTURA al Data Warehouse poblado en SQLite (Nivel 3).
 *
 * El DW vive en un archivo SQLite propio (datawarehouse.db), separado de la base
 * PostgreSQL operacional. Este módulo expone únicamente un catálogo CERRADO de
 * consultas OLAP (las de dw-model.ts): no se acepta SQL arbitrario, por lo que
 * no hay superficie de inyección — el cliente solo elige una operación por id.
 *
 * better-sqlite3 es un módulo nativo; se importa de forma perezosa (dynamic
 * import) para no cargar el binding en build, solo en runtime.
 */

import path from 'node:path'
import fs from 'node:fs'
import type DatabaseType from 'better-sqlite3'
import { CONSULTAS_OLAP, type OperacionId } from './dw-model'

/** Ruta del archivo SQLite del DW (raíz del proyecto, junto a package.json). */
export const DW_DB_PATH = path.join(process.cwd(), 'datawarehouse.db')

/** ¿El DW ya fue poblado (existe el archivo SQLite)? */
export function dwDisponible(): boolean {
  return fs.existsSync(DW_DB_PATH)
}

/** Abre el DW en modo solo lectura. Lanza si el archivo no existe. */
async function abrirDW(): Promise<DatabaseType.Database> {
  const { default: Database } = await import('better-sqlite3')
  return new Database(DW_DB_PATH, { readonly: true, fileMustExist: true })
}

/** Resultado tabular de una consulta OLAP. */
export interface ResultadoOlap {
  columnas: string[]
  filas: Array<Record<string, unknown>>
}

/**
 * Ejecuta una operación OLAP del catálogo cerrado.
 * El SQL es exactamente el que se muestra en la página (CONSULTAS_OLAP[op].sql);
 * `op` se valida contra el catálogo, así que nunca se ejecuta SQL externo.
 */
export async function ejecutarOlap(op: OperacionId): Promise<ResultadoOlap> {
  const consulta = CONSULTAS_OLAP.find((c) => c.id === op)
  if (!consulta) throw new Error(`Operación OLAP no permitida: ${op}`)

  const db = await abrirDW()
  try {
    const stmt = db.prepare(consulta.sql)
    const filas = stmt.all() as Array<Record<string, unknown>>
    // Si no hay filas, igual obtenemos los nombres de columna del statement.
    const columnas = filas.length > 0
      ? Object.keys(filas[0])
      : stmt.columns().map((c) => c.name)
    return { columnas, filas }
  } finally {
    db.close()
  }
}

/** Resumen del DW: cantidad de hechos cargados (para el estado de la página). */
export async function dwResumen(): Promise<{ totalHechos: number }> {
  const db = await abrirDW()
  try {
    const fila = db.prepare('SELECT COUNT(*) AS n FROM fact_normalizacion').get() as { n: number }
    return { totalHechos: fila.n }
  } finally {
    db.close()
  }
}
