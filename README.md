# Memora V3

Aplicación para estudiar cualquier materia y retenerla a largo plazo. Reglas: `CLAUDE.md`. Visión, dominio e hitos: `docs/`.

## Requisitos

Node 22 y pnpm 11.

```bash
pnpm install
pnpm test        # pruebas de todos los paquetes
pnpm typecheck   # comprobación de tipos
pnpm simulate    # simulación de 30 días del núcleo (ver docs/SIMULACION-H1.md)
```

## Paquetes

- `packages/core`: núcleo pedagógico agnóstico de la materia (H1). Sin interfaz ni servidor.
- `tools/simulate`: alumnos sintéticos para probar el núcleo de punta a punta.
