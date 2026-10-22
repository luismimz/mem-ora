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

## D-044 · Trazado de código: definición, historia y código comentado (14-oct-2026)
- **Qué:** técnica `code_trace` (solo conceptos). La tarjeta se recorre en tres toques: 1) la definición en una frase,
  2) una historia absurda y muy visual, 3) un código corto con cada línea comentada con un elemento de la historia.
- **Validación:** la historia tiene como máximo 30 palabras y elementos en MAYÚSCULAS; al menos 2 líneas; cada
  comentario nombra en MAYÚSCULAS un elemento que aparece en la historia (si no, la línea no está atada a ella). El
  código conserva su sangría. Los datos van en `evidence.lines`, sin columnas nuevas; al alumno solo le llegan las líneas.
- **Excepción a las 14 palabras** (decisión del usuario, opción 1): solo en esta técnica, anotada en CLAUDE.md. Con
  14 palabras la historia no da para comentar 3 o 4 líneas.
- **Rescate:** al acertar ya no hay cuadro de confirmación, solo borde verde con brillo y rebote, y avanza solo. La
  respuesta se oculta si la escena o la analogía la nombra («Un atributo ___ es…»).
- **Ejemplo de Java:** static, constructor y override pasan a trazado de código.

## D-045 · Misiones en la portada y revisión de misiones en Studio (14-oct-2026)
- **Misiones = módulos** del curso, en su orden. La portada las muestra como un mapa de juego (una fila deslizable,
  centrada en la actual) con su avance (unidades trabajadas / total). Cada misión se puede hacer por separado.
- **Sesión enfocada** (`/session?mission=`): solo entra contenido nuevo de esa misión (`focusCatalog` en el núcleo);
  los repasos vencidos llegan de todo lo ya trabajado. Los prerrequisitos que apuntan fuera de la misión se omiten.
- **«Continuar aventura»** retoma la sesión empezada hoy (y su misión); si no hay, abre la primera misión sin terminar.
  El héroe muestra siempre la misión que abrirá.
- **Al terminar**, el resumen se desliza (sin botones): si a la misión le quedan unidades, sigue en ella; si está
  completa, pasa a la siguiente. Sin misión siguiente, botón «Terminar».
- **Studio en la app:** «Revisar misiones» lista las misiones con su estado; «Probar» abre la misión entera como
  alumno (borradores incluidos, no guarda nada); «Aprobar y publicar» lleva asociaciones y unidades por el flujo con la
  cuenta que lo pide (mismas comprobaciones que el panel) y publica la misión y el curso. Solo revisión y
  administración; se comprueba antes de mover nada. Lo que falle se informa por unidad.
- **Por qué:** en Directus hay que pasar estado a estado y unidad a unidad; con misiones de 15–20 unidades era
  inviable. Y empezar siempre «desde el principio» del curso generaba fricción.

## D-046 · Navegación y orientación (14-oct-2026)
- **Direcciones propias:** `/` (Inicio), `/perfil`, `/studio`, `/sesion?curso=…&mision=…`, `/preview/:unidad`. El botón
  «atrás» del navegador y recargar funcionan (la sesión se reanuda), y el título de la pestaña dice dónde estás.
- **Barra común** en Inicio, Perfil y Studio: el logo vuelve a Inicio, la sección actual se marca y el avatar abre el
  perfil. Dentro de una sesión hay una barra propia para concentrarse: «← Inicio» (el avance se guarda en cada paso) y la
  misión y la escena en el centro.
- **Perfil:** datos, progreso por curso (misiones y unidades), preferencias del dispositivo (curso al entrar y modo por
  defecto) y «Cerrar sesión», lejos de los botones de uso diario (antes «Salir» estaba junto al nombre).
- **Al salir de una sesión**, Inicio confirma «Tu avance está guardado. Sigues en la Misión N».
- **Modos bloqueados:** ya no muestran un aviso lejano; la propia tarjeta explica por qué y se resalta al tocarla.
- **Vocabulario por materia:** «palabras» en idiomas y «conceptos» en el resto; la ilustración del héroe sale de la
  materia, no del título. «Empezar aventura» la primera vez, «Continuar» después.
- **Móvil:** sin desplazamiento lateral (pestañas de curso que no rompían la columna, selector de revisión, animación de
  entrada de tarjetas).

## D-047 · Sin saltos de diseño y el centro solo para el juego (14-oct-2026)
- Inicio, Perfil y Studio se alinean arriba (antes Inicio se centraba en vertical y se movía según el contenido) y usan
  todo el ancho del contenedor, en dos columnas en escritorio. Solo la sesión de juego se centra.
- Mientras llegan contadores, misión actual y misiones se muestran huecos del mismo tamaño (con brillo suave, sin
  animación si el sistema pide menos movimiento). Medido con CLS del navegador: Inicio 0,000 (escritorio) y 0,008
  (móvil); Perfil y Studio 0,000.
- La sección de misiones aparece desde la primera misión (antes, solo con dos o más).

