> Especificación inicial, escrita antes de la versión universal. Si algo contradice CLAUDE.md o docs/DOMINIO.md, mandan esos. Usarla como referencia del curso de inglés, no del núcleo.

# MEMORA — Especificación para Claude Code

## 0. Instrucciones para Claude Code

- **Prioridad máxima: secciones 24–26** (persistencia de la asociación y misión vertical). Las secciones 16–19 (manos libres, extras, Anki) y los hitos H11–H15 quedan **congelados** hasta cerrar H2.
- Primero **inspecciona el repositorio existente** (app desplegada en ingles.luismontalvan.com). Reutiliza stack, componentes y el TTS actual (Kokoro). No reescribas lo que ya funciona.
- Trabaja por **hitos** (sección 11). No avances al siguiente hasta que se cumplan los criterios de aceptación del actual.
- Entrega **bloques de código completos**, no diffs.
- Si falta una decisión (stack, base de datos, generación de imágenes), propón una opción y justifícala en 3 líneas antes de implementar.
- Contenido (palabras, escenas, imágenes, audio) **pregenerado y cacheado**, nunca generado en vivo durante una sesión.

## 1. Objetivo del producto

Ayudar a un hispanohablante (nivel A2–B1) a **retener vocabulario inglés a largo plazo** y a usarlo para hablar, con una experiencia que enganche como un juego.

Principio rector: **todo ejercicio es recuperación activa**. Nada pasivo. El engagement se gana con aprendizaje real, no con pulsar "siguiente".

## 2. Principios de diseño

1. Una palabra = imagen absurda breve + misma escena en inglés + frase real + producción + reaparición posterior.
2. **Audio antes que texto**: se oye la palabra antes de verla escrita.
3. La mnemotecnia es el origen de todo; no se crea una mala solo por tenerla (concretas → imagen; cognados → relación directa; phrasal verbs → escena de la acción; chunks → situación).
4. Ayuda progresiva y registrada: se anota cuánta pista necesitó el usuario.
5. **Anti-bucle**: ver sección 7.
6. Sesiones divididas en bloques cortos (3–7 min) dentro de una sesión diaria más larga.
7. Gamificación ligada al aprendizaje (sección 8), sin trucos de manipulación.

## 3. Rutas (selector)

- **Core 30 días** (por defecto): vocabulario por frecuencia + sector, listening/shadowing, gramática mínima útil (presente, pasado, futuro, condicional básico), conversación final.
- **Temario ILERNA**: Present/Past/Comparatives & Superlatives · Future · Modals & Intensifiers · Conditionals · Connectors & Prepositions · Relative clauses · Question tags & Passive · Reported speech · Culture.
- **Rutas transversales**: Leer · Escribir · Hablar (combinables con cualquier tema).
- Cada ruta/tema empieza con un **test de colocación de 5 preguntas**; si lo domina, se salta.
- **Sector** seleccionable (p. ej. desarrollo de software) para priorizar vocabulario relevante.
- Gramática: patrón + escena + producción propia + reescritura obligatoria al fallar. Mnemotecnia solo para conectores raros, preposiciones y verbos irregulares.

## 4. Ciclo de vida de una palabra

Estados: `nueva → vista → recuperada → reconocida_audio → usada_en_frase → repasada → dominada`

**Tres niveles públicos** (el contador de las 1.000 palabras los muestra por separado, para no inflarse):

- **Aprendida**: recuperada sin ayuda, reconocida al oírla y usada en una frase propia.
- **Estable**: supera los repasos a +7 y +14 días.
- **Dominada**: supera un test diferido de ≥30 días. Una palabra vista cerca del día 30 no puede estar dominada todavía; se marca como aprendida o estable.

Una palabra cuenta como **dominada** solo cuando:

1. Se recuperó sin pistas en ≥3 sesiones espaciadas.
2. Se resolvió en ≥3 formatos distintos (recuperar, audio, producir).
3. Se usó en una frase propia en ≥2 contextos diferentes.
4. Superó un test diferido (≥30 días) sin haberla repasado ese día.

Las palabras dominadas **salen de la cola diaria** y solo vuelven en tests de retención espaciados (30 y 90 días).

## 5. Recorrido de una palabra (primera exposición)

1. Sonido + significado + IPA (TTS automático).
2. Asociación breve en español con imagen (palabra puente sonora + acción del significado + sin detalles que distraigan).
3. Recuperación inmediata (la escena desaparece; completar hueco).
4. Misma escena en inglés (audio).
5. Frase natural + audio repetible.
6. Estructura visible (`Can I + borrow + objeto + for + tiempo?`).
7. Recuperación activa con **palabras clave**: el usuario escribe 2–3 palabras clave de la escena y luego reconstruye la historia con sus palabras (solo en palabras difíciles; en las demás se omite para no alargar el recorrido).
8. Ordenar frase (con fichas distractoras), transformar una pieza, crear la propia.
9. Se programa en el calendario de repasos.

**Palabras de nivel fácil**: cognados/transparentes → comprobación de 15 s (sin mnemotecnia). **Normales** → pasos 1, 3, 5, 8. **Difíciles** → recorrido completo. **Primer día**: bloque de cognados (lista de palabras casi iguales al español) como "efecto wow".

Feedback de mnemotecnia por palabra: ✅ Se me queda · 😐 Confusa · 🔊 No se parece · ✨ Crear otra · ✍️ Escribir la mía. Las respuestas ajustan el tipo de asociación que se genera después.

## 6. Repetición espaciada

