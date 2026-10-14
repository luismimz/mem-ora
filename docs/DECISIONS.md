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

## D-012 · Núcleo H1: definición de «éxito diferido»
- **Qué:** acierto sin pista, en `recall_unaided`, `production` o `application`, tras ≥ 20 h desde la última
  exposición (cualquier intento cuenta como exposición). Configurable en `deferred`.
- **Por qué:** mandato del usuario; 20 h en vez de 24 h para tolerar horarios de estudio variables.
- **Descartado:** contar `recall_cued` (tiene pista) y el reconocimiento.

## D-013 · Asociación con estado propio
- **Qué:** `association.ts` tiene calendario (+1/+3/+7/+14/+30 d), escalera de pistas P0–P5, diagnóstico
  («se está quedando», «formándose», «se está perdiendo») y revisión, separado del estado de la habilidad.
  El reconocimiento no cuenta para la asociación. La pista recomendada nunca pasa de P4.
- **Por qué:** mandato del usuario; el problema original de Memora era que la asociación no se volvía a recuperar.
- **Descartado:** derivar el estado de la asociación del de la habilidad (mezcla dos preguntas distintas).

## D-014 · Solo el reconocimiento puro no se consolida (revisada el 2026-10-13)
- **Qué:** las habilidades de reconocimiento puro (`recognition_choice`, `recognition_listening`) se programan
  (hasta +3 d como máximo) pero nunca llegan a «aprendida» ni desbloquean prerrequisitos. **Escuchar sí puede
  consolidar** mediante dos formatos de recuperación nuevos: `listening_transcribe` (dictado: escuchar y escribir
  lo oído) y `listening_explain` (escuchar y expresar el sentido con palabras propias; en idiomas, traducción libre).
- **Por qué:** «reconocer» no demuestra recuerdo sin ayuda (regla 11), pero dejar la escucha bloqueada para siempre
  impedía demostrar comprensión auditiva. Los nombres de los formatos son agnósticos de la materia.
- **Pesos:** ambos «alto» (0,75), como recuperar sin pistas. Hipótesis (ver `NUCLEO-UMBRALES.md`).
- **Versión anterior:** «las habilidades de solo escuchar nunca se consolidan». Descartada a petición del usuario.

## D-015 · Tope de escalón para aciertos débiles (`weakSuccessMaxStep`)
- **Qué:** un acierto de reconocimiento o con mucha pista sube de escalón solo hasta el 2 (+3 d).
- **Por qué:** la primera simulación mostró que, si un acierto débil repetía el escalón, todo lo reconocido se
  repasaba a diario, saturaba el tope y bloqueaba lo nuevo.
- **Descartado:** no espaciar nunca lo débil (satura) y espaciarlo sin límite (intervalos largos sin evidencia).

## D-016 · Prerrequisitos se cumplen con «en consolidación»
- **Qué:** `minStatus: consolidating`; «debilitada» cuenta como «en consolidación».
- **Por qué:** exigir «aprendida» bloquearía cada dependencia al menos dos días; un fallo posterior no debe volver a
  bloquear lo ya desbloqueado.

## D-017 · Simulación con alumnos sintéticos
- **Qué:** `tools/simulate` con un modelo de memoria simple (convenio «estabilidad = días hasta el 90 %»), semilla
  fija y una sesión diaria a las 9:00. Cuatro perfiles: idioma, programación, olvidadizo y ausente 5 días.
- **Por qué:** comprobar el mecanismo de punta a punta sin interfaz. No valida ningún umbral (ver
  `NUCLEO-UMBRALES.md`).
- **Nota:** el primer modelo (recuerdo del 37 % al cumplirse la estabilidad) era demasiado pesimista y generaba un
  círculo de fallos; se recalibró al convenio habitual.

## D-018 · Niveles aprendida, estable y dominada
- **Qué:** los estados se alinean con `CLAUDE.md`: `new → presented (vista) → learning → consolidating →
  learned (aprendida) → stable (estable) → mastered (dominada)`, más `weakened`. «Aprendida» = dos éxitos diferidos
  (lo que antes era «consolidado»); «estable» = acierto sin pista tras ≥ 7 d sin exposición; «dominada» = tras
  ≥ 30 d. Umbrales en `config.levels`.