## D-048 · Pantalla de juego ajustada a la altura (14-oct-2026)
- La sesión ocupa exactamente la altura de la pantalla (100dvh): cabecera, barra y una tarjeta que llena el resto. La
  ilustración absorbe el espacio libre (crece o se encoge) y los tamaños de letra dependen de la altura (clamp con vh).
- El contenido se centra dentro de la tarjeta con «safe center»: si no cabe (móvil pequeño e historia larga), empieza
  arriba y se desplaza dentro de la tarjeta, nunca la página. La pista de deslizar queda fija abajo.
- Medido en 375×667, 390×844, 1280×720 y 1440×900 con tarjeta, recuerda, historia, rescate, reto y resumen: scroll de
  página 0 en todos; solo alguna tarjeta muy larga en 375×667 se desplaza por dentro.

## D-049 · Estándar Memora para las historias de conceptos (14-oct-2026)
- **Por qué:** las primeras misiones eran «un Anki bonito»: metáforas tibias sin gancho. Memora se basa en mnemotecnia.
- **Qué:** toda historia lleva puente de sonido en español (`cue`), acción absurda y la idea clave; el revisor
  automático lo comprueba. Las 35 misiones generadas (Programación 22, Bases de datos 13) se reescribieron; las
  definiciones y los retos no cambian. Lo ya publicado volvió a borrador para revisarlo.
- **Tarjeta:** en conceptos la historia es la protagonista; la cadena «puente → término → idea» va dentro de la
  ilustración y se parte en líneas; en pantallas bajas se reducen tamaños sin quitar contenido.
- **Arreglo:** el gancho de Studio fallaba al editar asociaciones (intentaba leer como JSON campos de texto).

## D-050 · Corrección: la cadena y el bloque del puente, de vuelta a su sitio en todas las tarjetas (14-oct-2026)
- Al arreglar un desbordamiento quité por error el bloque «SUENA A» de los conceptos, la etiqueta «IMAGEN DIRECTA» y
  moví la cadena «puente → término → idea» al centro de la ilustración en todas las tarjetas. Se restaura todo como en
  el diseño V2: la cadena al pie de la ilustración (mismo margen) y el bloque del puente bajo ella.
- Lo único nuevo: la cadena se parte en líneas si es larga y la ilustración nunca es más pequeña que su contenido.
- Lección: ante un desbordamiento, adaptar el elemento, nunca quitarlo ni moverlo sin preguntar.

## D-051 · Producción en Coolify con base limpia y conector de contenido (14-oct-2026)
- **Qué:** `deploy/docker-compose.prod.yml` con Postgres, Directus (imagen con extensiones y esquema), la app web
  (nginx sirviendo la PWA y reenviando /api a Directus en el mismo origen) y un servicio de copia diaria (14 días).
- **Datos:** GitHub solo lleva código. La base de producción nace limpia; el esquema y los permisos se aplican con
  `pnpm prod:schema` y `pnpm prod:access`, y el contenido se vuelca con `pnpm prod:content` desde el Mac, usando
  `backend/.env.production` (ignorado por git). Repetible sin duplicar. Sin cuentas de prueba.
- **Seguridad:** secretos solo en Coolify; `.dockerignore` excluye `private/`, copias y `.env*`; cookies seguras e
  `IP_TRUST_PROXY` detrás del proxy de Coolify. nginx resuelve Directus por petición para arrancar aunque tarde.
- **Descartado:** restaurar la copia local (arrastraría cuentas y progreso de prueba).

## D-052 · Revisión global de tarjetas (14-oct-2026)
- La cadena «puente → término → idea» se muestra siempre en las tarjetas de presentación (con puente o sin él:
  «TÉRMINO → idea»), también en el paso 2 de los trazados de código. En los pasos de pregunta sigue oculta (daría la
  respuesta), como en V2.
- Títulos: se parten en los puntos naturales (tras «/», «_», «.») y su tamaño se limita por la palabra más larga y el
  ancho de la tarjeta (unidades de contenedor), así que nunca se salen.
- Comprobación automática: se recorren desde Studio → Probar todas las misiones de los 4 cursos (464 tarjetas) en
  876×1120 y 390×844, verificando cadena presente, dentro de la ilustración y sin desbordamiento. Resultado: 0 fallos.

## D-053 · Producción en marcha, contenido publicado y bucle con subida automática (14-oct-2026)
- Producción desplegada en Coolify (memora.luismontalvan.com y studio.luismontalvan.com). Fallos resueltos: build pack
  automático («Railpack») en lugar de Docker Compose, ruta de construcción `..` (Coolify usa la raíz como directorio
  del proyecto) y dominio de Directus sin puerto (:8055).
- Esquema, permisos y 35 misiones (428 unidades) volcados con el conector y **publicados por decisión expresa del
  usuario**, que es quien revisa el contenido (regla 12: la IA genera; la publicación la ordena una persona).