- Intervalos iniciales: mismo día, +1 día, +3, +7, +14, +30. **Adaptativos**: si falla, el intervalo baja; si acierta sin ayuda, sube.
- Registrar por intento: acierto, pista usada (1–7), tiempo de respuesta, formato.
- Pistas progresivas: 1 situación → 2 primera letra + nº de letras → 3 pronunciación figurada → 4 palabra puente → 5 escena → 6 frase en inglés → 7 audio lento.
- La ayuda desaparece con los encuentros: 1.º asociación completa → 2.º solo imagen → 3.º solo situación → 4.º recuperación directa → 5.º producción en conversación.
- **Carga diaria adaptativa**: si los repasos pendientes superan el tope (configurable, por defecto 120), se reduce el número de palabras nuevas. Unidades nuevas por día: la meta del plan de 30 días son ≈1.000 unidades trabajadas con la distribución de la sección 25 (≈33 al día, de las que solo ~10 reciben entrenamiento profundo de producción). Subir o bajar la carga según la retención a 7 días (≥ 80% sube, < 65% baja). 1.000 es la meta, no una cifra que inflar.
- Medir y mostrar el tiempo real por palabra y por habitación.

## 7. Anti-bucle de repetición (reglas obligatorias)

1. **Nunca el mismo formato dos veces seguidas** para la misma palabra; rotar entre: completar hueco, audio→significado, ordenar, rompecabezas de historia, producción, dictado, conversación.
2. **Entrelazado**: mezclar palabras de habitaciones y días distintos dentro de un mismo bloque de repaso.
3. **Detector de "sanguijuelas"**: si una palabra falla ≥4 veces, deja de repetirse igual; se **regenera la mnemotecnia** (o se pide al usuario la suya) y se cambia el formato. Más repetición idéntica está prohibida.
4. **Graduación**: palabras dominadas salen de la cola (sección 4).
5. **Tope diario** de repasos con prioridad por menor fuerza de recuerdo.
6. **Contextos nuevos**: cada reaparición usa una frase, una escena o una conversación distinta.
7. Opción "ya la sé": el usuario puede marcar una palabra como conocida; se verifica con una prueba rápida antes de retirarla.

## 8. Capa de juego (engagement ligado a aprender)

- **Un único nodo activo** en el mapa del día (camino de nodos: Repaso → Habitación 1 → Historia → Listening → Habitación 2 → Conversación → Misión final → Cofre).
- **Barra de progreso** siempre visible; respuesta inmediata con animación, sonido y vibración suaves.
- **XP solo por recuperación sin ayuda o producción propia**; pulsar "siguiente" no da XP.
- **Combos** por aciertos sin ayuda consecutivos.
- **Cofres** al completar habitaciones; **sorpresas** (clip real, imagen, personaje recurrente).
- **Racha diaria con "congelación"** (días de gracia) y **sin castigos**: fallar produce una misión de rescate con recompensa.
- **Mochila de palabras**: toque largo en cualquier palabra → significado en una tarjeta → "Ya la entiendo" / "Quiero aprenderla" (se añade a la mochila y pasa por su minicircuito). Al terminar la habitación hay misión extra de 1–2 min con las palabras descubiertas.
- **Misiones finales** que conectan las palabras del día en una situación real.
- **Desafíos con amigos/familia** (opcional, fase posterior).
- **Fecha objetivo** visible (el usuario elige un día de compromiso: viaje, charla, entrevista).
- Guardarraíles: sin notificaciones culpabilizadoras, sin cuenta atrás de pérdida artificial, límite de sesión sugerido, y opción de silenciar sonidos/vibración.

## 9. "Museo de historias" (memoria visual a largo plazo)

Cada palabra guarda su escena como una **obra** en una galería personal.

**9.1 Rompecabezas de la escena**: la imagen de la historia se divide en piezas (4–9). Cada pieza se desbloquea recuperando la palabra o un dato de la escena. Variantes:

- Completar el puzzle arrastrando piezas tras recordar la palabra de cada una.
- **Ordenar viñetas**: reconstruir la secuencia de 3–4 viñetas de la historia (burro pide el móvil → llama a su madre).
- **Pieza que falta**: una parte de la imagen está vacía; el usuario escribe qué falta (la palabra o el objeto).
- **Recuento de la historia**: ver solo la palabra clave y contar la escena en 1–2 frases (texto o voz).

**9.2 Cuadro que se desvanece**: cada obra tiene un indicador de "fuerza" basado en el calendario de repaso. Con el tiempo se difumina; un repaso exitoso la restaura. Esto convierte el repaso en un juego de "restaurar la galería" y se alimenta del SRS (no es un calendario aparte).

**9.3 Álbum por habitaciones**: cada habitación completa genera una "sala" con sus 10 escenas. Estados: pieza incompleta → completa → enmarcada (dominada).

**9.4 Reglas**: el puzzle es una variante más de recuperación (sección 7, rotación de formatos), no un ejercicio fijo. Un puzzle resuelto sin recuperar la palabra no cuenta como aprendizaje.

## 10. Contenido y datos

- **Lista base por frecuencia** (fuente abierta de frecuencia, revisar licencia) + filtro por sector. Objetivo: 1.000 palabras _que el usuario no sabía_, no 1.000 palabras.
- 30 días · 4 habitaciones/día · ~5 escenas/día · ≥150 escenas con variantes de situación.
- Clips de vídeo reales solo para palabras muy frecuentes, chunks y phrasal verbs, con fallback a TTS + imagen. No depender de YouTube para la ruta principal.
- Asset pipeline: imagen por escena (prompt guardado), audio TTS cacheado, frase y variantes pregeneradas, revisión de calidad antes de publicar.

Modelo de datos mínimo (adaptar al stack existente):

- `Word`(id, lemma, ipa, translation, frequency_rank, type, sector_tags)
- `Scene`(id, word_id, mnemonic_es, scene_en, bridge_word, image_url, audio_url, quality_scores{sound, meaning, visual, distraction})
- `UserWord`(user_id, word_id, state, strength, next_review_at, lapses, hint_level_history, mnemonic_feedback)
- `Attempt`(id, user_word_id, format, correct, hint_level, response_ms, context_id, created_at)
- `Route/Topic/Progress`, `Backpack`(user_id, word_id, source_context), `Gallery`(user_id, scene_id, strength)
- `Retention test`(user_id, word_id, interval_days, result)

