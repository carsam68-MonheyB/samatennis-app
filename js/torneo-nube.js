/*
 * torneo-nube.js — Conexión con Firebase: sesión y sincronización en vivo.
 *
 * Se carga como módulo (`<script type="module">`). Si el SDK no carga o la red
 * falla, la app sigue funcionando contra localStorage: la nube es una capa
 * encima, nunca un requisito para operar.
 *
 * Estructura en Firestore:
 *   torneos/{torneoId}                        meta del torneo + admins
 *     categorias/{categoriaId}                inscritos, sorteo, grupos, cuadro…
 *       partidos/{partidoId}                  un partido de grupo por documento
 *
 * Los partidos van en documentos separados para que dos administradores puedan
 * capturar al mismo tiempo en canchas distintas sin pisarse.
 */

// Versiones del SDK a intentar, de la más nueva a la más vieja. Si el CDN no
// tiene la primera, se prueba la siguiente en vez de quedarse sin nube.
const VERSIONES_SDK = ["12.18.0", "11.10.0", "10.14.1"];

async function cargarSDK() {
  let ultimoError = null;
  for (const version of VERSIONES_SDK) {
    const base = "https://www.gstatic.com/firebasejs/" + version + "/";
    try {
      const modulos = await Promise.all([
        import(base + "firebase-app.js"),
        import(base + "firebase-auth.js"),
        import(base + "firebase-firestore.js")
      ]);
      console.info("Firebase SDK", version, "cargado.");
      return modulos;
    } catch (error) {
      ultimoError = error;
    }
  }
  throw ultimoError || new Error("No hay versión del SDK disponible.");
}

// La configuración del proyecto es pública por diseño: va dentro de la página.
// Quien protege los datos son las reglas de seguridad de Firestore.
const CONFIG = {
  apiKey: "AIzaSyB_hJ6do73eMIpfWPTlj4NhTnjlhyxsBNw",
  authDomain: "samatennis-app.firebaseapp.com",
  projectId: "samatennis-app",
  storageBucket: "samatennis-app.firebasestorage.app",
  messagingSenderId: "228789914879",
  appId: "1:228789914879:web:cabe0af5cf9ee641ae10ca"
};

// El dueño puede todo en cualquier torneo. Debe coincidir con las reglas.
const CORREO_DUENO = "carsam68@gmail.com";

const estado = {
  disponible: false,
  motivo: "",
  usuario: null,
  torneoId: "",
  admins: [],
  escuchas: [],
  aplicandoRemoto: false
};

let sdk = null;
let alCambiar = function () {};

// ---------------------------------------------------------------- utilidades

function correoDe(usuario) {
  return (usuario && usuario.email ? usuario.email : "").trim().toLowerCase();
}

function esDueno() {
  return correoDe(estado.usuario) === CORREO_DUENO;
}

/** ¿La sesión actual puede capturar en el torneo abierto? */
function puedeEditar() {
  if (!estado.usuario) return false;
  if (esDueno()) return true;
  return estado.admins.map(function (correo) {
    return String(correo).trim().toLowerCase();
  }).indexOf(correoDe(estado.usuario)) !== -1;
}

function avisar() {
  alCambiar({
    disponible: estado.disponible,
    motivo: estado.motivo,
    usuario: estado.usuario ? { correo: correoDe(estado.usuario) } : null,
    esDueno: esDueno(),
    puedeEditar: puedeEditar(),
    torneoId: estado.torneoId,
    admins: estado.admins.slice()
  });
}

// --------------------------------------------------------------- arranque

/** Carga el SDK y deja lista la sesión. Nunca lanza: reporta el motivo. */
async function iniciar(opciones) {
  alCambiar = (opciones && opciones.alCambiar) || alCambiar;

  try {
    const [app, auth, firestore] = await cargarSDK();

    const aplicacion = app.initializeApp(CONFIG);
    sdk = {
      auth: auth.getAuth(aplicacion),
      db: firestore.getFirestore(aplicacion),
      ...auth,
      ...firestore
    };

    // Caché local: si se cae la red, sigue leyendo y encola las escrituras.
    // La API cambió entre versiones del SDK, así que intentamos la que exista.
    try {
      if (firestore.enableIndexedDbPersistence) {
        await firestore.enableIndexedDbPersistence(sdk.db);
      }
    } catch (error) {
      // Falla si hay varias pestañas abiertas; no es motivo para detenerse.
      console.info("Sin caché offline de Firestore:", error && error.code);
    }

    estado.disponible = true;
    estado.motivo = "";

    sdk.onAuthStateChanged(sdk.auth, function (usuario) {
      estado.usuario = usuario;
      avisar();
    });
  } catch (error) {
    estado.disponible = false;
    estado.motivo = "No se pudo cargar Firebase: " + (error && error.message ? error.message : error);
    console.warn(estado.motivo);
  }

  avisar();
  return estado.disponible;
}

