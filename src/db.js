'use strict';
const nosql = require('./nosql');
const store = require('./store');
function mode() { return process.env.DB_MODE || 'json'; }
function isNoSql() { return mode() === 'nosql'; }
// Coexistence facade: reads/writes go to active backend.
function readAll(collection) {
  if (isNoSql()) return nosql.readCollection(collection);
  // json backend: map collection name to store field
  const data = store.read();
  return data[collection] || [];
}
function writeAll(collection, arr) {
  if (isNoSql()) { nosql.writeCollection(collection, arr); return; }
  const data = store.read();
  data[collection] = arr;
  store.write(data);
}
function migrateJsonToNoSql() {
  const data = store.read();
  for (const [k, v] of Object.entries(data)) {
    if (Array.isArray(v)) nosql.writeCollection(k, v);
    else nosql.writeCollection(k, [v]);
  }
  return Object.keys(data);
}
module.exports = { mode, isNoSql, readAll, writeAll, migrateJsonToNoSql, nosql };