- El bucle de misiones importa y publica cada misión en local y en producción al terminarla (`private/dam/run.sh`).
- Nuevo curso en el plan: «Coolify y el sistema de Memora» (12 misiones) con fuentes oficiales.
- Incidente: un fragmento de la clave de la API de Coolify apareció en un error de terminal (la barra «|» de la clave
  al cargar el archivo con la shell). Se cambió a lectura sin shell; recomendado rotar la clave.

## D-054 · Modo sin conexión mínimo (H2.2b adelantado, 14-oct-2026)
- **Por qué:** el usuario quiere estudiar en un vuelo. Una app nativa no hace falta: la web instalada en la pantalla de
  inicio (PWA) funciona sin red con un service worker.
- **Qué:** `GET /memora/offline` devuelve sesiones ya construidas (repasos que vencen en 24 h + lo pendiente de cada
  misión). La app las guarda en el dispositivo («Descargar para el vuelo»), las juega sin red con el mismo motor, guarda
  el punto de cada sesión y una cola de respuestas, y la envía al volver la red (eventos idempotentes: no duplica).
  Si la red cae a mitad de una sesión normal, las respuestas también van a la cola.
- **Service worker:** guarda la app (index.html y /assets) para abrirla sin red; nunca guarda la API.
- **Límites (pendiente del H2.2b completo):** sin red no se recalcula el plan (las sesiones descargadas son fijas);
  se guarda en localStorage (unos 750 KB para los tres cursos DAM); audio desactivado sin red.
- **Probado:** descarga → modo avión → abre en «Modo avión» → 9 preguntas → vuelve la red → 19 respuestas
  sincronizadas, 0 pendientes.

## D-055 · Cursos DAM visibles para todos los alumnos (14-oct-2026)
- **Qué:** los tres cursos DAM pasan de «solo el propietario» a «todos los alumnos», en producción y en local; las
  misiones nuevas se crean públicas.
- **Por qué:** decisión del usuario (un alumno invitado no veía nada). El contenido es propio: los libros de ILERNA solo
  se usan para saber qué temas tocar. Se actualiza la regla 16 de CLAUDE.md en ese sentido.
- **Pendiente:** elegir por curso entre «todos», «solo yo» o «compartido con usuarios concretos» (ver IDEAS).

## D-056 · Retos de memoria (juego familiar) (14-oct-2026)
- **Qué:** tipo de unidad `memory_challenge` (lista de palabras, emojis, palabras falsas e historia por escenas) con
  validador: cada palabra debe aparecer en la historia y en el mismo orden. Modo de curso `memory`: la portada muestra
  los retos en lugar de la sesión. Curso «Retos de memoria» con 22 retos (el del usuario, uno de ejemplo y 20 nuevos).
- **Juego:** 1) un minuto con la lista; 2) tocar en orden lo que recuerdas (con palabras falsas mezcladas); 3) la
  historia escena a escena; 4) recordar otra vez; 5) comparar «antes → después»; extra: al revés.
- **Progreso en la cuenta (regla 10):** cada intento es un evento de aprendizaje sobre la habilidad del reto
  (`contextId` «reto:<fase>:<en orden>/<total>»); el mejor resultado sale de ahí y el reto vuelve con la curva del olvido.
- **Pendiente:** varios jugadores en el mismo móvil (marcador familiar) y crear retos desde Studio con vista previa.

## D-057 · Rampa de unidades nuevas según los aciertos (15-oct-2026)
- **Qué:** cada sesión trae al principio 8 unidades nuevas; cada día con al menos 5 intentos y ≥ 80 % de aciertos sube 2,
  y con < 60 % baja 2, entre 8 y el objetivo del curso (`newPerSession`). Si el objetivo es menor que 8, manda el objetivo.
- **Dónde:** `newUnitsFor` en `packages/core` (agnóstico, probado) a partir de la actividad diaria del alumno, que ya
  vive en el servidor; la sesión lo usa como tope de nuevas. Vale para todos los cursos.
- **Por qué:** empezar con menos carga y más éxito, y adaptarse a cada alumno. Descartado: escalera fija por número
  de sesión (no se adapta) y misiones más cortas en el contenido (obligaría a reescribir cursos).

## D-058 · «Completa la historia»: el hueco siempre es una palabra con contenido (15-oct-2026)
- **Fallo:** el hueco era la primera palabra de la idea clave aunque fuera un artículo («la», «el», «sin»). En 144 de
  645 unidades salían opciones como «LA / EL / UN» o la frase entera mezclada con palabras sueltas.
- **Arreglo:** `storyGap` busca el significado entero, después la primera palabra de ≥ 4 letras de la idea clave que
  esté en la historia y, si no hay, la pieza clave en MAYÚSCULAS (mejor si no es el puente). Coincidencia por palabra
  completa con Unicode (tildes). El revisor de misiones (`lint`) exige al menos una palabra con contenido.
- **Además:** el paquete sin conexión usa la misma rampa que la sesión en línea (D-057).

