# Flujo de la sesión por habitaciones (propuesta, pendiente de aprobación)

Sustituye al recorrido del H2.2a (D-033 → D-034). Se ajusta a `docs/ACUERDOS-PRODUCTO.md`, que manda en producto. Solo cambia `packages/experiences` y `apps/web`. Los tres puntos
que requerirían tocar el endpoint o el esquema van al final, como preguntas.

## 1. Matriz: V1, V2, H2.2a y propuesta frente a los principios rectores

Principios de `docs/ACUERDOS-PRODUCTO.md`:
- **P1:** enseñar primero, pedir después.
- **P2:** las asociaciones son el centro.
- **P3:** vocabulario primero, gramática en espiral y en menor proporción.
- **P4:** el Arcade divierte y sella, no enseña.
- **P5:** experiencia única.

Marcas:
- **contradice:** el ejercicio pide algo que antes no se ha enseñado en una tarjeta (P1).
- **incumple §x:** choca con otro acuerdo del documento.
- **riesgo:** cumple solo si se respeta la condición indicada.
- **falta:** el aspecto no está.

Comprobado leyendo el código antiguo en solo lectura (`frontend/`, `memora-v2/`) y el nuestro.

| Aspecto | Principio | V1 (`frontend/`) | V2 (`memora-v2/`) | H2.2a (rechazado) | Propuesta |
| --- | --- | --- | --- | --- | --- |
| Unidad de sesión | P3 | Habitaciones de 10 dentro de un palacio. Cumple | Escena de 3 palabras **con gramática en cada escena**: riesgo, proporción alta de gramática | Lista suelta de habilidades. Incumple §3 (habitación) | Habitación de 10 = 2 misiones de 5 (§2). Cumple |
| Primera pantalla de la palabra | P1, P2 | Tarjeta completa. Cumple. **Pero** el prototipo `borrow` empieza con «Escucha. ¿Qué palabra crees que es?»: **contradice** | Asociación con audio, palabra, significado, AFI, escena y puente. Cumple | Sonido sin significado. Incumple §3.1 | Palabra, significado, audio, AFI, pronunciación figurada, escena y puente juntos. Cumple |
| Recuperación inmediata | P1 | El prototipo pide teclear: incumple §3.2 | Opciones entre las palabras de la escena, ya enseñadas porque se recupera tras asociar las 3. Cumple | Teclear la palabra. Incumple §3.2 | Elegir o completar con fichas, sin teclear. **Riesgo:** los distractores deben ser palabras ya enseñadas; en las dos primeras de la habitación, fichas de la propia palabra |
| Pregunta de reconstrucción de la escena (3b.2) | P1, P2 | «Recuperación final: cuéntala», tecleado libre. Incumple §3.2 el primer día | Falta | Falta | **Falta en mi boceto: la añado.** En el repaso del bloque: «¿Qué hacía el burro?» con opciones (palabra → escena). Ayudas en el orden de 3b: imagen → puente → audio |
| Escena en inglés con audio | P1, P2 | Paso propio con audio. Cumple | Falta | Falta | Paso 4. Cumple (necesita el campo de la pregunta 3) |
| Frase natural y estructura | P1, P3 | Frase con audio normal y lento, y piezas etiquetadas. Cumple | Construir por huecos. Cumple | La frase solo aparecía dentro de «ordenar» | Paso 5 (frase y estructura si es patrón). Cumple |
| Ordenar con fichas | P1 | Reproduce la frase modelo, ya mostrada. Cumple | Por huecos, tras verla. Cumple | **Contradice:** se podía pedir ordenar un ejemplo distinto del mostrado en la tarjeta (cada paso elegía su ejemplo por separado) | Ordena la misma frase del paso 5. Cumple |
| «Descubre el truco» (Espejo) y construir por piezas (§3.5–3.6) | P3 | 23 fichas aparte, «frase escalera» de una estructura al día | Transformación gramatical en cada escena | Falta | **Falta en mi boceto:** solo cuando la unidad es un patrón, con colores (sujeto, raíz, terminación). La ficha completa de 9 pasos es del H4 |
| Bloques completos tipo LOOK FOR (3b.4) | P1, P3 | Tipos «chunk» y «phrasal» con pista | LOOK FOR como expresión inseparable (misión de las llaves). Cumple | `form: chunk / phrasal_verb` sin tratamiento propio | Se enseña como bloque en su tarjeta. **Pendiente:** limitar la explicación a las piezas que aún no conoce exige saber qué piezas se han enseñado |
| Gramática en espiral y en menor proporción | P3 | Una estructura al día, aparte del vocabulario. Proporción cumple; espiral parcial | Gramática en cada escena: más proporción de la acordada | **Contradice:** el patrón `can-i` del ejemplo usa palabras no enseñadas («Can I take a photo?») y no hay control de proporción | Como máximo 1 patrón por misión de 5 (≤ 20 %). Cada patrón exige como prerrequisito sus palabras y vuelve en habitaciones posteriores con vocabulario nuevo ya enseñado. **Pendiente:** validador de que los ejemplos del patrón solo usan vocabulario enseñado más palabras funcionales |
| Frase propia | P1 | «Crear otra» con IA. Fuera del recorrido normal según §3 | En algunas fases | En el recorrido normal. Incumple §3 | Fuera del recorrido; opción oculta. Producir = traducir la frase de ejemplo en los repasos, con alternativas aceptadas (§3) |
| Conversación con corrección concreta y reintento (3b.5) | P1 | Chat con IA en directo: **contradice** (puede pedir vocabulario no enseñado y es IA en la lección) | Diálogos revisados, error contextual y nuevo intento. Cumple | Falta | H7 (§3.7 la pone en el recorrido: lo planteo como pregunta). Respuestas y errores típicos preparados en el contenido, sin IA, solo con vocabulario enseñado |
| Recordar fuera de la historia y otro día en otra situación (3b.3, 3b.6) | P1, P2 | Examen con las mismas palabras | Repaso en Arcade | Repasos con los mismos ejemplos | Repasos que rotan contextos. **Riesgo:** una «frase nueva» solo puede usar vocabulario ya enseñado; hacen falta más ejemplos por unidad |
| Arcade: solo lo enseñado, y lo fallado vuelve | P4, P1 | Usa palabras desbloqueadas y los fallos actualizan el repaso. **Pero el respaldo contradice:** completa la tanda con un pack fijo de 13 palabras **aunque no se hayan visto**, con un progreso inventado | `MicroArcade` (el que se usa) exige recuerdo previo y registra el fallo en el calendario. Cumple. `DailyArcade` dejaría pasar palabras sin recuerdo (**contradice**), pero no se usa en ningún sitio | Sin Arcade | H3: el selector solo toma habilidades con exposición registrada y respeta las compuertas de 7 y 30 días. Un fallo es un intento más y el núcleo lo devuelve al repaso. **Prueba obligatoria:** el selector nunca devuelve algo sin exposición |
| «Mi evolución»: con ayuda frente a autónomo (3b) | P1 | Estadísticas por asociación | Intentos originales, ayuda y corrección. Cumple | El resultado separa «a la primera» de «con ayuda» | H6. Los datos ya existen: pista y formato de cada intento. «Autónomo» = sin pista y en recuperación o producción |

