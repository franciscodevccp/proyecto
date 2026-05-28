'use client'

/**
 * LugaresMap.tsx
 * Mapa interactivo Leaflet que muestra TODOS los lugares georeferenciados.
 * Usa MarkerClusterGroup para agrupar marcadores y soportar cientos de puntos.
 *
 * Funcionalidades:
 * - Todos los marcadores sin límite
 * - Clustering automático al alejar el zoom
 * - Botón "Ir a este lugar" en cada popup — abre Google Maps con las coordenadas
 * - Buscador sobre el mapa que filtra markers en tiempo real
 * - Ajuste automático de zoom para encuadrar todos los markers
 *
 * IMPORTANTE: Importar siempre con { ssr: false } desde lugares/page.tsx
 */

import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, useMap }       from 'react-leaflet'
import L                                          from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import { MapPin, Loader2, Search, X, Navigation } from 'lucide-react'

/** Estructura del georef recibida de la API */
interface LugarGeorefRaw {
  latitud: number
  longitud: number
}

/** Estructura de la dirección (solo campos necesarios para el popup) */
interface LugarDireccionRaw {
  ciudadEstadoProvincia: string | null
  pais: string | null
}

/** Estructura de un lugar tal como llega de /api/lugares/batch */
export interface LugarRaw {
  id:        string
  nombre:    string
  georef:    LugarGeorefRaw | null
  direccion: LugarDireccionRaw | null
}

/** Respuesta de la API de batch de lugares */
interface LugarBatchResponse {
  batch: { lugares: LugarRaw[] }
}

/** Punto simplificado listo para el mapa */
interface PuntoMapa {
  id:     string
  nombre: string
  lat:    number
  lon:    number
  pais:   string | null
  ciudad: string | null
}

// ─── Subcomponente: ajuste de bounds ──────────────────────────────────────────

function FitBounds({ puntos }: { puntos: PuntoMapa[] }) {
  const map = useMap()
  useEffect(() => {
    if (!puntos.length) return
    if (puntos.length === 1) { map.setView([puntos[0].lat, puntos[0].lon], 12); return }
    map.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lon] as L.LatLngTuple)), { padding: [48, 48] })
  }, [map, puntos])
  return null
}

// ─── Subcomponente: capa de clusters ──────────────────────────────────────────

function ClusterLayer({ puntos, icono }: { puntos: PuntoMapa[]; icono: L.DivIcon }) {
  const map        = useMap()
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    if (clusterRef.current) map.removeLayer(clusterRef.current)

    // Accedemos al namespace de markerClusterGroup mediante cast tipado
    const cluster = (L as unknown as { markerClusterGroup: (opts: object) => L.MarkerClusterGroup })
      .markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 60, chunkedLoading: true })

    puntos.forEach((p) => {
      const googleMapsUrl = `https://maps.google.com/?q=${p.lat},${p.lon}`
      const popup = `
        <div style="font-family:sans-serif;min-width:190px;padding:2px">
          <p style="font-weight:700;font-size:14px;margin:0 0 4px">${p.nombre}</p>
          ${p.ciudad || p.pais
            ? `<p style="color:#6b7280;font-size:12px;margin:0 0 6px">${[p.ciudad, p.pais].filter(Boolean).join(', ')}</p>`
            : ''}
          <p style="color:#9ca3af;font-family:monospace;font-size:11px;margin:0 0 10px">
            ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}
          </p>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer"
            style="display:inline-flex;align-items:center;gap:5px;background:#0d9488;color:white;
                   padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;
                   text-decoration:none;cursor:pointer">
            Ir a este lugar
          </a>
        </div>`
      L.marker([p.lat, p.lon], { icon: icono })
        .bindPopup(popup, { maxWidth: 260 })
        .addTo(cluster)
    })

    map.addLayer(cluster)
    clusterRef.current = cluster
    return () => { if (clusterRef.current) { map.removeLayer(clusterRef.current); clusterRef.current = null } }
  }, [map, puntos, icono])

  return null
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * LugaresMap acepta batchId para hacer fetch propio,
 * o lugares directamente para compatibilidad con el uso anterior.
 */
interface LugaresMapPropsConBatch { batchId: string;      lugares?: never }
interface LugaresMapPropsConLugares { lugares: LugarRaw[] | null; batchId?: never }
type LugaresMapProps = LugaresMapPropsConBatch | LugaresMapPropsConLugares

export default function LugaresMap(props: LugaresMapProps) {
  const [todos,    setTodos]    = useState<PuntoMapa[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Modo 1: se pasa batchId — el componente hace el fetch
    if (props.batchId) {
      const ctrl = new AbortController()
      fetch(`/api/lugares/batch?id=${props.batchId}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: LugarBatchResponse) => {
          setTodos(
            (d.batch?.lugares ?? [])
              .filter((l) => l.georef !== null)
              .map((l) => ({
                id:     l.id,
                nombre: l.nombre,
                lat:    l.georef!.latitud,
                lon:    l.georef!.longitud,
                pais:   l.direccion?.pais ?? null,
                ciudad: l.direccion?.ciudadEstadoProvincia ?? null,
              }))
          )
        })
        .catch((e: unknown) => { if (e instanceof Error && e.name !== 'AbortError') console.error('[LugaresMap]', e) })
        .finally(() => setCargando(false))
      return () => ctrl.abort()
    }

    // Modo 2: se pasan lugares directamente (compatibilidad hacia atrás)
    const lista = props.lugares
    if (lista === null || lista === undefined) {
      // null indica que el padre aún está cargando
      setCargando(lista === null)
      return
    }
    setTodos(
      lista
        .filter((l) => l.georef !== null)
        .map((l) => ({
          id:     l.id,
          nombre: l.nombre,
          lat:    l.georef!.latitud,
          lon:    l.georef!.longitud,
          pais:   l.direccion?.pais ?? null,
          ciudad: l.direccion?.ciudadEstadoProvincia ?? null,
        }))
    )
    setCargando(false)
  }, [props.batchId, props.lugares])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return todos
    return todos.filter((p) =>
      p.nombre.toLowerCase().includes(q) ||
      (p.pais ?? '').toLowerCase().includes(q) ||
      (p.ciudad ?? '').toLowerCase().includes(q)
    )
  }, [todos, busqueda])

  const icono = useMemo(() => L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill="#0d9488" stroke="white" stroke-width="1.2"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>`,
    className: '', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28],
  }), [])

  // Estado: cargando
  if (cargando) return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-32 flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
      <span className="text-sm text-gray-400">Cargando mapa...</span>
    </div>
  )

  // Estado: sin georef
  if (!todos.length) return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
      <MapPin className="w-6 h-6 opacity-40" />
      <p className="text-sm">Ningun lugar tiene georeferencia en este batch</p>
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mapa de lugares</span>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Navigation className="w-3 h-3" /> Haz clic en un marker para ir al lugar
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar lugar..."
            className="pl-8 pr-7 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg focus:outline-none focus:border-teal-400 w-44"
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} aria-label="Limpiar" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {filtrados.length === todos.length ? `${todos.length} lugares` : `${filtrados.length} / ${todos.length}`}
        </span>
      </div>
      <div className="h-[480px] w-full">
        <MapContainer center={[20, 0]} zoom={2} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap contributors &copy; CARTO'
            maxZoom={19}
          />
          <FitBounds puntos={filtrados} />
          <ClusterLayer puntos={filtrados} icono={icono} />
        </MapContainer>
      </div>
    </div>
  )
}
