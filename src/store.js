'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(process.cwd(), 'data', 'data.json');

function defaultData() {
  return {
    users: [],
    sessions: [],
    products: [],
    carts: {},
    orders: [],
    appointments: [],
    bills: [],
    medications: [],
    vitals: [],
    subscriptions: [],
    notifications: [],
    reviews: [],
    deliveries: [],
    messages: [],
    services: [],
    mpesaTransactions: [],
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