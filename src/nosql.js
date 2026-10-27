'use strict';
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(process.cwd(), 'data');
function fileFor(collection) { return path.join(DATA_DIR, collection + '.json'); }
function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function readCollection(collection) {
  ensureDir();
  const f = fileFor(collection);
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return []; }
}
function writeCollection(collection, arr) {
  ensureDir();
  const f = fileFor(collection);
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(arr, null, 2));
  fs.renameSync(tmp, f);
}
function find(collection, predicate) {
  const arr = readCollection(collection);
  return predicate ? arr.filter(predicate) : arr;
}
function findOne(collection, predicate) {
  const arr = readCollection(collection);
  return arr.find(predicate) || null;
}
function insert(collection, doc) {
  const arr = readCollection(collection);
  arr.push(doc);
  writeCollection(collection, arr);
  return doc;
}
function update(collection, predicate, patch) {
  const arr = readCollection(collection);
  let n = 0;
  arr.forEach((d) => { if (predicate(d)) { Object.assign(d, patch); n++; } });
  writeCollection(collection, arr);
  return n;
}
function remove(collection, predicate) {
  const arr = readCollection(collection);
  const before = arr.length;
  const kept = arr.filter((d) => !predicate(d));
  writeCollection(collection, kept);
  return before - kept.length;
}
function collections() {
  ensureDir();
  return fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}
module.exports = { readCollection, writeCollection, find, findOne, insert, update, remove, collections, DATA_DIR };
