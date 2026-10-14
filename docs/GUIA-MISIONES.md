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
6. **Asociación** (obligatoria si hay una defendible; si no, se omite):
   - Código con varias líneas significativas → `code_trace` (historia ≤ 30 palabras, ≥ 2 líneas, cada comentario
     nombra en MAYÚSCULAS un elemento de la historia).
   - Idea abstracta → `analogy` con `mapping` y `breaksWhere` honestos.
   - Término suelto → `absurd_scene` (≤ 14 palabras, pieza clave en MAYÚSCULAS).
   - La historia debe contener la idea clave (`gist`) para que «Completa la historia» funcione.
7. **Retos** (`exercises`): al menos uno por concepto cuando se pueda practicar. Respuestas **cortas y escribibles**
   (`3`, `extends`, `2`), con 2–3 opciones falsas plausibles y una `explanation` breve. Código Java/SQL **correcto y
   compilable**; si un reto depende de un detalle de versión, se indica.
8. **Ejemplos** (`examples`): código o caso corto con `explanation`.
9. **Claves** en minúsculas con guiones, únicas en todo el curso (prefijo de la misión si hay riesgo: `jdbc-commit`).
10. **Comprobar antes de importar:** `node --env-file=backend/.env backend/scripts/import-course.mjs <archivo> --check`
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
