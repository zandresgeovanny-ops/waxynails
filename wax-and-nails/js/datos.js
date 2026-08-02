/* ==========================================================================
   datos.js — Wax & Nails
   --------------------------------------------------------------------------
   Objetos planos en window. Sin fetch: el sitio abre con doble clic (file://).
   Generado desde:
     _research/wax-and-nails/catalogo/servicios.json
     _research/wax-and-nails/reseñas/reseñas.json
     _research/wax-and-nails/00-FICHA-VERIFICADA.md
   REGLA: aquí solo se publican reseñas con veracidad VERIFICADO. Las reseñas
   INVENTADAS del JSON de investigación NO se copiaron a este archivo.
   Los servicios con `propuesta: true` son los marcados INVENTADO: se muestran
   con la etiqueta "por confirmar" y están listados en LEEME.md.
   ========================================================================== */
window.DATOS = {
  "negocio": {
    "nombre": "Wax & Nails",
    "categoria": "Centro de estética",
    "calle": "Prolongación Paseo de la Asunción 514",
    "colonia": "Prados del Sur",
    "cp": "20280",
    "ciudad": "Aguascalientes",
    "estado": "Ags.",
    "pais": "México",
    "telefono": "449 103 3082",
    "telefonoIntl": "+52 449 103 3082",
    "whatsapp": "524491033082",
    "facebook": "https://www.facebook.com/p/Wax-Nails-100063796290618/",
    "facebookSeguidores": 2567,
    "google": {
      "calificacion": 4.4,
      "opiniones": 18
    },
    "facebookRating": {
      "calificacion": 5,
      "votos": 13
    },
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Prolongaci%C3%B3n%20Paseo%20de%20la%20Asunci%C3%B3n%20514%2C%20Prados%20del%20Sur%2C%2020280%20Aguascalientes",
    "mapsDir": "https://www.google.com/maps/dir/?api=1&destination=Prolongaci%C3%B3n%20Paseo%20de%20la%20Asunci%C3%B3n%20514%2C%20Prados%20del%20Sur%2C%2020280%20Aguascalientes%2C%20Ags."
  },
  "horario": {
    "0": null,
    "1": {
      "abre": "14:00",
      "cierra": "20:30"
    },
    "2": {
      "abre": "14:00",
      "cierra": "20:30"
    },
    "3": {
      "abre": "10:00",
      "cierra": "20:30"
    },
    "4": {
      "abre": "10:00",
      "cierra": "20:30"
    },
    "5": {
      "abre": "10:00",
      "cierra": "20:30"
    },
    "6": {
      "abre": "09:00",
      "cierra": "16:00"
    }
  },
  "horarioTexto": [
    {
      "dia": 0,
      "nombre": "Domingo",
      "texto": "Cerrado"
    },
    {
      "dia": 1,
      "nombre": "Lunes",
      "texto": "2:00 p.m. – 8:30 p.m."
    },
    {
      "dia": 2,
      "nombre": "Martes",
      "texto": "2:00 p.m. – 8:30 p.m."
    },
    {
      "dia": 3,
      "nombre": "Miércoles",
      "texto": "10:00 a.m. – 8:30 p.m."
    },
    {
      "dia": 4,
      "nombre": "Jueves",
      "texto": "10:00 a.m. – 8:30 p.m."
    },
    {
      "dia": 5,
      "nombre": "Viernes",
      "texto": "10:00 a.m. – 8:30 p.m."
    },
    {
      "dia": 6,
      "nombre": "Sábado",
      "texto": "9:00 a.m. – 4:00 p.m."
    }
  ],
  "categorias": [
    "Todos",
    "Uñas",
    "Pestañas y Cejas",
    "Depilación con cera",
    "Faciales y Spa"
  ],
  "servicios": [
    {
      "id": "svc-001",
      "categoria": "Uñas",
      "nombre": "Gelish en manos",
      "descripcion": "Esmaltado semipermanente sobre tu uña natural. Escoges tus colores y te dura de dos a tres semanas sin despostillarse. Incluye limpieza de cutícula e hidratación.",
      "duracion_min": 60,
      "precio_mxn": 180,
      "destacado": true,
      "propuesta": false
    },
    {
      "id": "svc-002",
      "categoria": "Uñas",
      "nombre": "Gelish con retiro",
      "descripcion": "Si ya traes gelish puesto, aquí va incluido el retiro cuidadoso para no maltratar tu uña, más la aplicación nueva.",
      "duracion_min": 75,
      "precio_mxn": 220,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-003",
      "categoria": "Uñas",
      "nombre": "Uñas acrílicas — largo 1 a 2",
      "descripcion": "Set completo de acrílico corto, para que sigas haciendo tus cosas del diario sin sentirlas estorbosas. Incluye dos colores y un diseño sencillo en dos uñas.",
      "duracion_min": 120,
      "precio_mxn": 350,
      "destacado": true,
      "propuesta": false
    },
    {
      "id": "svc-004",
      "categoria": "Uñas",
      "nombre": "Uñas acrílicas — largo 3 a 4",
      "descripcion": "Set completo con más largo, para cuando quieres que se note. Incluye dos colores y diseño sencillo. Si traes foto de referencia, mejor: nos ahorramos tiempo y queda igualito.",
      "duracion_min": 150,
      "precio_mxn": 420,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-005",
      "categoria": "Uñas",
      "nombre": "Retoque de acrílico (relleno)",
      "descripcion": "Para clientas que ya se hicieron su set aquí. Rellenamos el crecimiento, revisamos que la uña esté sana y le damos color nuevo.",
      "duracion_min": 90,
      "precio_mxn": 300,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-006",
      "categoria": "Uñas",
      "nombre": "Baño de acrílico",
      "descripcion": "Una capa delgadita de acrílico sobre tu propia uña, sin extender el largo. Ideal si tienes la uña débil o se te rompe de la punta.",
      "duracion_min": 100,
      "precio_mxn": 300,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-007",
      "categoria": "Uñas",
      "nombre": "Manicura rusa",
      "descripcion": "Técnica con torno para limpiar la cutícula a fondo. El acabado queda mucho más limpio pegadito a la piel y te dura más antes de que se note el crecimiento.",
      "duracion_min": 75,
      "precio_mxn": 280,
      "destacado": true,
      "propuesta": true
    },
    {
      "id": "svc-008",
      "categoria": "Uñas",
      "nombre": "Diseño de uñas (por uña)",
      "descripcion": "Nail art a mano: francés de color, efecto espejo, encapsulados, pedrería. Precio por uña, según qué tan detallado lo quieras.",
      "duracion_min": 15,
      "precio_mxn": 30,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-009",
      "categoria": "Uñas",
      "nombre": "Retiro de acrílico o gel",
      "descripcion": "Retiro con producto, sin arrancar ni jalar. Terminamos con aceite de cutícula para que tu uña no quede reseca.",
      "duracion_min": 40,
      "precio_mxn": 120,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-010",
      "categoria": "Uñas",
      "nombre": "Pedicura spa",
      "descripcion": "Tina con sales, corte y limado, retiro de durezas, exfoliación y masaje de pies. Terminas con esmalte del color que escojas. Es el servicio para consentirte.",
      "duracion_min": 75,
      "precio_mxn": 320,
      "destacado": true,
      "propuesta": false
    },
    {
      "id": "svc-011",
      "categoria": "Uñas",
      "nombre": "Gelish en pies",
      "descripcion": "Semipermanente en pies, para que aguante sandalia, alberca y vacaciones sin retocar.",
      "duracion_min": 45,
      "precio_mxn": 150,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-012",
      "categoria": "Pestañas y Cejas",
      "nombre": "Lifting de pestañas",
      "descripcion": "Rizamos y levantamos tu pestaña natural desde la raíz. Te dura de seis a ocho semanas y te olvidas del enchinador en las mañanas.",
      "duracion_min": 75,
      "precio_mxn": 300,
      "destacado": true,
      "propuesta": false
    },
    {
      "id": "svc-013",
      "categoria": "Pestañas y Cejas",
      "nombre": "Extensiones de pestañas mink 1x1",
      "descripcion": "Pestaña por pestaña, técnica clásica. Tú escoges el largo y la curvatura para que se vea natural o más dramático, como tú quieras.",
      "duracion_min": 120,
      "precio_mxn": 650,
      "destacado": true,
      "propuesta": false
    },
    {
      "id": "svc-014",
      "categoria": "Pestañas y Cejas",
      "nombre": "Retoque de extensiones",
      "descripcion": "Mantenimiento a las tres semanas. Quitamos las que ya se cayeron y rellenamos para que se vean como el primer día.",
      "duracion_min": 75,
      "precio_mxn": 400,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-015",
      "categoria": "Pestañas y Cejas",
      "nombre": "Laminado de cejas",
      "descripcion": "Peinamos y fijamos el vello hacia arriba para que la ceja se vea más poblada y ordenada. Dura entre cuatro y seis semanas.",
      "duracion_min": 60,
      "precio_mxn": 350,
      "destacado": true,
      "propuesta": true
    },
    {
      "id": "svc-016",
      "categoria": "Pestañas y Cejas",
      "nombre": "Diseño y depilación de cejas",
      "descripcion": "Medimos tu rostro antes de quitar nada y te enseño el diseño para que lo apruebes. Nada de dejarte una ceja que no pediste.",
      "duracion_min": 20,
      "precio_mxn": 80,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-017",
      "categoria": "Pestañas y Cejas",
      "nombre": "Tinte de cejas",
      "descripcion": "Le damos color al vello y a los huecos para que se vea más llena sin tener que maquillarla todos los días.",
      "duracion_min": 30,
      "precio_mxn": 150,
      "destacado": false,
      "propuesta": true
    },
    {
      "id": "svc-018",
      "categoria": "Depilación con cera",
      "nombre": "Bozo",
      "descripcion": "Rapidísimo. Cera tibia y al terminar te ponemos calmante para que no te quede rojo.",
      "duracion_min": 10,
      "precio_mxn": 60,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-019",
      "categoria": "Depilación con cera",
      "nombre": "Axilas",
      "descripcion": "Con cera tibia, cambiando espátula cada vez. Con el tiempo el vello sale más delgadito y tardas más en volver.",
      "duracion_min": 15,
      "precio_mxn": 80,
      "destacado": true,
      "propuesta": false
    },
    {
      "id": "svc-020",
      "categoria": "Depilación con cera",
      "nombre": "Bikini básico",
      "descripcion": "Lo que se sale del traje de baño. Si es tu primera vez te explico todo antes de empezar, con calma.",
      "duracion_min": 25,
      "precio_mxn": 150,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-021",
      "categoria": "Depilación con cera",
      "nombre": "Bikini brasileño",
      "descripcion": "Depilación completa con cera. Espacio privado, material desechable y cero prisa. Aquí nadie te apura.",
      "duracion_min": 40,
      "precio_mxn": 220,
      "destacado": true,
      "propuesta": false
    },
    {
      "id": "svc-022",
      "categoria": "Depilación con cera",
      "nombre": "Media pierna",
      "descripcion": "De la rodilla hacia abajo, que es lo que más se ve. Terminamos con crema hidratante.",
      "duracion_min": 30,
      "precio_mxn": 160,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-023",
      "categoria": "Depilación con cera",
      "nombre": "Pierna completa",
      "descripcion": "Pierna entera, de arriba a abajo. Si lo combinas con axilas o bikini te hago precio de paquete.",
      "duracion_min": 60,
      "precio_mxn": 290,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-024",
      "categoria": "Depilación con cera",
      "nombre": "Brazos completos",
      "descripcion": "Brazo completo con cera tibia, sin incluir axila.",
      "duracion_min": 30,
      "precio_mxn": 180,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-025",
      "categoria": "Depilación con cera",
      "nombre": "Espalda o abdomen",
      "descripcion": "Por zona. También atendemos caballeros con cita previa.",
      "duracion_min": 25,
      "precio_mxn": 160,
      "destacado": false,
      "propuesta": false
    },
    {
      "id": "svc-026",
      "categoria": "Faciales y Spa",
      "nombre": "Limpieza facial profunda",
      "descripcion": "Desmaquillado, exfoliación, vapor, extracción de puntos negros, mascarilla según tu tipo de piel y protector solar. Sales con la cara descansada.",
      "duracion_min": 75,
      "precio_mxn": 450,
      "destacado": true,
      "propuesta": true
    },
    {
      "id": "svc-027",
      "categoria": "Faciales y Spa",
      "nombre": "Facial hidratante exprés",
      "descripcion": "Para cuando andas corriendo pero traes la piel apagada. Limpieza, mascarilla hidratante y masaje facial en menos de una hora.",
      "duracion_min": 45,
      "precio_mxn": 300,
      "destacado": false,
      "propuesta": true
    },
    {
      "id": "svc-028",
      "categoria": "Faciales y Spa",
      "nombre": "Spa de manos con parafina",
      "descripcion": "Exfoliación, baño de parafina caliente y masaje. Perfecto si tienes las manos resecas o trabajas mucho con químicos.",
      "duracion_min": 40,
      "precio_mxn": 180,
      "destacado": false,
      "propuesta": true
    },
    {
      "id": "svc-029",
      "categoria": "Faciales y Spa",
      "nombre": "Spa de pies",
      "descripcion": "Tina caliente, exfoliación con sales, mascarilla y masaje relajante. Sin esmalte, solo para descansar los pies.",
      "duracion_min": 50,
      "precio_mxn": 250,
      "destacado": false,
      "propuesta": true
    }
  ],
  "esmaltes": [
    {
      "i": 0,
      "nombre": "Vino de Casa",
      "hex": "#8E4438",
      "texto": "#FFFCFA",
      "suave": "#EBD3C8",
      "familia": "vino"
    },
    {
      "i": 1,
      "nombre": "Nude Asunción",
      "hex": "#C9A18F",
      "texto": "#241A17",
      "suave": "#F4E7E0",
      "familia": "nude"
    },
    {
      "i": 2,
      "nombre": "Rosa Cantera",
      "hex": "#C9857A",
      "texto": "#241A17",
      "suave": "#F2DCD7",
      "familia": "nude"
    },
    {
      "i": 3,
      "nombre": "Blanco Leche",
      "hex": "#F1EAE4",
      "texto": "#241A17",
      "suave": "#FBF7F4",
      "familia": "claro"
    },
    {
      "i": 4,
      "nombre": "Café Tostado",
      "hex": "#5A3A2E",
      "texto": "#FFFCFA",
      "suave": "#E0CFC7",
      "familia": "oscuro"
    },
    {
      "i": 5,
      "nombre": "Rojo Feria",
      "hex": "#A32232",
      "texto": "#FFFCFA",
      "suave": "#F0D3D7",
      "familia": "vino"
    },
    {
      "i": 6,
      "nombre": "Uva Seca",
      "hex": "#5D3550",
      "texto": "#FFFCFA",
      "suave": "#E2D3DE",
      "familia": "oscuro"
    },
    {
      "i": 7,
      "nombre": "Durazno",
      "hex": "#E8A87C",
      "texto": "#241A17",
      "suave": "#FAE9DC",
      "familia": "nude"
    },
    {
      "i": 8,
      "nombre": "Verde Agave",
      "hex": "#4C5B45",
      "texto": "#FFFCFA",
      "suave": "#DCE1D8",
      "familia": "frio"
    },
    {
      "i": 9,
      "nombre": "Azul Talavera",
      "hex": "#2F4A6B",
      "texto": "#FFFCFA",
      "suave": "#D6DEE7",
      "familia": "frio"
    },
    {
      "i": 10,
      "nombre": "Negro Charol",
      "hex": "#1E1B1A",
      "texto": "#FFFCFA",
      "suave": "#D8D5D4",
      "familia": "oscuro"
    },
    {
      "i": 11,
      "nombre": "Gris Perla",
      "hex": "#B7B2AE",
      "texto": "#241A17",
      "suave": "#EEECEA",
      "familia": "claro"
    }
  ],
  "resenas": [
    {
      "id": "rev-001",
      "texto": "Bonitas instalaciones, super atenta su propietaria y excelentes sus trabajos.",
      "rating": 5,
      "autor": "Opinión publicada en Google",
      "origen": "google"
    },
    {
      "id": "rev-002",
      "texto": "Excelente servicio muy amables y un trabajo muy recomendado",
      "rating": 5,
      "autor": "Opinión publicada en Google",
      "origen": "google"
    },
    {
      "id": "rev-003",
      "texto": "Excelente atención y calidad en el servicio.",
      "rating": 5,
      "autor": "Opinión publicada en Google",
      "origen": "google"
    }
  ],
  "trabajos": [
    {
      "id": "tr-01",
      "archivo": "trabajo-01.svg",
      "familia": "nude",
      "titulo": "Gelish nude en manos",
      "categoria": "Uñas"
    },
    {
      "id": "tr-02",
      "archivo": "trabajo-02.svg",
      "familia": "vino",
      "titulo": "Acrílicas tono vino",
      "categoria": "Uñas"
    },
    {
      "id": "tr-03",
      "archivo": "trabajo-03.svg",
      "familia": "oscuro",
      "titulo": "Diseño en tonos oscuros",
      "categoria": "Uñas"
    },
    {
      "id": "tr-04",
      "archivo": "trabajo-04.svg",
      "familia": "claro",
      "titulo": "Francés en tono leche",
      "categoria": "Uñas"
    },
    {
      "id": "tr-05",
      "archivo": "trabajo-05.svg",
      "familia": "frio",
      "titulo": "Nail art de talavera",
      "categoria": "Uñas"
    },
    {
      "id": "tr-06",
      "archivo": "trabajo-06.svg",
      "familia": "nude",
      "titulo": "Pedicura spa",
      "categoria": "Uñas"
    },
    {
      "id": "tr-07",
      "archivo": "trabajo-07.svg",
      "familia": "vino",
      "titulo": "Gelish rojo con diseño",
      "categoria": "Uñas"
    },
    {
      "id": "tr-08",
      "archivo": "trabajo-08.svg",
      "familia": "oscuro",
      "titulo": "Depilación con cera tibia",
      "categoria": "Depilación con cera"
    }
  ],
  "pasosCera": [
    {
      "n": "01",
      "t": "Limpieza de la zona",
      "d": "Desmaquillado y desinfección antes de tocar nada. Material desechable, espátula nueva cada vez."
    },
    {
      "n": "02",
      "t": "Prueba de temperatura",
      "d": "La cera se prueba en tu muñeca antes de aplicarla. Si la sientes caliente, se espera."
    },
    {
      "n": "03",
      "t": "Aplicación y retiro",
      "d": "Por secciones, siguiendo el sentido del vello. Se avisa antes de cada jalón. Nadie te apura."
    },
    {
      "n": "04",
      "t": "Calmante e indicaciones",
      "d": "Gel calmante para bajar el enrojecimiento y te explico los cuidados de las siguientes 24 horas."
    }
  ],
  "brechas": [
    {
      "hoy": "No hay sitio web. Google muestra el botón \"Agregar sitio web\" en tu ficha.",
      "con": "Un dominio propio que puedes mandar por WhatsApp en vez de \"búscame en Face\"."
    },
    {
      "hoy": "La ficha de Google no está reclamada: no controlas tus fotos, tu horario ni tu descripción.",
      "con": "Ficha reclamada y ligada al sitio, con los mismos datos en los dos lados."
    },
    {
      "hoy": "Google dice 514 y Facebook dice 516. Un solo número equivocado te hunde en búsquedas locales.",
      "con": "Una sola dirección, idéntica en el sitio, en Google y en Facebook."
    },
    {
      "hoy": "No apareces en Fresha, Booksy ni AgendaPro. Ahí sí están 8 competidores de la ciudad.",
      "con": "Agenda propia en tu página. No rentas la relación con tu clienta a un marketplace."
    },
    {
      "hoy": "No hay lista de precios pública. Cada cotización es un WhatsApp contestado con las manos ocupadas.",
      "con": "29 servicios con precio y duración a la vista. La página contesta mientras tú trabajas."
    },
    {
      "hoy": "Tu portafolio vive dentro de Facebook, donde Google no lo indexa y se hunde a los tres días.",
      "con": "Galería ordenada por servicio, con dirección indexable."
    }
  ]
};
