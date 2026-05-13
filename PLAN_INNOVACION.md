# PLAN DE INNOVACIÓN — COMUNAS_NORM v2.0
> Para Claude Code: lee este archivo COMPLETO antes de tocar cualquier código.
> El proyecto ya funciona (v1). Vamos a agregar 12 módulos nuevos sin romper nada.
> Implementar SIEMPRE en el orden indicado. Correr `pnpm build` después de cada fase.

---

## Contexto del proyecto

App Next.js 14 + TypeScript + Prisma + PostgreSQL desplegada en VPS Hostinger.
Normaliza datasets de texto (originalmente comunas chilenas, pero debe funcionar con CUALQUIER dataset).

**Lo que ya existe y NO se toca:**
- `prisma/schema.prisma` — modelos Batch, Comuna, LogEntry (solo agregar campos)
- `app/lib/normalizer.ts` — lógica de normalización (solo extender, no reescribir)
- `app/lib/comunas-chile.ts` — lista INE + fuzzy matching
- `app/lib/prisma.ts` — cliente Prisma
- `app/api/comunas/route.ts` — GET comunas de un batch
- `app/api/logs/route.ts` — GET log de un batch
- Estructura general de `page.tsx` y layout

---

## MÓDULO 1 — Parser Multi-Formato Inteligente

### Objetivo
Aceptar TXT, CSV, TSV y XLSX. Si el archivo tiene múltiples columnas, mostrar un selector para que el usuario elija cuál normalizar.

### Archivo nuevo: `app/lib/parser.ts`

```typescript
/**
 * parser.ts
 * Detecta el formato del archivo y extrae la columna correcta.
 * Soporta: TXT (una columna), CSV, TSV, y texto pegado directamente.
 */

export interface ParseResult {
  lines: string[]           // Líneas limpias listas para normalizar
  format: 'txt' | 'csv' | 'tsv' | 'unknown'
  columns: string[]         // Nombres de columnas detectados (si aplica)
  selectedColumn: number    // Índice de columna seleccionada (default 0)
  totalRaw: number          // Total de líneas antes de filtrar vacías
}

export interface ParseOptions {
  columnIndex?: number      // Qué columna extraer en CSV/TSV (default 0)
  hasHeader?: boolean       // Si la primera fila es encabezado (default: auto-detect)
  encoding?: string         // UTF-8 por defecto
}

/**
 * Detecta el separador dominante del contenido
 */
export function detectFormat(content: string): 'txt' | 'csv' | 'tsv' | 'unknown' {
  const sample = content.slice(0, 2000) // analizar solo los primeros 2000 chars
  const tabCount = (sample.match(/\t/g) || []).length
  const semicolonCount = (sample.match(/;/g) || []).length
  const commaCount = (sample.match(/,/g) || []).length
  const newlineCount = (sample.match(/\n/g) || []).length

  if (tabCount > newlineCount * 0.5) return 'tsv'
  if (semicolonCount > newlineCount * 0.3 || commaCount > newlineCount * 0.3) return 'csv'
  return 'txt'
}

/**
 * Detecta si la primera fila es un encabezado.
 * Heurística: si la primera fila tiene texto que NO aparece en las demás filas
 * con patrones de datos normales, se considera encabezado.
 */
export function detectHeader(rows: string[][]): boolean {
  if (rows.length < 3) return false
  const firstRow = rows[0]
  // Si la primera fila tiene valores como "nombre", "ciudad", "id", etc.
  const headerKeywords = /^(id|nombre|name|ciudad|city|region|comuna|code|codigo|descripcion|description|valor|value|texto|text)$/i
  return firstRow.some(cell => headerKeywords.test(cell.trim()))
}

/**
 * Parsea el contenido del archivo según su formato.
 * Retorna las líneas listas para normalizar y metadatos del parsing.
 */
export function parseContent(content: string, options: ParseOptions = {}): ParseResult {
  const format = detectFormat(content)
  const separator = format === 'tsv' ? '\t' : format === 'csv' ? /[,;]/ : '\n'
  
  // Dividir en filas
  const rawRows = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
  
  if (format === 'txt') {
    return {
      lines: rawRows,
      format: 'txt',
      columns: ['valor'],
      selectedColumn: 0,
      totalRaw: rawRows.length,
    }
  }
  
  // Parsear como CSV o TSV
  const rows = rawRows.map(row => 
    row.split(separator).map(cell => cell.replace(/^["']|["']$/g, '').trim())
  )
  
  const hasHeader = options.hasHeader ?? detectHeader(rows)
  const headers = hasHeader ? rows[0] : rows[0].map((_, i) => `Columna ${i + 1}`)
  const dataRows = hasHeader ? rows.slice(1) : rows
  const colIndex = options.columnIndex ?? 0
  
  const lines = dataRows
    .map(row => row[colIndex] ?? '')
    .filter(cell => cell.length > 0)
  
  return {
    lines,
    format,
    columns: headers,
    selectedColumn: colIndex,
    totalRaw: rawRows.length,
  }
}
```