- **Plazo contado desde la última exposición**, con compuerta en el programador para no pedir antes de tiempo.
- **Descartado:** contar desde que se alcanzó el nivel anterior permitiendo repasos intermedios (mediría «recuerda
  con práctica», no «retiene»). Queda como alternativa si en uso real la compuerta resulta demasiado espaciada.
- **Diferencia con `ESPECIFICACION.md` §4** (borrador): allí los niveles son **por palabra** y combinan habilidades
  (aprendida = recuperada + reconocida al oír + usada en frase; estable = supera +7 y +14 d; dominada = 3 sesiones,
  3 formatos y 2 frases propias, más un test a ≥ 30 d). El núcleo implementa los niveles **por habilidad**; el nivel
  de una unidad se podría derivar combinando sus habilidades. Pendiente de decisión del usuario.
- **Sustituye** la lista de estados de `HITOS.md` H1 (actualizada).

## D-019 · Validador de prerrequisitos de reconocimiento, al principio del H2
- **Qué:** `validateCatalog` debe rechazar un prerrequisito que apunte a una habilidad de reconocimiento puro, o a
  una unidad cuyas habilidades no puedan consolidar. Pasa a ser el primer entregable del H2.
- **Por qué:** ese prerrequisito bloquearía para siempre lo que depende de él, y en el H2 el contenido empieza a
  crearse desde el administrador.

## D-020 · Pistas del núcleo renombradas a P0–P5
- **Qué:** la escala de pistas del núcleo se llama P0–P5 (P0 sin pista … P4 escena o ejemplo completo · P5 respuesta
  revelada). E0–E5 queda para los **encuentros** con la asociación en el tiempo (`ESPECIFICACION.md` §24).
- **Por qué:** los dos usos de E0–E5 significaban cosas distintas y se iban a cruzar en el H2.

## D-021 · Nivel por unidad y validador del catálogo (H2.0)
- **Nivel por unidad** (`units.ts`), derivado de sus habilidades que pueden consolidar (el reconocimiento puro no
  cuenta): aprendida = todas al menos aprendidas; estable = todas al menos estables; dominada = todas dominadas **y**
  éxitos diferidos en ≥ 3 formatos distintos y en ≥ 2 contextos distintos (`config.unitLevels`). Si la unidad admite
  menos de 3 formatos, se exigen todos los que admite y el validador lo informa.
- **Contexto:** el intento lleva un `contextId` opcional (escena, frase o caso); lo aporta el motor de experiencias.
- **Tipos de habilidad → formatos** (`config.skillFormats`): define qué habilidades pueden consolidar.
- **Requisito de unidad:** solo exige sus habilidades que pueden consolidar (antes, una unidad con una habilidad de
  reconocer no se cumplía nunca).
- **Validador:** devuelve códigos y datos con severidad `error` (impide publicar), `warning` o `info`; los mensajes
  para el autor viven en `packages/content` por idioma (regla 15).
- **Precedencia:** si `ESPECIFICACION.md` §4 contradice `CLAUDE.md` o `DOMINIO.md`, mandan estos. §4 pide además
  «≥ 3 sesiones espaciadas», que ya se cumple: dominada exige al menos dos éxitos diferidos, uno tras ≥ 7 días y otro
  tras ≥ 30 días.

## D-022 · Uso sin conexión desde el H2
- **Qué:** el alumno puede estudiar sin conexión la sesión de hoy y la de mañana (contenido, audio e imágenes
  descargados de antemano). El cliente ejecuta `packages/core` sobre una copia local; los intentos se encolan y se
  envían de forma idempotente al reconectar; **el servidor es la fuente de verdad** y recalcula al sincronizar.
  El administrador sigue requiriendo conexión.
- **Requisitos para H2.1:** versión y `updatedAt` por unidad (invalidar caché); en cada evento, id generado en el
  cliente, `deviceId`, hora del dispositivo y hora de recepción en el servidor.
- **iPhone:** si la PWA no está instalada, Safari puede borrar el almacenamiento local; se pide
  `navigator.storage.persist()`, se recomienda instalarla y se prueba en el iPhone del usuario.
- **Nota:** el usuario pidió sustituir una decisión «H2 requiere conexión»; no existía en este archivo, así que esta
  es la primera decisión sobre conexión.