## 11. Hitos y criterios de aceptación

1. **H1 — Una palabra perfecta (`borrow`)** — definición cerrada. Solo `borrow` (más la tarjeta sencilla de `charger`); las diez palabras y sus audios son H2.
   - Entrada especial y temporal para probar «Una palabra perfecta».
   - `borrow` **se escucha antes de verse**. Velocidad de estudio inicial **0.88**; lenta **0.70** (a calibrar de oído).
   - Escena breve: «Un BURRO te PIDE PRESTADO el móvil para llamar a su madre». Imagen **ya preparada y visible sin esperar** a ninguna generación.
   - La escena desaparece y el usuario **recupera `borrow`**; la misma escena aparece en inglés con audio natural.
   - Estructura `Can I + borrow + objeto + for + tiempo?`; frase con fichas y distractores; transformación (cambiar `charger` por otro objeto); frase personal que no pueda copiar el ejemplo.
   - Recuperación final de la escena sin verla (el paso de contarla es opcional y solo para palabras difíciles).
   - Feedback: «Se me queda», «Confusa», «No se parece», «Crear otra», «Escribir la mía».
   - Tarjeta sencilla al tocar `charger`: significado, audio y «Ya la entiendo».
   - Audios preparados de antemano para `borrow`: palabra normal, palabra lenta, escena inglesa, ejemplo y versión por fragmentos. Botón de repetir siempre disponible.
   - **Medición** del tiempo total y de la latencia de cada audio (petición → primer byte → inicio de reproducción).
   - Final con resultado real: qué recordó, ayuda usada y próximo repaso.
   - Sin modificar todavía el gran esquema de Directus (copia de seguridad antes de tocarlo) y **sin IA en vivo** durante el recorrido.
   - _Aceptación_: 4–6 minutos **medidos**; la voz se entiende bien; el usuario puede repetir la escena sin verla; ningún audio espera a una generación. No empezar H2 hasta comprobar personalmente que `borrow` se recuerda y la experiencia es clara.
2. **H2 — Misión vertical «Día 1 · Necesitas ayuda en el trabajo»** (sección 25): cinco unidades conectadas con asociación, imagen estable y audio ya preparado, escalera de asociación (sección 24), producción guiada, miniconversación y repaso final, todo guardado en la cuenta y reanudable. La habitación de 10 palabras sale después como plantilla de esta misión. _Aceptación_: cerrar la app a mitad y retomar en el mismo punto; todos los intentos (ordenar, frase personal) quedan guardados y actualizan las habilidades de cada unidad; al día siguiente las cinco unidades vuelven como repaso con la escalera de asociación.
3. **H3 — Motor de repaso** (sección 6 y 7) con registro de pistas/tiempo y entrelazado. _Aceptación_: ningún formato repite dos veces seguidas; tope diario respetado; detector de sanguijuelas probado.
4. **H4 — Museo de historias** (sección 9). _Aceptación_: las tres variantes de puzzle activas; indicador de fuerza ligado al SRS.
5. **H5 — Capa de juego** (sección 8) y mapa de un día. _Aceptación_: un único nodo activo; XP solo por recuperación sin ayuda; racha con congelación.
6. **H6 — Ruta Core 30 días** + test de colocación + listening/shadowing. _Aceptación_: un día completo de principio a fin.
7. **H7 — Selector** con rutas ILERNA y transversales (leer/escribir/hablar).
8. **H8 — Medición**: panel de retención a 7/30 días con palabras no repasadas, tiempo por habitación y palabras dominadas. Usa estos datos para recalibrar las palabras nuevas diarias.

## 12. Fuera de alcance por ahora

Multijugador, ranking global, sistema de pagos, generación de imágenes en vivo, vídeos obligatorios para cada palabra, reconocimiento de voz avanzado (empezar con Web Speech API).

## 13. Primera tarea para Claude Code

Lee el repo, resume en 15 líneas qué existe y qué falta respecto a H1, propón el plan de cambios por archivo y espera confirmación antes de modificar nada.

## 14. Voz (Kokoro): velocidad, lectura correcta y carga

Problemas actuales: la voz va muy rápida, a veces no lee bien y la carga puede interrumpir la lección. Antes de implementar, **audita cómo está desplegado Kokoro** (navegador o servidor) y qué voz y parámetros usa.

**14.1 Velocidad**

- Kokoro admite un parámetro `speed` global (1.0 = normal; menos de 1 = más lento). Valores iniciales a **calibrar a oído**: palabra aislada ≈ 0.85–0.9, frase normal ≈ 0.9, «audio lento» ≈ 0.7.
- Selector persistente de velocidad para el usuario (p. ej. 0.7 / 0.85 / 1.0) y botón «más lento» en cada audio, que reproduce la versión lenta pregenerada.
- La velocidad de la voz de estudio es **más lenta** que la del listening de nivel real; en las semanas siguientes se sube gradualmente.

**14.2 Pausas y ritmo**

- Kokoro responde sobre todo a la **puntuación**: usar comas, puntos y guiones para marcar pausas; no depender de etiquetas SSML en el modelo base.
- Generar el audio **por frase o fragmento corto**, no por párrafos largos, e insertar la pausa entre fragmentos (200–400 ms, configurable) desde el reproductor.
- Tres versiones por frase, pregeneradas: normal, lenta y por chunks (para shadowing).

**14.3 Pronunciación correcta**

- **Normalizador de texto antes del TTS**: números, símbolos, abreviaturas, siglas (p. ej. «API» → «A P I») y guiones.
- **Léxico propio** `pronunciations.json` (palabra → IPA). La sintaxis inline `[palabra](/IPA/)` existe en la librería de Kokoro, pero **no se da por válida hasta probarla con la imagen concreta desplegada** (algunos servidores intermedios no la procesan). Orden de trabajo: normalizador → léxico versionado → pruebas auditivas → decidir cómo inyectar las pronunciaciones.
- Proceso: generar el IPA con la librería de fonemas del modelo, revisar a mano las palabras problemáticas (nombres propios, tecnicismos, `charger`, siglas) y versionar el léxico (`lexicon_version`).
- Lista de prueba de ~50 frases con checklist de revisión humana antes de publicar contenido.
- Botón «reportar pronunciación» que guarda palabra, frase y versión para corregir el léxico.