## 2. Ritmo propuesto: habitación de 10 en dos misiones de 5

- La **V1** presentaba 10 palabras seguidas y pedía teclearlas al final: el hueco era demasiado largo y la
  recuperación demasiado difícil el primer día.
- La **V2** recuperaba tras 3: va bien para fijar, pero 3 es poco para una habitación de 10 y obliga a muchas
  transiciones.
- **Propuesta:**
  1. Cada palabra trae su recuperación fácil inmediata, en su propia tarjeta.
  2. Tras **5 palabras**, un **repaso mezclado del bloque** (sin teclear).
  3. Lo mismo con las palabras 6 a 10.
  4. Un **cierre de la habitación** mezclando las 10.
  5. El resumen con el tiempo por palabra y el próximo repaso.
- **Por qué 5:** es lo que cabe en la memoria de trabajo (4 ± 1 elementos) y deja bloques de unos 6 minutos.
- **Presupuesto de tiempo:** 10 palabras en 25 minutos o menos supone unos 60–90 s por tarjeta, 1 minuto por repaso
  de bloque y 2 minutos de cierre.
- Es una hipótesis: se medirá en el H2.4.

## 3. Bocetos de cada pantalla

Móvil primero. Una acción principal por pantalla, abajo y a todo lo ancho. Arriba siempre la habitación y el progreso.
Los colores y la tipografía saldrán de `docs/DISENO.md`, cuando estén las capturas.

