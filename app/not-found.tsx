/**
 * not-found.tsx
 * Página 404 del proyecto COMUNAS_NORM.
 * Server Component — sin directiva 'use client', sin hooks.
 * El tema oscuro/claro lo aplica el script inline de app/layout.tsx
 * antes del primer render, por lo que el dark mode funciona sin useDarkMode().
 */

import Link from 'next/link'
import { Database } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">

        {/* Icono */}
        <div className="flex justify-center">
          <div className="p-5 bg-blue-100 dark:bg-blue-950 rounded-2xl">
            <Database className="w-12 h-12 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        {/* Mensaje principal */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100">
            404
          </h1>
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Página no encontrada
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            La ruta que buscas no existe en este sistema.
          </p>
        </div>

        {/* Enlace de regreso */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
