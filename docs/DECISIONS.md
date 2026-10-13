# Decisiones

Formato: qué, por qué, alternativas descartadas. Las decisiones del 2026-10-13 vienen de las respuestas del usuario al
inventario (`docs/INVENTARIO.md`, sección 9; el número entre corchetes es el de la pregunta).

## D-001 · Stack [2]
- **Qué:** React + TypeScript + Vite (PWA), Directus nuevo (instancia propia, no la antigua), Kokoro en Docker,
  OpenRouter, despliegue con Coolify. Monorepo con **pnpm workspaces**.
- **Por qué:** coincide con `CLAUDE.md`; Directus nuevo evita arrastrar el esquema creado a mano.
- **Descartado:** reutilizar el Directus antiguo (reglas 1 y 8).

## D-002 · Empezar limpio [3, 4]
- **Qué:** no se migran cuentas ni progreso. Más adelante, solo si el usuario lo pide, se migran sus asociaciones propias
  por **exportación de solo lectura** (nunca importando código ni tocando la base antigua).
- **Asociaciones de IA:** de las 356 filas antiguas (para 355 palabras), 345 son manuales y 11 de IA. Las 11 de IA pasan a
  **borrador**; no se tratan como propias ni como publicadas.

## D-003 · ILERNA: curso privado, nunca en git [6, 2] (sustituye a la versión anterior de esta decisión)
- **Qué:** el material de ILERNA (libros comprados, uso personal) no se descarta, pero **nunca entra en git** y nunca se
  usa literal. Solo se usan resúmenes y preguntas propias, en un **curso privado visible solo para la cuenta del usuario**,
  cargado desde el administrador. El contenido original vive en carpetas ignoradas por git.
- **Se descarta igualmente:** `backend/private/ilerna/` del repositorio antiguo y `ilerna-editorial-plan.md`
  (derivados que copian estructura y texto); los módulos RA1–RA5 de `grammar_challenges` se reescriben desde cero si se
  quieren.
- **Regla añadida:** 16 en `CLAUDE.md`. Es una excepción acotada a la regla 14.
- **Consecuencia:** hay que garantizar visibilidad por cuenta en el modelo (propietario del curso y visibilidad
  `private`), porque el modelo de `DOMINIO.md` hoy no lo declara. Va a H2 (colecciones) y se anota en la propuesta.

## D-004 · Licencia [2, 7]
- **Qué:** licencia **privada**. Contenido propio (días 1–3, verbos, asociaciones manuales): **todos los derechos
  reservados**; origen «propio». Los campos de licencia del modelo admitirán `proprietary-own` y `private-personal-use`.
- **Descartado:** licencias abiertas para el contenido propio (el usuario no quiere publicarlo).

## D-005 · Cursos [8, 2]
- **Qué:** inglés primero; Java como segundo curso para probar la generalidad del núcleo (H5).
- **Unidad de Java antigua:** estaba en el esquema de palabra con puente y la «aprobó» un modelo. Pasa a **borrador**.

## D-006 · Autoría y revisión [9]
- **Qué:** el usuario es autor y revisor al principio; «revisor ≠ autor» se aplica cuando haya otra persona.
- **Condiciones:** el sistema registra quién revisó. Un modelo nunca cuenta como revisor. El contenido de riesgo medio o
  alto no se publica sin una segunda persona competente.

## D-007 · IA [10, 3]
- **Qué:** tope global de **5 €/mes con corte automático** y máximo **1 €/mes por usuario**. IA solo para **borradores
  desde el administrador**, nunca en la lección. Proveedores que guardan o entrenan con los prompts, excluidos.
- **Por qué:** sustituye al «2 €/día» propuesto; el usuario eligió un tope mensual.
- **Implicación:** el corte debe vivir en el servidor y contar coste real (no solo peticiones). El tope por usuario se
  aplica también a las peticiones del administrador cuando actúen en nombre de un usuario.

## D-008 · Registro [14, 5]
- **Qué:** por invitación. No hay alumnos reales: solo el usuario y su familia.

## D-009 · Sin ranking público [18]
- **Qué:** sin ranking con nombres visibles. `challenge_scores` no se porta.

## D-010 · Repositorio y commits [4]
- **Qué:** repositorio **privado `mem-ora`** en la cuenta `luismimz` de GitHub. Commits con el usuario de git
  configurado, sin `Co-Authored-By` ni enlaces de sesión (regla 17). Prefijos `feat/fix/docs/chore`, etiqueta por hito
  (`h0`, `h1`, …).
- **Estado:** el 13-oct `gh repo view luismimz/mem-ora` no encuentra el repositorio y `Memora/` aún no es un repo git.
  Pendiente de que el usuario confirme que se cree.

## D-011 · Despliegue [6]
- **Qué:** VPS Hetzner con Coolify, en un subdominio propio; la V2 sigue intacta. Las copias de seguridad se activan
  **antes de H2** (antes del primer cambio de esquema, regla 8).
- **Nota:** `HITOS.md` exige en H0 una copia de la base de datos y de los archivos del servidor. Queda como excepción
  explícita hasta H2, pendiente de que el usuario la apruebe al cerrar H0.
