# Visión de Memora

> Borrador a partir de lo definido en las conversaciones de diseño. Luis lo revisa y corrige; si algo contradice su documento maestro original, manda el original.

## Qué es

Memora es una app (PWA) para aprender cualquier materia y **retener lo aprendido a largo plazo**. Empieza por inglés para hispanohablantes, pero el núcleo no sabe de qué materia es: inglés, francés, italiano, Java, PHP, ciberseguridad, medicina, etc. El contenido se añade desde un administrador, sin tocar código.

## El problema que resuelve

Las apps de idiomas y de estudio enseñan algo una vez y se olvida. En la versión anterior, la asociación mnemotécnica ocurría **una sola vez** y no se recuperaba después. Memora existe para que **la asociación se quede**: que lo aprendido se recupere días y semanas después, sin ayuda.

## Para quién

Primero, Luis. Después, miles de personas. Sin prometer más de lo que el método demuestre: nada de "aprende en X días" que no se pueda comprobar.

## Qué lo hace distinto de estudiar de forma tradicional

1. **Equivalencia primero.** Un hispanohablante traduce antes de hablar. Memora le muestra primero la equivalencia con su lengua (método Español Espejo) y no una regla abstracta.
2. **Asociación memorable** (puente fonético / escena absurda) cuando de verdad ayuda; nunca forzada.
3. **Recuperación espaciada** con escalera de pistas: se recuerda sin ver la respuesta, a +1 h, +1 d, +3 d, +7 d, +14/30 d.
4. **Juego de verdad**, no solo puntos: Arcade, rachas, rescates de errores, sensación de avance.

## Las tres piezas

1. **Motor pedagógico.** Sabe qué conoce el alumno, qué debe aprender y qué está olvidando. Mapa de conocimiento, prerrequisitos, repaso espaciado, pesos de evidencia (reconocer pesa menos que producir).
2. **Motor de experiencias.** Historias, Arcade, gramática, conversaciones. Consume el motor pedagógico y no decide por su cuenta qué está aprendido.
3. **Memora Studio.** Administrador para crear cursos y contenido sin código: roles (administrador, autor, revisor), estados (borrador, en revisión, aprobado, publicado), vista previa como alumno, importación (JSON, CSV, Anki).

## Método Español Espejo (gramática de inglés)

Se restituye el sujeto que el español omite y se mantiene el auxiliar que ya existe, cambiando terminaciones por piezas inglesas:

- Estoy jugando → YO estoy jug-ando → **I am play-ing**.
- ¿Jugaste ayer? → ¿TÚ jugaste ayer? → **Did you play yesterday?**
  Cada ejemplo se verifica antes de publicarse; la asociación absurda se añade encima.

## Experiencia del alumno

- Una única actividad siguiente; sesiones de 3 a 7 minutos (15–20 en la ruta completa).
- Pulsar cualquier palabra desconocida para ver significado y añadirla a la "mochila".
- Modo manos libres (caminar, correr): un audio continuo pregenerado, no depende de que el navegador siga ejecutando JavaScript con la pantalla bloqueada.
- Recompensas ligadas al aprendizaje real, no a pulsar "siguiente".

## Estados honestos del aprendizaje

Una palabra es **aprendida**, **estable** o **dominada** solo cuando lo demuestran pruebas diferidas. Presentarla no cuenta.

## Principios

- El núcleo es universal; lo específico de cada materia vive en técnicas y contenido.
- El contenido tiene fuente, licencia y revisión humana. La IA propone borradores fuera de la lección y nunca publica.
- Contenido sensible (medicina, ciberseguridad) solo lo publica un revisor competente.
- Nada con derechos de autor de terceros sin permiso.
- El progreso del alumno vive en su cuenta (servidor), no solo en el navegador.

## Qué NO es (por ahora)

Un curso milagro, un sustituto de un profesional en materias sensibles, ni una app que enseñe 100 palabras al día sin comprobar que se retienen.

## Orden de trabajo

1. Terminar inglés bien (núcleo + una habitación de 10 palabras cargada desde el administrador).
2. Demostrar que sirve para otra materia (Java o un módulo del DAM) sin cambiar el núcleo.
3. Después, debatir ciberseguridad, IA, medicina y más idiomas.
