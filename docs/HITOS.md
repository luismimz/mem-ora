Hitos de Memora V3

Cada hito termina con tu prueba. No se pasa al siguiente sin tu aprobación.

H0. Inventario y congelación

Objetivo: saber qué hay, qué se reutiliza y si Directus sirve como administrador inicial. Entregables: docs/INVENTARIO.md; V1 y V2 congeladas y jugables; repositorio nuevo con CLAUDE.md y docs/. Aceptación:

El inventario cubre todos los puntos del prompt y marca lo no verificado.
Hay copia de seguridad de la base de datos y de los archivos del servidor.
Las preguntas pendientes están respondidas. Tu prueba: leer el inventario y confirmar que refleja la realidad.
H1. Núcleo universal (sin interfaz)

Objetivo: el cerebro de Memora, independiente de la materia, probado de forma aislada. Entregables (packages/core):

Entidades de docs/DOMINIO.md: unidad, habilidad, prerrequisito, estado por habilidad, intento con evidencia, asociación.
Estados: nuevo, presentado (vista), en aprendizaje, en consolidación, aprendida, estable, dominada, debilitado (ver D-018).
Registro de intentos con evidencia ponderada (tabla de CLAUDE.md).
Programador de repasos detrás de una interfaz (Scheduler), con una implementación simple adaptativa y un hueco para evaluar FSRS.
Escalera de pistas: sube tras un fallo y baja con el éxito; tras dos fallos la asociación se marca para revisión.
canPractice(unidad) por prerrequisitos y carga diaria adaptativa.
Script de simulación de 30 días para dos alumnos sintéticos de cursos distintos: uno de un idioma y otro de programación. Aceptación:
Pruebas que cubren: prioridad de los repasos vencidos, subida y bajada de pistas, que un acierto por reconocimiento no consolida, que nada pasa a «consolidado» sin éxito diferido, bloqueo por prerrequisitos, tope diario, idempotencia de intentos y serialización.
La misma simulación funciona con los dos cursos sin cambiar una línea del núcleo. Tu prueba: leer la salida de la simulación y comprobar que tiene sentido.
H2. Probar ya

Objetivo: tener un lugar real donde probar Memora y añadir contenido desde el administrador. Entregables:

Primero: validador del catálogo que rechace prerrequisitos sobre habilidades de reconocimiento puro (nunca consolidan y bloquearían para siempre lo que depende de ellas), con mensaje comprensible para el autor (D-019).
Nivel por unidad derivado de sus habilidades (aprendida, estable, dominada), con variedad de formatos para «dominada». Si ESPECIFICACION.md §4 contradice CLAUDE.md o DOMINIO.md, mandan estos.

Colecciones de Directus para curso, módulo, unidad, asociación, medios y revisión, con instantáneas de esquema.
Administrador v0 con roles, flujo de estados, validación por tipo y vista previa como alumno.
Sesión mínima del alumno sobre el núcleo: escuchar, asociar, recuperar sin ver, escena, estructura, ordenar, frase propia y resultado (como el prototipo de borrow), reanudable y guardada en la cuenta.
Subhitos: H2.0 validador del catálogo y nivel por unidad · H2.1 modelo de datos y administrador · H2.2a sesión con conexión (el servidor recalcula) · H2.2b sincronización y modo sin conexión · H2.3 audio e imágenes · H2.4 despliegue y habitación de 10 palabras. Cada uno con su prueba humana.
Tubería de audio (normalizador, léxico por idioma, caché por huella, audios normal y lento) y cola de imágenes con tope diario.
Uso sin conexión (D-022): estudiar sin conexión la sesión de hoy y la de mañana, con contenido, audio e imágenes descargados de antemano; intentos en cola local y envío idempotente al reconectar; el servidor es la fuente de verdad. Prueba en modo avión y en el iPhone del usuario.
Despliegue en un subdominio propio, con la app actual intacta.
Curso «Inglés» con una habitación de 10 palabras cargada solo desde el administrador. Aceptación:
Crear el curso y la habitación sin escribir código.
10 palabras en ≤25 minutos (medido); el audio empieza en <300 ms desde caché; sin IA en vivo.
Cerrar la app a mitad y retomar en el mismo punto.
Al día siguiente, el repaso usa la escalera de pistas.
Prueba de recorrido completo automatizada. Tu prueba: hacer la habitación y, al día siguiente, el repaso.
H3. Arcade universal

