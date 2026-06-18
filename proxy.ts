/**
 * proxy.ts (antes middleware.ts — convención renombrada en Next.js 16)
 * Autenticación para todos los endpoints internos de la API.
 *
 * Rutas públicas (sin autenticación): /api/public/*
 * Todas las demás rutas /api/* requieren el header x-internal-secret
 * cuyo valor debe coincidir con la variable de entorno INTERNAL_API_SECRET.
 *
 * Si INTERNAL_API_SECRET no está definida (ej. desarrollo local sin .env),
 * la verificación se omite completamente para no bloquear el entorno de dev.
 *
 * Agrega en tu .env de producción:
 *   INTERNAL_API_SECRET=change-me-in-production
 */

import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest): NextResponse {
  const secret = process.env.INTERNAL_API_SECRET

  // Sin secreto configurado → modo desarrollo, omitir verificación
  if (!secret) return NextResponse.next()

  const incoming = req.headers.get('x-internal-secret')
  if (incoming !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  // Aplica solo a rutas /api/* excluyendo /api/public/*
  matcher: ['/api/((?!public/).*)'],
}
