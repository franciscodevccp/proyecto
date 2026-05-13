'use client'

/**
 * SqlExport.tsx
 * Panel para configurar y descargar el script SQL de los datos normalizados.
 * Permite elegir dialecto (PostgreSQL, MySQL, SQLite), nombre de tabla,
 * opciones adicionales y muestra un preview de las primeras 10 lineas del SQL.
 */

import { useState } from 'react'
import { Database, Copy, Download, Check } from 'lucide-react'
import type { SQLDialect } from '../lib/exporters'

interface SqlExportProps {
  /** ID del batch cuyos datos se exportaran */
  batchId: string
}

/** Opciones de dialecto con icono y etiqueta */
const DIALECTS: { value: SQLDialect; label: string; icon: string }[] = [
  { value: 'postgresql', label: 'PostgreSQL', icon: '🐘' },
  { value: 'mysql', label: 'MySQL', icon: '🐬' },
  { value: 'sqlite', label: 'SQLite', icon: '📦' },
]

export default function SqlExport({ batchId }: SqlExportProps) {
  const [dialect, setDialect] = useState<SQLDialect>('postgresql')
  const [tableName, setTableName] = useState('datos_norm')
  const [includeOriginal, setIncludeOriginal] = useState(true)
  const [includeIndex, setIncludeIndex] = useState(true)
  const [copied, setCopied] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  /** Construye la URL de descarga con los parametros configurados */
  function buildUrl() {
    const params = new URLSearchParams({
      batchId,
      type: 'sql',
      dialect,
      tableName: tableName || 'datos_norm',
      includeOriginal: includeOriginal ? 'true' : 'false',
      includeIndex: includeIndex ? 'true' : 'false',
    })
    return `/api/download?${params.toString()}`
  }

  /** Descarga el archivo SQL */
  function downloadSQL() {
    window.open(buildUrl(), '_blank')
  }

  /** Carga un preview de las primeras 10 lineas del SQL generado */
  async function loadPreview() {
    setLoadingPreview(true)
    try {
      const res = await fetch(buildUrl())
      const text = await res.text()
      // Mostrar solo las primeras 10 lineas no vacias
      const lines = text.split('\n').filter((l) => l.trim()).slice(0, 10)
      setPreview(lines.join('\n'))
    } catch {
      setPreview('Error al cargar preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  /** Copia el preview al portapapeles */
  async function copyPreview() {
    if (!preview) return
    await navigator.clipboard.writeText(preview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      {/* Selector de dialecto */}
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Motor de base de datos:</p>
        <div className="flex gap-2">
          {DIALECTS.map((d) => (
            <button
              key={d.value}
              onClick={() => { setDialect(d.value); setPreview(null) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors
                ${dialect === d.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                }`}
            >
              <span>{d.icon}</span>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nombre de tabla e index */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1">
            Nombre de tabla:
          </label>
          <input
            type="text"
            value={tableName}
            onChange={(e) => { setTableName(e.target.value); setPreview(null) }}
            placeholder="datos_norm"
            className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="space-y-2 pt-5">
          {/* Opcion: incluir columna original */}
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeOriginal}
              onChange={(e) => { setIncludeOriginal(e.target.checked); setPreview(null) }}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            Incluir columna <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">original</code>
          </label>
          {/* Opcion: crear indice */}
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeIndex}
              onChange={(e) => { setIncludeIndex(e.target.checked); setPreview(null) }}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            Crear indice en <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">normalizado</code>
          </label>
        </div>
      </div>

      {/* Preview del SQL */}
      {preview && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Preview (primeras 10 lineas)</span>
            <button
              onClick={copyPreview}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <pre className="text-xs font-mono p-3 overflow-x-auto bg-gray-900 text-green-400 max-h-40">
            {preview}
          </pre>
        </div>
      )}

      {/* Botones de accion */}
      <div className="flex gap-2">
        <button
          onClick={loadPreview}
          disabled={loadingPreview}
          className="flex items-center gap-2 text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Database className="w-4 h-4" />
          {loadingPreview ? 'Cargando...' : 'Ver preview'}
        </button>
        <button
          onClick={downloadSQL}
          className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Descargar .sql
        </button>
      </div>
    </div>
  )
}