### Componente nuevo: `app/components/ColumnSelector.tsx`

Mostrar un mini-preview con las primeras 3 filas y radio buttons para elegir columna.
Solo aparece si el archivo tiene más de 1 columna.

```typescript
// Interfaz:
interface ColumnSelectorProps {
  columns: string[]
  preview: string[][]    // Primeras 3 filas de datos
  selected: number
  onChange: (index: number) => void
}
```

### Cambios en `app/components/FileUpload.tsx`

1. Agregar soporte para `.csv` y `.tsv` en `accept`
2. Leer el archivo, llamar a `detectFormat()` y `parseContent()`
3. Si hay múltiples columnas → mostrar `<ColumnSelector />` antes de procesar
4. Enviar `columnIndex` en el FormData al API

### Cambios en `app/api/process/route.ts`

1. Leer `columnIndex` del FormData
2. Llamar a `parseContent(content, { columnIndex })` antes de `processFile()`
3. Pasar `lines` ya parseadas a `processFile()` en vez del string crudo

---

## MÓDULO 2 — Configurador de Reglas ETL

### Objetivo
Permitir al usuario activar/desactivar cada regla de normalización individualmente.
Los perfiles se guardan en localStorage para reutilizarse.

### Reglas configurables
```
✅ Eliminar tildes y diacríticos
✅ Convertir a Title Case
✅ Trim de espacios al inicio/fin
✅ Colapsar espacios múltiples
✅ Eliminar duplicados
✅ Corrección ortográfica (fuzzy matching)
✅ Eliminar líneas vacías
☐ Convertir números a texto (ej: "1" → "Uno") — DESACTIVADO por defecto
```

### Archivo nuevo: `app/lib/etl-rules.ts`

```typescript
/**
 * etl-rules.ts
 * Define la interfaz de reglas ETL configurables.
 * Cada regla tiene un id, nombre, descripción, si es obligatoria y su estado por defecto.
 */

export interface ETLRule {
  id: string
  label: string
  description: string
  required: boolean        // Si es true, no se puede desactivar
  defaultEnabled: boolean
}

export interface ETLRuleSet {
  [ruleId: string]: boolean
}

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
    label: 'Colapsar espacios múltiples',
    description: 'Reemplaza dos o más espacios consecutivos por uno solo',
    required: false,
    defaultEnabled: true,
  },
  {
    id: 'removeAccents',
    label: 'Eliminar tildes y diacríticos',
    description: 'Convierte á→a, é→e, ñ→n, ü→u, etc.',
    required: false,
    defaultEnabled: true,
  },
  {
    id: 'titleCase',
    label: 'Formato Title Case',
    description: 'Primera letra de cada palabra en mayúscula, resto en minúscula',
    required: false,
    defaultEnabled: true,
  },
  {
    id: 'deduplicate',
    label: 'Eliminar duplicados',
    description: 'Mantiene solo la primera aparición de cada valor normalizado',
    required: false,
    defaultEnabled: true,
  },
  {
    id: 'fuzzyCorrect',
    label: 'Corrección ortográfica',
    description: 'Corrige typos comparando contra lista de referencia (fuzzy matching)',
    required: false,
    defaultEnabled: false,
  },
  {
    id: 'removeEmpty',
    label: 'Eliminar líneas vacías',
    description: 'Descarta líneas que queden vacías después de la normalización',
    required: true,
    defaultEnabled: true,
  },
]

export const DEFAULT_RULESET: ETLRuleSet = Object.fromEntries(
  AVAILABLE_RULES.map(r => [r.id, r.defaultEnabled])
)
```