## D-059 · Retos de memoria: los primeros suben de 8 a 14 palabras (15-oct-2026)
- **Qué:** cuatro retos nuevos al principio del curso, de 8, 10, 12 y 14 palabras, con historias cortas, visuales y
  sin repetir palabras de otros retos; después vienen los 22 retos de 15. Misma idea de rampa que D-057.
- **Corrección:** en 9 retos la lista decía una palabra en singular y la historia en plural («Huevo» / «huevos»); la
  lista usa ahora la misma forma que la historia.

## D-060 · Temarios de examen sin historias absurdas (16-oct-2026)
- **Qué:** un concepto puede ir sin asociación. La sesión entonces no tiene «Completa la historia» ni rescate: tarjeta
  (definición, ejemplo, contraste y apartado oficial del temario en `notes`), recordar y retos tipo examen.
- **Por qué:** en la preparación de un examen oficial (Acceso a Grado Medio · Madrid) el usuario pide ceñirse al temario;
  una historia por concepto despista. Coincide con CLAUDE.md: si no hay asociación defendible, se enseña por otra vía.
- **Contenido:** cada unidad cita su descriptor del RD 86/2025 (anexo I, nivel 3) y lleva al menos dos retos, muchos
  sobre un texto o problema propio. El revisor exige esos dos retos en lugar de la historia.
- **Descartado:** borrar y reimportar el curso (perdería el progreso ya guardado en producción); se reescriben las
  mismas unidades con `private/dam/update-units.mjs`.

## D-061 · Historias de 10 palabras como máximo y auditoría de todo el contenido (17-oct-2026)
- **Qué:** escena ≤ 10 palabras (antes 14), analogía ≤ 15 (antes 25) y trazado de código ≤ 20 (antes 30), en la regla
  de CLAUDE.md, en los validadores de `techniques` y en el revisor de misiones. Decisión del usuario.
- **Por qué:** las historias deben ser cortas para recordarlas y cumplir su función: una sola acción visual, el puente
  suena como la sílaba tónica del término y actúa sobre la idea clave, que aparece en la historia.
- **Auditoría:** `private/dam/audit.py` marcó 529 de 657 unidades. Se reescriben curso a curso (Inglés, Aprender a
  aprender, Programación, Bases de datos, Acceso a datos) conservando las unidades y el progreso, y se publican misión a
  misión en producción. El bucle de contenido nuevo queda parado hasta terminar.

## D-062 · Enseñar antes de evaluar y mnemotecnia útil en los temarios de examen (19-oct-2026)
- **Fallo:** tras reescribir el curso de Acceso a Grado Medio, la sesión del alumno empezaba con 14 preguntas de repaso
  sobre fichas que nunca había visto en su versión nueva: evaluaba sin enseñar.
- **Motor:** el servidor compara la última modificación de cada unidad con la última vez que el alumno la vio
  (`lastExposureAt`/`presentedAt`); si cambió después, la sesión muestra la ficha («Ficha renovada») justo antes de su
  repaso (`refreshUnits` en `buildAssociationSession`). Vale para todos los cursos y para la auditoría D-061.
- **Contenido de examen:** corrige D-060. Sin escenas absurdas, pero sí con mnemotecnia ligada al significado
  (analogía con correspondencia y límite, acrónimo o regla: «DE-ductiva: la idea va DE-lante», «método LÁSER»), además
  de la definición, el apartado oficial y los retos tipo examen.

## D-063 · Comprobación selectiva antes de escribir, con ayuda que se retira (19-oct-2026)
- **Qué:** en los repasos, antes de escribir la respuesta, un paso «Comprueba» para elegir entre 4 opciones. La ayuda
  depende de los repasos espaciados superados (éxitos diferidos): 0 → asociación completa a la vista, 1 → solo la imagen,
  2 → solo la idea; desde 3 se escribe directamente (especificación §6: «la ayuda desaparece con los encuentros»).
- **Lo nuevo:** ficha → recordar (elegir) → completar la clave → retos con opciones → **escribir** sin opciones al
  final (con pistas si hacen falta). Sustituye al «rescate» de opciones del cierre.
- **Al fallar** una comprobación se muestra la explicación (la escena o, sin escena, la definición del concepto).
- **Por qué:** el usuario detectó que los repasos iban directos a la pregunta difícil; solo Bases de datos (con contenido
  nuevo) mostraba la secuencia elegir → escribir. Ahora todos los cursos la siguen. Pesos honestos: la elección cuenta
  como reconocimiento (bajo); escribir sin pistas, como recuperación (alto).

## D-064 · Proceso de enseñanza acordado: asociación → clave → historia → pregunta; repesca (19-oct-2026)
- **Lo nuevo, por escena:** 1) las asociaciones (ficha con la mnemotecnia); 2) «La clave»: ¿qué palabra te hace
  recordar cada concepto? (se elige entre las claves de la escena); 3) «La historia»: se muestra la historia sin la
  palabra y se elige de qué habla; resultado de la escena. Después, «La pregunta» (retos tipo examen, con opciones).
