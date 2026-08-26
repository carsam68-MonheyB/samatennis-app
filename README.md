# Sama Tennis App

App web para administrar un torneo de tenis por grupos: sorteo, captura de
resultados, tablas de posiciones, ranking del torneo y cuadro final sembrado.

Está construida a partir de la lógica del archivo
`DRAWS_TENNIS_APP_CT2025_Primera_Varonil.xlsm`. Es HTML, CSS y JavaScript sin
dependencias ni compilación: se abre `index.html` en cualquier navegador
y todo se guarda en `localStorage`.

## Identidad visual

La paleta es **"cancha dura"**: azul marino de la superficie con el amarillo de
la pelota como acento. Se eligió comparando cuatro paletas aplicadas sobre la
app real —verde cancha, azul cancha dura, arcilla y grafito—: el azul es el que
hace resaltar más el amarillo y el que se lee como tenis de un vistazo.

La pelota del encabezado, del botón de sorteo y del ícono de la pestaña es un
SVG con la costura clásica en S, degradado de volumen y el hilo marcado. Se
mantiene nítida a cualquier tamaño.

La portada lleva de fondo una **cancha vista desde arriba**, dibujada en SVG con
las medidas reales (78 × 36 pies: líneas de sencillos, cuadros de saque, línea
central de saque y la red al centro), estirada al ancho de la tarjeta. Un velo
en degradado la atenúa del lado del texto para que no compita con la lectura.

El dueño puede subir una **imagen del club** desde *Inicio*: aparece en el
encabezado —a la izquierda, antes del nombre de la app, separada por una línea,
sobre un fondo claro para que también se vean los logos de tinta oscura— y en la
portada del torneo, para todos los que abran la liga. Se reduce en el navegador
antes de guardarse (máximo 520 px de lado, WebP con respaldo a PNG o JPEG) para
no acercarse al tope de 1 MB por documento de Firestore. Cada torneo lleva la
suya.

## Categorías

Un torneo contiene varias **categorías**, y cada una es una competencia
independiente: sus propios inscritos, cabezas de serie, sorteo, grupos,
resultados, ranking y cuadro final. El catálogo del club son 18:

| | Novatos | Tercera | Segunda | Primera | Libre |
|---|---|---|---|---|---|
| Varonil singles | ✓ | ✓ | ✓ | ✓ | ✓ |
| Varonil dobles | ✓ | ✓ | ✓ | ✓ | ✓ |
| Femenil singles | ✓ | ✓ | ✓ | ✓ | — |
| Femenil dobles | ✓ | ✓ | ✓ | ✓ | — |

En la pestaña *Categorías* marcas las que se juegan en ese torneo; el resto ni
aparecen. El selector del encabezado cambia entre las abiertas y todas las demás
pestañas trabajan sobre la que esté activa. En dobles la pareja se captura como
un participante con nombre propio ("Samaniego / Cepeda").

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

**Clasificados:** se configuran por posición de grupo, en la pestaña *Grupos*:

```
Posición de grupo    Cupo      Disponibles   Entran
Primeros lugares     Todos          9           9
Segundos lugares       5            9           5
Terceros lugares       2            9           2
────────────────────────────────────────────────────
16 clasificados → cuadro de 16, sin BYE ✓
```

Los primeros de grupo normalmente pasan todos. De las demás posiciones eliges
cuántos entran: se comparan **entre sí**, contra los de su misma posición en los
otros grupos, ordenados por puntaje. El resumen se actualiza mientras mueves los
números y te dice qué cuadro sale, para que puedas aterrizar en una potencia de 2
y evitar los BYE.

Cuando dos jugadores empatan exactamente, manda el enfrentamiento directo entre
ellos (criterio 1 del reglamento) y después el desempate manual.

**Ranking del torneo (siembra):** los clasificados se ordenan por jerarquía de
posición, no por puntaje puro. Primero todos los primeros de grupo ordenados por
puntaje entre ellos, luego los segundos que hayan clasificado, luego los terceros.
Ganar el grupo siempre siembra más alto que un buen puntaje desde el segundo lugar.

**Cuadro final:** el tamaño es la potencia de 2 inmediata superior al número de
clasificados (18 clasificados → cuadro de 32). Las posiciones siguen el orden de
siembra clásico (1-32, 17-16, 9-24, 25-8, …), que es el mismo de la hoja `Draw`.
Los lugares que sobran son BYE y los reciben los mejores sembrados. El cuadro se
arma sólo por número de siembra: dos jugadores del mismo grupo pueden volver a
encontrarse en la primera ronda.

## Diferencias intencionales con el archivo original

1. **Reparto de los BYE.** En la hoja `Draw` los dos clasificados peor rankeados
   quedaban fuera del cuadro y en su lugar los sembrados 13 a 16 jugaban una ronda
   previa. Aquí entran todos los clasificados: el cuadro crece a la potencia de 2
   siguiente y los BYE van a los mejores sembrados.