### Componente nuevo: `app/components/RulesConfig.tsx`

Panel colapsable (accordion) que muestra las reglas como toggles.
Tiene botones "Guardar perfil" y "Cargar perfil" que usan localStorage.
Muestra un badge "N reglas activas" en el header cuando está colapsado.

### Cambios en `app/lib/normalizer.ts`

Recibir `ETLRuleSet` como parámetro y aplicar solo las reglas habilitadas:

```typescript
export function processFile(
  lines: string[],              // CAMBIO: recibir líneas ya parseadas
  options: {
    rules?: ETLRuleSet          // NUEVO: reglas configurables
    correct?: boolean           // mantener compatibilidad
  } = {}
): ProcessResult
```

Aplicar reglas condicionalmente dentro de `normalizeText()`.

---

## MÓDULO 3 — Data Quality Score

### Objetivo
Mostrar un score de calidad del dataset ANTES y DESPUÉS de normalizar.
El score va de 0 a 100 y se calcula en base a los problemas detectados.

### Archivo nuevo: `app/lib/quality-score.ts`

```typescript
/**
 * quality-score.ts
 * Calcula un score de calidad del dato (0–100) para un dataset.
 * Penaliza por: tildes, mayúsculas inconsistentes, duplicados, espacios extra.
 */

export interface QualityBreakdown {
  score: number              // 0–100
  totalRecords: number
  issues: {
    withAccents: number       // registros con tildes/eñes
    wrongCase: number         // registros con capitalización incorrecta
    duplicates: number        // registros duplicados
    extraSpaces: number       // registros con espacios extra
    emptyLines: number        // líneas vacías
  }
  grade: 'A' | 'B' | 'C' | 'D' | 'F'  // Nota de calidad
}

/**
 * Calcula la calidad del dataset original (antes de normalizar)
 */
export function calculateQuality(lines: string[]): QualityBreakdown {
  // Implementar análisis de cada tipo de problema
  // Cada problema tiene un peso diferente en el score final:
  // - Duplicados: -15 puntos por cada 10% de duplicados
  // - Tildes: -10 puntos por cada 10% de registros con tildes
  // - Capitalización: -10 puntos por cada 10% inconsistente
  // - Espacios: -5 puntos por cada 10% con espacios extra
}

/**
 * Calcula la calidad DESPUÉS de normalizar
 * Debería ser siempre 100 si el normalizer funciona bien
 */
export function calculateQualityAfter(comunas: { normalized: string }[]): QualityBreakdown
```

### Componente nuevo: `app/components/QualityGauge.tsx`

Gauge semicircular (SVG) que muestra el score antes y después.
Colores: rojo (<40), naranja (40-70), verde (>70).
Incluye breakdown con iconos de cada tipo de problema.
Animación de transición del número al cargar.

```typescript
interface QualityGaugeProps {
  before: QualityBreakdown
  after: QualityBreakdown
}
```

