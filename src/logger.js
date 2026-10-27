'use strict';
const fs = require('fs');
const path = require('path');
const LOG_FILE = path.join(process.cwd(), 'data', 'app.log');
const ring = [];
const MAX_RING = 100;
function log(level, msg, meta) {
  const entry = { ts: new Date().toISOString(), level, msg, meta: meta || {} };
  ring.push(entry);
  if (ring.length > MAX_RING) ring.shift();
  const line = JSON.stringify(entry) + '\n';
  try { fs.appendFileSync(LOG_FILE, line); } catch (e) {}
  if (level === 'error') console.error(line.trim());
  else if (level === 'warn') console.warn(line.trim());
  else console.log(line.trim());
}
function info(msg, meta) { log('info', msg, meta); }
function warn(msg, meta) { log('warn', msg, meta); }
function error(msg, meta) { log('error', msg, meta); }
function recent() { return ring.slice(); }
module.exports = { info, warn, error, recent, MAX_RING };
