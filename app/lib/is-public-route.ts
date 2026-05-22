/**
 * is-public-route.ts
 * Utilidad para identificar si una ruta de la API es pública (sin autenticación).
 *
 * Rutas públicas: cualquier pathname que comience con /api/public/
 * Todas las demás rutas /api/* son internas y requieren autenticación
 * mediante el header x-internal-secret (ver middleware.ts).
 */

/**
 * Devuelve true si el pathname dado corresponde a un endpoint público
 * que no requiere autenticación.
 *
 * @param pathname - El pathname de la URL (ej. "/api/public/normalize")
 */
export function isPublicRoute(pathname: string): boolean {
  return pathname.startsWith('/api/public/')
}
