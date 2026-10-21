# Umbrales del núcleo: valor, porqué y cómo validarlo

> **Todos los valores de este documento son hipótesis.** Se eligieron con criterio, no con datos de alumnos
> reales. Viven en `packages/core/src/config.ts` (`defaultConfig`) y se cambian sin tocar la lógica.
> Cada uno indica qué dato real lo confirmaría o lo corregiría.
>
> **Los números de la simulación (`tools/simulate`, `docs/archivo/SIMULACION-H1.md`) no son predicciones.** Salen de
> alumnos sintéticos con un modelo de memoria inventado y calibrado a mano. Demuestran que el mecanismo funciona
> (los estados avanzan, los topes se respetan, los vencidos se recuperan), no cuántas palabras o conceptos
> aprenderá una persona real ni en cuánto tiempo.

## Evidencia (`evidence`)

| Umbral | Valor | Porqué | Cómo validarlo |
| --- | --- | --- | --- |
| `formatWeight` | elegir 0,2 · reconocer al escuchar 0,5 · dictado 0,75 · explicar lo oído 0,75 · con pistas 0,5 · recuperar 0,75 · producir 1 · aplicar 1 | Traduce la tabla de `CLAUDE.md` (bajo, medio, alto, muy alto) a una escala 0–1 lineal. Elegir entre 4 opciones acierta un 25 % al azar: por eso pesa poco. El dictado y la explicación libre de lo oído son recuperar sin pistas a partir del audio: pesan «alto», como recuperar. | Comparar, por formato, la probabilidad de acertar sin pista días después. Un formato cuyo acierto no predice el recuerdo posterior debe pesar menos. |
| `hintFactor` | P0 1 · P1 0,8 · P2 0,6 · P3 0,4 · P4 0,2 · P5 0 | Cada escalón de pista quita una parte igual del mérito. P5 revela la respuesta: no es evidencia. | Ver si los aciertos con pista alta predicen recuerdos posteriores; si no, bajar esos factores. |
| `slowMs` | 9 s | Heredado de la V1, donde un acierto de más de 9 s se marcaba como «dudado». | Distribución real de tiempos por formato y longitud de la respuesta. Probablemente debe depender del formato (escribir código lleva más que elegir). |
| `slowFactor` | 0,7 | Un acierto dudado sigue siendo un acierto, pero aún no es automático. | Recuerdo posterior de los aciertos lentos frente a los rápidos. |
| `retrievalFormats` | dictado, explicar lo oído, con pistas, sin pistas, producir, aplicar | Reconocer (elegir una opción o reconocer al escuchar) no exige recuperar de memoria. | Fijo por definición; se revisaría solo si aparece un formato nuevo. |

## Éxito diferido (`deferred`)

Definición: un acierto **sin pista** (`maxHint: 0`), en formato de **recuperación o producción**
(`listening_transcribe`, `listening_explain`, `recall_unaided`, `production`, `application`; nunca
reconocimiento) y tras **al menos 20 horas** desde la última exposición a esa habilidad (`minElapsedMs`).
Cualquier intento, incluso fallido, cuenta como exposición. En escucha, volver a oír el audio no es una pista.

| Umbral | Valor | Porqué | Cómo validarlo |
| --- | --- | --- | --- |
| `minElapsedMs` | 20 h | Separa «lo recuerdo porque lo acabo de ver» de «lo recuerdo de verdad», e incluye una noche de sueño. 20 h y no 24 h para que estudiar a horas algo distintas cada día cuente igual. | Comparar el recuerdo a 7 días de habilidades cuyo primer éxito diferido fue a 20 h frente a 3 días. |
| `formats` | dictado, explicar lo oído, sin pistas, producir, aplicar | Mandato del usuario: recuperación o producción, nunca solo reconocimiento. `recall_cued` queda fuera porque tiene pista. | Fijo por decisión de producto. |
| `maxHint` | 0 | Mandato del usuario: sin pista. | Fijo por decisión de producto. |

## Niveles: aprendida, estable, dominada (`skill`, `levels`)

