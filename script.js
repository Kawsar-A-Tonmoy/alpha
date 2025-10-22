import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, orderBy, query, where, limit, runTransaction } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { firebaseConfig, BKASH_NUMBER, COD_NUMBER, DELIVERY_FEE } from './config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const CATEGORIES = [
  { name: 'Keycaps', img: 'keycaps.jpg', cat: 'keycaps' },
  { name: 'Switches', img: 'switches.jpg', cat: 'switches' },
  { name: 'Keyboard & Barebones', img: 'keyboards.jpg', cat: 'keyboard-barebones' },
  { name: 'Collectables', img: 'collectables.jpg', cat: 'collectables' }
];

function createProductCard(p, showOrderBtn = true) {
  const images = p.images || [];
  const featured = images[0] || '';
  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const isPreOrder = p.availability === 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(p.discount)) : price;

  const card = document.createElement('div');
  card.className = 'card product-card';
  card.style.cursor = 'pointer';
  card.onclick = () => location.href = `product.html?slug=${p.slug}`;

  let btnHtml = '';
  if (showOrderBtn && !isUpcoming && !isOOS) {
    const btnText = isPreOrder ? 'Pre Order' : 'Order';
    const btnClass = isPreOrder ? 'preorder-btn' : 'order-btn';
    btnHtml = `<button class="${btnClass}" onclick="event.stopPropagation(); openCheckoutModal('${p.id}', ${isPreOrder})">${btnText}</button>`;
  }

  card.innerHTML = `
    <img src="${featured}" alt="${p.name}" onerror="this.src='';this.alt='Image not available';">
    <div class="badges">
      ${isOOS ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
      ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
      ${isPreOrder ? `<span class="badge preorder">PRE ORDER</span>` : ''}
    </div>
    <h3>${p.name}</h3>
    <div class="muted">Color: ${p.color || '-'}</div>
    <div class="price">
      ${isUpcoming ? `TBA` : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ''}৳${finalPrice.toFixed(2)}`}
    </div>
    ${btnHtml}
  `;
  return card;
}

function createCategoryCard(cat) {
  const div = document.createElement('div');
  div.className = 'card category-card';
  div.style.backgroundImage = `url('${cat.img}')`;
  div.onclick = () => location.href = `products.html?category=${cat.cat}`;
  div.innerHTML = `<div class="category-overlay"><h3>${cat.name}</h3></div>`;
  return div;
}

async function loadProducts(filterCategory = null) {
  let q = query(collection(db, 'products'));
  if (filterCategory) q = query(q, where('category', '==', filterCategory));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadProductBySlug(slug) {
  const q = query(collection(db, 'products'), where('slug', '==', slug), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function displayInterestProducts() {
  const container = document.getElementById('interest-products');
  if (!container) return;
  let prods = await loadProducts();
  prods = shuffle(prods).slice(0, 4);
  prods.forEach(p => container.appendChild(createProductCard(p)));
}

function displayCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;
  CATEGORIES.forEach(c => grid.appendChild(createCategoryCard(c)));
}

async function displayFilteredProducts() {
  const container = document.getElementById('product-list');
  if (!container) return;
  const params = new URLSearchParams(location.search);
  const cat = params.get('category');
  const prods = await loadProducts(cat);
  if (cat) document.querySelector('h1').textContent = `Products - ${cat.replace('-',' ')}`;
  prods.forEach(p => container.appendChild(createProductCard(p)));
}

let CURRENT_PRODUCT_ID = null;

async function displayProductDetail() {
  const detail = document.getElementById('product-detail');
  if (!detail) return;
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  if (!slug) { detail.innerHTML = '<p>Product not found.</p>'; return; }

  const p = await loadProductBySlug(slug);
  if (!p) { detail.innerHTML = '<p>Product not found.</p>'; return; }
  CURRENT_PRODUCT_ID = p.id;
  document.title = `${p.name} - The Geek Shop`;

  const images = p.images || [];
  const main = images[0] || '';
  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const isPreOrder = p.availability === 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const final = hasDiscount ? price - Number(p.discount) : price;

  detail.innerHTML = `
    <div class="images">
      <img id="main-image" src="${main}" alt="${p.name}" class="big-img">
      <div class="thumbs">
        ${images.map(img => `<img src="${img}" alt="${p.name}">`).join('')}
      </div>
    </div>
    <div class="info">
      <h1>${p.name}</h1>
      <div class="badges">
        ${isOOS ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
        ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
        ${isPreOrder ? `<span class="badge preorder">PRE ORDER</span>` : ''}
      </div>
      <div class="price">
        ${isUpcoming ? `TBA` : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ''}৳${final.toFixed(2)}`}
      </div>
      <div class="muted">Color: ${p.color || '-'}</div>
      <div>Availability: ${p.availability}</div>
      <div class="description">${p.description || ''}</div>
      <button ${isOOS || isUpcoming ? 'disabled' : ''} id="order-btn" class="${isPreOrder ? 'preorder-btn' : 'order-btn'}">
        ${isPreOrder ? 'Pre Order' : 'Order'}
      </button>
    </div>
  `;

  if (!isOOS && !isUpcoming) {
    document.getElementById('order-btn').addEventListener('click', () => openCheckoutModal(p.id, isPreOrder));
  }

  const viewer = document.getElementById('image-viewer');
  const viewerImg = document.getElementById('viewer-img');
  const closeViewer = document.getElementById('close-viewer');

  document.getElementById('main-image').addEventListener('click', () => {
    viewerImg.src = document.getElementById('main-image').src;
    viewer.classList.add('show');
  });
  viewer.addEventListener('click', e => { if (e.target === viewer) viewer.classList.remove('show'); });
  closeViewer.addEventListener('click', () => viewer.classList.remove('show'));
}

