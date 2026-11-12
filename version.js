// Versión de la app en Ajustes y botón «Buscar actualización».
// Lee la versión instalada del service worker (nombre de su caché) y la publicada (sw.js en la web).
// Se coloca debajo de la tarjeta que contiene el elemento indicado en data-ancla.
(function () {
  'use strict';
  const yo = document.currentScript;
  const ANCLA = (yo && yo.dataset.ancla) || '';
  const PREFIJO = (yo && yo.dataset.prefijo) || '';
  const leerPublicada = () => fetch('sw.js?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.text() : '').then(t => ((t.match(/VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || '')).catch(() => '');
  async function instalada() {
    try {
      if ('caches' in window) {
        const ks = (await caches.keys()).filter(k => !PREFIJO || k.startsWith(PREFIJO));
        if (ks.length) return ks.sort().pop();
      }
    } catch (e) { /* sin caché */ }
    return '';
  }
  const bonito = v => { const n = (String(v).match(/(\d+)$/) || [])[1]; return n ? 'versión ' + n : (v || '—'); };

  async function pintar(caja) {
    const [inst, pub] = await Promise.all([instalada(), leerPublicada()]);
    const actual = inst || pub;
    const nueva = inst && pub && inst !== pub;
    caja.innerHTML = `<span>Tienes la <b>${bonito(actual)}</b>${nueva ? ` · <b class="ver-nueva">hay una nueva (${bonito(pub)})</b>` : pub && inst ? ' · es la última' : ''}</span>
      <button type="button" class="ver-btn">${nueva ? 'Actualizar ahora' : 'Buscar actualización'}</button>`;
    caja.querySelector('.ver-btn').addEventListener('click', async (ev) => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Buscando…';
      const pub2 = await leerPublicada();
      const inst2 = await instalada();
      if (pub2 && inst2 && pub2 === inst2 && !nueva) { b.textContent = 'Ya tienes la última'; setTimeout(() => pintar(caja), 2500); return; }
      b.textContent = 'Actualizando…';
      try { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch (e) { /* sin service worker */ }
      setTimeout(() => location.reload(), 1500);
    });
  }
  function colocar() {
    if (!ANCLA) return;
    const a = document.querySelector(ANCLA);
    if (!a) return;
    const tarjeta = a.closest('.card, .tarjeta') || a.parentElement;
    if (!tarjeta || !tarjeta.parentElement || tarjeta.parentElement.querySelector(':scope > .ver-app')) return;
    const caja = document.createElement('div');
    caja.className = 'ver-app';
    caja.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;font-size:13px;opacity:.85;padding:10px 4px;margin:6px 0 0;border-top:1px dashed rgba(0,0,0,.15)';
    tarjeta.after(caja);
    pintar(caja);
  }
  const st = document.createElement('style');
  st.textContent = '.ver-app .ver-btn{font:inherit;font-size:12px;font-weight:700;border:1px solid rgba(0,0,0,.18);background:transparent;color:inherit;border-radius:999px;padding:4px 12px;cursor:pointer}.ver-app .ver-btn:disabled{opacity:.6;cursor:default}.ver-app .ver-nueva{color:#a8742a}';
  document.head.appendChild(st);
  new MutationObserver(colocar).observe(document.documentElement, { childList: true, subtree: true });
  colocar();
})();
