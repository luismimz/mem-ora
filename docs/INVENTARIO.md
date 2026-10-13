# Inventario del repositorio antiguo (Hito 0)

Fecha: 2026-10-13. Origen: `/Volumes/CORSAIR/luismi/Desktop/AprendiendoIngles30dias` (solo lectura).

## Método y límites de este inventario

- Se leyó código, configuración y documentos del repositorio antiguo. No se modificó nada en él.
- Las consultas a base de datos se hicieron sobre **una copia** de `backend/data/memora.db` (SQLite local, instantánea del
  13-oct-2026 14:35), guardada fuera de ambos repositorios. Las pruebas y la compilación se ejecutaron sobre **otra copia**
  del árbol de trabajo (sin `.git`, sin datos, sin `.env`).
- **No verificado** (no hay acceso): Coolify, la base de datos PostgreSQL de producción, los datos reales de alumnos en
  producción, qué commit está desplegado, las variables reales de Coolify y qué voces responde el Kokoro desplegado.
- Los valores de las variables de entorno **no se leyeron ni se imprimieron**; solo sus nombres. `backend/.env` existe en
  local y está ignorado por git (comprobado: no está en `git ls-files`).
- `docs/VISION.md` y `docs/HITOS.md` están **vacíos (0 bytes)** y `docs/PORTING.md` solo contiene la fila de ejemplo.
  Este inventario se apoya en `CLAUDE.md` y `docs/DOMINIO.md`; la visión completa que cita `CLAUDE.md` no se pudo leer.
  El archivo `memora-kit-claude-code-universal.md` de la raíz no se leyó (no estaba en el encargo).

---

## 1. Resumen en 15 líneas

1. El repositorio antiguo contiene **dos clientes**: `frontend/` (V1, 13.005 líneas TS/TSX, PWA) y `memora-v2/` (V2, 6.314 líneas, reconstrucción por «unidades atómicas»), más un backend Directus 11.17.4 con una extensión propia `memora-ai` (759 líneas) y ~3.500 líneas de scripts.
2. `docker-compose.yml` construye **V2** como servicio `web`; V1 ya no se despliega. V2 **no tiene PWA** (sin manifiesto ni service worker); el PWA solo existe en V1.
3. Funciona (comprobado): V1 pasa 37 pruebas y V2 132; ambos compilan con `tsc -b` sin errores (sobre copia). El backend no tiene ninguna prueba automatizada.
4. `memora-v2/` y `backend/curriculum/` **no están en git** (sin seguir) y hay 72 cambios sin confirmar; el `Dockerfile` de V2 copia un archivo de `backend/curriculum/`. Un despliegue desde GitHub no puede reproducir lo local.
5. Catálogo local: 2.711 palabras, pero solo **355** (13 %) tienen asociación/escena y están «publicadas»; 2.356 son «backlog» sin contenido pedagógico. Hay 356 asociaciones (345 «seed», 11 de IA).
6. Contenido V2: 11 `learning_units`, 10 en borrador y 1 publicada (una unidad de **Java**, que demuestra otra materia pero forzada dentro del esquema de palabra con puente).
7. Repaso espaciado V1: escalones 1 h→24 h→3 d→7 d→14 d→30 d; un fallo baja un escalón, «dudar» (acierto >9 s) avanza con la mitad de intervalo. **No pondera por formato de ejercicio** (contradice la regla 11). V2 tiene un modelo más rico (capacidades: reconocer, oír, recuperar, producir) pero vive en `localStorage` y se sincroniza como eventos.
8. Kokoro: proveedor limpio y reutilizable (caché por huella en `speech_cache_v2`), pero sin léxico real de pronunciación (solo 2 reemplazos de texto) y con la voz por defecto de inglés.
9. OpenRouter: funciona, con varios modelos por variable de entorno, pero **sin tope de gasto**, **sin enrutado de privacidad** y sin esquema JSON validado en el camino de la lección (solo `response_format: json_object`).
10. La IA genera contenido en directo dentro de la lección en V1 (`/fill`, `/keyword`, `/chat`, `/story`): contradice la regla 12. V2 ya separa borradores de publicado.
11. Roles en Directus: solo **Administrator** y **Learner**; no hay autor ni revisor, ni flujo de estados, ni validación de `payload`. Directus sirve como Studio v0 solo con mucho trabajo (sección 4).
12. Contenido sin licencia registrada. Hay un riesgo claro de derechos de autor: material didáctico PDF de ILERNA usado como fuente (sección 5).
13. Permisos de Learner: crear en `progress`, `attempts`, `sentences`, etc. no valida el campo `user` (escritura atribuible a otro usuario; lectura sí está filtrada).
14. Sin copias de seguridad automáticas en el repositorio; solo 7 copias manuales de SQLite en `backend/data/` (el despliegue usa Postgres).
15. Lo más valioso a reescribir: el patrón de eventos de progreso idempotentes, la caché de voz por huella, el Arcade «balístico», el protocolo de calidad de asociaciones de V2 y los validadores de puente.

---

## 2. Tabla de componentes

Decisiones: **REUTILIZAR REESCRIBIENDO** (R), **DESCARTAR** (D), **CONSULTAR** (C).

