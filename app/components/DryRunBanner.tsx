'use client'

/**
 * DryRunBanner.tsx
 * Banner amarillo de advertencia que aparece cuando se procesa en modo Dry Run.
 * Informa al usuario que los datos NO se guardaron en la base de datos
 * y ofrece el boton "Confirmar y guardar" para persistirlos.
 */

import { AlertTriangle, Save, Loader2 } from 'lucide-react'

interface DryRunBannerProps {
  /** Nombre del archivo que se proceso en modo preview */
  fileName: string
  /** Callback para confirmar y guardar los datos realmente en la BD */
  onConfirm: () => void
  /** Si el guardado definitivo esta en proceso */
  saving?: boolean
}

export default function DryRunBanner({ fileName, onConfirm, saving = false }: DryRunBannerProps) {
  return (
    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-xl px-5 py-4">
      {/* Icono de advertencia */}
      <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        {/* Titulo */}
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
          MODO PREVIEW — datos no guardados
        </p>
        {/* Descripcion */}
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          El archivo <strong>{fileName}</strong> fue procesado en modo vista previa.
          Los resultados NO se guardaron en la base de datos.
          Haz clic en "Confirmar y guardar" para persistirlos.
        </p>
      </div>

      {/* Boton de confirmacion */}
      <button
        onClick={onConfirm}
        disabled={saving}
        className="flex items-center gap-2 shrink-0 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-60
          text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? 'Guardando...' : 'Confirmar y guardar'}
      </button>
    </div>
  )
}
