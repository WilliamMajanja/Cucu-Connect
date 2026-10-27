'use strict';
// Client-side demo data layer used only when the real API is unavailable (e.g. GitHub Pages).
const DEMO_KEY = 'cucu_demo_data_v1';
async function demoLoad() {
  try { const raw = localStorage.getItem(DEMO_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  let d = null;
  try {
    const r = await fetch('seed.json');
    if (r.ok) d = await r.json();
  } catch (e) {}
  if (!d) d = { users: [], products: [], carts: {}, orders: [], appointments: [], bills: [], medications: [], vitals: [], subscriptions: [], notifications: [], reviews: [], deliveries: [], messages: [], services: [] };
  localStorage.setItem(DEMO_KEY, JSON.stringify(d));
  return d;
}
function demoSave(d) { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); }
function uid(p) { return p + Math.random().toString(36).slice(2, 10); }
function demoGetUser(data, userId) {
  let u = (data.users || []).find((x) => x.id === userId);
  if (!u) { u = { id: userId, name: 'Guest', email: '', phone: '', role: 'customer', accessibility: { fontSize: 'large', contrast: 'normal', voice: false }, caregiver: { name: '', phone: '' }, emergencyContacts: [], insurance: { provider: '', policy: '' }, createdAt: new Date().toISOString() }; data.users.push(u); }
  return u;
}
async function demoApi(path, opts) {
  const method = (opts && opts.method) || 'GET';
  const body = (opts && opts.body) || {};
  const data = await demoLoad();
  const url = path.split('?')[0];
  const q = {};
  const qs = path.split('?')[1];
  if (qs) qs.split('&').forEach((p) => { const [k, v] = p.split('='); q[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  const json = (status, obj) => ({ status, body: obj });
  // health
  if (url === '/api/health' && method === 'GET') return json(200, { status: 'ok', name: 'Cucu Connect', version: '2.0.0 (demo)', time: new Date().toISOString() });
  if (url === '/api/services' && method === 'GET') return json(200, { services: data.services });
  // auth
  if (url === '/api/auth/register' && method === 'POST') {
    if (!body.name || !body.email || !body.password) return json(400, { error: 'name, email, password required' });
    if ((data.users || []).some((u) => u.email === String(body.email).toLowerCase())) return json(409, { error: 'Email already registered' });
    const isFirst = (data.users || []).length === 0;
    const user = { id: uid('u'), name: body.name, email: String(body.email).toLowerCase(), password: '', phone: body.phone || '', role: isFirst ? 'admin' : (['customer','caregiver','provider','delivery'].includes(body.role) ? body.role : 'customer'), accessibility: { fontSize: 'large', contrast: 'normal', voice: false }, caregiver: { name: '', phone: '' }, emergencyContacts: [], insurance: { provider: '', policy: '' }, createdAt: new Date().toISOString() };
    data.users.push(user);
    const token = uid('tok');
    data.sessions = data.sessions || [];
    data.sessions.push({ token, userId: user.id, expires: new Date(Date.now() + 30 * 86400000).toISOString() });
    demoSave(data);
    const { password: _p, ...safe } = user;
    return json(201, { user: safe, token });
  }
  if (url === '/api/auth/login' && method === 'POST') {
    const user = (data.users || []).find((u) => u.email === String(body.email || '').toLowerCase());
    if (!user) return json(401, { error: 'Invalid credentials' });
    const token = uid('tok');
    data.sessions = (data.sessions || []).filter((s) => s.userId !== user.id);
    data.sessions.push({ token, userId: user.id, expires: new Date(Date.now() + 30 * 86400000).toISOString() });
    demoSave(data);
    const { password: _p, ...safe } = user;
    return json(200, { user: safe, token });
  }
  if (url === '/api/auth/logout' && method === 'POST') return json(200, { ok: true });
  if (url === '/api/auth/me' && method === 'GET') {
    // token not tracked client-side; return first user
    const user = data.users[0];
    const { password: _p, ...safe } = user;
    return json(200, { user: safe });
  }
  // products
  if (url === '/api/products' && method === 'GET') {
    let list = data.products || [];
    if (q.category) list = list.filter((p) => p.category === q.category);
    if (q.q) { const n = String(q.q).toLowerCase(); list = list.filter((p) => (p.name + ' ' + p.description + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(n)); }
    if (q.tag) list = list.filter((p) => (p.tags || []).includes(q.tag));
    return json(200, { products: list });
  }
  const prodMatch = url.match(/^\/api\/products\/([^/]+)$/);
  if (prodMatch) {
    const pid = decodeURIComponent(prodMatch[1]);
    if (method === 'GET') {
      const p = (data.products || []).find((x) => x.id === pid);
      if (!p) return json(404, { error: 'Not found' });
      const reviews = (data.reviews || []).filter((r) => r.productId === pid);
      return json(200, { product: p, reviews });
    }
  }
  // cart
  const cartMatch = url.match(/^\/api\/cart\/([^/]+)$/);
  if (cartMatch && method === 'GET') {
    const userId = decodeURIComponent(cartMatch[1]);
    const cart = data.carts[userId] || [];
    const items = cart.map((c) => { const p = (data.products || []).find((x) => x.id === c.productId); return { ...c, product: p, lineTotal: p ? p.price * c.qty : 0 }; });
    const total = items.reduce((s, i) => s + i.lineTotal, 0);
    return json(200, { items, total });
  }
  if (url === '/api/cart/add' && method === 'POST') {
    const { userId, productId, qty } = body;
    const p = (data.products || []).find((x) => x.id === productId);
    if (!p) return json(404, { error: 'product not found' });
    if (!data.carts[userId]) data.carts[userId] = [];
    const existing = data.carts[userId].find((c) => c.productId === productId);
    const q = Number(qty || 1);
    if (existing) existing.qty += q; else data.carts[userId].push({ productId, qty: q });
    demoSave(data);
    return json(200, { ok: true });
  }
  if (url === '/api/cart/remove' && method === 'POST') {
    const { userId, productId } = body;
    if (data.carts[userId]) data.carts[userId] = data.carts[userId].filter((c) => c.productId !== productId);
    demoSave(data);
    return json(200, { ok: true });
  }
  if (url === '/api/cart/clear' && method === 'POST') {
    if (body.userId) delete data.carts[body.userId];
    demoSave(data);
    return json(200, { ok: true });
  }
  if (url === '/api/checkout' && method === 'POST') {
    const { userId, address, deliveryDate } = body;
    const cart = data.carts[userId] || [];
    if (!cart.length) return json(400, { error: 'cart empty' });
    const items = cart.map((c) => { const p = (data.products || []).find((x) => x.id === c.productId); return { productId: c.productId, name: p ? p.name : c.productId, price: p ? p.price : 0, qty: c.qty }; });
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const order = { id: uid('o'), userId, items, total, status: 'placed', address: address || '', deliveryDate: deliveryDate || null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    data.orders = data.orders || [];
    data.orders.push(order);
    delete data.carts[userId];
    data.notifications = data.notifications || [];
    data.notifications.push({ id: uid('n'), userId, title: 'Order placed', message: 'Your order ' + order.id + ' has been placed.', type: 'success', read: false, createdAt: new Date().toISOString() });
    demoSave(data);
    return json(200, { order });
  }
  // orders
  const ordersUserMatch = url.match(/^\/api\/orders\/user\/([^/]+)$/);
  if (ordersUserMatch && method === 'GET') {
    const userId = decodeURIComponent(ordersUserMatch[1]);
    return json(200, { orders: (data.orders || []).filter((o) => o.userId === userId) });
  }
  const orderDetailMatch = url.match(/^\/api\/orders\/([^/]+)$/);
  if (orderDetailMatch && method === 'GET') {
    const oid = decodeURIComponent(orderDetailMatch[1]);
    const o = (data.orders || []).find((x) => x.id === oid);
    if (!o) return json(404, { error: 'Not found' });
    return json(200, { order: o });
  }
  if (url === '/api/orders/status' && method === 'POST') {
    const o = (data.orders || []).find((x) => x.id === body.orderId);
    if (!o) return json(404, { error: 'Not found' });
    o.status = body.status; o.updatedAt = new Date().toISOString();
    demoSave(data);
    return json(200, { order: o });
  }
  // appointments
  const apptUserMatch = url.match(/^\/api\/appointments\/user\/([^/]+)$/);
  if (apptUserMatch && method === 'GET') {
    const userId = decodeURIComponent(apptUserMatch[1]);
    return json(200, { appointments: (data.appointments || []).filter((a) => a.userId === userId) });
  }
  if (url === '/api/appointments' && method === 'POST') {
    const { userId, service, date, time, notes, provider } = body;
    const appt = { id: uid('a'), userId, service, date, time: time || '09:00', provider: provider || '', notes: notes || '', status: 'scheduled', createdAt: new Date().toISOString() };
    data.appointments = data.appointments || [];
    data.appointments.push(appt);
    demoSave(data);
    return json(200, { appointment: appt });
  }
  if (url === '/api/appointments/cancel' && method === 'POST') {
    const appt = (data.appointments || []).find((a) => a.id === body.id);
    if (appt) { appt.status = 'cancelled'; demoSave(data); }
    return json(200, { ok: true });
  }
  // bills
  const billsUserMatch = url.match(/^\/api\/bills\/user\/([^/]+)$/);
  if (billsUserMatch && method === 'GET') {
    const userId = decodeURIComponent(billsUserMatch[1]);
    let userBills = (data.bills || []).filter((b) => b.userId === userId);
    if (userBills.length === 0) {
      (data.bills || []).filter((b) => b.userId === null).forEach((s) => { data.bills.push({ ...s, id: s.id + '_' + userId, userId }); });
      demoSave(data);
      userBills = (data.bills || []).filter((b) => b.userId === userId);
    }
    return json(200, { bills: userBills });
  }
  if (url === '/api/bills/pay' && method === 'POST') {
    const bill = (data.bills || []).find((b) => b.id === body.billId);
    if (!bill) return json(404, { error: 'bill not found' });
    bill.status = 'paid'; bill.paidAt = new Date().toISOString();
    demoSave(data);
    return json(200, { bill });
  }
  // profile
  const profileMatch = url.match(/^\/api\/profile\/([^/]+)$/);
  if (profileMatch && method === 'GET') {
    const userId = decodeURIComponent(profileMatch[1]);
    const u = demoGetUser(data, userId);
    demoSave(data);
    const { password: _p, ...safe } = u;
    return json(200, { user: safe });
  }
  if (url === '/api/profile' && method === 'POST') {
    const { userId, ...rest } = body;
    const u = demoGetUser(data, userId);
    if (rest.name !== undefined) u.name = rest.name;
    if (rest.phone !== undefined) u.phone = rest.phone;
    if (rest.email !== undefined) u.email = rest.email;
    if (rest.accessibility) u.accessibility = { ...u.accessibility, ...rest.accessibility };
    if (rest.caregiver) u.caregiver = { ...u.caregiver, ...rest.caregiver };
    if (rest.insurance) u.insurance = { ...u.insurance, ...rest.insurance };
    if (Array.isArray(rest.emergencyContacts)) u.emergencyContacts = rest.emergencyContacts;
    demoSave(data);
    const { password: _p, ...safe } = u;
    return json(200, { user: safe });
  }
  // medications
  const medsUserMatch = url.match(/^\/api\/medications\/user\/([^/]+)$/);
  if (medsUserMatch && method === 'GET') {
    const userId = decodeURIComponent(medsUserMatch[1]);
    return json(200, { medications: (data.medications || []).filter((m) => m.userId === userId) });
  }
  if (url === '/api/medications' && method === 'POST') {
    const { userId, name, dosage, schedule, times, startDate, endDate, notes } = body;
    const m = { id: uid('m'), userId, name, dosage: dosage || '', schedule: schedule || 'daily', times: times || ['08:00'], startDate: startDate || new Date().toISOString().slice(0, 10), endDate: endDate || null, notes: notes || '', logs: [], active: true, createdAt: new Date().toISOString() };
    data.medications = data.medications || [];
    data.medications.push(m);
    demoSave(data);
    return json(201, { medication: m });
  }
  const medMatch = url.match(/^\/api\/medications\/([^/]+)$/);
  if (medMatch) {
    const mid = decodeURIComponent(medMatch[1]);
    if (method === 'PUT') {
      const m = (data.medications || []).find((x) => x.id === mid);
      if (!m) return json(404, { error: 'Not found' });
      Object.assign(m, body);
      demoSave(data);
      return json(200, { medication: m });
    }
    if (method === 'DELETE') {
      data.medications = (data.medications || []).filter((x) => x.id !== mid);
      demoSave(data);
      return json(200, { ok: true });
    }
  }
  if (url === '/api/medications/log' && method === 'POST') {
    const m = (data.medications || []).find((x) => x.id === body.medicationId);
    if (!m) return json(404, { error: 'Not found' });
    m.logs = m.logs || [];
    m.logs.push({ taken: !!body.taken, timestamp: body.timestamp || new Date().toISOString(), note: body.note || '' });
    demoSave(data);
    return json(200, { ok: true });
  }
  const medAdhMatch = url.match(/^\/api\/medications\/user\/([^/]+)\/adherence$/);
  if (medAdhMatch && method === 'GET') {
    const userId = decodeURIComponent(medAdhMatch[1]);
    const meds = (data.medications || []).filter((m) => m.userId === userId);
    const totalLogs = meds.reduce((s, m) => s + (m.logs || []).length, 0);
    const taken = meds.reduce((s, m) => s + (m.logs || []).filter((l) => l.taken).length, 0);
    return json(200, { medications: meds.length, logs: totalLogs, taken, adherence: totalLogs ? Math.round((taken / totalLogs) * 100) : 100 });
  }
  // vitals
  const vitalsUserMatch = url.match(/^\/api\/vitals\/user\/([^/]+)$/);
  if (vitalsUserMatch && method === 'GET') {
    const userId = decodeURIComponent(vitalsUserMatch[1]);
    let list = (data.vitals || []).filter((v) => v.userId === userId);
    if (q.type) list = list.filter((v) => v.type === q.type);
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return json(200, { vitals: list });
  }
  if (url === '/api/vitals' && method === 'POST') {
    const { userId, type, value, unit, timestamp, notes } = body;
    const v = { id: uid('v'), userId, type, value: Number(value), unit: unit || '', timestamp: timestamp || new Date().toISOString(), notes: notes || '' };
    data.vitals = data.vitals || [];
    data.vitals.push(v);
    demoSave(data);
    return json(201, { vital: v });
  }
  const vitalMatch = url.match(/^\/api\/vitals\/([^/]+)$/);
  if (vitalMatch && method === 'DELETE') {
    data.vitals = (data.vitals || []).filter((x) => x.id !== decodeURIComponent(vitalMatch[1]));
    demoSave(data);
    return json(200, { ok: true });
  }
  // subscriptions
  const subsUserMatch = url.match(/^\/api\/subscriptions\/user\/([^/]+)$/);
  if (subsUserMatch && method === 'GET') {
    const userId = decodeURIComponent(subsUserMatch[1]);
    return json(200, { subscriptions: (data.subscriptions || []).filter((s) => s.userId === userId) });
  }
  if (url === '/api/subscriptions' && method === 'POST') {
    const { userId, productId, frequency, qty, nextDate } = body;
    const sub = { id: uid('sub'), userId, productId, frequency: frequency || 'monthly', qty: qty || 1, nextDate: nextDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10), status: 'active', createdAt: new Date().toISOString() };
    data.subscriptions = data.subscriptions || [];
    data.subscriptions.push(sub);
    demoSave(data);
    return json(201, { subscription: sub });
  }
  const subMatch = url.match(/^\/api\/subscriptions\/([^/]+)$/);
  if (subMatch && method === 'PUT') {
    const sub = (data.subscriptions || []).find((x) => x.id === decodeURIComponent(subMatch[1]));
    if (!sub) return json(404, { error: 'Not found' });
    if (body.status) sub.status = body.status;
    if (body.nextDate) sub.nextDate = body.nextDate;
    if (body.qty) sub.qty = body.qty;
    demoSave(data);
    return json(200, { subscription: sub });
  }
  if (url === '/api/subscriptions/process' && method === 'POST') {
    const today = new Date().toISOString().slice(0, 10);
    const due = (data.subscriptions || []).filter((sub) => sub.status === 'active' && sub.nextDate <= today);
    const created = [];
    due.forEach((sub) => {
      const p = (data.products || []).find((x) => x.id === sub.productId);
      const order = { id: uid('o'), userId: sub.userId, items: [{ productId: sub.productId, name: p ? p.name : sub.productId, price: p ? p.price : 0, qty: sub.qty }], total: (p ? p.price : 0) * sub.qty, status: 'placed', subscriptionId: sub.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      data.orders.push(order);
      created.push(order);
      const d = new Date(sub.nextDate);
      if (sub.frequency === 'weekly') d.setDate(d.getDate() + 7);
      else if (sub.frequency === 'daily') d.setDate(d.getDate() + 1);
      else d.setMonth(d.getMonth() + 1);
      sub.nextDate = d.toISOString().slice(0, 10);
    });
    demoSave(data);
    return json(200, { processed: due.length, orders: created });
  }
  // reviews
  if (url === '/api/reviews' && method === 'GET') {
    let list = data.reviews || [];
    if (q.productId) list = list.filter((r) => r.productId === q.productId);
    return json(200, { reviews: list });
  }
  if (url === '/api/reviews' && method === 'POST') {
    const { userId, productId, rating, comment } = body;
    const r = { id: uid('r'), userId, productId, rating: Number(rating), comment: comment || '', createdAt: new Date().toISOString() };
    data.reviews = data.reviews || [];
    data.reviews.push(r);
    demoSave(data);
    return json(201, { review: r });
  }
  // deliveries
  if (url === '/api/deliveries' && method === 'POST') {
    const { orderId, userId, address, preferredDate, timeSlot } = body;
    const d = { id: uid('d'), orderId, userId, address: address || '', preferredDate: preferredDate || null, timeSlot: timeSlot || 'any', status: 'scheduled', createdAt: new Date().toISOString() };
    data.deliveries = data.deliveries || [];
    data.deliveries.push(d);
    demoSave(data);
    return json(201, { delivery: d });
  }
  const delUserMatch = url.match(/^\/api\/deliveries\/user\/([^/]+)$/);
  if (delUserMatch && method === 'GET') {
    const userId = decodeURIComponent(delUserMatch[1]);
    return json(200, { deliveries: (data.deliveries || []).filter((d) => d.userId === userId) });
  }
  // notifications
  const notifUserMatch = url.match(/^\/api\/notifications\/user\/([^/]+)$/);
  if (notifUserMatch && method === 'GET') {
    const userId = decodeURIComponent(notifUserMatch[1]);
    const list = (data.notifications || []).filter((n) => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return json(200, { notifications: list });
  }
  if (url === '/api/notifications/read' && method === 'POST') {
    const n = (data.notifications || []).find((x) => x.id === body.id);
    if (n) { n.read = true; demoSave(data); }
    return json(200, { ok: true });
  }
  if (url === '/api/notifications/read-all' && method === 'POST') {
    (data.notifications || []).forEach((n) => { if (n.userId === body.userId) n.read = true; });
    demoSave(data);
    return json(200, { ok: true });
  }
  // sos
  if (url === '/api/sos' && method === 'POST') {
    const u = demoGetUser(data, body.userId || 'guest');
    const event = { id: uid('sos'), userId: u.id, location: body.location || '', time: new Date().toISOString(), contacts: u.emergencyContacts || [] };
    data.messages = data.messages || [];
    data.messages.push({ type: 'sos', ...event });
    data.notifications = data.notifications || [];
    data.notifications.push({ id: uid('n'), userId: u.id, title: 'SOS triggered', message: 'Emergency alert recorded.', type: 'danger', read: false, createdAt: new Date().toISOString() });
    demoSave(data);
    return json(200, { ok: true, message: 'Emergency alert recorded. Contacts notified.', event });
  }
  // admin
  if (url === '/api/admin/stats' && method === 'GET') {
    return json(200, { users: (data.users || []).length, products: (data.products || []).length, orders: (data.orders || []).length, appointments: (data.appointments || []).length, revenue: (data.orders || []).reduce((sum, o) => sum + (o.total || 0), 0), unreadNotifications: (data.notifications || []).filter((n) => !n.read).length });
  }
  if (url === '/api/admin/users' && method === 'GET') {
    const users = (data.users || []).map(({ password, ...rest }) => rest);
    return json(200, { users });
  }
  // export
  const exportUserMatch = url.match(/^\/api\/export\/user\/([^/]+)$/);
  if (exportUserMatch && method === 'GET') {
    const userId = decodeURIComponent(exportUserMatch[1]);
    const payload = { user: (data.users || []).find((u) => u.id === userId), orders: (data.orders || []).filter((o) => o.userId === userId), appointments: (data.appointments || []).filter((a) => a.userId === userId), medications: (data.medications || []).filter((m) => m.userId === userId), vitals: (data.vitals || []).filter((v) => v.userId === userId), subscriptions: (data.subscriptions || []).filter((s) => s.userId === userId), bills: (data.bills || []).filter((b) => b.userId === userId), notifications: (data.notifications || []).filter((n) => n.userId === userId) };
    return json(200, payload);
  }
  // provider
  if (url === '/api/provider/appointments' && method === 'GET') return json(200, { appointments: (data.appointments || []).filter((a) => a.status === 'scheduled') });
  if (url === '/api/provider/appointments/status' && method === 'POST') {
    const a = (data.appointments || []).find((x) => x.id === body.id);
    if (!a) return json(404, { error: 'Not found' });
    a.status = body.status || a.status;
    demoSave(data);
    return json(200, { appointment: a });
  }
  // caregiver
  const cgMatch = url.match(/^\/api\/caregiver\/overview\/([^/]+)$/);
  if (cgMatch && method === 'GET') {
    const patientId = decodeURIComponent(cgMatch[1]);
    const patient = (data.users || []).find((u) => u.id === patientId);
    if (!patient) return json(404, { error: 'Patient not found' });
    return json(200, { patient: { id: patient.id, name: patient.name }, appointments: (data.appointments || []).filter((a) => a.userId === patientId), medications: (data.medications || []).filter((m) => m.userId === patientId), vitals: (data.vitals || []).filter((v) => v.userId === patientId).slice(-5), orders: (data.orders || []).filter((o) => o.userId === patientId), sos: (data.messages || []).filter((m) => m.type === 'sos' && m.userId === patientId) });
  }
  // delivery
  if (url === '/api/delivery/pending' && method === 'GET') return json(200, { deliveries: (data.deliveries || []).filter((d) => d.status !== 'delivered') });
  if (url === '/api/delivery/status' && method === 'POST') {
    const d = (data.deliveries || []).find((x) => x.id === body.id);
    if (!d) return json(404, { error: 'Not found' });
    d.status = body.status || d.status;
    demoSave(data);
    return json(200, { delivery: d });
  }
  return json(404, { error: 'Not found' });
}