| Ruta | Qué hace | Estado | Decisión | Motivo |
| --- | --- | --- | --- | --- |
| `frontend/src/lib/api.ts`, `store.tsx`, `pages/Login.tsx` | Autenticación Directus (login, registro, refresco, reset). Tokens en `localStorage`; el `access_token` se añade a la URL de `/assets` | Funciona | R (el flujo) | Directus auth es válido, pero guardar tokens en `localStorage` y en URL es deuda. Roles: solo admin/learner. |
| `memora-v2/src/services/directus.ts` | Cliente Directus V2 (login, refresh, items) | Funciona | C | Misma idea, menos código; útil como referencia. |
| Directus: colecciones `words`, `mnemonics`, `progress`, `attempts`, `study_days`, `sentences`, `irregular_verbs`, `verb_progress`, `profiles`, `mnemonic_feedback`, `pilot_reports`, `personal_vocabulary`, `speech_cache(_v2)`, `challenge_scores`, `grammar_challenges`, `learning_units`, `learning_events` (17) | Esquema V1 + V2 | Parcialmente vacío/obsoleto (ver sección 3) | D (esquema) / C | El modelo nuevo es otro (`DOMINIO.md`). Se consulta el campo a campo para no perder decisiones. |
| `backend/scripts/setup-schema.mjs` | Crea el esquema por API, a mano | Funciona pero sin instantáneas | D | Viola la regla 8 (migraciones versionadas). |
| `backend/extensions/memora-ai/dist/providers/kokoro.js` | Cliente de Kokoro (API compatible con OpenAI), timeout 20 s, reintento con voz por defecto | Funciona (código); servicio desplegado no verificado | **R** | Es la pieza que `PORTING.md` ya cita. Falta: idioma en la huella, léxico por idioma, latencia hasta el primer sonido. |
| `…/dist/index.js` ruta `/speech` | Caché por huella SHA-256 de (texto, voz, velocidad, versión de léxico, política de voz) y fichero en Directus | Funciona | **R** | Es casi la huella exigida; falta añadir idioma y modelo. Mide `generation_ms`, no latencia a primer sonido. |
| `…/providers/openrouter.js` | LLM por OpenRouter (lista de modelos por variable), imagen por modelo con imagen | Funciona | R | Falta tope de gasto, enrutado de privacidad, esquema JSON validado, reintento con modelo alternativo. |
| `…/providers/index.js` | Registro de proveedores intercambiables por variable de entorno | Funciona | R | Buen patrón (puertos y adaptadores). |
| `…/providers/{datamuse,tatoeba,pollinations}.js` | Pronunciación ARPAbet, candidatas, frases reales, imágenes gratis | Funciona | C | Todo específico de inglés/español; Datamuse y Tatoeba no sirven para otras materias. |
| `shared/phonetics.mjs`, `classify.mjs`, `mnemonicQuality.mjs` | Puntuación fonética del puente (real vs puente, sílaba tónica), clasificación de palabras, concisión | Funciona | C | Específico de inglés→español. Va a `techniques/puente-fonetico`, reescrito. V2 reconoce que la similitud por escritura no basta. |
| `frontend/src/lib/srs.ts` + `shared/retention.mjs` | Repaso espaciado V1 y medición de retención por ventanas (1 h, 24 h, 7 d, 30 d) | Funciona, con pruebas | **R** | Núcleo útil, pero sin peso por formato y con 3 resultados. Se reescribe en `packages/core` con la tabla de evidencia. |
| `memora-v2/src/domain/memory.ts` (+`learningProfile.ts`) | Memoria por palabra/pieza/frase con capacidades (reconocer, oír, recuperar, producir), revisión de asociaciones, señales de fatiga | Funciona, con pruebas (`memory.test.ts`, 1 prueba larga) | **R (concepto)** | Más cercano a `Skill` + `UserKnowledge`. Hoy vive en `localStorage`. Se reescribe sin nada de inglés. |
| `memora-v2/src/services/progressSync.ts` + `backend/.../core/progress.js` | Diario de eventos con id, secuencia y dispositivo; servidor idempotente por clave hash (usuario+curso+evento) | Funciona; comprobado en 315 eventos locales | **R** | Patrón correcto para la regla 10. Hay que quitar `course: 'es-en'` fijo y los tipos de evento de inglés. |
| `frontend/src/features/arcade/*` | Arcade V1 «sí/no» balístico | Funciona, 4 pruebas | **R** | Ver sección 7. |
| `frontend/src/pages/Challenges.tsx` | Desafíos: ordena la frase, rescata la historia, escucha oculta, imagen→palabra, ranking | Funciona; sin pruebas | C (reglas) / D (código) | Código muy denso (líneas de >700 caracteres). |
| `frontend/src/features/alchemy/*` | Fusión de phrasal verbs arrastrando dos fichas | Funciona; sin pruebas | C | Específico de phrasal verbs/compuestos. |
| `memora-v2/src/components/DailyArcade.tsx`, `MicroArcade.tsx` | Ráfaga adaptativa y Arcade sin reloj | Funciona; 3+ pruebas | C / R (reglas) | Ver sección 7. |
| `frontend/src/pages/Session.tsx` y `Today.tsx`, `Review.tsx` | Sesión de palabras V1: filtro «¿la conoces?» → habitaciones de 10 → repaso → examen | Funciona; sin pruebas | **D** | Modelo «100 palabras al día»; reemplazado por V2 y contrario a la regla 11 (un examen inmediato no es dominio). Se consulta el flujo. |
| `memora-v2/src/LanguageGame.tsx`, `domain/game.ts` | Sesión V2: asociar → recordar → recompensa → gramática → construir → conversación | Funciona; 8 pruebas del reductor | **R (máquina de estados)** | Reductor limpio y probado. La sesión debe ser reanudable en servidor. |
| `frontend/src/pages/practice/Chat.tsx`, `memora-v2/src/components/ConversationChat.tsx`, endpoint `/chat` | Conversaciones: V1 con IA en directo; V2 con diálogos revisados por coincidencia normalizada | V1 funciona; V2 funciona con guion | R (V2) / D (V1) | La regla 12 prohíbe IA en la lección. V2 ya usa respuestas revisadas. |
| `frontend/src/pages/practice/Story.tsx`, `pages/Library.tsx`, `data/dayJourney.ts` | Historias: V1 en directo con IA; 31 escenas fijas; 3 lecturas adaptadas | Funciona | C | Contenido escrito en el código (regla 3). |
| `content/phrasal_verbs.json`, `frontend/src/pages/PhrasalVerbs.tsx` | 80 phrasal verbs con ejemplo | Funciona | C (datos) | Contenido específico de inglés. |
| `content/irregular_verbs.json`, `pages/Verbs.tsx`, `verb_progress` | 101 verbos en 13 familias fonéticas; cajas de Leitner | Funciona | C | Específico de inglés; la idea de «familia» podría generalizarse a patrón. |
| Imágenes: `…/providers/pollinations.js`, `openrouter.js` imagen, `scripts/enrich-discovery-directus.mjs` (fal.ai) | Generación de imágenes | Funciona; sin cola con tope diario, sin registro de procedencia salvo en V2 | R | La regla pide cola con tope diario y guardado. V2 ya tiene `imageProvenance`. |
| PWA: `frontend/vite.config.ts` (vite-plugin-pwa) | Manifiesto + Workbox con caché de `/api/assets` | Funciona en V1; **ausente en V2** | R | Manifiesto con nombre fijo «Inglés en 30 días» y `lang: en`; sin modo sin conexión de contenido. |
| Pruebas: V1 5 archivos/37 pruebas; V2 24 archivos/132 pruebas; backend 0 | Unitarias del dominio | Pasan (comprobado sobre copia) | C | No hay prueba de recorrido completo (regla 7). La documentación de V2 dice «87 pruebas»; hoy son 132. |
| `backend/curriculum/*.json|md`, `backend/prompts/*.md`, `memora-v2/content/*.md|json` | Mundo 1 (casa), plan de maestría, protocolo de contenido, prompts del «árbitro» de IA | Documentos de trabajo | **C (muy valioso)** | El protocolo de contenido ya contiene la mayoría de reglas del nuevo `CLAUDE.md` (puente real, `bridgeEvidence`, rutas alternativas, revisión). |
| `backend/scripts/*.mjs` (~45 scripts) | Generación, auditoría, publicación de unidades V2 | Funcionan como guion manual | C / D | Muchos acoplados al Mundo 1 de inglés. Los validadores (`audit-*`, `association-policy`) se reescriben en `packages/content`. |
| `docker-compose.yml`, `*/Dockerfile`, `frontend/nginx.conf` | Despliegue Coolify | Ver sección 6 | C | Se reutiliza la topología. |

