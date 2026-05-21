'use client'

/**
 * FamososTimeline.tsx
 * Línea de tiempo horizontal que ordena los famosos por fecha de nacimiento.
 *
 * CORRECCIÓN CRÍTICA: fechaNormalizada tiene formato DD-MM-YYYY.
 * El año está en el índice 2 de split('-'), NO en el índice 0.
 * Ejemplo: "14-03-1879" → partes[2] = "1879" (Einstein)
 *
 * Enriquecimiento progresivo con Wikipedia REST API (gratuita, sin clave):
 *   GET https://en.wikipedia.org/api/rest_v1/page/summary/{nombre}
 *   → description (string corta) + thumbnail.source (URL de foto)
 * Las tarjetas muestran skeleton mientras carga y gradiente de era si no hay foto.
 */

import { useEffect, useState, useRef } from 'react'
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

interface WikiInfo {
  descripcion: string | null
  foto: string | null
}

/** Subconjunto de la respuesta de Wikipedia que nos interesa */
interface WikiResponse {
  description?: string
  thumbnail?: { source?: string }
}

interface FamososTimelineProps {
  batchId: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Ancho de cada tarjeta (px) */
const CARD_W = 210

/** Espacio entre tarjetas (px) */
const GAP = 16

/** Altura de la foto en cada tarjeta (px) */
const FOTO_H = 120

/** Tamaño del lote para las peticiones a Wikipedia */
const WIKI_LOTE = 8

/**
 * Cantidad máxima de items mostrados en el timeline.
 * Con archivos muy grandes el scroll horizontal se vuelve inusable y
 * las peticiones masivas a Wikipedia degeneran la experiencia.
 * Se toman los primeros MAX_TIMELINE_ITEMS ordenados cronológicamente
 * (los más antiguos) para que la línea de tiempo sea siempre coherente.
 */
const MAX_TIMELINE_ITEMS = 50

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrae el año numérico de una fecha DD-MM-YYYY.
 * El año está siempre en la posición 2 del array resultante de split('-').
 * Ejemplo: "01-06-1926" → 1926
 */
function extractAnio(fecha: string): number {
  const partes = fecha.split('-')
  return parseInt(partes[2], 10)
}

/** Etiqueta de año para el eje (soporta a.C. aunque en la práctica no llegan aquí) */
function formatAnio(anio: number): string {
  return anio < 0 ? `${Math.abs(anio)} a.C.` : String(anio)
}

/** Convierte DD-MM-YYYY → DD/MM/YYYY para la tarjeta */
function formatFechaNorm(fecha: string): string {
  return fecha.replace(/-/g, '/')
}

/**
 * Gradiente de fondo según la era del personaje.
 * Se muestra cuando Wikipedia no devuelve foto.
 */
function eraGradient(anio: number): string {
  if (anio < 1700) return 'linear-gradient(160deg,#4c1d95 0%,#6d28d9 100%)'
  if (anio < 1800) return 'linear-gradient(160deg,#164e63 0%,#0891b2 100%)'
  if (anio < 1900) return 'linear-gradient(160deg,#14532d 0%,#16a34a 100%)'
  if (anio < 1950) return 'linear-gradient(160deg,#78350f 0%,#d97706 100%)'
  return 'linear-gradient(160deg,#9d174d 0%,#ec4899 100%)'
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FamososTimeline({ batchId }: FamososTimelineProps) {
  const [items, setItems] = useState<FamosoCronologico[]>([])
  const [cargando, setCargando] = useState(true)

  /**
   * Mapa de enriquecimiento Wikipedia:
   *   undefined → todavía no cargado (skeleton)
   *   null      → Wikipedia no encontró el personaje
   *   WikiInfo  → datos disponibles
   */
  const [wiki, setWiki] = useState<Map<string, WikiInfo | null>>(new Map())

  /** Evita que el efecto de Wikipedia se dispare dos veces en Strict Mode */
  const wikiEnCurso = useRef(false)

  // ── Carga del batch ────────────────────────────────────────────────────────
  useEffect(() => {
    setCargando(true)
    wikiEnCurso.current = false
    setWiki(new Map())

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
          .slice(0, MAX_TIMELINE_ITEMS)

        setItems(cronologicos)
      })
      .catch(() => setItems([]))
      .finally(() => setCargando(false))
  }, [batchId])

