'use client'

/**
 * DataTable.tsx
 * Tabla paginada de comunas normalizadas con busqueda en tiempo real,
 * filtros por tipo de cambio y modal de exportacion en 4 formatos.
 */

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Search, X, FileText, FileJson, Sheet, Database, ArrowUpDown, Check } from 'lucide-react'
import SqlExport from './SqlExport'

interface Comuna {
  id: string
  original: string
  normalized: string
}

interface DataTableProps {
  batchId: string
}

const PAGE_SIZE = 20

export default function DataTable({ batchId }: DataTableProps) {
  const [comunas, setComunas] = useState<Comuna[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)

  // Modal exportacion
  const [showExportModal, setShowExportModal] = useState(false)
  const [sortedExport, setSortedExport] = useState(false)
  const [showSqlSection, setShowSqlSection] = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/comunas?batchId=${batchId}`)
      .then((r) => r.json())
      .then((d) => setComunas(d.comunas ?? []))
      .finally(() => setLoading(false))
  }, [batchId])

  useEffect(() => { setPage(1) }, [search, onlyChanged])

  // Cerrar modal con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowExportModal(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const filtered = comunas.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch =
      q === '' || c.original.toLowerCase().includes(q) || c.normalized.toLowerCase().includes(q)
    const matchChanged = !onlyChanged || c.original !== c.normalized
    return matchSearch && matchChanged
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasActiveFilters = search !== '' || onlyChanged

  function download(type: string) {
    setDownloading(type)
    const sortParam = sortedExport ? '&sorted=true' : ''
    window.open(`/api/download?batchId=${batchId}&type=${type}${sortParam}`, '_blank')
    setTimeout(() => setDownloading(null), 1500)
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500 dark:text-gray-400">Cargando datos…</div>
  }

  return (
    <div className="space-y-4">
      {/* Barra de controles */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-44"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="w-3.5 h-3.5 accent-blue-600" />
            Solo cambiados
          </label>

          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setOnlyChanged(false) }} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
              Limpiar filtros
            </button>
          )}

          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} registros{hasActiveFilters && ` de ${comunas.length}`}
          </span>
        </div>

        {/* Boton Exportar */}
        <button
          onClick={() => { setShowExportModal(true); setShowSqlSection(false) }}
          className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Tabla de datos */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left w-16">#</th>
              <th className="px-4 py-3 text-left">Original</th>
              <th className="px-4 py-3 text-left">Normalizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {slice.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-10 text-gray-400 dark:text-gray-500">
                  Sin resultados para esta busqueda
                </td>
              </tr>
            ) : (
              slice.map((c, i) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono">{c.original}</td>
                  <td className={`px-4 py-3 font-medium ${c.original !== c.normalized ? 'text-blue-700 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'}`}>
                    {c.normalized}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacion */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Pagina {page} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Modal de Exportacion ─────────────────────────────────────── */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowExportModal(false) }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700 overflow-hidden">

            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                  <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Exportar datos</h2>
                  <p className="text-xs text-gray-400">{comunas.length} registros normalizados</p>
                </div>
              </div>
              <button onClick={() => setShowExportModal(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Toggle ordenar */}
              <div
                onClick={() => setSortedExport((s) => !s)}
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all select-none
                  ${sortedExport
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <ArrowUpDown className={`w-5 h-5 ${sortedExport ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${sortedExport ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      Ordenar A → Z
                    </p>
                    <p className="text-xs text-gray-400">Los datos se exportan ordenados alfabéticamente</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${sortedExport ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${sortedExport ? 'left-5' : 'left-1'}`} />
                </div>
              </div>

              {/* Formatos */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Formato de exportación</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { type: 'csv', label: 'CSV', desc: 'Excel compatible', icon: FileText, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                    { type: 'json', label: 'JSON', desc: 'Para APIs', icon: FileJson, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
                    { type: 'xlsx', label: 'Excel', desc: '.xlsx nativo', icon: Sheet, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
                  ].map(({ type, label, desc, icon: Icon, color, bg }) => (
                    <button
                      key={type}
                      onClick={() => download(type)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all group"
                    >
                      <div className={`p-2.5 rounded-lg ${bg} transition-colors`}>
                        {downloading === type
                          ? <Check className={`w-5 h-5 ${color}`} />
                          : <Icon className={`w-5 h-5 ${color}`} />
                        }
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Seccion SQL */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <button
                  onClick={() => setShowSqlSection((s) => !s)}
                  className="flex items-center justify-between w-full text-left group"
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Exportar como SQL</span>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">PostgreSQL · MySQL · SQLite</span>
                  </div>
                  <span className="text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors">
                    {showSqlSection ? 'Ocultar ▲' : 'Configurar ▼'}
                  </span>
                </button>

                {showSqlSection && (
                  <div className="mt-4">
                    <SqlExport batchId={batchId} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
