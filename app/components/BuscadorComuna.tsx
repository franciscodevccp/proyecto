'use client'

/**
 * BuscadorComuna.tsx
 * Campo de búsqueda con autocompletado de comunas chilenas.
 * Permite al usuario escribir el nombre de una comuna y ver sugerencias en tiempo real.
 * Cumple el requisito: "ingresar una comuna en un menú de búsqueda"
 */

import { useState, useRef, useEffect } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import { COMUNAS_OFICIALES } from '../lib/comunas-chile'
import type { ProcessResponse } from './FileUpload'

interface BuscadorComunaProps {
  onResult: (data: ProcessResponse) => void
}

function filtrarSugerencias(texto: string): string[] {
  const q = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  if (q.length < 2) return []
  return COMUNAS_OFICIALES
    .filter((c) =>
      c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q)
    )
    .slice(0, 6)
}

export default function BuscadorComuna({ onResult }: BuscadorComunaProps) {
  const [texto,       setTexto]       = useState('')
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [cargando,    setCargando]    = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [abierto,     setAbierto]     = useState(false)
  const inputRef    = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const resultado = filtrarSugerencias(texto)
    setSugerencias(resultado)
    setAbierto(resultado.length > 0 && texto.length >= 2)
  }, [texto])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function procesarComuna(nombreComuna: string) {
    setAbierto(false)
    setTexto(nombreComuna)
    setCargando(true)
    setError(null)
    try {
      const blob    = new Blob([nombreComuna], { type: 'text/plain' })
      const archivo = new File([blob], `busqueda_${nombreComuna}.txt`, { type: 'text/plain' })
      const form    = new FormData()
      form.append('file',        archivo)
      form.append('columnIndex', '0')
      form.append('correct',     'false')
      form.append('dryRun',      'false')
      form.append('rules', JSON.stringify({
        trim: true, collapseSpaces: true, removeAccents: true,
        titleCase: true, deduplicate: true, fuzzyCorrect: false, removeEmpty: true,
      }))
      const res = await fetch('/api/process', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        throw new Error(err.error ?? 'Error al procesar')
      }
      const data = await res.json() as ProcessResponse
      onResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        O busca directamente una comuna:
      </p>
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onFocus={() => texto.length >= 2 && setAbierto(true)}
            placeholder='Ej: "florida", "san", "concepcion"...'
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
            disabled={cargando}
            aria-label="Buscar comuna de Chile"
            aria-autocomplete="list"
            aria-expanded={abierto}
          />
          {cargando ? (
            <Loader2 className="absolute right-3 w-4 h-4 text-blue-500 animate-spin" />
          ) : texto && (
            <button
              onClick={() => { setTexto(''); setSugerencias([]); setAbierto(false) }}
              aria-label="Limpiar busqueda"
              className="absolute right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {abierto && sugerencias.length > 0 && (
          <div
            ref={dropdownRef}
            role="listbox"
            className="absolute top-full mt-1 left-0 right-0 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
          >
            {sugerencias.map((comunaNombre) => {
              const q      = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
              const lower  = comunaNombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
              const idx    = lower.indexOf(q)
              const antes  = comunaNombre.slice(0, idx)
              const match  = comunaNombre.slice(idx, idx + texto.length)
              const despues = comunaNombre.slice(idx + texto.length)
              return (
                <button
                  key={comunaNombre}
                  role="option"
                  onClick={() => procesarComuna(comunaNombre)}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {antes}
                    <strong className="text-blue-600 dark:text-blue-400">{match}</strong>
                    {despues}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
