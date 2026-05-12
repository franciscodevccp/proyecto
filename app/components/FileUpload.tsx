'use client'

/**
 * FileUpload.tsx
 * Componente de carga de archivos con soporte de drag & drop.
 * Envia el archivo al endpoint /api/process y notifica al padre con el resultado.
 * Incluye opcion de correccion ortografica por fuzzy matching contra lista INE.
 */

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Loader2, SpellCheck } from 'lucide-react'

interface FileUploadProps {
  /** Funcion llamada cuando el procesamiento termina exitosamente */
  onResult: (data: ProcessResponse) => void
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
}

export default function FileUpload({ onResult }: FileUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [withCorrection, setWithCorrection] = useState(false)

  /**
   * Maneja la caida (drop) o seleccion del archivo.
   * Envia el FormData al API y propaga el resultado al componente padre.
   */
  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0]
      if (!file) return

      setFileName(file.name)
      setError(null)
      setLoading(true)

      try {
        const form = new FormData()
        form.append('file', file)
        // Enviar la opcion de correccion ortografica al servidor
        form.append('correct', withCorrection ? 'true' : 'false')

        const res = await fetch('/api/process', { method: 'POST', body: form })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Error procesando el archivo')
        }
        const data: ProcessResponse = await res.json()
        onResult(data)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Error desconocido')
      } finally {
        setLoading(false)
      }
    },
    [onResult, withCorrection],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'] },
    maxFiles: 1,
    disabled: loading,
  })

  return (
    <div className="w-full space-y-3">
      {/* Zona de drop con estilos dinamicos segun el estado */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          {loading ? (
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          ) : (
            <Upload className="w-10 h-10 text-gray-400" />
          )}
          <div>
            {loading ? (
              <p className="text-blue-600 font-medium">Procesando {fileName}…</p>
            ) : isDragActive ? (
              <p className="text-blue-600 font-medium">Suelta el archivo aqui</p>
            ) : (
              <>
                <p className="font-medium text-gray-700">
                  Arrastra tu archivo <span className="text-blue-600">.txt</span> aqui
                </p>
                <p className="text-sm text-gray-400 mt-1">o haz clic para seleccionarlo</p>
              </>
            )}
          </div>
          {fileName && !loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FileText className="w-4 h-4" />
              {fileName}
            </div>
          )}
        </div>
      </div>

      {/* Opcion de correccion ortografica (separada del flujo principal) */}
      <label className="flex items-center gap-3 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl cursor-pointer hover:bg-purple-100 transition-colors select-none">
        <input
          type="checkbox"
          checked={withCorrection}
          onChange={(e) => setWithCorrection(e.target.checked)}
          disabled={loading}
          className="w-4 h-4 accent-purple-600"
        />
        <SpellCheck className="w-4 h-4 text-purple-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-purple-800">Correccion ortografica (experimental)</p>
          <p className="text-xs text-purple-600">
            Corrige typos comparando contra las 346 comunas oficiales del INE (fuzzy matching)
          </p>
        </div>
      </label>

      {/* Mensaje de error en caso de fallo en el procesamiento */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
