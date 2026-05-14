'use client'

/**
 * QualityGauge.tsx
 * Gauge semicircular SVG que muestra el score de calidad del dataset
 * antes y despues de normalizar.
 * Colores: rojo (<40), naranja (40-70), verde (>70).
 * Incluye animacion de transicion al montar y breakdown de problemas.
 */

import { useEffect, useState } from 'react'
import type { QualityBreakdown } from '../lib/quality-score'

interface QualityGaugeProps {
  /** Score de calidad del dataset ANTES de normalizar */
  before: QualityBreakdown
  /** Score de calidad del dataset DESPUES de normalizar */
  after: QualityBreakdown
}

/** Radio y dimensiones del arco SVG */
const R = 65       // radio del arco
const CX = 90      // centro X del SVG
const CY = 85      // centro Y del SVG
const STROKE = 13  // grosor del arco

/** Devuelve el color segun el score */
function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'  // verde
  if (score >= 40) return '#f97316'  // naranja
  return '#ef4444'                    // rojo
}

/** Mini-gauge individual para antes o despues */
function Gauge({ score, label }: { score: number; label: string }) {
  const [displayed, setDisplayed] = useState(0)

  // Animacion del numero del 0 al score real al montar
  useEffect(() => {
    let frame: ReturnType<typeof requestAnimationFrame>
    const start = performance.now()
    const duration = 800 // ms

    function animate(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      setDisplayed(Math.round(progress * score))
      if (progress < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [score])

  const color = scoreColor(score)
  const arcLength = 2 * Math.PI * R * 0.5 // longitud del semicirculo
  const dashOffset = arcLength - (score / 100) * arcLength

  return (
    <div className="flex flex-col items-center gap-1 w-full max-w-[180px]">
      <svg width="100%" viewBox="0 0 180 110">
        {/* Arco de fondo gris */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Arco de progreso animado via strokeDasharray */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
        {/* Numero del score en el centro */}
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          fontSize="26"
          fontWeight="bold"
          fill={color}
        >
          {displayed}
        </text>
        {/* Texto "/100" debajo del numero */}
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="11" fill="#9ca3af">
          /100
        </text>
      </svg>
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>
    </div>
  )
}

/** Fila de un problema en el breakdown */
function IssueRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-medium ${count > 0 ? 'text-red-500' : 'text-green-600'}`}>
        {count > 0 ? `${count} (${pct}%)` : '✓ ninguno'}
      </span>
    </div>
  )
}

export default function QualityGauge({ before, after }: QualityGaugeProps) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Score de calidad del dataset</h3>

      {/* Gauges lado a lado, escalan con el contenedor */}
      <div className="flex justify-around items-end mb-4 gap-2">
        <Gauge score={before.score} label={`Antes — Nota ${before.grade}`} />
        <div className="text-xl text-gray-300 dark:text-gray-600 pb-8 shrink-0">→</div>
        <Gauge score={after.score} label={`Despues — Nota ${after.grade}`} />
      </div>

      {/* Breakdown de problemas del dataset original */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-1.5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Problemas detectados (antes):</p>
        <IssueRow label="Con tildes/enies" count={before.issues.withAccents} total={before.totalRecords} />
        <IssueRow label="Capitalizacion incorrecta" count={before.issues.wrongCase} total={before.totalRecords} />
        <IssueRow label="Duplicados" count={before.issues.duplicates} total={before.totalRecords} />
        <IssueRow label="Espacios extra" count={before.issues.extraSpaces} total={before.totalRecords} />
        <IssueRow label="Lineas vacias" count={before.issues.emptyLines} total={before.totalRecords} />
      </div>
    </div>
  )
}
