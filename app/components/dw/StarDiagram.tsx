'use client'

/**
 * StarDiagram.tsx
 * Diagrama estrella interactivo del Data Warehouse.
 *
 * - La tabla de hechos (FACT_NORMALIZACION) va al centro, destacada.
 * - Las 7 dimensiones se disponen en círculo (layout radial).
 * - Una capa SVG detrás dibuja las líneas de clave foránea (hecho → cada dimensión).
 * - Al hacer clic en una tabla se resalta su conexión y se muestra su detalle
 *   (columnas) en el panel inferior; al hacer clic en una columna se abre su
 *   ficha del diccionario de datos.
 *
 * El diagrama es plano (sin transformaciones 3D) para que las líneas SVG y las
 * tarjetas compartan el mismo sistema de coordenadas y queden siempre alineadas.
 *
 * Todo el contenido se lee de dw-model.ts (nada hardcodeado aquí).
 */

import { useState } from 'react'
import {
  Boxes, Calendar, Layers, Database, FileText, MapPin, Shuffle, CalendarDays,
  KeyRound, Link2, X,
} from 'lucide-react'
import {
  FACT_NORMALIZACION, DIMENSIONES,
  type Tabla, type Columna,
} from '../../lib/dw-model'

/** Icono representativo de cada tabla, por id. */
const ICONOS: Record<string, React.ComponentType<{ className?: string }>> = {
  fact_normalizacion: Boxes,
  dim_tiempo: Calendar,
  dim_modulo: Layers,
  dim_fuente: Database,
  dim_archivo: FileText,
  dim_ubicacion: MapPin,
  dim_tipo_cambio: Shuffle,
  dim_formato_fecha: CalendarDays,
}

/** Posición (en % del contenedor cuadrado) de cada dimensión en disposición radial. */
interface Posicion {
  id: string
  x: number
  y: number
}

/**
 * Calcula la posición polar de cada dimensión alrededor del centro (50,50).
 * La primera dimensión arranca arriba (-90°) y el resto se reparte en círculo.
 */
function calcularPosiciones(ids: string[], radio: number): Posicion[] {
  const n = ids.length
  return ids.map((id, i) => {
    const angulo = (-90 + (360 / n) * i) * (Math.PI / 180)
    return {
      id,
      x: 50 + radio * Math.cos(angulo),
      y: 50 + radio * Math.sin(angulo),
    }
  })
}