**14.4 Carga y caché**

- Audio **pregenerado al publicar** cada escena; nunca generado en vivo durante la lección.
- Clave de caché = hash de (texto + voz + velocidad + `lexicon_version`). Si cambia el léxico o la velocidad, solo se regenera lo afectado.
- Guardar en formato comprimido (Opus o MP3) con cabeceras de caché HTTP.
- **Precarga** del audio de los siguientes 2–3 pasos mientras el usuario hace el actual.
- **Lección del día disponible sin conexión** (Service Worker / IndexedDB).
- Fallback: si falta un audio en caché, generarlo bajo demanda con indicador de carga y encolarlo para pregeneración.
- Voz principal estadounidense, con 2–3 alternativas para una comparación a ciegas; no mezclar acentos sin avisar.

_Aceptación_: las 10 frases del hito se oyen sin errores de pronunciación a velocidad normal y lenta; el audio empieza en <300 ms desde caché; ningún paso espera a la generación.

## 15. IA vía OpenRouter

**Qué es**: una pasarela con una API compatible con OpenAI y una sola clave para cientos de modelos de distintos proveedores, con enrutado y reintentos automáticos. Hay modelos gratuitos, pero con límites de uso bajos y disponibilidad variable (revisar los límites actuales antes de depender de ellos). Para producción, usar modelos de pago con tope de gasto.

**Primero audita cómo está conectada en esta app**: dónde vive la clave, qué modelo se usa, qué funciones la llaman y qué coste tienen. No asumas nada.

**Roles de la IA en Memora**

1. **Generación de contenido fuera de sesión**: mnemotecnias, frases, variantes y escenas, con salida **JSON validada**; revisión humana antes de publicar.
2. **Valoración de mnemotecnias** en cuatro dimensiones (parecido sonoro, relación con el significado, claridad visual, ausencia de distracciones).
3. **Historias absurdas** para palabras de la mochila (en cola, no bloqueante).
4. **Conversación y feedback de escritura** en sesión, con streaming y límite diario; sigue las reglas del método (conversación real, una corrección ligera cada vez, reescribir antes de avanzar).

**Reglas obligatorias**

- La clave **solo en el backend**; el frontend nunca la ve.
- Modelo **configurable por tarea** (un modelo fuerte para contenido, uno barato y rápido para conversación) desde un fichero de configuración.
- **Tope de gasto** global y límite por usuario y día; registro de coste por llamada.
- Caché por hash de prompt; versionado de prompts; timeouts y reintentos con modelo alternativo.
- Validar siempre el JSON de salida y reintentar si no cumple el esquema.
- Nunca bloquear una lección esperando a la IA.
- No enviar datos personales innecesarios.

## 16. Modo manos libres (caminar, correr)

**Sesión de audio** de 10/20/30 min generada desde la cola del usuario:

- **Recuerdo hablado**: la app dice la pista, pausa 3–5 s para que el usuario responda en voz alta, y revela la respuesta.
- **Shadowing** de frases (versión por chunks de la sección 14).
- **Historias absurdas** contadas en audio para recordar escenas.
- **Listening graduado** y audiolibro (16.2).

**Controles sin mirar**: Media Session API (pantalla bloqueada, auriculares), botones grandes y, como mejora opcional, comandos de voz sencillos («next», «repeat», «slower», «I know it»).

**Honestidad técnica**: en una web app, el audio con pantalla bloqueada y el reconocimiento de voz en segundo plano pueden fallar según el móvil y el navegador (especialmente iOS). La versión base debe funcionar **sin voz**: pausa fija con autoavance. El reconocimiento de voz es una mejora a probar, no un requisito. La solución para el audio con pantalla bloqueada está en la sección 20.

**Qué cuenta como aprendizaje**: lo recordado mentalmente al caminar es autoevaluación («la sabía / no la sabía»). Da XP reducido y **no cuenta como recuperación verificada**: la palabra solo avanza de nivel si luego se recupera en pantalla.

**Seguridad**: avisar de que se mantenga atento al entorno al correr o caminar por la calle; pausar automáticamente si no hay respuesta durante un rato.

**16.2 Audiolibro gratuito**

- Fuente principal: **LibriVox**, grabaciones de voluntarios de libros de **dominio público**, de uso libre. Ojo: son libros antiguos, con acentos variados y a veces lenguaje anticuado; elegir por nivel y duración (cuentos y capítulos cortos primero) y comprobar la licencia del texto y de la grabación de cada título antes de incluirlo.
- Otros contenidos de dominio público o licencia abierta pensados para aprender inglés (p. ej. los de VOA Learning English) solo tras verificar su licencia.
- Reproductor con velocidad (0.8–1.2) y un **botón grande «guardar palabra»** que envía a la mochila la palabra y la frase con su marca de tiempo, para revisarla después en pantalla.
- Texto sincronizado si está disponible; si no, solo audio.

## 17. Extras valorados (solo si los datos de retención los justifican)

- **Algoritmo de repaso**: evaluar **FSRS** (algoritmo abierto que usa Anki, con implementaciones en TypeScript) en lugar de intervalos fijos adaptativos. Es la mejora de mayor impacto de esta lista.
- **Quiz de repaso** (3 min al día): audio→significado, imagen→palabra, frase con hueco y «¿qué pasaba en la escena de X?».
- **Duelo de 60 segundos** contrarreloj con palabras ya estables.
- **Jefe semanal** = test de retención diferido (sección 10) presentado como reto.
- **Importar mazos de Anki** y exportar a CSV: prioridad media; ver sección 19. El valor diferencial de Memora siguen siendo las escenas; Anki aporta el motor de repaso y los mazos ya hechos.
- Más modos no equivalen a más aprendizaje: añadir uno solo si mejora la retención a 7 y 30 días.

