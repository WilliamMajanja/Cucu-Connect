'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(process.cwd(), 'data', 'data.json');

function defaultData() {
  return {
    users: [
      {
        id: 'admin',
        name: 'Administrator',
        email: 'williammajanja@gmail.com',
        password: hashPassword('admin123'),
        phone: '',
        role: 'admin',
        accessibility: { fontSize: 'large', contrast: 'normal', voice: false },
        caregiver: { name: '', phone: '' },
        emergencyContacts: [],
        insurance: { provider: '', policy: '' },
        createdAt: new Date().toISOString(),
      },
    ],
    sessions: [],
    products: seedProducts(),
    carts: {},
    orders: [],
    appointments: [],
    medications: [],
    vitals: [],
    subscriptions: [],
    notifications: [],
    reviews: [],
    deliveries: [],
    bills: [
      { id: 'b1', userId: null, type: 'electricity', provider: 'Kenya Power', amount: 1200, dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), status: 'unpaid' },
      { id: 'b2', userId: null, type: 'water', provider: 'Nairobi Water', amount: 800, dueDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), status: 'unpaid' },
      { id: 'b3', userId: null, type: 'insurance', provider: 'NHIF', amount: 500, dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), status: 'unpaid' },
    ],
    messages: [],
    services: [
      { id: 's1', name: 'Healthcare', description: 'Telehealth, appointments, insurance' },
      { id: 's2', name: 'Bills & Payments', description: 'Pay utilities and insurance' },
      { id: 's3', name: 'Commerce', description: 'Groceries, medicines, assistive devices' },
      { id: 's4', name: 'Physical Therapy', description: 'Book therapy sessions' },
      { id: 's5', name: 'Emergency SOS', description: 'Emergency alert and contacts' },
      { id: 's6', name: 'Medication Reminders', description: 'Track and remind medications' },
      { id: 's7', name: 'Vitals Tracking', description: 'Track blood pressure, glucose, etc.' },
    ],
  };
}

function seedProducts() {
  return [
    { id: 'p1', name: 'Grocery Basket (Weekly)', category: 'groceries', price: 2500, description: 'Fresh groceries delivered to your doorstep', stock: 50, accessible: true, tags: ['weekly', 'essentials'] },
    { id: 'p2', name: 'Prescription Medicines Pack', category: 'medicine', price: 1800, description: 'Monthly medicine refill with reminder', stock: 30, accessible: true, tags: ['medicine', 'refill'] },
    { id: 'p3', name: 'Walking Cane (Adjustable)', category: 'assistive', price: 1200, description: 'Lightweight adjustable walking cane', stock: 20, accessible: true, tags: ['mobility'] },
    { id: 'p4', name: 'Wheelchair Cushion', category: 'assistive', price: 3500, description: 'Pressure-relief wheelchair cushion', stock: 15, accessible: true, tags: ['mobility', 'comfort'] },
    { id: 'p5', name: 'Blood Pressure Monitor', category: 'health', price: 4500, description: 'Digital BP monitor with large display', stock: 25, accessible: true, tags: ['monitoring'] },
    { id: 'p6', name: 'Physical Therapy Session', category: 'therapy', price: 3000, description: 'One-on-one physical therapy session', stock: 100, accessible: true, tags: ['therapy'] },
    { id: 'p7', name: 'Telehealth Consultation', category: 'healthcare', price: 1500, description: 'Video consultation with a doctor', stock: 100, accessible: true, tags: ['telehealth'] },
    { id: 'p8', name: 'Emergency Alert Pendant', category: 'safety', price: 5000, description: 'Wearable SOS alert device', stock: 40, accessible: true, tags: ['safety', 'sos'] },
    { id: 'p9', name: 'Glucose Meter Kit', category: 'health', price: 3200, description: 'Blood glucose monitoring kit', stock: 35, accessible: true, tags: ['diabetes'] },
    { id: 'p10', name: 'Incontinence Care Pack', category: 'care', price: 2200, description: 'Monthly care essentials pack', stock: 40, accessible: true, tags: ['care'] },
  ];
}

function ensure() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2));
  }
}
ensure();

function read() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function write(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

function uid(prefix) { return prefix + crypto.randomBytes(6).toString('hex'); }
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const h = crypto.scryptSync(pw, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hash, 'hex'));
}

module.exports = { read, write, uid, hashPassword, verifyPassword, DATA_FILE };