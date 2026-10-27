'use strict';
const https = require('https');

function cfg() {
  return {
    env: process.env.MPESA_ENV || 'sandbox',
    consumerKey: process.env.MPESA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    shortcode: process.env.MPESA_SHORTCODE || '',
    passkey: process.env.MPESA_PASSKEY || '',
    callbackUrl: process.env.MPESA_CALLBACK_URL || '',
  };
}
function isConfigured() {
  const c = cfg();
  return !!(c.consumerKey && c.consumerSecret && c.shortcode && c.passkey && c.callbackUrl);
}
function baseUrl() {
  return cfg().env === 'production' ? 'api.safaricom.co.ke' : 'sandbox.safaricom.co.ke';
}
function request(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: baseUrl(), path, method, headers: headers || {} };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}
let tokenCache = { token: null, expires: 0 };
async function getToken() {
  const c = cfg();
  if (!isConfigured()) throw new Error('M-Pesa not configured');
  if (tokenCache.token && Date.now() < tokenCache.expires) return tokenCache.token;
  const auth = Buffer.from(c.consumerKey + ':' + c.consumerSecret).toString('base64');
  const r = await request('GET', '/oauth/v1/generate?grant_type=client_credentials', { Authorization: 'Basic ' + auth });
  if (r.status !== 200 || !r.body.access_token) throw new Error('Failed to get access token');
  tokenCache = { token: r.body.access_token, expires: Date.now() + 50 * 60 * 1000 };
  return tokenCache.token;
}
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
}
async function stkPush({ phone, amount, accountRef, description }) {
  const c = cfg();
  const token = await getToken();
  const ts = timestamp();
  const password = Buffer.from(c.shortcode + c.passkey + ts).toString('base64');
  const body = {
    BusinessShortCode: c.shortcode,
    Password: password,
    Timestamp: ts,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(Number(amount)),
    PartyA: phone,
    PartyB: c.shortcode,
    PhoneNumber: phone,
    CallBackURL: c.callbackUrl,
    AccountReference: accountRef || 'CucuConnect',
    TransactionDesc: description || 'Payment',
  };
  return request('POST', '/mpesa/stkpush/v1/processrequest', { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body);
}
async function stkQuery(checkoutRequestId) {
  const c = cfg();
  const token = await getToken();
  const ts = timestamp();
  const password = Buffer.from(c.shortcode + c.passkey + ts).toString('base64');
  const body = { BusinessShortCode: c.shortcode, Password: password, Timestamp: ts, CheckoutRequestID: checkoutRequestId };
  return request('POST', '/mpesa/stkpushquery/v1/query', { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body);
}
module.exports = { cfg, isConfigured, getToken, stkPush, stkQuery };
