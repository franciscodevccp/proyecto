'use client'

/**
 * famosos/page.tsx
 * Página del módulo de famosos con estructura idéntica al dashboard principal.
 * Incluye drag & drop, tarjetas de estadísticas, tabs Datos / Log / Historial.
 */

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Toaster, toast } from 'react-hot-toast'
import {
  Users, Database, Moon, Sun, Upload, X, Loader2,
  FileText, Table, ScrollText, History, BookOpen, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'
import FamososStats from '../components/FamososStats'
import FamososTable from '../components/FamososTable'
import FamososBatchHistory, { type FamososResponse } from '../components/FamososBatchHistory'
import FamososBirthdayBanner from '../components/FamososBirthdayBanner'
import FamososTimeline from '../components/FamososTimeline'
import RulesConfig from '../components/RulesConfig'
import { useDarkMode } from '../hooks/useDarkMode'
import { DEFAULT_RULESET, type ETLRuleSet } from '../lib/etl-rules'

type Tab = 'datos' | 'log' | 'historial'

export default function PaginaFamosos() {
  const [isDark, toggleDark] = useDarkMode()
  const [resultado, setResultado] = useState<FamososResponse | null>(null)
  const [cargando, setCargando] = useState(false)
  const [tab, setTab] = useState<Tab>('datos')
  const [rules, setRules] = useState<ETLRuleSet>(DEFAULT_RULESET)

  /**
   * Si la URL trae ?batch=ID (viene desde analytics/historial),
   * carga ese batch automáticamente sin necesidad de subir archivo.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const batchId = params.get('batch')
    if (!batchId) return

    fetch(`/api/famosos/batch?id=${batchId}`)
      .then((r) => r.json())
      .then((d) => {
        const b = d.batch
        if (!b) return
        setResultado({
          batchId: b.id,
          fileName: b.fileName,
          totalInput: b.totalInput,
          totalOutput: b.totalOutput,
          duplicateCount: b.duplicates,
          cumpleanosCount: b.cumpleanos,
          logs: [],
        })
        setTab('datos')
      })
      .catch(() => {/* silencioso */})
  }, [])

  /**
   * Procesa el archivo .txt con el endpoint de famosos.
   */
  async function procesarArchivo(archivo: File) {
    const ext = archivo.name.toLowerCase()
    if (!ext.endsWith('.txt') && !ext.endsWith('.csv') && !ext.endsWith('.tsv')) {
      toast.error('Solo se aceptan archivos .txt, .csv o .tsv')
      return
    }
    setCargando(true)
    try {
      const form = new FormData()
      form.append('file', archivo)
      form.append('rules', JSON.stringify(rules))
      const res = await fetch('/api/famosos/process', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Error al procesar el archivo')
        return
      }
      setResultado(data)
      setTab('datos')
      toast.success(`${data.totalOutput} famosos procesados`)
    } catch {
      toast.error('Error de red al procesar el archivo')
    } finally {
      setCargando(false)
    }
  }

  /** Callback de react-dropzone */
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) procesarArchivo(accepted[0])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
    },
    maxFiles: 1,
    disabled: cargando,
  })

  /** Limpia el dashboard si el batch eliminado es el activo */
  function handleBatchDelete(id: string) {
    if (resultado?.batchId === id) setResultado(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Toaster position="top-right" />

      {/* Header — misma estructura que comunas */}
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
            <Users className="w-7 h-7 text-purple-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Famosos</h1>
              <p className="text-xs text-gray-400">Normalización de fechas y deduplicación</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/lugares"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Lugares turísticos
            </Link>
            <Link
              href="/api-docs"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              API Docs
            </Link>
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
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

        {/* Sección de carga — misma estructura que comunas */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Cargar archivo de famosos
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              Formato esperado:{' '}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">N. Nombre Completo - Fecha</code>
              {' '}— un famoso por línea
            </p>
          </div>

          {/* Zona de drop — misma que FileUpload.tsx */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${isDragActive
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }
              ${cargando ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              {cargando
                ? <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                : <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500" />
              }
              <div>
                {cargando ? (
                  <p className="text-purple-600 dark:text-purple-400 font-medium">Procesando…</p>
                ) : isDragActive ? (
                  <p className="text-purple-600 dark:text-purple-400 font-medium">Suelta el archivo aquí</p>
                ) : (
                  <>
                    <p className="font-medium text-gray-700 dark:text-gray-300">
                      Arrastra tu archivo aquí
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      Acepta{' '}
                      <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.txt</code>{' '}
                      <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.csv</code>{' '}
                      <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.tsv</code>
                      {' '}— o haz clic para seleccionar
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Configurador de reglas ETL — idéntico al de comunas */}
          <RulesConfig value={rules} onChange={setRules} />
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

            {/* Tarjetas de estadísticas */}
            <FamososStats
              totalInput={resultado.totalInput}
              totalOutput={resultado.totalOutput}
              duplicateCount={resultado.duplicateCount}
              cumpleanosCount={resultado.cumpleanosCount}
            />

            {/* Banner animado de cumpleaños (hoy o próximo) */}
            <FamososBirthdayBanner batchId={resultado.batchId} />

            {/* Línea de tiempo cronológica */}
            <FamososTimeline batchId={resultado.batchId} />

            {/* Tabs: Datos / Log / Historial */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-800">
                {(
                  [
                    { id: 'datos', label: 'Datos procesados', icon: Table },
                    { id: 'log', label: 'Log de proceso', icon: ScrollText },
                    { id: 'historial', label: 'Historial', icon: History },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors
                      ${tab === id
                        ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50/50 dark:bg-purple-950/30'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-3 sm:p-6">
                {tab === 'datos' && <FamososTable batchId={resultado.batchId} />}

                {tab === 'log' && (
                  <LogFamosos logs={resultado.logs} />
                )}

                {tab === 'historial' && (
                  <FamososBatchHistory
                    onLoad={(data) => { setResultado(data); setTab('datos') }}
                    onDelete={handleBatchDelete}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {/* Estado inicial sin resultados */}
        {!resultado && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Carga un archivo para ver los resultados</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-8 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-400 dark:text-gray-600">
          <span>COMUNAS_NORM — Módulo Famosos</span>
          <span>v0.1.0</span>
        </div>
      </footer>
    </div>
  )
}

/** Visor de log interno — lista las entradas con color según tipo */
function LogFamosos({ logs }: { logs: string[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400 dark:text-gray-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Carga un archivo para ver el log detallado</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="max-h-[500px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
        {logs.map((linea, i) => {
          const esDuplicado = linea.includes('DUPLICADO')
          const esCumple = linea.includes('CUMPLEAÑOS')
          const esError = linea.includes('no parseado')
          return (
            <div key={i} className="px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-start gap-3">
              <span className="text-xs text-gray-400 dark:text-gray-500 w-8 shrink-0 pt-0.5 font-mono">
                {String(i + 1).padStart(3, '0')}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  esDuplicado
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300'
                    : esCumple
                    ? 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
                    : esError
                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    : 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                }`}
              >
                {esDuplicado ? 'Duplicado' : esCumple ? 'Cumpleaños' : esError ? 'Error' : 'OK'}
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-relaxed">
                {linea}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
