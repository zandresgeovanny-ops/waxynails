/* ==========================================================================
   booking.js — Motor de reservas / citas (demo funcional)
   --------------------------------------------------------------------------
   REQUIERE ui.js cargado antes (usa UI.utils). whatsapp.js es opcional:
   si está, se usa para armar el link; si no, hay un fallback interno.

   Estado 100% en memoria. Cero localStorage, cero fetch, cero dependencias.
   Funciona abriendo el index.html con doble clic (file://).

   API:
     Booking.init({
       mount,               // selector o elemento donde se monta
       servicios,           // [{id, nombre, categoria, duracion_min, precio_mxn, descripcion}]
       horario,             // {0..6: null | {abre:'10:00', cierra:'20:30'}}  0=domingo
       diasCerrados,        // ['2026-08-15', ...] fechas específicas cerradas
       intervalo,           // minutos entre slots (default 30)
       telefonoWhatsApp,    // '524491033082'
       nombreNegocio,
       ocupacion,           // 0..1, qué tan lleno se simula (default .35)
       onConfirm            // fn(reserva)
     })
     Booking.ir(paso)        Booking.reset()      Booking.estado()
     Booking.preseleccionar(idServicio)           Booking.mensaje()

   Eventos en `document`:
     booking:step    detail {paso, anterior, estado}
     booking:select  detail {campo, valor, estado}
     booking:confirm detail {reserva}

   CRITERIO DE ANIMACIÓN (Emil Kowalski)
   - Los pasos se mueven en el eje X con dirección: avanzar entra por la
     derecha, retroceder por la izquierda. Si ambos entraran igual, el usuario
     perdería el sentido de "dónde está" dentro del flujo. 320ms con
     cubic-bezier(.32,.72,0,1): sale rápido y se asienta, sin rebote.
   - La altura del contenedor se anima al cambiar de paso (los pasos miden
     distinto). Sin eso, la página daría un salto y el botón se movería debajo
     del dedo del usuario.
   - Selección de servicio/slot: 120ms. Es feedback de clic, no una transición.
     Cualquier cosa arriba de ~150ms en un clic directo se siente laggy.
   - Cambio de mes del calendario: 220ms deslizando en X. Corto porque el
     usuario suele hacer varios clics seguidos y no debe encolarse.
   - La palomita final se dibuja en 520ms: es el único momento del flujo donde
     vale la pena que la animación tarde, porque comunica "terminaste".
   - Todo se neutraliza bajo prefers-reduced-motion.
   ========================================================================== */
