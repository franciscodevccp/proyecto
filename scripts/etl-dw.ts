/**
 * scripts/etl-dw.ts
 * ETL del Data Warehouse (Nivel 3). Se ejecuta con `pnpm etl`.
 *
 * Lee la base operacional PostgreSQL (vía el cliente Prisma ya existente) y
 * puebla el esquema estrella en un archivo SQLite propio (datawarehouse.db).
 * NO toca PostgreSQL ni el schema Prisma: solo lee y vuelca a SQLite.
 *
 * Realidad del modelo operacional (ver dw-model.ts): hay 3 jerarquías batch
 * independientes — Batch→Comuna, FamosoBatch→Famoso, LugarBatch→Lugar. El detalle
 * por registro (changeType, calidad) solo existe para Comunas (tabla LogEntry);
 * en Famosos/Lugares se trabaja a nivel del registro persistido. No se inventan
 * datos: las medidas que no existen por registro quedan en su valor neutro.
 *
 * Requiere DATABASE_URL en el entorno (.env) — la BD es local del VPS.
 */

import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { PrismaClient } from '../app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { FUENTES_SCD2 } from '../app/lib/dw-model'

// ─── Conexión a la base operacional ──────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error('[ETL] DATABASE_URL no está definida. Revisa el .env.')
}
const prisma = new PrismaClient({ adapter: new PrismaPg(DATABASE_URL) })

const DB_PATH = path.join(process.cwd(), 'datawarehouse.db')

// ─── Utilidades de fecha y calidad ───────────────────────────────────────────

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

interface DescTiempo {
  idTiempo: number
  fecha: string
  anio: number
  trimestre: number
  mes: number
  nombreMes: string
  dia: number
  diaSemana: number
  nombreDia: string
  esFinSemana: number
}

/** Descompone una fecha en los atributos de DIM_TIEMPO. id = AAAAMMDD. */
function describirTiempo(d: Date): DescTiempo {
  const anio = d.getFullYear()
  const mes = d.getMonth() + 1
  const dia = d.getDate()
  const diaSemana = d.getDay()
  return {
    idTiempo: anio * 10000 + mes * 100 + dia,
    fecha: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
    anio,
    trimestre: Math.floor((mes - 1) / 3) + 1,
    mes,
    nombreMes: MESES[mes - 1],
    dia,
    diaSemana,
    nombreDia: DIAS[diaSemana],
    esFinSemana: diaSemana === 0 || diaSemana === 6 ? 1 : 0,
  }
}

/**
 * Clasifica el formato de una fecha de nacimiento (Famosos).
 * Réplica de detectarFormato() de app/api/reporte/route.ts.
 */
function detectarFormato(fecha: string): string {
  const f = fecha.trim()
  if (/a\.?\s?c\.?/i.test(f)) return 'Año a.C.'
  if (/^\d{1,2}\s+de\s+\w+/i.test(f)) return 'D de Mes de AAAA'
  if (/^[a-záéíóúñ]{3,}\s+\d{1,2},?\s+\d{4}$/i.test(f)) return 'Mes D, AAAA'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) return 'DD/MM/AAAA'
  if (/^\d{2}-\d{2}-\d{4}$/.test(f)) return 'DD-MM-AAAA'
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return 'AAAA-MM-DD'
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(f)) return 'DD.MM.AAAA'
  if (/^\d{4}$/.test(f)) return 'Solo año'
  return 'Formato libre'
}

const tieneTildes = (s: string): number => (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(s) ? 1 : 0)
const espaciosExtra = (s: string): number => (s !== s.trim() || /\s{2,}/.test(s) ? 1 : 0)
function capIncorrecta(s: string): number {
  const palabras = s.trim().split(/\s+/).filter(Boolean)
  const esTitle = palabras.every((w) => w[0] === w[0].toUpperCase() && w.slice(1) === w.slice(1).toLowerCase())
  return esTitle ? 0 : 1
}

/** Extensión del archivo como formato (txt/csv/tsv). */
function formatoArchivo(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return ['txt', 'csv', 'tsv'].includes(ext) ? ext : 'txt'
}

// ─── Esquema estrella en SQLite ──────────────────────────────────────────────

