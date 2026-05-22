'use client'

/**
 * api-docs/page.tsx
 * Documentación de todos los endpoints del sistema COMUNAS_NORM.
 * Incluye el endpoint público y los endpoints de procesamiento por módulo.
 */

import { useState } from 'react'
import { Database, Copy, Check, Play, BookOpen, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// ─── Bloque de código con botón copiar ───────────────────────────────────────

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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

// ─── Etiqueta de método HTTP ──────────────────────────────────────────────────

function Badge({ method }: { method: 'GET' | 'POST' | 'DELETE' }) {
  const color = {
    GET:    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    POST:   'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
    DELETE: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  }[method]
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded ${color}`}>{method}</span>
  )
}

// ─── Cabecera de endpoint ─────────────────────────────────────────────────────

function EndpointHeader({
  method, path, title, desc, tag,
}: {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  title: string
  desc: string
  tag?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge method={method} />
        <code className="text-sm font-mono text-gray-700 dark:text-gray-300">{path}</code>
        {tag && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {tag}
          </span>
        )}
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl">{desc}</p>
    </div>
  )
}

// ─── Constantes de código ─────────────────────────────────────────────────────

const SCHEMA_NORMALIZE_REQ = `{
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

const SCHEMA_NORMALIZE_RES = `{
  "results": [
    {
      "original":   string   // Valor original sin modificar
      "normalized": string   // Valor despues del pipeline ETL
      "changed":    boolean  // true si normalized !== original
    }
  ],
  "stats": {
    "total":         number  // Total de registros recibidos
    "changed":       number  // Cuantos fueron modificados
    "duplicates":    number  // Cuantos fueron descartados por duplicados
    "qualityBefore": number  // Score de calidad original (0–100)
    "qualityAfter":  number  // Score de calidad normalizado (0–100)
  }
}`

const CURL_NORMALIZE = `curl -X POST https://sistema.franciscodev.cl/api/public/normalize \\
  -H "Content-Type: application/json" \\
  -d '{"data":["Santiago","CONCEPCION","valparaíso"],"rules":{"removeAccents":true,"titleCase":true}}'`

const FETCH_NORMALIZE = `const res = await fetch('https://sistema.franciscodev.cl/api/public/normalize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: ['Santiago', 'CONCEPCION', 'valparaíso'],
    rules: { removeAccents: true, titleCase: true },
  }),
})
const { results, stats } = await res.json()`

const SCHEMA_PROCESS_REQ = `// multipart/form-data
file        File      // Archivo .txt, .csv o .tsv
columnIndex number    // Índice de columna a procesar (default: 0)
correct     boolean   // Activar corrección fuzzy (default: false)
dryRun      boolean   // Solo previsualizar sin guardar (default: false)
rules       string    // JSON con ETLRuleSet (mismo esquema que /api/public/normalize)`

const SCHEMA_PROCESS_RES = `{
  "batchId":       string   // ID único del batch guardado
  "fileName":      string   // Nombre del archivo procesado
  "totalInput":    number   // Registros de entrada
  "totalOutput":   number   // Registros únicos de salida
  "duplicates":    number   // Duplicados eliminados
  "changes":       number   // Registros normalizados
  "corrections":   number   // Correcciones fuzzy aplicadas
  "correctionMode": boolean // Si se usó corrección ortográfica
  "qualityBefore": object | null  // Breakdown de calidad antes
  "qualityAfter":  object | null  // Breakdown de calidad después
}`

const SCHEMA_FAMOSOS_REQ = `// multipart/form-data
file   File    // Archivo .txt con formato "N. Nombre - Fecha"
rules  string  // JSON con ETLRuleSet`

const SCHEMA_FAMOSOS_RES = `{
  "batchId":        string   // ID único del batch
  "fileName":       string
  "totalInput":     number
  "totalOutput":    number   // Famosos únicos
  "duplicateCount": number
  "cumpleanosCount": number  // Famosos con fecha parseable
  "logs":           string[] // Log detallado por registro
}`

const SCHEMA_LUGARES_REQ = `// multipart/form-data
file   File    // CSV con separador ";" y coordenadas lat,lon
rules  string  // JSON con ETLRuleSet`

const SCHEMA_LUGARES_RES = `{
  "batchId":        string
  "fileName":       string
  "totalInput":     number
  "totalOutput":    number   // Lugares únicos
  "duplicateCount": number
  "logs":           string[] // Log por lugar (OK / DUPLICADO / sin georef)
}`

const SCHEMA_ANALYTICS_RES = `{
  "batches": [
    {
      "id":          string
      "fileName":    string
      "createdAt":   string   // ISO 8601
      "modulo":      "comunas" | "famosos" | "lugares"
      "totalInput":  number
      "totalOutput": number
      "duplicates":  number
      "qualityBefore": number | null
    }
  ],
  // "totals" es el nombre legado — se mantiene para compatibilidad
  "totals": {
    "totalArchivos": number
    "totalInput":    number
    "totalOutput":   number
    "totalDups":     number
    "totalChanges":  number
    "avgCalidad":    number | null
  },
  // "kpis" es la forma documentada (alias de totals con campos renombrados)
  "kpis": {
    "totalBatches":    number
    "totalInput":      number
    "totalOutput":     number
    "totalDuplicates": number
    "avgQuality":      number | null
  }
}`

const PLAYGROUND_DEFAULT = JSON.stringify(
  {
    data: ['Santiago', 'CONCEPCION', 'valparaíso', 'Santiago'],
    rules: { removeAccents: true, titleCase: true, deduplicate: true },
  },
  null, 2,
)

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [playInput, setPlayInput]   = useState(PLAYGROUND_DEFAULT)
  const [playOutput, setPlayOutput] = useState('')
  const [playLoading, setPlayLoading] = useState(false)
  const [playError, setPlayError]   = useState('')

  async function runPlayground() {
    setPlayLoading(true)
    setPlayError('')
    setPlayOutput('')
    try {
      const body = JSON.parse(playInput)
      const res  = await fetch('/api/public/normalize', {
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
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">API Docs</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-16">

        {/* ── Índice de endpoints ── */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Endpoints</h2>
          <div className="space-y-2">
            {[
              { method: 'POST' as const, path: '/api/public/normalize',  label: 'Normalizar texto',              tag: 'Público' },
              { method: 'POST' as const, path: '/api/process',           label: 'Procesar archivo de comunas',   tag: 'Interno' },
              { method: 'POST' as const, path: '/api/famosos/process',   label: 'Procesar archivo de famosos',   tag: 'Interno' },
              { method: 'POST' as const, path: '/api/lugares/process',   label: 'Procesar archivo de lugares',   tag: 'Interno' },
              { method: 'GET'  as const, path: '/api/analytics',         label: 'Métricas globales acumuladas',  tag: 'Interno' },
            ].map((e) => (
              <div key={e.path} className="flex items-center gap-3 py-1.5">
                <Badge method={e.method} />
                <code className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1">{e.path}</code>
                <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">{e.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full hidden sm:block
                  ${e.tag === 'Público'
                    ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}>
                  {e.tag}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            1. POST /api/public/normalize
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <EndpointHeader
            method="POST"
            path="/api/public/normalize"
            title="Normalizar texto"
            tag="Público — sin autenticación"
            desc="Normaliza un array de strings aplicando el pipeline ETL: eliminación de tildes, formato Title Case, deduplicación y corrección ortográfica opcional. No persiste datos. Límite: 10.000 registros por llamada."
          />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Request Body</h3>
            <CodeBlock code={SCHEMA_NORMALIZE_REQ} language="typescript" />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Response</h3>
            <CodeBlock code={SCHEMA_NORMALIZE_RES} language="typescript" />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ejemplos</h3>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">cURL</p>
            <CodeBlock code={CURL_NORMALIZE} language="bash" />
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-4">JavaScript (fetch)</p>
            <CodeBlock code={FETCH_NORMALIZE} language="javascript" />
          </div>

          {/* Reglas ETL */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Reglas ETL disponibles</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'trim',           desc: 'Quita espacios al inicio y fin. Siempre activa.' },
                { id: 'collapseSpaces', desc: 'Colapsa múltiples espacios en uno.' },
                { id: 'removeAccents',  desc: 'Elimina tildes, eñes y diacríticos.' },
                { id: 'titleCase',      desc: 'Capitaliza la primera letra de cada palabra.' },
                { id: 'deduplicate',    desc: 'Descarta registros duplicados.' },
                { id: 'fuzzyCorrect',   desc: 'Corrige typos contra lista de 346 comunas INE. Desactivada por defecto.' },
                { id: 'removeEmpty',    desc: 'Descarta líneas vacías. Siempre activa.' },
              ].map((r) => (
                <div key={r.id} className="flex gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                  <code className="text-xs bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-1 rounded font-mono shrink-0 h-fit">
                    {r.id}
                  </code>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{r.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Playground */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Playground interactivo</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Edita el JSON de entrada y ejecuta el request en tiempo real.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Request body</p>
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
                  {playLoading ? <span className="animate-spin inline-block">⏳</span> : <Play className="w-4 h-4" />}
                  {playLoading ? 'Ejecutando…' : 'Ejecutar'}
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Response</p>
                <div className="min-h-[14rem] bg-gray-900 rounded-xl border border-gray-700 p-3 overflow-auto">
                  {playError
                    ? <p className="text-red-400 text-xs font-mono">{playError}</p>
                    : playOutput
                    ? <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap">{playOutput}</pre>
                    : <p className="text-gray-500 text-xs">La respuesta aparecerá aquí…</p>
                  }
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* ══════════════════════════════════════════════════════════════════════
            2. POST /api/process
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <EndpointHeader
            method="POST"
            path="/api/process"
            title="Procesar archivo de Comunas"
            tag="Interno"
            desc="Recibe un archivo de texto con nombres de comunas (txt, csv, tsv), aplica el pipeline ETL y guarda el batch en la base de datos. Devuelve estadísticas y scores de calidad."
          />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Request — multipart/form-data</h3>
            <CodeBlock code={SCHEMA_PROCESS_REQ} language="typescript" />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Response</h3>
            <CodeBlock code={SCHEMA_PROCESS_RES} language="typescript" />
          </div>
          <CodeBlock
            language="bash"
            code={`curl -X POST https://sistema.franciscodev.cl/api/process \\
  -F "file=@comunas.txt" \\
  -F "columnIndex=0" \\
  -F "correct=false" \\
  -F "dryRun=false" \\
  -F 'rules={"trim":true,"titleCase":true,"removeAccents":true,"deduplicate":true}'`}
          />
        </section>

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* ══════════════════════════════════════════════════════════════════════
            3. POST /api/famosos/process
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <EndpointHeader
            method="POST"
            path="/api/famosos/process"
            title="Procesar archivo de Famosos"
            tag="Interno"
            desc='Recibe un archivo de texto con entradas en formato "N. Nombre Completo - Fecha". Normaliza las fechas, detecta cumpleaños y deduplica. Guarda el batch y devuelve logs detallados.'
          />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Request — multipart/form-data</h3>
            <CodeBlock code={SCHEMA_FAMOSOS_REQ} language="typescript" />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Response</h3>
            <CodeBlock code={SCHEMA_FAMOSOS_RES} language="typescript" />
          </div>
          <CodeBlock
            language="bash"
            code={`curl -X POST https://sistema.franciscodev.cl/api/famosos/process \\
  -F "file=@famosos.txt" \\
  -F 'rules={"trim":true,"titleCase":true,"removeAccents":true,"deduplicate":true}'`}
          />
        </section>

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* ══════════════════════════════════════════════════════════════════════
            4. POST /api/lugares/process
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <EndpointHeader
            method="POST"
            path="/api/lugares/process"
            title="Procesar archivo de Lugares turísticos"
            tag="Interno"
            desc='Recibe un CSV separado por ";" con columnas nombre;dirección;lat,lon en encoding Windows-1252. Normaliza coordenadas, deduplica y guarda georeferencias.'
          />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Request — multipart/form-data</h3>
            <CodeBlock code={SCHEMA_LUGARES_REQ} language="typescript" />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Response</h3>
            <CodeBlock code={SCHEMA_LUGARES_RES} language="typescript" />
          </div>
          <CodeBlock
            language="bash"
            code={`curl -X POST https://sistema.franciscodev.cl/api/lugares/process \\
  -F "file=@lugares.csv" \\
  -F 'rules={"trim":true,"titleCase":true,"removeAccents":true,"deduplicate":true}'`}
          />
        </section>

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* ══════════════════════════════════════════════════════════════════════
            5. GET /api/analytics
        ══════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <EndpointHeader
            method="GET"
            path="/api/analytics"
            title="Métricas globales acumuladas"
            tag="Interno"
            desc="Retorna todos los batches de los tres módulos (comunas, famosos, lugares) con sus estadísticas, más KPIs globales acumulados."
          />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Response</h3>
            <CodeBlock code={SCHEMA_ANALYTICS_RES} language="typescript" />
          </div>
          <CodeBlock
            language="bash"
            code="curl https://sistema.franciscodev.cl/api/analytics"
          />
        </section>

      </main>
    </div>
  )
}
