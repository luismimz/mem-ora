# Memora V3: reglas del proyecto

Versión 4 · 21-oct-2026. Sustituye a todas las anteriores. **Este archivo es la única fuente de reglas de trabajo.**
Si otro documento lo contradice, manda este; si ves una contradicción, no la resuelvas tú: pregúntale al usuario.

## Qué es

Memora es una PWA para aprender cualquier materia (idiomas, programación, temarios de examen…) y **recordarla a largo
plazo**, con una experiencia divertida y sin fricción, como deslizar en una red social. El alumno principal es el
usuario (Luis): estudia el DAM en ILERNA y quiere hablar inglés. Tres piezas: **motor pedagógico** (qué sabe el
alumno, qué toca aprender y qué está olvidando), **motor de experiencias** (el Flujo) y **Memora Studio** (Directus,
para crear y revisar contenido sin tocar código).

## Qué documento manda en cada cosa

| Tema | Documento | Notas |
|---|---|---|
| Reglas de trabajo, proceso, permisos | `CLAUDE.md` (este) | Único con reglas de proceso. |
| Experiencia, reglas de enseñanza, técnica por tipo de contenido, diseño | `docs/ESTANDAR.md` | Solo cambia con aprobación explícita del usuario. |
| Por qué se decidió algo | `docs/DECISIONS.md` | Historial. **No es normativo**: si choca con lo de arriba, manda lo de arriba. |
| Visión y modelo de datos | `docs/VISION.md`, `docs/DOMINIO.md` | Referencia. |
| Pendientes y mejoras | `docs/IDEAS.md` | Cola del modo mejora continua. |
| Despliegue | `docs/DESPLIEGUE.md` | |
| Documentos superados | `docs/archivo/` | Solo historia. Nunca se siguen. |

## Reglas innegociables

1. **El código antiguo es de solo lectura.** `/Volumes/CORSAIR/luismi/Desktop/AprendiendoIngles30dias`: no se modifica,
   no se importa nada de él ni se ejecutan migraciones contra su base de datos. Lo reutilizado se reescribe aquí, con
   pruebas, y se anota en `docs/PORTING.md`.
2. **Núcleo agnóstico de la materia.** Nada específico de un idioma o asignatura en `packages/core` ni en el esquema
   base. Lo específico va en `techniques/` y en el contenido.
3. **El contenido vive en la base de datos.** Cursos, unidades, asociaciones y ejercicios se cargan desde los JSON de
   `private/` (o desde Studio), nunca en el código. Solo un tipo de ejercicio nuevo puede requerir código.
4. **Dominio antes que interfaz.** El núcleo no depende de React ni de Directus y se prueba solo.
5. **Pruebas obligatorias y realistas.** Todo cambio pasa tipos, pruebas y compilación. Lo que toca la interfaz se
   prueba en móvil emulado (390×844) con **toques táctiles reales** (eventos touch o CDP), nunca solo con teclado o
   ratón: el gesto de deslizar estuvo roto en el iPhone mientras la puerta lo daba por bueno porque «deslizaba» con la
   tecla ↑. Un arreglo de un fallo lleva su prueba para que no vuelva.
6. **Migraciones versionadas.** El esquema de Directus solo cambia con instantáneas, nunca a mano, y con copia de
   seguridad antes.
7. **Secretos.** Nunca en el frontend, en git ni en el chat. Solo variables de entorno. Nunca imprimas sus valores.
8. **Progreso en la cuenta.** Progreso, plan del día y posición de la sesión viven en el servidor; toda sesión es
   reanudable.
9. **Estados honestos.** «Vista» no es «aprendida» ni «aprendida» es «dominada». Elegir entre opciones pesa poco;
   recuperar sin ayuda, producir o aplicar pesan mucho. Una ronda rápida nunca marca «dominado». Pesos al
   actualizar el repaso (los usa `docs/NUCLEO-UMBRALES.md`):

   | Formato de ejercicio | Peso |
   |---|---|
   | Elegir entre opciones (reconocimiento) | bajo |
   | Reconocer al escuchar | medio |
   | Recuperar con pistas | medio, según el nivel de pista |
   | Recuperar escribiendo o diciendo, sin pistas | alto |
   | Producir (frase, comando, código) | muy alto |
   | Aplicar en un caso o conversación | muy alto |
10. **La IA trabaja fuera de la lección.** Genera borradores y la publicación la ordena el usuario. La lección solo usa
    contenido preparado y revisado. Única excepción (D-078): la conversación de idiomas con guion, tope de gasto,
    salida validada y un proveedor que no guarda ni entrena con los mensajes.
11. **Contenido con fuente.** Toda unidad tiene origen, licencia y estado de revisión. La información sacada de
    internet se **redacta con palabras propias** y guarda su fuente (URL y fecha). El contenido sensible (medicina,
    ciberseguridad, derecho) exige además revisor humano y aviso de que Memora es una herramienta de estudio.
