/**
 * comunas-chile.ts
 * Lista oficial de las 346 comunas de Chile segun el INE.
 * Se usa como referencia para la correccion ortografica por fuzzy matching.
 */

/** Comunas con nombre de despliegue (Title Case, sin tildes para comparacion uniforme) */
export const COMUNAS_OFICIALES: string[] = [
  // Region de Arica y Parinacota
  'Arica', 'Camarones', 'Putre', 'General Lagos',
  // Region de Tarapaca
  'Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camina', 'Colchane', 'Huara', 'Pica',
  // Region de Antofagasta
  'Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal', 'Calama', 'Ollague',
  'San Pedro De Atacama', 'Tocopilla', 'Maria Elena',
  // Region de Atacama
  'Copiapo', 'Caldera', 'Tierra Amarilla', 'Chanaral', 'Diego De Almagro',
  'Vallenar', 'Alto Del Carmen', 'Freirina', 'Huasco',
  // Region de Coquimbo
  'La Serena', 'Coquimbo', 'Andacollo', 'La Higuera', 'Paiguano', 'Vicuna',
  'Illapel', 'Canela', 'Los Vilos', 'Salamanca', 'Ovalle', 'Combarbala',
  'Monte Patria', 'Punitaqui', 'Rio Hurtado',
  // Region de Valparaiso
  'Valparaiso', 'Casablanca', 'Concon', 'Juan Fernandez', 'Puchuncavi',
  'Quintero', 'Vina Del Mar', 'Isla De Pascua', 'Los Andes', 'Calle Larga',
  'Rinconada', 'San Esteban', 'La Ligua', 'Cabildo', 'Papudo', 'Petorca',
  'Zapallar', 'Quillota', 'Calera', 'Hijuelas', 'La Cruz', 'Nogales',
  'San Antonio', 'Algarrobo', 'Cartagena', 'El Quisco', 'El Tabo',
  'Santo Domingo', 'San Felipe', 'Catemu', 'Llaillay', 'Panquehue',
  'Putaendo', 'Santa Maria', 'Quilpue', 'Limache', 'Olmue', 'Villa Alemana',
  // Region Metropolitana
  'Santiago', 'Cerrillos', 'Cerro Navia', 'Conchali', 'El Bosque',
  'Estacion Central', 'Huechuraba', 'Independencia', 'La Cisterna',
  'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes',
  'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipu',
  'Nunoa', 'Pedro Aguirre Cerda', 'Penalolen', 'Providencia', 'Pudahuel',
  'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquin',
  'San Miguel', 'San Ramon', 'Vitacura', 'Puente Alto', 'Pirque',
  'San Jose De Maipo', 'Colina', 'Lampa', 'Tiltil', 'San Bernardo',
  'Buin', 'Calera De Tango', 'Paine', 'Melipilla', 'Alhue', 'Curacavi',
  'Maria Pinto', 'San Pedro', 'Talagante', 'El Monte', 'Isla De Maipo',
  'Padre Hurtado', 'Penaflor',
  // Region del Libertador Bernardo O Higgins
  'Rancagua', 'Codegua', 'Coinco', 'Coltauco', 'Donihue', 'Graneros',
  'Las Cabras', 'Machali', 'Malloa', 'Mostazal', 'Olivar', 'Peumo',
  'Pichidegua', 'Quinta De Tilcoco', 'Rengo', 'Requinoa', 'San Vicente',
  'Pichilemu', 'La Estrella', 'Litueche', 'Marchihue', 'Navidad',
  'Paredones', 'San Fernando', 'Chepica', 'Chimbarongo', 'Lolol',
  'Nancagua', 'Palmilla', 'Peralillo', 'Placilla', 'Pumanque', 'Santa Cruz',
  // Region del Maule
  'Talca', 'Constitucion', 'Curepto', 'Empedrado', 'Maule', 'Pelarco',
  'Pencahue', 'Rio Claro', 'San Clemente', 'San Rafael', 'Cauquenes',
  'Chanco', 'Pelluhue', 'Curico', 'Hualane', 'Licanten', 'Molina',
  'Rauco', 'Romeral', 'Sagrada Familia', 'Teno', 'Vichuquen', 'Linares',
  'Colbun', 'Longavi', 'Parral', 'Retiro', 'San Javier', 'Villa Alegre',
  'Yerbas Buenas',
  // Region del Nuble
  'Chillan', 'Bulnes', 'Cobquecura', 'Coelemu', 'Coihueco', 'Chillan Viejo',
  'El Carmen', 'Ninhue', 'Niquen', 'Pemuco', 'Pinto', 'Portezuelo',
  'Quillon', 'Quirihue', 'Ranquil', 'San Carlos', 'San Fabian',
  'San Ignacio', 'San Nicolas', 'Treguaco', 'Yungay',
  // Region del Biobio
  'Concepcion', 'Coronel', 'Chiguayante', 'Florida', 'Hualpen', 'Hualqui',
  'Lota', 'Penco', 'San Pedro De La Paz', 'Santa Juana', 'Talcahuano',
  'Tome', 'Lebu', 'Arauco', 'Canete', 'Contulmo', 'Curanilahue',
  'Los Alamos', 'Tirua', 'Los Angeles', 'Antuco', 'Cabrero', 'Laja',
  'Mulchen', 'Nacimiento', 'Negrete', 'Quilaco', 'Quilleco', 'San Rosendo',
  'Santa Barbara', 'Tucapel', 'Yumbel', 'Alto Biobio',
  // Region de La Araucania
  'Temuco', 'Carahue', 'Cunco', 'Curarrehue', 'Freire', 'Galvarino',
  'Gorbea', 'Lautaro', 'Loncoche', 'Melipeuco', 'Nueva Imperial',
  'Padre Las Casas', 'Perquenco', 'Pitrufquen', 'Pucon', 'Saavedra',
  'Teodoro Schmidt', 'Tolten', 'Vilcun', 'Villarrica', 'Cholchol',
  'Angol', 'Collipulli', 'Curacautin', 'Ercilla', 'Lonquimay',
  'Los Sauces', 'Lumaco', 'Puren', 'Renaico', 'Traiguen', 'Victoria',
  // Region de Los Rios
  'Valdivia', 'Corral', 'Futrono', 'La Union', 'Lago Ranco', 'Lanco',
  'Los Lagos', 'Mafil', 'Mariquina', 'Paillaco', 'Panguipulli', 'Rio Bueno',
  // Region de Los Lagos
  'Puerto Montt', 'Calbuco', 'Cochamo', 'Fresia', 'Frutillar', 'Los Muermos',
  'Llanquihue', 'Maullin', 'Puerto Varas', 'Castro', 'Ancud', 'Chonchi',
  'Curaco De Velez', 'Dalcahue', 'Puqueldon', 'Queilen', 'Quellon',
  'Quemchi', 'Quinchao', 'Osorno', 'Puerto Octay', 'Purranque', 'Puyehue',
  'Rio Negro', 'San Juan De La Costa', 'San Pablo', 'Chaiten',
  'Futaleufu', 'Hualaihue', 'Palena',
  // Region de Aysen
  'Coyhaique', 'Lago Verde', 'Aysen', 'Cisnes', 'Guaitecas', 'Cochrane',
  'Ohiggins', 'Tortel', 'Chile Chico', 'Rio Ibanez',
  // Region de Magallanes
  'Punta Arenas', 'Laguna Blanca', 'Rio Verde', 'San Gregorio',
  'Cabo De Hornos', 'Antartica', 'Puerto Natales', 'Torres Del Paine',
  'Puerto Williams',
]

