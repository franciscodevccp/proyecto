'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Loader2 } from 'lucide-react'

interface FileUploadProps {
  onResult: (data: ProcessResponse) => void
}

export interface ProcessResponse {
  batchId: string
  totalInput: number
  totalOutput: number
  duplicates: number
  changes: number
  fileName: string
}

export default function FileUpload({ onResult }: FileUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

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
    [onResult],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/plain': ['.txt'] },
    maxFiles: 1,
    disabled: loading,
  })

  return (
    <div className="w-full">
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
              <p className="text-blue-600 font-medium">Suelta el archivo aquí</p>
            ) : (
              <>
                <p className="font-medium text-gray-700">
                  Arrastra tu archivo <span className="text-blue-600">.txt</span> aquí
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
      {error && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}
    </div>
  )
}
