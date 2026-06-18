'use client'

/**
 * datawarehouse/page.tsx
 * Página interactiva del Data Warehouse (Evaluación 3 — modelado dimensional).
 *
 * Presenta en una sola vista los 5 entregables de la rúbrica + los extras
 * (Niveles 1-3). Todo el contenido se renderiza desde app/lib/dw-model.ts;
 * aquí no hay datos hardcodeados, solo la composición visual.
 *
 * Sigue el design system del proyecto: header con breadcrumb, dark mode
 * (useDarkMode), Tailwind, lucide-react y el componente CodeBlock para el SQL.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Database, Boxes, ArrowLeft, Sun, Moon, CheckCircle2, Network, Table2,
  Snowflake, Star, ArrowRight, GitBranch, Layers, Shuffle,
} from 'lucide-react'
import { useDarkMode } from '../hooks/useDarkMode'
import { APP_VERSION } from '../lib/version'
import { CodeBlock } from '../components/CodeBlock'
import { StarDiagram } from '../components/dw/StarDiagram'
import {
  DECLARACION_DATASET, DIMENSIONES, MATRIZ_BUS, LINAJE, CRUCES, CONSULTAS_OLAP,
  FUENTES_SCD2, FACT_NORMALIZACION, FACT_CALIDAD_DIARIA, DIMENSIONES_CONFORMADAS,
  DIM_UBICACION, COPO_UBICACION, TRADEOFF_ESQUEMA,
  type OperacionId,
} from '../lib/dw-model'

/** Los 5 entregables de la rúbrica, con el ancla a su sección en la página. */
const ENTREGABLES = [
  { texto: 'Diagrama dimensional (estrella / copo de nieve)', ancla: 'diagrama' },
  { texto: 'Identificación de la tabla de hechos', ancla: 'diagrama' },
  { texto: 'Al menos 7 dimensiones', ancla: 'diagrama' },
  { texto: 'Cruce de datos (≥ 3 datos nuevos)', ancla: 'cruces' },
  { texto: 'Consulta multidimensional (SQL / lenguaje natural)', ancla: 'olap' },
]