/** Quita tildes y pasa a minusculas para comparacion insensible a diacriticos */
function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Version sin tildes y en minusculas de cada comuna para comparar.
 * El indice corresponde 1:1 con COMUNAS_OFICIALES.
 */
export const COMUNAS_NORMALIZADAS: string[] = COMUNAS_OFICIALES.map(stripAccents)

/**
 * Calcula la distancia de Levenshtein entre dos cadenas.
 * Implementacion estandar de programacion dinamica O(n*m).
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Busca la comuna oficial mas cercana al texto de entrada.
 * Solo sugiere correccion si la distancia es <= 2 y la entrada tiene >= 5 caracteres.
 *
 * @param input - Nombre normalizado (sin tildes, Title Case) a corregir
 * @returns El nombre oficial si se encontro una correccion, null si no aplica
 */
export function findBestComuna(input: string): string | null {
  const key = stripAccents(input)

  // Si ya es una coincidencia exacta, no hay nada que corregir
  if (COMUNAS_NORMALIZADAS.includes(key)) return null

  // No intentar corregir nombres muy cortos (evita falsos positivos)
  if (key.length < 5) return null

  // Umbral adaptativo: hasta 2 errores, pero no mas del 25% de la longitud
  const threshold = Math.min(2, Math.floor(key.length * 0.25))

  let bestDist = Infinity
  let bestIndex = -1

  for (let i = 0; i < COMUNAS_NORMALIZADAS.length; i++) {
    const d = levenshtein(key, COMUNAS_NORMALIZADAS[i])
    if (d < bestDist) {
      bestDist = d
      bestIndex = i
    }
  }

  if (bestDist <= threshold && bestIndex !== -1) {
    return COMUNAS_OFICIALES[bestIndex]
  }
  return null
}
