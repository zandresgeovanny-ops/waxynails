/* ==========================================================================
   cart.js — Carrito y pedido en línea (demo funcional)
   --------------------------------------------------------------------------
   REQUIERE ui.js cargado antes (usa UI.utils).
   Estado 100% en memoria: no se toca localStorage ni sessionStorage.

   API:
     Cart.init({telefonoWhatsApp, moneda, nombreNegocio, propinas,
                propinaDefault, onChange})
     Cart.agregar(producto, cantidad)   Cart.quitar(clave)
     Cart.cantidad(clave, n)            Cart.nota(clave, texto)
     Cart.limpiar()                     Cart.abrir() / cerrar() / alternar()
     Cart.estado()                      Cart.mensaje()   Cart.checkout()
     Cart.montarBadge(el)               Cart.conectar(raiz)

   Eventos en `document` (burbujean, la landing puede escucharlos):
     cart:add    detail {item, clave, cantidad, estado}
     cart:change detail {estado, motivo}
     cart:clear  detail {estado}

   CRITERIO DE ANIMACIÓN
   - El drawer usa --ease-drawer (cubic-bezier(.32,.72,0,1)), la curva del
     sistema iOS: sale disparado y se asienta sin rebote. Un drawer con
     `ease` o `linear` se siente una persiana; con bounce, se marea.
     Entrada 420ms (recorrido largo), salida 260ms (el usuario ya decidió).
   - El carrito NO se re-renderiza entero en cada cambio: se hace diff. Si se
     reconstruyera el DOM, cada clic en "+" reiniciaría todas las animaciones
     y perdería el foco del teclado.
   - El badge hace un pop corto (220ms) al cambiar: es la confirmación de que
     el producto entró. Se cancela la animación previa antes de relanzarla
     para que 5 clics rápidos no encolen 5 pops.
   - Las filas entran/salen animando altura + opacidad, para que las de abajo
     se recorran en vez de saltar.
   ========================================================================== */