  // ── Enriquecimiento Wikipedia (lotes de WIKI_LOTE) ────────────────────────
  useEffect(() => {
    if (items.length === 0 || wikiEnCurso.current) return
    wikiEnCurso.current = true

    async function cargarWiki() {
      for (let i = 0; i < items.length; i += WIKI_LOTE) {
        const lote = items.slice(i, i + WIKI_LOTE)
        await Promise.all(
          lote.map(async (item) => {
            try {
              const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.nombre)}`
              const res = await fetch(url)
              if (!res.ok) {
                setWiki((prev) => new Map(prev).set(item.id, null))
                return
              }
              const data = (await res.json()) as WikiResponse
              setWiki((prev) =>
                new Map(prev).set(item.id, {
                  descripcion: data.description ?? null,
                  foto: data.thumbnail?.source ?? null,
                }),
              )
            } catch {
              setWiki((prev) => new Map(prev).set(item.id, null))
            }
          }),
        )
      }
    }

    cargarWiki()
  }, [items])

  // ── Estado: cargando ───────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-24 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">Cargando timeline…</span>
      </div>
    )
  }

  // ── Sin datos normalizados ─────────────────────────────────────────────────
  if (items.length === 0) return null

  /**
   * Ancho total del contenedor scrollable.
   * Cada tarjeta ocupa CARD_W + GAP; más un GAP inicial al final.
   */
  const totalW = (CARD_W + GAP) * items.length + GAP

  /**
   * Indica si el timeline fue recortado al máximo de items permitido.
   * Se usa en la cabecera para informar al usuario.
   */
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
          {/* Badge cuando el timeline está recortado al máximo */}
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
      {/* Scrollbar personalizada — reemplaza la barra gris del sistema */}
      <style>{`
        .tl-scroll::-webkit-scrollbar { height: 5px; }
        .tl-scroll::-webkit-scrollbar-track { background: transparent; margin: 0 20px; border-radius: 999px; }
        .tl-scroll::-webkit-scrollbar-thumb { background: #a855f7; border-radius: 999px; }
        .tl-scroll::-webkit-scrollbar-thumb:hover { background: #7c3aed; }
      `}</style>
      <div className="tl-scroll overflow-x-auto overscroll-x-contain pb-1">
        <div
          className="relative"
          style={{ width: totalW, minWidth: totalW }}
        >
          {/*
           * Línea horizontal central.
           * pt-4 = 16px → el dot (h-5 = 20px) queda centrado a y = 16 + 10 = 26px
           * La línea de 2px se sitúa en top = 25px para alinearse con el centro del dot.
           * Se extiende desde el centro de la primera tarjeta hasta el de la última.
           */}
          <div
            className="absolute z-0 rounded-full"
            style={{
              top: 25,
              left: GAP + CARD_W / 2,
              width: totalW - GAP - CARD_W,
              height: 2,
              background: 'linear-gradient(90deg,#a855f7 0%,#7c3aed 50%,#6366f1 100%)',
            }}
          />

          {/* Fila de tarjetas ──────────────────────────────────────────── */}
          <div
            className="flex pt-4 pb-5"
            style={{ gap: GAP, paddingLeft: GAP, paddingRight: GAP }}
          >
            {items.map((item, idx) => {
              /** undefined = cargando · null = no encontrado · WikiInfo = disponible */
              const wikiData = wiki.get(item.id)
              const esCargandoWiki = wikiData === undefined

              return (
                <div
                  key={item.id}
                  className="shrink-0 flex flex-col"
                  style={{ width: CARD_W }}
                >
                  {/* Punto numerado sobre la línea ─────────────────────── */}
                  <div className="flex justify-center mb-3 relative z-10">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-md"
                      style={{ background: '#7c3aed' }}
                    >
                      <span
                        className="text-white font-black leading-none select-none"
                        style={{ fontSize: 8 }}
                      >
                        {idx + 1}
                      </span>
                    </div>
                  </div>

                  {/* Tarjeta — enlace a Wikipedia en pestaña nueva */}
                  <a
                    href={`https://en.wikipedia.org/wiki/${encodeURIComponent(item.nombre)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col bg-white dark:bg-gray-800 flex-1 transition-all duration-200 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-600 hover:-translate-y-1 cursor-pointer"
                    title={`Ver ${item.nombre} en Wikipedia`}
                  >

                    {/* Cabecera visual: foto o gradiente de era */}
                    <div className="relative w-full overflow-hidden" style={{ height: FOTO_H }}>
                      {esCargandoWiki ? (
                        // Skeleton mientras carga Wikipedia
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      ) : wikiData?.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={wikiData.foto}
                          alt={item.nombre}
                          className="w-full h-full object-cover object-top"
                          loading="lazy"
                          onError={(e) => {
                            // Si la imagen falla, mostrar el gradiente de era
                            const parent = e.currentTarget.parentElement
                            if (parent) {
                              parent.style.background = eraGradient(item.anio)
                              e.currentTarget.style.display = 'none'
                            }
                          }}
                        />
                      ) : (
                        // Gradiente de era cuando Wikipedia no tiene foto
                        <div
                          className="w-full h-full"
                          style={{ background: eraGradient(item.anio) }}
                        />
                      )}

                      {/* Badge del año superpuesto */}
                      <span
                        className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded font-black text-white leading-none"
                        style={{
                          background: 'rgba(0,0,0,0.58)',
                          fontSize: 10,
                          backdropFilter: 'blur(2px)',
                        }}
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
                      {esCargandoWiki ? (
                        <div className="space-y-1 mt-0.5">
                          <div className="h-1.5 rounded bg-gray-200 dark:bg-gray-600 animate-pulse w-full" />
                          <div className="h-1.5 rounded bg-gray-200 dark:bg-gray-600 animate-pulse w-2/3" />
                        </div>
                      ) : wikiData?.descripcion ? (
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

                      {/* Prueba de normalización (siempre al fondo) */}
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
