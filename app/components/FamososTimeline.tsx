'use client'

/**
 * FamososTimeline.tsx
 * Línea de tiempo horizontal que ordena los famosos por fecha de nacimiento,
 * del más antiguo al más reciente (soporta fechas a.C. con años negativos).
 * Solo incluye famosos con fechaNormalizada — demuestra que la normalización funcionó.
 *
 * Cada tarjeta muestra:
 *   año (etiqueta del eje)
 *   nombre del famoso
 *   fechaOriginal (entrada del usuario, en gris)
 *   → fechaNormalizada (salida ISO del sistema, en púrpura)
 *
 * Las tarjetas alternan arriba/abajo de la línea para evitar solapamiento.
 * El contenedor es horizontalmente scrollable.
 */

import { useEffect, useState } from 'react'
import { Clock3, Loader2 } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FamosoRaw {
  id: string
  nombre: string
  fechaOriginal: string
  fechaNormalizada: string | null
}

interface BatchAPIResponse {
  batch: { famosos: FamosoRaw[] }
}

interface FamosoCronologico {
  id: string
  nombre: string
  fechaOriginal: string
  fechaNormalizada: string
  anio: number
}

interface FamososTimelineProps {
  batchId: string
}

// ─── Constantes de layout ─────────────────────────────────────────────────────

/** Ancho de cada celda de la timeline (px) */
const ITEM_W = 156

/** Altura total del contenedor SVG (px) */
const H = 290

/** Y de la línea horizontal en el contenedor (px desde arriba) */
const LINE_Y = 140

/** Longitud del conector vertical entre la línea y la tarjeta (px) */
const CONN = 44

/** Altura máxima de cada tarjeta (px) */
const CARD_H = 96

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extrae el año numérico de una fecha ISO (soporta a.C.: "-0069-02-17" → -69) */
function extractAnio(fecha: string): number {
  if (fecha.startsWith('-')) {
    return -parseInt(fecha.slice(1).split('-')[0], 10)
  }
  return parseInt(fecha.split('-')[0], 10)
}

/** Formatea el año para mostrar en el eje ("69 a.C." | "1879") */
function formatAnio(anio: number): string {
  return anio < 0 ? `${Math.abs(anio)} a.C.` : String(anio)
}

/**
 * Formatea la fecha normalizada abreviada para la tarjeta.
 * Fechas a.C. → solo el año; fechas d.C. → YYYY-MM-DD
 */
