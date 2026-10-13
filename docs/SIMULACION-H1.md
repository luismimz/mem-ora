# Salida de la simulación del H1

Generada con `pnpm simulate` (determinista: misma semilla, misma salida). Alumnos sintéticos: **no** son datos reales.

**Columnas:**
- *nuevas / repasos:* elementos del plan de ese día.
- *aciertos:* aciertos sobre intentos.
- *vencidas:* habilidades vencidas al empezar el día.
- *fuera:* vencidas que no cupieron en el día.
- *nuevo-bloq:* no entra nada nuevo por exceso de vencidas.
- *aprend / consol / consolid / debil:* habilidades en aprendizaje (incluye presentadas), en consolidación, consolidadas y debilitadas.
- *asoc:* asociaciones que se están quedando, en formación (incluye sin datos), que se están perdiendo y marcadas para revisión.

En el curso de idioma, 30 de las 102 habilidades son de solo escuchar: nunca se consolidan, por diseño (D-014).

```text
# Simulación de 30 días · topes: 8 nuevas, 30 repasos, 36 en total por día

## Alumno «idioma» · curso idioma

 día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | aprend consol consolid debil | asoc: queda forma pierde revisar
   1       sí      8        0      8/8        0      0              |      8      0        0     0  |           0      4       0        0
   2       sí      8        0      8/8        0      0              |     16      0        0     0  |           0      8       0        0
   3       sí      8        8    15/16        8      0              |     21      3        0     0  |           0     12       0        0
   4       sí      8        9    16/17        9      0              |     25      7        0     0  |           0     14       0        0
   5       sí      8        9    14/17        9      0              |     30     10        0     0  |           0     16       0        0
   6       sí      8       12    17/20       12      0              |     33     15        0     0  |           0     18       0        0
   7       sí      8       18    23/26       18      0              |     36     17        3     0  |           3     18       0        0
   8       sí      8       21    27/29       21      0              |     37     21        6     0  |           6     17       0        0
   9       sí      8       18    24/26       18      0              |     40     23        9     0  |           9     16       1        1
  10       sí      8       19    26/27       19      0              |     42     22       16     0  |          12     15       1        1
  11       sí      8       20    26/28       20      0              |     44     24       20     0  |          14     15       1        1
  12       sí      4       25    26/29       25      0              |     41     26       25     0  |          16     13       1        1
  13       sí      4       25    23/29       25      0              |     40     26       30     0  |          19     10       1        1
  14       sí      3       20    20/23       20      0              |     40     24       35     0  |          21      8       1        1
  15       sí      1       22    22/23       22      0              |     36     23       40     1  |          24      4       2        1
  16       sí      0       26    19/26       26      0              |     34     17       48     1  |          26      3       1        1
  17       sí      0       27    23/27       27      0              |     32     14       53     1  |          27      2       1        1
  18       sí      1       15    13/16       15      0              |     33     10       57     1  |          27      1       2        2
  19       sí      0       21    17/21       21      0              |     32      8       59     2  |          27      1       2        2
  20       sí      1       20    15/21       20      0              |     31      9       59     3  |          26      1       3        2
  21       sí      0       26    20/26       26      0              |     31      9       59     3  |          26      2       2        2
  22       sí      0       20    18/20       20      0              |     30     12       59     1  |          27      1       2        2
  23       sí      0       18    14/18       18      0              |     30     11       60     1  |          26      1       3        2
  24       sí      0       19    16/19       19      0              |     30      8       62     2  |          26      2       2        2
  25       sí      0       20    16/20       20      0              |     30      6       65     1  |          26      2       2        2
  26       sí      0       17    14/17       17      0              |     30      5       67     0  |          26      2       2        2
  27       sí      0       11     9/11       11      0              |     30      5       67     0  |          27      1       2        2
  28       sí      0       16    12/16       16      0              |     30      5       66     1  |          27      1       2        2
  29       sí      0       15    12/15       15      0              |     30      5       67     0  |          27      1       2        2
  30       sí      0       17    13/17       17      0              |     30      3       69     0  |          28      0       2        2

Final: 69/102 habilidades consolidadas, 0 debilitadas, 0 sin empezar.

## Alumno «programación» · curso programación

 día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | aprend consol consolid debil | asoc: queda forma pierde revisar
   1       sí      8        0      8/8        0      0              |      8      0        0     0  |           0      4       0        0
   2       sí      8        0      8/8        0      0              |     16      0        0     0  |           0      8       0        0
   3       sí      8        8    16/16        8      0              |     20      4        0     0  |           0     12       0        0
   4       sí      5        8    13/13        8      0              |     21      8        0     0  |           0     13       0        0
   5       sí      2        8     8/10        8      0              |     20     11        0     0  |           0     13       0        0
   6       sí      1        7      4/8        7      0              |     20     12        0     0  |           0     13       0        0
   7       sí      1       14    12/15       14      0              |     20     10        3     0  |           3     10       0        0
   8       sí      1       14    15/15       14      0              |     20      7        7     0  |           7      6       0        0
   9       sí      1       11    10/12       11      0              |     19      6       10     0  |          10      3       0        0
  10       sí      3        6      7/9        6      0              |     21      6       11     0  |          10      3       0        0
  11       sí      0        7      5/7        7      0              |     21      5       12     0  |          10      3       0        0
  12       sí      0       14    11/14       14      0              |     17      7       14     0  |          11      2       0        0
  13       sí      3       10    13/13       10      0              |     17      8       16     0  |          12      2       0        0
  14       sí      1        4      3/5        4      0              |     18      6       18     0  |          13      1       0        0
  15       sí      0       12    11/12       12      0              |     16      7       19     0  |          13      1       0        0
  16       sí      2       13    12/15       13      0              |     17      7       20     0  |          13      1       0        0
  17       sí      0       12    12/12       12      0              |     17      6       21     0  |          13      1       0        0
  18       sí      0        4      1/4        4      0              |     16      7       20     1  |          13      1       0        0
  19       sí      0       12    11/12       12      0              |     15      7       22     0  |          14      0       0        0
  20       sí      0        7      7/7        7      0              |     15      5       24     0  |          14      0       0        0
  21       sí      0       13    12/13       13      0              |     14      3       27     0  |          14      0       0        0
  22       sí      2        3      5/5        3      0              |     16      2       28     0  |          14      0       0        0
  23       sí      0        5      4/5        5      0              |     16      1       29     0  |          14      0       0        0
  24       sí      0        8      8/8        8      0              |     14      3       29     0  |          14      0       0        0
  25       sí      2        9     8/11        9      0              |     16      3       27     2  |          14      1       0        0
  26       sí      0        4      3/4        4      0              |     16      4       28     0  |          14      1       0        0
  27       sí      0        8      8/8        8      0              |     15      5       28     0  |          14      1       0        0
  28       sí      1        8      9/9        8      0              |     16      3       30     0  |          14      1       0        0
  29       sí      0        7      5/7        7      0              |     16      3       29     1  |          14      1       0        0
  30       sí      0        9      9/9        9      0              |     15      4       30     0  |          14      1       0        0

Final: 30/66 habilidades consolidadas, 0 debilitadas, 17 sin empezar.

## Alumno «olvidadizo» · curso idioma

 día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | aprend consol consolid debil | asoc: queda forma pierde revisar
   1       sí      8        0      8/8        0      0              |      8      0        0     0  |           0      4       0        0
   2       sí      8        0      8/8        0      0              |     16      0        0     0  |           0      8       0        0
   3       sí      8        8    11/16        8      0              |     24      0        0     0  |           0     12       0        0
   4       sí      8       13    13/21       13      0              |     31      1        0     0  |           0     14       2        2
   5       sí      8       16    16/24       16      0              |     39      1        0     0  |           0     16       3        3
   6       sí      8       20    20/28       20      0              |     46      2        0     0  |           0     19       4        4
   7       sí      8       22    18/30       22      0              |     53      3        0     0  |           0     22       5        5
   8       sí      6       30    23/36       33      3              |     59      3        0     0  |           0     22       7        7
   9       sí      1       30    17/31       32      2              |     60      3        0     0  |           0     21       9        9
  10       sí      0       30    13/30       36      6              |     58      4        0     1  |           0     16      14       14
  11       sí      1       30    19/31       36      6              |     57      6        0     1  |           0     15      15       15
  12       sí      0       30    20/30       40     10              |     55      7        1     1  |           2     12      16       16
  13       sí      2       30    21/32       33      3              |     52     11        2     1  |           5      9      16       16
  14       sí      4       30    19/34       34      4              |     56     11        2     1  |           5      7      18       18
  15       sí      1       30    16/31       35      5              |     56     11        3     1  |           5      7      18       18
  16       sí      1       30    19/31       38      8              |     53     15        3     1  |           6      6      18       18
  17       sí      4       30    19/34       35      5              |     54     19        3     0  |           7      5      18       18
  18       sí      1       30    20/31       35      5              |     53     20        3     1  |           7      5      18       18
  19       sí      1       30    12/31       35      5              |     54     20        4     0  |           7      5      18       18
  20       sí      0       30    17/30       45     15          sí  |     53     17        7     1  |           7      5      18       18
  21       sí      0       30    16/30       45     15          sí  |     50     19        9     0  |           7      5      18       18
  22       sí      0       30    14/30       46     16          sí  |     47     20        9     2  |           6      3      21       20
  23       sí      0       30    17/30       44     14          sí  |     46     19       10     3  |           6      4      20       20
  24       sí      0       30    16/30       45     15          sí  |     43     21        9     5  |           6      3      21       21
  25       sí      0       30    16/30       42     12          sí  |     43     20       11     4  |           4      3      23       21
  26       sí      0       30    16/30       42     12          sí  |     42     20       13     3  |           4      5      21       21
  27       sí      4       30    17/34       39      9              |     44     21       13     4  |           2      5      23       21
  28       sí      4       30    26/34       39      9              |     46     23       16     1  |           2      7      21       21
  29       sí      0       30    15/30       41     11          sí  |     45     21       18     2  |           2      7      21       21
  30       sí      0       30    11/30       47     17          sí  |     44     19       19     4  |           2      7      21       21

Final: 19/102 habilidades consolidadas, 4 debilitadas, 16 sin empezar.

## Alumno «ausente 5 días» · curso idioma

 día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | aprend consol consolid debil | asoc: queda forma pierde revisar
   1       sí      8        0      8/8        0      0              |      8      0        0     0  |           0      4       0        0
   2       sí      8        0      8/8        0      0              |     16      0        0     0  |           0      8       0        0
   3       sí      8        8    15/16        8      0              |     20      4        0     0  |           0     12       0        0
   4       sí      8        9    14/17        9      0              |     25      7        0     0  |           0     14       0        0
   5       sí      8       11    18/19       11      0              |     30     10        0     0  |           0     16       0        0
   6       sí      8        9    14/17        9      0              |     35     13        0     0  |           0     18       0        0
   7       sí      8       21    23/29       21      0              |     38     15        3     0  |           3     18       0        0
   8       sí      8       21    23/29       21      0              |     41     18        5     0  |           5     20       0        0
   9       sí      8       24    28/32       24      0              |     45     18        9     0  |           8     20       0        0
  10       sí      6       23    27/29       23      0              |     47     18       13     0  |           9     20       1        1
  11       no      0        0        -       22     22              |     47     18       13     0  |           9     20       1        1
  12       no      0        0        -       38     38              |     47     18       13     0  |           9     20       1        1
  13       no      0        0        -       51     51          sí  |     47     18       13     0  |           9     20       1        1
  14       no      0        0        -       67     67          sí  |     47     18       13     0  |           9     20       1        1
  15       no      0        0        -       70     70          sí  |     47     18       13     0  |           9     20       1        1
  16       sí      0       30    15/30       72     42          sí  |     41     20       17     0  |          11     18       1        1
  17       sí      0       30    23/30       60     30          sí  |     38     17       23     0  |          15     13       2        2
  18       sí      4       30    26/34       40     10              |     39     17       25     1  |          20      8       2        2
  19       sí      8       28    32/36       28      0              |     46     16       26     2  |          19      7       4        2
  20       sí      3       23    20/26       23      0              |     47     16       28     2  |          20      8       2        2
  21       sí      0       23    20/23       23      0              |     38     24       28     3  |          20      8       2        2
  22       sí      2       24    21/26       24      0              |     37     27       30     1  |          20      8       2        2
  23       sí      1       19    17/20       19      0              |     36     26       33     1  |          22      6       2        2
  24       sí      2       17    15/19       17      0              |     36     24       38     0  |          24      4       2        2
  25       sí      1       30    26/31       30      0              |     34     17       47     1  |          24      3       3        2
  26       sí      0       30    27/30       30      0              |     33     11       53     2  |          25      2       3        2
  27       sí      0       16    10/16       16      0              |     31     11       55     2  |          25      3       2        2
  28       sí      0       17    12/17       17      0              |     31     10       57     1  |          25      3       2        2
  29       sí      0       17    15/17       17      0              |     30      9       59     1  |          25      3       2        2
  30       sí      2       20    17/22       20      0              |     32      8       61     0  |          25      3       2        2

Final: 61/102 habilidades consolidadas, 0 debilitadas, 1 sin empezar.

```
