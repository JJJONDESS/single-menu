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
  authDomain: '://firebaseapp.com',
  projectId: 'restaurant-64f6a',
  storageBucket: '://appspot.com',
  messagingSenderId: '386962130068',
  appId: '1:386962130068:web:0b2ff00852ebfd18cce081'
};
// These values are NOT secret: every website that uses Firebase shows them. Your data is protected by
// the security rules (firestore.rules), not by hiding this block.

const CURRENCY = 'Rs';                       // shown before prices
const SDK = 'https://gstatic.com';

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
  if (fromUrl) { try { localStorage.setItem('arm_table', fromUrl); } catch (e) {} return fromUrl; }
  try { return clean(localStorage.getItem('arm_table')) || 'Takeaway'; } catch (e) { return 'Takeaway'; }
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

export async function submitOrder() {
  const items = cart.map(i => {
    const live = priceOf(dishOf(i.id)) || i.price;                 // use the current price from dishes.js
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
  }), 30000, 'We could not confirm your order. Please check your internet and ask your waiter before ordering again.');
  
  // FIXED HERE: Replaced sessionStorage with localStorage to handle persistent status states on reload
  try { localStorage.setItem('arm_order_id', ref.id); } catch (e) {}
  clearCart();
  return ref.id;
}

// Live status of one order (pending -> processing -> served -> completed)
let stopTracking = null;
export async function trackOrder(id, onStatus, onError) {
  const { db, F } = await getDb();
  if (stopTracking) stopTracking();
  stopTracking = F.onSnapshot(F.doc(db, 'orders', id),
    snap => {
      if (snap.exists()) {
        const currentStatus = snap.data().status;
        // FIXED HERE: Automatically flushes active tokens when order clears out
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

// ============================================================================
//  Customer screen UI Handler Engine (Runs natively on DOM container nodes)
// ============================================================================
const STATUS = {
  pending:    { icon: '⏳', title: 'Order sent',        pill: 'Order sent',  msg: 'The kitchen has your order and will start soon.' },
  processing: { icon: '👨‍🍳', title: 'Cooking now', pill: 'Preparing…', msg: 'Your food is being prepared in the kitchen!' },
  served:     { icon: '🍽️', title: 'On its way',   pill: 'On its way',  msg: 'Your food is on its way to your table!' },
  completed:  { icon: '✅', title: 'Enjoy your meal!',  pill: 'Completed',   msg: 'Thank you for dining at Melt 9!' }
};

// Auto-trigger persistence pipeline listener on viewport boot transitions
document.addEventListener('DOMContentLoaded', async () => {
  const savedOrderId = localStorage.getItem('arm_order_id');
  const overlayNode = document.getElementById('status-tracking-overlay');
  const msgNode = document.getElementById('status-msg');

  if (savedOrderId && overlayNode && msgNode) {
    overlayNode.style.display = 'flex';
    trackOrder(savedOrderId, (status) => {
      if (status && STATUS[status]) {
        msgNode.innerHTML = `<h3>${STATUS[status].icon} ${STATUS[status].title}</h3><p>${STATUS[status].msg}</p>`;
        if (status === 'completed') {
          setTimeout(() => { overlayNode.style.display = 'none'; }, 4000);
        }
      } else {
        overlayNode.style.display = 'none';
      }
    }, (err) => console.error("Tracking connection error:", err));
  }
});
