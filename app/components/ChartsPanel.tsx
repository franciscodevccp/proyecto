'use client'

import {
  PieChart, Pie, Cell, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { useEffect, useState } from 'react'
import type { ProcessResponse } from './FileUpload'

interface ChartsPanelProps {
  data: ProcessResponse
}

const PIE_COLORS = {
  Normalizados: '#3b82f6',
  Duplicados:   '#f97316',
  'Sin cambio': '#9ca3af',
  Corregidos:   '#a855f7',
}

interface BatchTrend {
  fileName: string
  qualityBefore: number | null
  createdAt: string
}

export default function ChartsPanel({ data }: ChartsPanelProps) {
  const [history, setHistory] = useState<BatchTrend[]>([])

  useEffect(() => {
    fetch('/api/batches')
      .then((r) => r.json())
      .then((d) => setHistory(d.batches ?? []))
      .catch(() => {})
  }, [data.batchId])

  // ── 1. Donut chart ────────────────────────────────────────────────
  const unchanged = data.totalOutput - data.changes - (data.corrections ?? 0)
  const pieData = [
    { name: 'Normalizados', value: data.changes },
    { name: 'Duplicados',   value: data.duplicates },
    { name: 'Sin cambio',   value: Math.max(0, unchanged) },
    ...(data.corrections > 0 ? [{ name: 'Corregidos', value: data.corrections }] : []),
  ].filter((d) => d.value > 0)

  // ── 2. Funnel de reduccion ────────────────────────────────────────
  const reductionPct = data.totalInput > 0
    ? Math.round((1 - data.totalOutput / data.totalInput) * 100)
    : 0
  const uniquesPct = data.totalInput > 0
    ? (data.totalOutput / data.totalInput) * 100
    : 100

  // ── 3. Area chart historico ───────────────────────────────────────
  // Excluir batches con score 0 (datos anteriores al fix de la formula)
  const trendData = history
    .filter((b) => b.qualityBefore !== null && (b.qualityBefore as number) > 0)
    .map((b) => ({
      name: b.fileName.replace(/\..*$/, '').slice(0, 10),
      score: b.qualityBefore as number,
    }))
    .reverse()

  const showTrend = trendData.length >= 2

  return (
    <div className="space-y-4">

      {/* Fila superior: donut + funnel lado a lado */}
      <div className="grid grid-cols-2 gap-4">

        {/* 1. Donut chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Distribucion de cambios</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={65}
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
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f3f4f6' }}
                itemStyle={{ color: '#93c5fd' }}
                formatter={(v) => [v, 'registros']}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Leyenda */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: PIE_COLORS[entry.name as keyof typeof PIE_COLORS] ?? '#6b7280' }}
                />
                {entry.name}
              </div>
            ))}
          </div>
        </div>

        {/* 2. Funnel de reduccion */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Reduccion de registros</p>
          <div className="space-y-3 mt-2">
            {/* Barra Entrada */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Entrada</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {data.totalInput.toLocaleString('es-CL')}
                </span>
              </div>
              <div className="h-7 w-full bg-blue-200 dark:bg-blue-900 rounded-md" />
            </div>

            {/* Indicador de reduccion */}
            <div className="flex items-center justify-center">
              <span className="text-sm font-semibold text-orange-500">
                ▼ {reductionPct}% reduccion
              </span>
            </div>

            {/* Barra Unicos */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Unicos</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {data.totalOutput.toLocaleString('es-CL')}
                </span>
              </div>
              <div className="h-7 bg-blue-600 rounded-md" style={{ width: `${uniquesPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Area chart historico (solo si hay 2+ batches) */}
      {showTrend && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Tendencia de calidad historica
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="qualityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
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
              />
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
  )
}
