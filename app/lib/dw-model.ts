/**
 * dw-model.ts
 * FUENTE ÚNICA DE VERDAD del Data Warehouse de COMUNAS_NORM (Evaluación 3).
 *
 * Todo el modelo dimensional vive aquí como datos tipados: la tabla de hechos,
 * las 7 dimensiones (+1 opcional), sus columnas con tipo/nullable/origen OLTP,
 * las relaciones (FK), la Matriz de Bus, el linaje OLTP→OLAP, los cruces de
 * datos, el catálogo de consultas OLAP, la variante copo de nieve, el ejemplo
 * SCD Tipo 2 y la segunda tabla de hechos (constelación).
 *
 * La página /datawarehouse y todos sus componentes RENDERIZAN desde aquí.
 * Nada de esto se hardcodea en el JSX.
 *
 * IMPORTANTE — el linaje (origenOLTP) está alineado con el schema Prisma REAL
 * (prisma/schema.prisma), no con suposiciones:
 *   - Hay 3 jerarquías de batch independientes: Batch→Comuna, FamosoBatch→Famoso,
 *     LugarBatch→Lugar (no un único Batch).
 *   - La calidad son DOS columnas: Batch.qualityBefore / Batch.qualityAfter (solo comunas).
 *   - LogEntry.changeType es String libre (sin enum en la BD).
 *   - Lugar.georef y Lugar.direccion son RELACIONES 1:1 a tablas Georeferencia/Direccion.
 *   - El campo de ciudad de la dirección se llama Direccion.ciudadEstadoProvincia.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del modelo
// ─────────────────────────────────────────────────────────────────────────────

/** Clasificación SCD (Slowly Changing Dimension) de una columna. */
export type TipoSCD = 'N/A' | 'Tipo 1' | 'Tipo 2'

/** Una columna de una tabla del DW, con su ficha completa de diccionario de datos. */
export interface Columna {
  /** Nombre de la columna en el esquema estrella. */
  nombre: string
  /** Tipo de dato SQL (PostgreSQL). */
  tipo: string
  /** Si admite NULL. En la tabla de hechos las FK nunca son nulas (técnica de Kimball). */
  nullable: boolean
  /** Descripción legible para el diccionario de datos interactivo. */
  descripcion: string
  /** True si es clave primaria de la tabla. */
  esPK?: boolean
  /** True si es clave foránea hacia una dimensión. */
  esFK?: boolean
  /** Si es FK, el nombre de la tabla dimensión referenciada. */
  refTabla?: string
  /** Origen en el sistema operacional (OLTP/Prisma). 'Derivado' si se calcula en el ETL. */
  origenOLTP?: string
  /** Tipo de cambio lento aplicado a la columna (relevante en DIM_FUENTE). */
  scd?: TipoSCD
}

/** Una tabla del DW: la tabla de hechos o una dimensión. */
export interface Tabla {
  /** Identificador técnico (nombre SQL en minúsculas). */
  id: string
  /** Nombre en mayúsculas para el diagrama (ej. 'FACT_NORMALIZACION'). */
  nombre: string
  /** Si es la tabla de hechos central o una dimensión radial. */
  tipo: 'hecho' | 'dimension'
  /** Etiqueta corta y legible para tarjetas y leyendas. */
  titulo: string
  /** Descripción del propósito de la tabla. */
  descripcion: string
  /** Grano (solo para la tabla de hechos). */
  grano?: string
  /** True si es una dimensión conformada (compartida entre procesos). */
  conformada?: boolean
  /** Columnas de la tabla. */
  columnas: Columna[]
}

/** Relación de clave foránea hecho → dimensión (para dibujar las líneas del diagrama). */
export interface RelacionFK {
  /** Tabla de hechos de origen. */
  desde: string
  /** Tabla dimensión de destino. */
  hasta: string
  /** Columna FK en la tabla de hechos que materializa la relación. */
  columna: string
}

/** Una fila de la Matriz de Bus de Kimball (proceso de negocio × dimensiones). */
export interface FilaBus {
  /** Nombre del proceso de negocio. */
  proceso: string
  /**
   * Mapa dimensionId → aplica. Si una dimensión no aplica al proceso,
   * se marca false (ej. Ubicación no aplica a Famosos).
   */
  dimensiones: Record<string, boolean>
}

/** Una fila de la tabla de linaje OLTP → OLAP. */
export interface LinajeFila {
  /** Campo del sistema operacional (Prisma) de origen. */
  origenOLTP: string
  /** Destino en el esquema dimensional. */
  destinoOLAP: string
  /** Transformación aplicada en el ETL. */
  transformacion: string
}

/** Un cruce de datasets que genera un dato nuevo (entregable 4 de la rúbrica). */
export interface Cruce {
  /** Primer dato de origen. */
  origen1: string
  /** Segundo dato de origen. */
  origen2: string
  /** El dato nuevo generado a partir del cruce. */
  datoNuevo: string
  /** Módulo al que aplica. */
  modulo: string
}

