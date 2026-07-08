'use client'

/**
 * HechosPorModuloChart.tsx
 * Gráfico de barras (Recharts) con el COUNT de FACT_NORMALIZACION por módulo.
 * Colores por módulo alineados con los badges de /analytics. La suma de las
 * barras equivale al KPI "Hechos normalizados" (con los mismos filtros).
 */

import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { HechoPorModulo } from '../../lib/dw-sqlite'

/** Color por módulo (mismos tonos que los badges de analytics). */
const COLOR_MODULO: Record<string, string> = {
  Comunas: '#3b82f6',
  Famosos: '#a855f7',
  Lugares: '#14b8a6',
}

export function HechosPorModuloChart({ datos }: { datos: HechoPorModulo[] }) {
  if (datos.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
        Sin hechos para los filtros actuales.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={datos} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        <XAxis dataKey="modulo" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#f3f4f6', fontWeight: 600 }}
          itemStyle={{ color: '#93c5fd' }}
          formatter={(v) => [Number(v).toLocaleString('es-CL'), 'Hechos']}
        />
        <Bar dataKey="total" name="Hechos" radius={[4, 4, 0, 0]}>
          {datos.map((d, i) => (
            <Cell key={i} fill={COLOR_MODULO[d.modulo] ?? '#6b7280'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
