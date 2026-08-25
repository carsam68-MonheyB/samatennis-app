/*
 * torneo-model.js — Lógica del torneo, traducida del archivo
 * DRAWS_TENNIS_APP_CT2025_Primera_Varonil.xlsm
 *
 * Equivalencias con las hojas del Excel:
 *   Sorteo           -> sortear() / repartirGrupos()
 *   Resultados       -> partidos[] y ganadorPartido()
 *   Grupos (AM:AS)   -> statsJugador() y tablaGrupo()
 *   Grupos (AU:AW)   -> clasificados de cada tabla
 *   RKN              -> seleccionarClasificados()
 *   Draw             -> generarCuadro() / resolverCuadro()
 */
(function (global) {
  "use strict";

  // Grupos!AS: cada nivel de desempate manual suma 0.01% (=0.0001) al puntaje.
  var BONO_DESEMPATE = 0.0001;

  // Sólo los dos primeros sets suman juegos (Reglamento FMT: el super tie-break
  // del tercer set cuenta como set ganado/perdido pero no aporta juegos).
  var SETS_QUE_SUMAN_JUEGOS = 2;

  // ---------------------------------------------------------------- utilidades

  function normalizar(nombre) {
    return String(nombre == null ? "" : nombre).trim();
  }

  function esMismoJugador(a, b) {
    return normalizar(a).toLocaleLowerCase("es") === normalizar(b).toLocaleLowerCase("es");
  }

  function numero(valor) {
    var n = Number(valor);
    return isFinite(n) ? n : 0;
  }

  function porcentaje(ganados, perdidos) {
    var total = ganados + perdidos;
    return total > 0 ? ganados / total : null;
  }

  // --------------------------------------------------------------- 1. Sorteo

  /**
   * Hoja "Sorteo": C=RAND(), D=RANK(), E/F reordenan la lista.
   * Aquí es un Fisher-Yates equivalente; el macro SORTEO() del Excel
   * simplemente congelaba el resultado pegándolo como valores en la columna G.
   */
  function sortear(nombres, aleatorio) {
    var rnd = typeof aleatorio === "function" ? aleatorio : Math.random;
    var lista = (nombres || []).map(normalizar).filter(Boolean);
    for (var i = lista.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = lista[i];
      lista[i] = lista[j];
      lista[j] = tmp;
    }
    return lista;
  }

  /**
   * Reparte el orden del sorteo entre los grupos, como las columnas A y B de
   * la hoja "Grupos": cada grupo arranca con su cabeza de serie y recibe
   * jugadores del sorteo en orden. Si sobran jugadores, los últimos grupos
   * quedan con uno más.
   */
  function repartirGrupos(cabezas, ordenSorteo) {
    var seeds = (cabezas || []).map(normalizar).filter(Boolean);
    var resto = (ordenSorteo || []).map(normalizar).filter(Boolean);
    if (!seeds.length) return [];

    var base = Math.floor(resto.length / seeds.length);
    var extras = resto.length % seeds.length;
    var grupos = [];
    var cursor = 0;

    for (var i = 0; i < seeds.length; i++) {
      // Los grupos del final absorben a los jugadores sobrantes.
      var cuantos = base + (i >= seeds.length - extras ? 1 : 0);
      grupos.push({
        nombre: "Grupo" + (i + 1),
        cabeza: seeds[i],
        jugadores: [seeds[i]].concat(resto.slice(cursor, cursor + cuantos))
      });
      cursor += cuantos;
    }
    return grupos;
  }

  /**
   * Calendario round-robin (todos contra todos) de un grupo.
   * Con 3 jugadores da 3 partidos y con 4 da 6, igual que la hoja "Resultados".
   */
  function calendarioGrupo(jugadores) {
    var lista = (jugadores || []).map(normalizar).filter(Boolean);
    var partidos = [];
    for (var i = 0; i < lista.length; i++) {
      for (var j = i + 1; j < lista.length; j++) {
        partidos.push({ jugadorA: lista[i], jugadorB: lista[j] });
      }
    }
    return partidos;
  }

  // ------------------------------------------------------- 2. Partidos y sets

  /**
   * Sets con juegos capturados, conservando su posición dentro del partido
   * (importante: el tercer set nunca suma juegos).
   */
  function setsValidos(partido) {
    return ((partido && partido.sets) || [])
      .map(function (set, indice) {
        if (!set) return null;
        var a = numero(set.a);
        var b = numero(set.b);
        if (a === 0 && b === 0) return null;
        return { indice: indice, a: a, b: b, tbA: set.tbA, tbB: set.tbB };
      })
      .filter(Boolean);
  }

  /** Sets ganados por cada lado. */
  function setsPorLado(partido) {
    var a = 0;
    var b = 0;
    setsValidos(partido).forEach(function (set) {
      if (set.a > set.b) a++;
      else if (set.b > set.a) b++;
    });
    return { a: a, b: b };
  }

  /** Ganador del partido, o null si aún no está definido. */
  function ganadorPartido(partido) {
    if (!partido) return null;
    var sets = setsPorLado(partido);
    if (sets.a === sets.b) return null;
    return sets.a > sets.b ? partido.jugadorA : partido.jugadorB;
  }

  function perdedorPartido(partido) {
    var ganador = ganadorPartido(partido);
    if (!ganador) return null;
    return esMismoJugador(ganador, partido.jugadorA) ? partido.jugadorB : partido.jugadorA;
  }

  /**
   * Marcador legible, siempre desde el lado del ganador (como en la hoja
   * "Resultados"): "6-3, 7-6(5)" o "6-4, 3-6, [10-7]".
   */
  function marcador(partido) {
    var sets = setsValidos(partido);
    if (!sets.length) return "";
    var ganador = ganadorPartido(partido);
    var invertir = !!ganador && esMismoJugador(ganador, partido.jugadorB);

    return sets
      .map(function (set) {
        var propios = invertir ? set.b : set.a;
        var rivales = invertir ? set.a : set.b;
        var tbPropio = invertir ? set.tbB : set.tbA;
        var tbRival = invertir ? set.tbA : set.tbB;

        if (partido.superMuerte && set.indice === 2) {
          return "[" + numero(tbPropio) + "-" + numero(tbRival) + "]";
        }
        var texto = propios + "-" + rivales;
        if (tbPropio != null || tbRival != null) {
          texto += "(" + Math.min(numero(tbPropio), numero(tbRival)) + ")";
        }
        return texto;
      })
      .join(", ");
  }

  // ---------------------------------------------- 3. Estadística por jugador

  /**
   * Equivale a las columnas AM:AR de la hoja "Grupos".
   *   AM/AN: sets ganados y perdidos (los tres sets cuentan)
   *   AO   : % de sets
   *   AP/AQ: juegos ganados y perdidos (sólo sets 1 y 2)
   *   AR   : % de juegos
   */
  function statsJugador(jugador, partidos) {
    var stats = {
      jugador: normalizar(jugador),
      pj: 0, pg: 0, pp: 0,
      sg: 0, sp: 0, pctSets: null,
      jg: 0, jp: 0, pctJuegos: null
    };

    (partidos || []).forEach(function (partido) {
      var esA = esMismoJugador(partido.jugadorA, jugador);
      var esB = esMismoJugador(partido.jugadorB, jugador);
      if (!esA && !esB) return;

      var ganador = ganadorPartido(partido);
      if (!ganador) return;

      stats.pj++;
      if (esMismoJugador(ganador, jugador)) stats.pg++;
      else stats.pp++;

      setsValidos(partido).forEach(function (set) {
        var propios = esA ? set.a : set.b;
        var rivales = esA ? set.b : set.a;

        if (propios > rivales) stats.sg++;
        else if (rivales > propios) stats.sp++;

        if (set.indice < SETS_QUE_SUMAN_JUEGOS) {
          stats.jg += propios;
          stats.jp += rivales;
        }
      });
    });

    stats.pctSets = porcentaje(stats.sg, stats.sp);
    stats.pctJuegos = porcentaje(stats.jg, stats.jp);
    return stats;
  }

  /**
   * Equivale a Grupos!AS: puntaje = %sets + %juegos + bono de desempate manual.
   * Si el jugador no tiene resultados, el Excel deja sólo el desempate/100.
   */
  function puntajeJugador(stats, desempate) {
    var nivel = numero(desempate);
    var suma = numero(stats.pctSets) + numero(stats.pctJuegos) + nivel * BONO_DESEMPATE;
    if (suma === 0) return nivel / 100;
    return suma;
  }

  // ------------------------------------------------------- 4. Tabla de grupo

  /** Ganador del enfrentamiento directo entre dos jugadores, si existe. */
  function enfrentamientoDirecto(unJugador, otroJugador, partidos) {
    var encontrado = null;
    (partidos || []).forEach(function (partido) {
      var mismos =
        (esMismoJugador(partido.jugadorA, unJugador) && esMismoJugador(partido.jugadorB, otroJugador)) ||
        (esMismoJugador(partido.jugadorA, otroJugador) && esMismoJugador(partido.jugadorB, unJugador));
      if (!mismos) return;
      var ganador = ganadorPartido(partido);
      if (ganador) encontrado = ganador;
    });
    return encontrado;
  }

  /**
   * Tabla de posiciones de un grupo, ordenada como Grupos!AU:AW.
   * Desempates (hoja "Reglamento Criterios Desempate"):
   *   1. puntaje (%sets + %juegos)
   *   2. enfrentamiento directo cuando el empate es entre dos jugadores
   *   3. desempate manual capturado por el juez de silla
   */
  function tablaGrupo(grupo, partidos, opciones) {
    var config = opciones || {};
    var desempates = config.desempates || {};

    var delGrupo = (partidos || []).filter(function (partido) {
      return partido.grupo === grupo.nombre;
    });

    var filas = (grupo.jugadores || []).map(function (jugador) {
      var stats = statsJugador(jugador, delGrupo);
      stats.grupo = grupo.nombre;
      stats.esCabeza = esMismoJugador(jugador, grupo.cabeza);
      stats.desempate = numero(desempates[jugador]);
      stats.puntaje = puntajeJugador(stats, stats.desempate);
      return stats;
    });

    var empatados = {};
    filas.forEach(function (fila) {
      empatados[fila.puntaje] = (empatados[fila.puntaje] || 0) + 1;
    });

    filas.sort(function (uno, otro) {
      if (otro.puntaje !== uno.puntaje) return otro.puntaje - uno.puntaje;
      // Empate exacto entre dos: manda el enfrentamiento directo.
      if (empatados[uno.puntaje] === 2) {
        var directo = enfrentamientoDirecto(uno.jugador, otro.jugador, delGrupo);
        if (directo) {
          uno.desempatePorDirecto = true;
          otro.desempatePorDirecto = true;
          return esMismoJugador(directo, uno.jugador) ? -1 : 1;
        }
      }
      if (otro.desempate !== uno.desempate) return otro.desempate - uno.desempate;
      return uno.jugador.localeCompare(otro.jugador, "es");
    });

    // Quién clasifica se decide después, comparando entre grupos.
    filas.forEach(function (fila, indice) {
      fila.posicion = indice + 1;
      fila.clasificado = false;
    });

    return filas;
  }

  /** Tablas de todos los grupos. */
  function tablasDeGrupos(grupos, partidos, opciones) {
    return (grupos || []).map(function (grupo) {
      return { grupo: grupo, filas: tablaGrupo(grupo, partidos, opciones) };
    });
  }

  // ---------------------------------------- 5. Clasificados y ranking (RKN)

  // Cupos por posición de grupo: índice 0 = primeros lugares, 1 = segundos, etc.
  // Cada cupo es un número o "todos".
  var CUPOS_POR_OMISION = ["todos", "todos"];

  function cuposDeConfig(config) {
    var cupos = (config && config.cupos) || CUPOS_POR_OMISION;
    return cupos.map(function (cupo) {
      if (cupo === "todos") return "todos";
      var n = Number(cupo);
      return isFinite(n) && n > 0 ? Math.floor(n) : 0;
    });
  }

  /** Orden entre jugadores que ocupan la misma posición en distintos grupos. */
  function compararPorPuntaje(uno, otro) {
    if (otro.puntaje !== uno.puntaje) return otro.puntaje - uno.puntaje;
    if (otro.desempate !== uno.desempate) return otro.desempate - uno.desempate;
    return uno.jugador.localeCompare(otro.jugador, "es");
  }

  /**
   * Decide quién pasa al cuadro final y en qué orden se siembra.
   *
   * Los cupos se aplican por posición de grupo: todos los primeros lugares, los
   * N mejores segundos, los N mejores terceros. Dentro de cada posición se
   * compara el puntaje de todos los grupos entre sí.
   *
   * El orden de siembra respeta la jerarquía: primero los primeros lugares
   * (ordenados por puntaje entre ellos), luego los segundos, luego los terceros.
   * Ganar el grupo siempre vale más que un buen puntaje desde el segundo lugar.
   *
   * Marca `clasificado` en las filas de las tablas que recibe.
   */
  function seleccionarClasificados(tablas, config) {
    var cupos = cuposDeConfig(config);
    var porPosicion = {};

    (tablas || []).forEach(function (tabla) {
      tabla.filas.forEach(function (fila) {
        fila.clasificado = false;
        if (fila.pj === 0) return; // sin partidos jugados no se clasifica
        porPosicion[fila.posicion] = (porPosicion[fila.posicion] || []).concat(fila);
      });
    });

    var clasificados = [];
    cupos.forEach(function (cupo, indice) {
      if (!cupo) return;
      var posicion = indice + 1;
      var candidatos = (porPosicion[posicion] || []).slice().sort(compararPorPuntaje);
      var elegidos = cupo === "todos" ? candidatos : candidatos.slice(0, cupo);
      elegidos.forEach(function (fila) {
        fila.clasificado = true;
        clasificados.push(fila);
      });
    });

    return clasificados.map(function (fila, indice) {
      return Object.assign({}, fila, { rkn: indice + 1 });
    });
  }

  /**
   * Cuántos clasificarían con una configuración dada, sin recalcular nada.
   * Sirve para la vista previa del panel de configuración.
   */
  function conteoDeClasificados(tablas, config) {
    var cupos = cuposDeConfig(config);

    // Cuántos jugadores hay en cada posición, contando todas las posiciones que
    // existen en los grupos (no sólo las que ya tienen cupo configurado).
    var disponiblesPorPosicion = {};
    var maxPosicion = 0;
    (tablas || []).forEach(function (tabla) {
      tabla.filas.forEach(function (fila) {
        if (fila.pj === 0) return;
        disponiblesPorPosicion[fila.posicion] = (disponiblesPorPosicion[fila.posicion] || 0) + 1;
        if (fila.posicion > maxPosicion) maxPosicion = fila.posicion;
      });
    });

    var detalle = [];
    for (var posicion = 1; posicion <= Math.max(maxPosicion, cupos.length); posicion++) {
      var cupo = cupos[posicion - 1] == null ? 0 : cupos[posicion - 1];
      var disponibles = disponiblesPorPosicion[posicion] || 0;
      detalle.push({
        posicion: posicion,
        cupo: cupo,
        disponibles: disponibles,
        entran: cupo === "todos" ? disponibles : Math.min(cupo, disponibles)
      });
    }

    var total = detalle.reduce(function (suma, fila) { return suma + fila.entran; }, 0);
    return {
      detalle: detalle,
      total: total,
      tamanoCuadro: total >= 2 ? tamanoCuadro(total) : 0,
      byes: total >= 2 ? tamanoCuadro(total) - total : 0
    };
  }

  // ---------------------------------------------------------- 6. Cuadro final

  var NOMBRES_RONDA = {
    2: "Final",
    4: "Semifinales",
    8: "Cuartos de final",
    16: "Octavos de final",
    32: "Dieciseisavos de final",
    64: "Treintaidosavos de final"
  };

  function nombreRonda(jugadoresEnRonda) {
    return NOMBRES_RONDA[jugadoresEnRonda] || "Ronda de " + jugadoresEnRonda;
  }

  /**
   * Orden de siembra estándar de un cuadro: 1-32, 17-16, 9-24, 25-8, ...
   * Mantiene separados a los mejores sembrados hasta lo más tarde posible.
   */
  function ordenSiembra(tamano) {
    var orden = [1, 2];
    while (orden.length < tamano) {
      var espejo = orden.length * 2 + 1;
      var siguiente = [];
      orden.forEach(function (posicion, indice) {
        // Alternar el orden de cada bloque es lo que mantiene la simetría
        // clásica del cuadro (1-32, 17-16, 9-24, 25-8, ...).
        if (indice % 2 === 0) siguiente.push(posicion, espejo - posicion);
        else siguiente.push(espejo - posicion, posicion);
      });
      orden = siguiente;
    }
    return orden;
  }

  function tamanoCuadro(jugadores) {
    var tamano = 2;
    while (tamano < jugadores) tamano *= 2;
    return tamano;
  }

  /**
   * Hoja "Draw": arma el cuadro con los clasificados sembrados por su RKN.
   * Los lugares vacíos son BYE y los reciben los mejores sembrados.
   */
  function generarCuadro(ranking) {
    var siembra = (ranking || []).slice();
    if (siembra.length < 2) return null;

    var tamano = tamanoCuadro(siembra.length);
    var orden = ordenSiembra(tamano);

    var slots = orden.map(function (seed) {
      if (seed > siembra.length) return null; // BYE
      var jugador = siembra[seed - 1];
      return { seed: seed, jugador: jugador.jugador, grupo: jugador.grupo, puntaje: jugador.puntaje };
    });

    var rondas = [];
    var participantes = slots;
    var numeroRonda = 1;

    while (participantes.length > 1) {
      var partidos = [];
      for (var i = 0; i < participantes.length; i += 2) {
        partidos.push({
          id: "R" + numeroRonda + "-" + (i / 2 + 1),
          ronda: numeroRonda,
          indice: i / 2,
          ladoA: participantes[i],
          ladoB: participantes[i + 1]
        });
      }
      rondas.push({ nombre: nombreRonda(participantes.length), numero: numeroRonda, partidos: partidos });
      participantes = partidos.map(function () { return null; });
      numeroRonda++;
    }

    return { tamano: tamano, byes: tamano - siembra.length, rondas: rondas };
  }

  /**
   * Propaga ganadores por el cuadro. `resultados` es un mapa
   * { "R1-3": { sets: [...], superMuerte: bool } } con lo capturado.
   */
  function resolverCuadro(cuadro, resultados) {
    if (!cuadro) return null;
    var marcadores = resultados || {};

    cuadro.rondas.forEach(function (ronda, indiceRonda) {
      ronda.partidos.forEach(function (partido, indicePartido) {
        if (indiceRonda > 0) {
          var previa = cuadro.rondas[indiceRonda - 1].partidos;
          partido.ladoA = previa[indicePartido * 2].ganador || null;
          partido.ladoB = previa[indicePartido * 2 + 1].ganador || null;
        }

        partido.resultado = marcadores[partido.id] || null;
        partido.ganador = null;
        partido.esBye = false;

        // Sólo la primera ronda tiene BYE: más adelante un lugar vacío
        // significa que el partido que lo alimenta aún no se juega.
        var esPrimeraRonda = indiceRonda === 0;

        if (esPrimeraRonda && partido.ladoA && !partido.ladoB) {
          partido.ganador = partido.ladoA;
          partido.esBye = true;
        } else if (esPrimeraRonda && partido.ladoB && !partido.ladoA) {
          partido.ganador = partido.ladoB;
          partido.esBye = true;
        } else if (partido.ladoA && partido.ladoB && partido.resultado) {
          var comoPartido = {
            jugadorA: partido.ladoA.jugador,
            jugadorB: partido.ladoB.jugador,
            sets: partido.resultado.sets,
            superMuerte: partido.resultado.superMuerte
          };
          var ganador = ganadorPartido(comoPartido);
          if (ganador) {
            partido.ganador = esMismoJugador(ganador, partido.ladoA.jugador) ? partido.ladoA : partido.ladoB;
            partido.marcador = marcador(comoPartido);
          }
        }
      });
    });

    var ultima = cuadro.rondas[cuadro.rondas.length - 1];
    cuadro.campeon = ultima.partidos[0].ganador || null;
    cuadro.finalista = null;
    if (cuadro.campeon) {
      var final = ultima.partidos[0];
      var otro = final.ladoA && esMismoJugador(final.ladoA.jugador, cuadro.campeon.jugador) ? final.ladoB : final.ladoA;
      cuadro.finalista = otro || null;
    }
    return cuadro;
  }

  var API = {
    BONO_DESEMPATE: BONO_DESEMPATE,
    normalizar: normalizar,
    esMismoJugador: esMismoJugador,
    sortear: sortear,
    repartirGrupos: repartirGrupos,
    calendarioGrupo: calendarioGrupo,
    setsValidos: setsValidos,
    setsPorLado: setsPorLado,
    ganadorPartido: ganadorPartido,
    perdedorPartido: perdedorPartido,
    marcador: marcador,
    statsJugador: statsJugador,
    puntajeJugador: puntajeJugador,
    enfrentamientoDirecto: enfrentamientoDirecto,
    tablaGrupo: tablaGrupo,
    tablasDeGrupos: tablasDeGrupos,
    seleccionarClasificados: seleccionarClasificados,
    conteoDeClasificados: conteoDeClasificados,
    ordenSiembra: ordenSiembra,
    tamanoCuadro: tamanoCuadro,
    generarCuadro: generarCuadro,
    resolverCuadro: resolverCuadro
  };

  global.TorneoModel = API;
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
