# Registro de reutilización (PORTING)

Cada pieza que se trae del repositorio antiguo se registra aquí. Se reescribe, no se copia entera.

| Pieza                     | Origen (ruta antigua)            | Destino (ruta nueva)           | Por qué se reutiliza      | Qué se cambió                               | Pruebas     | Estado    |
| ------------------------- | -------------------------------- | ------------------------------ | ------------------------- | ------------------------------------------- | ----------- | --------- |
| Ejemplo: proveedor Kokoro | backend/extensions/.../kokoro.js | packages/content/tts/kokoro.ts | Funciona y está conectado | Caché por huella, idioma, velocidad, léxico | tts.test.ts | Pendiente |
| Escalones de repaso y «dudado» por tiempo | frontend/src/lib/srs.ts | packages/core/src/scheduler.ts, evidence.ts | Calendario 1 h…30 d y umbral de 9 s probados en la V1 | Reescrito desde cero: peso por formato y pista, tope para aciertos débiles, facilidad por precisión, interfaz `Scheduler`; sin `ok/doubt/fail` | skill.test.ts, evidence.test.ts | Portado (H1) |
| Capacidades por dirección de recuerdo | memora-v2/src/domain/memory.ts | packages/core/src/skill.ts (habilidades por tipo) | Separar reconocer, oír, recuperar y producir | Pasa a ser una habilidad por tipo en el catálogo; sin palabras ni `localStorage` | skill.test.ts | Portado (H1, concepto) |
| Revisión de asociaciones por fallos | memora-v2/src/domain/memory.ts (`associationNeedsReview`) | packages/core/src/association.ts | Umbral de fallos y comparación de versiones | Estado propio, calendario +1…+30 d, escalera E0–E5, diagnóstico; la versión reinicia la medición | association.test.ts | Portado (H1, concepto) |
| Eventos idempotentes | memora-v2/src/services/progressSync.ts, backend/.../core/progress.js | packages/core/src/learner.ts | Patrón correcto para progreso en servidor | Idempotencia por id en el núcleo; orden cronológico; serialización estable. El servidor llega en el H2 | learner.test.ts | Portado (H1, parte del núcleo) |
| Señales de fatiga | memora-v2/src/domain/memory.ts (`shouldReduceDifficulty`) | packages/core/src/planner.ts (`newLoadFactor`) | Reducir carga ante malas rachas | Solo por precisión de días anteriores; sin tiempo ni abandono todavía | planner.test.ts | Portado (H1, parcial) |
| Arcade, desafíos, sesión V1, `phrasal`, irregulares | varios | — | — | — | — | Fuera del H1 |
| Esquema de Directus | backend/scripts/setup-schema.mjs | — | — | Descartado: esquema a mano. Sustituido por `backend/schema` (instantánea) y `backend/access` | — | Descartado (H2.1) |
| Clave idempotente de eventos | backend/extensions/memora-ai/dist/core/progress.js | colección `learning_events` (`event_key`) | Patrón ya probado en la V2 | Campos para sin conexión: id del cliente, dispositivo, orden, hora del dispositivo y de recepción | studio.test.ts (esquema); endpoint en el H2.2a | Parcial (H2.1) |

## Reglas

- Una pieza no se considera portada hasta tener pruebas propias.
- Si se descubre un comportamiento oculto en el código antiguo, se anota en `DECISIONS.md`.
- Lo que se descarta también se anota, con el motivo.
- Todo lo que se porte debe quedar sin nada específico de inglés en el núcleo.

## Notas de despliegue (Directus 12)

- El repositorio antiguo usaba `directus/directus:11.17.4` y `/server/health` en sus comprobaciones; en la 12 ese
  endpoint exige autenticación. Memora usa `/server/ping`.
- Los guiones antiguos ejecutaban `npx directus …` dentro de la imagen; la 12 ya no trae `npx`. Memora aplica el
  esquema por la API (D-028).