async function displayOtherProducts() {
  const container = document.getElementById('other-products');
  if (!container) return;
  const all = await loadProducts();
  const related = all.filter(p => p.id !== CURRENT_PRODUCT_ID);
  shuffle(related).slice(0, 4).forEach(p => container.appendChild(createProductCard(p)));
}

function calculateDeliveryFee(address) {
  const low = address.toLowerCase();
  if (low.includes('savar')) return 70;
  if (low.includes('dhaka')) return 110;
  return 150;
}

function updateDeliveryCharge() {
  const addr = document.getElementById('co-address').value.trim();
  const fee = calculateDeliveryFee(addr);
  document.getElementById('co-delivery').value = `Delivery Charge = ${fee}`;
  document.getElementById('co-delivery').dataset.fee = fee;
  updateTotalInModal();
}

function updateTotalInModal() {
  const qty = Number(document.getElementById('co-qty').value) || 1;
  const unit = Number(document.getElementById('co-unit-price-raw').value) || 0;
  const delivery = Number(document.getElementById('co-delivery').dataset.fee) || DELIVERY_FEE;
  const total = qty * unit + delivery;
  document.getElementById('co-total').value = total.toFixed(2);

  const method = document.getElementById('co-payment').value;
  const isPre = document.getElementById('co-payment').disabled;
  const payNow = document.getElementById('co-pay-now');
  const due = document.getElementById('co-due-amount');

  if (isPre) {
    const pre = Math.round((unit * 0.25) / 5) * 5;
    payNow.value = (qty * pre).toFixed(2);
    due.value = (total - qty * pre).toFixed(2);
  } else if (method === 'Bkash') {
    payNow.value = total.toFixed(2);
    due.value = '0.00';
  } else if (method === 'Cash on Delivery') {
    payNow.value = '0.00';
    due.value = total.toFixed(2);
  }
}

function handlePaymentChange(e) {
  const method = e.target.value;
  const num = document.getElementById('co-payment-number');
  const note = document.getElementById('co-note');
  const txn = document.getElementById('co-txn');
  const pay = document.getElementById('co-pay-now');
  const due = document.getElementById('co-due-amount');

  if (method === 'Bkash') {
    num.value = BKASH_NUMBER;
    note.textContent = `Send money to ${BKASH_NUMBER} and provide transaction ID.`;
    txn.required = true;
    pay.style.display = 'block';
    due.style.display = 'block';
    updateTotalInModal();
  } else if (method === 'Cash on Delivery') {
    num.value = COD_NUMBER;
    note.textContent = '';
    txn.required = false;
    pay.style.display = 'block';
    due.style.display = 'block';
    updateTotalInModal();
  } else {
    num.value = ''; note.textContent = ''; txn.required = false;
    pay.style.display = 'none'; due.style.display = 'none';
  }
}

