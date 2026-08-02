# Wax & Nails — landing demo

**Qué es:** una demostración funcional para enseñarle a la dueña en el celular durante la junta.
**Qué no es:** un sitio publicable. Hay datos por validar; están listados abajo y en `_research/wax-and-nails/VALIDAR-CON-DUEÑA.md`.

---

## Cómo abrirlo

Doble clic en `index.html`. Nada más. No necesita servidor, ni internet obligatorio, ni instalar nada.

- **Sin internet** las tipografías de Google Fonts no cargan y el sitio se ve con el respaldo local (Iowan Old Style / Georgia + la sans del sistema). Se lee perfecto, pero pierde el carácter de Fraunces. **Si vas a enseñarlo en la calle, ábrelo una vez con wifi antes** para que el navegador deje las fuentes en caché.
- Todo el estado vive en memoria. No usa `localStorage` ni `sessionStorage`: cerrar la pestaña reinicia la demo, que es exactamente lo que quieres entre una junta y otra.
- No hace ninguna petición de red al abrirse (`fetch` cero). Los datos están en `js/datos.js` como objetos de JavaScript.

### Recorrido sugerido para la junta (3 minutos)

1. **Hero.** "Aquí te atiende la dueña. Siempre." — es su propia reseña de Google convertida en titular.
2. **Baja al Abanico.** Déjala arrastrarlo con el dedo. Que elija un color. **La página completa se repinta.** Ahí se gana la junta.
3. **Baja a la galería.** Los trabajos de esa familia de tono suben al principio solos.
4. **Abre WhatsApp desde cualquier botón.** El mensaje ya trae el color que eligió.
5. **Motor de reservas.** Llega hasta el folio. Enséñale que el domingo está cerrado y que el lunes empieza a las 2.
6. **"Lo que hoy pasa cuando alguien te busca."** Ahí es donde se cierra la venta.

---

## Orden de secciones y por qué ese

`_design/sistema/arquitectura-de-secciones.md` nunca se escribió. Este es el orden que se derivó de la dirección "Cantera y Esmalte", con el argumento de cada posición:

| # | Sección | Por qué va aquí |
|---|---|---|
| 1 | **Hero** | La dirección dice que el hero es *tesis, no promesa*. Titular anclado en la reseña real + las dos acciones que la clienta realmente hace: apartar o escribir. El Abanico aparece insinuado (5 palillos apoyados en el arco de cantera) para prometer lo que viene abajo. |
| 2 | **Banda de cita real** | El perfil de marca recomienda la reseña textual "justo debajo del hero". Es la única prueba que ningún copy alcanza. Ocupa poco y compra credibilidad antes de pedir nada. |
| 3 | **El Abanico (FIRMA)** | Se juega temprano, no al final. Es el gancho y además **produce un dato** (el tono elegido) que las secciones de abajo consumen. Guardarlo para el final sería desperdiciarlo. |
| 4 | **Galería** | Va inmediatamente después porque es el consumidor directo del Abanico. La dirección manda que "la foto pese más que el texto" y que el formato sea 4:5 (el de Instagram). |
| 5 | **Servicios** | Ya vio el trabajo; ahora quiere el precio. Responde la objeción #1 del perfil de marca: *"¿cuánto me va a costar?"*. |
| 6 | **Depilación con cera** | Sale del catálogo a propósito y se pinta de ámbar. Es el servicio con más ansiedad y se vende con información, no con imagen. Robado de la Dirección 2 (Aesop): ficha técnica y procedimiento numerado. |
| 7 | **Reservas** | Justo después de precios y de haber desactivado el miedo. Responde la objeción #2: *"¿tendrá lugar el sábado?"*. |
| 8 | **Prueba social** | Después de la conversión, no antes: quien no reservó todavía necesita el empujón; quien ya reservó lo lee como confirmación. |
| 9 | **La dueña** | El activo insustituible del negocio va después de las reseñas porque las reseñas ya lo nombraron. Aquí solo se le pone cara. |
| 10 | **Antes / Después digital** | Esta sección **no es para la clienta, es para la dueña**. Va cerca del final, cuando ya vio de qué es capaz la página. Es el argumento de venta hecho sección. |
| 11 | **Ubicación y horario** | Responde la última objeción: *"¿dónde queda y hay dónde estacionarme?"*. |
| 12 | **CTA final + footer** | Remate y datos duros. El schema JSON-LD se muestra a propósito: es parte del pitch de SEO. |

---

## El Abanico, en corto

