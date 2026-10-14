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

`association` (opcional): `technique` (`absurd_scene` o `phonetic_bridge`), `scene` (máximo 14 palabras, pieza clave
en MAYÚSCULAS), `cue`, `sceneTarget` (la escena en el idioma del contenido), `emoji`, `evidence` (puente fonético).

## Copia completa

`pnpm backend:export` guarda en `backend/backups/export-<fecha>/` un archivo por curso en este formato y
`alumnos.json` con los eventos de aprendizaje, posiciones y planes (el progreso se recalcula desde los eventos).
