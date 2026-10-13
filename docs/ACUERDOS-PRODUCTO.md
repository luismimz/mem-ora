# Memora: acuerdos de producto y experiencia

> Documento de referencia. Recoge lo acordado con Luis desde el inicio del proyecto. Lo marcado **[confirmar]** es una interpretación que Luis debe validar. Si algo contradice a `CLAUDE.md` o `DOMINIO.md` en arquitectura, mandan estos; si algo contradice a este documento en producto o experiencia, manda este documento.

## Principios rectores (mandan sobre todo lo demás)

1. **Enseñar primero, pedir después.** El usuario nunca hace algo que no se le ha enseñado antes. Ningún ejercicio pide una palabra, una regla o un patrón que no haya aparecido ya en una tarjeta de enseñanza.
2. **Las asociaciones absurdas son el centro de Memora.** Junto a la **curva del olvido** (repaso espaciado) forman el método. El **espejo gramatical es un truco** que acompaña, no el eje.
3. **El vocabulario va primero; la gramática en espiral.** Sin vocabulario no se puede avanzar. Se da un poco de gramática y se va añadiendo; vuelve más veces y sube de nivel con el vocabulario que ya se tiene. Proporción: mucho vocabulario con asociación, gramática en menor medida.
4. **El Arcade divierte y sella.** Sirve para consolidar lo retenido y **localizar lo que no** se ha retenido (lo fallado vuelve al circuito de repaso). No enseña contenido nuevo.
5. **Debe ser una experiencia única**: de la calidad y la sensación del vídeo de referencia que Luis ha compartido (https://www.youtube.com/watch?v=AUZT63c8avw). Ideas adoptadas en la sección 3b. **[confirmar: Luis ha escuchado el tramo desde 23:26 y está de acuerdo]**

## Decisiones del 14-oct-2026 (mandan sobre lo anterior de este documento)

- **Sesión de asociaciones = 15 palabras nuevas.** Meta: unas **1.000 palabras aprendidas al mes** (≈ 33/día ⇒ 2–3 sesiones diarias). Se cuentan como aprendidas solo las recuperadas sin ayuda en un repaso diferido, no las vistas.
- **Asociaciones inverosímiles y absurdas primero**, con la calidad de V2 y mejorada: el alumno debe **recordar la historia** (reconstrucción de la escena y asociación inversa palabra → escena), no solo la palabra.
- **Gramática dentro de la asociación**: tras las 15 palabras, poca gramática con trucos (Espejo) usando solo esas palabras; si falla, se repite con otra frase. Crece en espiral con el vocabulario.
- **Arcade = juego divertido** con más asociaciones y asociaciones inversas (como V1); solo lo enseñado; lo fallado vuelve al repaso.
- **Chat** se desbloquea con al menos 3 sesiones de gramática.
- **Cuatro modos separados pero unidos**: Asociaciones, Gramática, Arcade y Chat se eligen por separado desde el inicio, y comparten el mismo progreso (un único estado del alumno).

## 0. Cómo se trabaja (proceso)

- Memora V3 se construye **desde cero** en `mem-ora`. El repositorio antiguo (V1/V2) es **solo lectura y referencia**. **Nada de parches** sobre lo anterior: se rehace mejor.
- V2 es la referencia de **diseño y de flujo**; hay que **mejorarla mucho**, no copiarla. El prototipo en HTML creado en el chat **no** es referencia.
- Un hito cada vez, con prueba humana de Luis antes de pasar al siguiente. Commits con el usuario de Luis, sin firmas de IA.
- Antes de implementar una pantalla: bocetos aprobados. Al implementarla: capturas de Playwright vistas por quien la hizo.

## 1. Qué es Memora

Una PWA para aprender cualquier materia y **retener a largo plazo**. Empieza por inglés para hispanohablantes. Sirve para idiomas, programación, ciberseguridad, medicina, etc., con contenido añadido desde un administrador sin tocar código. Primero para Luis y su familia; después, para miles de personas, sin prometer más de lo que el método demuestre.

## 2. Método (núcleo de Memora)

1. **Palabra puente + escena absurda.** Una palabra española real y familiar que _suena_ como la inglesa (KIWI→KEY, LOCO→LOCK, PAQUETE→POCKET), con evidencia documentada. Escena breve (máx. 14 palabras), con acción física y la pieza clave resaltada. La **imagen es estable**: la misma en todos los encuentros.
2. **Español Espejo (gramática).** Se ve primero la equivalencia con el español: se restituye el sujeto que se omite y se mantiene el auxiliar (Estoy buscando → YO estoy busc-ando → I'm look-ing for). En la pantalla "Descubre el truco" las piezas llevan color: sujeto, raíz y terminación. Debe ser divertido y sin lenguaje de "engaño".
3. **Recuperar, no releer.** La mnemotecnia es un andamio; la meta es la recuperación directa, sin escena.
4. **Sensación de juego tipo Duolingo**, ligada al aprendizaje real.

## 3. Recorrido de una palabra nueva (base: flujo de V2)

1. **Tarjeta de asociación**: palabra grande, significado, IPA, audio, pronunciación figurada, escena ilustrada, cadena puente (KIWI → KEY → LLAVE), "Suena a KIWI" y la escena escrita. **Todo junto; nunca un sonido sin significado.**
2. **Recuperación fácil** con la escena oculta: elegir entre opciones (o completar con fichas). **Nunca teclear en la primera exposición.**
3. **Resultado** breve ("¡Conexión hecha!", XP, combo).
4. La misma **escena en inglés** con audio; frase natural con audio.
5. **"Descubre el truco"** si hay patrón gramatical (Espejo con colores).
6. **Construir la frase por piezas** (Estoy→I'm, buscando→looking for…).
7. **Conversación** corta con un personaje (Emma) con situación, pista escrita, escuchar modelo, hablar y ver respuesta.
8. Se programa el repaso. Teclear la palabra llega en los repasos, con pistas.

- **Fuera del recorrido normal: "crear una frase propia".** Producir se practica traduciendo la frase de ejemplo en repasos (con alternativas aceptadas).
- **Muchas palabras con mnemotecnia.** Misión de 4–5 palabras (como V2) y dos o tres misiones forman una habitación de 10. **[confirmar ritmo]**
- **Mochila de palabras**: tocar (o mantener pulsada, en ejercicios de fichas) cualquier palabra inglesa desconocida abre una tarjeta con significado y pronunciación, con "Ya la entiendo" / "Quiero aprenderla". Las guardadas pasan por su propio minicircuito (imagen, asociación solo si ayuda, repaso). Aplica en toda la app.
- **Navegación**: en móvil, los pasos son tarjetas que se **deslizan** (slide) con botones visibles de apoyo; en PC la tarjeta va **centrada**. **[confirmar: interpretación de «todo en movimiento slide»]**
- **Modo revisión** (selector de fase, "no guarda progreso"): **solo para administración y autoría**, nunca en la app del alumno.

### 3b. Retirada progresiva de apoyos (ejemplo del kiwi)

Idea tomada de la demostración del vídeo de referencia (el alumno imagina, reconstruye con preguntas y recupera sin ayuda). Encaja con el recorrido de arriba; solo añade lo marcado como nuevo.

1. **Vivir la asociación**: el kiwi se traga una llave y sale rodando; se oye KEY con claridad y se ve la relación KIWI→KEY.
2. **Reconstruir la escena** con la palabra oculta: «¿Qué se llevó el kiwi?». Si necesita ayuda, se ofrece primero imagen, luego puente, luego audio. _(Nuevo: pregunta de reconstrucción de la escena.)_
3. **Recordar fuera de la historia**: más adelante aparece una llave en otra situación, sin depender del kiwi ni del orden de las escenas (E3).
4. **Estructura preparada**: LOOK FOR se aprende como bloque completo y se prepara «I'm looking for my keys»; la explicación se limita a las piezas que aún no conoce. _(Nuevo: bloques completos.)_
5. **Hablar con Emma**: responde, recibe una **corrección concreta** y puede **reintentarlo**; luego reutiliza lo aprendido («I'm looking for my phone»). _(Nuevo: corrección concreta + reintento.)_
6. **Recuperarlo otro día** en una situación diferente (E4/E5).

- **«Mi evolución»** conserva la conversación y distingue lo conseguido **con ayuda** de lo producido **de forma autónoma**.
- **Interfaz**: una acción clara cada vez, cambios de actividad con sentido y una continuación fácil de encontrar. El reto está en recordar y comunicarse; navegar debe ser sencillo. Objetivos pequeños y comparación con el propio progreso, no con otros.
- **Honestidad sobre la evidencia**: la recuperación activa y la práctica espaciada tienen respaldo amplio; las asociaciones **tienen que demostrar** en Memora que ayudan a recordar y usar el contenido más tarde (de ahí el A/B).

## 4. Retención

- **Escalera de encuentros E0–E5**: E0 primera exposición; E1 final de sesión (solo imagen, imagen→palabra y palabra→escena); E2 +1 día (solo situación); E3 +3 días (palabra en frase nueva, sin imagen); E4 +7 días; E5 +14/+30 días (recuperación directa). La imagen se desvanece con los encuentros. Dirección doble: palabra→escena y escena→palabra.
- **Pistas P0–P5** (el núcleo las usa; la especificación original define 7 niveles: situación, primera letra y nº de letras, pronunciación figurada, palabra puente, escena, frase en inglés, audio lento). Se registra la pista mínima necesaria.
- Fallo: sube un peldaño de pista, no se repite igual; tras dos fallos se revisa la asociación.
- **Anti-bucle**: nunca el mismo formato dos veces seguidas; entrelazado; "sanguijuelas" (≥4 fallos → regenerar mnemotecnia y cambiar formato); tope diario; contextos nuevos.
- **Estados honestos**: aprendida (éxito diferido corto), estable (sin pista tras ≥7 días), dominada (sin pista tras ≥30 días + 3 formatos y 2 contextos). Presentar no cuenta. Meta de 1.000 = palabras desconocidas con recuperación demostrada, no presentadas.
- Experimento A/B (escalera de asociación vs solo traducción) para medir si la asociación dura.

## 5. Capa de juego

- Un único nodo activo en el camino del día; barra de progreso siempre visible; respuesta inmediata con animación, sonido y vibración suaves.
- XP solo por recuperación sin ayuda; combos; cofres al completar habitaciones; racha con días de gracia **sin castigos** (el fallo da misión de rescate).
- **Museo de historias**: rompecabezas de la escena, cuadro que se desvanece con el olvido, álbum por habitaciones.
- **Arcade** (ráfagas rápidas solo con lo ya enseñado; sirve para divertir, sellar lo retenido y localizar lo que no; lo fallado vuelve al repaso), **Mi evolución**, "Tú eliges" (seguir la historia o ronda Arcade). Inicio con un héroe claro y las palabras de la misión con su puente.
- La **IA nunca interviene dentro de la lección.**

## 6. Voz, audio y modos de uso

- **Kokoro** como voz principal, más lenta y que lea bien: normalizador de texto, léxico de pronunciación por idioma, audio normal y lento, caché por huella, **primer sonido < 300 ms** desde caché, generación al aprobar (nunca en vivo).
- **Modo manos libres** (caminar, correr): un único audio continuo pregenerado con Media Session, porque iOS suspende el JavaScript con pantalla bloqueada. Luis usa **Brave en iPhone**: probar en su móvil. Audiolibro gratuito como extra.
- **Anki**: importar mazos con dos opciones: usarlos tal cual o usarlos para generar historias propias.
- **Uso sin conexión (decidido)**: el cliente ejecuta el núcleo en local; descarga la sesión de hoy y mañana con audio e imágenes; cola local de eventos idempotentes; el servidor recalcula y manda. Probar en modo avión en iPhone con la PWA instalada.

## 7. Medios e IA

- **Estado actual: imágenes con emoji provisional.** fal todavía no se usa en V3, para no gastar mientras se rehace la experiencia. El diseño debe tener un hueco de ilustración que funcione igual con emoji o con imagen, para que el cambio no obligue a rehacer pantallas. Sin imagen, marco neutro.
- **Imágenes con fal** (FLUX.1 schnell), **cuando se apruebe el diseño**: cola con tope diario (10 imágenes/día) y mensual (2 €/mes), prompts y procedencia guardados, **estilo consistente** (paleta, trazo plano, personaje recurrente), cada imagen **se aprueba aparte**. Probar el estilo con 5 imágenes antes de generar más.
- Los emojis valen para probar la sensación de la app, pero **no** para juzgar si la asociación ayuda a recordar: eso se mide con las imágenes reales.
- **OpenRouter**: tope 5 €/mes global y 1 €/mes por usuario; solo para **borradores desde el administrador**, siempre con fuente y revisión humana; excluir proveedores que entrenen con los datos. Recarga automática desactivada.
- Midjourney y Suno no se integran (no hay API oficial).
- Secretos solo en variables de entorno; nunca en el chat ni en git.

## 8. Plataforma universal y Studio

- Núcleo agnóstico de materia (`packages/core`); contenido en base de datos; tipos de conocimiento (término, patrón, concepto, comando, código, procedimiento, hecho, caso…); técnicas como módulos.
- **Studio** (Directus 12, con licencia): roles administrador/autor/revisor/alumno, estados borrador→revisión→aprobado→publicado, validación por tipo con mensajes claros, historial, vista previa como alumno.
- **Tema visual por curso** (colores, personaje, lugar) como datos.
- Contenido sensible (medicina, ciberseguridad): solo lo publica un revisor competente.

## 9. Contenido y derechos

- Puente real con evidencia; frase de 5–12 palabras con acción física; revisión humana (un modelo nunca cuenta como revisor); rechazadas en cuarentena; imágenes solo tras aprobar el texto.
- Los ejemplos y fichas de `METODO-ESPEJO.md` y `BANCO-EJEMPLOS.md` son **borrador sin revisar**.
- Material de ILERNA (libros comprados, uso personal): **curso privado, visible solo para la cuenta de Luis**, fuera de git. Licencia propia: privada.
- Registro por invitación (familia). Sin alumnos reales aparte de Luis y su familia.

## 10. Infraestructura

- Hetzner CX33 con Coolify. App en `memora.luismontalvan.com`, Directus en `studio.luismontalvan.com` (un solo nivel, por Cloudflare). La V2 (`ingles.luismontalvan.com`) sigue intacta.
- Directus 12.4.1 fijado; telemetría obligatoria aceptada; vigilar activaciones y revalidación de la licencia. Docker Desktop en local.
- Copias de seguridad antes de cualquier cambio de esquema y antes del H2.4; script de exportación a JSON independiente de Directus.

## 11. Pendiente de decidir

- Ritmo dentro de las 15 palabras (escenas de 3 como V2 o misiones de 5) [confirmar].
- Interpretación del movimiento «slide» en móvil.
- Cuándo se activa fal y con qué guía de estilo (tras aprobar el diseño y probar 5 imágenes).
- Modo manos libres, Anki y museo de historias: después de cerrar H2 (congelados).