const DDL = `
DROP TABLE IF EXISTS fact_normalizacion;
DROP TABLE IF EXISTS fact_calidad_diaria;
DROP TABLE IF EXISTS dim_tiempo;
DROP TABLE IF EXISTS dim_modulo;
DROP TABLE IF EXISTS dim_fuente;
DROP TABLE IF EXISTS dim_archivo;
DROP TABLE IF EXISTS dim_ubicacion;
DROP TABLE IF EXISTS dim_tipo_cambio;
DROP TABLE IF EXISTS dim_formato_fecha;

CREATE TABLE dim_tiempo (
  id_tiempo INTEGER PRIMARY KEY, fecha TEXT, anio INTEGER, trimestre INTEGER,
  mes INTEGER, nombre_mes TEXT, dia INTEGER, dia_semana INTEGER, nombre_dia TEXT, es_fin_semana INTEGER
);
CREATE TABLE dim_modulo (
  id_modulo INTEGER PRIMARY KEY, nombre_modulo TEXT, descripcion TEXT, tipo_entidad TEXT
);
CREATE TABLE dim_fuente (
  id_fuente INTEGER PRIMARY KEY, codigo_fuente TEXT, nombre_fuente TEXT, institucion TEXT,
  url TEXT, tipo TEXT, version INTEGER, valido_desde TEXT, valido_hasta TEXT, es_actual INTEGER
);
CREATE TABLE dim_archivo (
  id_archivo INTEGER PRIMARY KEY, nombre_archivo TEXT, formato TEXT, encoding TEXT, total_registros INTEGER
);
CREATE TABLE dim_ubicacion (
  id_ubicacion INTEGER PRIMARY KEY, pais TEXT, region TEXT, comuna TEXT, ciudad TEXT, zona_geografica TEXT
);
CREATE TABLE dim_tipo_cambio (
  id_tipo_cambio INTEGER PRIMARY KEY, codigo TEXT, etiqueta TEXT, descripcion TEXT
);
CREATE TABLE dim_formato_fecha (
  id_formato_fecha INTEGER PRIMARY KEY, codigo TEXT, etiqueta TEXT, ejemplo TEXT
);
CREATE TABLE fact_normalizacion (
  id_hecho INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tiempo INTEGER, id_modulo INTEGER, id_fuente INTEGER, id_archivo INTEGER,
  id_ubicacion INTEGER, id_tipo_cambio INTEGER, id_formato_fecha INTEGER,
  es_duplicado INTEGER, fue_normalizado INTEGER, fue_corregido INTEGER, tiene_georef INTEGER,
  es_cumpleanos INTEGER, tenia_tildes INTEGER, capitalizacion_incorrecta INTEGER, tenia_espacios_extra INTEGER,
  habitantes INTEGER, edad INTEGER
);
CREATE TABLE fact_calidad_diaria (
  id_tiempo INTEGER, id_modulo INTEGER, registros_procesados INTEGER, total_duplicados INTEGER,
  total_normalizados INTEGER, total_no_encontrados INTEGER, score_promedio REAL,
  PRIMARY KEY (id_tiempo, id_modulo)
);
`

/** Una fila lista para insertar en fact_normalizacion. */
interface FilaHecho {
  idTiempo: number
  idModulo: number
  idFuente: number
  idArchivo: number
  idUbicacion: number
  idTipoCambio: number
  idFormatoFecha: number
  esDuplicado: number
  fueNormalizado: number
  fueCorregido: number
  tieneGeoref: number
  esCumpleanos: number
  teniaTildes: number
  capIncorrecta: number
  teniaEspacios: number
  habitantes: number | null
  edad: number | null
}