2. **Siembra desde el ranking de clasificados.** La hoja `Draw` tomaba los mejores
   puntajes de *todos* los jugadores (`LARGE(Grupos!AS7:AS75, n)`), incluidos los
   que no clasificaron. La app siembra con la lista de clasificados.
3. **Jerarquía de posición en la siembra.** El Excel ordenaba por puntaje puro,
   así que un segundo de grupo podía sembrarse arriba de un primero. Aquí los
   primeros de grupo van siempre antes que los segundos.
4. **Cupos configurables.** El Excel clasificaba fijo a los dos primeros de cada
   grupo. La app permite definir cuántos entran por posición.

La estadística reproduce el archivo al pie de la letra: con el torneo de ejemplo
cargado (los datos reales de CT2025 Primera Varonil) los 28 jugadores dan
exactamente los mismos sets, juegos y puntajes que el Excel. Eso está verificado
en las pruebas.

## Torneo en la nube (Firebase)

La app funciona sola contra `localStorage`. Conectada a Firebase, además:

- **Cualquiera que abra la liga ve el torneo en vivo**, sin cuenta ni contraseña.
- **Sólo el dueño y los administradores del torneo capturan.** Quien no tiene
  permiso ve la app en modo consulta: los campos aparecen bloqueados y los
  botones de captura no se muestran.
- **Los administradores se asignan por torneo.** El del torneo de 2025 no puede
  tocar el de 2026 aunque conserve su cuenta.
- **Cada partido de grupo es un documento aparte**, para que dos administradores
  puedan capturar al mismo tiempo en canchas distintas sin pisarse.
- **Si se cae la red**, el SDK sigue mostrando lo último y encola las escrituras.

### Puesta en marcha

1. Consola de Firebase → **Authentication** → Email/Password activado, y los
   administradores dados de alta en la pestaña *Users*.
2. **Firestore Database** creada en modo producción.
3. **Firestore → Reglas**: pega el contenido de `firebase/reglas-firestore.txt`
   y publica. Sin esto la base rechaza todo.
4. En la app, pestaña *Inicio* → **Torneo en la nube**: escribe un identificador
   (`copa-2026`) y presiona *Subir este torneo a la nube*.
5. Ya con el torneo arriba, aparece el cuadro de **administradores**: un correo
   por línea. Sólo el dueño puede cambiar esa lista.

El correo del dueño está en dos lugares y deben coincidir: `CORREO_DUENO` en
`js/torneo-nube.js` y la función `esDueno()` de las reglas.

### Qué pasa si Firebase no responde

Nada grave: la app cae a modo local, el encabezado dice *"Sin nube · sólo este
navegador"* y todo sigue editable como siempre. **Exportar** sigue siendo el
respaldo de fin de jornada.

## Pruebas

```
node pruebas/modelo.prueba.js
```

Cubren la estadística contra las cifras del Excel, la selección de clasificados
por cupos, la jerarquía de siembra y la resolución del cuadro completo.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `js/torneo-model.js` | La lógica: sorteo, estadística, tablas, ranking y cuadro. Sin DOM. |
| `js/torneo-catalogo.js` | El catálogo fijo de 18 categorías del club. |
| `js/torneo-datos.js` | Torneo de ejemplo con los datos reales del archivo original. |
| `js/torneo-store.js` | Estado, persistencia en `localStorage`, exportar e importar. |
| `js/torneo-ui.js` | Pestañas, captura de marcadores y pintado de las vistas. |
| `js/torneo-nube.js` | Conexión con Firebase: sesión y sincronización en vivo. |
| `js/torneo-sesion.js` | Une la nube con la app: permisos, panel y modo consulta. |
| `firebase/reglas-firestore.txt` | Reglas de seguridad para pegar en la consola. |
| `css/tennis.css` | Estilos. |
| `pruebas/modelo.prueba.js` | Pruebas del modelo, sin dependencias. |

## Uso

1. **Categorías.** Marca las que se van a jugar en el torneo.
2. **Jugadores.** Captura las cabezas de grupo (una por grupo) y los inscritos de la categoría activa.
3. **Sorteo.** Revuelve las veces que quieras y congela: se arman los grupos y el
   calendario de todos contra todos.
4. **Resultados.** Anota cada set. Marca *super muerte* si el tercer set se juega
   como match tie-break a 10; el botón *W.O.* registra un default como 6-0, 6-0.
5. **Grupos, Ranking y Cuadro.** Se recalculan solos conforme capturas.

**Exportar** descarga el torneo completo en JSON e **Importar** lo restaura: es la
forma de respaldarlo o pasarlo a otra computadora, porque los datos viven sólo en
el navegador donde se capturaron.