## 18. Hitos añadidos

9. **H9 — Pipeline de voz** completo (sección 14) con léxico, caché y precarga.
10. **H10 — Pipeline de contenido con IA** (sección 15) con esquemas JSON, límites de gasto y revisión humana.
11. **H11 — Modo manos libres** (sección 16), primero sin voz y con LibriVox; después comandos de voz.
12. **H12 — Extras** (sección 17), empezando por la evaluación de FSRS.
    Si la voz de H1 sigue siendo mala, **H9 sube de prioridad** y se adelanta a H2.

## 19. Mazos y compatibilidad con Anki

**19.1 Qué hace bien Anki y qué adoptamos**

- **Programador de repaso FSRS** (ver sección 17): adoptar si la evaluación es positiva.
- **Calificación en cuatro niveles** (Otra vez / Difícil / Bien / Fácil): en el circuito de Memora la nota se **deduce** del rendimiento (acierto, pistas usadas, tiempo); en las tarjetas importadas en modo Anki, la elige el usuario.
- **Pasos de aprendizaje dentro de la sesión**: una tarjeta fallada vuelve a aparecer a los pocos minutos, con otro formato.
- **Límites diarios por mazo** (nuevas y repasos), con configuraciones predefinidas.
- **Mazos, submazos y etiquetas.**
- **Sanguijuelas**: tras N fallos se deja de repetir igual; en Memora, la palabra recibe una mnemotecnia nueva (sección 7).
- **Enterrar hermanas**: no mostrar varias tarjetas de la misma palabra el mismo día (ya está en la regla anti-bucle).
- **Estudio personalizado** (mazos filtrados): sesión solo con palabras difíciles, olvidadas, de un mazo o de una etiqueta.
- **Tarjetas de huecos (cloze)**, respuesta escrita y **deshacer**.
- **Estadísticas**: retención real, previsión de repasos de los próximos días y mapa de actividad.
- No copiar la complejidad de configuración de Anki: pocos ajustes y valores por defecto buenos.

**19.2 Mazos en Memora**
Entidad `Deck`: nombre, origen (propio, ruta, importado), etiquetas, límites diarios, modo (`anki` | `historias` | `mixto`) y lista de palabras o tarjetas. Mazos de serie: rutas (Core, temas ILERNA, sector), Mochila, Difíciles y los importados por el usuario.

**19.3 Importación**

- **Formatos**: `.apkg` (un ZIP) y CSV/TXT exportado desde Anki.
- Dentro del `.apkg`: una base de datos SQLite y un fichero `media` (JSON que relaciona nombres numéricos con los nombres reales de imágenes y audios). La base puede llamarse `collection.anki21b` (la más reciente, comprimida con zstd), `collection.anki21` o `collection.anki2`; esta última suele ser un sustituto sin contenido en exportaciones nuevas. Probar en ese orden y descomprimir si hace falta.
- Leer notas (campos separados), tarjetas, tipos de nota (plantillas), mazos y medios.
- **Seguridad**: procesar en el backend como tarea en segundo plano; límite de tamaño; **sanitizar el HTML** (lista de permitidos; eliminar scripts, estilos remotos e iframes); no ejecutar nunca código de las tarjetas; admitir solo imágenes y audio con tipo y tamaño validados.
- **Programación**: por defecto las tarjetas se importan como nuevas (sin historial). Importar el historial de repasos es opcional y posterior.
- **Licencia**: los mazos compartidos tienen licencias distintas. Uso personal y privado por usuario; no republicar.
- **Vista previa** de 10 tarjetas y informe de errores antes de confirmar.

**19.4 Dos modos al importar (elegible por mazo y cambiable después)**

- **Modo A — Tal cual (estilo Anki)**: se muestra la tarjeta con su plantilla ya sanitizada, se da la vuelta, se califica y la programa el repaso. Usa el audio del mazo si existe y, si no, la voz de Memora. Estas tarjetas tienen su propio contador y **no cuentan en las 1.000 palabras** salvo que la palabra pase una recuperación verificada dentro de Memora (frase propia o audio).
- **Modo B — Historias**: el usuario **asigna campos** (palabra inglesa, significado, ejemplo, audio, imagen) con vista previa. Se filtran las palabras que ya conoce con una prueba rápida y se ordenan por frecuencia. El usuario elige cuántas palabras al día quiere convertir; para cada una se genera en segundo plano (sección 15, con tope de gasto) la escena, la frase y las variantes, con imagen pregenerada y revisión. Si la tarjeta ya trae ejemplo, audio o imagen, se reutilizan.
- **Puente entre ambos**: una tarjeta del modo A que se convierte en sanguijuela se ofrece automáticamente para pasar a historia.
- Tipos de nota admitidos al principio: básico, básico y reverso, huecos y respuesta escrita; el resto se muestra tal cual o se omite con aviso.

_Aceptación_: importar un mazo real de 500+ tarjetas sin bloquear la app (en segundo plano, con progreso); vista previa correcta; ninguna tarjeta ejecuta código; los errores quedan en un informe.

## 20. Audio con pantalla bloqueada (iPhone/Brave)

**Dato de partida**: en Brave para iPhone, YouTube sigue sonando con la pantalla bloqueada. Brave tiene el ajuste **«Enable Background Audio»**, que debe estar activado. Eso no garantiza que una página propia haga lo mismo.

**Limitación técnica conocida de WebKit (el motor de todos los navegadores de iPhone)**: con la pantalla bloqueada o la app en segundo plano, el JavaScript se suspende. Mientras suena un elemento `<audio>` el proceso se mantiene activo, pero hay informes de que el evento `ended` no se dispara y de que un nuevo `play()` puede no hacer nada. Por tanto, encadenar clips con JavaScript (uno tras otro) puede dejar de funcionar al bloquear la pantalla.

