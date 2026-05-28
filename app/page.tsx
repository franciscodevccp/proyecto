'use client'

/**
 * page.tsx
 * Dashboard principal de COMUNAS_NORM v2.0.
 * Integra: FileUpload, QualityGauge, StatsPanel, ChartsPanel,
 * DryRunBanner, tabs (Datos / Log / Historial) y dark mode toggle.
 */

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Toaster, toast } from 'react-hot-toast'
import { Database, Table, ScrollText, History, Moon, Sun, BookOpen, X, BarChart2, Users, MapPin, ArrowRight } from 'lucide-react'
import Link from 'next/link'

import FileUpload, { type ProcessResponse } from './components/FileUpload'
import BuscadorComuna from './components/BuscadorComuna'
import StatsPanel from './components/StatsPanel'
import DataTable from './components/DataTable'
import LogViewer from './components/LogViewer'
import QualityGauge from './components/QualityGauge'
import ChartsPanel from './components/ChartsPanel'
import BatchHistory from './components/BatchHistory'
import ErrorBoundary from './components/ErrorBoundary'
import { useDarkMode } from './hooks/useDarkMode'
import { APP_VERSION } from './lib/version'

type Tab = 'datos' | 'log' | 'historial'

export default function Home() {
  const [result, setResult] = useState<ProcessResponse | null>(null)
  const [tab, setTab] = useState<Tab>('datos')
  const [isDark, toggleDark] = useDarkMode()
  /** Módulo detectado cuando el usuario sube un archivo equivocado */
  const [moduloEquivocado, setModuloEquivocado] = useState<'famosos' | 'lugares' | null>(null)

  // useSearchParams detecta cambios en la URL sin necesidad de recargar la página
  const searchParams = useSearchParams()

  // Carga automatica de un batch cuando se navega desde Analytics (?batch=<id>)
  useEffect(() => {
    const batchId = searchParams.get('batch')
    if (!batchId) return
    fetch(`/api/batches?id=${batchId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.batch) return
        const b = data.batch
        setResult({
          batchId: b.id,
          fileName: b.fileName,
          totalInput: b.totalInput,
          totalOutput: b.totalOutput,
          duplicates: b.duplicates,
          changes: b.changes,
          corrections: 0,
          correctionMode: false,
          qualityBefore: null,
          qualityAfter: null,
        })
        setTab('datos')
      })
      .catch(() => {/* ignorar errores de red */})
  }, [searchParams])

  /**
   * Limpia el dashboard si el batch eliminado es el que se esta mostrando actualmente.
   */
  function handleBatchDelete(id: string) {
    if (result?.batchId === id) {
      setResult(null)
    }
  }

  /** Recibe el resultado del procesamiento */
  function handleResult(data: ProcessResponse) {
    setResult(data)
    setTab('datos')
    toast.success(`Procesado: ${data.totalOutput} registros unicos`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Toaster position="top-right" />

      {/* Modal: archivo del módulo equivocado */}
      {moduloEquivocado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-md p-6 space-y-4">
            {/* Icono + título */}
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${moduloEquivocado === 'famosos' ? 'bg-purple-100 dark:bg-purple-950' : 'bg-teal-100 dark:bg-teal-950'}`}>
                {moduloEquivocado === 'famosos'
                  ? <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  : <MapPin className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                }
              </div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Archivo incorrecto
              </h2>
            </div>

            {/* Mensaje */}
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Este archivo parece corresponder al módulo de{' '}
              <strong className={moduloEquivocado === 'famosos' ? 'text-purple-600 dark:text-purple-400' : 'text-teal-600 dark:text-teal-400'}>
                {moduloEquivocado === 'famosos' ? 'Famosos' : 'Lugares turísticos'}
              </strong>.
              Esta página procesa solo comunas. ¿Quieres ir a la página correcta?
            </p>

            {/* Acciones */}
            <div className="flex gap-2 pt-1">
              <Link
                href={moduloEquivocado === 'famosos' ? '/famosos' : '/lugares'}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors
                  ${moduloEquivocado === 'famosos'
                    ? 'bg-purple-600 hover:bg-purple-700'
                    : 'bg-teal-600 hover:bg-teal-700'
                  }`}
              >
                Ir a {moduloEquivocado === 'famosos' ? 'Famosos' : 'Lugares'}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setModuloEquivocado(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Database className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">COMUNAS_NORM</h1>
              <p className="text-xs text-gray-400">Pipeline ETL de normalizacion de texto</p>
            </div>
          </div>

          {/* Navegacion y dark mode */}
          <div className="flex items-center gap-3">
            <Link
              href="/famosos"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Famosos
            </Link>
            <Link
              href="/lugares"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Lugares
            </Link>
            <Link
              href="/api-docs"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              API Docs
            </Link>
            <Link
              href="/analytics"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Analytics
            </Link>
            <Link
              href={result ? `/reporte?batch=${result.batchId}&modulo=comunas` : '/reporte'}
              className="hidden sm:flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              Reporte
            </Link>
            {/* Toggle dark mode */}
            <button
              onClick={toggleDark}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isDark
                ? <Sun className="w-4 h-4 text-yellow-400" aria-hidden="true" />
                : <Moon className="w-4 h-4 text-gray-500" aria-hidden="true" />
              }
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">

        {/* Seccion de carga */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Cargar archivo
            </h2>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              Sube un archivo <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.txt</code>,{' '}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.csv</code> o{' '}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.tsv</code> — un valor por linea (o elige columna en CSV/TSV)
            </p>
          </div>
          <FileUpload onResult={handleResult} onWrongModule={setModuloEquivocado} />
          {/* Divisor */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-gray-900 px-3 text-gray-400">o busca por nombre</span>
            </div>
          </div>
          {/* Buscador de comunas */}
          <BuscadorComuna onResult={handleResult} />
        </section>

        {/* Resultados */}
        {result && (
          <>
            {/* Cabecera de resultados con boton limpiar */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Resultados — {result.fileName}
              </p>
              <button
                onClick={() => setResult(null)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar
              </button>
            </div>

            {/* 1. Tarjetas de estadisticas (primera fila, full width) */}
            <StatsPanel data={result} />

            {/* 2. Quality gauge + Graficos en grid 2 columnas en desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <ErrorBoundary label="Score de calidad">
                {result.qualityBefore && result.qualityAfter && (
                  <QualityGauge before={result.qualityBefore} after={result.qualityAfter} />
                )}
              </ErrorBoundary>
              <ErrorBoundary label="Gráficos">
                <ChartsPanel data={result} />
              </ErrorBoundary>
            </div>

            {/* 3. Tabs: Datos / Log / Historial */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-800">
                {(
                  [
                    { id: 'datos', label: 'Datos normalizados', icon: Table },
                    { id: 'log', label: 'Log de cambios', icon: ScrollText },
                    { id: 'historial', label: 'Historial', icon: History },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex items-center gap-1.5 px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-colors
                      ${tab === id
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-950/30'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="p-3 sm:p-6">
                {tab === 'datos' && <DataTable batchId={result.batchId} />}
                {tab === 'log' && <LogViewer batchId={result.batchId} />}
                {tab === 'historial' && <BatchHistory onLoad={handleResult} onDelete={handleBatchDelete} />}
              </div>
            </div>
          </>
        )}

        {/* Estado inicial sin resultados */}
        {!result && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Carga un archivo para ver los resultados</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-8 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-400 dark:text-gray-600">
          <span>COMUNAS_NORM — Pipeline ETL de normalización de texto</span>
          <span>{APP_VERSION}</span>
        </div>
      </footer>
    </div>
  )
}
