/*
 * Pruebas del modelo. Se corren con: node pruebas/modelo.prueba.js
 * Sin dependencias: sólo Node.
 */
const Model = require("../js/torneo-model.js");
const EJEMPLO = require("../js/torneo-datos.js");

let fallos = 0;
let pruebas = 0;

function ok(condicion, mensaje) {
  pruebas++;
  if (condicion) {
    console.log("  ✓ " + mensaje);
  } else {
    fallos++;
    console.log("  ✗ " + mensaje);
  }
}

function igual(obtenido, esperado, mensaje) {
  const iguales = JSON.stringify(obtenido) === JSON.stringify(esperado);
  ok(iguales, mensaje + (iguales ? "" : `  (obtenido ${JSON.stringify(obtenido)}, esperado ${JSON.stringify(esperado)})`));
}

function tablasDelEjemplo() {
  return Model.tablasDeGrupos(EJEMPLO.grupos, EJEMPLO.partidos, { desempates: EJEMPLO.desempates });
}

// ---------------------------------------------------------------------------
console.log("\nEstadística: el ejemplo debe dar las mismas cifras que el Excel");

// Cifras tomadas de Grupos!AM:AS del archivo original.
const DEL_EXCEL = {
  "Gabriel Esquivel":   { sg: 4, sp: 0, jg: 24, jp: 5,  puntaje: 1.8275862068965516 },
  "CRISTOBAL HANDAM":   { sg: 2, sp: 2, jg: 16, jp: 16, puntaje: 1.0002 },
  "Stoyan Tassef":      { sg: 0, sp: 4, jg: 5,  jp: 24, puntaje: 0.1724137931034483 },
  "Carlos Samaniego":   { sg: 4, sp: 0, jg: 24, jp: 0,  puntaje: 2 },
  "Akihito Suga":       { sg: 2, sp: 2, jg: 21, jp: 21, puntaje: 1.0003 },
  "Fernando Cuadros":   { sg: 4, sp: 1, jg: 25, jp: 16, puntaje: 1.4097560975609755 },
  "Sebastian Gomez":    { sg: 4, sp: 2, jg: 19, jp: 15, puntaje: 1.2254901960784315 },
  "Daniel Zaja":        { sg: 6, sp: 0, jg: 39, jp: 25, puntaje: 1.609375 },
  "Angel Sobrino":      { sg: 4, sp: 1, jg: 20, jp: 8,  puntaje: 1.5142857142857142 },
  "Iván Cepeda":        { sg: 4, sp: 1, jg: 21, jp: 12, puntaje: 1.4363636363636365 }
};

const tablas = tablasDelEjemplo();
const porJugador = {};
tablas.forEach((t) => t.filas.forEach((f) => { porJugador[f.jugador] = f; }));

Object.keys(DEL_EXCEL).forEach((nombre) => {
  const fila = porJugador[nombre];
  const esperado = DEL_EXCEL[nombre];
  ok(
    fila &&
      fila.sg === esperado.sg && fila.sp === esperado.sp &&
      fila.jg === esperado.jg && fila.jp === esperado.jp &&
      Math.abs(fila.puntaje - esperado.puntaje) < 1e-9,
    `${nombre}: sets ${esperado.sg}-${esperado.sp}, juegos ${esperado.jg}-${esperado.jp}, puntaje ${esperado.puntaje.toFixed(4)}`
  );
});

// El tercer set nunca aporta juegos (regla FMT del super tie-break).
const conSuperMuerte = EJEMPLO.partidos.find((p) => p.superMuerte);
ok(!!conSuperMuerte, "el ejemplo incluye un partido con super muerte");
const juegosDelTercero = conSuperMuerte.sets[2].a + conSuperMuerte.sets[2].b;
ok(juegosDelTercero === 13, "el super tie-break se registra 7-6 en sets");

// ---------------------------------------------------------------------------
console.log("\nClasificación: cupos por posición de grupo");

const todos = Model.seleccionarClasificados(tablasDelEjemplo(), { cupos: ["todos", "todos"] });
ok(todos.length === 18, "todos los primeros + todos los segundos = 18 clasificados");

const soloPrimeros = Model.seleccionarClasificados(tablasDelEjemplo(), { cupos: ["todos"] });
ok(soloPrimeros.length === 9, "sólo los primeros = 9 clasificados");
ok(soloPrimeros.every((c) => c.posicion === 1), "y todos son primeros de grupo");

const mezcla = Model.seleccionarClasificados(tablasDelEjemplo(), { cupos: ["todos", 5, 2] });
ok(mezcla.length === 16, "9 primeros + 5 segundos + 2 terceros = 16 clasificados");
igual(
  mezcla.filter((c) => c.posicion === 2).map((c) => c.jugador),
  ["Sebastian Gomez", "SUSANA VILLARREAL", "Juan Pablo Mijares", "Akihito Suga", "CRISTOBAL HANDAM"],
  "los 5 segundos que entran son los de mejor puntaje entre todos los grupos"
);
ok(
  mezcla.filter((c) => c.posicion === 3).length === 2,
  "entran exactamente 2 terceros lugares"
);

const conteo = Model.conteoDeClasificados(tablasDelEjemplo(), { cupos: ["todos", 5, 2] });
igual([conteo.total, conteo.tamanoCuadro, conteo.byes], [16, 16, 0],
  "la vista previa avisa: 16 clasificados, cuadro de 16, sin BYE");

