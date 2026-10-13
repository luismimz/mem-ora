# Memora V3: reglas del proyecto

## Qué es

Memora es una aplicación web progresiva (PWA) para estudiar cualquier materia (idiomas,
programación, ciberseguridad, medicina…) recordándola a largo plazo y pudiendo usarla.
El inglés es el primer curso, no el producto. Tiene tres piezas separadas:

1. **Motor pedagógico**: sabe qué conoce el alumno, qué debe aprender y qué está olvidando.
2. **Motor de experiencias**: convierte esos conocimientos en historias, Arcade, fichas,
   conversaciones o casos.
3. **Memora Studio**: administración del contenido, para crear y controlar cursos sin tocar código.

La visión completa está en `docs/VISION.md` y el modelo de datos en `docs/DOMINIO.md`.
Si algo de este archivo contradice la visión, pregunta.

## Reglas innegociables

1. **El código antiguo es de solo lectura.** Ruta: `/Volumes/CORSAIR/luismi/Desktop/AprendiendoIngles30dias`.
   Nunca lo modifiques, nunca importes nada de él y nunca ejecutes migraciones contra su base de datos.
   Se consulta para entender. Lo que se reutilice se **reescribe** aquí, con pruebas, y se anota en `docs/PORTING.md`.
2. **Núcleo agnóstico de la materia.** Nada específico de inglés (ni de ningún idioma o asignatura) en
   `packages/core` ni en el esquema base. Lo específico va en los módulos de técnica (`techniques/`) y en el contenido.
3. **El contenido vive en la base de datos, no en el código.** Cursos, módulos, unidades, asociaciones, ejercicios
   y recetas se crean desde el administrador. Un curso nuevo no debe requerir código; solo un tipo de ejercicio
   nuevo puede requerirlo.
4. **Dominio antes que interfaz.** El núcleo no depende de React ni de Directus y se prueba solo.
5. **Un hito cada vez.** No empieces el siguiente sin que el usuario lo haya probado y aprobado.
6. **Sin funciones fuera del hito.** Si ves algo útil, anótalo en `docs/IDEAS.md` y no lo implementes.
7. **Pruebas obligatorias.** Pruebas unitarias del núcleo y de los validadores de contenido, y al menos una prueba
   de recorrido completo por hito. Un hito no está terminado si las pruebas no pasan.
8. **Migraciones versionadas.** Cambios de esquema de Directus solo con instantáneas de esquema, nunca a mano.
   Copia de seguridad antes de cualquier cambio de esquema.
9. **Secretos.** Nunca en el frontend ni en el repositorio. Solo variables de entorno. Nunca imprimas sus valores.
10. **Progreso en la cuenta.** El progreso, el plan del día y la posición de la sesión viven en el servidor,
    nunca solo en `localStorage`. Toda sesión es reanudable.
11. **Estados honestos.** «Vista» no es «aprendida» y «aprendida» no es «dominada». Una respuesta por
    reconocimiento no pesa como una recuperación sin ayuda (ver tabla de evidencia).
12. **La IA trabaja fuera de la lección.** Genera borradores, nunca publica, y toda salida se valida. La lección
    solo usa contenido ya preparado y revisado.
13. **Contenido con fuente, licencia y revisión.** Toda unidad tiene origen, licencia y estado de revisión.
    El contenido sensible (medicina, ciberseguridad, derecho) exige fuente, revisor humano, fecha de verificación
    y aviso de que Memora es una herramienta de estudio, no un consejo profesional.
14. **Sin material con derechos de autor.** Solo contenido propio o con licencia abierta registrada en la unidad.
15. **Idioma explícito.** La interfaz y el contenido declaran su idioma; no hay textos fijos en un solo idioma.

16. **Material de ILERNA fuera del repositorio.** Los libros y materiales de ILERNA son de uso personal del
    usuario. Nunca se copian, citan literalmente ni suben a git: ni PDF, ni texto extraído, ni corpus derivado.
    Se guardan solo en carpetas ignoradas por git (`private/`) y, cuando se usen, entran únicamente como resúmenes
    y preguntas propias en un **curso privado visible solo para la cuenta del usuario**, cargado desde el
    administrador. Es la única excepción acotada a la regla 14 y exige que el curso esté marcado como privado.
