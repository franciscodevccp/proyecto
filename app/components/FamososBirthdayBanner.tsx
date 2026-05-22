'use client'

/**
 * FamososBirthdayBanner.tsx
 * Banner animado que muestra quién cumple años HOY según la fecha del sistema.
 * Si nadie cumple hoy, muestra quién cumple próximamente y cuántos días faltan.
 *
 * fechaNormalizada tiene formato DD-MM-YYYY (estándar del date-parser).
 * El cálculo es siempre client-side para que sea preciso aunque el batch
 * haya sido procesado en un día distinto.
 *
 * OPTIMIZACIÓN (Item 5): los datos llegan como prop desde famosos/page.tsx,
 * que centraliza el único fetch a /api/famosos/batch. Ya no se hace fetch aquí.
 */

import { useMemo } from 'react'
import { Cake, CalendarDays } from 'lucide-react'
import { esCumpleanosHoy, diasHastaProximoCumpleanos } from '../lib/date-parser'

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Estructura mínima de un famoso que este banner necesita */
export interface FamosoRaw {
  id: string
  nombre: string
  fechaOriginal: string
  fechaNormalizada: string | null
  fechaAprox: string | null
  edad: number | null
  esCumpleanos: boolean
}

interface ProximoCumple {
  famoso: FamosoRaw
  dias: number
  mes: number
  dia: number
}

interface FamososBirthdayBannerProps {
  /**
   * Lista de famosos del batch activo.
   * null indica que los datos aún se están cargando → el banner no renderiza nada.
   */
  famosos: FamosoRaw[] | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrae mes y día de una fecha en formato DD-MM-YYYY.
 * Ejemplo: "14-03-1879" → { dia: 14, mes: 3 }
 */
function parseMesDia(fecha: string): { mes: number; dia: number } | null {
  const partes = fecha.split('-')
  if (partes.length !== 3) return null
  const dia = parseInt(partes[0], 10) // partes[0] = DD
  const mes = parseInt(partes[1], 10) // partes[1] = MM
  if (isNaN(dia) || isNaN(mes) || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { dia, mes }
}

/** Formatea día y mes en español */
function formatDiaMes(mes: number, dia: number): string {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${dia} de ${meses[mes - 1]}`
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FamososBirthdayBanner({ famosos }: FamososBirthdayBannerProps) {
  // B-02: todos los hooks ANTES de cualquier return para respetar las Rules of Hooks.
  // Cuando famosos es null se usa array vacío como fallback seguro.
  const cumpleHoy: FamosoRaw[] = useMemo(
    () => (famosos ?? []).filter((f) => f.fechaNormalizada && esCumpleanosHoy(f.fechaNormalizada)),
    [famosos],
  )

  const proximo: ProximoCumple | null = useMemo(() => {
    if (!famosos) return null
    let minDias = Infinity
    let resultado: ProximoCumple | null = null
    for (const f of famosos) {
      if (!f.fechaNormalizada) continue
      const md = parseMesDia(f.fechaNormalizada)
      if (!md) continue
      const dias = diasHastaProximoCumpleanos(md.mes, md.dia)
      if (dias < minDias) {
        minDias = dias
        resultado = { famoso: f, dias, mes: md.mes, dia: md.dia }
      }
    }
    return resultado
  }, [famosos])

  // Mientras los datos no estén disponibles, no renderizar nada
  if (famosos === null) return null

  if (cumpleHoy.length > 0) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg,#ec4899 0%,#a855f7 50%,#7c3aed 100%)' }}
      >
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: 'radial-gradient(ellipse at 20% 50%,rgba(255,255,255,0.15) 0%,transparent 60%)' }}
        />
        <div className="relative flex items-start gap-4">
          <div className="p-3 rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Cake className="w-6 h-6 text-white" style={{ animation: 'bnc 1s infinite' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: 'rgba(255,255,255,0.75)' }}>
              Cumpleaños hoy
            </p>
            <p className="text-white font-bold text-lg leading-tight">
              {cumpleHoy.map((f) => f.nombre).join(' · ')}
            </p>
            {cumpleHoy.map((f) => (
              <p key={f.id} className="font-mono text-xs mt-0.5"
                style={{ color: 'rgba(255,255,255,0.7)' }}>
                {f.fechaOriginal}
                {f.fechaNormalizada && (
                  <span style={{ color: 'rgba(255,255,255,0.95)' }}>
                    {' '}→ {f.fechaNormalizada}
                  </span>
                )}
              </p>
            ))}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-black text-5xl leading-none" style={{ color: 'rgba(255,255,255,0.2)' }}>
              {new Date().getDate()}
            </p>
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][new Date().getMonth()]}
            </p>
          </div>
        </div>
        <style>{`@keyframes bnc{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
      </div>
    )
  }

  // ── Próximo cumpleaños ──────────────────────────────────────────────────────
  if (proximo) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 px-5 py-4">
        <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/50 shrink-0">
          <CalendarDays className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-500 dark:text-purple-400">
            Próximo cumpleaños
          </p>
          <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">
            {proximo.famoso.nombre}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
            {formatDiaMes(proximo.mes, proximo.dia)}
            {proximo.famoso.fechaNormalizada && (
              <span className="text-purple-500 dark:text-purple-400">
                {' '}· {proximo.famoso.fechaNormalizada}
              </span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-black text-purple-600 dark:text-purple-400 leading-none">
            {proximo.dias}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {proximo.dias === 1 ? 'día' : 'días'}
          </p>
        </div>
      </div>
    )
  }

  return null
}