(function (window, document) {
  'use strict';

  if (!window.UI || !window.UI.utils) {
    console.error('[cart] Falta ui.js. Orden correcto: ui.js → cart.js');
    return;
  }
  var U = window.UI.utils;

  /* ------------------------------------------------------------ estilos */

  U.inyectar('lib-cart-estilos', [
    '.lib-drawer-backdrop{position:fixed;inset:0;z-index:var(--z-drawer,500);',
    '  background:var(--color-backdrop,rgba(16,16,20,.5));opacity:0;',
    '  transition:opacity var(--dur-drawer,420ms) var(--ease-drawer,cubic-bezier(.32,.72,0,1));}',
    '.lib-drawer-backdrop[data-abierto="true"]{opacity:1;}',
    '.lib-drawer-backdrop[data-cerrando="true"]{transition-duration:var(--dur-drawer-salida,260ms);}',

    '.lib-drawer{position:fixed;top:0;right:0;bottom:0;z-index:calc(var(--z-drawer,500) + 1);',
    '  width:min(420px,100vw);display:flex;flex-direction:column;',
    '  background:var(--color-superficie,#fff);color:var(--color-texto,#17171a);',
    '  box-shadow:-24px 0 60px -20px rgba(0,0,0,.35);',
    /* 100% y no px: translateX en porcentaje es relativo al propio ancho del
       elemento, así funciona igual en móvil (100vw) que en escritorio. */
    '  transform:translate3d(100%,0,0);',
    '  transition:transform var(--dur-drawer,420ms) var(--ease-drawer,cubic-bezier(.32,.72,0,1));}',
    '.lib-drawer-backdrop[data-abierto="true"] .lib-drawer{transform:translate3d(0,0,0);}',
    '.lib-drawer-backdrop[data-cerrando="true"] .lib-drawer{transform:translate3d(100%,0,0);',
    '  transition-duration:var(--dur-drawer-salida,260ms);}',

    '.lib-drawer__head{display:flex;align-items:center;justify-content:space-between;gap:1rem;',
    '  padding:1.1rem 1.25rem;border-bottom:1px solid var(--color-borde,#e6e6ea);flex:0 0 auto;}',
    '.lib-drawer__titulo{font-size:var(--txt-md,1.15rem);font-weight:600;}',
    '.lib-drawer__cerrar{width:2.25rem;height:2.25rem;border-radius:999px;display:grid;place-items:center;',
    '  color:var(--color-texto-suave,#6b6b76);transition:background-color var(--dur-hover,180ms) ease;}',
    '.lib-drawer__cuerpo{flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding:.5rem 1.25rem;}',
    '.lib-drawer__pie{flex:0 0 auto;padding:1rem 1.25rem max(1rem,env(safe-area-inset-bottom));',
    '  border-top:1px solid var(--color-borde,#e6e6ea);background:var(--color-superficie,#fff);}',

    '.lib-cart-vacio{display:grid;place-items:center;gap:.6rem;text-align:center;',
    '  padding:3.5rem 1rem;color:var(--color-texto-suave,#6b6b76);}',

    '.lib-cart-item{overflow:hidden;}',
    '.lib-cart-item__caja{display:grid;grid-template-columns:auto 1fr auto;gap:.85rem;',
    '  padding:.9rem 0;border-bottom:1px solid var(--color-borde,#eeeef1);align-items:start;}',
    '.lib-cart-item__img{width:3.25rem;height:3.25rem;border-radius:var(--radio-md,10px);',
    '  object-fit:cover;background:var(--color-fondo-alt,#f3f3f6);}',
    '.lib-cart-item__nombre{font-weight:600;line-height:1.3;}',
    '.lib-cart-item__precio{color:var(--color-texto-suave,#6b6b76);font-size:var(--txt-sm,.9rem);}',
    '.lib-cart-item__nota{width:100%;margin-top:.45rem;padding:.4rem .55rem;font-size:var(--txt-xs,.8rem);',
    '  border:1px dashed var(--color-borde,#dcdce2);border-radius:var(--radio-sm,8px);',
    '  background:transparent;color:var(--color-texto,#17171a);resize:none;',
    '  transition:border-color var(--dur-hover,180ms) ease,background-color var(--dur-hover,180ms) ease;}',
    '.lib-cart-item__nota:focus{border-style:solid;border-color:var(--color-acento,#17171a);}',
    '.lib-cart-item__col{display:flex;flex-direction:column;align-items:flex-end;gap:.5rem;}',
    '.lib-cart-item__total{font-weight:600;font-variant-numeric:tabular-nums;}',

    '.lib-qty{display:inline-flex;align-items:center;gap:.15rem;border-radius:999px;',
    '  border:1px solid var(--color-borde,#e6e6ea);padding:.15rem;}',
    '.lib-qty button{width:1.75rem;height:1.75rem;border-radius:999px;display:grid;place-items:center;',
    '  font-size:1rem;line-height:1;color:var(--color-texto,#17171a);',
    '  transition:background-color var(--dur-hover,180ms) ease,transform var(--dur-press,140ms) var(--ease-out,ease-out);}',
    '.lib-qty output{min-width:1.6rem;text-align:center;font-variant-numeric:tabular-nums;font-weight:600;',
    '  font-size:var(--txt-sm,.9rem);}',

    '.lib-cart-linea{display:flex;justify-content:space-between;gap:1rem;padding:.2rem 0;',
    '  font-size:var(--txt-sm,.9rem);color:var(--color-texto-suave,#6b6b76);}',
    '.lib-cart-linea b{font-variant-numeric:tabular-nums;color:var(--color-texto,#17171a);font-weight:600;}',
    '.lib-cart-total{display:flex;justify-content:space-between;gap:1rem;align-items:baseline;',
    '  margin:.55rem 0 .85rem;font-size:var(--txt-md,1.15rem);font-weight:700;}',
    '.lib-cart-total span:last-child{font-variant-numeric:tabular-nums;}',

    '.lib-propinas{display:flex;gap:.4rem;margin:.4rem 0 .8rem;flex-wrap:wrap;}',
    '.lib-propina{padding:.35rem .75rem;border-radius:999px;font-size:var(--txt-xs,.8rem);font-weight:600;',
    '  border:1px solid var(--color-borde,#e6e6ea);color:var(--color-texto-suave,#6b6b76);',
    '  transition:background-color var(--dur-menu,220ms) var(--ease-out,ease-out),',
    '             color var(--dur-menu,220ms) var(--ease-out,ease-out),',
    '             border-color var(--dur-menu,220ms) var(--ease-out,ease-out),',
    '             transform var(--dur-press,140ms) var(--ease-out,ease-out);}',
    '.lib-propina[aria-checked="true"]{background:var(--color-acento,#17171a);',
    '  color:var(--color-sobre-acento,#fff);border-color:var(--color-acento,#17171a);}',

    '.lib-cart-cta{display:flex;width:100%;align-items:center;justify-content:center;gap:.5rem;',
    '  padding:.9rem 1rem;border-radius:var(--radio-md,12px);font-weight:600;',
    '  background:var(--color-acento,#17171a);color:var(--color-sobre-acento,#fff);',
    '  transition:filter var(--dur-hover,180ms) ease,transform var(--dur-press,140ms) var(--ease-out,ease-out);}',
    '.lib-cart-cta:disabled{opacity:.45;cursor:not-allowed;}',
    '.lib-cart-limpiar{display:block;width:100%;margin-top:.6rem;text-align:center;',
    '  font-size:var(--txt-xs,.8rem);color:var(--color-texto-suave,#6b6b76);text-decoration:underline;}',

    '.lib-badge{display:inline-grid;place-items:center;min-width:1.25rem;height:1.25rem;padding:0 .3rem;',
    '  border-radius:999px;font-size:.7rem;font-weight:700;line-height:1;',
    '  background:var(--color-acento,#17171a);color:var(--color-sobre-acento,#fff);',
    '  font-variant-numeric:tabular-nums;}',
    '.lib-badge[data-vacio="true"]{opacity:0;transform:scale(.6);}',
    '.lib-badge{transition:opacity 180ms var(--ease-out,ease-out),transform 180ms var(--ease-out,ease-out);}',

    '@media (hover:hover) and (pointer:fine){',
    '  .lib-drawer__cerrar:hover{background:var(--color-fondo-alt,#f2f2f5);}',
    '  .lib-qty button:hover{background:var(--color-fondo-alt,#f2f2f5);}',
    '  .lib-cart-cta:hover:not(:disabled){filter:brightness(1.12);}',
    '  .lib-propina:hover{border-color:var(--color-acento,#17171a);color:var(--color-texto,#17171a);}}'
  ].join('\n'));

  /* ------------------------------------------------------------- estado */

  var cfg = {
    telefonoWhatsApp: '',
    moneda: 'MXN',
    locale: 'es-MX',
    nombreNegocio: '',
    titulo: 'Tu pedido',
    textoCTA: 'Enviar pedido por WhatsApp',
    propinas: [0, 10, 15],
    propinaDefault: 0,
    permiteNotas: true,
    onChange: null
  };

  var items = [];          // [{clave, id, nombre, precio, cantidad, nota, imagen, variante}]
  var propinaPct = 0;
  var abierto = false;
  var iniciado = false;

  var backdrop = null, drawer = null, cuerpo = null, pie = null, tituloEl = null;
  var liberarFoco = null;
  var filas = {};          // clave → nodo, para hacer diff en vez de re-render
  var badges = [];

  /* ---------------------------------------------------------- cálculos */

  function money(n) { return U.moneda(n, { moneda: cfg.moneda, locale: cfg.locale }); }

  function subtotal() {
    return items.reduce(function (s, it) { return s + it.precio * it.cantidad; }, 0);
  }
  function propinaMonto() {
    return Math.round(subtotal() * (propinaPct / 100) * 100) / 100;
  }
  function total() { return subtotal() + propinaMonto(); }
  function contar() {
    return items.reduce(function (s, it) { return s + it.cantidad; }, 0);
  }

  function estado() {
    return {
      items: items.map(function (it) { return Object.assign({}, it); }),
      cantidad: contar(),
      subtotal: subtotal(),
      propinaPct: propinaPct,
      propina: propinaMonto(),
      total: total(),
      moneda: cfg.moneda
    };
  }

  function clave(prod) {
    // La variante entra en la clave: "Hamburguesa (sin queso)" y
    // "Hamburguesa" son dos renglones distintos del pedido, no uno con 2.
    return String(prod.id != null ? prod.id : prod.nombre) + (prod.variante ? '::' + prod.variante : '');
  }

  function buscar(k) {
    for (var i = 0; i < items.length; i++) if (items[i].clave === k) return items[i];
    return null;
  }

  /* ------------------------------------------------------------- badges */

  function pop(el) {
    if (U.reducido()) return;
    // WAAPI y no CSS animation: se puede cancelar la animación en curso.
    // Sin cancel, cinco clics seguidos encolan cinco pops y el badge
    // "tiembla" durante un segundo después de que el usuario ya paró.
    if (el.__anim) el.__anim.cancel();
    el.__anim = el.animate(
      [{ transform: 'scale(0.86)' }, { transform: 'scale(1.16)', offset: 0.55 }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'cubic-bezier(0.23,1,0.32,1)' }
    );
  }

  function pintarBadges() {
    var n = contar();
    badges.forEach(function (b) {
      var previo = b.textContent;
      b.textContent = String(n);
      b.setAttribute('data-vacio', n === 0 ? 'true' : 'false');
      b.setAttribute('aria-label', n === 1 ? '1 producto en el pedido' : n + ' productos en el pedido');
      if (previo !== String(n) && n > 0) pop(b);
    });
  }

  function montarBadge(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el || badges.indexOf(el) > -1) return;
    el.classList.add('lib-badge');
    // aria-live polite: el lector anuncia el nuevo total sin interrumpir.
    el.setAttribute('aria-live', 'polite');
    badges.push(el);
    pintarBadges();
  }

  /* ------------------------------------------------------- construcción */

  var SVG_CERRAR = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/></svg>';
  var SVG_BOLSA = '<svg viewBox="0 0 32 32" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10h18l-1.6 16H8.6L7 10Z"/><path d="M12 13V8a4 4 0 0 1 8 0v5"/></svg>';

  function construir() {
    backdrop = U.crear('div', { class: 'lib-drawer-backdrop', hidden: true });

    tituloEl = U.crear('h2', { class: 'lib-drawer__titulo', id: U.id('cart-titulo'), text: cfg.titulo });
    var btnCerrar = U.crear('button', {
      class: 'lib-drawer__cerrar', type: 'button', 'aria-label': 'Cerrar el pedido', html: SVG_CERRAR
    });
    btnCerrar.addEventListener('click', function () { cerrar('boton'); });

    cuerpo = U.crear('div', { class: 'lib-drawer__cuerpo' });
    pie = U.crear('div', { class: 'lib-drawer__pie' });

    drawer = U.crear('aside', {
      class: 'lib-drawer', role: 'dialog', 'aria-modal': 'true',
      'aria-labelledby': tituloEl.id, tabindex: '-1'
    }, [
      U.crear('div', { class: 'lib-drawer__head' }, [tituloEl, btnCerrar]),
      cuerpo,
      pie
    ]);

    backdrop.appendChild(drawer);
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) cerrar('backdrop');
    });

    document.body.appendChild(backdrop);
  }

  /* --------------------------------------------------------- filas (diff) */

  function crearFila(it) {
    var wrap = U.crear('li', { class: 'lib-cart-item', 'data-clave': it.clave });

    var img = it.imagen
      ? U.crear('img', { class: 'lib-cart-item__img', src: it.imagen, alt: '', loading: 'lazy' })
      : U.crear('div', { class: 'lib-cart-item__img' });

    var nombre = U.crear('div', { class: 'lib-cart-item__nombre', text: it.nombre });
    var precio = U.crear('div', { class: 'lib-cart-item__precio', text: money(it.precio) + ' c/u' + (it.variante ? ' · ' + it.variante : '') });
    var centro = U.crear('div', {}, [nombre, precio]);

    if (cfg.permiteNotas) {
      var nota = U.crear('textarea', {
        class: 'lib-cart-item__nota', rows: '1',
        placeholder: 'Nota para la cocina (opcional)',
        'aria-label': 'Nota para ' + it.nombre
      });
      nota.value = it.nota || '';
      nota.addEventListener('input', function () {
        var ref = buscar(it.clave);
        if (ref) ref.nota = nota.value;
        // La nota no cambia totales: se avisa sin repintar (repintar aquí
        // le quitaría el foco al usuario a media palabra).
        notificar('nota');
      });
      centro.appendChild(nota);
    }

    var menos = U.crear('button', { type: 'button', 'aria-label': 'Quitar uno de ' + it.nombre, text: '−' });
    var mas = U.crear('button', { type: 'button', 'aria-label': 'Agregar uno de ' + it.nombre, text: '+' });
    var out = U.crear('output', { class: 'lib-cart-qty-valor', text: String(it.cantidad) });
    menos.addEventListener('click', function () { cantidad(it.clave, buscar(it.clave).cantidad - 1); });
    mas.addEventListener('click', function () { cantidad(it.clave, buscar(it.clave).cantidad + 1); });

    var qty = U.crear('div', { class: 'lib-qty', role: 'group', 'aria-label': 'Cantidad de ' + it.nombre }, [menos, out, mas]);
    var totalLinea = U.crear('div', { class: 'lib-cart-item__total', text: money(it.precio * it.cantidad) });
    var col = U.crear('div', { class: 'lib-cart-item__col' }, [totalLinea, qty]);

    wrap.appendChild(U.crear('div', { class: 'lib-cart-item__caja' }, [img, centro, col]));

    wrap.__out = out;
    wrap.__total = totalLinea;
    return wrap;
  }

  function entrarFila(wrap) {
    if (U.reducido()) return;
    // De 0 a su altura real: las filas de abajo se recorren en lugar de
    // saltar de golpe. La altura se libera después para que la nota pueda
    // crecer si el usuario escribe varias líneas.
    var h = wrap.scrollHeight;
    wrap.style.height = '0px';
    wrap.style.opacity = '0';
    U.reflow(wrap);
    wrap.style.transition = 'height 260ms var(--ease-out,cubic-bezier(.23,1,.32,1)),opacity 200ms var(--ease-out,cubic-bezier(.23,1,.32,1))';
    window.requestAnimationFrame(function () {
      wrap.style.height = h + 'px';
      wrap.style.opacity = '1';
    });
    U.alTerminar(wrap, function () { wrap.style.height = ''; wrap.style.transition = ''; }, 400);
  }

  function salirFila(wrap, alTerminar) {
    if (U.reducido()) {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (alTerminar) alTerminar();
      return;
    }
    wrap.style.height = wrap.scrollHeight + 'px';
    U.reflow(wrap);
    // Salida más rápida que la entrada (200ms vs 260ms).
    wrap.style.transition = 'height 200ms var(--ease-in-out,cubic-bezier(.77,0,.175,1)),opacity 140ms var(--ease-out,ease-out)';
    window.requestAnimationFrame(function () {
      wrap.style.height = '0px';
      wrap.style.opacity = '0';
    });
    U.alTerminar(wrap, function () {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      if (alTerminar) alTerminar();
    }, 320);
  }

  /* ------------------------------------------------------------ pintado */

  function pintarCuerpo() {
    if (!cuerpo) return;

    var lista = cuerpo.querySelector('.lib-cart-lista');
    if (!lista) {
      lista = U.crear('ul', { class: 'lib-cart-lista', role: 'list', style: { listStyle: 'none', margin: '0', padding: '0' } });
      cuerpo.appendChild(lista);
    }

    // Estado vacío: la demo nunca debe verse "rota" sin datos.
    var vacio = cuerpo.querySelector('.lib-cart-vacio');
    if (!items.length) {
      if (!vacio) {
        vacio = U.crear('div', { class: 'lib-cart-vacio' }, [
          U.crear('span', { html: SVG_BOLSA, 'aria-hidden': 'true' }),
          U.crear('p', { text: 'Tu pedido está vacío.' }),
          U.crear('p', { style: { fontSize: '.85rem' }, text: 'Agrega algo del menú y aparecerá aquí.' })
        ]);
        cuerpo.appendChild(vacio);
      }
    } else if (vacio) {
      vacio.parentNode.removeChild(vacio);
    }

    // 1. Bajas
    Object.keys(filas).forEach(function (k) {
      if (buscar(k)) return;
      var nodo = filas[k];
      delete filas[k];
      salirFila(nodo);
    });

    // 2. Altas y actualizaciones
    items.forEach(function (it) {
      var nodo = filas[it.clave];
      if (!nodo) {
        nodo = crearFila(it);
        filas[it.clave] = nodo;
        lista.appendChild(nodo);
        entrarFila(nodo);
      } else {
        // Solo texto: no se toca la estructura, así el foco del teclado y el
        // cursor dentro del textarea de la nota se conservan.
        nodo.__out.textContent = String(it.cantidad);
        nodo.__total.textContent = money(it.precio * it.cantidad);
      }
    });
  }

  function pintarPie() {
    if (!pie) return;
    pie.textContent = '';

    var hay = items.length > 0;

    pie.appendChild(U.crear('div', { class: 'lib-cart-linea' }, [
      U.crear('span', { text: 'Subtotal' }),
      U.crear('b', { text: money(subtotal()) })
    ]));

    if (cfg.propinas && cfg.propinas.length) {
      var grupo = U.crear('div', {
        class: 'lib-propinas', role: 'radiogroup', 'aria-label': 'Propina'
      });
      cfg.propinas.forEach(function (p) {
        var b = U.crear('button', {
          class: 'lib-propina', type: 'button', role: 'radio',
          'aria-checked': p === propinaPct ? 'true' : 'false',
          tabindex: p === propinaPct ? '0' : '-1',
          text: p === 0 ? 'Sin propina' : p + '%'
        });
        b.addEventListener('click', function () { setPropina(p); });
        grupo.appendChild(b);
      });
      // Flechas dentro del grupo (patrón APG de radiogroup).
      grupo.addEventListener('keydown', function (e) {
        var paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
          : (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0);
        if (!paso) return;
        e.preventDefault();
        var i = cfg.propinas.indexOf(propinaPct);
        var sig = (i + paso + cfg.propinas.length) % cfg.propinas.length;
        setPropina(cfg.propinas[sig]);
        window.requestAnimationFrame(function () {
          var btns = pie.querySelectorAll('.lib-propina');
          if (btns[sig]) btns[sig].focus();
        });
      });
      pie.appendChild(grupo);

      if (propinaPct > 0) {
        pie.appendChild(U.crear('div', { class: 'lib-cart-linea' }, [
          U.crear('span', { text: 'Propina (' + propinaPct + '%)' }),
          U.crear('b', { text: money(propinaMonto()) })
        ]));
      }
    }

    pie.appendChild(U.crear('div', { class: 'lib-cart-total' }, [
      U.crear('span', { text: 'Total' }),
      U.crear('span', { text: money(total()) })
    ]));

    var cta = U.crear('button', {
      class: 'lib-cart-cta', type: 'button', text: cfg.textoCTA
    });
    cta.disabled = !hay;
    cta.addEventListener('click', function () { checkout(); });
    pie.appendChild(cta);

    if (hay) {
      var limpiarBtn = U.crear('button', { class: 'lib-cart-limpiar', type: 'button', text: 'Vaciar pedido' });
      limpiarBtn.addEventListener('click', function () { limpiar(); });
      pie.appendChild(limpiarBtn);
    }
  }

  function pintar() {
    pintarCuerpo();
    pintarPie();
    pintarBadges();
  }

  function notificar(motivo) {
    var e = estado();
    if (typeof cfg.onChange === 'function') cfg.onChange(e, motivo);
    U.emitir('cart:change', { estado: e, motivo: motivo });
  }

  /* ---------------------------------------------------------- mutaciones */

  function agregar(producto, cant) {
    if (!iniciado) { console.warn('[cart] Llama a Cart.init() antes de agregar.'); return null; }
    if (!producto) return null;

    var n = Math.max(1, parseInt(cant || 1, 10) || 1);
    var k = clave(producto);
    var existente = buscar(k);

    if (existente) {
      existente.cantidad += n;
    } else {
      existente = {
        clave: k,
        id: producto.id != null ? producto.id : producto.nombre,
        nombre: producto.nombre || 'Producto',
        precio: Number(producto.precio) || 0,
        cantidad: n,
        nota: producto.nota || '',
        imagen: producto.imagen || '',
        variante: producto.variante || ''
      };
      items.push(existente);
    }

    pintar();
    U.emitir('cart:add', { item: Object.assign({}, existente), clave: k, cantidad: n, estado: estado() });
    notificar('agregar');
    return k;
  }

  function cantidad(k, n) {
    var it = buscar(k);
    if (!it) return;
    n = parseInt(n, 10);
    if (isNaN(n) || n <= 0) { quitar(k); return; }
    // Tope defensivo: en una demo nadie pide 400 hamburguesas y un input
    // pegado con el dedo no debe romper el layout de totales.
    it.cantidad = Math.min(n, 99);
    pintar();
    notificar('cantidad');
  }

  function quitar(k) {
    var i = -1;
    for (var j = 0; j < items.length; j++) if (items[j].clave === k) i = j;
    if (i < 0) return;
    items.splice(i, 1);
    pintar();
    notificar('quitar');
  }

  function nota(k, texto) {
    var it = buscar(k);
    if (!it) return;
    it.nota = String(texto || '');
    var fila = filas[k];
    if (fila) {
      var ta = fila.querySelector('.lib-cart-item__nota');
      if (ta && ta.value !== it.nota) ta.value = it.nota;
    }
    notificar('nota');
  }

  function setPropina(p) {
    propinaPct = Number(p) || 0;
    pintarPie();
    notificar('propina');
  }

  function limpiar() {
    items = [];
    pintar();
    U.emitir('cart:clear', { estado: estado() });
    notificar('limpiar');
  }

  /* -------------------------------------------------------- abrir/cerrar */

  function abrir() {
    if (abierto || !backdrop) return;
    abierto = true;
    backdrop.hidden = false;
    U.bloquearScroll();
    U.reflow(backdrop);
    backdrop.setAttribute('data-abierto', 'true');
    liberarFoco = U.atraparFoco(drawer);

    document.addEventListener('keydown', alEscape);
    U.emitir('cart:abrir', { estado: estado() });
  }

  function alEscape(e) {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar('escape'); }
  }

  function cerrar(motivo) {
    if (!abierto) return;
    abierto = false;
    document.removeEventListener('keydown', alEscape);
    if (liberarFoco) { liberarFoco(); liberarFoco = null; }

    backdrop.setAttribute('data-cerrando', 'true');
    backdrop.removeAttribute('data-abierto');

    U.alTerminar(backdrop, function () {
      backdrop.removeAttribute('data-cerrando');
      backdrop.hidden = true;
      U.liberarScroll();
      U.emitir('cart:cerrar', { motivo: motivo });
    }, 600);
  }

  function alternar() { if (abierto) cerrar('toggle'); else abrir(); }

  /* ------------------------------------------------------------ checkout */

  function folio() {
    // Folio corto y legible por teléfono: sin ceros ni letras ambiguas.
    var abc = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    var s = '';
    for (var i = 0; i < 5; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
    return 'PD-' + s;
  }

  function mensaje(extra) {
    var f = (extra && extra.folio) || folio();
    var lineas = [];
    var negocio = cfg.nombreNegocio ? ' ' + cfg.nombreNegocio : '';

    lineas.push('Hola' + negocio + ', quiero hacer este pedido:');
    lineas.push('');
    items.forEach(function (it) {
      lineas.push('• ' + it.cantidad + '× ' + it.nombre +
        (it.variante ? ' (' + it.variante + ')' : '') +
        ' — ' + money(it.precio * it.cantidad));
      if (it.nota) lineas.push('   ↳ ' + it.nota);
    });
    lineas.push('');
    lineas.push('Subtotal: ' + money(subtotal()));
    if (propinaPct > 0) lineas.push('Propina (' + propinaPct + '%): ' + money(propinaMonto()));
    lineas.push('Total: ' + money(total()));
    lineas.push('');
    lineas.push('Folio: ' + f);
    if (extra && extra.nota) { lineas.push(''); lineas.push(extra.nota); }

    return { texto: lineas.join('\n'), folio: f };
  }

  function checkout(extra) {
    if (!items.length) return null;
    var m = mensaje(extra);

    var url;
    if (window.WhatsApp) {
      url = window.WhatsApp.link(cfg.telefonoWhatsApp, m.texto);
    } else {
      url = 'https://wa.me/' + String(cfg.telefonoWhatsApp).replace(/\D+/g, '') + '?text=' + encodeURIComponent(m.texto);
    }

    U.emitir('cart:checkout', { estado: estado(), folio: m.folio, mensaje: m.texto, url: url });

    var w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) window.location.href = url;

    if (window.UI && window.UI.Toast) {
      window.UI.Toast.exito('Se abrió WhatsApp con tu pedido.', { titulo: 'Folio ' + m.folio });
    }
    return { url: url, folio: m.folio, mensaje: m.texto };
  }

  /* ---------------------------------------------------- enlace declarativo */

  /**
   * Conecta atributos del HTML sin escribir JS en la landing:
   *   [data-cart-add]  con data-id / data-nombre / data-precio / data-imagen
   *   [data-cart-abrir]  abre el drawer
   *   [data-cart-badge]  muestra el contador
   *   [data-cart-total]  muestra el total en texto
   */
  function conectar(raiz) {
    raiz = raiz || document;

    var b = raiz.querySelectorAll('[data-cart-badge]');
    for (var i = 0; i < b.length; i++) montarBadge(b[i]);

    // Delegación en document: sirve también para productos inyectados
    // después (filtros del menú, "cargar más").
    if (!conectar.__delegado) {
      conectar.__delegado = true;

      document.addEventListener('click', function (e) {
        var add = e.target.closest('[data-cart-add]');
        if (add) {
          e.preventDefault();
          agregar({
            id: add.getAttribute('data-id') || add.getAttribute('data-cart-add'),
            nombre: add.getAttribute('data-nombre') || '',
            precio: parseFloat(add.getAttribute('data-precio') || '0'),
            imagen: add.getAttribute('data-imagen') || '',
            variante: add.getAttribute('data-variante') || ''
          }, parseInt(add.getAttribute('data-cantidad') || '1', 10));

          if (add.hasAttribute('data-cart-abrir-al-agregar')) abrir();
          return;
        }
        var open = e.target.closest('[data-cart-abrir]');
        if (open) { e.preventDefault(); abrir(); }
      });
    }
  }

  /* ---------------------------------------------------------------- init */

  function init(opciones) {
    for (var k in opciones) {
      if (Object.prototype.hasOwnProperty.call(opciones, k)) cfg[k] = opciones[k];
    }
    if (cfg.propinaDefault) propinaPct = cfg.propinaDefault;

    if (!iniciado) {
      iniciado = true;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { construir(); pintar(); conectar(document); });
      } else {
        construir(); pintar(); conectar(document);
      }
    } else if (tituloEl) {
      tituloEl.textContent = cfg.titulo;
      pintar();
    }
    return Cart;
  }

  var Cart = {
    init: init,
    agregar: agregar,
    quitar: quitar,
    cantidad: cantidad,
    nota: nota,
    propina: setPropina,
    limpiar: limpiar,
    abrir: abrir,
    cerrar: cerrar,
    alternar: alternar,
    estado: estado,
    contar: contar,
    mensaje: mensaje,
    checkout: checkout,
    montarBadge: montarBadge,
    conectar: conectar,
    get config() { return Object.assign({}, cfg); }
  };

  window.Cart = Cart;
})(window, document);
