'use strict';
// =====================================================================
//  Centro de Control — traer los datos directamente del Excel
//  «CENTRO CONTROL» (.xlsx), sin pasar por el archivo .json.
//  Usa leerXlsx() de lector-excel.js. Los id salen del contenido de
//  cada fila, así que importar dos veces con «Juntar» no duplica.
// =====================================================================

function excelCentroAImportar(hojas) {
  const H = {}; hojas.forEach(h => { H[h.nombre.trim().toUpperCase()] = h.filas; });
  const tiene = (n) => !!H[n];
  if (!['BIBLIOTECA', 'AMAZON KDP', 'GASTOS', 'VENTA DIRECTA', 'INGRESOS NO KDP'].some(tiene)) return null;
  const colN = (c) => c.split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const val = (hoja, col, fila) => { const f = (H[hoja] || [])[fila - 1] || []; const v = f[colN(col)]; return v === undefined ? '' : v; };
  const ultima = (hoja) => (H[hoja] || []).length;
  const t = (v) => {
    if (v === null || v === undefined || v === true || v === false) return '';
    const s = String(v).split(/\r?\n/).map(x => x.trim()).filter(Boolean).join(' · ');
    return ['-', '#VALUE!', '#N/A', '#REF!', '#DIV/0!', 'N/A', 'None'].includes(s) ? '' : s;
  };
  const lineas = (v) => String(v ?? '').split(/\r?\n|,(?=\s*\S)/).map(x => x.trim()).filter(x => x && x !== '-');
  const num = (v) => { if (v === '' || v === null || v === undefined || v === '-') return ''; const x = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.')); return Number.isFinite(x) ? x : ''; };
  const fecha = (v) => {
    if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
    const s = String(v ?? '').trim();
    let m = s.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); if (m) return `${m[1]}-${m[2]}-${m[3] || '01'}`;
    m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
    return '';
  };
  const mes = (v) => fecha(v).slice(0, 7);
  const si = (v) => /^s/i.test(t(v));
  const pct = (parte, base) => base ? Math.round(n(parte) / n(base) * 10000) / 100 : 0;
  // id estable a partir del contenido de la fila
  const idDe = (pref, ...cosas) => { let h = 2166136261; const s = cosas.join('|'); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return pref + (h >>> 0).toString(36); };
  const vistos = new Map();
  const unico = (id) => { const k = (vistos.get(id) || 0) + 1; vistos.set(id, k); return k > 1 ? id + '-' + k : id; };

  const d = { libros: [], kdp: { ventas: [], kenp: [] }, ingresos: [], ventas: [], gastos: [], impuestos: [], ajustes: {} };

  // ---- Libros (BIBLIOTECA, fila 8 en adelante) ----
  for (let r = 8; r <= ultima('BIBLIOTECA'); r++) {
    const g = (c) => val('BIBLIOTECA', c, r);
    const titulo = t(g('A')); if (!titulo) continue;
    const ref = t(g('Z'));
    const l = {
      id: unico(ref ? 'x' + ref : idDe('l', titulo, t(g('M')), t(g('R')))), titulo, subtitulo: t(g('B')), sinopsis: t(g('D')) ? String(g('D')).trim() : '', frase: t(g('E')),
      serie: t(g('F')), genero: t(g('G')), tropos: lineas(g('H')), estado: t(g('I')) || 'Activo', afiliado: t(g('J')), extracto: t(g('K')), opinion: t(g('L')),
      fechaPub: fecha(g('M')), reedicion: si(g('N')), fechaReed: fecha(g('O')), categorias: String(g('P') ?? '').split(/\r?\n/).map(x => x.trim()).filter(x => x && x !== '-'),
      keywords: [], asin: /^[A-Z0-9]{10}$/.test(t(g('R'))) ? t(g('R')) : '', isbnAmazon: t(g('S')), isbnPropio: t(g('T')), deposito: t(g('U')),
      booktrailer: t(g('V')), spotify: t(g('W')), pinterest: t(g('X')), maps: t(g('Y')), prioridad: t(g('AA')), universo: t(g('AB')), estadoComercial: t(g('AC')),
      select: si(g('AG')), renovSelect: fecha(g('AH')), codigos: [], idioma: 'es',
    };
    // Palabras clave: una por línea; las líneas tipo «Cambiadas 28-12-23» van a notas
    const kwLineas = String(g('Q') ?? '').split(/\r?\n/).map(x => x.replace(/^"+|"+$/g, '').trim()).filter(x => x && x !== '-');
    l.keywords = kwLineas.filter(x => !/^cambiad/i.test(x));
    const kwNotas = kwLineas.filter(x => /^cambiad/i.test(x)); if (kwNotas.length) l.notasKw = kwNotas.join(' · ');
    if (/\b(series|book)\b/i.test(l.serie)) l.idioma = 'en';
    if (!l.asin && /^[A-Z0-9]{10}$/.test(t(g('R')).toUpperCase())) l.asin = t(g('R')).toUpperCase();
    d.libros.push(l);
  }

  // ---- Amazon KDP: ventas desde la fila 17 hasta el bloque «KENP · PEGA AQUÍ»; KENP debajo ----
  if (tiene('AMAZON KDP')) {
    let marca = 0;
    for (let r = 17; r <= ultima('AMAZON KDP'); r++) if (/^KENP/i.test(t(val('AMAZON KDP', 'A', r)))) { marca = r; break; }
    const finV = marca ? marca - 1 : ultima('AMAZON KDP');
    for (let r = 17; r <= finV; r++) {
      const g = (c) => val('AMAZON KDP', c, r);
      const titulo = t(g('B')), m = mes(g('A'));
      if (!titulo || !m || /^total/i.test(titulo)) continue;
      const vend = num(g('H')) || 0, dev = num(g('I')) || 0;
      const f = { mes: m, titulo, codigo: t(g('D')), tienda: t(g('E')), tipo: t(g('F')), transaccion: t(g('G')), vendidas: vend, devueltas: dev,
        netas: num(g('J')) !== '' ? num(g('J')) : vend - dev, precio: num(g('K')) || 0, oferta: num(g('L')) || 0, coste: num(g('M')) || 0,
        regalias: num(g('N')) || 0, moneda: (t(g('O')) || 'EUR').toUpperCase() };
      f.id = unico(idDe('v', f.mes, f.codigo, f.titulo, f.tienda, f.tipo, f.transaccion, f.netas, f.regalias, f.moneda));
      d.kdp.ventas.push(f);
    }
    if (marca) for (let r = marca + 1; r <= ultima('AMAZON KDP'); r++) {
      const g = (c) => val('AMAZON KDP', c, r);
      const titulo = t(g('B')), m = mes(g('A')), p = num(g('F'));
      if (!titulo || !m || p === '' || /^(t[ií]tulo|total)/i.test(titulo)) continue;
      const f = { mes: m, titulo, codigo: t(g('D')), tienda: t(g('E')), paginas: p };
      f.id = unico(idDe('k', f.mes, f.codigo, f.titulo, f.tienda, f.paginas));
      d.kdp.kenp.push(f);
    }
  }

  // ---- Ingresos que no son de Amazon ----
  for (let r = 8; r <= ultima('INGRESOS NO KDP'); r++) {
    const g = (c) => val('INGRESOS NO KDP', c, r);
    const bruto = num(g('E'));
    if (!t(g('B')) && !bruto) continue;
    const i = { fecha: fecha(g('A')), concepto: t(g('B')), linea: t(g('C')), cliente: t(g('D')), bruto: bruto || 0, irpfPct: pct(g('F'), bruto), ivaPct: pct(g('G'), bruto),
      estado: t(g('I')) || 'Pendiente', metodo: t(g('J')), factura: t(g('K')), notas: [t(g('L')), t(g('M'))].filter(Boolean).join(' · ') };
    i.id = unico(idDe('i', i.fecha, i.concepto, i.cliente, i.bruto, i.factura));
    d.ingresos.push(i);
  }

  // ---- Venta directa ----
  for (let r = 8; r <= ultima('VENTA DIRECTA'); r++) {
    const g = (c) => val('VENTA DIRECTA', c, r);
    if (!t(g('C')) && !t(g('D'))) continue;
    const v = { fecha: fecha(g('A')), pedido: t(g('B')), cliente: t(g('C')), libro: t(g('D')), formato: t(g('E')) || 'Edición especial', uds: num(g('F')) || 1, pvp: num(g('G')) || 0,
      costeUd: num(g('J')) || 0, envioCobrado: num(g('K')) || 0, costeEnvio: num(g('L')) || 0, regalos: num(g('M')) || 0,
      estado: t(g('O')) || 'Pendiente', seguimiento: t(g('P')), notas: t(g('R')) };
    v.id = unico(idDe('d', v.fecha, v.pedido, v.cliente, v.libro, v.uds, v.pvp));
    d.ventas.push(v);
  }

  // ---- Gastos ----
  for (let r = 8; r <= ultima('GASTOS'); r++) {
    const g = (c) => val('GASTOS', c, r);
    if (!t(g('B'))) continue;
    let base = num(g('G')), iva = num(g('H')) || 0; const total = num(g('I'));
    if (base === '' && total) base = total - iva;
    const x = { fecha: fecha(g('A')), concepto: t(g('B')), cat: t(g('C')) || 'Otros', subcat: t(g('D')), proveedor: t(g('E')), libro: t(g('F')), base: base || 0,
      ivaPct: base ? Math.round(iva / base * 100) : 0, pagado: si(g('J')), metodo: t(g('K')), deducible: !/^n/i.test(t(g('L'))), notas: t(g('M')) };
    x.id = unico(idDe('g', x.fecha, x.concepto, x.proveedor, x.base));
    d.gastos.push(x);
  }

  // ---- Ajustes (CONFIG) ----
  const cambios = {};
  for (let r = 9; r <= 30; r++) { const k = t(val('CONFIG', 'O', r)).toUpperCase(), v = num(val('CONFIG', 'P', r)); if (/^[A-Z]{3}$/.test(k) && v !== '') cambios[k] = v; }
  if (Object.keys(cambios).length) d.ajustes.cambios = cambios;
  const obj = num(val('CONFIG', 'B', 10)); if (obj) d.ajustes.objetivo = obj;
  const saldo = num(val('CONFIG', 'B', 11)); if (saldo !== '') d.ajustes.saldoInicial = saldo;

  return { app: 'centro', tipo: 'importar-excel', version: 1, fecha: new Date().toISOString(), datos: d };
}

// Abre un .json (copia o importación) o el Excel del Centro de Control
async function leerArchivoCentro(f) {
  if (/\.xls[xm]$/i.test(f.name)) {
    const hojas = await leerArchivoTabla(f);
    const j = excelCentroAImportar(hojas);
    if (!j) throw new Error('Ese Excel no parece el Centro de Control: no tiene las hojas BIBLIOTECA, AMAZON KDP, GASTOS…');
    return j;
  }
  return JSON.parse(await f.text());
}
