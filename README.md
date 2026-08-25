# Sama Tennis App

App web para administrar un torneo de tenis por grupos: sorteo, captura de
resultados, tablas de posiciones, ranking del torneo y cuadro final sembrado.

Está construida a partir de la lógica del archivo
`DRAWS_TENNIS_APP_CT2025_Primera_Varonil.xlsm`. Es HTML, CSS y JavaScript sin
dependencias ni compilación: se abre `index.html` en cualquier navegador
y todo se guarda en `localStorage`.

## De dónde sale cada cosa

| Hoja del Excel | Equivalente en la app |
| --- | --- |
| `Sorteo` (`RAND` + `RANK` y el macro `SORTEO()`) | Pestaña **Sorteo**: revolver y congelar el orden |
| `Cabezas de Grupo` | Pestaña **Jugadores**: una cabeza por grupo |
| `Resultados` | Pestaña **Resultados**: un partido por tarjeta, set por set |
| `Grupos` columnas `AM:AS` | Pestaña **Grupos**: sets, juegos, porcentajes y puntaje |
| `Grupos` columnas `AU:AW` | Los clasificados marcados en cada tabla |
| `RKN` | Pestaña **Ranking** |
| `Draw` | Pestaña **Cuadro final** |
| `Reglamento Criterios Desempate` | Pestaña **Reglamento** |

## Las fórmulas

**Puntaje de cada jugador** (`Grupos!AS`):

```
puntaje = % de sets ganados + % de juegos ganados + (desempate manual × 0.0001)
```

- **% de sets** = sets ganados / sets jugados. Cuentan los tres sets.
- **% de juegos** = juegos ganados / juegos jugados, **sólo de los dos primeros
  sets**. Es la regla FMT: el super tie-break del tercer set cuenta como set
  ganado o perdido, pero sus puntos no suman juegos.
- Un set ganado en tie-break se registra 7-6: 7 juegos para el ganador y 6 para
  el perdedor. El marcador interno del tie-break queda de constancia.
- El **desempate manual** (0 a 5) es el que se captura en la tabla del grupo
  cuando hay que resolver un empate exacto, por ejemplo tras un sorteo presencial.
- Si un jugador no tiene resultados, su puntaje es `desempate / 100`, igual que
  en el Excel.

**Clasificados:** los dos primeros de cada grupo por puntaje. Cuando dos jugadores
empatan exactamente, manda el enfrentamiento directo entre ellos (criterio 1 del
reglamento) y después el desempate manual.

**Ranking del torneo:** todos los clasificados ordenados por puntaje. Ese orden
es el número de siembra en el cuadro.

**Cuadro final:** el tamaño es la potencia de 2 inmediata superior al número de
clasificados (18 clasificados → cuadro de 32). Las posiciones siguen el orden de
siembra clásico (1-32, 17-16, 9-24, 25-8, …), que es el mismo de la hoja `Draw`.
Los lugares que sobran son BYE y los reciben los mejores sembrados.

## Dos diferencias intencionales con el archivo original

1. **Reparto de los BYE.** En la hoja `Draw` los dos clasificados peor rankeados
   (17 y 18) quedaban fuera del cuadro y en su lugar los sembrados 13 a 16
   jugaban una ronda previa. Aquí entran los 18 clasificados: el cuadro es de 32
   con 14 BYE para los mejores sembrados, y los partidos de primera ronda son
   15 vs 18 y 16 vs 17.
2. **Siembra del cuadro desde el ranking.** La hoja `Draw` tomaba los mejores
   puntajes de *todos* los jugadores (`LARGE(Grupos!AS7:AS75, n)`), incluidos los
   que no clasificaron. La app siembra con la lista de clasificados, que es lo
   que la propia hoja `RKN` calcula.

Lo demás reproduce el archivo al pie de la letra: con el torneo de ejemplo
cargado (los datos reales de CT2025 Primera Varonil) los 28 jugadores dan
exactamente los mismos sets, juegos, puntajes y el mismo ranking del 1 al 18 que
el Excel.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `js/torneo-model.js` | La lógica: sorteo, estadística, tablas, ranking y cuadro. Sin DOM. |
| `js/torneo-datos.js` | Torneo de ejemplo con los datos reales del archivo original. |
| `js/torneo-store.js` | Estado, persistencia en `localStorage`, exportar e importar. |
| `js/torneo-ui.js` | Pestañas, captura de marcadores y pintado de las vistas. |
| `css/tennis.css` | Estilos. |

## Uso

1. **Jugadores.** Captura las cabezas de grupo (una por grupo) y los inscritos.
2. **Sorteo.** Revuelve las veces que quieras y congela: se arman los grupos y el
   calendario de todos contra todos.
3. **Resultados.** Anota cada set. Marca *super muerte* si el tercer set se juega
   como match tie-break a 10; el botón *W.O.* registra un default como 6-0, 6-0.
4. **Grupos, Ranking y Cuadro.** Se recalculan solos conforme capturas.

**Exportar** descarga el torneo completo en JSON e **Importar** lo restaura: es la
forma de respaldarlo o pasarlo a otra computadora, porque los datos viven sólo en
el navegador donde se capturaron.
