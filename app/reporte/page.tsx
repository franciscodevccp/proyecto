'use client'

/**
 * reporte/page.tsx
 * Genera un resumen ejecutivo en lenguaje natural del dataset procesado.
 * Soporta los tres módulos: comunas, famosos, lugares.
 *
 * Acepta ?batch=ID&modulo=famosos|comunas|lugares para carga directa
 * (cuando se llega desde analytics o el historial de cada módulo).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Toaster, toast } from 'react-hot-toast'
import { useDarkMode } from '../hooks/useDarkMode'
import {
  Database, TrendingUp, Download, Users, MapPin,
  Sun, Moon, ChevronDown, Loader2, ArrowLeft,
} from 'lucide-react'


// ─── Tipos ────────────────────────────────────────────────────────────────────

type Modulo = 'famosos' | 'comunas' | 'lugares'

interface BatchItem {
  id: string
  fileName: string
  createdAt: string
  modulo: Modulo
}

// Reporte famosos
interface ReporteFamosos {
  modulo: 'famosos'
  fileName: string
  createdAt: string
  totalInput: number
  totalOutput: number
  duplicates: number
  pctDups: number
  formatos: { nombre: string; count: number }[]
  conNormalizada: number
  conAprox: number
  sinFecha: number
  masAntiguo: { nombre: string; anio: number; display: string; esAprox: boolean } | null
  masReciente: { nombre: string; anio: number; display: string; esAprox: boolean } | null
  cumpleHoy: string[]
  proximoCumple: { nombre: string; diaMes: string; diasFaltan: number } | null
}

// Reporte comunas
interface ReporteComunas {
  modulo: 'comunas'
  fileName: string
  createdAt: string
  totalInput: number
  totalOutput: number
  duplicates: number
  pctDups: number
  changes: number
  pctNorm: number
  sinCambio: number
  qualityBefore: number | null
  qualityAfter: number | null
  cambios: { tipo: string; count: number }[]
}

// Reporte lugares
interface ReporteLugares {
  modulo: 'lugares'
  fileName: string
  createdAt: string
  totalInput: number
  totalOutput: number
  duplicates: number
  pctDups: number
  conGeoref: number
  sinGeoref: number
  conDireccion: number
  pctGeoref: number
  paises: { pais: string; count: number }[]
  ciudades: { ciudad: string; count: number }[]
  boundsLat: [number, number] | null
  boundsLon: [number, number] | null
  totalPaises: number
}

type ReporteData = ReporteFamosos | ReporteComunas | ReporteLugares

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MODULO_LABEL: Record<Modulo, string> = {
  famosos: 'Famosos',
  comunas: 'Comunas',
  lugares: 'Lugares turísticos',
}

const MODULO_COLOR: Record<Modulo, string> = {
  famosos: 'text-purple-600 dark:text-purple-400',
  comunas: 'text-blue-600 dark:text-blue-400',
  lugares: 'text-teal-600 dark:text-teal-400',
}

const MODULO_ICON: Record<Modulo, React.ElementType> = {
  famosos: Users,
  comunas: Database,
  lugares: MapPin,
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function plural(n: number, sing: string, plur: string) {
  return n === 1 ? `${n} ${sing}` : `${n} ${plur}`
}

// ─── Sub-componentes de reporte ───────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-6 mb-3">
      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
        {label}
      </p>
      <div className="h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${accent ?? 'text-gray-800 dark:text-gray-100'}`}>
        {value}
      </span>
    </div>
  )
}

// ─── Vista: Famosos ───────────────────────────────────────────────────────────

function ReporteFamososView({ r }: { r: ReporteFamosos }) {
  const pctNorm = r.totalOutput > 0
    ? Math.round((r.conNormalizada / r.totalOutput) * 100)
    : 0

  return (
    <>
      {/* Resumen ejecutivo en lenguaje natural */}
      <Divider label="Resumen ejecutivo" />
      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>
          Se detectaron{' '}
          <strong className="text-gray-900 dark:text-gray-100">{r.totalInput}</strong>{' '}
          registros con{' '}
          <strong className="text-gray-900 dark:text-gray-100">
            {plural(r.formatos.length, 'formato de fecha distinto', 'formatos de fecha distintos')}
          </strong>.{' '}
          Tras la normalización quedaron{' '}
          <strong className="text-gray-900 dark:text-gray-100">{r.totalOutput} famosos únicos</strong>
          {r.duplicates > 0 && (
            <> ({r.duplicates} {r.duplicates === 1 ? 'duplicado eliminado' : 'duplicados eliminados'})</>
          )}.
        </p>

        {r.masAntiguo && r.masReciente && (
          <p>
            El personaje más antiguo es{' '}
            <strong className="text-purple-700 dark:text-purple-300">{r.masAntiguo.nombre}</strong>
            {' '}({r.masAntiguo.display}).{' '}
            El más reciente es{' '}
            <strong className="text-purple-700 dark:text-purple-300">{r.masReciente.nombre}</strong>
            {' '}({r.masReciente.display}).
          </p>
        )}

        {r.cumpleHoy.length > 0 ? (
          <p>
            Hoy cumple años{' '}
            <strong className="text-pink-700 dark:text-pink-300">{r.cumpleHoy.join(', ')}</strong>.
          </p>
        ) : r.proximoCumple ? (
          <p>
            Hoy no hay cumpleaños. El próximo es{' '}
            <strong className="text-pink-700 dark:text-pink-300">{r.proximoCumple.nombre}</strong>
            {' '}el {r.proximoCumple.diaMes}
            {' '}(en {plural(r.proximoCumple.diasFaltan, 'día', 'días')}).
          </p>
        ) : (
          <p>No hay datos de cumpleaños disponibles.</p>
        )}
      </div>

      {/* Estadísticas de procesamiento */}
      <Divider label="Estadísticas de procesamiento" />
      <div className="space-y-0">
        <Stat label="Registros de entrada"   value={r.totalInput} />
        <Stat label="Famosos únicos (salida)" value={r.totalOutput} />
        <Stat
          label="Duplicados eliminados"
          value={`${r.duplicates} (${r.pctDups}%)`}
          accent={r.duplicates > 0 ? 'text-orange-600' : 'text-green-600'}
        />
        <Stat
          label="Fechas normalizadas"
          value={`${r.conNormalizada} (${pctNorm}%)`}
          accent="text-blue-600 dark:text-blue-400"
        />
        {r.conAprox > 0 && (
          <Stat
            label="Fechas históricas (a.C.)"
            value={r.conAprox}
            accent="text-violet-600 dark:text-violet-400"
          />
        )}
        {r.sinFecha > 0 && (
          <Stat
            label="Sin fecha parseada"
            value={r.sinFecha}
            accent="text-red-500"
          />
        )}
      </div>

      {/* Rango temporal */}
      {(r.masAntiguo || r.masReciente) && (
        <>
          <Divider label="Rango temporal" />
          <div className="space-y-0">
            {r.masAntiguo && (
              <Stat
                label="Más antiguo"
                value={`${r.masAntiguo.nombre} · ${r.masAntiguo.display}`}
                accent="text-indigo-600 dark:text-indigo-400"
              />
            )}
            {r.masReciente && (
              <Stat
                label="Más reciente"
                value={`${r.masReciente.nombre} · ${r.masReciente.display}`}
                accent="text-pink-600 dark:text-pink-400"
              />
            )}
          </div>
        </>
      )}

      {/* Formatos de fecha detectados */}
      <Divider label={`Formatos de fecha detectados (${r.formatos.length})`} />
      <div className="space-y-0">
        {r.formatos.map((f) => (
          <Stat
            key={f.nombre}
            label={f.nombre}
            value={`${f.count} ${f.count === 1 ? 'registro' : 'registros'}`}
          />
        ))}
      </div>

      {/* Cumpleaños */}
      <Divider label="Cumpleaños" />
      <div className="space-y-0">
        {r.cumpleHoy.length > 0 ? (
          <Stat label="Cumple hoy" value={r.cumpleHoy.join(', ')} accent="text-pink-600" />
        ) : (
          <Stat label="Cumple hoy" value="Nadie" accent="text-gray-400" />
        )}
        {r.proximoCumple && (
          <>
            <Stat label="Próximo cumpleaños" value={`${r.proximoCumple.nombre} · ${r.proximoCumple.diaMes}`} />
            <Stat label="Días restantes" value={r.proximoCumple.diasFaltan} />
          </>
        )}
      </div>
    </>
  )
}