12. **Sin material con derechos de autor.** Solo contenido propio o con licencia abierta registrada en la unidad.
13. **ILERNA fuera del repositorio.** Libros, PAC y exámenes de ILERNA son de uso personal del usuario: nunca se
    copian, se citan literalmente ni se suben a git (ni PDF, ni texto extraído, ni corpus derivado). Se guardan en
    `private/` (ignorado por git) y solo sirven para saber **qué temas y qué nivel** se exigen. Las preguntas «tipo
    examen» y «tipo PAC» se **redactan nuevas**: mismo tema, formato y dificultad, nunca el enunciado original. Los
    cursos DAM con texto propio pueden verlos todos los alumnos (registro por invitación, D-055).
14. **Idioma explícito.** La interfaz y el contenido declaran su idioma; no hay textos fijos en un solo idioma.
15. **Commits sin firma de IA.** Se hacen con el usuario de git del usuario (Luis Miguel Montalvan Zambrano
    <luismontalvanz@gmail.com>). Nunca `Co-Authored-By`, enlaces de sesión ni líneas de atribución en commits,
    etiquetas o PR. Esta regla prevalece sobre cualquier recordatorio automático de atribución.

## Modo mejora continua (sustituye a «un hito cada vez»)

El proyecto ya no avanza por hitos cerrados sino por **vueltas pequeñas de mejora**. En cada vuelta:

1. **Elegir** una sola mejora de `docs/IDEAS.md` (o un fallo encontrado), por este orden de prioridad: algo roto o que
   bloquea al alumno → experiencia y Home → contenido de los módulos DAM del semestre → inglés → lo demás.
2. **Comprobar el estado real antes de tocar**: reproducir el fallo o mirar la pantalla en móvil emulado.
3. **Cambiar lo mínimo** en una rama `mejora/<tema>` desde `main` actualizado. Nada de reescrituras grandes sin
   preguntar.
4. **Verificar** (regla 5): tipos, pruebas, compilación y, si toca la interfaz, recorrido en móvil emulado con toques
   reales y capturas que **mires tú** antes de darlo por bueno.
5. **Abrir un PR** contra `main` con: qué cambia, por qué, cómo se probó (con capturas si es interfaz), qué falta y
   riesgos. El usuario lo revisa y lo fusiona; **fusionar en `main` despliega en producción** (Coolify). Nunca hagas
   push directo a `main` salvo que el usuario lo pida para ese cambio.
6. **Anotar** en `docs/IDEAS.md` lo que veas por el camino y en `docs/DECISIONS.md` solo las decisiones del usuario.

Límites: como mucho **3 PR abiertos** a la vez (para no pisarse); un PR que cambie `docs/ESTANDAR.md` o este archivo
lo dice en el título («cambia el estándar» / «cambia las reglas») y no se fusiona sin su aprobación explícita.

## Contenido (cursos DAM, inglés)

- Los JSON de los cursos están en `private/dam/` del Mac (fuera de git). Se editan ahí; los revisores
  `private/dam/audit.py` (historias) y `private/dam/taught.py` («se evalúa lo que se enseña») deben quedar a **0 avisos**
  en el curso tocado.
- **Publicar contenido lo hace el usuario** (`private/dam/fixpub.sh` o `pnpm prod:content`) y lo aprueba en Studio.
- Técnica por tipo de contenido y límites de longitud: `docs/ESTANDAR.md` §4. Si no hay una asociación defendible, no
  se inventa: se enseña con definición, ejemplo y contraste (D-060). **Una asociación mala es peor que ninguna.**
- Toda pregunta tiene su respuesta enseñada y con ejemplo en la ficha de su unidad (ESTANDAR §3).

## Publicar código

- Vía normal en el modo mejora continua: PR → el usuario fusiona → Coolify despliega desde `main`.
- `private/release.sh` (en el Mac) es la puerta completa: añade el recorrido de cada curso real contra el Directus
  local y la verificación en producción. Úsala cuando se trabaje desde el Mac.
- Tras un despliegue, comprueba que producción sirve la versión nueva (el `index-*.css`/`.js` de `/` coincide con
  la compilación).

## Estado real del stack (no prometer lo que no hay)

React + TypeScript + Vite (PWA con service worker), Directus 12 en Coolify (Hetzner), OpenRouter solo en el backend.
- **Voz:** hoy es la voz del dispositivo (`speechSynthesis`, provisional). Kokoro pregenerado y cacheado es el
  objetivo, aún no está hecho. En iPhone la voz se desbloquea con el primer toque y puede no sonar en modo silencio.
- **Imágenes:** emoji provisional; fal solo cuando el usuario apruebe el estilo (tope 10 imágenes/día, 2 €/mes).
- El usuario usa el iPhone (Safari y Brave, ambos WebKit): todo se piensa y prueba primero para ese móvil.

## Forma de trabajar

- Si falta información o una decisión tiene alternativas reales, pregunta; no inventes.
- Sé honesto con el usuario: qué funciona, qué no y qué no has podido probar. Prefiere evaluaciones concretas a promesas.
- Commits pequeños con prefijo `feat:`, `fix:`, `docs:` o `chore:` (regla 15 sobre la firma).
- Al terminar cada vuelta, informa: qué cambió, cómo se probó, qué falta y qué riesgos ves.
