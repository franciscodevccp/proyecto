/**
 * api/analytics/route.ts
 * Endpoint que retorna métricas agregadas de los tres módulos del sistema:
 * Comunas (Batch), Famosos (FamosoBatch) y Lugares (LugarBatch).
 *
 * GET /api/analytics
 * Responde con:
 *   totals   – KPIs globales acumulados (suma de los 3 módulos)
 *   batches  – lista unificada ordenada por fecha, cada item con campo `modulo`
 */

import { NextResponse } from 'next/server'
import { prisma } from '../../lib/prisma'

export async function GET() {
  try {
    // ── Consultas en paralelo para los 3 módulos ─────────────────────────────
    const [
      comunasBatches,
      famososBatches,
      lugaresBatches,
    ] = await Promise.all([
      prisma.batch.findMany({
        orderBy: { createdAt: 'asc' },
        take: 1000, // tope de seguridad — usar /api/batches con paginación para el historial completo
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          totalInput: true,
          totalOutput: true,
          duplicates: true,
          changes: true,
          qualityBefore: true,
          qualityAfter: true,
        },
      }),
      prisma.famosoBatch.findMany({
        orderBy: { createdAt: 'asc' },
        take: 1000, // tope de seguridad — usar /api/batches con paginación para el historial completo
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          totalInput: true,
          totalOutput: true,
          duplicates: true,
        },
      }),
      prisma.lugarBatch.findMany({
        orderBy: { createdAt: 'asc' },
        take: 1000, // tope de seguridad — usar /api/batches con paginación para el historial completo
        select: {
          id: true,
          fileName: true,
          createdAt: true,
          totalInput: true,
          totalOutput: true,
          duplicates: true,
        },
      }),
    ])

    // ── Lista unificada con etiqueta de módulo ────────────────────────────────
    const batches = [
      ...comunasBatches.map((b) => ({
        ...b,
        modulo: 'comunas' as const,
        changes: b.changes,
        qualityBefore: b.qualityBefore,
        qualityAfter: b.qualityAfter,
      })),
      ...famososBatches.map((b) => ({
        ...b,
        modulo: 'famosos' as const,
        changes: null,
        qualityBefore: null,
        qualityAfter: null,
      })),
      ...lugaresBatches.map((b) => ({
        ...b,
        modulo: 'lugares' as const,
        changes: null,
        qualityBefore: null,
        qualityAfter: null,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    // ── KPIs globales ─────────────────────────────────────────────────────────
    const totalArchivos = batches.length
    const totalInput    = batches.reduce((s, b) => s + b.totalInput, 0)
    const totalOutput   = batches.reduce((s, b) => s + b.totalOutput, 0)
    const totalDups     = batches.reduce((s, b) => s + b.duplicates, 0)
    const totalChanges  = comunasBatches.reduce((s, b) => s + b.changes, 0)

    // Calidad promedio solo de comunas (los otros módulos no calculan score)
    const conCalidad = comunasBatches.filter((b) => b.qualityBefore !== null && b.qualityBefore > 0)
    const avgCalidad = conCalidad.length > 0
      ? Math.round(conCalidad.reduce((s, b) => s + (b.qualityBefore ?? 0), 0) / conCalidad.length)
      : null

    const totals = {
      totalArchivos,
      totalInput,
      totalOutput,
      totalDups,
      totalChanges,
      avgCalidad,
    }

    return NextResponse.json({
      totals,   // mantener compatibilidad con consumidores existentes (nombre legado)
      batches,
      kpis: {   // forma documentada en la API — alias de totals con campos renombrados
        totalBatches:    batches.length,
        totalInput,
        totalOutput,
        totalDuplicates: totalDups,
        avgQuality:      avgCalidad,
      },
    })
  } catch (error) {
    console.error('[analytics]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
