/* ==========================================================================
   reveal.js — Motor de scroll reveal
   --------------------------------------------------------------------------
   Por qué existe: al hacer scroll, el contenido que entra por primera vez se
   presenta en lugar de aparecer de golpe. Es una animación NARRATIVA (el
   usuario la ve una sola vez por elemento), por eso se permite que dure más
   que los 300ms de la UI operativa.

   Decisiones:
   - Un SOLO IntersectionObserver compartido para toda la página. N observers
     = N callbacks compitiendo por el main thread.
   - Cada elemento se deja de observar apenas se revela: no hay animación de
     salida, así que seguir observándolo es trabajo tirado a la basura.
   - `will-change` se aplica UN frame antes de animar y se retira al terminar.
     Dejarlo permanente crea una capa de composición por elemento y consume
     memoria de GPU en páginas largas.
   - Solo se animan transform y opacity (ver base.css para el detalle de las
     variantes `clip` y `blur`).
   - Con prefers-reduced-motion el motor no se enciende: ni siquiera se agrega
     la clase que oculta el contenido, así que todo nace visible.

   IMPORTANTE: cargar este archivo en el <head>. La clase `reveal-listo` se
   agrega en <html> de forma síncrona, antes del primer pintado, para que el
   contenido nazca oculto y no haya parpadeo. Si el JS falla, la clase nunca
   se agrega y el contenido queda visible: degradación correcta.
   ========================================================================== */
