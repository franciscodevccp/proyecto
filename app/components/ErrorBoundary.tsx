'use client'

/**
 * ErrorBoundary.tsx
 * Componente de clase que captura errores de renderizado en su subárbol
 * y muestra un mensaje de error amigable en lugar de romper toda la página.
 *
 * Uso:
 *   <ErrorBoundary label="Timeline de famosos">
 *     <FamososTimeline batchId={batchId} />
 *   </ErrorBoundary>
 */

import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ErrorBoundaryProps {
  /** Nombre del bloque para el mensaje de error (ej. "Mapa de lugares") */
  label?: string
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: null }
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return { hasError: true, message }
  }

  /** Registra el error en consola para facilitar el diagnóstico en desarrollo */
  componentDidCatch(error: unknown, info: { componentStack: string }): void {
    console.error('[ErrorBoundary]', this.props.label ?? 'componente', error, info.componentStack)
  }

  /** Permite reintentar el renderizado del subárbol */
  private handleRetry = (): void => {
    this.setState({ hasError: false, message: null })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    const label = this.props.label ?? 'Este componente'

    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-6 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 dark:text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">
            {label} encontró un error al renderizar
          </p>
          {this.state.message && (
            <p className="text-xs text-red-500 dark:text-red-600 mt-1 font-mono">
              {this.state.message}
            </p>
          )}
        </div>
        <button
          onClick={this.handleRetry}
          className="text-xs bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }
}
