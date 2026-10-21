// ============================================================================
//  app.js  -  shared by index.html (customer cart) and kitchen.html (staff screen)
//
//  1. Paste YOUR Firebase settings into FIREBASE_CONFIG below (steps are in the setup guide).
//  2. Nothing else in this file needs editing.
//
//  Until FIREBASE_CONFIG is filled in, ordering stays switched OFF and the
//  customer pages behave exactly as before (WhatsApp button, no cart).
// ============================================================================

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCNn5DaO7y0nbv_-27_iBJmioUl3BAPddc',
  authDomain: 'restaurant-64f6a.firebaseapp.com',
  projectId: 'restaurant-64f6a',
  storageBucket: 'restaurant-64f6a.appspot.com',
  messagingSenderId: '386962130068',
  appId: '1:386962130068:web:0b2ff00852ebfd18cce081'
};
// These values are NOT secret: every website that uses Firebase shows them. Your data is protected by
// the security rules (firestore.rules), not by hiding this block.

const CURRENCY = 'Rs';                       // shown before prices
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';

export const isConfigured = () =>
  !!FIREBASE_CONFIG.apiKey && !/^PASTE/.test(FIREBASE_CONFIG.apiKey) &&
  !!FIREBASE_CONFIG.projectId && !/^PASTE/.test(FIREBASE_CONFIG.projectId);

// ----------------------------------------------------------------------------
//  Firebase (v10 modular SDK). It is downloaded only when it is really needed,
//  so the menu page stays fast.
// ----------------------------------------------------------------------------
let dbPromise = null, authPromise = null;

export function getDb() {                    // -> { app, db, F }   (F = the firestore functions)
  if (!isConfigured()) return Promise.reject(new Error('Firebase is not set up yet. Fill in FIREBASE_CONFIG in app.js.'));
  if (!dbPromise) dbPromise = (async () => {
    const [A, F] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js')]);
    const app = A.initializeApp(FIREBASE_CONFIG);
    return { app, db: F.getFirestore(app), F };
  })().catch(e => { dbPromise = null; throw e; });
  return dbPromise;
}

export function getAuthKit() {               // -> { auth, U }   (U = the auth functions)
  if (!authPromise) authPromise = (async () => {
    const { app } = await getDb();
    const U = await import(SDK + 'firebase-auth.js');
    return { auth: U.getAuth(app), U };
  })().catch(e => { authPromise = null; throw e; });
  return authPromise;
}

// ----------------------------------------------------------------------------
//  Table number:  https://yoursite/?table=4   (remembered while the customer moves between pages)
// ----------------------------------------------------------------------------
export function getTable() {
  const clean = v => String(v || '').replace(/[^\w\- ]/g, '').trim().slice(0, 20);
  const fromUrl = clean(new URLSearchParams(location.search).get('table'));
  if (fromUrl) { try { sessionStorage.setItem('arm_table', fromUrl); } catch (e) {} return fromUrl; }
  try { return clean(sessionStorage.getItem('arm_table')) || 'Takeaway'; } catch (e) { return 'Takeaway'; }
}

// ----------------------------------------------------------------------------
//  Shopping cart (kept in localStorage, so it survives moving between the menu and the dish pages)
// ----------------------------------------------------------------------------
const CART_KEY = 'arm_cart_v1';
const dishOf = id => (typeof DISHES !== 'undefined') ? DISHES[id] : undefined;
export function priceOf(d) {                 // 'Rs 1,450' or 1450 -> 1450 (0 = no price, cannot be ordered)
  if (!d) return 0;
  const n = typeof d.price === 'number' ? d.price : parseFloat(String(d.price || '').replace(/,/g, '').replace(/[^\d.]/g, ''));
  return isFinite(n) && n > 0 ? n : 0;
}
const money = n => CURRENCY + ' ' + Math.round(n).toLocaleString('en-US');

const changeListeners = new Set();
function loadCart() {
  try {
    const a = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(a)) return [];
    return a.filter(i => i && typeof i.id === 'string' && i.qty > 0 && i.price > 0)
            .map(i => ({ id: i.id, name: String(i.name).slice(0, 80), price: Number(i.price), qty: Math.min(99, Math.floor(i.qty)) }));
  } catch (e) { return []; }
}
let cart = loadCart();
function save() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} changeListeners.forEach(f => f()); }

