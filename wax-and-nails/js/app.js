/* ==========================================================================
   app.js — Wax & Nails
   --------------------------------------------------------------------------
   Script clásico (nada de módulos, nada de fetch, nada de storage): la página
   tiene que abrir con doble clic desde el escritorio.

   Orden de carga: ui.js → reveal.js (en el head) → whatsapp.js → booking.js
   → datos.js → este archivo.

   Contenido:
     1. Utilidades mínimas
     2. FIRMA · El Abanico (apertura, arrastre, teclado, repintado global)
     3. Galería filtrada por familia de tono
     4. Catálogo de servicios con filtros
     5. Motor de reservas
     6. Reseñas verificadas
     7. Diagnóstico de presencia digital
     8. Horario en vivo y mapa
     9. Cabecera, WhatsApp y remates

   Toda animación que aparece aquí tiene su fila en
   _design/sistema/tabla-de-movimiento.md. No hay duraciones improvisadas.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var D = window.DATOS;
  if (!D) { console.error('[app] Falta datos.js'); return; }

  /* ======================================================================
     1 · UTILIDADES
     ====================================================================== */

  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }

  function reducido() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function pesos(n) {
    return '$' + new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n);
  }

  /** 90 → "1 h 30 min". Las duraciones se leen, no se calculan. */
  function duracion(min) {
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Vuelve a registrar el contenido inyectado en el motor de revelado. */
  function rescanear(raiz) {
    if (window.Reveal && window.Reveal.scan) window.Reveal.scan(raiz || document);
  }

  var ICONO_RELOJ = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';


  /* ======================================================================
     2 · FIRMA · EL ABANICO
     ----------------------------------------------------------------------
     Un muestrario de esmaltes que existe físicamente sobre la mesa de
     cualquier salón. Al elegir un color repinta exactamente cinco roles del
     sitio: botón primario, subrayado de enlace, borde activo del catálogo,
     chip seleccionado y el anillo del tono elegido. Nada más. Si se repinta
     todo, se pierde la lectura.
     ====================================================================== */

  var Abanico = (function () {
    var raiz = null;
    var palillos = [];
    var indice = 0;
    var apertura = 0.08;
    var abierto = false;
    var suscriptores = [];

    var MIN = 0.08, MAX_CRUDO = 1.25, RECORRIDO = 220;
    var VEL_DESCARTE = 0.11;   // px/ms — un flick rápido basta, sin umbral de distancia

    function fijarApertura(v) {
      apertura = v;
      raiz.style.setProperty('--apertura', String(v));
    }

    /* --------------------------------------------------- repintado global */

    function repintar(el) {
      var r = document.documentElement.style;
      r.setProperty('--acento', el.getAttribute('data-hex'));
      r.setProperty('--acento-texto', el.getAttribute('data-texto'));
      r.setProperty('--acento-suave', el.getAttribute('data-suave'));
      // El contraste NUNCA se calcula en runtime: cada palillo trae su par
      // hex/texto precalculado y verificado a ≥4.5:1 en el archivo de sistema.
    }

    function seleccionar(i, moverFoco) {
      if (i < 0 || i >= palillos.length) return;
      indice = i;
      for (var k = 0; k < palillos.length; k++) {
        var elegido = (k === i);
        palillos[k].setAttribute('aria-checked', elegido ? 'true' : 'false');
        palillos[k].setAttribute('tabindex', elegido ? '0' : '-1');
      }
      var el = palillos[i];
      repintar(el);
      if (moverFoco) el.focus();

      var info = {
        nombre: el.getAttribute('data-nombre'),
        hex: el.getAttribute('data-hex'),
        familia: el.getAttribute('data-familia')
      };
      var eco = $('[data-abanico-nombre]');
      if (eco) eco.textContent = info.nombre;
      for (var s = 0; s < suscriptores.length; s++) suscriptores[s](info);
    }

    /* ------------------------------------------------------------ apertura */

    function abrir() {
      if (abierto) return;
      abierto = true;
      fijarApertura(1);
      // El stagger dura 520ms + 11×26ms. Pasado eso, el abanico deja de ser
      // una entrada y pasa a ser un control: sin delay y con curva de salida.
      window.setTimeout(function () {
        if (raiz.getAttribute('data-modo') !== 'arrastre') raiz.setAttribute('data-modo', 'listo');
      }, 520 + 11 * 26);
    }

    /* ------------------------------------------------------------ arrastre */

    function conectarArrastre() {
      var activo = false, idPuntero = null;
      var x0 = 0, t0 = 0, base = 0, recorrido = 0;

      raiz.addEventListener('pointerdown', function (e) {
        if (reducido()) return;                 // sin arrastre con movimiento reducido
        if (activo) return;                      // multi-touch: se ignoran contactos extra
        activo = true;
        idPuntero = e.pointerId;
        x0 = e.clientX; t0 = e.timeStamp;
        base = apertura; recorrido = 0;
        raiz.setAttribute('data-modo', 'arrastre');
        try { raiz.setPointerCapture(e.pointerId); } catch (err) { /* navegador viejo */ }
      });

      raiz.addEventListener('pointermove', function (e) {
        if (!activo || e.pointerId !== idPuntero) return;
        var dx = e.clientX - x0;
        recorrido = Math.abs(dx);
        var crudo = base + dx / RECORRIDO;
        // Damping fuera del tope: nada en la vida real se detiene de golpe.
        if (crudo > 1) crudo = 1 + (crudo - 1) * 0.35;
        if (crudo > MAX_CRUDO) crudo = MAX_CRUDO;
        if (crudo < MIN) crudo = MIN;
        fijarApertura(crudo);
      });

      function soltar(e) {
        if (!activo || (e && e.pointerId !== idPuntero)) return;
        activo = false;
        var dx = e ? e.clientX - x0 : 0;
        var dt = e ? Math.max(e.timeStamp - t0, 1) : 1;
        var v = dx / dt;

        var destino;
        if (Math.abs(v) > VEL_DESCARTE) destino = v > 0 ? 1 : MIN;   // decide la velocidad
        else destino = apertura > 0.54 ? 1 : MIN;                     // si no, la cercanía

        raiz.setAttribute('data-modo', 'listo');
        fijarApertura(destino);
        abierto = (destino === 1);
        try { raiz.releasePointerCapture(idPuntero); } catch (err) { /* ya liberado */ }
        idPuntero = null;
      }

      raiz.addEventListener('pointerup', soltar);
      raiz.addEventListener('pointercancel', soltar);

      // Un arrastre no debe seleccionar color. 6px de tolerancia entre un
      // toque y un gesto: por debajo de eso el dedo simplemente tiembla.
      raiz.addEventListener('click', function (e) {
        if (recorrido > 6) { e.preventDefault(); e.stopPropagation(); recorrido = 0; }
      }, true);
    }

    /* ------------------------------------------------------------- teclado */

    function conectarTeclado() {
      raiz.addEventListener('keydown', function (e) {
        var n = palillos.length, i = indice;
        switch (e.key) {
          case 'ArrowRight': case 'ArrowDown': i = (indice + 1) % n; break;
          case 'ArrowLeft':  case 'ArrowUp':   i = (indice - 1 + n) % n; break;
          case 'Home': i = 0; break;
          case 'End':  i = n - 1; break;
          case ' ': case 'Spacebar': i = indice; break;
          default: return;
        }
        e.preventDefault();
        abrir();                 // navegar con teclado abre el mazo: si no, no se ve nada
        seleccionar(i, true);
      });
    }

    /* ---------------------------------------------------------------- init */

    function init() {
      raiz = $('[data-abanico]');
      if (!raiz) return;
      palillos = $$('.palillo', raiz);
      if (!palillos.length) return;

      palillos.forEach(function (p, i) {
        p.addEventListener('click', function () { seleccionar(i, false); });
      });

      if (reducido()) {
        // Nace abierto, sin apertura ni stagger, sin arrastre. El cambio de
        // color se conserva: es información, no movimiento.
        abierto = true;
        fijarApertura(1);
        raiz.setAttribute('data-modo', 'listo');
      } else {
        fijarApertura(MIN);
        conectarArrastre();
        if ('IntersectionObserver' in window) {
          var io = new window.IntersectionObserver(function (entradas) {
            entradas.forEach(function (en) {
              if (!en.isIntersecting) return;
              io.unobserve(en.target);   // se abre una sola vez, es una entrada
              abrir();
            });
          }, { threshold: 0.4 });
          io.observe(raiz);
        } else {
          abrir();
        }
      }

      conectarTeclado();
      seleccionar(0, false);
    }

    return {
      init: init,
      alCambiar: function (fn) { suscriptores.push(fn); },
      actual: function () { return palillos.length ? palillos[indice].getAttribute('data-nombre') : ''; }
    };
  })();


  /* ======================================================================
     3 · GALERÍA FILTRADA POR FAMILIA DE TONO
     ----------------------------------------------------------------------
     Es lo que justifica al Abanico: el color deja de ser decoración y se
     vuelve un filtro. No se reordena el DOM con animación de posición
     (sería un FLIP innecesario que marea): se usa `order` de grid.
     ====================================================================== */

  var Galeria = (function () {
    var lista = null;

    function pintar() {
      lista = $('[data-galeria]');
      if (!lista) return;
      lista.innerHTML = D.trabajos.map(function (t) {
        return '<li class="galeria__pieza" data-familia="' + esc(t.familia) + '" data-reveal="scale">' +
          '<img src="assets/img/' + esc(t.archivo) + '" alt="' + esc(t.titulo) + '" width="400" height="500" loading="lazy">' +
          '<span class="galeria__etiqueta">' + esc(t.titulo) + '</span>' +
          '</li>';
      }).join('');
      rescanear(lista.parentNode);
    }

    function filtrar(info) {
      if (!lista) return;
      var piezas = $$('.galeria__pieza', lista);
      var coinciden = 0;
      piezas.forEach(function (p) {
        var igual = p.getAttribute('data-familia') === info.familia;
        if (igual) coinciden++;
        p.setAttribute('data-atenuada', igual ? 'false' : 'true');
        p.setAttribute('data-destacada', igual ? 'true' : 'false');
        p.style.order = igual ? '0' : '1';
      });
      var nota = $('[data-galeria-nota]');
      if (nota) {
        nota.textContent = coinciden
          ? coinciden + (coinciden === 1 ? ' trabajo' : ' trabajos') + ' en la familia de ' + info.nombre + '.'
          : 'Todavía no hay trabajos publicados en la familia de ' + info.nombre + '.';
      }
    }

    return { pintar: pintar, filtrar: filtrar };
  })();


  /* ======================================================================
     4 · CATÁLOGO DE SERVICIOS
     ====================================================================== */

  var Carta = (function () {
    var estado = { categoria: 'Todos', orden: 'destacado', precioMax: 650, duracionMax: 0 };
    var cont = null;

    function pintarChips() {
      var caja = $('[data-filtro-categorias]');
      if (!caja) return;
      caja.innerHTML = D.categorias.map(function (c) {
        return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' +
          (c === estado.categoria) + '">' + esc(c) + '</button>';
      }).join('');
      $$('.chip', caja).forEach(function (b) {
        b.addEventListener('click', function () {
          estado.categoria = b.getAttribute('data-cat');
          $$('.chip', caja).forEach(function (o) {
            o.setAttribute('aria-pressed', String(o === b));
          });
          pintar();
        });
      });
    }

    function filtrados() {
      var out = D.servicios.filter(function (s) {
        if (estado.categoria !== 'Todos' && s.categoria !== estado.categoria) return false;
        if (s.precio_mxn > estado.precioMax) return false;
        if (estado.duracionMax && s.duracion_min > estado.duracionMax) return false;
        return true;
      });
      out.sort(function (a, b) {
        switch (estado.orden) {
          case 'precio-asc':    return a.precio_mxn - b.precio_mxn;
          case 'precio-desc':   return b.precio_mxn - a.precio_mxn;
          case 'duracion-asc':  return a.duracion_min - b.duracion_min;
          case 'duracion-desc': return b.duracion_min - a.duracion_min;
          default:
            if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
            return a.precio_mxn - b.precio_mxn;
        }
      });
      return out;
    }

    function tarjeta(s) {
      var esCera = s.categoria === 'Depilación con cera';
      return '<li class="svc' + (esCera ? ' svc--cera' : '') + '" data-id="' + esc(s.id) + '">' +
        '<div class="svc__cabeza">' +
          '<h3 class="svc__nombre">' + esc(s.nombre) + '</h3>' +
          '<span class="svc__precio">' + pesos(s.precio_mxn) + '</span>' +
        '</div>' +
        '<p class="svc__desc">' + esc(s.descripcion) + '</p>' +
        '<p class="svc__meta">' +
          '<span>' + esc(s.categoria) + '</span>' +
          '<span>' + duracion(s.duracion_min) + '</span>' +
          (s.destacado ? '<span>De los más pedidos</span>' : '') +
          (s.propuesta ? '<span class="svc__propuesta">Por confirmar</span>' : '') +
        '</p>' +
        '<p class="svc__pie"><button type="button" class="svc__accion" data-reservar="' + esc(s.id) + '">Reservar este</button></p>' +
        '</li>';
    }

    function pintar() {
      cont = $('[data-carta]');
      if (!cont) return;
      var lista = filtrados();

      cont.innerHTML = lista.map(tarjeta).join('');

      var vacio = $('[data-carta-vacio]');
      if (vacio) vacio.hidden = lista.length > 0;

      var conteo = $('[data-conteo]');
      if (conteo) {
        conteo.textContent = lista.length === 1
          ? '1 servicio'
          : lista.length + ' servicios' + (estado.categoria !== 'Todos' ? ' en ' + estado.categoria.toLowerCase() : '');
      }

      $$('[data-reservar]', cont).forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-reservar');
          $$('.svc', cont).forEach(function (c) {
            c.setAttribute('data-preseleccionado', String(c.getAttribute('data-id') === id));
          });
          if (window.Booking && window.Booking.preseleccionar) window.Booking.preseleccionar(id);
          var destino = $('#reservar');
          if (destino) destino.scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'start' });
        });
      });
    }

    function init() {
      pintarChips();

      var orden = $('[data-orden]');
      if (orden) orden.addEventListener('change', function () { estado.orden = orden.value; pintar(); });

      var precio = $('[data-precio-max]');
      var salida = $('[data-precio-salida]');
      if (precio) {
        precio.addEventListener('input', function () {
          estado.precioMax = parseInt(precio.value, 10);
          if (salida) salida.textContent = pesos(estado.precioMax);
          pintar();
        });
      }

      var dur = $('[data-duracion]');
      if (dur) dur.addEventListener('change', function () { estado.duracionMax = parseInt(dur.value, 10); pintar(); });

      // Atajo desde la sección de cera hacia su categoría del catálogo.
      $$('[data-ir-categoria]').forEach(function (a) {
        a.addEventListener('click', function () {
          estado.categoria = a.getAttribute('data-ir-categoria');
          pintarChips();
          pintar();
        });
      });

      pintar();
    }

    return { init: init };
  })();


  /* ======================================================================
     5 · MOTOR DE RESERVAS
     ====================================================================== */

  function iniciarReservas() {
    if (!window.Booking || !$('#reservas')) return;

    window.Booking.init({
      mount: '#reservas',
      servicios: D.servicios.map(function (s) {
        return {
          id: s.id, nombre: s.nombre, categoria: s.categoria,
          duracion_min: s.duracion_min, precio_mxn: s.precio_mxn,
          descripcion: s.descripcion
        };
      }),
      horario: D.horario,          // domingo cerrado; lunes y martes abren a las 14:00
      diasCerrados: [],
      intervalo: 30,
      telefonoWhatsApp: D.negocio.whatsapp,
      nombreNegocio: D.negocio.nombre,
      ocupacion: 0.35,
      onConfirm: function (reserva) {
        if (window.UI && window.UI.Toast) {
          window.UI.Toast.exito('Cita apartada. Folio ' + reserva.folio, {
            descripcion: 'Ahora mándala por WhatsApp para que quede confirmada.'
          });
        }
      }
    });
  }


  /* ======================================================================
     6 · RESEÑAS
     ----------------------------------------------------------------------
     Solo entran las tres transcritas de Google. Las reseñas inventadas del
     archivo de investigación no se publican: publicarlas sería inventar
     testimonios de clientas que no existen.
     ====================================================================== */

  function pintarResenas() {
    var cont = $('[data-resenas]');
    if (!cont) return;
    var estrella = '<svg class="ico-estrella" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M10 1.6l2.5 5.1 5.6.8-4 4 .9 5.6L10 14.4 5 17.1l1-5.6-4.1-4 5.6-.8z"/></svg>';

    cont.innerHTML = D.resenas.map(function (r) {
      var estrellas = '';
      for (var i = 0; i < r.rating; i++) estrellas += estrella;
      return '<li class="resena" data-reveal>' +
        '<blockquote class="resena__cita">&ldquo;' + esc(r.texto) + '&rdquo;</blockquote>' +
        '<div class="resena__pie">' +
          '<span class="estrellas" role="img" aria-label="' + r.rating + ' de 5 estrellas">' + estrellas + '</span>' +
          '<span>' + esc(r.autor) + '</span>' +
          '<span class="resena__origen">Verificada</span>' +
        '</div></li>';
    }).join('');
    rescanear(cont.parentNode);
  }


  /* ======================================================================
     7 · DIAGNÓSTICO DE PRESENCIA DIGITAL
     ====================================================================== */

  function pintarBrechas() {
    var cont = $('[data-brechas]');
    if (!cont) return;
    cont.innerHTML = D.brechas.map(function (b) {
      return '<li class="brecha" data-reveal>' +
        '<div class="brecha__lado brecha__lado--hoy">' +
          '<span class="brecha__rotulo">Hoy</span>' +
          '<span class="brecha__texto">' + esc(b.hoy) + '</span>' +
        '</div>' +
        '<div class="brecha__lado brecha__lado--con">' +
          '<span class="brecha__rotulo">Con tu página</span>' +
          '<span class="brecha__texto">' + esc(b.con) + '</span>' +
        '</div></li>';
    }).join('');
    rescanear(cont.parentNode);
  }


  /* ======================================================================
     8 · PASOS DE CERA, HORARIO EN VIVO Y MAPA
     ====================================================================== */

  function pintarPasosCera() {
    var cont = $('[data-pasos-cera]');
    if (!cont) return;
    cont.innerHTML = D.pasosCera.map(function (p) {
      return '<li><span class="pasos__n">' + esc(p.n) + '</span>' +
        '<span><span class="pasos__t">' + esc(p.t) + '</span>' +
        '<span class="pasos__d">' + esc(p.d) + '</span></span></li>';
    }).join('');
  }

  function minutos(hhmm) {
    var p = hhmm.split(':');
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function pintarHorario() {
    var cuerpo = $('[data-tabla-horario]');
    var ahora = new Date();
    var hoy = ahora.getDay();

    if (cuerpo) {
      cuerpo.innerHTML = D.horarioTexto.map(function (h) {
        var cerrado = h.texto === 'Cerrado';
        return '<tr data-hoy="' + (h.dia === hoy) + '" data-cerrado="' + cerrado + '">' +
          '<th scope="row">' + esc(h.nombre) + (h.dia === hoy ? ' <span class="visualmente-oculto">(hoy)</span>' : '') + '</th>' +
          '<td>' + esc(h.texto) + '</td></tr>';
      }).join('');
    }

    var estado = $('[data-estado-hoy]');
    if (!estado) return;

    var tramo = D.horario[hoy];
    var min = ahora.getHours() * 60 + ahora.getMinutes();
    var abierto = !!tramo && min >= minutos(tramo.abre) && min < minutos(tramo.cierra);

    var texto;
    if (abierto) {
      texto = 'Abierto ahora · cerramos a las ' + tramo.cierra;
    } else if (tramo && min < minutos(tramo.abre)) {
      texto = 'Cerrado · hoy abrimos a las ' + tramo.abre;
    } else {
      // Próximo día con horario.
      var d = hoy, salto = 0;
      do { d = (d + 1) % 7; salto++; } while (!D.horario[d] && salto < 7);
      var nombre = D.horarioTexto[d] ? D.horarioTexto[d].nombre.toLowerCase() : '';
      texto = 'Cerrado · abrimos el ' + nombre + ' a las ' + (D.horario[d] ? D.horario[d].abre : '');
    }

    estado.textContent = texto;
    estado.setAttribute('data-abierto', String(abierto));
  }

  function conectarMapa() {
    $$('[data-maps-dir]').forEach(function (a) {
      a.href = D.negocio.mapsDir;
    });
  }


  /* ======================================================================
     9 · CABECERA, WHATSAPP Y REMATES
     ====================================================================== */

  function conectarCabecera() {
    var cab = $('[data-cab]');
    if (!cab) return;
    var ultimo = null;
    // Un solo listener pasivo y un solo write por cambio de estado: escribir
    // en cada scroll dispararía estilo y paint sin que nada haya cambiado.
    window.addEventListener('scroll', function () {
      var compacta = window.scrollY > 8;
      if (compacta === ultimo) return;
      ultimo = compacta;
      cab.setAttribute('data-compacta', String(compacta));
    }, { passive: true });
  }

  function mensajeWhatsApp(nombreTono) {
    return 'Hola, me interesa una cita. Vi el tono ' + nombreTono + ' en su página.';
  }

  function conectarWhatsApp() {
    if (!window.WhatsApp) return;
    var tel = D.negocio.whatsapp;

    // Botón flotante: aparece pasado el hero, nunca late ni pulsa.
    window.WhatsApp.boton({
      telefono: tel,
      mensaje: mensajeWhatsApp(Abanico.actual() || 'Vino de Casa'),
      apareceEn: 560,
      tooltip: '¿Te ayudo a escoger?',
      etiqueta: 'Escribir a Wax & Nails por WhatsApp'
    });

    actualizarEnlacesWA(Abanico.actual() || 'Vino de Casa');
  }

  function actualizarEnlacesWA(nombreTono) {
    if (!window.WhatsApp) return;
    var msg = mensajeWhatsApp(nombreTono);
    var href = window.WhatsApp.link(D.negocio.whatsapp, msg);

    $$('[data-wa]').forEach(function (a) {
      a.setAttribute('data-wa-mensaje', msg);
      if (a.tagName === 'A') { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    });

    var fab = $('.lib-wa__btn');
    if (fab) fab.href = href;
  }

  function pintarSchemaVisible() {
    var origen = $('#schema-negocio');
    var destino = $('[data-schema-visible]');
    if (!origen || !destino) return;
    // Se copia del propio <script>: así el bloque visible nunca puede
    // desincronizarse del que Google lee.
    destino.textContent = origen.textContent.trim();
  }

  function remates() {
    var anio = $('[data-anio]');
    if (anio) anio.textContent = String(new Date().getFullYear());

    var salida = $('[data-precio-salida]');
    var rango = $('[data-precio-max]');
    if (salida && rango) salida.textContent = pesos(parseInt(rango.value, 10));
  }


  /* ======================================================================
     ARRANQUE
     ====================================================================== */

  function arrancar() {
    // 1. Contenido primero: lo que se pinta debe existir antes de conectar
    //    el revelado, los contadores y el Abanico.
    Galeria.pintar();
    Carta.init();
    pintarResenas();
    pintarBrechas();
    pintarPasosCera();
    pintarHorario();
    conectarMapa();
    pintarSchemaVisible();
    remates();

    // 2. Firma y sus dos consumidores.
    Abanico.alCambiar(function (info) {
      Galeria.filtrar(info);
      actualizarEnlacesWA(info.nombre);
    });
    Abanico.init();

    // 3. Motor de reservas y utilidades transversales.
    iniciarReservas();
    conectarCabecera();
    conectarWhatsApp();

    if (window.UI && window.UI.conectar) window.UI.conectar(document);
    rescanear(document);

    // El horario "de hoy" se refresca cada minuto: la demo se enseña en vivo
    // y un estado "abierto" congelado a las 20:31 delata la página.
    window.setInterval(pintarHorario, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }

})(window, document);
