'use client'

/**
 * ThemeToggle.tsx
 * Botón de modo oscuro para el encabezado del dashboard (server component).
 * Aísla el uso de useDarkMode en un componente cliente pequeño, para que la
 * página /dashboard pueda seguir siendo server component.
 */

import { Sun, Moon } from 'lucide-react'
import { useDarkMode } from '../../hooks/useDarkMode'

export function ThemeToggle() {
  const [isDark, toggleDark] = useDarkMode()
  return (
    <button
      onClick={toggleDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      {isDark
        ? <Sun className="w-4 h-4 text-yellow-400" aria-hidden="true" />
        : <Moon className="w-4 h-4 text-gray-500" aria-hidden="true" />}
    </button>
  )
}
