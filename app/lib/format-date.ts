/**
 * format-date.ts
 * Utilidad compartida para formatear fechas ISO a string legible en español.
 * B-06: extraída de FamososBatchHistory y LugaresBatchHistory para evitar duplicación.
 */

/**
 * Formatea una fecha ISO 8601 a string legible en español (Chile).
 * Ejemplo: "2024-03-14T15:09:26.535Z" → "14/03/2024, 15:09"
 */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