## D-023 · Topes de gasto por proveedor (revisada el 2026-10-13)
- **Saldos prepago** sin recarga automática: fal 10 € en total (ampliable si hace falta), OpenRouter 5 €.
- **Topes en la app, independientes:** OpenRouter 5 €/mes; fal 2 €/mes, que es el tope de imágenes (fal, modelo
  rápido FLUX.1 [schnell]), más un **tope diario de 10 imágenes**. Cada imagen se aprueba aparte.
- **Corte automático** al llegar al tope, contando el coste real de cada llamada.
- **Precio a verificar en el H2.3** contra la página del modelo y el coste real de una llamada. Fuentes secundarias
  (13-oct-2026): 0,003 $/megapíxel; no está claro si 1024×1024 se factura como 1 o 2 MP (0,003–0,006 $ por imagen).

## D-024 · Kokoro bajo demanda
- **Qué:** Kokoro no está siempre encendido. El audio se genera al aprobar la unidad (cola) y se sirve desde caché.
  En el H2.3 se mide el consumo real (CPU, RAM, tiempo por frase) y se valora generar en el Mac y subir los archivos.
- **Por qué:** el VPS (Hetzner CX33, x86, 80 GB) se comparte con otros proyectos; los recursos reales se verifican en
  el H2.4.

## D-025 · Dominios y entorno (revisada el 13-oct-2026)
- **App:** `memora.luismontalvan.com`. **Directus (panel y API):** `studio.luismontalvan.com`. Subdominios de un solo
  nivel, gestionados en Cloudflare. **Son las `PUBLIC_URL` definitivas:** la licencia se ata a ellas; no se cambian sin
  avisar al usuario. `ingles.luismontalvan.com` (V2) no se toca. 2FA obligatorio en administración.
- **Local:** Docker Desktop en el Mac (29.8, Compose 5.5, ARM). El VPS es x86: imágenes multiarquitectura.
- **HTTPS local para el iPhone (H2.2b):** `mkcert`. La clave raíz se queda solo en el Mac y el usuario borra el perfil
  del iPhone al terminar. **Nunca túneles públicos.**
- **Sesión entre subdominios:** ver D-032.

## D-026 · Habitación del H2
- **10 unidades:** las 5 de la misión «Necesitas ayuda en el trabajo» (`borrow`, `charger`, `run out of`,
  `Can I + verbo`, `actually`) más `battery`, `receipt`, `plug`, «I can't find…» y «How much is it?».
- Los ejemplos pasan por la revisión del usuario antes de publicarse.

## D-027 · Directus 12.4.1 con licencia (sustituye a «Directus 11.17.4, no 12»; 13-oct-2026)
- **Versión:** `directus/directus:12.4.1` fijada (amd64 y arm64), publicada el 23-sep-2026. Se descartó la 12.5.0
  por tener solo 6 días; la 12.4.1 corrige el fallo de la 12.4.0 que las propias notas piden evitar.
- **Licencia:** «Open Innovation Grant», leída del entorno (`LICENSE_KEY`, que el compose toma de
  `DIRECTUS_LICENSE_KEY` en `backend/.env`, nunca en git). Estado activo, sin caducidad (`expires_at: -1`), plazas,
  colecciones y flujos ilimitados, reglas de permisos personalizadas activadas. `LICENSE_KEY_MANAGEMENT_ENABLED=false`:
  la licencia no se cambia desde el panel ni la API.
- **Por qué:** Memora depende de reglas de permisos personalizadas («solo sus borradores», «solo editable en
  borrador», curso privado). **Comprobado con pruebas, no solo con la documentación:**
  - Con licencia: 18/18 pruebas de integración, incluidas 5 que solo pasan si la regla de permiso actúa.
  - En una instalación aparte sin licencia: nivel Core, **25 colecciones como máximo** y reglas personalizadas
    desactivadas. Directus **rechaza crear** los permisos con reglas (`RESOURCE_RESTRICTED`), el guion de permisos
    falla y la batería de integración falla. Con licencia, el límite de colecciones es ilimitado.
