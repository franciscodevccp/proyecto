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

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo cerrado del DASHBOARD ejecutivo (/dashboard)
//
// Segundo catálogo de SOLO LECTURA, independiente de CONSULTAS_OLAP. Igual que
// aquél, el cliente NUNCA envía SQL: elige una operación por id y pasa filtros
// OPCIONALES. Los filtros se aplican SIEMPRE como parámetros ligados con nombre
// (:id_modulo, :fecha_desde…), nunca por concatenación de texto. Los valores se
// validan contra una lista blanca (sanitizarFiltros) construida con datos reales
// del propio DW, así que no hay superficie de inyección.
//
// Módulo Comunas = id_modulo 1 (ver etl-dw.ts). Solo Comunas tiene score y
// no_encontrados (FACT_CALIDAD_DIARIA); Famosos/Lugares quedan en 0/NULL → se
// devuelven como null y la UI muestra “—”, sin inventar valores.
// ─────────────────────────────────────────────────────────────────────────────

/** Id del módulo Comunas en el DW (única fuente de score/no_encontrados). */
const ID_MODULO_COMUNAS = 1

/** Filtros opcionales del dashboard, ya validados y tipados. */
export interface FiltrosDashboard {
  id_modulo?: number
  id_fuente?: number
  fecha_desde?: string // 'YYYY-MM-DD'
  fecha_hasta?: string // 'YYYY-MM-DD'
  region?: string
  pais?: string
  limite?: number
}

/** KPIs del encabezado. calidad_comunas/no_encontrados son null cuando no aplican. */
export interface DashboardKpis {
  total_hechos: number
  total_cargas: number
  calidad_comunas: number | null
  no_encontrados: number | null
}

export interface HechoPorModulo { modulo: string; total: number }
export interface RankingComuna { comuna: string; habitantes: number }
export interface CalidadDiaria { fecha: string; score: number }

/** Opciones reales para poblar los desplegables de filtros. */
export interface OpcionesFiltro {
  modulos: Array<{ id: number; nombre: string }>
  fuentes: Array<{ id: number; nombre: string; codigo: string }>
  regiones: string[]
  paises: string[]
  fechaMin: string | null
  fechaMax: string | null
}

/** Ids de las operaciones del dashboard (catálogo cerrado). */
export const DASHBOARD_OPS = [
  'dashboard_kpis',
  'dashboard_hechos_por_modulo',
  'dashboard_ranking_comunas',
  'dashboard_calidad_diaria',
  'dashboard_filtros',
] as const
export type DashboardOp = (typeof DASHBOARD_OPS)[number]

/** Todo lo que necesita la página /dashboard en una sola carga. */
export interface DashboardData {
  opciones: OpcionesFiltro
  filtros: FiltrosDashboard
  kpis: DashboardKpis
  hechosPorModulo: HechoPorModulo[]
  rankingComunas: RankingComuna[]
  calidadDiaria: CalidadDiaria[]
}

// ── Helpers de binding (evitan el edge case de objeto de params vacío) ──
function todas<T>(stmt: DatabaseType.Statement, params: Record<string, unknown>): T[] {
  return (Object.keys(params).length ? stmt.all(params) : stmt.all()) as T[]
}
function una<T>(stmt: DatabaseType.Statement, params: Record<string, unknown>): T {
  return (Object.keys(params).length ? stmt.get(params) : stmt.get()) as T
}

/** Convierte 'YYYY-MM-DD' a la clave inteligente id_tiempo (AAAAMMDD) o null. */
function fechaAIdTiempo(fecha?: string): number | null {
  if (!fecha) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  return m ? Number(m[1] + m[2] + m[3]) : null
}

