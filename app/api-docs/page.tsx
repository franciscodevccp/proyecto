'use client'

/**
 * api-docs/page.tsx
 * Documentacion interactiva del endpoint publico /api/public/normalize.
 * Incluye: descripcion, schemas, ejemplos cURL y fetch, y un playground en vivo.
 */

import { useState } from 'react'
import { Database, Copy, Check, Play, BookOpen } from 'lucide-react'
import Link from 'next/link'

/** Bloque de codigo con boton copiar */
function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
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
      <pre className="text-sm p-4 bg-gray-900 text-gray-100 overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
    </div>
  )
}

const EXAMPLE_REQUEST = JSON.stringify(
  {
    data: ['Santiago', 'CONCEPCION', 'valparaíso', 'Santiago'],
    rules: { removeAccents: true, titleCase: true, deduplicate: true },
  },
  null,
  2,
)

const CURL_EXAMPLE = `curl -X POST https://sistema.franciscodev.cl/api/public/normalize \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ data: ['Santiago', 'CONCEPCION'], rules: { removeAccents: true } })}'`

const FETCH_EXAMPLE = `const response = await fetch('/api/public/normalize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: ['Santiago', 'CONCEPCION', 'valparaíso'],
    rules: { removeAccents: true, titleCase: true },
  }),
})
const result = await response.json()
console.log(result.results) // [{ original, normalized, changed }, ...]`

const SCHEMA_REQUEST = `{
  "data":  string[]        // Array de strings a normalizar (max 10.000)
  "rules": {               // Opcional — todas activas por defecto
    "trim":           boolean  // Eliminar espacios extremos
    "collapseSpaces": boolean  // Colapsar espacios multiples
    "removeAccents":  boolean  // Eliminar tildes y diacriticos
    "titleCase":      boolean  // Formato Title Case
    "deduplicate":    boolean  // Eliminar duplicados
    "fuzzyCorrect":   boolean  // Correccion ortografica (fuzzy matching)
  }
}`

const SCHEMA_RESPONSE = `{
  "results": [
    {
      "original":   string   // Valor original sin modificar
      "normalized": string   // Valor despues del pipeline ETL
      "changed":    boolean  // true si normalized !== original
    }
  ],
  "stats": {
    "total":        number  // Total de registros recibidos
    "changed":      number  // Cuantos fueron modificados
    "duplicates":   number  // Cuantos fueron descartados por duplicados
    "qualityBefore": number // Score de calidad original (0-100)
    "qualityAfter":  number // Score de calidad normalizado (0-100)
  }
}`

export default function ApiDocsPage() {
  const [playInput, setPlayInput] = useState(EXAMPLE_REQUEST)
  const [playOutput, setPlayOutput] = useState('')
  const [playLoading, setPlayLoading] = useState(false)
  const [playError, setPlayError] = useState('')

  /** Ejecuta el request en vivo con el JSON del playground */
  async function runPlayground() {
    setPlayLoading(true)
    setPlayError('')
    setPlayOutput('')
    try {
      const body = JSON.parse(playInput)
      const res = await fetch('/api/public/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      setPlayOutput(JSON.stringify(data, null, 2))
    } catch (e) {
      setPlayError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setPlayLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
            <Database className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900 dark:text-gray-100">COMUNAS_NORM</span>
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">API Docs</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Hero */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">POST</span>
            <code className="text-sm font-mono text-gray-700 dark:text-gray-300">/api/public/normalize</code>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            API de Normalizacion de Texto
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed max-w-2xl">
            Normaliza un array de strings aplicando el pipeline ETL: eliminacion de tildes,
            formato Title Case, deduplicacion y correccion ortografica opcional.
            No requiere autenticacion. No persiste datos. Limite: 10.000 registros por llamada.
          </p>
        </div>

        {/* Schema Request */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Request Body</h2>
          <CodeBlock code={SCHEMA_REQUEST} language="typescript" />
        </section>

        {/* Schema Response */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Response</h2>
          <CodeBlock code={SCHEMA_RESPONSE} language="typescript" />
        </section>

        {/* Ejemplos */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Ejemplos</h2>
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">cURL</p>
            <CodeBlock code={CURL_EXAMPLE} language="bash" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4">JavaScript (fetch)</p>
            <CodeBlock code={FETCH_EXAMPLE} language="javascript" />
          </div>
        </section>

        {/* Reglas disponibles */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">Reglas ETL disponibles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { id: 'trim', label: 'trim', desc: 'Quita espacios al inicio y fin. Siempre activa.' },
              { id: 'collapseSpaces', label: 'collapseSpaces', desc: 'Colapsa multiples espacios en uno.' },
              { id: 'removeAccents', label: 'removeAccents', desc: 'Elimina tildes, enies y diacriticos.' },
              { id: 'titleCase', label: 'titleCase', desc: 'Capitaliza la primera letra de cada palabra.' },
              { id: 'deduplicate', label: 'deduplicate', desc: 'Descarta registros duplicados.' },
              { id: 'fuzzyCorrect', label: 'fuzzyCorrect', desc: 'Corrige typos contra lista de 346 comunas INE. Desactivada por defecto.' },
              { id: 'removeEmpty', label: 'removeEmpty', desc: 'Descarta lineas vacias. Siempre activa.' },
            ].map((rule) => (
              <div key={rule.id} className="flex gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <code className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded font-mono shrink-0 h-fit">
                  {rule.label}
                </code>
                <p className="text-xs text-gray-500 dark:text-gray-400">{rule.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Playground interactivo */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            Playground interactivo
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Edita el JSON de entrada y ejecuta el request en tiempo real.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Input */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Request body</p>
              <textarea
                value={playInput}
                onChange={(e) => setPlayInput(e.target.value)}
                rows={14}
                className="w-full font-mono text-xs p-3 bg-gray-900 text-gray-100 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500 resize-none"
                spellCheck={false}
              />
              <button
                onClick={runPlayground}
                disabled={playLoading}
                className="flex items-center gap-2 w-full justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                {playLoading
                  ? <span className="animate-spin">⏳</span>
                  : <Play className="w-4 h-4" />
                }
                {playLoading ? 'Ejecutando...' : 'Ejecutar'}
              </button>
            </div>

            {/* Output */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Response</p>
              <div className="min-h-[14rem] bg-gray-900 rounded-xl border border-gray-700 p-3 overflow-auto">
                {playError ? (
                  <p className="text-red-400 text-xs font-mono">{playError}</p>
                ) : playOutput ? (
                  <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap">{playOutput}</pre>
                ) : (
                  <p className="text-gray-500 text-xs">La respuesta aparecera aqui...</p>
                )}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