| Nivel | Condición | Umbral |
| --- | --- | --- |
| **Aprendida** (`learned`) | Desde «en consolidación», `deferredSuccessesToLearn` éxitos diferidos (≥ 20 h sin exposición) | 2 |
| **Estable** (`stable`) | Desde «aprendida», un acierto sin pista en recuperación o producción tras ≥ `levels.stable.minElapsedMs` **sin exposición** | 7 días |
| **Dominada** (`mastered`) | Desde «aprendida» o «estable», un acierto sin pista tras ≥ `levels.mastered.minElapsedMs` **sin exposición** | 30 días |

- **Porqué de 7 y 30 días:** son los plazos de `VISION.md` y del panel de retención previsto («recuerdo a 7 y
  30 días con unidades no repasadas»). Un recuerdo que sobrevive una semana sin ver la unidad ya no depende de la
  memoria reciente; uno que sobrevive un mes se acerca al largo plazo.
- **«Sin exposición»:** el plazo se cuenta desde la última vez que el alumno vio o practicó esa habilidad, no
  desde que se aprendió. Practicar antes lo reinicia. Es lo más estricto y lo más honesto, pero significa que un
  repaso adicional (por ejemplo, en Arcade) retrasa la prueba de nivel. Alternativa descartada por ahora: contar
  desde que se alcanzó el nivel anterior, con repasos intermedios permitidos (mediría «recuerda con práctica»,
  no «retiene sin práctica»).
- **Compuerta de nivel:** el programador no vuelve a pedir una habilidad «aprendida» antes de 7 días ni una
  «estable» antes de 30 (si su escalón proponía antes, se aplaza). Sin esa compuerta, el calendario normal
  (+7 d × facilidad 0,8 = 5,6 d) impediría llegar nunca a «estable».
- **Salto directo:** si el acierto llega tras ≥ 30 días desde «aprendida», pasa directamente a «dominada»
  (también ha demostrado los 7 días).
- **Consecuencia:** en una simulación de 30 días **nada puede estar dominado**, porque la primera exposición es el
  día 1. Coincide con `ESPECIFICACION.md` («una palabra vista cerca del día 30 no puede estar dominada todavía»).
- **Validar con:** recuerdo sin pista a 7 y 30 días de unidades no repasadas, y si lo «dominado» sigue
  acertándose a 90 días.

Un fallo de recuperación en «aprendida», «estable» o «dominada» la pasa a «debilitada». Recuperarla exige un
éxito diferido (vuelve a «en consolidación») y luego volver a superar cada plazo.

## Tipos de habilidad y nivel por unidad (`skillFormats`, `unitLevels`)

| Tipo | Formatos que admite | ¿Puede consolidar? |
| --- | --- | --- |
| reconocer (`recognize`) | elegir entre opciones | No: nunca pasa de «en aprendizaje» |
| escuchar (`listen`) | reconocer al escuchar, dictado, explicar lo oído | Sí (dictado o explicación) |
| recordar (`recall`) | con pistas, sin pistas | Sí (sin pistas) |
| producir (`produce`), hablar (`speak`) | producir | Sí |
| aplicar (`apply`) | aplicar | Sí |

| Umbral | Valor | Porqué | Cómo validarlo |
| --- | --- | --- | --- |
| `masteredMinFormats` | 3 | `ESPECIFICACION.md` §4: «se resolvió en ≥ 3 formatos distintos (recuperar, audio, producir)». Si la unidad admite menos, se exigen todos los que admite (el validador lo informa). | Recuerdo a 90 días de unidades dominadas con 2 frente a 3 formatos. |
| `masteredMinContexts` | 2 | §4: «se usó en una frase propia en ≥ 2 contextos diferentes». Generalizado a cualquier materia: éxitos diferidos en ≥ 2 contextos (escena, frase, caso). | Transferencia: acierto en un contexto nuevo. |
| `contextsLimit` | 10 | Se guardan los últimos 10 contextos por habilidad; basta para contar variedad sin crecer sin límite. | Fijo. |

El nivel de una unidad es el de su habilidad más floja: una habilidad debilitada la deja sin nivel hasta recuperarla.

## Habilidad (`skill`)