---

## 3. Qué es específico de inglés y qué se puede generalizar

**Específico de inglés / de español→inglés (queda fuera del núcleo):**

- Columnas de `words`: `en`, `es`, `ipa`, `pron_es`, `arpabet`, `example_en`, `example_es`, `definition_en`, `cefr_level`, `verb_family`, `irregular_forms`, `bridge_word`, `ipa_phonetic`, `bridge_phonetic_match`, `target_sentence_en/es`, `scene_es`.
- Todo `shared/phonetics.mjs` y `classify.mjs` (cognado/fácil/palabra clave/bloque/phrasal/irregular, ARPAbet).
- `irregular_verbs`, `verb_progress`, phrasal verbs, `grammar_challenges` (módulos RA1–RA5 de un ciclo formativo).
- Proveedores Datamuse y Tatoeba; voz `af_heart`; `lang: en-US` en el síntesis del navegador.
- Nombres de tipos: `chunk`, `phrasal`, `irregular`; `course: 'es-en'` fijo en el servidor; la navegación del texto de interfaz en español sin traducciones.
- En V2: `GrammarForm` (`spanishStem`, `englishRoot`, `-ando`/`-ing`), «Español Espejo», «puente» (`bridge`) obligatorio en `AtomicWord`.

**Generalizable (candidato a `packages/core`):**