### Dónde integrarlo
- En `page.tsx`, mostrar el gauge ENCIMA de StatsPanel
- Calcular `before` durante el `processFile()` en `normalizer.ts`
- Devolver en la respuesta de `api/process` los campos `qualityBefore` y `qualityAfter`
- Agregar `qualityScore` al modelo `Batch` en `schema.prisma`

---

## MÓDULO 4 — Exportar SQL

### Objetivo
Generar scripts SQL listos para ejecutar en PostgreSQL, MySQL o SQLite.
Incluye CREATE TABLE + INSERT INTO con todos los datos normalizados.

### Archivo nuevo: `app/lib/sql-export.ts`

```typescript
/**
 * sql-export.ts
 * Genera scripts SQL para importar los datos normalizados en diferentes motores.
 */

export type SQLDialect = 'postgresql' | 'mysql' | 'sqlite'

export interface SQLExportOptions {
  tableName: string          // Nombre de la tabla (default: 'comunas_norm')
  dialect: SQLDialect
  includeOriginal: boolean   // Si incluir la columna 'original' además de 'normalizado'
  includeIndex: boolean      // Si crear un índice sobre la columna normalizada
}

/**
 * Genera el script SQL completo (DROP IF EXISTS + CREATE + INSERT)
 * con comentarios explicativos para cada sección.
 */
export function generateSQL(
  comunas: { original: string; normalized: string }[],
  options: SQLExportOptions
): string {
  // Generar:
  // 1. Comentario de encabezado con fecha, total de registros, dialecto
  // 2. DROP TABLE IF EXISTS
  // 3. CREATE TABLE con tipos correctos para cada dialecto
  // 4. INSERT INTO en batches de 500 registros (para archivos grandes)
  // 5. CREATE INDEX (si se pidió)
  // 6. Comentario de pie con estadísticas
}
```

### Nuevo endpoint: `app/api/download/route.ts`

Agregar `type=sql` al switch existente.
Recibir parámetros: `dialect`, `tableName`, `includeOriginal`, `includeIndex`.

### Componente nuevo: `app/components/SqlExport.tsx`

Panel con:
- Selector de dialecto (PostgreSQL / MySQL / SQLite) con íconos
- Input para nombre de tabla
- Checkboxes para opciones
- Preview de las primeras 10 líneas del SQL
- Botón "Copiar" y botón "Descargar .sql"

---

## MÓDULO 5 — Historial de Batches

### Objetivo
Ver todos los archivos procesados anteriormente, con sus estadísticas y la posibilidad
de volver a ver los resultados de cualquier batch pasado.

### Cambios en `schema.prisma`

No se necesitan nuevos modelos. El modelo `Batch` ya tiene todo lo necesario.
Solo agregar el campo de quality score:

```prisma
model Batch {
  // ... campos existentes ...
  qualityBefore Float?  // Score de calidad antes de normalizar
  qualityAfter  Float?  // Score de calidad después (siempre ~100)
}
```

### Nuevo endpoint: `app/api/batches/route.ts`

```typescript
// GET /api/batches — Retorna los últimos 20 batches ordenados por fecha
// Con paginación opcional: ?page=1&limit=10
export async function GET(req: NextRequest) {
  const batches = await prisma.batch.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      totalInput: true,
      totalOutput: true,
      duplicates: true,
      changes: true,
      qualityBefore: true,
    }
  })
  return NextResponse.json({ batches })
}
```

### Componente nuevo: `app/components/BatchHistory.tsx`

Timeline vertical con los últimos batches procesados.
Cada item muestra: nombre de archivo, fecha, stats resumidos, score de calidad.
Clic en un item → carga ese batch en el dashboard principal.
Botón "Eliminar" con confirmación para borrar un batch y sus datos.

### Integración en `page.tsx`

Agregar una tercera tab "Historial" junto a "Datos normalizados" y "Log de cambios".

---

## MÓDULO 6 — REST API Pública con Documentación

### Objetivo
Exponer un endpoint público que normalice texto sin necesidad de la UI.
Ideal para integración con otros sistemas. Incluir documentación visual.