(function (window, document) {
  'use strict';

  if (!window.UI || !window.UI.utils) {
    console.error('[booking] Falta ui.js. Orden correcto: ui.js → booking.js');
    return;
  }
  var U = window.UI.utils;

  var DIAS_CORTO = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* ------------------------------------------------------------ estilos */

  U.inyectar('lib-booking-estilos', [
    /* --- contenedor --- */
    '.bk{position:relative;--bk-acento:var(--color-acento,#111);}',
    '.bk__barra{display:flex;gap:2px;margin-bottom:var(--esp-5,2rem);}',
    '.bk__barra-item{flex:1;height:3px;border-radius:99px;background:var(--color-borde,#e6e2dd);',
    '  position:relative;overflow:hidden;}',
    '.bk__barra-item::after{content:"";position:absolute;inset:0;background:var(--bk-acento);',
    '  transform:scaleX(0);transform-origin:left;',
    /* 400ms ease-out: la barra es información periférica, no debe competir
       por atención con el contenido que acaba de entrar. */
    '  transition:transform 400ms var(--ease-out,cubic-bezier(.16,1,.3,1));}',
    '.bk__barra-item[data-hecho="true"]::after{transform:scaleX(1);}',

    '.bk__pasos{position:relative;overflow:hidden;',
    '  transition:height 320ms var(--ease-drawer,cubic-bezier(.32,.72,0,1));}',
    '.bk__paso{position:absolute;top:0;left:0;width:100%;}',
    '.bk__paso[data-activo="true"]{position:relative;}',
    '.bk__paso[data-anim="entra-der"]{animation:bkEntraDer 320ms var(--ease-drawer,cubic-bezier(.32,.72,0,1)) both;}',
    '.bk__paso[data-anim="entra-izq"]{animation:bkEntraIzq 320ms var(--ease-drawer,cubic-bezier(.32,.72,0,1)) both;}',
    '.bk__paso[data-anim="sale-der"]{animation:bkSaleDer 260ms var(--ease-drawer,cubic-bezier(.32,.72,0,1)) both;}',
    '.bk__paso[data-anim="sale-izq"]{animation:bkSaleIzq 260ms var(--ease-drawer,cubic-bezier(.32,.72,0,1)) both;}',
    '@keyframes bkEntraDer{from{opacity:0;transform:translate3d(24px,0,0)}to{opacity:1;transform:none}}',
    '@keyframes bkEntraIzq{from{opacity:0;transform:translate3d(-24px,0,0)}to{opacity:1;transform:none}}',
    '@keyframes bkSaleDer{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(24px,0,0)}}',
    '@keyframes bkSaleIzq{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(-24px,0,0)}}',

    '.bk__titulo{font-family:var(--fuente-titulos,inherit);font-size:var(--txt-lg,1.25rem);',
    '  margin:0 0 .25rem;line-height:1.2;}',
    '.bk__ayuda{color:var(--color-texto-suave,#6b6660);font-size:var(--txt-sm,.875rem);',
    '  margin:0 0 var(--esp-4,1.5rem);}',

    /* --- paso 1: servicios --- */
    '.bk__cats{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:var(--esp-3,1rem);}',
    '.bk__cat{border:1px solid var(--color-borde,#e6e2dd);background:none;cursor:pointer;',
    '  border-radius:99px;padding:.4rem .9rem;font:inherit;font-size:var(--txt-xs,.8rem);',
    '  color:var(--color-texto-suave,#6b6660);',
    '  transition:color 120ms linear,border-color 120ms linear,background-color 120ms linear;}',
    '.bk__cat[aria-pressed="true"]{background:var(--bk-acento);border-color:var(--bk-acento);',
    '  color:var(--color-sobre-acento,#fff);}',

    '.bk__lista{display:grid;gap:.5rem;max-height:min(46vh,420px);overflow-y:auto;',
    '  padding-right:.25rem;scrollbar-width:thin;}',
    '.bk__servicio{display:flex;align-items:flex-start;gap:.85rem;width:100%;text-align:left;',
    '  cursor:pointer;font:inherit;padding:.85rem 1rem;border-radius:var(--radio-md,12px);',
    '  border:1px solid var(--color-borde,#e6e2dd);background:var(--color-superficie,#fff);',
    '  transition:border-color 120ms linear,background-color 120ms linear,transform 120ms var(--ease-out,ease);}',
    '.bk__servicio:hover{border-color:var(--color-texto-suave,#9a948c);}',
    /* El press de 0.99 confirma el toque en móvil, donde no hay hover.
       Menos que eso no se percibe; más, se siente elástico. */
    '.bk__servicio:active{transform:scale(.99);}',
    '.bk__servicio[aria-pressed="true"]{border-color:var(--bk-acento);',
    '  background:color-mix(in srgb,var(--bk-acento) 6%,transparent);}',
    '.bk__servicio-check{flex:0 0 18px;width:18px;height:18px;margin-top:.15rem;border-radius:50%;',
    '  border:1.5px solid var(--color-borde,#d8d3cc);position:relative;',
    '  transition:border-color 120ms linear,background-color 120ms linear;}',
    '.bk__servicio[aria-pressed="true"] .bk__servicio-check{background:var(--bk-acento);border-color:var(--bk-acento);}',
    '.bk__servicio-check::after{content:"";position:absolute;left:5px;top:2px;width:5px;height:9px;',
    '  border:solid var(--color-sobre-acento,#fff);border-width:0 2px 2px 0;transform:rotate(45deg) scale(0);',
    '  transition:transform 160ms var(--ease-spring,cubic-bezier(.34,1.56,.64,1));}',
    '.bk__servicio[aria-pressed="true"] .bk__servicio-check::after{transform:rotate(45deg) scale(1);}',
    '.bk__servicio-cuerpo{flex:1;min-width:0;}',
    '.bk__servicio-nombre{font-weight:600;line-height:1.3;}',
    '.bk__servicio-desc{font-size:var(--txt-xs,.8rem);color:var(--color-texto-suave,#6b6660);',
    '  margin-top:.15rem;line-height:1.4;}',
    '.bk__servicio-meta{flex:0 0 auto;text-align:right;font-size:var(--txt-sm,.875rem);}',
    '.bk__servicio-precio{font-weight:600;font-variant-numeric:tabular-nums;}',
    '.bk__servicio-dur{font-size:var(--txt-xs,.8rem);color:var(--color-texto-suave,#6b6660);}',

    /* --- paso 2: calendario --- */
    '.bk__cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;}',
    '.bk__cal-mes{font-weight:600;text-transform:capitalize;font-variant-numeric:tabular-nums;}',
    '.bk__icon-btn{width:34px;height:34px;display:grid;place-items:center;cursor:pointer;',
    '  border-radius:50%;border:1px solid var(--color-borde,#e6e2dd);background:none;color:inherit;',
    '  transition:background-color 120ms linear,opacity 120ms linear;}',
    '.bk__icon-btn:hover:not(:disabled){background:var(--color-fondo-alt,#f6f3ef);}',
    '.bk__icon-btn:disabled{opacity:.3;cursor:not-allowed;}',
    '.bk__cal-viewport{overflow:hidden;}',
    '.bk__cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}',
    '.bk__cal-grid[data-anim="der"]{animation:bkEntraDer 220ms var(--ease-out,ease) both;}',
    '.bk__cal-grid[data-anim="izq"]{animation:bkEntraIzq 220ms var(--ease-out,ease) both;}',
    '.bk__cal-dow{text-align:center;font-size:var(--txt-xs,.75rem);padding:.35rem 0;',
    '  color:var(--color-texto-suave,#9a948c);font-weight:600;}',
    '.bk__dia{aspect-ratio:1;display:grid;place-items:center;cursor:pointer;font:inherit;',
    '  font-size:var(--txt-sm,.875rem);font-variant-numeric:tabular-nums;border:0;background:none;',
    '  color:inherit;border-radius:var(--radio-sm,8px);position:relative;',
    '  transition:background-color 120ms linear,color 120ms linear;}',
    '.bk__dia:hover:not(:disabled){background:var(--color-fondo-alt,#f6f3ef);}',
    '.bk__dia:disabled{color:var(--color-borde,#d8d3cc);cursor:not-allowed;}',
    '.bk__dia[aria-pressed="true"]{background:var(--bk-acento);color:var(--color-sobre-acento,#fff);}',
    '.bk__dia--hoy::after{content:"";position:absolute;bottom:5px;width:3px;height:3px;border-radius:50%;',
    '  background:currentColor;opacity:.6;}',
    '.bk__dia--vacio{visibility:hidden;}',

    /* --- paso 3: horas --- */
    '.bk__franja{margin-bottom:1.1rem;}',
    '.bk__franja-tit{font-size:var(--txt-xs,.75rem);text-transform:uppercase;letter-spacing:.08em;',
    '  color:var(--color-texto-suave,#9a948c);margin-bottom:.5rem;font-weight:600;}',
    '.bk__horas{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:.4rem;}',
    '.bk__hora{padding:.6rem .25rem;cursor:pointer;font:inherit;font-size:var(--txt-sm,.875rem);',
    '  font-variant-numeric:tabular-nums;border-radius:var(--radio-sm,8px);',
    '  border:1px solid var(--color-borde,#e6e2dd);background:var(--color-superficie,#fff);color:inherit;',
    '  transition:border-color 120ms linear,background-color 120ms linear,color 120ms linear;}',
    '.bk__hora:hover:not(:disabled){border-color:var(--color-texto-suave,#9a948c);}',
    '.bk__hora:disabled{opacity:.4;cursor:not-allowed;text-decoration:line-through;}',
    '.bk__hora[aria-pressed="true"]{background:var(--bk-acento);border-color:var(--bk-acento);',
    '  color:var(--color-sobre-acento,#fff);}',

    /* --- paso 4: datos --- */
    '.bk__campo{margin-bottom:.85rem;}',
    '.bk__label{display:block;font-size:var(--txt-xs,.8rem);font-weight:600;margin-bottom:.3rem;}',
    '.bk__input{width:100%;font:inherit;padding:.7rem .85rem;border-radius:var(--radio-sm,8px);',
    '  border:1px solid var(--color-borde,#e6e2dd);background:var(--color-superficie,#fff);color:inherit;',
    '  transition:border-color 120ms linear,box-shadow 120ms linear;}',
    '.bk__input:focus{outline:none;border-color:var(--bk-acento);',
    '  box-shadow:0 0 0 3px color-mix(in srgb,var(--bk-acento) 18%,transparent);}',
    '.bk__input[aria-invalid="true"]{border-color:var(--color-error,#c0392b);}',
    '.bk__error{color:var(--color-error,#c0392b);font-size:var(--txt-xs,.75rem);margin-top:.25rem;',
    '  display:block;min-height:1em;}',
    'textarea.bk__input{resize:vertical;min-height:72px;}',

    /* --- resumen --- */
    '.bk__resumen{background:var(--color-fondo-alt,#f6f3ef);border-radius:var(--radio-md,12px);',
    '  padding:1rem 1.1rem;margin-bottom:1.1rem;font-size:var(--txt-sm,.875rem);}',
    '.bk__resumen-fila{display:flex;justify-content:space-between;gap:1rem;padding:.3rem 0;}',
    '.bk__resumen-fila dt{color:var(--color-texto-suave,#6b6660);flex:0 0 auto;}',
    '.bk__resumen-fila dd{margin:0;text-align:right;font-weight:600;}',
    '.bk__resumen-total{border-top:1px solid var(--color-borde,#e0dbd4);margin-top:.4rem;padding-top:.55rem;}',

    /* --- acciones --- */
    '.bk__acciones{display:flex;gap:.6rem;align-items:center;margin-top:var(--esp-4,1.5rem);}',
    '.bk__btn{font:inherit;font-weight:600;cursor:pointer;border-radius:99px;padding:.8rem 1.5rem;',
    '  border:1px solid transparent;',
    '  transition:transform var(--dur-press,120ms) var(--ease-out,ease),opacity 120ms linear,',
    '             background-color 160ms linear;}',
    '.bk__btn:active:not(:disabled){transform:scale(.975);}',
    '.bk__btn:disabled{opacity:.4;cursor:not-allowed;}',
    '.bk__btn--primario{flex:1;background:var(--bk-acento);color:var(--color-sobre-acento,#fff);}',
    '.bk__btn--fantasma{background:none;border-color:var(--color-borde,#e6e2dd);color:inherit;}',

    /* --- confirmación --- */
    '.bk__ok{text-align:center;padding:1.5rem 0;}',
    '.bk__ok-circulo{width:64px;height:64px;margin:0 auto 1.1rem;border-radius:50%;',
    '  display:grid;place-items:center;background:color-mix(in srgb,var(--bk-acento) 12%,transparent);',
    '  animation:bkPop 380ms var(--ease-spring,cubic-bezier(.34,1.56,.64,1)) both;}',
    '@keyframes bkPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}',
    '.bk__ok-check{stroke:var(--bk-acento);stroke-width:2.5;fill:none;stroke-linecap:round;',
    '  stroke-linejoin:round;stroke-dasharray:28;stroke-dashoffset:28;',
    /* Se dibuja, no aparece. Es el único momento del flujo que merece
       tardar: comunica cierre, no transición. */
    '  animation:bkDibuja 520ms var(--ease-out,cubic-bezier(.16,1,.3,1)) 180ms forwards;}',
    '@keyframes bkDibuja{to{stroke-dashoffset:0}}',
    '.bk__folio{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;',
    '  background:var(--color-fondo-alt,#f6f3ef);border-radius:var(--radio-sm,8px);',
    '  padding:.35rem .7rem;display:inline-block;margin:.5rem 0 1rem;font-size:var(--txt-sm,.875rem);}',

    '.bk__vacio{text-align:center;padding:2rem 1rem;color:var(--color-texto-suave,#6b6660);',
    '  font-size:var(--txt-sm,.875rem);}',

    '@media (prefers-reduced-motion:reduce){',
    '  .bk *,.bk *::after,.bk *::before{animation-duration:.01ms!important;',
    '    animation-iteration-count:1!important;transition-duration:.01ms!important;}',
    '  .bk__pasos{transition:none;}}'
  ].join('\n'));

  /* ------------------------------------------------------------ helpers */

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hoy() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }

  function minutos(hhmm) {
    var p = String(hhmm).split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }
  function aHHMM(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function a12h(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    var suf = h >= 12 ? 'p.m.' : 'a.m.';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + pad(mm) + ' ' + suf;
  }

  /* Hash determinista: el mismo día genera siempre los mismos huecos
     ocupados. Si usáramos Math.random(), al navegar de mes y volver la
     disponibilidad cambiaría y la demo se vería rota frente al cliente. */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }
  function ocupado(fechaISO, min, tasa) {
    return (hash(fechaISO + '@' + min) % 1000) / 1000 < tasa;
  }

  function folio() {
    var d = new Date();
    var base = (hash(String(d.getTime())) % 46656).toString(36).toUpperCase();
    return 'RS-' + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + ('000' + base).slice(-4);
  }

  function fechaLarga(d) {
    return DIAS_LARGO[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
  }

  /* ------------------------------------------------------------ módulo */

  var Booking = {};
  var cfg = null;
  var raiz = null;
  var st = null;
  var refs = {};

  function estadoInicial() {
    return {
      paso: 1,
      categoria: 'Todos',
      servicio: null,
      fecha: null,          // Date
      hora: null,           // minutos desde medianoche
      mesVista: hoy(),
      datos: { nombre: '', telefono: '', notas: '' },
      errores: {},
      folio: null
    };
  }

  Booking.init = function (opciones) {
    cfg = Object.assign({
      mount: '#reservas',
      servicios: [],
      horario: null,
      diasCerrados: [],
      intervalo: 30,
      telefonoWhatsApp: '',
      nombreNegocio: 'el negocio',
      ocupacion: 0.35,
      moneda: 'MXN',
      onConfirm: null
    }, opciones || {});

    raiz = typeof cfg.mount === 'string' ? document.querySelector(cfg.mount) : cfg.mount;
    if (!raiz) { console.warn('[booking] No se encontró el contenedor', cfg.mount); return Booking; }

    if (!cfg.horario) {
      cfg.horario = { 0: null, 1: { abre: '10:00', cierra: '19:00' }, 2: { abre: '10:00', cierra: '19:00' },
        3: { abre: '10:00', cierra: '19:00' }, 4: { abre: '10:00', cierra: '19:00' },
        5: { abre: '10:00', cierra: '19:00' }, 6: { abre: '10:00', cierra: '15:00' } };
    }

    st = estadoInicial();
    construir();
    render(0);
    return Booking;
  };

  Booking.estado = function () { return JSON.parse(JSON.stringify({
    paso: st.paso,
    servicio: st.servicio,
    fecha: st.fecha ? iso(st.fecha) : null,
    hora: st.hora !== null ? aHHMM(st.hora) : null,
    datos: st.datos
  })); };

  Booking.reset = function () { st = estadoInicial(); render(0); return Booking; };

  Booking.preseleccionar = function (idServicio) {
    var s = buscarServicio(idServicio);
    if (!s) return Booking;
    st.servicio = s;
    st.paso = 2;
    render(1);
    if (raiz.scrollIntoView) raiz.scrollIntoView({ behavior: U.reducido() ? 'auto' : 'smooth', block: 'center' });
    return Booking;
  };

  Booking.ir = function (paso) {
    paso = Math.max(1, Math.min(5, paso));
    if (paso > st.paso && !validar(st.paso)) { render(0); return Booking; }
    var dir = paso > st.paso ? 1 : -1;
    var anterior = st.paso;
    st.paso = paso;
    render(dir);
    U.emitir('booking:step', { paso: paso, anterior: anterior, estado: Booking.estado() });
    return Booking;
  };

  function buscarServicio(id) {
    for (var i = 0; i < cfg.servicios.length; i++) {
      if (String(cfg.servicios[i].id) === String(id)) return cfg.servicios[i];
    }
    return null;
  }

  function validar(paso) {
    st.errores = {};
    if (paso === 1 && !st.servicio) { st.errores.servicio = 'Elige un servicio para continuar.'; return false; }
    if (paso === 2 && !st.fecha) { st.errores.fecha = 'Elige un día.'; return false; }
    if (paso === 3 && st.hora === null) { st.errores.hora = 'Elige un horario.'; return false; }
    if (paso === 4) {
      var ok = true;
      if (st.datos.nombre.trim().length < 3) { st.errores.nombre = 'Escribe tu nombre completo.'; ok = false; }
      var tel = st.datos.telefono.replace(/\D/g, '');
      if (tel.length < 10) { st.errores.telefono = 'Necesitamos 10 dígitos para confirmarte.'; ok = false; }
      return ok;
    }
    return true;
  }

  /* ------------------------------------------------------------ estructura */

  function construir() {
    raiz.classList.add('bk');
    raiz.innerHTML = '';

    refs.barra = U.crear('div', { class: 'bk__barra', 'aria-hidden': 'true' });
    for (var i = 0; i < 4; i++) refs.barra.appendChild(U.crear('div', { class: 'bk__barra-item' }));

    refs.pasos = U.crear('div', { class: 'bk__pasos' });
    refs.live = U.crear('p', {
      class: 'bk__ayuda', role: 'status', 'aria-live': 'polite',
      style: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }
    });

    raiz.appendChild(refs.barra);
    raiz.appendChild(refs.pasos);
    raiz.appendChild(refs.live);
  }

  /* dir: 1 avanzar, -1 retroceder, 0 sin transición */
  function render(dir) {
    var items = refs.barra.children;
    for (var i = 0; i < items.length; i++) {
      items[i].setAttribute('data-hecho', st.paso > i + 1 || st.paso === 5 ? 'true' : 'false');
    }

    var nuevo = pintarPaso(st.paso);
    var viejo = refs.pasos.querySelector('.bk__paso[data-activo="true"]');
    var reducido = U.reducido();

    if (!viejo || dir === 0 || reducido) {
      refs.pasos.innerHTML = '';
      nuevo.setAttribute('data-activo', 'true');
      refs.pasos.appendChild(nuevo);
      refs.pasos.style.height = '';
      enfocarPrimero(nuevo);
      return;
    }

    // Congelamos la altura actual para poder animarla hacia la nueva.
    var alturaIni = refs.pasos.offsetHeight;
    refs.pasos.style.height = alturaIni + 'px';

    viejo.setAttribute('data-activo', 'false');
    viejo.setAttribute('data-anim', dir > 0 ? 'sale-izq' : 'sale-der');

    nuevo.setAttribute('data-activo', 'true');
    nuevo.setAttribute('data-anim', dir > 0 ? 'entra-der' : 'entra-izq');
    nuevo.style.position = 'absolute';
    refs.pasos.appendChild(nuevo);

    var alturaFin = nuevo.offsetHeight;
    // Doble rAF: garantiza que el navegador ya midió la altura inicial antes
    // de cambiarla, si no, no hay transición que animar.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { refs.pasos.style.height = alturaFin + 'px'; });
    });

    window.setTimeout(function () {
      if (viejo.parentNode) viejo.parentNode.removeChild(viejo);
      nuevo.style.position = '';
      nuevo.removeAttribute('data-anim');
      refs.pasos.style.height = '';
      enfocarPrimero(nuevo);
    }, 330);
  }

  function enfocarPrimero(paso) {
    var f = paso.querySelector('input, [role="group"] button:not(:disabled), button:not(:disabled)');
    // Solo movemos el foco si el usuario ya estaba navegando dentro del widget;
    // robarle el foco a alguien que solo hizo scroll es hostil.
    if (f && raiz.contains(document.activeElement)) {
      try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); }
    }
    if (refs.live) refs.live.textContent = 'Paso ' + Math.min(st.paso, 4) + ' de 4';
  }

  function pintarPaso(n) {
    if (n === 1) return pasoServicio();
    if (n === 2) return pasoFecha();
    if (n === 3) return pasoHora();
    if (n === 4) return pasoDatos();
    return pasoOk();
  }

  function cabecera(titulo, ayuda) {
    return [
      U.crear('h3', { class: 'bk__titulo', text: titulo }),
      U.crear('p', { class: 'bk__ayuda', text: ayuda })
    ];
  }

  function acciones(opts) {
    var caja = U.crear('div', { class: 'bk__acciones' });
    if (opts.atras) {
      caja.appendChild(U.crear('button', {
        type: 'button', class: 'bk__btn bk__btn--fantasma', text: 'Atrás',
        onclick: function () { Booking.ir(st.paso - 1); }
      }));
    }
    var pri = U.crear('button', {
      type: 'button', class: 'bk__btn bk__btn--primario', text: opts.texto,
      onclick: opts.accion
    });
    if (opts.deshabilitado) pri.disabled = true;
    caja.appendChild(pri);
    return caja;
  }

  /* ------------------------------------------------------ paso 1: servicio */

  function categorias() {
    var vistas = { 'Todos': 1 }, out = ['Todos'];
    for (var i = 0; i < cfg.servicios.length; i++) {
      var c = cfg.servicios[i].categoria || 'Otros';
      if (!vistas[c]) { vistas[c] = 1; out.push(c); }
    }
    return out;
  }

  function pasoServicio() {
    var wrap = U.crear('div', { class: 'bk__paso' });
    cabecera('¿Qué te vas a hacer?', 'Elige un servicio. Puedes cambiarlo después.')
      .forEach(function (n) { wrap.appendChild(n); });

    var cats = categorias();
    if (cats.length > 2) {
      var barra = U.crear('div', { class: 'bk__cats', role: 'group', 'aria-label': 'Filtrar por categoría' });
      cats.forEach(function (c) {
        barra.appendChild(U.crear('button', {
          type: 'button', class: 'bk__cat', text: c,
          'aria-pressed': st.categoria === c ? 'true' : 'false',
          onclick: function () { st.categoria = c; render(0); }
        }));
      });
      wrap.appendChild(barra);
    }

    var lista = U.crear('div', { class: 'bk__lista', role: 'group', 'aria-label': 'Servicios disponibles' });
    var visibles = cfg.servicios.filter(function (s) {
      return st.categoria === 'Todos' || s.categoria === st.categoria;
    });

    if (!visibles.length) {
      lista.appendChild(U.crear('p', { class: 'bk__vacio', text: 'No hay servicios en esta categoría.' }));
    }

    visibles.forEach(function (s) {
      var sel = st.servicio && String(st.servicio.id) === String(s.id);
      var meta = U.crear('div', { class: 'bk__servicio-meta' }, [
        U.crear('div', { class: 'bk__servicio-precio', text: U.moneda(s.precio_mxn, { moneda: cfg.moneda }) }),
        U.crear('div', { class: 'bk__servicio-dur', text: (s.duracion_min || 60) + ' min' })
      ]);
      var cuerpo = U.crear('div', { class: 'bk__servicio-cuerpo' }, [
        U.crear('div', { class: 'bk__servicio-nombre', text: s.nombre })
      ]);
      if (s.descripcion) {
        cuerpo.appendChild(U.crear('div', { class: 'bk__servicio-desc', text: s.descripcion }));
      }
      lista.appendChild(U.crear('button', {
        type: 'button', class: 'bk__servicio', 'aria-pressed': sel ? 'true' : 'false',
        onclick: function () {
          st.servicio = s;
          st.hora = null; // cambiar de servicio cambia la duración: los slots ya no valen
          U.emitir('booking:select', { campo: 'servicio', valor: s, estado: Booking.estado() });
          render(0);
        }
      }, [U.crear('span', { class: 'bk__servicio-check', 'aria-hidden': 'true' }), cuerpo, meta]));
    });

    wrap.appendChild(lista);
    if (st.errores.servicio) wrap.appendChild(U.crear('span', { class: 'bk__error', text: st.errores.servicio }));
    wrap.appendChild(acciones({
      texto: 'Elegir fecha', deshabilitado: !st.servicio,
      accion: function () { Booking.ir(2); }
    }));
    return wrap;
  }

  /* --------------------------------------------------------- paso 2: fecha */

  function diaCerrado(d) {
    if (cfg.diasCerrados.indexOf(iso(d)) !== -1) return true;
    return !cfg.horario[d.getDay()];
  }

  function pasoFecha() {
    var wrap = U.crear('div', { class: 'bk__paso' });
    cabecera('¿Qué día te queda bien?', st.servicio ? st.servicio.nombre + ' · ' + (st.servicio.duracion_min || 60) + ' min' : '')
      .forEach(function (n) { wrap.appendChild(n); });

    var nav = U.crear('div', { class: 'bk__cal-nav' });
    var h = hoy();
    var enMesActual = st.mesVista.getFullYear() === h.getFullYear() && st.mesVista.getMonth() === h.getMonth();

    var prev = U.crear('button', {
      type: 'button', class: 'bk__icon-btn', 'aria-label': 'Mes anterior',
      html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
      onclick: function () { moverMes(-1); }
    });
    prev.disabled = enMesActual;

    nav.appendChild(prev);
    nav.appendChild(U.crear('div', {
      class: 'bk__cal-mes', 'aria-live': 'polite',
      text: MESES[st.mesVista.getMonth()] + ' ' + st.mesVista.getFullYear()
    }));
    nav.appendChild(U.crear('button', {
      type: 'button', class: 'bk__icon-btn', 'aria-label': 'Mes siguiente',
      html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
      onclick: function () { moverMes(1); }
    }));
    wrap.appendChild(nav);

    var viewport = U.crear('div', { class: 'bk__cal-viewport' });
    viewport.appendChild(gridMes());
    wrap.appendChild(viewport);
    refs.viewport = viewport;

    if (st.errores.fecha) wrap.appendChild(U.crear('span', { class: 'bk__error', text: st.errores.fecha }));
    wrap.appendChild(acciones({
      atras: true, texto: 'Ver horarios', deshabilitado: !st.fecha,
      accion: function () { Booking.ir(3); }
    }));
    return wrap;
  }

  function moverMes(delta) {
    var d = new Date(st.mesVista.getFullYear(), st.mesVista.getMonth() + delta, 1);
    st.mesVista = d;
    if (!refs.viewport) { render(0); return; }
    refs.viewport.innerHTML = '';
    var g = gridMes();
    if (!U.reducido()) g.setAttribute('data-anim', delta > 0 ? 'der' : 'izq');
    refs.viewport.appendChild(g);
    // El botón de "mes anterior" puede haberse habilitado/deshabilitado.
    var prev = refs.pasos.querySelector('.bk__cal-nav .bk__icon-btn');
    var h = hoy();
    if (prev) prev.disabled = st.mesVista.getFullYear() === h.getFullYear() && st.mesVista.getMonth() === h.getMonth();
    var etiqueta = refs.pasos.querySelector('.bk__cal-mes');
    if (etiqueta) etiqueta.textContent = MESES[st.mesVista.getMonth()] + ' ' + st.mesVista.getFullYear();
  }

  function gridMes() {
    var grid = U.crear('div', { class: 'bk__cal-grid', role: 'group', 'aria-label': 'Días disponibles' });
    DIAS_CORTO.forEach(function (d, i) {
      grid.appendChild(U.crear('div', { class: 'bk__cal-dow', text: d, 'aria-label': DIAS_LARGO[i] }));
    });

    var y = st.mesVista.getFullYear(), m = st.mesVista.getMonth();
    var primero = new Date(y, m, 1);
    var total = new Date(y, m + 1, 0).getDate();
    var h = hoy();

    for (var i = 0; i < primero.getDay(); i++) {
      grid.appendChild(U.crear('div', { class: 'bk__dia bk__dia--vacio', 'aria-hidden': 'true' }));
    }

    for (var d = 1; d <= total; d++) {
      (function (dia) {
        var fecha = new Date(y, m, dia);
        var pasado = fecha < h;
        var cerrado = diaCerrado(fecha);
        var esHoy = iso(fecha) === iso(h);
        var sel = st.fecha && iso(st.fecha) === iso(fecha);

        var btn = U.crear('button', {
          type: 'button',
          class: 'bk__dia' + (esHoy ? ' bk__dia--hoy' : ''),
          text: String(dia),
          'aria-pressed': sel ? 'true' : 'false',
          'aria-label': fechaLarga(fecha) + (cerrado ? ' — cerrado' : ''),
          onclick: function () {
            st.fecha = fecha;
            st.hora = null;
            U.emitir('booking:select', { campo: 'fecha', valor: iso(fecha), estado: Booking.estado() });
            // Avanzar solo cuando el usuario ya vio el calendario: el clic en el
            // día ES la decisión, pedir un segundo clic sería fricción gratis.
            Booking.ir(3);
          }
        });
        btn.disabled = pasado || cerrado;
        grid.appendChild(btn);
      })(d);
    }
    return grid;
  }

  /* ---------------------------------------------------------- paso 3: hora */

  function slotsDe(fecha) {
    var reglas = cfg.horario[fecha.getDay()];
    if (!reglas) return [];
    var dur = (st.servicio && st.servicio.duracion_min) || 60;
    var ini = minutos(reglas.abre), fin = minutos(reglas.cierra);
    var out = [];
    var ahora = new Date();
    var esHoy = iso(fecha) === iso(hoy());
    var minAhora = ahora.getHours() * 60 + ahora.getMinutes();

    for (var m = ini; m + dur <= fin; m += cfg.intervalo) {
      // Con 2h de anticipación mínima: reservar "para dentro de 10 minutos"
      // no es creíble y el dueño lo va a notar en la demo.
      var muyPronto = esHoy && m < minAhora + 120;
      out.push({ min: m, libre: !muyPronto && !ocupado(iso(fecha), m, cfg.ocupacion) });
    }
    return out;
  }

  function pasoHora() {
    var wrap = U.crear('div', { class: 'bk__paso' });
    cabecera('¿A qué hora?', st.fecha ? fechaLarga(st.fecha) : '')
      .forEach(function (n) { wrap.appendChild(n); });

    var slots = st.fecha ? slotsDe(st.fecha) : [];
    var libres = slots.filter(function (s) { return s.libre; }).length;

    if (!slots.length || !libres) {
      wrap.appendChild(U.crear('p', {
        class: 'bk__vacio',
        text: !slots.length ? 'Ese día está cerrado. Elige otro.' : 'Ya no hay lugares ese día. Prueba con otra fecha.'
      }));
    } else {
      var franjas = [
        { tit: 'Mañana', desde: 0, hasta: 12 * 60 },
        { tit: 'Tarde', desde: 12 * 60, hasta: 18 * 60 },
        { tit: 'Noche', desde: 18 * 60, hasta: 24 * 60 }
      ];
      franjas.forEach(function (f) {
        var dentro = slots.filter(function (s) { return s.min >= f.desde && s.min < f.hasta; });
        if (!dentro.length) return;
        var caja = U.crear('div', { class: 'bk__franja' }, [
          U.crear('div', { class: 'bk__franja-tit', text: f.tit })
        ]);
        var grid = U.crear('div', { class: 'bk__horas', role: 'group', 'aria-label': 'Horarios de la ' + f.tit.toLowerCase() });
        dentro.forEach(function (s) {
          var btn = U.crear('button', {
            type: 'button', class: 'bk__hora', text: a12h(s.min).replace(' a.m.', '').replace(' p.m.', ''),
            'aria-label': a12h(s.min) + (s.libre ? '' : ' — ocupado'),
            'aria-pressed': st.hora === s.min ? 'true' : 'false',
            onclick: function () {
              st.hora = s.min;
              U.emitir('booking:select', { campo: 'hora', valor: aHHMM(s.min), estado: Booking.estado() });
              render(0);
            }
          });
          btn.disabled = !s.libre;
          grid.appendChild(btn);
        });
        caja.appendChild(grid);
        wrap.appendChild(caja);
      });
      wrap.appendChild(U.crear('p', {
        class: 'bk__ayuda', style: { marginBottom: '0' },
        text: libres + (libres === 1 ? ' lugar disponible' : ' lugares disponibles') + ' este día'
      }));
    }

    if (st.errores.hora) wrap.appendChild(U.crear('span', { class: 'bk__error', text: st.errores.hora }));
    wrap.appendChild(acciones({
      atras: true, texto: 'Continuar', deshabilitado: st.hora === null,
      accion: function () { Booking.ir(4); }
    }));
    return wrap;
  }

  /* --------------------------------------------------------- paso 4: datos */

  function resumen() {
    var dl = U.crear('dl', { class: 'bk__resumen' });
    function fila(k, v, clase) {
      dl.appendChild(U.crear('div', { class: 'bk__resumen-fila' + (clase ? ' ' + clase : '') }, [
        U.crear('dt', { text: k }), U.crear('dd', { text: v })
      ]));
    }
    if (st.servicio) fila('Servicio', st.servicio.nombre);
    if (st.fecha) fila('Fecha', fechaLarga(st.fecha));
    if (st.hora !== null) fila('Hora', a12h(st.hora));
    if (st.servicio) fila('Duración', (st.servicio.duracion_min || 60) + ' min');
    if (st.servicio) fila('Total', U.moneda(st.servicio.precio_mxn, { moneda: cfg.moneda }), 'bk__resumen-total');
    return dl;
  }

  function campo(id, etiqueta, tipo, valor, error, placeholder) {
    var input = U.crear(tipo === 'textarea' ? 'textarea' : 'input', {
      class: 'bk__input', id: 'bk-' + id, value: tipo === 'textarea' ? null : valor,
      type: tipo === 'textarea' ? null : tipo,
      placeholder: placeholder || null,
      inputmode: tipo === 'tel' ? 'tel' : null,
      autocomplete: id === 'nombre' ? 'name' : (id === 'telefono' ? 'tel' : 'off'),
      'aria-invalid': error ? 'true' : 'false',
      'aria-describedby': error ? 'bk-err-' + id : null,
      oninput: function (e) {
        st.datos[id] = e.target.value;
        // Limpiamos el error en cuanto empieza a corregir, no al enviar otra vez.
        if (st.errores[id]) {
          delete st.errores[id];
          e.target.setAttribute('aria-invalid', 'false');
          var span = document.getElementById('bk-err-' + id);
          if (span) span.textContent = '';
        }
      }
    });
    if (tipo === 'textarea') input.value = valor;
    return U.crear('div', { class: 'bk__campo' }, [
      U.crear('label', { class: 'bk__label', for: 'bk-' + id, text: etiqueta }),
      input,
      U.crear('span', { class: 'bk__error', id: 'bk-err-' + id, text: error || '' })
    ]);
  }

  function pasoDatos() {
    var wrap = U.crear('div', { class: 'bk__paso' });
    cabecera('Últimos datos', 'Te confirmamos por WhatsApp en menos de 10 minutos.')
      .forEach(function (n) { wrap.appendChild(n); });

    wrap.appendChild(resumen());
    wrap.appendChild(campo('nombre', 'Tu nombre', 'text', st.datos.nombre, st.errores.nombre, 'María Fernanda López'));
    wrap.appendChild(campo('telefono', 'WhatsApp', 'tel', st.datos.telefono, st.errores.telefono, '449 123 4567'));
    wrap.appendChild(campo('notas', 'Algo que debamos saber (opcional)', 'textarea', st.datos.notas, null, 'Alergias, preferencias, si vienes con alguien más…'));

    wrap.appendChild(acciones({
      atras: true, texto: 'Confirmar cita',
      accion: function () {
        if (!validar(4)) { render(0); return; }
        confirmar();
      }
    }));
    return wrap;
  }

  /* ----------------------------------------------------- paso 5: confirmado */

  Booking.mensaje = function () {
    var l = [];
    l.push('Hola ' + cfg.nombreNegocio + ', quiero confirmar mi cita:');
    l.push('');
    if (st.folio) l.push('Folio: ' + st.folio);
    if (st.servicio) l.push('Servicio: ' + st.servicio.nombre);
    if (st.fecha) l.push('Fecha: ' + fechaLarga(st.fecha));
    if (st.hora !== null) l.push('Hora: ' + a12h(st.hora));
    if (st.servicio) l.push('Total: ' + U.moneda(st.servicio.precio_mxn, { moneda: cfg.moneda }));
    l.push('');
    l.push('Nombre: ' + st.datos.nombre);
    l.push('Tel: ' + st.datos.telefono);
    if (st.datos.notas.trim()) l.push('Nota: ' + st.datos.notas.trim());
    return l.join('\n');
  };

  function linkWA() {
    var msg = Booking.mensaje();
    if (window.WhatsApp && typeof window.WhatsApp.link === 'function') {
      return window.WhatsApp.link(cfg.telefonoWhatsApp, msg);
    }
    return 'https://wa.me/' + String(cfg.telefonoWhatsApp).replace(/\D/g, '') +
      '?text=' + encodeURIComponent(msg);
  }

  function confirmar() {
    st.folio = folio();
    var reserva = Booking.estado();
    reserva.folio = st.folio;
    reserva.mensaje = Booking.mensaje();
    reserva.whatsapp = linkWA();

    st.paso = 5;
    render(1);
    U.emitir('booking:confirm', { reserva: reserva });
    if (typeof cfg.onConfirm === 'function') cfg.onConfirm(reserva);
    if (window.UI && window.UI.Toast) {
      window.UI.Toast.exito
        ? window.UI.Toast.exito('Cita apartada · ' + st.folio)
        : window.UI.Toast.mostrar && window.UI.Toast.mostrar({ titulo: 'Cita apartada', descripcion: st.folio });
    }
  }

  function pasoOk() {
    var wrap = U.crear('div', { class: 'bk__paso' });
    var ok = U.crear('div', { class: 'bk__ok' });

    ok.appendChild(U.crear('div', {
      class: 'bk__ok-circulo', 'aria-hidden': 'true',
      html: '<svg width="30" height="30" viewBox="0 0 24 24"><path class="bk__ok-check" d="M4.5 12.5l5 5 10-11"/></svg>'
    }));
    ok.appendChild(U.crear('h3', { class: 'bk__titulo', text: '¡Listo, ' + (st.datos.nombre.split(' ')[0] || 'gracias') + '!' }));
    ok.appendChild(U.crear('p', { class: 'bk__ayuda', style: { marginBottom: '.25rem' }, text: 'Tu lugar está apartado.' }));
    ok.appendChild(U.crear('div', { class: 'bk__folio', text: st.folio }));
    wrap.appendChild(ok);
    wrap.appendChild(resumen());

    var caja = U.crear('div', { class: 'bk__acciones' });
    var enviar = U.crear('a', {
      class: 'bk__btn bk__btn--primario', href: linkWA(), target: '_blank', rel: 'noopener',
      text: 'Confirmar por WhatsApp',
      style: { textAlign: 'center', textDecoration: 'none' }
    });
    caja.appendChild(enviar);
    caja.appendChild(U.crear('button', {
      type: 'button', class: 'bk__btn bk__btn--fantasma', text: 'Otra cita',
      onclick: function () { Booking.reset(); }
    }));
    wrap.appendChild(caja);

    wrap.appendChild(U.crear('p', {
      class: 'bk__ayuda',
      style: { marginTop: '1rem', marginBottom: '0', textAlign: 'center', fontSize: '.75rem' },
      text: 'Demostración. En la versión final la cita entra directo a la agenda y se manda recordatorio 24 h antes.'
    }));
    return wrap;
  }

  window.Booking = Booking;
})(window, document);