| Umbral | Valor | Porqué | Cómo validarlo |
| --- | --- | --- | --- |
| `consolidatingEvidence` | 1,5 | Equivale a dos recuperaciones sin pista o a una producción y media. Siete reconocimientos llegarían a 1,4, y además hace falta al menos un acierto de recuperación: reconocer nunca basta. | Tasa de fallos en el primer repaso diferido según la evidencia acumulada al entrar en consolidación. |
| `failEvidencePenalty` | 0,5 | Un fallo de recuperación anula algo más de medio acierto: no borra lo aprendido, pero frena. | Comparar trayectorias con y sin penalización. |
| `deferredSuccessesToLearn` | 2 | Un éxito diferido puede ser suerte; dos en días distintos son un patrón. | Recuerdo a 7 días de lo aprendido con 2 éxitos frente a 3. |
| `failuresToWeakenConsolidating` | 2 | Una habilidad en consolidación tolera un fallo aislado; dos seguidos indican que no se sostiene. Lo aprendido, estable o dominado se debilita con un solo fallo de recuperación porque ya prometía retención. | Tasa de recuperación tras un fallo aislado. |
| `accuracyAlpha` | 0,3 | La precisión reciente pesa los últimos 3–4 intentos. | Estabilidad del factor de facilidad en datos reales. |
| `initialAccuracy` | 0,6 | Punto de partida neutro, algo prudente. | Precisión real media en el primer repaso. |

## Programador (`scheduler`, `adaptive-v1`)

| Umbral | Valor | Porqué | Cómo validarlo |
| --- | --- | --- | --- |
| `stepsMs` | 1 h · 3 h · 1 d · 3 d · 7 d · 14 d · 30 d | Curva del olvido decidida por el usuario (D-036); 30 d como mantenimiento. | Tasa de acierto al vencer cada escalón; el objetivo habitual es 85–90 %. |
| `retryDelayMs` | 4 h | Tras un fallo, se vuelve a intentar en otra sesión, no en la misma. | Acierto en el reintento según la espera. |
| `advanceMinWeight` | 0,5 | Abren los intervalos largos: recuperar sin pista (0,75; 0,53 si es lento) y producir o aplicar con pista hasta P2 (0,6). No los abren recuperar con pista (≤ 0,4) ni reconocer. | Comparar el recuerdo según el peso del acierto que hizo subir el escalón. |
| `weakSuccessMaxStep` | 3 (3 días) | **Añadido por la simulación.** Sin este tope, lo que solo se reconoce se repasaba a diario para siempre y saturaba el día. Con él, un acierto débil espacia hasta 3 días, pero los intervalos largos siguen exigiendo recuperación. Afecta sobre todo al reconocimiento puro, que nunca se consolida. | Carga diaria real y recuerdo de habilidades de reconocimiento a 3 días. |
| `failStepDrop` | 1 | Un fallo baja un escalón, no vuelve al principio (como en la V1). | Comparar con volver al escalón 0. |
| `easeMin` · `easeMax` | 0,8 · 1,2 | La precisión reciente alarga o acorta los intervalos ±20 %. Rango estrecho a propósito, hasta tener datos. | Si el acierto al vencer se aleja del 85–90 %, ampliar el rango o pasar a FSRS. |

FSRS: la interfaz `Scheduler` permite añadirlo en el registro `schedulers` sin tocar nada más. No se ha
implementado: evaluarlo exige historiales reales de intentos para ajustar sus parámetros.

## Asociación (`association`)

| Umbral | Valor | Porqué | Cómo validarlo |
| --- | --- | --- | --- |
| `stepsMs` | +1 d · +3 d · +7 d · +14 d · +30 d | Mandato del usuario. Es independiente del calendario de la habilidad. | Recuerdo sin pista de la asociación en cada escalón. |
| `failStepDrop` | 2 | Fallar una asociación es más grave que fallar una habilidad: si la ayuda de memoria no evoca nada, hay que volver a cerca del principio. | Comparar recuperación con bajadas de 1 y 2. |
| `maxRecommendedHint` | P4 | P5 es revelar la respuesta, no una pista. Si se recomendara P5, el alumno no podría volver a acertar nunca. | Fijo por diseño. |
| `failuresToReview` | 2 | Mandato del H1: tras dos fallos la asociación se marca para revisión. Se cuentan seguidos. | Proporción de asociaciones revisadas que de verdad eran malas. |
| `losingWindow` · `losingFailureRate` | 5 · 50 % | Detecta asociaciones que fallan de forma intermitente y nunca dos veces seguidas. También activa la revisión. | Igual que el anterior. |
| `losingHintLevel` | P3 | Necesitar la propia ayuda de memoria (P3) o más para recordar indica que no se ha interiorizado. | Recuerdo posterior de asociaciones que llegaron a P3. |
| `establishedStep` | 2 (+7 d) | Fallar tras haber superado el +3 d indica pérdida, no falta de práctica. No activa la revisión por sí solo; marca «se está perdiendo». | Recuperación de esas asociaciones tras un repaso. |
| `holdingStreak` | 2 | «Se está quedando» = dos recuperaciones diferidas sin pista seguidas y pista recomendada ≤ P1. | Recuerdo a 30 días de las marcadas «se está quedando». |
| `minRetrievals` | 2 | Con una sola recuperación no se diagnostica. | Fijo por prudencia. |

