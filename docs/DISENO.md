# Diseño de Memora (referencia: V2)

Capturas reales de la V2 en `docs/diseno/` (iPhone 390×844), hechas con Playwright sobre una copia local en modo
vista previa. **Se reconstruye limpio con estos valores; no se copian sus estilos.**

## Tokens
| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| page | #eae5dc | #171714 | Fondo arena cálido |
| ink | #282622 | #f5f1ea | Texto principal |
| muted | #66635d | #c1bbb0 | Texto secundario |
| accent / accent-ink | #8b6950 / #76543b | #d8b79a / #eed1b2 | Marrón: etiquetas, significado |
| warm / warm-soft | #a85a37 / #f8e6d7 | #efaa7e / rgba(131,77,51,.35) | Puente, terminaciones, XP |
| grammar-verb (+soft) | #275f54 / #e6f0eb | #a5d9c6 / #293f35 | Raíz del verbo (Espejo) |
| grammar-aux (+soft) | #245d8c / #e5eff9 | #a6d4fa / #263b4c | Auxiliar (Espejo) |
| surface | rgba(255,253,248,.58) | rgba(37,35,32,.58) | Tarjetas translúcidas |
| shadow | 0 30px 72px rgba(72,54,39,.13) | 0 36px 90px rgba(0,0,0,.4) | Tarjeta flotante |

**Tipografía:** sistema (`-apple-system`, SF Pro Display, Avenir Next). Palabra en inglés enorme y ultranegrita;
significado en mayúsculas marrones; etiquetas en versalitas espaciadas («ASOCIACIÓN 1/3», «RECUERDA · 1/3»).

## Componentes
- **Tarjeta de juego:** una sola tarjeta grande y redondeada (≈ 28 px), que se arrastra (← conecta, → pista) y con teclado.
- **Tarjeta de asociación:** lugar arriba · palabra + SIGNIFICADO + AFI · ilustración (emoji doble provisional) con la
  cadena PLAYA → PLAY → JUGAR · «SUENA A» + puente grande · escena con puente y significado resaltados · audio ·
  «Esta asociación no me ayuda».
- **Recordar:** ilustración + «¿Cómo se dice *jugar*?» + 3 opciones grandes · combo.
- **Resultado:** «Vamos a usarlas», XP, «las que fallaron volverán en tu repaso».
- **Descubre el truco:** jug|ando → play|ing con colores de raíz y terminación.
- **Construir:** frase española con la pieza resaltada, huecos y dos opciones grandes.
- **Inicio:** tarjeta de aventura ilustrada, «Empezar misión», «¿Qué te apetece hacer?» (Aprender palabras, Arcade,
  Conversar con candado), cifras honestas, mapa de misiones.

## Mejoras sobre V2 (acordadas)
- Escenas de **5 palabras** (3 escenas = sesión de 15).
- Reconstrucción de la escena y asociación inversa.
- Cuatro modos separados (Asociaciones, Gramática, Arcade, Chat) sobre un único progreso.
- Barra de revisión solo para administración y autoría.
