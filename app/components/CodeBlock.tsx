'use client'

/**
 * CodeBlock.tsx
 * Bloque de código con botón "Copiar" y etiqueta de lenguaje.
 *
 * Extraído desde api-docs/page.tsx (donde estaba inline) para reutilizarlo en la
 * página /datawarehouse (bloques SQL de las consultas OLAP) sin duplicar código.
 * Mantiene exactamente el mismo comportamiento y estilos que la versión original.
 */

import { useState, useEffect, useRef } from 'react'
import { Copy, Check } from 'lucide-react'

export function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  // B-08: guardar el timer en un ref para poder limpiarlo si el componente se desmonta
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-xs text-gray-400">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre className="text-sm p-4 bg-gray-900 text-gray-100 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  )
}
