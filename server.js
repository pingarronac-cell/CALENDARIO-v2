// ================================================================
// SERVIDOR - CALENDARIO DE PRODUCCIÓN v4
// Ferralia · Piera & Viladecans
// ================================================================
const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT    = 3000;

// Users allowed to set Orden de Trabajo (OT)
const OT_ALLOWED = ['GREGORY LAMOTHE','MARC','ROSA','CRISTINA','RAUL MORIANO','ALBERTO','JORDI PEDROSA','XAVI MUÑOZ'];
const DB_FILE = path.join(__dirname, 'database.json');

// ── Default database ─────────────────────────────────────────
function defaultDB() {
  return {
    users: {
      'ALBERTO':         { pin: 'admin123', role: 'admin' },
      'JORDI PEDROSA':   { pin: 'admin123', role: 'admin' },
      'XAVI MUÑOZ':      { pin: 'admin123', role: 'admin' },
      'ANGEL BORDONADA': { pin: '0000', role: 'tecnico' },
      'ASIEL CARMONA':   { pin: '0000', role: 'tecnico' },
      'CRISTINA':        { pin: '0000', role: 'tecnico' },
      'GALO':            { pin: '0000', role: 'tecnico' },
      'GREGORY LAMOTHE': { pin: '0000', role: 'tecnico' },
      'JOAN LLADOS':     { pin: '0000', role: 'tecnico' },
      'JORDI CASTILLO':  { pin: '0000', role: 'tecnico' },
      'RAUL MORIANO':    { pin: '0000', role: 'tecnico' },
      'ROSA':            { pin: '0000', role: 'tecnico' },
      'MARC':             { pin: '0000', role: 'tecnico' },
      'CARLOS':          { pin: '0000', role: 'taller' },
      'ANDRIY':          { pin: '0000', role: 'taller' },
      'ANTONIO':         { pin: '0000', role: 'taller' },
      'ROBERTO':         { pin: '0000', role: 'taller' },
      'SOLO LECTURA':    { pin: '', role: 'readonly' },
    },
    plantas: {
      piera: {
        pedidos: {},
        festivos: [],
        capacidad: { elaborado: 50000, soldado: 20000 },
        transportistas: [
          'SU CAMION','SANTOS - JOSE','SANTOS - JORDI 1','MIGUEL ANGEL ROMERO',
          'DAVID RODRIGUEZ','JORGE FERRALIA','CABA - ADRIAN','CABA - ANGEL',
          'CABA - CESAR','CABA - PACO','CABA - RAFAEL','CABA - RAMON','SERVETO'
        ],
      },
      viladecans: {
        pedidos: {},
        festivos: [],
        capacidad: { elaborado: 40000, soldado: 15000 },
        transportistas: [
          'SU CAMION','SANTOS - JOSE','SANTOS - JORDI 1','MIGUEL ANGEL ROMERO',
          'DAVID RODRIGUEZ','JORGE FERRALIA','CABA - ADRIAN','CABA - ANGEL',
          'CABA - CESAR','CABA - PACO','CABA - RAFAEL','CABA - RAMON','SERVETO'
        ],
      },
    },
    obras: [],  // populated on first load
  };
}

function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const d = defaultDB();
      d.obras = require('./obras_data.json');
      saveDB(d); return d;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) { 
    const d = defaultDB();
    try { d.obras = require('./obras_data.json'); } catch(e2) { d.obras = []; }
    return d;
  }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8'); }

// Init
const _db = loadDB();
if (!_db.plantas) {
  const def = defaultDB();
  _db.plantas = def.plantas;
}
// Ensure both plants exist
['piera','viladecans'].forEach(p => {
  if (!_db.plantas[p]) _db.plantas[p] = defaultDB().plantas[p];
  if (!_db.plantas[p].capacidad) _db.plantas[p].capacidad = { elaborado: 50000, soldado: 20000 };
  if (!_db.plantas[p].festivos) _db.plantas[p].festivos = [];
  if (!_db.plantas[p].transportistas) _db.plantas[p].transportistas = defaultDB().plantas.piera.transportistas;
});
saveDB(_db);

// ── MIME ─────────────────────────────────────────────────────
const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript',
  '.css':'text/css',
  '.json':'application/json',
  '.ico':'image/x-icon',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.webmanifest':'application/manifest+json',
};