- **Descartado:** quedarse en la 11 (sin parches a largo plazo) y la 12 sin licencia (sin reglas propias).
- **Condiciones de la beca (leídas el 13-oct-2026):**
  - **Telemetría obligatoria.** El acuerdo de uso, §3.3, dice que el beneficiario no deshabilitará, bloqueará ni
    excluirá la recogida de telemetría, y la FAQ dice que no se puede desactivar con esta licencia. Según la
    documentación, con licencias que la exigen **Directus ignora `TELEMETRY=false`**. No se ha podido verificar en los
    registros si ya se envía. Pendiente de la decisión del usuario.
  - Duración: el acuerdo y la FAQ dicen que no caduca; la página de licencias dice «un año, renovable». Lo que muestra
    la instancia es `expires_at: -1`.
  - Activaciones: 5 por clave, cada una atada a la base de datos y a la `PUBLIC_URL`.
  - Incumplimiento: terminación por causa si no se corrige en 10 días tras el aviso (§5.3). Al terminar, la clave
    deja de valer y el software deja de funcionar (§2.2, §5.4); el contenido sigue siendo del beneficiario (§4.1).

## D-028 · Esquema, permisos y ajustes como código
- **Esquema:** `backend/schema/define.mjs` crea por la API lo que falte, solo en desarrollo. Su resultado se exporta a
  `backend/schema/snapshot.json`, versionado. **Los demás entornos solo aplican la instantánea**
  (`pnpm backend:schema:apply`), siempre con copia previa (`backend/backups/`). Desde la 12 se aplica **por la API
  del servidor** (`/schema/diff` + `/schema/apply`): aplicada con la CLI dentro del contenedor, el servidor en marcha
  no veía las colecciones nuevas (403) hasta reiniciarse. Este comportamiento no figura en las notas de la 12. Comprobado: el entorno local se
  reconstruyó desde cero solo con la instantánea y la prueba de recorrido pasó.
- **Roles, políticas, permisos y ajustes** no entran en las instantáneas de Directus; van en
  `backend/access/apply-access.mjs`, idempotente.
- **Descartado:** el `setup-schema.mjs` del repositorio antiguo (esquema a mano, sin instantáneas).

## D-029 · Reglas de Studio en el servidor
- La extensión `memora` (hook) aplica validación por tipo y técnica, flujo de estados por rol, bloqueo del contenido
  en revisión/aprobado/publicado, validación de la estructura del curso, habilidades por defecto, versión al publicar,
  copia de lo publicado e historial. Vale para el panel y para la API: un permiso amplio no se salta la revisión.
- **Nadie salta pasos, ni administración.** Para corregir algo publicado hay que devolverlo a borrador, revisarlo y
  publicarlo otra vez: mientras tanto desaparece para los alumnos. Editar una versión aparte sin despublicar
  (versiones de contenido de Directus) queda para el H8.
- **El alumno no lee colecciones:** usará los endpoints del H2.2a, que aplican la visibilidad de cursos privados.
- **Cuentas de prueba** con dominio `example.com` (reservado para pruebas; Directus rechaza `.local`).

## D-030 · 2FA de administración
- Política de administración con `enforce_tfa`. **Matiz comprobado:** hasta que la cuenta configura el 2FA, se puede
  iniciar sesión por la API sin código; el panel obliga a configurarlo al entrar.
- **En producción (H2.4):** configurar el 2FA en el primer acceso, antes de cualquier otra cosa, y no dejar un token
  estático (`ADMIN_TOKEN`) en la cuenta personal: usar una cuenta de servicio con permisos limitados o retirar el token
  tras el despliegue.

## D-031 · Telemetría de Directus activada (13-oct-2026)
- **Qué:** `TELEMETRY=true`. El usuario acepta la telemetría que exige la Open Innovation Grant (acuerdo de uso, §3.3),
  para que la configuración no contradiga el acuerdo.
- **Qué se envía:** URL pública, identificador aleatorio del proyecto, versión, tipo y tamaño de la base, recuentos
  (colecciones, elementos, campos, archivos, usuarios por tipo, roles, flujos, extensiones), si hay claves de IA (sí o
  no) y número de peticiones por método. **No** se envía contenido, nombres de campos, datos personales ni secretos.
  Cada 6 horas, a `telemetry.directus.io`.
- **Riesgo:** desactivarla o bloquearla incumple el acuerdo; Directus puede terminar la licencia si no se corrige en
  10 días tras el aviso (§5.3), y entonces el software deja de funcionar.