| Concepto actual | Generaliza a | Observación |
| --- | --- | --- |
| `progress` (paso, próximo repaso, fallos, `avg_ms`) | `UserKnowledge` por `Skill` | Hoy es por palabra; V2 ya separa capacidades. |
| `attempts` (tipo, modo, resultado, ms, horas desde el aprendizaje, pistas) | `Attempt` con evidencia | Falta el formato de ejercicio como campo de primera clase (para el peso). |
| `learning_events` (id, usuario, curso, evento JSON, clave idempotente) | Diario de eventos | Ya tiene `course`. |
| `learning_units` (id, estado, contenido JSON, veredictos de auditoría) | `KnowledgeUnit` + `ContentVersion` | La unidad de Java prueba la idea, pero metida en `AtomicWord`. |
| `mnemonics` (origen, dueño, `phon_score`, imagen) | `Association` | `phon_score` es de la técnica de puente, no del núcleo. |
| `speech_cache_v2` | `Media` con huella | Añadir idioma. |
| Mundo → zona → lugar → misión (`worlds.json`, `location`) | `Course` → `Module` → palacio | El «lugar» es la técnica palacio de memoria. |
| Estado `draft/needs_review/approved/rejected` en asociaciones V2 | Flujo de `Association` | Falta `published` y `deprecated` y quién revisó. |
| Retención por ventanas (`retentionBy`) | Métrica de calidad por técnica | Muy útil para decidir si una técnica funciona. |
| Fatiga (`shouldReduceDifficulty`) | Motor de experiencias | Sí. |

---

## 4. ¿Sirve el panel de Directus como Studio v0?

Versión fijada: Directus 11.17.4. Datos de la instantánea local: 18 colecciones, 223 campos, 51 permisos, 0 flujos, 0 versiones de contenido, 19.708 revisiones.

| Requisito de `DOMINIO.md` | Estado actual | Qué falta |
| --- | --- | --- |
| Roles administrador, autor, revisor | Solo `Administrator` y `Learner` (3 usuarios, 1 learner). | Crear `Author` y `Reviewer` con permisos por colección y estado; regla «revisor ≠ autor». |
| Formularios de cursos/módulos/unidades/prerrequisitos | Solo hay `words` y `learning_units`; no existen `Course`, `Module`, `Skill`, `Prerequisite`. | Modelo nuevo completo. Directus lo permite bien (relaciones M2O/M2M). |
| Editor de `payload` con validación por tipo | `learning_units.content` es JSON libre. La validación está en scripts y en el cliente V2 (`unit.ts`), no en Directus. | Hook/extensión que valide con el esquema de `packages/content` al guardar y devuelva errores legibles. |
| Flujo de estados con registro | `learning_units.status` es texto (`draft`/`published`) sin transiciones; 0 flujos. Hay revisiones nativas de Directus (activadas). | Transiciones controladas por rol (Flows o hook), campos `reviewedBy`, `lastVerified`, expiración automática. |
| Medios y cola de audio/imagen con tope diario | Generación por scripts manuales o en directo; sin cola ni tope. | Colección de cola + worker + contadores. |
| Vista previa como alumno | V2 tiene `?preview=1` y «Revisión · Fase 1» dentro de la app; Directus no. | Enlace de vista previa desde el item (extensión de interfaz o botón con URL). |
| Publicar, despublicar, versionar, volver atrás | Revisiones nativas existen; **Content Versioning** de Directus no se usa (0 filas). | Activar versiones por colección y definir el procedimiento. |
| Importar/exportar JSON y CSV con plantillas | Solo scripts (`prepare-directus.mjs`, `seed-*.mjs`). Directus tiene importación CSV/JSON básica por colección, sin plantillas por tipo. | Plantillas y validación previa. |
| IA solo borrador, con fuente | Las unidades V2 llevan «revisión editorial» hecha por IA (`reviewedBy: "codex-editorial"`). | Prohibir que un modelo cuente como revisor; campo de fuente obligatorio. |

**Conclusión:** sí puede ser Studio v0, y es razonable no construir un panel propio al principio, pero **solo después de** crear el modelo nuevo, los roles, una extensión de validación por tipo y los flujos de estado. Sin esas cuatro piezas es un editor de tablas sin garantías. Esto es una valoración, no una prueba; no se ha ensayado ningún flujo de autor/revisor.

---

## 5. Datos y contenido

Recuentos de la instantánea local (SQLite, 13-oct-2026). Producción: **no verificado**.

### 5.1 En Directus

| Conjunto | Recuento | Calidad estimada | Fuente / licencia |
| --- | --- | --- | --- |
| `words` | 2.711 (keyword 1.806, cognado 356, chunk 314, phrasal 136, irregular 78, fácil 21) | Muy desigual. 355 «publicadas»; 2.356 en «backlog». `cefr_level` y `definition_en` vacíos en todas; `audio_url` y `sentence_builder` vacíos; IPA en 345; pronunciación figurada en 2.251; ejemplo en 437. | Origen del listado de frecuencia **no documentado** (`wordlist.txt`). Sin licencia registrada. |
| `mnemonics` (asociaciones) | 356 sobre 355 palabras: 345 `seed` (manuales, días 1–3), 11 `ai`. `phon_score` medio 0,81; 316 ≥ 0,65 | Calidad variable. Ejemplos revisados de bajo parecido: *build→BILLETES* (0,57), *move→MUEBLE* (0,60). La puntuación la calcula el propio algoritmo, no una persona. | Escritas por el autor (días 1–3) o por modelos vía OpenRouter. Licencia no registrada. |
| `learning_units` | 11 (10 `draft`, 1 `published`: «La Java y las máscaras») | Las unidades del Mundo 1 son borradores con protocolo estricto; la de Java es un caso real de otra materia. | Propia/IA; sin licencia registrada. |
| `irregular_verbs` | 101 (13 familias) | Datos correctos de contenido común (formas verbales); mnemotecnia propia. | Propia. |
| `learning_events` | 315 eventos, 1 usuario | Datos de pruebas del autor. | Datos personales. |
| `attempts` / `progress` / `study_days` / `profiles` | 43 / 34 / 1 / 4 | Uso de pruebas. | Datos personales. |
| `sentences`, `challenge_scores`, `speech_cache(_v2)`, `personal_vocabulary`, `mnemonic_feedback`, `grammar_challenges`, `pilot_reports`, `verb_progress` | 1 / 0 / 0 / 0 / 0 / 0 / 0 / 0 | Vacías (la caché de voz local está vacía: Kokoro no está activo en local). | — |
| `directus_files` | 1 archivo | — | — |

