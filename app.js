'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const store = require('./src/store');
const ussd = require('./src/ussd');
const daraja = require('./src/daraja');
const logger = require('./src/logger');

const BASE_PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}
function parseForm(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      const out = {};
      data.split('&').forEach((pair) => {
        if (!pair) return;
        const [k, v] = pair.split('=');
        out[decodeURIComponent((k || '').replace(/\+/g, ' '))] = decodeURIComponent((v || '').replace(/\+/g, ' '));
      });
      resolve(out);
    });
    req.on('error', reject);
  });
}

function getToken(req) {
  const h = req.headers['authorization'] || '';
  if (h.toLowerCase().startsWith('bearer ')) return h.slice(7).trim();
  const q = url.parse(req.url, true).query;
  if (q.token) return q.token;
  return null;
}
function getSession(req) {
  const data = store.read();
  const token = getToken(req);
  if (!token) return null;
  const s = (data.sessions || []).find((x) => x.token === token && new Date(x.expires) > new Date());

  if (!s) return null;
  const user = (data.users || []).find((u) => u.id === s.userId);
  return user ? { user, token, csrf: s.csrf } : null;
}
function requireAuth(req, res) {
  const s = getSession(req);
  if (!s) { sendJson(res, 401, { error: 'Authentication required' }); return null; }
  return s;
}
function requireAdmin(req, res) {
  const s = requireAuth(req, res);
  if (!s) return null;
  if (s.user.role !== 'admin') { sendJson(res, 403, { error: 'Admin required' }); return null; }
  return s;
}

function getUser(data, userId) {
  let u = (data.users || []).find((x) => x.id === userId);
  if (!u) {
    u = { id: userId, name: 'Guest', email: '', role: 'customer', phone: '', accessibility: { fontSize: 'large', contrast: 'normal', voice: false }, caregiver: { name: '', phone: '' }, emergencyContacts: [], insurance: { provider: '', policy: '' }, createdAt: new Date().toISOString() };
    data.users.push(u);
    store.write(data);
  }
  return u;
}

function addNotification(data, userId, title, message, type = 'info') {
  data.notifications = data.notifications || [];
  data.notifications.push({ id: store.uid('n'), userId, title, message, type, read: false, createdAt: new Date().toISOString() });
}

const rateLimitMap = new Map();
function rateLimit(req, res) {
  const ip = req.socket.remoteAddress || 'unknown';
  let key = ip;
  try {
    const tok = getToken(req);
    if (tok) key = 'u:' + tok;
  } catch (e) {}
  const now = Date.now();
  const windowMs = 60000;
  const max = 120;
  const rec = rateLimitMap.get(key) || { count: 0, reset: now + windowMs };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + windowMs; }
  rec.count++;
  rateLimitMap.set(key, rec);
  if (rec.count > max) { sendJson(res, 429, { error: 'Too many requests' }); return false; }
  return true;
}

