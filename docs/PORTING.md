# Registro de reutilización (PORTING)

Cada pieza que se trae del repositorio antiguo se registra aquí. Se reescribe, no se copia entera.

| Pieza                     | Origen (ruta antigua)            | Destino (ruta nueva)           | Por qué se reutiliza      | Qué se cambió                               | Pruebas     | Estado    |
| ------------------------- | -------------------------------- | ------------------------------ | ------------------------- | ------------------------------------------- | ----------- | --------- |
| Ejemplo: proveedor Kokoro | backend/extensions/.../kokoro.js | packages/content/tts/kokoro.ts | Funciona y está conectado | Caché por huella, idioma, velocidad, léxico | tts.test.ts | Pendiente |

## Reglas

- Una pieza no se considera portada hasta tener pruebas propias.
- Si se descubre un comportamiento oculto en el código antiguo, se anota en `DECISIONS.md`.
- Lo que se descarta también se anota, con el motivo.
- Todo lo que se porte debe quedar sin nada específico de inglés en el núcleo.