### Nuevo endpoint: `app/api/public/normalize/route.ts`

```typescript
/**
 * POST /api/public/normalize
 * Normaliza un array de strings sin guardar en base de datos.
 * Diseñado para integración externa (ETL pipelines, scripts, etc.)
 * 
 * Request body:
 * {
 *   "data": ["Santiago", "CONCEPCION", "valparaíso"],
 *   "rules": { "removeAccents": true, "titleCase": true, ... }  // opcional
 * }
 * 
 * Response:
 * {
 *   "results": [
 *     { "original": "Santiago", "normalized": "Santiago", "changed": false },
 *     { "original": "CONCEPCION", "normalized": "Concepcion", "changed": true },
 *     ...
 *   ],
 *   "stats": { "total": 3, "changed": 2, "duplicates": 0 }
 * }
 */
```

### Nueva página: `app/api-docs/page.tsx`

Página de documentación estilo Swagger (sin librería externa, con HTML/CSS propio).
Mostrar:
1. Descripción del endpoint
2. Request/Response schema
3. Ejemplo con cURL
4. Ejemplo con JavaScript fetch
5. Playground interactivo (textarea donde escribir JSON y ver la respuesta en vivo)

Agregar link "API Docs" en el header de la app.

---

## MÓDULO 7 — Gráficos Visuales (Charts)

### Objetivo
Mostrar los resultados del proceso con gráficos interactivos usando Recharts.
Un Data Architect siempre presenta datos con visualizaciones, no solo números.

### Instalación
```bash
pnpm add recharts
```

### Componente nuevo: `app/components/ChartsPanel.tsx`

Tres gráficos en una grid 2x2:

**1. Pie chart — Distribución de cambios**
```
Sectores: Normalizados (azul) / Duplicados (naranja) / Sin cambio (gris)
```

**2. Bar chart — Antes vs Después**
```
Dos barras por categoría: "Registros ingresados" vs "Registros únicos"
Muestra el porcentaje de reducción
```

**3. Radial bar — Score de calidad**
```
Semicírculo del score antes (rojo/naranja/verde según valor)
Animación al cargar
```

**4. Área chart — Tendencia de calidad histórica**
```
Línea con los últimos 10 batches procesados
Eje X: fecha, Eje Y: score de calidad
Solo se muestra si hay más de 2 batches en el historial
```

### Integración en `page.tsx`
Agregar `<ChartsPanel />` entre `<StatsPanel />` y el bloque de tabs.

---

## MÓDULO 8 — Modo Dry Run (Staging)

### Objetivo
Procesar el archivo y mostrar una PREVIEW de qué cambiaría, SIN guardar nada en la BD.
Concepto clave de ETL industrial: Bronze layer → Silver layer (staging) → Gold layer (producción).

### Cambios en `app/api/process/route.ts`

Agregar parámetro `dryRun: boolean` en el FormData:
- Si `dryRun = true` → ejecutar `processFile()` pero NO llamar a `prisma.batch.create()`
- Devolver los mismos stats + una muestra de los primeros 20 resultados
- Incluir en la respuesta `{ dryRun: true, preview: [...primeros 20 resultados] }`

### Cambios en `app/components/FileUpload.tsx`

Agregar toggle "Vista previa (sin guardar)" junto al botón de procesar.
Cuando `dryRun = true`:
- Mostrar un banner amarillo "MODO PREVIEW — estos datos NO se guardaron en la base de datos"
- Mostrar StatsPanel y primeros 20 resultados en una tabla reducida
- Mostrar botón "Confirmar y guardar" que reprocesa con `dryRun = false`

### Componente nuevo: `app/components/DryRunBanner.tsx`

Banner informativo con ícono de advertencia, texto explicativo y botón "Confirmar y guardar".

---

## MÓDULO 9 — Exportar JSON y Excel (.xlsx)

