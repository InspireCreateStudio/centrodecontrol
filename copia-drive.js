// Copias de seguridad en Google Drive: carpeta «Copias de seguridad · Inspire & Create» en tu Drive.
// Cada app sube ahí su copia y se quedan solo las dos últimas de esa app (la anterior a la anterior se borra).
// Usa el permiso drive.file: la app solo ve y toca los archivos que ha creado ella.
(function () {
  'use strict';
  const CARPETA = 'Copias de seguridad · Inspire & Create';
  const GUARDAR = 2;
  const API = 'https://www.googleapis.com/drive/v3/files';
  const SUBIR = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';
  const q = (s) => encodeURIComponent(s);
  const comillas = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  async function llamar(token, url, opts = {}) {
    const r = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.headers || {}) } });
    if (r.status === 401) throw Object.assign(new Error('token'), { tipo: 'token' });
    if (r.status === 403) throw Object.assign(new Error('permiso'), { tipo: 'permiso' });
    if (!r.ok) throw new Error('drive ' + r.status);
    return r;
  }
  async function carpeta(token) {
    const busca = `name='${comillas(CARPETA)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const r = await (await llamar(token, `${API}?q=${q(busca)}&fields=files(id)&spaces=drive&pageSize=5`)).json();
    if (r.files && r.files.length) return r.files[0].id;
    const c = await (await llamar(token, `${API}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: CARPETA, mimeType: 'application/vnd.google-apps.folder' }) })).json();
    return c.id;
  }

  // prefijo: el principio del nombre de los archivos de esta app (p. ej. «Centro de Control · Copia»)
  async function subir({ token, prefijo, nombre, blob }) {
    const id = await carpeta(token);
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify({ name: nombre, parents: [id], mimeType: 'application/json' })], { type: 'application/json' }));
    fd.append('file', blob);
    await llamar(token, SUBIR, { method: 'POST', body: fd });
    // Me quedo con las dos últimas de esta app y borro las anteriores
    const busca = `'${id}' in parents and name contains '${comillas(prefijo)}' and trashed=false`;
    const l = await (await llamar(token, `${API}?q=${q(busca)}&orderBy=createdTime desc&fields=files(id,name,createdTime)&pageSize=50`)).json();
    const viejas = (l.files || []).filter(f => f.name.startsWith(prefijo)).slice(GUARDAR);
    for (const f of viejas) { try { await llamar(token, `${API}/${f.id}`, { method: 'DELETE' }); } catch (e) { /* si no se puede borrar una, sigo */ } }
    return { borradas: viejas.length };
  }

  // Intenta subir la copia; si no se puede, la descarga (copias a mano) o lo reintenta al próximo toque (automáticas).
  //   app: { conectado(), token(), olvidarToken(), descargar(blob, nombre), aviso(texto) }
  async function guardar({ app, prefijo, nombre, blob, auto }) {
    if (!app.conectado()) { app.descargar(blob, nombre); return 'descargas'; }
    try {
      const token = await app.token();
      await subir({ token, prefijo, nombre, blob });
      try { localStorage.removeItem('copia-drive:permiso:' + prefijo); } catch (e) { /* nada */ }
      app.aviso(`Copia guardada en tu Google Drive, en la carpeta «${CARPETA}». Me quedo con las dos últimas.`);
      return 'drive';
    } catch (e) {
      if (e && (e.tipo === 'token' || e.tipo === 'permiso')) { try { app.olvidarToken(); } catch (x) { /* nada */ } }
      if (e && e.tipo === 'permiso') { try { localStorage.setItem('copia-drive:permiso:' + prefijo, '1'); } catch (x) { /* nada */ } }
      if (auto && (!e || e.tipo !== 'permiso')) {
        // Sin sesión de Google ahora mismo (o sin conexión): lo intento cuando vuelvas a tocar la app
        const otraVez = () => { document.removeEventListener('click', otraVez, true); setTimeout(() => guardar({ app, prefijo, nombre, blob, auto: false }), 300); };
        document.addEventListener('click', otraVez, true);
        return 'pendiente';
      }
      app.descargar(blob, nombre);
      app.aviso(e && e.tipo === 'permiso'
        ? 'No he podido guardar la copia en Drive porque falta tu permiso: la he dejado en Descargas. En Ajustes, desconecta y vuelve a conectar Google Drive para darlo.'
        : 'No he podido guardar la copia en Drive: la he dejado en Descargas.');
      return 'descargas';
    }
  }
  const faltaPermiso = (prefijo) => { try { return !!localStorage.getItem('copia-drive:permiso:' + prefijo); } catch (e) { return false; } };

  window.CopiaDrive = { guardar, subir, faltaPermiso, CARPETA, SCOPE: 'https://www.googleapis.com/auth/drive.file' };
})();
