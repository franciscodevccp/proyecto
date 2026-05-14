'use client'

/**
 * analytics/page.tsx
 * Dashboard de analytics globales con metricas acumuladas de todos los batches.
 * Secciones: KPIs, graficos historicos y tabla resumen paginada.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Database, FileText, Copy, Pencil, TrendingUp, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useDarkMode } from '../hooks/useDarkMode'
import { Sun, Moon } from 'lucide-react'

/** Estructura de un batch en la respuesta del API */
interface BatchItem {
  id: string
  fileName: string
  createdAt: string
  totalInput: number
  totalOutput: number
  duplicates: number
  changes: number
  qualityBefore: number | null
  qualityAfter: number | null
}

/** Totales agregados de todos los batches */
interface Totals {
  _sum: { totalInput: number | null; totalOutput: number | null; duplicates: number | null; changes: number | null }
  _count: { id: number }
  _avg: { qualityBefore: number | null }
}

const PAGE_SIZE = 10

/** Formatea fecha ISO a string legible chileno */
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Color del score de calidad */
function qualityColor(score: number | null) {
  if (score === null) return 'text-gray-400'
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-orange-600'
  return 'text-red-600'
}

const PIE_COLORS = ['#3b82f6', '#f97316', '#9ca3af']

export default function AnalyticsPage() {
  const [totals, setTotals] = useState<Totals | null>(null)
  const [batches, setBatches] = useState<BatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [isDark, toggleDark] = useDarkMode()

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => {
        setTotals(d.totals)
        setBatches(d.batches ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  // Datos derivados para los graficos
  // Excluir batches con score 0 (datos anteriores al fix de la formula)
  const trendData = batches
    .filter((b) => b.qualityBefore !== null && b.qualityBefore > 0)
    .map((b) => ({
      name: b.fileName.replace(/\..*$/, '').slice(0, 12),
      score: b.qualityBefore as number,
      fecha: fmtDate(b.createdAt),
    }))

  const topDuplicates = [...batches]
    .sort((a, b) => b.duplicates - a.duplicates)
    .slice(0, 10)
    .map((b) => ({ name: b.fileName.replace(/\..*$/, '').slice(0, 14), duplicates: b.duplicates }))

  const totalNorm = totals?._sum.changes ?? 0
  const totalDup = totals?._sum.duplicates ?? 0
  const totalIn = totals?._sum.totalInput ?? 0
  const totalOut = totals?._sum.totalOutput ?? 0
  const unchanged = Math.max(0, totalOut - totalNorm)

  const pieData = [
    { name: 'Normalizados', value: totalNorm },
    { name: 'Duplicados', value: totalDup },
    { name: 'Sin cambio', value: unchanged },
  ].filter((d) => d.value > 0)

  // Paginacion de la tabla
  const totalPages = Math.ceil(batches.length / PAGE_SIZE)
  const pageSlice = [...batches].reverse().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  /** Descarga CSV resumen de todos los batches */
  function downloadSummary() {
    const bom = '﻿'
    const header = 'Archivo;Fecha;Entrada;Unicos;Duplicados;Normalizados;Calidad\n'
    const rows = [...batches].reverse().map((b) =>
      `"${b.fileName}";"${fmtDate(b.createdAt)}";${b.totalInput};${b.totalOutput};${b.duplicates};${b.changes};${b.qualityBefore ?? ''}`
    ).join('\n')
    const blob = new Blob([bom + header + rows], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'analytics_resumen.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
          <button onClick={toggleDark} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-gray-500" />}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando analytics...</div>
        ) : (
          <>
            {/* ── Sección 1: KPIs globales ──────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                Metricas globales acumuladas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Archivos procesados', value: totals?._count.id ?? 0, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
                  { label: 'Registros procesados', value: (totalIn).toLocaleString('es-CL'), icon: Database, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
                  { label: 'Duplicados eliminados', value: (totalDup).toLocaleString('es-CL'), icon: Copy, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950' },
                  { label: 'Calidad promedio', value: totals?._avg.qualityBefore !== null ? `${Math.round(totals?._avg.qualityBefore ?? 0)}/100` : 'N/A', icon: Pencil, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
                ].map((card) => {
                  const Icon = card.icon
                  return (
                    <div key={card.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4">
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

            {/* ── Sección 2: Graficos historicos ───────────────────── */}
            {trendData.length >= 2 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">
                  Graficos historicos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Line chart: evolucion del score de calidad */}
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Evolucion del score de calidad
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#d1d5db' }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#d1d5db' }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                          labelStyle={{ color: '#f3f4f6', fontWeight: 600 }}
                          itemStyle={{ color: '#93c5fd' }}
                          formatter={(v) => [`${v}/100`, 'Calidad']}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.fecha ?? ''}
                        />
                        <Area type="monotone" dataKey="score" stroke="#3b82f6" fill="url(#grad)" strokeWidth={2} dot={{ r: 3 }} name="Score" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bar chart: top 10 archivos con mas duplicados */}
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Top archivos con mas duplicados
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={topDuplicates} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#d1d5db' }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#d1d5db' }} width={80} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                          labelStyle={{ color: '#f3f4f6' }}
                          itemStyle={{ color: '#fed7aa' }}
                        />
                        <Bar dataKey="duplicates" name="Duplicados" fill="#f97316" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Pie chart: distribucion acumulada de tipos de cambio */}
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 md:col-span-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      Distribucion acumulada de tipos de cambio
                    </p>
                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="60%" height={220}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={false}>
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                            labelStyle={{ color: '#f3f4f6' }}
                            itemStyle={{ color: '#d1d5db' }}
                            formatter={(v) => [(v ?? 0).toLocaleString('es-CL'), 'registros']}
                          />
                          <Legend wrapperStyle={{ color: '#d1d5db' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── Sección 3: Tabla resumen ──────────────────────────── */}
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
                        <th className="px-4 py-3 text-left">Archivo</th>
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-right">Entrada</th>
                        <th className="px-4 py-3 text-right">Unicos</th>
                        <th className="px-4 py-3 text-right">Dup.</th>
                        <th className="px-4 py-3 text-right">Calidad</th>
                        <th className="px-4 py-3 text-center">Accion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {pageSlice.length === 0 ? (
                        <tr><td colSpan={7} className="text-center py-10 text-gray-400">Sin datos</td></tr>
                      ) : pageSlice.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 max-w-[160px] truncate">{b.fileName}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{fmtDate(b.createdAt)}</td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{b.totalInput.toLocaleString('es-CL')}</td>
                          <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{b.totalOutput.toLocaleString('es-CL')}</td>
                          <td className="px-4 py-3 text-right text-orange-600">{b.duplicates.toLocaleString('es-CL')}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${qualityColor(b.qualityBefore)}`}>
                            {b.qualityBefore !== null ? `${b.qualityBefore}/100` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Link
                              href={`/?batch=${b.id}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Ver
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginacion */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 py-3 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Pagina {page} de {totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
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
