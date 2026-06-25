# COMUNAS_NORM

Aplicación web de normalización de datasets y modelado dimensional, desarrollada para la
**Evaluación 3 — Arquitectura y Almacenamiento de Datos (INACAP)**.

El sistema toma datasets crudos, los limpia mediante un pipeline ETL (tildes, mayúsculas,
espacios, duplicados, enriquecimiento) y, sobre el sistema operacional resultante, deriva un
**Data Warehouse** en esquema estrella con consultas OLAP en vivo.

## Módulos

El sistema normaliza tres datasets, cada uno con su propio pipeline y vistas:

- **Comunas** — normalización de comunas chilenas (elimina tildes/eñes, unifica
  capitalización, quita duplicados) y enriquecimiento con región (API DPA) y habitantes
  (INE Censo 2024).
- **Famosos** — normalización de personajes y sus fechas de nacimiento (detección de formato
  de fecha, cálculo de edad, marca de cumpleaños) e imágenes desde Wikipedia.
- **Lugares** — lugares turísticos con georreferencia (latitud/longitud) y dirección postal
  parseada (país, ciudad/estado), visualizados en un mapa con clústeres.

## Data Warehouse

A partir del sistema operacional (PostgreSQL) se deriva un **esquema estrella**:

- `FACT_NORMALIZACION` como tabla de hechos (grano: un registro de entrada al pipeline ETL)
  y **7 dimensiones** (tiempo, módulo, fuente, archivo, ubicación, tipo de cambio, formato de
  fecha), más una segunda tabla de hechos (`FACT_CALIDAD_DIARIA`) que forma una constelación.
- El modelo dimensional vive como **única fuente de verdad** en
  [`app/lib/dw-model.ts`](app/lib/dw-model.ts); la página `/datawarehouse` y sus componentes
  renderizan desde ahí (nada hardcodeado en el JSX).
- El ETL ([`scripts/etl-dw.ts`](scripts/etl-dw.ts)) lee la base operacional vía Prisma y
  puebla el esquema estrella en un archivo **SQLite** (`datawarehouse.db`), sin tocar
  PostgreSQL.
- La página `/datawarehouse` muestra el diagrama estrella interactivo, el diccionario de
  datos completo, la Matriz de Bus, el linaje OLTP→OLAP, los cruces de datos y las
  **consultas OLAP** (roll-up, drill-down, slice, dice, pivot) ejecutadas en vivo contra el DW.

## Stack

- **Next.js 16.2.6** (App Router) + **TypeScript**
- **Prisma + PostgreSQL** (sistema operacional)
- **better-sqlite3** (Data Warehouse / OLAP)
- **Tailwind CSS v4** (con dark mode)
- **Recharts** (gráficos) · **Leaflet** (mapas) · **lucide-react** (iconos)

## Cómo correr

Requisitos: Node.js 20+, pnpm y una instancia de PostgreSQL.

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar la base operacional en .env (en la raíz del proyecto)
#    DATABASE_URL="postgresql://USUARIO:PASSWORD@HOST:5432/comunas_norm"

# 3. Aplicar el schema a la base de datos
pnpm dlx prisma migrate deploy   # o: pnpm dlx prisma db push

# 4. Levantar el servidor de desarrollo
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

### Poblar el Data Warehouse

Con `DATABASE_URL` apuntando a la base operacional con datos, ejecuta el ETL para generar
el DW en SQLite:

```bash
pnpm etl
```

Esto crea/regenera `datawarehouse.db`. Tras poblarlo, la sección OLAP de `/datawarehouse`
mostrará resultados reales en vivo.

## Scripts

| Comando      | Descripción                                            |
|--------------|--------------------------------------------------------|
| `pnpm dev`   | Servidor de desarrollo                                 |
| `pnpm build` | Build de producción (incluye `prisma generate`)        |
| `pnpm start` | Servidor de producción                                 |
| `pnpm lint`  | ESLint                                                 |
| `pnpm etl`   | Pobla el Data Warehouse (SQLite) desde la base operacional |

Para la guía completa de instalación, base de datos y despliegue en VPS, ver
[`instrucciones.md`](instrucciones.md).
