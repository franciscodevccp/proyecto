'use client'

/**
 * FamososImagenModal.tsx
 * Modal que muestra la imagen cacheada de un famoso obtenida de Wikipedia.
 * La imagen se almacena en BD para no repetir llamadas a la API externa.
 */

import { useEffect, useState } from 'react'
import { X, ExternalLink, Loader2, User } from 'lucide-react'

interface FamososImagenModalProps {
  famosoId:      string
  nombre:        string
  edad:          number | null
  fechaOriginal: string
  onClose:       () => void
}

/** Datos de imagen retornados por /api/famosos/imagen */
interface ImagenData {
  fotoUrl:          string | null
  fotoFuente:       string | null
  fotoFechaCaptura: string | null
  cache:            boolean
}

/** Formatea una fecha ISO a formato legible en español */
function formatFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/** Genera las iniciales del nombre para el placeholder */
function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('')
}

export default function FamososImagenModal({ famosoId, nombre, edad, fechaOriginal, onClose }: FamososImagenModalProps) {
  const [imagen,   setImagen]   = useState<ImagenData | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/famosos/imagen?famosoId=${famosoId}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: ImagenData) => setImagen(d))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== 'AbortError') {
          setImagen({ fotoUrl: null, fotoFuente: null, fotoFechaCaptura: null, cache: false })
        }
      })
      .finally(() => setCargando(false))
    return () => ctrl.abort()
  }, [famosoId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">{nombre}</h2>
          <button onClick={onClose} aria-label="Cerrar modal" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="w-full aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            {cargando ? (
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            ) : imagen?.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagen.fotoUrl} alt={`Foto de ${nombre}`} className="w-full h-full object-cover object-top" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <User className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                <span className="text-3xl font-bold text-gray-300 dark:text-gray-600">{iniciales(nombre)}</span>
                <span className="text-xs text-gray-400 text-center px-4">Sin imagen en Wikipedia</span>
              </div>
            )}
          </div>
          <div className="space-y-0 text-sm">
            {[
              { label: 'Nombre',     valor: nombre },
              { label: 'Edad',       valor: edad !== null ? `${edad} anos` : '—' },
              { label: 'Nacimiento', valor: fechaOriginal },
            ].map(({ label, valor }) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">{label}</span>
                <span className="font-medium text-gray-800 dark:text-gray-100 text-right text-xs max-w-[180px] truncate">{valor}</span>
              </div>
            ))}
            {imagen?.fotoUrl && (
              <>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500 dark:text-gray-400">Fuente imagen</span>
                  <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(nombre)}`} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs">
                    {imagen.fotoFuente ?? 'Wikipedia'} <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-gray-500 dark:text-gray-400">Capturada el</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{formatFecha(imagen.fotoFechaCaptura)}</span>
                </div>
                {imagen.cache && (
                  <p className="text-xs text-center text-green-600 dark:text-green-400 pt-1">Imagen desde cache local</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
