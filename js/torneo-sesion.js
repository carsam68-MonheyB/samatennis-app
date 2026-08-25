/*
 * torneo-sesion.js — Une la nube con la app: sesión, permisos y sincronización.
 *
 * Si Firebase no está disponible, o si el torneo abierto es sólo local, la app
 * se comporta exactamente como antes: todo en el navegador y editable.
 */
(function () {
  "use strict";

  var Store = window.TorneoStore;
  var UI = window.TorneoUI;

  var $ = function (selector) { return document.querySelector(selector); };
  var nube = null;
  var estadoNube = { disponible: false, motivo: "Conectando…", usuario: null, puedeEditar: false, esDueno: false };

  function escapar(texto) {
    return (UI && UI.escapar ? UI.escapar : String)(texto);
  }

  /** Sólo se bloquea la edición cuando el torneo vive en la nube. */
  function soloLectura() {
    var estado = Store.estado();
    if (!estado.torneoId) return false;
    return !estadoNube.puedeEditar;
  }

  // ------------------------------------------------------------- encabezado

  function pintarSesion() {
    var caja = $("#sesion-estado");
    if (!caja) return;

    if (!estadoNube.disponible) {
      caja.textContent = "Sin nube · sólo este navegador";
      caja.className = "sesion__estado sesion__estado--local";
    } else if (!estadoNube.usuario) {
      caja.textContent = "Modo consulta";
      caja.className = "sesion__estado";
    } else if (estadoNube.puedeEditar) {
      caja.textContent = estadoNube.usuario.correo + (estadoNube.esDueno ? " · dueño" : " · administrador");
      caja.className = "sesion__estado sesion__estado--admin";
    } else {
      caja.textContent = estadoNube.usuario.correo + " · sin permiso de captura";
      caja.className = "sesion__estado";
    }

    $("#btn-entrar").hidden = !estadoNube.disponible || !!estadoNube.usuario;
    $("#btn-salir").hidden = !estadoNube.usuario;
  }

  // ------------------------------------------------------------ panel nube

  function pintarPanelNube() {
    var caja = $("#panel-nube");
    if (!caja) return;

    var estado = Store.estado();

    if (!estadoNube.disponible) {
      caja.innerHTML =
        '<p class="nota">La app está trabajando sólo en este navegador. ' +
        escapar(estadoNube.motivo || "") + "</p>" +
        '<p class="nota">Usa <strong>Exportar</strong> para respaldar el torneo.</p>';
      return;
    }

    var filas = [];

    filas.push(
      '<p class="nota">Torneo abierto: <strong>' +
      (estado.torneoId ? escapar(estado.torneoId) : "ninguno (sólo local)") + "</strong></p>"
    );

    filas.push(
      '<div class="nube-fila">' +
      '<select id="selector-torneo" aria-label="Torneo en la nube"></select>' +
      '<button type="button" class="btn btn--sm" id="btn-abrir-torneo">Abrir</button>' +
      '<button type="button" class="btn btn--sm btn--ghost" id="btn-recargar-torneos">Actualizar lista</button>' +
      "</div>"
    );

    if (estadoNube.esDueno) {
      filas.push(
        '<div class="nube-fila">' +
        '<input type="text" id="nuevo-torneo-id" placeholder="copa-2026" />' +
        '<button type="button" class="btn btn--sm" id="btn-subir-torneo">Subir este torneo a la nube</button>' +
        "</div>" +
        '<p class="nota">El identificador va en la liga y no se puede cambiar después: usa minúsculas y guiones.</p>'
      );

      if (estado.torneoId) {
        filas.push(
          '<label class="nube-admins">Administradores de este torneo, un correo por línea' +
          '<textarea id="admins-torneo" rows="3">' + escapar((estado.admins || []).join("\n")) + "</textarea>" +
          "</label>" +
          '<button type="button" class="btn btn--sm" id="btn-guardar-admins">Guardar administradores</button>' +
          '<p class="nota">Sólo tú puedes cambiar esta lista. Los administradores capturan resultados; ' +
          "todos los demás sólo ven.</p>"
        );
      }
    }

    caja.innerHTML = filas.join("");
    llenarSelectorTorneos();
  }

  function llenarSelectorTorneos() {
    var selector = $("#selector-torneo");
    if (!selector || !nube) return;
    nube.listarTorneos().then(function (torneos) {
      var actual = Store.estado().torneoId;
      selector.innerHTML = torneos.length
        ? torneos.map(function (torneo) {
            return '<option value="' + escapar(torneo.id) + '"' + (torneo.id === actual ? " selected" : "") +
              ">" + escapar(torneo.nombre || torneo.id) + "</option>";
          }).join("")
        : '<option value="">— no hay torneos en la nube —</option>';
    }).catch(function (error) {
      selector.innerHTML = '<option value="">' + escapar("Error: " + error.message) + "</option>";
    });
  }

  // ------------------------------------------------------- sincronización

  function abrirTorneo(torneoId) {
    if (!torneoId || !nube) return;
    nube.escuchar(torneoId, function (datos) {
      nube.marcarAplicandoRemoto(true);
      Store.aplicarRemoto({
        torneoId: torneoId,
        torneo: {
          nombre: datos.torneo.nombre || "",
          sede: datos.torneo.sede || "",
          inicio: datos.torneo.inicio || "",
          fin: datos.torneo.fin || ""
        },
        admins: datos.torneo.admins || [],
        categorias: datos.categorias,
        categoriaActiva: Store.estado().categoriaActiva || datos.torneo.categoriaActiva || ""
      });
      nube.marcarAplicandoRemoto(false);
      refrescar();
    });
  }

  function refrescar() {
    UI.setSoloLectura(soloLectura());
    UI.render();
    pintarSesion();
    pintarPanelNube();
  }

  // ------------------------------------------------------------- eventos

  function conectar() {
    $("#btn-entrar").addEventListener("click", function () {
      $("#dialogo-sesion").showModal();
    });

    $("#form-sesion").addEventListener("submit", function (evento) {
      evento.preventDefault();
      var error = $("#error-sesion");
      error.textContent = "";
      nube.entrar($("#sesion-correo").value, $("#sesion-clave").value)
        .then(function () {
          $("#dialogo-sesion").close();
          $("#sesion-clave").value = "";
        })
        .catch(function (falla) {
          error.textContent = "No se pudo entrar: " + (falla.code || falla.message);
        });
    });

    $("#btn-cerrar-sesion-dialogo").addEventListener("click", function () {
      $("#dialogo-sesion").close();
    });

    $("#btn-salir").addEventListener("click", function () {
      nube.salir().then(refrescar);
    });

    $("#panel-nube").addEventListener("click", function (evento) {
      var boton = evento.target.closest("button");
      if (!boton) return;

      if (boton.id === "btn-recargar-torneos") {
        llenarSelectorTorneos();
        return;
      }

      if (boton.id === "btn-abrir-torneo") {
        var id = $("#selector-torneo").value;
        if (id) abrirTorneo(id);
        return;
      }

      if (boton.id === "btn-subir-torneo") {
        var nuevo = ($("#nuevo-torneo-id").value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
        if (!nuevo) return window.alert("Escribe un identificador para el torneo.");
        if (!window.confirm('Se va a subir el torneo local con el identificador "' + nuevo + '". ¿Continuar?')) return;

        var estado = Store.estado();
        nube.subirTorneo(nuevo, estado)
          .then(function () {
            Store.setTorneoId(nuevo);
            abrirTorneo(nuevo);
            window.alert("Torneo subido.");
          })
          .catch(function (falla) {
            window.alert("No se pudo subir: " + falla.message);
          });
        return;
      }

      if (boton.id === "btn-guardar-admins") {
        var correos = ($("#admins-torneo").value || "").split("\n").map(function (linea) {
          return linea.trim().toLowerCase();
        }).filter(Boolean);
        nube.setAdmins(Store.estado().torneoId, correos)
          .then(function () { window.alert("Administradores actualizados."); })
          .catch(function (falla) { window.alert("No se pudo guardar: " + falla.message); });
      }
    });

    // Cada cambio local que no venga de la nube se escribe en el documento afectado.
    Store.suscribir(function (estado, cambio) {
      if (!nube || cambio.tipo === "remoto" || !estado.torneoId) return;
      nube.escribir(cambio, estado);
    });
  }

  // ------------------------------------------------------------- arranque

  function arrancar() {
    nube = window.TorneoNube;
    if (!nube) {
      estadoNube = { disponible: false, motivo: "El módulo de nube no cargó.", usuario: null, puedeEditar: false, esDueno: false };
      refrescar();
      return;
    }

    conectar();

    nube.iniciar({
      alCambiar: function (nuevo) {
        estadoNube = nuevo;
        var estado = Store.estado();
        // Al abrir la app, si el torneo guardado vive en la nube, reengancharlo.
        if (nuevo.disponible && estado.torneoId && !nube.estado().torneoId) {
          abrirTorneo(estado.torneoId);
        }
        refrescar();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // El módulo de nube se carga aparte; si ya está, arrancamos de inmediato.
    if (window.TorneoNube) arrancar();
    else {
      window.addEventListener("torneo-nube-lista", arrancar, { once: true });
      // Si el SDK no carga en unos segundos, seguimos en modo local.
      window.setTimeout(function () {
        if (!nube) arrancar();
      }, 4000);
    }
  });
})();