### Objetivo
Además de CSV y SQL, exportar en JSON (para APIs) y Excel nativo (para usuarios no técnicos).

### Instalación
```bash
pnpm add xlsx
```

### Cambios en `app/lib/sql-export.ts` → renombrar a `app/lib/exporters.ts`

Agregar funciones:

```typescript
/**
 * Genera un JSON con estructura estándar para consumo de APIs
 * Incluye metadatos del batch y array de resultados
 */
export function generateJSON(
  comunas: { original: string; normalized: string }[],
  batch: { fileName: string; createdAt: Date; totalInput: number }
): string {
  return JSON.stringify({
    metadata: {
      source: batch.fileName,
      processedAt: batch.createdAt,
      totalInput: batch.totalInput,
      totalOutput: comunas.length,
    },
    data: comunas,
  }, null, 2)
}

/**
 * Genera un buffer de Excel (.xlsx) con dos hojas:
 * - "Datos normalizados": tabla con original y normalizado
 * - "Resumen": stats del proceso
 */
export function generateExcel(
  comunas: { original: string; normalized: string }[],
  stats: { totalInput: number; totalOutput: number; duplicates: number; changes: number }
): Buffer
```

### Cambios en `app/api/download/route.ts`

Agregar `type=json` y `type=xlsx` al switch existente.

### Cambios en `app/components/DataTable.tsx`

Reemplazar el botón "Descargar CSV" por un dropdown con 4 opciones:
- Descargar CSV
- Descargar JSON
- Descargar Excel (.xlsx)
- Descargar SQL (abre SqlExport.tsx)

---

## MÓDULO 10 — Búsqueda y Filtros en la Tabla

### Objetivo
Permitir buscar y filtrar los resultados directamente en la tabla paginada.

### Cambios en `app/components/DataTable.tsx`

Agregar encima de la tabla:

```
[🔍 Buscar...              ] [Filtrar: Todos ▼] [Solo cambiados □]
```

**Funcionalidades:**
- Input de búsqueda: filtra en tiempo real sobre `original` y `normalized`
- Dropdown: "Todos" / "Solo normalizados" / "Sin cambio"
- Checkbox "Solo cambiados": muestra solo registros donde `original !== normalized`
- El contador "433 comunas normalizadas" se actualiza con los filtros activos
- Botón "Limpiar filtros" aparece cuando hay algún filtro activo

**Implementación:** todo en estado local de React, sin llamadas adicionales al API.

---

## MÓDULO 11 — Dark Mode

### Objetivo
Toggle de modo oscuro en el header. Persiste en localStorage.
Tailwind ya tiene soporte para dark mode — solo hay que activarlo.

### Cambios en `tailwind.config.ts`

```typescript
darkMode: 'class',  // activar dark mode por clase en el <html>
```

### Nuevo hook: `app/hooks/useDarkMode.ts`

```typescript
/**
 * useDarkMode.ts
 * Hook para manejar el modo oscuro.
 * Lee la preferencia del sistema al inicio y persiste en localStorage.
 */
export function useDarkMode(): [boolean, () => void] {
  // Leer de localStorage o preferencia del sistema
  // Agregar/remover clase 'dark' en document.documentElement
  // Persistir en localStorage al cambiar
}
```

### Cambios en `app/layout.tsx`

Agregar script inline para aplicar la clase `dark` antes del render (evita flash):

