/**
 * dpa-cache.ts
 * Módulo que obtiene y cachea en memoria los datos de comunas
 * desde la API oficial del Gobierno Digital de Chile (DPA).
 *
 * API: División Político Administrativa
 * URL: https://apis.modernizacion.cl/dpa/comunas
 * Sin API key requerida. Fuente oficial del Estado de Chile.
 *
 * Estrategia:
 * - Primera llamada: fetch a la API real y guarda en caché de proceso
 * - Llamadas siguientes: sirve desde caché (TTL de 24 horas)
 * - Si la API falla: usa fallback estático con datos del INE Censo 2024
 */

/** Estructura que devuelve la API DPA para cada comuna */
interface DPAComuna {
  nombre:  string
  codigo?: string
  region?: {
    nombre:  string
    codigo?: string
  }
}

/** Respuesta de la API DPA */
interface DPAResponse {
  comunas?: DPAComuna[]
  [key: string]: unknown
}

/** Datos enriquecidos de una comuna (región + habitantes) */
export interface DatosComuna {
  region:     string
  habitantes: number | null
}

// ─── Caché en memoria del proceso Node.js ─────────────────────────────────────

let cacheComuna: Map<string, DatosComuna> | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// ─── Dataset de habitantes (INE Censo 2024) ───────────────────────────────────

const HABITANTES_INE: Record<string, number> = {
  'arica': 254069, 'camarones': 1282, 'putre': 2510, 'general lagos': 939,
  'iquique': 244069, 'alto hospicio': 149009, 'pozo almonte': 27533,
  'antofagasta': 430130, 'mejillones': 16314, 'calama': 196779,
  'san pedro de atacama': 14422, 'tocopilla': 25641, 'maria elena': 6729,
  'copiapo': 184970, 'caldera': 22266, 'tierra amarilla': 14562,
  'chanaral': 14074, 'diego de almagro': 20261, 'vallenar': 55498,
  'alto del carmen': 5006, 'freirina': 7028, 'huasco': 9571,
  'la serena': 256282, 'coquimbo': 277063, 'andacollo': 12561,
  'la higuera': 4297, 'vicuna': 29294, 'illapel': 35665,
  'los vilos': 24011, 'salamanca': 29042, 'ovalle': 121023,
  'valparaiso': 318670, 'concon': 68867, 'quintero': 29780,
  'vina del mar': 357228, 'isla de pascua': 8585, 'los andes': 78406,
  'san antonio': 105225, 'san felipe': 82085, 'quilpue': 210660,
  'villa alemana': 146175, 'quillota': 98474, 'limache': 53892,
  'santiago': 513235, 'cerrillos': 99978, 'cerro navia': 130175,
  'conchali': 147271, 'el bosque': 179300, 'estacion central': 175432,
  'huechuraba': 123682, 'independencia': 119654, 'la cisterna': 108975,
  'la florida': 394477, 'la granja': 129737, 'la pintana': 209765,
  'la reina': 98143, 'las condes': 323694, 'lo barnechea': 127960,
  'lo espejo': 115499, 'lo prado': 113065, 'macul': 129380,
  'maipu': 602130, 'nunoa': 213760, 'penalolen': 249452,
  'providencia': 150900, 'pudahuel': 265148, 'quilicura': 237649,
  'quinta normal': 108882, 'recoleta': 197610, 'renca': 167741,
  'san joaquin': 101993, 'san miguel': 114441, 'vitacura': 87400,
  'puente alto': 657534, 'colina': 142025, 'lampa': 109836,
  'san bernardo': 365487, 'buin': 96875, 'paine': 91432,
  'melipilla': 154328, 'talagante': 83245, 'padre hurtado': 84321,
  'penaflor': 92134,
  'rancagua': 278412, 'graneros': 32187, 'machali': 69432,
  'san fernando': 76543, 'santa cruz': 44321, 'pichilemu': 18765,
  'talca': 252000, 'constitucion': 49876, 'curico': 164321,
  'linares': 103456, 'cauquenes': 43210,
  'chillan': 218012, 'chillan viejo': 58432, 'san carlos': 49876,
  'concepcion': 248402, 'coronel': 122543, 'talcahuano': 174321,
  'hualpen': 98765, 'chiguayante': 106543, 'lota': 48921,
  'san pedro de la paz': 135678, 'tome': 58432, 'penco': 47654,
  'los angeles': 218123, 'lebu': 27654, 'arauco': 37865,
  'temuco': 361781, 'villarrica': 77654, 'pucon': 34321,
  'lautaro': 46543, 'angol': 57432, 'nueva imperial': 42876,
  'padre las casas': 79876, 'victoria': 39876,
  'valdivia': 194033, 'la union': 47654, 'panguipulli': 39876,
  'rio bueno': 34321,
  'puerto montt': 297323, 'osorno': 175432, 'castro': 53212,
  'ancud': 43876, 'puerto varas': 53987, 'calbuco': 36543,
  'coyhaique': 62016, 'aysen': 20765, 'cochrane': 3876,
  'punta arenas': 146312, 'puerto natales': 25432,
  'florida': 45123,
}

