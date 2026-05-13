'use client'

/**
 * ChartsPanel.tsx
 * Panel de graficos interactivos con Recharts.
 * Muestra 3 visualizaciones del batch actual:
 *   1. Pie chart — distribucion de tipos de cambio
 *   2. Bar chart — registros antes vs despues
 *   3. Radial bar — score de calidad antes de normalizar
 * Si hay historial de mas de 2 batches, agrega un area chart de tendencia.
 */

import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar,
  AreaChart, Area,
  ResponsiveContainer,
} from 'recharts'
import { useEffect, useState } from 'react'
import type { ProcessResponse } from './FileUpload'

interface ChartsPanelProps {
  /** Datos del batch actual para graficar */
  data: ProcessResponse
}

/** Colores del pie chart para cada tipo de cambio */
const PIE_COLORS = {
  Normalizados: '#3b82f6',
  Duplicados: '#f97316',
  'Sin cambio': '#9ca3af',
  Corregidos: '#a855f7',
}

/** Estructura minima de batch para el grafico de tendencia historica */
interface BatchTrend {
  fileName: string
  qualityBefore: number | null
  createdAt: string
}

export default function ChartsPanel({ data }: ChartsPanelProps) {
  const [history, setHistory] = useState<BatchTrend[]>([])

  // Cargar historial para el grafico de tendencia
  useEffect(() => {
    fetch('/api/batches')
      .then((r) => r.json())
      .then((d) => setHistory(d.batches ?? []))
      .catch(() => {/* ignorar errores de red */})
  }, [data.batchId])

  // ── Datos para el Pie chart ────────────────────────────────────────
  const unchanged = data.totalOutput - data.changes - (data.corrections ?? 0)
  const pieData = [
    { name: 'Normalizados', value: data.changes },
    { name: 'Duplicados', value: data.duplicates },
    { name: 'Sin cambio', value: Math.max(0, unchanged) },
    ...(data.corrections > 0 ? [{ name: 'Corregidos', value: data.corrections }] : []),
  ].filter((d) => d.value > 0)

  // ── Datos para el Bar chart ────────────────────────────────────────
  const barData = [
    { label: 'Entrada', value: data.totalInput, fill: '#93c5fd' },
    { label: 'Unicos', value: data.totalOutput, fill: '#3b82f6' },
    { label: 'Duplicados', value: data.duplicates, fill: '#f97316' },
    { label: 'Normalizados', value: data.changes, fill: '#a855f7' },
  ]

  // ── Datos para el Radial bar (quality score) ───────────────────────
  const qualityScore = data.qualityBefore?.score ?? 0
  const radialData = [{ name: 'Calidad', value: qualityScore, fill: qualityScore >= 70 ? '#22c55e' : qualityScore >= 40 ? '#f97316' : '#ef4444' }]

  // ── Datos para el Area chart historico ────────────────────────────
  const trendData = history
    .filter((b) => b.qualityBefore !== null)
    .map((b) => ({
      name: b.fileName.replace(/\..*$/, '').slice(0, 10),
      score: b.qualityBefore as number,
    }))
    .reverse() // del mas antiguo al mas reciente

  const showTrend = trendData.length >= 2

  return (
    <div className="space-y-4">
      {/* Grid 2x2 (o 2x1 si no hay tendencia) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. Pie chart — distribucion de cambios */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Distribucion de cambios</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={false}
                labelLine={false}
              >
                {pieData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? '#6b7280'}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [v, 'registros']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Bar chart — antes vs despues */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Registros por categoria</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip />
              <Bar dataKey="value" name="Registros" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Radial bar — score de calidad */}
        {data.qualityBefore && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Score de calidad original</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              Nota: <strong>{data.qualityBefore.grade}</strong> — {qualityScore}/100
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="80%"
                data={radialData}
                startAngle={180}
                endAngle={0}
              >
                <RadialBar dataKey="value" background cornerRadius={8} label={false} />
                <Tooltip formatter={(v) => [`${v}/100`, 'Calidad']} />
                <Legend
                  iconSize={0}
                  formatter={() => `Score: ${qualityScore}/100`}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 4. Area chart — tendencia historica (solo si hay datos suficientes) */}
        {showTrend && (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Tendencia de calidad historica
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip formatter={(v) => [`${v}/100`, 'Calidad']} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  fill="url(#qualityGrad)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Score"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
