/*
 * torneo-ui.js — Interfaz: pestañas, captura de marcadores y pintado
 * de tablas, ranking y cuadro final.
 */
(function () {
  "use strict";

  var Model = window.TorneoModel;
  var Store = window.TorneoStore;
  var Catalogo = window.TorneoCatalogo;

  var $ = function (selector, raiz) { return (raiz || document).querySelector(selector); };
  var $$ = function (selector, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(selector));
  };

  var vistaActual = "inicio";
  var grupoFiltrado = "todos";

  function escapar(texto) {
    return String(texto == null ? "" : texto)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function pct(valor) {
    return valor == null ? "—" : (valor * 100).toFixed(1) + "%";
  }

  function puntos(valor) {
    return valor == null ? "—" : valor.toFixed(4);
  }

  // ------------------------------------------------------------- pestañas

  // Llave del cuadro con el formulario de captura abierto. Se recuerda para
  // que un repintado —por ejemplo, un cambio que llega de la nube mientras se
  // captura— no cierre el formulario en la cara de quien está anotando.
  var llaveAbierta = "";

  function mostrarVista(nombre) {
    if (nombre !== "cuadro") llaveAbierta = "";
    vistaActual = nombre;
    $$(".tab").forEach(function (tab) {
      tab.classList.toggle("is-active", tab.dataset.vista === nombre);
    });
    $$(".vista").forEach(function (vista) {
      vista.classList.toggle("is-active", vista.id === "vista-" + nombre);
    });
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Mensaje único cuando el torneo todavía no tiene categorías abiertas. */
  function avisarSinCategoria() {
    var aviso = '<div class="vacio-msg">Abre una categoría en la pestaña <strong>Categorías</strong>.</div>';
    Array.prototype.forEach.call(arguments, function (selector) {
      var nodo = $(selector);
      if (nodo) nodo.innerHTML = aviso;
    });
  }

  // ------------------------------------------------------------ categorías

  function pintarCategorias() {
    var abiertas = {};
    Store.categorias().forEach(function (categoria) { abiertas[categoria.id] = categoria; });

    var porRama = {};
    Catalogo.catalogo().forEach(function (definicion) {
      var llave = definicion.rama + " " + definicion.modalidad;
      (porRama[llave] = porRama[llave] || []).push(definicion);
    });

    $("#catalogo-categorias").innerHTML = Object.keys(porRama).map(function (llave) {
      var tarjetas = porRama[llave].map(function (definicion) {
        var categoria = abiertas[definicion.id];
        var resumen = categoria ? Store.resumenCategoria(categoria) : null;
        var detalle = resumen
          ? '<span class="cat-card__detalle">' + resumen.jugadores + " jugadores · " +
            (resumen.sorteada ? resumen.grupos + " grupos · " + resumen.jugados + "/" + resumen.partidos + " partidos"
                              : "sin sortear") + "</span>"
          : '<span class="cat-card__detalle">Cerrada</span>';

        return (
          '<div class="cat-card' + (categoria ? " abierta" : "") + '">' +
          '<label class="cat-card__nombre">' +
          '<input type="checkbox" data-categoria="' + escapar(definicion.id) + '"' +
          (categoria ? " checked" : "") + " /> " + escapar(definicion.subcategoria) + "</label>" +
          detalle + "</div>"
        );
      }).join("");

      return '<div class="cat-grupo"><h3>' + escapar(llave) + "</h3>" + tarjetas + "</div>";
    }).join("");
  }

  /** Selector de categoría activa del encabezado. */
  function pintarSelectorCategoria() {
    var selector = $("#selector-categoria");
    var abiertas = Store.categorias();
    var activa = Store.categoria();

    selector.hidden = !abiertas.length;
    if (!abiertas.length) return;

    selector.innerHTML = abiertas.map(function (categoria) {
      return '<option value="' + escapar(categoria.id) + '"' +
        (activa && categoria.id === activa.id ? " selected" : "") + ">" +
        escapar(categoria.nombre) + "</option>";
    }).join("");
  }

  // ------------------------------------------------------------- jugadores

  function esCabeza(categoria, nombre) {
    return (categoria.cabezas || []).some(function (otro) { return Model.esMismoJugador(otro, nombre); });
  }

  function filaJugador(categoria, nombre, indice) {
    var marcado = esCabeza(categoria, nombre);
    return (
      '<div class="fila-jugador' + (marcado ? " es-cabeza" : "") + '">' +
      "<span>" + (indice + 1) + "</span>" +
      '<button type="button" class="marca-cg' + (marcado ? " is-activa" : "") + '" data-solo-admin' +
      ' data-cg="' + escapar(nombre) + '" aria-pressed="' + (marcado ? "true" : "false") +
      '" title="Cabeza de grupo">CG</button>' +
      '<input type="text" value="' + escapar(nombre) + '" data-tipo="inscrito" data-indice="' + indice + '" />' +
      '<button type="button" class="btn-icono" data-solo-admin data-quitar="inscrito" data-indice="' + indice +
      '" aria-label="Quitar">&times;</button>' +
      "</div>"
    );
  }

  /** Cuántas cabezas faltan y de cuántos jugadores queda cada grupo. */
  function pintarResumenGrupos(categoria) {
    var caja = $("#resumen-grupos");
    if (!caja) return;

    var grupos = categoria.numeroGrupos || 0;
    var marcadas = (categoria.cabezas || []).length;
    var inscritos = (categoria.inscritos || []).length;
    $("#num-grupos").value = grupos;

    if (!grupos) {
      caja.innerHTML = '<p class="nota">Escribe de cuántos grupos será la categoría.</p>';
      return;
    }

    var tamanos = Model.tamanosDeGrupo(inscritos, grupos);
    var minimo = Math.min.apply(null, tamanos);
    var maximo = Math.max.apply(null, tamanos);
    var reparto = minimo === maximo
      ? minimo + " jugadores por grupo"
      : minimo + " o " + maximo + " jugadores por grupo";

    var faltan = grupos - marcadas;
    var estadoCabezas = faltan === 0
      ? '<span class="ok">Ya están las ' + grupos + " cabezas de grupo.</span>"
      : faltan > 0
        ? '<span class="pendiente">Faltan ' + faltan + " por marcar.</span>"
        : '<span class="pendiente">Sobran ' + Math.abs(faltan) + ": desmárcalas o sube el número de grupos.</span>";

    caja.innerHTML =
      '<ul class="resumen-grupos">' +
      "<li><strong>" + grupos + "</strong> grupos · <strong>" + inscritos + "</strong> inscritos</li>" +
      "<li>Cabezas de grupo: <strong>" + marcadas + " de " + grupos + "</strong> " + estadoCabezas + "</li>" +
      (inscritos ? "<li>Quedaría en " + escapar(reparto) + " (" + tamanos.join(", ") + ")</li>" : "") +
      "</ul>";
  }

  function pintarJugadores() {
    var categoria = Store.categoria();
    if (!categoria) return avisarSinCategoria("#resumen-grupos", "#lista-inscritos");
    pintarResumenGrupos(categoria);
    $("#lista-inscritos").innerHTML = categoria.inscritos.length
      ? categoria.inscritos.map(function (nombre, i) { return filaJugador(categoria, nombre, i); }).join("")
      : '<p class="nota">Aún no hay inscritos.</p>';
  }

  // ---------------------------------------------------------------- sorteo

  function pintarSorteo() {
    var categoria = Store.categoria();
    if (!categoria) return avisarSinCategoria("#tabla-sorteo", "#grupos-armados");
    var orden = categoria.sorteo.orden || [];
    var aviso = $("#aviso-sorteo");

    if (categoria.sorteo.congelado) {
      aviso.hidden = false;
      aviso.textContent =
        "El sorteo está congelado. Si lo reabres y vuelves a sortear se rehacen los grupos; " +
        "los resultados de las parejas que sigan enfrentándose se conservan.";
    } else if (orden.length) {
      aviso.hidden = false;
      aviso.textContent = "Sorteo provisional: congélalo para armar los grupos y el calendario.";
    } else {
      aviso.hidden = true;
    }

    $("#tabla-sorteo").innerHTML = orden.length
      ? '<div class="tabla-wrap"><table><thead><tr><th class="num">Orden</th><th>Jugador</th></tr></thead><tbody>' +
        orden.map(function (nombre, i) {
          return '<tr><td class="num">' + (i + 1) + "</td><td>" + escapar(nombre) + "</td></tr>";
        }).join("") +
        "</tbody></table></div>"
      : '<p class="nota">Presiona la pelota para hacer el sorteo.</p>';

    $("#grupos-armados").innerHTML = categoria.grupos.length
      ? categoria.grupos.map(function (grupo) {
          return (
            '<div class="grupo-card"><h3>' + escapar(grupo.nombre) + "</h3><ol>" +
            grupo.jugadores.map(function (jugador) {
              var esCabeza = Model.esMismoJugador(jugador, grupo.cabeza);
              return "<li>" + escapar(jugador) + (esCabeza ? ' <span class="badge badge--cg">CG</span>' : "") + "</li>";
            }).join("") +
            "</ol></div>"
          );
        }).join("")
      : '<p class="nota">Los grupos aparecen al congelar el sorteo.</p>';
  }

  // ---------------------------------------------- tarjeta de partido (HTML)

  /**
   * El tercer set se juega como super muerte a 10 puntos. Sólo un partido
   * viejo, capturado antes de esta regla, puede tener un tercer set con juegos.
   */
  function esSuperMuerte(partido) {
    return !partido || partido.superMuerte !== false;
  }

  function necesitaTieBreak(partido, indice) {
    var set = (partido.sets || [])[indice];
    if (!set) return false;
    if (esSuperMuerte(partido) && indice === 2) return false;
    return (set.a === 7 && set.b === 6) || (set.a === 6 && set.b === 7);
  }

  // Topes de captura: un set normal se gana 6 o 7 juegos; el super tie-break
  // es a 10 puntos pero puede alargarse (12-10, 15-13…), igual que un tie-break.
  var MAX_JUEGOS = 7;
  var MAX_PUNTOS = 30;

  function entradaTieBreak(indice, lado, valor) {
    return (
      '<input type="number" min="0" max="' + MAX_PUNTOS + '" class="tb" placeholder="tb" value="' +
      (valor == null ? "" : valor) + '" data-set="' + indice + '" data-lado="' + lado + '" data-tb="1" />'
    );
  }

  function celdaSet(partido, indice, lado) {
    var set = (partido.sets || [])[indice] || {};
    var esSuper = esSuperMuerte(partido) && indice === 2;
    // Con super muerte los inputs son los puntos del match tie-break, no juegos.
    var valor = esSuper ? (lado === "a" ? set.tbA : set.tbB) : (lado === "a" ? set.a : set.b);

    var html =
      '<input type="number" min="0" max="' + (esSuper ? MAX_PUNTOS : MAX_JUEGOS) +
      '" inputmode="numeric" value="' + (valor == null ? "" : valor) +
      '" data-set="' + indice + '" data-lado="' + lado + '" aria-label="' +
      (esSuper ? "Super muerte" : "Set " + (indice + 1)) + '" />';

    if (necesitaTieBreak(partido, indice)) {
      html += entradaTieBreak(indice, lado, lado === "a" ? set.tbA : set.tbB);
    }
    return "<div>" + html + "</div>";
  }

  function pieDeTarjeta(partido, esCuadro) {
    var ganador = Model.ganadorPartido(partido);
    return (
      '<div class="resultado-texto">' +
      (ganador ? "Gana <strong>" + escapar(ganador) + "</strong> · " + escapar(Model.marcador(partido)) : "Sin resultado") +
      "</div>" +
      '<div class="partido__acciones">' +
      '<span class="regla-super">' +
      (esSuperMuerte(partido)
        ? "Tercer set: super muerte a 10 puntos"
        : "Tercer set capturado con juegos (partido anterior a la regla)") +
      "</span>" +
      '<button type="button" class="btn btn--sm btn--ghost" data-solo-admin data-wo="a">W.O. ' + escapar(partido.jugadorA) + "</button>" +
      '<button type="button" class="btn btn--sm btn--ghost" data-solo-admin data-wo="b">W.O. ' + escapar(partido.jugadorB) + "</button>" +
      '<button type="button" class="btn btn--sm btn--ghost" data-solo-admin data-limpiar="1">Limpiar</button>' +
      (esCuadro ? '<button type="button" class="btn btn--sm" data-cerrar="1">Guardar y cerrar</button>' : "") +
      "</div>"
    );
  }

  function tarjetaPartido(partido, opciones) {
    var config = opciones || {};
    var esCuadro = config.ambito === "cuadro";
    var ganador = Model.ganadorPartido(partido);
    var ganaA = ganador && Model.esMismoJugador(ganador, partido.jugadorA);
    var ganaB = ganador && Model.esMismoJugador(ganador, partido.jugadorB);

    var fechas = esCuadro
      ? ""
      : '<div class="partido__fechas">' +
        '<input type="date" value="' + escapar(partido.fecha || "") + '" data-campo="fecha" />' +
        '<input type="time" value="' + escapar(partido.hora || "") + '" data-campo="hora" />' +
        "</div>";

    return (
      '<div class="partido" data-partido="' + escapar(partido.id) +
      '" data-super="' + (esSuperMuerte(partido) ? "1" : "0") +
      '" data-ambito="' + (config.ambito || "grupo") +
      '" data-titulo="' + escapar(config.titulo || partido.id) +
      '" data-jugador-a="' + escapar(partido.jugadorA) +
      '" data-jugador-b="' + escapar(partido.jugadorB) + '">' +
      '<div class="partido__cabecera">' +
      '<div class="partido__titulo">' + escapar(config.titulo || partido.id) + "</div>" + fechas +
      "</div>" +
      '<div class="marcador-grid">' +
      '<div></div><div class="encabezado">Set 1</div><div class="encabezado">Set 2</div>' +
      '<div class="encabezado" data-encabezado-3>' + (esSuperMuerte(partido) ? "S. muerte" : "Set 3") + "</div>" +
      '<div class="nombre' + (ganaA ? " gana" : "") + '">' + escapar(partido.jugadorA) + "</div>" +
      celdaSet(partido, 0, "a") + celdaSet(partido, 1, "a") + celdaSet(partido, 2, "a") +
      '<div class="nombre' + (ganaB ? " gana" : "") + '">' + escapar(partido.jugadorB) + "</div>" +
      celdaSet(partido, 0, "b") + celdaSet(partido, 1, "b") + celdaSet(partido, 2, "b") +
      "</div>" +
      '<div class="partido__pie">' + pieDeTarjeta(partido, esCuadro) + "</div>" +
      "</div>"
    );
  }

  // ------------------------------------- lectura y actualización en caliente

  /** Lee los inputs de una tarjeta y devuelve el marcador en el formato del modelo. */
  function leerMarcador(tarjeta) {
    var superMuerte = tarjeta.dataset.super !== "0";
    var sets = [null, null, null];

    for (var indice = 0; indice < 3; indice++) {
      var entradaA = tarjeta.querySelector('input[data-set="' + indice + '"][data-lado="a"]:not([data-tb])');
      var entradaB = tarjeta.querySelector('input[data-set="' + indice + '"][data-lado="b"]:not([data-tb])');
      var tbA = tarjeta.querySelector('input[data-set="' + indice + '"][data-lado="a"][data-tb]');
      var tbB = tarjeta.querySelector('input[data-set="' + indice + '"][data-lado="b"][data-tb]');

      var valorA = entradaA && entradaA.value !== "" ? Number(entradaA.value) : null;
      var valorB = entradaB && entradaB.value !== "" ? Number(entradaB.value) : null;
      if (valorA == null && valorB == null) continue;
      valorA = valorA || 0;
      valorB = valorB || 0;

      if (superMuerte && indice === 2) {
        // El match tie-break se registra 7-6 en sets; los puntos quedan de constancia.
        sets[indice] = { a: valorA > valorB ? 7 : 6, b: valorA > valorB ? 6 : 7, tbA: valorA, tbB: valorB };
      } else {
        var set = { a: valorA, b: valorB };
        if (tbA && tbA.value !== "") set.tbA = Number(tbA.value);
        if (tbB && tbB.value !== "") set.tbB = Number(tbB.value);
        sets[indice] = set;
      }
    }

    while (sets.length && !sets[sets.length - 1]) sets.pop();
    return { sets: sets, superMuerte: superMuerte };
  }

  /** Partido reconstruido a partir de lo que hay en pantalla. */
  function partidoDeTarjeta(tarjeta) {
    var marcador = leerMarcador(tarjeta);
    return {
      id: tarjeta.dataset.partido,
      jugadorA: tarjeta.dataset.jugadorA,
      jugadorB: tarjeta.dataset.jugadorB,
      sets: marcador.sets,
      superMuerte: marcador.superMuerte
    };
  }

  /** Agrega o quita los campos de tie-break según cómo vaya quedando el set. */
  function sincronizarTieBreaks(tarjeta, partido) {
    [0, 1, 2].forEach(function (indice) {
      var necesita = necesitaTieBreak(partido, indice);
      ["a", "b"].forEach(function (lado) {
        var base = tarjeta.querySelector('input[data-set="' + indice + '"][data-lado="' + lado + '"]:not([data-tb])');
        if (!base) return;
        var contenedor = base.parentNode;
        var existente = contenedor.querySelector("input[data-tb]");
        if (necesita && !existente) contenedor.insertAdjacentHTML("beforeend", entradaTieBreak(indice, lado, null));
        if (!necesita && existente) existente.remove();
      });
    });
  }

  /** Refresca ganador, marcador y tie-breaks sin volver a dibujar la tarjeta. */
  function actualizarTarjeta(tarjeta) {
    var partido = partidoDeTarjeta(tarjeta);
    var ganador = Model.ganadorPartido(partido);
    var nombres = $$(".marcador-grid .nombre", tarjeta);

    if (nombres[0]) nombres[0].classList.toggle("gana", !!ganador && Model.esMismoJugador(ganador, partido.jugadorA));
    if (nombres[1]) nombres[1].classList.toggle("gana", !!ganador && Model.esMismoJugador(ganador, partido.jugadorB));

    $(".resultado-texto", tarjeta).innerHTML = ganador
      ? "Gana <strong>" + escapar(ganador) + "</strong> · " + escapar(Model.marcador(partido))
      : "Sin resultado";

    sincronizarTieBreaks(tarjeta, partido);
  }

  /** Vuelve a dibujar una sola tarjeta (al cambiar super muerte, W.O. o limpiar). */
  function reconstruirTarjeta(tarjeta) {
    var esCuadro = tarjeta.dataset.ambito === "cuadro";
    var id = tarjeta.dataset.partido;
    var partido;

    if (esCuadro) {
      var guardado = (Store.categoria() || { cuadro: {} }).cuadro[id] || {};
      partido = {
        id: id,
        jugadorA: tarjeta.dataset.jugadorA,
        jugadorB: tarjeta.dataset.jugadorB,
        sets: guardado.sets || [],
        superMuerte: guardado.superMuerte !== false
      };
    } else {
      partido = Store.partidoPorId(id);
      if (!partido) return;
    }

    tarjeta.outerHTML = tarjetaPartido(partido, { titulo: tarjeta.dataset.titulo, ambito: tarjeta.dataset.ambito });
  }

  function guardarMarcador(tarjeta) {
    var id = tarjeta.dataset.partido;
    var datos = leerMarcador(tarjeta);
    if (tarjeta.dataset.ambito === "cuadro") Store.setResultadoCuadro(id, datos.sets.length ? datos : null);
    else Store.setPartido(id, datos);
  }

  // ------------------------------------------------------------ resultados

  function pintarResultados() {
    var categoria = Store.categoria();
    if (!categoria) return avisarSinCategoria("#filtro-grupos", "#lista-partidos");

    $("#filtro-grupos").innerHTML = [{ nombre: "todos", etiqueta: "Todos" }]
      .concat(categoria.grupos.map(function (grupo) { return { nombre: grupo.nombre, etiqueta: grupo.nombre }; }))
      .map(function (opcion) {
        return '<button type="button" class="chip' + (opcion.nombre === grupoFiltrado ? " is-active" : "") +
          '" data-grupo="' + escapar(opcion.nombre) + '">' + escapar(opcion.etiqueta) + "</button>";
      })
      .join("");

    var visibles = categoria.partidos.filter(function (partido) {
      return grupoFiltrado === "todos" || partido.grupo === grupoFiltrado;
    });

    $("#lista-partidos").innerHTML = visibles.length
      ? visibles.map(function (partido, indice) {
          return tarjetaPartido(partido, {
            titulo: partido.grupo + " · Partido " + (partido.id.split("-P")[1] || indice + 1),
            ambito: "grupo"
          });
        }).join("")
      : '<div class="vacio-msg">Congela el sorteo para generar el calendario de partidos.</div>';
  }

  // ---------------------------------------------------------------- grupos

  var NOMBRES_POSICION = [
    "Primeros lugares", "Segundos lugares", "Terceros lugares",
    "Cuartos lugares", "Quintos lugares"
  ];

  /** Panel de cupos con la cuenta de clasificados y el cuadro que resulta. */
  function pintarConfigClasifican(datos) {
    var contenedor = $("#config-clasifican");
    if (!contenedor) return;

    var categoria = Store.categoria();
    if (!categoria) return avisarSinCategoria("#config-clasifican");
    var maxJugadores = (categoria.grupos || []).reduce(function (max, grupo) {
      return Math.max(max, (grupo.jugadores || []).length);
    }, 0);

    if (!maxJugadores) {
      contenedor.innerHTML = '<p class="nota">Arma los grupos para configurar la clasificación.</p>';
      return;
    }

    var cupos = (categoria.clasifican.cupos || []).slice();
    var filas = [];

    for (var posicion = 1; posicion <= maxJugadores; posicion++) {
      var detalle = datos.conteo.detalle[posicion - 1] || { disponibles: 0, entran: 0 };
      var disponibles = detalle.disponibles;
      var actual = cupos[posicion - 1];
      if (actual == null) actual = 0;

      var opciones = ['<option value="todos"' + (actual === "todos" ? " selected" : "") + ">Todos</option>"];
      for (var n = 0; n <= disponibles; n++) {
        opciones.push('<option value="' + n + '"' + (actual === n ? " selected" : "") + ">" + n + "</option>");
      }

      filas.push(
        '<tr><td>' + escapar(NOMBRES_POSICION[posicion - 1] || "Posición " + posicion) + "</td>" +
        '<td><select data-cupo="' + posicion + '">' + opciones.join("") + "</select></td>" +
        '<td class="num">' + disponibles + "</td>" +
        '<td class="num"><strong>' + detalle.entran + "</strong></td></tr>"
      );
    }

    var total = datos.conteo.total;
    var resumen = total < 2
      ? "Se necesitan al menos 2 clasificados para armar el cuadro."
      : "<strong>" + total + "</strong> clasificados → cuadro de <strong>" + datos.conteo.tamanoCuadro +
        "</strong>" + (datos.conteo.byes ? " con <strong>" + datos.conteo.byes + "</strong> BYE" : ", sin BYE ✓");

    contenedor.innerHTML =
      '<div class="tabla-wrap"><table><thead><tr>' +
      "<th>Posición de grupo</th><th>Cupo</th><th class=\"num\">Disponibles</th><th class=\"num\">Entran</th>" +
      "</tr></thead><tbody>" + filas.join("") + "</tbody></table></div>" +
      '<p class="resumen-clasifican">' + resumen + "</p>";
  }

  function pintarGrupos() {
    var datos = Store.derivado();
    pintarConfigClasifican(datos);

    $("#tablas-grupos").innerHTML = datos.tablas.length
      ? datos.tablas.map(function (tabla) {
          var filas = tabla.filas.map(function (fila) {
            var opciones = [0, 1, 2, 3, 4, 5].map(function (nivel) {
              return '<option value="' + nivel + '"' + (nivel === fila.desempate ? " selected" : "") + ">" +
                (nivel === 0 ? "—" : nivel) + "</option>";
            }).join("");
            return (
              "<tr" + (fila.clasificado ? ' class="clasificado"' : "") + ">" +
              '<td class="num">' + fila.posicion + "</td>" +
              '<td class="jugador">' + escapar(fila.jugador) +
              (fila.esCabeza ? ' <span class="badge badge--cg">CG</span>' : "") +
              (fila.clasificado ? ' <span class="badge badge--ok" title="Clasifica al cuadro final">✓</span>' : "") + "</td>" +
              '<td class="num">' + fila.pj + "</td>" +
              '<td class="num">' + fila.pg + "-" + fila.pp + "</td>" +
              '<td class="num">' + fila.sg + "-" + fila.sp + "</td>" +
              '<td class="num" data-solo-admin>' + pct(fila.pctSets) + "</td>" +
              '<td class="num">' + fila.jg + "-" + fila.jp + "</td>" +
              '<td class="num" data-solo-admin>' + pct(fila.pctJuegos) + "</td>" +
              '<td class="num"><strong>' + puntos(fila.puntaje) + "</strong></td>" +
              '<td data-solo-admin><select class="select-desempate" data-desempate="' + escapar(fila.jugador) + '">' +
              opciones + "</select></td></tr>"
            );
          }).join("");

          return (
            '<div class="grupo-card"><h3>' + escapar(tabla.grupo.nombre) +
            "<small>CG: " + escapar(tabla.grupo.cabeza) + "</small></h3>" +
            '<div class="tabla-wrap"><table><thead><tr>' +
            '<th class="num">#</th><th>Jugador</th><th class="num" title="Partidos jugados">PJ</th>' +
            '<th class="num" title="Partidos ganados - perdidos">PG-PP</th><th class="num">Sets</th>' +
            '<th class="num" data-solo-admin>%S</th><th class="num">Juegos</th>' +
            '<th class="num" data-solo-admin>%J</th>' +
            '<th class="num">Puntaje</th><th data-solo-admin>Des.</th>' +
            "</tr></thead><tbody>" + filas + "</tbody></table></div></div>"
          );
        }).join("")
      : '<div class="vacio-msg">Arma los grupos desde la pestaña Sorteo.</div>';
  }

  // --------------------------------------------------------------- ranking

  function pintarRanking() {
    var datos = Store.derivado();

    $("#tabla-ranking").innerHTML = datos.ranking.length
      ? '<div class="tabla-wrap"><table><thead><tr>' +
        '<th class="num">RKN</th><th>Jugador</th><th>Grupo</th><th class="num">Pos.</th>' +
        '<th class="num" data-solo-admin>% sets</th><th class="num" data-solo-admin>% juegos</th>' +
        '<th class="num">Puntaje</th>' +
        "</tr></thead><tbody>" +
        datos.ranking.map(function (fila) {
          return (
            '<tr><td class="num">' + fila.rkn + "</td>" +
            '<td class="jugador">' + escapar(fila.jugador) + "</td>" +
            "<td>" + escapar(fila.grupo) + "</td>" +
            '<td class="num">' + fila.posicion + "</td>" +
            '<td class="num" data-solo-admin>' + pct(fila.pctSets) + "</td>" +
            '<td class="num" data-solo-admin>' + pct(fila.pctJuegos) + "</td>" +
            '<td class="num"><strong>' + puntos(fila.puntaje) + "</strong></td></tr>"
          );
        }).join("") +
        "</tbody></table></div>"
      : '<div class="vacio-msg">Aún no hay clasificados: captura resultados de los grupos.</div>';
  }

  // ---------------------------------------------------------------- cuadro

  function ladoDeLlave(lado, esGanador, esPrimeraRonda) {
    // En la primera ronda un lugar vacío es un BYE; después es un partido pendiente.
    if (!lado) return '<div class="llave__lado vacio">' + (esPrimeraRonda ? "BYE" : "Por definir") + "</div>";
    return (
      '<div class="llave__lado' + (esGanador ? " gana" : "") + '">' +
      "<span>" + escapar(lado.jugador) + "</span>" +
      '<span class="llave__seed">' + (lado.seed ? "#" + lado.seed : "") + "</span></div>"
    );
  }

  function llaveDeCuadro(partido, esPrimeraRonda, ala) {
    var jugable = partido.ladoA && partido.ladoB;
    var clase = partido.ganador ? "resuelta" : jugable ? "jugable" : "";
    var marcador = partido.marcador ? '<div class="llave__marcador">' + escapar(partido.marcador) + "</div>" : "";
    var boton = jugable
      ? '<div class="llave__editar" data-solo-admin><button type="button" class="btn btn--sm btn--ghost" data-llave="' +
        escapar(partido.id) + '">' + (partido.ganador ? "Editar marcador" : "Capturar marcador") + "</button></div>"
      : "";
    var ganaA = partido.ganador && partido.ladoA && partido.ganador.jugador === partido.ladoA.jugador;
    var ganaB = partido.ganador && partido.ladoB && partido.ganador.jugador === partido.ladoB.jugador;

    return (
      '<div class="llave-slot"><div class="llave ' + clase + (ala === "der" ? " llave--der" : "") + '">' +
      ladoDeLlave(partido.ladoA, ganaA, esPrimeraRonda) +
      ladoDeLlave(partido.ladoB, ganaB, esPrimeraRonda) +
      marcador + boton +
      '<div class="llave__form" data-form="' + escapar(partido.id) + '" hidden></div>' +
      "</div></div>"
    );
  }

  function columnaDeRonda(ronda, indiceRonda, partidos, ala) {
    var llaves = partidos.map(function (partido) {
      return llaveDeCuadro(partido, indiceRonda === 0, ala);
    }).join("");

    return '<div class="ronda ronda--r' + indiceRonda + '"><div class="ronda__titulo">' +
      escapar(ronda.nombre) + '</div><div class="ronda__llaves">' + llaves + "</div></div>";
  }

  /**
   * Cuadro en espejo: la mitad de arriba del sorteo avanza de izquierda a
   * derecha, la de abajo de derecha a izquierda, y la final queda al centro.
   * Es el tablero de toda la vida, el que se lee de un vistazo.
   */
  function pintarCuadro() {
    var datos = Store.derivado();
    var cuadro = datos.cuadro;
    var nota = $("#nota-cuadro");

    if (!cuadro) {
      nota.textContent = "Se necesitan al menos dos clasificados para armar el cuadro.";
      $("#cuadro").innerHTML = '<div class="vacio-msg">Sin clasificados todavía.</div>';
      return;
    }

    nota.innerHTML =
      "Cuadro de <strong>" + cuadro.tamano + "</strong> lugares con <strong>" + datos.ranking.length +
      "</strong> clasificados" +
      (cuadro.byes
        ? " y <strong>" + cuadro.byes + "</strong> BYE. Los mejores sembrados reciben el BYE y " +
          "avanzan solos a la siguiente ronda."
        : ", sin BYE: todos arrancan en la primera ronda.");

    var rondas = cuadro.rondas;
    var laFinal = rondas[rondas.length - 1];
    var previas = rondas.slice(0, -1);

    function mitad(ronda, ala) {
      var corte = Math.ceil(ronda.partidos.length / 2);
      return ala === "izq" ? ronda.partidos.slice(0, corte) : ronda.partidos.slice(corte);
    }

    var izquierda = previas.map(function (ronda, i) {
      return columnaDeRonda(ronda, i, mitad(ronda, "izq"), "izq");
    }).join("");

    // El ala derecha se lee de adentro hacia afuera: semifinal primero.
    var derecha = previas.map(function (ronda, i) {
      return columnaDeRonda(ronda, i, mitad(ronda, "der"), "der");
    }).reverse().join("");

    var campeon = cuadro.campeon
      ? '<div class="campeon"><span>Campeón</span><strong>' + escapar(cuadro.campeon.jugador) + "</strong>" +
        (cuadro.finalista ? "<small>Finalista: " + escapar(cuadro.finalista.jugador) + "</small>" : "") +
        "</div>"
      : "";

    var centro =
      '<div class="cuadro__centro">' +
      '<div class="ronda ronda--final"><div class="ronda__titulo">' + escapar(laFinal.nombre) + "</div>" +
      '<div class="ronda__llaves">' +
      laFinal.partidos.map(function (partido) {
        return llaveDeCuadro(partido, rondas.length === 1, "");
      }).join("") +
      "</div></div>" + campeon +
      "</div>";

    $("#cuadro").innerHTML =
      '<div class="cuadro__ala cuadro__ala--izq">' + izquierda + "</div>" +
      centro +
      '<div class="cuadro__ala cuadro__ala--der">' + derecha + "</div>";

    if (llaveAbierta) abrirFormularioLlave(llaveAbierta);
  }

  /** Abre el formulario de marcador dentro de una llave del cuadro. */
  function abrirFormularioLlave(id) {
    var datos = Store.derivado();
    var partido = null;
    datos.cuadro.rondas.forEach(function (ronda) {
      ronda.partidos.forEach(function (candidato) { if (candidato.id === id) partido = candidato; });
    });
    if (!partido || !partido.ladoA || !partido.ladoB) return;

    var guardado = (Store.categoria() || { cuadro: {} }).cuadro[id] || {};
    var contenedor = $('[data-form="' + id + '"]');
    if (!contenedor) return;
    llaveAbierta = id;
    contenedor.hidden = false;
    contenedor.innerHTML = tarjetaPartido(
      {
        id: id,
        jugadorA: partido.ladoA.jugador,
        jugadorB: partido.ladoB.jugador,
        sets: guardado.sets || [],
        superMuerte: guardado.superMuerte !== false
      },
      { titulo: partido.id, ambito: "cuadro" }
    );
  }

  // -------------------------------------------------------- inicio y KPIs

  function pintarInicio() {
    var estado = Store.estado();
    var categoria = Store.categoria() || { cabezas: [], inscritos: [], grupos: [], partidos: [] };
    var datos = Store.derivado();
    var jugados = categoria.partidos.filter(function (partido) { return Model.ganadorPartido(partido); }).length;

    var tarjetas = [
      { valor: Store.categorias().length, etiqueta: "Categorías abiertas" },
      { valor: categoria.inscritos.length, etiqueta: "Jugadores" },
      { valor: categoria.grupos.length, etiqueta: "Grupos" },
      { valor: jugados + " / " + categoria.partidos.length, etiqueta: "Partidos de grupo jugados" },
      { valor: datos.ranking.length, etiqueta: "Clasificados" },
      { valor: datos.cuadro ? datos.cuadro.tamano : "—", etiqueta: "Lugares en el cuadro" },
      { valor: datos.cuadro && datos.cuadro.campeon ? datos.cuadro.campeon.jugador : "—", etiqueta: "Campeón" }
    ];

    $("#kpis").innerHTML = tarjetas.map(function (tarjeta) {
      return '<div class="kpi"><strong>' + escapar(tarjeta.valor) + "</strong><span>" +
        escapar(tarjeta.etiqueta) + "</span></div>";
    }).join("");

    $("#torneo-nombre").value = estado.torneo.nombre || "";
    $("#torneo-sede").value = estado.torneo.sede || "";
    $("#torneo-inicio").value = estado.torneo.inicio || "";
    $("#torneo-fin").value = estado.torneo.fin || "";
  }

  function pintarCabecera() {
    var torneo = Store.estado().torneo;
    var categoria = Store.categoria();
    var partes = [torneo.nombre, categoria && categoria.nombre].filter(Boolean);
    $("#brand-torneo").textContent = partes.join(" · ") || "Torneo sin nombre";

    var tablero = $("#cuadro-titulo");
    if (tablero) tablero.textContent = partes.join(" · ") || "Cuadro final";
  }

  var soloLectura = false;
  // Crear, importar o reemplazar torneos es del dueño; el administrador sólo
  // trabaja dentro del torneo que le asignaron.
  var soloDueno = false;

  // Vistas que sólo tienen sentido para quien administra el torneo.
  var VISTAS_DE_ADMIN = ["categorias", "jugadores", "sorteo"];

  /** Deja la app en modo consulta para quien no puede capturar. */
  function aplicarModoLectura() {
    document.body.classList.toggle("solo-lectura", soloLectura);
    $$(".app-main input, .app-main select, .app-main textarea").forEach(function (campo) {
      campo.disabled = soloLectura;
    });
    $$("[data-solo-admin]").forEach(function (nodo) {
      nodo.hidden = soloLectura;
    });
    $$("[data-solo-dueno]").forEach(function (nodo) {
      nodo.hidden = soloLectura || soloDueno;
    });

    // Si el espectador estaba parado en una vista de administración, sacarlo.
    if (soloLectura && VISTAS_DE_ADMIN.indexOf(vistaActual) !== -1) {
      mostrarVista("inicio");
    }
  }

  function setSoloLectura(valor) {
    soloLectura = !!valor;
    aplicarModoLectura();
  }

  /** true cuando la sesión NO es la del dueño: se ocultan sus herramientas. */
  function setSoloDueno(valor) {
    soloDueno = !!valor;
    aplicarModoLectura();
  }

  /**
   * Dónde está el cursor dentro de una tarjeta de partido. Al repintar por un
   * cambio propio o de la nube hay que devolverlo a su sitio: si no, cada
   * número capturado saca a quien está anotando.
   */
  function huellaDelFoco() {
    var activo = document.activeElement;
    if (!activo || !activo.matches || !activo.matches("input, select")) return null;
    var tarjeta = activo.closest(".partido");
    if (!tarjeta) return null;
    var huella = {
      partido: tarjeta.dataset.partido,
      ambito: tarjeta.dataset.ambito || "grupo",
      campo: activo.dataset.campo || "",
      set: activo.dataset.set,
      lado: activo.dataset.lado,
      tb: activo.dataset.tb ? "1" : "",
      cursor: null
    };
    // Los input de tipo number no permiten leer la posición del cursor.
    try { huella.cursor = activo.selectionStart; } catch (error) { huella.cursor = null; }
    return huella;
  }

  function restaurarFoco(huella) {
    if (!huella) return;
    var tarjeta = $('.partido[data-ambito="' + huella.ambito + '"][data-partido="' + huella.partido + '"]');
    if (!tarjeta) return;
    var selector = huella.campo
      ? '[data-campo="' + huella.campo + '"]'
      : 'input[data-set="' + huella.set + '"][data-lado="' + huella.lado + '"]' +
        (huella.tb ? "[data-tb]" : ":not([data-tb])");
    var entrada = $(selector, tarjeta);
    if (!entrada || entrada === document.activeElement) return;
    entrada.focus();
    if (huella.cursor != null) {
      try { entrada.setSelectionRange(huella.cursor, huella.cursor); } catch (error) { /* number input */ }
    }
  }

  function render() {
    var foco = huellaDelFoco();
    pintarCabecera();
    pintarSelectorCategoria();
    if (vistaActual === "categorias") pintarCategorias();
    if (vistaActual === "inicio") pintarInicio();
    if (vistaActual === "jugadores") pintarJugadores();
    if (vistaActual === "sorteo") pintarSorteo();
    if (vistaActual === "resultados") pintarResultados();
    if (vistaActual === "grupos") pintarGrupos();
    if (vistaActual === "ranking") pintarRanking();
    if (vistaActual === "cuadro") pintarCuadro();
    aplicarModoLectura();
    restaurarFoco(foco);
  }

  // ------------------------------------------------------------- eventos

  function listaDeInscritos() {
    var categoria = Store.categoria();
    return categoria ? categoria.inscritos.slice() : [];
  }

  /** Nadie gana un set con más de 7 juegos ni pierde con menos de 0. */
  function limitarCaptura(entrada) {
    if (entrada.value === "") return;
    var tope = Number(entrada.max);
    var valor = Number(entrada.value);
    if (!isFinite(valor)) return;
    if (valor > tope) entrada.value = String(tope);
    if (valor < 0) entrada.value = "0";
  }

  /** Mientras se escribe: sólo refrescamos la tarjeta, sin re-dibujar la vista. */
  function alEscribirEnPartido(evento) {
    var tarjeta = evento.target.closest(".partido");
    if (!tarjeta || !evento.target.matches("input[data-set]")) return;
    limitarCaptura(evento.target);
    actualizarTarjeta(tarjeta);
  }

  function alCambiarEnPartido(evento) {
    var tarjeta = evento.target.closest(".partido");
    if (!tarjeta) return;

    if (evento.target.matches("[data-campo]")) {
      Store.setPartido(tarjeta.dataset.partido, {
        fecha: $('[data-campo="fecha"]', tarjeta).value,
        hora: $('[data-campo="hora"]', tarjeta).value
      });
      return;
    }

    if (evento.target.matches("input[data-set]")) {
      guardarMarcador(tarjeta);
      actualizarTarjeta(tarjeta);
    }
  }

  function alClicEnPartido(evento) {
    var tarjeta = evento.target.closest(".partido");
    if (!tarjeta) return false;

    var esCuadro = tarjeta.dataset.ambito === "cuadro";

    if (evento.target.closest("[data-cerrar]")) {
      guardarMarcador(tarjeta);
      llaveAbierta = "";
      pintarCuadro();
      return true;
    }

    var wo = evento.target.closest("[data-wo]");
    var limpiar = evento.target.closest("[data-limpiar]");
    if (!wo && !limpiar) return false;

    var sets = [];
    if (wo) {
      var ganaA = wo.dataset.wo === "a";
      sets = [
        { a: ganaA ? 6 : 0, b: ganaA ? 0 : 6 },
        { a: ganaA ? 6 : 0, b: ganaA ? 0 : 6 }
      ];
    }

    if (esCuadro) {
      Store.setResultadoCuadro(tarjeta.dataset.partido, sets.length ? { sets: sets, superMuerte: true } : null);
      pintarCuadro();
    } else {
      Store.setPartido(tarjeta.dataset.partido, { sets: sets, superMuerte: true });
      reconstruirTarjeta(tarjeta);
    }
    return true;
  }

  function conectarEventos() {
    $("#tabs").addEventListener("click", function (evento) {
      var tab = evento.target.closest(".tab");
      if (tab) mostrarVista(tab.dataset.vista);
    });

    // --- datos del torneo
    $("#form-torneo").addEventListener("input", function () {
      Store.setDatosTorneo({
        nombre: $("#torneo-nombre").value,
        sede: $("#torneo-sede").value,
        inicio: $("#torneo-inicio").value,
        fin: $("#torneo-fin").value
      });
      pintarCabecera();
    });

    // --- jugadores
    $("#vista-jugadores").addEventListener("change", function (evento) {
      if (evento.target.id === "num-grupos") {
        Store.setNumeroGrupos(evento.target.value);
        pintarJugadores();
        return;
      }
      var entrada = evento.target.closest("input[data-tipo]");
      if (!entrada) return;
      var categoria = Store.categoria();
      if (!categoria) return;
      var lista = listaDeInscritos();
      var indice = Number(entrada.dataset.indice);
      var anterior = lista[indice];
      var nuevoNombre = entrada.value.trim();
      // Corregir el nombre de una cabeza de grupo no debe quitarle la marca.
      var cabezasPrevias = (categoria.cabezas || []).slice();
      var eraCabeza = !!anterior && esCabeza(categoria, anterior);

      lista[indice] = nuevoNombre;
      Store.setInscritos(lista.filter(Boolean));
      if (nuevoNombre && eraCabeza) {
        Store.setCabezas(cabezasPrevias.map(function (nombre) {
          return Model.esMismoJugador(nombre, anterior) ? nuevoNombre : nombre;
        }));
      }
      pintarJugadores();
    });

    $("#vista-jugadores").addEventListener("click", function (evento) {
      var marca = evento.target.closest("[data-cg]");
      if (marca) {
        var motivo = Store.alternarCabeza(marca.dataset.cg);
        if (motivo) window.alert(motivo);
        pintarJugadores();
        return;
      }

      var quitar = evento.target.closest("[data-quitar]");
      if (!quitar) return;
      var lista = listaDeInscritos();
      lista.splice(Number(quitar.dataset.indice), 1);
      Store.setInscritos(lista);
      pintarJugadores();
    });

    $("#btn-agregar-inscrito").addEventListener("click", function () {
      Store.setInscritos(listaDeInscritos().concat("Nuevo jugador"));
      pintarJugadores();
    });

    $("#btn-pegar-inscritos").addEventListener("click", function () {
      var lineas = $("#pegar-inscritos").value.split("\n").map(function (linea) { return linea.trim(); });
      Store.setInscritos(lineas.filter(Boolean));
      $("#pegar-inscritos").value = "";
      pintarJugadores();
    });

    // --- sorteo
    $("#btn-sortear").addEventListener("click", function () {
      var categoria = Store.categoria();
      if (!categoria) return window.alert("Abre una categoría antes de sortear.");
      if (categoria.sorteo.congelado) {
        window.alert("El sorteo está congelado. Reábrelo para volver a sortear.");
        return;
      }
      if (!categoria.inscritos.length) {
        window.alert("Primero captura a los inscritos.");
        return;
      }
      if (!Store.porSortear(categoria).length) {
        window.alert("Todos los inscritos están marcados como cabeza de grupo: no hay a quién sortear.");
        return;
      }
      var pelota = $("#btn-sortear");
      pelota.classList.add("girando");
      window.setTimeout(function () { pelota.classList.remove("girando"); }, 700);
      Store.sortear();
      pintarSorteo();
    });

    $("#btn-congelar").addEventListener("click", function () {
      var categoria = Store.categoria();
      if (!categoria) return window.alert("Abre una categoría antes de sortear.");
      if (!categoria.sorteo.orden.length) {
        window.alert("Haz el sorteo antes de congelarlo.");
        return;
      }
      var faltan = Store.cabezasQueFaltan(categoria);
      if (!categoria.numeroGrupos) {
        window.alert("Indica de cuántos grupos será la categoría en la pestaña Jugadores.");
        return;
      }
      if (faltan !== 0) {
        window.alert(faltan > 0
          ? "Faltan " + faltan + " cabezas de grupo por marcar en la pestaña Jugadores."
          : "Hay " + Math.abs(faltan) + " cabezas de grupo de más para " + categoria.numeroGrupos + " grupos.");
        return;
      }
      Store.congelarSorteo();
      pintarSorteo();
    });

    $("#btn-reabrir").addEventListener("click", function () {
      Store.reabrirSorteo();
      pintarSorteo();
    });

    // --- resultados
    $("#filtro-grupos").addEventListener("click", function (evento) {
      var chip = evento.target.closest(".chip");
      if (!chip) return;
      grupoFiltrado = chip.dataset.grupo;
      pintarResultados();
    });

    $("#lista-partidos").addEventListener("input", alEscribirEnPartido);
    $("#lista-partidos").addEventListener("change", alCambiarEnPartido);
    $("#lista-partidos").addEventListener("click", alClicEnPartido);

    // --- categorías
    $("#catalogo-categorias").addEventListener("change", function (evento) {
      var casilla = evento.target.closest("[data-categoria]");
      if (!casilla) return;
      var id = casilla.dataset.categoria;

      if (casilla.checked) {
        Store.abrirCategoria(id);
      } else {
        var categoria = Store.categorias().filter(function (cat) { return cat.id === id; })[0];
        var resumen = categoria ? Store.resumenCategoria(categoria) : null;
        var tieneDatos = resumen && (resumen.jugadores > 0 || resumen.jugados > 0);
        if (tieneDatos && !window.confirm("Se borrarán los datos capturados de esta categoría. ¿Continuar?")) {
          casilla.checked = true;
          return;
        }
        Store.cerrarCategoria(id);
      }
      render();
    });

    $("#selector-categoria").addEventListener("change", function (evento) {
      Store.setCategoriaActiva(evento.target.value);
      grupoFiltrado = "todos";
      render();
    });

    // --- configuración de clasificados
    $("#config-clasifican").addEventListener("change", function (evento) {
      var select = evento.target.closest("[data-cupo]");
      if (!select) return;
      Store.setCupo(Number(select.dataset.cupo), select.value);
      pintarGrupos();
    });

    // --- grupos
    $("#tablas-grupos").addEventListener("change", function (evento) {
      var select = evento.target.closest("[data-desempate]");
      if (!select) return;
      Store.setDesempate(select.dataset.desempate, select.value);
      pintarGrupos();
    });

    // --- cuadro
    $("#cuadro").addEventListener("click", function (evento) {
      if (alClicEnPartido(evento)) return;
      var boton = evento.target.closest("[data-llave]");
      if (boton) abrirFormularioLlave(boton.dataset.llave);
    });
    $("#cuadro").addEventListener("input", alEscribirEnPartido);
    $("#cuadro").addEventListener("change", alCambiarEnPartido);

    // --- archivo
    $("#btn-exportar").addEventListener("click", function () {
      var estado = Store.estado();
      var blob = new Blob([Store.exportar()], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = (categoria.torneo.nombre || "torneo").replace(/[^\w-]+/g, "-").toLowerCase() + ".json";
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);
    });

    $("#btn-importar").addEventListener("click", function () { $("#input-importar").click(); });

    $("#input-importar").addEventListener("change", function (evento) {
      var archivo = evento.target.files && evento.target.files[0];
      if (!archivo) return;
      var lector = new FileReader();
      lector.onload = function () {
        try {
          Store.importar(String(lector.result));
          render();
        } catch (error) {
          window.alert("El archivo no tiene el formato esperado.");
        }
      };
      lector.readAsText(archivo);
      evento.target.value = "";
    });

    $("#btn-ejemplo").addEventListener("click", function () {
      if (!window.confirm("Esto reemplaza el torneo actual por el de ejemplo. ¿Continuar?")) return;
      Store.cargarEjemplo();
      render();
    });

    $("#btn-nuevo").addEventListener("click", function () {
      var enLaNube = !!Store.estado().torneoId;
      var aviso = enLaNube
        ? "Vas a empezar un torneo nuevo en blanco. El torneo que está en la nube NO se borra: " +
          "sigue ahí y lo puedes volver a abrir cuando quieras. ¿Continuar?"
        : "Esto borra el torneo actual. ¿Continuar?";
      if (!window.confirm(aviso)) return;
      Store.nuevoTorneo();
      grupoFiltrado = "todos";
      render();
    });
  }

  window.TorneoUI = {
    render: render,
    setSoloLectura: setSoloLectura,
    setSoloDueno: setSoloDueno,
    escapar: escapar
  };

  document.addEventListener("DOMContentLoaded", function () {
    Store.cargar();
    conectarEventos();
    render();
  });
})();
