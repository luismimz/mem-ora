# Boceto del modo Asociaciones (pendiente de aprobación)

Sesión de 15 palabras = 3 escenas de 5. Aspecto y gestos de V2 (`docs/DISENO.md`, `docs/diseno/`): tarjeta grande que
se arrastra (← conecta, → pista), fondo arena, palabra enorme, significado en marrón. Teclear solo en repasos.

## Orden de una sesión
1. **Repasos vencidos** (curva 1 h · 3 h · 24 h · 3 d · 7 d · 14 d), si los hay. Aquí sí se teclea, con pistas.
2. **Escena 1:** 5 tarjetas de asociación → recordar las 5 (opciones) → reconstruir la historia → resultado.
3. **Escena 2** y **Escena 3**, igual.
4. **Cierre:** asociación inversa mezclando las 15 → resumen y próximo repaso.

## A · Inicio (como V2)
```
┌────────────────────────────────┐
│ M        ◉ 0/15 palabras    ☾  │
│ Inicio · Palabras · Arcade ·   │
│ Gramática · Chat 🔒            │
│ ┌────────────────────────────┐ │
│ │ (ilustración del lugar)    │ │
│ │ MUNDO 1 · LA CASA VIVA     │ │
│ │ Sesión de hoy: 15 palabras │ │
│ │ 3 escenas · 4 repasos      │ │
│ │ [ Continuar aventura → ]   │ │
│ └────────────────────────────┘ │
│ ¿Qué te apetece hacer?         │
│ ◈ Asociaciones  ✦ Arcade       │
│ ▣ Gramática     ◌ Chat (3 ses.)│
└────────────────────────────────┘
```

## B · Tarjeta de asociación (igual que V2, 1 de 5)
```
┌────────────────────────────────┐
│ ← Recorrido   ESCENA 1 · 1/5 ▬ │
│ La Casa Viva · Dormitorio      │
│ PLAY  JUGAR                    │
│ /pleɪ/ · ≈ PLÉI                │
│ ┌────────────────────────────┐ │
│ │      🏖️   🎮               │ │
│ │ [PLAYA → PLAY → JUGAR]     │ │
│ └────────────────────────────┘ │
│ SUENA A  PLAYA            🔊   │
│ Una PLAYA invade el salón      │
│ cuando empiezas a JUGAR.       │
│ Esta asociación no me ayuda    │
│ Conecta · arrastra ←   Pista → │
└────────────────────────────────┘
```
Suena sola: escena en español y luego la palabra en inglés. Nunca sonido sin significado.

## C · Recordar (tras las 5 tarjetas, como V2)
```
┌────────────────────────────────┐
│ RECUERDA · 1/5      COMBO x2   │
│ ┌────────────────────────────┐ │
│ │      🏖️   🎮               │ │
│ └────────────────────────────┘ │
│ ¿Cómo se dice jugar?           │
│ [ DESK ] [ PLAY ] [ COMPUTER ] │
└────────────────────────────────┘
```
Opciones solo con palabras de la escena (ya enseñadas). Si falla, vuelve la escena y se repite al final de la ronda.

## D · Reconstruir la historia (corregido: lleva al SIGNIFICADO)
```
┌────────────────────────────────┐
│ COMPLETA LA HISTORIA           │
│ Una PLAYA invade el salón      │
│ cuando empiezas a ______.      │
│ [ JUGAR ] [ COMER ] [ DORMIR ] │
│ …y en inglés eso es: PLAY 🔊   │
└────────────────────────────────┘
```
El puente (PLAYA) solo es el sonido; la historia lleva al significado (JUGAR) y de ahí a la palabra (PLAY).

## E · Resultado de la escena (como V2)
```
┌────────────────────────────────┐
│          🏖️ 🎮 ✨              │
│      4/5 RECORDADAS            │
│   ¡Conexión hecha!  +40 XP     │
│ La que falló vuelve en 1 hora. │
│ Seguir · arrastra ←            │
└────────────────────────────────┘
```

## F · Cierre: asociación inversa con las 15
```
┌────────────────────────────────┐
│ RESCATE · 7/15                 │
│ (ilustración)                  │
│ ¿Qué palabra esconde esta      │
│ escena?   [ KEY ] [ PLAY ]     │
│           [ DESK ] [ LOCK ]    │
└────────────────────────────────┘
```
Alterna escena → palabra, palabra → significado y audio → significado; nunca el mismo formato dos veces seguidas.

## G · Resumen
```
┌────────────────────────────────┐
│ ¡15 palabras nuevas!  18 min   │
│ A la primera 12 · Con ayuda 3  │
│ Próximo repaso: hoy 17:40 (1 h)│
│ Gramática con estas palabras ▸ │
│ [ Terminar ]  [ Otra sesión ]  │
└────────────────────────────────┘
```
«Gramática con estas palabras» es la puerta al modo Gramática (no obligatoria).

## H · Repaso (días siguientes)
```
┌────────────────────────────────┐
│ REPASO · 2/9                   │
│ ¿Cómo se dice jugar?           │
│ [___________]                  │
│ [Comprobar] [💡 Pista] [Ver]   │
└────────────────────────────────┘
```
Pistas: primera letra → pronunciación figurada → puente → escena. «Ver» no cuenta como acierto.

## Arcade sorpresa
A partir de 20 palabras aprendidas, al acabar una escena puede saltar al azar un Arcade corto (solo lo enseñado) para
romper la rutina.

## Cambios técnicos que implica (al aprobar)
- `packages/experiences` y `apps/web`: rehacer la sesión y las pantallas con este diseño.
- Endpoint: enviar módulo/escena de cada unidad y fijar el curso de inglés en 15 nuevas por sesión.
- Contenido: emoji provisional y escena en inglés por asociación (campo nuevo en el esquema, con copia previa).
- Capturas con Playwright de cada pantalla antes de enseñártelo.
