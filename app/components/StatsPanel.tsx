'use client'

/**
 * StatsPanel.tsx
 * Panel de tarjetas con las estadisticas del proceso de normalizacion:
 * registros ingresados, unicos, duplicados eliminados, normalizados
 * y (si se activo) corregidos ortograficamente.
 */

import { FileText, CheckCircle, Copy, Pencil, SpellCheck } from 'lucide-react'
import type { ProcessResponse } from './FileUpload'

interface StatsPanelProps {
  data: ProcessResponse
}

export default function StatsPanel({ data }: StatsPanelProps) {
  const cards = [
    {
      label: 'Registros ingresados',
      value: data.totalInput,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Registros unicos',
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
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

      {/* Tarjeta extra de correcciones (solo visible si se activo la opcion) */}
      {data.correctionMode && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-purple-100 p-3 rounded-lg shrink-0">
            <SpellCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-800">{data.corrections}</p>
            <p className="text-xs text-purple-600 leading-tight">
              Typos corregidos por fuzzy matching contra lista INE
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
