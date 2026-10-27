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
    products: [],
    carts: {},
    orders: [],
    appointments: [],
    medications: [],
    vitals: [],
    subscriptions: [],
    notifications: [],
    reviews: [],
    deliveries: [],
    bills: [],
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