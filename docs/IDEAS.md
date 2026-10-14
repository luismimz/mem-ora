# Ideas fuera del hito en curso

No se implementan hasta que un hito las incluya.

- **Arcade respeta las compuertas de nivel** (H3): el selector del Arcade no debe sacar habilidades «aprendidas»
  antes de 7 días ni «estables» antes de 30 días desde su última exposición. Si lo hiciera, la exposición reiniciaría
  el plazo y la habilidad nunca podría demostrar el nivel siguiente (D-018). Aplica a cualquier modo libre.

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
- **Botones de transición en el panel** (H2.2a o H8): hoy el estado es un desplegable con todos los valores y el
  servidor rechaza los no permitidos. Mejor mostrar solo «Enviar a revisión», «Aprobar», «Publicar»… según el rol.
- **Lista de comprobación del revisor** por técnica (`reviewChecklist`, p. ej. «el puente es una palabra real») visible
  en el panel al aprobar una asociación.
- **Editar lo publicado sin despublicar** con versiones de contenido de Directus (H8).
- **Despliegue con Directus 12 (H2.4):**
  - `IP_TRUST_PROXY=true` detrás del proxy de Coolify (el valor por defecto pasó a `false`);
  - `PUBLIC_URL` completa (`https://studio.luismontalvan.com`), obligatoria con licencia;
  - comprobación de vida con `/server/ping` (`/server/health` exige autenticación);
  - la imagen no trae `npx`: nada de comandos `npx directus` en el despliegue; el esquema se aplica por la API;
  - la licencia se revalida en línea (`offline_enabled: false`): el servidor necesita salida a Internet hacia el
    servicio de licencias de Directus;
  - confirmar cuántas activaciones admite la licencia antes de usarla en local y en producción a la vez.
- **Pasar a Directus 12.5.x** cuando lleve unas semanas publicada. Revisar antes las validaciones estrictas de
  `ip_access` y el nuevo cálculo del 2FA por políticas efectivas.
- **Alerta de licencia (H2.4, obligatoria antes de abrir a la familia):** vigilar `GET /license` (estado,
  `invalid_reason`, `token_expires_at`) y avisar al administrador si la revalidación falla. Según Directus: si la
  instancia no llega al servidor de licencias durante más de 7 días, baja a Core; tras el periodo de gracia de 30 días
  de una licencia caducada, **los alumnos no pueden iniciar sesión**; y si la clave va en el entorno y el servidor de
  licencias no responde al arrancar, **Directus no arranca**. La alerta debe llegar por un canal que no dependa de
  Directus (correo o notificación).
- **Higiene de activaciones (desde ya):** cada licencia tiene 5 activaciones, y cada una se ata a la base de datos y a
  la `PUBLIC_URL`. Destruir la base (`docker compose down -v`) sin desactivar deja la activación ocupada. Las pruebas
  de reconstrucción desde la instantánea deben hacerse en una instancia aparte **sin licencia**, y las de permisos en
  el entorno persistente.
- **Prueba de recorrido en el navegador** (H2.2b): automatizarla con Playwright, junto con el modo sin conexión. En el
  H2.2a el recorrido se prueba por la API con el mismo motor que la app, pero la interfaz no se ha visto con pruebas
  automáticas.
- **Recálculo incremental** del estado del alumno: hoy se recalcula con todos sus eventos en cada envío. Basta para el
  H2; con muchos eventos convendrá partir de la última instantánea.
- **Experiencia «aplicar»** (caso o minidiálogo) para que los patrones vuelvan a tener esa habilidad (H7).

## Materias que no son idiomas (siguientes pasos tras D-042)
- ~~Ejercicios de concepto~~ hecho en D-043.
- Tipos `procedure` (pasos ordenados: subredes) y `comparison` (TCP frente a UDP), si los conceptos no bastan.
- Prerrequisitos en el archivo de curso JSON (`requires: ["class"]`).
- Hueco de la espiral configurable por curso: Gramática en idiomas, mini-reto de código en Java, caso en redes (recetas, H4).
- Importar contenido sensible con revisor, fecha de verificación y aviso (regla 13).
