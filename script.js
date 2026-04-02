// ================================================


import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, orderBy, query, where, runTransaction } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

import { firebaseConfig, BKASH_NUMBER, COD_NUMBER, DELIVERY_FEE } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global products cache
const productsMap = new Map();

// ==================== CART ====================
function getCart() {
  return JSON.parse(localStorage.getItem('cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

function addToCart(productId, qty = 1) {
  const product = productsMap.get(productId);
  if (!product) return alert("Product not found");

  if (product.availability === 'Upcoming') return alert("Coming soon");

  const isOOS = Number(product.stock) <= 0 && product.availability !== 'Pre Order';
  if (isOOS) return alert("Out of stock");

  let cart = getCart();
  const existing = cart.find(i => i.id === productId);
  const price = Number(product.discount) > 0 ? Number(product.price) - Number(product.discount) : Number(product.price);

  if (existing) existing.qty += qty;
  else cart.push({ id: productId, name: product.name, color: product.color || '', price, image: product.images?.[0] || '', qty });

  saveCart(cart);
  alert(`${product.name} added to cart!`);
}

function removeFromCart(id) {
  saveCart(getCart().filter(i => i.id !== id));
}

function updateCartQuantity(id, newQty) {
  if (newQty < 1) return removeFromCart(id);
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (item) item.qty = newQty;
  saveCart(cart);
}

function updateCartUI() {
  const cart = getCart();
  const countEl = document.getElementById('cart-count');
  if (countEl) countEl.textContent = cart.reduce((sum, i) => sum + i.qty, 0);

  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if (!container) return;

  container.innerHTML = '';
  let total = 0;

  if (cart.length === 0) {
    container.innerHTML = `<p class="text-center py-10 text-on-surface-variant">Your cart is empty</p>`;
    totalEl && (totalEl.innerHTML = `<strong>Total: ৳0</strong>`);
    return;
  }

  cart.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;
    const div = document.createElement('div');
    div.className = "flex gap-4 bg-surface-container-low p-4 rounded-2xl";
    div.innerHTML = `
      <img src="${item.image}" class="w-20 h-20 object-cover rounded-xl" alt="">
      <div class="flex-1">
        <h4 class="font-medium">${item.name}</h4>
        ${item.color ? `<p class="text-xs text-on-surface-variant">${item.color}</p>` : ''}
        <p class="text-sm">৳${item.price} × ${item.qty}</p>
        <div class="flex items-center gap-3 mt-3">
          <button class="qty-minus px-3 py-1 bg-surface-container-highest rounded-xl">-</button>
          <span>${item.qty}</span>
          <button class="qty-plus px-3 py-1 bg-surface-container-highest rounded-xl">+</button>
          <button class="remove-btn ml-auto text-red-400">Remove</button>
        </div>
      </div>
    `;
    div.querySelector('.qty-minus').onclick = () => updateCartQuantity(item.id, item.qty - 1);
    div.querySelector('.qty-plus').onclick = () => updateCartQuantity(item.id, item.qty + 1);
    div.querySelector('.remove-btn').onclick = () => removeFromCart(item.id);
    container.appendChild(div);
  });

  if (totalEl) totalEl.innerHTML = `<strong>Total: ৳${total}</strong>`;
}

// ==================== LOAD PRODUCTS FROM FIREBASE ====================
async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    productsMap.clear();
    snapshot.docs.forEach(doc => {
      productsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    console.log(`✅ Loaded ${productsMap.size} products from Firebase`);
    return Array.from(productsMap.values());
  } catch (err) {
    console.error("❌ Firebase load error:", err);
    return [];
  }
}

// ==================== CREATE PRODUCT CARD ====================
function createProductCard(p) {
  const finalPrice = Number(p.discount) > 0 ? Number(p.price) - Number(p.discount) : Number(p.price);
  const card = document.createElement('div');
  card.className = "group bg-surface-container-low rounded-3xl overflow-hidden border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer";
  card.innerHTML = `
    <div class="aspect-square relative">
      <img src="${p.images?.[0] || ''}" class="w-full h-full object-cover group-hover:scale-105 transition-transform" alt="${p.name}">
      ${p.hotDeal ? `<div class="absolute top-3 left-3 bg-red-500 text-white text-xs px-3 py-1 rounded-full font-bold">HOT</div>` : ''}
    </div>
    <div class="p-5">
      <h3 class="font-headline font-semibold">${p.name}</h3>
      <p class="text-on-surface-variant text-sm">${p.color || ''}</p>
      <div class="mt-4 flex justify-between items-end">
        <span class="text-2xl font-bold text-secondary">৳${finalPrice}</span>
        <button class="add-to-cart px-6 py-2 bg-primary text-on-primary-container rounded-2xl text-sm font-bold">Add</button>
      </div>
    </div>
  `;
  card.onclick = (e) => {
    if (!e.target.closest('.add-to-cart')) window.location.href = `product.html?id=${p.id}`;
  };
  card.querySelector('.add-to-cart').onclick = (e) => {
    e.stopPropagation();
    addToCart(p.id);
  };
  return card;
}

// ==================== MAIN APP START ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🚀 Script initialized");

  const products = await loadProducts();

  // Populate Home Page
  const interestContainer = document.getElementById('interest-products');
  if (interestContainer) {
    const shuffled = [...products].sort(() => 0.5 - Math.random()).slice(0, 8);
    shuffled.forEach(p => interestContainer.appendChild(createProductCard(p)));
    console.log("✅ Populated interest products");
  }

  // Populate Products Page
  const productList = document.getElementById('product-list');
  if (productList) {
    products.forEach(p => productList.appendChild(createProductCard(p)));
    console.log("✅ Populated products page");
  }

  // Cart slider
  const cartSlider = document.getElementById('cart-slider');
  document.getElementById('cart-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (cartSlider) cartSlider.style.right = '0';
    updateCartUI();
  });

  document.getElementById('close-cart')?.addEventListener('click', () => {
    if (cartSlider) cartSlider.style.right = '-400px';
  });

  document.getElementById('checkout-cart')?.addEventListener('click', () => {
    window.location.href = 'checkout.html';
  });

  // Status form
  const statusForm = document.getElementById('status-form');
  if (statusForm) {
    statusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = document.getElementById('phone-input').value.trim();
      const resultDiv = document.getElementById('order-result');
      resultDiv.innerHTML = '<p class="text-center">Loading orders...</p>';

      try {
        const q = query(collection(db, 'orders'), where('phone', '==', phone), orderBy('timeISO', 'desc'));
        const snap = await getDocs(q);
        if (snap.empty) {
          resultDiv.innerHTML = `<p class="text-center">No orders found for ${phone}</p>`;
          return;
        }
        let html = '<div class="space-y-6">';
        snap.docs.forEach(doc => {
          const o = doc.data();
          html += `
            <div class="bg-surface-container-low p-6 rounded-3xl">
              <p class="font-medium">${o.productName || 'Multiple items'}</p>
              <p>Status: <span class="font-bold">${o.status}</span></p>
              <p class="text-sm">Paid: ৳${o.paid}</p>
            </div>`;
        });
        html += '</div>';
        resultDiv.innerHTML = html;
      } catch (err) {
        resultDiv.innerHTML = `<p class="text-red-400">Error: ${err.message}</p>`;
      }
    });
  }

  updateCartUI();
  console.log("✅ Script fully loaded and ready");
});

window.addToCart = addToCart;