async function main(): Promise<void> {
  console.log('[ETL] Leyendo base operacional…')
  const [batchesComunas, batchesFamosos, batchesLugares] = await Promise.all([
    prisma.batch.findMany({ include: { logs: true, comunas: true } }),
    prisma.famosoBatch.findMany({ include: { famosos: true } }),
    prisma.lugarBatch.findMany({ include: { lugares: { include: { georef: true, direccion: true } } } }),
  ])
  console.log(`[ETL] Batches: comunas=${batchesComunas.length}, famosos=${batchesFamosos.length}, lugares=${batchesLugares.length}`)

  if (fs.existsSync(DB_PATH)) fs.rmSync(DB_PATH)
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(DDL)

  // ── Dimensiones de catálogo fijo ──
  const insModulo = db.prepare('INSERT INTO dim_modulo (id_modulo, nombre_modulo, descripcion, tipo_entidad) VALUES (?,?,?,?)')
  const moduloId: Record<string, number> = { Comunas: 1, Famosos: 2, Lugares: 3 }
  insModulo.run(1, 'Comunas', 'Normalización de comunas chilenas', 'Comuna')
  insModulo.run(2, 'Famosos', 'Normalización de personajes y fechas', 'Persona')
  insModulo.run(3, 'Lugares', 'Normalización de lugares turísticos', 'Lugar turístico')

  // DIM_FUENTE desde el catálogo SCD2; los hechos referencian la versión vigente por código.
  const insFuente = db.prepare('INSERT INTO dim_fuente (id_fuente, codigo_fuente, nombre_fuente, institucion, url, tipo, version, valido_desde, valido_hasta, es_actual) VALUES (?,?,?,?,?,?,?,?,?,?)')
  const fuenteActual = new Map<string, number>()
  for (const f of FUENTES_SCD2) {
    insFuente.run(f.idFuente, f.codigo, f.nombreFuente, null, null, null, f.version, f.validoDesde, f.validoHasta, f.esActual ? 1 : 0)
    if (f.esActual) fuenteActual.set(f.codigo, f.idFuente)
  }
  const idFuente = (codigo: string): number => fuenteActual.get(codigo) ?? fuenteActual.get('MANUAL') ?? 5

  // DIM_TIPO_CAMBIO (catálogo base + get-or-create para valores no previstos).
  const insTipoCambio = db.prepare('INSERT INTO dim_tipo_cambio (id_tipo_cambio, codigo, etiqueta, descripcion) VALUES (?,?,?,?)')
  const tipoCambioId = new Map<string, number>()
  const TIPOS_BASE: Array<[string, string]> = [
    ['normalized', 'Normalizado'], ['duplicate', 'Duplicado'], ['corrected', 'Corregido'], ['unchanged', 'Sin cambio'],
  ]
  TIPOS_BASE.forEach(([codigo, etiqueta], i) => {
    insTipoCambio.run(i + 1, codigo, etiqueta, null)
    tipoCambioId.set(codigo, i + 1)
  })
  let nextTipoCambio = TIPOS_BASE.length + 1
  const idTipoCambio = (codigo: string): number => {
    const c = codigo || 'unchanged'
    const existente = tipoCambioId.get(c)
    if (existente !== undefined) return existente
    const id = nextTipoCambio++
    insTipoCambio.run(id, c, c, null)
    tipoCambioId.set(c, id)
    return id
  }

  // ── Dimensiones con get-or-create ──
  const insTiempo = db.prepare('INSERT OR IGNORE INTO dim_tiempo (id_tiempo, fecha, anio, trimestre, mes, nombre_mes, dia, dia_semana, nombre_dia, es_fin_semana) VALUES (?,?,?,?,?,?,?,?,?,?)')
  const tiempoVistos = new Set<number>()
  const idTiempo = (d: Date): number => {
    const t = describirTiempo(d)
    if (!tiempoVistos.has(t.idTiempo)) {
      insTiempo.run(t.idTiempo, t.fecha, t.anio, t.trimestre, t.mes, t.nombreMes, t.dia, t.diaSemana, t.nombreDia, t.esFinSemana)
      tiempoVistos.add(t.idTiempo)
    }
    return t.idTiempo
  }

  const insArchivo = db.prepare('INSERT INTO dim_archivo (id_archivo, nombre_archivo, formato, encoding, total_registros) VALUES (?,?,?,?,?)')
  const archivoId = new Map<string, number>()
  let nextArchivo = 1
  const idArchivo = (fileName: string, totalRegistros: number): number => {
    const existente = archivoId.get(fileName)
    if (existente !== undefined) return existente
    const id = nextArchivo++
    insArchivo.run(id, fileName, formatoArchivo(fileName), null, totalRegistros)
    archivoId.set(fileName, id)
    return id
  }

  const insUbicacion = db.prepare('INSERT INTO dim_ubicacion (id_ubicacion, pais, region, comuna, ciudad, zona_geografica) VALUES (?,?,?,?,?,?)')
  const ubicacionId = new Map<string, number>()
  insUbicacion.run(1, 'No aplica', null, null, null, null) // miembro "No aplica"
  ubicacionId.set('__NA__', 1)
  let nextUbicacion = 2
  const idUbicacion = (pais: string | null, region: string | null, comuna: string | null, ciudad: string | null): number => {
    const clave = JSON.stringify([pais, region, comuna, ciudad])
    const existente = ubicacionId.get(clave)
    if (existente !== undefined) return existente
    const id = nextUbicacion++
    insUbicacion.run(id, pais, region, comuna, ciudad, null)
    ubicacionId.set(clave, id)
    return id
  }
  const UBIC_NA = 1

  const insFormato = db.prepare('INSERT INTO dim_formato_fecha (id_formato_fecha, codigo, etiqueta, ejemplo) VALUES (?,?,?,?)')
  const formatoId = new Map<string, number>()
  insFormato.run(1, 'no_aplica', 'No aplica', null)
  formatoId.set('No aplica', 1)
  let nextFormato = 2
  const idFormato = (etiqueta: string): number => {
    const existente = formatoId.get(etiqueta)
    if (existente !== undefined) return existente
    const id = nextFormato++
    insFormato.run(id, etiqueta.toLowerCase().replace(/\s+/g, '_'), etiqueta, null)
    formatoId.set(etiqueta, id)
    return id
  }
  const FORMATO_NA = 1

  // ── Construcción de hechos ──
  const hechos: FilaHecho[] = []

  // Comunas: cada LogEntry es un registro de entrada (el grano más fino real).
  for (const b of batchesComunas) {
    const t = idTiempo(b.createdAt)
    const a = idArchivo(b.fileName, b.totalInput)
    // Mapa normalized → comuna (para enriquecer con region/habitantes).
    const porNombre = new Map<string, (typeof b.comunas)[number]>()
    for (const c of b.comunas) porNombre.set(c.normalized, c)

    for (const log of b.logs) {
      const esDup = log.changeType === 'duplicate' ? 1 : 0
      const comuna = esDup ? undefined : porNombre.get(log.normalized)
      const tieneHab = comuna?.habitantes != null
      hechos.push({
        idTiempo: t,
        idModulo: moduloId.Comunas,
        idFuente: idFuente(tieneHab ? 'INE' : 'DPA'),
        idArchivo: a,
        idUbicacion: comuna ? idUbicacion('Chile', comuna.region ?? null, comuna.normalized, null) : UBIC_NA,
        idTipoCambio: idTipoCambio(log.changeType),
        idFormatoFecha: FORMATO_NA,
        esDuplicado: esDup,
        fueNormalizado: log.changeType === 'normalized' ? 1 : 0,
        fueCorregido: log.changeType === 'corrected' ? 1 : 0,
        tieneGeoref: 0,
        esCumpleanos: 0,
        teniaTildes: tieneTildes(log.original),
        capIncorrecta: capIncorrecta(log.original),
        teniaEspacios: espaciosExtra(log.original),
        habitantes: comuna?.habitantes ?? null,
        edad: null,
      })
    }
  }

  // Famosos: cada Famoso persistido es un registro (no hay LogEntry para famosos).
  for (const b of batchesFamosos) {
    const t = idTiempo(b.createdAt)
    const a = idArchivo(b.fileName, b.totalInput)
    for (const fa of b.famosos) {
      hechos.push({
        idTiempo: t,
        idModulo: moduloId.Famosos,
        idFuente: idFuente('WIKI'),
        idArchivo: a,
        idUbicacion: UBIC_NA,
        idTipoCambio: idTipoCambio('normalized'),
        idFormatoFecha: idFormato(detectarFormato(fa.fechaOriginal)),
        esDuplicado: 0,
        fueNormalizado: 1,
        fueCorregido: 0,
        tieneGeoref: 0,
        esCumpleanos: fa.esCumpleanos ? 1 : 0,
        teniaTildes: 0,
        capIncorrecta: 0,
        teniaEspacios: 0,
        habitantes: null,
        edad: fa.edad ?? null,
      })
    }
  }

  // Lugares: cada Lugar persistido es un registro (georef/direccion por relación).
  for (const b of batchesLugares) {
    const t = idTiempo(b.createdAt)
    const a = idArchivo(b.fileName, b.totalInput)
    for (const lu of b.lugares) {
      const pais = lu.direccion?.pais ?? null
      const ciudad = lu.direccion?.ciudadEstadoProvincia ?? null
      hechos.push({
        idTiempo: t,
        idModulo: moduloId.Lugares,
        idFuente: idFuente('MANUAL'),
        idArchivo: a,
        idUbicacion: lu.direccion ? idUbicacion(pais, null, null, ciudad) : UBIC_NA,
        idTipoCambio: idTipoCambio('normalized'),
        idFormatoFecha: FORMATO_NA,
        esDuplicado: 0,
        fueNormalizado: 1,
        fueCorregido: 0,
        tieneGeoref: lu.georef ? 1 : 0,
        esCumpleanos: 0,
        teniaTildes: 0,
        capIncorrecta: 0,
        teniaEspacios: 0,
        habitantes: null,
        edad: null,
      })
    }
  }

  // ── Inserción masiva de hechos (en una transacción) ──
  const insHecho = db.prepare(`INSERT INTO fact_normalizacion
    (id_tiempo, id_modulo, id_fuente, id_archivo, id_ubicacion, id_tipo_cambio, id_formato_fecha,
     es_duplicado, fue_normalizado, fue_corregido, tiene_georef, es_cumpleanos,
     tenia_tildes, capitalizacion_incorrecta, tenia_espacios_extra, habitantes, edad)
    VALUES (@idTiempo,@idModulo,@idFuente,@idArchivo,@idUbicacion,@idTipoCambio,@idFormatoFecha,
     @esDuplicado,@fueNormalizado,@fueCorregido,@tieneGeoref,@esCumpleanos,
     @teniaTildes,@capIncorrecta,@teniaEspacios,@habitantes,@edad)`)
  const insertarHechos = db.transaction((filas: FilaHecho[]) => {
    for (const f of filas) insHecho.run(f)
  })
  insertarHechos(hechos)

  // ── fact_calidad_diaria: snapshot agregado por módulo × día ──
  // COUNT(*), SUM(es_duplicado) y SUM(fue_normalizado) sí se derivan bien de
  // fact_normalizacion; total_no_encontrados y score_promedio NO (no existen por
  // registro), así que aquí entran como 0 / NULL y se corrigen abajo solo para Comunas.
  db.exec(`INSERT INTO fact_calidad_diaria (id_tiempo, id_modulo, registros_procesados, total_duplicados, total_normalizados, total_no_encontrados, score_promedio)
    SELECT id_tiempo, id_modulo, COUNT(*), SUM(es_duplicado), SUM(fue_normalizado), 0, NULL
    FROM fact_normalizacion GROUP BY id_tiempo, id_modulo`)

  // Medidas exclusivas del módulo Comunas (id_modulo = 1): total_no_encontrados y
  // score_promedio se calculan desde los Batch de comunas —las únicas jerarquías que
  // persisten noEncontrados y qualityAfter— agregando por día (id_tiempo). Famosos y
  // Lugares no tienen estos datos: quedan en 0 / NULL (no se inventan valores).
  interface AggCalidad {
    noEncontrados: number // SUMA de Batch.noEncontrados del día
    sumaScore: number     // acumulador para promediar qualityAfter
    nScore: number        // cantidad de batches con qualityAfter no-null
  }
  const calidadPorDia = new Map<number, AggCalidad>()
  for (const b of batchesComunas) {
    const idt = describirTiempo(b.createdAt).idTiempo
    const agg = calidadPorDia.get(idt) ?? { noEncontrados: 0, sumaScore: 0, nScore: 0 }
    agg.noEncontrados += b.noEncontrados
    if (b.qualityAfter != null) {
      agg.sumaScore += b.qualityAfter
      agg.nScore += 1
    }
    calidadPorDia.set(idt, agg)
  }
  const updCalidad = db.prepare(
    'UPDATE fact_calidad_diaria SET total_no_encontrados = ?, score_promedio = ? WHERE id_tiempo = ? AND id_modulo = ?'
  )
  for (const [idt, agg] of calidadPorDia) {
    // Promedio de qualityAfter ignorando los null; redondeado a 2 decimales (DECIMAL(5,2)).
    const scorePromedio = agg.nScore > 0 ? Math.round((agg.sumaScore / agg.nScore) * 100) / 100 : null
    updCalidad.run(agg.noEncontrados, scorePromedio, idt, moduloId.Comunas)
  }

  const total = db.prepare('SELECT COUNT(*) AS n FROM fact_normalizacion').get() as { n: number }
  console.log(`[ETL] Hechos cargados: ${total.n}`)
  console.log(`[ETL] Dimensiones: tiempo=${tiempoVistos.size}, archivo=${archivoId.size}, ubicacion=${nextUbicacion - 1}, formato=${nextFormato - 1}, tipo_cambio=${tipoCambioId.size}`)
  console.log(`[ETL] DW escrito en ${DB_PATH}`)

  db.close()
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('[ETL] Error:', e)
  await prisma.$disconnect()
  process.exit(1)
})
