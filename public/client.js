'use strict';

const API = '';
let state = {
  userId: localStorage.getItem('cucu_user_id') || ('u' + Math.random().toString(36).slice(2, 10)),
  token: localStorage.getItem('cucu_token') || null,
  csrf: null,
  user: null,
  products: [],
  cart: [],
  cartTotal: 0,
  orders: [],
  appointments: [],
  bills: [],
  medications: [],
  vitals: [],
  subscriptions: [],
  notifications: [],
  reviews: [],
};

function $(sel, root = document) { return root.querySelector(sel); }
function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function $$(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function confetti() {
  const colors = ['#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:50%;left:50%;width:8px;height:8px;border-radius:2px;pointer-events:none;z-index:300;';
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    document.body.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 200;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    el.animate([
      { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 },
    ], { duration: 900 + Math.random()*400, easing: 'cubic-bezier(.22,1,.36,1)' });
    setTimeout(() => el.remove(), 1400);
  }
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { t.hidden = true; }, 3500);
}

async function api(path, opts = {}) {
  if (window.DEMO_MODE && typeof window.demoApi === 'function') {
    const r = await window.demoApi(path, opts || {});
    if (r.status >= 400) throw new Error((r.body && r.body.error) || 'Error');
    return r.body;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  if (state.csrf) headers['X-CSRF-Token'] = state.csrf;
  const res = await fetch(API + path, {
    headers,
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
}

function applyAccessibility() {
  const u = state.user;
  if (!u || !u.accessibility) return;
  const a = u.accessibility;
  document.documentElement.style.fontSize = a.fontSize === 'xlarge' ? '22px' : a.fontSize === 'small' ? '16px' : '18px';
  document.body.classList.toggle('contrast-high', a.contrast === 'high');
  if (a.voice) enableVoice();
}

function speak(text) {
  if (!window.speechSynthesis) return;
  const u = state.user;
  if (!u || !u.accessibility || !u.accessibility.voice) return;
  const ut = new SpeechSynthesisUtterance(text);
  ut.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(ut);
}

function enableVoice() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
  if (window._cucuRec) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  rec.onresult = (e) => {
    const last = e.results[e.results.length - 1];
    if (last.isFinal) handleVoiceCommand(last[0].transcript.trim().toLowerCase());
  };
  try { rec.start(); } catch (e) {}
  window._cucuRec = rec;
}

function handleVoiceCommand(cmd) {
  if (cmd.includes('home')) go('home');
  else if (cmd.includes('health')) go('healthcare');
  else if (cmd.includes('bill')) go('bills');
  else if (cmd.includes('shop') || cmd.includes('store')) go('shop');
  else if (cmd.includes('therapy')) go('therapy');
  else if (cmd.includes('profile')) go('profile');
  else if (cmd.includes('access')) go('accessibility');
  else if (cmd.includes('emergency') || cmd.includes('sos')) go('sos');
  else if (cmd.includes('cart')) go('cart');
  else if (cmd.includes('order')) go('orders');
  else if (cmd.includes('med')) go('medications');
  else if (cmd.includes('vital')) go('vitals');
  else if (cmd.includes('notif')) go('notifications');
}

const routes = {
  home: renderHome,
  healthcare: renderHealthcare,
  bills: renderBills,
  shop: renderShop,
  therapy: renderTherapy,
  profile: renderProfile,
  accessibility: renderAccessibility,
  sos: renderSOS,
  cart: renderCart,
  orders: renderOrders,
  medications: renderMedications,
  vitals: renderVitals,
  subscriptions: renderSubscriptions,
  notifications: renderNotifications,
  admin: renderAdmin,
  auth: renderAuth,
  ussd: renderUSSD,
  provider: renderProvider,
  caregiver: renderCaregiver,
  delivery: renderDelivery,
};

function go(route) {
  $$('.view').forEach((v) => { v.hidden = true; });
  const el = $('#view-' + route);
  if (el) el.hidden = false;
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.route === route));
  $$('.bn-btn').forEach((b) => b.classList.toggle('active', b.dataset.route === route));
  const fn = routes[route];
  if (fn) fn();
  window.scrollTo(0, 0);
  const main = document.getElementById('main');
  if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
  const sb = $('#sidebar'); const ov = $('#sidebar-overlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('open');
}

function fmtMoney(n) { return 'KES ' + Number(n).toLocaleString(); }

// ---------- Home ----------
async function renderHome() {
  const v = $('#view-home');
  let services = [];
  try { const r = await api('/api/services'); services = r.services || []; } catch (e) {}
  const cards = services.map((svc) => `
    <div class="card"><h2>${escapeHtml(svc.name)}</h2><p>${escapeHtml(svc.description)}</p></div>
  `).join('') || '<div class="empty"><p>No services configured. Add services via admin.</p></div>';
  v.innerHTML = `
    <div class="hero">
      <h1>Welcome to Cucu Connect</h1>
      <p>Digital and commerce services for the elderly and disabled.</p>
    </div>
    <div class="stat-grid" style="margin-bottom:var(--gap);">
      <div class="stat"><div class="num" id="stat-products">${(state.products||[]).length}</div><div class="label">Products</div></div>
      <div class="stat"><div class="num" id="stat-cart">${(state.cart||[]).length}</div><div class="label">Cart Items</div></div>
      <div class="stat"><div class="num" id="stat-notifs">${(state.notifications||[]).length}</div><div class="label">Notifications</div></div>
    </div>
    <div class="grid">${cards}</div>
  `;
  speak('Welcome to Cucu Connect');
  updateNotifBadge();
}

// ---------- Auth ----------
function renderAuth() {
  const v = $('#view-auth') || createView('auth');
  v.innerHTML = `
    <h1>Account</h1>
    <div class="grid">
      <div class="card">
        <h2>Login</h2>
        <label>Email</label><input id="l-email" type="email">
        <label>Password</label><input id="l-pass" type="password">
        <button class="btn" id="l-btn">Login</button>
      </div>
      <div class="card">
        <h2>Register</h2>
        <label>Name</label><input id="r-name">
        <label>Email</label><input id="r-email" type="email">
        <label>Password</label><input id="r-pass" type="password">
        <label>Phone</label><input id="r-phone">
        <button class="btn" id="r-btn">Register</button>
      </div>
    </div>
    <div class="card" id="auth-status"></div>
  `;
  $('#l-btn').addEventListener('click', login);
  $('#r-btn').addEventListener('click', register);
  renderAuthStatus();
}
function createView(name) {
  const sec = document.createElement('section');
  sec.id = 'view-' + name;
  sec.className = 'view';
  sec.hidden = true;
  document.querySelector('main').appendChild(sec);
  return sec;
}
// ensure auth view exists
(function ensureViews() {
  ['auth','medications','vitals','subscriptions','notifications','admin'].forEach((n) => {
    if (!document.getElementById('view-' + n)) createView(n);
  });
})();

function renderAuthStatus() {
  const el = $('#auth-status');
  if (!el) return;
  if (state.token && state.user) {
    el.innerHTML = `<p>Logged in as <strong>${state.user.name}</strong> (${state.user.email || state.user.id}).</p><button class="btn danger" id="logout-btn">Logout</button>`;
    $('#logout-btn').addEventListener('click', logout);
  } else {
    el.innerHTML = '<p>Not logged in. You can still use guest features.</p>';
  }
}
async function login() {
  try {
    const r = await api('/api/auth/login', { method: 'POST', body: { email: $('#l-email').value, password: $('#l-pass').value } });
    state.token = r.token;
    state.user = r.user;
    state.userId = r.user.id;
    localStorage.setItem('cucu_token', r.token);
    localStorage.setItem('cucu_user_id', r.user.id);
    try { const c = await api('/api/csrf'); state.csrf = c.csrf; } catch (e) {}
    toast('Welcome ' + r.user.name);
    speak('Welcome ' + r.user.name);
    applyAccessibility();
    renderAuthStatus();
  } catch (e) { toast(e.message); }
}
async function register() {
  try {
    const r = await api('/api/auth/register', { method: 'POST', body: { name: $('#r-name').value, email: $('#r-email').value, password: $('#r-pass').value, phone: $('#r-phone').value } });
    state.token = r.token;
    state.user = r.user;
    state.userId = r.user.id;
    localStorage.setItem('cucu_token', r.token);
    localStorage.setItem('cucu_user_id', r.user.id);
    try { const c = await api('/api/csrf'); state.csrf = c.csrf; } catch (e) {}
    toast('Account created');
    speak('Account created');
    applyAccessibility();
    renderAuthStatus();
  } catch (e) { toast(e.message); }
}
async function logout() {
  try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch (e) {}
  state.token = null;
  localStorage.removeItem('cucu_token');
  toast('Logged out');
  renderAuthStatus();
}

// ---------- Healthcare ----------
function renderHealthcare() {
  const v = $('#view-healthcare');
  v.innerHTML = `
    <h1>Healthcare Services</h1>
    <div class="card">
      <h2>Book an Appointment</h2>
      <label>Service</label>
      <select id="appt-service">
        <option value="Telehealth Consultation">Telehealth Consultation</option>
        <option value="General Checkup">General Checkup</option>
        <option value="Home Visit">Home Visit</option>
        <option value="Insurance Review">Insurance Review</option>
      </select>
      <label>Provider</label>
      <input id="appt-provider" placeholder="Doctor/clinic name">
      <label>Date</label>
      <input type="date" id="appt-date">
      <label>Time</label>
      <input type="time" id="appt-time" value="09:00">
      <label>Notes</label>
      <textarea id="appt-notes" rows="3" placeholder="Describe your needs"></textarea>
      <button class="btn" id="appt-book">Book Appointment</button>
    </div>
    <div class="card">
      <h2>Health Products</h2>
      <div class="grid" id="health-products"></div>
    </div>
    <div class="card">
      <h2>My Appointments</h2>
      <div id="appt-list"></div>
    </div>
  `;
  $('#appt-book').addEventListener('click', bookAppointment);
  loadProducts('healthcare', '#health-products');
  loadProducts('health', '#health-products');
  loadAppointments();
}
async function bookAppointment() {
  const body = {
    userId: state.userId,
    service: $('#appt-service').value,
    provider: $('#appt-provider').value,
    date: $('#appt-date').value,
    time: $('#appt-time').value,
    notes: $('#appt-notes').value,
  };
  if (!body.date) { toast('Please choose a date'); return; }
  try {
    await api('/api/appointments', { method: 'POST', body });
    toast('Appointment booked');
    speak('Appointment booked');
    loadAppointments();
  } catch (e) { toast(e.message); }
}
async function loadAppointments() {
  try {
    const r = await api('/api/appointments/user/' + encodeURIComponent(state.userId));
    const el = $('#appt-list');
    if (!el) return;
    if (!r.appointments.length) { el.innerHTML = '<div class="empty"><p>No appointments yet.</p></div>'; return; }
    el.innerHTML = '<table><thead><tr><th>Service</th><th>Provider</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      r.appointments.map((a) => `<tr>
        <td>${escapeHtml(a.service)}</td><td>${escapeHtml(a.provider || '-')}</td><td>${a.date}</td><td>${a.time}</td><td>${a.status}</td>
        <td>${a.status === 'scheduled' ? `<button class="btn secondary" onclick="cancelAppt('${a.id}')">Cancel</button>` : ''}</td>
      </tr>`).join('') + '</tbody></table>';
  } catch (e) { toast(e.message); }
}
window.cancelAppt = async function (id) {
  await api('/api/appointments/cancel', { method: 'POST', body: { id } });
  toast('Cancelled');
  loadAppointments();
};

// ---------- Bills ----------
function renderBills() {
  const v = $('#view-bills');
  v.innerHTML = `
    <h1>Bills & Payments</h1>
    <p>Pay your utility and insurance bills securely.</p>
    <div class="card"><div id="bills-list"></div></div>
  `;
  loadBills();
}
async function loadBills() {
  try {
    const r = await api('/api/bills/user/' + encodeURIComponent(state.userId));
    const el = $('#bills-list');
    if (!el) return;
    if (!r.bills.length) { el.innerHTML = '<div class="empty"><p>No bills.</p></div>'; return; }
    el.innerHTML = '<table><thead><tr><th>Type</th><th>Provider</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      r.bills.map((b) => `<tr>
        <td>${escapeHtml(b.type)}</td><td>${escapeHtml(b.provider)}</td><td>${fmtMoney(b.amount)}</td><td>${b.dueDate}</td><td>${b.status}</td>
        <td>${b.status !== 'paid' ? `<button class="btn" onclick="payBill('${b.id}')">Pay</button>` : 'Paid'}</td>
      </tr>`).join('') + '</tbody></table>';
  } catch (e) { toast(e.message); }
}
window.payBill = async function (id) {
  try {
    await api('/api/bills/pay', { method: 'POST', body: { billId: id } });
    toast('Bill paid');
    speak('Bill paid');
    loadBills();
  } catch (e) { toast(e.message); }
};

// ---------- Shop ----------
function renderShop() {
  const v = $('#view-shop');
  v.innerHTML = `
    <h1>Shop</h1>
    <div class="card">
      <input id="shop-search" placeholder="Search products..." />
      <label>Category</label>
      <select id="shop-cat"><option value="">All</option></select>
    </div>
    <div class="grid" id="shop-products"></div>
    <div class="card">
      <button class="btn" onclick="go('cart')">View Cart</button>
    </div>
  `;
  $('#shop-cat').addEventListener('change', () => loadShopProducts());
  $('#shop-search').addEventListener('input', () => loadShopProducts());
  loadShopProducts();
}
async function loadShopProducts() {
  const cat = $('#shop-cat').value;
  const q = $('#shop-search').value.trim();
  const params = new URLSearchParams();
  if (cat) params.set('category', cat);
  if (q) params.set('q', q);
  try {
    const r = await api('/api/products?' + params.toString());
    const catSel = $('#shop-cat');
    if (catSel && catSel.options.length <= 1) {
      const cats = [...new Set((r.products || []).map((p) => p.category))];
      cats.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });
    }
    const el = $('#shop-products');
    el.innerHTML = r.products.map((p) => `
      <div class="card product">
        <h3>${escapeHtml(p.name)}</h3>
        <span class="badge">${p.category}</span>
        <p>${escapeHtml(p.description)}</p>
        <div class="price">${fmtMoney(p.price)}</div>
        <p>Stock: ${p.stock}</p>
        <button class="btn" onclick="addToCart('${p.id}')">Add to Cart</button>
        <button class="btn secondary" onclick="viewProduct('${p.id}')">Details</button>
      </div>
    `).join('') || '<div class="empty"><p>No products found.</p></div>';
  } catch (e) { toast(e.message); }
}
window.addToCart = async function (productId) {
  try {
    await api('/api/cart/add', { method: 'POST', body: { userId: state.userId, productId, qty: 1 } });
    toast('Added to cart');
    speak('Added to cart');
  } catch (e) { toast(e.message); }
};
window.viewProduct = async function (id) {
  try {
    const r = await api('/api/products/' + encodeURIComponent(id));
    const p = r.product;
    const reviews = r.reviews || [];
    const html = `
      <div class="card">
        <h2>${p.name}</h2>
        <p>${escapeHtml(p.description)}</p>
        <div class="price">${fmtMoney(p.price)}</div>
        <p>Stock: ${p.stock}</p>
        <h3>Reviews</h3>
        ${reviews.length ? reviews.map((rv) => `<p><strong>${rv.rating}/5</strong> ${escapeHtml(rv.comment)}</p>`).join('') : '<div class="empty"><p>No reviews yet.</p></div>'}
        <h3>Add Review</h3>
        <label>Rating (1-5)</label><input id="rev-rating" type="number" min="1" max="5" value="5">
        <label>Comment</label><textarea id="rev-comment"></textarea>
        <button class="btn" onclick="submitReview('${p.id}')">Submit Review</button>
      </div>
    `;
    // show in a modal-like card at top of shop view
    const container = $('#view-shop');
    const div = document.createElement('div');
    div.innerHTML = html;
    container.prepend(div);
  } catch (e) { toast(e.message); }
};
window.submitReview = async function (productId) {
  try {
    await api('/api/reviews', { method: 'POST', body: { userId: state.userId, productId, rating: $('#rev-rating').value, comment: $('#rev-comment').value } });
    toast('Review submitted');
  } catch (e) { toast(e.message); }
};
async function loadProducts(cat, selector) {
  try {
    const r = await api('/api/products?category=' + encodeURIComponent(cat));
    const el = $(selector);
    if (!el) return;
    el.innerHTML = r.products.map((p) => `
      <div class="card product">
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="price">${fmtMoney(p.price)}</div>
        <button class="btn" onclick="addToCart('${p.id}')">Add to Cart</button>
      </div>
    `).join('') || '<div class="empty"><p>No products.</p></div>';
  } catch (e) {}
}

// ---------- Therapy ----------
function renderTherapy() {
  const v = $('#view-therapy');
  v.innerHTML = `
    <h1>Physical Therapy</h1>
    <div class="card">
      <h2>Book a Therapy Session</h2>
      <label>Session Type</label>
      <select id="th-type">
        <option value="Physical Therapy Session">Physical Therapy Session</option>
        <option value="Home Therapy Visit">Home Therapy Visit</option>
        <option value="Rehabilitation Program">Rehabilitation Program</option>
      </select>
      <label>Date</label>
      <input type="date" id="th-date">
      <label>Time</label>
      <input type="time" id="th-time" value="10:00">
      <label>Notes</label>
      <textarea id="th-notes" rows="3"></textarea>
      <button class="btn" id="th-book">Book Session</button>
    </div>
    <div class="card">
      <h2>Therapy Products</h2>
      <div class="grid" id="therapy-products"></div>
    </div>
  `;
  $('#th-book').addEventListener('click', async () => {
    const body = {
      userId: state.userId,
      service: $('#th-type').value,
      date: $('#th-date').value,
      time: $('#th-time').value,
      notes: $('#th-notes').value,
    };
    if (!body.date) { toast('Please choose a date'); return; }
    try {
      await api('/api/appointments', { method: 'POST', body });
      toast('Therapy session booked');
      speak('Therapy session booked');
    } catch (e) { toast(e.message); }
  });
  loadProducts('therapy', '#therapy-products');
}

// ---------- Profile ----------
function renderProfile() {
  const v = $('#view-profile');
  v.innerHTML = `
    <h1>My Profile</h1>
    <div class="card">
      <label>Name</label>
      <input id="p-name">
      <label>Phone</label>
      <input id="p-phone">
      <label>Email</label>
      <input id="p-email">
      <label>Caregiver Name</label>
      <input id="p-cg-name">
      <label>Caregiver Phone</label>
      <input id="p-cg-phone">
      <label>Insurance Provider</label>
      <input id="p-ins-provider">
      <label>Insurance Policy</label>
      <input id="p-ins-policy">
      <button class="btn" id="p-save">Save Profile</button>
    </div>
    <div class="card">
      <h2>Emergency Contacts</h2>
      <label>Name</label><input id="ec-name">
      <label>Phone</label><input id="ec-phone">
      <button class="btn secondary" id="ec-add">Add Contact</button>
      <div id="ec-list"></div>
    </div>
    <div class="card">
      <button class="btn secondary" onclick="exportData()">Export My Data</button>
    </div>
  `;
  loadProfile();
  $('#p-save').addEventListener('click', saveProfile);
  $('#ec-add').addEventListener('click', addEmergencyContact);
}
async function loadProfile() {
  try {
    const r = await api('/api/profile/' + encodeURIComponent(state.userId));
    const u = r.user || {};
    state.user = u;
    $('#p-name').value = u.name || '';
    $('#p-phone').value = u.phone || '';
    $('#p-email').value = u.email || '';
    $('#p-cg-name').value = (u.caregiver && u.caregiver.name) || '';
    $('#p-cg-phone').value = (u.caregiver && u.caregiver.phone) || '';
    $('#p-ins-provider').value = (u.insurance && u.insurance.provider) || '';
    $('#p-ins-policy').value = (u.insurance && u.insurance.policy) || '';
    applyAccessibility();
    renderECList();
  } catch (e) { toast(e.message); }
}
async function saveProfile() {
  const body = {
    userId: state.userId,
    name: $('#p-name').value,
    phone: $('#p-phone').value,
    email: $('#p-email').value,
    caregiver: { name: $('#p-cg-name').value, phone: $('#p-cg-phone').value },
    insurance: { provider: $('#p-ins-provider').value, policy: $('#p-ins-policy').value },
  };
  try {
    const r = await api('/api/profile', { method: 'POST', body });
    state.user = r.user;
    toast('Profile saved');
    speak('Profile saved');
  } catch (e) { toast(e.message); }
}
async function addEmergencyContact() {
  const name = $('#ec-name').value.trim();
  const phone = $('#ec-phone').value.trim();
  if (!name || !phone) { toast('Enter name and phone'); return; }
  try {
    const r = await api('/api/profile/' + encodeURIComponent(state.userId));
    const u = r.user || {};
    const contacts = u.emergencyContacts || [];
    contacts.push({ name, phone });
    await api('/api/profile', { method: 'POST', body: { userId: state.userId, emergencyContacts: contacts } });
    $('#ec-name').value = '';
    $('#ec-phone').value = '';
    toast('Contact added');
    const r2 = await api('/api/profile/' + encodeURIComponent(state.userId));
    state.user = r2.user;
    renderECList();
  } catch (e) { toast(e.message); }
}
function renderECList() {
  const el = $('#ec-list');
  if (!el) return;
  const contacts = (state.user && state.user.emergencyContacts) || [];
  if (!contacts.length) { el.innerHTML = '<div class="empty"><p>No emergency contacts yet.</p></div>'; return; }
  el.innerHTML = '<ul>' + contacts.map((c) => `<li>${c.name} - ${c.phone}</li>`).join('') + '</ul>';
}
window.exportData = async function () {
  try {
    const r = await api('/api/export/user/' + encodeURIComponent(state.userId));
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cucu-data.json'; a.click();
    URL.revokeObjectURL(url);
    toast('Data exported');
  } catch (e) { toast(e.message); }
};

// ---------- Accessibility ----------
function renderAccessibility() {
  const v = $('#view-accessibility');
  v.innerHTML = `
    <h1>Accessibility Settings</h1>
    <div class="card">
      <label>Text Size</label>
      <select id="a-font">
        <option value="small">Small</option>
        <option value="large">Large (default)</option>
        <option value="xlarge">Extra Large</option>
      </select>
      <label>Contrast</label>
      <select id="a-contrast">
        <option value="normal">Normal</option>
        <option value="high">High Contrast</option>
      </select>
      <label>Voice Assistant (read aloud + voice commands)</label>
      <select id="a-voice">
        <option value="false">Off</option>
        <option value="true">On</option>
      </select>
      <button class="btn" id="a-save">Save Settings</button>
    </div>
    <div class="card">
      <h2>Tips</h2>
      <ul>
        <li>Use Tab to navigate. All buttons are keyboard accessible.</li>
        <li>High contrast improves readability.</li>
        <li>Voice commands: say "home", "shop", "bills", "emergency", etc.</li>
      </ul>
    </div>
  `;
  (async () => {
    try {
      const r = await api('/api/profile/' + encodeURIComponent(state.userId));
      const u = r.user || {};
      state.user = u;
      const a = u.accessibility || {};
      $('#a-font').value = a.fontSize || 'large';
      $('#a-contrast').value = a.contrast || 'normal';
      $('#a-voice').value = a.voice ? 'true' : 'false';
    } catch (e) {}
  })();
  $('#a-save').addEventListener('click', async () => {
    const body = {
      userId: state.userId,
      accessibility: {
        fontSize: $('#a-font').value,
        contrast: $('#a-contrast').value,
        voice: $('#a-voice').value === 'true',
      },
    };
    try {
      const r = await api('/api/profile', { method: 'POST', body });
      state.user = r.user;
      applyAccessibility();
      toast('Settings saved');
      speak('Settings saved');
    } catch (e) { toast(e.message); }
  });
}

// ---------- SOS ----------
function renderSOS() {
  const v = $('#view-sos');
  v.innerHTML = `
    <h1>Emergency SOS</h1>
    <div class="sos-box">
      <h2>Press SOS to alert caregivers</h2>
      <button class="btn danger big" id="sos-btn" style="font-size:1.6rem;padding:20px 40px;">SOS - Send Alert</button>
    </div>
    <div class="card">
      <p>Also call emergency services: 112 / 999 / 911</p>
    </div>
  `;
  $('#sos-btn').addEventListener('click', sendSOS);
}
async function sendSOS() {
  try {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await api('/api/sos', { method: 'POST', body: { userId: state.userId, location: pos.coords.latitude + ',' + pos.coords.longitude } });
        toast('Emergency alert sent');
        speak('Emergency alert sent. Help is on the way.');
      }, async () => {
        await api('/api/sos', { method: 'POST', body: { userId: state.userId, location: 'unknown' } });
        toast('Emergency alert sent');
        speak('Emergency alert sent.');
      });
    } else {
      await api('/api/sos', { method: 'POST', body: { userId: state.userId, location: 'unknown' } });
      toast('Emergency alert sent');
    }
  } catch (e) { toast(e.message); }
}

// ---------- Cart ----------
function renderCart() {
  const v = $('#view-cart');
  v.innerHTML = `
    <h1>Shopping Cart</h1>
    <div class="card" id="cart-list"></div>
    <div class="card">
      <label>Delivery Address</label>
      <input id="cart-addr" placeholder="Your address">
      <label>Preferred Delivery Date</label>
      <input type="date" id="cart-date">
      <button class="btn" id="checkout-btn">Checkout</button>
      <button class="btn secondary" onclick="go('shop')">Continue Shopping</button>
    </div>
  `;
  loadCart();
  $('#checkout-btn').addEventListener('click', checkout);
}
async function loadCart() {
  try {
    const r = await api('/api/cart/' + encodeURIComponent(state.userId));
    const el = $('#cart-list');
    if (!r.items.length) { el.innerHTML = '<div class="empty"><p>Your cart is empty.</p></div>'; return; }
    el.innerHTML = '<table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead><tbody>' +
      r.items.map((i) => `<tr>
        <td>${i.product ? i.product.name : i.productId}</td>
        <td>${i.qty}</td>
        <td>${fmtMoney(i.product ? i.product.price : 0)}</td>
        <td>${fmtMoney(i.lineTotal)}</td>
        <td><button class="btn secondary" onclick="removeFromCart('${i.productId}')">Remove</button></td>
      </tr>`).join('') + '</tbody></table>' +
      `<p class="big">Total: ${fmtMoney(r.total)}</p>`;
    state.cartTotal = r.total;
  } catch (e) { toast(e.message); }
}
window.removeFromCart = async function (productId) {
  await api('/api/cart/remove', { method: 'POST', body: { userId: state.userId, productId } });
  toast('Removed');
  loadCart();
};
async function checkout() {
  try {
    const r = await api('/api/checkout', { method: 'POST', body: { userId: state.userId, address: $('#cart-addr').value, deliveryDate: $('#cart-date').value } });
    toast('Order placed: ' + r.order.id);
    speak('Order placed');
    confetti();
    go('orders');
  } catch (e) { toast(e.message); }
}

// ---------- Orders ----------
function renderOrders() {
  const v = $('#view-orders');
  v.innerHTML = `<h1>My Orders</h1><div class="card" id="orders-list"></div>`;
  loadOrders();
}
async function loadOrders() {
  try {
    const r = await api('/api/orders/user/' + encodeURIComponent(state.userId));
    const el = $('#orders-list');
    if (!r.orders.length) { el.innerHTML = '<div class="empty"><p>No orders yet.</p></div>'; return; }
    el.innerHTML = '<table><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th><th>Track</th></tr></thead><tbody>' +
      r.orders.map((o) => `<tr>
        <td>${o.id}</td><td>${new Date(o.createdAt).toLocaleDateString()}</td>
        <td>${o.items.map((i) => i.name + ' x' + i.qty).join(', ')}</td>
        <td>${fmtMoney(o.total)}</td><td>${o.status}</td>
        <td><button class="btn secondary" onclick="trackOrder('${o.id}')">Track</button></td>
      </tr>`).join('') + '</tbody></table>';
  } catch (e) { toast(e.message); }
}
window.trackOrder = async function (id) {
  try {
    const r = await api('/api/orders/' + encodeURIComponent(id));
    const o = r.order;
    toast('Order ' + o.id + ' status: ' + o.status);
  } catch (e) { toast(e.message); }
};

// ---------- Medications ----------
function renderMedications() {
  const v = $('#view-medications');
  v.innerHTML = `
    <h1>Medication Reminders</h1>
    <div class="card">
      <h2>Add Medication</h2>
      <label>Name</label><input id="m-name">
      <label>Dosage</label><input id="m-dosage" placeholder="e.g. 1 tablet">
      <label>Schedule</label>
      <select id="m-schedule"><option value="daily">Daily</option><option value="twice">Twice daily</option><option value="weekly">Weekly</option></select>
      <label>Times (comma separated)</label><input id="m-times" value="08:00">
      <label>Start Date</label><input type="date" id="m-start">
      <label>End Date (optional)</label><input type="date" id="m-end">
      <label>Notes</label><textarea id="m-notes"></textarea>
      <button class="btn" id="m-add">Add Medication</button>
    </div>
    <div class="card">
      <h2>Adherence</h2>
      <div id="med-adh"></div>
    </div>
    <div class="card">
      <h2>My Medications</h2>
      <div id="med-list"></div>
    </div>
  `;
  $('#m-add').addEventListener('click', addMedication);
  loadMedications();
}
async function addMedication() {
  const body = {
    userId: state.userId,
    name: $('#m-name').value,
    dosage: $('#m-dosage').value,
    schedule: $('#m-schedule').value,
    times: $('#m-times').value.split(',').map((s) => s.trim()).filter(Boolean),
    startDate: $('#m-start').value || new Date().toISOString().slice(0, 10),
    endDate: $('#m-end').value || null,
    notes: $('#m-notes').value,
  };
  if (!body.name) { toast('Name required'); return; }
  try {
    await api('/api/medications', { method: 'POST', body });
    toast('Medication added');
    speak('Medication added');
    loadMedications();
  } catch (e) { toast(e.message); }
}
async function loadMedications() {
  try {
    const r = await api('/api/medications/user/' + encodeURIComponent(state.userId));
    const el = $('#med-list');
    if (!el) return;
    if (!r.medications.length) { el.innerHTML = '<div class="empty"><p>No medications.</p></div>'; $('#med-adh').innerHTML = ''; return; }
    el.innerHTML = '<table><thead><tr><th>Name</th><th>Dosage</th><th>Schedule</th><th>Times</th><th>Status</th><th>Log</th><th></th></tr></thead><tbody>' +
      r.medications.map((m) => `<tr>
        <td>${m.name}</td><td>${m.dosage}</td><td>${m.schedule}</td><td>${(m.times || []).join(', ')}</td><td>${m.active ? 'Active' : 'Inactive'}</td>
        <td><button class="btn secondary" onclick="logMed('${m.id}',true)">Taken</button> <button class="btn secondary" onclick="logMed('${m.id}',false)">Missed</button></td>
        <td><button class="btn secondary" onclick="deleteMed('${m.id}')">Delete</button></td>
      </tr>`).join('') + '</tbody></table>';
    // adherence
    const a = await api('/api/medications/user/' + encodeURIComponent(state.userId) + '/adherence');
    $('#med-adh').innerHTML = `<p>Medications: ${a.medications}, Logs: ${a.logs}, Taken: ${a.taken}, Adherence: ${a.adherence}%</p>`;
  } catch (e) { toast(e.message); }
}
window.logMed = async function (id, taken) {
  try {
    await api('/api/medications/log', { method: 'POST', body: { medicationId: id, taken, timestamp: new Date().toISOString() } });
    toast(taken ? 'Marked taken' : 'Marked missed');
    loadMedications();
  } catch (e) { toast(e.message); }
};
window.deleteMed = async function (id) {
  try {
    await api('/api/medications/' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Deleted');
    loadMedications();
  } catch (e) { toast(e.message); }
};

// ---------- Vitals ----------
function renderVitals() {
  const v = $('#view-vitals');
  v.innerHTML = `
    <h1>Vitals Tracking</h1>
    <div class="card">
      <h2>Record Vital</h2>
      <label>Type</label>
      <select id="v-type">
        <option value="blood_pressure">Blood Pressure</option>
        <option value="glucose">Blood Glucose</option>
        <option value="heart_rate">Heart Rate</option>
        <option value="weight">Weight</option>
        <option value="temperature">Temperature</option>
      </select>
      <label>Value</label><input id="v-value" type="number" step="any">
      <label>Unit</label><input id="v-unit" placeholder="e.g. mmHg, mg/dL">
      <label>Notes</label><textarea id="v-notes"></textarea>
      <button class="btn" id="v-add">Save Vital</button>
    </div>
    <div class="card">
      <label>Filter by type</label>
      <select id="v-filter"><option value="">All</option>
        <option value="blood_pressure">Blood Pressure</option>
        <option value="glucose">Blood Glucose</option>
        <option value="heart_rate">Heart Rate</option>
        <option value="weight">Weight</option>
        <option value="temperature">Temperature</option>
      </select>
      <div id="v-list"></div>
    </div>
  `;
  $('#v-add').addEventListener('click', addVital);
  $('#v-filter').addEventListener('change', loadVitals);
  loadVitals();
}
async function addVital() {
  const body = {
    userId: state.userId,
    type: $('#v-type').value,
    value: $('#v-value').value,
    unit: $('#v-unit').value,
    notes: $('#v-notes').value,
  };
  if (body.value === '') { toast('Value required'); return; }
  try {
    await api('/api/vitals', { method: 'POST', body });
    toast('Vital recorded');
    loadVitals();
  } catch (e) { toast(e.message); }
}
async function loadVitals() {
  try {
    const type = $('#v-filter').value;
    const q = type ? '?type=' + encodeURIComponent(type) : '';
    const r = await api('/api/vitals/user/' + encodeURIComponent(state.userId) + q);
    const el = $('#v-list');
    if (!r.vitals.length) { el.innerHTML = '<div class="empty"><p>No vitals recorded.</p></div>'; return; }
    el.innerHTML = '<table><thead><tr><th>Type</th><th>Value</th><th>Unit</th><th>Time</th><th></th></tr></thead><tbody>' +
      r.vitals.map((v) => `<tr>
        <td>${v.type}</td><td>${v.value}</td><td>${v.unit}</td><td>${new Date(v.timestamp).toLocaleString()}</td>
        <td><button class="btn secondary" onclick="deleteVital('${v.id}')">Delete</button></td>
      </tr>`).join('') + '</tbody></table>';
  } catch (e) { toast(e.message); }
}
window.deleteVital = async function (id) {
  try {
    await api('/api/vitals/' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Deleted');
    loadVitals();
  } catch (e) { toast(e.message); }
};

// ---------- Subscriptions ----------
function renderSubscriptions() {
  const v = $('#view-subscriptions');
  v.innerHTML = `
    <h1>Subscriptions</h1>
    <div class="card">
      <h2>Create Recurring Order</h2>
      <label>Product</label>
      <select id="sub-product"></select>
      <label>Frequency</label>
      <select id="sub-freq"><option value="weekly">Weekly</option><option value="monthly" selected>Monthly</option><option value="daily">Daily</option></select>
      <label>Quantity</label><input id="sub-qty" type="number" value="1">
      <label>Next Date</label><input type="date" id="sub-next">
      <button class="btn" id="sub-add">Subscribe</button>
    </div>
    <div class="card">
      <h2>My Subscriptions</h2>
      <div id="sub-list"></div>
    </div>
  `;
  loadSubProducts();
  $('#sub-add').addEventListener('click', addSubscription);
  loadSubscriptions();
}
async function loadSubProducts() {
  try {
    const r = await api('/api/products');
    const sel = $('#sub-product');
    sel.innerHTML = r.products.map((p) => `<option value="${p.id}">${p.name} - ${fmtMoney(p.price)}</option>`).join('');
  } catch (e) {}
}
async function addSubscription() {
  const body = {
    userId: state.userId,
    productId: $('#sub-product').value,
    frequency: $('#sub-freq').value,
    qty: Number($('#sub-qty').value || 1),
    nextDate: $('#sub-next').value || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  };
  try {
    await api('/api/subscriptions', { method: 'POST', body });
    toast('Subscription created');
    loadSubscriptions();
  } catch (e) { toast(e.message); }
}
async function loadSubscriptions() {
  try {
    const r = await api('/api/subscriptions/user/' + encodeURIComponent(state.userId));
    const el = $('#sub-list');
    if (!r.subscriptions.length) { el.innerHTML = '<div class="empty"><p>No subscriptions.</p></div>'; return; }
    el.innerHTML = '<table><thead><tr><th>Product</th><th>Frequency</th><th>Qty</th><th>Next Date</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      r.subscriptions.map((s) => {
        const p = (state.products || []).find((x) => x.id === s.productId);
        return `<tr>
          <td>${s.productId}</td><td>${s.frequency}</td><td>${s.qty}</td><td>${s.nextDate}</td><td>${s.status}</td>
          <td>${s.status === 'active' ? `<button class="btn secondary" onclick="toggleSub('${s.id}','paused')">Pause</button>` : `<button class="btn" onclick="toggleSub('${s.id}','active')">Resume</button>`}
          <button class="btn danger" onclick="toggleSub('${s.id}','cancelled')">Cancel</button></td>
        </tr>`;
      }).join('') + '</tbody></table>';
  } catch (e) { toast(e.message); }
}
window.toggleSub = async function (id, status) {
  try {
    await api('/api/subscriptions/' + encodeURIComponent(id), { method: 'PUT', body: { status } });
    toast('Updated');
    loadSubscriptions();
  } catch (e) { toast(e.message); }
};

// ---------- Notifications ----------
function renderNotifications() {
  const v = $('#view-notifications');
  v.innerHTML = `
    <h1>Notifications</h1>
    <div class="card">
      <button class="btn secondary" onclick="markAllRead()">Mark all read</button>
    </div>
    <div class="card" id="notif-list"></div>
  `;
  loadNotifications();
}
async function loadNotifications() {
  try {
    const r = await api('/api/notifications/user/' + encodeURIComponent(state.userId));
    const el = $('#notif-list');
    if (!r.notifications.length) { el.innerHTML = '<div class="empty"><p>No notifications.</p></div>'; return; }
    el.innerHTML = r.notifications.map((n) => `
      <div class="card" style="opacity:${n.read ? 0.6 : 1}">
        <strong>${n.title}</strong> <span class="badge">${n.type}</span>
        <p>${n.message}</p>
        <small>${new Date(n.createdAt).toLocaleString()}</small>
        ${!n.read ? `<button class="btn secondary" onclick="markRead('${n.id}')">Mark read</button>` : ''}
      </div>
    `).join('');
  } catch (e) { toast(e.message); }
}
window.markRead = async function (id) {
  await api('/api/notifications/read', { method: 'POST', body: { id } });
  loadNotifications();
};
window.markAllRead = async function () {
  await api('/api/notifications/read-all', { method: 'POST', body: { userId: state.userId } });
  loadNotifications();
  toast('All marked read');
};
async function updateNotifBadge() {
  try {
    const r = await api('/api/notifications/user/' + encodeURIComponent(state.userId));
    const unread = r.notifications.filter((n) => !n.read).length;
    // update a badge if exists
    const badge = $('#notif-badge');
    if (badge) badge.textContent = unread ? unread : '';
  } catch (e) {}
}

// ---------- Admin ----------
function renderAdmin() {
  const v = $('#view-admin') || createView('admin');
  v.innerHTML = `
    <h1>Admin Dashboard</h1>
    <div class="card" id="admin-stats"></div>

    <div class="card">
      <h2>Manage Products</h2>
      <div class="grid" style="grid-template-columns:1fr 1fr;">
        <div>
          <label>Name</label><input id="adm-p-name">
          <label>Category</label><input id="adm-p-cat" value="general">
          <label>Price</label><input id="adm-p-price" type="number" step="0.01">
          <label>Stock</label><input id="adm-p-stock" type="number">
          <label>Description</label><textarea id="adm-p-desc"></textarea>
          <button class="btn" id="adm-p-add">Add Product</button>
        </div>
        <div id="adm-products"></div>
      </div>
    </div>

    <div class="card">
      <h2>Orders</h2>
      <div id="adm-orders"></div>
    </div>

    <div class="card">
      <h2>Users</h2>
      <div id="admin-users"></div>
    </div>

    <div class="card">
      <h2>Process Subscriptions</h2>
      <button class="btn" onclick="processSubs()">Run</button>
    </div>
  `;
  $('#adm-p-add').addEventListener('click', addAdminProduct);
  loadAdmin();
}
async function loadAdmin() {
  try {
    const r = await api('/api/admin/stats');
    $('#admin-stats').innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="num">${r.users}</div><div class="label">Users</div></div>
        <div class="stat"><div class="num">${r.products}</div><div class="label">Products</div></div>
        <div class="stat"><div class="num">${r.orders}</div><div class="label">Orders</div></div>
        <div class="stat"><div class="num">${fmtMoney(r.revenue)}</div><div class="label">Revenue</div></div>
      </div>
    `;
    // products
    const pr = await api('/api/products');
    $('#adm-products').innerHTML = '<table><thead><tr><th>Name</th><th>Price</th><th>Stock</th><th></th></tr></thead><tbody>' +
      pr.products.map((p) => `<tr>
        <td>${p.name}</td><td>${fmtMoney(p.price)}</td><td>${p.stock}</td>
        <td><button class="btn danger sm" onclick="deleteAdminProduct('${p.id}')">Delete</button></td>
      </tr>`).join('') + '</tbody></table>';
    // orders
    // fetch all orders via admin? use /api/orders/:id not list; use stats only. Load from a global? We'll load user orders not available. Skip list; show recent via subscriptions process only.
    const or = await api('/api/orders');
    $('#adm-orders').innerHTML = '<table><thead><tr><th>Order</th><th>User</th><th>Total</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      or.orders.map((o) => `<tr>
        <td>${o.id}</td><td>${escapeHtml(o.userId)}</td><td>${fmtMoney(o.total)}</td><td>${o.status}</td>
        <td><select onchange="adminOrderStatus('${o.id}', this.value)">
          <option value="">Change</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select></td>
      </tr>`).join('') + '</tbody></table>';
    // users with role change
    $('#admin-users').innerHTML = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead><tbody>' +
      u.users.map((x) => `<tr>
        <td>${escapeHtml(x.name)}</td><td>${escapeHtml(x.email)}</td><td>${x.role}</td>
        <td><select onchange="adminUserRole('${x.id}', this.value)">
          <option value="">Change</option>
          <option value="customer">Customer</option>
          <option value="caregiver">Caregiver</option>
          <option value="provider">Provider</option>
          <option value="delivery">Delivery</option>
          <option value="admin">Admin</option>
        </select></td>
      </tr>`).join('') + '</tbody></table>';
    const u = await api('/api/admin/users');
    $('#admin-users').innerHTML = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead><tbody>' +
      u.users.map((x) => `<tr><td>${x.name}</td><td>${x.email}</td><td>${x.role}</td></tr>`).join('') + '</tbody></table>';
  } catch (e) { toast(e.message || 'Admin access required'); }
}
window.addAdminProduct = async function () {
  try {
    await api('/api/products', { method: 'POST', body: {
      name: $('#adm-p-name').value,
      category: $('#adm-p-cat').value,
      price: Number($('#adm-p-price').value),
      stock: Number($('#adm-p-stock').value),
      description: $('#adm-p-desc').value,
    }});
    toast('Product added');
    loadAdmin();
  } catch (e) { toast(e.message); }
};
window.adminOrderStatus = async function (id, status) {
  if (!status) return;
  try { await api('/api/orders/status', { method: 'POST', body: { orderId: id, status } }); toast('Order updated'); loadAdmin(); }
  catch (e) { toast(e.message); }
};
window.adminUserRole = async function (id, role) {
  if (!role) return;
  try { await api('/api/profile', { method: 'POST', body: { userId: id, role } }); toast('Role updated'); loadAdmin(); }
  catch (e) { toast(e.message); }
};
window.deleteAdminProduct = async function (id) {
  try {
    await api('/api/products/' + encodeURIComponent(id), { method: 'DELETE' });
    toast('Product deleted');
    loadAdmin();
  } catch (e) { toast(e.message); }
};

window.processSubs = async function () {
  try {
    const r = await api('/api/subscriptions/process', { method: 'POST', body: {} });
    toast('Processed ' + r.processed + ' subscriptions');
  } catch (e) { toast(e.message); }
};

// ---------- USSD Companion ----------
function renderUSSD() {
  const v = $('#view-ussd');
  v.innerHTML = `
    <h1>USSD Companion</h1>
    <p class="big">Interact with the Cucu Connect USSD service (*123#) for feature phones.</p>
    <div class="card">
      <label>Phone Number</label>
      <input id="ussd-phone" value="+254700000000">
      <label>USSD Input (e.g. 1*1*2026-12-01*09:00)</label>
      <input id="ussd-text" placeholder="Leave empty for main menu">
      <button class="btn" id="ussd-send">Send</button>
    </div>
    <div class="card">
      <h2>Response</h2>
      <pre id="ussd-resp" style="white-space:pre-wrap;font-size:1.1rem;"></pre>
    </div>
    <div class="card">
      <h2>Quick Dial Codes</h2>
      <p>Try: (empty) main menu; 5*1 SOS; 2 view/pay bills; 3*1 browse shop; 6*1 profile.</p>
    </div>
  `;
  $('#ussd-send').addEventListener('click', sendUSSD);
}
async function sendUSSD() {
  const phone = $('#ussd-phone').value;
  const text = $('#ussd-text').value;
  const form = new URLSearchParams();
  form.set('phoneNumber', phone);
  form.set('text', text);
  form.set('sessionId', 'sim-' + Date.now());
  try {
    const res = await fetch('/ussd', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    const txt = await res.text();
    $('#ussd-resp').textContent = txt;
    speak(txt.replace(/^(CON|END)\s*/, ''));
  } catch (e) { toast(e.message); }
}

// ---------- Provider companion ----------
function renderProvider() {
  const v = $('#view-provider');
  v.innerHTML = `
    <h1>Provider Companion</h1>
    <p class="big">Manage scheduled appointments.</p>
    <div class="card" id="prov-list"></div>
  `;
  loadProvider();
}
async function loadProvider() {
  try {
    const r = await api('/api/provider/appointments');
    const el = $('#prov-list');
    if (!r.appointments.length) { el.innerHTML = '<div class="empty"><p>No scheduled appointments.</p></div>'; return; }
    el.innerHTML = '<table><thead><tr><th>Service</th><th>User</th><th>Date</th><th>Time</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      r.appointments.map((a) => `<tr>
        <td>${a.service}</td><td>${a.userId}</td><td>${a.date}</td><td>${a.time}</td><td>${a.status}</td>
        <td>
          <button class="btn sm" onclick="provStatus('${a.id}','completed')">Complete</button>
          <button class="btn secondary sm" onclick="provStatus('${a.id}','cancelled')">Cancel</button>
        </td>
      </tr>`).join('') + '</tbody></table>';
  } catch (e) { toast(e.message || 'Provider access required'); }
}
window.provStatus = async function (id, status) {
  try {
    await api('/api/provider/appointments/status', { method: 'POST', body: { id, status } });
    toast('Updated');
    loadProvider();
  } catch (e) { toast(e.message); }
};

// ---------- Caregiver companion ----------
function renderCaregiver() {
  const v = $('#view-caregiver');
  v.innerHTML = `
    <h1>Caregiver Companion</h1>
    <p class="big">Monitor a patient's care.</p>
    <div class="card">
      <label>Patient User ID</label>
      <input id="cg-patient" placeholder="u...">
      <button class="btn" id="cg-load">Load Patient</button>
    </div>
    <div class="card" id="cg-overview"></div>
  `;
  $('#cg-load').addEventListener('click', loadCaregiver);
}
async function loadCaregiver() {
  const pid = $('#cg-patient').value.trim();
  if (!pid) { toast('Enter patient ID'); return; }
  try {
    const r = await api('/api/caregiver/overview/' + encodeURIComponent(pid));
    const el = $('#cg-overview');
    el.innerHTML = `
      <h2>${r.patient.name}</h2>
      <div class="stat-grid" style="margin:12px 0;">
        <div class="stat"><div class="num">${r.appointments.length}</div><div class="label">Appointments</div></div>
        <div class="stat"><div class="num">${r.medications.length}</div><div class="label">Medications</div></div>
        <div class="stat"><div class="num">${r.vitals.length}</div><div class="label">Vitals</div></div>
        <div class="stat"><div class="num">${r.orders.length}</div><div class="label">Orders</div></div>
      </div>
      <h3>Recent Vitals</h3>
      ${r.vitals.length ? r.vitals.map((v) => `<p>${v.type}: ${v.value} ${v.unit || ''}</p>`).join('') : '<div class="empty"><p>No vitals.</p></div>'}
      <h3>Medications</h3>
      ${r.medications.length ? r.medications.map((m) => `<p>${m.name} ${m.dosage || ''}</p>`).join('') : '<div class="empty"><p>No medications.</p></div>'}
      <h3>SOS Events</h3>
      ${r.sos.length ? r.sos.map((s) => `<p>${new Date(s.time).toLocaleString()}</p>`).join('') : '<div class="empty"><p>No SOS events.</p></div>'}
    `;
  } catch (e) { toast(e.message || 'Caregiver access required'); }
}

// ---------- Delivery companion ----------
function renderDelivery() {
  const v = $('#view-delivery');
  v.innerHTML = `
    <h1>Delivery Companion</h1>
    <p class="big">Pending deliveries.</p>
    <div class="card" id="del-list"></div>
  `;
  loadDelivery();
}
async function loadDelivery() {
  try {
    const r = await api('/api/delivery/pending');
    const el = $('#del-list');
    if (!r.deliveries.length) { el.innerHTML = '<div class="empty"><p>No pending deliveries.</p></div>'; return; }
    el.innerHTML = '<table><thead><tr><th>Order</th><th>User</th><th>Address</th><th>Preferred Date</th><th>Status</th><th>Action</th></tr></thead><tbody>' +
      r.deliveries.map((d) => `<tr>
        <td>${d.orderId}</td><td>${d.userId}</td><td>${d.address || '-'}</td><td>${d.preferredDate || '-'}</td><td>${d.status}</td>
        <td><button class="btn sm" onclick="delStatus('${d.id}','delivered')">Mark Delivered</button></td>
      </tr>`).join('') + '</tbody></table>';
  } catch (e) { toast(e.message || 'Delivery access required'); }
}
window.delStatus = async function (id, status) {
  try {
    await api('/api/delivery/status', { method: 'POST', body: { id, status } });
    toast('Updated');
    loadDelivery();
  } catch (e) { toast(e.message); }
};

// ---------- Init ----------
async function init() {
  // detect static-only hosting (e.g. GitHub Pages) where the API is unavailable
  let apiAvailable = true;
  try { const r = await fetch('/api/health'); if (!r.ok) apiAvailable = false; } catch (e) { apiAvailable = false; }
  window.DEMO_MODE = !apiAvailable;
  // Demo mode runs silently (no banner).
  // load products cache
  try {
    const r = await api('/api/products');
    state.products = r.products;
  } catch (e) {}
  // load profile if token
  if (!state.user) {
    try {
      const r = await api('/api/profile/' + encodeURIComponent(state.userId));
      state.user = r.user;
    } catch (e) { state.user = null; }
  }
  if (state.token) {
    try {
      const r = await api('/api/auth/me');
      state.user = r.user;
      state.userId = r.user.id;
      localStorage.setItem('cucu_user_id', r.user.id);
      try { const c = await api('/api/csrf'); state.csrf = c.csrf; } catch (e) {}
    } catch (e) {
      state.token = null;
      localStorage.removeItem('cucu_token');
    }
  }
  applyAccessibility();
  $$('.nav-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.route)));
  $$('.bn-btn').forEach((b) => b.addEventListener('click', () => go(b.dataset.route)));
  const menuBtn = $('#menu-btn'); const sidebar = $('#sidebar'); const overlay = $('#sidebar-overlay');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => {
      const open = sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    });
  }
  if (overlay) overlay.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); if (menuBtn) menuBtn.setAttribute('aria-expanded','false'); });
  // add nav buttons for new views? ensure
  go('home');
  updateNotifBadge();
}
init();