/** Identificadores de las operaciones OLAP soportadas. */
export type OperacionId =
  | 'principal'
  | 'rollup'
  | 'drilldown'
  | 'slice'
  | 'dice'
  | 'pivot'

/** Una consulta multidimensional del catálogo (entregable 5 + Nivel 1). */
export interface ConsultaOLAP {
  /** Identificador de la operación. */
  id: OperacionId
  /** Nombre de la operación OLAP. */
  nombre: string
  /** Qué hace, en una línea. */
  descripcion: string
  /** Versión en lenguaje natural (opcional). */
  lenguajeNatural?: string
  /** SQL ejecutable contra el esquema estrella. */
  sql: string
}

/** Una fila del ejemplo SCD Tipo 2 de DIM_FUENTE. */
export interface FilaFuenteSCD {
  idFuente: number
  codigo: string
  nombreFuente: string
  version: number
  validoDesde: string
  /** NULL = versión vigente. */
  validoHasta: string | null
  esActual: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Declaración obligatoria del dataset (exigida por el documento del docente)
// ─────────────────────────────────────────────────────────────────────────────

/** Frase literal exigida en la entrega sobre la continuidad del dataset. */
export const DECLARACION_DATASET =
  'Se mantiene el dataset de la Entrega 1: comunas, famosos y lugares.'

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tabla de hechos — FACT_NORMALIZACION
//    Grano: una fila = un registro de entrada al pipeline ETL.
// ─────────────────────────────────────────────────────────────────────────────

export const FACT_NORMALIZACION: Tabla = {
  id: 'fact_normalizacion',
  nombre: 'FACT_NORMALIZACION',
  tipo: 'hecho',
  titulo: 'Hecho de normalización',
  descripcion:
    'Cada fila es un registro de entrada al pipeline ETL (incluidos los descartados ' +
    'por duplicado). Es la tabla LogEntry/registro llevada a esquema estrella.',
  grano: 'Un registro de entrada al pipeline ETL',
  columnas: [
    { nombre: 'id_hecho', tipo: 'BIGSERIAL', nullable: false, esPK: true, descripcion: 'Clave subrogada del hecho.', origenOLTP: 'Derivado (autoincremental del ETL)' },

    // Claves foráneas a las 7 dimensiones
    { nombre: 'id_tiempo', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_tiempo', descripcion: 'FK a la dimensión tiempo (fecha de carga del batch).', origenOLTP: 'Batch.createdAt / FamosoBatch.createdAt / LugarBatch.createdAt' },
    { nombre: 'id_modulo', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_modulo', descripcion: 'FK al módulo (Comunas / Famosos / Lugares).', origenOLTP: 'Derivado (la jerarquía batch de origen)' },
    { nombre: 'id_fuente', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_fuente', descripcion: 'FK a la fuente del dato (DPA/INE/WIKI/MANUAL).', origenOLTP: 'Derivado (módulo + enriquecimiento)' },
    { nombre: 'id_archivo', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_archivo', descripcion: 'FK al archivo de carga.', origenOLTP: 'Batch.fileName / FamosoBatch.fileName / LugarBatch.fileName' },
    { nombre: 'id_ubicacion', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_ubicacion', descripcion: 'FK a la ubicación. Famosos apuntan al miembro "No aplica".', origenOLTP: 'Comuna.region / Direccion.pais + ciudadEstadoProvincia' },
    { nombre: 'id_tipo_cambio', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_tipo_cambio', descripcion: 'FK al tipo de cambio aplicado al registro.', origenOLTP: 'LogEntry.changeType (String libre, normalizado en ETL)' },
    { nombre: 'id_formato_fecha', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_formato_fecha', descripcion: 'FK al formato de fecha detectado. Comunas/Lugares → "No aplica".', origenOLTP: 'detectarFormato(Famoso.fechaOriginal)' },

    // Medidas tipo bandera (0/1) — aditivas como conteos
    { nombre: 'es_duplicado', tipo: 'SMALLINT', nullable: false, descripcion: '1 si el registro fue descartado por duplicado.', origenOLTP: "Derivado de LogEntry.changeType = 'duplicate'" },
    { nombre: 'fue_normalizado', tipo: 'SMALLINT', nullable: false, descripcion: '1 si el registro fue normalizado.', origenOLTP: "Derivado de LogEntry.changeType = 'normalized'" },
    { nombre: 'fue_corregido', tipo: 'SMALLINT', nullable: false, descripcion: '1 si el registro fue corregido (fuzzy/lookup).', origenOLTP: "Derivado de LogEntry.changeType = 'corrected'" },
    { nombre: 'tiene_georef', tipo: 'SMALLINT', nullable: false, descripcion: '1 si el lugar tiene georreferencia.', origenOLTP: 'Lugar.georef IS NOT NULL (relación 1:1 a Georeferencia)' },
    { nombre: 'es_cumpleanos', tipo: 'SMALLINT', nullable: false, descripcion: '1 si el famoso cumple años a la fecha de carga.', origenOLTP: 'Famoso.esCumpleanos' },
    { nombre: 'tenia_tildes', tipo: 'SMALLINT', nullable: false, descripcion: '1 si el original tenía tildes/diacríticos.', origenOLTP: 'Derivado (lógica de quality-score.ts a nivel de registro)' },
    { nombre: 'capitalizacion_incorrecta', tipo: 'SMALLINT', nullable: false, descripcion: '1 si el original no estaba en Title Case.', origenOLTP: 'Derivado (quality-score.ts)' },
    { nombre: 'tenia_espacios_extra', tipo: 'SMALLINT', nullable: false, descripcion: '1 si el original tenía espacios sobrantes.', origenOLTP: 'Derivado (quality-score.ts)' },

    // Medidas numéricas (nullable según módulo)
    { nombre: 'habitantes', tipo: 'INT', nullable: true, descripcion: 'Población de la comuna (solo módulo Comunas).', origenOLTP: 'Comuna.habitantes (INE Censo 2024)' },
    { nombre: 'edad', tipo: 'INT', nullable: true, descripcion: 'Edad del famoso al día de hoy (solo módulo Famosos).', origenOLTP: 'Famoso.edad' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Las 7 dimensiones
// ─────────────────────────────────────────────────────────────────────────────

/** 1. DIM_TIEMPO — dimensión conformada. */
export const DIM_TIEMPO: Tabla = {
  id: 'dim_tiempo',
  nombre: 'DIM_TIEMPO',
  tipo: 'dimension',
  titulo: 'Tiempo',
  descripcion: 'Calendario de carga de los batches. Conformada entre los 3 procesos.',
  conformada: true,
  columnas: [
    { nombre: 'id_tiempo', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave inteligente AAAAMMDD (ej: 20260617).', origenOLTP: 'Derivado de createdAt' },
    { nombre: 'fecha', tipo: 'DATE', nullable: false, descripcion: 'Fecha de carga del batch.', origenOLTP: 'Batch.createdAt' },
    { nombre: 'anio', tipo: 'INT', nullable: false, descripcion: 'Año.', origenOLTP: 'Derivado' },
    { nombre: 'trimestre', tipo: 'INT', nullable: false, descripcion: 'Trimestre (1-4).', origenOLTP: 'Derivado' },
    { nombre: 'mes', tipo: 'INT', nullable: false, descripcion: 'Mes (1-12).', origenOLTP: 'Derivado' },
    { nombre: 'nombre_mes', tipo: 'VARCHAR(15)', nullable: false, descripcion: 'Nombre del mes.', origenOLTP: 'Derivado' },
    { nombre: 'dia', tipo: 'INT', nullable: false, descripcion: 'Día del mes.', origenOLTP: 'Derivado' },
    { nombre: 'dia_semana', tipo: 'INT', nullable: false, descripcion: 'Día de la semana (1-7).', origenOLTP: 'Derivado' },
    { nombre: 'nombre_dia', tipo: 'VARCHAR(15)', nullable: false, descripcion: 'Nombre del día.', origenOLTP: 'Derivado' },
    { nombre: 'es_fin_semana', tipo: 'SMALLINT', nullable: false, descripcion: '1 si es sábado/domingo.', origenOLTP: 'Derivado' },
  ],
}

/** 2. DIM_MODULO */
export const DIM_MODULO: Tabla = {
  id: 'dim_modulo',
  nombre: 'DIM_MODULO',
  tipo: 'dimension',
  titulo: 'Módulo',
  descripcion: 'Los tres procesos de normalización del sistema.',
  columnas: [
    { nombre: 'id_modulo', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.', origenOLTP: 'Derivado' },
    { nombre: 'nombre_modulo', tipo: 'VARCHAR(20)', nullable: false, descripcion: "'Comunas' | 'Famosos' | 'Lugares'.", origenOLTP: 'Derivado (jerarquía batch)' },
    { nombre: 'descripcion', tipo: 'VARCHAR(255)', nullable: true, descripcion: 'Descripción del módulo.', origenOLTP: 'Derivado' },
    { nombre: 'tipo_entidad', tipo: 'VARCHAR(50)', nullable: true, descripcion: "'Comuna' | 'Persona' | 'Lugar turístico'.", origenOLTP: 'Derivado' },
  ],
}

/** 3. DIM_FUENTE — recibe SCD Tipo 2. */
export const DIM_FUENTE: Tabla = {
  id: 'dim_fuente',
  nombre: 'DIM_FUENTE',
  tipo: 'dimension',
  titulo: 'Fuente',
  descripcion: 'Origen del dato. Implementa SCD Tipo 2 para preservar el histórico de versiones.',
  columnas: [
    { nombre: 'id_fuente', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.', origenOLTP: 'Derivado', scd: 'N/A' },
    { nombre: 'codigo_fuente', tipo: 'VARCHAR(30)', nullable: false, descripcion: "Clave natural: 'DPA'|'INE'|'WIKI'|'MANUAL'.", origenOLTP: 'Derivado (módulo + enriquecimiento)', scd: 'Tipo 1' },
    { nombre: 'nombre_fuente', tipo: 'VARCHAR(100)', nullable: false, descripcion: 'Nombre legible de la fuente.', origenOLTP: 'Derivado', scd: 'Tipo 2' },
    { nombre: 'institucion', tipo: 'VARCHAR(150)', nullable: true, descripcion: 'Institución responsable.', origenOLTP: 'Derivado', scd: 'Tipo 2' },
    { nombre: 'url', tipo: 'VARCHAR(255)', nullable: true, descripcion: 'Endpoint o URL de la fuente.', origenOLTP: 'Derivado', scd: 'Tipo 2' },
    { nombre: 'tipo', tipo: 'VARCHAR(20)', nullable: true, descripcion: "'API' | 'Dataset' | 'Manual'.", origenOLTP: 'Derivado', scd: 'Tipo 1' },
    { nombre: 'version', tipo: 'INT', nullable: false, descripcion: 'Versión del registro (SCD2).', origenOLTP: 'Derivado', scd: 'Tipo 2' },
    { nombre: 'valido_desde', tipo: 'DATE', nullable: false, descripcion: 'Inicio de vigencia de la versión.', origenOLTP: 'Derivado', scd: 'Tipo 2' },
    { nombre: 'valido_hasta', tipo: 'DATE', nullable: true, descripcion: 'Fin de vigencia (NULL = vigente).', origenOLTP: 'Derivado', scd: 'Tipo 2' },
    { nombre: 'es_actual', tipo: 'SMALLINT', nullable: false, descripcion: '1 si es la versión vigente.', origenOLTP: 'Derivado', scd: 'Tipo 2' },
  ],
}

/** 4. DIM_ARCHIVO */
export const DIM_ARCHIVO: Tabla = {
  id: 'dim_archivo',
  nombre: 'DIM_ARCHIVO',
  tipo: 'dimension',
  titulo: 'Archivo',
  descripcion: 'El archivo de carga y su formato técnico.',
  columnas: [
    { nombre: 'id_archivo', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.', origenOLTP: 'Derivado' },
    { nombre: 'nombre_archivo', tipo: 'VARCHAR(255)', nullable: false, descripcion: 'Nombre del archivo cargado.', origenOLTP: 'Batch.fileName / FamosoBatch.fileName / LugarBatch.fileName' },
    { nombre: 'formato', tipo: 'VARCHAR(10)', nullable: true, descripcion: "'txt' | 'csv' | 'tsv'.", origenOLTP: 'Derivado del parser (detectarSeparadorCSV)' },
    { nombre: 'encoding', tipo: 'VARCHAR(20)', nullable: true, descripcion: "'UTF-8' | 'Windows-1252'.", origenOLTP: 'Derivado (detectarEncoding de lugares-parser)' },
    { nombre: 'total_registros', tipo: 'INT', nullable: true, descripcion: 'Total de registros del archivo.', origenOLTP: 'Batch.totalInput' },
  ],
}

/** 5. DIM_UBICACION — dimensión conformada; admite copo de nieve. */
export const DIM_UBICACION: Tabla = {
  id: 'dim_ubicacion',
  nombre: 'DIM_UBICACION',
  tipo: 'dimension',
  titulo: 'Ubicación',
  descripcion: 'Geografía de comunas (Chile) y lugares (mundial). Conformada; admite copo de nieve. Famosos → "No aplica".',
  conformada: true,
  columnas: [
    { nombre: 'id_ubicacion', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.', origenOLTP: 'Derivado' },
    { nombre: 'pais', tipo: 'VARCHAR(100)', nullable: true, descripcion: "País ('Chile' | 'Estados Unidos' | ... | 'No aplica').", origenOLTP: 'Direccion.pais (parsearDireccion)' },
    { nombre: 'region', tipo: 'VARCHAR(100)', nullable: true, descripcion: 'Región chilena (solo comunas).', origenOLTP: 'Comuna.region (API DPA)' },
    { nombre: 'comuna', tipo: 'VARCHAR(100)', nullable: true, descripcion: 'Comuna.', origenOLTP: 'Comuna.normalized' },
    { nombre: 'ciudad', tipo: 'VARCHAR(100)', nullable: true, descripcion: 'Ciudad/estado/provincia del lugar.', origenOLTP: 'Direccion.ciudadEstadoProvincia' },
    { nombre: 'zona_geografica', tipo: 'VARCHAR(50)', nullable: true, descripcion: 'Macrozona (Norte/Centro/Sur o continente).', origenOLTP: 'Derivado' },
  ],
}

/** 6. DIM_TIPO_CAMBIO */
export const DIM_TIPO_CAMBIO: Tabla = {
  id: 'dim_tipo_cambio',
  nombre: 'DIM_TIPO_CAMBIO',
  tipo: 'dimension',
  titulo: 'Tipo de cambio',
  descripcion: 'Resultado del registro tras pasar por el pipeline. Normaliza el String libre LogEntry.changeType.',
  columnas: [
    { nombre: 'id_tipo_cambio', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.', origenOLTP: 'Derivado' },
    { nombre: 'codigo', tipo: 'VARCHAR(20)', nullable: false, descripcion: "'normalized'|'duplicate'|'corrected'|'unchanged'.", origenOLTP: 'LogEntry.changeType (String, normalizado en ETL)' },
    { nombre: 'etiqueta', tipo: 'VARCHAR(30)', nullable: false, descripcion: "'Normalizado'|'Duplicado'|'Corregido'|'Sin cambio'.", origenOLTP: 'Derivado (lookup)' },
    { nombre: 'descripcion', tipo: 'VARCHAR(255)', nullable: true, descripcion: 'Descripción del tipo de cambio.', origenOLTP: 'Derivado' },
  ],
}

/** 7. DIM_FORMATO_FECHA */
export const DIM_FORMATO_FECHA: Tabla = {
  id: 'dim_formato_fecha',
  nombre: 'DIM_FORMATO_FECHA',
  tipo: 'dimension',
  titulo: 'Formato de fecha',
  descripcion: 'Formato de fecha de nacimiento detectado (solo Famosos). Comunas/Lugares → "No aplica".',
  columnas: [
    { nombre: 'id_formato_fecha', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.', origenOLTP: 'Derivado' },
    { nombre: 'codigo', tipo: 'VARCHAR(30)', nullable: false, descripcion: 'Código del formato.', origenOLTP: 'detectarFormato()' },
    { nombre: 'etiqueta', tipo: 'VARCHAR(50)', nullable: false, descripcion: "'D de Mes de AAAA' | 'Mes D, AAAA' | 'AAAA-MM-DD' | 'No aplica'…", origenOLTP: 'detectarFormato(Famoso.fechaOriginal)' },
    { nombre: 'ejemplo', tipo: 'VARCHAR(50)', nullable: true, descripcion: 'Ejemplo del formato.', origenOLTP: 'Derivado' },
  ],
}

/** Las 7 dimensiones obligatorias del modelo. */
export const DIMENSIONES: Tabla[] = [
  DIM_TIEMPO,
  DIM_MODULO,
  DIM_FUENTE,
  DIM_ARCHIVO,
  DIM_UBICACION,
  DIM_TIPO_CAMBIO,
  DIM_FORMATO_FECHA,
]

/** Todas las tablas del modelo estrella (hecho + 7 dimensiones). */
export const TABLAS: Tabla[] = [FACT_NORMALIZACION, ...DIMENSIONES]

// ─────────────────────────────────────────────────────────────────────────────
// 3. Relaciones (FK) hecho → dimensión
// ─────────────────────────────────────────────────────────────────────────────

export const RELACIONES: RelacionFK[] = DIMENSIONES.map((dim) => {
  const fk = FACT_NORMALIZACION.columnas.find((c) => c.refTabla === dim.id)
  // Toda dimensión obligatoria tiene exactamente una FK en el hecho.
  return { desde: FACT_NORMALIZACION.id, hasta: dim.id, columna: fk?.nombre ?? '' }
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Matriz de Bus de Kimball (Nivel 1)
// ─────────────────────────────────────────────────────────────────────────────

export const MATRIZ_BUS: FilaBus[] = [
  {
    proceso: 'Normalización Comunas',
    dimensiones: {
      dim_tiempo: true, dim_modulo: true, dim_fuente: true, dim_archivo: true,
      dim_ubicacion: true, dim_tipo_cambio: true, dim_formato_fecha: false,
    },
  },
  {
    proceso: 'Normalización Famosos',
    dimensiones: {
      dim_tiempo: true, dim_modulo: true, dim_fuente: true, dim_archivo: true,
      dim_ubicacion: false, dim_tipo_cambio: true, dim_formato_fecha: true,
    },
  },
  {
    proceso: 'Normalización Lugares',
    dimensiones: {
      dim_tiempo: true, dim_modulo: true, dim_fuente: true, dim_archivo: true,
      dim_ubicacion: true, dim_tipo_cambio: true, dim_formato_fecha: false,
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 5. Linaje OLTP → OLAP (Nivel 1) — alineado con el schema Prisma REAL
// ─────────────────────────────────────────────────────────────────────────────

export const LINAJE: LinajeFila[] = [
  { origenOLTP: 'Batch.createdAt / FamosoBatch.createdAt / LugarBatch.createdAt', destinoOLAP: 'DIM_TIEMPO', transformacion: 'Descomponer en año / trimestre / mes / día' },
  { origenOLTP: 'Batch.fileName / FamosoBatch.fileName / LugarBatch.fileName', destinoOLAP: 'DIM_ARCHIVO.nombre_archivo', transformacion: 'Directo (las 3 jerarquías batch tienen fileName)' },
  { origenOLTP: 'Separador/encoding del parser', destinoOLAP: 'DIM_ARCHIVO.formato / encoding', transformacion: 'detectarSeparadorCSV + detectarEncoding (lugares-parser.ts)' },
  { origenOLTP: 'Comuna.region', destinoOLAP: 'DIM_UBICACION.region', transformacion: 'Directo (desde API DPA)' },
  { origenOLTP: 'Comuna.habitantes', destinoOLAP: 'FACT.habitantes', transformacion: 'Directo (INE Censo 2024)' },
  { origenOLTP: 'LogEntry.changeType (String libre)', destinoOLAP: 'DIM_TIPO_CAMBIO', transformacion: 'Normalizar el texto y lookup contra la dimensión' },
  { origenOLTP: 'Famoso.fechaOriginal', destinoOLAP: 'DIM_FORMATO_FECHA', transformacion: 'Clasificar con detectarFormato()' },
  { origenOLTP: 'Famoso.edad', destinoOLAP: 'FACT.edad', transformacion: 'Directo' },
  { origenOLTP: 'Famoso.esCumpleanos', destinoOLAP: 'FACT.es_cumpleanos', transformacion: 'Directo (Boolean → 0/1)' },
  { origenOLTP: 'Lugar.georef (relación 1:1 → Georeferencia)', destinoOLAP: 'FACT.tiene_georef', transformacion: 'Bandera (georef IS NOT NULL); JOIN a Georeferencia' },
  { origenOLTP: 'Lugar.direccion.pais (relación 1:1 → Direccion)', destinoOLAP: 'DIM_UBICACION.pais', transformacion: 'JOIN a Direccion (parsearDireccion)' },
  { origenOLTP: 'Lugar.direccion.ciudadEstadoProvincia', destinoOLAP: 'DIM_UBICACION.ciudad', transformacion: 'JOIN a Direccion; renombrado a ciudad' },
  { origenOLTP: 'Batch.qualityBefore / qualityAfter', destinoOLAP: 'FACT (banderas de calidad)', transformacion: 'Reglas de quality-score.ts a nivel de registro (solo comunas)' },
  { origenOLTP: 'Batch.duplicates (agregado)', destinoOLAP: 'FACT.es_duplicado (por registro)', transformacion: 'Derivar desde LogEntry.changeType' },
  { origenOLTP: 'Jerarquía batch de origen', destinoOLAP: 'DIM_MODULO / DIM_FUENTE', transformacion: 'Batch→Comunas/DPA·INE, FamosoBatch→Famosos/WIKI, LugarBatch→Lugares/MANUAL' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 6. Cruces de datos (entregable 4) — al menos 3, aquí 5
// ─────────────────────────────────────────────────────────────────────────────

export const CRUCES: Cruce[] = [
  { origen1: 'Duplicados', origen2: 'Total de entrada', datoNuevo: 'Tasa de duplicación del dato fuente (%)', modulo: 'Universal' },
  { origen1: 'Habitantes (comuna)', origen2: 'Región', datoNuevo: 'Población total y ranking de comunas por región', modulo: 'Comunas' },
  { origen1: 'Score antes', origen2: 'Score después', datoNuevo: 'Ganancia de calidad por normalización (%)', modulo: 'Comunas' },
  { origen1: 'País (lugar)', origen2: 'Nº de lugares', datoNuevo: 'Concentración turística por país', modulo: 'Lugares' },
  { origen1: 'Edad (famoso)', origen2: 'Época de nacimiento', datoNuevo: 'Distribución generacional de personajes', modulo: 'Famosos' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 7. Catálogo de consultas OLAP (entregable 5 + Nivel 1)
// ─────────────────────────────────────────────────────────────────────────────

export const CONSULTAS_OLAP: ConsultaOLAP[] = [
  {
    id: 'principal',
    nombre: 'Consulta principal',
    descripcion: 'Registros por módulo, fuente y mes, con duplicados y normalizados.',
    lenguajeNatural:
      'Registros procesados por módulo, fuente y mes, indicando cuántos fueron duplicados y cuántos normalizados.',
    sql: `SELECT m.nombre_modulo, fu.nombre_fuente, t.anio, t.mes,
       COUNT(*)               AS total_registros,
       SUM(f.es_duplicado)    AS duplicados,
       SUM(f.fue_normalizado) AS normalizados
FROM fact_normalizacion f
JOIN dim_modulo m  ON f.id_modulo  = m.id_modulo
JOIN dim_fuente fu ON f.id_fuente  = fu.id_fuente
JOIN dim_tiempo t  ON f.id_tiempo  = t.id_tiempo
GROUP BY m.nombre_modulo, fu.nombre_fuente, t.anio, t.mes
ORDER BY total_registros DESC;`,
  },
  {
    id: 'rollup',
    nombre: 'Roll-up',
    descripcion: 'Subir de mes a año (agregar).',
    sql: `SELECT t.anio, COUNT(*) AS registros, SUM(f.es_duplicado) AS duplicados
FROM fact_normalizacion f JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
GROUP BY t.anio ORDER BY t.anio;`,
  },
  {
    id: 'drilldown',
    nombre: 'Drill-down',
    descripcion: 'Bajar de año a mes y día (detallar).',
    sql: `SELECT t.anio, t.mes, t.dia, COUNT(*) AS registros
FROM fact_normalizacion f JOIN dim_tiempo t ON f.id_tiempo = t.id_tiempo
WHERE t.anio = 2026
GROUP BY t.anio, t.mes, t.dia ORDER BY t.anio, t.mes, t.dia;`,
  },
  {
    id: 'slice',
    nombre: 'Slice',
    descripcion: 'Fijar una dimensión (una rebanada del cubo).',
    sql: `SELECT m.nombre_modulo, COUNT(*) AS registros
FROM fact_normalizacion f JOIN dim_modulo m ON f.id_modulo = m.id_modulo
WHERE m.nombre_modulo = 'Lugares'
GROUP BY m.nombre_modulo;`,
  },
  {
    id: 'dice',
    nombre: 'Dice',
    descripcion: 'Varias condiciones (un subcubo).',
    sql: `SELECT m.nombre_modulo, fu.nombre_fuente, t.anio, COUNT(*) AS registros
FROM fact_normalizacion f
JOIN dim_modulo m  ON f.id_modulo = m.id_modulo
JOIN dim_fuente fu ON f.id_fuente = fu.id_fuente
JOIN dim_tiempo t  ON f.id_tiempo = t.id_tiempo
WHERE m.nombre_modulo = 'Comunas' AND fu.codigo_fuente = 'DPA' AND t.anio = 2026
GROUP BY m.nombre_modulo, fu.nombre_fuente, t.anio;`,
  },
  {
    id: 'pivot',
    nombre: 'Pivot (rotación)',
    descripcion: 'Reorganizar módulo × fuente.',
    sql: `SELECT m.nombre_modulo,
       SUM(CASE WHEN fu.codigo_fuente = 'DPA'  THEN 1 ELSE 0 END) AS dpa,
       SUM(CASE WHEN fu.codigo_fuente = 'INE'  THEN 1 ELSE 0 END) AS ine,
       SUM(CASE WHEN fu.codigo_fuente = 'WIKI' THEN 1 ELSE 0 END) AS wikipedia
FROM fact_normalizacion f
JOIN dim_modulo m  ON f.id_modulo = m.id_modulo
JOIN dim_fuente fu ON f.id_fuente = fu.id_fuente
GROUP BY m.nombre_modulo;`,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 8. Variante copo de nieve de DIM_UBICACION (Nivel 2)
// ─────────────────────────────────────────────────────────────────────────────

/** Las tres tablas en cadena que reemplazan a DIM_UBICACION en su forma normalizada. */
export const COPO_UBICACION: Tabla[] = [
  {
    id: 'dim_pais',
    nombre: 'DIM_PAIS',
    tipo: 'dimension',
    titulo: 'País',
    descripcion: 'Nivel superior de la jerarquía geográfica.',
    columnas: [
      { nombre: 'id_pais', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.' },
      { nombre: 'pais', tipo: 'VARCHAR(100)', nullable: true, descripcion: 'Nombre del país.' },
      { nombre: 'zona_geografica', tipo: 'VARCHAR(50)', nullable: true, descripcion: 'Macrozona / continente.' },
    ],
  },
  {
    id: 'dim_region',
    nombre: 'DIM_REGION',
    tipo: 'dimension',
    titulo: 'Región',
    descripcion: 'Nivel intermedio; referencia a DIM_PAIS.',
    columnas: [
      { nombre: 'id_region', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.' },
      { nombre: 'region', tipo: 'VARCHAR(100)', nullable: true, descripcion: 'Región.' },
      { nombre: 'id_pais', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_pais', descripcion: 'FK a DIM_PAIS.' },
    ],
  },
  {
    id: 'dim_comuna',
    nombre: 'DIM_COMUNA',
    tipo: 'dimension',
    titulo: 'Comuna',
    descripcion: 'Nivel de detalle; referencia a DIM_REGION.',
    columnas: [
      { nombre: 'id_comuna', tipo: 'INT', nullable: false, esPK: true, descripcion: 'Clave subrogada.' },
      { nombre: 'comuna', tipo: 'VARCHAR(100)', nullable: true, descripcion: 'Comuna.' },
      { nombre: 'ciudad', tipo: 'VARCHAR(100)', nullable: true, descripcion: 'Ciudad/estado/provincia.' },
      { nombre: 'id_region', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_region', descripcion: 'FK a DIM_REGION.' },
    ],
  },
]

/** Trade-off estrella vs. copo de nieve (para la nota del toggle). */
export const TRADEOFF_ESQUEMA = {
  estrella: 'Menos joins, lectura más rápida, algo de redundancia. Recomendado para análisis.',
  copoNieve: 'Sin redundancia, más integridad, pero más joins. Útil con jerarquías grandes.',
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Ejemplo SCD Tipo 2 en DIM_FUENTE (Nivel 1)
// ─────────────────────────────────────────────────────────────────────────────

export const FUENTES_SCD2: FilaFuenteSCD[] = [
  { idFuente: 1, codigo: 'INE', nombreFuente: 'INE Censo 2017', version: 1, validoDesde: '2017-01-01', validoHasta: '2024-08-31', esActual: false },
  { idFuente: 2, codigo: 'INE', nombreFuente: 'INE Censo 2024', version: 2, validoDesde: '2024-09-01', validoHasta: null, esActual: true },
  { idFuente: 3, codigo: 'DPA', nombreFuente: 'API DPA Gobierno Digital', version: 1, validoDesde: '2020-01-01', validoHasta: null, esActual: true },
  { idFuente: 4, codigo: 'WIKI', nombreFuente: 'Wikipedia REST API', version: 1, validoDesde: '2020-01-01', validoHasta: null, esActual: true },
  { idFuente: 5, codigo: 'MANUAL', nombreFuente: 'Búsqueda manual', version: 1, validoDesde: '2020-01-01', validoHasta: null, esActual: true },
]

// ─────────────────────────────────────────────────────────────────────────────
// 10. Constelación de hechos (Nivel 3) — segunda tabla de hechos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FACT_CALIDAD_DIARIA — hecho de snapshot periódico (grano: módulo × día).
 * Comparte DIM_TIEMPO y DIM_MODULO con FACT_NORMALIZACION → constelación de hechos.
 */
export const FACT_CALIDAD_DIARIA: Tabla = {
  id: 'fact_calidad_diaria',
  nombre: 'FACT_CALIDAD_DIARIA',
  tipo: 'hecho',
  titulo: 'Calidad diaria (snapshot)',
  descripcion: 'Snapshot periódico de calidad por módulo y día. Comparte DIM_TIEMPO y DIM_MODULO con el hecho transaccional.',
  grano: 'Un registro por módulo × día',
  columnas: [
    { nombre: 'id_tiempo', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_tiempo', descripcion: 'FK a DIM_TIEMPO.', origenOLTP: '*Batch.createdAt (agregado por día)' },
    { nombre: 'id_modulo', tipo: 'INT', nullable: false, esFK: true, refTabla: 'dim_modulo', descripcion: 'FK a DIM_MODULO.', origenOLTP: 'Jerarquía batch' },
    { nombre: 'registros_procesados', tipo: 'INT', nullable: false, descripcion: 'Total de registros del día.', origenOLTP: 'SUM(*Batch.totalInput)' },
    { nombre: 'total_duplicados', tipo: 'INT', nullable: false, descripcion: 'Duplicados del día.', origenOLTP: 'SUM(*Batch.duplicates)' },
    { nombre: 'total_normalizados', tipo: 'INT', nullable: false, descripcion: 'Normalizados del día.', origenOLTP: 'SUM(Batch.changes) (solo comunas)' },
    { nombre: 'total_no_encontrados', tipo: 'INT', nullable: false, descripcion: 'No encontrados del día.', origenOLTP: 'SUM(Batch.noEncontrados) (solo comunas)' },
    { nombre: 'score_promedio', tipo: 'DECIMAL(5,2)', nullable: true, descripcion: 'Score de calidad promedio del día.', origenOLTP: 'AVG(Batch.qualityAfter) (solo comunas)' },
  ],
}

/** Las dimensiones conformadas que ambos hechos comparten (base de la constelación). */
export const DIMENSIONES_CONFORMADAS: string[] = ['dim_tiempo', 'dim_modulo']