export default function DataWarehousePage() {
  const [isDark, toggleDark] = useDarkMode()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* ── Header ── */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Volver al inicio"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-gray-900 dark:text-gray-100">COMUNAS_NORM</span>
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Warehouse</span>
            </div>
          </div>
          <button
            onClick={toggleDark}
            aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark
              ? <Sun className="w-4 h-4 text-yellow-400" aria-hidden="true" />
              : <Moon className="w-4 h-4 text-gray-500" aria-hidden="true" />}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">

        {/* ── Intro + checklist de entregables ── */}
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              Modelo del Data Warehouse
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed">
              Esquema estrella derivado del sistema operacional real (Next.js + Prisma + PostgreSQL).
              El hecho no es una comuna ni un famoso: es el <strong>evento de normalización</strong>.
              Cada registro que pasa por el pipeline ETL es una fila de la tabla de hechos.
            </p>
          </div>

          {/* Declaración obligatoria del dataset */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
            <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200 italic">{DECLARACION_DATASET}</p>
          </div>

          {/* Checklist de los 5 entregables */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ENTREGABLES.map((e, i) => (
              <a
                key={i}
                href={`#${e.ancla}`}
                className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300">{e.texto}</span>
              </a>
            ))}
          </div>
        </section>

        {/* ── 1-3. Diagrama estrella 3D ── */}
        <Seccion id="diagrama" icono={Star} titulo="Diagrama estrella" badge="Entregables 1 · 2 · 3">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            <code className="font-mono text-blue-600 dark:text-blue-400">FACT_NORMALIZACION</code> al centro
            (grano: un registro de entrada al pipeline) y las 7 dimensiones en disposición radial.
          </p>
          <StarDiagram />
        </Seccion>

        {/* ── Toggle estrella ↔ copo de nieve ── */}
        <Seccion id="copo" icono={Snowflake} titulo="Estrella ↔ Copo de nieve" badge="Nivel 2">
          <SnowflakeToggle />
        </Seccion>

        {/* ── Matriz de Bus ── */}
        <Seccion id="bus" icono={Network} titulo="Matriz de Bus de Kimball" badge="Nivel 1">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Procesos de negocio × dimensiones. Las dimensiones compartidas entre los tres procesos
            son <strong>conformadas</strong> y permiten el análisis cruzado.
          </p>
          <MatrizBus />
        </Seccion>

        {/* ── Linaje OLTP → OLAP ── */}
        <Seccion id="linaje" icono={GitBranch} titulo="Linaje OLTP → OLAP" badge="Nivel 1">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Cada campo del esquema Prisma operacional mapeado a su destino dimensional. Prueba que el
            modelo se derivó del sistema real (3 jerarquías batch, no del ejemplo del PDF).
          </p>
          <TablaLinaje />
        </Seccion>

        {/* ── 4. Cruce de datos ── */}
        <Seccion id="cruces" icono={Shuffle} titulo="Cruce de datos" badge="Entregable 4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Datos nuevos generados al cruzar campos del dataset. Se requieren al menos 3; aquí hay 5.
          </p>
          <TablaCruces />
        </Seccion>

        {/* ── 5. Operaciones OLAP ── */}
        <Seccion id="olap" icono={Boxes} titulo="Consultas multidimensionales (OLAP)" badge="Entregable 5 · Nivel 1">
          <OlapTabs />
        </Seccion>

        {/* ── SCD Tipo 2 ── */}
        <Seccion id="scd2" icono={Layers} titulo="SCD Tipo 2 en DIM_FUENTE" badge="Nivel 1">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Las dimensiones de cambio lento (Tipo 2) preservan el histórico: los hechos antiguos
            siguen apuntando a la versión de la fuente vigente cuando se procesaron.
          </p>
          <TablaScd2 />
        </Seccion>

        {/* ── Constelación de hechos ── */}
        <Seccion id="constelacion" icono={Table2} titulo="Constelación de hechos" badge="Nivel 3">
          <Constelacion />
        </Seccion>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-8 py-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-gray-400 dark:text-gray-600">
          <span>COMUNAS_NORM — Data Warehouse · Evaluación 3</span>
          <span>{APP_VERSION}</span>
        </div>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Envoltorio de sección con título e icono
// ─────────────────────────────────────────────────────────────────────────────

function Seccion({
  id, icono: Icono, titulo, badge, children,
}: {
  id: string
  icono: React.ComponentType<{ className?: string }>
  titulo: string
  badge?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icono className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{titulo}</h2>
        {badge && (
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle estrella ↔ copo de nieve de DIM_UBICACION
// ─────────────────────────────────────────────────────────────────────────────

function SnowflakeToggle() {
  const [copo, setCopo] = useState(false)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCopo(false)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            !copo ? 'bg-blue-600 text-white border-blue-500' : 'border-gray-200 dark:border-gray-700 text-gray-500'
          }`}
        >
          <Star className="w-4 h-4" /> Estrella
        </button>
        <button
          onClick={() => setCopo(true)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            copo ? 'bg-blue-600 text-white border-blue-500' : 'border-gray-200 dark:border-gray-700 text-gray-500'
          }`}
        >
          <Snowflake className="w-4 h-4" /> Copo de nieve
        </button>
      </div>

      {!copo ? (
        // Forma estrella: DIM_UBICACION plana
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <h4 className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100 mb-2">{DIM_UBICACION.nombre}</h4>
          <div className="flex flex-wrap gap-1.5">
            {DIM_UBICACION.columnas.map((c) => (
              <code key={c.nombre} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{c.nombre}</code>
            ))}
          </div>
        </div>
      ) : (
        // Forma copo de nieve: cadena de 3 tablas normalizadas
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {COPO_UBICACION.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2 flex-1">
              <div className="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                <h4 className="font-mono font-bold text-xs text-gray-900 dark:text-gray-100 mb-1.5">{t.nombre}</h4>
                <div className="flex flex-wrap gap-1">
                  {t.columnas.map((c) => (
                    <code key={c.nombre} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">{c.nombre}</code>
                  ))}
                </div>
              </div>
              {i < COPO_UBICACION.length - 1 && <ArrowRight className="w-4 h-4 text-gray-400 shrink-0 hidden sm:block" />}
            </div>
          ))}
        </div>
      )}

      {/* Trade-off */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
          <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1"><Star className="w-3.5 h-3.5" /> Estrella</p>
          <p className="text-gray-600 dark:text-gray-400 text-xs">{TRADEOFF_ESQUEMA.estrella}</p>
        </div>
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1"><Snowflake className="w-3.5 h-3.5" /> Copo de nieve</p>
          <p className="text-gray-600 dark:text-gray-400 text-xs">{TRADEOFF_ESQUEMA.copoNieve}</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Matriz de Bus
// ─────────────────────────────────────────────────────────────────────────────

function MatrizBus() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Proceso</th>
            {DIMENSIONES.map((d) => (
              <th key={d.id} className="py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">{d.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIZ_BUS.map((fila) => (
            <tr key={fila.proceso} className="border-b border-gray-100 dark:border-gray-800/50">
              <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{fila.proceso}</td>
              {DIMENSIONES.map((d) => (
                <td key={d.id} className="py-2 px-2 text-center">
                  {fila.dimensiones[d.id]
                    ? <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                    : <span className="text-gray-300 dark:text-gray-700">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de linaje OLTP → OLAP
// ─────────────────────────────────────────────────────────────────────────────

function TablaLinaje() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Origen OLTP (Prisma)</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Destino OLAP</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Transformación</th>
          </tr>
        </thead>
        <tbody>
          {LINAJE.map((fila, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50">
              <td className="py-2 px-2"><code className="text-xs text-purple-600 dark:text-purple-400">{fila.origenOLTP}</code></td>
              <td className="py-2 px-2"><code className="text-xs text-blue-600 dark:text-blue-400">{fila.destinoOLAP}</code></td>
              <td className="py-2 px-2 text-gray-600 dark:text-gray-400 text-xs">{fila.transformacion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabla de cruces
// ─────────────────────────────────────────────────────────────────────────────

function TablaCruces() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Dato origen 1</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Dato origen 2</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Dato nuevo generado</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Módulo</th>
          </tr>
        </thead>
        <tbody>
          {CRUCES.map((c, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50">
              <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{c.origen1}</td>
              <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{c.origen2}</td>
              <td className="py-2 px-2 font-medium text-gray-800 dark:text-gray-200">{c.datoNuevo}</td>
              <td className="py-2 px-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{c.modulo}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pestañas de operaciones OLAP
// ─────────────────────────────────────────────────────────────────────────────

/** Estado de la consulta en vivo contra el DW (SQLite, Nivel 3). */
type EstadoDW = 'cargando' | 'ok' | 'vacio' | 'no_poblado' | 'error'

/** Forma de la respuesta de /api/dw/query. */
interface RespuestaDW {
  ok: boolean
  reason?: string
  columnas?: string[]
  filas?: Array<Record<string, unknown>>
}

function OlapTabs() {
  const [activa, setActiva] = useState<OperacionId>('principal')
  const [estado, setEstado] = useState<EstadoDW>('cargando')
  const [columnas, setColumnas] = useState<string[]>([])
  const [filas, setFilas] = useState<Array<Record<string, unknown>>>([])
  const consulta = CONSULTAS_OLAP.find((c) => c.id === activa) ?? CONSULTAS_OLAP[0]

  // Cada vez que cambia la operación, consulta el DW poblado y trae el resultado real.
  useEffect(() => {
    let cancelado = false
    setEstado('cargando')
    fetch(`/api/dw/query?op=${activa}`)
      .then((r) => r.json() as Promise<RespuestaDW>)
      .then((d) => {
        if (cancelado) return
        if (!d.ok) {
          setEstado(d.reason === 'not_populated' ? 'no_poblado' : 'error')
          return
        }
        const f = d.filas ?? []
        setColumnas(d.columnas ?? [])
        setFilas(f)
        setEstado(f.length === 0 ? 'vacio' : 'ok')
      })
      .catch(() => { if (!cancelado) setEstado('error') })
    return () => { cancelado = true }
  }, [activa])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CONSULTAS_OLAP.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiva(c.id)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              activa === c.id
                ? 'bg-blue-600 text-white border-blue-500'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{consulta.descripcion}</p>
        {consulta.lenguajeNatural && (
          <p className="text-sm text-gray-500 dark:text-gray-500 italic mb-3">«{consulta.lenguajeNatural}»</p>
        )}
        <CodeBlock code={consulta.sql} language="sql" />
      </div>

      <ResultadoEnVivo estado={estado} columnas={columnas} filas={filas} />
    </div>
  )
}

/** Tabla de resultados en vivo (o estado equivalente) de la consulta OLAP. */
function ResultadoEnVivo({
  estado, columnas, filas,
}: {
  estado: EstadoDW
  columnas: string[]
  filas: Array<Record<string, unknown>>
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Resultado en vivo</span>
        {estado === 'ok' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">DW poblado</span>}
        {estado === 'no_poblado' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">DW no poblado</span>}
      </div>

      {estado === 'cargando' && <p className="text-sm text-gray-400">Consultando el DW…</p>}
      {estado === 'no_poblado' && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          El DW no está poblado en este entorno. Ejecuta{' '}
          <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">pnpm etl</code>{' '}
          donde haya acceso a la base operacional para ver los resultados reales.
        </p>
      )}
      {estado === 'error' && <p className="text-sm text-red-500">No se pudo consultar el DW.</p>}
      {estado === 'vacio' && <p className="text-sm text-gray-500 dark:text-gray-400">El DW está poblado pero la consulta no devolvió filas.</p>}
      {estado === 'ok' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                {columnas.map((c) => (
                  <th key={c} className="text-left py-2 px-3 font-mono text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.slice(0, 50).map((fila, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800/50">
                  {columnas.map((c) => (
                    <td key={c} className="py-1.5 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatearValor(fila[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filas.length > 50 && (
            <p className="text-xs text-gray-400 px-3 py-2">Mostrando 50 de {filas.length} filas.</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Formatea un valor de celda para mostrarlo en la tabla de resultados. */
function formatearValor(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number' || typeof v === 'string') return String(v)
  return JSON.stringify(v)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabla SCD Tipo 2
// ─────────────────────────────────────────────────────────────────────────────

function TablaScd2() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">id</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">código</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">nombre_fuente</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">ver.</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">valido_desde</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">valido_hasta</th>
            <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">actual</th>
          </tr>
        </thead>
        <tbody>
          {FUENTES_SCD2.map((f) => (
            <tr key={f.idFuente} className={`border-b border-gray-100 dark:border-gray-800/50 ${f.esActual ? '' : 'opacity-60'}`}>
              <td className="py-2 px-2 text-gray-500">{f.idFuente}</td>
              <td className="py-2 px-2"><code className="text-xs text-blue-600 dark:text-blue-400">{f.codigo}</code></td>
              <td className="py-2 px-2 text-gray-700 dark:text-gray-300">{f.nombreFuente}</td>
              <td className="py-2 px-2 text-center text-gray-500">{f.version}</td>
              <td className="py-2 px-2 text-gray-500 text-xs">{f.validoDesde}</td>
              <td className="py-2 px-2 text-gray-500 text-xs">{f.validoHasta ?? <span className="italic text-gray-400">(NULL)</span>}</td>
              <td className="py-2 px-2 text-center">
                {f.esActual
                  ? <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
                  : <span className="text-gray-300 dark:text-gray-700">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Constelación de hechos
// ─────────────────────────────────────────────────────────────────────────────

function Constelacion() {
  const conformadas = DIMENSIONES.filter((d) => DIMENSIONES_CONFORMADAS.includes(d.id))
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Una segunda tabla de hechos que <strong>comparte dimensiones conformadas</strong> con la primera:
        eso es una constelación (no una sola estrella). Ilustra hechos transaccionales vs. de snapshot.
      </p>
      <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
        {/* Hecho transaccional */}
        <div className="flex-1 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 p-3 text-center">
          <p className="font-mono font-bold text-sm text-blue-700 dark:text-blue-300">{FACT_NORMALIZACION.nombre}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">transaccional · {FACT_NORMALIZACION.grano}</p>
        </div>
        {/* Dimensiones conformadas compartidas */}
        <div className="flex sm:flex-col items-center justify-center gap-1">
          {conformadas.map((d) => (
            <div key={d.id} className="rounded-lg border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 px-2 py-1">
              <code className="text-[10px] text-purple-700 dark:text-purple-300">{d.nombre}</code>
            </div>
          ))}
        </div>
        {/* Hecho de snapshot */}
        <div className="flex-1 rounded-xl border-2 border-teal-500 bg-teal-50 dark:bg-teal-950/30 p-3 text-center">
          <p className="font-mono font-bold text-sm text-teal-700 dark:text-teal-300">{FACT_CALIDAD_DIARIA.nombre}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">snapshot · {FACT_CALIDAD_DIARIA.grano}</p>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Ambos hechos comparten {conformadas.map((d) => d.nombre).join(' y ')} → dimensiones conformadas.
      </p>
    </div>
  )
}
