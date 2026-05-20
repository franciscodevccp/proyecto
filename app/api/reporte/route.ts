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

// ─── Helpers de cumpleaños ────────────────────────────────────────────────────

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Días hasta la próxima ocurrencia del día/mes dado */
function diasHasta(mes: number, dia: number): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  let proximo = new Date(hoy.getFullYear(), mes - 1, dia)
  proximo.setHours(0, 0, 0, 0)
  if (proximo.getTime() <= hoy.getTime()) {
    proximo = new Date(hoy.getFullYear() + 1, mes - 1, dia)
  }
  return Math.round((proximo.getTime() - hoy.getTime()) / 86_400_000)
}

// ─── Módulo Famosos ───────────────────────────────────────────────────────────

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
  interface PersonaAnio {
    nombre: string
    anio: number
    display: string
    esAprox: boolean
  }

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
  const hoy    = new Date()
  const mesHoy = hoy.getMonth() + 1
  const diaHoy = hoy.getDate()

  const cumpleHoy: string[] = []
  for (const f of famosos) {
    if (!f.fechaNormalizada) continue
    const p = f.fechaNormalizada.split('-')
    if (parseInt(p[1], 10) === mesHoy && parseInt(p[0], 10) === diaHoy) {
      cumpleHoy.push(f.nombre)
    }
  }

  let proximoCumple: { nombre: string; diaMes: string; diasFaltan: number } | null = null
  if (cumpleHoy.length === 0) {
    let minDias = Infinity
    for (const f of famosos) {
      if (!f.fechaNormalizada) continue
      const p   = f.fechaNormalizada.split('-')
      const dia = parseInt(p[0], 10)
      const mes = parseInt(p[1], 10)
      const d   = diasHasta(mes, dia)
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
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    include: {
      logs: {
        select: { changeType: true },
        take: 2000,
      },
    },
  })
  if (!batch) return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })

  // Conteo por tipo de cambio
  const tipoMap = new Map<string, number>()
  for (const log of batch.logs) {
    tipoMap.set(log.changeType, (tipoMap.get(log.changeType) ?? 0) + 1)
  }
  const cambios = Array.from(tipoMap.entries())
    .map(([tipo, count]) => ({ tipo, count }))
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
  const batch = await prisma.lugarBatch.findUnique({
    where: { id: batchId },
    include: {
      lugares: {
        include: { georef: true, direccion: true },
      },
    },
  })
  if (!batch) return NextResponse.json({ error: 'Batch no encontrado' }, { status: 404 })

  const lugares = batch.lugares

  const conGeoref   = lugares.filter((l) => l.georef !== null).length
  const sinGeoref   = lugares.filter((l) => l.georef === null).length
  const conDireccion = lugares.filter((l) => l.direccion !== null).length

  // Países y ciudades
  const paisMap    = new Map<string, number>()
  const ciudadMap  = new Map<string, number>()
  for (const l of lugares) {
    if (l.direccion?.pais) {
      paisMap.set(l.direccion.pais, (paisMap.get(l.direccion.pais) ?? 0) + 1)
    }
    if (l.direccion?.ciudadEstadoProvincia) {
      ciudadMap.set(l.direccion.ciudadEstadoProvincia, (ciudadMap.get(l.direccion.ciudadEstadoProvincia) ?? 0) + 1)
    }
  }

  const paises  = Array.from(paisMap.entries()).map(([pais, count]) => ({ pais, count }))
    .sort((a, b) => b.count - a.count).slice(0, 8)
  const ciudades = Array.from(ciudadMap.entries()).map(([ciudad, count]) => ({ ciudad, count }))
    .sort((a, b) => b.count - a.count).slice(0, 6)

  // Rango de coordenadas
  const lats = lugares.flatMap((l) => l.georef ? [l.georef.latitud] : [])
  const lons = lugares.flatMap((l) => l.georef ? [l.georef.longitud] : [])

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
    totalPaises: paisMap.size,
  })
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const batchId = req.nextUrl.searchParams.get('batchId')
  const modulo  = req.nextUrl.searchParams.get('modulo')

  if (!batchId || !modulo) {
    return NextResponse.json({ error: 'batchId y modulo son requeridos' }, { status: 400 })
  }

  if (modulo === 'famosos') return reporteFamosos(batchId)
  if (modulo === 'comunas') return reporteComunas(batchId)
  if (modulo === 'lugares') return reporteLugares(batchId)

  return NextResponse.json({ error: 'Módulo no válido' }, { status: 400 })
}