### 0 · Entrada a la habitación
```
┌──────────────────────────────┐
│ ← Cursos        Habitación 1 │
│ «Necesitas ayuda en el trabajo»│
│                              │
│  10 palabras · unos 20 min   │
│  ○○○○○ ○○○○○                 │
│  Repasos pendientes: 3       │
│                              │
│ [ Empezar ]                  │
└──────────────────────────────┘
```
Si hay repasos vencidos, van **antes** de la habitación, con su propia pantalla (§4).

### 1 · Palabra: significado, audio y pronunciación juntos
```
┌──────────────────────────────┐
│ Hab. 1 · 1/10   ●○○○○ ○○○○○  │
│                              │
│        borrow                │  ← grande, en inglés
│     pedir prestado           │
│  /ˈbɒr.əʊ/ · ≈ BÁ-rou        │  ← AFI + pronunciación figurada
│  [🔊 Escuchar] [🐢 Lento]     │  ← suena sola al entrar
│                              │
│ [ Ver la escena ]            │
└──────────────────────────────┘
```

### 2 · Escena en español con imagen
```
┌──────────────────────────────┐
│ Hab. 1 · 1/10                │
│ ┌──────────────────────────┐ │
│ │        (imagen)          │ │
│ └──────────────────────────┘ │
│  Suena a  BURRO              │
│  Un BURRO te PIDE PRESTADO   │  ← pieza clave resaltada
│  el móvil.                   │
│  ¿Te sirve?  ✅  😐  🔊      │  ← opcional, no bloquea
│ [ Ya la tengo ]              │
└──────────────────────────────┘
```
Sin asociación aprobada, se muestra «conexión directa» (palabra, significado e imagen si la hay) y se sigue.

### 3 · Recuperación fácil, sin la escena y sin teclear
```
┌──────────────────────────────┐
│ Hab. 1 · 1/10                │
│  ¿Cómo se dice               │
│  «pedir prestado»?           │
│ [ borrow ]                   │
│ [ charger ]                  │  ← distractores de la habitación
│ [ plug ]                     │
└──────────────────────────────┘
```
Se alterna, para no repetir formato:
- **elegir la palabra** a partir del significado;
- **completarla con fichas** (`bor` · `row` · `ger` · `plu`);
- en expresiones de varias palabras, **fichas de palabras**.

Si falla, vuelve la escena y se repite con otro formato. Cuenta como reconocimiento (peso bajo, D-014).

### 4 · La misma escena en inglés, con audio
```
┌──────────────────────────────┐
│ (imagen pequeña)             │
│ A donkey BORROWS your phone. │
│ [🔊] [🐢]                    │
│ [ Seguir ]                   │
└──────────────────────────────┘
```

### 5 · Frase natural con audio (y estructura si es un patrón)
```
┌──────────────────────────────┐
│ Can I borrow your charger?   │
│ ¿Me prestas tu cargador?     │
│ [🔊] [🐢 por trozos]          │
│ ┌Can I┐┌borrow┐┌your charger┐│  ← solo en patrones
│ │pedir││acción││objeto      ││
│ [ Ordenarla ]                │
└──────────────────────────────┘
```

### 6 · Ordenar con fichas
```
┌──────────────────────────────┐
│ ¿Me prestas tu cargador?     │
│ ___ ___ ___ ___ ___          │
│ [your] [Can] [plug] [I]      │
│ [charger] [borrow] [the]     │
│ [ Comprobar ]   [ Vaciar ]   │
└──────────────────────────────┘
```
Al acertar: «✓ borrow · vuelve mañana». El repaso queda programado y se pasa a la siguiente palabra.

### 7 · Repaso del bloque (tras 5 palabras, y cierre tras 10)
```
┌──────────────────────────────┐
│ Repaso rápido · 3/8          │
│ (imagen de la escena)        │
│ ¿Qué palabra es?             │
│ [ charger ] [ borrow ] [plug]│
└──────────────────────────────┘
```
Mezcla las palabras del bloque, sin teclear y sin repetir formato seguido:
- imagen o escena → palabra;
- palabra → significado;
- audio → significado;
- **reconstrucción de la escena (3b.2):** «¿Qué hacía el burro?», con opciones de escena (palabra → escena). Si
  necesita ayuda: primero la imagen, luego el puente, luego el audio.

