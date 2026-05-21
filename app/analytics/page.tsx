'use client'

/**
 * analytics/page.tsx
 * Dashboard de analytics globales unificado: Comunas + Famosos + Lugares.
 * Cada batch muestra su módulo de origen, botón Ver (enlace a la página
 * correspondiente) y botón Eliminar (con confirmación inline).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  Database, FileText, Copy, Pencil, TrendingUp,
  ChevronLeft, ChevronRight, Download, Trash2,
  Users, MapPin,
} from 'lucide-react'
import { useDarkMode } from '../hooks/useDarkMode'
import { Sun, Moon, ArrowLeft } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Modulo = 'comunas' | 'famosos' | 'lugares'

interface BatchUnificado {
  id: string
  fileName: string
  createdAt: string
  totalInput: number
  totalOutput: number
  duplicates: number
  changes: number | null
  qualityBefore: number | null
  qualityAfter: number | null
  modulo: Modulo
}

interface Totals {
  totalArchivos: number
  totalInput: number
  totalOutput: number
  totalDups: number
  totalChanges: number
  avgCalidad: number | null
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

/** Endpoint DELETE según el módulo del batch */
const DELETE_URL: Record<Modulo, string> = {
  comunas: '/api/batches',
  famosos: '/api/famosos/batch',
  lugares: '/api/lugares/batch',
}

/** Ruta "Ver" según el módulo — pasa el batchId como query param */
const VER_URL: Record<Modulo, (id: string) => string> = {
  comunas: (id) => `/?batch=${id}`,
  famosos: (id) => `/famosos?batch=${id}`,
  lugares: (id) => `/lugares?batch=${id}`,
}

