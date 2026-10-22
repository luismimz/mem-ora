# Cola de mejoras (modo mejora continua)

Cada vuelta toma **una** de aquí, por la prioridad de `CLAUDE.md` (roto → experiencia y Home → contenido DAM → inglés →
lo demás). Lo que se ve por el camino se anota aquí, no se implementa de paso.

## Prioritario (21-oct-2026)

- **[roto → arreglado sin ejecutar, 22-oct]** `private/shots/feed.cjs` (en el Mac, fuera de git) ya desliza con el dedo
  (CDP), entra por «Seguir aprendiendo» (buscaba «aventura», que ya no existe) y sabe pasar Escucha, Construye la frase y
  Ráfaga. Falta ejecutarlo con la app y el Directus locales arrancados (`private/release.sh`).
- ✓ **Prueba del gesto en el repositorio:** `apps/web/e2e/*-touch.mjs` (Flujo, Inicio y simulacro, con toques reales).
- **[experiencia] Revisión de la Home en el móvil:** qué ve el alumno al entrar, qué hace después y si se entiende.
- **[experiencia] Audio:** confirmar en el iPhone del usuario que la voz suena; después, Kokoro pregenerado.
- **[contenido] Exámenes de práctica y PAC de ILERNA** tal cual, en una misión privada del usuario (regla 13), y
  **preguntas nuevas con su mismo patrón** por módulo del semestre (Programación, Bases de datos, Acceso a datos,
  Interfaces, SGE…). Necesita que el usuario deje los PDF en `private/`.
- **[contenido] Explicaciones más claras** en las fichas DAM, ampliadas con fuentes abiertas redactadas con palabras
  propias y con su fuente (regla 11).
- **[inglés] Calidad de las asociaciones e historias:** el usuario las ve malas. Revisar con él ejemplos concretos
  antes de reescribir en masa; una asociación mala es peor que ninguna.

- **[inglés] Espejos pendientes:** `many` (have got), `jump` y `stand` (una sola pieza); `thirteen`/`fifteen` (sin valor).
- **[inglés] Más vocabulario hasta 1.000** (meta de 30 días). Hecho: misiones 18–21 (ciudad + there is, pasado + irregulares,
  viajes + going to, trabajo + comparativos): 315 palabras. Siguiente: tiempo atmosférico, ropa, emociones, adjetivos,
  días y meses, animales, compras, salud, frases para conversar.
- **[inglés] Arrastre tipo imán** para las piezas de Lego (hoy, botones).

## Ideas de benrios.dev/tests (22-oct-2026, revisadas con el usuario)

Ideas, no un cambio de formato: su base es el test de 4 opciones (reconocimiento, pesa poco en Memora).

1. ✓ (PR #12) **[experiencia] Mapa de misiones con 4 estados** en la Home: superada, en curso, «conviene repasar» (el motor sabe
   qué se olvida) y sin empezar. Que se vea el avance y lo que se apaga.
