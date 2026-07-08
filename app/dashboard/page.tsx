/**
 * dashboard/page.tsx
 * Dashboard ejecutivo de COMUNAS_NORM (Evaluación 3).
 *
 * Server component: la carga inicial (y cada cambio de filtro vía querystring)
 * consulta el Data Warehouse real (datawarehouse.db) a través del catálogo
 * cerrado de solo lectura de dw-sqlite.ts. La interacción (filtros, dark mode,
 * gráficos Recharts) vive en componentes cliente. Nada hardcodeado.
 *
 * Se fuerza runtime Node + dynamic para leer el binding nativo de SQLite solo en
 * runtime (nunca en build) y no prerenderizar con datos estáticos.
 */

import Link from 'next/link'
import {
  Database, FileText, Gauge, SearchX, ArrowLeft, LayoutDashboard,
  Boxes, BarChart3, Trophy, TrendingUp,
} from 'lucide-react'
import { cargarDashboard, dwDisponible } from '../lib/dw-sqlite'
import { ThemeToggle } from '../components/dashboard/ThemeToggle'
import { DashboardFilters } from '../components/dashboard/DashboardFilters'
import { KpiCard } from '../components/dashboard/KpiCard'
import { HechosPorModuloChart } from '../components/dashboard/HechosPorModuloChart'
import { RankingComunas } from '../components/dashboard/RankingComunas'
import { CalidadDiariaChart } from '../components/dashboard/CalidadDiariaChart'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Toma el primer valor de un parámetro de búsqueda (que puede venir repetido). */
function primerValor(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">

      {/* ── Header ── */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Volver al inicio">
              <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <Database className="w-6 h-6 text-blue-600" />
              <span className="font-bold text-gray-900 dark:text-gray-100">COMUNAS_NORM</span>
            </Link>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <div className="flex items-center gap-1.5">
              <LayoutDashboard className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/datawarehouse"
              className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <Boxes className="w-4 h-4" />
              Data Warehouse
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard ejecutivo</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Indicadores en vivo desde el Data Warehouse (esquema estrella en SQLite). Todos los números
            provienen de <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">datawarehouse.db</code>.
          </p>
        </div>

        {/* Cuerpo: datos reales o aviso de DW no poblado */}
        {dwDisponible()
          ? <CuerpoDashboard raw={{
              id_modulo: primerValor(sp.id_modulo),
              id_fuente: primerValor(sp.id_fuente),
              fecha_desde: primerValor(sp.fecha_desde),
              fecha_hasta: primerValor(sp.fecha_hasta),
              region: primerValor(sp.region),
              pais: primerValor(sp.pais),
            }} />
          : <NoPoblado />}
      </main>
    </div>
  )
}

/** Cuerpo con datos reales del DW. */
async function CuerpoDashboard({ raw }: { raw: Record<string, string | undefined> }) {
  const { opciones, filtros, kpis, hechosPorModulo, rankingComunas, calidadDiaria } = await cargarDashboard(raw)

  return (
    <>
      {/* Barra de filtros (client) */}
      <DashboardFilters opciones={opciones} filtros={filtros} />

      {/* Fila de KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Hechos normalizados"
          value={kpis.total_hechos.toLocaleString('es-CL')}
          icon={Database}
          color="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-950"
        />
        <KpiCard
          label="Cargas procesadas"
          value={kpis.total_cargas.toLocaleString('es-CL')}
          icon={FileText}
          color="text-green-600"
          bg="bg-green-50 dark:bg-green-950"
        />
        <KpiCard
          label="Calidad promedio"
          value={kpis.calidad_comunas !== null ? `${kpis.calidad_comunas}%` : 'N/A'}
          icon={Gauge}
          color="text-purple-600"
          bg="bg-purple-50 dark:bg-purple-950"
          hint="Solo módulo Comunas"
        />
        <KpiCard
          label="No encontrados"
          value={kpis.no_encontrados !== null ? kpis.no_encontrados.toLocaleString('es-CL') : 'N/A'}
          icon={SearchX}
          color="text-orange-600"
          bg="bg-orange-50 dark:bg-orange-950"
          hint="Solo módulo Comunas"
        />
      </div>

      {/* Gráfico por módulo + ranking de comunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Hechos por módulo</h2>
          </div>
          <HechosPorModuloChart datos={hechosPorModulo} />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Top comunas por población</h2>
          </div>
          <RankingComunas datos={rankingComunas} />
        </div>
      </div>

      {/* Evolución de calidad diaria (Comunas) */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Evolución de la calidad (Comunas)</h2>
        </div>
        <CalidadDiariaChart datos={calidadDiaria} />
      </div>
    </>
  )
}

/** Aviso cuando el DW no fue poblado (p.ej. desarrollo local sin ETL). */
function NoPoblado() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
      <Boxes className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-700" />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        El Data Warehouse no está poblado en este entorno. Ejecuta{' '}
        <code className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">pnpm etl</code>{' '}
        donde haya acceso a la base operacional para ver los indicadores reales.
      </p>
    </div>
  )
}