function formatFechaNorm(fecha: string): string {
  if (fecha.startsWith('-')) {
    const anio = parseInt(fecha.slice(1).split('-')[0], 10)
    return `${anio} a.C.`
  }
  // Mostrar los primeros 10 chars (YYYY-MM-DD)
  return fecha.substring(0, 10)
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FamososTimeline({ batchId }: FamososTimelineProps) {
  const [items, setItems] = useState<FamosoCronologico[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    setCargando(true)
    fetch(`/api/famosos/batch?id=${batchId}`)
      .then((r) => r.json())
      .then((d: BatchAPIResponse) => {
        const famosos: FamosoRaw[] = d.batch?.famosos ?? []
        const cronologicos: FamosoCronologico[] = famosos
          .filter((f): f is FamosoRaw & { fechaNormalizada: string } =>
            f.fechaNormalizada !== null && f.fechaNormalizada.length > 0,
          )
          .map((f) => ({
            id: f.id,
            nombre: f.nombre,
            fechaOriginal: f.fechaOriginal,
            fechaNormalizada: f.fechaNormalizada,
            anio: extractAnio(f.fechaNormalizada),
          }))
          .sort((a, b) => a.anio - b.anio)

        setItems(cronologicos)
      })
      .catch(() => setItems([]))
      .finally(() => setCargando(false))
  }, [batchId])

  // ── Cargando ──────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-24 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">Cargando timeline…</span>
      </div>
    )
  }

  // ── Sin datos normalizados ────────────────────────────────────────────────
  if (items.length === 0) return null

  const totalW = ITEM_W * items.length + 40

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Linea de tiempo
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {items.length} famoso{items.length !== 1 ? 's' : ''} ordenados
          {' '}· {formatAnio(items[0].anio)} → {formatAnio(items[items.length - 1].anio)}
        </span>
      </div>

      {/* Timeline scrollable */}
      <div className="overflow-x-auto overscroll-x-contain">
        <div
          className="relative"
          style={{ width: totalW, height: H, minWidth: totalW }}
        >
          {/* Línea horizontal central */}
          <div
            className="absolute bg-purple-200 dark:bg-purple-900/60"
            style={{ top: LINE_Y - 1, left: 20, width: totalW - 40, height: 2 }}
          />

          {/* Extremos de la línea */}
          <div
            className="absolute w-2 h-2 rounded-full bg-purple-300 dark:bg-purple-700"
            style={{ top: LINE_Y - 5, left: 16 }}
          />
          <div
            className="absolute w-2 h-2 rounded-full bg-purple-300 dark:bg-purple-700"
            style={{ top: LINE_Y - 5, left: totalW - 24 }}
          />

          {items.map((item, idx) => {
            /** Centro X de este item */
            const cx = 20 + idx * ITEM_W + ITEM_W / 2
            /** Tarjeta arriba (odd) o abajo (even) */
            const esArriba = idx % 2 === 1

            // Posiciones para tarjeta arriba
            const cardTopArriba = LINE_Y - CONN - CARD_H
            const connTopArriba = LINE_Y - CONN

            // Posiciones para tarjeta abajo
            const connTopAbajo = LINE_Y + 6
            const cardTopAbajo = LINE_Y + CONN + 6

            return (
              <div key={item.id}>
                {/* Punto en la línea */}
                <div
                  className="absolute rounded-full bg-purple-500 border-2 border-white dark:border-gray-900 shadow-sm"
                  style={{
                    width: 12,
                    height: 12,
                    left: cx - 6,
                    top: LINE_Y - 6,
                    zIndex: 1,
                  }}
                />

                {/* Conector vertical */}
                <div
                  className="absolute bg-purple-300 dark:bg-purple-700"
                  style={{
                    width: 1.5,
                    height: CONN,
                    left: cx - 0.75,
                    top: esArriba ? connTopArriba : connTopAbajo,
                  }}
                />

                {/* Tarjeta */}
                <div
                  className="absolute"
                  style={{
                    left: cx - ITEM_W / 2 + 8,
                    width: ITEM_W - 16,
                    top: esArriba ? cardTopArriba : cardTopAbajo,
                    height: CARD_H,
                  }}
                >
                  <div className="h-full rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm px-2.5 py-2 flex flex-col justify-center gap-0.5 overflow-hidden">
                    {/* Año */}
                    <p className="text-xs font-black text-purple-600 dark:text-purple-400 leading-none">
                      {formatAnio(item.anio)}
                    </p>

                    {/* Nombre */}
                    <p
                      className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight"
                      title={item.nombre}
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {item.nombre}
                    </p>

                    {/* Entrada original (gris, tachado conceptual) */}
                    <p
                      className="text-gray-400 dark:text-gray-500 font-mono leading-none truncate"
                      style={{ fontSize: 9 }}
                      title={item.fechaOriginal}
                    >
                      {item.fechaOriginal}
                    </p>

                    {/* Flecha + fecha normalizada */}
                    <p
                      className="text-purple-500 dark:text-purple-400 font-mono font-medium leading-none truncate"
                      style={{ fontSize: 9 }}
                    >
                      → {formatFechaNorm(item.fechaNormalizada)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Leyenda + hint de scroll */}
      <div className="px-4 sm:px-6 pb-3 pt-1 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            Entrada original
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
            Fecha normalizada ISO
          </span>
        </div>
        {items.length > 5 && (
          <p className="text-xs text-gray-300 dark:text-gray-600 italic">
            ← desliza para ver todos →
          </p>
        )}
      </div>
    </div>
  )
}
