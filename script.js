import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, orderBy, query, where, runTransaction, limit } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { firebaseConfig, BKASH_NUMBER, COD_NUMBER, DELIVERY_FEE } from './config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const statusExplanations = {
  Pending: 'Order received, waiting for processing.',
  Processing: 'Your order is being prepared.',
  Dispatched: 'Your order has been shipped.',
  Delivered: 'Your order has been delivered.',
  Cancelled: 'Your order has been cancelled.'
};
const statusColors = {
  Pending: '#eab308',
  Processing: '#3b82f6',
  Dispatched: '#eab308',
  Delivered: '#22c55e',
  Cancelled: '#ef4444'
};

async function loadProducts(filterCategory = null) {
  try {
    let q = query(collection(db, 'products'));
    if (filterCategory) q = query(q, where('category', '==', filterCategory));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error loading products:', err);
    return [];
  }
}

async function loadProductBySlug(slug) {
  try {
    const q = query(collection(db, 'products'), where('slug', '==', slug), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (err) {
    console.error('Error loading product by slug:', err);
    return null;
  }
}

async function loadOrders() {
  try {
    const q = query(collection(db, 'orders'), orderBy('timeISO', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error loading orders:', err);
    return [];
  }
}

async function generateUniqueSlug(name, color, existingId = null) {
  let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (color) baseSlug += '-' + color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const q = query(collection(db, 'products'), where('slug', '==', slug));
    const snapshot = await getDocs(q);
    const exists = snapshot.docs.some(d => d.id !== existingId);
    if (!exists) return slug;
    slug = baseSlug + '-' + counter++;
  }
}

function createProductCard(p) {
  const images = p.images || [];
  const featuredImage = images[0] || '';
  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const isPreOrder = p.availability === 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(p.discount)) : price;

  const card = document.createElement('div');
  card.className = 'card product-card';
  card.style.cursor = 'pointer';
  card.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    window.location.href = `product.html?slug=${p.slug}`;
  });

  card.innerHTML = `
    <img src="${featuredImage}" alt="${p.name}" onerror="this.src=''; this.alt='Image not available';">
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
    <button ${isOOS || isUpcoming ? 'disabled' : ''} class="${isPreOrder ? 'preorder-btn' : 'order-btn'}">
      ${isPreOrder ? 'Pre Order' : 'Order'}
    </button>
  `;

  const button = card.querySelector('button');
  if (button && !isOOS && !isUpcoming) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      openCheckoutModal(p.id, isPreOrder);
    });
  }

  return card;
}

async function displayInterestProducts() {
  const section = document.getElementById('interest-products');
  if (!section) return;
  let products = await loadProducts();
  products = shuffle(products).slice(0, 4);
  products.forEach(p => section.appendChild(createProductCard(p)));
}

async function displayFilteredProducts() {
  const section = document.getElementById('product-list');
  if (!section) return;
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  const products = await loadProducts(category);
  if (category) {
    document.querySelector('h1').textContent = `Products - ${category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}`;
  }
  products.forEach(p => section.appendChild(createProductCard(p)));
}

