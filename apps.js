// Barra para saltar entre las apps de Inspire & Create Studio (Planner, Centro de Control, Novelia, Kit).
// Se pinta dentro de cualquier <div class="apps-barra"></div> vacío (lo pone el Inicio de cada app)
// y añade la tarjeta «Tus apps» en Ajustes, debajo de la tarjeta del elemento de data-ancla.
// La elección se guarda en localStorage «ics-apps»; en github.io la comparten las cuatro apps.
(function () {
  'use strict';
  const yo = document.currentScript;
  const ESTA = (yo && yo.dataset.app) || '';
  const ANCLA = (yo && yo.dataset.ancla) || '';
  const BASE = 'https://inspirecreatestudio.github.io/';
  const PLANNERS = {
    miplanner: { n: 'Mi Planner', url: 'https://miplanner-inspirecreate.pages.dev/' },
    personal: { n: 'Planner', url: BASE + 'plannermensual/' },
  };
  const APPS = [
    { k: 'planner', i: '📅', n: 'Planner' },
    { k: 'centro', i: '📊', n: 'Centro de Control', url: BASE + 'centrodecontrol/' },
    { k: 'novelia', i: '✍️', n: 'Novelia', url: BASE + 'novelia-studio/' },
    { k: 'kit', i: '📚', n: 'Kit', url: BASE + 'kitescritoras/' },
  ];
  const CLAVE = 'ics-apps';
  function leer() {
    let c = {};
    try { c = JSON.parse(localStorage.getItem(CLAVE) || '{}') || {}; } catch (e) { c = {}; }
    if (!Array.isArray(c.ocultas)) c.ocultas = [];
    // Quien usa el planner personal en este navegador (Marta) lo tiene por defecto; el resto, Mi Planner
    if (ESTA === 'planner-personal' && !c.personal) { c.personal = true; if (!c.planner) c.planner = 'personal'; guardar(c); }
    if (!c.planner) c.planner = 'miplanner';
    return c;
  }
  function guardar(c) { try { localStorage.setItem(CLAVE, JSON.stringify(c)); } catch (e) { /* sin almacenamiento */ } }
  const esEsta = k => ESTA === k || (k === 'planner' && ESTA.startsWith('planner'));
  function lista() {
    const c = leer();
    return APPS.filter(a => esEsta(a.k) || !c.ocultas.includes(a.k)).map(a => {
      if (a.k !== 'planner') return a;
      // Dentro de un planner, el botón lleva a ese mismo planner
      const pl = ESTA === 'planner-personal' ? PLANNERS.personal : ESTA === 'planner-mi' ? PLANNERS.miplanner : PLANNERS[c.planner] || PLANNERS.miplanner;
      return Object.assign({}, a, { n: pl.n, url: pl.url });
    });
  }
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function pintarBarra(el) {
    const apps = lista();
    if (apps.length < 2) { el.innerHTML = ''; el.dataset.lista = '1'; el.style.display = 'none'; return; }
    el.style.display = '';
    el.setAttribute('role', 'navigation');
    el.setAttribute('aria-label', 'Tus apps');
    el.innerHTML = apps.map(a => esEsta(a.k)
      ? `<span class="apps-b on" aria-current="page"><span aria-hidden="true">${a.i}</span> ${esc(a.n)}</span>`
      : `<a class="apps-b" href="${esc(a.url)}"><span aria-hidden="true">${a.i}</span> ${esc(a.n)}</a>`).join('');
    el.dataset.lista = '1';
  }

  function tarjetaAjustes() {
    const c = leer();
    const caja = document.createElement('div');
    caja.className = 'apps-aj';
    const otras = APPS.filter(a => !esEsta(a.k));
    caja.innerHTML = `<h3>Tus apps</h3>
      <p>Arriba en Inicio tienes botones para saltar de una app a otra. Elige cuáles quieres ver.</p>
      <div class="apps-aj-l">${otras.map(a => `<label><input type="checkbox" data-app="${a.k}"${c.ocultas.includes(a.k) ? '' : ' checked'}> ${a.i} ${esc(a.k === 'planner' ? 'Planner' : a.n)}</label>`).join('')}</div>
      ${ESTA.startsWith('planner') || !c.personal ? '' : `<label class="apps-aj-pl">El botón del Planner abre
        <select data-planner>
          <option value="miplanner"${c.planner === 'miplanner' ? ' selected' : ''}>Mi Planner</option>
          <option value="personal"${c.planner === 'personal' ? ' selected' : ''}>mi planner personal</option>
        </select></label>`}`;
    caja.addEventListener('change', ev => {
      const t = ev.target, c2 = leer();
      if (t.dataset.app) {
        c2.ocultas = c2.ocultas.filter(k => k !== t.dataset.app);
        if (!t.checked) c2.ocultas.push(t.dataset.app);
      }
      if (t.hasAttribute('data-planner')) c2.planner = t.value;
      guardar(c2);
      document.querySelectorAll('.apps-barra').forEach(pintarBarra);
    });
    return caja;
  }

  function colocar() {
    document.querySelectorAll('.apps-barra:not([data-lista])').forEach(pintarBarra);
    if (!ANCLA) return;
    const a = document.querySelector(ANCLA);
    if (!a) return;
    const tarjeta = a.closest('.card, .tarjeta') || a.parentElement;
    if (!tarjeta || !tarjeta.parentElement || tarjeta.parentElement.querySelector(':scope > .apps-aj')) return;
    const caja = tarjetaAjustes();
    caja.className = 'apps-aj ' + (tarjeta.classList.contains('card') ? 'card' : tarjeta.classList.contains('tarjeta') ? 'tarjeta' : '');
    tarjeta.after(caja);
  }

  const st = document.createElement('style');
  st.textContent = `.apps-barra{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
.apps-b{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;line-height:1.2;padding:6px 12px;border-radius:999px;border:1px solid rgba(0,0,0,.14);background:rgba(255,255,255,.55);color:inherit;text-decoration:none;white-space:nowrap}
a.apps-b:hover{border-color:rgba(0,0,0,.35);background:rgba(255,255,255,.9)}
.apps-b.on{background:var(--acento,var(--rosa,var(--verde,#a5595d)));border-color:transparent;color:#fff}
.apps-aj h3{margin:0 0 4px}.apps-aj p{margin:0 0 10px;font-size:13px;opacity:.8}
.apps-aj-l{display:flex;flex-wrap:wrap;gap:6px 18px;margin-bottom:10px}.apps-aj label{font-size:14px;cursor:pointer}
.apps-aj select{font:inherit;margin-left:6px;padding:3px 6px;border-radius:6px}
@media (max-width:600px){.apps-b{font-size:12px;padding:5px 10px}}`;
  document.head.appendChild(st);
  new MutationObserver(colocar).observe(document.documentElement, { childList: true, subtree: true });
  colocar();
})();