### 5.2 En archivos

| Archivo | Contenido | Observaciones |
| --- | --- | --- |
| `content/day01–03.json` | 341 palabras (128+107+106) con puente, escena, ejemplo | Escritas a mano. Calidad más alta del repositorio. |
| `content/wordlist.txt` | Días 4–30, 27 temas; ~3.050 líneas de datos | Sin fuente ni licencia. Sin asociaciones. |
| `content/phrasal_verbs.json` | 80 unidades con ejemplo | Autoría/IA no registrada. |
| `content/irregular_verbs.json` | 101 verbos | Ver arriba. |
| `content/pilot.json` | 20 palabras de prueba | — |
| `backend/curriculum/*.json` y `mission-specs/` (27 especificaciones de misión del Mundo 1) | Plan de la casa, mundos, reglas de palacio, contratos visuales de gramática | Documentos de diseño, no contenido final. |
| `memora-v2/content/*.json` | Unidades piloto (llaves, espejo, juego/playa, cocina, dormitorio) y extras del Mundo 1 | Borradores; se declara que el puente aún necesita revisión humana por oído. |
| `backend/private/` | `ilerna/` (corpus de 64 KB), `generated/`, `checkpoints/` (63 MB), `quarantine/` (asociaciones rechazadas) | Ignorado por git. |
| Imágenes | `frontend/public/images` (portada 2,4 MB; ilustración de *borrow*), `memora-v2/public` (SVG y un JPG ambiental), `backend/uploads` (1 JPG + 1 AVIF) | **Procedencia y licencia no registradas** salvo el campo `imageProvenance` previsto en el tipo de V2. |

### 5.3 Licencias y fuentes (lo que se puede afirmar)

- **ILERNA (riesgo alto, regla 14):** `memora-v2/content/ilerna-editorial-plan.md` declara haber revisado en modo lectura PDF de material didáctico, anexo de vocabulario y exámenes de ILERNA; `backend/private/ilerna/laboratory-corpus.md` y `context*.md` derivan de ese material. `grammar_challenges` cita módulos RA1–RA5. Es material con derechos de terceros; no debe pasar al repositorio nuevo ni al contenido. Estado de su licencia: **no verificado, se asume reservado**.
- **Tatoeba:** el código declara CC BY 2.0 FR; exige atribución y se guarda `source: tatoeba#id`. No verificado que la interfaz la muestre.
- **Datamuse / CMU (pronunciación):** gratuito sin clave; condiciones de uso **no verificadas**.
- **Pollinations (imágenes gratis):** términos de uso de las imágenes generadas **no verificados**.
- **fal.ai (`flux/schnell`) y modelos de OpenRouter (texto e imagen):** las condiciones dependen del modelo; **no verificado** ni registrado por unidad.
- **Lecturas de `Library.tsx`:** adaptaciones breves de *Alice*, *The Secret Garden* y *Sherlock Holmes* (obras originales en dominio público); quién escribió la adaptación no está registrado.
- **Canciones/películas (`MediaLab.tsx`):** enlaces de YouTube **introducidos por el alumno y guardados en `localStorage`**; no hay biblioteca curada como dice el README (comprobado en el código).
- **Kokoro:** el modelo y la imagen de FastAPI son de terceros; licencia **no verificada** aquí.

---

## 6. Despliegue

Fuente: `docker-compose.yml`, `Dockerfile`s, `nginx.conf`, `.env.example`. Coolify en sí **no verificado**.

### 6.1 Servicios

| Servicio | Imagen / build | Notas |
| --- | --- | --- |
| `web` | `memora-v2/Dockerfile` (Node 22 → nginx 1.27) | Único con dominio. Proxy `/api/` → `directus:8055` (por eso el administrador queda público en `/api/admin`). |
| `directus` | `backend/Dockerfile` sobre `directus/directus:11.17.4` + extensión `memora-ai` + scripts + `content/` | Arranque: `directus bootstrap`, luego `boot.mjs`, que ya solo comprueba salud (no migra). |
| `tts` | `ghcr.io/remsky/kokoro-fastapi-cpu:latest` | **Etiqueta `latest` sin fijar.** Healthcheck sobre `/v1/audio/voices`. Puerto 8880 solo interno. |
| `db` | `postgres:16-alpine` | Healthcheck `pg_isready`. |

### 6.2 Redes, volúmenes, copias

