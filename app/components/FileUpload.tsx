'use client'

/**
 * FileUpload.tsx
 * Carga de archivos con drag & drop.
 * Soporta .txt, .csv y .tsv. Si hay multiples columnas muestra ColumnSelector.
 * Incluye RulesConfig para configurar las reglas ETL del pipeline.
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { parseContent, type ParseResult } from '../lib/parser'
import { DEFAULT_RULESET, type ETLRuleSet } from '../lib/etl-rules'
import type { QualityBreakdown } from '../lib/quality-score'
import ColumnSelector from './ColumnSelector'
import RulesConfig from './RulesConfig'

interface FileUploadProps {
  onResult: (data: ProcessResponse) => void
  /** Callback opcional: se llama cuando el archivo parece ser de otro módulo */
  onWrongModule?: (modulo: 'famosos' | 'lugares') => void
}

/**
 * Analiza las primeras líneas del archivo y determina si corresponde
 * a otro módulo (famosos o lugares) en lugar de comunas.
 *
 * Famosos:  líneas con formato "N. Nombre - fecha"
 * Lugares:  líneas con separador ";" y coordenadas lat,lon
 * Retorna null si parece un archivo de comunas o es indeterminado.
 */
function detectarModuloEquivocado(texto: string): 'famosos' | 'lugares' | null {
  const lineas = texto.split('\n').map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 20)
  if (lineas.length < 2) return null

  // Famosos: "1. Nombre Apellido - fecha"
  const patronFamoso = /^\d+\.\s+\S.+\s+-\s+.{3,}/
  const coincidenciasFamoso = lineas.filter((l) => patronFamoso.test(l)).length
  if (coincidenciasFamoso >= Math.min(3, Math.ceil(lineas.length * 0.5))) return 'famosos'

  // Lugares: CSV con ";" y coordenadas decimales (lat,lon)
  const patronCoords = /;.*-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+/
  const coincidenciasLugar = lineas.filter((l) => patronCoords.test(l)).length
  if (coincidenciasLugar >= 2) return 'lugares'

  return null
}

/** Respuesta del endpoint /api/process */
export interface ProcessResponse {
  batchId: string
  totalInput: number
  totalOutput: number
  duplicates: number
  changes: number
  corrections: number
  correctionMode: boolean
  fileName: string
  qualityBefore: QualityBreakdown | null
  qualityAfter: QualityBreakdown | null
  dryRun?: boolean
  preview?: { original: string; normalized: string; changeType: string }[]
  noEncontrados?: number
}

export default function FileUpload({ onResult, onWrongModule }: FileUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado del archivo seleccionado antes de enviar
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [selectedColumn, setSelectedColumn] = useState(0)

  // Reglas ETL configuradas por el usuario
  const [rules, setRules] = useState<ETLRuleSet>(DEFAULT_RULESET)

  /**
   * Al soltar o seleccionar un archivo, se lee y parsea localmente
   * para detectar columnas antes de enviarlo al servidor.
   */
  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted[0]
    if (!file) return
    setError(null)
    setPendingFile(file)
    setSelectedColumn(0)

    // Leer el archivo en el cliente para detectar columnas (solo los primeros 50 KB)
    const slice = file.slice(0, 50 * 1024)
    const text = await slice.text()

    // Detectar si el archivo pertenece a otro módulo antes de continuar
    if (onWrongModule) {
      const moduloDetectado = detectarModuloEquivocado(text)
      if (moduloDetectado) {
        onWrongModule(moduloDetectado)
        return // no cargar el archivo en esta página
      }
    }

    const result = parseContent(text, { columnIndex: 0 })
    setParsed(result)
  }, [onWrongModule])

  /** Envia el archivo al servidor con todos los parametros configurados */
  async function handleSubmit() {
    if (!pendingFile) return
    setLoading(true)
    setError(null)

    try {
      const form = new FormData()
      form.append('file', pendingFile)
      form.append('columnIndex', String(selectedColumn))
      form.append('correct', String(rules['fuzzyCorrect'] ?? false))
      form.append('dryRun', 'false')
      form.append('rules', JSON.stringify(rules))

      const res = await fetch('/api/process', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error procesando el archivo')
      }
      const data: ProcessResponse = await res.json()
      onResult(data)

      // Limpiar estado tras procesar exitosamente
      setPendingFile(null)
      setParsed(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
    },
    maxFiles: 1,
    disabled: loading,
  })

  // Mostrar selector de columna solo si hay mas de una columna detectada
  const multiColumn = parsed && parsed.columns.length > 1

  return (
    <div className="w-full space-y-3">
      {/* Zona de drop */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }
          ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          ) : (
            <Upload className="w-10 h-10 text-gray-400 dark:text-gray-500" />
          )}
          <div>
            {loading ? (
              <p className="text-blue-600 dark:text-blue-400 font-medium">Procesando…</p>
            ) : isDragActive ? (
              <p className="text-blue-600 dark:text-blue-400 font-medium">Suelta el archivo aqui</p>
            ) : (
              <>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  Arrastra tu archivo aqui
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Acepta{' '}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.txt</code>{' '}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.csv</code>{' '}
                  <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">.tsv</code>
                  {' '}— o haz clic para seleccionar
                </p>
              </>
            )}
          </div>
          {pendingFile && !loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <FileText className="w-4 h-4" />
              {pendingFile.name}
              {parsed && (
                <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                  {parsed.format.toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selector de columna (solo para CSV/TSV con multiples columnas) */}
      {multiColumn && parsed && (
        <ColumnSelector
          columns={parsed.columns}
          preview={parsed.preview}
          selected={selectedColumn}
          onChange={setSelectedColumn}
        />
      )}

      {/* Configurador de reglas ETL */}
      <RulesConfig value={rules} onChange={setRules} />

      {/* Boton de procesar (solo visible cuando hay archivo seleccionado) */}
      {pendingFile && !loading && (
        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors"
        >
          Procesar archivo
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
