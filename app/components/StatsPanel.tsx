'use client'

/**
 * StatsPanel.tsx
 * Tarjetas de estadisticas del proceso de normalizacion con soporte dark mode.
 */

import { FileText, CheckCircle, Copy, Pencil, SpellCheck, AlertCircle } from 'lucide-react'
import type { ProcessResponse } from './FileUpload'

interface StatsPanelProps {
  data: ProcessResponse
}

export default function StatsPanel({ data }: StatsPanelProps) {
  const cards = [
    { label: 'Registros ingresados', value: data.totalInput, icon: FileText,
      color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950' },
    { label: 'Registros unicos', value: data.totalOutput, icon: CheckCircle,
      color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950' },
    { label: 'Duplicados eliminados', value: data.duplicates, icon: Copy,
      color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950' },
    { label: 'Registros normalizados', value: data.changes, icon: Pencil,
      color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950' },
    { label: 'No encontrados en fuente oficial', value: data.noEncontrados ?? 0, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
              <div className={`${card.bg} p-2 sm:p-3 rounded-lg shrink-0`}>
                <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">{card.value.toLocaleString('es-CL')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{card.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {data.correctionMode && (
        <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-xl p-4 flex items-center gap-4">
          <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg shrink-0">
            <SpellCheck className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{data.corrections}</p>
            <p className="text-xs text-purple-600 dark:text-purple-400 leading-tight">
              Typos corregidos por fuzzy matching contra lista INE
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
