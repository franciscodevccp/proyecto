'use client'

/**
 * LugaresMap.tsx
 * Mapa interactivo Leaflet que muestra los lugares georeferenciados de un batch.
 * Usa tiles gratuitos de CartoDB (sin API key).
 * Se importa siempre con { ssr: false } para evitar errores de window en Next.js.
 *
 * Limitado a MAX_PUNTOS marcadores por rendimiento.
 * Ajusta el zoom automaticamente para encuadrar todos los marcadores.
 */

import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Loader2 } from 'lucide-react'

/** Maximo de pines a mostrar en el mapa */
const MAX_PUNTOS = 60

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Estructura del georef recibida de la API */
interface LugarGeoref {
  latitud: number
  longitud: number
}

/** Estructura de la dirección (solo campos necesarios para el popup) */
interface LugarDireccion {
  ciudadEstadoProvincia: string | null
  pais: string | null
}

/** Estructura de un lugar tal como llega de /api/lugares/batch */
interface LugarRaw {
  id: string
  nombre: string
  georef: LugarGeoref | null
  direccion: LugarDireccion | null
}

/** Respuesta del endpoint GET /api/lugares/batch?id=X */
interface BatchAPIResponse {
  batch: {
    lugares: LugarRaw[]
  }
}

/** Punto simplificado listo para el mapa */
interface PuntoMapa {
  id: string
  nombre: string
  lat: number
  lon: number
  pais: string | null
  ciudad: string | null
}

// ─── Subcomponente: ajuste de bounds ──────────────────────────────────────────

/**
 * FitBounds — se monta dentro del MapContainer para acceder al mapa via useMap()
 * y ajustar el zoom/centro cuando cambia la lista de puntos.
 */
function FitBounds({ puntos }: { puntos: PuntoMapa[] }) {
  const map = useMap()

  useEffect(() => {
    if (puntos.length === 0) return
    if (puntos.length === 1) {
      map.setView([puntos[0].lat, puntos[0].lon], 12)
      return
    }
    const bounds = L.latLngBounds(
      puntos.map((p) => [p.lat, p.lon] as L.LatLngTuple),
    )
    map.fitBounds(bounds, { padding: [48, 48] })
  }, [map, puntos])

  return null
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface LugaresMapProps {
  /** ID del batch cuyos lugares se van a mostrar */
  batchId: string
}

export default function LugaresMap({ batchId }: LugaresMapProps) {
  const [puntos, setPuntos] = useState<PuntoMapa[]>([])
  const [totalConGeoref, setTotalConGeoref] = useState(0)
  const [cargando, setCargando] = useState(true)

  // Cargar lugares del batch y filtrar los que tienen georef
  useEffect(() => {
    setCargando(true)
    fetch(`/api/lugares/batch?id=${batchId}`)
      .then((r) => r.json())
      .then((d: BatchAPIResponse) => {
        const lugares: LugarRaw[] = d.batch?.lugares ?? []
        const conGeoref = lugares.filter((l) => l.georef !== null)
        setTotalConGeoref(conGeoref.length)

        const mapeados: PuntoMapa[] = conGeoref
          .slice(0, MAX_PUNTOS)
          .map((l) => ({
            id: l.id,
            nombre: l.nombre,
            lat: l.georef!.latitud,
            lon: l.georef!.longitud,
            pais: l.direccion?.pais ?? null,
            ciudad: l.direccion?.ciudadEstadoProvincia ?? null,
          }))

        setPuntos(mapeados)
      })
      .catch(() => {
        // Silenciar error de red — el mapa simplemente no mostrara puntos
        setPuntos([])
      })
      .finally(() => setCargando(false))
  }, [batchId])

  // Icono SVG teal personalizado — evita el bug de Leaflet con webpack
  const markerIcon = useMemo(
    () =>
      L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="#0d9488" stroke="white" stroke-width="1"/>
          <circle cx="12" cy="9" r="2.5" fill="white"/>
        </svg>`,
        className: '',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30],
      }),
    [],
  )

  // ── Estado: cargando ──────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-32 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando mapa…</span>
        </div>
      </div>
    )
  }

  // ── Estado: sin georef ─────────────────────────────────────────────────────
  if (puntos.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
        <MapPin className="w-6 h-6 opacity-40" />
        <p className="text-sm">Ningún lugar tiene georeferencia en este batch</p>
      </div>
    )
  }

  // ── Mapa ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">

      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Mapa de georeferencias
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {puntos.length === totalConGeoref
            ? `${puntos.length} lugar${puntos.length !== 1 ? 'es' : ''} georreferenciado${puntos.length !== 1 ? 's' : ''}`
            : `${puntos.length} de ${totalConGeoref} georreferenciados (límite ${MAX_PUNTOS})`
          }
        </span>
      </div>

      {/* Contenedor del mapa — altura fija para que Leaflet funcione */}
      <div className="h-[420px] w-full">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          className="h-full w-full"
          scrollWheelZoom
        >
          {/* Tiles CartoDB Positron — gratuito, sin API key, apariencia limpia */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxZoom={19}
          />

          {/* Ajusta el mapa para encuadrar todos los marcadores */}
          <FitBounds puntos={puntos} />

          {/* Marcadores */}
          {puntos.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lon]} icon={markerIcon}>
              <Popup maxWidth={220}>
                <div className="text-sm leading-snug">
                  <p className="font-semibold text-gray-800">{p.nombre}</p>
                  {(p.ciudad || p.pais) && (
                    <p className="text-gray-500 text-xs mt-0.5">
                      {[p.ciudad, p.pais].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-gray-400 font-mono text-xs mt-1">
                    {p.lat.toFixed(5)}, {p.lon.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  )
}
