'use client'

/**
 * DashboardFilters.tsx
 * Barra de filtros del dashboard. Los desplegables se pueblan con datos REALES
 * del DW (operación dashboard_filtros) y usan componentes de diseño propio
 * (FancySelect / DatePicker), no controles nativos. Al cambiar un filtro se
 * actualiza la querystring y se navega: el server component vuelve a calcular
 * KPIs, gráfico y ranking de forma coherente (sin fetch manual ni estado duplicado).
 *
 * Región/País son contextuales: región solo aplica al módulo Comunas y país al
 * módulo Lugares; el resto del tiempo el control aparece deshabilitado.
 */

import { useRouter, usePathname } from 'next/navigation'
import { Filter, X } from 'lucide-react'
import type { OpcionesFiltro, FiltrosDashboard } from '../../lib/dw-sqlite'
import { FancySelect, type OpcionSelect } from './FancySelect'
import { DatePicker } from './DatePicker'

interface Props {
  opciones: OpcionesFiltro
  filtros: FiltrosDashboard
}

export function DashboardFilters({ opciones, filtros }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  // Opciones de cada desplegable (siempre con la opción "Todos/Todas" al inicio).
  const optModulos: OpcionSelect[] = [
    { value: '', label: 'Todos' },
    ...opciones.modulos.map((m) => ({ value: String(m.id), label: m.nombre })),
  ]
  const optFuentes: OpcionSelect[] = [
    { value: '', label: 'Todas' },
    ...opciones.fuentes.map((s) => ({ value: String(s.id), label: s.nombre })),
  ]
  const optRegiones: OpcionSelect[] = [
    { value: '', label: 'Todas' },
    ...opciones.regiones.map((r) => ({ value: r, label: r })),
  ]
  const optPaises: OpcionSelect[] = [
    { value: '', label: 'Todos' },
    ...opciones.paises.map((p) => ({ value: p, label: p })),
  ]

  /** Aplica cambios sobre el estado actual y navega con la nueva querystring. */
  function aplicar(cambios: Record<string, string | undefined>) {
    const actual: Record<string, string | undefined> = {
      id_modulo: filtros.id_modulo?.toString(),
      id_fuente: filtros.id_fuente?.toString(),
      fecha_desde: filtros.fecha_desde,
      fecha_hasta: filtros.fecha_hasta,
      region: filtros.region,
      pais: filtros.pais,
    }
    const fusion = { ...actual, ...cambios }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(fusion)) {
      if (v) params.set(k, v)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const hayFiltros =
    filtros.id_modulo !== undefined || filtros.id_fuente !== undefined ||
    !!filtros.fecha_desde || !!filtros.fecha_hasta || !!filtros.region || !!filtros.pais

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filtros</h2>
        {hayFiltros && (
          <button
            onClick={() => router.push(pathname)}
            className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Limpiar
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Módulo */}
        <Campo label="Módulo">
          <FancySelect
            ariaLabel="Filtrar por módulo"
            value={filtros.id_modulo?.toString() ?? ''}
            options={optModulos}
            onChange={(v) => aplicar({ id_modulo: v || undefined })}
          />
        </Campo>

        {/* Fuente */}
        <Campo label="Fuente">
          <FancySelect
            ariaLabel="Filtrar por fuente"
            value={filtros.id_fuente?.toString() ?? ''}
            options={optFuentes}
            onChange={(v) => aplicar({ id_fuente: v || undefined })}
          />
        </Campo>

        {/* Rango de fechas */}
        <Campo label="Desde">
          <DatePicker
            value={filtros.fecha_desde ?? ''}
            initialMonth={opciones.fechaMax ?? undefined}
            onChange={(v) => aplicar({ fecha_desde: v || undefined })}
          />
        </Campo>
        <Campo label="Hasta">
          <DatePicker
            value={filtros.fecha_hasta ?? ''}
            initialMonth={opciones.fechaMax ?? undefined}
            onChange={(v) => aplicar({ fecha_hasta: v || undefined })}
          />
        </Campo>

        {/* Región (comunas chilenas) */}
        <Campo label="Región">
          <FancySelect
            ariaLabel="Filtrar por región"
            value={filtros.region ?? ''}
            options={optRegiones}
            onChange={(v) => aplicar({ region: v || undefined })}
          />
        </Campo>

        {/* País (lugares) */}
        <Campo label="País">
          <FancySelect
            ariaLabel="Filtrar por país"
            value={filtros.pais ?? ''}
            options={optPaises}
            onChange={(v) => aplicar({ pais: v || undefined })}
          />
        </Campo>
      </div>
    </div>
  )
}

/** Envoltorio etiqueta + control para la barra de filtros. */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      {children}
    </div>
  )
}