- 12 palillos escritos **en el HTML**, no generados por JavaScript: sin JS el muestrario se ve abierto, estático y con los 12 nombres legibles. No se rompe nada.
- Geometría de la spec: pivote a `156px` del borde superior, barrido de −6° a +71°, `z-index: calc(20 − i)` para que el mazo cerrado se apile bien.
- **Apertura:** una sola vez, al entrar en pantalla (`IntersectionObserver` a 0.4). 520 ms, `--ease-cajon`, stagger de 26 ms por palillo. El stagger es lo que lo hace abanico y no 12 barras girando juntas.
- **Arrastre:** 1:1 con el dedo, `setPointerCapture`, damping fuera del tope (`1 + (crudo − 1) × 0.35`). Al soltar decide por velocidad (`> 0.11 px/ms`), no por distancia.
- **Repintado:** JS escribe `--acento`, `--acento-texto` y `--acento-suave` en `:root`. Están registradas con `@property { syntax: '<color>' }`, así que **el color interpola** en 420 ms en vez de cortar en seco. Los consumidores heredan el valor ya interpolado: **no hay una sola transición de color en los componentes**, para no encimar dos curvas.
- **Contraste:** cada palillo trae su `data-texto` precalculado. Nunca se calcula en runtime. Los 12 pares están verificados a ≥4.5:1 (el más bajo, Rosa Cantera, da 5.76:1).
- **Teclado:** `role="radiogroup"` con roving tabindex. ←/→/↑/↓ recorren, Inicio/Fin saltan a los extremos, Espacio selecciona. Navegar con teclado abre el mazo solo, porque si no, no se vería nada.
- **Movimiento reducido:** nace abierto, sin apertura, sin stagger, sin arrastre. El cambio de color se conserva a 160 ms — es información, no movimiento.
- **Doble función:** filtra la galería por familia de tono y precarga el mensaje de WhatsApp. Deja de ser decoración y se vuelve el primer dato cualificado del lead.

### Dónde llega el acento (y dónde no)

La dirección permite cinco roles. Estos son:
botón primario · subrayado de enlace y de navegación · borde de la ficha preseleccionada · chip de categoría activo · anillo del tono elegido.

Se agregaron dos consumidores más, a conciencia:

1. **Los controles del motor de reservas** (botón de confirmar, día y hora seleccionados). No es un rol nuevo: son "botón primario" y "chip seleccionado" con otro nombre, dentro de la librería compartida.
2. **El pin del mapa.** Sí es un sexto rol. Se dejó porque es una sola marca pequeña y refuerza la idea de que el color es el del negocio. Si molesta, se quita cambiando `.f-acento` por `.f-c400` en el SVG del mapa.

El anillo de foco **nunca** usa el acento: usa `--tinta`. Con "Blanco Leche" seleccionado, un anillo de acento sería invisible.

---

## Qué contiene cada archivo

```
index.html          Estructura, los 12 palillos, el mapa SVG y el JSON-LD.
css/base.css        Copiada tal cual de _design/sistema/lib/. No se tocó.
css/estilos.css     Tokens del sistema + puente hacia la librería + todas las secciones.
js/lib/*.js         Copiados tal cual. No se tocaron.
js/datos.js         Generado desde servicios.json, reseñas.json y la ficha verificada.
js/app.js           El Abanico, la galería, el catálogo, el horario en vivo y los remates.
assets/img/*.svg    11 gráficos generados aquí. Cero imágenes externas.
```

**`js/lib/cart.js` está copiado pero no se carga.** Esta landing no vende productos, vende citas. Se dejó en la carpeta por consistencia con las otras landings del proyecto.

**Orden de carga:** `reveal.js` (en el `<head>`, para que el contenido nazca oculto sin parpadeo) → `ui.js` → `whatsapp.js` → `booking.js` → `datos.js` → `app.js`.

---

## Verificaciones que se corrieron

