# Salida de la simulación del H1

> **Estos números no son predicciones.** Salen de cuatro alumnos sintéticos con un modelo de memoria inventado y
> calibrado a mano. Sirven para comprobar que el mecanismo funciona (los estados avanzan, los topes diarios se
> respetan, los vencidos se recuperan tras una ausencia), no para estimar cuánto aprenderá una persona real.

Generada con `pnpm simulate` (30 días) y `pnpm simulate -- --days=60`. Es determinista: misma semilla, misma salida.

## Resumen: niveles alcanzados

### Por habilidad

| Alumno | Día | Aprendidas | Estables | Dominadas | En consolidación | En aprendizaje | Debilitadas | Sin empezar |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Idioma (102) | 30 | 41 | 56 | 0 | 4 | 0 | 1 | 0 |
| Programación (66) | 30 | 8 | 25 | 0 | 0 | 16 | 0 | 17 |
| Olvidadizo (102) | 30 | 30 | 10 | 0 | 31 | 19 | 5 | 7 |
| Ausente 5 días (102) | 30 | 46 | 40 | 0 | 10 | 3 | 0 | 3 |
| Idioma (102) | 60 | 8 | 60 | 23 | 11 | 0 | 0 | 0 |
| Programación (66) | 60 | 2 | 24 | 11 | 4 | 17 | 1 | 7 |
| Olvidadizo (102) | 60 | 27 | 55 | 2 | 15 | 0 | 3 | 0 |
| Ausente 5 días (102) | 60 | 4 | 81 | 13 | 4 | 0 | 0 | 0 |

### Por unidad (H2.0)

El nivel de una unidad es el de su habilidad más floja, y «dominada» exige además ≥ 3 formatos y ≥ 2 contextos (D-021).

| Alumno | Día | Aprendidas | Estables | Dominadas | Sin nivel |
| --- | --- | --- | --- | --- | --- |
| Idioma (36) | 30 | 27 | 5 | 0 | 4 |
| Programación (36) | 30 | 7 | 18 | 0 | 11 |
| Olvidadizo (36) | 30 | 3 | 0 | 0 | 33 |
| Ausente 5 días (36) | 30 | 23 | 3 | 0 | 10 |
| Idioma (36) | 60 | 6 | 18 | 2 | 10 |
| Programación (36) | 60 | 1 | 22 | 4 | 9 |
| Olvidadizo (36) | 60 | 13 | 7 | 0 | 16 |
| Ausente 5 días (36) | 60 | 3 | 29 | 0 | 4 |

- **A 30 días nada está dominado, por construcción:** dominar exige un acierto sin pista tras ≥ 30 días sin
  exposición, y la primera exposición es el día 1.
- **El reconocimiento puro no consolida:** en programación, de las 18 habilidades de reconocer conceptos, 15 siguen
  «en aprendizaje» y 3 no han empezado; ninguna pasa de ahí, a propósito.
- **Escuchar ya consolida:** en idioma, de las 30 habilidades de escuchar, 22 están «aprendidas», 7 «estables» y 1
  «en consolidación», gracias al dictado y a la explicación libre de lo oído.
- **«Sin empezar» en programación** se debe a los prerrequisitos encadenados del catálogo sintético.

**Columnas:**
- *nuevas / repasos:* elementos del plan de ese día.
- *aciertos:* aciertos sobre intentos.
- *vencidas:* habilidades vencidas al empezar el día.
- *fuera:* vencidas que no cupieron en el día.
- *nuevo-bloq:* no entra nada nuevo por exceso de vencidas.
- *en-apr / consol / aprend / estab / domin / debil:* habilidades en aprendizaje (incluye vistas), en consolidación, aprendidas, estables, dominadas y debilitadas.
- *asoc:* asociaciones que se están quedando, en formación (incluye sin datos), que se están perdiendo y marcadas para revisión.
- *unid:* unidades aprendidas, estables y dominadas según su nivel derivado.

## Detalle día a día (30 días)