- **Redes:** no se declara ninguna; red por defecto de Compose. Solo `web` publica puerto (vía Coolify).
- **Volúmenes:** `pgdata` (Postgres) y `uploads` (`/directus/uploads`, incluye el audio en caché). El modelo de Kokoro viene dentro de la imagen.
- **Copias de seguridad:** el repositorio **no define ninguna** para Postgres ni para `uploads`. Lo que existe: 7 copias manuales de SQLite en `backend/data/` (de antes de cada cambio de esquema/contenido, hasta 21 MB), que no sirven para producción (Postgres). Copias programadas en Coolify: **no verificado**.
- **Persistencia de progreso:** en servidor (Directus). En V2 además hay un diario local pendiente de envío.

### 6.3 Variables de entorno (solo nombres)

`.env.example`: `APP_URL`, `PUBLIC_URL`, `DIRECTUS_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DB_PASSWORD`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_MODELS`, `OPENROUTER_IMAGE_MODEL`, `LLM_PROVIDER`, `PRONUNCIATION_PROVIDER`, `CANDIDATES_PROVIDER`, `IMAGE_PROVIDER`, `SENTENCES_PROVIDER`, `TTS_PROVIDER`, `KOKORO_TTS_URL`, `KOKORO_TTS_API_KEY`, `KOKORO_TTS_MODEL`, `KOKORO_TTS_VOICE`, `AI_ALLOWED_EMAILS`, `PUBLIC_REGISTRATION`, `EMAIL_FROM`, `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASSWORD`, `EMAIL_SMTP_SECURE`.

Solo en `docker-compose.yml`: `SECRET`, `DB_CLIENT`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `WEBSOCKETS_ENABLED`, `TELEMETRY`, `FAL_KEY`, `FAL_MODEL`, `PREPARE_ALL_ASSOCIATIONS`, `DISCOVERY_ENRICH_ON_BOOT`, `DISCOVERY_TEXT_MODE`, `DISCOVERY_IMAGE_MODE`, `DISCOVERY_ENRICH_LIMIT`, `DISCOVERY_ENRICH_BATCH`, `KOKORO_LEXICON_VERSION`, `PASSWORD_RESET_URL_ALLOW_LIST`, `EMAIL_TRANSPORT`, `POSTGRES_DB/USER/PASSWORD`.

`backend/.env` local (solo nombres): `HOST`, `PORT`, `PUBLIC_URL`, `DB_CLIENT`, `DB_FILENAME`, `SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STORAGE_LOCATIONS`, `STORAGE_LOCAL_ROOT`, `EXTENSIONS_PATH`, `EXTENSIONS_AUTO_RELOAD`, `CORS_ENABLED`, `CORS_ORIGIN`, `WEBSOCKETS_ENABLED`, `TELEMETRY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_IMAGE_MODEL`, `PASSWORD_RESET_URL_ALLOW_LIST`, `FAL_KEY`.

Observaciones: `FAL_KEY` no está en `.env.example` (omisión de documentación); `PUBLIC_REGISTRATION` por defecto es `true`; `AI_ALLOWED_EMAILS` por defecto vacío (= cualquier usuario registrado puede gastar IA).

### 6.4 Idiomas del servicio de voz

- **Desplegado: no verificado.** No se consultó el servicio real (`/v1/audio/voices`). Voz por defecto configurada: `af_heart` (inglés americano). El código trata voces `ef_`/`em_` (español) con una política propia, lo que sugiere que se probó español, pero no hay constancia de ello.
- **Documentación externa** (búsqueda web, no verificada contra la imagen desplegada): Kokoro-82M v1.0 declara 8 idiomas y 54 voces: inglés americano y británico, español, francés, hindi, italiano, portugués brasileño, japonés y chino mandarín (prefijos `a`, `b`, `e`, `f`, `h`, `i`, `p`, `j`, `z`). Hay discrepancias entre fuentes en el número de voces (50 frente a 54). Fuentes: [Hugging Face – kokoro.cpp GGUF](https://huggingface.co/simonfxr/kokoro.cpp-GGUF), [Featherless](https://featherless.ai/docs/audio-speech-model-kokoro), [DeepInfra](https://deepinfra.com/hexgrad/Kokoro-82M), [Soniqo](https://soniqo.audio/guides/kokoro).
- Antes de prometer un curso: consultar `/v1/audio/voices` del servicio real y escuchar muestras. Cobertura ≠ calidad (el francés tiene una sola voz según las fuentes).
- No existe un «léxico de pronunciación» real: solo dos reemplazos en el texto (`API`→`A P I`, `AI`→`A I`) y un número de versión (`KOKORO_LEXICON_VERSION`) usado en la huella.

---

## 7. Mecánicas de Arcade que merece la pena rescatar

### 7.1 Arcade V1 «Ráfaga sí/no» (`frontend/src/features/arcade/useArcadeEngine.ts`)

- **Tanda:** 15 cartas; la misma palabra puede aparecer como máximo 2 veces; se exigen ≥ 8 palabras únicas (si no, la tanda queda vacía y no se inventa vocabulario). No hay dos apariciones consecutivas de la misma carta si existe otra.
- **Entrada:** se oye el audio, aparece la palabra objetivo (o una alternativa) y el alumno responde **SÍ/NO** («¿coincide el significado?»). `expectedYes` es verdadero siempre que no haya alternativa; con alternativa, 50 %.
- **Tiempo de reacción:** 4.000 ms en las 2 primeras; 3.500 ms normal; 3.000 ms si el combo ≥ 2. Si vence el tiempo, cuenta como fallo.
- **Resultado:** acierto < 1.500 ms = `ok` («balístico»); acierto más lento = `doubt`; error o tiempo agotado = `fail`.
- **Puntuación:** `ok` → +100 puntos, +15 XP; `doubt` → +50, +10 XP; `fail` → 0 puntos, −10 XP (nunca por debajo de 0). **Combo:** +1 con `ok`, se mantiene con `doubt`, vuelve a 1 con `fail`.
- **Fallo:** congela el reloj, muestra la respuesta 2.200 ms y retoma. Tras un acierto hay una pausa de 600 ms.
- **Salidas:** cada respuesta aplica `afterReview` al progreso y registra un intento (`mode: arcade`, `kind: review`). Récord, XP diario y racha en `localStorage` (contradice la regla 10).
- **Compuerta:** solo entran palabras desbloqueadas (estado aprendido/en repaso o con escalón > 0); «ya la conocía» no desbloquea. Respaldo: 13 palabras curadas.
- **Qué rescatar:** reacción binaria breve, ventana adaptativa, la compuerta de «solo lo enseñado», el fallo como recuperación. **Qué cambiar:** el resultado debe llevar su formato (reconocer = peso bajo) y no marcar nunca «dominada».

### 7.2 Desafíos V1 (`pages/Challenges.tsx`, `features/alchemy`)

- **Ordena la frase:** 5 frases de la «escalera»; fichas barajadas + 1–2 distractores; acierto solo si la unión coincide exactamente; puntuación = frases correctas; guarda récord y envía a `challenge_scores`.
- **Rescata la historia:** hasta 8 palabras aprendidas; se muestra la escena absurda y 4 opciones (1 correcta + 3 de las aprendidas); +1 por acierto.
- **Escucha oculta e imagen→palabra:** 8 palabras con ejemplo; el alumno escribe lo que oye/ve; puntuación por similitud (`sentenceScore`).
- **Alquimia:** arrastrar dos fichas hasta que colisionan (rectángulos reales) para formar un phrasal/compuesto, con 2 distractores; +20 XP y se registra como acierto (`afterReview('ok')`) **aunque sea reconocimiento**, lo que viola la regla 11.
- **Ranking:** `challenge_scores` (nombre visible, juego, puntuación, total); legible por cualquier usuario.

### 7.3 Arcade V2 (`DailyArcade.tsx`, `MicroArcade.tsx`, `domain/microArcade.ts`)

- **Ráfaga diaria:** hasta 6 rondas de vocabulario + frases listas para repasar; tipos `picture`, `recognition`, `audio`, `bridge`, `chunk`, `complete`, `write`, `sentence`, `learning-language`, `conversation`. Tiempo 8.000 ms (apoyado) o 5.000 ms (independiente), sin reloj en `write`, `sentence`, `conversation`, `complete`, y modo «amable» sin reloj. Prioriza lo vencido, lo débil y el mantenimiento; la recognición «calienta» y la producción va después. Califica `quick/hesitant/missed`.
- **Arcade de asociaciones (Micro):** sin reloj, sin vidas ni rachas; muestra la imagen de la escena, pide la palabra entre 3 opciones, con pista opcional (la pista queda registrada). Se ofrece según contexto (tras aprender algo nuevo o con repaso vencido).
- **Regla de V2 que coincide con el nuevo `CLAUDE.md`:** Arcade solo usa lo enseñado y registrado; pistas y errores conservan evidencia; un acierto ayudado no cuenta como dominio autónomo.

---

## 8. Riesgos y deuda técnica

1. **Estado de git:** `memora-v2/` y `backend/curriculum/` sin seguir, 72 cambios sin confirmar, 32 commits, ninguna etiqueta. El despliegue y la reproducibilidad son inciertos.
2. **PWA perdida en V2:** si V2 es lo desplegado, la app deja de ser instalable.
3. **Dos fuentes de verdad de progreso:** V2 guarda memorias en `localStorage` y las reconstruye con eventos; riesgo de pérdida por cuota, pestañas concurrentes y dispositivos (la propia documentación de V2 lo admite). Contradice la regla 10 si no se invierte (servidor primero).
4. **Sin ponderación de evidencia:** `afterReview` trata igual cualquier formato; Alquimia y Arcade cuentan como repaso.
5. **IA en la lección y sin controles:** `/fill`, `/keyword`, `/chat`, `/story`, `/correct`, `/translate`, `/define` llaman a OpenRouter en directo; sin tope de gasto ni por usuario/día; sin enrutado de privacidad (no se encontró `data_collection`/`zdr`); `PUBLIC_REGISTRATION=true` y lista blanca vacía por defecto → cualquier registro puede gastar saldo. Salida con `json_object` y `extractJson` indulgente, sin esquema validado ni modelo alternativo.
6. **«Revisión humana» que no lo es:** `editorialReview.reviewedBy = "codex-editorial"`. Un modelo no puede ser revisor (reglas 12–13).
7. **Permisos de Learner (instantánea local):** `create`/`update` sin validación de `user` en `progress`, `attempts`, `sentences`, `study_days`, `profiles`, etc.; `words` legible entero (incluido el backlog); `challenge_scores` legible por todos. Producción: no verificado.
8. **Seguridad de sesión:** tokens en `localStorage`; `access_token` en la URL de los activos; administrador accesible en `/api/admin` por el mismo dominio; `latest` en la imagen de Kokoro.
9. **Esquema creado a mano** (`setup-schema.mjs`), sin instantáneas ni migraciones (regla 8); 19.708 revisiones acumuladas.
10. **Contenido en el código:** `dayJourney.ts`, `structures.ts`, `palaces.ts`, `conversationPath.ts`, lecturas de `Library.tsx` y retos de respaldo de gramática (regla 3).
11. **Texto fijo en un idioma:** interfaz en español en el código; `lang: en` en el manifiesto (regla 15).
12. **Código ilegible:** `Challenges.tsx` con líneas de cientos de caracteres, `styles.css` de 210 KB, `ExposureCard.tsx` de 32 KB, `useDiscoveryQueue.ts` de 41 KB, dos versiones de «Stage0Foundry».
13. **Pruebas:** backend sin pruebas; ninguna prueba de recorrido completo; las verificaciones de V2 son manuales y quedan en documentos de texto.
14. **Dependencia de servicios gratis:** Pollinations, Datamuse, Tatoeba (sin acuerdo de servicio).
15. **Voz:** sin latencia al primer sonido, sin léxico real, caché dependiente de Directus (si el esquema se daña, el código cae a «sin caché»).
16. **Derechos de autor (ILERNA):** ver sección 5.3.
17. **Fuga de procedencia:** imágenes y audio sin licencia registrada.
18. **Datos de alumnos reales:** si los hay en producción, hay RGPD pendiente (exportar/borrar por cuenta; V2 lo lista como pendiente). No verificado.

---

## 9. Preguntas para el usuario antes del Hito 1

1. **`docs/VISION.md` y `docs/HITOS.md` están vacíos.** ¿Los escribes tú, o quieres que redacte un borrador a partir de `CLAUDE.md`/`DOMINIO.md` para que lo corrijas? ¿Cuál es el alcance exacto del Hito 1?
2. **Stack:** `CLAUDE.md` dice «confirmar en el Hito 0». ¿Confirmas React + TypeScript + Vite (PWA), Directus, Kokoro en Docker, OpenRouter y Coolify? ¿Gestor de paquetes y monorepo (pnpm/npm workspaces)? ¿Directus propio nuevo o el existente?
3. **Producción actual:** ¿hay alumnos reales con datos? ¿Qué se despliega ahora (V1, V2 o nada) y desde qué commit? ¿Debe seguir funcionando mientras se construye Memora V3?
4. **Datos antiguos:** ¿se migra algo (cuentas, progreso, las 355 palabras con asociación) o se empieza limpio? Recuerda que no se puede importar código ni tocar su base de datos; una migración sería por exportación de solo lectura.
5. **Acceso de solo lectura a producción:** ¿me das (por otro canal, nunca en el chat) permiso para consultar `/v1/audio/voices` y las cifras de Postgres? Hasta entonces, lo de la sección 6.4 queda sin verificar.
6. **ILERNA:** ¿puedes confirmar la licencia del material? Si no hay permiso, ¿descartamos todo lo derivado (`laboratory-corpus.md`, módulos RA1–RA5, vocabulario ASIR/DAM/DAW)?
7. **Licencia propia:** ¿qué licencia aplicas a tu contenido (días 1–3, phrasal verbs, irregulares, asociaciones)? ¿Puedo marcarlo como «propio» en el campo de licencia?
8. **Primer curso:** ¿el inglés para hispanohablantes sigue siendo el primero? ¿Y la prueba de generalidad: Java (ya existe una unidad) o ciberseguridad? ¿Hay un segundo curso pensado para el Hito 1 o 2?
9. **Revisores:** ¿quién será el revisor humano de asociaciones y contenido sensible? ¿Eres tú el único autor y revisor al principio (la regla «revisor distinto del autor» no se podría cumplir)?
10. **Gasto de IA:** ¿qué tope diario global y por usuario quieres en OpenRouter? ¿Qué modelos permites por tarea? ¿Aceptas excluir proveedores que guardan o entrenan con los prompts aunque suba el coste?
11. **Idioma de interfaz:** ¿español inicialmente, con soporte para otros? ¿Qué pares de idiomas de contenido entran en el primer año (el espejo español→inglés es el único hoy)?
12. **PWA:** ¿qué nivel de modo sin conexión necesitas (solo interfaz, o también sesión del día y audio en caché)?
13. **Imágenes:** ¿Pollinations/fal siguen, o prefieres OpenRouter/otro proveedor? ¿Tope diario deseado?
14. **Registro y cuentas:** ¿registro abierto, por invitación o cerrado? ¿Correo SMTP disponible para recuperar contraseña?
15. **Copias de seguridad:** ¿qué mecanismo tienes en Coolify (programadas, destino, retención)? Es requisito de la regla 8 antes del primer cambio de esquema.
16. **Repositorio:** ¿nombre y remoto del nuevo repositorio (git aún no inicializado en `Memora/`)? ¿Convención de commits y etiquetas por hito?
17. **Procedencia del listado de frecuencia** (`wordlist.txt`): ¿de dónde salió? Si no se puede licenciar, no se reutiliza.
18. **Competición/ranking:** ¿se mantiene (con nombres visibles) o se retira por privacidad?
