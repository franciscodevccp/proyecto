'use client'

/**
 * FancySelect.tsx
 * Desplegable con diseño propio (no usa el <select> nativo): botón + panel de
 * opciones estilado, coherente con el design system (Tailwind, dark mode).
 * Soporta teclado (↑/↓/Enter/Esc), cierre al hacer click fuera y marca la opción
 * activa/seleccionada. Controlado por `value` + `options` + `onChange`.
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface OpcionSelect {
  value: string
  label: string
}

interface Props {
  value: string
  options: OpcionSelect[]
  onChange: (value: string) => void
  disabled?: boolean
  title?: string
  ariaLabel?: string
  /** Ancho del control (por defecto w-44). */
  className?: string
}

export function FancySelect({ value, options, onChange, disabled, title, ariaLabel, className }: Props) {
  const [open, setOpen] = useState(false)
  const [activo, setActivo] = useState(0) // índice resaltado por teclado/hover
  const rootRef = useRef<HTMLDivElement>(null)

  const seleccionada = options.find((o) => o.value === value) ?? options[0]

  // Cerrar al hacer click fuera del control.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  /** Abre el panel resaltando la opción actualmente seleccionada. */
  function abrir() {
    const i = options.findIndex((o) => o.value === value)
    setActivo(i < 0 ? 0 : i)
    setOpen(true)
  }

  function alternar() {
    if (disabled) return
    if (open) setOpen(false)
    else abrir()
  }

  function elegir(v: string) {
    onChange(v)
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        abrir()
      }
      return
    }
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => Math.min(options.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (options[activo]) elegir(options[activo].value) }
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? 'w-44 max-w-full'}`}>
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={alternar}
        onKeyDown={onKey}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 transition-colors hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="truncate">{seleccionada?.label}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full min-w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-1 shadow-lg shadow-black/10 dark:shadow-black/50"
        >
          {options.map((o, i) => {
            const sel = o.value === value
            const act = i === activo
            return (
              <li key={o.value} role="option" aria-selected={sel}>
                <button
                  type="button"
                  onMouseEnter={() => setActivo(i)}
                  onClick={() => elegir(o.value)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-sm text-left transition-colors
                    ${act ? 'bg-blue-50 dark:bg-blue-950/60' : ''}
                    ${sel ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-200'}`}
                >
                  <span className="truncate">{o.label}</span>
                  {sel && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
