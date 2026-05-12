'use client'

/**
 * LogViewer.tsx
 * Visor del log de cambios de un batch.
 * Permite filtrar por tipo de cambio (normalizado, duplicado, sin cambio)
 * y descargar el log completo en formato TXT.
 */

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

/** Estructura de una entrada del log */
interface LogEntry {
  id: string
  lineNumber: number
  original: string
  normalized: string
  changeType: string
  detail: string | null
}

interface LogViewerProps {
  /** ID del batch cuyo log se debe mostrar */
  batchId: string
}

/** Clases CSS para cada badge de tipo de cambio */
const BADGE: Record<string, string> = {
  normalized: 'bg-blue-100 text-blue-700',
  duplicate: 'bg-orange-100 text-orange-700',
  unchanged: 'bg-gray-100 text-gray-500',
  corrected: 'bg-purple-100 text-purple-700',
}

/** Etiquetas legibles para cada tipo de cambio */
const LABEL: Record<string, string> = {
  normalized: 'Normalizado',
  duplicate: 'Duplicado',
  unchanged: 'Sin cambio',
  corrected: 'Corregido',
}

export default function LogViewer({ batchId }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('all') // filtro activo
  const [loading, setLoading] = useState(true)

  // Cargar el log del batch cuando el componente se monta o cambia el batchId
  useEffect(() => {
    setLoading(true)
    fetch(`/api/logs?batchId=${batchId}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .finally(() => setLoading(false))
  }, [batchId])

  // Filtrar entradas según el tipo seleccionado
  const filtered = filter === 'all' ? logs : logs.filter((l) => l.changeType === filter)

  /** Abre el endpoint de descarga para bajar el log en TXT */
  const downloadLog = () => {
    window.open(`/api/download?batchId=${batchId}&type=log`, '_blank')
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Cargando log…</div>
  }

  return (
    <div className="space-y-4">
      {/* Barra de filtros y botón de descarga */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {/* Botones de filtro: Todos, Normalizado, Duplicado, Sin cambio */}
          {['all', 'normalized', 'corrected', 'duplicate', 'unchanged'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f === 'all' ? 'Todos' : LABEL[f]}
              {/* Contador de entradas para cada filtro */}
              <span className="ml-1 opacity-70">
                ({f === 'all' ? logs.length : logs.filter((l) => l.changeType === f).length})
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={downloadLog}
          className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Descargar log
        </button>
      </div>

      {/* Lista de entradas del log con scroll vertical */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Sin entradas</div>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
                {/* Número de línea original en el archivo */}
                <span className="text-xs text-gray-400 w-8 shrink-0 pt-0.5">#{entry.lineNumber}</span>
                {/* Badge con el tipo de cambio */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${BADGE[entry.changeType] ?? 'bg-gray-100 text-gray-500'}`}
                >
                  {LABEL[entry.changeType] ?? entry.changeType}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  {/* Valor original → valor normalizado (solo si hubo cambio) */}
                  <span className="text-gray-400 font-mono">{entry.original}</span>
                  {entry.changeType !== 'unchanged' && (
                    <>
                      <span className="mx-2 text-gray-300">→</span>
                      <span className="text-gray-800 font-medium">{entry.normalized}</span>
                    </>
                  )}
                  {/* Detalle del cambio (ej: "tildes removidas, capitalización normalizada") */}
                  {entry.detail && (
                    <span className="ml-2 text-xs text-gray-400">({entry.detail})</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
