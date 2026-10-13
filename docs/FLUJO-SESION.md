# Flujo de la sesión por habitaciones (propuesta, pendiente de aprobación)

Sustituye al recorrido del H2.2a (D-033 → D-034). Solo cambia `packages/experiences` y `apps/web`. Los tres puntos
que requerirían tocar el endpoint o el esquema van al final, como preguntas.

## 1. Qué hacían V1 y V2, y en qué se apartaba el H2.2a

| | V1 (`frontend/`) | V2 (`memora-v2/`) | H2.2a (rechazado) |
| --- | --- | --- | --- |
| Unidad de sesión | Ronda de 10, 25, 50 o 100 palabras, partida en **habitaciones de 10** dentro de un palacio | Escena de **3 palabras** («tres anclas por escena») en un lugar de la casa | Lista suelta de habilidades del plan, sin habitación |
| Tarjeta de palabra | Palabra y significado grandes; caja «1 · Escucha el sonido real» con AFI, pronunciación figurada y audio; caja «2 · Crea la conexión mental» con palabra puente, imagen o emoji y escena (con botón «la escena en inglés»); objetivo de unos 45 s | Palabra, significado en mayúsculas, AFI, imagen de la escena, «Suena a» con el puente y audio; suena primero la escena en español y luego la palabra; «Esta asociación no me ayuda» | Empezaba con **un sonido sin significado**; asociación sin imagen ni pronunciación figurada |
| Recuperación inmediata | El prototipo `borrow` (`PerfectWord`) **tecleaba** la palabra; la sesión normal no recuperaba palabra a palabra | **Elegir entre opciones** (las otras palabras de la escena), con 5 s de margen, combo y vuelta a la escena si falla | **Teclear** la palabra en la primera exposición |
| Escena en inglés | Botón o paso propio («la misma película, ahora en inglés») con audio | Implícita en la tarjeta | No existía |
| Frase y estructura | Frase con audio normal y lento, y piezas etiquetadas (`Can I · borrow · your charger · for a minute?`) | Construir frases eligiendo entre dos piezas por hueco | Frase solo dentro de «ordenar» |
| Ordenar | Fichas con 2 o 3 sobrantes, «reproduce exactamente la frase modelo» | Por huecos | Fichas con distractores |
| Frase propia | Sí, con revisión por IA | Sí, en algunas fases | En el recorrido normal, con dos intentos |
| Ritmo | **10 seguidas** → resumen de la habitación (s/palabra) → repaso opcional → **examen tecleado** al final de la ronda | **3 seguidas** → recuperar las 3 → gramática → construir → conversación | Una habilidad tras otra, sin bloques |

Además, `ESPECIFICACION.md` pide:
- **§5:** sonido, significado y AFI juntos; asociación con imagen; recuperación inmediata con la escena oculta; la misma escena en inglés; frase natural con audio repetible; estructura visible; ordenar con fichas; programar el repaso.
- **§7:** nunca el mismo formato dos veces seguidas para una palabra, y contextos nuevos en cada reaparición.

## 2. Ritmo propuesto: habitación de 10 en dos bloques de 5

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
- audio → significado.

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

1. **Habilidad «producir» sin frase propia.** Si la frase propia sale del recorrido, la habilidad «producir» solo
   recibe «ordenar» (reconocimiento) y la unidad no podría llegar a «aprendida». Propongo que en los repasos
   «producir» se pruebe **traduciendo la frase de ejemplo** (formato `production`, tecleado y con pistas). ¿De acuerdo?
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
4. **Imagen de la escena.** Las imágenes generadas llegan en el H2.3. Hasta entonces, propongo usar las que subas a
   mano en «Medios», ya aprobadas. Requiere que el endpoint las incluya en la sesión. Sin imagen se muestra un
   marco neutro.
5. **Pronunciación figurada:** ya existe en el contenido (`pronunciation.respelling`). Se mostrará si está.
6. **Faltan `docs/PROTOTIPO.html` y las capturas de `docs/diseno/`.** No los encuentro en el repositorio. Cuando
   estén, escribo `docs/DISENO.md` y ajusto estos bocetos.
