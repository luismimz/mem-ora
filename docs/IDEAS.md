# Ideas fuera del hito en curso

No se implementan hasta que un hito las incluya.

- **Validar prerrequisitos de reconocimiento** (H2): `validateCatalog` debería avisar si un prerrequisito apunta a
  una habilidad de solo reconocimiento, que nunca llega a «en consolidación» y bloquearía para siempre.
- **Estrategia de prioridad con muchos vencidos** (H6): hoy se repasa primero lo más retrasado, que es también lo
  más probablemente olvidado. Comparar con «lo más próximo a olvidarse pero aún recuperable».
- **Evaluar FSRS** cuando haya historiales reales (detrás de la interfaz `Scheduler`).
- **Umbral de «dudado» por formato** (escribir código lleva más que elegir una opción).
- **Revisión de asociaciones en la experiencia** (H2/H4): mientras una asociación está en revisión, ¿se sigue
  mostrando, se oculta o se ofrece la vía alternativa (otra técnica)?
- **Medición de retención por ventanas** de la V1 (`shared/retention.mjs`: +1 h, +24 h, +7 d, +30 d por asociación)
  para el panel de calidad de técnicas (H6/H8).
- **Zona horaria por alumno** en `dayOriginMs` (H2).