export function addItem(id) {                // adds 1, or +1 if the dish is already in the cart
  const d = dishOf(id), p = priceOf(d);
  if (!d || !p) return false;
  const found = cart.find(i => i.id === id);
  if (found) found.qty = Math.min(99, found.qty + 1);
  else cart.push({ id, name: d.name, price: p, qty: 1 });
  save(); return true;
}
export function changeQty(id, delta) {       // the + and - buttons (qty 0 removes the line)
  cart = cart.map(i => i.id === id ? { ...i, qty: Math.min(99, i.qty + delta) } : i).filter(i => i.qty > 0);
  save();
}
export function removeItem(id) { cart = cart.filter(i => i.id !== id); save(); }      // delete one line
export function clearCart() { cart = []; save(); }                                       // "Delete all"
export const cartCount = () => cart.reduce((s, i) => s + i.qty, 0);
export const cartTotal = () => cart.reduce((s, i) => s + i.qty * i.price, 0);
export const getCart = () => cart.map(i => ({ ...i }));
window.addEventListener('storage', e => { if (e.key === CART_KEY) { cart = loadCart(); changeListeners.forEach(f => f()); } });

// ----------------------------------------------------------------------------
//  Sending the order to Firestore
// ----------------------------------------------------------------------------
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

// Paste this connection block straight into your app.js submitOrder function:
export async function submitOrder() {
  const items = cart.map(i => ({
    product_id: i.id,    // Matches the "Internal Reference" text string in Odoo
    qty: i.qty
  }));

  if (!items.length) throw new Error('Your cart is empty.');

  // JSON-RPC payload structured natively for local Odoo database controller routers
  const odooPayload = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      db: "melt9_pos",      // Check your local Odoo login screen for this exact name
      login: "landscapewebsitedesign@gmail.com", // Your Odoo Administrator username
      password: "Asdfvcxz_01",      // The password you use to log into localhost:8069
      table_number: getTable(),
      order_lines: items
    }
  };

  // Change it from localhost to your live ngrok tunnel:
const response = await fetch("https://YOUR_NGROK_URL_HERE.ngrok-free.app/jsonrpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(odooPayload)
  });

  if (!response.ok) {
    throw new Error("POS Gateway routing timed out. Please check if your local server is running.");
  }

  const data = await response.json();
  
  if (data.error) {
    console.error("Odoo error response payload details:", data.error);
    throw new Error("Odoo validation error: " + data.error.message);
  }

  // Clear tracking tokens gracefully
  try { localStorage.setItem('arm_order_id', 'local_test_' + Date.now()); } catch (e) {}
  clearCart();
  return true;
}


// Live status of one order (pending -> processing -> served -> completed)
let stopTracking = null;
export async function trackOrder(id, onStatus, onError) {
  const { db, F } = await getDb();
  if (stopTracking) stopTracking();
  stopTracking = F.onSnapshot(F.doc(db, 'orders', id),
    snap => onStatus(snap.exists() ? snap.data().status : null),
    err => onError && onError(err));
}

// ============================================================================
//  Customer screen (only runs on pages that contain <div id="cartui"> i.e. index.html)
// ============================================================================
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const STATUS = {
  pending:    { icon: '⏳',         title: 'Order sent',        pill: 'Order sent',  msg: 'The kitchen has your order and will start soon.' },
  processing: { icon: '👨‍🍳', title: 'Cooking now', pill: 'Preparing…', msg: 'Your food is being prepared in the kitchen!' },
  served:     { icon: '🍽️', title: 'On its way',   pill: 'On its way',  msg: 'Your food is on its way to your table!' },
  completed:  { icon: '✅',         title: 'Enjoy your meal!',  pill: 'Completed',   msg: 'Your order is complete. Thank you!' }
};