// ─── Vista: Comunas ───────────────────────────────────────────────────────────

function ReporteComunasView({ r }: { r: ReporteComunas }) {
  return (
    <>
      <Divider label="Resumen ejecutivo" />
      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>
          Se procesaron{' '}
          <strong className="text-gray-900 dark:text-gray-100">{r.totalInput}</strong>{' '}
          registros de entrada. Tras eliminar{' '}
          <strong className="text-gray-900 dark:text-gray-100">
            {r.duplicates} {r.duplicates === 1 ? 'duplicado' : 'duplicados'}
          </strong>{' '}
          ({r.pctDups}%) quedaron{' '}
          <strong className="text-gray-900 dark:text-gray-100">{r.totalOutput} comunas únicas</strong>.
        </p>
        <p>
          De esas,{' '}
          <strong className="text-blue-700 dark:text-blue-300">{r.changes}</strong>{' '}
          fueron normalizadas ({r.pctNorm}%) y{' '}
          <strong className="text-gray-700 dark:text-gray-300">{r.sinCambio}</strong>{' '}
          ya estaban en formato correcto.
        </p>
        {r.qualityBefore !== null && r.qualityAfter !== null && (
          <p>
            El score de calidad del dataset pasó de{' '}
            <strong className="text-orange-600">{r.qualityBefore}/100</strong>{' '}
            a{' '}
            <strong className="text-green-600">{r.qualityAfter}/100</strong>{' '}
            tras la normalización.
          </p>
        )}
      </div>

      <Divider label="Estadísticas de procesamiento" />
      <div className="space-y-0">
        <Stat label="Registros de entrada"  value={r.totalInput} />
        <Stat label="Comunas únicas"        value={r.totalOutput} />
        <Stat label="Duplicados eliminados" value={`${r.duplicates} (${r.pctDups}%)`}
          accent={r.duplicates > 0 ? 'text-orange-600' : 'text-green-600'} />
        <Stat label="Normalizadas"          value={`${r.changes} (${r.pctNorm}%)`}
          accent="text-blue-600 dark:text-blue-400" />
        <Stat label="Sin cambio"            value={r.sinCambio} />
        {r.qualityBefore !== null && (
          <Stat label="Calidad antes" value={`${r.qualityBefore}/100`}
            accent="text-orange-500" />
        )}
        {r.qualityAfter !== null && (
          <Stat label="Calidad después" value={`${r.qualityAfter}/100`}
            accent="text-green-600" />
        )}
      </div>

      {r.cambios.length > 0 && (
        <>
          <Divider label="Tipos de cambio aplicados" />
          <div className="space-y-0">
            {r.cambios.map((c) => (
              <Stat key={c.tipo} label={c.tipo} value={`${c.count} veces`} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

// ─── Vista: Lugares ───────────────────────────────────────────────────────────

function ReporteLugaresView({ r }: { r: ReporteLugares }) {
  return (
    <>
      <Divider label="Resumen ejecutivo" />
      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>
          Se procesaron{' '}
          <strong className="text-gray-900 dark:text-gray-100">{r.totalInput}</strong>{' '}
          registros. Tras eliminar{' '}
          <strong className="text-gray-900 dark:text-gray-100">
            {r.duplicates} {r.duplicates === 1 ? 'duplicado' : 'duplicados'}
          </strong>{' '}
          ({r.pctDups}%) quedaron{' '}
          <strong className="text-gray-900 dark:text-gray-100">
            {r.totalOutput} lugares únicos
          </strong>.
        </p>
        <p>
          <strong className="text-teal-700 dark:text-teal-300">{r.conGeoref}</strong>{' '}
          de ellos tienen georeferencia válida ({r.pctGeoref}%)
          {r.sinGeoref > 0 && (
            <>, mientras que <strong className="text-red-600">{r.sinGeoref}</strong> no pudieron ser georeferenciad{r.sinGeoref === 1 ? 'o' : 'os'}</>
          )}.
        </p>
        {r.totalPaises > 0 && (
          <p>
            El dataset abarca{' '}
            <strong className="text-gray-900 dark:text-gray-100">
              {plural(r.totalPaises, 'país', 'países')}
            </strong>.
            {r.paises[0] && (
              <> El más frecuente es <strong className="text-teal-700 dark:text-teal-300">{r.paises[0].pais}</strong> con {r.paises[0].count} {r.paises[0].count === 1 ? 'lugar' : 'lugares'}.</>
            )}
          </p>
        )}
        {r.boundsLat && r.boundsLon && (
          <p>
            Las coordenadas cubren desde{' '}
            <strong className="text-gray-900 dark:text-gray-100">
              lat {r.boundsLat[0].toFixed(2)}° a {r.boundsLat[1].toFixed(2)}°
            </strong>{' '}
            y{' '}
            <strong className="text-gray-900 dark:text-gray-100">
              lon {r.boundsLon[0].toFixed(2)}° a {r.boundsLon[1].toFixed(2)}°
            </strong>.
          </p>
        )}
      </div>

      <Divider label="Estadísticas de procesamiento" />
      <div className="space-y-0">
        <Stat label="Registros de entrada"  value={r.totalInput} />
        <Stat label="Lugares únicos"        value={r.totalOutput} />
        <Stat label="Duplicados eliminados" value={`${r.duplicates} (${r.pctDups}%)`}
          accent={r.duplicates > 0 ? 'text-orange-600' : 'text-green-600'} />
        <Stat label="Con georeferencia"     value={`${r.conGeoref} (${r.pctGeoref}%)`}
          accent="text-teal-600 dark:text-teal-400" />
        <Stat label="Sin georeferencia"     value={r.sinGeoref}
          accent={r.sinGeoref > 0 ? 'text-red-500' : 'text-green-600'} />
        <Stat label="Con dirección estructurada" value={r.conDireccion} />
        <Stat label="Países representados"  value={r.totalPaises} />
      </div>

      {r.paises.length > 0 && (
        <>
          <Divider label="Distribución por país" />
          <div className="space-y-0">
            {r.paises.map((p) => (
              <Stat key={p.pais} label={p.pais} value={`${p.count} ${p.count === 1 ? 'lugar' : 'lugares'}`} />
            ))}
          </div>
        </>
      )}

      {r.ciudades.length > 0 && (
        <>
          <Divider label="Ciudades principales" />
          <div className="space-y-0">
            {r.ciudades.map((c) => (
              <Stat key={c.ciudad} label={c.ciudad} value={`${c.count} ${c.count === 1 ? 'lugar' : 'lugares'}`} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReportePage() {
  const [isDark, toggleDark] = useDarkMode()
  const [batches, setBatches]     = useState<BatchItem[]>([])
  const [modulo, setModulo]       = useState<Modulo>('famosos')
  const [batchId, setBatchId]     = useState<string>('')
  const [reporte, setReporte]     = useState<ReporteData | null>(null)
  const [cargando, setCargando]   = useState(false)
  const [descargando, setDescargando] = useState(false)

  /** Genera y descarga el reporte como PDF usando html2canvas + jsPDF v2 */
  async function descargarPDF() {
    const elemento = document.getElementById('reporte-documento')
    if (!elemento || !reporte) return
    setDescargando(true)
    try {
      // Importaciones dinámicas para evitar SSR
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      // Captura el elemento como imagen en alta resolución con fondo blanco
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      const pdf     = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
      const pageW   = pdf.internal.pageSize.getWidth()
      const pageH   = pdf.internal.pageSize.getHeight()
      const imgW    = pageW
      const imgH    = (canvas.height * imgW) / canvas.width

      // Paginación automática si el contenido supera una hoja A4
      let heightLeft = imgH
      let position   = 0

      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
      heightLeft -= pageH

      while (heightLeft > 0) {
        position  -= pageH
        pdf.addPage()
        pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH)
        heightLeft -= pageH
      }

      const nombre = `reporte-${reporte.modulo}-${reporte.fileName.replace(/\s+/g, '_')}.pdf`
      pdf.save(nombre)
      toast.success('PDF descargado')
    } catch (err) {
      console.error('Error generando PDF:', err)
      toast.error('Error al generar el PDF: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setDescargando(false)
    }
  }

  // Carga la lista de batches al montar
  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => r.json())
      .then((d) => setBatches(d.batches ?? []))
  }, [])

  // Lee params de la URL para carga directa (desde analytics)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const bid = params.get('batch')
    const mod = params.get('modulo') as Modulo | null
    if (bid && mod && ['famosos', 'comunas', 'lugares'].includes(mod)) {
      setModulo(mod)
      setBatchId(bid)
      cargarReporte(bid, mod)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarReporte(bid: string, mod: Modulo) {
    if (!bid) return
    setCargando(true)
    setReporte(null)
    try {
      const res = await fetch(`/api/reporte?batchId=${bid}&modulo=${mod}`)
      const data = await res.json()
      if (res.ok) setReporte(data as ReporteData)
    } finally {
      setCargando(false)
    }
  }

  const batchesFiltrados = [...batches]
    .filter((b) => b.modulo === modulo)
    .reverse()

  const moduloIcon = MODULO_ICON[modulo]
  const ModuloIcon = moduloIcon

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Toaster position="top-right" />

      {/* Estilos de impresión */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>

      {/* Header */}
      <header className="no-print bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              <span className="font-bold text-gray-900 dark:text-gray-100 hidden sm:block">COMUNAS_NORM</span>
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reporte</span>
            </div>
          </div>
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {isDark
              ? <Sun className="w-4 h-4 text-yellow-400" />
              : <Moon className="w-4 h-4 text-gray-500" />
            }
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Selector de módulo + batch */}
        <section className="no-print bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Generar reporte
          </h2>

          {/* Tabs de módulo */}
          <div className="flex gap-2">
            {(['famosos', 'comunas', 'lugares'] as Modulo[]).map((m) => {
              const Icon = MODULO_ICON[m]
              return (
                <button
                  key={m}
                  onClick={() => { setModulo(m); setBatchId(''); setReporte(null) }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${modulo === m
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {MODULO_LABEL[m]}
                </button>
              )
            })}
          </div>

          {/* Selector de batch */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Selecciona un batch —</option>
                {batchesFiltrados.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.fileName} · {new Date(b.createdAt).toLocaleDateString('es-CL')}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => cargarReporte(batchId, modulo)}
              disabled={!batchId || cargando}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generar'}
            </button>
          </div>
        </section>

        {/* Cargando */}
        {cargando && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Generando reporte…</span>
          </div>
        )}

        {/* Documento del reporte */}
        {!cargando && reporte && (
          <div id="reporte-documento" className="print-card bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">

            {/* Cabecera del documento */}
            <div
              className="px-6 sm:px-8 py-6 border-b border-gray-100 dark:border-gray-800"
              style={{
                background: reporte.modulo === 'famosos'
                  ? 'linear-gradient(135deg,#f5f3ff,#ede9fe)'
                  : reporte.modulo === 'lugares'
                  ? 'linear-gradient(135deg,#f0fdfa,#ccfbf1)'
                  : 'linear-gradient(135deg,#eff6ff,#dbeafe)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Reporte de análisis ejecutivo
                  </p>
                  <h1 className="text-xl font-black text-gray-900 leading-tight">
                    {reporte.fileName}
                  </h1>
                  <div className="flex items-center gap-2 mt-1.5">
                    <ModuloIcon className={`w-4 h-4 ${MODULO_COLOR[reporte.modulo]}`} />
                    <span className={`text-sm font-semibold ${MODULO_COLOR[reporte.modulo]}`}>
                      {MODULO_LABEL[reporte.modulo]}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-500">
                      Generado el {fmtDate(new Date().toISOString())}
                    </span>
                  </div>
                </div>
                {/* Botón descargar PDF */}
                <button
                  onClick={descargarPDF}
                  disabled={descargando}
                  className="no-print flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all shrink-0"
                >
                  {descargando
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Download className="w-4 h-4" />
                  }
                  {descargando ? 'Generando…' : 'Descargar PDF'}
                </button>
              </div>

              {/* Línea separadora estilo CLI */}
              <p className="mt-4 text-xs font-mono text-gray-400 tracking-tight select-none">
                {'━'.repeat(48)}
              </p>
            </div>

            {/* Cuerpo del reporte */}
            <div className="px-6 sm:px-8 py-6">
              {reporte.modulo === 'famosos' && <ReporteFamososView r={reporte} />}
              {reporte.modulo === 'comunas' && <ReporteComunasView r={reporte} />}
              {reporte.modulo === 'lugares' && <ReporteLugaresView r={reporte} />}
            </div>

            {/* Pie del documento */}
            <div className="px-6 sm:px-8 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50">
              <p className="text-xs text-gray-400 font-mono">
                COMUNAS_NORM — Módulo {MODULO_LABEL[reporte.modulo]} — v0.1.0
              </p>
            </div>
          </div>
        )}

        {/* Estado vacío inicial */}
        {!cargando && !reporte && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-600">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Selecciona un módulo y un batch para generar el reporte</p>
          </div>
        )}
      </main>
    </div>
  )
}
