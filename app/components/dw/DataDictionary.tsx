/**
 * DataDictionary.tsx
 * Diccionario de datos COMPLETO del Data Warehouse, en formato estático.
 *
 * A diferencia del StarDiagram —que revela las columnas al hacer clic—, aquí se
 * listan inline TODAS las columnas de TODAS las tablas del modelo: la ficha que
 * pide la rúbrica (Entregable 3). Es puramente presentacional y lee TABLAS de
 * dw-model.ts (la tabla de hechos + las 7 dimensiones); no hardcodea nada.
 *
 * Reusa el patrón de tablas de datawarehouse/page.tsx (MatrizBus / TablaLinaje) y
 * el patrón de claves del StarDiagram (KeyRound para PK, Link2 para FK).
 */

import { KeyRound, Link2 } from 'lucide-react'
import { TABLAS, type Tabla, type Columna } from '../../lib/dw-model'

/** Celda "Clave" de una columna: PK, FK → tabla referenciada, o vacío. */
function CeldaClave({ columna }: { columna: Columna }) {
  if (columna.esPK) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
        <KeyRound className="w-3.5 h-3.5 shrink-0" /> PK
      </span>
    )
  }
  if (columna.esFK) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
        <Link2 className="w-3.5 h-3.5 shrink-0" /> FK → {columna.refTabla}
      </span>
    )
  }
  return <span className="text-gray-300 dark:text-gray-700">—</span>
}

/** Ficha de una tabla: cabecera (nombre + tipo + grano) y tabla de columnas. */
function FichaTabla({ tabla }: { tabla: Tabla }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
      {/* Cabecera: nombre en mono, badge de tipo y —si es hecho— el grano */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h4 className="font-mono font-bold text-sm text-gray-900 dark:text-gray-100">{tabla.nombre}</h4>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          tabla.tipo === 'hecho'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }`}>
          {tabla.tipo === 'hecho' ? 'Tabla de hechos' : 'Dimensión'}
        </span>
        {tabla.conformada && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
            conformada
          </span>
        )}
        {tabla.grano && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
            <span className="font-semibold">Grano:</span> {tabla.grano}
          </span>
        )}
      </div>

      {/* Ficha de columnas (mismo patrón de tabla que MatrizBus / TablaLinaje) */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
              <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Columna</th>
              <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Tipo</th>
              <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Nullable</th>
              <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Clave</th>
              <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Origen OLTP</th>
              <th className="py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {tabla.columnas.map((col) => (
              <tr key={col.nombre} className="border-b border-gray-100 dark:border-gray-800/50 align-top">
                <td className="py-2 px-2 whitespace-nowrap">
                  <code className="text-xs font-mono text-gray-800 dark:text-gray-200">{col.nombre}</code>
                </td>
                <td className="py-2 px-2 whitespace-nowrap">
                  <code className="text-xs text-gray-500 dark:text-gray-400">{col.tipo}</code>
                </td>
                <td className="py-2 px-2 text-xs text-gray-500 dark:text-gray-400">{col.nullable ? 'Sí' : 'No'}</td>
                <td className="py-2 px-2 whitespace-nowrap"><CeldaClave columna={col} /></td>
                <td className="py-2 px-2">
                  <code className="text-xs text-purple-600 dark:text-purple-400">{col.origenOLTP ?? '—'}</code>
                </td>
                <td className="py-2 px-2 text-xs text-gray-600 dark:text-gray-400">{col.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Diccionario de datos completo: una ficha por cada tabla del modelo estrella. */
export function DataDictionary() {
  return (
    <div className="space-y-5">
      {TABLAS.map((tabla) => (
        <FichaTabla key={tabla.id} tabla={tabla} />
      ))}
    </div>
  )
}
