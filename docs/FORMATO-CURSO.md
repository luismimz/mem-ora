# Formato de archivo de curso (JSON, versión 1)

Sirve para **importar** un curso completo desde Memora → Studio (botón «Studio» arriba, solo autoría y
administración) y es el mismo formato que produce **Exportar**. Ejemplos listos para probar:
[`ejemplos/curso-frances.json`](ejemplos/curso-frances.json) y [`ejemplos/curso-java.json`](ejemplos/curso-java.json).

## Cómo se importa

1. Eliges el archivo. Se **comprueba entero** y, si hay problemas, se listan con su sitio
   («Módulo 1 (cocina) › Unidad 2 (lait): Significado: es obligatorio.»). No se crea nada.
2. Si está bien, pulsas «Importar como borrador». Todo entra en **borrador**: curso, módulos, unidades y asociaciones.
3. Revisas y publicas en el panel de Studio como siempre (regla 12: nada se publica sin revisión).

Si algo falla a mitad de la creación, se borra lo creado: no quedan cursos a medias.

## Campos

`course`
| Campo | Obligatorio | Valor por defecto | Notas |
| --- | --- | --- | --- |
| `key` | sí | | minúsculas, números y guiones; único |
| `title` | sí | | |
| `contentLanguage` | sí | | idioma de lo que se aprende (`en`, `fr`; en Java, `en`) |
| `subject` | no | | idioma, programación, redes… |
| `learnerLanguage`, `uiLanguage` | no | `es` | |
| `newPerSession` | no | 15 | de 1 a 50 |
| `audio` | no | `true` | `false` en materias sin pronunciación |
| `modes` | no | los cuatro | `associations`, `grammar`, `arcade`, `chat` |
| `visibility` | no | `private` | lo importado empieza privado; se cambia al publicar |
| `riskLevel` | no | `low` | `medium`/`high` exige fuente y revisor (regla 13) |
| `license`, `sources` | no | | se heredan en cada unidad que no declare las suyas |

`modules[]`: `key`, `title`, `units[]` (al menos una).

`units[]` de tipo `term` (palabra, expresión, concepto): `key`, `type: "term"`, `text`, `meaning`, `examples[]`
(`text`, `translation`) y, opcionales, `form`, `partOfSpeech`, `pronunciation` (texto o `{ "ipa", "respelling" }`),
`notes`, `license`, `sources`.

`units[]` de tipo `pattern` (estructura): `goal`, `rule`, `pieces[]`, `examples[]`, `pitfalls[]`.

`units[]` de tipo `concept` (Java, redes, temarios…): `name` (lo que se recuerda: «class»), `gist` (idea clave
corta, ≤ 60 caracteres: «molde»; la usan la historia y los juegos), `definition` (completa, en la tarjeta),
`examples[]` (`text` —código, caso, cifra— y `explanation` opcional; **sin traducción**) y, opcionales,
`answers` (otras respuestas válidas al repasar: «clase»), `contrast` (con qué no confundirlo), `notes` y `exercises`.

`exercises[]` (retos de aplicación; si hay al menos uno, el concepto gana la habilidad «aplicar»):
| `kind` | Qué pide | Campos |
| --- | --- | --- |
| `predict_output` | ¿Qué imprime este código? | `prompt`, `code`, `answer`, `distractors` (≥ 2) |
| `fill_gap` | Completa el hueco | `prompt`, `code` con `___`, `answer`, `distractors` |
| `find_bug` | ¿Qué falla? (mejor respuesta corta: la línea o la palabra) | `prompt`, `code`, `answer`, `distractors` |
| `apply_case` | Aplica el concepto a un caso | `prompt`, `answer`, `distractors` |
| `order_steps` | Ordena los pasos | `prompt`, `steps` (≥ 3, en el orden correcto) |

Opcionales: `accepted` (otras respuestas válidas al escribir) y `explanation` (se muestra al corregir).
El primer día el reto se responde **con opciones** (evidencia baja); en el repaso, **escribiendo** u ordenando sin
ayuda (aplicación, evidencia muy alta). Por eso conviene que `answer` sea corta y escribible.

`association` (opcional): `technique` (`absurd_scene`, `phonetic_bridge` solo en términos, o `analogy` en conceptos y patrones), `scene` (máximo 14 palabras, pieza clave
en MAYÚSCULAS), `cue`, `sceneTarget` (la escena en el idioma del contenido), `emoji`, `evidence`.

- Puente fonético: `evidence` = `familiarMeaning`, `soundRelation`, `differences`.
- Analogía: `cue` es la cosa cotidiana («molde de galletas»), `scene` la comparación (≤ 25 palabras, pieza clave en
  MAYÚSCULAS) y `evidence` = `mapping` (qué corresponde a qué) y `breaksWhere` (dónde deja de valer). Las dos son
  obligatorias: una analogía sin límite declarado enseña cosas falsas.
- Trazado de código (solo conceptos): `scene` es una historia absurda y muy visual (≤ 30 palabras, elementos en
  MAYÚSCULAS) y `evidence.lines` el código, línea a línea (≥ 2), cada una con `note`: el comentario, que debe nombrar
  en MAYÚSCULAS un elemento de la historia. La tarjeta se recorre en tres toques: definición → historia → código.
  ```json
  { "technique": "code_trace", "scene": "En el pueblo hay una sola PIZARRA COMPARTIDA; cada PERRO que nace corre a SUMAR una raya.",
    "evidence": { "lines": [ { "code": "static int count = 0;", "note": "la PIZARRA del pueblo: una sola" },
                             { "code": "  Dog() { count++; }", "note": "cada PERRO que nace corre a SUMAR una raya" } ] } }
  ```

## Copia completa

`pnpm backend:export` guarda en `backend/backups/export-<fecha>/` un archivo por curso en este formato y
`alumnos.json` con los eventos de aprendizaje, posiciones y planes (el progreso se recalcula desde los eventos).
