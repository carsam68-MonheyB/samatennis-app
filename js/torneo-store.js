/*
 * torneo-store.js — Estado del torneo: persistencia, edición y datos derivados.
 * Guarda todo en localStorage; no hay servidor ni cuentas.
 */
(function (global) {
  "use strict";

  var LLAVE = "monheyb-torneo-tenis-v1";
  var Model = global.TorneoModel;

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  function torneoVacio() {
    return {
      torneo: { nombre: "Nuevo torneo", categoria: "", sede: "", inicio: "", fin: "" },
      cabezas: [],
      inscritos: [],
      sorteo: { congelado: false, orden: [] },
      grupos: [],
      partidos: [],
      desempates: {},
      cuadro: {},
      // Cupos al cuadro final por posición de grupo: primeros, segundos, terceros...
      clasifican: { cupos: ["todos", "todos"] }
    };
  }

  var estado = torneoVacio();
  var suscriptores = [];

  /** Acepta la configuración nueva por cupos y migra la vieja (top-N por grupo). */
  function normalizarClasifican(limpio, datos) {
    var config = (datos && datos.clasifican) || limpio.clasifican;
    if (config && Array.isArray(config.cupos) && config.cupos.length) {
      return { cupos: config.cupos.slice() };
    }
    var previo = Number(datos && datos.clasificanPorGrupo);
    if (previo > 0) {
      var cupos = [];
      for (var i = 0; i < previo; i++) cupos.push("todos");
      return { cupos: cupos };
    }
    return { cupos: ["todos", "todos"] };
  }

  function normalizarEstado(datos) {
    var base = torneoVacio();
    var limpio = Object.assign(base, datos || {});
    limpio.torneo = Object.assign(base.torneo, (datos && datos.torneo) || {});
    limpio.sorteo = Object.assign({ congelado: false, orden: [] }, (datos && datos.sorteo) || {});
    limpio.clasifican = normalizarClasifican(limpio, datos);
    limpio.cabezas = limpio.cabezas || [];
    limpio.inscritos = limpio.inscritos || [];
    limpio.grupos = limpio.grupos || [];
    limpio.partidos = limpio.partidos || [];
    limpio.desempates = limpio.desempates || {};
    limpio.cuadro = limpio.cuadro || {};
    return limpio;
  }

  function cargar() {
    try {
      var crudo = global.localStorage && global.localStorage.getItem(LLAVE);
      if (crudo) {
        estado = normalizarEstado(JSON.parse(crudo));
        return estado;
      }
    } catch (error) {
      console.warn("No se pudo leer el torneo guardado:", error);
    }
    estado = normalizarEstado(clonar(global.TorneoEjemplo || {}));
    return estado;
  }

  function guardar() {
    try {
      if (global.localStorage) global.localStorage.setItem(LLAVE, JSON.stringify(estado));
    } catch (error) {
      console.warn("No se pudo guardar el torneo:", error);
    }
    suscriptores.forEach(function (fn) { fn(estado); });
  }

  function suscribir(fn) {
    suscriptores.push(fn);
  }

  // ------------------------------------------------------------- jugadores

  function setCabezas(lista) {
    estado.cabezas = (lista || []).map(Model.normalizar).filter(Boolean);
    guardar();
  }

  function setInscritos(lista) {
    estado.inscritos = (lista || []).map(Model.normalizar).filter(Boolean);
    guardar();
  }

  function setDatosTorneo(datos) {
    Object.assign(estado.torneo, datos || {});
    guardar();
  }

  // ---------------------------------------------------------------- sorteo

  function sortear() {
    estado.sorteo = { congelado: false, orden: Model.sortear(estado.inscritos) };
    guardar();
    return estado.sorteo.orden;
  }

  /** Equivalente al macro SORTEO(): fija el orden y arma los grupos. */
  function congelarSorteo() {
    if (!estado.sorteo.orden.length) return;
    estado.sorteo.congelado = true;
    estado.grupos = Model.repartirGrupos(estado.cabezas, estado.sorteo.orden);
    regenerarCalendario();
  }

  function reabrirSorteo() {
    estado.sorteo.congelado = false;
    guardar();
  }

  // -------------------------------------------------------------- partidos

  function llaveDePareja(unJugador, otroJugador) {
    return [Model.normalizar(unJugador), Model.normalizar(otroJugador)]
      .sort(function (a, b) { return a.localeCompare(b, "es"); })
      .join(" ~ ");
  }

  /**
   * Reconstruye el calendario round-robin de cada grupo conservando los
   * resultados ya capturados para las parejas que siguen existiendo.
   */
  function regenerarCalendario() {
    var previos = {};
    estado.partidos.forEach(function (partido) {
      previos[llaveDePareja(partido.jugadorA, partido.jugadorB)] = partido;
    });

    var nuevos = [];
    estado.grupos.forEach(function (grupo) {
      Model.calendarioGrupo(grupo.jugadores).forEach(function (pareja, indice) {
        var anterior = previos[llaveDePareja(pareja.jugadorA, pareja.jugadorB)];
        nuevos.push({
          id: grupo.nombre + "-P" + (indice + 1),
          grupo: grupo.nombre,
          jugadorA: anterior ? anterior.jugadorA : pareja.jugadorA,
          jugadorB: anterior ? anterior.jugadorB : pareja.jugadorB,
          fecha: anterior ? anterior.fecha : "",
          hora: anterior ? anterior.hora : "",
          sets: anterior ? anterior.sets : [],
          superMuerte: anterior ? !!anterior.superMuerte : false
        });
      });
    });

    estado.partidos = nuevos;
    guardar();
  }

  function partidoPorId(id) {
    return estado.partidos.filter(function (partido) { return partido.id === id; })[0] || null;
  }

  function setPartido(id, cambios) {
    var partido = partidoPorId(id);
    if (!partido) return;
    Object.assign(partido, cambios || {});
    guardar();
  }

  /** Cambia el cupo de una posición de grupo: número o "todos". */
  function setCupo(posicion, valor) {
    var cupos = (estado.clasifican.cupos || []).slice();
    while (cupos.length < posicion) cupos.push(0);
    cupos[posicion - 1] = valor === "todos" ? "todos" : Math.max(0, Number(valor) || 0);
    estado.clasifican = { cupos: cupos };
    guardar();
  }

  function setDesempate(jugador, nivel) {
    var valor = Number(nivel) || 0;
    if (valor > 0) estado.desempates[jugador] = valor;
    else delete estado.desempates[jugador];
    guardar();
  }

  function setResultadoCuadro(id, resultado) {
    if (resultado && resultado.sets && resultado.sets.length) estado.cuadro[id] = resultado;
    else delete estado.cuadro[id];
    guardar();
  }

  // -------------------------------------------------------------- derivados

  function derivado() {
    var tablas = Model.tablasDeGrupos(estado.grupos, estado.partidos, { desempates: estado.desempates });
    var ranking = Model.seleccionarClasificados(tablas, estado.clasifican);
    var cuadro = Model.resolverCuadro(Model.generarCuadro(ranking), estado.cuadro);
    var conteo = Model.conteoDeClasificados(tablas, estado.clasifican);
    return { tablas: tablas, ranking: ranking, cuadro: cuadro, conteo: conteo };
  }

  // ------------------------------------------------------ archivo / reinicio

  function exportar() {
    return JSON.stringify(estado, null, 2);
  }

  function importar(texto) {
    var datos = JSON.parse(texto);
    estado = normalizarEstado(datos);
    guardar();
    return estado;
  }

  function cargarEjemplo() {
    estado = normalizarEstado(clonar(global.TorneoEjemplo || {}));
    guardar();
  }

  function nuevoTorneo() {
    estado = torneoVacio();
    guardar();
  }

  global.TorneoStore = {
    LLAVE: LLAVE,
    cargar: cargar,
    guardar: guardar,
    suscribir: suscribir,
    estado: function () { return estado; },
    setDatosTorneo: setDatosTorneo,
    setCabezas: setCabezas,
    setInscritos: setInscritos,
    sortear: sortear,
    congelarSorteo: congelarSorteo,
    reabrirSorteo: reabrirSorteo,
    regenerarCalendario: regenerarCalendario,
    partidoPorId: partidoPorId,
    setPartido: setPartido,
    setCupo: setCupo,
    setDesempate: setDesempate,
    setResultadoCuadro: setResultadoCuadro,
    derivado: derivado,
    exportar: exportar,
    importar: importar,
    cargarEjemplo: cargarEjemplo,
    nuevoTorneo: nuevoTorneo
  };
})(typeof window !== "undefined" ? window : globalThis);