// ── Helpers ──────────────────────────────────────────────────
function sendJSON(res, code, data) {
  res.writeHead(code, {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type',
  });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => { try { resolve(JSON.parse(b||'{}')); } catch(e) { resolve({}); } });
  });
}

// ── Capacity check ───────────────────────────────────────────
function checkCapacity(db, planta, dateStr, kgElab, kgSold, excludeKey) {
  const pedidos = db.plantas[planta].pedidos;
  const cap     = db.plantas[planta].capacidad;
  let totalElab = 0, totalSold = 0;
  Object.entries(pedidos).forEach(([key, p]) => {
    if (key === excludeKey) return;
    if (key.startsWith(dateStr + '__')) {
      totalElab += parseFloat(p.kgElab) || 0;
      totalSold += parseFloat(p.kgSold) || 0;
    }
  });
  const newElab = totalElab + (parseFloat(kgElab) || 0);
  const newSold = totalSold + (parseFloat(kgSold) || 0);
  return {
    ok: newElab <= cap.elaborado && newSold <= cap.soldado,
    elaborado: { used: totalElab, new: newElab, max: cap.elaborado, over: newElab > cap.elaborado },
    soldado:   { used: totalSold, new: newSold, max: cap.soldado,   over: newSold > cap.soldado },
  };
}

// ── Compact pedidos (fill gaps) ──────────────────────────────
function compactDay(db, planta, dateStr) {
  const pedidos = db.plantas[planta].pedidos;
  const dayKeys = Object.keys(pedidos)
    .filter(k => k.startsWith(dateStr + '__'))
    .sort((a, b) => parseInt(a.split('__')[1]) - parseInt(b.split('__')[1]));
  
  const values = dayKeys.map(k => pedidos[k]);
  dayKeys.forEach(k => delete pedidos[k]);
  values.forEach((v, i) => { pedidos[`${dateStr}__${i}`] = v; });
}

