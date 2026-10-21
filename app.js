// ============================================================================
//  app.js  -  shared by index.html (customer cart) and kitchen.html (staff screen)
// ============================================================================

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCNn5DaO7y0nbv_-27_iBJmioUl3BAPddc',
  authDomain: '://firebaseapp.com',
  projectId: 'restaurant-64f6a',
  storageBucket: '://appspot.com',
  messagingSenderId: '386962130068',
  appId: '1:386962130068:web:0b2ff00852ebfd18cce081'
};

const CURRENCY = 'Rs';
const SDK = 'https://gstatic.com';

export const isConfigured = () =>
  !!FIREBASE_CONFIG.apiKey && !/^PASTE/.test(FIREBASE_CONFIG.apiKey) &&
  !!FIREBASE_CONFIG.projectId && !/^PASTE/.test(FIREBASE_CONFIG.projectId);

// ----------------------------------------------------------------------------
//  Firebase (v10 modular SDK Setup)
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
//  Table Parameter Setup
// ----------------------------------------------------------------------------
export function getTable() {
  const clean = v => String(v || '').replace(/[^\w\- ]/g, '').trim().slice(0, 20);
  const fromUrl = clean(new URLSearchParams(location.search).get('table'));
  if (fromUrl) { try { localStorage.setItem('arm_table', fromUrl); } catch (e) {} return fromUrl; }
  try { return clean(localStorage.getItem('arm_table')) || 'Takeaway'; } catch (e) { return 'Takeaway'; }
}

// ----------------------------------------------------------------------------
//  Core Shopping Cart System Architecture
// ----------------------------------------------------------------------------
const CART_KEY = 'arm_cart_v1';
const dishOf = id => (typeof DISHES !== 'undefined') ? DISHES[id] : undefined;

export function priceOf(d) {
  if (!d) return 0;
  const n = typeof d.price === 'number' ? d.price : parseFloat(String(d.price || '').replace(/,/g, '').replace(/[^\d.]/g, ''));
  return isFinite(n) && n > 0 ? n : 0;
}

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

// EXPORTS FOR INDEX.HTML (Ensures buttons work and cards display data dynamically)
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

// Bind change listeners to trigger manual UI updates on index items card nodes
export const onCartChange = (callback) => { changeListeners.add(callback); };

window.addEventListener('storage', e => { if (e.key === CART_KEY) { cart = loadCart(); changeListeners.forEach(f => f()); } });

// ----------------------------------------------------------------------------
//  Sending order receipts to database
// ----------------------------------------------------------------------------
const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

export async function submitOrder() {
  const items = cart.map(i => {
    const live = priceOf(dishOf(i.id)) || i.price;
    return { dish_id: i.id, dish_name: i.name, qty: i.qty, price: live };
  });
  if (!items.length) throw new Error('Your cart is empty.');
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const { db, F } = await getDb();
  const ref = await withTimeout(F.addDoc(F.collection(db, 'orders'), {
    table_number: getTable(),
    items,
    total_bill: total,
    status: 'pending',
    assigned_employee: null,
    timestamp: F.serverTimestamp()
  }), 30000, 'We could not confirm your order. Please check your internet connection.');
  
  // Set localStorage tracking token parameter
  try { localStorage.setItem('arm_order_id', ref.id); } catch (e) {}
  clearCart();
  return ref.id;
}

export async function trackOrder(id, onStatus, onError) {
  const { db, F } = await getDb();
  if (stopTracking) stopTracking();
  let stopTracking = F.onSnapshot(F.doc(db, 'orders', id),
    snap => {
      if (snap.exists()) {
        const currentStatus = snap.data().status;
        if (currentStatus === 'completed') {
          try { localStorage.removeItem('arm_order_id'); } catch (e) {}
        }
        onStatus(currentStatus);
      } else {
        onStatus(null);
      }
    },
    err => onError && onError(err));
}

// ----------------------------------------------------------------------------
//  Realtime Persistence Live Overlay Visualizer Setup
// ----------------------------------------------------------------------------
const STATUS = {
  pending:    { icon: '⏳', title: 'Order sent',        msg: 'The kitchen has your order and will start soon.' },
  processing: { icon: '👨‍🍳', title: 'Cooking now', msg: 'Your food is being prepared in the kitchen!' },
  served:     { icon: '🍽️', title: 'On its way',   msg: 'Your food is on its way to your table!' },
  completed:  { icon: '✅', title: 'Enjoy your meal!',  msg: 'Thank you for dining at Melt 9!' }
};

document.addEventListener('DOMContentLoaded', async () => {
  const savedOrderId = localStorage.getItem('arm_order_id');
  const overlayNode = document.getElementById('status-tracking-overlay');
  const msgNode = document.getElementById('status-msg');

  if (savedOrderId && overlayNode && msgNode) {
    overlayNode.style.display = 'flex';
    // Dynamically request engine configurations
    const { db, F } = await getDb();
    F.onSnapshot(F.doc(db, 'orders', savedOrderId), (snap) => {
      if (snap.exists()) {
        const status = snap.data().status;
        if (STATUS[status]) {
          msgNode.innerHTML = `<h3>${STATUS[status].icon} ${STATUS[status].title}</h3><p>${STATUS[status].msg}</p>`;
          if (status === 'completed') {
            try { localStorage.removeItem('arm_order_id'); } catch (e) {}
            setTimeout(() => { overlayNode.style.display = 'none'; }, 4000);
          }
        }
      } else {
        overlayNode.style.display = 'none';
      }
    });
  }
});