async function openCheckoutModal(productId, isPreOrder = false) {
  const snap = await getDoc(doc(db, 'products', productId));
  if (!snap.exists()) return;
  const d = snap.data();
  const unit = Number(d.price) - Number(d.discount);
  document.getElementById('co-product-id').value = productId;
  document.getElementById('co-product-name').value = d.name;
  document.getElementById('co-color').value = d.color || '';
  document.getElementById('co-price').value = unit.toFixed(2);
  document.getElementById('co-unit-price-raw').value = unit;
  document.getElementById('co-available-stock').value = d.stock;
  document.getElementById('co-qty').value = 1;
  document.getElementById('co-qty').max = d.stock;
  document.getElementById('co-payment').value = isPreOrder ? 'Bkash' : '';
  document.getElementById('co-payment').disabled = isPreOrder;
  document.getElementById('co-payment-number').value = '';
  document.getElementById('co-txn').value = '';
  document.getElementById('co-name').value = '';
  document.getElementById('co-phone').value = '';
  document.getElementById('co-address').value = '';
  document.getElementById('co-note').textContent = '';
  document.getElementById('co-policy').checked = false;
  document.getElementById('co-pay-now').style.display = 'none';
  document.getElementById('co-due-amount').style.display = 'none';
  document.getElementById('co-delivery').value = `Delivery Charge = ${DELIVERY_FEE}`;
  document.getElementById('co-delivery').dataset.fee = DELIVERY_FEE;

  if (isPreOrder) {
    const pre = Math.round((unit * 0.25) / 5) * 5;
    const del = Number(document.getElementById('co-delivery').dataset.fee);
    document.getElementById('co-pay-now').value = pre.toFixed(2);
    document.getElementById('co-due-amount').value = (unit - pre + del).toFixed(2);
    document.getElementById('co-payment-number').value = BKASH_NUMBER;
    document.getElementById('co-note').textContent = `Send money to ${BKASH_NUMBER} and provide transaction ID.`;
    document.getElementById('co-pay-now').style.display = 'block';
    document.getElementById('co-due-amount').style.display = 'block';
  }
  updateTotalInModal();
  document.getElementById('checkout-modal').classList.add('show');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('show');
}

async function submitCheckoutOrder(e) {
  e.preventDefault();
  const id = document.getElementById('co-product-id').value;
  const qty = Number(document.getElementById('co-qty').value);
  const stock = Number(document.getElementById('co-available-stock').value);
  if (qty > stock) return alert('Quantity exceeds stock.');
  if (!document.getElementById('co-policy').checked) return alert('Agree to policy.');
  const method = document.getElementById('co-payment').value;
  const txn = method === 'Cash on Delivery' ? Math.random().toString(36).substring(2,10).toUpperCase()
                                          : document.getElementById('co-txn').value.trim();
  if (method === 'Bkash' && !txn) return alert('Transaction ID required.');

  const snap = await getDoc(doc(db, 'products', id));
  const d = snap.data();
  const unit = Number(document.getElementById('co-unit-price-raw').value);
  const del = Number(document.getElementById('co-delivery').dataset.fee);
  const total = qty * unit + del;
  let paid = 0, due = total;
  const isPre = d.availability === 'Pre Order';
  if (isPre) { paid = qty * Math.round((unit * 0.25) / 5) * 5; due = total - paid; }
  else if (method === 'Bkash') { paid = total; due = 0; }

  const order = {
    productId: id, productName: d.name, color: d.color||'', unitPrice: unit,
    quantity: qty, deliveryFee: del, paid, due,
    customerName: document.getElementById('co-name').value.trim(),
    phone: document.getElementById('co-phone').value.trim(),
    address: document.getElementById('co-address').value.trim(),
    paymentMethod: method, transactionId: txn,
    status: 'Pending', timeISO: new Date().toISOString()
  };

  try {
    await runTransaction(db, async tx => {
      const fresh = await tx.get(doc(db, 'products', id));
      if (fresh.data().stock < qty) throw 'Stock low';
      tx.update(doc(db, 'products', id), { stock: fresh.data().stock - qty });
      tx.set(doc(collection(db, 'orders')), order);
    });
    alert(`Order placed! TXN: ${txn}`);
    closeCheckoutModal();
  } catch (err) { alert('Error: '+err); }
}

document.addEventListener('DOMContentLoaded', () => {
  displayInterestProducts();
  displayCategories();
  displayFilteredProducts();
  displayProductDetail();
  displayOtherProducts();

  const modal = document.getElementById('checkout-modal');
  if (modal) {
    document.getElementById('close-modal-btn').onclick = closeCheckoutModal;
    document.getElementById('checkout-form').onsubmit = submitCheckoutOrder;
    document.getElementById('co-payment').onchange = handlePaymentChange;
    document.getElementById('co-qty').oninput = updateTotalInModal;
    document.getElementById('co-address').oninput = updateDeliveryCharge;
  }
});