- **Escribir solo en idiomas** (unidades `term`): al final de lo nuevo y en los repasos. En el resto se elige siempre.
- **Repasos:** pista de la mnemotecnia («se parece a ETIQUETA») → elegir; la pista se retira repaso a repaso (D-063).
- **Repesca:** al final de la sesión, lo fallado se vuelve a enseñar (ficha) y se comprueba otra vez; lo acertado se
  salta solo (pasos `retry` en el plan; la app los omite si no hubo fallo de esa unidad en la sesión).
- Sustituye en lo nuevo a «Recuerda (significado → nombre)» y «Completa la historia». Validado primero en Acceso a
  Grado Medio (recorrido local paso a paso) antes de replicar el contenido en el resto.

## D-065 · Todo repaso empieza por su asociación (20-oct-2026)
- **Qué:** en los repasos, cada concepto empieza por su ficha con la asociación («Repaso · primero, la asociación») y
  después la comprobación con pista y la pregunta. Si la ficha cambió, se marca «Ficha renovada» (D-062).
- **Por qué:** decisión del usuario como profesor: enseñar siempre antes de preguntar. Coste asumido: el intento de
  recuperación es más fácil (menos efecto de prueba); la repesca y los repasos espaciados siguen midiendo lo retenido.

## D-066 · Recordar sin escribir, repasos «intento primero» y sesiones cortas (20-oct-2026)
- **Recordar sin escribir:** paso «Piensa»: se muestra la pista (en lo nuevo, la historia sin la palabra; en el repaso,
  la clave, la imagen o solo la idea), el alumno piensa la respuesta, pulsa «Ver la respuesta» y se califica: Sí / Casi
  / No. Al ver la respuesta se vuelve a enseñar la ficha. Cuenta como recuperación (con pista P4/P1 o sin pista);
  «Casi» y «No» llevan a la repesca. Sustituye a elegir de qué habla la historia (reconocimiento) en lo nuevo.
- **Repasos (revierte D-065):** intento primero, con pista que se retira; si fallas, la ficha reenseña y repesca. La
  ficha va antes solo si cambió (D-062). Motivo: práctica de recuperación (Roediger y Karpicke 2006) y error con
  corrección (Kornell, Hays y Bjork 2009); ver la respuesta antes convierte el repaso en releer.
- **Sesiones cortas:** bloques de 4 conceptos nuevos y como mucho 10 repasos por sesión (5–10 minutos).
- **Idiomas:** se mantiene elegir y escribir (D-064). Primero se valida en Acceso a Grado Medio.
- **Siguiente:** medir la retención a 7 y 30 días y cambiar el programador por FSRS.

## D-067 · Se enseña antes de preguntar, siempre (decisión del usuario, 20-oct-2026)
- **Qué:** se restaura D-065. Todo repaso empieza por la asociación y después el intento; vale también al empezar la
  sesión. El proceso completo queda en `docs/PROCESO-APRENDIZAJE.md` y solo se cambia con aprobación del usuario.
- **Error corregido:** en D-066 se revirtió D-065 por criterio técnico (práctica de recuperación) sin confirmación
  explícita del usuario. Lección: una decisión pedagógica del usuario no se cambia sin preguntarle.
- **Prueba:** «nunca se pregunta por una unidad sin mostrar antes su asociación en la sesión» (motor de experiencias).

## D-068 · Modo Flujo: aprender deslizando, al estilo de las redes sociales y del Arcade (20-oct-2026)
- **Qué (aprobado por el usuario):** un deslizar continuo de tarjetas cortas. Lo nuevo entra en parejas: dos
  asociaciones rápidas («reel», avanzan solas en ~6 s o al tocar) y sus dos preguntas relámpago (7 s, 3 opciones,
  término → significado o al revés). Los repasos van como relámpago. **Se enseña en el error:** si fallas o se acaba el
  tiempo, aparece la asociación completa y esa unidad vuelve 3 tarjetas después en sentido contrario. Cada 8
  tarjetas, una pregunta tipo examen de algo ya visto. Solo en idiomas se escribe al final. Sin pantallas intermedias.
- **Por qué:** el proceso por escenas era correcto pero lento y con fricción; el usuario quiere fluidez y engancharse.
- **Cómo se activa:** modo de curso `flow` (de momento solo Acceso a Grado Medio, para validarlo). Los demás cursos
  siguen con el proceso por escenas (D-064/D-067) hasta que el usuario apruebe replicarlo.
- **Además:** el desplegable «Revisar paso» solo aparece en la vista previa de Studio o con `#revisar`.

## D-069 · Flujo: la asociación sin cuenta atrás; la pregunta, con tiempo según lo que hay que leer (20-oct-2026)
- **Qué:** el reel de la asociación ya no avanza solo: se pasa al tocar o deslizar. La pregunta relámpago da 7 s más
  1 s por cada 35 caracteres de pregunta y opciones (máximo 15 s).
- **Por qué:** el usuario no tenía tiempo de leer la asociación en 6,5 s.

