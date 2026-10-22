// ============================================================================
//  app.js  -  shared by index.html (customer cart) and kitchen.html (staff screen)
// ============================================================================

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCNn5DaO7y0nbv_-27_iBJmioUl3BAPddc',
  authDomain: 'restaurant-64f6a.firebaseapp.com',
  projectId: 'restaurant-64f6a',
  storageBucket: 'restaurant-64f6a.appspot.com',
  messagingSenderId: '386962130068',
  appId: '1:386962130068:web:0b2ff00852ebfd18cce081'
};

const CURRENCY = 'Rs';
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';

export const isConfigured = () =>
  !!FIREBASE_CONFIG.apiKey && !/^PASTE/.test(FIREBASE_CONFIG.apiKey) &&
  !!FIREBASE_CONFIG.projectId && !/^PASTE/.test(FIREBASE_CONFIG.projectId);

let dbPromise = null, authPromise = null;

export function getDb() {
  if (!isConfigured()) return Promise.reject(new Error('Firebase is not set up yet.'));
  if (!dbPromise) dbPromise = (async () => {
    const [A, F] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-firestore.js')]);
    const app = A.initializeApp(FIREBASE_CONFIG);
    return { app, db: F.getFirestore(app), F };
  })().catch(e => { dbPromise = null; throw e; });
  return dbPromise;
}

export function getAuthKit() {
  if (!authPromise) authPromise = (async () => {
    const { app } = await getDb();
    const U = await import(SDK + 'firebase-auth.js');
    return { auth: U.getAuth(app), U };
  })().catch(e => { authPromise = null; throw e; });
  return authPromise;
}

export function getTable() {
  const clean = v => String(v || '').replace(/[^\w\- ]/g, '').trim().slice(0, 20);
  const fromUrl = clean(new URLSearchParams(location.search).get('table'));
  if (fromUrl) { try { localStorage.setItem('arm_table', fromUrl); } catch (e) {} return fromUrl; }
  try { return clean(localStorage.getItem('arm_table')) || 'Takeaway'; } catch (e) { return 'Takeaway'; }
}