```html
<script dangerouslySetInnerHTML={{ __html: `
  const dark = localStorage.getItem('darkMode') === 'true' ||
    (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
`}}/>
```

### Cambios en `app/components/` (todos los componentes)

Agregar variantes `dark:` de Tailwind en cada clase de color:
- `bg-white` → `bg-white dark:bg-gray-900`
- `text-gray-800` → `text-gray-800 dark:text-gray-100`
- `border-gray-200` → `border-gray-200 dark:border-gray-700`
- etc.

### Cambios en `page.tsx` — header

Agregar botón toggle sol/luna en el extremo derecho del header:
```tsx
<button onClick={toggleDark}>
  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
</button>
```

---

## MÓDULO 12 — Dashboard Analytics Global

### Objetivo
Página `/analytics` con métricas acumuladas de TODOS los batches históricos.
Demuestra capacidad de análisis y reporting sobre datos persistidos.

### Nueva página: `app/analytics/page.tsx`

Layout con 3 secciones:

**Sección 1 — KPIs globales (cards)**
```
Total archivos procesados | Total registros procesados | 
Promedio de calidad | Total duplicados eliminados histórico
```

**Sección 2 — Gráficos históricos**
```
- Line chart: evolución del score de calidad en el tiempo (todos los batches)
- Bar chart: top 10 archivos con más duplicados
- Pie chart: distribución acumulada de tipos de cambio
```

**Sección 3 — Tabla resumen de todos los batches**
```
Tabla con: fecha, archivo, registros, calidad, acciones (ver / eliminar)
Paginada, 10 registros por página
Botón "Exportar resumen CSV" con stats de todos los batches
```

### Nuevo endpoint: `app/api/analytics/route.ts`

```typescript
// GET /api/analytics
// Retorna métricas agregadas de todos los batches
export async function GET() {
  const [totals, batches] = await Promise.all([
    // Aggregate query: sum de totalInput, totalOutput, duplicates, changes
    prisma.batch.aggregate({
      _sum: { totalInput: true, totalOutput: true, duplicates: true, changes: true },
      _count: { id: true },
      _avg: { qualityBefore: true },
    }),
    // Todos los batches para los gráficos
    prisma.batch.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, fileName: true, createdAt: true, totalInput: true,
                totalOutput: true, duplicates: true, qualityBefore: true }
    })
  ])
  return NextResponse.json({ totals, batches })
}
```

### Cambios en `app/layout.tsx` — navegación

Agregar link "Analytics" en el header junto a "API Docs".

---

## ORDEN DE IMPLEMENTACIÓN COMPLETO (v2.0)

Implementar en este orden exacto — cada paso es verificable antes de seguir:

```
FASE 1 — Lógica base (sin UI)
1.  lib/etl-rules.ts
2.  lib/parser.ts
3.  lib/quality-score.ts
4.  lib/exporters.ts              (SQL + JSON + Excel, renombrado de sql-export.ts)
5.  Actualizar lib/normalizer.ts  (recibir reglas + líneas pre-parseadas)
6.  Actualizar schema.prisma      (qualityBefore, qualityAfter en Batch)
7.  pnpm dlx prisma migrate dev --name add_quality_and_formats
8.  pnpm build → verificar 0 errores TS

FASE 2 — Componentes nuevos
9.  components/ColumnSelector.tsx
10. components/RulesConfig.tsx
11. components/QualityGauge.tsx
12. components/SqlExport.tsx
13. components/BatchHistory.tsx
14. components/ChartsPanel.tsx
15. components/DryRunBanner.tsx
16. hooks/useDarkMode.ts

FASE 3 — Actualizar existentes
17. Actualizar components/FileUpload.tsx    (multi-formato + ColumnSelector + DryRun toggle)
18. Actualizar components/DataTable.tsx     (búsqueda + filtros + dropdown exportar)
19. Actualizar components/StatsPanel.tsx    (si hay campos nuevos)
20. Actualizar api/process/route.ts         (dryRun + parser + rules + quality)
21. Actualizar api/download/route.ts        (type=json, type=xlsx, type=sql)
22. Actualizar layout.tsx                   (dark mode script + nav links)
23. Actualizar page.tsx                     (ChartsPanel + DryRunBanner + dark mode toggle)

FASE 4 — Endpoints y páginas nuevas
24. api/batches/route.ts
25. api/public/normalize/route.ts
26. api/analytics/route.ts
27. app/api-docs/page.tsx
28. app/analytics/page.tsx
29. pnpm build → verificar 0 errores TS

FASE 5 — Dark mode (último, porque toca todos los componentes)
30. Agregar variantes dark: en TODOS los componentes
31. pnpm build → verificar 0 errores TS

FASE 6 — Deploy
32. git add . && git commit -m "feat: COMUNAS_NORM v2.0 — ETL completo"
33. Subir al VPS con SCP o git pull
34. pnpm install && pnpm dlx prisma migrate deploy && pnpm build
35. pm2 restart comunas-norm
36. Verificar sistema.franciscodev.cl funcionando
```

---

## CHECKLIST DE CALIDAD FINAL

Antes de dar por terminado, verificar CADA punto:

**Módulos originales (v1)**
- [ ] Sube un TXT → normaliza, deduplica, log, descarga CSV

**Módulo 1 — Parser**
- [ ] Sube un CSV con 3 columnas → aparece ColumnSelector
- [ ] Sube un TSV → detecta formato automáticamente

**Módulo 2 — Reglas ETL**
- [ ] Desactiva "Eliminar tildes" → los acentos se mantienen en el resultado
- [ ] Guarda un perfil → recarga la página → el perfil sigue guardado

**Módulo 3 — Data Quality**
- [ ] Sube datos sucios → score bajo; datos limpios → score alto
- [ ] El gauge muestra animación al cargar

**Módulo 4 — SQL Export**
- [ ] Descarga PostgreSQL → se puede ejecutar en psql sin errores
- [ ] Cambia dialecto a SQLite → el script cambia los tipos de datos

**Módulo 5 — Historial**
- [ ] Procesa 3 archivos → el historial muestra los 3
- [ ] Click en un batch pasado → carga sus resultados en el dashboard

**Módulo 6 — REST API**
- [ ] POST /api/public/normalize con JSON → respuesta correcta
- [ ] El playground en /api-docs funciona en vivo

**Módulo 7 — Charts**
- [ ] Los 4 gráficos se renderizan al procesar un archivo
- [ ] El área chart histórico aparece después del segundo batch

**Módulo 8 — Dry Run**
- [ ] Toggle "Vista previa" → procesa sin guardar, muestra banner amarillo
- [ ] "Confirmar y guardar" → guarda y el banner desaparece

**Módulo 9 — Export JSON/Excel**
- [ ] Dropdown muestra 4 opciones de descarga
- [ ] El .xlsx abre correctamente en Excel

**Módulo 10 — Búsqueda**
- [ ] Buscar "santiago" → filtra la tabla en tiempo real
- [ ] "Solo cambiados" → muestra solo filas con original ≠ normalizado

**Módulo 11 — Dark Mode**
- [ ] Toggle sol/luna en el header cambia el tema
- [ ] Recarga la página → el tema persiste

**Módulo 12 — Analytics**
- [ ] /analytics muestra KPIs correctos
- [ ] Los gráficos históricos se renderizan

---

## NOTAS PARA CLAUDE CODE

- NO usar `any` en TypeScript — siempre tipar correctamente
- Comentar TODO el código en español (requisito de la evaluación)
- Cada archivo nuevo debe tener su JSDoc en el encabezado
- Si algo rompe el build, revertir ESE archivo específico antes de continuar
- Ejecutar `pnpm build` después de cada FASE (no de cada archivo)
- El proyecto está en producción en `sistema.franciscodev.cl` — ser cuidadoso
- `pnpm add recharts xlsx` antes de empezar la Fase 2
- Para el dark mode (Fase 5): agregar `darkMode: 'class'` en `tailwind.config.ts` primero
- El módulo de analytics requiere que ya existan batches en la BD para mostrar datos reales

---

*Plan generado para COMUNAS_NORM v2.0 — 12 módulos — Evaluación 2, Arquitectura y Almacenamiento de Datos — INACAP 2026*
