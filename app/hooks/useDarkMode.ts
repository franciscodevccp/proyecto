'use client'

/**
 * useDarkMode.ts
 * Hook para manejar el modo oscuro de la aplicacion.
 * Lee la preferencia del sistema operativo al primer render
 * y persiste el estado en localStorage para recordarlo entre sesiones.
 * Agrega o remueve la clase 'dark' en document.documentElement.
 */

import { useEffect, useState } from 'react'

const LS_KEY = 'comunas-norm:darkMode'

/**
 * Retorna [isDark, toggleDark]:
 *   - isDark: booleano con el estado actual del modo oscuro
 *   - toggleDark: funcion para alternar entre claro y oscuro
 */
export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState(false)

  // Al montar: leer preferencia guardada o detectar la del sistema
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY)
    if (stored !== null) {
      // El usuario habia elegido manualmente
      const dark = stored === 'true'
      setIsDark(dark)
      applyClass(dark)
    } else {
      // Sin preferencia guardada: usar la del sistema operativo
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(prefersDark)
      applyClass(prefersDark)
    }
  }, [])

  /** Alterna entre modo claro y oscuro y persiste la eleccion */
  function toggleDark() {
    setIsDark((prev) => {
      const next = !prev
      applyClass(next)
      localStorage.setItem(LS_KEY, String(next))
      return next
    })
  }

  return [isDark, toggleDark]
}

/** Agrega o remueve la clase 'dark' del elemento raiz del documento */
function applyClass(dark: boolean) {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}
