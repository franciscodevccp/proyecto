'use client'

/**
 * LugaresSqlExport.tsx
 * Panel colapsable para configurar y descargar el script SQL de lugares turisticos.
 * Genera 3 tablas con FK (lugares, georeferencias, direcciones).
 * Permite elegir entre PostgreSQL y MySQL, ver preview y descargar el .sql.
 */

import { useState } from 'react'
import {
  Database,
  Server,
  Download,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Info,
} from 'lucide-react'

type LugaresDialect = 'postgresql' | 'mysql'

interface LugaresSqlExportProps {
  /** ID del batch cuyos datos se exportaran */
  batchId: string
  /** Total de lugares del batch */
  totalRegistros: number
}

/** Dialectos disponibles para lugares (sin SQLite: el esquema FK requiere motor relacional) */
const DIALECTOS: {
  value: LugaresDialect
  label: string
  Icono: React.ComponentType<{ className?: string }>
  color: string
}[] = [
  {
    value: 'postgresql',
    label: 'PostgreSQL',
    Icono: Database,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'mysql',
    label: 'MySQL',
    Icono: Server,
    color: 'text-orange-600 dark:text-orange-400',
  },
]

export default function LugaresSqlExport({ batchId, totalRegistros }: LugaresSqlExportProps) {
  const [expandido, setExpandido] = useState(false)
  const [dialecto, setDialecto] = useState<LugaresDialect>('postgresql')
  const [preview, setPreview] = useState<string | null>(null)
  const [cargandoPreview, setCargandoPreview] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [descargando, setDescargando] = useState(false)

  /** Construye la URL base con los parametros actuales */
  function buildUrl(extraParams?: Record<string, string>) {
    const params = new URLSearchParams({
      batchId,
      type: 'sql',
      dialect: dialecto,
      ...extraParams,
    })
    return `/api/lugares/download?${params.toString()}`
  }

  /** Carga el preview de las primeras 30 lineas del SQL */
  async function cargarPreview() {
    setCargandoPreview(true)
    setPreview(null)
    try {
      const res = await fetch(buildUrl({ preview: 'true' }))
      const data = await res.json() as { preview: string }
      setPreview(data.preview ?? 'Sin contenido')
    } catch {
      setPreview('Error al cargar el preview')
    } finally {
      setCargandoPreview(false)
    }
  }

  /** Copia el preview al portapapeles */
  async function copiarPreview() {
    if (!preview) return
    await navigator.clipboard.writeText(preview)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  /** Inicia la descarga del archivo SQL */
  function descargar() {
    setDescargando(true)
    window.open(buildUrl(), '_blank')
    setTimeout(() => setDescargando(false), 1500)
  }

  /** Cambia el dialecto y limpia el preview */
  function cambiarDialecto(d: LugaresDialect) {
    setDialecto(d)
    setPreview(null)
  }

  return (
    <div className="border-t border-gray-100 dark:border-gray-800 pt-4">

      {/* Cabecera colapsable */}
      <button
        onClick={() => setExpandido((v) => !v)}
        className="flex items-center justify-between w-full group"
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Exportar SQL
          </span>
          <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
            3 tablas
          </span>
        </div>
        {expandido
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />
        }
      </button>

      {/* Panel de configuracion */}
      {expandido && (
        <div className="mt-4 space-y-4">

          {/* Nota informativa sobre las 3 tablas */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              El script genera 3 tablas relacionadas:{' '}
              <code className="bg-white dark:bg-gray-900 px-1 rounded border border-gray-200 dark:border-gray-700">lugares</code>,{' '}
              <code className="bg-white dark:bg-gray-900 px-1 rounded border border-gray-200 dark:border-gray-700">georeferencias</code>{' '}
              y{' '}
              <code className="bg-white dark:bg-gray-900 px-1 rounded border border-gray-200 dark:border-gray-700">direcciones</code>{' '}
              con clave foranea a{' '}
              <code className="bg-white dark:bg-gray-900 px-1 rounded border border-gray-200 dark:border-gray-700">lugares(id)</code>.
            </p>
          </div>

          {/* Selector de dialecto */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Motor de base de datos
            </p>
            <div className="flex gap-2">
              {DIALECTOS.map(({ value, label, Icono, color }) => (
                <button
                  key={value}
                  onClick={() => cambiarDialecto(value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors
                    ${dialecto === value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                    }`}
                >
                  <Icono className={`w-4 h-4 ${dialecto === value ? color : 'text-gray-400'}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview del SQL */}
          {preview && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Preview — primeras lineas
                </span>
                <button
                  onClick={copiarPreview}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  {copiado
                    ? <Check className="w-3.5 h-3.5 text-green-500" />
                    : <Copy className="w-3.5 h-3.5" />
                  }
                  {copiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <pre className="text-xs font-mono p-3 overflow-x-auto bg-gray-900 text-green-400 max-h-44 whitespace-pre">
                {preview}
              </pre>
            </div>
          )}

          {/* Botones de accion */}
          <div className="flex gap-2">
            <button
              onClick={cargarPreview}
              disabled={cargandoPreview}
              className="flex items-center gap-2 text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {cargandoPreview ? 'Cargando...' : 'Ver preview'}
            </button>
            <button
              onClick={descargar}
              disabled={descargando}
              className="flex items-center gap-2 text-sm bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {descargando
                ? <Check className="w-4 h-4" />
                : <Download className="w-4 h-4" />
              }
              Descargar .sql
            </button>
          </div>

          <p className="text-xs text-gray-400">
            {totalRegistros} lugares — tablas: lugares, georeferencias, direcciones
          </p>

        </div>
      )}
    </div>
  )
}
