'use strict';
const store = require('./store');

const sessions = new Map();

function mainMenu() {
  return 'Welcome to Cucu Connect\n1. Healthcare\n2. Bills\n3. Shop\n4. Therapy\n5. Emergency SOS\n6. My Account\n0. Exit';
}
function con(msg) { return 'CON ' + msg; }
function end(msg) { return 'END ' + msg; }

function getUserByPhone(phone) {
  const data = store.read();
  let u = (data.users || []).find((x) => x.phone === phone);
  if (!u) {
    u = {
      id: store.uid('u'), name: 'Guest', email: '', phone, role: 'customer', password: '',
      accessibility: { fontSize: 'large', contrast: 'normal', voice: false },
      caregiver: { name: '', phone: '' }, emergencyContacts: [], insurance: { provider: '', policy: '' },
      createdAt: new Date().toISOString(),
    };
    data.users.push(u);
    store.write(data);
  }
  return u;
}

function handle(body) {
  const sessionId = body.sessionId || body.session_id || ('s' + Math.random().toString(36).slice(2));
  const phone = body.phoneNumber || body.phone || body.msisdn || '';
  const text = (body.text || '').trim();
  const user = getUserByPhone(phone);

  if (text === '') return con(mainMenu());

  const parts = text.split('*');
  const l1 = parts[0];
  const l2 = parts[1];
  const l3 = parts[2];
  const l4 = parts[3];

  if (l1 === '0') return end('Thank you for using Cucu Connect.');

  // Healthcare
  if (l1 === '1') {
    if (!l2) return con('Healthcare\n1. Book Appointment\n2. My Appointments\n3. Insurance\n0. Back');
    if (l2 === '0') return con(mainMenu());
    if (l2 === '1') {
      if (!l3) return con('Enter date (YYYY-MM-DD):');
      if (!l4) return con('Enter time (HH:MM):');
      const data = store.read();
      const appt = { id: store.uid('a'), userId: user.id, service: 'Telehealth Consultation', date: l3, time: l4, provider: '', notes: '', status: 'scheduled', createdAt: new Date().toISOString() };
      data.appointments = data.appointments || [];
      data.appointments.push(appt);
      store.write(data);
      return end('Appointment booked for ' + l3 + ' at ' + l4 + '.');
    }
    if (l2 === '2') {
      const data = store.read();
      const appts = (data.appointments || []).filter((a) => a.userId === user.id).slice(-3);
      if (!appts.length) return end('No appointments found.');
      return end(appts.map((a, i) => (i + 1) + '. ' + a.service + ' ' + a.date + ' ' + a.time).join('\n'));
    }
    if (l2 === '3') {
      return end('Insurance: ' + (user.insurance && user.insurance.provider ? user.insurance.provider + ' ' + (user.insurance.policy || '') : 'Not set. Update via app.'));
    }
    return end('Invalid option.');
  }

  // Bills
  if (l1 === '2') {
    if (!l2) {
      const data = store.read();
      let bills = (data.bills || []).filter((b) => b.userId === user.id);
      if (!bills.length) {
        (data.bills || []).filter((b) => b.userId === null).forEach((s) => {
          data.bills.push({ ...s, id: s.id + '_' + user.id, userId: user.id });
        });
        store.write(data);
        bills = (data.bills || []).filter((b) => b.userId === user.id);
      }
      const unpaid = bills.filter((b) => b.status !== 'paid');
      if (!unpaid.length) return end('No unpaid bills. Thank you!');
      return con('Unpaid bills:\n' + unpaid.map((b, i) => (i + 1) + '. ' + b.type + ' ' + b.provider + ' KES ' + b.amount).join('\n') + '\nSelect number to pay:');
    }
    const data = store.read();
    const unpaid = (data.bills || []).filter((b) => b.userId === user.id && b.status !== 'paid');
    const idx = parseInt(l2, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= unpaid.length) return end('Invalid selection.');
    const bill = unpaid[idx];
    bill.status = 'paid';
    bill.paidAt = new Date().toISOString();
    store.write(data);
    return end('Paid ' + bill.type + ' KES ' + bill.amount + '. Thank you!');
  }

  // Shop
  if (l1 === '3') {
    if (!l2) return con('Shop\n1. Browse products\n2. View cart\n3. Checkout\n0. Back');
    if (l2 === '0') return con(mainMenu());
    if (l2 === '1') {
      const data = store.read();
      const cats = [...new Set((data.products || []).map((p) => p.category))];
      if (!l3) return con('Categories:\n' + cats.map((c, i) => (i + 1) + '. ' + c).join('\n'));
      const ci = parseInt(l3, 10) - 1;
      if (isNaN(ci) || ci < 0 || ci >= cats.length) return end('Invalid category.');
      const cat = cats[ci];
      const products = (data.products || []).filter((p) => p.category === cat);
      if (!l4) return con(cat + ':\n' + products.map((p, i) => (i + 1) + '. ' + p.name + ' KES ' + p.price).join('\n') + '\nSelect product:');
      const pi = parseInt(l4, 10) - 1;
      if (isNaN(pi) || pi < 0 || pi >= products.length) return end('Invalid product.');
      const p = products[pi];
      if (!data.carts[user.id]) data.carts[user.id] = [];
      const ex = data.carts[user.id].find((c) => c.productId === p.id);
      if (ex) ex.qty += 1;
      else data.carts[user.id].push({ productId: p.id, qty: 1 });
      store.write(data);
      return end('Added ' + p.name + ' to cart.');
    }
    if (l2 === '2') {
      const data = store.read();
      const cart = data.carts[user.id] || [];
      if (!cart.length) return end('Your cart is empty.');
      const items = cart.map((c) => {
        const p = (data.products || []).find((x) => x.id === c.productId);
        return (p ? p.name : c.productId) + ' x' + c.qty;
      });
      const total = cart.reduce((s, c) => {
        const p = (data.products || []).find((x) => x.id === c.productId);
        return s + (p ? p.price * c.qty : 0);
      }, 0);
      return end('Cart:\n' + items.join('\n') + '\nTotal: KES ' + total);
    }
    if (l2 === '3') {
      const data = store.read();
      const cart = data.carts[user.id] || [];
      if (!cart.length) return end('Cart is empty.');
      const items = cart.map((c) => {
        const p = (data.products || []).find((x) => x.id === c.productId);
        return { productId: c.productId, name: p ? p.name : c.productId, price: p ? p.price : 0, qty: c.qty };
      });
      const total = items.reduce((s, i) => s + i.price * i.qty, 0);
      const order = { id: store.uid('o'), userId: user.id, items, total, status: 'placed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      data.orders = data.orders || [];
      data.orders.push(order);
      delete data.carts[user.id];
      store.write(data);
      return end('Order placed: ' + order.id + '. Total KES ' + total + '.');
    }
    return end('Invalid option.');
  }

  // Therapy
  if (l1 === '4') {
    if (!l2) return con('Therapy\n1. Book Session\n2. My Sessions\n0. Back');
    if (l2 === '0') return con(mainMenu());
    if (l2 === '1') {
      if (!l3) return con('Enter date (YYYY-MM-DD):');
      if (!l4) return con('Enter time (HH:MM):');
      const data = store.read();
      const appt = { id: store.uid('a'), userId: user.id, service: 'Physical Therapy Session', date: l3, time: l4, provider: '', notes: '', status: 'scheduled', createdAt: new Date().toISOString() };
      data.appointments = data.appointments || [];
      data.appointments.push(appt);
      store.write(data);
      return end('Therapy booked for ' + l3 + ' at ' + l4 + '.');
    }
    if (l2 === '2') {
      const data = store.read();
      const appts = (data.appointments || []).filter((a) => a.userId === user.id && a.service.includes('Therapy')).slice(-3);
      if (!appts.length) return end('No therapy sessions found.');
      return end(appts.map((a, i) => (i + 1) + '. ' + a.date + ' ' + a.time + ' (' + a.status + ')').join('\n'));
    }
    return end('Invalid option.');
  }

  // Emergency SOS
  if (l1 === '5') {
    if (!l2) return con('Emergency\n1. Trigger SOS\n2. View Contacts\n0. Back');
    if (l2 === '0') return con(mainMenu());
    if (l2 === '1') {
      const data = store.read();
      const ev = { id: store.uid('sos'), userId: user.id, location: 'ussd', time: new Date().toISOString(), contacts: user.emergencyContacts || [] };
      data.messages = data.messages || [];
      data.messages.push({ type: 'sos', ...ev });
      store.write(data);
      return end('SOS alert sent. Help is on the way. Call 112/999 if urgent.');
    }
    if (l2 === '2') {
      const contacts = user.emergencyContacts || [];
      if (!contacts.length) return end('No emergency contacts set. Add via app.');
      return end('Contacts:\n' + contacts.map((c, i) => (i + 1) + '. ' + c.name + ' ' + c.phone).join('\n'));
    }
    return end('Invalid option.');
  }

  // My Account
  if (l1 === '6') {
    if (!l2) return con('My Account\n1. Profile\n2. Medications\n3. Last Vitals\n4. Subscriptions\n0. Back');
    if (l2 === '0') return con(mainMenu());
    if (l2 === '1') {
      return end('Name: ' + (user.name || 'Guest') + '\nPhone: ' + (user.phone || '-') + '\nInsurance: ' + ((user.insurance && user.insurance.provider) || 'Not set'));
    }
    if (l2 === '2') {
      const data = store.read();
      const meds = (data.medications || []).filter((m) => m.userId === user.id);
      if (!meds.length) return end('No medications set.');
      return end(meds.map((m, i) => (i + 1) + '. ' + m.name + ' ' + (m.dosage || '')).join('\n'));
    }
    if (l2 === '3') {
      const data = store.read();
      const vs = (data.vitals || []).filter((v) => v.userId === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      if (!vs.length) return end('No vitals recorded.');
      const v = vs[0];
      return end('Last: ' + v.type + ' ' + v.value + ' ' + (v.unit || '') + ' on ' + new Date(v.timestamp).toLocaleDateString());
    }
    if (l2 === '4') {
      const data = store.read();
      const subs = (data.subscriptions || []).filter((s) => s.userId === user.id);
      if (!subs.length) return end('No subscriptions.');
      return end(subs.map((s, i) => (i + 1) + '. ' + s.productId + ' ' + s.frequency + ' next ' + s.nextDate).join('\n'));
    }
    return end('Invalid option.');
  }

  return end('Invalid option. Dial again.');
}

module.exports = { handle };