- **Alternativas:** una licencia de pago que permita desactivarla, o volver a Directus 11 (sin niveles; ver D-027).

## D-032 · Sesión del alumno por cookie (H2.2a)
- **Qué:** el alumno inicia sesión con Directus en modo `session`: cookie `httpOnly`, sin tokens en `localStorage`.
- **Local:** la app se sirve en `http://127.0.0.1:5173` y llama a Directus a través de un proxy de Vite (`/api`), así
  que la cookie es del mismo origen. Se usa `127.0.0.1` y no `localhost` porque las cookies no distinguen puertos:
  con `localhost` la sesión de la app y la del panel (`localhost:8055`) se pisarían.
- **Producción (a decidir en el H2.4):**
  - **Opción A (recomendada):** el servidor de la app sirve también `/api` como proxy hacia Directus. Cookie del mismo
    origen (`memora.luismontalvan.com`), sin CORS, y el service worker del H2.2b controla todo bajo un solo origen.
  - **Opción B:** la app llama directamente a `studio.luismontalvan.com`. Exige `CORS_ORIGIN` con la app,
    `CORS_CREDENTIALS=true`, cookie `Secure` y `SameSite=Lax` (los dos subdominios son el mismo «sitio»). Si se
    quisiera compartir la cookie, `SESSION_COOKIE_DOMAIN=.luismontalvan.com`, lo que también la mandaría al panel.

## D-033 · Sesión mínima del H2.2a · SUSTITUIDA por D-034 (13-oct-2026)
- **Recorrido de una unidad nueva:** escuchar → asociar (o «estructura» si es un patrón) → recuperar sin ver →
  ordenar → frase propia → resultado. Los repasos van primero, con la pista inicial que marca la escalera de la
  asociación.
- **Evidencia de cada paso** (tabla de `CLAUDE.md`):
  - recuperar escribiendo, sin pista → `recall_unaided`; con pista → `recall_cued` (P1 primera letra, P2 frase con
    hueco, P3 palabra de apoyo, P4 escena); «ver la respuesta» → P5, nunca cuenta como acierto;
  - **ordenar fichas → `recognition_choice` (peso bajo)**: elegir el orden entre fichas dadas no es producir;
  - **frase propia → `production`**, corregida solo por estructura (contiene la pieza, no copia el ejemplo, al menos
    tres palabras). Sin IA en la lección, la naturalidad de la frase no se juzga. Admite un segundo intento y los dos
    quedan registrados;
  - dictado en el repaso de «escuchar» → `listening_transcribe`.
- **Patrón:** su recuperación es rellenar la pieza fija en un ejemplo. Sus habilidades por defecto son recordar y
  producir. «Aplicar» se añadirá cuando exista una experiencia de caso o minidiálogo; antes, una habilidad imposible
  de practicar dejaba la unidad sin poder llegar a «aprendida».
- **Voz provisional:** en el H2.2a se usa la voz del navegador, con un aviso en pantalla. El audio de Kokoro desde
  caché llega en el H2.3.
- **El servidor manda:** el endpoint `memora-api` valida cada evento contra el contenido publicado (habilidad,
  unidad, asociación, formato y pista), pone siempre el usuario de la sesión, corrige horas del futuro y recalcula el
  estado desde todos los eventos. La posición de la sesión se guarda en el servidor tras cada paso.
- **Vista previa como alumno:** botón en la unidad del panel (`presentation-links`), solo para autoría, revisión y
  administración. La dirección de la app la fija `APP_URL` en `backend:access`. No guarda nada.
- **Límite conocido:** el «día» va en UTC (`dayOriginMs: 0`), así que en España cambia a las 2:00 en verano y a la
  1:00 en invierno. La zona horaria por alumno está en `IDEAS.md`.

## D-034 · Recorrido de la palabra por habitaciones (sustituye a D-033; pendiente de aprobación)
- **Motivo:** el usuario probó el H2.2a y lo rechazó («no es Memora»): empezaba con un sonido sin significado, pedía
  teclear la palabra en la primera exposición y metía la frase propia en el recorrido normal.
