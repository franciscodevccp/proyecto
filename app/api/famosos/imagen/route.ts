/**
 * api/famosos/imagen/route.ts
 * Obtiene y cachea la imagen de un famoso desde Wikipedia REST API.
 * GET /api/famosos/imagen?famosoId=X
 *
 * Flujo:
 * 1. Busca el famoso en BD — si ya tiene fotoUrl la retorna directamente (caché BD)
 * 2. Si no tiene foto — llama a Wikipedia REST API
 * 3. Guarda el resultado en BD para no repetir llamadas
 * 4. Retorna los datos con indicador de caché
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma }                    from '../../../lib/prisma'

/** Estructura del resumen que devuelve la API REST de Wikipedia */
interface WikipediaSummary {
  thumbnail?: { source: string; width: number; height: number }
  timestamp?: string
  description?: string
}

export async function GET(req: NextRequest) {
  const famosoId = req.nextUrl.searchParams.get('famosoId')
  if (!famosoId) {
    return NextResponse.json({ error: 'famosoId es requerido' }, { status: 400 })
  }

  try {
    const famoso = await prisma.famoso.findUnique({ where: { id: famosoId } })
    if (!famoso) return NextResponse.json({ error: 'Famoso no encontrado' }, { status: 404 })

    // Caché hit: foto ya almacenada en BD
    if (famoso.fotoUrl) {
      return NextResponse.json({
        fotoUrl:          famoso.fotoUrl,
        fotoFuente:       famoso.fotoFuente,
        fotoFechaCaptura: famoso.fotoFechaCaptura,
        descripcion:      null,
        cache:            true,
      })
    }

    // Caché miss: llamar a Wikipedia REST API
    let fotoUrl:          string | null = null
    let fotoFuente:       string | null = null
    let fotoFechaCaptura: Date   | null = null

    try {
      const ctrl = new AbortController()
      setTimeout(() => ctrl.abort(), 5000)

      const wikiRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(famoso.nombre)}`,
        {
          signal:  ctrl.signal,
          headers: { 'User-Agent': 'COMUNAS_NORM/1.0 (evaluacion INACAP)' },
        }
      )

      if (wikiRes.ok) {
        const data       = await wikiRes.json() as WikipediaSummary
        fotoUrl          = data.thumbnail?.source ?? null
        fotoFuente       = fotoUrl ? 'Wikipedia' : null
        fotoFechaCaptura = fotoUrl ? new Date()   : null
      }
    } catch {
      // Wikipedia no disponible — continuar sin foto
    }

    // Guardar en BD solo si se obtuvo foto
    if (fotoUrl) {
      await prisma.famoso.update({
        where: { id: famosoId },
        data: { fotoUrl, fotoFuente, fotoFechaCaptura },
      })
    }

    return NextResponse.json({ fotoUrl, fotoFuente, fotoFechaCaptura, cache: false })
  } catch (error) {
    console.error('[famosos/imagen]', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
