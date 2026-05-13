/**
 * etl-rules.ts
 * Define las reglas ETL configurables para el pipeline de normalización.
 * Cada regla tiene un id único, etiqueta, descripción, si es obligatoria
 * y su estado por defecto. El usuario puede activar/desactivar las reglas
 * opcionales desde la interfaz.
 */

/** Definición de una regla ETL individual */
export interface ETLRule {
  /** Identificador único de la regla, usado como clave en ETLRuleSet */
  id: string
  /** Etiqueta legible para mostrar en la UI */
  label: string
  /** Descripción detallada de qué hace la regla */
  description: string
  /** Si es true, la regla no se puede desactivar desde la UI */
  required: boolean
  /** Estado activo por defecto al iniciar la aplicación */
  defaultEnabled: boolean
}

/** Mapa de id de regla → estado activo (true/false) */
export interface ETLRuleSet {
  [ruleId: string]: boolean
}

/** Lista completa de reglas disponibles en el pipeline */
export const AVAILABLE_RULES: ETLRule[] = [
  {
    id: 'trim',
    label: 'Eliminar espacios extremos',
    description: 'Quita espacios al inicio y al final de cada valor',
    required: true,
    defaultEnabled: true,
  },
  {
    id: 'collapseSpaces',
    label: 'Colapsar espacios multiples',
    description: 'Reemplaza dos o mas espacios consecutivos por uno solo',
    required: false,
    defaultEnabled: true,
  },
  {
    id: 'removeAccents',
    label: 'Eliminar tildes y diacriticos',
    description: 'Convierte a→a, e→e, n→n, u→u, etc. Normaliza Unicode NFD',
    required: false,
    defaultEnabled: true,
  },
  {
    id: 'titleCase',
    label: 'Formato Title Case',
    description: 'Primera letra de cada palabra en mayuscula, resto en minuscula',
    required: false,
    defaultEnabled: true,
  },
  {
    id: 'deduplicate',
    label: 'Eliminar duplicados',
    description: 'Mantiene solo la primera aparicion de cada valor normalizado',
    required: false,
    defaultEnabled: true,
  },
  {
    id: 'fuzzyCorrect',
    label: 'Correccion ortografica',
    description: 'Corrige typos comparando contra lista de referencia (fuzzy matching Levenshtein)',
    required: false,
    defaultEnabled: false,
  },
  {
    id: 'removeEmpty',
    label: 'Eliminar lineas vacias',
    description: 'Descarta lineas que queden vacias despues de la normalizacion',
    required: true,
    defaultEnabled: true,
  },
]

/**
 * Conjunto de reglas por defecto: todas activas excepto fuzzyCorrect.
 * Se construye automáticamente a partir de AVAILABLE_RULES.
 */
export const DEFAULT_RULESET: ETLRuleSet = Object.fromEntries(
  AVAILABLE_RULES.map((r) => [r.id, r.defaultEnabled]),
)

/**
 * Valida y completa un ETLRuleSet parcial.
 * Las reglas obligatorias se fuerzan a true.
 * Las reglas faltantes se completan con su valor por defecto.
 *
 * @param partial - Objeto parcial con el estado de cada regla
 * @returns ETLRuleSet completo y validado
 */
export function resolveRuleSet(partial: Partial<ETLRuleSet>): ETLRuleSet {
  // Filtrar claves con undefined antes de mezclar para mantener el tipo ETLRuleSet
  const cleanPartial = Object.fromEntries(
    Object.entries(partial).filter(([, v]) => v !== undefined),
  ) as ETLRuleSet
  const resolved: ETLRuleSet = { ...DEFAULT_RULESET, ...cleanPartial }

  // Las reglas obligatorias siempre se mantienen activas
  for (const rule of AVAILABLE_RULES) {
    if (rule.required) {
      resolved[rule.id] = true
    }
  }

  return resolved
}
