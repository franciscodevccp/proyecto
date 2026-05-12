'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface LogEntry {
  id: string
  lineNumber: number
  original: string
  normalized: string
  changeType: string
  detail: string | null
}

interface LogViewerProps {
  batchId: string
}

const BADGE: Record<string, string> = {
  normalized: 'bg-blue-100 text-blue-700',
  duplicate: 'bg-orange-100 text-orange-700',
  unchanged: 'bg-gray-100 text-gray-500',
}

const LABEL: Record<string, string> = {
  normalized: 'Normalizado',
  duplicate: 'Duplicado',
  unchanged: 'Sin cambio',
}

export default function LogViewer({ batchId }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/logs?batchId=${batchId}`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .finally(() => setLoading(false))
  }, [batchId])

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.changeType === filter)

  const downloadLog = () => {
    window.open(`/api/download?batchId=${batchId}&type=log`, '_blank')
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Cargando log…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {['all', 'normalized', 'duplicate', 'unchanged'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                ${filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f === 'all' ? 'Todos' : LABEL[f]}
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

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">Sin entradas</div>
          ) : (
            filtered.map((entry) => (
              <div key={entry.id} className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3">
                <span className="text-xs text-gray-400 w-8 shrink-0 pt-0.5">#{entry.lineNumber}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${BADGE[entry.changeType] ?? 'bg-gray-100 text-gray-500'}`}
                >
                  {LABEL[entry.changeType] ?? entry.changeType}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="text-gray-400 font-mono">{entry.original}</span>
                  {entry.changeType !== 'unchanged' && (
                    <>
                      <span className="mx-2 text-gray-300">→</span>
                      <span className="text-gray-800 font-medium">{entry.normalized}</span>
                    </>
                  )}
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