**Solución de diseño**: la sesión manos libres es **un único archivo de audio continuo prerenderizado**:

- El servidor monta (p. ej. con ffmpeg) los clips cacheados más silencios para las pausas de respuesta y las revelaciones, con **capítulos** para navegar.
- Un solo `<audio>` controlado con Media Session (play/pausa, ±15 s, capítulo anterior/siguiente). Sin temporizadores de JavaScript y sin Web Audio API para este modo.
- Duración 10/20/30 min. Se renderiza en segundo plano al pedirla o la noche anterior («sesión de mañana»), y queda disponible sin conexión.
- Pausas fijas (3–5 s, configurables).
- Al volver a la pantalla, **lista rápida de las palabras de la sesión** para marcar cuáles no sabía, que alimenta el repaso espaciado.

_Aceptación (se prueba en el iPhone con Brave)_: 20 minutos con pantalla bloqueada sin cortes. Si se corta, documentar cuándo y probar en Safari y como app instalada en la pantalla de inicio antes de decidir.

## 21. Voz sin esperas

**Objetivo**: primer sonido en <300 ms con audio en caché y <1,5 s en audio bajo demanda.

- **Primero medir**: instrumentar (petición → primer byte → inicio de reproducción) por tipo (caché / bajo demanda) para saber dónde está la espera. Causas habituales: arranque en frío del modelo, generación por cada petición, archivos grandes, párrafos largos y colas en serie.
- **Todo el contenido oficial, pregenerado** y servido desde caché comprimida (Opus/MP3).
- **Modelo siempre caliente** en el servidor (proceso residente que no recarga el modelo en cada petición), o carga anticipada si la síntesis se hace en el navegador.
- **Generación por frases con streaming**: se reproduce el primer fragmento mientras se genera el resto.
- **Precarga**: los siguientes 2–3 pasos de la lección y las próximas tarjetas por vencer.
- **Cola de pregeneración en segundo plano** para mazos importados, empezando por las tarjetas que vencen antes.
- **Caché local** (IndexedDB y Service Worker) para la lección del día.
- Audios cortos: palabra y frase por separado, nunca párrafos largos.
- Último recurso, opcional: la voz del dispositivo como respaldo instantáneo, avisando de que suena peor.

_Aceptación_: informe de latencias antes y después; el 95% de los audios de una lección empiezan en <300 ms.

## 22. Hitos añadidos (2.ª tanda)

13. **H13 — Mazos e importación de Anki**: primero el modo A (tal cual) con importación segura; después el modo B (historias) y el puente de sanguijuelas.
14. **H14 — Sesión de audio prerenderizada** (sección 20) con prueba real en Brave/iPhone.
15. **H15 — Voz sin esperas** (sección 21). La **medición de latencia se hace ya en H1** para tener una base; las mejoras se integran con H9.

## 23. Hallazgos de la auditoría del repositorio y despliegue (a verificar por Claude Code)

**Voz (Kokoro)**

- `http://tts:8880` es correcto: es el nombre interno del contenedor dentro de Docker, no una dirección para el navegador. El backend anuncia `tts: kokoro` y `enabled: true`; voz por defecto `af_heart`; Kokoro acepta velocidades entre 0.5 y 1.5.
- El fallo está en la **integración del frontend**: Memora usa Kokoro como generador bajo demanda, no como biblioteca de audio preparada.
- La app pide el audio al llegar al ejercicio; Kokoro puede tardar hasta ~20 s y el frontend da error a los 8 s, y **descarta el audio aunque termine después**.
- Las historias se envían como párrafos largos; no hay cola central de reproducción, segmentación ni precarga.
- El control de velocidad de Ajustes no afecta a la mayoría de audios Kokoro; la reproducción normal envía siempre 1.0 y el botón lento usa 0.65.
- El selector de voz se guarda solo en el navegador, no en el perfil de usuario.
- El audio se guarda en `speech_cache_v2` solo tras la primera petición: no está pregenerado. La caché del navegador guarda una URL con el token de acceso, que deja de funcionar cuando cambia el token.
- No se mide el tiempo hasta el primer sonido.
- **Arreglos inmediatos** (antes incluso de H1): subir el límite de espera y no descartar audios tardíos, aplicar la velocidad elegida a todos los audios, guardar la voz en el perfil, cachear por clave estable (sin token en la URL) y empezar a medir latencias.
- Ficheros señalados: `ExposureCard.tsx`, `common.tsx`, `api.ts`, `Settings.tsx`, `content/pilot.json`, `backend/extensions/memora-ai/dist/providers/kokoro.js`, más un reproductor central de audio y un componente de palabras interactivas.

**IA (OpenRouter)**

- La clave está confinada al backend. Hoy: modelo por defecto `deepseek/deepseek-chat-v3.1`, alternativas Gemini Flash, GPT-4o mini y Claude Haiku. Imágenes con Pollinations (no OpenRouter), ejemplos de Tatoeba, pronunciación y candidatas mnemotécnicas con Datamuse.
- Se llama a OpenRouter para mnemotecnias alternativas, cadenas del palacio, corrección de frases, traducción, definiciones, historias y conversación. **Faltan**: modelo distinto por tarea, registro de tokens y coste, límite diario por usuario, tope global de gasto, reintentos con modelo alternativo, caché por versión de prompt, validación estricta de esquemas JSON, cola fuera de la lección y revisión humana antes de publicar contenido oficial.
- Hoy algunas historias, definiciones, imágenes y ejemplos se generan mientras el usuario espera, lo que contradice la regla de no bloquear la ruta principal.

**Elección de modelo (sección 15)**

