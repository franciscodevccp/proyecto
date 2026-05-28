'use client'

/**
 * FamososTimeline.tsx
 * Línea de tiempo horizontal que ordena los famosos por fecha de nacimiento.
 *
 * CORRECCIÓN CRÍTICA: fechaNormalizada tiene formato DD-MM-YYYY.
 * El año está en el índice 2 de split('-'), NO en el índice 0.
 * Ejemplo: "14-03-1879" → partes[2] = "1879" (Einstein)
 *
 * Enriquecimiento con Wikipedia a través del proxy /api/wiki (servidor).
 * El proxy cachea las respuestas 1 hora para que recargar el mismo batch
 * sea instantáneo y no golpee la API externa.
 *
 * OPTIMIZACIÓN: los datos llegan como prop desde famosos/page.tsx,
 * que centraliza el único fetch a /api/famosos/batch.
 */

import { useEffect, useState, useMemo } from 'react'
import { Clock3, Loader2 } from 'lucide-react'
import type { FamosoRaw } from './FamososBirthdayBanner'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface FamosoCronologico {
  id: string
  nombre: string
  fechaOriginal: string
  fechaNormalizada: string
  anio: number
}

interface WikiInfo {
  descripcion: string | null
  foto: string | null
}

interface FamososTimelineProps {
  /**
   * Lista de famosos del batch activo.
   * null indica que los datos aún se están cargando → se muestra el skeleton.
   */
  famosos: FamosoRaw[] | null
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Ancho de cada tarjeta (px) */
const CARD_W = 210

/** Espacio entre tarjetas (px) */
const GAP = 16

/** Altura de la foto en cada tarjeta (px) */
const FOTO_H = 120

/**
 * Cantidad máxima de items mostrados en el timeline.
 * Se toman los primeros MAX ordenados cronológicamente.
 */
const MAX_TIMELINE_ITEMS = 50

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrae el año numérico de una fecha DD-MM-YYYY.
 * El año está siempre en la posición 2 del array resultante de split('-').
 */
function extractAnio(fecha: string): number {
  const partes = fecha.split('-')
  return parseInt(partes[2], 10)
}

/** Etiqueta de año para el eje */
function formatAnio(anio: number): string {
  return anio < 0 ? `${Math.abs(anio)} a.C.` : String(anio)
}

/** Convierte DD-MM-YYYY → DD/MM/YYYY para mostrar en la tarjeta */
function formatFechaNorm(fecha: string): string {
  return fecha.replace(/-/g, '/')
}

/**
 * Gradiente de fondo según la era del personaje.
 * Se muestra cuando el proxy no devuelve foto.
 */
function eraGradient(anio: number): string {
  if (anio < 1700) return 'linear-gradient(160deg,#4c1d95 0%,#6d28d9 100%)'
  if (anio < 1800) return 'linear-gradient(160deg,#164e63 0%,#0891b2 100%)'
  if (anio < 1900) return 'linear-gradient(160deg,#14532d 0%,#16a34a 100%)'
  if (anio < 1950) return 'linear-gradient(160deg,#78350f 0%,#d97706 100%)'
  return 'linear-gradient(160deg,#9d174d 0%,#ec4899 100%)'
}

/** Respuesta del endpoint POST /api/wiki */
interface WikiBatchResponse {
  resultados: Record<string, WikiInfo>
}

/**
 * Carga los datos de Wikipedia para TODOS los items en UNA sola petición POST.
 *
 * El proxy /api/wiki usa la MediaWiki Action API que acepta hasta 50 títulos
 * por petición, eliminando el rate-limiting (HTTP 429) que aparecía al hacer
 * una petición por persona. Los redirects (ej: "Mozart" → "Wolfgang Amadeus
 * Mozart") se resuelven en el servidor de forma genérica para cualquier nombre.
 *
 * @param items  - Items a enriquecer
 * @param signal - AbortSignal para cancelar si el componente se desmonta
 * @returns Mapa id → WikiInfo
 */
async function fetchWikiBatch(
  items: FamosoCronologico[],
  signal: AbortSignal,
): Promise<Map<string, WikiInfo>> {
  const resultado = new Map<string, WikiInfo>()
  try {
    const res = await fetch('/api/wiki', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nombres: items.map((i) => i.nombre) }),
      signal,
    })
    if (!res.ok) {
      items.forEach((i) => resultado.set(i.id, { descripcion: null, foto: null }))
      return resultado
    }
    const data = (await res.json()) as WikiBatchResponse
    // Mapear cada item por su id usando el nombre como clave de la respuesta
    items.forEach((item) => {
      resultado.set(item.id, data.resultados[item.nombre] ?? { descripcion: null, foto: null })
    })
  } catch {
    // Error de red o abort — marcar todos como sin datos (muestra gradiente de era)
    items.forEach((i) => resultado.set(i.id, { descripcion: null, foto: null }))
  }
  return resultado
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FamososTimeline({ famosos }: FamososTimelineProps) {
  /**
   * Mapa de enriquecimiento Wikipedia:
   *   undefined → todavía no cargado (skeleton)
   *   WikiInfo  → datos disponibles (foto/descripcion pueden ser null)
   */
  const [wiki, setWiki] = useState<Map<string, WikiInfo>>(new Map())

  // ── Derivar items desde el prop ────────────────────────────────────────────
  const items = useMemo<FamosoCronologico[]>(() => {
    if (famosos === null) return []
    return famosos
      .filter((f): f is FamosoRaw & { fechaNormalizada: string } =>
        f.fechaNormalizada !== null && f.fechaNormalizada.length > 0,
      )
      .map((f) => ({
        id:               f.id,
        nombre:           f.nombre,
        fechaOriginal:    f.fechaOriginal,
        fechaNormalizada: f.fechaNormalizada,
        anio:             extractAnio(f.fechaNormalizada),
      }))
      .sort((a, b) => a.anio - b.anio)
      .slice(0, MAX_TIMELINE_ITEMS)
  }, [famosos])

  // ── Enriquecimiento Wikipedia ──────────────────────────────────────────────
  useEffect(() => {
    // Limpiar wiki anterior cuando llegan datos nuevos o cuando no hay items
    setWiki(new Map())
    if (items.length === 0) return

    const controller = new AbortController()

    async function cargarWiki() {
      // Una sola petición POST trae las 50 personas de golpe (sin rate-limiting)
      const datos = await fetchWikiBatch(items, controller.signal)
      if (controller.signal.aborted) return
      setWiki(datos)
    }

    cargarWiki()
    return () => controller.abort()
  }, [items])

  // ── Estado: cargando ───────────────────────────────────────────────────────
  if (famosos === null) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-24 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">Cargando timeline…</span>
      </div>
    )
  }

  // ── Sin datos normalizados ─────────────────────────────────────────────────
  if (items.length === 0) return null

  const totalW  = (CARD_W + GAP) * items.length + GAP
  const recortado = items.length === MAX_TIMELINE_ITEMS

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

      {/* Cabecera ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Clock3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Línea de tiempo
          </span>
          {recortado && (
            <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
              primeros {MAX_TIMELINE_ITEMS}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">
          {items.length} famoso{items.length !== 1 ? 's' : ''} ordenados
          {' · '}
          {formatAnio(items[0].anio)} → {formatAnio(items[items.length - 1].anio)}
        </span>
      </div>

      {/* Scroll horizontal ────────────────────────────────────────────────── */}
      <style>{`
        .tl-scroll::-webkit-scrollbar { height: 5px; }
        .tl-scroll::-webkit-scrollbar-track { background: transparent; margin: 0 20px; border-radius: 999px; }
        .tl-scroll::-webkit-scrollbar-thumb { background: #a855f7; border-radius: 999px; }
        .tl-scroll::-webkit-scrollbar-thumb:hover { background: #7c3aed; }
      `}</style>
      <div className="tl-scroll overflow-x-auto overscroll-x-contain pb-1">
        <div className="relative" style={{ width: totalW, minWidth: totalW }}>

          {/* Línea horizontal del eje temporal */}
          <div
            className="absolute z-0 rounded-full"
            style={{
              top:        25,
              left:       GAP + CARD_W / 2,
              width:      totalW - GAP - CARD_W,
              height:     2,
              background: 'linear-gradient(90deg,#a855f7 0%,#7c3aed 50%,#6366f1 100%)',
            }}
          />

          {/* Fila de tarjetas ────────────────────────────────────────────── */}
          <div
            className="flex pt-4 pb-5"
            style={{ gap: GAP, paddingLeft: GAP, paddingRight: GAP }}
          >
            {items.map((item, idx) => {
              const wikiData = wiki.get(item.id)
              /** true mientras no llegó la respuesta del proxy */
              const esCargando = wikiData === undefined

              return (
                <div key={item.id} className="shrink-0 flex flex-col" style={{ width: CARD_W }}>

                  {/* Punto numerado sobre la línea ─────────────────────── */}
                  <div className="flex justify-center mb-3 relative z-10">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-md"
                      style={{ background: '#7c3aed' }}
                    >
                      <span className="text-white font-black leading-none select-none" style={{ fontSize: 8 }}>
                        {idx + 1}
                      </span>
                    </div>
                  </div>

                  {/* Tarjeta — enlace a Wikipedia */}
                  <a
                    href={`https://en.wikipedia.org/wiki/${encodeURIComponent(item.nombre)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col bg-white dark:bg-gray-800 flex-1 transition-all duration-200 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-600 hover:-translate-y-1"
                    aria-label={`Ver ${item.nombre} en Wikipedia`}
                  >

                    {/* Cabecera visual: skeleton → foto → gradiente de era */}
                    <div className="relative w-full overflow-hidden" style={{ height: FOTO_H }}>
                      {esCargando ? (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      ) : wikiData.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={wikiData.foto}
                          alt={item.nombre}
                          className="w-full h-full object-cover object-top"
                          loading="lazy"
                          onError={(e) => {
                            // Si la imagen externa falla, mostrar el gradiente de era
                            const parent = e.currentTarget.parentElement
                            if (parent) {
                              parent.style.background = eraGradient(item.anio)
                              e.currentTarget.style.display = 'none'
                            }
                          }}
                        />
                      ) : (
                        <div className="w-full h-full" style={{ background: eraGradient(item.anio) }} />
                      )}

                      {/* Badge del año superpuesto */}
                      <span
                        className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded font-black text-white leading-none"
                        style={{ background: 'rgba(0,0,0,0.58)', fontSize: 10, backdropFilter: 'blur(2px)' }}
                      >
                        {formatAnio(item.anio)}
                      </span>
                    </div>

                    {/* Cuerpo de texto ─────────────────────────────────── */}
                    <div className="flex-1 flex flex-col gap-1 px-2.5 pt-2 pb-2">

                      {/* Nombre */}
                      <p
                        className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight"
                        title={item.nombre}
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.nombre}
                      </p>

                      {/* Descripción de Wikipedia */}
                      {esCargando ? (
                        <div className="space-y-1 mt-0.5">
                          <div className="h-1.5 rounded bg-gray-200 dark:bg-gray-600 animate-pulse w-full" />
                          <div className="h-1.5 rounded bg-gray-200 dark:bg-gray-600 animate-pulse w-2/3" />
                        </div>
                      ) : wikiData.descripcion ? (
                        <p
                          className="text-gray-500 dark:text-gray-400 leading-snug"
                          title={wikiData.descripcion}
                          style={{
                            fontSize: 9,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {wikiData.descripcion}
                        </p>
                      ) : null}

                      {/* Fechas (siempre al fondo) */}
                      <div className="mt-auto pt-1.5 border-t border-gray-100 dark:border-gray-700">
                        <p
                          className="font-mono text-gray-400 dark:text-gray-500 truncate"
                          style={{ fontSize: 8 }}
                          title={item.fechaOriginal}
                        >
                          {item.fechaOriginal}
                        </p>
                        <p
                          className="font-mono font-semibold text-purple-500 dark:text-purple-400 truncate"
                          style={{ fontSize: 8 }}
                        >
                          → {formatFechaNorm(item.fechaNormalizada)}
                        </p>
                      </div>
                    </div>
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Leyenda inferior ─────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-gray-400 mt-2">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
            Fecha original
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
            Normalizada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
            Wikipedia
          </span>
        </div>
        {items.length > 4 && (
          <p className="text-xs text-gray-300 dark:text-gray-600 italic mt-2">← desliza →</p>
        )}
      </div>
    </div>
  )
}