Ninguna de estas preguntas usa una palabra que no se haya enseñado ya en una tarjeta de esta sesión (P1).

### 8 · Resumen de la habitación
```
┌──────────────────────────────┐
│ Habitación 1 completada      │
│ 10 palabras · 18 min         │
│ 1 min 48 s por palabra       │
│ A la primera: 8 · Ayuda: 2   │
│ Vuelven mañana: 10           │
│ [ Seguir ]  [ Terminar hoy ] │
└──────────────────────────────┘
```

### 9 · Repasos (días siguientes): aquí sí se teclea
```
┌──────────────────────────────┐
│ Repaso · 2/12                │
│  ¿Cómo se dice               │
│  «pedir prestado»?           │
│  [_______________]           │
│ [Comprobar] [💡 Pista] [Ver] │
└──────────────────────────────┘
```
- **Escalera de pistas**, alineada con §6: P1 primera letra y número de letras · P2 pronunciación figurada ·
  P3 palabra puente · P4 escena. «Ver» es P5 y no cuenta como acierto.
- **Formatos que rotan (§7):** escribir la palabra, dictado, y **traducir la frase de ejemplo**. Traducir la frase
  sustituye a la frase propia como prueba de producción.

## 4. Lo que hay que decidir antes de escribir código

1. ~~Habilidad «producir» sin frase propia.~~ **Resuelta por `ACUERDOS-PRODUCTO.md` §3:** producir se practica
   traduciendo la frase de ejemplo en los repasos, con alternativas aceptadas. Las alternativas necesitan un campo en
   el contenido de la unidad (`packages/content`).
2. **Habitación = módulo y tope diario.** Para que la sesión sea «una habitación de 10», hacen falta dos cosas que
   tocan el endpoint (extensión de Directus), no el núcleo:
   - enviar el módulo de cada unidad;
   - subir el tope de habilidades nuevas del curso de 8 a 30 (10 palabras × 3), como ajuste de configuración del
     curso.
   ¿Lo permites, o prefieres otra vía?
3. **Escena en inglés.** La asociación solo guarda la escena en español. Para el paso 4 hace falta su versión en
   inglés:
   - **(a)** un campo nuevo en `associations` (cambio de esquema, con instantánea y copia);
   - **(b)** guardarla dentro de `evidence` de la técnica, sin tocar el esquema.

   Recomiendo (a).
4. ~~Imagen de la escena.~~ **Resuelta por `ACUERDOS-PRODUCTO.md` §7:** emoji provisional en un hueco de
   ilustración que admite igual un emoji o una imagen, y marco neutro si no hay. fal no se usa hasta aprobar el
   diseño. Falta saber dónde se guarda el emoji (ver pregunta 7).
5. **Pronunciación figurada:** ya existe en el contenido (`pronunciation.respelling`). Se mostrará si está.
6. **Faltan las capturas de `docs/diseno/`.** `ACUERDOS-PRODUCTO.md` §0 dice que el prototipo HTML del chat
   **no** es referencia y que la V2 sí lo es (para mejorarla). Cuando estén las capturas, escribo `docs/DISENO.md`.
7. **Emoji de la escena.** La asociación no tiene un campo para el emoji provisional. Igual que en la pregunta 3:
   **(a)** campo en el esquema o **(b)** dentro de `evidence`.
8. **Diferencias con `ACUERDOS-PRODUCTO.md` §3** que mi boceto no cubría:
   - el «resultado breve» tras la recuperación (¡Conexión hecha!, XP, combo);
   - «Descubre el truco» con colores si hay patrón;
   - construir por piezas;
   - la conversación con Emma dentro del recorrido;
   - la mochila de palabras;
   - el deslizamiento en móvil («slide», a confirmar).

   Propongo:
   - incluir en esta revisión el resultado breve, «Descubre el truco» y construir por piezas, solo en patrones;
   - dejar la conversación para el H7 y la mochila para después del H2.

   ¿De acuerdo?