| Qué | Resultado |
|---|---|
| `node --check` en los 7 `.js` | sin errores de sintaxis |
| Rutas `src`/`href` locales del HTML | 11/11 existen · **cero 404** |
| Rutas de imagen generadas por JS | 8/8 existen |
| `localStorage` / `sessionStorage` / `fetch(` / `type="module"` / `import` | 0 apariciones en código propio |
| `var(--x)` sin definir en `estilos.css` o `base.css` | ninguna (las 3 "sueltas" son `--i`, `--hex` y `--txt`, que se inyectan por `style` en cada palillo) |
| Hex crudos fuera de `:root` | solo los 3 `initial-value` de `@property`, que es donde tienen que estar |
| Contraste de los 12 pares del Abanico | 12/12 ≥ 4.5:1 (rango 5.76:1 – 16.75:1) |
| Ejecución completa del DOM (linkedom) | 0 errores en consola |
| Render | 8 piezas de galería · 29 servicios · 5 chips · **3 reseñas** · 6 brechas · 4 pasos de cera · 7 filas de horario |
| Abanico | 12 palillos · 1 seleccionado · roving tabindex correcto · `--acento` escrito en `:root` |
| Cambio de esmalte | repinta los 3 tokens, refiltra la galería y reescribe el mensaje de WhatsApp |
| Teclado | → avanza, Inicio vuelve al primero |
| Reserva de punta a punta | folio emitido (`RS-0802-0FG8`) + mensaje de WhatsApp pre-llenado + enlace `wa.me` |
| Horario en el calendario | **10/10 domingos deshabilitados** · lunes 2:00 – 7:30 p.m. · sábado 9:00 a.m. – 3:00 p.m. |
| Jerarquía de encabezados | un solo `h1`, cero saltos de nivel |
| Accesibilidad estructural | landmarks completos · 11/11 imágenes con `alt` y `width`/`height` · 82/82 botones con nombre accesible |
| Anclas internas y `aria-labelledby` | todas resuelven · cero ids duplicados |
| JSON-LD | parsea · `BeautySalon` · 3 bloques de horario · 5 ofertas |
| Peso total | **360 KB** (presupuesto: < 900 KB) |

**Lo que no se pudo probar aquí:** el arrastre real del Abanico con el dedo y el render pixel a pixel a 360 / 768 / 1440. El navegador de la máquina no estaba disponible durante la construcción. El layout está resuelto con `grid` fluido y `clamp()`, y se revisó el único punto donde el cálculo se apretaba —el `h1` a 48 px en 360 px— quitándole el `<br>` forzado. **Ábrelo una vez en tu celular antes de la junta y arrastra el abanico.**

---

## Qué falta validar con la dueña

### 🔴 Bloqueante — sin esto no se publica

1. **Su nombre.** No aparece en ninguna fuente pública. La sección "La dueña" tiene un aviso visible pidiéndolo.
2. **Su foto.** Hay un marcador en SVG, elegante y con el texto "TU FOTO AQUÍ". No es un cuadro gris.
3. **El número exterior: ¿514 o 516?** Google dice 514, su Facebook dice 516. La página usa **514** (el de Google) en el texto y en el JSON-LD. Esta contradicción es literalmente el primer punto de la junta.
4. **Su Instagram.** Se buscó activamente y no se localizó el handle; los resultados que salen son de otros negocios homónimos (incluido uno en Rusia). **No se puso ningún enlace a Instagram en la página** para no mandar tráfico a la cuenta equivocada.

### 🟡 Importante

5. **Los 29 precios y duraciones.** Ninguno es público: todos salen de investigación de mercado local. Los servicios llevan una nota honesta arriba de la carta.
6. **Los 6 servicios que ni siquiera sabemos si ofrece.** Están marcados en la página con la etiqueta *"Por confirmar"*: manicura rusa, laminado de cejas, tinte de cejas, limpieza facial profunda, facial hidratante exprés, spa de manos con parafina y spa de pies.
7. **Los 12 nombres de esmalte.** Son placeholders plausibles y locales (Feria de San Marcos, Talavera, agave, cantera). Son el mejor gancho de la página para que ella los corrija en vivo: pregúntale cómo les dice ella a sus colores.
8. **El domingo.** No aparece cerrado en ninguna fuente: se infirió. La página lo marca cerrado y el motor de reservas lo bloquea.
9. **¿Cierra a comer?** No se puso ningún descanso.
10. **Estacionamiento.** La página dice "estacionamiento en la calle". Se infirió de la vista de fachada.

### 🟢 Mejora

11. **Las fotos reales.** Las 8 piezas de la galería son composiciones abstractas en SVG, coherentes con la paleta. La sección lo dice con todas sus letras. Cuando lleguen sus fotos, entran en 4:5 sin recortar.
12. **Correo del negocio.** No se encontró; no se puso ninguno.
13. **El dominio.** El JSON-LD usa `waxandnails.mx` como marcador. Hay que comprarlo o elegir otro.

---

## Lo que NO se hizo, a propósito

- **No se publicaron las 8 reseñas inventadas** del archivo de investigación. `js/datos.js` solo copió las 3 marcadas `VERIFICADO`, y el archivo lo dice en su cabecera. Publicar testimonios de clientas que no existen es un riesgo legal y una traición al único activo probado del negocio.
- **No hay cifras infladas.** No dice "+500 clientas satisfechas" ni "10 años de experiencia". Los únicos números son 4.4, 18, 5.0, 13 y 2,567. Todos verificables.
- **No hay emoji como ícono ni estrellas de emoji.** Todo es SVG de una sola familia, trazo 1.75.
- **No hay imágenes externas.** Los 11 gráficos se generaron para este sitio.
- **El botón de WhatsApp no late ni pulsa.** Un CTA que late compite con el contenido.
