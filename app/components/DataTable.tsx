'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

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

  useEffect(() => {
    setLoading(true)
    fetch(`/api/comunas?batchId=${batchId}`)
      .then((r) => r.json())
      .then((d) => setComunas(d.comunas ?? []))
      .finally(() => setLoading(false))
  }, [batchId])

  const totalPages = Math.ceil(comunas.length / PAGE_SIZE)
  const slice = comunas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const downloadCsv = () => {
    window.open(`/api/download?batchId=${batchId}&type=csv`, '_blank')
  }

  if (loading) {
    return <div className="text-center py-10 text-gray-500">Cargando datos…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{comunas.length} comunas normalizadas</p>
        <button
          onClick={downloadCsv}
          className="flex items-center gap-2 text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Descargar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left w-16">#</th>
              <th className="px-4 py-3 text-left">Original</th>
              <th className="px-4 py-3 text-left">Normalizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {slice.map((c, i) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{(page - 1) * PAGE_SIZE + i + 1}</td>
                <td className="px-4 py-3 text-gray-500 font-mono">{c.original}</td>
                <td className="px-4 py-3 text-gray-800 font-medium">{c.normalized}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