- El candidato propuesto es `deepseek/deepseek-v4.1-flash`: precio muy bajo en OpenRouter (según el proveedor, del orden de 0,05–0,15 USD por millón de tokens de entrada y 0,30–0,60 de salida; **comprobar la cifra actual en la página del modelo**).
- A estos precios el coste de generar 1.000 escenas es de céntimos o pocos euros, así que **el criterio decisivo es la calidad y la fiabilidad del JSON, no el precio**.
- Mini-prueba antes de decidir: 30 palabras, 4–5 modelos baratos (el actual, DeepSeek V4.1 Flash y otros equivalentes), mismas instrucciones; valorar a ciegas la mnemotecnia en las cuatro dimensiones (sonido, significado, visual, sin distracciones), el porcentaje de JSON válido a la primera y el coste real. Ejecutarla de forma repetible desde la configuración por tarea.
- Privacidad: para contenido que escribe el usuario (conversaciones, correcciones), usar la preferencia de enrutado de OpenRouter que excluye proveedores que guardan o entrenan con los prompts (verificar el parámetro exacto en la documentación) y evitar los niveles baratos que lo permiten.

## 24. Persistencia de la asociación (núcleo del proyecto)

**Diagnóstico**: hoy la asociación aparece **una sola vez**, en la exposición. El examen y los repasos preguntan solo la traducción español→inglés y el primer repaso se programa a +1 hora, así que **la escena no se vuelve a recuperar** y se olvida. Una asociación solo dura si se recupera varias veces, en momentos espaciados, y se va retirando poco a poco.

**Principios**

- La mnemotecnia es un **andamio**: da la primera recuperación. La memoria duradera sale de recuperar muchas veces y de usar la palabra. La meta final es la recuperación directa, sin escena.
- Mientras la palabra esté en las primeras etapas o falle, cada repaso pasa por la escena.
- La imagen es **estable**: la misma en todos los encuentros.

**24.1 Escalera de encuentros con la asociación** (por palabra; los intervalos son iniciales y los ajusta el repaso espaciado)
| Encuentro | Cuándo | Pista | Qué se pide |
|---|---|---|---|
| E0 | Primera exposición | Escena + imagen + audio | Recuperar la palabra con la escena oculta (inmediato) |
| E1 | Final de la sesión | Solo imagen | Imagen → palabra y **palabra → escena** («¿qué hacía el burro?») |
| E2 | +1 día | Solo la situación | Recuperar la palabra y comprobar si «se vino la escena» (sí / no) |
| E3 | +3 días | Ninguna (palabra en una frase nueva) | Entender/usar en contexto; la escena solo si falla |
| E4 | +7 días | Ninguna | Producirla en una misión personal |
| E5+ | +14, +30 días | Ninguna | Recuperación directa; la escena ya no aparece salvo fallo |

**24.2 Dirección doble**: palabra → escena **y** escena → palabra. Hoy el examen solo toca la traducción, que no activa la escena.

**24.3 Qué pasa en un fallo**

- Se sube **un peldaño** de pista (primero la imagen, luego la situación, etc.), no se repite el mismo ejercicio.
- Tras dos fallos, la escena se revisa: ¿era mala? Se regenera o el usuario escribe la suya.
- La palabra vuelve al peldaño anterior de la escalera, no al principio.

**24.4 Calidad de la asociación** (catálogo, no resultado automático)

- Estados `draft → reviewed → published → rejected`; la IA no publica directamente. Las más frecuentes pasan revisión humana.
- Escena breve (máx. 14 palabras, **también para las asociaciones antiguas**), fácil de visualizar, con palabra puente sonora y sin detalles que distraigan.
- Campos: `keyword`, `scene_es`, `scene_en`, `phonetic_score`, `semantic_quality`, `image`, `status`.
- Imagen preparada solo para palabras visuales e importantes; la imagen no debe revelar la respuesta por texto.

**24.5 ¿Dura de verdad? Medirlo**

- Experimento dentro de la app: cada palabra nueva se asigna **al azar** a (A) repasos con escalera de asociación o (B) repasos solo con traducción.
- Comparar el recuerdo sin ayuda a 7 y 30 días. Con unas 200 palabras o más da una señal orientativa, no una prueba científica.
- Registrar el tipo de asociación (sonora, imagen, cognado) y el feedback del usuario, y mostrar qué tipos le funcionan mejor.

**24.6 Cambios señalados (verificar en el repositorio)**: el examen final de `Session.tsx` y la programación a +1 h se sustituyen por la escalera; los intentos de «ordenar frase» y «frase personal» se guardan y cuentan; el repaso consulta la pista actual de cada palabra.

_Aceptación_: una palabra nueva pasa por E0–E2 con las dos direcciones; los intentos quedan guardados con el peldaño y la pista usada; el experimento A/B está activo y registra resultados.

## 25. Reconducción: una misión vertical

**Problemas detectados** (auditoría del producto, a verificar): hay tres «directores» distintos de lo que hacer (Inicio envía a `/sesion`, la Ruta propone otra secuencia y la sesión tiene una tercera); las condiciones de finalización de la Ruta no representan actividades realizadas; el modelo de datos sigue centrado en `Word` (los phrasal verbs, irregulares, escenas y conversación van aparte); la frase personal es demasiado abierta y depende de la IA como juez; las historias, juegos y palabras guardadas no alimentan el progreso principal; el «aprendida» actual solo significa «introducida».

**Plan**

