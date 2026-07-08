'use client'

/**
 * DashboardFilters.tsx
 * Barra de filtros del dashboard. Los desplegables se pueblan con datos REALES
 * del DW (operación dashboard_filtros). Al cambiar un filtro se actualiza la
 * querystring y se navega: el server component vuelve a calcular KPIs, gráfico
 * y ranking de forma coherente (no hay fetch manual ni estado duplicado).
 *
 * Región/País son contextuales: región solo aplica al módulo Comunas y país al
 * módulo Lugares; el resto del tiempo el control aparece deshabilitado.
 */

import { useRouter, usePathname } from 'next/navigation'
import { Filter, X } from 'lucide-react'
import type { OpcionesFiltro, FiltrosDashboard } from '../../lib/dw-sqlite'

interface Props {
  opciones: OpcionesFiltro
  filtros: FiltrosDashboard
}

export function DashboardFilters({ opciones, filtros }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  // Ids de Comunas/Lugares (para habilitar Región/País) resueltos por nombre.
  const idComunas = opciones.modulos.find((m) => /comuna/i.test(m.nombre))?.id
  const idLugares = opciones.modulos.find((m) => /lugar/i.test(m.nombre))?.id

  const regionHabilitada = filtros.id_modulo !== undefined && filtros.id_modulo === idComunas
  const paisHabilitado = filtros.id_modulo !== undefined && filtros.id_modulo === idLugares

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

  const inputCls =
    'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 ' +
    'text-gray-700 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed'

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
        {/* Módulo — al cambiarlo se limpian región y país (dejan de aplicar) */}
        <Campo label="Módulo">
          <select
            className={inputCls}
            value={filtros.id_modulo?.toString() ?? ''}
            onChange={(e) => aplicar({ id_modulo: e.target.value || undefined, region: undefined, pais: undefined })}
          >
            <option value="">Todos</option>
            {opciones.modulos.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </Campo>

        {/* Fuente */}
        <Campo label="Fuente">
          <select
            className={inputCls}
            value={filtros.id_fuente?.toString() ?? ''}
            onChange={(e) => aplicar({ id_fuente: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {opciones.fuentes.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </Campo>

        {/* Rango de fechas */}
        <Campo label="Desde">
          <input
            type="date"
            className={inputCls}
            value={filtros.fecha_desde ?? ''}
            min={opciones.fechaMin ?? undefined}
            max={opciones.fechaMax ?? undefined}
            onChange={(e) => aplicar({ fecha_desde: e.target.value || undefined })}
          />
        </Campo>
        <Campo label="Hasta">
          <input
            type="date"
            className={inputCls}
            value={filtros.fecha_hasta ?? ''}
            min={opciones.fechaMin ?? undefined}
            max={opciones.fechaMax ?? undefined}
            onChange={(e) => aplicar({ fecha_hasta: e.target.value || undefined })}
          />
        </Campo>

        {/* Región — solo módulo Comunas */}
        <Campo label="Región">
          <select
            className={inputCls}
            disabled={!regionHabilitada}
            title={regionHabilitada ? undefined : 'Aplica al módulo Comunas'}
            value={filtros.region ?? ''}
            onChange={(e) => aplicar({ region: e.target.value || undefined })}
          >
            <option value="">Todas</option>
            {opciones.regiones.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Campo>

        {/* País — solo módulo Lugares */}
        <Campo label="País">
          <select
            className={inputCls}
            disabled={!paisHabilitado}
            title={paisHabilitado ? undefined : 'Aplica al módulo Lugares'}
            value={filtros.pais ?? ''}
            onChange={(e) => aplicar({ pais: e.target.value || undefined })}
          >
            <option value="">Todos</option>
            {opciones.paises.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Campo>
      </div>
    </div>
  )
}

/** Envoltorio etiqueta + control para la barra de filtros. */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</span>
      {children}
    </label>
  )
}