/** Entero positivo o null (para ids y límite). */
function enteroPositivo(v: string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Valida y tipa los filtros crudos (querystring) contra una lista blanca real:
 * ids que existan en DIM_MODULO/DIM_FUENTE, fechas con formato ISO, y
 * region/pais que existan en DIM_UBICACION. Cualquier valor no reconocido se
 * descarta silenciosamente (no se propaga al SQL).
 */
export function sanitizarFiltros(
  raw: Record<string, string | null | undefined>,
  opciones: OpcionesFiltro,
): FiltrosDashboard {
  const f: FiltrosDashboard = {}

  const idMod = enteroPositivo(raw.id_modulo)
  if (idMod !== null && opciones.modulos.some((m) => m.id === idMod)) f.id_modulo = idMod

  const idFte = enteroPositivo(raw.id_fuente)
  if (idFte !== null && opciones.fuentes.some((s) => s.id === idFte)) f.id_fuente = idFte

  if (raw.fecha_desde && /^\d{4}-\d{2}-\d{2}$/.test(raw.fecha_desde)) f.fecha_desde = raw.fecha_desde
  if (raw.fecha_hasta && /^\d{4}-\d{2}-\d{2}$/.test(raw.fecha_hasta)) f.fecha_hasta = raw.fecha_hasta

  if (raw.region && opciones.regiones.includes(raw.region)) f.region = raw.region
  if (raw.pais && opciones.paises.includes(raw.pais)) f.pais = raw.pais

  const lim = enteroPositivo(raw.limite)
  if (lim !== null && lim >= 1 && lim <= 50) f.limite = lim

  return f
}

/**
 * Construye el WHERE de las consultas sobre FACT_NORMALIZACION (alias f) con
 * SOLO cláusulas fijas + parámetros ligados. `u` es el alias de DIM_UBICACION
 * (requerido si hay filtro de region/pais).
 */
function whereFact(f: FiltrosDashboard): { where: string; params: Record<string, unknown> } {
  const clausulas: string[] = []
  const params: Record<string, unknown> = {}
  if (f.id_modulo !== undefined) { clausulas.push('f.id_modulo = :id_modulo'); params.id_modulo = f.id_modulo }
  if (f.id_fuente !== undefined) { clausulas.push('f.id_fuente = :id_fuente'); params.id_fuente = f.id_fuente }
  const desde = fechaAIdTiempo(f.fecha_desde)
  if (desde !== null) { clausulas.push('f.id_tiempo >= :fecha_desde'); params.fecha_desde = desde }
  const hasta = fechaAIdTiempo(f.fecha_hasta)
  if (hasta !== null) { clausulas.push('f.id_tiempo <= :fecha_hasta'); params.fecha_hasta = hasta }
  if (f.region) { clausulas.push('u.region = :region'); params.region = f.region }
  if (f.pais) { clausulas.push('u.pais = :pais'); params.pais = f.pais }
  return { where: clausulas.length ? 'WHERE ' + clausulas.join(' AND ') : '', params }
}

/**
 * Construye el WHERE de las consultas sobre FACT_CALIDAD_DIARIA (alias f). Este
 * hecho de snapshot es solo-Comunas y no tiene id_fuente ni ubicación, así que
 * solo aplica el módulo Comunas fijo + el rango de fechas.
 */
function whereCalidad(f: FiltrosDashboard): { where: string; params: Record<string, unknown> } {
  const clausulas = ['f.id_modulo = :modulo_comunas']
  const params: Record<string, unknown> = { modulo_comunas: ID_MODULO_COMUNAS }
  const desde = fechaAIdTiempo(f.fecha_desde)
  if (desde !== null) { clausulas.push('f.id_tiempo >= :fecha_desde'); params.fecha_desde = desde }
  const hasta = fechaAIdTiempo(f.fecha_hasta)
  if (hasta !== null) { clausulas.push('f.id_tiempo <= :fecha_hasta'); params.fecha_hasta = hasta }
  return { where: 'WHERE ' + clausulas.join(' AND '), params }
}

/** ¿El filtro de módulo excluye a Comunas? (medidas de calidad → N/A). */
function excluyeComunas(f: FiltrosDashboard): boolean {
  return f.id_modulo !== undefined && f.id_modulo !== ID_MODULO_COMUNAS
}

// ── Operaciones internas (reciben un handle ya abierto) ──

function _opciones(db: DatabaseType.Database): OpcionesFiltro {
  const modulos = db.prepare(
    'SELECT id_modulo AS id, nombre_modulo AS nombre FROM dim_modulo ORDER BY id_modulo',
  ).all() as Array<{ id: number; nombre: string }>
  const fuentes = db.prepare(
    'SELECT id_fuente AS id, nombre_fuente AS nombre, codigo_fuente AS codigo FROM dim_fuente WHERE es_actual = 1 ORDER BY id_fuente',
  ).all() as Array<{ id: number; nombre: string; codigo: string }>
  const regiones = (db.prepare(
    "SELECT DISTINCT region FROM dim_ubicacion WHERE region IS NOT NULL AND region <> '' ORDER BY region",
  ).all() as Array<{ region: string }>).map((r) => r.region)
  const paises = (db.prepare(
    "SELECT DISTINCT pais FROM dim_ubicacion WHERE pais IS NOT NULL AND pais <> '' AND pais <> 'No aplica' ORDER BY pais",
  ).all() as Array<{ pais: string }>).map((r) => r.pais)
  const rango = db.prepare('SELECT MIN(fecha) AS min, MAX(fecha) AS max FROM dim_tiempo').get() as {
    min: string | null; max: string | null
  }
  return { modulos, fuentes, regiones, paises, fechaMin: rango.min, fechaMax: rango.max }
}

function _kpis(db: DatabaseType.Database, f: FiltrosDashboard): DashboardKpis {
  // total_hechos y total_cargas desde el hecho transaccional (respetan todos los filtros).
  const joinUbic = f.region || f.pais ? 'LEFT JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion' : ''
  const { where, params } = whereFact(f)
  const base = una<{ total_hechos: number; total_cargas: number }>(
    db.prepare(
      `SELECT COUNT(*) AS total_hechos, COUNT(DISTINCT f.id_archivo) AS total_cargas
       FROM fact_normalizacion f ${joinUbic} ${where}`,
    ),
    params,
  )

  // Calidad y no encontrados: snapshot solo-Comunas. N/A si el filtro excluye Comunas.
  let calidad_comunas: number | null = null
  let no_encontrados: number | null = null
  if (!excluyeComunas(f)) {
    const { where: whereCd, params: paramsCd } = whereCalidad(f)
    const cd = una<{ calidad: number | null; no_enc: number | null }>(
      db.prepare(
        `SELECT AVG(score_promedio) AS calidad, SUM(total_no_encontrados) AS no_enc
         FROM fact_calidad_diaria f ${whereCd}`,
      ),
      paramsCd,
    )
    calidad_comunas = cd.calidad !== null ? Math.round(cd.calidad * 100) / 100 : null
    no_encontrados = cd.no_enc // null si el rango no cubre días de Comunas
  }

  return { total_hechos: base.total_hechos, total_cargas: base.total_cargas, calidad_comunas, no_encontrados }
}

function _hechosPorModulo(db: DatabaseType.Database, f: FiltrosDashboard): HechoPorModulo[] {
  const joinUbic = f.region || f.pais ? 'LEFT JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion' : ''
  const { where, params } = whereFact(f)
  return todas<HechoPorModulo>(
    db.prepare(
      `SELECT m.nombre_modulo AS modulo, COUNT(*) AS total
       FROM fact_normalizacion f
       JOIN dim_modulo m ON f.id_modulo = m.id_modulo
       ${joinUbic} ${where}
       GROUP BY m.id_modulo, m.nombre_modulo
       ORDER BY total DESC`,
    ),
    params,
  )
}

function _rankingComunas(db: DatabaseType.Database, f: FiltrosDashboard): RankingComuna[] {
  if (excluyeComunas(f)) return [] // habitantes solo existe para Comunas
  const clausulas = ['f.id_modulo = :modulo_comunas', 'f.habitantes IS NOT NULL', 'u.comuna IS NOT NULL']
  const params: Record<string, unknown> = {
    modulo_comunas: ID_MODULO_COMUNAS,
    limite: f.limite && f.limite > 0 ? f.limite : 5,
  }
  if (f.id_fuente !== undefined) { clausulas.push('f.id_fuente = :id_fuente'); params.id_fuente = f.id_fuente }
  const desde = fechaAIdTiempo(f.fecha_desde)
  if (desde !== null) { clausulas.push('f.id_tiempo >= :fecha_desde'); params.fecha_desde = desde }
  const hasta = fechaAIdTiempo(f.fecha_hasta)
  if (hasta !== null) { clausulas.push('f.id_tiempo <= :fecha_hasta'); params.fecha_hasta = hasta }
  if (f.region) { clausulas.push('u.region = :region'); params.region = f.region }
  return todas<RankingComuna>(
    db.prepare(
      `SELECT u.comuna AS comuna, MAX(f.habitantes) AS habitantes
       FROM fact_normalizacion f
       JOIN dim_ubicacion u ON f.id_ubicacion = u.id_ubicacion
       WHERE ${clausulas.join(' AND ')}
       GROUP BY u.comuna
       ORDER BY habitantes DESC
       LIMIT :limite`,
    ),
    params,
  )
}

function _calidadDiaria(db: DatabaseType.Database, f: FiltrosDashboard): CalidadDiaria[] {
  if (excluyeComunas(f)) return []
  const clausulas = ['f.id_modulo = :modulo_comunas', 'f.score_promedio IS NOT NULL']
  const params: Record<string, unknown> = { modulo_comunas: ID_MODULO_COMUNAS }
  const desde = fechaAIdTiempo(f.fecha_desde)
  if (desde !== null) { clausulas.push('f.id_tiempo >= :fecha_desde'); params.fecha_desde = desde }
  const hasta = fechaAIdTiempo(f.fecha_hasta)
  if (hasta !== null) { clausulas.push('f.id_tiempo <= :fecha_hasta'); params.fecha_hasta = hasta }
  return todas<CalidadDiaria>(
    db.prepare(
      `SELECT t.fecha AS fecha, f.score_promedio AS score
       FROM fact_calidad_diaria f
       JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
       WHERE ${clausulas.join(' AND ')}
       ORDER BY t.fecha`,
    ),
    params,
  )
}

/**
 * Ejecuta UNA operación del dashboard por id (para el endpoint /api/dw/dashboard).
 * Valida los filtros crudos contra la lista blanca antes de tocar el SQL.
 */
export async function ejecutarDashboard(
  op: DashboardOp,
  raw: Record<string, string | null | undefined>,
): Promise<unknown> {
  const db = await abrirDW()
  try {
    const opciones = _opciones(db)
    const filtros = sanitizarFiltros(raw, opciones)
    switch (op) {
      case 'dashboard_kpis': return _kpis(db, filtros)
      case 'dashboard_hechos_por_modulo': return _hechosPorModulo(db, filtros)
      case 'dashboard_ranking_comunas': return _rankingComunas(db, filtros)
      case 'dashboard_calidad_diaria': return _calidadDiaria(db, filtros)
      case 'dashboard_filtros': return opciones
    }
  } finally {
    db.close()
  }
}

/** Carga TODO el dashboard en una sola apertura del DW (para el server component). */
export async function cargarDashboard(
  raw: Record<string, string | null | undefined>,
): Promise<DashboardData> {
  const db = await abrirDW()
  try {
    const opciones = _opciones(db)
    const filtros = sanitizarFiltros(raw, opciones)
    return {
      opciones,
      filtros,
      kpis: _kpis(db, filtros),
      hechosPorModulo: _hechosPorModulo(db, filtros),
      rankingComunas: _rankingComunas(db, filtros),
      calidadDiaria: _calidadDiaria(db, filtros),
    }
  } finally {
    db.close()
  }
}