## D-070 · Flujo: toda unidad se enseña antes de preguntarla; la pregunta no se cierra sola; revisión antes de entregar (20-oct-2026)
- **Fallos:** en el Flujo, los repasos entraban como pregunta sin su asociación (incumplía la regla de oro D-067) y la
  pregunta relámpago se daba por fallada al acabarse el tiempo («me salta la pregunta»).
- **Arreglo:** toda unidad, nueva o de repaso, entra en parejas reel → relámpago (repasos y nuevas alternando de dos en
  dos). La barra de tiempo solo da puntos por rapidez; la pregunta espera a que respondas.
- **Repaso escrito (idiomas):** «Comprobar» a todo el ancho bajo la respuesta; «Pista» y «Ver», secundarias debajo.
- **Revisión obligatoria antes de entregar:** `private/shots/verify.cjs` comprueba en la app real 10 puntos del método
  (empieza por asociación, ninguna pregunta sin asociación, la asociación y la pregunta no avanzan solas, al fallar se
  enseña y hay repesca, sesión corta, no se escribe fuera de idiomas). Las pruebas del motor fijan la regla de oro.

## D-071 · Recordar el inicio de sesión en el dispositivo (20-oct-2026)
- **Causas:** Directus mantiene la sesión 1 día por defecto (con 2FA, eso es pedir el código cada día), y la app mandaba
  a «Entrar» ante cualquier error al abrirse, también durante un despliegue (servidor arrancando).
- **Arreglo:** `SESSION_COOKIE_TTL` y `REFRESH_TOKEN_TTL` a 30 días, renovados en cada uso (configurables en Coolify).
  La app solo pide entrar con 401/403; otros fallos se reintentan unos segundos. La cookie es de la propia web (misma
  origen vía `/api`), con `HttpOnly`, `Secure` y `SameSite=Lax`.
- **Riesgo asumido:** quien tenga el dispositivo desbloqueado entra sin código durante 30 días; «Salir» cierra la sesión.

## D-072 · Flujo como experiencia propia, al estilo de una red social; Desarrollo de interfaces lo estrena (20-oct-2026)
- **Qué:** la sesión en modo `flow` se pinta con un componente nuevo (`Feed.tsx`), no con la sesión por escenas:
  pantalla completa, una tarjeta cada vez, deslizar hacia arriba; color propio por concepto; barra de progreso arriba,
  XP y combo 🔥 siempre visibles; vibración y sonido breves; celebración a 3, 5, 10… aciertos seguidos; puntos que
  flotan. Tarjetas: asociación (reel, sin cuenta atrás), relámpago, **¿verdad o mentira?** (deslizar → / ← o botones),
  pregunta jefe 👑 tipo examen y, solo en idiomas, escribir. Al fallar: «Recuérdalo así» con la asociación y la unidad
  vuelve 3 tarjetas después. Final: XP, **racha de días** (calculada en el servidor), aciertos, mejor combo, nuevos y
  próximo repaso, con «⚡ Una ronda más» sin salir.
- **Curso:** Desarrollo de interfaces (DAM M07) se crea en modo Flujo; misión 1 «Componentes y eventos» con analogías
  de ≤ 10 palabras ligadas al significado y retos de código Java correcto. Contenido propio (regla 16).
- **Revisión antes de entregar:** `private/shots/feed.cjs` recorre la ronda en la app real y comprueba el método.

## D-073 · Se evalúa lo que se enseña: la ficha del Flujo enseña la definición y el ejemplo (20-oct-2026)
- **Fallo:** el reel solo mostraba idea clave y mnemotecnia; la definición (donde están TextField, BorderLayout…) no
  se veía, y algunas preguntas pedían cosas no explicadas.
- **Arreglo:** la ficha (y «Recuérdalo así») muestra la mnemotecnia y debajo «Qué es», el contraste y «Ejemplo» (con
  código si lo hay). Si es larga se desplaza; «Siguiente» al final. Los +XP suben junto al contador, sin tapar texto.
- **Revisor (bloqueante al generar):** `private/dam/taught.py` comprueba que la respuesta de cada reto aparece en lo
  enseñado (su ficha o una anterior del curso). Desarrollo de interfaces: 0 incumplimientos. Resto: 42 por corregir
  en la auditoría (Acceso 8, Aprender 14, Acceso a datos 5, Bases de datos 11, Programación 4).

## D-074 · La app se actualiza sola en el móvil (20-oct-2026)
- **Fallo:** el móvil seguía con la versión vieja: nginx guardaba 30 días cualquier `.js` (también `sw.js`, el service
  worker) y la página principal no llevaba `Cache-Control`; con la app abierta, nada comprobaba si había versión nueva.
- **Arreglo:** `index.html`, `sw.js` y el manifiesto con `no-cache`; solo `/assets/` (con huella) un año. El service
  worker pide la página sin caché (`cache: 'no-store'`, `updateViaCache: 'none'`, caché v2). La app comprueba la
  versión al volver a primer plano y cada 5 minutos y se recarga sola; en mitad de una ronda espera a que salgas.
