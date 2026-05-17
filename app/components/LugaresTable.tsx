'use client'

/**
 * LugaresTable.tsx
 * Tabla paginada de lugares turísticos con búsqueda por nombre o país,
 * y modal de exportación (CSV / JSON / TXT con toggle A→Z).
 * Muestra: nombre, país, ciudad/estado, coordenadas.
 */

import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Download,
  FileText,
  FileJson,
  MapPin,
  ArrowUpDown,
  Check,
} from 'lucide-react'

/** Estructura de un lugar recibido de la API (con relaciones incluidas) */
interface Georef {
  latitud: number
  longitud: number
}

interface Direccion {
  nombreCalle: string | null
  numeroCalle: string | null
  ciudadEstadoProvincia: string | null
  pais: string | null
  rawDireccion: string
}

interface Lugar {
  id: string
  nombre: string
  georef: Georef | null
  direccion: Direccion | null
}

interface LugaresTableProps {
  batchId: string
}

const PAGE_SIZE = 20

export default function LugaresTable({ batchId }: LugaresTableProps) {
  const [lugares, setLugares] = useState<Lugar[]>([])
  const [page, setPage] = useState(1)
  const [cargando, setCargando] = useState(true)

  // Filtros
  const [busqueda, setBusqueda] = useState('')

  // Modal de exportación
  const [mostrarModal, setMostrarModal] = useState(false)
  const [ordenado, setOrdenado] = useState(false)
  const [descargando, setDescargando] = useState<string | null>(null)

  // Cargar lugares del batch
  useEffect(() => {
    setCargando(true)
    fetch(`/api/lugares/batch?id=${batchId}`)
      .then((r) => r.json())
      .then((d) => setLugares(d.batch?.lugares ?? []))
      .finally(() => setCargando(false))
  }, [batchId])

  // Volver a página 1 cuando cambia la búsqueda
  useEffect(() => { setPage(1) }, [busqueda])

  // Cerrar modal con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMostrarModal(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Filtrar en memoria por nombre o país
  const filtrados = lugares.filter((l) => {
    const q = busqueda.toLowerCase()
    return (
      q === '' ||
      l.nombre.toLowerCase().includes(q) ||
      (l.direccion?.pais ?? '').toLowerCase().includes(q) ||
      (l.direccion?.ciudadEstadoProvincia ?? '').toLowerCase().includes(q)
    )
  })

  const totalPaginas = Math.ceil(filtrados.length / PAGE_SIZE)
  const slice = filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hayFiltros = busqueda !== ''

  /** Descarga el archivo en el tipo solicitado */
  function descargar(tipo: string) {
    setDescargando(tipo)
    const params = `batchId=${batchId}&type=${tipo}${ordenado ? '&sorted=true' : ''}`
    window.open(`/api/lugares/download?${params}`, '_blank')
    setTimeout(() => setDescargando(null), 1500)
  }

  if (cargando) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        Cargando lugares…
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Barra de controles */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o país…"
              className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-56"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {hayFiltros && (
            <button
              onClick={() => setBusqueda('')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Limpiar filtros
            </button>
          )}

          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filtrados.length} registros{hayFiltros && ` de ${lugares.length}`}
          </span>
        </div>

        {/* Botón exportar */}
        <button
          onClick={() => setMostrarModal(true)}
          className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left w-12">#</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">País</th>
              <th className="px-4 py-3 text-left">Ciudad / Estado</th>
              <th className="px-4 py-3 text-left">Coordenadas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {slice.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400 dark:text-gray-500">
                  Sin resultados para esta búsqueda
                </td>
              </tr>
            ) : (
              slice.map((l, i) => (
                <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500">
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-teal-500 shrink-0" />
                      {l.nombre}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {l.direccion?.pais ?? <span className="text-gray-300 dark:text-gray-600 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {l.direccion?.ciudadEstadoProvincia ?? <span className="text-gray-300 dark:text-gray-600 italic">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {l.georef
                      ? `${l.georef.latitud.toFixed(4)}, ${l.georef.longitud.toFixed(4)}`
                      : <span className="text-gray-300 dark:text-gray-600 italic">sin georef</span>
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Página {page} de {totalPaginas}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))}
            disabled={page === totalPaginas}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Modal de exportación ───────────────────────────────────────── */}
      {mostrarModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setMostrarModal(false) }}
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                  <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Exportar lugares
                  </h2>
                  <p className="text-xs text-gray-400">{lugares.length} registros</p>
                </div>
              </div>
              <button
                onClick={() => setMostrarModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">

              {/* Toggle A→Z */}
              <div
                onClick={() => setOrdenado((s) => !s)}
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all select-none
                  ${ordenado
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <ArrowUpDown className={`w-5 h-5 ${ordenado ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`} />
                  <div>
                    <p className={`text-sm font-medium ${ordenado ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      Ordenar A → Z
                    </p>
                    <p className="text-xs text-gray-400">Exportar en orden alfabético por nombre</p>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${ordenado ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${ordenado ? 'left-5' : 'left-1'}`} />
                </div>
              </div>

              {/* Botones de formato */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Formato de exportación
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { tipo: 'csv', label: 'CSV', desc: 'Excel compatible', icono: FileText, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                    { tipo: 'json', label: 'JSON', desc: 'Para APIs', icono: FileJson, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' },
                    { tipo: 'txt', label: 'TXT', desc: 'Texto plano', icono: FileText, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
                  ].map(({ tipo, label, desc, icono: Icono, color, bg }) => (
                    <button
                      key={tipo}
                      onClick={() => descargar(tipo)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
                    >
                      <div className={`p-2.5 rounded-lg ${bg}`}>
                        {descargando === tipo
                          ? <Check className={`w-5 h-5 ${color}`} />
                          : <Icono className={`w-5 h-5 ${color}`} />
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

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
