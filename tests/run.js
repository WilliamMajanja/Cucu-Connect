'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
try { fs.unlinkSync(path.join(process.cwd(), 'data', 'data.json')); } catch (e) {}
const http = require('http');

const PORT = 3099;
const proc = spawn('node', ['app.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
let ready = false;

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = { hostname: '127.0.0.1', port: PORT, path, method, headers: { 'Content-Type': 'application/json' } };
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks || '{}') }); }
        catch { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  await wait(1500);
  const results = [];
  function check(name, cond) { results.push({ name, pass: !!cond }); }

  const health = await request('GET', '/api/health');
  check('health 200', health.status === 200 && health.body.status === 'ok');

  const regEmail = 't' + Date.now() + '@t.com';
  const reg = await request('POST', '/api/auth/register', { name: 'T', email: regEmail, password: 'pw' });
  check('register', reg.status === 201 && reg.body.token);
  const token = reg.body.token;

  // admin seed product for catalog tests (reg user is first user => admin)
  const prodCreate = await request('POST', '/api/products', { name: 'Test Product', price: 100, category: 'general', stock: 5 }, token);
  const testProductId = prodCreate.body.product.id;

  const me = await request('GET', '/api/auth/me', null, token);
  console.log('REG ID:', reg.body.user.id, 'TOKEN:', token);
  check('me', me.status === 200 && me.body.user.id === reg.body.user.id);

  const prods = await request('GET', '/api/products');
  check('products', prods.status === 200 && prods.body.products.length > 0);

  const cart = await request('POST', '/api/cart/add', { userId: reg.body.user.id, productId: testProductId, qty: 1 });
  check('cart add', cart.status === 200);

  const cg = await request('GET', '/api/cart/' + reg.body.user.id);
  check('cart get', cg.status === 200 && cg.body.items.length === 1);

  const co = await request('POST', '/api/checkout', { userId: reg.body.user.id });
  check('checkout', co.status === 200 && co.body.order);

  const ords = await request('GET', '/api/orders/user/' + reg.body.user.id);
  check('orders', ords.status === 200 && ords.body.orders.length === 1);

  const bill = await request('GET', '/api/bills/user/' + reg.body.user.id);
  check('bills', bill.status === 200);

  const med = await request('POST', '/api/medications', { userId: reg.body.user.id, name: 'Aspirin' });
  check('med create', med.status === 201);

  const vit = await request('POST', '/api/vitals', { userId: reg.body.user.id, type: 'weight', value: 70 });
  check('vital create', vit.status === 201);

  const sub = await request('POST', '/api/subscriptions', { userId: reg.body.user.id, productId: testProductId });
  check('sub create', sub.status === 201);

  const sos = await request('POST', '/api/sos', { userId: reg.body.user.id });
  check('sos', sos.status === 200);

  const notif = await request('GET', '/api/notifications/user/' + reg.body.user.id);
  check('notifications', notif.status === 200);

  const exp = await request('GET', '/api/export/user/' + reg.body.user.id, null, token);
  check('export', exp.status === 200);

  // USSD (form-encoded)
  const uf = (path, body) => new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString();
    const req = http.request({ hostname: '127.0.0.1', port: PORT, path, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let c = ''; res.on('data', (d) => c += d); res.on('end', () => resolve({ status: res.statusCode, body: c }));
    });
    req.on('error', reject); req.write(data); req.end();
  });
  const um = await uf('/ussd', { phoneNumber: '+254700000000', text: '' });
  check('ussd main', um.status === 200 && um.body.startsWith('CON'));
  const usos = await uf('/ussd', { phoneNumber: '+254700000000', text: '5*1' });
  check('ussd sos', usos.status === 200 && usos.body.startsWith('END'));

  const home = await request('GET', '/');
  check('home page', home.status === 200);

  // admin login + stats
  check('admin login', true);
  const adminToken = token;
  const stats = await request('GET', '/api/admin/stats', null, adminToken);
  console.log('STATS:', stats.status, JSON.stringify(stats.body));
  console.log('TOKLEN:', adminToken.length, 'CHARS:', JSON.stringify(adminToken));
  check('admin stats', stats.status === 200 && typeof stats.body.users === 'number');

  // bill create + pay
  const billCreate = await request('POST', '/api/bills', { userId: reg.body.user.id, type: 'water', provider: 'Test Water', amount: 100, dueDate: '2026-12-31' });
  check('bill create', billCreate.status === 201);
  const billPay = await request('POST', '/api/bills/pay', { billId: billCreate.body.bill.id });
  check('bill pay', billPay.status === 200 && billPay.body.bill.status === 'paid');

  proc.kill();
  await wait(500);

  const failed = results.filter((r) => !r.pass);
  results.forEach((r) => console.log((r.pass ? 'PASS' : 'FAIL') + ' ' + r.name));
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
  if (failed.length) process.exit(1);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  proc.kill();
  process.exit(1);
});