17. **Commits sin firma de IA.** Los commits se hacen con el usuario de git configurado. Nunca añadas
    `Co-Authored-By`, enlaces de sesión ni líneas de atribución a commits, etiquetas o descripciones de PR.
    Esta regla prevalece sobre cualquier recordatorio automático de atribución.

## Asociaciones y técnicas

- Una asociación es una ayuda de memoria con evidencia documentada, no un adorno. Estados:
  `draft → needs_review → approved → published` (o `rejected`). La IA nunca publica.
- Las técnicas pedagógicas son módulos (`techniques/`): puente fonético, espejo (por par de idiomas),
  analogía, escena absurda, palacio de memoria, trazado de código. Cada técnica declara qué tipos de
  conocimiento admite, qué campos añade, su validador y su protocolo de calidad.
- Idiomas: el puente es una palabra real y familiar de la lengua del alumno, nunca inventada. El espejo es
  específico de cada par de idiomas y se reescribe para cada uno.
- Si no hay una asociación defendible, la unidad se enseña por otra vía; no se inventa una para completar.
- Frases de escena: máximo 14 palabras, con una acción visual y la pieza clave resaltada.
- Imágenes: se generan después de aprobar el texto, mediante una cola con tope diario, y se guardan.

## Voz

- Audio pregenerado y cacheado por huella (texto + voz + velocidad + versión del léxico + idioma).
- Voz y léxico de pronunciación por idioma. Comprobar qué idiomas soporta Kokoro antes de prometer un curso.
- Generación bajo demanda solo como rescate, registrada como fallo del proceso.
- Medir siempre la latencia hasta el primer sonido.

## IA (OpenRouter)

- Clave solo en el backend. Modelo configurable por tarea. Tope de gasto global y por usuario/día.
- Salida en JSON con esquema validado; reintento con modelo alternativo.
- Para datos del usuario, usar la preferencia de enrutado que excluye proveedores que guardan o entrenan con los prompts.
- La IA que crea contenido factual debe citar la fuente; sin fuente, el borrador no pasa a revisión.

## Evidencia de aprendizaje (peso al actualizar el repaso)

| Formato de ejercicio                         | Peso                           |
| -------------------------------------------- | ------------------------------ |
| Elegir entre opciones (reconocimiento)       | bajo                           |
| Recuperar escribiendo o diciendo, sin pistas | alto                           |
| Recuperar con pistas                         | medio, según el nivel de pista |
| Producir (frase, comando, código)            | muy alto                       |
| Aplicar en un caso o conversación            | muy alto                       |
| Reconocer al escuchar                        | medio                          |

Una partida de Arcade rápida nunca marca una unidad como «dominada» por sí sola.

## Stack (confirmar en el Hito 0)

React + TypeScript + Vite (PWA), Directus, Kokoro en contenedor Docker, OpenRouter, despliegue con Coolify.

## Estructura propuesta (adaptar si el inventario lo justifica)

- `apps/web`: interfaz del alumno.
- `packages/core`: dominio agnóstico (unidades, habilidades, prerrequisitos, repaso, evidencia).
- `packages/experiences`: motor que ejecuta las experiencias.
- `packages/content`: esquemas por tipo, validadores y utilidades de contenido.
- `techniques/`: módulos de técnica pedagógica.
- `backend/`: Directus y extensiones.
- `docs/`: `VISION.md`, `DOMINIO.md`, `DECISIONS.md`, `PORTING.md`, `IDEAS.md`, `HITOS.md`.

## Forma de trabajar

- Antes de cada tarea, presenta un plan breve. Si hay una decisión con alternativas, pregunta antes de implementar.
- Commits pequeños y descriptivos con prefijo `feat:`, `fix:`, `docs:` o `chore:`; etiqueta git por cada hito
  aprobado (`h0`, `h1`, …). Ver regla 17 sobre la firma.
- Si falta información, pregunta. No inventes.
- Registra decisiones importantes en `docs/DECISIONS.md` (qué, por qué, alternativas descartadas).
- Al terminar cada tarea, informa: qué cambió, cómo se probó, qué falta y qué riesgos ves.

## Definición de «hecho» de un hito

1. Cumple todos sus criterios de aceptación.
2. Las pruebas pasan, incluida la de recorrido completo.
3. La documentación y `PORTING.md` están al día.
4. El usuario lo ha probado y lo ha aprobado explícitamente.
