'use client'

/**
 * lugares/page.tsx
 * Página del módulo de lugares turísticos.
 * Carga un archivo CSV separado por ";" (encoding Windows-1252),
 * lo procesa y muestra estadísticas + tabla paginada con exportación.
 */

import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { MapPin, Moon, Sun, Upload, X, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import LugaresStats from '../components/LugaresStats'
import LugaresTable from '../components/LugaresTable'
import { useDarkMode } from '../hooks/useDarkMode'

/** Respuesta del endpoint POST /api/lugares/process */
interface ResultadoLugares {
  batchId: string
  fileName: string
  totalInput: number
  totalOutput: number
  duplicateCount: number
  logs: string[]
}

export default function PaginaLugares() {
  const [isDark, toggleDark] = useDarkMode()
  const [resultado, setResultado] = useState<ResultadoLugares | null>(null)
  const [cargando, setCargando] = useState(false)
  const [mostrarLogs, setMostrarLogs] = useState(false)

  // Estado de drag & drop
  const [arrastrandoSobre, setArrastrandoSobre] = useState(false)

  /**
   * Procesa el archivo con el endpoint de lugares.
   * El servidor lo lee con latin1 para manejar Windows-1252.
   */
  async function procesarArchivo(archivo: File) {
    const nombre = archivo.name.toLowerCase()
    if (!nombre.endsWith('.txt') && !nombre.endsWith('.csv')) {
      toast.error('Solo se aceptan archivos .txt o .csv')
      return
    }

    setCargando(true)
    try {
      const form = new FormData()
      form.append('file', archivo)

      const res = await fetch('/api/lugares/process', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Error al procesar el archivo')
        return
      }

      setResultado(data)
      toast.success(`${data.totalOutput} lugares procesados`)
    } catch {
      toast.error('Error de red al procesar el archivo')
    } finally {
      setCargando(false)
    }
  }

  /** Maneja selección de archivo via input */
  function onArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (archivo) procesarArchivo(archivo)
    e.target.value = ''
  }

  /** Maneja drop de archivo */
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setArrastrandoSobre(false)
    const archivo = e.dataTransfer.files[0]
    if (archivo) procesarArchivo(archivo)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Volver al inicio"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </Link>
            <MapPin className="w-7 h-7 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Lugares turísticos
              </h1>
              <p className="text-xs text-gray-400">Procesamiento de georeferencias y direcciones</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/famosos"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Famosos
            </Link>
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark
                ? <Sun className="w-4 h-4 text-yellow-400" />
                : <Moon className="w-4 h-4 text-gray-500" />
              }
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">

        {/* Zona de carga */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Cargar archivo de lugares
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              Formato: CSV separado por{' '}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">;</code>{' '}
              con columnas{' '}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">nombre;dirección;lat,lon</code>
              {' '}— encoding Windows-1252
            </p>
          </div>

          {/* Área de drag & drop */}
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastrandoSobre(true) }}
            onDragLeave={() => setArrastrandoSobre(false)}
            onDrop={onDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
              ${arrastrandoSobre
                ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/30'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Arrastra el archivo aquí o haz clic para seleccionarlo
            </p>
            <label className="cursor-pointer">
              <span className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${cargando
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700 text-white'
                }`}
              >
                {cargando ? 'Procesando…' : 'Seleccionar archivo .txt / .csv'}
              </span>
              <input
                type="file"
                accept=".txt,.csv"
                onChange={onArchivoSeleccionado}
                disabled={cargando}
                className="hidden"
              />
            </label>
          </div>
        </section>

        {/* Resultados */}
        {resultado && (
          <>
            {/* Cabecera de resultados */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Resultados — {resultado.fileName}
              </p>
              <button
                onClick={() => setResultado(null)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar
              </button>
            </div>

            {/* Estadísticas */}
            <LugaresStats
              totalInput={resultado.totalInput}
              totalOutput={resultado.totalOutput}
              duplicateCount={resultado.duplicateCount}
            />

            {/* Tabla de lugares */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Lugares procesados
                </h3>
                <button
                  onClick={() => setMostrarLogs((s) => !s)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  {mostrarLogs ? 'Ocultar log ▲' : 'Ver log ▼'}
                </button>
              </div>

              {/* Log detallado (colapsable) */}
              {mostrarLogs && (
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                    {resultado.logs.map((linea, i) => (
                      <div
                        key={i}
                        className={linea.includes('DUPLICADO') ? 'text-orange-500' : ''}
                      >
                        {linea}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 sm:p-6">
                <LugaresTable batchId={resultado.batchId} />
              </div>
            </div>
          </>
        )}

        {/* Estado inicial */}
        {!resultado && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Carga un archivo para ver los lugares procesados</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-8 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-400 dark:text-gray-600">
          <span>COMUNAS_NORM — Módulo Lugares Turísticos</span>
          <span>v0.1.0</span>
        </div>
      </footer>
    </div>
  )
}
