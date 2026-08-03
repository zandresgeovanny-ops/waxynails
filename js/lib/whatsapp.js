/* ==========================================================================
   whatsapp.js — Links wa.me + botón flotante
   --------------------------------------------------------------------------
   Expone window.WhatsApp con:
     limpiar(num)      → solo dígitos
     normalizar(num)   → '52' + 10 dígitos (formato que exige wa.me)
     esValido(num)     → bool
     formato(num)      → '+52 449 123 4567' para mostrar
     link(num, msg)    → 'https://wa.me/52...?text=...'
     abrir(num, msg)   → abre en pestaña nueva
     boton(config)     → botón flotante con tooltip que se asoma una vez
     conectar()        → enlaces declarativos [data-wa]

   CRITERIO DE ANIMACIÓN
   - El botón NO está desde el inicio: aparecería compitiendo con el hero.
     Entra después de cierto scroll, con la escala y el desplazamiento que
     usaría un objeto que sube desde abajo. Entrada 320ms ease-out.
   - El tooltip se asoma UNA SOLA VEZ, unos segundos después de que el botón
     ya está en pantalla, y se retrae solo. Es una invitación, no un anuncio:
     si volviera a salir cada tanto se volvería publicidad y molestaría.
   - Al salir, el botón se va más rápido que como entró (220ms).
   - Sin storage: la bandera de "ya se mostró" vive en memoria del módulo.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var LADA_PAIS = '52';        // México
  var LARGO_NACIONAL = 10;     // 3 de lada + 7, o 2 + 8 según la ciudad

  /* --------------------------------------------------------- normalización */

  function limpiar(num) {
    return String(num === null || num === undefined ? '' : num).replace(/\D+/g, '');
  }

  /**
   * Devuelve el número en el formato que wa.me acepta: código de país
   * pegado, sin '+', sin espacios, sin el viejo '1' de México.
   *
   * Casos que resuelve:
   *   '4491234567'          → '524491234567'
   *   '+52 449 123 4567'    → '524491234567'
   *   '52 1 449 123 4567'   → '524491234567'  (el '1' era del WhatsApp viejo)
   *   '00 52 449...'        → '524491234567'  (prefijo internacional europeo)
   */
  function normalizar(num) {
    var d = limpiar(num);
    if (!d) return '';

    // Prefijo internacional 00
    if (d.indexOf('00') === 0) d = d.slice(2);

    // Ya viene con lada de país
    if (d.length > LARGO_NACIONAL && d.indexOf(LADA_PAIS) === 0) {
      var resto = d.slice(LADA_PAIS.length);
      // '521XXXXXXXXXX': el 1 intermedio es un residuo del formato antiguo
      // de WhatsApp México. Hoy sobra y rompe el link.
      if (resto.length === LARGO_NACIONAL + 1 && resto.charAt(0) === '1') resto = resto.slice(1);
      if (resto.length === LARGO_NACIONAL) return LADA_PAIS + resto;
    }

    // Número nacional pelón
    if (d.length === LARGO_NACIONAL) return LADA_PAIS + d;

    // 11 dígitos empezando con 1 (formato viejo sin lada de país)
    if (d.length === LARGO_NACIONAL + 1 && d.charAt(0) === '1') return LADA_PAIS + d.slice(1);

    // Otro país: se respeta tal cual si tiene largo plausible (E.164).
    if (d.length >= 8 && d.length <= 15) return d;

    return '';
  }

  function esValido(num) {
    var n = normalizar(num);
    if (!n) return false;
    if (n.indexOf(LADA_PAIS) === 0 && n.length === LADA_PAIS.length + LARGO_NACIONAL) return true;
    return n.length >= 10 && n.length <= 15;
  }

  /** '+52 449 123 4567' — agrupado como lo lee un mexicano. */
  function formato(num) {
    var n = normalizar(num);
    if (!n) return '';
    if (n.indexOf(LADA_PAIS) === 0 && n.length === 12) {
      var nac = n.slice(2);
      return '+52 ' + nac.slice(0, 3) + ' ' + nac.slice(3, 6) + ' ' + nac.slice(6);
    }
    return '+' + n;
  }

  /** '449 123 4567' — sin lada de país, para mostrar junto a un ícono. */
  function formatoCorto(num) {
    var n = normalizar(num);
    if (!n) return '';
    var nac = n.indexOf(LADA_PAIS) === 0 && n.length === 12 ? n.slice(2) : n;
    if (nac.length !== 10) return nac;
    return nac.slice(0, 3) + ' ' + nac.slice(3, 6) + ' ' + nac.slice(6);
  }

  /* ---------------------------------------------------------------- links */

  /**
   * encodeURIComponent y no encodeURI: hay que escapar &, #, + y ? porque si
   * no, el mensaje se corta en el primer & y llega la mitad. Los saltos de
   * línea quedan como %0A, que WhatsApp respeta y renderiza como enter.
   */
  function link(num, mensaje) {
    var n = normalizar(num);
    var base = 'https://wa.me/' + n;
    if (!mensaje) return base;
    return base + '?text=' + encodeURIComponent(String(mensaje));
  }

  function abrir(num, mensaje) {
    var url = link(num, mensaje);
    // noopener: sin esto la pestaña de WhatsApp puede manipular la nuestra.
    var w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) window.location.href = url;   // popup bloqueado: navegación directa
    return url;
  }

  /* ------------------------------------------------------- botón flotante */

  var ESTILOS = [
    '.lib-wa{position:fixed;right:max(1rem,env(safe-area-inset-right));',
    '  bottom:max(1rem,env(safe-area-inset-bottom));z-index:var(--z-wa,400);',
    '  display:flex;align-items:center;gap:.5rem;flex-direction:row-reverse;',
    '  pointer-events:none;}',
    '.lib-wa__btn{pointer-events:auto;width:3.5rem;height:3.5rem;border-radius:999px;',
    '  display:grid;place-items:center;color:#fff;background:var(--color-whatsapp,#25d366);',
    '  box-shadow:0 10px 26px -6px rgba(37,211,102,.55),0 2px 6px rgba(0,0,0,.18);',
    /* Estado oculto: baja 12px y encoge a .82 (nunca a 0). Solo transform y
       opacity: se compositan en GPU y no disparan layout mientras el usuario
       hace scroll, que es justo cuando esto se dispara. */
    '  opacity:0;transform:translate3d(0,12px,0) scale(.82);',
    '  transition:opacity 320ms var(--ease-out,cubic-bezier(.23,1,.32,1)),',
    '             transform 320ms var(--ease-out,cubic-bezier(.23,1,.32,1)),',
    '             box-shadow var(--dur-hover,180ms) ease;}',
    '.lib-wa[data-visible="true"] .lib-wa__btn{opacity:1;transform:translate3d(0,0,0) scale(1);}',
    /* Salida más rápida: el usuario volvió arriba, ya no lo necesita. */
    '.lib-wa[data-visible="false"] .lib-wa__btn{transition-duration:220ms;}',
    '.lib-wa__btn:active{transform:translate3d(0,0,0) scale(.94);}',
    '.lib-wa__globo{pointer-events:auto;max-width:min(62vw,15rem);',
    '  padding:.55rem .8rem;border-radius:var(--radio-md,12px);',
    '  background:var(--color-superficie,#fff);color:var(--color-texto,#17171a);',
    '  border:1px solid var(--color-borde,#e6e6ea);',
    '  box-shadow:var(--sombra-media,0 10px 24px -8px rgba(0,0,0,.18));',
    '  font-size:var(--txt-sm,.875rem);line-height:1.35;white-space:normal;',
    /* transform-origin a la derecha: el globo pertenece al botón, así que
       crece DESDE el botón. Si escalara desde el centro se leería como un
       elemento suelto que no tiene nada que ver. */
    '  transform-origin:right center;opacity:0;transform:translate3d(8px,0,0) scale(.92);',
    '  transition:opacity 220ms var(--ease-out,cubic-bezier(.23,1,.32,1)),',
    '             transform 220ms var(--ease-out,cubic-bezier(.23,1,.32,1));}',
    '.lib-wa[data-globo="true"] .lib-wa__globo{opacity:1;transform:translate3d(0,0,0) scale(1);}',
    '.lib-wa__globo-cerrar{margin-left:.4rem;color:var(--color-texto-suave,#6b6b76);font-weight:600;}',
    '@media (hover:hover) and (pointer:fine){',
    '  .lib-wa__btn:hover{box-shadow:0 14px 34px -6px rgba(37,211,102,.7),0 3px 8px rgba(0,0,0,.2);}}',
    '@media (prefers-reduced-motion:reduce){',
    '  .lib-wa__btn,.lib-wa__globo{transform:none!important;}}',
    '@media print{.lib-wa{display:none!important;}}'
  ].join('\n');

  var ICONO_WA = '<svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor" aria-hidden="true">' +
    '<path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.35.69 4.54 1.87 6.39L4 29l7.76-1.82a12 12 0 0 0 4.28.79h.01c6.63 0 12.03-5.4 12.03-12.04C28.08 8.4 22.68 3 16.04 3Zm0 21.94h-.01c-1.3 0-2.58-.35-3.7-1.01l-.26-.16-4.6 1.08 1.1-4.49-.17-.28a9.9 9.9 0 0 1-1.52-5.28c0-5.47 4.45-9.92 9.93-9.92 2.65 0 5.15 1.04 7.02 2.91a9.86 9.86 0 0 1 2.9 7.02c0 5.47-4.45 9.93-9.93 9.93Zm5.45-7.44c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/></svg>';

  var botonCreado = null;

  function inyectarEstilos() {
    if (document.getElementById('lib-wa-estilos')) return;
    var st = document.createElement('style');
    st.id = 'lib-wa-estilos';
    st.textContent = ESTILOS;
    document.head.appendChild(st);
  }

  /**
   * Botón flotante de WhatsApp.
   * @param {Object} cfg
   *  telefono        {string}  requerido
   *  mensaje         {string}  mensaje pre-llenado
   *  apareceEn       {number}  px de scroll para aparecer (default 520)
   *  apareceDespuesDe{string}  selector: aparece al pasar ese elemento
   *  tooltip         {string}  texto del globo (vacío = sin globo)
   *  tooltipEn       {number}  ms tras hacerse visible (default 4500)
   *  tooltipDura     {number}  ms que se queda (default 6000)
   *  etiqueta        {string}  aria-label
   */
  function boton(cfg) {
    cfg = cfg || {};
    if (!cfg.telefono) {
      console.warn('[whatsapp] boton() requiere `telefono`.');
      return null;
    }
    if (botonCreado) return botonCreado;

    inyectarEstilos();

    var umbral = typeof cfg.apareceEn === 'number' ? cfg.apareceEn : 520;
    var textoTooltip = cfg.tooltip || '';
    var tooltipEn = typeof cfg.tooltipEn === 'number' ? cfg.tooltipEn : 4500;
    var tooltipDura = typeof cfg.tooltipDura === 'number' ? cfg.tooltipDura : 6000;

    // Bandera EN MEMORIA (nada de storage): el globo se asoma una sola vez
    // por carga de página.
    var tooltipYaSalio = false;
    var visible = false;

    var contenedor = document.createElement('div');
    contenedor.className = 'lib-wa';
    contenedor.setAttribute('data-visible', 'false');

    var enlace = document.createElement('a');
    enlace.className = 'lib-wa__btn';
    enlace.href = link(cfg.telefono, cfg.mensaje);
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    enlace.setAttribute('aria-label', cfg.etiqueta || 'Escribir por WhatsApp');
    enlace.innerHTML = ICONO_WA;
    // Mientras está oculto no debe ser alcanzable con Tab: un foco invisible
    // deja al usuario de teclado sin saber dónde está parado.
    enlace.setAttribute('tabindex', '-1');
    enlace.setAttribute('aria-hidden', 'true');
    contenedor.appendChild(enlace);

    var globo = null;
    var globoTexto = null;
    if (textoTooltip) {
      globo = document.createElement('div');
      globo.className = 'lib-wa__globo';
      globo.setAttribute('role', 'status');
      globoTexto = document.createElement('span');
      globoTexto.className = 'lib-wa__globo-texto';
      globoTexto.textContent = textoTooltip;
      globo.appendChild(globoTexto);
      var cerrarGlobo = document.createElement('button');
      cerrarGlobo.type = 'button';
      cerrarGlobo.className = 'lib-wa__globo-cerrar';
      cerrarGlobo.setAttribute('aria-label', 'Ocultar mensaje');
      cerrarGlobo.textContent = '×';
      cerrarGlobo.addEventListener('click', function () { ocultarGlobo(); });
      globo.appendChild(cerrarGlobo);
      contenedor.appendChild(globo);
    }

    document.body.appendChild(contenedor);

    function mostrarGlobo() {
      if (!globo || tooltipYaSalio || !visible) return;
      tooltipYaSalio = true;
      contenedor.setAttribute('data-globo', 'true');
      window.setTimeout(ocultarGlobo, tooltipDura);
    }
    function ocultarGlobo() {
      if (!globo) return;
      contenedor.setAttribute('data-globo', 'false');
    }

    function setVisible(v) {
      if (v === visible) return;
      visible = v;
      contenedor.setAttribute('data-visible', v ? 'true' : 'false');
      enlace.setAttribute('tabindex', v ? '0' : '-1');
      if (v) enlace.removeAttribute('aria-hidden');
      else enlace.setAttribute('aria-hidden', 'true');

      if (v && globo && !tooltipYaSalio) {
        window.setTimeout(mostrarGlobo, tooltipEn);
      } else if (!v) {
        ocultarGlobo();
      }
    }

    // Referencia opcional: aparecer al pasar un elemento (típicamente el
    // hero). Es más confiable que un número mágico de px porque el alto del
    // hero cambia entre móvil y escritorio.
    var ref = cfg.apareceDespuesDe ? document.querySelector(cfg.apareceDespuesDe) : null;

    var pendiente = false;
    function evaluar() {
      pendiente = false;
      var y = window.scrollY || window.pageYOffset || 0;
      if (ref) {
        var r = ref.getBoundingClientRect();
        setVisible(r.bottom < 40);
      } else {
        setVisible(y > umbral);
      }
    }
    function alScroll() {
      // Throttle con rAF: el listener de scroll dispara decenas de veces por
      // segundo y leer scrollY/getBoundingClientRect fuerza layout.
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(evaluar);
    }

    window.addEventListener('scroll', alScroll, { passive: true });
    window.addEventListener('resize', alScroll, { passive: true });
    evaluar();

    botonCreado = {
      el: contenedor,
      enlace: enlace,
      actualizarMensaje: function (msg) { enlace.href = link(cfg.telefono, msg); },
      mostrarGlobo: function (texto) {
        if (!globo) return;
        if (texto && globoTexto) globoTexto.textContent = texto;
        // Se rearma la bandera a propósito: esto es una llamada explícita de
        // la landing (ej. "el carrito lleva 10 min sin cerrarse"), no el
        // asomo automático de una sola vez.
        tooltipYaSalio = false;
        mostrarGlobo();
      },
      destruir: function () {
        window.removeEventListener('scroll', alScroll);
        window.removeEventListener('resize', alScroll);
        if (contenedor.parentNode) contenedor.parentNode.removeChild(contenedor);
        botonCreado = null;
      }
    };
    return botonCreado;
  }

  /* -------------------------------------------------- enlaces declarativos */

  /**
   * Convierte en links de WhatsApp cualquier <a data-wa="telefono"
   * data-wa-mensaje="texto">. Se resuelve al hacer clic y no al cargar, para
   * que el mensaje pueda depender del estado del momento.
   */
  function conectar(raiz) {
    var nodos = (raiz || document).querySelectorAll('[data-wa]');
    for (var i = 0; i < nodos.length; i++) {
      var n = nodos[i];
      var tel = n.getAttribute('data-wa');
      var msg = n.getAttribute('data-wa-mensaje') || '';
      if (n.tagName === 'A') {
        n.href = link(tel, msg);
        n.target = '_blank';
        n.rel = 'noopener noreferrer';
      } else {
        (function (nodo, t, m) {
          nodo.addEventListener('click', function () { abrir(t, m); });
        })(n, tel, msg);
      }
    }
  }

  var WhatsApp = {
    limpiar: limpiar,
    normalizar: normalizar,
    esValido: esValido,
    formato: formato,
    formatoCorto: formatoCorto,
    link: link,
    abrir: abrir,
    boton: boton,
    conectar: conectar
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { conectar(document); });
  } else {
    conectar(document);
  }

  window.WhatsApp = WhatsApp;
})(window, document);