Al resolver una revisión con una asociación nueva, la versión sube y la medición empieza de cero: no se
mezclan los resultados de dos ayudas de memoria distintas.

## Prerrequisitos (`prerequisites`)

| Umbral | Valor | Porqué | Cómo validarlo |
| --- | --- | --- | --- |
| `minStatus` | en consolidación | Exigir «aprendida» bloquearía días (hacen falta dos éxitos diferidos). «En consolidación» exige ya evidencia de recuperación. Una habilidad debilitada no vuelve a bloquear lo que ya se desbloqueó. | Acierto en lo desbloqueado según el estado de lo requerido. |

Una habilidad de reconocimiento puro (`kind: recognize`) nunca llega a «en consolidación». Desde el H2.0,
`validateCatalog` **rechaza** un prerrequisito que la exija (error `prerequisite_unreachable`), y un requisito de
unidad solo exige las habilidades de esa unidad que pueden consolidar.

## Carga diaria (`load`)

| Umbral | Valor | Porqué | Cómo validarlo |
| --- | --- | --- | --- |
| `newCap` | 8 | `VISION.md` pide sesiones cortas (3–7 min, 15–20 en la ruta completa). 8 habilidades nuevas ≈ 3 unidades nuevas al día. | Tiempo medido por elemento en el H2 (objetivo: 10 palabras en ≤ 25 min). |
| `reviewCap` | 30 | ≈ 10–15 min de repaso a 20–30 s por elemento. | Tiempo real por repaso. |
| `totalCap` | 36 | Repaso + lo nuevo, sin pasar de una sesión razonable. | Abandono de sesiones largas. |
| `adaptWindowDays` · `adaptMinAttempts` | 3 días · 10 intentos | Ventana corta para reaccionar a una mala racha, con un mínimo para no reaccionar al ruido. | Estabilidad de la carga día a día. |
| `lowAccuracy` · `veryLowAccuracy` | 65 % · 45 % | Por debajo del 65 % se reduce lo nuevo a la mitad; por debajo del 45 % no entra nada nuevo. | Precisión real frente a la sensación de frustración (encuesta breve). |
| `minNewPerDay` | 3 | Siempre entra un mínimo de contenido nuevo, aunque haya atasco de repasos o mala racha: el atasco no puede impedir avanzar (D-037). Se reserva antes de repartir los repasos. Cada curso lo ajustará (inglés: 15 palabras por sesión). | Días sin contenido nuevo y retención de lo nuevo introducido con atasco. |
| `backlogSuppressNew` | 10 | Si quedan más de 10 vencidas fuera del día, no se añade nada nuevo: primero se recupera. | Simulación: tras 5 días de ausencia, 70 vencidas se recuperan en 3 días sin superar el tope. Falta confirmarlo con uso real. |
| `overdueCapRatio` | 3 | El retraso relativo prioriza, pero con tope, para que lo muy antiguo no acapare todo el día. | Comparar estrategias de prioridad (ver `IDEAS.md`). |
| `weakenedBonus` · `associationLosingBonus` | 1 · 0,5 | Lo debilitado y las asociaciones en apuros pasan delante de un vencido normal. | Recuperación de lo debilitado. |
| `dayOriginMs` · `dayLengthMs` | 0 · 24 h | Días en UTC por defecto; el origen permite la zona horaria del alumno. | Se fijará por alumno en el H2. |