function initCustomerUI() {
  document.body.classList.add('ordering-on');
  if ($('wa')) $('wa').style.display = 'none';                       // the cart replaces the WhatsApp button

  // ---- Add buttons (menu cards and the dish page) ----
  const refreshAddButtons = () => document.querySelectorAll('[data-add]').forEach(b => { b.hidden = !priceOf(dishOf(b.dataset.add)); });
  refreshAddButtons();
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    e.preventDefault();
    if (addItem(b.dataset.add)) {
      const old = b.dataset.label || (b.dataset.label = b.textContent);
      b.textContent = 'Added ✓'; clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = old; }, 1100);
    }
  });

  // ---- Cart drawer ----
  const drawer = $('cartdrawer'), back = $('cartback');
  const openDrawer = () => { renderCart(); drawer.classList.add('open'); back.classList.add('open'); $('carterr').textContent = ''; };
  const closeDrawer = () => { drawer.classList.remove('open'); back.classList.remove('open'); };
  $('cartfab').onclick = openDrawer;
  $('cartclose').onclick = closeDrawer;
  back.onclick = closeDrawer;

  function renderCart() {
    const items = getCart(), list = $('cartlist');
    list.textContent = '';
    $('cartempty').style.display = items.length ? 'none' : 'block';
    items.forEach(i => {
      const row = el('div', 'crow');
      const info = el('div', 'cinfo');
      info.append(el('div', 'cname', i.name), el('div', 'cprice', money(i.price) + ' × ' + i.qty + ' = ' + money(i.price * i.qty)));
      const qty = el('div', 'cqty');
      const mk = (t, label, fn) => { const b = el('button', 'cbtn', t); b.type = 'button'; b.setAttribute('aria-label', label); b.onclick = fn; return b; };
      qty.append(mk('−', 'One less', () => changeQty(i.id, -1)), el('span', 'cn', String(i.qty)), mk('+', 'One more', () => changeQty(i.id, 1)));
      const del = mk('✕', 'Remove ' + i.name, () => removeItem(i.id)); del.classList.add('cdel');
      row.append(info, qty, del);
      list.appendChild(row);
    });
    $('carttotal').textContent = money(cartTotal());
    $('carttable').textContent = getTable() === 'Takeaway' ? 'Takeaway' : 'Table ' + getTable();
    $('cartconfirm').disabled = !items.length || sending;
    $('cartclear').disabled = !items.length;
  }
  function renderBadge() {
    const n = cartCount();
    $('cartbadge').textContent = n > 99 ? '99+' : String(n);
    $('cartbadge').style.display = n ? 'block' : 'none';
  }
  changeListeners.add(() => { renderBadge(); if (drawer.classList.contains('open')) renderCart(); });
  renderBadge();

  // "Delete all" needs two taps so it cannot happen by accident
  let clearArmed = false;
  $('cartclear').onclick = () => {
    if (!clearArmed) {
      clearArmed = true; $('cartclear').textContent = 'Tap again to delete all';
      setTimeout(() => { clearArmed = false; $('cartclear').textContent = 'Delete all'; }, 3000);
      return;
    }
    clearArmed = false; $('cartclear').textContent = 'Delete all'; clearCart();
  };

  // ---- Confirm order ----
  let sending = false;
  $('cartconfirm').onclick = async () => {
    if (sending || !cartCount()) return;
    if (navigator.onLine === false) { $('carterr').textContent = 'No internet connection. Please try again when you are online.'; return; }
    sending = true; $('cartconfirm').disabled = true; $('cartconfirm').textContent = 'Sending…'; $('carterr').textContent = '';
    try {
      const id = await submitOrder();
      closeDrawer();
      beginTracking(id);
    } catch (e) {
      console.error(e);
      $('carterr').textContent = /confirm your order|empty/.test(e.message) ? e.message : 'Sorry, the order could not be sent. Please try again or call the waiter.';
    } finally {
      sending = false; $('cartconfirm').textContent = 'Confirm Order'; $('cartconfirm').disabled = !cartCount();
    }
  };

  // ---- Live order status card ----
  let status = null, orderId = null;
  const card = $('orderstatus'), pill = $('orderpill');
  function renderStatus(mode) {
    const s = STATUS[status];
    if (mode === 'error') { $('osicon').textContent = '⚠️'; $('ostitle').textContent = 'We lost track of your order'; $('osmsg').textContent = 'Please ask your waiter about your order.'; }
    else if (!s) { $('osicon').textContent = '⏳'; $('ostitle').textContent = 'Connecting…'; $('osmsg').textContent = 'Checking your order with the kitchen.'; }
    else { $('osicon').textContent = s.icon; $('ostitle').textContent = s.title; $('osmsg').textContent = s.msg; }
    $('osmeta').textContent = (getTable() === 'Takeaway' ? 'Takeaway' : 'Table ' + getTable()) + (orderId ? ' · Order #' + orderId.slice(-5).toUpperCase() : '');
    $('osclose').textContent = status === 'completed' ? 'Done' : 'OK';
    pill.textContent = s ? s.pill : 'Order…';
    pill.style.display = orderId ? 'block' : 'none';
  }
  function forgetOrder() {
    orderId = null; status = null;
    try { sessionStorage.removeItem('arm_order_id'); } catch (e) {}
    if (stopTracking) { stopTracking(); stopTracking = null; }
    card.classList.remove('open'); pill.style.display = 'none';
  }
  let lastShown = null;
  function beginTracking(id, silent) {
    orderId = id; status = null; lastShown = null;
    renderStatus(); if (!silent) card.classList.add('open');
    trackOrder(id, st => {
      if (st === null) { forgetOrder(); return; }
      status = st; renderStatus();
      if (st !== lastShown) {                                                   // pop the card open on every change
        if (!(silent && lastShown === null)) card.classList.add('open');
        lastShown = st;
      }
    }, err => { console.warn(err); renderStatus('error'); }).catch(err => { console.warn(err); renderStatus('error'); });
  }
  $('osclose').onclick = () => { if (status === 'completed') forgetOrder(); else card.classList.remove('open'); };
  pill.onclick = () => card.classList.add('open');

  // Customer reloads the page or moves to another dish: keep following the same order
  let saved = null; try { saved = sessionStorage.getItem('arm_order_id'); } catch (e) {}
  if (saved) beginTracking(saved, true);
}

if (document.getElementById('cartui') && isConfigured()) initCustomerUI();
