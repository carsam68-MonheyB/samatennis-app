/*
 * torneo-store.js — Estado del torneo: persistencia, edición y datos derivados.
 *
 * Un torneo contiene varias categorías (Varonil Primera Singles, Femenil
 * Novatos Dobles, …). Cada categoría es una competencia independiente con sus
 * inscritos, su sorteo, sus grupos y su cuadro final. Casi toda la API opera
 * sobre la categoría activa.
 *
 * Todo se guarda en localStorage; no hay servidor ni cuentas.
 */
(function (global) {
  "use strict";

  var LLAVE = "monheyb-torneo-tenis-v1";
  var Model = global.TorneoModel;
  var Catalogo = global.TorneoCatalogo;

  function clonar(valor) {
    return JSON.parse(JSON.stringify(valor));
  }

  // ------------------------------------------------------------- estructuras

  function categoriaVacia(definicion) {
    var base = definicion || {};
    return {
      id: base.id || "categoria",
      rama: base.rama || "",
      subcategoria: base.subcategoria || "",
      modalidad: base.modalidad || "Singles",
      nombre: base.nombre || "Categoría",
      // Todos los jugadores de la categoría. Las cabezas de grupo se eligen
      // de aquí mismo: son un subconjunto de los inscritos, no otra lista.
      inscritos: [],
      cabezas: [],
      // Cuántos grupos quiere el torneo. Define cuántas cabezas hay que marcar
      // y de cuántos jugadores queda cada grupo. 0 = todavía sin decidir.
      numeroGrupos: 0,
      sorteo: { congelado: false, orden: [] },
      grupos: [],
      partidos: [],
      desempates: {},
      cuadro: {},
      // Cupos al cuadro final por posición de grupo: primeros, segundos, terceros...
      clasifican: { cupos: ["todos", "todos"] }
    };
  }

  function torneoVacio() {
    return {
      torneoId: "",          // id del documento en la nube; vacío = sólo local
      torneo: { nombre: "Nuevo torneo", sede: "", inicio: "", fin: "", logo: "" },
      admins: [],            // correos que pueden capturar en este torneo
      categorias: [],
      categoriaActiva: ""
    };
  }

  var estado = torneoVacio();
  var suscriptores = [];

  // ---------------------------------------------------------- normalización

  /** Acepta la configuración nueva por cupos y migra la vieja (top-N por grupo). */
  function normalizarClasifican(datos) {
    var config = datos && datos.clasifican;
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

  function mismoNombre(uno, otro) {
    return Model.esMismoJugador(uno, otro);
  }

  function contiene(lista, nombre) {
    return (lista || []).some(function (otro) { return mismoNombre(otro, nombre); });
  }

  /**
   * Antes las cabezas de grupo eran una lista aparte de los inscritos. Ahora
   * los inscritos son todos y las cabezas se marcan entre ellos, así que a los
   * torneos guardados con el formato viejo se les suman las cabezas a la lista.
   */
  function unirCabezasConInscritos(cabezas, inscritos) {
    var todos = (cabezas || []).map(Model.normalizar).filter(Boolean);
    (inscritos || []).map(Model.normalizar).filter(Boolean).forEach(function (nombre) {
      if (!contiene(todos, nombre)) todos.push(nombre);
    });
    return todos;
  }

  /**
   * El tercer set es super muerte a 10 puntos. Un partido viejo que ya tenga
   * un tercer set capturado con juegos se respeta tal como se guardó.
   */
  function normalizarPartido(partido) {
    var limpio = Object.assign({}, partido || {});
    if (typeof limpio.superMuerte !== "boolean") {
      var tercero = (limpio.sets || [])[2];
      var terceroConJuegos = !!tercero && tercero.tbA == null && tercero.tbB == null &&
        (Number(tercero.a) || Number(tercero.b));
      limpio.superMuerte = !terceroConJuegos;
    }
    return limpio;
  }

  function normalizarCategoria(datos) {
    var limpia = Object.assign(categoriaVacia(), datos || {});
    limpia.sorteo = Object.assign({ congelado: false, orden: [] }, (datos && datos.sorteo) || {});
    limpia.clasifican = normalizarClasifican(datos);
    limpia.inscritos = unirCabezasConInscritos(limpia.cabezas, limpia.inscritos);
    limpia.cabezas = (limpia.cabezas || []).map(Model.normalizar).filter(function (nombre) {
      return nombre && contiene(limpia.inscritos, nombre);
    });
    limpia.numeroGrupos = Math.max(0, Math.floor(Number(limpia.numeroGrupos) || 0)) ||
      limpia.cabezas.length || (limpia.grupos || []).length;
    limpia.grupos = limpia.grupos || [];
    limpia.partidos = (limpia.partidos || []).map(normalizarPartido);
    limpia.desempates = limpia.desempates || {};
    limpia.cuadro = limpia.cuadro || {};
    delete limpia.clasificanPorGrupo;
    return limpia;
  }

  /**
   * Convierte un torneo guardado con el formato anterior —una sola competencia
   * en la raíz— en un torneo con una categoría, para no perder lo capturado.
   */
  function migrarFormatoAnterior(datos) {
    var definicion = (Catalogo && Catalogo.porId("varonil-primera-singles")) || {};
    return [
      normalizarCategoria(
        Object.assign({}, datos, {
          id: definicion.id || "categoria-unica",
          rama: definicion.rama || "",
          subcategoria: definicion.subcategoria || "",
          modalidad: definicion.modalidad || "Singles",
          nombre: definicion.nombre || "Categoría única"
        })
      )
    ];
  }

  function normalizarEstado(datos) {
    var limpio = torneoVacio();
    var origen = datos || {};

    limpio.torneo = Object.assign(limpio.torneo, origen.torneo || {});
    delete limpio.torneo.categoria; // antes era texto libre; ahora son categorías reales
    limpio.torneoId = origen.torneoId || "";
    limpio.admins = (origen.admins || []).map(function (correo) {
      return String(correo).trim().toLowerCase();
    }).filter(Boolean);

    if (Array.isArray(origen.categorias)) {
      limpio.categorias = origen.categorias.map(normalizarCategoria);
    } else if (origen.grupos || origen.cabezas || origen.inscritos) {
      limpio.categorias = migrarFormatoAnterior(origen);
    }

    var existe = limpio.categorias.some(function (categoria) {
      return categoria.id === origen.categoriaActiva;
    });
    limpio.categoriaActiva = existe ? origen.categoriaActiva : (limpio.categorias[0] || {}).id || "";

    return limpio;
  }

  // ------------------------------------------------------------ persistencia

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
    // Se arranca vacío a propósito: quien abre la app debe ver el torneo real
    // que llega de la nube, no un ejemplo que además podría escribirse encima.
    estado = torneoVacio();
    return estado;
  }

  /**
   * Guarda en localStorage y avisa a los suscriptores QUÉ cambió, para que la
   * capa de nube escriba sólo el documento afectado en vez de todo el torneo.
   *
   * cambio: { tipo: "torneo" }
   *       | { tipo: "categoria" | "calendario" | "categoriaBorrada", categoriaId }
   *       | { tipo: "partido", categoriaId, partidoId }
   */
  function guardar(cambio) {
    try {
      if (global.localStorage) global.localStorage.setItem(LLAVE, JSON.stringify(estado));
    } catch (error) {
      console.warn("No se pudo guardar el torneo:", error);
    }
    var descriptor = cambio || { tipo: "torneo" };
    suscriptores.forEach(function (fn) { fn(estado, descriptor); });
  }

  function idActivo() {
    var cat = categoria();
    return cat ? cat.id : "";
  }

  /** Cambio que afecta a toda la categoría activa. */
  function guardarCategoria(tipo) {
    guardar({ tipo: tipo || "categoria", categoriaId: idActivo() });
  }

  function suscribir(fn) {
    suscriptores.push(fn);
  }

  // -------------------------------------------------------------- categorías

  /** La categoría activa, o null si el torneo no tiene ninguna abierta. */
  function categoria() {
    if (!estado.categorias.length) return null;
    var activa = estado.categorias.filter(function (cat) {
      return cat.id === estado.categoriaActiva;
    })[0];
    return activa || estado.categorias[0];
  }

  function categorias() {
    return estado.categorias;
  }

  function setCategoriaActiva(id) {
    estado.categoriaActiva = id;
    guardar();
  }

  /** Abre una categoría del catálogo en este torneo. */
  function abrirCategoria(id) {
    if (estado.categorias.some(function (cat) { return cat.id === id; })) return;
    var definicion = Catalogo.porId(id);
    if (!definicion) return;

    estado.categorias.push(categoriaVacia(definicion));
    // Mantener el orden del catálogo, no el orden en que se fueron abriendo.
    var orden = Catalogo.catalogo().map(function (cat) { return cat.id; });
    estado.categorias.sort(function (uno, otro) {
      return orden.indexOf(uno.id) - orden.indexOf(otro.id);
    });
    if (!estado.categoriaActiva) estado.categoriaActiva = id;
    guardar({ tipo: "categoria", categoriaId: id });
  }

  function cerrarCategoria(id) {
    estado.categorias = estado.categorias.filter(function (cat) { return cat.id !== id; });
    if (estado.categoriaActiva === id) {
      estado.categoriaActiva = (estado.categorias[0] || {}).id || "";
    }
    guardar({ tipo: "categoriaBorrada", categoriaId: id });
  }

  /** Resumen de avance de una categoría, para la pantalla de categorías. */
  function resumenCategoria(cat) {
    var jugados = (cat.partidos || []).filter(function (partido) {
      return Model.ganadorPartido(partido);
    }).length;
    return {
      jugadores: (cat.inscritos || []).length,
      grupos: (cat.grupos || []).length,
      partidos: (cat.partidos || []).length,
      jugados: jugados,
      sorteada: !!(cat.sorteo && cat.sorteo.congelado)
    };
  }

  // --------------------------------------------------------------- jugadores

  /** Marca como cabezas de grupo a jugadores que ya están inscritos. */
  function setCabezas(lista) {
    var cat = categoria();
    if (!cat) return;
    var nombres = (lista || []).map(Model.normalizar).filter(Boolean);
    nombres.forEach(function (nombre) {
      if (!contiene(cat.inscritos, nombre)) cat.inscritos.push(nombre);
    });
    cat.cabezas = nombres;
    guardarCategoria();
  }

  function setInscritos(lista) {
    var cat = categoria();
    if (!cat) return;
    cat.inscritos = (lista || []).map(Model.normalizar).filter(Boolean);
    // Quien ya no está inscrito tampoco puede seguir siendo cabeza de grupo.
    cat.cabezas = cat.cabezas.filter(function (nombre) {
      return contiene(cat.inscritos, nombre);
    });
    guardarCategoria();
  }

  /** Cuántas cabezas faltan por marcar según los grupos configurados. */
  function cabezasQueFaltan(cual) {
    var cat = cual || categoria();
    var objetivo = cat ? cat.numeroGrupos || 0 : 0;
    return objetivo - ((cat && cat.cabezas) || []).length;
  }

  /**
   * Marca o desmarca a un inscrito como cabeza de grupo.
   * Devuelve el motivo por el que no se pudo, o "" si sí se pudo.
   */
  function alternarCabeza(nombre) {
    var cat = categoria();
    if (!cat) return "No hay categoría abierta.";
    var limpio = Model.normalizar(nombre);
    if (!contiene(cat.inscritos, limpio)) return "Ese jugador no está inscrito.";

    if (contiene(cat.cabezas, limpio)) {
      cat.cabezas = cat.cabezas.filter(function (otro) { return !mismoNombre(otro, limpio); });
      guardarCategoria();
      return "";
    }

    if (!cat.numeroGrupos) return "Primero indica de cuántos grupos será la categoría.";
    if (cabezasQueFaltan(cat) <= 0) {
      return "Ya están marcadas las " + cat.numeroGrupos + " cabezas que pide la configuración.";
    }
    cat.cabezas.push(limpio);
    guardarCategoria();
    return "";
  }

  /** De cuántos grupos será la categoría: define cuántas cabezas se marcan. */
  function setNumeroGrupos(cuantos) {
    var cat = categoria();
    if (!cat) return;
    cat.numeroGrupos = Math.max(0, Math.min(64, Math.floor(Number(cuantos) || 0)));
    guardarCategoria();
  }

  function setAdmins(correos) {
    estado.admins = (correos || []).map(function (correo) {
      return String(correo).trim().toLowerCase();
    }).filter(Boolean);
    guardar({ tipo: "torneo" });
  }

  function setTorneoId(id) {
    estado.torneoId = id || "";
    guardar({ tipo: "torneo" });
  }

  /**
   * Reemplaza el estado con lo que llegó de la nube. No dispara escrituras:
   * el suscriptor de nube ignora los cambios marcados como remotos.
   */
  function aplicarRemoto(datos) {
    var activa = estado.categoriaActiva;
    estado = normalizarEstado(datos);
    if (activa && estado.categorias.some(function (cat) { return cat.id === activa; })) {
      estado.categoriaActiva = activa;
    }
    try {
      if (global.localStorage) global.localStorage.setItem(LLAVE, JSON.stringify(estado));
    } catch (error) {
      console.warn("No se pudo guardar el torneo:", error);
    }
    suscriptores.forEach(function (fn) { fn(estado, { tipo: "remoto" }); });
  }

  function setDatosTorneo(datos) {
    Object.assign(estado.torneo, datos || {});
    guardar();
  }

  // ------------------------------------------------------------------ sorteo

  /** Los inscritos que no son cabeza de grupo: son los que entran al sorteo. */
  function porSortear(cual) {
    var cat = cual || categoria();
    return ((cat && cat.inscritos) || []).filter(function (nombre) {
      return !contiene(cat.cabezas, nombre);
    });
  }

  function sortear() {
    var cat = categoria();
    if (!cat) return [];
    cat.sorteo = { congelado: false, orden: Model.sortear(porSortear(cat)) };
    guardarCategoria();
    return cat.sorteo.orden;
  }

  /** Equivalente al macro SORTEO(): fija el orden y arma los grupos. */
  function congelarSorteo() {
    var cat = categoria();
    if (!cat || !cat.sorteo.orden.length) return;
    cat.sorteo.congelado = true;
    cat.grupos = Model.repartirGrupos(cat.cabezas, cat.sorteo.orden);
    regenerarCalendario();
  }

  function reabrirSorteo() {
    var cat = categoria();
    if (!cat) return;
    cat.sorteo.congelado = false;
    guardarCategoria();
  }

  // ---------------------------------------------------------------- partidos

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
    var cat = categoria();
    if (!cat) return;

    var previos = {};
    cat.partidos.forEach(function (partido) {
      previos[llaveDePareja(partido.jugadorA, partido.jugadorB)] = partido;
    });

    var nuevos = [];
    cat.grupos.forEach(function (grupo) {
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
          superMuerte: anterior ? anterior.superMuerte !== false : true
        });
      });
    });

    cat.partidos = nuevos;
    guardar({ tipo: "calendario", categoriaId: cat.id });
  }

  function partidoPorId(id) {
    var cat = categoria();
    if (!cat) return null;
    return cat.partidos.filter(function (partido) { return partido.id === id; })[0] || null;
  }

  function setPartido(id, cambios) {
    var partido = partidoPorId(id);
    if (!partido) return;
    Object.assign(partido, cambios || {});
    guardar({ tipo: "partido", categoriaId: idActivo(), partidoId: id });
  }

  /** Cambia el cupo de una posición de grupo: número o "todos". */
  function setCupo(posicion, valor) {
    var cat = categoria();
    if (!cat) return;
    var cupos = (cat.clasifican.cupos || []).slice();
    while (cupos.length < posicion) cupos.push(0);
    cupos[posicion - 1] = valor === "todos" ? "todos" : Math.max(0, Number(valor) || 0);
    cat.clasifican = { cupos: cupos };
    guardarCategoria();
  }

  function setDesempate(jugador, nivel) {
    var cat = categoria();
    if (!cat) return;
    var valor = Number(nivel) || 0;
    if (valor > 0) cat.desempates[jugador] = valor;
    else delete cat.desempates[jugador];
    guardarCategoria();
  }

  function setResultadoCuadro(id, resultado) {
    var cat = categoria();
    if (!cat) return;
    if (resultado && resultado.sets && resultado.sets.length) cat.cuadro[id] = resultado;
    else delete cat.cuadro[id];
    guardarCategoria();
  }

  // --------------------------------------------------------------- derivados

  var VACIO = { detalle: [], total: 0, tamanoCuadro: 0, byes: 0 };

  function derivado() {
    var cat = categoria();
    if (!cat) return { tablas: [], ranking: [], cuadro: null, conteo: VACIO };

    var tablas = Model.tablasDeGrupos(cat.grupos, cat.partidos, { desempates: cat.desempates });
    var ranking = Model.seleccionarClasificados(tablas, cat.clasifican);
    var cuadro = Model.resolverCuadro(Model.generarCuadro(ranking), cat.cuadro);
    var conteo = Model.conteoDeClasificados(tablas, cat.clasifican);
    return { tablas: tablas, ranking: ranking, cuadro: cuadro, conteo: conteo };
  }

  // ------------------------------------------------------ archivo / reinicio

  function exportar() {
    return JSON.stringify(estado, null, 2);
  }

  function importar(texto) {
    estado = normalizarEstado(JSON.parse(texto));
    guardar();
    return estado;
  }

  function cargarEjemplo() {
    estado = normalizarEstado(clonar(global.TorneoEjemplo || {}));
    guardar();
  }

  /*
   * El identificador del torneo no es un segundo nombre: es su dirección.
   * Va en la liga que se comparte (…/?torneo=copa-2025) y ya no se puede
   * cambiar, por eso se arma solo con el nombre en vez de pedirlo aparte.
   */
  function identificadorDesde(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
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
    categoria: categoria,
    categorias: categorias,
    setCategoriaActiva: setCategoriaActiva,
    abrirCategoria: abrirCategoria,
    cerrarCategoria: cerrarCategoria,
    resumenCategoria: resumenCategoria,
    setDatosTorneo: setDatosTorneo,
    setAdmins: setAdmins,
    setTorneoId: setTorneoId,
    identificadorDesde: identificadorDesde,
    aplicarRemoto: aplicarRemoto,
    setCabezas: setCabezas,
    alternarCabeza: alternarCabeza,
    cabezasQueFaltan: cabezasQueFaltan,
    porSortear: porSortear,
    setNumeroGrupos: setNumeroGrupos,
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
