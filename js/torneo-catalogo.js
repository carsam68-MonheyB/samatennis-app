/*
 * torneo-catalogo.js — Catálogo fijo de categorías del club.
 *
 * Una categoría es una competencia completa e independiente: sus inscritos,
 * sus cabezas de serie, su sorteo, sus grupos y su cuadro final.
 * En cada torneo se abren sólo las que se vayan a jugar.
 */
(function (global) {
  "use strict";

  var RAMAS = ["Varonil", "Femenil"];
  var SUBCATEGORIAS = ["Novatos", "Tercera", "Segunda", "Primera", "Libre"];
  var MODALIDADES = ["Singles", "Dobles"];

  // La categoría Libre sólo existe en la rama varonil.
  function aplica(rama, subcategoria) {
    return !(rama === "Femenil" && subcategoria === "Libre");
  }

  function sinAcentos(texto) {
    return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function idDeCategoria(rama, subcategoria, modalidad) {
    return [rama, subcategoria, modalidad]
      .map(function (parte) { return sinAcentos(parte).toLowerCase(); })
      .join("-");
  }

  function nombreDeCategoria(rama, subcategoria, modalidad) {
    return rama + " " + subcategoria + " " + modalidad;
  }

  /** Las 18 categorías posibles, en orden de exhibición. */
  function catalogo() {
    var lista = [];
    RAMAS.forEach(function (rama) {
      MODALIDADES.forEach(function (modalidad) {
        SUBCATEGORIAS.forEach(function (subcategoria) {
          if (!aplica(rama, subcategoria)) return;
          lista.push({
            id: idDeCategoria(rama, subcategoria, modalidad),
            rama: rama,
            subcategoria: subcategoria,
            modalidad: modalidad,
            nombre: nombreDeCategoria(rama, subcategoria, modalidad),
            // En dobles el participante es una pareja con nombre propio.
            esDobles: modalidad === "Dobles"
          });
        });
      });
    });
    return lista;
  }

  function porId(id) {
    return catalogo().filter(function (categoria) { return categoria.id === id; })[0] || null;
  }

  var API = {
    RAMAS: RAMAS,
    SUBCATEGORIAS: SUBCATEGORIAS,
    MODALIDADES: MODALIDADES,
    idDeCategoria: idDeCategoria,
    nombreDeCategoria: nombreDeCategoria,
    catalogo: catalogo,
    porId: porId
  };

  global.TorneoCatalogo = API;
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
