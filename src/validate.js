'use strict';
// Minimal zero-dependency schema validator.
function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function validate(schema, data) {
  const errors = [];
  if (schema.type === 'object') {
    if (!isObject(data)) { errors.push('expected object'); return { ok: false, errors }; }
    const props = schema.properties || {};
    for (const key of Object.keys(props)) {
      const p = props[key];
      const val = data[key];
      if (val === undefined) {
        if (p.required) errors.push(key + ' is required');
        continue;
      }
      if (p.type === 'string' && typeof val !== 'string') errors.push(key + ' must be string');
      if (p.type === 'number' && (typeof val !== 'number' || isNaN(val))) errors.push(key + ' must be number');
      if (p.type === 'integer' && (!Number.isInteger(val))) errors.push(key + ' must be integer');
      if (p.type === 'boolean' && typeof val !== 'boolean') errors.push(key + ' must be boolean');
      if (p.type === 'array' && !Array.isArray(val)) errors.push(key + ' must be array');
      if (p.enum && !p.enum.includes(val)) errors.push(key + ' must be one of ' + p.enum.join(','));
      if (p.minLength && String(val).length < p.minLength) errors.push(key + ' too short');
      if (p.maxLength && String(val).length > p.maxLength) errors.push(key + ' too long');
      if (p.minimum !== undefined && val < p.minimum) errors.push(key + ' below minimum');
      if (p.maximum !== undefined && val > p.maximum) errors.push(key + ' above maximum');
      if (p.pattern && !new RegExp(p.pattern).test(String(val))) errors.push(key + ' invalid format');
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(data)) if (!props[k]) errors.push('unknown field: ' + k);
    }
  }
  return { ok: errors.length === 0, errors };
}
module.exports = { validate, isObject };
