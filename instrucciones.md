# COMUNAS_NORM — Instructivo Completo
> Proyecto: Evaluación 2 - Arquitectura y Almacenamiento de Datos — INACAP
> Stack: Next.js 14 · TypeScript · Prisma · PostgreSQL · Tailwind CSS
> Deploy: VPS Hostinger (Ubuntu 22.04) · PM2 · Nginx

---

## Índice

1. [Descripción del Proyecto](#1-descripción-del-proyecto)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Requisitos Previos](#3-requisitos-previos)
4. [Instalación Local](#4-instalación-local)
5. [Configuración de Base de Datos (Local)](#5-configuración-de-base-de-datos-local)
6. [Variables de Entorno](#6-variables-de-entorno)
7. [Comandos Prisma](#7-comandos-prisma)
8. [Correr en Desarrollo](#8-correr-en-desarrollo)
9. [Preparar VPS Hostinger](#9-preparar-vps-hostinger)
10. [Configurar PostgreSQL en VPS](#10-configurar-postgresql-en-vps)
11. [Deploy Manual al VPS](#11-deploy-manual-al-vps)
12. [Configurar Nginx](#12-configurar-nginx)
13. [Configurar PM2](#13-configurar-pm2)
14. [Trabajar con Claude Code](#14-trabajar-con-claude-code)
15. [Funcionalidades del Sistema](#15-funcionalidades-del-sistema)
16. [Solución de Problemas Comunes](#16-solución-de-problemas-comunes)

---

## 1. Descripción del Proyecto

Aplicación web para normalizar datasets de comunas chilenas (tabla `COMUNAS_NORM`).

### ¿Qué hace?
- Carga archivos `.txt` con nombres de comunas (uno por línea)
- Normaliza el texto: elimina tildes, eñes, espacios extra y unifica mayúsculas/minúsculas
- Elimina registros duplicados
- Genera un log detallado de cada cambio realizado
- Guarda los resultados en PostgreSQL
- Permite descargar el dataset limpio (CSV) y el log de cambios (TXT)
- Muestra estadísticas y tabla de resultados en el dashboard

---

## 2. Estructura del Proyecto

```
comunas-norm/
├── prisma/
│   └── schema.prisma          # Modelos de base de datos
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── process/
│   │   │   │   └── route.ts   # POST: procesa y normaliza el archivo
│   │   │   ├── comunas/
│   │   │   │   └── route.ts   # GET: obtiene comunas normalizadas
│   │   │   ├── logs/
│   │   │   │   └── route.ts   # GET: obtiene log de cambios
│   │   │   └── download/
│   │   │       └── route.ts   # GET: descarga CSV o TXT del log
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx           # Página principal con tabs
│   ├── components/
│   │   ├── FileUpload.tsx     # Drag & drop para cargar archivo
│   │   ├── StatsPanel.tsx     # Cards con estadísticas del proceso
│   │   ├── DataTable.tsx      # Tabla paginada de resultados
│   │   └── LogViewer.tsx      # Visor del log de cambios
│   └── lib/
│       ├── normalizer.ts      # Lógica de normalización de datos
│       └── prisma.ts          # Instancia del cliente Prisma
├── .env                       # Variables de entorno (NO subir a Git)
├── .env.example               # Plantilla de variables (SÍ subir a Git)
├── .gitignore
├── INSTRUCTIVO.md             # Este archivo
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 3. Requisitos Previos

### En tu máquina local
- Node.js 20+
- pnpm instalado globalmente
- PostgreSQL instalado (para desarrollo local)
- Git
- Editor de código (VS Code recomendado)
- Claude Code instalado (ver sección 14)

### En el VPS
- Ubuntu 22.04
- Acceso SSH con usuario con permisos sudo
- Puerto 80 y 443 abiertos en el firewall de Hostinger

---

## 4. Instalación Local

### Crear el proyecto
```bash
pnpm create next-app@latest comunas-norm
```
Seleccionar estas opciones:
```
✔ TypeScript?          › Yes
✔ ESLint?              › Yes
✔ Tailwind CSS?        › Yes
✔ src/ directory?      › Yes
✔ App Router?          › Yes
✔ Turbopack?           › No
✔ Customize alias?     › No
```

### Entrar al proyecto
```bash
cd comunas-norm
```

### Instalar dependencias
```bash
pnpm add prisma @prisma/client
pnpm add @neondatabase/serverless
pnpm add react-dropzone
pnpm add react-hot-toast
pnpm add lucide-react
```

### Inicializar Prisma
```bash
pnpm dlx prisma init
```

---

## 5. Configuración de Base de Datos (Local)

### Instalar PostgreSQL (si no lo tienes)

**Windows:** Descargar desde https://www.postgresql.org/download/windows/

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Crear base de datos local
```bash
# Entrar a PostgreSQL
psql -U postgres

# Dentro de psql ejecutar:
CREATE DATABASE comunas_norm;
CREATE USER comunas_user WITH PASSWORD 'password_local';
GRANT ALL PRIVILEGES ON DATABASE comunas_norm TO comunas_user;
\q
```

---

## 6. Variables de Entorno

Crear el archivo `.env` en la raíz del proyecto:

```env
# Base de datos local
DATABASE_URL="postgresql://comunas_user:password_local@localhost:5432/comunas_norm"
DIRECT_URL="postgresql://comunas_user:password_local@localhost:5432/comunas_norm"
```

> ⚠️ Nunca subas el archivo `.env` a Git. Ya está en `.gitignore`.

El archivo `.env.example` (que SÍ va en Git) debe verse así:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
```

---

## 7. Comandos Prisma

### Aplicar el schema a la base de datos
```bash
pnpm dlx prisma migrate dev --name init
```

### Ver los datos en el navegador (Prisma Studio)
```bash
pnpm dlx prisma studio
```

### Regenerar el cliente después de cambiar el schema
```bash
pnpm dlx prisma generate
```

### Resetear la base de datos (¡borra todo!)
```bash
pnpm dlx prisma migrate reset
```

### Ver el estado de las migraciones
```bash
pnpm dlx prisma migrate status
```

---

## 8. Correr en Desarrollo

```bash
pnpm dev
```

Abrir en el navegador: `http://localhost:3000`

### Build de producción (para probar antes de subir)
```bash
pnpm build
pnpm start
```

---

## 9. Preparar VPS Hostinger

Conectarse por SSH:
```bash
ssh usuario@IP_DEL_VPS
```

### Actualizar el sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Instalar pnpm
```bash
npm install -g pnpm
```

### Instalar PM2
```bash
npm install -g pm2
```

### Instalar PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### Instalar Nginx
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Abrir puertos en el firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 10. Configurar PostgreSQL en VPS

```bash
sudo -u postgres psql
```

Dentro de psql:
```sql
CREATE DATABASE comunas_norm;
CREATE USER comunas_user WITH PASSWORD 'CAMBIA_ESTA_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE comunas_norm TO comunas_user;
\q
```

---

## 11. Deploy Manual al VPS

### Opción A — Subir con SCP (desde tu máquina local)

Primero hacer el build local:
```bash
pnpm build
```

Crear la carpeta en el VPS:
```bash
ssh usuario@IP_DEL_VPS "mkdir -p /var/www/comunas-norm"
```

Subir los archivos necesarios:
```bash
scp -r .next package.json pnpm-lock.yaml prisma public usuario@IP_DEL_VPS:/var/www/comunas-norm/
```

### Opción B — Clonar desde GitHub (recomendado)

En el VPS:
```bash
cd /var/www
git clone https://github.com/TU_USUARIO/comunas-norm.git
cd comunas-norm
```

### En el VPS — instalar dependencias y migrar

```bash
cd /var/www/comunas-norm

# Crear el .env con las credenciales del VPS
nano .env
# (pegar las variables con los datos del VPS y guardar con Ctrl+X)

# Instalar dependencias
pnpm install --frozen-lockfile

# Aplicar migraciones a la DB del VPS
pnpm dlx prisma migrate deploy

# Hacer el build
pnpm build
```

---

## 12. Configurar Nginx

Crear el archivo de configuración:
```bash
sudo nano /etc/nginx/sites-available/comunas-norm
```

Pegar esta configuración (reemplaza `TU_DOMINIO_O_IP`):
```nginx
server {
    listen 80;
    server_name TU_DOMINIO_O_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar el sitio:
```bash
sudo ln -s /etc/nginx/sites-available/comunas-norm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 13. Configurar PM2

Iniciar la aplicación con PM2:
```bash
cd /var/www/comunas-norm
pm2 start pnpm --name "comunas-norm" -- start
```

Guardar la configuración para que reinicie automáticamente:
```bash
pm2 save
pm2 startup
# Ejecutar el comando que PM2 te indique
```

### Comandos útiles de PM2
```bash
pm2 list                        # Ver apps corriendo
pm2 logs comunas-norm           # Ver logs en tiempo real
pm2 restart comunas-norm        # Reiniciar la app
pm2 stop comunas-norm           # Detener la app
pm2 delete comunas-norm         # Eliminar la app de PM2
```

### Actualizar el código en el VPS
```bash
cd /var/www/comunas-norm
git pull                        # Si usas Git
pnpm install
pnpm build
pm2 restart comunas-norm
```

---

## 14. Trabajar con Claude Code

Claude Code es un agente de IA en la terminal que puede leer, escribir y ejecutar código directamente en el proyecto.

### Instalación
```bash
npm install -g @anthropic-ai/claude-code
```

### Iniciar Claude Code en el proyecto
```bash
cd comunas-norm
claude
```

### Cómo usarlo en este proyecto

Claude Code puede leer este instructivo y el contexto del proyecto completo. Algunos ejemplos de lo que puedes pedirle:

**Crear archivos:**
```
Crea el archivo src/lib/normalizer.ts con la lógica de normalización
descrita en el INSTRUCTIVO.md
```

**Corregir errores:**
```
El endpoint api/process está dando error 500, revisa el archivo
src/app/api/process/route.ts y corrígelo
```

**Agregar funcionalidades:**
```
Agrega paginación al componente DataTable.tsx, 20 registros por página
```

**Revisar el schema:**
```
Revisa prisma/schema.prisma y agrega un índice para búsqueda
por nombre normalizado
```

**Ejecutar comandos:**
```
Corre pnpm dlx prisma migrate dev --name add_index y verifica
que no haya errores
```

### Buenas prácticas con Claude Code

- Siempre dile **en qué archivo** quieres que trabaje
- Si hay un error, **pega el mensaje completo** del error
- Pídele que **comente el código** (lo requiere la evaluación)
- Antes de subir al VPS, pídele que haga un **code review**
- Puedes pedirle que lea este instructivo con: `lee el INSTRUCTIVO.md y dime qué falta por hacer`

### Contexto que Claude Code necesita saber

Cuando inicies una sesión nueva, puedes darle este contexto:

```
Estoy trabajando en comunas-norm, una app Next.js 14 con TypeScript,
Prisma y PostgreSQL. El objetivo es normalizar un dataset de comunas
chilenas: eliminar tildes, unificar mayúsculas, quitar duplicados y
generar un log de cambios. El deploy es en un VPS Hostinger con
Ubuntu 22.04, PM2 y Nginx. Lee el INSTRUCTIVO.md para el contexto completo.
```

---

## 15. Funcionalidades del Sistema

### Pipeline de Normalización (`src/lib/normalizer.ts`)
1. **Trim y espacios** — elimina espacios al inicio/fin y múltiples espacios seguidos
2. **Tildes y caracteres especiales** — usa Unicode NFD para remover diacríticos (á→a, é→e, ñ→n, etc.)
3. **Formato Title Case** — primera letra de cada palabra en mayúscula, resto en minúscula
4. **Deduplicación** — compara versiones normalizadas, mantiene el primer registro

### Endpoints API
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/process` | Recibe el archivo .txt y ejecuta la normalización |
| GET | `/api/comunas?batchId=X` | Retorna las comunas normalizadas del lote |
| GET | `/api/logs?batchId=X` | Retorna el log de cambios del lote |
| GET | `/api/download?batchId=X&type=csv` | Descarga CSV con datos limpios |
| GET | `/api/download?batchId=X&type=log` | Descarga TXT con el log de cambios |

### Modelos de Base de Datos
- **`Batch`** — representa un lote de procesamiento (un archivo subido)
- **`Comuna`** — cada comuna normalizada, vinculada a un Batch
- **`LogEntry`** — cada cambio individual registrado durante la normalización

---

## 16. Solución de Problemas Comunes

### Error: `Cannot find module '@prisma/client'`
```bash
pnpm dlx prisma generate
```

### Error: `P1001: Can't reach database server`
- Verificar que PostgreSQL esté corriendo: `sudo systemctl status postgresql`
- Verificar que las credenciales en `.env` sean correctas
- Verificar que la base de datos exista: `psql -U postgres -l`

### Error: `EADDRINUSE: address already in use :::3000`
```bash
# Ver qué proceso usa el puerto 3000
lsof -i :3000
# Matar el proceso (reemplazar PID)
kill -9 PID
```

### PM2 no reinicia después de reboot del VPS
```bash
pm2 save
pm2 startup
# Ejecutar el comando que te muestre
```

### Nginx devuelve 502 Bad Gateway
- Verificar que PM2 esté corriendo: `pm2 list`
- Verificar que Next.js escuche en el puerto 3000: `pm2 logs comunas-norm`
- Verificar la configuración de Nginx: `sudo nginx -t`

### Migraciones fallidas en producción
```bash
# Ver estado de migraciones
pnpm dlx prisma migrate status

# Aplicar migraciones pendientes (producción)
pnpm dlx prisma migrate deploy
```

---

## Notas Finales

- El archivo `.env` **nunca** debe subirse a Git ni compartirse
- Hacer siempre `pnpm build` y probar localmente antes de subir al VPS
- Guardar backups de la DB periódicamente: `pg_dump comunas_norm > backup.sql`
- Los logs de PM2 están en `~/.pm2/logs/`

---