function routeApi(req, res, pathname) {
  if (!rateLimit(req, res)) return;
  const method = req.method;
  const data = store.read();
  const q = url.parse(req.url, true).query;
  // Optional CSRF enforcement (only when client sends the header)
  if (method !== 'GET' && method !== 'HEAD' && !pathname.startsWith('/api/auth/') && pathname !== '/webhook') {
    const sess = getSession(req);
    if (sess && req.headers['x-csrf-token'] && req.headers['x-csrf-token'] !== sess.csrf) {
      return sendJson(res, 403, { error: 'Invalid CSRF token' });
    }
  }

  // ---------- health ----------
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, { status: 'ok', name: 'Cucu Connect', version: '3.0.0', time: new Date().toISOString(), uptime: process.uptime(), dbMode: (process.env.DB_MODE || 'json'), recentErrors: logger.recent().filter((e) => e.level === 'error').length });
  }
  if (pathname === '/api/services' && method === 'GET') {
    return sendJson(res, 200, { services: data.services });
  }

  // ---------- auth ----------
  if (pathname === '/api/auth/register' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { name, email, password, phone, role } = body;
      if (!name || !email || !password) return sendJson(res, 400, { error: 'name, email, password required' });
      if ((data.users || []).some((u) => u.email === email.toLowerCase())) return sendJson(res, 409, { error: 'Email already registered' });
      const isFirst = (data.users || []).length === 0;
      const user = {
        id: store.uid('u'),
        name,
        email: email.toLowerCase(),
        password: store.hashPassword(password),
        phone: phone || '',
        role: isFirst ? 'admin' : (['customer','caregiver','provider','delivery'].includes(role) ? role : 'customer'),
        accessibility: { fontSize: 'large', contrast: 'normal', voice: false },
        caregiver: { name: '', phone: '' },
        emergencyContacts: [],
        insurance: { provider: '', policy: '' },
        createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      const token = store.uid('tok');
      data.sessions = data.sessions || [];
      data.sessions.push({ token, userId: user.id, csrf: store.uid('csrf'), expires: new Date(Date.now() + 30 * 86400000).toISOString() });
      store.write(data);
      const { password: _p, ...safe } = user;
      return sendJson(res, 201, { user: safe, token });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/auth/login' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { email, password } = body;
      const user = (data.users || []).find((u) => u.email === (email || '').toLowerCase());
      if (!user || !store.verifyPassword(password || '', user.password || '')) return sendJson(res, 401, { error: 'Invalid credentials' });
      const token = store.uid('tok');
      data.sessions = data.sessions || [];
      // prune old sessions for user
      data.sessions = data.sessions.filter((s) => s.userId !== user.id);
      data.sessions.push({ token, userId: user.id, csrf: store.uid('csrf'), expires: new Date(Date.now() + 30 * 86400000).toISOString() });
      store.write(data);
      const { password: _p, ...safe } = user;
      return sendJson(res, 200, { user: safe, token });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/auth/logout' && method === 'POST') {
    return parseBody(req).then((body) => {
      const token = getToken(req) || body.token;
      const d = store.read();
      d.sessions = (d.sessions || []).filter((s) => s.token !== token);
      store.write(d);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/auth/me' && method === 'GET') {
    const s = getSession(req);
    if (!s) return sendJson(res, 401, { error: 'Not authenticated' });
    const { password: _p, ...safe } = s.user;
    return sendJson(res, 200, { user: safe });
  }
  if (pathname === '/api/csrf' && method === 'GET') {
    const s = getSession(req);
    if (!s) return sendJson(res, 401, { error: 'Not authenticated' });
    return sendJson(res, 200, { csrf: s.csrf });
  }

  // ---------- products ----------
  if (pathname === '/api/products' && method === 'GET') {
    let list = (data.products || []).filter((p) => !p.deletedAt || q.includeDeleted === '1');
    if (q.category) list = list.filter((p) => p.category === q.category);
    if (q.q) {
      const needle = String(q.q).toLowerCase();
      list = list.filter((p) => (p.name + ' ' + p.description + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(needle));
    }
    if (q.tag) list = list.filter((p) => (p.tags || []).includes(q.tag));
    if (q.page) {
      const page = Math.max(1, Number(q.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
      const total = list.length;
      const pages = Math.max(1, Math.ceil(total / limit));
      const start = (page - 1) * limit;
      return sendJson(res, 200, { products: list.slice(start, start + limit), total, page, pages });
    }
    return sendJson(res, 200, { products: list });
  }
  const prodMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (prodMatch) {
    const pid = decodeURIComponent(prodMatch[1]);
    if (method === 'GET') {
      const p = (data.products || []).find((x) => x.id === pid);
      if (!p) return sendJson(res, 404, { error: 'Not found' });
      const reviews = (data.reviews || []).filter((r) => r.productId === pid);
      return sendJson(res, 200, { product: p, reviews });
    }
    const s = requireAdmin(req, res);
    if (!s) return;
    if (method === 'PUT') {
      return parseBody(req).then((body) => {
        const p = (data.products || []).find((x) => x.id === pid);
        if (!p) return sendJson(res, 404, { error: 'Not found' });
        if (body.price !== undefined && (isNaN(Number(body.price)) || Number(body.price) < 0)) return sendJson(res, 400, { error: 'invalid price' });
        if (body.stock !== undefined && (isNaN(Number(body.stock)) || Number(body.stock) < 0 || !Number.isInteger(Number(body.stock)))) return sendJson(res, 400, { error: 'invalid stock' });
        Object.assign(p, body);
        store.write(data);
        return sendJson(res, 200, { product: p });
      }).catch((e) => sendJson(res, 400, { error: e.message }));
    }
    if (method === 'DELETE') {
      const p = (data.products || []).find((x) => x.id === pid);
      if (!p) return sendJson(res, 404, { error: 'Not found' });
      p.deletedAt = new Date().toISOString();
      store.write(data);
      return sendJson(res, 200, { ok: true, softDeleted: true });
    }
  }
  if (pathname === '/api/products' && method === 'POST') {
    const s = requireAdmin(req, res);
    if (!s) return;
    return parseBody(req).then((body) => {
      if (!body.name || body.price === undefined || body.price === null) return sendJson(res, 400, { error: 'name and price required' });
      if (isNaN(Number(body.price))) return sendJson(res, 400, { error: 'price must be a number' });
      if (Number(body.price) < 0) return sendJson(res, 400, { error: 'price cannot be negative' });
      const p = { id: store.uid('p'), name: body.name, category: body.category || 'general', price: Number(body.price), description: body.description || '', stock: Number(body.stock || 0), accessible: body.accessible !== false, tags: body.tags || [] };
      data.products = data.products || [];
      data.products.push(p);
      store.write(data);
      return sendJson(res, 201, { product: p });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- cart ----------
  const cartMatch = pathname.match(/^\/api\/cart\/([^/]+)$/);
  if (cartMatch && method === 'GET') {
    const userId = decodeURIComponent(cartMatch[1]);
    const cart = data.carts[userId] || [];
    const items = cart.map((c) => {
      const p = (data.products || []).find((x) => x.id === c.productId);
      return { ...c, product: p, lineTotal: p ? p.price * c.qty : 0 };
    });
    const total = items.reduce((s, i) => s + i.lineTotal, 0);
    return sendJson(res, 200, { items, total });
  }
  if (pathname === '/api/cart/add' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, productId, qty } = body;
      if (!userId || !productId) return sendJson(res, 400, { error: 'userId and productId required' });
      const q = Number(qty == null ? 1 : qty);
      if (!Number.isFinite(q) || q <= 0 || !Number.isInteger(q)) return sendJson(res, 400, { error: 'qty must be a positive integer' });
      const p = (data.products || []).find((x) => x.id === productId);
      if (!p) return sendJson(res, 404, { error: 'product not found' });
      if (!data.carts[userId]) data.carts[userId] = [];
      const existing = data.carts[userId].find((c) => c.productId === productId);
      if (existing) existing.qty += q;
      else data.carts[userId].push({ productId, qty: q });
      store.write(data);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/cart/remove' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, productId } = body;
      if (!userId || !productId) return sendJson(res, 400, { error: 'userId and productId required' });
      if (!data.carts[userId]) return sendJson(res, 404, { error: 'cart not found' });
      const before = data.carts[userId].length;
      data.carts[userId] = data.carts[userId].filter((c) => c.productId !== productId);
      if (data.carts[userId].length === before) return sendJson(res, 404, { error: 'item not in cart' });
      store.write(data);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/cart/clear' && method === 'POST') {
    return parseBody(req).then((body) => {
      if (!body.userId) return sendJson(res, 400, { error: 'userId required' });
      if (!data.carts[body.userId]) return sendJson(res, 404, { error: 'cart not found' });
      delete data.carts[body.userId];
      store.write(data);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/checkout' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, address, deliveryDate } = body;
      const cart = data.carts[userId] || [];
      if (!cart.length) return sendJson(res, 400, { error: 'cart empty' });
      const items = cart.map((c) => {
        const p = (data.products || []).find((x) => x.id === c.productId);
        return { productId: c.productId, name: p ? p.name : c.productId, price: p ? p.price : 0, qty: c.qty };
      });
      const total = items.reduce((s, i) => s + i.price * i.qty, 0);
      const order = { id: store.uid('o'), userId, items, total, status: 'placed', address: address || '', deliveryDate: deliveryDate || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      data.orders = data.orders || [];
      data.orders.push(order);
      delete data.carts[userId];
      addNotification(data, userId, 'Order placed', 'Your order ' + order.id + ' has been placed.', 'success');
      store.write(data);
      return sendJson(res, 200, { order });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- orders ----------
  if (pathname === '/api/orders' && method === 'GET') {
    const s = requireAdmin(req, res);
    if (!s) return;
    let list = (data.orders || []).filter((o) => !o.deletedAt || q.includeDeleted === '1');
    if (q.status) list = list.filter((o) => o.status === q.status);
    if (q.q) { const n = String(q.q).toLowerCase(); list = list.filter((o) => (o.id + ' ' + o.userId).toLowerCase().includes(n)); }
    if (q.page) {
      const page = Math.max(1, Number(q.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(q.limit) || 50));
      const total = list.length;
      const pages = Math.max(1, Math.ceil(total / limit));
      const start = (page - 1) * limit;
      return sendJson(res, 200, { orders: list.slice(start, start + limit), total, page, pages });
    }
    return sendJson(res, 200, { orders: list });
  }

  const ordersUserMatch = pathname.match(/^\/api\/orders\/user\/([^/]+)$/);
  if (ordersUserMatch && method === 'GET') {
    const userId = decodeURIComponent(ordersUserMatch[1]);
    return sendJson(res, 200, { orders: (data.orders || []).filter((o) => o.userId === userId) });
  }
  const orderDeleteMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderDeleteMatch && method === 'DELETE') {
    const s = requireAdmin(req, res);
    if (!s) return;
    const oid = decodeURIComponent(orderDeleteMatch[1]);
    const o = (data.orders || []).find((x) => x.id === oid);
    if (!o) return sendJson(res, 404, { error: 'Not found' });
    o.deletedAt = new Date().toISOString();
    store.write(data);
    return sendJson(res, 200, { ok: true, softDeleted: true });
  }
  const orderDetailMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (orderDetailMatch && method === 'GET') {
    const oid = decodeURIComponent(orderDetailMatch[1]);
    const o = (data.orders || []).find((x) => x.id === oid);
    if (!o) return sendJson(res, 404, { error: 'Not found' });
    return sendJson(res, 200, { order: o });
  }
  if (pathname === '/api/orders/status' && method === 'POST') {
    const s = requireAuth(req, res);
    if (!s) return;
    return parseBody(req).then((body) => {
      const o = (data.orders || []).find((x) => x.id === body.orderId);
      if (!o) return sendJson(res, 404, { error: 'Not found' });
      if (s.user.role !== 'admin' && o.userId !== s.user.id) return sendJson(res, 403, { error: 'Forbidden' });
      const allowedOrderStatus = ['placed','confirmed','processing','shipped','delivered','cancelled'];
      if (!allowedOrderStatus.includes(body.status)) return sendJson(res, 400, { error: 'invalid status' });
      o.status = body.status;
      o.updatedAt = new Date().toISOString();
      addNotification(data, o.userId, 'Order updated', 'Order ' + o.id + ' is now ' + o.status + '.', 'info');
      store.write(data);
      return sendJson(res, 200, { order: o });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- appointments ----------
  const apptUserMatch = pathname.match(/^\/api\/appointments\/user\/([^/]+)$/);
  if (apptUserMatch && method === 'GET') {
    const userId = decodeURIComponent(apptUserMatch[1]);
    return sendJson(res, 200, { appointments: (data.appointments || []).filter((a) => a.userId === userId) });
  }
  if (pathname === '/api/appointments' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, service, date, time, notes, provider } = body;
      if (!userId || !service || !date) return sendJson(res, 400, { error: 'userId, service, date required' });
      const appt = { id: store.uid('a'), userId, service, date, time: time || '09:00', provider: provider || '', notes: notes || '', status: 'scheduled', createdAt: new Date().toISOString() };
      data.appointments = data.appointments || [];
      data.appointments.push(appt);
      addNotification(data, userId, 'Appointment booked', service + ' on ' + date + ' at ' + appt.time, 'success');
      store.write(data);
      return sendJson(res, 200, { appointment: appt });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/appointments/cancel' && method === 'POST') {
    return parseBody(req).then((body) => {
      const appt = (data.appointments || []).find((a) => a.id === body.id);
      if (!appt) return sendJson(res, 404, { error: 'appointment not found' });
      appt.status = 'cancelled'; store.write(data);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- bills ----------
  const billsUserMatch = pathname.match(/^\/api\/bills\/user\/([^/]+)$/);
  if (billsUserMatch && method === 'GET') {
    const userId = decodeURIComponent(billsUserMatch[1]);
    const userBills = (data.bills || []).filter((b) => b.userId === userId);
    return sendJson(res, 200, { bills: userBills });
  }
  if (pathname === '/api/bills/pay' && method === 'POST') {
    return parseBody(req).then((body) => {
      const bill = (data.bills || []).find((b) => b.id === body.billId);
      if (!bill) return sendJson(res, 404, { error: 'bill not found' });
      bill.status = 'paid';
      bill.paidAt = new Date().toISOString();
      addNotification(data, bill.userId, 'Bill paid', bill.type + ' bill paid.', 'success');
      store.write(data);
      return sendJson(res, 200, { bill });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/bills' && method === 'POST') {
    // create bill (admin/system)
    return parseBody(req).then((body) => {
      const bill = { id: store.uid('b'), userId: body.userId || null, type: body.type, provider: body.provider, amount: Number(body.amount), dueDate: body.dueDate, status: 'unpaid', createdAt: new Date().toISOString() };
      data.bills = data.bills || [];
      data.bills.push(bill);
      store.write(data);
      return sendJson(res, 201, { bill });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- profile ----------
  const profileMatch = pathname.match(/^\/api\/profile\/([^/]+)$/);
  if (profileMatch && method === 'GET') {
    const userId = decodeURIComponent(profileMatch[1]);
    const u = getUser(data, userId);
    store.write(data);
    const d2 = store.read();
    const user = (d2.users || []).find((x) => x.id === userId) || u;
    const { password: _p, ...safe } = user;
    return sendJson(res, 200, { user: safe });
  }
  if (pathname === '/api/profile' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, ...rest } = body;
      if (!userId) return sendJson(res, 400, { error: 'userId required' });
      const u = getUser(data, userId);
      if (rest.name !== undefined) u.name = rest.name;
      if (rest.role !== undefined && ['customer','caregiver','provider','delivery','admin'].includes(rest.role)) u.role = rest.role;
      if (rest.phone !== undefined) u.phone = rest.phone;
      if (rest.email !== undefined) u.email = rest.email;
      if (rest.accessibility) u.accessibility = { ...u.accessibility, ...rest.accessibility };
      if (rest.caregiver) u.caregiver = { ...u.caregiver, ...rest.caregiver };
      if (rest.insurance) u.insurance = { ...u.insurance, ...rest.insurance };
      if (Array.isArray(rest.emergencyContacts)) u.emergencyContacts = rest.emergencyContacts;
      store.write(data);
      const { password: _p, ...safe } = u;
      return sendJson(res, 200, { user: safe });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- medications ----------
  const medsUserMatch = pathname.match(/^\/api\/medications\/user\/([^/]+)$/);
  if (medsUserMatch && method === 'GET') {
    const userId = decodeURIComponent(medsUserMatch[1]);
    return sendJson(res, 200, { medications: (data.medications || []).filter((m) => m.userId === userId) });
  }
  if (pathname === '/api/medications' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, name, dosage, schedule, times, startDate, endDate, notes } = body;
      if (!userId || !name) return sendJson(res, 400, { error: 'userId and name required' });
      const m = { id: store.uid('m'), userId, name, dosage: dosage || '', schedule: schedule || 'daily', times: times || ['08:00'], startDate: startDate || new Date().toISOString().slice(0, 10), endDate: endDate || null, notes: notes || '', logs: [], active: true, createdAt: new Date().toISOString() };
      data.medications = data.medications || [];
      data.medications.push(m);
      addNotification(data, userId, 'Medication added', name + ' added to your schedule.', 'info');
      store.write(data);
      return sendJson(res, 201, { medication: m });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  const medMatch = pathname.match(/^\/api\/medications\/([^/]+)$/);
  if (medMatch) {
    const mid = decodeURIComponent(medMatch[1]);
    if (method === 'PUT') {
      return parseBody(req).then((body) => {
        const m = (data.medications || []).find((x) => x.id === mid);
        if (!m) return sendJson(res, 404, { error: 'Not found' });
        Object.assign(m, body);
        store.write(data);
        return sendJson(res, 200, { medication: m });
      }).catch((e) => sendJson(res, 400, { error: e.message }));
    }
    if (method === 'DELETE') {
      const before = (data.medications || []).length;
      data.medications = (data.medications || []).filter((x) => x.id !== mid);
      if (data.medications.length === before) return sendJson(res, 404, { error: 'medication not found' });
      store.write(data);
      return sendJson(res, 200, { ok: true });
    }
  }
  if (pathname === '/api/medications/log' && method === 'POST') {
    return parseBody(req).then((body) => {
      const m = (data.medications || []).find((x) => x.id === body.medicationId);
      if (!m) return sendJson(res, 404, { error: 'Not found' });
      m.logs = m.logs || [];
      m.logs.push({ taken: !!body.taken, timestamp: body.timestamp || new Date().toISOString(), note: body.note || '' });
      store.write(data);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  const medAdhMatch = pathname.match(/^\/api\/medications\/user\/([^/]+)\/adherence$/);
  if (medAdhMatch && method === 'GET') {
    const userId = decodeURIComponent(medAdhMatch[1]);
    const meds = (data.medications || []).filter((m) => m.userId === userId);
    const totalLogs = meds.reduce((s, m) => s + (m.logs || []).length, 0);
    const taken = meds.reduce((s, m) => s + (m.logs || []).filter((l) => l.taken).length, 0);
    return sendJson(res, 200, { medications: meds.length, logs: totalLogs, taken, adherence: totalLogs ? Math.round((taken / totalLogs) * 100) : 100 });
  }

  // ---------- vitals ----------
  const vitalsUserMatch = pathname.match(/^\/api\/vitals\/user\/([^/]+)$/);
  if (vitalsUserMatch && method === 'GET') {
    const userId = decodeURIComponent(vitalsUserMatch[1]);
    let list = (data.vitals || []).filter((v) => v.userId === userId);
    if (q.type) list = list.filter((v) => v.type === q.type);
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return sendJson(res, 200, { vitals: list });
  }
  if (pathname === '/api/vitals' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, type, value, unit, timestamp, notes } = body;
      if (!userId || !type || value === undefined) return sendJson(res, 400, { error: 'userId, type, value required' });
      const v = { id: store.uid('v'), userId, type, value: Number(value), unit: unit || '', timestamp: timestamp || new Date().toISOString(), notes: notes || '' };
      data.vitals = data.vitals || [];
      data.vitals.push(v);
      store.write(data);
      return sendJson(res, 201, { vital: v });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  const vitalMatch = pathname.match(/^\/api\/vitals\/([^/]+)$/);
  if (vitalMatch && method === 'DELETE') {
    const vid = decodeURIComponent(vitalMatch[1]);
    const before = (data.vitals || []).length;
    data.vitals = (data.vitals || []).filter((x) => x.id !== vid);
    if (data.vitals.length === before) return sendJson(res, 404, { error: 'vital not found' });
    store.write(data);
    return sendJson(res, 200, { ok: true });
  }

  // ---------- subscriptions ----------
  const subsUserMatch = pathname.match(/^\/api\/subscriptions\/user\/([^/]+)$/);
  if (subsUserMatch && method === 'GET') {
    const userId = decodeURIComponent(subsUserMatch[1]);
    return sendJson(res, 200, { subscriptions: (data.subscriptions || []).filter((s) => s.userId === userId) });
  }
  if (pathname === '/api/subscriptions' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, productId, frequency, qty, nextDate } = body;
      if (!userId || !productId) return sendJson(res, 400, { error: 'userId and productId required' });
      const sub = { id: store.uid('sub'), userId, productId, frequency: frequency || 'monthly', qty: qty || 1, nextDate: nextDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), status: 'active', createdAt: new Date().toISOString() };
      data.subscriptions = data.subscriptions || [];
      data.subscriptions.push(sub);
      store.write(data);
      return sendJson(res, 201, { subscription: sub });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  const subMatch = pathname.match(/^\/api\/subscriptions\/([^/]+)$/);
  if (subMatch && method === 'PUT') {
    return parseBody(req).then((body) => {
      const sub = (data.subscriptions || []).find((x) => x.id === decodeURIComponent(subMatch[1]));
      if (!sub) return sendJson(res, 404, { error: 'Not found' });
      if (body.status) {
        if (!['active','paused','cancelled'].includes(body.status)) return sendJson(res, 400, { error: 'invalid status' });
        sub.status = body.status;
      }
      if (body.nextDate) sub.nextDate = body.nextDate;
      if (body.qty) sub.qty = body.qty;
      store.write(data);
      return sendJson(res, 200, { subscription: sub });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/subscriptions/process' && method === 'POST') {
    const s = requireAdmin(req, res);
    if (!s) return;
    const today = new Date().toISOString().slice(0, 10);
    const due = (data.subscriptions || []).filter((sub) => sub.status === 'active' && sub.nextDate <= today);
    const created = [];
    due.forEach((sub) => {
      const p = (data.products || []).find((x) => x.id === sub.productId);
      const order = { id: store.uid('o'), userId: sub.userId, items: [{ productId: sub.productId, name: p ? p.name : sub.productId, price: p ? p.price : 0, qty: sub.qty }], total: (p ? p.price : 0) * sub.qty, status: 'placed', subscriptionId: sub.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      data.orders.push(order);
      created.push(order);
      // advance nextDate by frequency
      const d = new Date(sub.nextDate);
      if (sub.frequency === 'weekly') d.setDate(d.getDate() + 7);
      else if (sub.frequency === 'daily') d.setDate(d.getDate() + 1);
      else d.setMonth(d.getMonth() + 1);
      sub.nextDate = d.toISOString().slice(0, 10);
      addNotification(data, sub.userId, 'Subscription order', 'Recurring order ' + order.id + ' created.', 'info');
    });
    store.write(data);
    return sendJson(res, 200, { processed: due.length, orders: created });
  }

  // ---------- reviews ----------
  if (pathname === '/api/reviews' && method === 'GET') {
    let list = data.reviews || [];
    if (q.productId) list = list.filter((r) => r.productId === q.productId);
    return sendJson(res, 200, { reviews: list });
  }
  if (pathname === '/api/reviews' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, productId, rating, comment } = body;
      if (!userId || !productId || !rating) return sendJson(res, 400, { error: 'userId, productId, rating required' });
      const r = { id: store.uid('r'), userId, productId, rating: Number(rating), comment: comment || '', createdAt: new Date().toISOString() };
      data.reviews = data.reviews || [];
      data.reviews.push(r);
      store.write(data);
      return sendJson(res, 201, { review: r });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- deliveries ----------
  if (pathname === '/api/deliveries' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { orderId, userId, address, preferredDate, timeSlot } = body;
      if (!orderId || !userId) return sendJson(res, 400, { error: 'orderId and userId required' });
      const d = { id: store.uid('d'), orderId, userId, address: address || '', preferredDate: preferredDate || null, timeSlot: timeSlot || 'any', status: 'scheduled', createdAt: new Date().toISOString() };
      data.deliveries = data.deliveries || [];
      data.deliveries.push(d);
      store.write(data);
      return sendJson(res, 201, { delivery: d });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  const delUserMatch = pathname.match(/^\/api\/deliveries\/user\/([^/]+)$/);
  if (delUserMatch && method === 'GET') {
    const userId = decodeURIComponent(delUserMatch[1]);
    return sendJson(res, 200, { deliveries: (data.deliveries || []).filter((d) => d.userId === userId) });
  }

  // ---------- notifications ----------
  const notifUserMatch = pathname.match(/^\/api\/notifications\/user\/([^/]+)$/);
  if (notifUserMatch && method === 'GET') {
    const userId = decodeURIComponent(notifUserMatch[1]);
    const list = (data.notifications || []).filter((n) => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { notifications: list });
  }
  if (pathname === '/api/notifications/read' && method === 'POST') {
    return parseBody(req).then((body) => {
      const n = (data.notifications || []).find((x) => x.id === body.id);
      if (!n) return sendJson(res, 404, { error: 'notification not found' });
      n.read = true; store.write(data);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/notifications/read-all' && method === 'POST') {
    return parseBody(req).then((body) => {
      if (!body.userId) return sendJson(res, 400, { error: 'userId required' });
      (data.notifications || []).forEach((n) => { if (n.userId === body.userId) n.read = true; });
      store.write(data);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- sos ----------
  if (pathname === '/api/sos' && method === 'POST') {
    return parseBody(req).then((body) => {
      const { userId, location } = body;
      if (!userId) return sendJson(res, 400, { error: 'userId required' });
      const u = getUser(data, userId);
      store.write(data);
      const event = { id: store.uid('sos'), userId: u.id, location: location || '', time: new Date().toISOString(), contacts: u.emergencyContacts || [] };
      data.messages = data.messages || [];
      data.messages.push({ type: 'sos', ...event });
      addNotification(data, u.id, 'SOS triggered', 'Emergency alert recorded.', 'danger');
      store.write(data);
      return sendJson(res, 200, { ok: true, message: 'Emergency alert recorded. Contacts notified.', event });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- admin ----------
  if (pathname === '/api/admin/stats' && method === 'GET') {
    const s = requireAdmin(req, res);
    if (!s) return;
    return sendJson(res, 200, {
      users: (data.users || []).length,
      products: (data.products || []).length,
      orders: (data.orders || []).length,
      appointments: (data.appointments || []).length,
      revenue: (data.orders || []).reduce((sum, o) => sum + (o.total || 0), 0),
      unreadNotifications: (data.notifications || []).filter((n) => !n.read).length,
    });
  }
  if (pathname === '/api/admin/users' && method === 'GET') {
    const s = requireAdmin(req, res);
    if (!s) return;
    const users = (data.users || []).map(({ password, ...rest }) => rest);
    return sendJson(res, 200, { users });
  }

  // ---------- payments (Daraja) ----------
  if (pathname === '/api/payments/mpesa/stkpush' && method === 'POST') {
    if (!daraja.isConfigured()) return sendJson(res, 503, { error: 'M-Pesa not configured' });
    return parseBody(req).then(async (body) => {
      const { phone, amount, accountRef, description } = body;
      if (!phone || !amount) return sendJson(res, 400, { error: 'phone and amount required' });
      try {
        const r = await daraja.stkPush({ phone, amount, accountRef, description });
        if (r.status !== 200) return sendJson(res, r.status, r.body);
        // record pending transaction
        data.mpesaTransactions = data.mpesaTransactions || [];
        data.mpesaTransactions.push({ checkoutRequestId: r.body.CheckoutRequestID, phone, amount, status: 'pending', createdAt: new Date().toISOString() });
        store.write(data);
        return sendJson(res, 200, r.body);
      } catch (e) { return sendJson(res, 500, { error: e.message }); }
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  if (pathname === '/api/payments/mpesa/callback' && method === 'POST') {
    return parseBody(req).then((body) => {
      const stk = body.Body && body.Body.stkCallback;
      if (!stk) return sendJson(res, 400, { error: 'invalid callback' });
      const checkoutId = stk.CheckoutRequestID;
      const txs = data.mpesaTransactions || [];
      const tx = txs.find((t) => t.checkoutRequestId === checkoutId);
      if (stk.ResultCode === 0) {
        if (tx) { tx.status = 'success'; tx.mpesaReceipt = (stk.CallbackMetadata && stk.CallbackMetadata.Item && stk.CallbackMetadata.Item.find((i) => i.Name === 'MpesaReceiptNumber')?.Value) || ''; }
        // mark related bill paid if accountRef matches bill id
        const meta = stk.CallbackMetadata && stk.CallbackMetadata.Item ? stk.CallbackMetadata.Item : [];
        const acc = meta.find((i) => i.Name === 'AccountReference');
        if (acc && acc.Value) {
          const bill = (data.bills || []).find((b) => b.id === acc.Value);
          if (bill) { bill.status = 'paid'; bill.paidAt = new Date().toISOString(); }
        }
        store.write(data);
        return sendJson(res, 200, { ok: true, status: 'success' });
      }
      if (tx) tx.status = 'failed';
      store.write(data);
      return sendJson(res, 200, { ok: true, status: 'failed', reason: stk.ResultDesc });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }
  const mpesaStatusMatch = pathname.match(/^\/api\/payments\/mpesa\/status\/([^/]+)$/);
  if (mpesaStatusMatch && method === 'GET') {
    const id = decodeURIComponent(mpesaStatusMatch[1]);
    const tx = (data.mpesaTransactions || []).find((t) => t.checkoutRequestId === id);
    if (!tx) return sendJson(res, 404, { error: 'transaction not found' });
    return sendJson(res, 200, { transaction: tx });
  }

  // ---------- export ----------
  if (pathname === '/api/admin/logs' && method === 'GET') {
    const s = requireAdmin(req, res);
    if (!s) return;
    return sendJson(res, 200, { logs: logger.recent() });
  }
  if (pathname === '/api/admin/backup' && method === 'GET') {
    const s = requireAdmin(req, res);
    if (!s) return;
    return sendJson(res, 200, { data: store.read() });
  }
  if (pathname === '/api/admin/restore' && method === 'POST') {
    const s = requireAdmin(req, res);
    if (!s) return;
    return parseBody(req).then((body) => {
      if (!body.data) return sendJson(res, 400, { error: 'data required' });
      store.write(body.data);
      return sendJson(res, 200, { ok: true });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  const exportUserMatch = pathname.match(/^\/api\/export\/user\/([^/]+)$/);
  if (exportUserMatch && method === 'GET') {
    const userId = decodeURIComponent(exportUserMatch[1]);
    const s = getSession(req);
    if (!s || (s.user.id !== userId && s.user.role !== 'admin')) { sendJson(res, 403, { error: 'Forbidden' }); return; }
    const payload = {
      user: (data.users || []).find((u) => u.id === userId),
      orders: (data.orders || []).filter((o) => o.userId === userId),
      appointments: (data.appointments || []).filter((a) => a.userId === userId),
      medications: (data.medications || []).filter((m) => m.userId === userId),
      vitals: (data.vitals || []).filter((v) => v.userId === userId),
      subscriptions: (data.subscriptions || []).filter((s) => s.userId === userId),
      bills: (data.bills || []).filter((b) => b.userId === userId),
      notifications: (data.notifications || []).filter((n) => n.userId === userId),
    };
    return sendJson(res, 200, payload);
  }

  // ---------- companion: provider ----------
  if (pathname === '/api/provider/appointments' && method === 'GET') {
    const s = requireAuth(req, res);
    if (!s) return;
    if (!['provider','admin'].includes(s.user.role)) { sendJson(res, 403, { error: 'Provider required' }); return; }
    return sendJson(res, 200, { appointments: (data.appointments || []).filter((a) => a.status === 'scheduled') });
  }
  if (pathname === '/api/provider/appointments/status' && method === 'POST') {
    const s = requireAuth(req, res);
    if (!s) return;
    if (!['provider','admin'].includes(s.user.role)) { sendJson(res, 403, { error: 'Provider required' }); return; }
    return parseBody(req).then((body) => {
      const a = (data.appointments || []).find((x) => x.id === body.id);
      if (!a) return sendJson(res, 404, { error: 'Not found' });
      const allowedApptStatus = ['scheduled','confirmed','completed','cancelled','no_show'];
      const newApptStatus = body.status || a.status;
      if (!allowedApptStatus.includes(newApptStatus)) return sendJson(res, 400, { error: 'invalid status' });
      a.status = newApptStatus;
      store.write(data);
      addNotification(data, a.userId, 'Appointment updated', a.service + ' is now ' + a.status + '.', 'info');
      store.write(data);
      return sendJson(res, 200, { appointment: a });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- companion: caregiver overview ----------
  const cgMatch = pathname.match(/^\/api\/caregiver\/overview\/([^/]+)$/);
  if (cgMatch && method === 'GET') {
    const s = requireAuth(req, res);
    if (!s) return;
    if (!['caregiver','admin'].includes(s.user.role)) { sendJson(res, 403, { error: 'Caregiver required' }); return; }
    const patientId = decodeURIComponent(cgMatch[1]);
    const patient = (data.users || []).find((u) => u.id === patientId);
    if (!patient) return sendJson(res, 404, { error: 'Patient not found' });
    return sendJson(res, 200, {
      patient: { id: patient.id, name: patient.name },
      appointments: (data.appointments || []).filter((a) => a.userId === patientId),
      medications: (data.medications || []).filter((m) => m.userId === patientId),
      vitals: (data.vitals || []).filter((v) => v.userId === patientId).slice(-5),
      orders: (data.orders || []).filter((o) => o.userId === patientId),
      sos: (data.messages || []).filter((m) => m.type === 'sos' && m.userId === patientId),
    });
  }

  // ---------- companion: delivery ----------
  if (pathname === '/api/delivery/pending' && method === 'GET') {
    const s = requireAuth(req, res);
    if (!s) return;
    if (!['delivery','admin'].includes(s.user.role)) { sendJson(res, 403, { error: 'Delivery required' }); return; }
    return sendJson(res, 200, { deliveries: (data.deliveries || []).filter((d) => d.status !== 'delivered') });
  }
  if (pathname === '/api/delivery/status' && method === 'POST') {
    const s = requireAuth(req, res);
    if (!s) return;
    if (!['delivery','admin'].includes(s.user.role)) { sendJson(res, 403, { error: 'Delivery required' }); return; }
    return parseBody(req).then((body) => {
      const d = (data.deliveries || []).find((x) => x.id === body.id);
      if (!d) return sendJson(res, 404, { error: 'Not found' });
      const allowedDeliveryStatus = ['scheduled','in_transit','delivered','failed'];
      const newStatus = body.status || d.status;
      if (!allowedDeliveryStatus.includes(newStatus)) return sendJson(res, 400, { error: 'invalid status' });
      d.status = newStatus;
      store.write(data);
      return sendJson(res, 200, { delivery: d });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- SMS gateway (Twilio-style) ----------
  if (pathname === '/sms' && method === 'POST') {
    return (req.headers['content-type'] && req.headers['content-type'].includes('application/json') ? parseBody(req) : parseForm(req)).then((body) => {
      const from = body.From || body.from || body.phoneNumber || '';
      const text = body.Body || body.text || body.body || '';
      const user = null;
      const resp = ussd.handle({ phoneNumber: from, text, sessionId: 'sms-' + Date.now() });
      // TwiML
      const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message>' + String(resp).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</Message></Response>';
      res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
      res.end(twiml);
    }).catch((e) => sendText(res, 400, e.message));
  }

  // ---------- WhatsApp gateway ----------
  if (pathname === '/whatsapp' && method === 'POST') {
    return (req.headers['content-type'] && req.headers['content-type'].includes('application/json') ? parseBody(req) : parseForm(req)).then((body) => {
      const from = body.From || body.from || body.phoneNumber || '';
      const text = body.Body || body.text || body.body || '';
      const resp = ussd.handle({ phoneNumber: from, text, sessionId: 'wa-' + Date.now() });
      return sendJson(res, 200, { reply: resp });
    }).catch((e) => sendJson(res, 400, { error: e.message }));
  }

  // ---------- webhook ----------
  if (pathname === '/webhook' && method === 'GET') {
    const verify = process.env.VERIFY_TOKEN || 'cucu';
    if (q['hub.verify_token'] === verify) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(q['hub.challenge'] || '');
    }
    return sendText(res, 403, 'Forbidden');
  }
  if (pathname === '/webhook' && method === 'POST') {
    return parseBody(req).then(() => sendJson(res, 200, { ok: true })).catch(() => sendJson(res, 200, { ok: true }));
  }

  return sendJson(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) filePath = path.join(PUBLIC_DIR, 'index.html');
    fs.readFile(filePath, (err2, content) => {
      if (err2) { res.writeHead(404); return res.end('Not found'); }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(content);
    });
  });
}

const server = http.createServer((req, res) => {
  // security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const parsed = url.parse(req.url);
  const pathname = decodeURIComponent(parsed.pathname);
  if (pathname === '/ussd') {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    const parser = ct.includes('application/json') ? parseBody(req) : parseForm(req);
    parser.then((body) => {
      const resp = ussd.handle(body);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(resp);
    }).catch((e) => sendText(res, 400, 'END ' + e.message));
    return;
  }
  if (pathname.startsWith('/api/') || pathname === '/webhook') {
    const start = Date.now();
    const origEnd = res.end.bind(res);
    res.end = (chunk) => { logger.info('request', { method: req.method, path: pathname, status: res.statusCode, ms: Date.now() - start }); return origEnd(chunk); };
    try { routeApi(req, res, pathname); } catch (e) { logger.error('route error', { path: pathname, error: e.message }); sendJson(res, 500, { error: e.message }); }
    return;
  }
  serveStatic(req, res, pathname);
});

function startServer(port, attempts = 0) {
  server.listen(port, () => {
    console.log('Cucu Connect running on http://localhost:' + port);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempts < 10) {
      console.log('Port ' + port + ' in use, trying ' + (port + 1) + '...');
      startServer(port + 1, attempts + 1);
    } else {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    }
  });
}
process.on('uncaughtException', (err) => { console.error('Uncaught exception:', err); });
process.on('unhandledRejection', (err) => { console.error('Unhandled rejection:', err); });
process.on('SIGTERM', () => { console.log('Shutting down...'); server.close(() => process.exit(0)); });
process.on('SIGINT', () => { console.log('Shutting down...'); server.close(() => process.exit(0)); });

startServer(BASE_PORT);