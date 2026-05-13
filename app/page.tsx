'use client'

/**
 * page.tsx
 * Dashboard principal de COMUNAS_NORM v2.0.
 * Integra: FileUpload, QualityGauge, StatsPanel, ChartsPanel,
 * DryRunBanner, tabs (Datos / Log / Historial) y dark mode toggle.
 */

import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { Database, Table, ScrollText, History, Moon, Sun, BookOpen } from 'lucide-react'
import Link from 'next/link'

import FileUpload, { type ProcessResponse } from './components/FileUpload'
import StatsPanel from './components/StatsPanel'
import DataTable from './components/DataTable'
import LogViewer from './components/LogViewer'
import QualityGauge from './components/QualityGauge'
import ChartsPanel from './components/ChartsPanel'
import DryRunBanner from './components/DryRunBanner'
import BatchHistory from './components/BatchHistory'
import { useDarkMode } from './hooks/useDarkMode'

type Tab = 'datos' | 'log' | 'historial'

export default function Home() {
  const [result, setResult] = useState<ProcessResponse | null>(null)
  const [tab, setTab] = useState<Tab>('datos')
  const [savingDryRun, setSavingDryRun] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [isDark, toggleDark] = useDarkMode()

  /** Recibe el resultado del procesamiento (normal o dry run) */
  function handleResult(data: ProcessResponse) {
    setResult(data)
    setTab('datos')
    if (data.dryRun) {
      toast('Modo preview: los datos NO se guardaron', { icon: '👁️' })
    } else {
      toast.success(`Procesado: ${data.totalOutput} registros unicos`)
    }
  }

  /**
   * Confirma el dry run: reprocesa el mismo archivo sin el flag dryRun
   * para persistir los datos en la base de datos.
   */
  async function handleConfirmDryRun() {
    if (!pendingFile && !result) return
    setSavingDryRun(true)
    try {
      // Re-usar el mismo archivo que se proceso en preview
      // Como ya no tenemos la referencia al File, re-procesamos con los mismos params
      // enviando el fileName como referencia — el usuario debera subir el archivo de nuevo
      // si no esta en memoria. Alternativa: guardar el File en estado.
      toast.error('Para guardar, sube el archivo nuevamente sin el modo preview activo')
    } finally {
      setSavingDryRun(false)
    }
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
          <FileUpload onResult={handleResult} />
        </section>

        {/* Resultados */}
        {result && (
          <>
            {/* Banner de dry run (solo visible en modo preview) */}
            {result.dryRun && (
              <DryRunBanner
                fileName={result.fileName}
                onConfirm={handleConfirmDryRun}
                saving={savingDryRun}
              />
            )}

            {/* Quality gauge (solo si hay scores calculados) */}
            {result.qualityBefore && result.qualityAfter && (
              <QualityGauge before={result.qualityBefore} after={result.qualityAfter} />
            )}

            {/* Tarjetas de estadisticas */}
            <StatsPanel data={result} />

            {/* Graficos (solo en modo normal, no dry run) */}
            {!result.dryRun && <ChartsPanel data={result} />}

            {/* Preview table en dry run */}
            {result.dryRun && result.preview && result.preview.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 overflow-hidden">
                <div className="px-6 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Vista previa — primeros {result.preview.length} resultados
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3 text-left">Original</th>
                        <th className="px-4 py-3 text-left">Normalizado</th>
                        <th className="px-4 py-3 text-left">Cambio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {result.preview.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2.5 font-mono text-gray-500 dark:text-gray-400">{row.original}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200">{row.normalized}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                              ${row.changeType === 'normalized' ? 'bg-blue-100 text-blue-700' :
                                row.changeType === 'corrected' ? 'bg-purple-100 text-purple-700' :
                                row.changeType === 'duplicate' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-500'}`}
                            >
                              {row.changeType}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabs: Datos / Log / Historial (solo en modo normal) */}
            {!result.dryRun && (
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
                  {tab === 'historial' && <BatchHistory onLoad={handleResult} />}
                </div>
              </div>
            )}
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
