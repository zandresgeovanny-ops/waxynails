/* ==========================================================================
   ui.js — Componentes de interfaz + núcleo compartido
   --------------------------------------------------------------------------
   Expone en window:
     UI.utils    → helpers compartidos (foco, scroll lock, eventos, moneda)
     UI.Toast    → pila de notificaciones estilo Sonner
     UI.Modal    → diálogo con backdrop, trap de foco y bloqueo de scroll
     UI.Tabs     → tabs con indicador deslizante medido en px reales
     UI.Accordion→ acordeón con altura animada y liberada a `auto`
     UI.Counter  → número que cuenta al entrar en viewport
     UI.Marquee  → cinta infinita que pausa al hover
     UI.Lightbox → galería con navegación por teclado

   ESTE ARCHIVO ES REQUISITO de cart.js y booking.js (usan UI.utils).
   Orden de carga: base.css → reveal.js → ui.js → whatsapp.js → cart.js → booking.js

   CRITERIO GENERAL DE ANIMACIÓN (Emil Kowalski):
   1. ¿Debo animar? Solo si el usuario lo ve ocasionalmente. Nada disparado
      por teclado se anima: se repite cientos de veces al día y la animación
      lo vuelve lento (ver `data-instante` en Tabs).
   2. ¿Para qué? Continuidad espacial, feedback o evitar cambios abruptos.
   3. Easing: entra/sale → ease-out. Se mueve en pantalla → ease-in-out.
      Movimiento constante → linear. `ease-in` NUNCA.
   4. Duración: press 140ms, tooltip 160ms, menú 220ms, modal 260ms,
      drawer 420ms. La salida siempre más rápida que la entrada.
   5. Transiciones, no keyframes, para todo lo que se dispara rápido: las
      transiciones se redirigen a medio camino, los keyframes reinician.
   ========================================================================== */
