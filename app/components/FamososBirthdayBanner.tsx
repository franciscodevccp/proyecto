'use client'

/**
 * FamososBirthdayBanner.tsx
 * Banner animado que muestra quién cumple años HOY según la fecha del sistema.
 * Si nadie cumple hoy, muestra quién cumple próximamente y cuántos días faltan.
 * El cálculo es siempre client-side (fecha actual) para que sea preciso aunque
 * el batch haya sido procesado en otro día.
 */

import { useEffect, useState } from 'react'
import { Cake, CalendarDays } from 'lucide-react'

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

interface ProximoCumple {
  famoso: FamosoRaw
  dias: number
  mes: number
  dia: number
}

interface FamososBirthdayBannerProps {
  batchId: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extrae mes y dia de una fecha normalizada ISO (soporta fechas a.C.) */
function parseMesDia(fecha: string): { mes: number; dia: number } | null {
  // Fechas a.C.: "-0069-02-17" → slice(1) = "0069-02-17"
  const limpia = fecha.startsWith('-') ? fecha.slice(1) : fecha
  const partes = limpia.split('-')
  if (partes.length < 3) return null
  const mes = parseInt(partes[1], 10)
  const dia = parseInt(partes[2], 10)
  if (isNaN(mes) || isNaN(dia)) return null
  return { mes, dia }
}

/** Devuelve true si el mes/día coincide con hoy */
function esHoy(mes: number, dia: number): boolean {
  const hoy = new Date()
  return mes === hoy.getMonth() + 1 && dia === hoy.getDate()
}

/** Cuántos días faltan hasta el próximo cumpleaños (este año o el siguiente) */
function diasHasta(mes: number, dia: number): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const anio = hoy.getFullYear()
  let proximo = new Date(anio, mes - 1, dia)
  proximo.setHours(0, 0, 0, 0)
  if (proximo.getTime() <= hoy.getTime()) {
    proximo = new Date(anio + 1, mes - 1, dia)
  }
  return Math.round((proximo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

/** Formatea día y mes en español sin year */
function formatDiaMes(mes: number, dia: number): string {
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${dia} de ${meses[mes - 1]}`
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function FamososBirthdayBanner({ batchId }: FamososBirthdayBannerProps) {
  const [cumpleHoy, setCumpleHoy] = useState<FamosoRaw[]>([])
  const [proximo, setProximo] = useState<ProximoCumple | null>(null)
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    fetch(`/api/famosos/batch?id=${batchId}`)
      .then((r) => r.json())
      .then((d: BatchAPIResponse) => {
        const famosos: FamosoRaw[] = d.batch?.famosos ?? []

        // ── Calcular cumpleaños de hoy ──────────────────────────────────────
        const hoy: FamosoRaw[] = []
        for (const f of famosos) {
          if (!f.fechaNormalizada) continue
          const md = parseMesDia(f.fechaNormalizada)
          if (md && esHoy(md.mes, md.dia)) hoy.push(f)
        }

        if (hoy.length > 0) {
          setCumpleHoy(hoy)
          setCargado(true)
          return
        }

        // ── Calcular próximo cumpleaños ────────────────────────────────────
        let minDias = Infinity
        let candidato: ProximoCumple | null = null

        for (const f of famosos) {
          if (!f.fechaNormalizada) continue
          const md = parseMesDia(f.fechaNormalizada)
          if (!md) continue
          const dias = diasHasta(md.mes, md.dia)
          if (dias < minDias) {
            minDias = dias
            candidato = { famoso: f, dias, mes: md.mes, dia: md.dia }
          }
        }

        setProximo(candidato)
        setCargado(true)
      })
      .catch(() => setCargado(true))
  }, [batchId])

  if (!cargado) return null

  // ── Banner: cumpleaños HOY ─────────────────────────────────────────────────
  if (cumpleHoy.length > 0) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #7c3aed 100%)',
        }}
      >
        {/* Brillo animado de fondo */}
        <div className="absolute inset-0 animate-pulse"
          style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)' }}
        />

        <div className="relative flex items-start gap-4">
          {/* Icono animado */}
          <div className="p-3 rounded-xl shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Cake className="w-6 h-6 text-white" style={{ animation: 'bounce 1s infinite' }} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest mb-1"
              style={{ color: 'rgba(255,255,255,0.75)' }}>
              Cumpleanos hoy
            </p>
            <p className="text-white font-bold text-lg leading-tight">
              {cumpleHoy.map((f) => f.nombre).join(' · ')}
            </p>
            {cumpleHoy.map((f) => (
              <p key={f.id} className="font-mono text-xs mt-0.5"
                style={{ color: 'rgba(255,255,255,0.65)' }}>
                {f.fechaOriginal}
                {f.fechaNormalizada && (
                  <span style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {' '}→ {f.fechaNormalizada.substring(0, 10)}
                  </span>
                )}
              </p>
            ))}
          </div>

          {/* Año en grande */}
          <div className="shrink-0 text-right">
            <p className="font-black text-4xl leading-none"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              {new Date().getDate()}
            </p>
            <p className="text-xs font-medium"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              {['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][new Date().getMonth()]}
            </p>
          </div>
        </div>

        {/* Estilo de rebote para Cake */}
        <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      </div>
    )
  }

  // ── Banner: próximo cumpleaños ─────────────────────────────────────────────
  if (proximo) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 px-5 py-4">
        <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/50 shrink-0">
          <CalendarDays className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-purple-500 dark:text-purple-400">
            Proximo cumpleanos
          </p>
          <p className="font-semibold text-gray-800 dark:text-gray-100 truncate">
            {proximo.famoso.nombre}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
            {formatDiaMes(proximo.mes, proximo.dia)}
            {proximo.famoso.fechaNormalizada && (
              <span className="text-purple-500 dark:text-purple-400">
                {' '}· {proximo.famoso.fechaNormalizada.substring(0, 10)}
              </span>
            )}
          </p>
        </div>

        {/* Contador de días */}
        <div className="shrink-0 text-right">
          <p className="text-3xl font-black text-purple-600 dark:text-purple-400 leading-none">
            {proximo.dias}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {proximo.dias === 1 ? 'dia' : 'dias'}
          </p>
        </div>
      </div>
    )
  }

  return null
}