- **Qué cambia (propuesta en `docs/FLUJO-SESION.md`, a la espera de aprobación):**
  - primera exposición en el orden que pidió el usuario: palabra, significado, audio y pronunciación figurada juntos;
    escena en español con imagen y pieza clave resaltada; recuperación fácil sin teclear; escena en inglés con audio;
    frase natural con audio (y estructura si es un patrón); ordenar con fichas; repaso programado;
  - teclear solo llega en los repasos, con la escalera de pistas;
  - la frase propia («Hazla tuya») sale del recorrido normal y queda como opción oculta;
  - la sesión se organiza por habitaciones de 10 palabras.
- Se mantiene de D-033: el servidor manda, la vista previa, ordenar cuenta como reconocimiento.

## D-035 · Producto: 15 palabras por sesión y cuatro modos (14-oct-2026)
- Sesión de asociaciones de 15 palabras; meta ≈1.000 aprendidas al mes (2–3 sesiones/día), contando solo recuperación diferida sin ayuda.
- Asociaciones absurdas al centro, con recuerdo de la historia (reconstrucción e inversa). Gramática breve tras las 15 palabras y solo con ellas; Arcade con asociaciones directas e inversas; chat tras 3 sesiones de gramática.
- Modos Asociaciones, Gramática, Arcade y Chat elegibles por separado sobre un único estado del alumno.
- Sustituye la «habitación de 10» de D-034. Pendiente: cuota mínima de lo nuevo aunque haya repasos acumulados (requiere ajustar el plan del núcleo, con aprobación).

## D-036 · Escenas de 5 y curva del olvido (14-oct-2026)
- Sesión de 15 palabras = 3 escenas de 5. Diseño igual al de V2 (`docs/DISENO.md`, capturas en `docs/diseno/`).
- Intervalos de repaso: **1 h, 3 h, 24 h, 3 d, 7 d, 14 d** (y 30 d para el mantenimiento y «dominada»). Lo asumido sin
  fallos se espacia y no vuelve cada día. Supone cambiar `scheduler.stepsMs` del núcleo (configuración) y repetir
  pruebas y simulación: se hará al implementar, con aviso.

## D-037 · Mínimo diario de contenido nuevo y curva aplicada (14-oct-2026)
- `scheduler.stepsMs` = 1 h, 3 h, 1 d, 3 d, 7 d, 14 d, 30 d (D-036) y `weakSuccessMaxStep` = 3 (sigue siendo 3 días).
- `load.minNewPerDay` (3 por defecto): con atasco de repasos o mala racha entra igualmente ese mínimo. Antes no entraba
  nada con más de 10 vencidos fuera del día. Simulación (no es predicción): el olvidadizo pasa de casi tres semanas sin
  nada nuevo a tener contenido nuevo 25 de 30 días.
- **Agnóstico de la materia:** son ajustes de configuración del núcleo, iguales para idiomas, Java, redes o un temario.
  Cada curso podrá fijar los suyos (por ejemplo, 15 palabras por sesión en inglés). El núcleo sigue sin conocer la materia.

## D-038 · Boceto de Asociaciones aprobado y espiral (14-oct-2026)
- Boceto aprobado (`docs/BOCETO-ASOCIACIONES.md`) con la reconstrucción corregida: la historia lleva al significado.
- Arcade sorpresa al azar a partir de 20 palabras aprendidas.
- Espiral: asociaciones → truco → asociaciones → construir frase → frases absurdas en inglés → Arcade sorpresa → más
  gramática; siempre con vocabulario ya aprendido. Secuencias configurables como recetas desde Studio (H4).

## D-039 · Repasos del mismo día, varias sesiones al día y audio por curso (14-oct-2026)
- **Fallo corregido:** el plan diario descartaba lo practicado hoy, contradiciendo la curva de 1 h y 3 h; tras una
  sesión la app se quedaba sin nada. Ahora lo vencido vuelve el mismo día (prueba en `planner.test.ts`).
- **Ritmo:** `new_per_session` limita cada sesión; el tope diario admite 3 sesiones (meta ≈1.000 al mes).
- **Audio por curso:** `courses.audio_enabled` (idiomas sí; Java no). Sin audio no suena ni se muestran botones.

