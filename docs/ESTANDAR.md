# Estándar de Memora (congelado)

Versión 1 · 21-oct-2026 · aprobado por el usuario al pedir «establecer de una vez cada parte» (D-075).
**Nada de este documento se cambia sin aprobación explícita del usuario.** Un fallo se corrige respetándolo y se añade
una comprobación automática para que no vuelva.

## 1. Promesa
Aprender un temario completo (los libros de ILERNA, idiomas, oposiciones…) y **recordarlo a largo plazo**, con una
experiencia **divertida, fluida y sin fricción**, como deslizar en una red social. Elegir bien qué técnica de memoria
usa cada cosa es tan importante como la interfaz.

## 2. La experiencia: modo Flujo (única para cursos de conceptos)
Pantalla completa, una tarjeta cada vez, «Siguiente ↑» o deslizar para avanzar. Arriba: barra de progreso, XP y combo 🔥.

| Tarjeta | Qué hace | Reglas |
|---|---|---|
| **Ficha** («Nuevo para tu memoria») | Enseña: emoji, nombre, idea clave, mnemotecnia (puente o analogía) y debajo **Qué es**, contraste y **Ejemplo** | Nunca avanza sola. Todo lo que se pregunte después está aquí. |
| **Relámpago** | 3 opciones: idea → nombre o nombre → idea | Nunca se cierra sola. Rapidez = puntos extra, no penaliza. |
| **¿Verdad o mentira?** | «NOMBRE = idea»; deslizar → / ← o botones | Solo de conceptos ya enseñados. |
| **Pregunta jefe 👑** | Pregunta tipo examen o de código | Cada ~8 tarjetas, de algo ya visto. |
| **Recuérdalo así** | Al fallar: la ficha completa | La unidad vuelve 3 tarjetas después (repesca). |
| **Escríbelo** | Solo en idiomas | En conceptos nunca se escribe. |
| **Ronda completada** | XP, racha de días, aciertos, mejor combo, nuevos, próximo repaso | «⚡ Una ronda más» sin salir. |

Orden: parejas **ficha, ficha, pregunta, pregunta**, con repasos y nuevos alternando. Lo nuevo empieza en 8 por sesión
y sube con los aciertos (D-057); como mucho 10 repasos por ronda.

## 3. Reglas de enseñanza (innegociables)
1. **Se enseña antes de preguntar.** Ninguna pregunta sobre algo sin su ficha antes en la misma ronda.
2. **Se evalúa lo que se enseña.** Cada respuesta aparece en la ficha de su unidad o en una anterior del curso.
3. **Se enseña en el error** y lo fallado vuelve en la misma ronda; después, la curva del olvido decide (repaso
   espaciado en el servidor).
4. **Cobertura completa:** cada apartado del índice del libro tiene al menos una unidad (mapa de cobertura).
5. **Estados honestos:** elegir pesa poco; aplicar en un caso pesa más; una ronda rápida nunca marca «dominado».

## 4. Qué técnica de memoria usa cada cosa
| Lo que se aprende | Técnica | Ejemplo |
|---|---|---|
| Palabra de idioma, nombre arbitrario (clase, comando, sigla) | **Escena absurda con puente de sonido** (palabra española real que suena como la sílaba tónica) | ESCUADRA → *square* |
| Concepto, proceso, idea abstracta | **Analogía** con correspondencia y dónde falla | El LISTENER, un PORTERO que espera el timbre |
| Fragmento de código | **Trazado de código**: historia ≤ 20 palabras, cada línea atada a un elemento | `bind` = HILO que ata dos cosas |
| Lista ordenada o regla | **Acrónimo o regla** | Método LÁSER: Leer, Subrayar, Esquematizar, Resumir |

Mnemotecnia ≤ 10 palabras (código ≤ 20), una sola acción visual, la pieza clave en MAYÚSCULAS y una palabra de la idea
clave dentro. Si no hay asociación defendible, no se inventa: se enseña con definición y ejemplo.

## 5. Diseño (móvil primero, 390 px)
Nada se sale de la pantalla (las palabras y el código largos se parten). Ningún elemento flotante tapa texto. Nada
avanza ni se cierra solo. Contraste legible en todos los fondos. Botón principal a todo el ancho. La sesión recuerda el
dispositivo 30 días. La app se actualiza sola (sin quedarse en una versión vieja).

## 6. Calidad: nada se publica sin pasar la puerta
`private/release.sh` es **la única forma de publicar**. Ejecuta: tipos, todas las pruebas, compilación, recorrido real
de cada curso en Flujo (empieza enseñando, ninguna pregunta sin ficha, nada avanza solo, al fallar enseña, sin
desbordamientos, termina bien), revisor de contenido (longitud, puente, idea clave, «se evalúa lo que se enseña»),
despliegue y verificación en producción (cabeceras de caché y reglas del plan de sesión). Si algo falla, no se publica.

## 7. Contenido de ILERNA
Contenido propio (definiciones, mnemotecnias y preguntas redactadas por Memora); los libros solo indican qué temas
cubrir (regla 16). Prioridad: los módulos del semestre en curso, libro a libro y apartado a apartado.
