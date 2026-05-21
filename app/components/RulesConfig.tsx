'use client'

/**
 * RulesConfig.tsx
 * Panel colapsable (acordeon) para configurar las reglas ETL del pipeline.
 * Muestra cada regla como un toggle. Las reglas obligatorias no se pueden desactivar.
 * Permite guardar y cargar perfiles de configuracion en localStorage.
 */

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Save, FolderOpen, Settings } from 'lucide-react'
import { AVAILABLE_RULES, DEFAULT_RULESET, type ETLRuleSet } from '../lib/etl-rules'

const LS_KEY = 'comunas-norm:etl-profile'

interface RulesConfigProps {
  /** Conjunto de reglas activo actualmente */
  value: ETLRuleSet
  /** Callback cuando el usuario cambia alguna regla */
  onChange: (rules: ETLRuleSet) => void
}

export default function RulesConfig({ value, onChange }: RulesConfigProps) {
  const [open, setOpen] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // Ref estable para el callback onChange — evita que el efecto de carga
  // necesite declarar onChange como dependencia (lo que causaría re-ejecuciones
  // en cada render y la advertencia de react-hooks/exhaustive-deps).
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])

  // Contar cuantas reglas opcionales estan activas
  const activeCount = AVAILABLE_RULES.filter((r) => !r.required && value[r.id]).length
  const totalOptional = AVAILABLE_RULES.filter((r) => !r.required).length

  /** Cambia el estado de una regla individual */
  function toggleRule(id: string) {
    onChange({ ...value, [id]: !value[id] })
  }

  /** Guarda el perfil actual en localStorage */
  function saveProfile() {
    localStorage.setItem(LS_KEY, JSON.stringify(value))
    setSavedMsg('Perfil guardado')
    setTimeout(() => setSavedMsg(null), 2000)
  }

  /** Carga el perfil guardado en localStorage */
  function loadProfile() {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) {
      setSavedMsg('No hay perfil guardado')
      setTimeout(() => setSavedMsg(null), 2000)
      return
    }
    try {
      const loaded = JSON.parse(raw) as ETLRuleSet
      onChange({ ...DEFAULT_RULESET, ...loaded })
      setSavedMsg('Perfil cargado')
      setTimeout(() => setSavedMsg(null), 2000)
    } catch {
      setSavedMsg('Error al cargar perfil')
      setTimeout(() => setSavedMsg(null), 2000)
    }
  }

  // Al montar el componente, intentar cargar el perfil guardado automaticamente.
  // Se usa onChangeRef.current para acceder al callback sin necesidad de declararlo
  // como dependencia — la ref siempre apunta a la versión más reciente del prop.
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    try {
      const loaded = JSON.parse(raw) as ETLRuleSet
      onChangeRef.current({ ...DEFAULT_RULESET, ...loaded })
    } catch { /* perfil guardado inválido — ignorar silenciosamente */ }
  }, []) // Sin eslint-disable: onChangeRef.current es estable

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header del acordeon */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reglas ETL</span>
          {/* Badge con cantidad de reglas activas */}
          <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
            {activeCount}/{totalOptional} activas
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {/* Contenido colapsable */}
      {open && (
        <div className="p-4 space-y-3 bg-white dark:bg-gray-900">
          {/* Lista de reglas */}
          <div className="space-y-2">
            {AVAILABLE_RULES.map((rule) => (
              <label
                key={rule.id}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                  ${value[rule.id]
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                    : 'border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                  }
                  ${rule.required ? 'opacity-75 cursor-not-allowed' : 'hover:border-blue-300 dark:hover:border-blue-700'}`}
              >
                <input
                  type="checkbox"
                  checked={value[rule.id] ?? rule.defaultEnabled}
                  onChange={() => !rule.required && toggleRule(rule.id)}
                  disabled={rule.required}
                  className="mt-0.5 w-4 h-4 accent-blue-600 shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 leading-tight">
                    {rule.label}
                    {/* Badge de obligatoria */}
                    {rule.required && (
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 font-normal">obligatoria</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{rule.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Acciones de perfil */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={saveProfile}
              className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar perfil
            </button>
            <button
              onClick={loadProfile}
              className="flex items-center gap-1.5 text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Cargar perfil
            </button>
            {/* Mensaje de confirmacion temporal */}
            {savedMsg && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">{savedMsg}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