// ----------------------------------------------------------------- sesión

async function entrar(correo, clave) {
  if (!estado.disponible) throw new Error("Sin conexión con Firebase.");
  await sdk.signInWithEmailAndPassword(sdk.auth, String(correo).trim(), clave);
}

async function salir() {
  if (!estado.disponible) return;
  await sdk.signOut(sdk.auth);
}

// -------------------------------------------------------------- lectura

function detenerEscuchas() {
  estado.escuchas.forEach(function (detener) {
    try { detener(); } catch (error) { /* ya estaba detenida */ }
  });
  estado.escuchas = [];
}

/** Lista de torneos disponibles, para el selector. */
async function listarTorneos() {
  if (!estado.disponible) return [];
  const consulta = await sdk.getDocs(sdk.collection(sdk.db, "torneos"));
  const torneos = [];
  consulta.forEach(function (documento) {
    torneos.push(Object.assign({ id: documento.id }, documento.data()));
  });
  return torneos.sort(function (uno, otro) {
    return String(otro.inicio || "").localeCompare(String(uno.inicio || ""));
  });
}

/**
 * Escucha un torneo completo y reporta el estado armado en el formato que usa
 * la app. Se llama cada vez que alguien cambia algo, sea quien sea.
 */
function escuchar(torneoId, alRecibir) {
  if (!estado.disponible) return;
  detenerEscuchas();
  estado.torneoId = torneoId;

  const armado = { torneo: null, categorias: {}, partidos: {} };

  /*
   * Firestore avisa también de lo que uno mismo acaba de escribir: llega como
   * un eco local con la escritura todavía pendiente. Ese eco no trae nada
   * nuevo —el dato ya está en la app— y sí provoca un repintado justo mientras
   * se captura un marcador, que es lo que sacaba al capturista del formulario.
   *
   * Lo que llega se guarda siempre (para no perder de vista ningún documento),
   * pero sólo se avisa a la app cuando el cambio viene de alguien más.
   */
  function esEcoPropio(instantanea) {
    return !!(instantanea.metadata && instantanea.metadata.hasPendingWrites);
  }

  function hayCambiosAjenos(cambios) {
    return cambios.some(function (cambio) { return !esEcoPropio(cambio.doc); });
  }

  function publicar() {
    if (!armado.torneo) return;
    const categorias = Object.keys(armado.categorias).map(function (id) {
      return Object.assign({}, armado.categorias[id], {
        partidos: Object.keys(armado.partidos[id] || {}).map(function (partidoId) {
          return armado.partidos[id][partidoId];
        }).sort(function (uno, otro) {
          return String(uno.id).localeCompare(String(otro.id), "es", { numeric: true });
        })
      });
    });

    estado.admins = armado.torneo.admins || [];
    alRecibir({ torneo: armado.torneo, categorias: categorias });
    avisar();
  }

  const refTorneo = sdk.doc(sdk.db, "torneos", torneoId);
  estado.escuchas.push(
    sdk.onSnapshot(refTorneo, function (instantanea) {
      if (!instantanea.exists()) return;
      armado.torneo = Object.assign({ id: instantanea.id }, instantanea.data());
      if (!esEcoPropio(instantanea)) publicar();
    })
  );

  const refCategorias = sdk.collection(refTorneo, "categorias");
  estado.escuchas.push(
    sdk.onSnapshot(refCategorias, function (instantanea) {
      const cambios = instantanea.docChanges();
      cambios.forEach(function (cambio) {
        const id = cambio.doc.id;
        if (cambio.type === "removed") {
          delete armado.categorias[id];
          delete armado.partidos[id];
          return;
        }
        armado.categorias[id] = Object.assign({ id: id }, cambio.doc.data());

        // Cada categoría trae su propia escucha de partidos.
        if (!armado.partidos[id]) {
          armado.partidos[id] = {};
          estado.escuchas.push(
            sdk.onSnapshot(sdk.collection(refCategorias, id, "partidos"), function (lote) {
              const cambiosPartidos = lote.docChanges();
              cambiosPartidos.forEach(function (cambioPartido) {
                if (cambioPartido.type === "removed") delete armado.partidos[id][cambioPartido.doc.id];
                else armado.partidos[id][cambioPartido.doc.id] =
                  Object.assign({ id: cambioPartido.doc.id }, cambioPartido.doc.data());
              });
              if (hayCambiosAjenos(cambiosPartidos)) publicar();
            })
          );
        }
      });
      if (hayCambiosAjenos(cambios)) publicar();
    })
  );
}