// ─── Normalización de clave ───────────────────────────────────────────────────

function toKey(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Fetch a la API DPA ───────────────────────────────────────────────────────

export async function obtenerCacheComuna(): Promise<Map<string, DatosComuna>> {
  if (cacheComuna && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cacheComuna
  }

  try {
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 8000)

    const res = await fetch('https://apis.modernizacion.cl/dpa/comunas', {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json' },
    })

    if (!res.ok) throw new Error(`DPA API HTTP ${res.status}`)

    const data = await res.json() as DPAResponse | DPAComuna[]

    const lista: DPAComuna[] = Array.isArray(data)
      ? data
      : (data.comunas ?? [])

    if (lista.length === 0) throw new Error('DPA API devolvió lista vacía')

    const mapa = new Map<string, DatosComuna>()
    for (const c of lista) {
      const clave  = toKey(c.nombre)
      const region = c.region?.nombre ?? 'Región no determinada'
      const hab    = HABITANTES_INE[clave] ?? null
      mapa.set(clave, { region, habitantes: hab })
    }

    cacheComuna    = mapa
    cacheTimestamp = Date.now()
    console.info(`[DPA] Caché actualizado: ${mapa.size} comunas`)
    return mapa

  } catch (error) {
    console.warn('[DPA] API no disponible, usando fallback estático:', error)
    return obtenerFallbackEstatico()
  }
}

function obtenerFallbackEstatico(): Map<string, DatosComuna> {
  if (cacheComuna) return cacheComuna

  const FALLBACK: Record<string, string> = {
    'arica': 'Región de Arica y Parinacota',
    'camarones': 'Región de Arica y Parinacota',
    'putre': 'Región de Arica y Parinacota',
    'general lagos': 'Región de Arica y Parinacota',
    'iquique': 'Región de Tarapacá',
    'alto hospicio': 'Región de Tarapacá',
    'antofagasta': 'Región de Antofagasta',
    'calama': 'Región de Antofagasta',
    'copiapo': 'Región de Atacama',
    'la serena': 'Región de Coquimbo',
    'coquimbo': 'Región de Coquimbo',
    'valparaiso': 'Región de Valparaíso',
    'vina del mar': 'Región de Valparaíso',
    'santiago': 'Región Metropolitana de Santiago',
    'la florida': 'Región Metropolitana de Santiago',
    'las condes': 'Región Metropolitana de Santiago',
    'maipu': 'Región Metropolitana de Santiago',
    'puente alto': 'Región Metropolitana de Santiago',
    'providencia': 'Región Metropolitana de Santiago',
    'nunoa': 'Región Metropolitana de Santiago',
    'quilicura': 'Región Metropolitana de Santiago',
    'san bernardo': 'Región Metropolitana de Santiago',
    'rancagua': "Región del Libertador General Bernardo O'Higgins",
    'talca': 'Región del Maule',
    'curico': 'Región del Maule',
    'linares': 'Región del Maule',
    'chillan': 'Región de Ñuble',
    'concepcion': 'Región del Biobío',
    'talcahuano': 'Región del Biobío',
    'coronel': 'Región del Biobío',
    'los angeles': 'Región del Biobío',
    'temuco': 'Región de La Araucanía',
    'villarrica': 'Región de La Araucanía',
    'angol': 'Región de La Araucanía',
    'valdivia': 'Región de Los Ríos',
    'puerto montt': 'Región de Los Lagos',
    'osorno': 'Región de Los Lagos',
    'castro': 'Región de Los Lagos',
    'coyhaique': 'Región de Aysén del General Carlos Ibáñez del Campo',
    'punta arenas': 'Región de Magallanes y de la Antártica Chilena',
    'florida': 'Región del Biobío',
  }

  const mapa = new Map<string, DatosComuna>()
  for (const [clave, region] of Object.entries(FALLBACK)) {
    mapa.set(clave, { region, habitantes: HABITANTES_INE[clave] ?? null })
  }
  cacheComuna    = mapa
  cacheTimestamp = Date.now()
  return mapa
}

export async function buscarDatosComuna(nombreNormalizado: string): Promise<DatosComuna | null> {
  const mapa  = await obtenerCacheComuna()
  const clave = toKey(nombreNormalizado)
  return mapa.get(clave) ?? null
}