// ── SERVER ───────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed   = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method   = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type',
    });
    return res.end();
  }

  // ── LOGIN ──────────────────────────────────────────────────
  if (pathname === '/api/login' && method === 'POST') {
    const { username, pin } = await readBody(req);
    if (!username) return sendJSON(res, 400, { error: 'Usuario requerido' });
    const db = loadDB();
    const u  = db.users[username];
    if (!u) return sendJSON(res, 401, { error: 'Usuario no encontrado' });
    // Readonly user: no PIN required
    if (u.role === 'readonly') {
      return sendJSON(res, 200, { ok: true, username, role: 'readonly' });
    }
    if (pin !== u.pin) return sendJSON(res, 401, { error: 'PIN incorrecto' });
    return sendJSON(res, 200, { ok: true, username, role: u.role });
  }

  // ── CHANGE PIN ─────────────────────────────────────────────
  if (pathname === '/api/change-pin' && method === 'POST') {
    const { username, oldPin, newPin } = await readBody(req);
    const db = loadDB();
    const u  = db.users[username];
    if (!u) return sendJSON(res, 403, { error: 'Usuario no encontrado' });
    if (u.pin !== oldPin) return sendJSON(res, 401, { error: 'PIN actual incorrecto' });
    if (!newPin || newPin.length < 4) return sendJSON(res, 400, { error: 'El PIN debe tener al menos 4 caracteres' });
    db.users[username].pin = newPin;
    saveDB(db);
    return sendJSON(res, 200, { ok: true });
  }

  // ── RESET PIN (admin only) ─────────────────────────────────
  if (pathname === '/api/reset-pin' && method === 'POST') {
    const { requesterUsername, requesterPin, targetUsername, newPin } = await readBody(req);
    const db = loadDB();
    const requester = db.users[requesterUsername];
    // Allow bypass from settings panel (admin already authenticated)
    const pinOk = requesterPin === '_admin_settings' || (requester && requester.pin === requesterPin);
    if (!requester || requester.role !== 'admin' || !pinOk)
      return sendJSON(res, 403, { error: 'Solo administradores pueden resetear PINs' });
    if (!db.users[targetUsername]) return sendJSON(res, 404, { error: 'Usuario no encontrado' });
    db.users[targetUsername].pin = newPin || '0000';
    saveDB(db);
    return sendJSON(res, 200, { ok: true });
  }

  // ── GET CONFIG ─────────────────────────────────────────────
  if (pathname === '/api/config' && method === 'GET') {
    const db = loadDB();
    return sendJSON(res, 200, {
      users: Object.entries(db.users).map(([name, u]) => ({ name, role: u.role })),
      obras: db.obras,
      plantas: {
        piera: {
          capacidad:      db.plantas.piera.capacidad,
          festivos:       db.plantas.piera.festivos,
          transportistas: db.plantas.piera.transportistas,
        },
        viladecans: {
          capacidad:      db.plantas.viladecans.capacidad,
          festivos:       db.plantas.viladecans.festivos,
          transportistas: db.plantas.viladecans.transportistas,
        },
      },
    });
  }

  // ── UPDATE CONFIG (admin only) ─────────────────────────────
  if (pathname === '/api/config' && method === 'POST') {
    const body = await readBody(req);
    if (body.requesterRole !== 'admin') return sendJSON(res, 403, { error: 'Solo administradores' });
    const db = loadDB();

    if (body.obras) db.obras = body.obras;

    // Per-plant settings
    ['piera','viladecans'].forEach(p => {
      if (body[p]) {
        if (body[p].capacidad)      db.plantas[p].capacidad      = body[p].capacidad;
        if (body[p].festivos)       db.plantas[p].festivos       = body[p].festivos;
        if (body[p].transportistas) db.plantas[p].transportistas = body[p].transportistas;
      }
    });

    // Users
    if (body.addUser) {
      const { name, role, pin } = body.addUser;
      if (!name || !role) return sendJSON(res, 400, { error: 'Nombre y rol requeridos' });
      const key2 = name.trim().toUpperCase();
      const existingPin = db.users[key2]?.pin || '0000';
      const finalPin = (!pin || pin === 'keep') ? existingPin : pin;
      db.users[key2] = { role, pin: finalPin };
    }
    if (body.removeUser) {
      if (['ALBERTO','JORDI PEDROSA'].includes(body.removeUser))
        return sendJSON(res, 400, { error: 'No se puede eliminar el administrador principal' });
      delete db.users[body.removeUser];
    }

    saveDB(db);
    return sendJSON(res, 200, {
      ok: true,
      users: Object.entries(db.users).map(([name, u]) => ({ name, role: u.role })),
      obras: db.obras,
      plantas: {
        piera:      { capacidad: db.plantas.piera.capacidad, festivos: db.plantas.piera.festivos, transportistas: db.plantas.piera.transportistas },
        viladecans: { capacidad: db.plantas.viladecans.capacidad, festivos: db.plantas.viladecans.festivos, transportistas: db.plantas.viladecans.transportistas },
      },
    });
  }

  // ── GET PEDIDOS ────────────────────────────────────────────
  if (pathname === '/api/pedidos' && method === 'GET') {
    const { planta, week } = parsed.query;
    if (!planta) return sendJSON(res, 400, { error: 'planta requerida' });
    const db = loadDB();
    if (!week) return sendJSON(res, 200, db.plantas[planta].pedidos);
    const base = new Date(week + 'T12:00:00');
    const days = Array.from({length:5}, (_, i) => {
      const d = new Date(base); d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
    const out = {};
    Object.entries(db.plantas[planta].pedidos).forEach(([k, v]) => {
      if (days.includes(k.split('__')[0])) out[k] = v;
    });
    return sendJSON(res, 200, out);
  }

  // ── CHECK CAPACITY ─────────────────────────────────────────
  if (pathname === '/api/check-capacity' && method === 'POST') {
    const { planta, dateStr, kgElab, kgSold, excludeKey } = await readBody(req);
    const db = loadDB();
    return sendJSON(res, 200, checkCapacity(db, planta, dateStr, kgElab, kgSold, excludeKey));
  }

  // ── SAVE PEDIDO ────────────────────────────────────────────
  if (pathname === '/api/pedidos' && method === 'POST') {
    const body = await readBody(req);
    const { planta, key, data, forceOverCapacity } = body;
    if (!planta || !key) return sendJSON(res, 400, { error: 'planta y key requeridas' });
    const db = loadDB();

    // Festivo check
    const dateStr = key.split('__')[0];
    if (db.plantas[planta].festivos.includes(dateStr))
      return sendJSON(res, 403, { error: 'Este día es festivo. No se pueden añadir pedidos.' });

    const existing = db.plantas[planta].pedidos[key];

    // Permission checks
    if (!existing && data.role === 'taller')
      return sendJSON(res, 403, { error: 'Los encargados de taller no pueden crear pedidos' });
    if (existing && data.editType !== 'estado' && data.editType !== 'observaciones' && data.editType !== 'orden') {
      // Admins can always edit; OT_ALLOWED tecnicos can also edit full pedido
      const canEdit = data.role === 'admin' || OT_ALLOWED.includes(data.author);
      if (!canEdit)
        return sendJSON(res, 403, { error: 'Solo los administradores pueden editar pedidos' });
    }

    // Capacity check (only for new pedidos or kg changes, not estado/obs edits)
    if (!data.editType || data.editType === 'full') {
      const cap = checkCapacity(db, planta, dateStr, data.kgElab, data.kgSold, existing ? key : null);
      if (!cap.ok && !forceOverCapacity) {
        if (data.role !== 'admin') {
          // Find available days (next 7 days)
          const available = [];
          for (let i = 1; i <= 7; i++) {
            const d = new Date(dateStr + 'T12:00:00');
            d.setDate(d.getDate() + i);
            const ds = d.toISOString().split('T')[0];
            if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
            if (db.plantas[planta].festivos.includes(ds)) continue;
            const c2 = checkCapacity(db, planta, ds, data.kgElab, data.kgSold, null);
            if (c2.ok) available.push(ds);
          }
          return sendJSON(res, 409, {
            error: 'capacity',
            message: 'Se supera la capacidad de producción de este día.',
            elaborado: cap.elaborado,
            soldado: cap.soldado,
            available,
          });
        }
        // Admin: warn but allow with forceOverCapacity flag handled above
        // If admin didn't send force flag yet, return warning
        return sendJSON(res, 409, {
          error: 'capacity_admin',
          message: 'Se supera la capacidad. ¿Deseas confirmar igualmente?',
          elaborado: cap.elaborado,
          soldado: cap.soldado,
        });
      }
    }

    if (existing) {
      if (data.editType === 'orden') {
        // OT field: only allowed users, no editedBy/editedAt update
        if (!OT_ALLOWED.includes(data.author))
          return sendJSON(res, 403, { error: 'No tienes permiso para asignar la Orden de Trabajo' });
        db.plantas[planta].pedidos[key].orden = (data.orden||'').toUpperCase().slice(0,3);
        // Deliberately NOT updating editedBy/editedAt — OT is operational only
        saveDB(db);
        return sendJSON(res, 200, { ok: true, pedido: db.plantas[planta].pedidos[key] });
      } else if (data.editType === 'observaciones') {
        db.plantas[planta].pedidos[key].observaciones = data.observaciones;
        db.plantas[planta].pedidos[key].obsAuthor     = data.author;
        db.plantas[planta].pedidos[key].obsAt         = Date.now();
      } else if (data.editType === 'estado') {
        const allowed = {
          admin:   ['planificado','aprobado','impreso','en_produccion','acabado','en_ruta'],
          tecnico: ['planificado','aprobado','impreso'],
          taller:  ['en_produccion','acabado','en_ruta'],
        };
        if (!allowed[data.role]?.includes(data.estado))
          return sendJSON(res, 403, { error: 'No tienes permiso para ese estado' });
        db.plantas[planta].pedidos[key].estado       = data.estado;
        db.plantas[planta].pedidos[key].estadoAuthor = data.author;
        db.plantas[planta].pedidos[key].estadoAt     = Date.now();
      } else {
        // Full edit (admin)
        const old = existing;
        db.plantas[planta].pedidos[key] = {
          ...data,
          author:        old.author,
          createdAt:     old.createdAt,
          editedBy:      data.author,
          editedAt:      Date.now(),
          estado:        old.estado || 'planificado',
          observaciones: old.observaciones || '',
          obsAuthor:     old.obsAuthor || '',
          obsAt:         old.obsAt || null,
        };
        // Handle date change: move pedido to new date/slot
        if (data.newKey && data.newKey !== key) {
          const p = db.plantas[planta].pedidos[key];
          delete db.plantas[planta].pedidos[key];
          // Find next available slot on new date
          const newDateStr = data.newKey.split('__')[0];
          let slot = 0;
          while (db.plantas[planta].pedidos[`${newDateStr}__${slot}`]) slot++;
          db.plantas[planta].pedidos[`${newDateStr}__${slot}`] = p;
          compactDay(db, planta, dateStr);
          saveDB(db);
          return sendJSON(res, 200, { ok: true, movedTo: `${newDateStr}__${slot}` });
        }
      }
    } else {
      // Find next available slot
      let slot = parseInt(key.split('__')[1]);
      while (db.plantas[planta].pedidos[`${dateStr}__${slot}`]) slot++;
      const finalKey = `${dateStr}__${slot}`;
      db.plantas[planta].pedidos[finalKey] = {
        ...data,
        author:        data.author,
        createdAt:     Date.now(),
        editedBy:      null,
        editedAt:      null,
        estado:        'planificado',
        observaciones: '',
        obsAuthor:     '',
        obsAt:         null,
      };
      saveDB(db);
      return sendJSON(res, 200, { ok: true, pedido: db.plantas[planta].pedidos[finalKey], key: finalKey });
    }

    saveDB(db);
    return sendJSON(res, 200, { ok: true, pedido: db.plantas[planta].pedidos[key] });
  }

  // ── DELETE PEDIDO ──────────────────────────────────────────
  if (pathname.startsWith('/api/pedidos/') && method === 'DELETE') {
    const body = await readBody(req);
    if (body.role !== 'admin') return sendJSON(res, 403, { error: 'Solo administradores' });
    const db  = loadDB();
    const key = decodeURIComponent(pathname.replace('/api/pedidos/', ''));
    const { planta } = body;
    if (!planta || !db.plantas[planta]) return sendJSON(res, 400, { error: 'planta requerida' });
    const dateStr = key.split('__')[0];
    delete db.plantas[planta].pedidos[key];
    compactDay(db, planta, dateStr);
    saveDB(db);
    return sendJSON(res, 200, { ok: true });
  }

  // ── DRAG & DROP MOVE ───────────────────────────────────────
  if (pathname === '/api/move' && method === 'POST') {
    const { planta, fromKey, toDateStr, role } = await readBody(req);
    if (role !== 'admin') return sendJSON(res, 403, { error: 'Solo administradores pueden mover pedidos' });
    const db = loadDB();

    if (db.plantas[planta].festivos.includes(toDateStr))
      return sendJSON(res, 403, { error: 'El día destino es festivo' });

    const p = db.plantas[planta].pedidos[fromKey];
    if (!p) return sendJSON(res, 404, { error: 'Pedido no encontrado' });
    const fromDate = fromKey.split('__')[0];

    // Find next slot on target date
    let slot = 0;
    while (db.plantas[planta].pedidos[`${toDateStr}__${slot}`]) slot++;
    db.plantas[planta].pedidos[`${toDateStr}__${slot}`] = { ...p, fecha: toDateStr, editedBy: 'DRAG', editedAt: Date.now() };
    delete db.plantas[planta].pedidos[fromKey];
    compactDay(db, planta, fromDate);
    saveDB(db);
    return sendJSON(res, 200, { ok: true, newKey: `${toDateStr}__${slot}` });
  }

  // ── SEARCH ─────────────────────────────────────────────────
  if (pathname === '/api/search' && method === 'GET') {
    const { planta, q } = parsed.query;
    const db = loadDB();
    const results = [];
    const query = (q || '').toLowerCase();
    Object.entries(db.plantas[planta]?.pedidos || {}).forEach(([key, p]) => {
      if (
        (p.pedido  && p.pedido.toLowerCase().includes(query)) ||
        (p.obra    && p.obra.toLowerCase().includes(query)) ||
        (p.cliente && p.cliente.toLowerCase().includes(query))
      ) {
        results.push({ key, ...p });
      }
    });
    return sendJSON(res, 200, results.slice(0, 20));
  }

  // ── MOVE BETWEEN PLANTAS (admin only) ────────────────────────
  if (pathname === '/api/move-planta' && method === 'POST') {
    const { fromPlanta, toPlanta, key, role } = await readBody(req);
    if (role !== 'admin') return sendJSON(res, 403, { error: 'Solo administradores pueden cambiar de planta' });
    const db = loadDB();
    const p = db.plantas[fromPlanta]?.pedidos[key];
    if (!p) return sendJSON(res, 404, { error: 'Pedido no encontrado' });

    const fromDate = key.split('__')[0];
    // Check destination not festivo
    if (db.plantas[toPlanta].festivos.some(f => (typeof f === 'object' ? f.date : f) === fromDate))
      return sendJSON(res, 403, { error: 'El día es festivo en la planta destino' });

    // Find next available slot in destination planta same date
    let slot = 0;
    while (db.plantas[toPlanta].pedidos[`${fromDate}__${slot}`]) slot++;
    const newKey = `${fromDate}__${slot}`;

    db.plantas[toPlanta].pedidos[newKey] = { ...p, editedBy: 'CAMBIO PLANTA', editedAt: Date.now() };
    delete db.plantas[fromPlanta].pedidos[key];
    compactDay(db, fromPlanta, fromDate);
    saveDB(db);
    return sendJSON(res, 200, { ok: true, newKey, toPlanta });
  }

  // ── EXPORT XLSX ─────────────────────────────────────────────
  if (pathname === '/api/export' && method === 'GET') {
    const { planta } = parsed.query;
    const db   = loadDB();
    const fTs  = ts => ts ? new Date(ts).toLocaleString('es-ES') : '';
    const ELBL = { planificado:'Planificado', aprobado:'Aprobado', impreso:'Impreso', en_produccion:'En producción', acabado:'Acabado', en_ruta:'En ruta' };

    const headers = ['Planta','Fecha','Slot','Estado','Nº Pedidos','Obras','Cliente','Dirección','KG Elaborado','KG Soldado','Transportista','Carga','Notas','Observaciones','Obs. Autor','Autor','Creado','Editado por','Editado'];
    const rows = [];
    const plantasList = planta ? [planta] : ['piera','viladecans'];
    plantasList.forEach(pl => {
      Object.entries(db.plantas[pl]?.pedidos || {}).sort().forEach(([key, p]) => {
        const [ds, slot] = key.split('__');
        const pedidosStr = p.pedidos && p.pedidos.length
          ? p.pedidos.map(r => r.num + (r.desc ? ' · ' + r.desc : '')).join(' | ')
          : (p.pedido || '');
        rows.push([
          pl === 'piera' ? 'Piera' : 'Viladecans',
          ds, parseInt(slot)+1,
          ELBL[p.estado]||'',
          pedidosStr,
          p.obra||'', p.cliente||'', p.direccion||'',
          p.kgElab||'', p.kgSold||'',
          p.transportista||'', p.carga||'',
          p.notas||'', p.observaciones||'', p.obsAuthor||'',
          p.author||'', fTs(p.createdAt), p.editedBy||'', fTs(p.editedAt)
        ]);
      });
    });

    // Build SpreadsheetML XML (opens directly in Excel with correct columns)
    const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const headerRow = headers.map(h => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('');
    const dataRows  = rows.map(r =>
      '<Row>' + r.map(v => {
        const num = typeof v === 'number' || (!isNaN(v) && v !== '' && v !== null);
        return `<Cell><Data ss:Type="${num ? 'Number' : 'String'}">${esc(v)}</Data></Cell>`;
      }).join('') + '</Row>'
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Pedidos">
    <Table>
      <Row>${headerRow.replace(/<Cell>/g,'<Cell ss:StyleID="header">')}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

    const filename = `pedidos_${planta||'all'}_${new Date().toISOString().split('T')[0]}.xls`;
    res.writeHead(200, {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(xml, 'utf8'),
    });
    return res.end(xml, 'utf8');
  }

  // ── STATIC FILES ───────────────────────────────────────────
  const filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    return res.end(fs.readFileSync(filePath));
  }

  res.writeHead(404, { 'Content-Type':'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔═══════════════════════════════════════════════╗');
  console.log('  ║  CALENDARIO DE PRODUCCIÓN · FERRALIA v4       ║');
  console.log('  ║  Piera & Viladecans                           ║');
  console.log('  ╚═══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ✅  Servidor en marcha — puerto ${PORT}`);
  console.log(`  👉  Desde este PC:   http://localhost:${PORT}`);
  console.log(`  👉  Desde la red:    http://[IP-DEL-SERVIDOR]:${PORT}`);
  console.log('');
  console.log('  Cierra esta ventana para parar el servidor.');
  console.log('');
});