export function StarDiagram() {
  // Tabla seleccionada (hecho o dimensión). null = nada resaltado.
  const [tablaSel, setTablaSel] = useState<string | null>(null)
  // Columna seleccionada para mostrar su ficha de diccionario de datos.
  const [columnaSel, setColumnaSel] = useState<Columna | null>(null)

  const posiciones = calcularPosiciones(DIMENSIONES.map((d) => d.id), 38)
  const centro = { x: 50, y: 50 }

  /** ¿La tabla `id` está activa (resaltada) según la selección actual? */
  function estaActiva(id: string): boolean {
    if (tablaSel === null) return true // sin selección: todo a opacidad normal
    if (tablaSel === FACT_NORMALIZACION.id) return true // hecho seleccionado: todo activo
    return id === FACT_NORMALIZACION.id || id === tablaSel // dimensión: solo ella + el hecho
  }

  /** ¿La línea FK hacia la dimensión `dimId` está activa? */
  function lineaActiva(dimId: string): boolean {
    if (tablaSel === null) return false
    if (tablaSel === FACT_NORMALIZACION.id) return true
    return tablaSel === dimId
  }

  /** Tabla actualmente seleccionada (objeto completo) para el panel de detalle. */
  const tablaDetalle: Tabla | null =
    tablaSel === null
      ? null
      : tablaSel === FACT_NORMALIZACION.id
        ? FACT_NORMALIZACION
        : DIMENSIONES.find((d) => d.id === tablaSel) ?? null

  function seleccionarTabla(id: string) {
    setTablaSel((prev) => (prev === id ? null : id))
    setColumnaSel(null)
  }

  return (
    <div className="space-y-6">
      {/* ── Diagrama radial ── */}
      <div className="relative mx-auto w-full max-w-2xl" style={{ aspectRatio: '1 / 1' }}>
        {/* Halo suave detrás del hecho, para dar profundidad sin romper la alineación */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 rounded-full bg-blue-500/5 blur-3xl"
          aria-hidden="true"
        />

        {/* Capa SVG con las líneas FK (detrás de las tarjetas).
            Las líneas y las tarjetas comparten el mismo sistema de coordenadas
            (centro = 50,50; dimensiones en %), por eso quedan siempre alineadas. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full z-0"
          aria-hidden="true"
        >
          {posiciones.map((p) => {
            const activa = lineaActiva(p.id)
            return (
              <line
                key={p.id}
                x1={centro.x}
                y1={centro.y}
                x2={p.x}
                y2={p.y}
                stroke={activa ? '#3b82f6' : '#94a3b8'}
                strokeWidth={activa ? 1 : 0.5}
                strokeOpacity={tablaSel && !activa ? 0.2 : 0.65}
                vectorEffect="non-scaling-stroke"
                className="transition-all duration-300"
              />
            )
          })}
        </svg>

        {/* Tarjetas de dimensiones */}
        {DIMENSIONES.map((dim, i) => {
          const p = posiciones[i]
          return (
            <TablaCard
              key={dim.id}
              tabla={dim}
              x={p.x}
              y={p.y}
              activa={estaActiva(dim.id)}
              seleccionada={tablaSel === dim.id}
              onClick={() => seleccionarTabla(dim.id)}
            />
          )
        })}

        {/* Tarjeta de hechos (centro, destacada) */}
        <TablaCard
          tabla={FACT_NORMALIZACION}
          x={centro.x}
          y={centro.y}
          esHecho
          activa={estaActiva(FACT_NORMALIZACION.id)}
          seleccionada={tablaSel === FACT_NORMALIZACION.id}
          onClick={() => seleccionarTabla(FACT_NORMALIZACION.id)}
        />
      </div>

      {/* Leyenda / ayuda */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Haz clic en una tabla para ver sus columnas y conexiones · clic en una columna para su ficha
      </p>

      {/* ── Panel de detalle de la tabla seleccionada ── */}
      {tablaDetalle && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              tablaDetalle.tipo === 'hecho'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              {tablaDetalle.tipo === 'hecho' ? 'Tabla de hechos' : 'Dimensión'}
            </span>
            <h3 className="font-mono font-bold text-gray-900 dark:text-gray-100">{tablaDetalle.nombre}</h3>
            {tablaDetalle.conformada && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                conformada
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{tablaDetalle.descripcion}</p>
          {tablaDetalle.grano && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              <span className="font-semibold">Grano:</span> {tablaDetalle.grano}
            </p>
          )}

          {/* Columnas clickeables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {tablaDetalle.columnas.map((col) => (
              <button
                key={col.nombre}
                onClick={() => setColumnaSel(col)}
                className={`flex items-center gap-2 text-left px-3 py-1.5 rounded-lg border transition-colors ${
                  columnaSel?.nombre === col.nombre && tablaDetalle.columnas.includes(columnaSel)
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/40'
                    : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                {col.esPK
                  ? <KeyRound className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                  : col.esFK
                    ? <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    : <span className="w-3.5 shrink-0" />}
                <code className="text-xs font-mono text-gray-700 dark:text-gray-300">{col.nombre}</code>
                <span className="text-[10px] text-gray-400 ml-auto">{col.tipo}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Ficha de diccionario de datos de la columna ── */}
      {columnaSel && (
        <div className="bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <code className="font-mono font-bold text-blue-700 dark:text-blue-300">{columnaSel.nombre}</code>
              {columnaSel.esPK && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">PK</span>}
              {columnaSel.esFK && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">FK → {columnaSel.refTabla}</span>}
            </div>
            <button
              onClick={() => setColumnaSel(null)}
              className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              aria-label="Cerrar ficha"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <FichaFila etiqueta="Tipo" valor={columnaSel.tipo} mono />
            <FichaFila etiqueta="Nullable" valor={columnaSel.nullable ? 'Sí' : 'No'} />
            <FichaFila etiqueta="Descripción" valor={columnaSel.descripcion} span2 />
            <FichaFila etiqueta="Origen OLTP" valor={columnaSel.origenOLTP ?? '—'} span2 mono />
            {columnaSel.scd && columnaSel.scd !== 'N/A' && (
              <FichaFila etiqueta="SCD" valor={columnaSel.scd} />
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

/**
 * Una tarjeta de tabla posicionada en el diagrama radial.
 * El wrapper absoluto ancla la tarjeta en (x%, y%) — el mismo punto al que llega
 * su línea FK. El hover hace un scale centrado, sin mover ese ancla.
 */
function TablaCard({
  tabla, x, y, esHecho = false, activa, seleccionada, onClick,
}: {
  tabla: Tabla
  x: number
  y: number
  esHecho?: boolean
  activa: boolean
  seleccionada: boolean
  onClick: () => void
}) {
  const Icono = ICONOS[tabla.id] ?? Database
  return (
    <div
      className={`absolute ${esHecho ? 'z-20' : 'z-10'}`}
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <button
        onClick={onClick}
        className={`relative block rounded-xl border text-center transition-all duration-200 hover:scale-105
          ${esHecho
            ? 'bg-blue-600 border-blue-500 text-white px-4 py-3 shadow-xl shadow-blue-500/30'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 px-3 py-2 shadow-md hover:shadow-lg'}
          ${seleccionada ? 'ring-2 ring-blue-400' : ''}
          ${activa ? 'opacity-100' : 'opacity-30'}`}
        style={{ minWidth: esHecho ? '9rem' : '6.75rem' }}
      >
        <div className="flex items-center justify-center gap-1.5">
          <Icono className={esHecho ? 'w-4 h-4' : 'w-3.5 h-3.5 text-blue-600'} />
          <span className={`font-mono font-bold ${esHecho ? 'text-sm' : 'text-[11px] text-gray-800 dark:text-gray-200'}`}>
            {tabla.nombre}
          </span>
        </div>
        <span className={`block mt-0.5 ${esHecho ? 'text-[11px] text-blue-100' : 'text-[10px] text-gray-400'}`}>
          {esHecho ? tabla.grano : `${tabla.columnas.length} columnas`}
        </span>
      </button>
    </div>
  )
}

/** Una fila de la ficha de diccionario de datos. */
function FichaFila({
  etiqueta, valor, span2 = false, mono = false,
}: {
  etiqueta: string
  valor: string
  span2?: boolean
  mono?: boolean
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{etiqueta}</dt>
      <dd className={`text-gray-700 dark:text-gray-300 ${mono ? 'font-mono text-xs' : ''}`}>{valor}</dd>
    </div>
  )
}