## D-040 · Modos por curso (14-oct-2026)
- `courses.modes` (casillas en Studio): Asociaciones, Gramática, Arcade y Chat. La app solo muestra los modos y
  contadores del curso. Idiomas: los cuatro. Otras materias (p. ej., Java): Asociaciones y Arcade; el Chat es opcional
  (casos o preguntas sobre conceptos).
- Sin Gramática, el Chat se abre al llevar 15 unidades trabajadas (en lugar de 3 sesiones de gramática).
- Sin Arcade, no salta el Arcade sorpresa dentro de las asociaciones.

## D-041 · Importar y exportar cursos en JSON (14-oct-2026)
- **Qué:** formato de curso v1 (`docs/FORMATO-CURSO.md`, validador en `packages/content/src/courseFile.ts`), página
  «Studio» en la app (autoría y administración) y endpoints `/memora/import`, `/memora/export/:id`,
  `/memora/studio/courses`. Guion `pnpm backend:export` con cursos y eventos de alumnos.
- **Todo o nada:** se comprueba todo antes de escribir (forma, contenido, técnica y clave repetida). La creación usa los
  servicios de Directus, así que pasan los mismos ganchos de Studio y los permisos del rol. Si algo falla, se borra el
  curso creado (cascada). Descartado: una transacción, porque los ganchos leen con la conexión global y no verían lo
  creado dentro de ella.
- **Siempre borrador** y visibilidad privada por defecto (regla 12).
- **Permiso nuevo:** el rol Autor puede crear cursos (antes solo leerlos), coherente con la regla 3. El propietario lo
  pone el gancho.
- **Exportación:** incluye borradores (es una copia de contenido); excluye unidades obsoletas y asociaciones rechazadas.

## D-042 · Conceptos y analogía para materias que no son idiomas (14-oct-2026)
- **Qué:** tipo de unidad `concept` (`name`, `gist`, `definition`, `answers`, `examples` sin traducción, `contrast`) y
  técnica `analogy` (cosa cotidiana + comparación ≤ 25 palabras + evidencia `mapping`/`breaksWhere`). La escena absurda
  también vale para conceptos. El ejemplo de Java pasa a conceptos (3 con analogía).
- **Por qué:** `term` exigía traducción en los ejemplos y comparaba el repaso con un solo texto exacto; en Java eso
  forzaba el contenido. `gist` (idea clave corta) permite que historia, Arcade y rescate funcionen igual que con palabras
  sin textos largos en mayúsculas; la definición completa se ve en la tarjeta.
- **Habilidades del concepto:** solo `recall` (lleva la asociación). Producir y aplicar llegarán con sus ejercicios; una
  habilidad que la sesión no practica dejaría la unidad sin poder llegar a «aprendida».
- **Idiomas intactos:** `term` y `pattern` no cambian; los textos de la app solo cambian para `concept`
  («¿Qué concepto es…?», «SE PARECE A»). Esquema: solo se añaden opciones a `units.type` y `associations.technique`
  (instantánea aplicada con copia previa).
- **Descartado:** reutilizar `term` con la traducción opcional (mezclaba reglas de idiomas y de conceptos en un validador).

## D-043 · Retos de aplicación en los conceptos (14-oct-2026)
- **Qué:** `concept.exercises` con cinco tipos (predecir la salida, completar el hueco, encontrar el error, aplicar a un
  caso, ordenar pasos) y paso `challenge` en la sesión de Asociaciones. El ejemplo de Java trae un reto por concepto.
- **Habilidad «aplicar» solo con ejercicios** (`skillsFor`): un concepto sin retos sigue con solo «recordar», y si se le
  añaden retos después, el gancho crea la habilidad. Nunca se borra sola (puede tener historial).
- **Evidencia honesta:** el primer día, opciones u ordenar = `recognition_choice` (bajo; regla de no teclear en la
  primera exposición). En el repaso, escribir u ordenar sin ayuda = `application` (muy alto); «Ver» = P5, nunca acierto.
- **Idiomas intactos:** los retos solo existen en `concept`; `term` y `pattern` no generan pasos nuevos.
- **Vista previa:** el selector «Revisar paso» también aparece en la vista previa (solo autoría), para ver cada paso.
- **Riesgo anotado:** con 10 conceptos nuevos la sesión suma 10 retos al final; si resulta larga, limitar los del
  primer día es un ajuste de configuración.
