'use client'

/**
 * CalidadDiariaChart.tsx
 * Mini-línea de evolución de calidad (score_promedio) por día para Comunas,
 * desde la 2ª tabla de hechos FACT_CALIDAD_DIARIA. Usa el mismo patrón de
 * AreaChart que /analytics. Requiere al menos 2 días con score para dibujarse.
 */

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { CalidadDiaria } from '../../lib/dw-sqlite'

export function CalidadDiariaChart({ datos }: { datos: CalidadDiaria[] }) {
  if (datos.length < 2) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
        Se necesitan al menos 2 días con score para la tendencia.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={datos}>
        <defs>
          <linearGradient id="gradCalidadDash" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6', fontWeight: 600 }}
          itemStyle={{ color: '#86efac' }}
          formatter={(v) => [`${v}/100`, 'Calidad']}
        />
        <Area type="monotone" dataKey="score" stroke="#22c55e" fill="url(#gradCalidadDash)" strokeWidth={2} dot={{ r: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