// -------------------------------------------------------------- escritura

function sinPartidos(categoria) {
  const copia = Object.assign({}, categoria);
  delete copia.partidos;
  return copia;
}

/** Sube un torneo completo por primera vez (o lo reemplaza). */
async function subirTorneo(torneoId, estadoApp) {
  if (!estado.disponible) throw new Error("Sin conexión con Firebase.");

  const refTorneo = sdk.doc(sdk.db, "torneos", torneoId);
  await sdk.setDoc(refTorneo, Object.assign({}, estadoApp.torneo, {
    admins: estadoApp.admins || [],
    categoriaActiva: estadoApp.categoriaActiva || ""
  }));

  for (const categoria of estadoApp.categorias) {
    const refCategoria = sdk.doc(refTorneo, "categorias", categoria.id);
    await sdk.setDoc(refCategoria, sinPartidos(categoria));
    for (const partido of categoria.partidos || []) {
      await sdk.setDoc(sdk.doc(refCategoria, "partidos", partido.id), partido);
    }
  }
}

/** Guarda un cambio puntual. `cambio` viene del store. */
async function escribir(cambio, estadoApp) {
  if (!estado.disponible || !estado.torneoId || !puedeEditar()) return;
  if (estado.aplicandoRemoto) return; // eco de lo que acabamos de recibir

  const refTorneo = sdk.doc(sdk.db, "torneos", estado.torneoId);
  const marca = {
    capturadoPor: correoDe(estado.usuario),
    capturadoEn: new Date().toISOString()
  };

  try {
    if (cambio.tipo === "torneo") {
      await sdk.setDoc(refTorneo, Object.assign({}, estadoApp.torneo, {
        admins: estadoApp.admins || [],
        categoriaActiva: estadoApp.categoriaActiva || ""
      }), { merge: true });
      return;
    }

    const categoria = (estadoApp.categorias || []).filter(function (cat) {
      return cat.id === cambio.categoriaId;
    })[0];
    if (!categoria) return;

    const refCategoria = sdk.doc(refTorneo, "categorias", categoria.id);

    if (cambio.tipo === "categoriaBorrada") {
      await sdk.deleteDoc(refCategoria);
      return;
    }

    if (cambio.tipo === "partido") {
      const partido = (categoria.partidos || []).filter(function (uno) {
        return uno.id === cambio.partidoId;
      })[0];
      if (!partido) return;
      await sdk.setDoc(sdk.doc(refCategoria, "partidos", partido.id), Object.assign({}, partido, marca));
      return;
    }

    // Cualquier otro cambio de la categoría: inscritos, sorteo, grupos, cuadro…
    await sdk.setDoc(refCategoria, Object.assign(sinPartidos(categoria), marca));

    if (cambio.tipo === "calendario") {
      // El calendario se rehizo: reescribir todos los partidos de la categoría.
      for (const partido of categoria.partidos || []) {
        await sdk.setDoc(sdk.doc(refCategoria, "partidos", partido.id), partido);
      }
    }
  } catch (error) {
    // Quien llama necesita enterarse para poder avisarle a la persona.
    console.warn("No se pudo guardar en la nube:", error);
    estado.motivo = "No se pudo guardar en la nube: " + (error && error.message ? error.message : error);
    avisar();
    throw error;
  }
}

async function crearTorneo(torneoId, datos) {
  if (!estado.disponible) throw new Error("Sin conexión con Firebase.");
  await sdk.setDoc(sdk.doc(sdk.db, "torneos", torneoId), Object.assign({
    nombre: "Nuevo torneo", sede: "", inicio: "", fin: "", admins: []
  }, datos || {}));
}

async function setAdmins(torneoId, correos) {
  if (!estado.disponible) throw new Error("Sin conexión con Firebase.");
  await sdk.setDoc(sdk.doc(sdk.db, "torneos", torneoId), { admins: correos }, { merge: true });
}

function marcarAplicandoRemoto(valor) {
  estado.aplicandoRemoto = !!valor;
}

window.TorneoNube = {
  CORREO_DUENO: CORREO_DUENO,
  iniciar: iniciar,
  entrar: entrar,
  salir: salir,
  listarTorneos: listarTorneos,
  escuchar: escuchar,
  detenerEscuchas: detenerEscuchas,
  subirTorneo: subirTorneo,
  crearTorneo: crearTorneo,
  setAdmins: setAdmins,
  escribir: escribir,
  marcarAplicandoRemoto: marcarAplicandoRemoto,
  puedeEditar: puedeEditar,
  esDueno: esDueno,
  estado: function () { return estado; }
};

window.dispatchEvent(new CustomEvent("torneo-nube-lista"));