Objetivo: que Arcade sea divertido y recupere conocimientos de cualquier materia. Entregables: dos juegos por formato (por ejemplo, imagen a término y construcción) que funcionan con cualquier tipo de unidad que los admita; selector de contenido por repasos vencidos, debilitados y recientes; puntuación del juego separada del estado de aprendizaje; mecánicas de V1 portadas. Aceptación: cada respuesta actualiza el repaso según el peso de su evidencia; nunca el mismo formato dos veces seguidas para una unidad; sin esperas de audio. Tu prueba: jugar varias partidas: ¿es divertido? ¿Las unidades fallidas vuelven?

H4. Recetas JSON y fichas

Objetivo: que el mismo motor ejecute experiencias distintas sin pantallas exclusivas. Entregables: esquema JSON versionado extraído de H2 y H3; validador con mensajes comprensibles; el tipo «ficha» con su recorrido de 9 pasos; la técnica del espejo español a inglés como módulo; tres recetas (aventura mixta, solo vocabulario y Mega Arcade); las cinco fichas piloto cargadas desde el administrador. Aceptación: las tres recetas funcionan en el mismo motor; un JSON no puede ejecutar código; un prerrequisito sin preparar muestra un error claro. Tu prueba: modificar una receta a mano y ver el cambio sin tocar código.

H5. Segundo curso: demostrar que sirve para cualquier materia

Objetivo: probar que un curso de otra materia se crea sin código. Entregables: un curso de prueba, por ejemplo un módulo de tu DAM o «Java básico», creado solo desde el administrador con tipos concept, command y code_snippet, con sus asociaciones y ejercicios; el tipo de ejercicio nuevo que haga falta, si hace falta. Aceptación:

El núcleo no cambia.
El contenido nuevo pasa por el mismo flujo de revisión y publicación, con fuente y licencia registradas.
El curso funciona en sesión, Arcade y repaso. Tu prueba: estudiar ese curso unos días y comprobar si la experiencia sirve fuera del inglés.
H6. Inicio, plan del día y «Mi evolución»

Objetivo: el recorrido recomendado, sin obligación, para cualquier curso. Entregables: inicio con la tarjeta de aventura y los accesos a los modos; selector de curso; plan diario persistente; «Continuar» que reanuda la posición exacta; progreso honesto; medición del recuerdo a 7 y 30 días con unidades no repasadas. Aceptación: elegir un modo libre no crea progresos paralelos; las cifras coinciden con el estado del núcleo. Tu prueba: usar la app varios días seguidos con dos cursos.

H7. Conversación y casos

Objetivo: práctica comunicativa o aplicada según la materia. Entregables: conversación con personajes para idiomas que comprueba antes los conocimientos necesarios; casos prácticos para otras materias; correcciones comprensibles; guardado de una conversación representativa y estadísticas, sin transcripciones redundantes; tope de gasto de IA. Aceptación: nunca se exige una pieza no preparada; las repeticiones no llenan el historial. Tu prueba: conversar o resolver un caso y comprobar que se entiende todo lo que se pide.

H8. Studio avanzado

Entregables: editor visual de recetas compatible con el JSON; creación asistida por IA con borradores, fuente obligatoria y validaciones lingüísticas y técnicas; versiones y reversión; importación y exportación avanzadas, incluida Anki. Aceptación: lo creado en el editor visual produce el mismo JSON que uno escrito a mano; nada generado por IA se publica sin revisión.

H9. Más idiomas y contenido sensible

Entregables: curso de francés o italiano con su voz, su léxico y su técnica de puente y de espejo propias, revisadas por un hablante competente; flujo completo de contenido sensible con revisor, fecha de verificación, caducidad y avisos, probado con un curso de nivel de riesgo alto. Aceptación: una unidad con verificación caducada vuelve a revisión; ningún contenido sensible se publica sin fuente y revisor.

H10. Migración y cambio de versión

Entregables: script de migración de usuarios y progreso (si procede), redirección del dominio, plan de vuelta atrás. Aceptación: ensayo completo en una copia; copia de seguridad previa; la app antigua sigue disponible hasta confirmar el cambio.

Reglas contra la repetición del problema
Nada de funciones nuevas fuera del hito en curso.
Cada hito tiene pruebas automáticas y tu prueba humana.
Una sola fuente de verdad para el progreso del alumno.
Un curso nuevo se crea desde el administrador; si exige código, se anota por qué en DECISIONS.md.
Toda decisión importante, en DECISIONS.md. Si algo no encaja con el hito, va a IDEAS.md.
