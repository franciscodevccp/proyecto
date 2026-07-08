/**
 * KpiCard.tsx
 * Tarjeta KPI del dashboard. Puramente presentacional (sin estado), reutiliza
 * el estilo de tarjeta de /analytics: caja de icono coloreada + valor + etiqueta.
 */

import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  /** Etiqueta descriptiva del indicador. */
  label: string
  /** Valor ya formateado (o 'N/A' cuando no aplica). */
  value: string
  /** Icono lucide-react. */
  icon: LucideIcon
  /** Clase de color del icono (ej. 'text-blue-600'). */
  color: string
  /** Clase de fondo de la caja del icono (ej. 'bg-blue-50 dark:bg-blue-950'). */
  bg: string
  /** Aclaración opcional bajo la etiqueta (ej. 'Solo módulo Comunas'). */
  hint?: string
}

export function KpiCard({ label, value, icon: Icon, color, bg, hint }: KpiCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 flex items-center gap-4">
      <div className={`${bg} p-3 rounded-lg shrink-0`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 truncate">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
        {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  )
}
