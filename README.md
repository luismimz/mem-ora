# Memora V3

Aplicación para estudiar cualquier materia y retenerla a largo plazo. Reglas: `CLAUDE.md` (única fuente). Experiencia: `docs/ESTANDAR.md`. Visión, dominio y decisiones: `docs/`.

## Requisitos

Node 22 y pnpm 11.

```bash
pnpm install
pnpm test        # pruebas de todos los paquetes
pnpm typecheck   # comprobación de tipos
pnpm simulate    # simulación de 30 días del núcleo (ver docs/archivo/SIMULACION-H1.md); --days=60 para más
pnpm catalog-demo  # cómo explica el validador los problemas de varios catálogos
```

## Studio local (Directus)

Requiere Docker Desktop. Todo queda en el Mac (puertos solo en 127.0.0.1).

```bash
pnpm backend:env <tu-correo>   # crea backend/.env con secretos aleatorios (una vez)
pnpm backend:up                # Directus, Postgres y Mailpit
pnpm backend:schema:apply      # copia de seguridad + aplica backend/schema/snapshot.json
pnpm backend:access            # roles, permisos, 2FA de administración, ajustes
pnpm backend:accounts          # cuentas de prueba (contraseñas en backend/.env.accounts)
pnpm test:integration          # prueba de recorrido completo contra el Directus local
```

Panel: http://localhost:8055/admin · Correos: http://localhost:8025 · Guía de prueba: `docs/archivo/H2.1-PRUEBA.md`.

## App del alumno (local)

```bash
pnpm backend:seed-demo   # curso de demostración con contenido de ejemplo sin revisar
pnpm web                 # http://127.0.0.1:5173 (usa 127.0.0.1, no localhost: D-032)
```

Guía de prueba: `docs/archivo/H2.2a-PRUEBA.md`.

## Paquetes

- `packages/core`: núcleo pedagógico agnóstico de la materia (H1). Sin interfaz ni servidor.
- `packages/content`: tipos de unidad (`term`, `pattern`) y sus validadores, flujo de estados y mensajes para el autor.
- `packages/experiences`: motor de la sesión (pasos, ejercicios, corrección sin IA y eventos).
- `apps/web`: app del alumno (React + Vite), sesión por cookie.
- `techniques`: técnicas pedagógicas como módulos (puente fonético, escena absurda) con sus validadores.
- `backend`: Directus local, esquema versionado, permisos como código y la extensión `memora`.
- `tools/simulate`: alumnos sintéticos para probar el núcleo de punta a punta.