(function (window, document) {
  'use strict';

  /* ======================================================================
     0. NÚCLEO COMPARTIDO (UI.utils)
     ====================================================================== */

  var mqReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqHover = window.matchMedia('(hover: hover) and (pointer: fine)');

  var SELECTOR_ENFOCABLE = [
    'a[href]', 'area[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])', 'iframe', 'object', 'embed',
    '[contenteditable]:not([contenteditable="false"])', '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  var utils = {
    /** ¿El usuario pidió menos movimiento? Se consulta en vivo, no se cachea. */
    reducido: function () { return mqReducido.matches; },
    /** ¿El dispositivo tiene puntero fino? Evita hovers fantasma en táctil. */
    tieneHover: function () { return mqHover.matches; },

    /** Crea un elemento con props y atributos en una sola llamada. */
    crear: function (tag, props, hijos) {
      var el = document.createElement(tag);
      if (props) {
        for (var k in props) {
          if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
          var v = props[k];
          if (v === null || v === undefined || v === false) continue;
          if (k === 'class') el.className = v;
          else if (k === 'text') el.textContent = v;
          else if (k === 'html') el.innerHTML = v;
          else if (k === 'style' && typeof v === 'object') { for (var s in v) el.style[s] = v[s]; }
          else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
          else el.setAttribute(k, v === true ? '' : v);
        }
      }
      if (hijos) {
        var lista = Array.isArray(hijos) ? hijos : [hijos];
        for (var i = 0; i < lista.length; i++) {
          var h = lista[i];
          if (h === null || h === undefined) continue;
          el.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
        }
      }
      return el;
    },

    /** Escapa texto para inyectarlo en HTML sin abrir un XSS. */
    escapar: function (str) {
      return String(str === null || str === undefined ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    /** Inyecta un <style> una sola vez (idempotente por id). */
    inyectar: function (id, css) {
      if (document.getElementById(id)) return;
      var st = document.createElement('style');
      st.id = id;
      st.textContent = css;
      document.head.appendChild(st);
    },

    /** Dispara un CustomEvent que burbujea, para que la landing reaccione. */
    emitir: function (nombre, detalle, destino) {
      var ev = new CustomEvent(nombre, { detail: detalle || {}, bubbles: true, cancelable: true });
      (destino || document).dispatchEvent(ev);
      return ev;
    },

    /** Formatea dinero. Intl está en todos los navegadores objetivo. */
    moneda: function (valor, cfg) {
      cfg = cfg || {};
      var n = Number(valor) || 0;
      try {
        return new Intl.NumberFormat(cfg.locale || 'es-MX', {
          style: 'currency',
          currency: cfg.moneda || 'MXN',
          minimumFractionDigits: n % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2
        }).format(n);
      } catch (e) {
        return '$' + n.toFixed(n % 1 === 0 ? 0 : 2);
      }
    },

    enfocables: function (raiz) {
      var lista = raiz.querySelectorAll(SELECTOR_ENFOCABLE);
      var out = [];
      for (var i = 0; i < lista.length; i++) {
        var el = lista[i];
        // offsetParent null = display:none. Un trap que enfoca elementos
        // invisibles deja al usuario de teclado "en la nada".
        if (el.offsetParent !== null || el === document.activeElement) out.push(el);
      }
      return out;
    },

    /**
     * Atrapa el foco dentro de un contenedor. Devuelve la función de liberado,
     * que además devuelve el foco a donde estaba antes de abrir. Sin esto, un
     * usuario de teclado "cae" detrás del modal y no encuentra el camino.
     */
    atraparFoco: function (contenedor, opciones) {
      opciones = opciones || {};
      var previo = document.activeElement;

      function alTab(e) {
        if (e.key !== 'Tab') return;
        var items = utils.enfocables(contenedor);
        if (!items.length) { e.preventDefault(); contenedor.focus(); return; }
        var primero = items[0];
        var ultimo = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === primero || document.activeElement === contenedor)) {
          e.preventDefault(); ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault(); primero.focus();
        }
      }

      // Segunda red de seguridad: si el foco escapa por cualquier otra vía
      // (clic en el fondo, foco programático externo), lo traemos de vuelta.
      function alFocusIn(e) {
        if (contenedor.contains(e.target)) return;
        var items = utils.enfocables(contenedor);
        (items[0] || contenedor).focus();
      }

      document.addEventListener('keydown', alTab, true);
      document.addEventListener('focusin', alFocusIn, true);

      // Enfoque inicial: el elemento marcado, el primero enfocable, o el
      // contenedor. Sin esto el lector de pantalla sigue leyendo el fondo.
      window.requestAnimationFrame(function () {
        var inicial = opciones.inicial ||
          contenedor.querySelector('[data-autofoco]') ||
          utils.enfocables(contenedor)[0] ||
          contenedor;
        try { inicial.focus({ preventScroll: true }); } catch (err) { inicial.focus(); }
      });

      return function liberar() {
        document.removeEventListener('keydown', alTab, true);
        document.removeEventListener('focusin', alFocusIn, true);
        if (opciones.devolverFoco !== false && previo && previo.focus) {
          try { previo.focus({ preventScroll: true }); } catch (err) { previo.focus(); }
        }
      };
    },

    /* ---- Bloqueo de scroll con compensación de scrollbar --------------
       Al poner overflow:hidden desaparece la barra de scroll y TODO el
       layout salta ~15px a la derecha. Se compensa con padding-right igual
       al ancho de la barra. Es el detalle invisible clásico: nadie lo nota
       cuando está bien, todos lo notan cuando falta. ------------------ */
    _bloqueos: 0,
    _guardado: null,

    bloquearScroll: function () {
      if (utils._bloqueos++ > 0) return;

      var html = document.documentElement;
      var body = document.body;
      var ancho = window.innerWidth - html.clientWidth;

      utils._guardado = {
        overflow: body.style.overflow,
        paddingRight: body.style.paddingRight,
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
        scrollY: window.scrollY || window.pageYOffset || 0
      };

      // Se publica el ancho para que los elementos fixed (header, botón de
      // WhatsApp) puedan compensarse ellos también.
      html.style.setProperty('--ancho-scrollbar', ancho + 'px');

      if (ancho > 0) {
        var actual = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
        body.style.paddingRight = (actual + ancho) + 'px';
      }
      body.style.overflow = 'hidden';

      // iOS Safari ignora overflow:hidden en body. El truco de position:fixed
      // es el único que funciona; guardamos y restauramos el scroll para que
      // no salte al cerrar.
      if (utils._esIOS()) {
        body.style.position = 'fixed';
        body.style.top = (-utils._guardado.scrollY) + 'px';
        body.style.width = '100%';
      }
    },

    liberarScroll: function () {
      if (utils._bloqueos === 0) return;
      if (--utils._bloqueos > 0) return;

      var html = document.documentElement;
      var body = document.body;
      var g = utils._guardado || {};

      body.style.overflow = g.overflow || '';
      body.style.paddingRight = g.paddingRight || '';
      var eraIOS = body.style.position === 'fixed';
      body.style.position = g.position || '';
      body.style.top = g.top || '';
      body.style.width = g.width || '';
      html.style.setProperty('--ancho-scrollbar', '0px');

      if (eraIOS) {
        // Restauración instantánea: un scroll suave aquí se vería como un
        // salto raro justo después de cerrar el modal.
        var previo = html.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        window.scrollTo(0, g.scrollY || 0);
        html.style.scrollBehavior = previo;
      }
      utils._guardado = null;
    },

    _esIOS: function () {
      return /iP(hone|ad|od)/.test(window.navigator.platform || '') ||
        (window.navigator.userAgent.indexOf('Mac') > -1 && 'ontouchend' in document);
    },

    /** Fuerza un reflow. Necesario para que el navegador "vea" el estado
        inicial antes de transicionar al final. */
    reflow: function (el) { return el.offsetHeight; },

    /** Espera al final de una transición con salvavidas por si no llega. */
    alTerminar: function (el, cb, maxMs) {
      var hecho = false;
      function fin(e) {
        if (e && e.target !== el) return;
        if (hecho) return;
        hecho = true;
        el.removeEventListener('transitionend', fin);
        cb();
      }
      el.addEventListener('transitionend', fin);
      window.setTimeout(fin, maxMs || 600);
    },

    /** Genera ids únicos para enlazar aria-controls / aria-labelledby. */
    _n: 0,
    id: function (prefijo) { return (prefijo || 'lib') + '-' + (++utils._n) + '-' + Date.now().toString(36).slice(-4); }
  };

  /* ======================================================================
     1. ESTILOS DE LOS COMPONENTES
     Se inyectan desde JS para que cada módulo sea autosuficiente y funcione
     con doble clic desde disco (file://) sin depender de más <link>.
     ====================================================================== */

  utils.inyectar('lib-ui-estilos', [
    /* ---------------------------- TOASTS ---------------------------- */
    '.lib-toasts{position:fixed;z-index:var(--z-toast,800);width:min(384px,calc(100vw - 2rem));',
    '  list-style:none;margin:0;padding:0;pointer-events:none;}',
    '.lib-toasts[data-pos="abajo-derecha"]{right:1rem;bottom:1rem;}',
    '.lib-toasts[data-pos="abajo-izquierda"]{left:1rem;bottom:1rem;}',
    '.lib-toasts[data-pos="arriba-derecha"]{right:1rem;top:1rem;}',
    '.lib-toasts[data-pos="arriba-centro"]{left:50%;top:1rem;transform:translateX(-50%);}',
    '.lib-toast{position:absolute;left:0;right:0;pointer-events:auto;',
    '  display:flex;gap:.7rem;align-items:flex-start;',
    '  padding:.85rem .95rem;border-radius:var(--radio-md,12px);',
    '  background:var(--color-superficie,#fff);color:var(--color-texto,#17171a);',
    '  border:1px solid var(--color-borde,#e6e6ea);',
    '  box-shadow:var(--sombra-alta,0 12px 32px -8px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.06));',
    '  font-size:var(--txt-sm,.9rem);line-height:1.45;',
    /* transform con ease-out y 400ms: el recorrido es largo (entra desde
       fuera de pantalla) pero debe sentirse inmediato al arrancar.
       La opacidad va más corta para que no "fantasmee" al reacomodarse. */
    '  transition:transform 400ms var(--ease-out,cubic-bezier(.23,1,.32,1)),',
    '             opacity 250ms var(--ease-out,cubic-bezier(.23,1,.32,1));',
    '  will-change:transform,opacity;touch-action:pan-y;}',
    '.lib-toasts[data-pos^="abajo"] .lib-toast{bottom:0;transform-origin:bottom center;}',
    '.lib-toasts[data-pos^="arriba"] .lib-toast{top:0;transform-origin:top center;}',
    /* Mientras se arrastra la transición se apaga: el dedo manda 1:1. */
    '.lib-toast[data-arrastrando="true"]{transition:none;cursor:grabbing;}',
    '.lib-toast__icono{flex:0 0 auto;width:1.15rem;height:1.15rem;margin-top:.12rem;}',
    '.lib-toast__cuerpo{flex:1 1 auto;min-width:0;}',
    '.lib-toast__titulo{font-weight:600;}',
    '.lib-toast__desc{color:var(--color-texto-suave,#6b6b76);}',
    '.lib-toast__accion{flex:0 0 auto;align-self:center;font-size:var(--txt-xs,.78rem);font-weight:600;',
    '  padding:.35rem .6rem;border-radius:var(--radio-sm,8px);',
    '  background:var(--color-acento,#17171a);color:var(--color-sobre-acento,#fff);}',
    '.lib-toast__cerrar{flex:0 0 auto;width:1.4rem;height:1.4rem;border-radius:999px;',
    '  color:var(--color-texto-suave,#6b6b76);display:grid;place-items:center;',
    '  transition:background-color var(--dur-hover,180ms) ease,color var(--dur-hover,180ms) ease;}',
    '.lib-toast[data-tipo="exito"] .lib-toast__icono{color:var(--color-exito,#128a52);}',
    '.lib-toast[data-tipo="error"] .lib-toast__icono{color:var(--color-error,#c0392b);}',
    '.lib-toast[data-tipo="info"] .lib-toast__icono{color:var(--color-acento,#17171a);}',

    /* ---------------------------- MODAL ----------------------------- */
    '.lib-backdrop{position:fixed;inset:0;z-index:var(--z-modal,600);',
    '  background:var(--color-backdrop,rgba(16,16,20,.55));opacity:0;',
    '  transition:opacity var(--dur-modal,260ms) var(--ease-out,cubic-bezier(.23,1,.32,1));',
    '  display:grid;place-items:center;padding:1rem;overflow-y:auto;',
    '  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}',
    '.lib-backdrop[data-abierto="true"]{opacity:1;}',
    /* Salida más rápida que la entrada: el usuario ya decidió cerrar. */
    '.lib-backdrop[data-cerrando="true"]{transition-duration:var(--dur-modal-salida,180ms);}',
    '.lib-modal{position:relative;width:min(560px,100%);max-height:calc(100svh - 2rem);overflow:auto;',
    '  background:var(--color-superficie,#fff);color:var(--color-texto,#17171a);',
    '  border-radius:var(--radio-lg,16px);box-shadow:var(--sombra-alta,0 24px 60px -12px rgba(0,0,0,.3));',
    '  padding:clamp(1.25rem,1rem + 1.5vw,2rem);',
    /* transform-origin center: el modal NO está anclado a un trigger, a
       diferencia de un popover. Escala desde 0.96 (nunca desde 0: nada en
       el mundo real aparece de la nada) y sube 8px. */
    '  transform:scale(.96) translate3d(0,8px,0);opacity:0;transform-origin:center;',
    '  transition:transform var(--dur-modal,260ms) var(--ease-out,cubic-bezier(.23,1,.32,1)),',
    '             opacity var(--dur-modal,260ms) var(--ease-out,cubic-bezier(.23,1,.32,1));}',
    '.lib-backdrop[data-abierto="true"] .lib-modal{transform:scale(1) translate3d(0,0,0);opacity:1;}',
    /* Al salir baja apenas 4px y encoge menos: sugiere "se guarda", no "se
       va volando". Y dura 180ms, no 260ms. */
    '.lib-backdrop[data-cerrando="true"] .lib-modal{transform:scale(.98) translate3d(0,4px,0);opacity:0;',
    '  transition-duration:var(--dur-modal-salida,180ms);}',
    '.lib-modal__cerrar{position:absolute;top:.75rem;right:.75rem;width:2rem;height:2rem;',
    '  border-radius:999px;display:grid;place-items:center;color:var(--color-texto-suave,#6b6b76);',
    '  transition:background-color var(--dur-hover,180ms) ease,color var(--dur-hover,180ms) ease;}',
    '.lib-modal__titulo{font-size:var(--txt-lg,1.5rem);margin-bottom:.5rem;padding-right:2rem;}',

    /* ----------------------------- TABS ----------------------------- */
    '.lib-tabs__lista{position:relative;display:flex;gap:.25rem;overflow-x:auto;',
    '  scrollbar-width:none;border-bottom:1px solid var(--color-borde,#e6e6ea);}',
    '.lib-tabs__lista::-webkit-scrollbar{display:none;}',
    '.lib-tabs__lista [role="tab"]{position:relative;padding:.7rem 1rem;white-space:nowrap;',
    '  color:var(--color-texto-suave,#6b6b76);font-weight:500;',
    '  transition:color var(--dur-hover,180ms) ease,transform var(--dur-press,140ms) var(--ease-out,ease-out);}',
    '.lib-tabs__lista [role="tab"][aria-selected="true"]{color:var(--color-texto,#17171a);}',
    /* El indicador se mueve con translateX + scaleX (ancho base 1px): así
       solo se compositan transforms, sin tocar layout en cada frame.
       ease-in-out porque NO entra ni sale: ya está en pantalla y se desplaza
       de un punto a otro. */
    '.lib-tabs__indicador{position:absolute;left:0;bottom:-1px;width:1px;height:2px;',
    '  background:var(--color-acento,#17171a);transform-origin:left center;',
    '  transform:translate3d(0,0,0) scaleX(0);',
    '  transition:transform 260ms var(--ease-in-out,cubic-bezier(.77,0,.175,1));}',
    /* Activado con teclado = sin animación. Es una acción que se repite
       muchas veces al día y la animación la haría sentir lenta. */
    '.lib-tabs__indicador[data-instante="true"]{transition-duration:0ms;}',
    '.lib-tabs__panel{padding-top:1rem;opacity:1;transition:opacity 160ms var(--ease-out,ease-out);}',
    '.lib-tabs__panel[hidden]{display:none;}',
    '.lib-tabs__panel[data-entrando="true"]{opacity:0;}',

    /* --------------------------- ACORDEÓN --------------------------- */
    '[data-accordion-panel]{overflow:hidden;height:0;',
    /* La altura sí dispara layout: es la única propiedad que puede animar
       "abrirse". Se acota a un solo elemento y al terminar se libera a
       `auto` para que el contenido pueda crecer solo (imagen que carga,
       texto que se re-envuelve al rotar el teléfono). */
    '  transition:height 280ms var(--ease-in-out,cubic-bezier(.77,0,.175,1));}',
    '[data-accordion-panel][data-abierto="true"]{height:auto;}',
    '.lib-acordeon-inner{padding-bottom:1rem;}',
    '[data-accordion-trigger]{display:flex;width:100%;align-items:center;justify-content:space-between;',
    '  gap:1rem;text-align:left;padding:1rem 0;font-weight:600;}',
    '[data-accordion-trigger] .lib-acordeon-chevron{flex:0 0 auto;width:1rem;height:1rem;',
    '  transition:transform 280ms var(--ease-in-out,cubic-bezier(.77,0,.175,1));}',
    '[data-accordion-trigger][aria-expanded="true"] .lib-acordeon-chevron{transform:rotate(180deg);}',

    /* ---------------------------- MARQUEE --------------------------- */
    '.lib-marquee{display:flex;overflow:hidden;width:100%;',
    '  -webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);',
    '  mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);}',
    '.lib-marquee__grupo{display:flex;flex:0 0 auto;align-items:center;gap:var(--marquee-gap,2.5rem);',
    '  padding-right:var(--marquee-gap,2.5rem);',
    /* linear y solo linear: cualquier easing en un movimiento continuo se
       lee como un tirón cada vuelta. */
    '  animation:lib-marquee-mover var(--marquee-dur,28s) linear infinite;}',
    '@keyframes lib-marquee-mover{from{transform:translate3d(0,0,0)}to{transform:translate3d(-100%,0,0)}}',
    '@media (hover:hover) and (pointer:fine){',
    '  .lib-marquee:hover .lib-marquee__grupo{animation-play-state:paused;}}',
    '@media (prefers-reduced-motion:reduce){',
    '  .lib-marquee__grupo{animation:none!important;}',
    '  .lib-marquee{overflow-x:auto;}}',

    /* --------------------------- LIGHTBOX --------------------------- */
    '.lib-lightbox{position:fixed;inset:0;z-index:var(--z-lightbox,700);opacity:0;',
    '  background:rgba(10,10,12,.94);display:grid;grid-template-rows:auto 1fr auto;',
    '  transition:opacity 220ms var(--ease-out,cubic-bezier(.23,1,.32,1));}',
    '.lib-lightbox[data-abierto="true"]{opacity:1;}',
    '.lib-lightbox__figura{display:grid;place-items:center;padding:1rem;min-height:0;}',
    '.lib-lightbox__img{max-width:100%;max-height:100%;object-fit:contain;',
    '  border-radius:var(--radio-md,10px);opacity:1;transform:scale(1);',
    '  transition:opacity 200ms var(--ease-out,ease-out),transform 200ms var(--ease-out,ease-out);}',
    /* Al cambiar de foto no hay crossfade de dos imágenes superpuestas
       (se ve como dos objetos distintos): se apaga la actual con una escala
       mínima y se enciende la nueva. */
    '.lib-lightbox__img[data-cambiando="true"]{opacity:0;transform:scale(.985);}',
    '.lib-lightbox__barra{display:flex;align-items:center;justify-content:space-between;',
    '  gap:1rem;padding:1rem;color:#fff;font-size:var(--txt-sm,.9rem);}',
    '.lib-lightbox__nav{position:absolute;top:50%;transform:translateY(-50%);width:2.75rem;height:2.75rem;',
    '  border-radius:999px;display:grid;place-items:center;color:#fff;background:rgba(255,255,255,.1);',
    '  transition:background-color var(--dur-hover,180ms) ease;}',
    '.lib-lightbox__nav[data-dir="prev"]{left:1rem;} .lib-lightbox__nav[data-dir="next"]{right:1rem;}',
    '.lib-lightbox__nav:disabled{opacity:.3;cursor:default;}',
    '.lib-lightbox__pie{padding:1rem;color:rgba(255,255,255,.8);text-align:center;font-size:var(--txt-sm,.9rem);}',

    /* Hovers agrupados detrás de puntero fino: en táctil se quedan pegados
       después del tap y producen falsos estados activos. */
    '@media (hover:hover) and (pointer:fine){',
    '  .lib-toast__cerrar:hover{background:var(--color-fondo-alt,#f2f2f5);color:var(--color-texto,#17171a);}',
    '  .lib-modal__cerrar:hover{background:var(--color-fondo-alt,#f2f2f5);color:var(--color-texto,#17171a);}',
    '  .lib-tabs__lista [role="tab"]:hover{color:var(--color-texto,#17171a);}',
    '  .lib-lightbox__nav:hover:not(:disabled){background:rgba(255,255,255,.22);}}'
  ].join('\n'));

  /* ======================================================================
     2. TOAST — pila estilo Sonner
     ----------------------------------------------------------------------
     Por qué así:
     - Posición calculada por índice + transiciones CSS. Cuando entra un
       toast nuevo, todos recalculan su transform y la transición hace el
       "empujón" gratis. Con keyframes cada toast reiniciaría desde cero.
     - Colapsada: los de atrás se ven como una pila (offset chico + escala).
       Al hover se expande a alturas reales para poder leerlos y accionarlos.
     - El timer se pausa al hover Y cuando la pestaña se oculta: si el
       usuario cambia de pestaña, al volver el toast sigue ahí.
     - Swipe con velocidad (>0.11 px/ms) además de distancia: un flick corto
       y rápido debe bastar, no hay que arrastrar media pantalla.
     ====================================================================== */

  var Toast = (function () {
    var cfg = {
      posicion: 'abajo-derecha',
      duracion: 4200,
      max: 3,          // visibles a la vez
      tope: 6,         // en memoria; más allá se descarta el más viejo
      gapColapsado: 14,
      gapExpandido: 12,
      escala: 0.055,
      umbralVelocidad: 0.11 // px/ms
    };

    var contenedor = null;
    var toasts = [];      // [0] = el más nuevo (al frente)
    var expandido = false;
    var timerColapso = null;
    var contador = 0;

    var ICONOS = {
      exito: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="m6.5 10.2 2.4 2.4 4.6-5"/></svg>',
      error: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 6v5M10 14h.01"/></svg>',
      info: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6h.01"/></svg>'
    };
    ICONOS.aviso = ICONOS.info;

    function asegurarContenedor() {
      if (contenedor && document.body.contains(contenedor)) return contenedor;
      contenedor = utils.crear('ol', {
        class: 'lib-toasts',
        'data-pos': cfg.posicion,
        role: 'region',
        'aria-label': 'Notificaciones',
        tabindex: '-1'
      });
      document.body.appendChild(contenedor);

      // Delegación: los eventos burbujean desde el toast aunque el
      // contenedor tenga pointer-events:none.
      contenedor.addEventListener('mouseover', function () {
        if (!utils.tieneHover()) return;
        window.clearTimeout(timerColapso);
        if (!expandido) { expandido = true; reposicionar(); }
        pausarTodos();
      });
      contenedor.addEventListener('mouseout', function (e) {
        if (!utils.tieneHover()) return;
        if (e.relatedTarget && contenedor.contains(e.relatedTarget)) return;
        // Pequeña gracia antes de colapsar: sin esto, mover el mouse entre
        // dos toasts hace que la pila parpadee abriéndose y cerrándose.
        window.clearTimeout(timerColapso);
        timerColapso = window.setTimeout(function () {
          expandido = false; reposicionar(); reanudarTodos();
        }, 140);
      });

      return contenedor;
    }

    function esArriba() { return cfg.posicion.indexOf('arriba') === 0; }

    function reposicionar() {
      var signo = esArriba() ? 1 : -1;
      var acumulado = 0;

      for (var i = 0; i < toasts.length; i++) {
        var t = toasts[i];
        var visible = i < cfg.max;
        var y, escala;

        if (expandido) {
          // Expandida: cada toast se corre por la altura real de los que
          // tiene delante. translateY en px porque las alturas difieren.
          y = signo * acumulado;
          escala = 1;
          acumulado += t.el.offsetHeight + cfg.gapExpandido;
        } else {
          y = signo * (i * cfg.gapColapsado);
          escala = 1 - Math.min(i, cfg.max) * cfg.escala;
        }

        t.el.style.zIndex = String(1000 - i);
        t.el.style.opacity = visible || expandido ? '1' : '0';
        t.el.style.pointerEvents = visible || expandido ? 'auto' : 'none';

        if (!t.arrastrando) {
          t.el.style.transform = 'translate3d(0,' + y + 'px,0) scale(' + escala.toFixed(3) + ')';
        }
        t.y = y;
        t.escala = escala;
      }

      // El contenedor crece para que el área de hover cubra la pila entera.
      if (contenedor) {
        var alto = 0;
        for (var j = 0; j < toasts.length && j < cfg.max; j++) alto += toasts[j].el.offsetHeight + cfg.gapExpandido;
        contenedor.style.height = Math.max(alto, 0) + 'px';
      }
    }

    function pausar(t) {
      if (t.pausado || !t.duracion) return;
      t.pausado = true;
      window.clearTimeout(t.timer);
      t.restante -= (Date.now() - t.desde);
    }
    function reanudar(t) {
      if (!t.pausado || !t.duracion) return;
      t.pausado = false;
      t.desde = Date.now();
      t.timer = window.setTimeout(function () { descartar(t.id); }, Math.max(t.restante, 400));
    }
    function pausarTodos() { toasts.forEach(pausar); }
    function reanudarTodos() { if (!expandido && !document.hidden) toasts.forEach(reanudar); }

    // Edge case invisible: si la pestaña se oculta, el timer sigue corriendo
    // y el usuario vuelve a una pantalla vacía sin haber leído nada.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pausarTodos(); else reanudarTodos();
    });

    function salir(t, direccion) {
      if (t.saliendo) return;
      t.saliendo = true;
      window.clearTimeout(t.timer);

      var idx = toasts.indexOf(t);
      if (idx > -1) toasts.splice(idx, 1);

      t.el.setAttribute('data-arrastrando', 'false');
      // Salida más corta que la entrada (240ms vs 400ms).
      t.el.style.transition = 'transform 240ms var(--ease-out,cubic-bezier(.23,1,.32,1)),opacity 200ms var(--ease-out,cubic-bezier(.23,1,.32,1))';
      if (direccion) {
        // Se va por donde el usuario lo empujó: continuidad espacial.
        t.el.style.transform = 'translate3d(' + (direccion * 110) + '%,' + t.y + 'px,0) scale(1)';
      } else {
        // Sin gesto: se va por el mismo lado por el que entró.
        t.el.style.transform = 'translate3d(0,' + (esArriba() ? -110 : 110) + '%,0) scale(1)';
      }
      t.el.style.opacity = '0';

      utils.alTerminar(t.el, function () {
        if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
        if (typeof t.alCerrar === 'function') t.alCerrar();
      }, 400);

      reposicionar();
    }

    function descartar(id) {
      for (var i = 0; i < toasts.length; i++) {
        if (toasts[i].id === id) { salir(toasts[i], 0); return true; }
      }
      return false;
    }

    /* ---- Swipe para descartar ---------------------------------------
       Se usa velocidad además de distancia porque exigir un umbral fijo
       obliga a arrastrar de más. Damping en la dirección "equivocada":
       nada en la vida real se detiene de golpe contra un muro. */
    function conectarGesto(t) {
      var el = t.el;
      var puntero = null, x0 = 0, y0 = 0, t0 = 0, dx = 0, movido = false;

      el.addEventListener('pointerdown', function (e) {
        if (puntero !== null) return;              // multi-touch: se ignora el 2º dedo
        if (e.target.closest('[data-toast-accion]')) return;
        puntero = e.pointerId;
        x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); dx = 0; movido = false;
        try { el.setPointerCapture(puntero); } catch (err) {}
        pausar(t);
      });

      el.addEventListener('pointermove', function (e) {
        if (e.pointerId !== puntero) return;
        var ddx = e.clientX - x0;
        var ddy = e.clientY - y0;
        if (!movido) {
          if (Math.abs(ddx) < 4 && Math.abs(ddy) < 4) return;
          // Si el gesto arranca vertical, es scroll: soltamos el toast.
          if (Math.abs(ddy) > Math.abs(ddx)) { cancelar(); return; }
          movido = true;
          el.setAttribute('data-arrastrando', 'true');
          t.arrastrando = true;
        }
        dx = ddx;
        // Hacia la izquierda (contra el borde de la pantalla) hay
        // resistencia creciente en vez de tope seco.
        var visual = dx < 0 ? dx * 0.28 : dx;
        el.style.transform = 'translate3d(' + visual + 'px,' + t.y + 'px,0) scale(' + t.escala.toFixed(3) + ')';
        el.style.opacity = String(Math.max(0.25, 1 - Math.abs(visual) / (el.offsetWidth || 320)));
      });

      function cancelar() {
        if (puntero === null) return;
        try { el.releasePointerCapture(puntero); } catch (err) {}
        puntero = null;
        t.arrastrando = false;
        el.setAttribute('data-arrastrando', 'false');
        el.style.opacity = '1';
        reposicionar();
        reanudarTodos();
      }

      el.addEventListener('pointerup', function (e) {
        if (e.pointerId !== puntero) return;
        var dt = Math.max(Date.now() - t0, 1);
        var velocidad = Math.abs(dx) / dt;
        var ancho = el.offsetWidth || 320;
        var fuera = dx > ancho * 0.32 || (velocidad > cfg.umbralVelocidad && dx > 16);

        try { el.releasePointerCapture(puntero); } catch (err) {}
        puntero = null;
        t.arrastrando = false;
        el.setAttribute('data-arrastrando', 'false');

        if (fuera) { salir(t, 1); return; }
        if (!movido) { salir(t, 0); return; }  // clic simple = descartar
        // Snap-back rápido: el sistema responde, el usuario ya soltó.
        el.style.opacity = '1';
        reposicionar();
        reanudarTodos();
      });

      el.addEventListener('pointercancel', cancelar);
    }

    function mostrar(opciones) {
      if (typeof opciones === 'string') opciones = { mensaje: opciones };
      opciones = opciones || {};
      asegurarContenedor();

      var tipo = opciones.tipo || 'info';
      var id = 'toast-' + (++contador);
      var duracion = opciones.duracion === 0 ? 0 : (opciones.duracion || cfg.duracion);

      var cuerpo = utils.crear('div', { class: 'lib-toast__cuerpo' });
      if (opciones.titulo) cuerpo.appendChild(utils.crear('div', { class: 'lib-toast__titulo', text: opciones.titulo }));
      if (opciones.mensaje) cuerpo.appendChild(utils.crear('div', { class: 'lib-toast__desc', text: opciones.mensaje }));

      var el = utils.crear('li', {
        class: 'lib-toast',
        'data-tipo': tipo,
        // Los errores interrumpen (assertive); el resto se anuncia cuando el
        // lector de pantalla termina lo que está diciendo.
        role: tipo === 'error' ? 'alert' : 'status',
        'aria-live': tipo === 'error' ? 'assertive' : 'polite',
        'aria-atomic': 'true'
      }, [
        utils.crear('span', { class: 'lib-toast__icono', html: ICONOS[tipo] || ICONOS.info }),
        cuerpo
      ]);

      if (opciones.accion && opciones.accion.texto) {
        var btn = utils.crear('button', {
          class: 'lib-toast__accion', type: 'button', 'data-toast-accion': '', text: opciones.accion.texto
        });
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (typeof opciones.accion.onClick === 'function') opciones.accion.onClick();
          descartar(id);
        });
        el.appendChild(btn);
      } else {
        var cerrar = utils.crear('button', {
          class: 'lib-toast__cerrar', type: 'button', 'aria-label': 'Cerrar notificación',
          html: '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>'
        });
        cerrar.addEventListener('click', function (e) { e.stopPropagation(); descartar(id); });
        el.appendChild(cerrar);
      }

      var t = {
        id: id, el: el, duracion: duracion, restante: duracion,
        desde: Date.now(), pausado: false, arrastrando: false, saliendo: false,
        y: 0, escala: 1, alCerrar: opciones.alCerrar
      };

      // Estado inicial: fuera de pantalla por el lado de su posición. Entra
      // y sale por el mismo lado = consistencia espacial.
      el.style.transform = 'translate3d(0,' + (esArriba() ? -110 : 110) + '%,0) scale(1)';
      el.style.opacity = '0';

      contenedor.insertBefore(el, contenedor.firstChild);
      toasts.unshift(t);

      // Tope duro: más de N toasts en memoria es ruido, no información.
      while (toasts.length > cfg.tope) salir(toasts[toasts.length - 1], 0);

      conectarGesto(t);

      // Un frame para que el navegador registre el estado inicial; si no,
      // el toast aparece ya colocado y no hay entrada.
      utils.reflow(el);
      window.requestAnimationFrame(reposicionar);

      if (duracion > 0 && !document.hidden) {
        t.timer = window.setTimeout(function () { descartar(id); }, duracion);
      } else if (duracion > 0) {
        t.pausado = true;
      }

      return id;
    }

    return {
      mostrar: mostrar,
      exito: function (msg, o) { o = o || {}; o.mensaje = msg; o.tipo = 'exito'; return mostrar(o); },
      error: function (msg, o) { o = o || {}; o.mensaje = msg; o.tipo = 'error'; return mostrar(o); },
      info: function (msg, o) { o = o || {}; o.mensaje = msg; o.tipo = 'info'; return mostrar(o); },
      aviso: function (msg, o) { o = o || {}; o.mensaje = msg; o.tipo = 'aviso'; return mostrar(o); },
      descartar: descartar,
      limpiar: function () { toasts.slice().forEach(function (t) { salir(t, 0); }); },
      config: function (o) {
        for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) cfg[k] = o[k];
        if (contenedor) contenedor.setAttribute('data-pos', cfg.posicion);
        return cfg;
      }
    };
  })();

  /* ======================================================================
     3. MODAL
     ====================================================================== */

  var Modal = (function () {
    var abiertos = [];

    function Instancia(opciones) {
      this.o = opciones || {};
      this.abierto = false;
      this.backdrop = null;
      this.panel = null;
      this._liberarFoco = null;
      this._marcador = null;
      this._origen = null;
    }

    Instancia.prototype.construir = function () {
      var self = this;
      var o = this.o;
      var idTitulo = utils.id('modal-titulo');

      var panel = utils.crear('div', {
        class: 'lib-modal' + (o.clase ? ' ' + o.clase : ''),
        role: 'dialog',
        'aria-modal': 'true',
        tabindex: '-1'
      });
      if (o.ancho) panel.style.width = 'min(' + o.ancho + ',100%)';

      if (o.titulo) {
        panel.appendChild(utils.crear('h2', { class: 'lib-modal__titulo', id: idTitulo, text: o.titulo }));
        panel.setAttribute('aria-labelledby', idTitulo);
      } else if (o.etiqueta) {
        panel.setAttribute('aria-label', o.etiqueta);
      } else {
        panel.setAttribute('aria-label', 'Diálogo');
      }

      if (o.cerrable !== false) {
        var btn = utils.crear('button', {
          class: 'lib-modal__cerrar', type: 'button', 'aria-label': 'Cerrar',
          html: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>'
        });
        btn.addEventListener('click', function () { self.cerrar('boton'); });
        panel.appendChild(btn);
      }

      var contenido = o.contenido;
      if (typeof contenido === 'string') {
        panel.appendChild(utils.crear('div', { class: 'lib-modal__cuerpo', html: contenido }));
      } else if (contenido && contenido.nodeType === 1) {
        // El nodo original se MUEVE al modal y se deja un marcador para
        // devolverlo a su lugar al cerrar: así conserva sus listeners.
        this._origen = contenido;
        this._marcador = document.createComment('lib-modal');
        if (contenido.parentNode) contenido.parentNode.insertBefore(this._marcador, contenido);
        contenido.hidden = false;
        panel.appendChild(contenido);
      }

      var backdrop = utils.crear('div', { class: 'lib-backdrop' });
      backdrop.appendChild(panel);

      if (o.cerrarConBackdrop !== false) {
        backdrop.addEventListener('pointerdown', function (e) {
          // Solo si el press EMPIEZA en el backdrop: si el usuario arrastra
          // una selección de texto desde adentro y suelta afuera, no cierra.
          if (e.target === backdrop) self._presionoFondo = true;
        });
        backdrop.addEventListener('click', function (e) {
          if (e.target === backdrop && self._presionoFondo) self.cerrar('backdrop');
          self._presionoFondo = false;
        });
      }

      this.backdrop = backdrop;
      this.panel = panel;
      return panel;
    };

    Instancia.prototype.abrir = function () {
      if (this.abierto) return this;
      var self = this;
      this.abierto = true;

      if (!this.backdrop) this.construir();
      document.body.appendChild(this.backdrop);

      utils.bloquearScroll();
      abiertos.push(this);

      // Estado inicial ya está en CSS (opacity 0, scale .96). Un reflow y
      // el flag dispara la transición de entrada.
      utils.reflow(this.backdrop);
      this.backdrop.setAttribute('data-abierto', 'true');

      this._liberarFoco = utils.atraparFoco(this.panel, { inicial: this.o.focoInicial });

      this._onKey = function (e) {
        if (e.key !== 'Escape') return;
        // Solo el modal de más arriba responde a Escape.
        if (abiertos[abiertos.length - 1] !== self) return;
        e.stopPropagation();
        self.cerrar('escape');
      };
      document.addEventListener('keydown', this._onKey);

      if (typeof this.o.alAbrir === 'function') this.o.alAbrir(this);
      utils.emitir('modal:abrir', { modal: this });
      return this;
    };

    Instancia.prototype.cerrar = function (motivo) {
      if (!this.abierto) return this;
      var self = this;
      this.abierto = false;

      var i = abiertos.indexOf(this);
      if (i > -1) abiertos.splice(i, 1);

      document.removeEventListener('keydown', this._onKey);
      if (this._liberarFoco) { this._liberarFoco(); this._liberarFoco = null; }

      this.backdrop.setAttribute('data-cerrando', 'true');
      this.backdrop.removeAttribute('data-abierto');

      utils.alTerminar(this.backdrop, function () {
        self.backdrop.removeAttribute('data-cerrando');
        // Se devuelve el contenido prestado a su lugar original.
        if (self._origen && self._marcador && self._marcador.parentNode) {
          self._origen.hidden = true;
          self._marcador.parentNode.insertBefore(self._origen, self._marcador);
        }
        if (self.backdrop.parentNode) self.backdrop.parentNode.removeChild(self.backdrop);
        utils.liberarScroll();
        if (typeof self.o.alCerrar === 'function') self.o.alCerrar(motivo);
        utils.emitir('modal:cerrar', { modal: self, motivo: motivo });
      }, 400);

      return this;
    };

    Instancia.prototype.destruir = function () {
      if (this.abierto) this.cerrar('destruir');
      this.backdrop = null; this.panel = null;
    };

    function crear(opciones) { return new Instancia(opciones); }

    /** Atajo declarativo: <button data-modal-abrir="#mi-dialogo"> */
    function conectar(raiz) {
      (raiz || document).addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-modal-abrir]');
        if (!trigger) return;
        var sel = trigger.getAttribute('data-modal-abrir');
        var destino = document.querySelector(sel);
        if (!destino) return;
        e.preventDefault();
        if (!destino.__modal) {
          destino.__modal = crear({
            contenido: destino,
            titulo: destino.getAttribute('data-modal-titulo') || '',
            etiqueta: destino.getAttribute('aria-label') || 'Diálogo'
          });
        }
        destino.__modal.abrir();
      });
    }

    return { crear: crear, conectar: conectar, get abiertos() { return abiertos.slice(); } };
  })();

  /* ======================================================================
     4. TABS
     ====================================================================== */

  var Tabs = (function () {
    function init(raiz) {
      if (typeof raiz === 'string') raiz = document.querySelector(raiz);
      if (!raiz || raiz.__tabs) return raiz && raiz.__tabs;

      var lista = raiz.querySelector('[role="tablist"]') || raiz.querySelector('[data-tabs-lista]');
      if (!lista) return null;
      lista.classList.add('lib-tabs__lista');
      lista.setAttribute('role', 'tablist');

      var tabs = Array.prototype.slice.call(lista.querySelectorAll('[data-tab]'));
      var paneles = Array.prototype.slice.call(raiz.querySelectorAll('[data-tab-panel]'));
      if (!tabs.length) return null;

      var indicador = lista.querySelector('.lib-tabs__indicador');
      if (!indicador) {
        indicador = utils.crear('span', { class: 'lib-tabs__indicador', 'aria-hidden': 'true' });
        lista.appendChild(indicador);
      }

      var activo = 0;

      tabs.forEach(function (tab, i) {
        var clave = tab.getAttribute('data-tab');
        var panel = paneles.filter(function (p) { return p.getAttribute('data-tab-panel') === clave; })[0];
        var idTab = tab.id || utils.id('tab');
        var idPanel = panel ? (panel.id || utils.id('panel')) : null;

        tab.id = idTab;
        tab.setAttribute('role', 'tab');
        tab.setAttribute('type', 'button');
        if (panel) {
          panel.id = idPanel;
          panel.classList.add('lib-tabs__panel');
          panel.setAttribute('role', 'tabpanel');
          panel.setAttribute('aria-labelledby', idTab);
          // tabindex 0: si el panel no tiene nada enfocable, el usuario de
          // teclado igual puede llegar a leerlo.
          panel.setAttribute('tabindex', '0');
          tab.setAttribute('aria-controls', idPanel);
        }
        if (tab.getAttribute('aria-selected') === 'true') activo = i;
        tab.__panel = panel;
      });

      function medir(instante) {
        var tab = tabs[activo];
        if (!tab) return;
        var rl = lista.getBoundingClientRect();
        var rt = tab.getBoundingClientRect();
        // Posiciones REALES en px (incluye el scroll horizontal de la lista):
        // nada de suponer anchos iguales entre tabs.
        var x = rt.left - rl.left + lista.scrollLeft;
        indicador.setAttribute('data-instante', instante ? 'true' : 'false');
        indicador.style.transform = 'translate3d(' + x + 'px,0,0) scaleX(' + rt.width + ')';
        if (instante) {
          // Se devuelve a modo animado en el siguiente frame, para que el
          // próximo cambio con mouse sí se deslice.
          window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () { indicador.setAttribute('data-instante', 'false'); });
          });
        }
      }

      function activar(i, opciones) {
        opciones = opciones || {};
        if (i < 0 || i >= tabs.length) return;
        activo = i;

        tabs.forEach(function (tab, j) {
          var sel = j === i;
          tab.setAttribute('aria-selected', sel ? 'true' : 'false');
          // Roving tabindex: un solo tab en el orden de tabulación. Tab entra
          // al grupo, flechas navegan dentro. Es el patrón APG.
          tab.setAttribute('tabindex', sel ? '0' : '-1');
          if (tab.__panel) {
            if (sel) {
              tab.__panel.hidden = false;
              // Fade solo de opacidad (sin movimiento): el contenido no
              // "viaja", solo se sustituye.
              tab.__panel.setAttribute('data-entrando', 'true');
              utils.reflow(tab.__panel);
              window.requestAnimationFrame(function () { tab.__panel.setAttribute('data-entrando', 'false'); });
            } else {
              tab.__panel.hidden = true;
            }
          }
        });

        if (opciones.foco) tabs[i].focus();
        // Si el tab activo quedó fuera de la lista scrolleable, lo traemos.
        if (opciones.scroll !== false && lista.scrollWidth > lista.clientWidth) {
          tabs[i].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: utils.reducido() ? 'auto' : 'smooth' });
        }
        medir(!!opciones.instante);
        utils.emitir('tabs:cambio', { raiz: raiz, indice: i, clave: tabs[i].getAttribute('data-tab') }, raiz);
      }

      lista.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-tab]');
        if (!tab) return;
        var i = tabs.indexOf(tab);
        if (i > -1 && i !== activo) activar(i, { instante: false });
      });

      lista.addEventListener('keydown', function (e) {
        var mapa = { ArrowRight: 1, ArrowLeft: -1, Home: 'inicio', End: 'fin' };
        if (!(e.key in mapa)) return;
        e.preventDefault();
        var destino;
        if (mapa[e.key] === 'inicio') destino = 0;
        else if (mapa[e.key] === 'fin') destino = tabs.length - 1;
        else destino = (activo + mapa[e.key] + tabs.length) % tabs.length;
        // instante:true → el indicador NO se anima. Cambiar de tab con
        // teclado es una acción rápida y repetida: animarla la haría lenta.
        activar(destino, { foco: true, instante: true });
      });

      // El indicador depende de medidas reales: si cambia el ancho (rotar el
      // teléfono, cargar una fuente), hay que volver a medir o queda corrido.
      if ('ResizeObserver' in window) {
        new window.ResizeObserver(function () { medir(true); }).observe(lista);
      } else {
        window.addEventListener('resize', function () { medir(true); });
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { medir(true); });
      }
      lista.addEventListener('scroll', function () { medir(true); }, { passive: true });

      activar(activo, { instante: true, scroll: false });

      var api = { activar: activar, medir: medir, get indice() { return activo; } };
      raiz.__tabs = api;
      return api;
    }

    function conectar(raiz) {
      var nodos = (raiz || document).querySelectorAll('[data-tabs]');
      for (var i = 0; i < nodos.length; i++) init(nodos[i]);
    }

    return { init: init, conectar: conectar };
  })();

  /* ======================================================================
     5. ACCORDION
     ----------------------------------------------------------------------
     La animación de altura es la excepción justificada a "solo transform y
     opacity": es la única forma de que el contenido de abajo se recorra en
     lugar de saltar. Se mide scrollHeight, se anima a ese px exacto, y al
     terminar se libera a `auto` para que el panel siga siendo responsive.
     ====================================================================== */

  var Accordion = (function () {
    var CHEVRON = '<svg class="lib-acordeon-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';

    function init(raiz) {
      if (typeof raiz === 'string') raiz = document.querySelector(raiz);
      if (!raiz || raiz.__accordion) return raiz && raiz.__accordion;

      var unico = raiz.hasAttribute('data-accordion-single');
      var items = Array.prototype.slice.call(raiz.querySelectorAll('[data-accordion-item]'));

      items.forEach(function (item) {
        var trigger = item.querySelector('[data-accordion-trigger]');
        var panel = item.querySelector('[data-accordion-panel]');
        if (!trigger || !panel) return;

        var idT = trigger.id || utils.id('acc-t');
        var idP = panel.id || utils.id('acc-p');
        trigger.id = idT; panel.id = idP;
        trigger.setAttribute('type', 'button');
        trigger.setAttribute('aria-controls', idP);
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', idT);

        // Se envuelve el contenido: sin wrapper, el padding del panel se
        // recorta feo mientras la altura es 0.
        if (!panel.querySelector(':scope > .lib-acordeon-inner')) {
          var inner = utils.crear('div', { class: 'lib-acordeon-inner' });
          while (panel.firstChild) inner.appendChild(panel.firstChild);
          panel.appendChild(inner);
        }

        if (!trigger.querySelector('.lib-acordeon-chevron')) {
          trigger.insertAdjacentHTML('beforeend', CHEVRON);
        }

        var abierto = item.hasAttribute('data-abierto-inicial');
        trigger.setAttribute('aria-expanded', abierto ? 'true' : 'false');
        if (abierto) { panel.setAttribute('data-abierto', 'true'); }
        else { panel.style.height = '0px'; panel.hidden = false; }

        trigger.addEventListener('click', function () { alternar(item); });
        item.__panel = panel;
        item.__trigger = trigger;
      });

      function abrir(item) {
        var panel = item.__panel, trigger = item.__trigger;
        if (!panel || trigger.getAttribute('aria-expanded') === 'true') return;

        trigger.setAttribute('aria-expanded', 'true');
        panel.removeAttribute('data-abierto');
        panel.style.height = panel.scrollHeight + 'px';

        utils.alTerminar(panel, function () {
          // Liberar a `auto`: si el contenido crece después (una imagen que
          // termina de cargar) el panel se ajusta solo.
          if (trigger.getAttribute('aria-expanded') === 'true') {
            panel.style.height = '';
            panel.setAttribute('data-abierto', 'true');
          }
        }, 400);

        utils.emitir('accordion:abrir', { item: item }, raiz);
      }

      function cerrar(item) {
        var panel = item.__panel, trigger = item.__trigger;
        if (!panel || trigger.getAttribute('aria-expanded') !== 'true') return;

        trigger.setAttribute('aria-expanded', 'false');
        // De `auto` no se puede transicionar: primero se fija la altura
        // actual en px, se fuerza reflow, y recién ahí se va a 0.
        panel.removeAttribute('data-abierto');
        panel.style.height = panel.scrollHeight + 'px';
        utils.reflow(panel);
        window.requestAnimationFrame(function () { panel.style.height = '0px'; });

        utils.emitir('accordion:cerrar', { item: item }, raiz);
      }

      function alternar(item) {
        var esta = item.__trigger.getAttribute('aria-expanded') === 'true';
        if (unico && !esta) {
          items.forEach(function (otro) { if (otro !== item) cerrar(otro); });
        }
        if (esta) cerrar(item); else abrir(item);
      }

      var api = {
        abrir: function (i) { abrir(items[i]); },
        cerrar: function (i) { cerrar(items[i]); },
        alternar: function (i) { alternar(items[i]); },
        cerrarTodo: function () { items.forEach(cerrar); }
      };
      raiz.__accordion = api;
      return api;
    }

    function conectar(raiz) {
      var nodos = (raiz || document).querySelectorAll('[data-accordion]');
      for (var i = 0; i < nodos.length; i++) init(nodos[i]);
    }

    return { init: init, conectar: conectar };
  })();

  /* ======================================================================
     6. COUNTER
     ----------------------------------------------------------------------
     easeOutExpo: arranca disparado y frena al final. Es lo contrario a un
     contador lineal, que se siente una barra de progreso. Aquí el número
     "aterriza" en su valor final, que es el dato que importa.
     ====================================================================== */

  var Counter = (function () {
    var observer = null;

    function formatear(n, dec) {
      return new Intl.NumberFormat('es-MX', {
        minimumFractionDigits: dec, maximumFractionDigits: dec
      }).format(n);
    }

    function animar(el) {
      if (el.__contado) return;
      el.__contado = true;

      var destino = parseFloat(el.getAttribute('data-counter'));
      if (isNaN(destino)) return;
      var dec = parseInt(el.getAttribute('data-counter-decimales') || '0', 10) || 0;
      var pre = el.getAttribute('data-counter-prefijo') || '';
      var post = el.getAttribute('data-counter-sufijo') || '';
      var desde = parseFloat(el.getAttribute('data-counter-desde') || '0') || 0;
      var dur = parseInt(el.getAttribute('data-counter-duracion') || '1400', 10);

      // tabular-nums: sin esto el número "baila" horizontalmente en cada
      // frame porque el 1 es más angosto que el 8.
      el.style.fontVariantNumeric = 'tabular-nums';

      if (utils.reducido()) {
        el.textContent = pre + formatear(destino, dec) + post;
        return;
      }

      var t0 = null;
      function paso(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        var e = 1 - Math.pow(2, -10 * p);          // easeOutExpo
        if (p === 1) e = 1;
        el.textContent = pre + formatear(desde + (destino - desde) * e, dec) + post;
        if (p < 1) window.requestAnimationFrame(paso);
      }
      window.requestAnimationFrame(paso);
    }

    function conectar(raiz) {
      var nodos = (raiz || document).querySelectorAll('[data-counter]');
      if (!nodos.length) return;

      if (!('IntersectionObserver' in window)) {
        for (var k = 0; k < nodos.length; k++) animar(nodos[k]);
        return;
      }

      if (!observer) {
        observer = new window.IntersectionObserver(function (entradas) {
          entradas.forEach(function (en) {
            if (!en.isIntersecting) return;
            observer.unobserve(en.target);   // cuenta una sola vez
            animar(en.target);
          });
        }, { threshold: 0.4 });   // 40%: que el número esté claramente a la vista
      }
      for (var i = 0; i < nodos.length; i++) {
        var el = nodos[i];
        if (el.__contado) continue;
        // Valor inicial visible por si el observer no dispara nunca.
        if (!el.textContent.trim()) el.textContent = (el.getAttribute('data-counter-prefijo') || '') + '0' + (el.getAttribute('data-counter-sufijo') || '');
        observer.observe(el);
      }
    }

    return { conectar: conectar, animar: animar };
  })();

  /* ======================================================================
     7. MARQUEE
     ----------------------------------------------------------------------
     100% CSS: la animación corre fuera del main thread, así que sigue fluida
     aunque el navegador esté ocupado cargando imágenes. Con JS por frame
     perdería cuadros justo durante la carga, que es cuando más se nota.
     ====================================================================== */

  var Marquee = (function () {
    function init(el) {
      if (el.__marquee) return;
      el.__marquee = true;
      el.classList.add('lib-marquee');

      var grupo = utils.crear('div', { class: 'lib-marquee__grupo' });
      while (el.firstChild) grupo.appendChild(el.firstChild);
      el.appendChild(grupo);

      // El clon es puramente visual: aria-hidden para que el lector de
      // pantalla no lea el mismo contenido dos veces.
      var clon = grupo.cloneNode(true);
      clon.setAttribute('aria-hidden', 'true');
      el.appendChild(clon);

      function calcular() {
        var vel = parseFloat(el.getAttribute('data-marquee-velocidad') || '55'); // px/s
        var ancho = grupo.scrollWidth;
        if (!ancho || !vel) return;
        // La duración se deriva del ancho real: dos cintas con distinto
        // contenido se mueven a la MISMA velocidad, no en el mismo tiempo.
        el.style.setProperty('--marquee-dur', (ancho / vel).toFixed(2) + 's');
      }
      calcular();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(calcular);
      if ('ResizeObserver' in window) new window.ResizeObserver(calcular).observe(grupo);

      if (el.getAttribute('data-marquee-direccion') === 'derecha') {
        grupo.style.animationDirection = 'reverse';
        clon.style.animationDirection = 'reverse';
      }
    }

    function conectar(raiz) {
      var nodos = (raiz || document).querySelectorAll('[data-marquee]');
      for (var i = 0; i < nodos.length; i++) init(nodos[i]);
    }

    return { init: init, conectar: conectar };
  })();

  /* ======================================================================
     8. LIGHTBOX
     ====================================================================== */

  var Lightbox = (function () {
    var overlay = null, img = null, pie = null, cuenta = null;
    var btnPrev = null, btnNext = null;
    var items = [], indice = 0, liberarFoco = null, abierto = false;

    function construir() {
      if (overlay) return;

      img = utils.crear('img', { class: 'lib-lightbox__img', alt: '' });
      pie = utils.crear('figcaption', { class: 'lib-lightbox__pie' });
      cuenta = utils.crear('span', { class: 'lib-lightbox__cuenta', 'aria-live': 'polite' });

      var cerrar = utils.crear('button', {
        class: 'lib-lightbox__nav', type: 'button', 'aria-label': 'Cerrar galería',
        style: { position: 'static', transform: 'none' },
        html: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>'
      });
      cerrar.addEventListener('click', cerrarLb);

      btnPrev = utils.crear('button', {
        class: 'lib-lightbox__nav', 'data-dir': 'prev', type: 'button', 'aria-label': 'Imagen anterior',
        html: '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 3-5 5 5 5"/></svg>'
      });
      btnNext = utils.crear('button', {
        class: 'lib-lightbox__nav', 'data-dir': 'next', type: 'button', 'aria-label': 'Imagen siguiente',
        html: '<svg viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>'
      });
      btnPrev.addEventListener('click', function () { ir(indice - 1); });
      btnNext.addEventListener('click', function () { ir(indice + 1); });

      var figura = utils.crear('figure', { class: 'lib-lightbox__figura', style: { margin: '0', position: 'relative' } }, [img]);

      overlay = utils.crear('div', {
        class: 'lib-lightbox', role: 'dialog', 'aria-modal': 'true',
        'aria-label': 'Galería de imágenes', tabindex: '-1'
      }, [
        utils.crear('div', { class: 'lib-lightbox__barra' }, [cuenta, cerrar]),
        figura,
        pie
      ]);
      overlay.appendChild(btnPrev);
      overlay.appendChild(btnNext);

      overlay.addEventListener('click', function (e) {
        // Clic en el fondo cierra; sobre la imagen o los controles, no.
        if (e.target === overlay || e.target.classList.contains('lib-lightbox__figura')) cerrarLb();
      });

      conectarSwipe(overlay);
    }

    function conectarSwipe(el) {
      var pid = null, x0 = 0, y0 = 0, t0 = 0;
      el.addEventListener('pointerdown', function (e) {
        if (pid !== null) return;
        pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = Date.now();
      });
      el.addEventListener('pointerup', function (e) {
        if (e.pointerId !== pid) return;
        var dx = e.clientX - x0, dy = e.clientY - y0;
        var dt = Math.max(Date.now() - t0, 1);
        pid = null;
        if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;
        // Mismo criterio de velocidad que en los toasts: un flick basta.
        if (Math.abs(dx) / dt > 0.11 || Math.abs(dx) > 90) ir(indice + (dx < 0 ? 1 : -1));
      });
      el.addEventListener('pointercancel', function () { pid = null; });
    }

    function pintar() {
      var it = items[indice];
      if (!it) return;
      // Se apaga, se cambia el src, se enciende. Nunca dos imágenes
      // superpuestas: se leen como dos objetos distintos, no como una
      // transición.
      img.setAttribute('data-cambiando', 'true');
      window.setTimeout(function () {
        img.src = it.src;
        img.alt = it.alt || '';
        pie.textContent = it.caption || '';
        cuenta.textContent = (indice + 1) + ' de ' + items.length;
        btnPrev.disabled = indice === 0;
        btnNext.disabled = indice === items.length - 1;
        img.setAttribute('data-cambiando', 'false');
      }, utils.reducido() ? 0 : 190);
    }

    function ir(i) {
      if (i < 0 || i >= items.length || i === indice) return;
      indice = i;
      pintar();
    }

    function alKeydown(e) {
      if (!abierto) return;
      if (e.key === 'Escape') { e.preventDefault(); cerrarLb(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); ir(indice + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); ir(indice - 1); }
      else if (e.key === 'Home') { e.preventDefault(); ir(0); }
      else if (e.key === 'End') { e.preventDefault(); ir(items.length - 1); }
    }

    function abrirLb(lista, i) {
      construir();
      items = lista; indice = i || 0; abierto = true;
      document.body.appendChild(overlay);
      utils.bloquearScroll();
      img.removeAttribute('data-cambiando');
      var it = items[indice];
      img.src = it.src; img.alt = it.alt || '';
      pie.textContent = it.caption || '';
      cuenta.textContent = (indice + 1) + ' de ' + items.length;
      btnPrev.disabled = indice === 0;
      btnNext.disabled = indice === items.length - 1;

      utils.reflow(overlay);
      overlay.setAttribute('data-abierto', 'true');
      document.addEventListener('keydown', alKeydown);
      liberarFoco = utils.atraparFoco(overlay);
    }

    function cerrarLb() {
      if (!abierto) return;
      abierto = false;
      document.removeEventListener('keydown', alKeydown);
      if (liberarFoco) { liberarFoco(); liberarFoco = null; }
      overlay.removeAttribute('data-abierto');
      utils.alTerminar(overlay, function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        utils.liberarScroll();
      }, 400);
    }

    function leerItems(grupo) {
      var nodos = document.querySelectorAll('[data-lightbox="' + grupo + '"]');
      var out = [];
      for (var i = 0; i < nodos.length; i++) {
        var n = nodos[i];
        var im = n.tagName === 'IMG' ? n : n.querySelector('img');
        out.push({
          src: n.getAttribute('data-lightbox-src') || n.getAttribute('href') || (im && im.src),
          alt: n.getAttribute('data-lightbox-alt') || (im && im.alt) || '',
          caption: n.getAttribute('data-lightbox-caption') || '',
          nodo: n
        });
      }
      return out;
    }

    function conectar(raiz) {
      (raiz || document).addEventListener('click', function (e) {
        var trigger = e.target.closest('[data-lightbox]');
        if (!trigger) return;
        e.preventDefault();
        var grupo = trigger.getAttribute('data-lightbox');
        var lista = leerItems(grupo);
        var i = 0;
        for (var k = 0; k < lista.length; k++) if (lista[k].nodo === trigger) i = k;
        abrirLb(lista, i);
      });
    }

    return { conectar: conectar, abrir: abrirLb, cerrar: cerrarLb, ir: ir };
  })();

  /* ======================================================================
     9. Exportación y auto-init
     ====================================================================== */

  var UI = {
    utils: utils,
    Toast: Toast,
    Modal: Modal,
    Tabs: Tabs,
    Accordion: Accordion,
    Counter: Counter,
    Marquee: Marquee,
    Lightbox: Lightbox,

    /** Conecta todos los componentes declarativos de una raíz. */
    conectar: function (raiz) {
      Tabs.conectar(raiz);
      Accordion.conectar(raiz);
      Counter.conectar(raiz);
      Marquee.conectar(raiz);
      return UI;
    }
  };

  function arrancar() {
    UI.conectar(document);
    Modal.conectar(document);
    Lightbox.conectar(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancar);
  } else {
    arrancar();
  }

  window.UI = UI;
})(window, document);