async function displayProductDetail() {
  const detail = document.getElementById('product-detail');
  if (!detail) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) {
    detail.innerHTML = '<p>Product not found.</p>';
    return;
  }
  const p = await loadProductBySlug(slug);
  if (!p) {
    detail.innerHTML = '<p>Product not found.</p>';
    return;
  }
  document.title = `${p.name} - The Geek Shop`;
  const images = p.images || [];
  const featuredImage = images[0] || '';
  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const isPreOrder = p.availability === 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(p.discount)) : price;
  const html = `
    <div class="images">
      <img id="main-image" src="${featuredImage}" alt="${p.name}">
      <div class="thumbs">
        ${images.map(img => `<img src="${img}" alt="${p.name}" onclick="document.getElementById('main-image').src = this.src;">`).join('')}
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
        ${isUpcoming ? `TBA` : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ''}৳${finalPrice.toFixed(2)}`}
      </div>
      <div class="muted">Color: ${p.color || '-'}</div>
      <div>Availability: ${p.availability}</div>
      <div class="description">${p.description || ''}</div>
      <button ${isOOS || isUpcoming ? 'disabled' : ''} id="order-btn" class="${isPreOrder ? 'preorder-btn' : 'order-btn'}">${isPreOrder ? 'Pre Order' : 'Order'}</button>
    </div>
  `;
  detail.innerHTML = html;
  if (!isOOS && !isUpcoming) {
    document.getElementById('order-btn').addEventListener('click', () => openCheckoutModal(p.id, isPreOrder));
  }
  const viewer = document.getElementById('image-viewer');
  const viewerImg = document.getElementById('viewer-img');
  const closeViewer = document.getElementById('close-viewer');
  if (viewer && viewerImg && closeViewer) {
    document.querySelectorAll('.images img').forEach(img => {
      img.addEventListener('click', () => {
        viewerImg.src = img.src;
        viewerImg.alt = img.alt;
        viewer.classList.add('show');
      });
    });
    viewer.addEventListener('click', e => {
      if (e.target === viewer) viewer.classList.remove('show', 'zoomed');
    });
    closeViewer.addEventListener('click', () => viewer.classList.remove('show', 'zoomed'));
    viewerImg.addEventListener('dblclick', () => viewer.classList.toggle('zoomed'));
  }
  await displayOtherProducts(slug);
}

async function displayOtherProducts(currentSlug) {
  const container = document.getElementById('other-products');
  if (!container) return;
  let products = await loadProducts();
  products = products.filter(p => p.slug !== currentSlug);
  products = shuffle(products).slice(0, 4);
  container.innerHTML = '';
  products.forEach(p => container.appendChild(createProductCard(p)));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function calculateDeliveryFee(address) {
  const lowerAddr = address.toLowerCase();
  if (lowerAddr.includes("savar")) return 70;
  else if (lowerAddr.includes("dhaka")) return 110;
  return 150;
}

function updateDeliveryCharge() {
  const address = document.getElementById('co-address').value.trim();
  const deliveryFee = calculateDeliveryFee(address);
  document.getElementById('co-delivery').value = `Delivery Charge = ${deliveryFee}`;
  document.getElementById('co-delivery').dataset.fee = deliveryFee;
  updateTotalInModal();
}

async function openCheckoutModal(productId, isPreOrder = false) {
  const p = await getDoc(doc(db, 'products', productId));
  if (!p.exists()) return;
  const data = p.data();
  const price = data.price === 'TBA' ? 0 : Number(data.price) || 0;
  const discount = Number(data.discount) || 0;
  const unit = price - discount;
  document.getElementById('co-product-id').value = productId;
  document.getElementById('co-product-name').value = data.name;
  document.getElementById('co-color').value = data.color || '';
  document.getElementById('co-price').value = unit.toFixed(2);
  document.getElementById('co-unit-price-raw').value = unit.toString();
  document.getElementById('co-available-stock').value = String(data.stock);
  document.getElementById('co-qty').value = 1;
  document.getElementById('co-qty').max = data.stock;
  document.getElementById('co-payment').value = '';
  document.getElementById('co-payment-number').value = '';
  document.getElementById('co-pay-now').value = '';
  document.getElementById('co-due-amount').value = '';
  document.getElementById('co-txn').value = '';
  document.getElementById('co-note').textContent = '';
  document.getElementById('checkout-modal').classList.add('show');
  updateDeliveryCharge();
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('show');
}

function updateTotalInModal() {
  const qty = Number(document.getElementById('co-qty').value) || 1;
  const unit = Number(document.getElementById('co-unit-price-raw').value) || 0;
  const delivery = Number(document.getElementById('co-delivery').dataset.fee) || 0;
  const total = qty * unit + delivery;
  document.getElementById('co-total').value = total.toFixed(2);

  const payment = document.getElementById('co-payment').value;
  if (payment === 'Bkash') {
    document.getElementById('co-payment-number').value = BKASH_NUMBER;
    document.getElementById('co-pay-now').value = total.toFixed(2);
    document.getElementById('co-due-amount').value = '0.00';
    document.getElementById('co-note').textContent = 'Pay full amount via Bkash.';
  } else if (payment === 'Cash on Delivery') {
    document.getElementById('co-payment-number').value = COD_NUMBER;
    document.getElementById('co-pay-now').value = '0.00';
    document.getElementById('co-due-amount').value = total.toFixed(2);
    document.getElementById('co-note').textContent = 'Pay on delivery.';
  } else {
    document.getElementById('co-payment-number').value = '';
    document.getElementById('co-pay-now').value = '';
    document.getElementById('co-due-amount').value = '';
    document.getElementById('co-note').textContent = '';
  }
}

async function submitCheckoutOrder(e) {
  e.preventDefault();
  const productId = document.getElementById('co-product-id').value;
  const qty = Number(document.getElementById('co-qty').value);
  const stock = Number(document.getElementById('co-available-stock').value);
  if (qty > stock) {
    alert('Not enough stock!');
    return;
  }
  const order = {
    productId,
    productName: document.getElementById('co-product-name').value,
    color: document.getElementById('co-color').value,
    quantity: qty,
    unitPrice: Number(document.getElementById('co-unit-price-raw').value),
    paid: Number(document.getElementById('co-pay-now').value) || 0,
    due: Number(document.getElementById('co-due-amount').value) || 0,
    customerName: document.getElementById('co-name').value,
    phone: document.getElementById('co-phone').value,
    address: document.getElementById('co-address').value,
    paymentMethod: document.getElementById('co-payment').value,
    transactionId: document.getElementById('co-txn').value.trim(),
    status: 'Pending',
    timeISO: new Date().toISOString()
  };
  try {
    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'products', productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error('Product not found');
      const currentStock = Number(productSnap.data().stock);
      if (currentStock < qty) throw new Error('Out of stock');
      transaction.update(productRef, { stock: currentStock - qty });
      transaction.set(doc(collection(db, 'orders')), order);
    });
    alert('Order placed successfully!');
    closeCheckoutModal();
  } catch (err) {
    console.error(err);
    alert('Error: ' + err.message);
  }
}

function handlePaymentChange() {
  updateTotalInModal();
}

document.addEventListener('DOMContentLoaded', () => {
  displayInterestProducts();
  displayFilteredProducts();
  displayProductDetail();

  const modal = document.getElementById('checkout-modal');
  if (modal) {
    document.getElementById('close-modal-btn').onclick = closeCheckoutModal;
    const form = document.getElementById('checkout-form');
    form.addEventListener('submit', submitCheckoutOrder);
    document.getElementById('co-payment').addEventListener('change', handlePaymentChange);
    document.getElementById('co-qty').addEventListener('input', updateTotalInModal);
    document.getElementById('co-address').addEventListener('input', updateDeliveryCharge);
  }

  const loginPanel = document.getElementById('login-panel');
  const adminPanel = document.getElementById('admin-panel');
  const addForm = document.getElementById('add-product-form');
  if (addForm) addForm.addEventListener('submit', addProduct);
  if (loginPanel && adminPanel) {
    onAuthStateChanged(auth, async user => {
      if (user) {
        loginPanel.style.display = 'none';
        adminPanel.style.display = 'block';
        await renderDataTable();
        await renderOrdersTable();
      } else {
        loginPanel.style.display = 'block';
        adminPanel.style.display = 'none';
      }
    });
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-pass').value;
        try {
          await signInWithEmailAndPassword(auth, email, pass);
        } catch (err) {
          console.error('Login failed:', err);
          alert('Login failed: ' + err.message);
        }
      });
    }
  }

  setupStatusForm();
});