(function (window, document) {
  'use strict';

  var CLASE_LISTO = 'reveal-listo';
  var CLASE_VISIBLE = 'reveal-visible';
  var ATTR = 'data-reveal';

  var mqReducido = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: null };

  var config = {
    // -12% abajo: el elemento se revela cuando ya entró de verdad al campo
    // visual, no cuando asoma 1px. Arriba 0px para que lo que ya está en
    // pantalla al cargar se revele de inmediato.
    rootMargin: '0px 0px -12% 0px',
    threshold: 0,
    // Stagger por defecto entre hermanos. 30-80ms es el rango donde se lee
    // como cascada; por debajo no se nota, por encima se siente lento.
    stagger: 60,
    // Techo del delay acumulado: en una grilla de 20 tarjetas, el último
    // elemento no puede esperar 1.2s. Se recorta.
    staggerMax: 400,
    duracionSalvavidas: 1400 // ms para limpiar will-change si no llega transitionend
  };

  var observer = null;
  var iniciado = false;
  var reducido = !!mqReducido.matches;
  // WeakSet y no un atributo en el DOM: no ensucia el HTML y deja que el
  // recolector de basura se lleve los nodos que la página elimine.
  var registrados = new WeakSet();

  /* ---------------------------------------------------------------- utilidades */

  function esElemento(v) {
    return v && v.nodeType === 1;
  }

  function resolverRaiz(raiz) {
    if (!raiz) return document;
    if (typeof raiz === 'string') return document.querySelector(raiz) || document;
    return esElemento(raiz) ? raiz : document;
  }

  /* --------------------------------------------------------- limpieza de estado */

  // Retiramos will-change y el delay inline apenas termina la transición.
  // Dejar el transition-delay puesto contaminaría cualquier transición futura
  // del elemento (por ejemplo un hover), que arrancaría con retraso.
  function limpiar(el) {
    el.style.willChange = '';
    el.style.transitionDelay = '';
  }

  function programarLimpieza(el, delay) {
    var hecho = false;

    function alTerminar(e) {
      // Solo nos importa la transición del propio elemento, no la de un hijo.
      if (e && e.target !== el) return;
      if (hecho) return;
      hecho = true;
      el.removeEventListener('transitionend', alTerminar);
      limpiar(el);
    }

    el.addEventListener('transitionend', alTerminar);

    // Salvavidas: si la pestaña está oculta o la transición se cancela,
    // `transitionend` nunca llega y will-change quedaría vivo para siempre.
    window.setTimeout(alTerminar, config.duracionSalvavidas + (delay || 0));
  }

  /* ------------------------------------------------------------------- revelado */

  function revelar(el, delay) {
    if (el.classList.contains(CLASE_VISIBLE)) return;

    if (reducido) {
      el.classList.add(CLASE_VISIBLE);
      limpiar(el);
      return;
    }

    if (delay) el.style.transitionDelay = delay + 'ms';

    // Promoción a capa propia UN frame antes de animar. Si se pone y se
    // cambia la clase en el mismo frame, el navegador puede no alcanzar a
    // crear la capa y el primer frame se salta.
    el.style.willChange = 'transform, opacity';

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        el.classList.add(CLASE_VISIBLE);
        programarLimpieza(el, delay);
      });
    });
  }

  /* --------------------------------------------------------------- delay total */

  function calcularDelay(el) {
    // Delay explícito del propio elemento.
    var propio = parseInt(el.getAttribute('data-reveal-delay') || '0', 10);
    if (isNaN(propio)) propio = 0;

    // Delay heredado del contenedor con stagger. Se calcula al observar, no
    // en el callback, para que el orden de la cascada sea el orden del DOM y
    // no el orden azaroso en que el observer dispara.
    var deStagger = parseInt(el.getAttribute('data-reveal-stagger-delay') || '0', 10);
    if (isNaN(deStagger)) deStagger = 0;

    return propio + deStagger;
  }

  /* ------------------------------------------------------------------ observador */

  function alIntersectar(entradas) {
    for (var i = 0; i < entradas.length; i++) {
      var entrada = entradas[i];
      if (!entrada.isIntersecting) continue;

      var el = entrada.target;
      // Un elemento revelado no vuelve a esconderse: dejar de observarlo baja
      // el costo del observer en páginas con cientos de nodos.
      observer.unobserve(el);
      revelar(el, calcularDelay(el));
    }
  }

  function asegurarObserver() {
    if (observer) return observer;

    if (!('IntersectionObserver' in window)) {
      observer = null;
      return null;
    }

    observer = new window.IntersectionObserver(alIntersectar, {
      root: null,
      rootMargin: config.rootMargin,
      threshold: config.threshold
    });
    return observer;
  }

  /* ------------------------------------------------------------------- stagger */

  // Reparte delays entre los hijos revelables de un contenedor marcado con
  // data-reveal-stagger. El stagger es decorativo: nunca bloquea nada.
  function aplicarStagger(contenedor) {
    var valor = contenedor.getAttribute('data-reveal-stagger');
    var paso = parseInt(valor, 10);
    if (isNaN(paso) || paso < 0) paso = config.stagger;

    var techo = parseInt(contenedor.getAttribute('data-reveal-stagger-max') || '', 10);
    if (isNaN(techo)) techo = config.staggerMax;

    // Hijos directos con data-reveal. Si un hijo directo no lo tiene, se
    // buscan sus descendientes revelables (patrón típico: <ul><li><article
    // data-reveal>). Así el autor de la landing no tiene que aplanar su HTML.
    var hijos = [];
    var directos = contenedor.children;
    for (var i = 0; i < directos.length; i++) {
      var h = directos[i];
      if (h.hasAttribute(ATTR)) {
        hijos.push(h);
      } else {
        var interno = h.querySelector('[' + ATTR + ']');
        if (interno) hijos.push(interno);
      }
    }

    for (var j = 0; j < hijos.length; j++) {
      var d = Math.min(j * paso, techo);
      hijos[j].setAttribute('data-reveal-stagger-delay', String(d));
    }

    return hijos;
  }

  /* ------------------------------------------------------------------ registro */

  function observarElemento(el) {
    if (!esElemento(el)) return;
    if (registrados && registrados.has(el)) return;
    if (el.classList.contains(CLASE_VISIBLE)) return;

    if (registrados) registrados.add(el);

    if (reducido || !asegurarObserver()) {
      // Sin observer (navegador viejo) mostramos todo: es preferible ver el
      // contenido sin animación que no verlo.
      revelar(el, 0);
      return;
    }

    observer.observe(el);
  }

  /* ------------------------------------------------------------- API pública */

  var Reveal = {
    /**
     * Enciende el motor. Idempotente.
     * @param {Object} [opciones] rootMargin, threshold, stagger, staggerMax
     */
    init: function (opciones) {
      if (opciones) {
        for (var k in opciones) {
          if (Object.prototype.hasOwnProperty.call(opciones, k)) config[k] = opciones[k];
        }
      }

      if (iniciado) {
        Reveal.scan();
        return Reveal;
      }
      iniciado = true;

      if (reducido) {
        // Ni siquiera encendemos el motor: la clase no está en <html>, así
        // que el CSS nunca esconde nada. Cero trabajo, cero movimiento.
        return Reveal;
      }

      Reveal.scan();
      return Reveal;
    },

    /**
     * Busca y registra elementos nuevos. Llamar después de inyectar HTML.
     * @param {Element|string} [raiz]
     */
    scan: function (raiz) {
      var contexto = resolverRaiz(raiz);

      var contenedores = contexto.querySelectorAll('[data-reveal-stagger]');
      for (var i = 0; i < contenedores.length; i++) aplicarStagger(contenedores[i]);

      var elementos = contexto.querySelectorAll('[' + ATTR + ']');
      for (var j = 0; j < elementos.length; j++) observarElemento(elementos[j]);

      return Reveal;
    },

    /** Registra un elemento suelto. */
    observe: function (el) {
      if (typeof el === 'string') el = document.querySelector(el);
      observarElemento(el);
      return Reveal;
    },

    /** Revela ya mismo, sin esperar al scroll (útil para contenido del hero). */
    revelarAhora: function (el, delay) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!esElemento(el)) return Reveal;
      if (observer) observer.unobserve(el);
      revelar(el, delay || 0);
      return Reveal;
    },

    /** Vuelve un elemento a su estado oculto (para demos y re-plays). */
    reiniciar: function (el) {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!esElemento(el)) return Reveal;
      el.classList.remove(CLASE_VISIBLE);
      limpiar(el);
      if (registrados) registrados.delete(el);
      observarElemento(el);
      return Reveal;
    },

    /** Apaga el motor y muestra todo. */
    destroy: function () {
      if (observer) { observer.disconnect(); observer = null; }
      document.documentElement.classList.remove(CLASE_LISTO);
      iniciado = false;
      return Reveal;
    },

    get reducido() { return reducido; }
  };

  /* ------------------------------------------------- arranque síncrono en <head> */

  // Se agrega la clase ANTES del primer pintado: sin esto el contenido se
  // vería un frame y luego desaparecería (flash).
  if (!reducido) {
    document.documentElement.classList.add(CLASE_LISTO);
  }

  // Si el usuario cambia su preferencia de sistema en vivo, respondemos.
  if (mqReducido.addEventListener) {
    mqReducido.addEventListener('change', function (e) {
      reducido = e.matches;
      if (reducido) {
        document.documentElement.classList.remove(CLASE_LISTO);
        if (observer) { observer.disconnect(); observer = null; }
      } else {
        document.documentElement.classList.add(CLASE_LISTO);
      }
    });
  }

  // Auto-init al tener DOM. La landing puede llamar Reveal.init() antes con
  // sus propias opciones: init es idempotente.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Reveal.init(); });
  } else {
    Reveal.init();
  }

  window.Reveal = Reveal;
})(window, document);