2. ✓ (PR #12) **[experiencia] Contador de fallos que se vacía** («Vacía tus N fallos»): un fallo sale al acertarlo después.
3. ✓ (PR #13) **[contenido] «Reportar un error»** en la ficha o la pregunta: un toque y va a la cola de revisión de Studio.
4. ✓ (como «No estoy seguro», antes de responder) **[núcleo] «Acerté, pero dudé»:** toque opcional al acertar; el acierto cuenta como poco seguro (regla 9).
5. ✓ **[experiencia] Calendario de actividad** (días estudiados) y **logros honestos** (por memoria real, no por
   respuestas correctas).
6. **[inglés] Inglés técnico/profesional** del módulo DAM. Hecho: misión 17 (informática) y misión 22 (correos formales,
   CV, pasiva).
7. ✓ (PR del simulacro; falta: preguntas de los exámenes de ILERNA cuando estén en `private/`) **[DAM] Simulacro de examen:** 30 preguntas de todos los temas, 60 min, sin ayudas hasta el final, se aprueba con
   7, mejor nota. Solo mide: nunca marca «dominado». Con los exámenes de práctica de ILERNA cuando estén en `private/`.
8. **[DAM] Código comprobado:** compilar el código de las preguntas DAM en la puerta (`private/dam/taught.py`).

No se cogen: elegir nº de preguntas o reloj antes de empezar (fricción), atajos de teclado (el usuario usa iPhone),
rangos por respuestas correctas (inflan).

## Ideas anteriores (de la etapa por hitos)

- **Arcade respeta las compuertas de nivel** (H3): el selector del Arcade no debe sacar habilidades «aprendidas»
  antes de 7 días ni «estables» antes de 30 días desde su última exposición. Si lo hiciera, la exposición reiniciaría
  el plazo y la habilidad nunca podría demostrar el nivel siguiente (D-018). Aplica a cualquier modo libre.

- **Nivel por unidad** (`ESPECIFICACION.md` §4): derivar «aprendida / estable / dominada» de una palabra o concepto
  combinando sus habilidades (recuperar, escuchar, producir) y sus formatos. Pendiente de decisión (D-018).
- **Lo dominado sale de la cola diaria** y solo vuelve en tests de retención (30 y 90 días), como propone
  `ESPECIFICACION.md` §4. Hoy lo dominado se sigue programando con el calendario normal (+30 d).
- **Repasos que no reinicien el plazo de nivel:** si la compuerta de 7/30 días resulta demasiado espaciada en uso
  real, permitir repasos «de mantenimiento» que no cuenten como exposición (alternativa descartada en D-018).
- **Estrategia de prioridad con muchos vencidos** (H6): hoy se repasa primero lo más retrasado, que es también lo
  más probablemente olvidado. Comparar con «lo más próximo a olvidarse pero aún recuperable».
- **Evaluar FSRS** cuando haya historiales reales (detrás de la interfaz `Scheduler`).
- **Umbral de «dudado» por formato** (escribir código lleva más que elegir una opción).
- **Revisión de asociaciones en la experiencia** (H2/H4): mientras una asociación está en revisión, ¿se sigue
  mostrando, se oculta o se ofrece la vía alternativa (otra técnica)?
- **Medición de retención por ventanas** de la V1 (`shared/retention.mjs`: +1 h, +24 h, +7 d, +30 d por asociación)
  para el panel de calidad de técnicas (H6/H8).
- **Zona horaria por alumno** en `dayOriginMs` (H2).
- **Botones de transición en el panel** (H2.2a o H8): hoy el estado es un desplegable con todos los valores y el
  servidor rechaza los no permitidos. Mejor mostrar solo «Enviar a revisión», «Aprobar», «Publicar»… según el rol.
- **Lista de comprobación del revisor** por técnica (`reviewChecklist`, p. ej. «el puente es una palabra real») visible
  en el panel al aprobar una asociación.
- **Editar lo publicado sin despublicar** con versiones de contenido de Directus (H8).
- **Despliegue con Directus 12 (H2.4):**
  - `IP_TRUST_PROXY=true` detrás del proxy de Coolify (el valor por defecto pasó a `false`);
  - `PUBLIC_URL` completa (`https://studio.luismontalvan.com`), obligatoria con licencia;
  - comprobación de vida con `/server/ping` (`/server/health` exige autenticación);
  - la imagen no trae `npx`: nada de comandos `npx directus` en el despliegue; el esquema se aplica por la API;
  - la licencia se revalida en línea (`offline_enabled: false`): el servidor necesita salida a Internet hacia el
    servicio de licencias de Directus;
  - confirmar cuántas activaciones admite la licencia antes de usarla en local y en producción a la vez.
- **Pasar a Directus 12.5.x** cuando lleve unas semanas publicada. Revisar antes las validaciones estrictas de
  `ip_access` y el nuevo cálculo del 2FA por políticas efectivas.
- **Alerta de licencia (H2.4, obligatoria antes de abrir a la familia):** vigilar `GET /license` (estado,
  `invalid_reason`, `token_expires_at`) y avisar al administrador si la revalidación falla. Según Directus: si la
  instancia no llega al servidor de licencias durante más de 7 días, baja a Core; tras el periodo de gracia de 30 días
  de una licencia caducada, **los alumnos no pueden iniciar sesión**; y si la clave va en el entorno y el servidor de
  licencias no responde al arrancar, **Directus no arranca**. La alerta debe llegar por un canal que no dependa de
  Directus (correo o notificación).
- **Higiene de activaciones (desde ya):** cada licencia tiene 5 activaciones, y cada una se ata a la base de datos y a
  la `PUBLIC_URL`. Destruir la base (`docker compose down -v`) sin desactivar deja la activación ocupada. Las pruebas
  de reconstrucción desde la instantánea deben hacerse en una instancia aparte **sin licencia**, y las de permisos en
  el entorno persistente.
- **Prueba de recorrido en el navegador** (H2.2b): automatizarla con Playwright, junto con el modo sin conexión. En el
  H2.2a el recorrido se prueba por la API con el mismo motor que la app, pero la interfaz no se ha visto con pruebas
  automáticas.
- **Recálculo incremental** del estado del alumno: hoy se recalcula con todos sus eventos en cada envío. Basta para el
  H2; con muchos eventos convendrá partir de la última instantánea.
- **Experiencia «aplicar»** (caso o minidiálogo) para que los patrones vuelvan a tener esa habilidad (H7).

## Materias que no son idiomas (siguientes pasos tras D-042)
- ~~Ejercicios de concepto~~ hecho en D-043.
- Tipos `procedure` (pasos ordenados: subredes) y `comparison` (TCP frente a UDP), si los conceptos no bastan.
- Prerrequisitos en el archivo de curso JSON (`requires: ["class"]`).
- Hueco de la espiral configurable por curso: Gramática en idiomas, mini-reto de código en Java, caso en redes (recetas, H4).
- Importar contenido sensible con revisor, fecha de verificación y aviso (regla 13).
- Corrección sensible a mayúsculas en retos de «predecir la salida»: hoy `sameAnswer` ignora mayúsculas, así que «HOLA»
  pasaría por «hola». Opción: campo `caseSensitive` en el ejercicio (detectado al generar la misión 18 de DAM).
- Compartir cursos con usuarios concretos (D-055): visibilidad «todos / solo yo / estos usuarios», gestionada desde
  Studio con una lista de alumnos por curso.
