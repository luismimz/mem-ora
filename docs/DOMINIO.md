# Dominio de Memora: modelo universal

## Entidades (agnósticas de la materia)

- **Course**: curso o paquete de contenido (`title`, `subject`, `uiLanguage`, `contentLanguage`,
  `license`, `status`). Ejemplos: «Inglés», «Java básico», «Ciberseguridad: fundamentos».
- **Module**: agrupación ordenada dentro de un curso (un «mundo», un tema, un capítulo).
- **KnowledgeUnit**: la unidad que se aprende. Tiene `type`, `payload` (JSON validado por tipo), `language`,
  `sources[]`, `license`, `status`, `reviewedBy`, `lastVerified` y `riskLevel` (bajo, medio, alto).
- **Skill**: capacidad ligada a una unidad: reconocer, recuperar, producir, aplicar, escuchar, hablar.
- **Prerequisite**: una unidad o habilidad requiere otra antes de poder practicarse.
- **Association**: ayuda de memoria de una unidad (`technique`, `text`, medios, `evidence`, `status`, `reviewedBy`).
- **Technique**: módulo pedagógico registrado (puente fonético, espejo, analogía, escena absurda, palacio, trazado de código).
- **Experience**: receta JSON versionada que describe una experiencia (aventura, Arcade, ficha, caso).
- **UserKnowledge**: estado de cada habilidad de cada usuario (estado, fuerza, próximo repaso, fallos, nivel de pista).
- **Attempt**: intento con evidencia (formato, acierto, pista usada, tiempo, contexto).
- **DailyPlan / Session**: plan del día y posición reanudable.
- **Media**: audio, imágenes y archivos con idioma, huella y licencia.
- **ReviewTask**: cola de revisión humana de contenido.
- **ContentVersion**: versión de cada unidad para recuperar estados anteriores.

## Tipos de conocimiento y formatos de ejercicio

| Tipo                   | Ejemplos                                          | Campos principales                        | Formatos de ejercicio                                           |
| ---------------------- | ------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| `term` (vocabulario)   | palabra, expresión, phrasal verb, forma irregular | lemma, traducción, pronunciación, ejemplo | recuperar, imagen a término, escuchar, construir frase, ordenar |
| `pattern` (estructura) | ficha espejo, regla gramatical                    | piezas, regla, avisos, ejemplos           | descubrir, construir, trío, detective de errores                |
| `concept`              | ACID, XSS, diástole, polimorfismo                 | término, definición, ejemplo, analogía    | recuperar, completar huecos, verdadero o falso, caso            |
| `command`              | SQL, git, Linux, sintaxis de Java o PHP           | sintaxis, parámetros, ejemplo, salida     | completar, ordenar, predecir resultado, detective de errores    |
| `code_snippet`         | un método, una consulta, una expresión            | código, lenguaje, salida, explicación     | predecir la salida, completar, encontrar el fallo               |
| `procedure`            | respuesta a un incidente, protocolo clínico       | pasos ordenados, condiciones              | ordenar pasos, completar el paso que falta                      |
| `fact`                 | puerto, cifra, umbral, fecha                      | valor, unidad, contexto, fuente           | recuperar, comparar                                             |
| `case`                 | caso práctico                                     | escenario, opciones, justificación        | decidir, justificar                                             |
| `image_label`          | anatomía, diagramas, arquitectura                 | imagen, etiquetas                         | etiquetar, imagen a término                                     |
| `formula`              | fórmulas                                          | fórmula (LaTeX), variables                | completar, aplicar                                              |

Cada tipo declara su esquema, sus formatos de ejercicio admitidos y su validador. Añadir un tipo nuevo es
el único cambio que puede requerir código.

## Técnicas como módulos

| Técnica            | Sirve para                        | Notas                                                                                                    |
| ------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Puente fonético    | Vocabulario de idiomas            | Palabra real y familiar; evidencia del parecido y de las diferencias                                     |
| Espejo             | Estructuras de un par de idiomas  | Específico de cada par; francés e italiano necesitan reglas propias y revisión de un hablante competente |
| Analogía           | Conceptos                         | «Puente desde lo que ya sabes»; por ejemplo, un JOIN como cruzar dos hojas de cálculo                    |
| Escena absurda     | Cualquier unidad memorable        | Máximo 14 palabras, acción visual                                                                        |
| Palacio de memoria | Procedimientos y listas ordenadas | Recorrido de lugares conocidos                                                                           |
| Trazado de código  | Código y comandos                 | El alumno predice paso a paso antes de ver el resultado                                                  |

## Administrador (Studio)

Requisitos mínimos de la primera versión (Directus como Studio v0):

- Roles: administrador, autor y revisor.
- Crear y ordenar cursos, módulos, unidades, prerrequisitos y asociaciones desde formularios.
- Editor del `payload` con validación por tipo y mensajes de error comprensibles.
- Flujo de estados: `draft → needs_review → approved → published → deprecated`, con registro de quién cambió qué.
- Subida de medios y cola de generación de audio e imágenes con tope diario.
- Vista previa como alumno antes de publicar.
- Publicar, despublicar, versionar y volver a una versión anterior.
- Importar y exportar en JSON y CSV, con plantillas por tipo.
- Generación asistida por IA solo como borrador, con fuente obligatoria en contenido factual.
  Más adelante: editor visual de recetas, creación asistida más avanzada e importación de Anki.

## Contenido sensible

| Nivel de riesgo | Ejemplos                                    | Requisitos para publicar                                                                                                   |
| --------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Bajo            | Vocabulario, sintaxis básica                | Revisión del autor y validación automática                                                                                 |
| Medio           | Seguridad, programación avanzada, normativa | Fuente, licencia y revisor distinto del autor                                                                              |
| Alto            | Medicina, farmacología, derecho             | Fuente citada, revisión por un profesional, fecha de verificación y caducidad, aviso visible y nunca consejo personalizado |

Una unidad con `lastVerified` caducado vuelve a `needs_review` automáticamente.

## Idiomas

Separar siempre: idioma de la interfaz, idioma del alumno, idioma del contenido y técnica pedagógica. Un puente
fonético o un espejo español a inglés no sirve para otro par de idiomas. La voz y el léxico de pronunciación son
por idioma.
