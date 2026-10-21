# Estándar de Memora (congelado)

Versión 2 · 21-oct-2026 · aprobado por el usuario al pedir «establecer de una vez cada parte» (D-075); versión 2 con
sus respuestas del mismo día: deslizar sin botones, feed infinito, ejemplo visto para cada pregunta (D-077).
**Nada de este documento se cambia sin aprobación explícita del usuario.** Un fallo se corrige respetándolo y se añade
una comprobación automática para que no vuelva.

## 1. Promesa
Aprender un temario completo (los libros de ILERNA, idiomas, oposiciones…) y **recordarlo a largo plazo**, con una
experiencia **divertida, fluida y sin fricción**, como deslizar en una red social. Elegir bien qué técnica de memoria
usa cada cosa es tan importante como la interfaz.

## 2. La experiencia: modo Flujo (para todos los cursos, también idiomas desde D-078)
Pantalla completa, una tarjeta cada vez. **Se avanza deslizando hacia arriba; no hay botones de avance.** Al acertar, la
tarjeta pasa sola; al fallar, «Recuérdalo así» se queda hasta que deslizas. Arriba: barra de la ronda, XP y combo 🔥.
**Infinito:** cada ronda acaba en un hito dentro del feed y la siguiente ya está cargada; se sale con ✕ cuando quieras.

| Tarjeta | Qué hace | Reglas |
|---|---|---|
| **Ficha** («Nuevo para tu memoria», «Tus errores», «Refuerzo») | Enseña: emoji, nombre, idea clave, mnemotecnia (puente o analogía) y debajo **Qué es**, contraste y **todos sus ejemplos** | Nunca avanza sola. Todo lo que se pregunte después está aquí. «🤔 Explícame más» abre la letra pequeña y deja anotada la petición. |
| **Relámpago** | 3 opciones: idea → nombre o nombre → idea | Nunca se cierra sola. Rapidez = puntos extra, no penaliza. |
| **¿Verdad o mentira?** | «NOMBRE = idea»; deslizar → / ← o botones | Solo de conceptos ya enseñados. |
| **Pregunta jefe 👑** | Pregunta tipo examen o de código | Cada ~8 tarjetas, de algo ya visto. Al fallar, «Recuérdalo así» con la respuesta. |
| **Sube de nivel ⬆️** | Con 2 repasos superados, la pregunta se completa escribiendo (respuesta corta) | Solo en repasos, nunca la primera vez. |
| **Recuérdalo así** | Al fallar: la ficha completa y, si viene de una pregunta, su respuesta | La unidad vuelve 3 tarjetas después (repesca). |
| **Escríbelo** | Solo en idiomas: escribir la palabra | En conceptos solo se escribe al subir de nivel. |
| **Hito** («Ronda N completada») | XP de la ronda, racha, protectores 🛡️, aciertos, mejor combo, nuevos, próximo repaso | Se desliza y empieza la siguiente ronda. |

Orden de cada ronda: **repasos, tus errores, lo nuevo** y, si no queda nada de eso, **refuerzo de lo más débil**. Siempre
en parejas **ficha, ficha, pregunta, pregunta**. Lo nuevo empieza en 8 por ronda y sube con los aciertos (D-057); al
día, como mucho tres rondas de nuevas; después, el feed sigue con repasos, errores y refuerzo. Como mucho 10 repasos
por ronda. **Racha con protector:** cada 7 días de racha se gana un protector (máximo 2) que salva un día perdido.

## 3. Reglas de enseñanza (innegociables)
1. **Se enseña antes de preguntar.** Ninguna pregunta sobre algo sin su ficha antes en la misma ronda.
2. **Se evalúa lo que se enseña, con su ejemplo visto.** Cada respuesta aparece en la ficha de **su** unidad (la que
   se enseña justo antes); si es código (un método, una clase, una opción), en un ejemplo que diga qué hace (D-077).
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
Nada se sale de la pantalla (las palabras y el código largos se parten). Ningún elemento flotante tapa texto. Lo que
hay que leer nunca avanza ni se cierra solo; solo pasa sola la tarjeta que ya has respondido bien. Contraste legible en todos los fondos. Botón principal a todo el ancho. La sesión recuerda el
dispositivo 30 días. La app se actualiza sola (sin quedarse en una versión vieja).

## 6. Calidad: nada se publica sin pasar la puerta
`private/release.sh` es **la única forma de publicar**. Ejecuta: tipos, todas las pruebas, compilación, recorrido real
de cada curso en Flujo (empieza enseñando, ninguna pregunta sin ficha, nada avanza solo, al fallar enseña, sin
desbordamientos, sin botones de avance, el hito encadena la ronda siguiente), revisor de contenido (longitud, puente, idea clave, «se evalúa lo que se enseña»),
despliegue y verificación en producción (cabeceras de caché y reglas del plan de sesión). Si algo falla, no se publica.

## 7. Contenido de ILERNA
Contenido propio (definiciones, mnemotecnias y preguntas redactadas por Memora); los libros solo indican qué temas
cubrir (regla 16). Prioridad: los módulos del semestre en curso, libro a libro y apartado a apartado.
