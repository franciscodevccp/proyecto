/**
 * api/reporte/route.ts
 * Genera el reporte de análisis ejecutivo para un batch de cualquier módulo.
 *
 * GET /api/reporte?batchId=X&modulo=famosos|comunas|lugares
 *
 * Retorna datos estructurados que la página /reporte convierte en
 * lenguaje natural. Todo el cómputo ocurre aquí en el servidor.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'
import { esCumpleanosHoy, diasHastaProximoCumpleanos } from '../../lib/date-parser'

// ─── Detector de formato de fecha ─────────────────────────────────────────────

/**
 * Clasifica el formato de una fecha original (tal como vino en el archivo).
 * Cubre los patrones más frecuentes del parser de famosos.
 */
function detectarFormato(fecha: string): string {
  const f = fecha.trim()
  if (/a\.?c\.?/i.test(f))                                return 'Año a.C.'
  if (/^\d{1,2}\s+de\s+\w+/i.test(f))                    return 'D de Mes de AAAA'
  if (/^[a-záéíóúñ]{3,}\s+\d{1,2},?\s+\d{4}$/i.test(f)) return 'Mes D, AAAA'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f))                   return 'DD/MM/AAAA'
  if (/^\d{2}-\d{2}-\d{4}$/.test(f))                     return 'DD-MM-AAAA'
  if (/^\d{4}-\d{2}-\d{2}$/.test(f))                     return 'AAAA-MM-DD'
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(f))                   return 'DD.MM.AAAA'
  if (/^\d{4}$/.test(f))                                  return 'Solo año'
  return 'Formato libre'
}

// ─── Nombres de mes en español (para la etiqueta del próximo cumpleaños) ──────

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// ─── Módulo Famosos ───────────────────────────────────────────────────────────

/** Representa un famoso con su año de nacimiento para ordenación cronológica */
interface PersonaAnio {
  nombre: string
  anio: number
  display: string
  esAprox: boolean
}

async function reporteFamosos(batchId: string): Promise<NextResponse> {
  const batch = await prisma.famosoBatch.findUnique({
    where: { id: batchId },
    include: { famosos: { orderBy: { createdAt: 'asc' } } },
  })
  if (!batch) return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })

  const famosos = batch.famosos

  // ── Formatos de fecha detectados ─────────────────────────────────────────
  const fmtMap = new Map<string, number>()
  for (const f of famosos) {
    const fmt = detectarFormato(f.fechaOriginal)
    fmtMap.set(fmt, (fmtMap.get(fmt) ?? 0) + 1)
  }
  const formatos = Array.from(fmtMap.entries())
    .map(([nombre, count]) => ({ nombre, count }))
    .sort((a, b) => b.count - a.count)

  // ── Estadísticas de normalización ────────────────────────────────────────
  const conNormalizada = famosos.filter((f) => f.fechaNormalizada !== null).length
  const conAprox       = famosos.filter((f) => f.fechaAprox !== null).length
  const sinFecha       = famosos.filter((f) => !f.fechaNormalizada && !f.fechaAprox).length

  // ── Rango temporal (más antiguo / más reciente) ───────────────────────────
  const conAnio: PersonaAnio[] = []

  for (const f of famosos) {
    if (f.fechaNormalizada) {
      // DD-MM-YYYY → año en partes[2]
      const partes = f.fechaNormalizada.split('-')
      const anio   = parseInt(partes[2], 10)
      if (!isNaN(anio)) {
        conAnio.push({ nombre: f.nombre, anio, display: f.fechaNormalizada.replace(/-/g, '/'), esAprox: false })
      }
    } else if (f.fechaAprox) {
      // "aprox. 69 a.C." → año negativo
      const m = f.fechaAprox.match(/(\d+)\s*a\.?c\.?/i)
      if (m) {
        const anio = -parseInt(m[1], 10)
        conAnio.push({ nombre: f.nombre, anio, display: f.fechaAprox, esAprox: true })
      }
    }
  }

  const ordenados  = conAnio.sort((a, b) => a.anio - b.anio)
  const masAntiguo = ordenados[0]       ?? null
  const masReciente = ordenados[ordenados.length - 1] ?? null

  // ── Cumpleaños ────────────────────────────────────────────────────────────
  // esCumpleanosHoy y diasHastaProximoCumpleanos viven en date-parser para
  // evitar duplicación con la misma lógica usada en el módulo de famosos.
  const cumpleHoy = famosos
    .filter((f) => esCumpleanosHoy(f.fechaNormalizada))
    .map((f) => f.nombre)

  let proximoCumple: { nombre: string; diaMes: string; diasFaltan: number } | null = null
  if (cumpleHoy.length === 0) {
    let minDias = Infinity
    for (const f of famosos) {
      if (!f.fechaNormalizada) continue
      const p   = f.fechaNormalizada.split('-')
      const dia = parseInt(p[0], 10)
      const mes = parseInt(p[1], 10)
      const d   = diasHastaProximoCumpleanos(mes, dia)
      if (d < minDias) {
        minDias = d
        proximoCumple = {
          nombre: f.nombre,
          diaMes: `${dia} de ${MESES[mes - 1]}`,
          diasFaltan: d,
        }
      }
    }
  }

  const pctDups = batch.totalInput > 0
    ? Math.round((batch.duplicates / batch.totalInput) * 100)
    : 0

  return NextResponse.json({
    modulo: 'famosos',
    fileName: batch.fileName,
    createdAt: batch.createdAt.toISOString(),
    totalInput: batch.totalInput,
    totalOutput: batch.totalOutput,
    duplicates: batch.duplicates,
    pctDups,
    formatos,
    conNormalizada,
    conAprox,
    sinFecha,
    masAntiguo,
    masReciente,
    cumpleHoy,
    proximoCumple,
  })
}

