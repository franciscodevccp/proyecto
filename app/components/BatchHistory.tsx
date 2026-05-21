'use client'

/**
 * BatchHistory.tsx
 * Timeline vertical con el historial de todos los batches procesados.
 * Cada item muestra nombre de archivo, fecha, estadisticas resumidas y score de calidad.
 * Permite cargar un batch pasado en el dashboard o eliminarlo con confirmacion.
 */

import { useEffect, useState } from 'react'
import { FileText, Trash2, ExternalLink, RefreshCw } from 'lucide-react'
import type { ProcessResponse } from './FileUpload'

/** Estructura de un batch en el historial */
interface BatchSummary {
  id: string
  fileName: string
  createdAt: string
  totalInput: number
  totalOutput: number
  duplicates: number
  changes: number
  qualityBefore: number | null
}

interface BatchHistoryProps {
  /** Callback para cargar un batch pasado en el dashboard principal */
  onLoad: (data: ProcessResponse) => void
  /** Callback opcional que se llama con el id del batch recien eliminado */
  onDelete?: (id: string) => void
}

/** Formatea una fecha ISO a string legible en formato chileno */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Color del badge de calidad segun el score */
function qualityColor(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
  if (score >= 70) return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
  if (score >= 40) return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
  return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
}

export default function BatchHistory({ onLoad, onDelete }: BatchHistoryProps) {
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  // Indica si hay más de 20 batches en la BD (sin cargarlos todos)
  const [hayMas, setHayMas] = useState(false)

  /** Carga el historial de batches desde el API (pide 21 para detectar si hay más) */
  async function fetchBatches() {
    setLoading(true)
    try {
      const res = await fetch('/api/batches?limit=21')
      const data = await res.json()
      const todos: BatchSummary[] = data.batches ?? []
      setHayMas(todos.length > 20)
      setBatches(todos.slice(0, 20))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBatches() }, [])

  /** Carga un batch pasado en el dashboard */
  function handleLoad(batch: BatchSummary) {
    onLoad({
      batchId: batch.id,
      fileName: batch.fileName,
      totalInput: batch.totalInput,
      totalOutput: batch.totalOutput,
      duplicates: batch.duplicates,
      changes: batch.changes,
      corrections: 0,
      correctionMode: false,
      qualityBefore: null,
      qualityAfter: null,
    })
  }

  /** Elimina un batch con confirmacion */
  async function handleDelete(id: string) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    setDeletingId(id)
    setConfirmId(null)
    try {
      await fetch(`/api/batches?id=${id}`, { method: 'DELETE' })
      setBatches((prev) => prev.filter((b) => b.id !== id))
      // Notificar al padre para que limpie el dashboard si el batch borrado es el activo
      onDelete?.(id)
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-400 dark:text-gray-500">Cargando historial...</div>
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>No hay batches procesados aun</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Boton de recargar */}
      <div className="flex justify-end">
        <button
          onClick={fetchBatches}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Actualizar
        </button>
      </div>

      {/* Timeline de batches */}
      <div className="relative">
        {/* Linea vertical del timeline */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-3">
          {batches.map((batch) => (
            <div key={batch.id} className="relative flex gap-4 pl-10">
              {/* Punto del timeline */}
              <div className="absolute left-3 top-4 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-white dark:border-gray-900" />

              {/* Tarjeta del batch */}
              <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {/* Nombre del archivo */}
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{batch.fileName}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatDate(batch.createdAt)}</p>
                  </div>
                  {/* Badge de calidad */}
                  {batch.qualityBefore !== null && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${qualityColor(batch.qualityBefore)}`}>
                      Q: {batch.qualityBefore}
                    </span>
                  )}
                </div>

                {/* Mini stats */}
                <div className="flex gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  <span><strong className="text-gray-700 dark:text-gray-200">{batch.totalInput}</strong> entrada</span>
                  <span><strong className="text-gray-700 dark:text-gray-200">{batch.totalOutput}</strong> unicos</span>
                  <span><strong className="text-orange-600">{batch.duplicates}</strong> dup.</span>
                  <span><strong className="text-blue-600">{batch.changes}</strong> norm.</span>
                </div>

                {/* Acciones */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleLoad(batch)}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver resultados
                  </button>
                  <button
                    onClick={() => handleDelete(batch.id)}
                    disabled={deletingId === batch.id}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors
                      ${confirmId === batch.id
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-700'
                      }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    {confirmId === batch.id ? 'Confirmar' : deletingId === batch.id ? 'Eliminando...' : 'Eliminar'}
                  </button>
                  {/* Boton cancelar confirmacion */}
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

      {/* Aviso cuando hay más de 20 batches */}
      {hayMas && (
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 py-2">
          Mostrando los 20 más recientes.{' '}
          <a href="/analytics" className="text-blue-600 dark:text-blue-400 hover:underline">
            Ver todos en Analytics →
          </a>
        </p>
      )}
    </div>
  )
}
