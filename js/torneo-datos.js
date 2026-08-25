/*
 * torneo-datos.js — Torneo de ejemplo: los datos reales del archivo
 * DRAWS_TENNIS_APP_CT2025_Primera_Varonil.xlsm (9 grupos, 28 jugadores).
 * Sirve como demo y como prueba de que la app reproduce las cifras del Excel.
 */
(function (global) {
  "use strict";
  var TORNEO_EJEMPLO = {
    "torneo": {
      "nombre": "Copa Tenis 2025",
      "categoria": "Primera Varonil",
      "sede": "",
      "inicio": "2025-09-16",
      "fin": "2025-09-18"
    },
    "cabezas": [
      "CRISTOBAL HANDAM",
      "JORGE SAMANIEGO",
      "EDUARDO VEGA",
      "SUSANA VILLARREAL",
      "CESAR SOSA",
      "ROBERTO SOTO",
      "ALEJANDRO DUEÑES",
      "MARIO ROMAN",
      "FERNANDO CEPEDA"
    ],
    "inscritos": [
      "Stoyan Tassef",
      "Gabriel Esquivel",
      "Cristian Miranda",
      "Juan Pablo Mijares",
      "Akihito Suga",
      "Fernando Cuadros",
      "Frank Lopez",
      "Iván Cepeda",
      "Carlos Elizondo",
      "Angel Sobrino",
      "Antonio Alfaro",
      "Carlos Samaniego",
      "Said Ganem",
      "Ricardo Cuadros",
      "Daniel Zaja",
      "Patricio Gomez",
      "Angel Hernandez",
      "Gerardo Alba",
      "Sebastian Gomez"
    ],
    "sorteo": {
      "congelado": true,
      "orden": [
        "Stoyan Tassef",
        "Gabriel Esquivel",
        "Cristian Miranda",
        "Juan Pablo Mijares",
        "Akihito Suga",
        "Fernando Cuadros",
        "Frank Lopez",
        "Iván Cepeda",
        "Carlos Elizondo",
        "Angel Sobrino",
        "Antonio Alfaro",
        "Carlos Samaniego",
        "Said Ganem",
        "Ricardo Cuadros",
        "Daniel Zaja",
        "Patricio Gomez",
        "Angel Hernandez",
        "Gerardo Alba",
        "Sebastian Gomez"
      ]
    },
    "grupos": [
      {
        "nombre": "Grupo1",
        "cabeza": "CRISTOBAL HANDAM",
        "jugadores": [
          "CRISTOBAL HANDAM",
          "Stoyan Tassef",
          "Gabriel Esquivel"
        ]
      },
      {
        "nombre": "Grupo2",
        "cabeza": "JORGE SAMANIEGO",
        "jugadores": [
          "JORGE SAMANIEGO",
          "Cristian Miranda",
          "Juan Pablo Mijares"
        ]
      },
      {
        "nombre": "Grupo3",
        "cabeza": "EDUARDO VEGA",
        "jugadores": [
          "EDUARDO VEGA",
          "Akihito Suga",
          "Fernando Cuadros"
        ]
      },
      {
        "nombre": "Grupo4",
        "cabeza": "SUSANA VILLARREAL",
        "jugadores": [
          "SUSANA VILLARREAL",
          "Frank Lopez",
          "Iván Cepeda"
        ]
      },
      {
        "nombre": "Grupo5",
        "cabeza": "CESAR SOSA",
        "jugadores": [
          "CESAR SOSA",
          "Carlos Elizondo",
          "Angel Sobrino"
        ]
      },
      {
        "nombre": "Grupo6",
        "cabeza": "ROBERTO SOTO",
        "jugadores": [
          "ROBERTO SOTO",
          "Antonio Alfaro",
          "Carlos Samaniego"
        ]
      },
      {
        "nombre": "Grupo7",
        "cabeza": "ALEJANDRO DUEÑES",
        "jugadores": [
          "ALEJANDRO DUEÑES",
          "Said Ganem",
          "Ricardo Cuadros"
        ]
      },
      {
        "nombre": "Grupo8",
        "cabeza": "MARIO ROMAN",
        "jugadores": [
          "MARIO ROMAN",
          "Daniel Zaja",
          "Patricio Gomez",
          "Angel Hernandez"
        ]
      },
      {
        "nombre": "Grupo9",
        "cabeza": "FERNANDO CEPEDA",
        "jugadores": [
          "FERNANDO CEPEDA",
          "Gerardo Alba",
          "Sebastian Gomez"
        ]
      }
    ],
    "partidos": [
      {
        "id": "Grupo1-P1",
        "grupo": "Grupo1",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "CRISTOBAL HANDAM",
        "jugadorB": "Stoyan Tassef",
        "sets": [
          {
            "a": 6,
            "b": 3
          },
          {
            "a": 6,
            "b": 1
          }
        ]
      },
      {
        "id": "Grupo1-P2",
        "grupo": "Grupo1",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "Gabriel Esquivel",
        "jugadorB": "CRISTOBAL HANDAM",
        "sets": [
          {
            "a": 6,
            "b": 3
          },
          {
            "a": 6,
            "b": 1
          }
        ]
      },
      {
        "id": "Grupo1-P3",
        "grupo": "Grupo1",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Stoyan Tassef",
        "jugadorB": "Gabriel Esquivel",
        "sets": [
          {
            "a": 1,
            "b": 6
          },
          {
            "a": 0,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo2-P1",
        "grupo": "Grupo2",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "JORGE SAMANIEGO",
        "jugadorB": "Cristian Miranda",
        "sets": [
          {
            "a": 6,
            "b": 0
          },
          {
            "a": 6,
            "b": 0
          }
        ]
      },
      {
        "id": "Grupo2-P2",
        "grupo": "Grupo2",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "Juan Pablo Mijares",
        "jugadorB": "JORGE SAMANIEGO",
        "sets": [
          {
            "a": 6,
            "b": 7,
            "tbA": 3,
            "tbB": 7
          },
          {
            "a": 2,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo2-P3",
        "grupo": "Grupo2",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Cristian Miranda",
        "jugadorB": "Juan Pablo Mijares",
        "sets": [
          {
            "a": 1,
            "b": 6
          },
          {
            "a": 0,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo3-P1",
        "grupo": "Grupo3",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "EDUARDO VEGA",
        "jugadorB": "Akihito Suga",
        "sets": [
          {
            "a": 6,
            "b": 7,
            "tbA": 5,
            "tbB": 7
          },
          {
            "a": 2,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo3-P2",
        "grupo": "Grupo3",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "Fernando Cuadros",
        "jugadorB": "EDUARDO VEGA",
        "sets": [
          {
            "a": 6,
            "b": 1
          },
          {
            "a": 6,
            "b": 7,
            "tbA": 5,
            "tbB": 7
          },
          {
            "a": 7,
            "b": 6,
            "tbA": 10,
            "tbB": 4
          }
        ],
        "superMuerte": true
      },
      {
        "id": "Grupo3-P3",
        "grupo": "Grupo3",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Akihito Suga",
        "jugadorB": "Fernando Cuadros",
        "sets": [
          {
            "a": 3,
            "b": 6
          },
          {
            "a": 5,
            "b": 7
          }
        ]
      },
      {
        "id": "Grupo4-P1",
        "grupo": "Grupo4",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "SUSANA VILLARREAL",
        "jugadorB": "Frank Lopez",
        "sets": [
          {
            "a": 6,
            "b": 4
          },
          {
            "a": 6,
            "b": 2
          }
        ]
      },
      {
        "id": "Grupo4-P2",
        "grupo": "Grupo4",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "Iván Cepeda",
        "jugadorB": "SUSANA VILLARREAL",
        "sets": [
          {
            "a": 3,
            "b": 6
          },
          {
            "a": 6,
            "b": 3
          },
          {
            "a": 7,
            "b": 6,
            "tbA": 10,
            "tbB": 3
          }
        ],
        "superMuerte": true
      },
      {
        "id": "Grupo4-P3",
        "grupo": "Grupo4",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Frank Lopez",
        "jugadorB": "Iván Cepeda",
        "sets": [
          {
            "a": 2,
            "b": 6
          },
          {
            "a": 1,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo5-P1",
        "grupo": "Grupo5",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "CESAR SOSA",
        "jugadorB": "Carlos Elizondo",
        "sets": [
          {
            "a": 6,
            "b": 3
          },
          {
            "a": 6,
            "b": 0
          }
        ]
      },
      {
        "id": "Grupo5-P2",
        "grupo": "Grupo5",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "Angel Sobrino",
        "jugadorB": "CESAR SOSA",
        "sets": [
          {
            "a": 6,
            "b": 0
          },
          {
            "a": 6,
            "b": 0
          }
        ]
      },
      {
        "id": "Grupo5-P3",
        "grupo": "Grupo5",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Carlos Elizondo",
        "jugadorB": "Angel Sobrino",
        "sets": [
          {
            "a": 6,
            "b": 2
          },
          {
            "a": 2,
            "b": 6
          },
          {
            "a": 6,
            "b": 7,
            "tbA": 4,
            "tbB": 10
          }
        ],
        "superMuerte": true
      },
      {
        "id": "Grupo6-P1",
        "grupo": "Grupo6",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "ROBERTO SOTO",
        "jugadorB": "Antonio Alfaro",
        "sets": [
          {
            "a": 0,
            "b": 6
          },
          {
            "a": 0,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo6-P2",
        "grupo": "Grupo6",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "Carlos Samaniego",
        "jugadorB": "ROBERTO SOTO",
        "sets": [
          {
            "a": 6,
            "b": 0
          },
          {
            "a": 6,
            "b": 0
          }
        ]
      },
      {
        "id": "Grupo6-P3",
        "grupo": "Grupo6",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Antonio Alfaro",
        "jugadorB": "Carlos Samaniego",
        "sets": [
          {
            "a": 0,
            "b": 6
          },
          {
            "a": 0,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo7-P1",
        "grupo": "Grupo7",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "ALEJANDRO DUEÑES",
        "jugadorB": "Said Ganem",
        "sets": [
          {
            "a": 2,
            "b": 6
          },
          {
            "a": 3,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo7-P2",
        "grupo": "Grupo7",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "Ricardo Cuadros",
        "jugadorB": "ALEJANDRO DUEÑES",
        "sets": [
          {
            "a": 1,
            "b": 6
          },
          {
            "a": 6,
            "b": 3
          },
          {
            "a": 7,
            "b": 6,
            "tbA": 10,
            "tbB": 6
          }
        ],
        "superMuerte": true
      },
      {
        "id": "Grupo7-P3",
        "grupo": "Grupo7",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Said Ganem",
        "jugadorB": "Ricardo Cuadros",
        "sets": [
          {
            "a": 6,
            "b": 4
          },
          {
            "a": 6,
            "b": 1
          }
        ]
      },
      {
        "id": "Grupo8-P1",
        "grupo": "Grupo8",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "MARIO ROMAN",
        "jugadorB": "Daniel Zaja",
        "sets": [
          {
            "a": 6,
            "b": 7,
            "tbA": 5,
            "tbB": 7
          },
          {
            "a": 5,
            "b": 7
          }
        ]
      },
      {
        "id": "Grupo8-P2",
        "grupo": "Grupo8",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "Patricio Gomez",
        "jugadorB": "Angel Hernandez",
        "sets": [
          {
            "a": 3,
            "b": 6
          },
          {
            "a": 6,
            "b": 3
          },
          {
            "a": 6,
            "b": 7,
            "tbA": 7,
            "tbB": 10
          }
        ],
        "superMuerte": true
      },
      {
        "id": "Grupo8-P3",
        "grupo": "Grupo8",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "Daniel Zaja",
        "jugadorB": "Angel Hernandez",
        "sets": [
          {
            "a": 6,
            "b": 2
          },
          {
            "a": 7,
            "b": 6,
            "tbA": 7,
            "tbB": 2
          }
        ]
      },
      {
        "id": "Grupo8-P4",
        "grupo": "Grupo8",
        "fecha": "2025-09-17",
        "hora": "19:00",
        "jugadorA": "MARIO ROMAN",
        "jugadorB": "Patricio Gomez",
        "sets": [
          {
            "a": 1,
            "b": 6
          },
          {
            "a": 2,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo8-P5",
        "grupo": "Grupo8",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Patricio Gomez",
        "jugadorB": "Daniel Zaja",
        "sets": [
          {
            "a": 4,
            "b": 6
          },
          {
            "a": 2,
            "b": 6
          }
        ]
      },
      {
        "id": "Grupo8-P6",
        "grupo": "Grupo8",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "MARIO ROMAN",
        "jugadorB": "Angel Hernandez",
        "sets": [
          {
            "a": 6,
            "b": 0
          },
          {
            "a": 6,
            "b": 0
          }
        ]
      },
      {
        "id": "Grupo9-P1",
        "grupo": "Grupo9",
        "fecha": "2025-09-18",
        "hora": "19:00",
        "jugadorA": "FERNANDO CEPEDA",
        "jugadorB": "Gerardo Alba",
        "sets": [
          {
            "a": 6,
            "b": 2
          },
          {
            "a": 6,
            "b": 2
          }
        ]
      },
      {
        "id": "Grupo9-P2",
        "grupo": "Grupo9",
        "fecha": "2025-09-17",
        "hora": "20:20",
        "jugadorA": "Sebastian Gomez",
        "jugadorB": "FERNANDO CEPEDA",
        "sets": [
          {
            "a": 1,
            "b": 6
          },
          {
            "a": 6,
            "b": 2
          },
          {
            "a": 7,
            "b": 6,
            "tbA": 11,
            "tbB": 9
          }
        ],
        "superMuerte": true
      },
      {
        "id": "Grupo9-P3",
        "grupo": "Grupo9",
        "fecha": "2025-09-16",
        "hora": "08:00",
        "jugadorA": "Gerardo Alba",
        "jugadorB": "Sebastian Gomez",
        "sets": [
          {
            "a": 7,
            "b": 6,
            "tbA": 5,
            "tbB": 7
          },
          {
            "a": 0,
            "b": 6
          },
          {
            "a": 6,
            "b": 7,
            "tbA": 6,
            "tbB": 10
          }
        ],
        "superMuerte": true
      }
    ],
    "desempates": {
      "CRISTOBAL HANDAM": 2,
      "Akihito Suga": 3
    },
    "cuadro": {}
  };

  global.TorneoEjemplo = TORNEO_EJEMPLO;
  if (typeof module === "object" && module.exports) module.exports = TORNEO_EJEMPLO;
})(typeof window !== "undefined" ? window : globalThis);
