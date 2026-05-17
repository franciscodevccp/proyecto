'use client'

/**
 * DataTable.tsx
 * Tabla paginada de comunas normalizadas con busqueda en tiempo real,
 * filtros por tipo de cambio y dropdown de exportacion en 4 formatos.
 */

import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Download, Search, X, ChevronDown } from 'lucide-react'
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

/** Opciones del dropdown de exportacion (sin SQL, que tiene su propio panel) */
const EXPORT_OPTIONS = [
  { label: 'Descargar CSV', type: 'csv' },
  { label: 'Descargar JSON', type: 'json' },
  { label: 'Descargar Excel (.xlsx)', type: 'xlsx' },
]

export default function DataTable({ batchId }: DataTableProps) {
  const [comunas, setComunas] = useState<Comuna[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  // Estado de busqueda y filtros
  const [search, setSearch] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)

  // Ordenar datos al exportar
  const [sortedExport, setSortedExport] = useState(false)

  // Estado del dropdown de exportacion y panel SQL
  const [exportOpen, setExportOpen] = useState(false)
  const [showSql, setShowSql] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/comunas?batchId=${batchId}`)
      .then((r) => r.json())
      .then((d) => setComunas(d.comunas ?? []))
      .finally(() => setLoading(false))
  }, [batchId])

  // Resetear pagina al cambiar filtros
  useEffect(() => { setPage(1) }, [search, onlyChanged])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Filtrado en memoria sin llamadas adicionales al API
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
    const sortParam = sortedExport ? '&sorted=true' : ''
    window.open(`/api/download?batchId=${batchId}&type=${type}${sortParam}`, '_blank')
    setExportOpen(false)
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500 dark:text-gray-400">Cargando datos…</div>
  }

  return (
    <div className="space-y-4">
      {/* Barra de controles */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Busqueda en tiempo real */}
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
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Checkbox solo cambiados */}
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyChanged}
              onChange={(e) => setOnlyChanged(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600"
            />
            Solo cambiados
          </label>

          {/* Boton limpiar (visible solo cuando hay filtros activos) */}
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setOnlyChanged(false) }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Limpiar filtros
            </button>
          )}

          {/* Contador dinamico que refleja los filtros */}
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filtered.length} registros{hasActiveFilters && ` de ${comunas.length}`}
          </span>
        </div>

        {/* Dropdown de exportacion */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setExportOpen((o) => !o)}
            className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg z-10 overflow-hidden">
              {EXPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => download(opt.type)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
              <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sortedExport}
                    onChange={(e) => setSortedExport(e.target.checked)}
                    className="w-3.5 h-3.5 accent-blue-600"
                  />
                  Ordenar A→Z
                </label>
              </div>
              <button
                onClick={() => { setShowSql((s) => !s); setExportOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-t border-gray-100 dark:border-gray-700"
              >
                Exportar SQL…
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panel SQL desplegable bajo la tabla */}
      {showSql && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Exportar como SQL</p>
            <button onClick={() => setShowSql(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          <SqlExport batchId={batchId} />
        </div>
      )}

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
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">Pagina {page} de {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
