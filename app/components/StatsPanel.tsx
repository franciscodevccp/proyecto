'use client'

/**
 * StatsPanel.tsx
 * Panel de tarjetas con las estadísticas del proceso de normalización:
 * registros ingresados, únicos, duplicados eliminados y normalizados.
 */

import { FileText, CheckCircle, Copy, Pencil } from 'lucide-react'
import type { ProcessResponse } from './FileUpload'

interface StatsPanelProps {
  /** Datos del batch procesado con las estadísticas */
  data: ProcessResponse
}

export default function StatsPanel({ data }: StatsPanelProps) {
  // Definición de cada tarjeta: etiqueta, valor, ícono y colores
  const cards = [
    {
      label: 'Registros ingresados',
      value: data.totalInput,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Registros únicos',
      value: data.totalOutput,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: 'Duplicados eliminados',
      value: data.duplicates,
      icon: Copy,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      label: 'Registros normalizados',
      value: data.changes,
      icon: Pencil,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          // Tarjeta individual con ícono coloreado y valor numérico
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`${card.bg} p-3 rounded-lg`}>
              <Icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{card.value}</p>
              <p className="text-xs text-gray-500 leading-tight">{card.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