- **Además (mismo día):** Cloudflare servía el `sw.js` antiguo desde su caché (30 días); el service worker pasa a
  `sw-v2.js` y nginx no guarda en caché ningún `sw*.js`. Si vuelve a pasar, se sube el número en `main.tsx`.
- **Desbordamiento:** en el Flujo, el código y las palabras largas se parten (`overflow-wrap: anywhere`) y ninguna
  tarjeta se sale de la pantalla; el recorrido de revisión (`feed.cjs`) lo comprueba en cada tarjeta.

## D-075 · Estándar congelado, puerta de calidad única y Flujo para todos los cursos de conceptos (21-oct-2026)
- **Por qué:** el usuario, cansado de arreglos que rompían otras cosas, pide establecer de una vez cada parte.
- **Estándar:** `docs/ESTANDAR.md` (experiencia, reglas de enseñanza, qué técnica de memoria para cada cosa, diseño,
  calidad, contenido de ILERNA). Solo se cambia con aprobación del usuario.
- **Puerta de calidad:** `private/release.sh` es la única forma de publicar: tipos, pruebas, compilación, recorrido
  real de cada curso en Flujo, revisores de contenido (cursos auditados a 0 avisos), despliegue y verificación en
  producción (versión servida, caché y reglas del plan). Si algo falla, no se publica.
- **Flujo único** para los cursos de conceptos (Programación, Bases de datos, Acceso a datos, Desarrollo de interfaces,
  Aprender a aprender, Acceso a Grado Medio). Inglés y Retos de memoria siguen como están hasta que el usuario decida.
- **Contenido:** prioridad a los módulos del semestre en curso (guías 1s 26/27): Acceso a datos, Desarrollo de
  interfaces, Sistemas de gestión empresarial, Bases de datos B, Programación B e Inteligencia Artificial, con mapa de
  cobertura apartado a apartado del índice de cada libro.


## D-076 · Temario del semestre completo y auditoría de todo lo publicado (21-oct-2026)
- **Contenido nuevo:** Programación B 23–26 (genericidad y estructuras, grafos y árboles, conectar Java con SQLite,
  MySQL y PostgreSQL y la BD en Docker, CRUD con JDBC y db4o) y Bases de datos B 14–15 (MongoDB en la práctica,
  SQLite a fondo). Con esto los seis módulos del semestre quedan cubiertos apartado a apartado.
- **Auditoría:** las ~470 historias antiguas que pasaban de 10 palabras o no contenían la idea clave se reescribieron
  a mano una a una (no se recortaron automáticamente), se quitaron los puentes repetidos dentro de un curso (cada
  palabra de apoyo lleva a un solo concepto) y las fichas enseñan ahora todo lo que después se pregunta.
  Resultado: 0 avisos en los ocho cursos de conceptos y 0 retos sobre algo no enseñado.
- **Cómo:** `private/dam/fix/<curso>.py` (historia, palabra de apoyo, idea clave o frase de la definición por clave de
  unidad) se aplica a los JSON con `apply_fix.py` y también al regenerar una misión (`save`), así que no se pierde.
  `fixpub.sh` lo sube a local y producción con `update-units` y `update-assoc`, que conservan el progreso.
- **Regla aprendida:** una analogía necesita palabra de apoyo (el validador la exige); a una escena absurda se le
  puede quitar si repetía la de otro concepto.

## D-077 · Flujo infinito sin botones, cada pregunta con su ejemplo visto (21-oct-2026)
- **Por qué:** el usuario encontró una pregunta jefe («¿qué método de Files comprueba si un fichero está en disco?»)
  cuya respuesta solo aparecía en una lista de la ficha, sin explicar; no quiere botones de más y quiere el efecto
  red social: deslizar y que no acabe. Aprobado por el usuario (respuestas del 21-oct).
- **Contenido:** el revisor exige ahora que la respuesta esté en la ficha de **su** unidad (no en cualquier parte del
  curso) y que el código salga en un ejemplo que diga qué hace. Se arreglaron 70 retos (ejemplos y frases nuevas).
- **Experiencia:** sin «Siguiente», «Entendido» ni «Una ronda más»: se desliza; al acertar pasa sola; al fallar, «Recuérdalo
  así» (con la respuesta si venía de una pregunta). La ficha muestra todos sus ejemplos y «🤔 Explícame más» abre la
  letra pequeña (correspondencias y límite de la analogía, el código línea a línea) y anota la petición
  (`content_requests`) para ampliar la ficha.
- **Infinito:** cada ronda acaba en un hito; la siguiente se pide en ese momento y se encadena al deslizar. Orden:
  repasos, «tus errores» (fallado u olvidado), lo nuevo (rampa D-057; como mucho tres rondas de nuevas al día) y, si no
  queda nada, refuerzo de lo más débil (`weakUnits`). Las preguntas suben de nivel: con 2 repasos superados se completa
  escribiendo (respuesta corta); en idiomas, se escribe la palabra.