// ─── Módulo Comunas ───────────────────────────────────────────────────────────

async function reporteComunas(batchId: string): Promise<NextResponse> {
  // A-04: se eliminó el take:2000 en logs — se usa groupBy para contar por tipo
  // sin cargar todos los logs en memoria (evita conteos incorrectos en batches grandes).
  const [batch, cambiosAgg] = await Promise.all([
    prisma.batch.findUnique({ where: { id: batchId } }),
    prisma.logEntry.groupBy({
      by: ['changeType'],
      where: { batchId },
      _count: { _all: true },
    }),
  ])
  if (!batch) return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })

  // Mapear el resultado de groupBy al formato esperado por la respuesta
  const cambios = cambiosAgg
    .map((g) => ({ tipo: g.changeType, count: g._count._all }))
    .sort((a, b) => b.count - a.count)

  const pctDups = batch.totalInput > 0
    ? Math.round((batch.duplicates / batch.totalInput) * 100)
    : 0
  const pctNorm = batch.totalOutput > 0
    ? Math.round((batch.changes / batch.totalOutput) * 100)
    : 0

  return NextResponse.json({
    modulo: 'comunas',
    fileName: batch.fileName,
    createdAt: batch.createdAt.toISOString(),
    totalInput: batch.totalInput,
    totalOutput: batch.totalOutput,
    duplicates: batch.duplicates,
    pctDups,
    changes: batch.changes,
    pctNorm,
    sinCambio: batch.totalOutput - batch.changes,
    qualityBefore: batch.qualityBefore,
    qualityAfter: batch.qualityAfter,
    cambios: cambios.slice(0, 6),
  })
}

// ─── Módulo Lugares ───────────────────────────────────────────────────────────

async function reporteLugares(batchId: string): Promise<NextResponse> {
  // A-03: se reemplazó el include masivo (load de todos los lugares + relaciones)
  // por consultas de agregación independientes. Esto evita cargar miles de registros
  // en memoria y reduce drásticamente el uso de RAM para batches grandes.
  const [
    batch,
    conGeoref,
    conDireccion,
    paisGroups,
    ciudadGroups,
    georefs,
  ] = await Promise.all([
    prisma.lugarBatch.findUnique({ where: { id: batchId } }),
    // Conteo de lugares con georeferencia
    prisma.georeferencia.count({ where: { lugar: { batchId } } }),
    // Conteo de lugares con dirección estructurada
    prisma.direccion.count({ where: { lugar: { batchId } } }),
    // Agrupación por país (sin cargar todos los registros)
    prisma.direccion.groupBy({
      by: ['pais'],
      where: { lugar: { batchId }, pais: { not: null } },
      _count: { _all: true },
    }),
    // Agrupación por ciudad/estado
    prisma.direccion.groupBy({
      by: ['ciudadEstadoProvincia'],
      where: { lugar: { batchId }, ciudadEstadoProvincia: { not: null } },
      _count: { _all: true },
    }),
    // Solo lat/lon para calcular el bounding box (sin cargar el resto del modelo)
    prisma.georeferencia.findMany({
      where: { lugar: { batchId } },
      select: { latitud: true, longitud: true },
    }),
  ])
  if (!batch) return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })

  const sinGeoref = batch.totalOutput - conGeoref

  // Construir listas de países y ciudades ordenadas por frecuencia
  const paises = paisGroups
    .filter((g) => g.pais !== null)
    .map((g) => ({ pais: g.pais as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const ciudades = ciudadGroups
    .filter((g) => g.ciudadEstadoProvincia !== null)
    .map((g) => ({ ciudad: g.ciudadEstadoProvincia as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Rango de coordenadas calculado en JS sobre solo los valores escalares
  const lats = georefs.map((g) => g.latitud)
  const lons = georefs.map((g) => g.longitud)

  const pctGeoref = batch.totalOutput > 0
    ? Math.round((conGeoref / batch.totalOutput) * 100)
    : 0
  const pctDups = batch.totalInput > 0
    ? Math.round((batch.duplicates / batch.totalInput) * 100)
    : 0

  return NextResponse.json({
    modulo: 'lugares',
    fileName: batch.fileName,
    createdAt: batch.createdAt.toISOString(),
    totalInput: batch.totalInput,
    totalOutput: batch.totalOutput,
    duplicates: batch.duplicates,
    pctDups,
    conGeoref,
    sinGeoref,
    conDireccion,
    pctGeoref,
    paises,
    ciudades,
    boundsLat: lats.length > 0 ? [Math.min(...lats), Math.max(...lats)] : null,
    boundsLon: lons.length > 0 ? [Math.min(...lons), Math.max(...lons)] : null,
    // El total de países distintos se obtiene directamente del groupBy
    totalPaises: paisGroups.filter((g) => g.pais !== null).length,
  })
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const batchId = req.nextUrl.searchParams.get('batchId')
  const modulo  = req.nextUrl.searchParams.get('modulo')

  if (!batchId || !modulo) {
    return NextResponse.json({ error: 'batchId y modulo son requeridos' }, { status: 400 })
  }

  // M-22: cada sub-función lanza si Prisma falla → capturar aquí para devolver 500 limpio
  try {
    if (modulo === 'famosos') return await reporteFamosos(batchId)
    if (modulo === 'comunas') return await reporteComunas(batchId)
    if (modulo === 'lugares') return await reporteLugares(batchId)
  } catch (error) {
    console.error('[reporte]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }

  return NextResponse.json({ error: 'Módulo no válido' }, { status: 400 })
}
