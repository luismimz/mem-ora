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

## D-023 · Topes de gasto por proveedor
- **Saldos prepago** sin recarga automática: fal 10 €, OpenRouter 5 €.
- **Topes en la app:** OpenRouter 5 €/mes; fal 2 €/mes; imágenes (fal, modelo rápido FLUX.1 [schnell]) con
  sublímite de 1 €/mes y tope diario. Cada imagen se aprueba aparte.
- **Precio a verificar en el H2.3** contra la página del modelo y el coste real de una llamada. Fuentes secundarias
  (13-oct-2026): 0,003 $/megapíxel; no está claro si 1024×1024 se factura como 1 o 2 MP (0,003–0,006 $ por imagen).
- **Pendiente:** el usuario escribió también «dentro de los 5 €/mes»; ver la pregunta abierta sobre si los topes son
  por proveedor o un total.

## D-024 · Kokoro bajo demanda
- **Qué:** Kokoro no está siempre encendido. El audio se genera al aprobar la unidad (cola) y se sirve desde caché.
  En el H2.3 se mide el consumo real (CPU, RAM, tiempo por frase) y se valora generar en el Mac y subir los archivos.
- **Por qué:** el VPS (Hetzner CX33, x86, 80 GB) se comparte con otros proyectos; los recursos reales se verifican en
  el H2.4.

## D-025 · Dominios y entorno
- **App:** `memora.luismontalvan.com`. **Administrador:** un subdominio distinto (nombre a confirmar en el H2.4).
  `ingles.luismontalvan.com` (V2) no se toca.
- **Local:** Docker Desktop en el Mac para Directus, Postgres y Kokoro.

## D-026 · Habitación del H2
- **10 unidades:** las 5 de la misión «Necesitas ayuda en el trabajo» (`borrow`, `charger`, `run out of`,
  `Can I + verbo`, `actually`) más `battery`, `receipt`, `plug`, «I can't find…» y «How much is it?».
- Los ejemplos pasan por la revisión del usuario antes de publicarse.