const CART_KEY = 'arm_cart_v1';
const dishOf = id => (typeof DISHES !== 'undefined') ? DISHES[id] : undefined;
export function priceOf(d) {
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

export function addItem(id) {
  const d = dishOf(id), p = priceOf(d);
  if (!d || !p) return false;
  const found = cart.find(i => i.id === id);
  if (found) found.qty = Math.min(99, found.qty + 1);
  else cart.push({ id, name: d.name, price: p, qty: 1 });
  save(); return true;
}
export function changeQty(id, delta) {
  cart = cart.map(i => i.id === id ? { ...i, qty: Math.min(99, i.qty + delta) } : i).filter(i => i.qty > 0);
  save();
}
export function removeItem(id) { cart = cart.filter(i => i.id !== id); save(); }
export function clearCart() { cart = []; save(); }
export const cartCount = () => cart.reduce((s, i) => s + i.qty, 0);
export const cartTotal = () => cart.reduce((s, i) => s + i.qty * i.price, 0);
export const getCart = () => cart.map(i => ({ ...i }));
window.addEventListener('storage', e => { if (e.key === CART_KEY) { cart = loadCart(); changeListeners.forEach(f => f()); } });

const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

export async function submitOrder() {
  const items = cart.map(i => {
    const live = priceOf(dishOf(i.id)) || i.price;
    return { dish_id: i.id, dish_name: i.name, qty: i.qty, price: live };
  });
  if (!items.length) throw new Error('Your cart is empty.');
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  
  const custNameEl = document.getElementById('custname');
  const customer_name = custNameEl && custNameEl.value.trim() ? custNameEl.value.trim() : 'Guest';
  
  const token_number = Math.floor(1000 + Math.random() * 9000);

  const { db, F } = await getDb();
  const ref = await withTimeout(F.addDoc(F.collection(db, 'orders'), {
    table_number: getTable(),
    customer_name: customer_name,
    token_number: token_number,
    items,
    total_bill: total,
    status: 'pending',
    assigned_employee: null,
    timestamp: F.serverTimestamp()
  }), 30000, 'We could not confirm your order. Please check your internet and ask your waiter before ordering again.');
  
  try { 
    let active = JSON.parse(localStorage.getItem('arm_active_orders') || '[]');
    if (!active.includes(ref.id)) active.push(ref.id);
    localStorage.setItem('arm_active_orders', JSON.stringify(active));
  } catch (e) {}
  
  clearCart();
  return ref.id;
}

export async function trackOrder(id, onStatus, onError) {
  const { db, F } = await getDb();
  return F.onSnapshot(F.doc(db, 'orders', id),
    snap => onStatus(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    err => onError && onError(err));
}

// ============================================================================
//  Customer screen
// ============================================================================
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const STATUS = {
  pending:    { icon: '⏳', title: 'Order sent', pill: 'Order sent', msg: 'The kitchen has your order and will start soon.' },
  processing: { icon: '👨‍🍳', title: 'Cooking now', pill: 'Preparing…', msg: 'Your food is being prepared in the kitchen!' },
  served:     { icon: '🍽️', title: 'On its way', pill: 'On its way', msg: 'Your food is on its way to your table!' },
  completed:  { icon: '✅', title: 'Enjoy your meal!', pill: 'Completed', msg: 'Your order is complete. Thank you!' }
};

function initCustomerUI() {
  document.body.classList.add('ordering-on');
  if ($('wa')) $('wa').style.display = 'none';

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

  let clearArmed = false;
  $('cartclear').onclick = () => {
    if (!clearArmed) {
      clearArmed = true; $('cartclear').textContent = 'Tap again to delete all';
      setTimeout(() => { clearArmed = false; $('cartclear').textContent = 'Delete all'; }, 3000);
      return;
    }
    clearArmed = false; $('cartclear').textContent = 'Delete all'; clearCart();
  };

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
  let currentOrderData = null, currentModalOrderId = null;
  let activeOrders = [];
  let trackers = {}; 

  try { activeOrders = JSON.parse(localStorage.getItem('arm_active_orders') || '[]'); } catch (e) {}
  
  const card = $('orderstatus'), pill = $('orderpill');

  function renderStatus(mode) {
    const s = currentOrderData ? STATUS[currentOrderData.status] : null;
    
    if (mode === 'error') { 
      $('osicon').textContent = '⚠️'; $('ostitle').textContent = 'We lost track of your order'; $('osmsg').textContent = 'Please ask your waiter about your order.'; 
    } else if (!s) { 
      $('osicon').textContent = '⏳'; $('ostitle').textContent = 'Connecting…'; $('osmsg').textContent = 'Checking your order with the kitchen.'; 
    } else { 
      $('osicon').textContent = s.icon; $('ostitle').textContent = s.title; $('osmsg').textContent = s.msg; 
    }
    
    let itemsHtml = '';
    if (currentOrderData && currentOrderData.items) {
      currentOrderData.items.forEach(i => {
        itemsHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.9rem; color:#444;">
          <span>${i.qty}x ${i.dish_name}</span>
          <span>Rs ${Math.round(i.price)}</span>
        </div>`;
      });
    }
    
    $('osmsg').innerHTML = `<div style="margin-bottom:12px;">${s ? s.msg : 'Checking...'}</div>` + 
                           (itemsHtml ? `<div style="border-top:1px solid #eee; padding-top:8px;">${itemsHtml}</div>` : '');
    
    const token = currentOrderData && currentOrderData.token_number ? `Token #${currentOrderData.token_number}` : (currentModalOrderId ? 'Order #' + currentModalOrderId.slice(-5).toUpperCase() : '');
    $('osmeta').textContent = (getTable() === 'Takeaway' ? 'Takeaway' : 'Table ' + getTable()) + (token ? ' · ' + token : '');
    
    $('osclose').textContent = (currentOrderData && currentOrderData.status === 'completed') ? 'Done' : 'OK';
    
    const pillText = s ? s.pill : 'Order…';
    pill.textContent = activeOrders.length > 1 ? `Orders (${activeOrders.length})` : pillText;
    pill.style.display = activeOrders.length > 0 ? 'block' : 'none';
  }

  function forgetOrder(idToRemove) {
    if (idToRemove) {
      activeOrders = activeOrders.filter(id => id !== idToRemove);
      try { localStorage.setItem('arm_active_orders', JSON.stringify(activeOrders)); } catch (e) {}
      
      if (trackers[idToRemove]) { 
        try { trackers[idToRemove](); } catch (e) { console.warn(e); }
        delete trackers[idToRemove]; 
      }
    }
    
    if (activeOrders.length === 0) {
      currentModalOrderId = null; 
      currentOrderData = null;
      card.classList.remove('open'); 
      pill.style.display = 'none';
    } else {
      if (currentModalOrderId === idToRemove) {
        currentModalOrderId = activeOrders[activeOrders.length - 1];
        currentOrderData = null; 
        renderStatus();
      }
    }
  }

  let lastShown = null;
  function beginTracking(id, silent) {
    if (!activeOrders.includes(id)) activeOrders.push(id);
    try { localStorage.setItem('arm_active_orders', JSON.stringify(activeOrders)); } catch (e) {}
    
    currentModalOrderId = id; 
    currentOrderData = null; lastShown = null;
    renderStatus(); 
    if (!silent) card.classList.add('open');
    
    if (trackers[id]) {
      try { trackers[id](); } catch (e) {}
    }
    
    trackers[id] = trackOrder(id, orderData => {
      if (orderData === null) { forgetOrder(id); return; }
      
      if (currentModalOrderId === id) {
        currentOrderData = orderData; 
        renderStatus();
        if (orderData.status !== lastShown) {
          if (!(silent && lastShown === null)) card.classList.add('open');
          lastShown = orderData.status;
        }
      }
      
      if (orderData.status === 'completed') {
        setTimeout(() => {
          if (currentModalOrderId === id) card.classList.remove('open');
          forgetOrder(id);
        }, 5000);
      }
    }, err => { 
      console.warn(err); 
      if (currentModalOrderId === id) renderStatus('error'); 
    });
  }

  // Fixed the button so it visually closes the modal FIRST, then cleans up.
  $('osclose').onclick = () => { 
    card.classList.remove('open'); 
    if (currentOrderData && currentOrderData.status === 'completed') {
      forgetOrder(currentModalOrderId); 
    }
  };
  
  pill.onclick = () => {
    if (activeOrders.length > 0 && !currentModalOrderId) {
      currentModalOrderId = activeOrders[activeOrders.length - 1];
    }
    card.classList.add('open');
  };

  if (activeOrders.length > 0) {
    activeOrders.forEach((id, index) => {
      beginTracking(id, index !== activeOrders.length - 1);
    });
  }

}

if (document.getElementById('cartui') && isConfigured()) initCustomerUI();
