# Ideas fuera del hito en curso

No se implementan hasta que un hito las incluya.

- **Nivel por unidad** (`ESPECIFICACION.md` §4): derivar «aprendida / estable / dominada» de una palabra o concepto
  combinando sus habilidades (recuperar, escuchar, producir) y sus formatos. Pendiente de decisión (D-018).
- **Lo dominado sale de la cola diaria** y solo vuelve en tests de retención (30 y 90 días), como propone
  `ESPECIFICACION.md` §4. Hoy lo dominado se sigue programando con el calendario normal (+30 d).
- **Repasos que no reinicien el plazo de nivel:** si la compuerta de 7/30 días resulta demasiado espaciada en uso
  real, permitir repasos «de mantenimiento» que no cuenten como exposición (alternativa descartada en D-018).
- **Estrategia de prioridad con muchos vencidos** (H6): hoy se repasa primero lo más retrasado, que es también lo
  más probablemente olvidado. Comparar con «lo más próximo a olvidarse pero aún recuperable».
- **Evaluar FSRS** cuando haya historiales reales (detrás de la interfaz `Scheduler`).
- **Umbral de «dudado» por formato** (escribir código lleva más que elegir una opción).
- **Revisión de asociaciones en la experiencia** (H2/H4): mientras una asociación está en revisión, ¿se sigue
  mostrando, se oculta o se ofrece la vía alternativa (otra técnica)?
- **Medición de retención por ventanas** de la V1 (`shared/retention.mjs`: +1 h, +24 h, +7 d, +30 d por asociación)
  para el panel de calidad de técnicas (H6/H8).
- **Zona horaria por alumno** en `dayOriginMs` (H2).
