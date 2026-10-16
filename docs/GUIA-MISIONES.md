# Guía para escribir misiones (cursos de conceptos)

Una misión es un módulo de un curso de conceptos (formato en `docs/FORMATO-CURSO.md`) con 12–20 unidades. Se escribe
para estudiar y recordar, no para copiar un temario. La IA la prepara como **borrador** (`"origin": "ai"`) y una
persona la revisa antes de publicarla (regla 12).

## Reglas
1. **Contenido propio.** Nunca se copia texto de libros o apuntes con derechos (reglas 14 y 16). Se usan para saber
   *qué* temas toca, no *cómo* los explica. Definiciones, historias y retos se redactan desde cero.
2. **Fuente citada.** Cada curso declara `sources` (documentación oficial abierta: dev.java, docs de Oracle, Spring,
   PostgreSQL/MySQL, MongoDB, MDN, React, AWS…). Si algo no se puede respaldar con una fuente abierta, no se incluye.
3. **Un concepto por unidad.** `name` es lo que se recuerda («PreparedStatement»); `gist` la idea en ≤ 60 caracteres
   («consulta SQL precompilada y segura»); `definition` una o dos frases claras y correctas.
4. **`answers`** con las formas que el alumno escribiría (español, inglés, sin tildes: «hilo», «thread»).
5. **`contrast`** cuando haya una confusión típica («≠ `==`: compara referencias»).
6. **Estándar Memora para la historia (D-049)**: no es un Anki bonito. Cada historia es absurda, exagerada y con una
   acción visual, y cumple tres cosas que el revisor automático comprueba:
   - **Puente de sonido** (`cue`): una palabra real del español que suena como el término (ROLLO → rollback,
     COMETA → commit, ESTATUA → static) y aparece en la historia. Si el término ya es español, puede omitirse.
   - **Idea clave**: la primera palabra de `gist` aparece en la historia, para que «Completa la historia» funcione.
   - **Límites**: escena ≤ 14 palabras; trazado de código ≤ 30 y cada comentario nombra un elemento de la historia.
   Ejemplo: «Un ROLLO gigante rueda hacia atrás y DESHACE todas tus huellas» (rollback).
   Las historias van en `private/dam/historias/<curso>-<NN>.py` y se aplican con `private/dam/retell.sh`.
7. **Asociación** (obligatoria si hay una defendible; si no, se omite):
   - Código con varias líneas significativas → `code_trace` (historia ≤ 30 palabras, ≥ 2 líneas, cada comentario
     nombra en MAYÚSCULAS un elemento de la historia).
   - Idea abstracta → `analogy` con `mapping` y `breaksWhere` honestos.
   - Término suelto → `absurd_scene` (≤ 14 palabras, pieza clave en MAYÚSCULAS).
   - La historia debe contener la idea clave (`gist`) para que «Completa la historia» funcione.
8. **Retos** (`exercises`): al menos uno por concepto cuando se pueda practicar. Respuestas **cortas y escribibles**
   (`3`, `extends`, `2`), con 2–3 opciones falsas plausibles y una `explanation` breve. Código Java/SQL **correcto y
   compilable**; si un reto depende de un detalle de versión, se indica.
9. **Ejemplos** (`examples`): código o caso corto con `explanation`.
10. **Claves** en minúsculas con guiones, únicas en todo el curso (prefijo de la misión si hay riesgo: `jdbc-commit`).
11. **Comprobar antes de importar:** `node --env-file=backend/.env backend/scripts/import-course.mjs <archivo> --check`
    (añadir `--append` si el curso ya existe). Corregir hasta que no haya problemas.

## Cabecera de cada archivo
```json
{ "schemaVersion": 1, "origin": "ai",
  "course": { "key": "dam-programacion", "title": "Programación · DAM", "subject": "programación",
    "contentLanguage": "en", "learnerLanguage": "es", "newPerSession": 12, "audio": false,
    "modes": ["associations", "arcade"], "visibility": "private", "license": "private-personal-use",
    "sources": [{ "title": "Currículo oficial DAM (RD 450/2010)" }, { "title": "dev.java — Learn Java", "url": "https://dev.java/learn/" }] },
  "modules": [{ "key": "01-que-es-programar", "title": "Misión 1 · Qué es programar", "units": [ … ] }] }
```

## Cursos de preparación de examen oficial (D-060)
Sin historia absurda: la unidad se crea con `E()` (sin `association`), cita en `notes` el apartado oficial del temario
(«Temario oficial · NC.3.4 · …») y lleva al menos dos retos tipo examen, a ser posible sobre un texto o problema propio.
Para reescribir una misión ya publicada sin perder progreso: `private/dam/update-units.mjs` y después `publish-course.mjs`.
