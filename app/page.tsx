'use client'

/**
 * page.tsx
 * Dashboard principal de COMUNAS_NORM v2.0.
 * Integra: FileUpload, QualityGauge, StatsPanel, ChartsPanel,
 * DryRunBanner, tabs (Datos / Log / Historial) y dark mode toggle.
 */

import { useState, useEffect } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { Database, Table, ScrollText, History, Moon, Sun, BookOpen } from 'lucide-react'
import Link from 'next/link'

import FileUpload, { type ProcessResponse } from './components/FileUpload'
import StatsPanel from './components/StatsPanel'
import DataTable from './components/DataTable'
import LogViewer from './components/LogViewer'
import QualityGauge from './components/QualityGauge'
import ChartsPanel from './components/ChartsPanel'
import BatchHistory from './components/BatchHistory'
import { useDarkMode } from './hooks/useDarkMode'

type Tab = 'datos' | 'log' | 'historial'

export default function Home() {
  const [result, setResult] = useState<ProcessResponse | null>(null)
  const [tab, setTab] = useState<Tab>('datos')
  const [pendingFileRef, setPendingFileRef] = useState<File | null>(null)
  const [isDark, toggleDark] = useDarkMode()

  // Carga automatica de un batch cuando se navega desde Analytics (?batch=<id>)
  useEffect(() => {
    const batchId = new URLSearchParams(window.location.search).get('batch')
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
  }, [])

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

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
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
              href="/api-docs"
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              API Docs
            </Link>
            <Link
              href="/analytics"
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              Analytics
            </Link>
            {/* Toggle dark mode */}
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

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Seccion de carga */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-3">
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
          <FileUpload onResult={handleResult} onFilePicked={setPendingFileRef} />
        </section>

        {/* Resultados */}
        {result && (
          <>
            {/* 1. Tarjetas de estadisticas (primera fila, full width) */}
            <StatsPanel data={result} />

            {/* 2. Quality gauge + Graficos en grid 2 columnas en desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {result.qualityBefore && result.qualityAfter && (
                <QualityGauge before={result.qualityBefore} after={result.qualityAfter} />
              )}
              <ChartsPanel data={result} />
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
                    className={`flex items-center gap-2 px-5 py-4 text-sm font-medium transition-colors
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
              <div className="p-6">
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
    </div>
  )
}
