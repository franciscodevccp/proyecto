'use client'

/**
 * FamososBatchHistory.tsx
 * Timeline vertical con el historial de batches del módulo de famosos.
 * Permite cargar un batch pasado o eliminarlo con confirmación.
 */

import { useEffect, useState } from 'react'
import { FileText, Trash2, ExternalLink, RefreshCw } from 'lucide-react'

/** Resumen de un batch de famosos para el historial */
interface FamosoBatchSummary {
  id: string
  fileName: string
  createdAt: string
  totalInput: number
  totalOutput: number
  duplicates: number
  cumpleanos: number
}

/** Respuesta simplificada para cargar un batch pasado */
export interface FamososResponse {
  batchId: string
  fileName: string
  totalInput: number
  totalOutput: number
  duplicateCount: number
  cumpleanosCount: number
  logs: string[]
}

interface FamososBatchHistoryProps {
  onLoad: (data: FamososResponse) => void
  onDelete?: (id: string) => void
}

/** Formatea fecha ISO a string legible */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function FamososBatchHistory({ onLoad, onDelete }: FamososBatchHistoryProps) {
  const [batches, setBatches] = useState<FamosoBatchSummary[]>([])
  const [cargando, setCargando] = useState(true)
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function cargarHistorial() {
    setCargando(true)
    try {
      const res = await fetch('/api/famosos/batch')
      const data = await res.json()
      setBatches(data.batches ?? [])
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { cargarHistorial() }, [])

  /**
   * Carga un batch pasado en el dashboard.
   * Obtiene los famosos completos para calcular cumpleanosCount de forma dinámica
   * (el valor almacenado en la BD es del día del procesamiento y puede estar desfasado).
   */
  async function handleLoad(batch: FamosoBatchSummary) {
    try {
      const res = await fetch(`/api/famosos/batch?id=${batch.id}`)
      const data = await res.json()
      const famosos: { esCumpleanos: boolean }[] = data.batch?.famosos ?? []
      const cumpleanosCount = famosos.filter((f) => f.esCumpleanos).length
      onLoad({
        batchId: batch.id,
        fileName: batch.fileName,
        totalInput: batch.totalInput,
        totalOutput: batch.totalOutput,
        duplicateCount: batch.duplicates,
        cumpleanosCount,
        logs: [],
      })
    } catch {
      // Si falla la petición, usar el valor guardado como fallback
      onLoad({
        batchId: batch.id,
        fileName: batch.fileName,
        totalInput: batch.totalInput,
        totalOutput: batch.totalOutput,
        duplicateCount: batch.duplicates,
        cumpleanosCount: batch.cumpleanos,
        logs: [],
      })
    }
  }

  /** Elimina un batch con confirmación de dos pasos */
  async function handleDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    setEliminandoId(id)
    setConfirmId(null)
    try {
      await fetch(`/api/famosos/batch?id=${id}`, { method: 'DELETE' })
      setBatches((prev) => prev.filter((b) => b.id !== id))
      onDelete?.(id)
    } finally {
      setEliminandoId(null)
    }
  }

  if (cargando) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500">
        Cargando historial…
      </div>
    )
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No hay batches procesados aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Botón de recargar */}
      <div className="flex justify-end">
        <button
          onClick={cargarHistorial}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Timeline de batches */}
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.id} className="relative flex gap-4 pl-10">
              <div className="absolute left-3 top-4 w-2.5 h-2.5 rounded-full bg-purple-400 border-2 border-white dark:border-gray-900" />
              <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-purple-200 dark:hover:border-purple-700 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {batch.fileName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {formatDate(batch.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Mini stats */}
                <div className="flex gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span><strong className="text-gray-700 dark:text-gray-200">{batch.totalInput}</strong> entrada</span>
                  <span><strong className="text-gray-700 dark:text-gray-200">{batch.totalOutput}</strong> únicos</span>
                  <span><strong className="text-orange-600">{batch.duplicates}</strong> dup.</span>
                  <span><strong className="text-pink-600">{batch.cumpleanos}</strong> cumple.</span>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleLoad(batch)}
                    className="flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver resultados
                  </button>
                  <button
                    onClick={() => handleDelete(batch.id)}
                    disabled={eliminandoId === batch.id}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors
                      ${confirmId === batch.id
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-700'
                      }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    {confirmId === batch.id ? 'Confirmar' : eliminandoId === batch.id ? 'Eliminando…' : 'Eliminar'}
                  </button>
                  {confirmId === batch.id && (
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
