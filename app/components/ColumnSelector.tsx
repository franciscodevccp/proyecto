'use client'

/**
 * ColumnSelector.tsx
 * Mini-panel que aparece cuando un archivo CSV/TSV tiene mas de una columna.
 * Muestra un preview de las primeras 3 filas y permite elegir cual columna normalizar.
 */

interface ColumnSelectorProps {
  /** Nombres de columnas detectados (encabezados o "Columna N") */
  columns: string[]
  /** Primeras 3 filas de datos para previsualizar el contenido de cada columna */
  preview: string[][]
  /** Indice de la columna actualmente seleccionada */
  selected: number
  /** Callback al cambiar la seleccion */
  onChange: (index: number) => void
}

export default function ColumnSelector({
  columns,
  preview,
  selected,
  onChange,
}: ColumnSelectorProps) {
  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 space-y-3">
      {/* Encabezado explicativo */}
      <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
        Se detectaron {columns.length} columnas. Elige cual normalizar:
      </p>

      {/* Tabla de preview con radio buttons por columna */}
      <div className="overflow-x-auto rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900">
        <table className="w-full text-xs">
          <thead className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
            <tr>
              {/* Columna de seleccion */}
              <th className="px-3 py-2 text-center w-10"></th>
              {columns.map((col, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100 dark:divide-blue-900">
            {preview.map((row, ri) => (
              <tr key={ri} className="hover:bg-blue-50 dark:hover:bg-blue-950">
                {/* Solo la primera fila tiene el radio button visible por columna */}
                {ri === 0 ? (
                  <td className="px-3 py-2" rowSpan={preview.length}>
                    <div className="flex flex-col gap-2 items-center">
                      {columns.map((_, ci) => (
                        <input
                          key={ci}
                          type="radio"
                          name="column-select"
                          checked={selected === ci}
                          onChange={() => onChange(ci)}
                          className="accent-blue-600 w-4 h-4"
                        />
                      ))}
                    </div>
                  </td>
                ) : null}
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-2 font-mono ${
                      selected === ci
                        ? 'text-blue-800 dark:text-blue-200 font-semibold bg-blue-50 dark:bg-blue-950'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {cell || <span className="text-gray-300 dark:text-gray-600 italic">vacio</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirmacion de seleccion activa */}
      <p className="text-xs text-blue-600 dark:text-blue-400">
        Columna seleccionada: <strong>{columns[selected]}</strong>
      </p>
    </div>
  )
}