1. **Congelar** nuevas funciones (sección 26).
2. **`LearningUnit`** única: `word | chunk | phrasal_verb | pattern | irregular_form | personal_word | sentence`, con progreso **por habilidad**: significado, escucha, pronunciación, producción, uso en contexto y memoria. Migración **gradual** junto a `Word`, sin romper lo existente.
3. **`DailyPlan` persistente** (en la cuenta, no en `localStorage`): repasos pendientes, episodio del día, unidades activas, de reconocimiento, chunks, patrón, conversación final. Un único botón: «Continuar · Misión N de M». La Ruta se deriva de este plan.
4. **Sesión única y reanudable**: recuperar lo pendiente → entrar en la escena → aprender unidades → escuchar la escena → ordenar → transformar → misión personal → minidiálogo → recuperación final → recompensa.
5. **Producción personal con intención**: situación + intención + patrón + piezas permitidas (ej.: «Estás en el trabajo y tu móvil no tiene batería. Pide prestado un cargador diez minutos. `Can I borrow + objeto + for + tiempo?`»). Validación local de la estructura → ¿cumple la misión? → revisión lingüística de la IA como **segundo nivel** → explicación de **un** error → segundo intento. No se pega la corrección completa en el campo. La frase correcta se **guarda** y vuelve como listening, ordenar, dictado, pronunciación, conversación y repaso.
6. **Capturas integradas**: una palabra guardada desde un libro, canción o película se convierte en unidad real (significado en contexto → asociación → plan de mañana → repaso dentro de su frase original).
7. **Juegos adaptativos**: consultan un programador común (≈40% palabras débiles, 25% próximas a vencer, 20% nuevas, 15% dominadas) y cada partida actualiza el progreso.
8. **Estados honestos por habilidad**: vista → reconocida → recuperable (ES→EN) → comprendida al oír → usada → automatizada → consolidada. Una palabra fallada en el examen inicial **no** cuenta como aprendida.
9. **Objetivo de 1.000 con dos cifras separadas**: unidades encontradas/reconocidas (≥1.000) y unidades con producción profunda (300–450). Distribución diaria orientativa: 10 activas, 15 de reconocimiento, 5 cognados, 3 chunks o phrasal verbs y 30–60 personales en el mes.

**Misión de arranque: «Día 1 · Necesitas ayuda en el trabajo»**
Cinco unidades conectadas (p. ej. `borrow`, `charger`, `run out of`, el patrón `Can I + verbo`, `actually`): escena de entrada, asociación breve con imagen estable, audio Kokoro precargado, estructura visible, frase transformada, respuesta personal («pide prestado un cargador diez minutos»), miniconversación y repaso final. Todo guardado en la cuenta. Solo cuando esa misión sea clara, rápida y satisfactoria, se convierte el motor en plantilla para generar los 30 días.

## 26. Congelación y pruebas

- **Congelado hasta cerrar H2**: más libros, juegos, pantallas, modo manos libres (secciones 16 y 20), importación de Anki (19) y extras (17).
- **Siguen**: arreglos de voz (secciones 14, 21 y 23), H1 y H2.
- **Pruebas de recorrido completo** (hoy solo hay pruebas de repetición, comparación de respuestas, fonética, clasificación y longitud): terminar una sesión, abandonar y reanudar, generar y corregir una frase, permisos de cuenta familiar, Kokoro real, recorrido diario, progreso entre dispositivos, actualización de la PWA y migraciones de Directus.
- La Ruta no debe ser una lista de enlaces: sus pasos se marcan solo por actividades realmente completadas.

## 27. Generación de medios: qué usar (imágenes, voz, música, vídeo)

Estado a octubre de 2026 según fuentes públicas; **verificar licencia y límites de la versión exacta antes de publicar**.

**Midjourney y Suno: no integrar**

- **Midjourney** no tiene API oficial. Funciona por Discord y su web, y sus términos prohíben automatizar. Los «APIs de Midjourney» de terceros son envolturas no oficiales que manejan una cuenta, con riesgo de bloqueo. No usarlas.
- **Suno** tampoco tiene API pública. En julio de 2026 anunció que explora una API para un grupo reducido de socios, sin fecha. Los servicios de terceros se basan en acceso no autorizado. No usarlos.

**Imágenes (prioridad alta: son parte del núcleo de la asociación)**

- Modelo recomendado: **FLUX.1 [schnell]** (Apache 2.0, uso comercial permitido). Alternativas con licencia abierta: FLUX.2 [klein] 4B, Z-Image Turbo y Qwen-Image (Apache 2.0). **Evitar** FLUX.2 [dev] y otras versiones de licencia no comercial sin licencia aparte.
- Acceso gratis para empezar: **Cloudflare Workers AI** (10.000 «neurons» diarios en el plan gratuito; admite FLUX.1 schnell). El número de imágenes por día depende del tamaño y los pasos: medirlo. Al agotar el cupo, las peticiones fallan.
- Se **pregeneran fuera de la lección** con una cola y un tope diario, se guardan con hash de (prompt + modelo + estilo + semilla) y se sirven desde caché. Nunca en vivo.
- Estilo coherente: un prompt de estilo fijo para todas las escenas; la imagen de cada escena es estable.
- Alternativa hoy en uso: Pollinations (sin clave, pero generación bajo demanda y menos control); sustituir por la cola anterior.

**Voz**

- Salida: **Kokoro** (ya integrado). Entrada para la ruta «Hablar» (pronunciación y shadowing): **Whisper** (modelo abierto), disponible también en el plan gratuito de Workers AI.

**Música (prioridad baja, congelada)**

- **ACE-Step 1.5** (licencia MIT): corre en una GPU de consumo y tiene calidad cercana a las herramientas comerciales, pero requiere GPU (un servidor sin GPU no sirve). **MusicGen**: pesos CC BY-NC (no comercial). **Stable Audio Open**: licencia comunitaria con umbral de ingresos.
- Uso posible más adelante: canciones cortas con vocabulario del día. No hay evidencia en este proyecto de que mejore la retención: medir antes de invertir.

**Vídeo (prioridad baja, congelada)**

- Modelos abiertos como **Wan 2.2** (Apache 2.0) requieren GPU potente. No aporta a la retención; las imágenes estables bastan por ahora.

**Reglas de integración**

- Todo detrás de una interfaz de proveedor en el backend (como `kokoro.js`): intercambiable por configuración.
- Claves solo en el backend, cola de generación, tope diario y de gasto, caché por hash y registro de coste y errores.
- Los servicios gratuitos son para prototipos: no depender de ellos sin plan de sustitución.
