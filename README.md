# qaja

Monorepo base con **Next.js (`pnpm`)** y **FastAPI (`uv`)** preparado para desplegarse en **Railway** como un **único proyecto** con **dos servicios** (`web` y `api`).

## Estructura

```text
qaja/
├── api/                 # Servicio FastAPI (Python + uv + Railpack)
│   ├── app/
│   ├── tests/
│   ├── main.py
│   ├── pyproject.toml
│   ├── uv.lock
│   └── railpack.json
├── web/                 # Servicio Next.js (App Router + pnpm + Railpack)
│   ├── src/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── railpack.json
├── mise.toml            # Versiones locales de node, pnpm, python, uv y just
└── justfile             # Comandos rápidos de desarrollo y verificación
```

## Desarrollo local

Requisitos: [mise](https://mise.jdx.dev/) (gestiona Node, pnpm, Python, uv y just).

```bash
mise trust
mise install

# Instalar dependencias iniciales
cd api && uv sync && cd ..
cd web && pnpm install && cd ..

# Levantar ambos servicios en paralelo (api :8000, web :3000)
just dev
```

Otros comandos útiles:

```bash
just dev-api   # Solo FastAPI en http://127.0.0.1:8000
just dev-web   # Solo Next.js en http://localhost:3000
just check     # Ejecuta pytest (api) + tsc --noEmit (web)
just build     # Build de producción de Next.js
```

## Despliegue en Railway (1 Proyecto, 2 Servicios)

No necesitas crear 2 proyectos ni 2 repositorios. Railway aísla ambos stacks dentro del mismo proyecto usando **Root Directory** y **Railpack**:

1. **Crea un Proyecto en Railway** y agrega dos servicios vacíos o conectados al mismo repositorio de GitHub: **`api`** y **`web`**.
2. **Servicio `api`:**
   - Ve a **Settings → Source → Root Directory** y configura `/api`.
   - Railpack detectará `api/railpack.json`, `api/pyproject.toml` y `api/uv.lock`, instalará con `uv` y ejecutará `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`.
   - *(Opcional)* En **Variables**, ajusta `ENVIRONMENT=production`.
3. **Servicio `web`:**
   - Ve a **Settings → Source → Root Directory** y configura `/web`.
   - Railpack detectará `web/railpack.json`, `web/package.json` y `web/pnpm-lock.yaml`, ejecutará `pnpm run build` y levantará `next start -H 0.0.0.0 -p ${PORT:-3000}`.
   - En **Variables**, agrega la URL interna para comunicación privada entre servicios:
     ```dotenv
     API_INTERNAL_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}
     ```
   - En **Settings → Networking**, genera un dominio público para `web`.
4. **Opcional (si el navegador llamará directo a `api`):**
   - Genera un dominio público para `api` en **Settings → Networking**.
   - En las variables de `web`, agrega `NEXT_PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}`.
   - En las variables de `api`, agrega `CORS_ORIGINS=https://${{web.RAILWAY_PUBLIC_DOMAIN}}`.