// La vista previa debe contar todas las posiciones que existen en los grupos,
// aunque todavía no tengan cupo asignado.
const conteoCorto = Model.conteoDeClasificados(tablasDelEjemplo(), { cupos: ["todos", "todos"] });
igual(
  conteoCorto.detalle.map((d) => [d.posicion, d.disponibles, d.entran]),
  [[1, 9, 9], [2, 9, 9], [3, 9, 0], [4, 1, 0]],
  "con cupos sólo para 1º y 2º, la tabla igual muestra los 3º y 4º disponibles"
);

const conteoSolos = Model.conteoDeClasificados(tablasDelEjemplo(), { cupos: ["todos"] });
igual([conteoSolos.total, conteoSolos.tamanoCuadro, conteoSolos.byes], [9, 16, 7],
  "sólo los primeros: 9 clasificados, cuadro de 16, 7 BYE");

// ---------------------------------------------------------------------------
console.log("\nSiembra: ganar el grupo pesa más que el puntaje");

// Grupo A flojo pero con un ganador claro; Grupo B parejo y muy fuerte.
const gruposPrueba = [
  { nombre: "GrupoA", cabeza: "A1", jugadores: ["A1", "A2", "A3"] },
  { nombre: "GrupoB", cabeza: "B1", jugadores: ["B1", "B2", "B3"] }
];
const partidosPrueba = [
  // Grupo A: los tres se ganan entre sí, así que el "ganador" queda con 2-2 en sets.
  { id: "A-1", grupo: "GrupoA", jugadorA: "A1", jugadorB: "A2", sets: [{ a: 6, b: 4 }, { a: 6, b: 4 }] },
  { id: "A-2", grupo: "GrupoA", jugadorA: "A3", jugadorB: "A1", sets: [{ a: 6, b: 2 }, { a: 6, b: 2 }] },
  { id: "A-3", grupo: "GrupoA", jugadorA: "A2", jugadorB: "A3", sets: [{ a: 6, b: 4 }, { a: 6, b: 4 }] },
  // Grupo B: el segundo sólo pierde dos tie-breaks y arrasa su otro partido.
  { id: "B-1", grupo: "GrupoB", jugadorA: "B1", jugadorB: "B2", sets: [{ a: 7, b: 6 }, { a: 7, b: 6 }] },
  { id: "B-2", grupo: "GrupoB", jugadorA: "B1", jugadorB: "B3", sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }] },
  { id: "B-3", grupo: "GrupoB", jugadorA: "B2", jugadorB: "B3", sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }] }
];

const tablasPrueba = Model.tablasDeGrupos(gruposPrueba, partidosPrueba, {});
const b2 = tablasPrueba[1].filas.find((f) => f.jugador === "B2");
const ganadorA = tablasPrueba[0].filas[0];
ok(b2.posicion === 2, "B2 es segundo lugar de su grupo");
ok(ganadorA.posicion === 1, `${ganadorA.jugador} gana el Grupo A`);
ok(b2.puntaje > ganadorA.puntaje,
  `pero B2 tiene mejor puntaje (${b2.puntaje.toFixed(4)} > ${ganadorA.puntaje.toFixed(4)})`);

const siembra = Model.seleccionarClasificados(tablasPrueba, { cupos: ["todos", "todos"] });
igual(siembra.slice(0, 2).map((c) => c.jugador), ["B1", ganadorA.jugador],
  "aun así los dos primeros sembrados son los ganadores de grupo");
ok(siembra[2].jugador === "B2", "B2 se siembra hasta el tercer lugar, después de los primeros");

// ---------------------------------------------------------------------------
console.log("\nCuadro final");

const rankingEjemplo = Model.seleccionarClasificados(tablasDelEjemplo(), { cupos: ["todos", "todos"] });
const cuadro = Model.resolverCuadro(Model.generarCuadro(rankingEjemplo), {});
igual([cuadro.tamano, cuadro.byes], [32, 14], "18 clasificados dan un cuadro de 32 con 14 BYE");
ok(!cuadro.campeon, "sin marcadores capturados no hay campeón");
ok(
  cuadro.rondas[0].partidos.filter((p) => !p.ladoA && !p.ladoB).length === 0,
  "ninguna llave de primera ronda queda completamente vacía"
);

igual(Model.ordenSiembra(8), [1, 8, 5, 4, 3, 6, 7, 2], "el orden de siembra de 8 es el clásico");
igual(Model.ordenSiembra(32).slice(0, 8), [1, 32, 17, 16, 9, 24, 25, 8],
  "el orden de siembra de 32 coincide con la hoja Draw del Excel");

// Jugar el cuadro completo debe consumir exactamente Q-1 partidos.
const resultados = {};
for (let vuelta = 0; vuelta < 8; vuelta++) {
  const parcial = Model.resolverCuadro(Model.generarCuadro(rankingEjemplo), resultados);
  parcial.rondas.forEach((ronda) =>
    ronda.partidos.forEach((partido) => {
      if (partido.ladoA && partido.ladoB && !resultados[partido.id]) {
        resultados[partido.id] = { sets: [{ a: 6, b: 1 }, { a: 6, b: 2 }], superMuerte: false };
      }
    })
  );
}
const completo = Model.resolverCuadro(Model.generarCuadro(rankingEjemplo), resultados);
ok(Object.keys(resultados).length === 17, "18 jugadores = 17 partidos jugados en el cuadro");
ok(!!completo.campeon, "con el cuadro completo hay campeón: " + (completo.campeon || {}).jugador);
ok(!!completo.finalista, "y finalista: " + (completo.finalista || {}).jugador);

// ---------------------------------------------------------------------------
console.log(`\n${pruebas - fallos}/${pruebas} pruebas pasaron`);
if (fallos) {
  console.log(`${fallos} FALLARON`);
  process.exit(1);
}