- **Racha con protector:** cada 7 días de racha, un protector (máximo 2) que salva un día perdido (`streakOf`).
- **Aviso de repaso en el móvil:** Web Push sin contenido cifrado: el servidor (hook `memora-push`, cada 15 min) solo
  «toca el timbre» firmado con VAPID y el service worker pide el texto a `/memora/push/message` con la sesión. Se avisa
  de 9:00 a 22:00 (Madrid), como mucho cada 12 h y solo si hay repasos vencidos. Claves solo en el entorno
  (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; `private/qa/vapid-setup.mjs` las crea sin mostrarlas). El hito
  ofrece «🔔 Avísame» una vez; en iPhone exige tener Memora en la pantalla de inicio (iOS 16.4+).
- **Descartado:** vidas o corazones (castigan el error, que en Memora es el momento de enseñar); avanzar solo en las
  fichas (el usuario necesita tiempo para leer, D-070).

## D-078 · Inglés intensivo: Flujo con audio, escribir y conversación con IA con guion (21-oct-2026)
- **Situación del usuario:** nivel A2, 2 horas o más al día, quiere hablar en inglés lo antes posible (objetivo B2
  conversacional). Se le dijo con honestidad que B2 en 30 días no es realista; el plan busca el mayor salto posible
  hacia la conversación fluida y sigue después hacia B2.
- **Formato:** el inglés pasa al Flujo (deslizar, infinito), con ▶ para oír cada palabra y ejemplo y escribir solo en
  idiomas.
- **Contenido:** vocabulario frecuente (las 1.000 primeras y más), frases hechas para conversar, gramática clave del
  A2 al B2 y escucha.
- **Conversación con IA (cambia la regla 12 solo para esto, aprobado por el usuario):** situaciones preparadas
  (restaurante, entrevista, viaje…) en las que la IA hace de interlocutor y corrige. Lleva guion y objetivo por
  situación, tope de gasto global y por usuario y día, y un proveedor que no guarda ni entrena con los mensajes. La
  corrección se valida con esquema; el resto de la lección sigue usando solo contenido preparado y revisado.

## D-079 · Inglés que enseña de verdad: escuchar, construir frases y gramática en el Flujo (22-oct-2026)
- **Por qué:** el usuario no sentía avance («castigado en el mismo punto») y no veía gramática. Causa: en el Flujo cada
  palabra solo se practicaba reconociendo su significado; «escuchar» y «producir» nunca salían, así que ninguna palabra
  llegaba a «aprendida». La gramática no existía en el Flujo ni en el curso.
- **Qué:** tarjetas «Escucha» (oír y elegir) y «Construye la frase» (ordenar las palabras de un ejemplo real); las
  unidades `pattern` entran con su truco Espejo y se practican y repescan construyendo. Un truco por misión del curso de
  inglés (13), con el vocabulario de esa misión. El hito muestra lo trabajado, lo que está en la memoria y la misión.
- **Decisión del usuario (22-oct-2026):** en idiomas, sin tope diario de nuevas mientras se acierte (≥ 80 % en la ronda).

## D-080 · Contenido propio desde git, publicado al desplegar (22-oct-2026)
- **Por qué:** el contenido solo se podía publicar desde el Mac del usuario con su clave; trabajando a distancia nada
  llegaba a producción. **Qué:** `content/<curso>/` en el repositorio y el hook `memora-content`, que lo vuelca al
  arrancar Directus (idempotente, conserva el progreso, nunca borra). Fusionar el PR es la orden de publicar.
  **Descartado:** una GitHub Action con la clave de administración (exige guardar un secreto más y depende del runner).


## D-081 · Reto de 30 días, Ráfaga y los pilares del método (22-oct-2026)
- **Decisiones del usuario:** meta de aprender inglés en 30 días con un objetivo diario exigente y divertido, y estos
  pilares: Feynman y semáforos (Toco o cuento: HAVE si se toca o se cuenta, TO BE si se siente; DO/DID/WILL como
  alarmas de presente, pasado y futuro; HAVE al principio = «¿YA…?»), equivalencias directas (-ar/-er/-ir = TO,
  -ando = -ING, -ría = WOULD, «si tuviera» = pasado), piezas de Lego (chunks: look at/for/after, listen to…) e
  «inglés al revés» (la preposición al final).
- **Meta diaria:** 35 nuevas al día en idiomas (≈ 1.000 en 30 días), visible en Inicio y en cada hito. Honestidad: el
  curso tiene ~250 unidades; el resto se añade vuelta a vuelta.
- **Ráfaga:** un concepto cuyas preguntas se responden con el mismo puñado de respuestas cortas se juega rápido: con
  dos, deslizando la tarjeta; con tres o cuatro, con botones gigantes de colores; confeti y «pop» al acertar. La
  tarjeta cae en 4 s; si toca el suelo vuelve una vez al final (la rapidez da puntos, no castiga: ESTANDAR §2).
  Arrastrar piezas tipo imán (chunks) se resolvió con botones de pieza: más fiable en el móvil.
