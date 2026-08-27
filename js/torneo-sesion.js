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

  // Si el dueño escribe otro identificador, se respeta aunque el panel se repinte.
  var idEscritoAMano = null;

  /** El torneo puede venir en la liga: …/?torneo=copa-2025 */
  function torneoDeLaLiga() {
    try {
      return new URLSearchParams(window.location.search).get("torneo") || "";
    } catch (error) {
      return "";
    }
  }

  /** Sólo se bloquea la edición cuando el torneo vive en la nube. */
  function soloLectura() {
    var estado = Store.estado();
    if (!estado.torneoId) return false;
    return !estadoNube.puedeEditar;
  }

  // --------------------------------------------------- confirmación al guardar

  var temporizadorAviso = null;

  /**
   * La app guarda sola al salir de cada campo, así que hace falta decirlo:
   * sin esto la persona no sabe si su captura quedó registrada.
   */
  function avisoGuardado(situacion, detalle) {
    var caja = $("#aviso-guardado");
    if (!caja) return;

    window.clearTimeout(temporizadorAviso);
    caja.hidden = false;
    caja.className = "aviso-guardado aviso-guardado--" + situacion;

    if (situacion === "guardando") {
      caja.textContent = "Guardando…";
      return;
    }

    if (situacion === "error") {
      // Este se queda hasta que la persona vuelva a intentar: es un problema real.
      caja.textContent = "No se guardó: " + (detalle || "revisa tu conexión");
      return;
    }

    caja.textContent = situacion === "local" ? "Guardado ✓" : "Guardado y sincronizado ✓";
    temporizadorAviso = window.setTimeout(function () { caja.hidden = true; }, 2500);
  }

  // ------------------------------------------------------ imagen del club

  // El logo viaja dentro del documento del torneo, que en Firestore no puede
  // pasar de 1 MB. Reducirlo aquí evita ese tope y hace que cargue rápido en
  // el celular de quien consulta desde la cancha.
  var LADO_MAXIMO = 520;
  var PESO_MAXIMO = 350 * 1024;

  function reducirImagen(archivo) {
    return new Promise(function (resolver, rechazar) {
      var lector = new FileReader();
      lector.onerror = function () { rechazar(new Error("No se pudo leer el archivo.")); };
      lector.onload = function () {
        var imagen = new Image();
        imagen.onerror = function () { rechazar(new Error("El archivo no es una imagen válida.")); };
        imagen.onload = function () {
          var escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
          var lienzo = document.createElement("canvas");
          lienzo.width = Math.round(imagen.width * escala);
          lienzo.height = Math.round(imagen.height * escala);
          lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

          // WebP conserva la transparencia de los logos y pesa menos que PNG.
          var datos = lienzo.toDataURL("image/webp", 0.85);
          if (datos.indexOf("data:image/webp") !== 0) datos = lienzo.toDataURL("image/png");
          if (datos.length > PESO_MAXIMO) datos = lienzo.toDataURL("image/jpeg", 0.8);
          if (datos.length > PESO_MAXIMO) {
            rechazar(new Error("La imagen pesa demasiado, prueba con una más sencilla."));
            return;
          }
          resolver(datos);
        };
        imagen.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  function pintarLogo() {
    var logo = Store.estado().torneo.logo || "";

    var enPortada = $("#hero-logo");
    if (enPortada) {
      enPortada.hidden = !logo;
      if (logo) $("#hero-logo-img").src = logo;
    }

    var enEncabezado = $("#marca-club");
    if (enEncabezado) {
      enEncabezado.hidden = !logo;
      if (logo) $("#marca-club-img").src = logo;
    }

    var enTablero = $("#cuadro-logo");
    if (enTablero) {
      enTablero.hidden = !logo;
      if (logo) $("#cuadro-logo-img").src = logo;
    }

    var vista = $("#logo-vista");
    if (vista) {
      vista.innerHTML = logo
        ? '<img src="' + logo + '" alt="Imagen del club" />'
        : "<span>Sin imagen</span>";
    }
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
      var sugerido = Store.identificadorDesde(estado.torneo && estado.torneo.nombre);
      var propuesto = idEscritoAMano !== null ? idEscritoAMano : sugerido;

      filas.push(
        '<div class="nube-fila">' +
        '<input type="text" id="nuevo-torneo-id" placeholder="copa-2026" value="' +
        escapar(propuesto) + '" />' +
        '<button type="button" class="btn btn--sm" id="btn-subir-torneo">Subir este torneo a la nube</button>' +
        "</div>" +
        '<p class="nota">Este es el identificador del torneo, no su nombre: se arma solo con el nombre ' +
        "que capturaste, va en la liga que compartes y ya no se puede cambiar. " +
        "Cámbialo sólo si quieres otra dirección.</p>"
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
          fin: datos.torneo.fin || "",
          logo: datos.torneo.logo || ""
        },
        admins: datos.torneo.admins || [],
        categorias: datos.categorias,
        categoriaActiva: Store.estado().categoriaActiva || datos.torneo.categoriaActiva || ""
      });
      nube.marcarAplicandoRemoto(false);
      refrescar();
    });
  }

  /** La portada le habla distinto a quien administra y a quien sólo consulta. */
  function pintarPortada() {
    var titulo = $("#hero-titulo");
    if (!titulo) return;

    var estado = Store.estado();
    var categoria = Store.categoria();

    if (soloLectura()) {
      titulo.textContent = estado.torneo.nombre || "Torneo";
      var hero = $("#hero-datos");
      if (hero) {
        hero.textContent = (categoria ? categoria.nombre + ". " : "") +
          "Resultados, tablas de posiciones, ranking y cuadro final, actualizados en vivo " +
          "conforme se van jugando los partidos.";
      }
      return;
    }

    titulo.textContent = "Administra tu torneo de tenis de principio a fin";
  }

  /** El texto de "dónde viven los datos" cambia según haya nube o no. */
  function pintarTextosDeDatos() {
    var torneoId = Store.estado().torneoId;
    var pie = $("#pie-datos");
    var hero = $("#hero-datos");

    if (torneoId) {
      if (pie) {
        pie.innerHTML = "Revisa todos los Resultados en Tiempo Real.";
      }
      if (hero) {
        hero.innerHTML = "Sorteo de grupos, captura de resultados set por set, porcentajes de sets y " +
          "juegos, ranking del torneo y cuadro final sembrado automáticamente. " +
          "Los administradores capturan y todos lo ven al instante.";
      }
      return;
    }

    if (pie) {
      pie.innerHTML = "Los datos viven sólo en este navegador. Usa <strong>Exportar</strong> " +
        "para respaldar el torneo.";
    }
    if (hero) {
      hero.innerHTML = "Sorteo de grupos, captura de resultados set por set, porcentajes de sets y " +
        "juegos, ranking del torneo y cuadro final sembrado automáticamente. " +
        "Todo se guarda en este navegador.";
    }
  }

  /**
   * Quien abre la liga por primera vez no ha elegido torneo: le abrimos el que
   * indique la liga, el que ya tuviera guardado, o el más reciente de la nube.
   * Sin esto un espectador vería el torneo de ejemplo local en vez del real.
   */
  function abrirTorneoPorOmision() {
    var deLaLiga = torneoDeLaLiga();
    if (deLaLiga) return abrirTorneo(deLaLiga);

    var guardado = Store.estado().torneoId;
    if (guardado) return abrirTorneo(guardado);

    nube.listarTorneos().then(function (torneos) {
      if (torneos.length) abrirTorneo(torneos[0].id);
    }).catch(function (error) {
      console.warn("No se pudo listar los torneos:", error);
    });
  }

  /**
   * Las herramientas del dueño se ocultan a los administradores sólo cuando el
   * torneo vive en la nube. Sin nube la app es de un solo usuario y no aplica.
   */
  function ocultarHerramientasDeDueno() {
    var estado = Store.estado();
    if (!estadoNube.disponible || !estado.torneoId) return false;
    return !estadoNube.esDueno;
  }

  function refrescar() {
    UI.setSoloDueno(ocultarHerramientasDeDueno());
    UI.setSoloLectura(soloLectura());
    UI.render();
    pintarSesion();
    pintarPanelNube();
    pintarTextosDeDatos();
    pintarPortada();
    pintarLogo();
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

    // --- imagen del club
    $("#btn-subir-logo").addEventListener("click", function () {
      $("#archivo-logo").click();
    });

    $("#archivo-logo").addEventListener("change", function (evento) {
      var archivo = evento.target.files && evento.target.files[0];
      evento.target.value = "";
      if (!archivo) return;

      var nota = $("#nota-logo");
      nota.textContent = "Preparando la imagen…";

      reducirImagen(archivo)
        .then(function (datos) {
          Store.setDatosTorneo({ logo: datos });
          nota.textContent = "Listo: la imagen ya aparece en la portada.";
          refrescar();
        })
        .catch(function (falla) {
          nota.textContent = falla.message;
        });
    });

    $("#btn-quitar-logo").addEventListener("click", function () {
      if (!Store.estado().torneo.logo) return;
      if (!window.confirm("¿Quitar la imagen del club?")) return;
      Store.setDatosTorneo({ logo: "" });
      $("#nota-logo").textContent = "Imagen quitada.";
      refrescar();
    });

    $("#panel-nube").addEventListener("input", function (evento) {
      if (evento.target && evento.target.id === "nuevo-torneo-id") {
        idEscritoAMano = evento.target.value;
      }
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
        var estadoLocal = Store.estado();
        var nuevo = Store.identificadorDesde($("#nuevo-torneo-id").value) ||
          Store.identificadorDesde(estadoLocal.torneo && estadoLocal.torneo.nombre);
        if (!nuevo) return window.alert("Primero ponle nombre al torneo en la pestaña Datos.");
        if (!window.confirm('Se va a subir el torneo local con el identificador "' + nuevo + '". ¿Continuar?')) return;

        nube.subirTorneo(nuevo, estadoLocal)
          .then(function () {
            idEscritoAMano = null;
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
      if (cambio.tipo === "remoto") return;

      if (!nube || !estado.torneoId || !estadoNube.puedeEditar) {
        avisoGuardado("local");
        return;
      }

      avisoGuardado("guardando");
      nube.escribir(cambio, estado)
        .then(function () { avisoGuardado("nube"); })
        .catch(function (falla) { avisoGuardado("error", falla && falla.message); });
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

    var yaAbrio = false;

    nube.iniciar({
      alCambiar: function (nuevo) {
        estadoNube = nuevo;
        if (nuevo.disponible && !yaAbrio && !nube.estado().torneoId) {
          yaAbrio = true;
          abrirTorneoPorOmision();
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