```text
# Simulación de 30 días · topes: 8 nuevas, 30 repasos, 36 en total por día

## Alumno «idioma» · curso idioma

 día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | en-apr consol aprend estab domin debil | asoc: queda forma pierde revisar | unid: aprend estab domin
   1       sí      8        0      8/8        0      0              |      8      0      0     0     0     0  |           0      4       0        0  |            0     0     0
   2       sí      8        0      8/8        0      0              |     16      0      0     0     0     0  |           0      8       0        0  |            0     0     0
   3       sí      8        8    12/16        8      0              |     21      3      0     0     0     0  |           0     12       0        0  |            0     0     0
   4       sí      8       12    19/20       12      0              |     26      6      0     0     0     0  |           0     14       0        0  |            0     0     0
   5       sí      8        9    14/17        9      0              |     32      8      0     0     0     0  |           0     16       0        0  |            0     0     0
   6       sí      8       15    21/23       15      0              |     34     14      0     0     0     0  |           0     19       0        0  |            0     0     0
   7       sí      8       15    20/23       15      0              |     37     17      2     0     0     0  |           2     20       0        0  |            0     0     0
   8       sí      8       21    27/29       21      0              |     34     25      5     0     0     0  |           5     19       0        0  |            0     0     0
   9       sí      8       17    24/25       17      0              |     32     33      7     0     0     0  |           7     20       0        0  |            0     0     0
  10       sí      8       22    28/30       22      0              |     31     35     14     0     0     0  |           9     21       0        0  |            0     0     0
  11       sí      3       19    19/22       19      0              |     28     37     18     0     0     0  |          12     18       0        0  |            0     0     0
  12       sí      2       21    21/23       21      0              |     20     42     23     0     0     0  |          15     15       0        0  |            0     0     0
  13       sí      5       16    19/21       16      0              |     18     44     28     0     0     0  |          17     13       0        0  |            1     0     0
  14       sí      1       15    15/16       15      0              |     16     39     36     0     0     0  |          20     10       0        0  |            3     0     0
  15       sí      0       16    15/16       16      0              |      6     46     37     2     0     0  |          21      9       0        0  |            4     0     0
  16       sí      3       16    18/19       16      0              |      7     40     42     5     0     0  |          24      6       0        0  |            5     0     0
  17       sí      0       14    13/14       14      0              |      6     31     50     7     0     0  |          25      5       0        0  |            9     0     0
  18       sí      0       16    14/16       16      0              |      1     31     51    10     0     1  |          27      3       0        0  |           11     0     0
  19       sí      6       18    19/24       18      0              |      7     22     55    14     0     2  |          28      2       0        0  |           14     0     0
  20       sí      0       14    12/14       14      0              |      7     19     55    18     0     1  |          28      1       1        0  |           17     0     0
  21       sí      0       14    13/14       14      0              |      1     24     51    23     0     1  |          28      2       0        0  |           17     0     0
  22       sí      2       15    17/17       15      0              |      3     17     51    30     0     1  |          29      1       0        0  |           21     1     0
  23       sí      0        9      7/9        9      0              |      3     16     48    34     0     1  |          29      1       0        0  |           20     2     0
  24       sí      0       13     9/13       13      0              |      1     15     46    38     0     2  |          29      1       0        0  |           20     2     0
  25       sí      0       19    14/19       19      0              |      0     11     45    44     0     2  |          29      1       0        0  |           22     3     0
  26       sí      0       10     9/10       10      0              |      0     11     45    46     0     0  |          29      1       0        0  |           23     3     0
  27       sí      0        6      5/6        6      0              |      0      8     44    49     0     1  |          30      0       0        0  |           24     4     0
  28       sí      0       10     8/10       10      0              |      0      7     40    54     0     1  |          30      0       0        0  |           23     5     0
  29       sí      0        3      3/3        3      0              |      0      7     41    54     0     0  |          30      0       0        0  |           24     5     0
  30       sí      0        9      7/9        9      0              |      0      4     41    56     0     1  |          30      0       0        0  |           27     5     0

Día 30 (102 habilidades): aprendidas 41 · estables 56 · dominadas 0 · en consolidación 4 · en aprendizaje 0 · debilitadas 1 · sin empezar 0.
Día 30 (36 unidades): aprendidas 27 · estables 5 · dominadas 0 · sin nivel 4.

## Alumno «programación» · curso programación

 día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | en-apr consol aprend estab domin debil | asoc: queda forma pierde revisar | unid: aprend estab domin
   1       sí      8        0      8/8        0      0              |      8      0      0     0     0     0  |           0      4       0        0  |            0     0     0
   2       sí      8        0      8/8        0      0              |     16      0      0     0     0     0  |           0      8       0        0  |            0     0     0
   3       sí      8        8    16/16        8      0              |     20      4      0     0     0     0  |           0     12       0        0  |            0     0     0
   4       sí      5        8    13/13        8      0              |     21      8      0     0     0     0  |           0     13       0        0  |            0     0     0
   5       sí      2        8     8/10        8      0              |     20     11      0     0     0     0  |           0     13       0        0  |            0     0     0
   6       sí      1        7      4/8        7      0              |     20     12      0     0     0     0  |           0     13       0        0  |            0     0     0
   7       sí      1       14    12/15       14      0              |     20     10      3     0     0     0  |           3     10       0        0  |            3     0     0
   8       sí      1       14    15/15       14      0              |     20      7      7     0     0     0  |           7      6       0        0  |            7     0     0
   9       sí      1       11    10/12       11      0              |     19      6     10     0     0     0  |          10      3       0        0  |           10     0     0
  10       sí      3        6      7/9        6      0              |     21      6     11     0     0     0  |          10      3       0        0  |           10     0     0
  11       sí      0        7      5/7        7      0              |     21      5     12     0     0     0  |          10      3       0        0  |           10     0     0
  12       sí      0       14    11/14       14      0              |     17      7     14     0     0     0  |          11      2       0        0  |           11     0     0
  13       sí      3       10    13/13       10      0              |     17      8     16     0     0     0  |          12      2       0        0  |           11     0     0
  14       sí      1        4      3/5        4      0              |     18      6     18     0     0     0  |          13      1       0        0  |           13     0     0
  15       sí      0       12    11/12       12      0              |     16      7     16     3     0     0  |          13      1       0        0  |           11     3     0
  16       sí      2       12    12/14       12      0              |     17      6     14     7     0     0  |          13      1       0        0  |            9     7     0
  17       sí      0       11    11/11       11      0              |     17      5     12    10     0     0  |          13      1       0        0  |            6    10     0
  18       sí      0        3      2/3        3      0              |     15      7     12    10     0     0  |          13      1       0        0  |            6    10     0
  19       sí      2        9     9/11        9      0              |     17      5     13    11     0     0  |          14      0       0        0  |            7    10     0
  20       sí      0        9      7/9        9      0              |     17      3     13    13     0     0  |          14      0       0        0  |            8    11     0
  21       sí      0       14    12/14       14      0              |     16      3     11    16     0     0  |          14      0       0        0  |            9    11     0
  22       sí      0        7      7/7        7      0              |     14      3     11    18     0     0  |          14      0       0        0  |            8    13     0
  23       sí      2        6      7/8        6      0              |     16      3     10    19     0     0  |          14      1       0        0  |            7    14     0
  24       sí      0        5      4/5        5      0              |     16      2     11    19     0     0  |          14      1       0        0  |            8    14     0
  25       sí      0       12     8/12       12      0              |     15      3      8    22     0     0  |          14      1       0        0  |            6    16     0
  26       sí      1        6      7/7        6      0              |     16      2      9    22     0     0  |          14      1       0        0  |            7    16     0
  27       sí      0        5      4/5        5      0              |     16      2      8    23     0     0  |          14      1       0        0  |            6    17     0
  28       sí      0        7      6/7        7      0              |     16      2      7    24     0     0  |          14      1       0        0  |            6    17     0
  29       sí      0        7      5/7        7      0              |     16      1      7    25     0     0  |          15      0       0        0  |            6    18     0
  30       sí      0        9      8/9        9      0              |     16      0      8    25     0     0  |          15      0       0        0  |            7    18     0

Día 30 (66 habilidades): aprendidas 8 · estables 25 · dominadas 0 · en consolidación 0 · en aprendizaje 16 · debilitadas 0 · sin empezar 17.
Día 30 (36 unidades): aprendidas 7 · estables 18 · dominadas 0 · sin nivel 11.

## Alumno «olvidadizo» · curso idioma

 día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | en-apr consol aprend estab domin debil | asoc: queda forma pierde revisar | unid: aprend estab domin
   1       sí      8        0      8/8        0      0              |      8      0      0     0     0     0  |           0      4       0        0  |            0     0     0
   2       sí      8        0      8/8        0      0              |     16      0      0     0     0     0  |           0      8       0        0  |            0     0     0
   3       sí      8        8     9/16        8      0              |     24      0      0     0     0     0  |           0     12       0        0  |            0     0     0
   4       sí      8       15    14/23       15      0              |     31      1      0     0     0     0  |           0     15       1        1  |            0     0     0
   5       sí      8       17    17/25       17      0              |     37      3      0     0     0     0  |           0     17       2        2  |            0     0     0
   6       sí      4       20    11/24       20      0              |     40      4      0     0     0     0  |           0     18       2        2  |            0     0     0
   7       sí      4       27    16/31       27      0              |     42      6      0     0     0     0  |           0     18       3        3  |            0     0     0
   8       sí      4       27    16/31       27      0              |     42     10      0     0     0     0  |           1     17       5        5  |            0     0     0
   9       sí      4       30    20/34       32      2              |     43     13      0     0     0     0  |           1     19       5        5  |            0     0     0
  10       sí      4       30    15/34       32      2              |     46     14      0     0     0     0  |           1     20       6        6  |            0     0     0
  11       sí      4       30    22/34       36      6              |     48     14      1     0     0     1  |           1     20       8        8  |            0     0     0
  12       sí      2       30    19/32       35      5              |     43     20      3     0     0     0  |           2     19       9        9  |            0     0     0
  13       sí      2       30    14/32       36      6              |     41     24      3     0     0     0  |           2     16      12       12  |            0     0     0
  14       sí      1       30    12/31       36      6              |     41     22      5     0     0     1  |           3     12      15       15  |            0     0     0
  15       sí      1       30    13/31       39      9              |     40     20      5     0     0     5  |           3     10      17       17  |            0     0     0
  16       sí      0       30    15/30       49     19          sí  |     37     21      7     0     0     5  |           3     10      17       17  |            0     0     0
  17       sí      0       30    12/30       46     16          sí  |     35     21      9     0     0     5  |           4      8      18       18  |            0     0     0
  18       sí      0       30    17/30       44     14          sí  |     31     24     12     0     0     3  |           4      8      18       18  |            0     0     0
  19       sí      4       30    16/34       36      6              |     33     24     13     0     0     4  |           4      8      18       18  |            0     0     0
  20       sí      0       30    18/30       43     13          sí  |     30     24     17     0     0     3  |           3      5      22       21  |            0     0     0
  21       sí      2       30    16/32       38      8              |     30     23     15     1     0     7  |           3      6      21       21  |            0     0     0
  22       sí      0       30    18/30       45     15          sí  |     28     24     17     2     0     5  |           3      6      21       21  |            0     0     0
  23       sí      2       30    18/32       39      9              |     25     27     19     2     0     5  |           3      6      21       21  |            0     0     0
  24       sí      3       30    23/33       39      9              |     26     26     22     2     0     5  |           3      6      21       21  |            1     0     0
  25       sí      2       30    20/32       36      6              |     26     24     26     4     0     3  |           3      6      21       21  |            2     0     0
  26       sí      2       30    18/32       35      5              |     23     24     28     4     0     6  |           3      6      21       21  |            2     0     0
  27       sí      3       30    21/33       33      3              |     24     26     28     7     0     3  |           4      5      21       21  |            2     0     0
  28       sí      0       30    16/30       30      0              |     19     31     28     8     0     2  |           5      3      22       22  |            1     0     0
  29       sí      4       29    19/33       29      0              |     21     32     30     8     0     1  |           5      3      22       22  |            3     0     0
  30       sí      3       27    18/30       27      0              |     19     31     30    10     0     5  |           5      3      22       22  |            3     0     0

Día 30 (102 habilidades): aprendidas 30 · estables 10 · dominadas 0 · en consolidación 31 · en aprendizaje 19 · debilitadas 5 · sin empezar 7.
Día 30 (36 unidades): aprendidas 3 · estables 0 · dominadas 0 · sin nivel 33.

## Alumno «ausente 5 días» · curso idioma

 día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | en-apr consol aprend estab domin debil | asoc: queda forma pierde revisar | unid: aprend estab domin
   1       sí      8        0      8/8        0      0              |      8      0      0     0     0     0  |           0      4       0        0  |            0     0     0
   2       sí      8        0      8/8        0      0              |     16      0      0     0     0     0  |           0      8       0        0  |            0     0     0
   3       sí      8        8    14/16        8      0              |     20      4      0     0     0     0  |           0     12       0        0  |            0     0     0
   4       sí      8       10    15/18       10      0              |     25      7      0     0     0     0  |           0     14       0        0  |            0     0     0
   5       sí      8       11    16/19       11      0              |     30     10      0     0     0     0  |           0     16       0        0  |            0     0     0
   6       sí      8       12    16/20       12      0              |     32     16      0     0     0     0  |           0     17       1        1  |            0     0     0
   7       sí      8       20    23/28       20      0              |     35     17      4     0     0     0  |           4     16       1        1  |            0     0     0
   8       sí      8       22    23/30       22      0              |     34     23      7     0     0     0  |           7     15       2        2  |            0     0     0
   9       sí      8       22    27/30       22      0              |     33     29     10     0     0     0  |          10     15       2        2  |            0     0     0
  10       sí      8       23    27/31       23      0              |     34     28     18     0     0     0  |          12     15       2        2  |            0     0     0
  11       no      0        0        -       22     22              |     34     28     18     0     0     0  |          12     15       2        2  |            0     0     0
  12       no      0        0        -       38     38              |     34     28     18     0     0     0  |          12     15       2        2  |            0     0     0
  13       no      0        0        -       46     46          sí  |     34     28     18     0     0     0  |          12     15       2        2  |            0     0     0
  14       no      0        0        -       54     54          sí  |     34     28     18     0     0     0  |          12     15       2        2  |            0     0     0
  15       no      0        0        -       58     58          sí  |     34     28     18     0     0     0  |          12     15       2        2  |            0     0     0
  16       sí      0       30    11/30       63     33          sí  |     27     31     22     0     0     0  |          14     12       3        3  |            0     0     0
  17       sí      0       30    21/30       58     28          sí  |     22     31     27     0     0     0  |          16      9       4        4  |            0     0     0
  18       sí      0       30    24/30       46     16          sí  |     17     29     30     4     0     0  |          19      6       4        4  |            2     0     0
  19       sí      4       30    29/34       40     10              |     14     27     30    10     0     3  |          19      5       5        5  |            4     0     0
  20       sí      6       26    27/32       26      0              |     18     25     29    15     0     3  |          21      3       6        5  |            7     0     0
  21       sí      0       12    11/12       12      0              |     13     31     29    15     0     2  |          21      4       5        5  |            7     0     0
  22       sí      0       14    10/14       14      0              |      9     31     33    15     0     2  |          21      4       5        5  |            8     0     0
  23       sí      1       16    14/17       16      0              |      7     29     40    15     0     0  |          21      4       5        5  |            9     0     0
  24       sí      0       14    14/14       14      0              |      4     27     42    18     0     0  |          21      4       5        5  |           10     0     0
  25       sí      4       15    17/19       15      0              |      8     18     47    22     0     0  |          22      3       5        5  |           17     0     0
  26       sí      0       17    16/17       17      0              |      6     14     46    29     0     0  |          23      2       5        5  |           18     1     0
  27       sí      2       15    13/17       15      0              |      5     11     49    31     0     1  |          24      1       5        5  |           22     1     0
  28       sí      1       12    10/13       12      0              |      5     10     46    36     0     1  |          24      1       5        5  |           21     3     0
  29       sí      0        6      5/6        6      0              |      3     12     47    36     0     0  |          24      1       5        5  |           22     3     0
  30       sí      1        9     9/10        9      0              |      3     10     46    40     0     0  |          25      0       5        5  |           23     3     0

Día 30 (102 habilidades): aprendidas 46 · estables 40 · dominadas 0 · en consolidación 10 · en aprendizaje 3 · debilitadas 0 · sin empezar 3.
Día 30 (36 unidades): aprendidas 23 · estables 3 · dominadas 0 · sin nivel 10.

```
