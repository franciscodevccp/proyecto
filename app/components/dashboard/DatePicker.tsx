'use client'

/**
 * DatePicker.tsx
 * Selector de fecha con calendario de diseño propio (no usa el date picker
 * nativo). Botón con la fecha formateada (dd-mm-aaaa) + panel de calendario:
 * navegación de mes, grilla lunes→domingo y acciones "Borrar" / "Hoy".
 * Trabaja con cadenas ISO 'YYYY-MM-DD' ('' = sin fecha). Cualquier día es
 * seleccionable; `initialMonth` solo sugiere en qué mes abrir (ej. el dato más
 * reciente), para no arrancar en un mes lejano.
 */

import { useEffect, useRef, useState } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface Props {
  value: string // 'YYYY-MM-DD' o ''
  onChange: (value: string) => void // '' para limpiar
  /** Mes sugerido para abrir el calendario si no hay valor (ej. 'YYYY-MM-DD' del dato más reciente). */
  initialMonth?: string
  placeholder?: string
  className?: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const DIAS_SEMANA = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do']

const pad = (n: number) => String(n).padStart(2, '0')
/** Construye ISO 'YYYY-MM-DD' (m es 0-based). */
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

function parseISO(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null
}

export function DatePicker({ value, onChange, initialMonth, placeholder = 'dd-mm-aaaa', className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  const parsed = parseISO(value)
  const hoy = new Date()

  /** Mes inicial: el del valor; si no, el sugerido (initialMonth); si no, el actual. */
  function mesInicial(): { y: number; m: number } {
    if (parsed) return { y: parsed.y, m: parsed.m }
    const hint = initialMonth ? parseISO(initialMonth) : null
    if (hint) return { y: hint.y, m: hint.m }
    return { y: hoy.getFullYear(), m: hoy.getMonth() }
  }

  const [open, setOpen] = useState(false)
  const [vista, setVista] = useState<{ y: number; m: number }>(mesInicial)

  // Cerrar al hacer click fuera.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  /** Abre el calendario situándolo en el mes del valor (o el sugerido). */
  function abrir() {
    setVista(mesInicial())
    setOpen(true)
  }

  const display = parsed ? `${pad(parsed.d)}-${pad(parsed.m + 1)}-${parsed.y}` : ''

  // Grilla del mes: blancos de relleno + días (semana lunes→domingo).
  const offset = (new Date(vista.y, vista.m, 1).getDay() + 6) % 7
  const diasMes = new Date(vista.y, vista.m + 1, 0).getDate()
  const celdas: Array<number | null> = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: diasMes }, (_, i) => i + 1),
  ]

  function elegir(d: number) {
    onChange(iso(vista.y, vista.m, d))
    setOpen(false)
  }

  function irMes(delta: number) {
    const nd = new Date(vista.y, vista.m + delta, 1)
    setVista({ y: nd.getFullYear(), m: nd.getMonth() })
  }

  function hoyClick() {
    const t = new Date()
    onChange(iso(t.getFullYear(), t.getMonth(), t.getDate()))
    setOpen(false)
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? 'w-40'}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : abrir())}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-left transition-colors hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
      >
        <span className={display ? 'text-gray-700 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'}>
          {display || placeholder}
        </span>
        <CalendarIcon className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-lg shadow-black/10 dark:shadow-black/50">
          {/* Cabecera: mes/año + navegación */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => irMes(-1)}
              className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 capitalize">
              {MESES[vista.m]} {vista.y}
            </span>
            <button
              type="button"
              onClick={() => irMes(1)}
              className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Encabezado de días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-gray-400 dark:text-gray-500">{d}</div>
            ))}
          </div>

          {/* Grilla de días (cualquier día es seleccionable) */}
          <div className="grid grid-cols-7 gap-1">
            {celdas.map((d, i) => {
              if (d === null) return <div key={`b${i}`} />
              const sel = parsed && parsed.y === vista.y && parsed.m === vista.m && parsed.d === d
              const esHoy = hoy.getFullYear() === vista.y && hoy.getMonth() === vista.m && hoy.getDate() === d
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => elegir(d)}
                  className={`h-8 w-8 rounded-lg text-sm transition-colors
                    ${sel
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-950/60'}
                    ${!sel && esHoy ? 'ring-1 ring-blue-400' : ''}`}
                >
                  {d}
                </button>
              )
            })}
          </div>

          {/* Acciones */}
          <div className="mt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Borrar
            </button>
            <button
              type="button"
              onClick={hoyClick}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