/** Estilos del badge de módulo */
const MODULO_BADGE: Record<Modulo, { label: string; className: string }> = {
  comunas: { label: 'Comunas', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  famosos: { label: 'Famosos', className: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  lugares: { label: 'Lugares', className: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function qualityColor(score: number | null) {
  if (score === null) return 'text-gray-400'
  if (score >= 70) return 'text-green-500'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-500'
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [totals, setTotals]   = useState<Totals | null>(null)
  const [batches, setBatches] = useState<BatchUnificado[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [isDark, toggleDark]  = useDarkMode()

  /** ID pendiente de confirmación de borrado */
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  /** IDs en proceso de eliminación */
  const [eliminando, setEliminando]       = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => {
        setTotals(d.totals)
        setBatches(d.batches ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Datos para gráficos ────────────────────────────────────────────────────

  /** Tendencia de calidad — solo comunas (los demás módulos no tienen score) */
  const trendData = batches
    .filter((b) => b.modulo === 'comunas' && b.qualityBefore !== null && b.qualityBefore > 0)
    .map((b) => ({
      name: b.fileName.replace(/\..*$/, '').slice(0, 12),
      score: b.qualityBefore as number,
      fecha: fmtDate(b.createdAt),
    }))

  /** Top 10 por duplicados (todos los módulos) */
  const topDuplicates = [...batches]
    .sort((a, b) => b.duplicates - a.duplicates)
    .slice(0, 10)
    .map((b) => ({
      name: b.fileName.replace(/\..*$/, '').slice(0, 14),
      duplicates: b.duplicates,
      fill: b.modulo === 'famosos' ? '#a855f7' : b.modulo === 'lugares' ? '#14b8a6' : '#f97316',
    }))

  // ── Paginación ─────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(batches.length / PAGE_SIZE)
  const pageSlice  = [...batches].reverse().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Acciones ───────────────────────────────────────────────────────────────

  function downloadSummary() {
    const bom    = '﻿'
    const header = 'Módulo;Archivo;Fecha;Entrada;Únicos;Duplicados;Calidad\n'
    const rows   = [...batches].reverse().map((b) =>
      `"${b.modulo}";"${b.fileName}";"${fmtDate(b.createdAt)}";${b.totalInput};${b.totalOutput};${b.duplicates};${b.qualityBefore ?? ''}`
    ).join('\n')
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'analytics_resumen.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function eliminarBatch(id: string, modulo: Modulo) {
    setEliminando((prev) => new Set(prev).add(id))
    setConfirmandoId(null)
    try {
      const res = await fetch(`${DELETE_URL[modulo]}?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setBatches((prev) => prev.filter((b) => b.id !== id))
      }
    } finally {
      setEliminando((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Volver al inicio"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-gray-900 dark:text-gray-100">COMUNAS_NORM</span>
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Analytics</span>
            </div>
          </div>
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark
              ? <Sun className="w-4 h-4 text-yellow-400" />
              : <Moon className="w-4 h-4 text-gray-500" />
            }
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando analytics...</div>
        ) : (
          <>
            {/* ── Leyenda de módulos ───────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
              {(['comunas', 'famosos', 'lugares'] as Modulo[]).map((m) => {
                const badge = MODULO_BADGE[m]
                const Icon  = m === 'famosos' ? Users : m === 'lugares' ? MapPin : Database
                const count = batches.filter((b) => b.modulo === m).length
                return (
                  <span
                    key={m}
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${badge.className}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {badge.label} ({count})
                  </span>
                )
              })}
            </div>

            {/* ── KPIs globales ────────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Métricas globales acumuladas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Archivos procesados',
                    value: totals?.totalArchivos ?? 0,
                    icon: FileText,
                    color: 'text-blue-600',
                    bg: 'bg-blue-50 dark:bg-blue-950',
                  },
                  {
                    label: 'Registros procesados',
                    value: (totals?.totalInput ?? 0).toLocaleString('es-CL'),
                    icon: Database,
                    color: 'text-green-600',
                    bg: 'bg-green-50 dark:bg-green-950',
                  },
                  {
                    label: 'Duplicados eliminados',
                    value: (totals?.totalDups ?? 0).toLocaleString('es-CL'),
                    icon: Copy,
                    color: 'text-orange-600',
                    bg: 'bg-orange-50 dark:bg-orange-950',
                  },
                  {
                    label: 'Calidad prom. comunas',
                    value: totals?.avgCalidad !== null ? `${totals?.avgCalidad}/100` : 'N/A',
                    icon: Pencil,
                    color: 'text-purple-600',
                    bg: 'bg-purple-50 dark:bg-purple-950',
                  },
                ].map((card) => {
                  const Icon = card.icon
                  return (
                    <div
                      key={card.label}
                      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4"
                    >
                      <div className={`${card.bg} p-3 rounded-lg`}>
                        <Icon className={`w-5 h-5 ${card.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{card.value}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{card.label}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* ── Gráficos ─────────────────────────────────────────────── */}
            {(trendData.length >= 2 || topDuplicates.length > 0) && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                  Gráficos históricos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Evolución del score de calidad (comunas) */}
                  {trendData.length >= 2 && (
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Evolución del score de calidad
                      </p>
                      <p className="text-xs text-gray-400 mb-3">Solo módulo Comunas</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                            labelStyle={{ color: '#f3f4f6', fontWeight: 600 }}
                            itemStyle={{ color: '#93c5fd' }}
                            formatter={(v) => [`${v}/100`, 'Calidad']}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fecha ?? ''}
                          />
                          <Area
                            type="monotone"
                            dataKey="score"
                            stroke="#3b82f6"
                            fill="url(#grad)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Top archivos con más duplicados (todos los módulos) */}
                  {topDuplicates.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Top archivos con más duplicados
                      </p>
                      <p className="text-xs text-gray-400 mb-3">
                        <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1" />Comunas
                        <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mx-1 ml-3" />Famosos
                        <span className="inline-block w-2 h-2 rounded-full bg-teal-500 mx-1 ml-3" />Lugares
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={topDuplicates} layout="vertical" margin={{ left: 10, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} width={80} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                            labelStyle={{ color: '#f3f4f6' }}
                            itemStyle={{ color: '#fed7aa' }}
                          />
                          <Bar dataKey="duplicates" name="Duplicados" radius={[0, 4, 4, 0]}>
                            {topDuplicates.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                </div>
              </section>
            )}

            {/* ── Tabla de todos los batches ────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Todos los batches ({batches.length})
                </h2>
                <button
                  onClick={downloadSummary}
                  className="flex items-center gap-2 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar resumen CSV
                </button>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Módulo</th>
                        <th className="px-4 py-3 text-left">Archivo</th>
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-right">Entrada</th>
                        <th className="px-4 py-3 text-right">Únicos</th>
                        <th className="px-4 py-3 text-right">Dup.</th>
                        <th className="px-4 py-3 text-right">Calidad</th>
                        <th className="px-4 py-3 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {pageSlice.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-10 text-gray-400">Sin datos</td>
                        </tr>
                      ) : pageSlice.map((b) => {
                        const badge = MODULO_BADGE[b.modulo]
                        return (
                          <tr
                            key={b.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            {/* Módulo */}
                            <td className="px-4 py-3">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}>
                                {badge.label}
                              </span>
                            </td>

                            {/* Archivo */}
                            <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 max-w-[140px] truncate">
                              {b.fileName}
                            </td>

                            {/* Fecha */}
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                              {fmtDate(b.createdAt)}
                            </td>

                            {/* Entrada */}
                            <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                              {b.totalInput.toLocaleString('es-CL')}
                            </td>

                            {/* Únicos */}
                            <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                              {b.totalOutput.toLocaleString('es-CL')}
                            </td>

                            {/* Duplicados */}
                            <td className="px-4 py-3 text-right text-orange-500">
                              {b.duplicates.toLocaleString('es-CL')}
                            </td>

                            {/* Calidad */}
                            <td className={`px-4 py-3 text-right font-semibold ${qualityColor(b.qualityBefore)}`}>
                              {b.qualityBefore !== null ? `${b.qualityBefore}/100` : '—'}
                            </td>

                            {/* Acción */}
                            <td className="px-4 py-3 text-center">
                              {confirmandoId === b.id ? (
                                // Confirmación inline
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">¿Eliminar?</span>
                                  <button
                                    onClick={() => eliminarBatch(b.id, b.modulo)}
                                    className="text-xs font-semibold text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                                  >
                                    Sí
                                  </button>
                                  <button
                                    onClick={() => setConfirmandoId(null)}
                                    className="text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                // Acciones normales
                                <div className="flex items-center justify-center gap-3">
                                  <Link
                                    href={VER_URL[b.modulo](b.id)}
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Ver
                                  </Link>
                                  <button
                                    onClick={() => setConfirmandoId(b.id)}
                                    disabled={eliminando.has(b.id)}
                                    className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                                    title="Eliminar batch"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-100 dark:border-gray-800">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Página {page} de {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
