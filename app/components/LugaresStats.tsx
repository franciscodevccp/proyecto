'use client'

/**
 * LugaresStats.tsx
 * Tarjetas de estadísticas del procesamiento del archivo de lugares turísticos.
 * Muestra totales de ingresados, únicos y duplicados eliminados.
 */

import { MapPin, CheckCircle, Copy } from 'lucide-react'

interface LugaresStatsProps {
  totalInput: number
  totalOutput: number
  duplicateCount: number
}

export default function LugaresStats({
  totalInput,
  totalOutput,
  duplicateCount,
}: LugaresStatsProps) {
  const tarjetas = [
    {
      label: 'Registros ingresados',
      valor: totalInput,
      icono: MapPin,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: 'Lugares únicos',
      valor: totalOutput,
      icono: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950',
    },
    {
      label: 'Duplicados eliminados',
      valor: duplicateCount,
      icono: Copy,
      color: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-950',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {tarjetas.map((t) => {
        const Icono = t.icono
        return (
          <div
            key={t.label}
            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 sm:p-5 flex items-center gap-2 sm:gap-4"
          >
            <div className={`${t.bg} p-2 sm:p-3 rounded-lg shrink-0`}>
              <Icono className={`w-4 h-4 sm:w-5 sm:h-5 ${t.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                {t.valor.toLocaleString('es-CL')}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{t.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
