/**
 * RankingComunas.tsx
 * Ranking de comunas por población (medida `habitantes` del módulo Comunas).
 * Presentacional: recibe los datos reales del DW y dibuja una barra proporcional
 * por comuna. Si no hay datos (filtros que excluyen Comunas) muestra un aviso.
 */

import type { RankingComuna } from '../../lib/dw-sqlite'

export function RankingComunas({ datos }: { datos: RankingComuna[] }) {
  if (datos.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">
        Sin datos de población para los filtros actuales.
      </p>
    )
  }

  // La barra más larga corresponde a la comuna más poblada del top.
  const max = Math.max(...datos.map((d) => d.habitantes))

  return (
    <ol className="space-y-3">
      {datos.map((d, i) => (
        <li key={d.comuna} className="flex items-center gap-3">
          <span className="w-5 text-right text-xs font-semibold text-gray-400 dark:text-gray-500">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{d.comuna}</span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
                {d.habitantes.toLocaleString('es-CL')}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${max > 0 ? (d.habitantes / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
