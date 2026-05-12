'use client'

import { useState } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { Database, Table, ScrollText } from 'lucide-react'
import FileUpload, { type ProcessResponse } from './components/FileUpload'
import StatsPanel from './components/StatsPanel'
import DataTable from './components/DataTable'
import LogViewer from './components/LogViewer'

type Tab = 'datos' | 'log'

export default function Home() {
  const [result, setResult] = useState<ProcessResponse | null>(null)
  const [tab, setTab] = useState<Tab>('datos')

  const handleResult = (data: ProcessResponse) => {
    setResult(data)
    setTab('datos')
    toast.success(`Archivo procesado: ${data.totalOutput} comunas únicas`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <Database className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">COMUNAS_NORM</h1>
            <p className="text-xs text-gray-400">Normalización de datasets de comunas chilenas</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Upload */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Cargar archivo
          </h2>
          <p className="text-sm text-gray-400">
            Sube un archivo <code className="bg-gray-100 px-1 rounded">.txt</code> con un nombre de
            comuna por línea
          </p>
          <div className="pt-2">
            <FileUpload onResult={handleResult} />
          </div>
        </section>

        {/* Results */}
        {result && (
          <>
            <StatsPanel data={result} />

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => setTab('datos')}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors
                    ${tab === 'datos' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Table className="w-4 h-4" />
                  Datos normalizados
                </button>
                <button
                  onClick={() => setTab('log')}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors
                    ${tab === 'log' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ScrollText className="w-4 h-4" />
                  Log de cambios
                </button>
              </div>
              <div className="p-6">
                {tab === 'datos' && <DataTable batchId={result.batchId} />}
                {tab === 'log' && <LogViewer batchId={result.batchId} />}
              </div>
            </div>
          </>
        )}

        {!result && (
          <div className="text-center py-16 text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Carga un archivo para ver los resultados</p>
          </div>
        )}
      </main>
    </div>
  )
}
