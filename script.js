import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, orderBy, query, where, runTransaction } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { firebaseConfig, BKASH_NUMBER, COD_NUMBER, DELIVERY_FEE } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Status explanations
const statusExplanations = {
  Pending: 'Order received, waiting for processing.',
  Processing: 'Your order is being prepared.',
  Dispatched: 'Your order has been shipped.',
  Delivered: 'Your order has been delivered.',
  Cancelled: 'Your order has been cancelled.'
};

// Status colors
const statusColors = {
  Pending: '#eab308',
  Processing: '#3b82f6',
  Dispatched: '#eab308',
  Delivered: '#22c55e',
  Cancelled: '#ef4444'
};

// Categories for home
const categories = [
  { name: 'Keycaps', bg: 'k.png' },
  { name: 'Switches', bg: 's.png' },
  { name: 'Keyboards and Barebones', bg: 'k&b.png' },
  { name: 'Accessories and Collectables', bg: 'c&a.png' }
];

// ====== UTIL ======
async function loadProducts() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Error loading products:', err);
    return [];
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

function shuffle(array) {
  return array.slice().sort(() => Math.random() - 0.5);
}

// ====== SHIMMER PLACEHOLDERS ======
function createShimmerCard() {
  const card = document.createElement('div');
  card.className = 'card product-card shimmer-placeholder';
  card.innerHTML = `
    <div class="shimmer-image"></div>
    <div class="shimmer-badges">
      <div class="shimmer-badge"></div>
      <div class="shimmer-badge"></div>
    </div>
    <div class="shimmer-title"></div>
    <div class="shimmer-muted"></div>
    <div class="shimmer-price"></div>
    <div class="shimmer-button"></div>
  `;
  return card;
}

// Shimmer for main product image
function createMainImageShimmer() {
  const img = document.createElement('div');
  img.className = 'shimmer-image-placeholder';
  return img;
}

// Shimmer for thumbnail gallery
function createThumbnailShimmer() {
  const thumb = document.createElement('div');
  thumb.className = 'thumbnail shimmer-thumbnail';
  return thumb;
}

// Shimmer for product info lines
function createInfoLineShimmer() {
  const line = document.createElement('div');
  line.className = 'shimmer-line';
  return line;
}

// ====== PRODUCT CARD ======
function createProductCard(p) {
  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const isPreOrder = p.availability === 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(p.discount)) : price;
  const images = p.images || [];
  const card = document.createElement('div');
  card.className = 'card product-card';
  card.innerHTML = `
    <img src="${images[0] || ''}" alt="${p.name}" onerror="this.src=''; this.alt='Image not available';">
    <div class="badges">
      ${p.category === 'new' ? `<span class="badge new">NEW</span>` : ``}
      ${p.category === 'hot' ? `<span class="badge hot">HOT Deal</span>` : ``}
      ${isOOS ? `<span class="badge oos">OUT OF STOCK</span>` : ``}
      ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ``}
      ${isPreOrder ? `<span class="badge preorder">PRE ORDER</span>` : ``}
    </div>
    <h3>${p.name}</h3>
    <div class="muted">Color: ${p.color || '-'}</div>
    <div class="price">
      ${isUpcoming ? `TBA` : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ``}৳${finalPrice.toFixed(2)}`}
    </div>
    <button class="view-details-btn">View Details</button>
  `;
  card.querySelector('.view-details-btn').addEventListener('click', () => {
    window.location.href = `product.html?id=${p.id}`;
  });
  return card;
}

function createCategoryCard(c) {
  const card = document.createElement('div');
  card.className = 'card category-card';
  card.style.backgroundImage = `url(${c.bg})`;
  card.innerHTML = `<h3>${c.name}</h3>`;
  card.addEventListener('click', () => {
    window.location.href = `products.html?category=${encodeURIComponent(c.name)}`;
  });
  return card;
}

// ====== PAGE INIT ======
async function initHomePage() {
  const interestSection = document.getElementById('interest-products');
  const categoriesSection = document.getElementById('categories');
  if (!interestSection || !categoriesSection) return;

  // Render categories
  categories.forEach(c => categoriesSection.appendChild(createCategoryCard(c)));

  // Show shimmer placeholders
  for (let i = 0; i < 4; i++) {
    interestSection.appendChild(createShimmerCard());
  }

  // Render interest products
  const products = await loadProducts();
  interestSection.innerHTML = ''; // Clear placeholders
  const eligible = products.filter(p => p.availability !== 'Upcoming');
  const random4 = shuffle(eligible).slice(0, 4);
  random4.forEach(p => interestSection.appendChild(createProductCard(p)));
  setupImageViewer();
}

async function initProductsPage() {
  const title = document.getElementById('products-title');
  const list = document.getElementById('product-list');
  if (!list) return;

  const urlParams = new URLSearchParams(window.location.search);
  const category = urlParams.get('category');
  if (category) title.innerText = category;
  else title.innerText = 'All Products';

  // Show shimmer placeholders
  for (let i = 0; i < 8; i++) {
    list.appendChild(createShimmerCard());
  }

  // Load and render products
  const products = await loadProducts();
  list.innerHTML = ''; // Clear placeholders
  const filtered = category ? products.filter(p => p.category === category) : products;
  filtered.forEach(p => list.appendChild(createProductCard(p)));
  setupImageViewer();
}

async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  if (!id) {
    alert('Product not found');
    return;
  }

  // === SHIMMER FOR MAIN PRODUCT ===
  const mainImg = document.getElementById('main-image');
  const thumbnailGallery = document.getElementById('thumbnail-gallery');
  const nameEl = document.getElementById('product-name');
  const colorEl = document.getElementById('product-color');
  const priceEl = document.getElementById('product-price');
  const badgesEl = document.getElementById('product-badges');
  const descEl = document.getElementById('product-desc');
  const orderRow = document.getElementById('order-row');

  // Insert shimmer placeholders
  mainImg.parentNode.replaceChild(createMainImageShimmer(), mainImg);
  nameEl.innerHTML = '';
  nameEl.appendChild(createInfoLineShimmer());
  nameEl.appendChild(createInfoLineShimmer());
  colorEl.innerHTML = '';
  colorEl.appendChild(createInfoLineShimmer());
  priceEl.innerHTML = '';
  priceEl.appendChild(createInfoLineShimmer());
  badgesEl.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const badge = document.createElement('div');
    badge.className = 'shimmer-badge';
    badgesEl.appendChild(badge);
  }
  descEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const line = createInfoLineShimmer();
    line.style.width = `${70 + Math.random() * 20}%`;
    descEl.appendChild(line);
  }
  orderRow.innerHTML = '';
  const btnShimmer = document.createElement('div');
  btnShimmer.className = 'shimmer-button';
  orderRow.appendChild(btnShimmer);

  // Thumbnails shimmer
  for (let i = 0; i < 3; i++) {
    thumbnailGallery.appendChild(createThumbnailShimmer());
  }

  // === SHIMMER FOR OTHER PRODUCTS ===
  const otherSection = document.getElementById('other-products');
  for (let i = 0; i < 4; i++) {
    otherSection.appendChild(createShimmerCard());
  }

  // === LOAD DATA ===
  const products = await loadProducts();
  const product = products.find(p => p.id === id);
  if (!product) {
    alert('Product not found');
    return;
  }

  // === REPLACE MAIN PRODUCT SHIMMER WITH REAL DATA ===
  document.title = product.name;
  const sameName = products.filter(p => p.name.toLowerCase() === product.name.toLowerCase());
  let slug = product.name.toLowerCase().replace(/\s+/g, '-');
  if (sameName.length > 1 && product.color) {
    slug += '-' + product.color.toLowerCase().replace(/\s+/g, '-');
  }
  document.getElementById('canonical-link').href = `/product/${slug}`;

  const images = product.images || [];

  // Replace main image
  const realMainImg = document.createElement('img');
  realMainImg.id = 'main-image';
  realMainImg.src = images[0] || '';
  realMainImg.alt = product.name;
  document.querySelector('.shimmer-image-placeholder').parentNode.replaceChild(realMainImg, document.querySelector('.shimmer-image-placeholder'));

  // Replace name
  nameEl.innerHTML = product.name;

  // Replace color
  colorEl.innerText = `Color: ${product.color || '-'}`;

  // Replace price
  const isUpcoming = product.availability === 'Upcoming';
  const hasDiscount = Number(product.discount) > 0;
  const price = Number(product.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(product.discount)) : price;
  priceEl.innerHTML = isUpcoming ? 'TBA' : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ''}৳${finalPrice.toFixed(2)}`;

  // Replace badges
  badgesEl.innerHTML = `
    ${product.category === 'new' ? `<span class="badge new">NEW</span>` : ''}
    ${product.category === 'hot' ? `<span class="badge hot">HOT</span>` : ''}
    ${!isUpcoming && Number(product.stock) <= 0 && product.availability !== 'Pre Order' ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
    ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
    ${product.availability === 'Pre Order' ? `<span class="badge preorder">PRE ORDER</span>` : ''}
  `;

  // Replace description
  descEl.innerText = product.description || '';

  // Replace order button
  const button = document.createElement('button');
  if (isUpcoming) {
    button.textContent = 'Upcoming - Stay Tuned';
    button.disabled = true;
  } else if (product.availability === 'Pre Order') {
    button.className = 'preorder-btn';
    button.textContent = 'Pre Order';
    button.onclick = () => openCheckoutModal(product.id, true);
  } else if (Number(product.stock) > 0) {
    button.textContent = 'Order Now';
    button.onclick = () => openCheckoutModal(product.id);
  } else {
    button.textContent = 'Out of Stock';
    button.disabled = true;
  }
  orderRow.innerHTML = '';
  orderRow.appendChild(button);

  // Replace thumbnails
  thumbnailGallery.innerHTML = '';
  if (images.length > 1) {
    images.slice(1).forEach(src => {
      const thumb = document.createElement('img');
      thumb.src = src;
      thumb.alt = product.name;
      thumb.className = 'thumbnail';
      thumb.onclick = () => { realMainImg.src = src; };
      thumbnailGallery.appendChild(thumb);
    });
  }

  // === REPLACE OTHER PRODUCTS SHIMMER ===
  otherSection.innerHTML = '';
  const eligible = products.filter(p => p.availability !== 'Upcoming' && p.id !== id);
  const random4 = shuffle(eligible).slice(0, 4);
  random4.forEach(p => otherSection.appendChild(createProductCard(p)));

  // === SETUP INTERACTIONS ===
  document.getElementById('close-modal-btn').onclick = closeCheckoutModal;
  const form = document.getElementById('checkout-form');
  form.addEventListener('submit', submitCheckoutOrder);
  document.getElementById('co-payment').addEventListener('change', handlePaymentChange);
  document.getElementById('co-qty').addEventListener('input', updateTotalInModal);
  document.getElementById('co-address').addEventListener('input', updateDeliveryCharge);
  setupImageViewer();
  realMainImg.addEventListener('click', () => {
    document.getElementById('viewer-img').src = realMainImg.src;
    document.getElementById('image-viewer').classList.add('show');
  });
}

// ====== IMAGE VIEWER ======
function setupImageViewer() {
  const viewer = document.getElementById('image-viewer');
  const viewerImg = document.getElementById('viewer-img');
  const closeViewer = document.getElementById('close-viewer');
  if (viewer && viewerImg && closeViewer) {
    document.querySelectorAll('.product-card img').forEach(img => {
      img.addEventListener('click', () => {
        viewerImg.src = img.src;
        viewerImg.alt = img.alt;
        viewer.classList.add('show');
      });
    });
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer) {
        viewer.classList.remove('show');
        viewer.classList.remove('zoomed');
      }
    });
    closeViewer.addEventListener('click', () => {
      viewer.classList.remove('show');
      viewer.classList.remove('zoomed');
    });
    viewerImg.addEventListener('dblclick', () => {
      viewer.classList.toggle('zoomed');
    });
  }
}

// ====== DELIVERY CHARGE LOGIC ======
function calculateDeliveryFee(address) {
  const lowerAddr = address.toLowerCase();
  if (lowerAddr.includes("savar")) {
    return 70;
  } else if (lowerAddr.includes("dhaka")) {
    return 110;
  }
  return 150;
}

function updateDeliveryCharge() {
  const address = document.getElementById('co-address').value.trim();
  const deliveryFee = calculateDeliveryFee(address);
  document.getElementById('co-delivery').value = `Delivery Charge = ${deliveryFee}`;
  document.getElementById('co-delivery').dataset.fee = deliveryFee;
  updateTotalInModal();
}

// ====== CHECKOUT MODAL FLOW ======
async function openCheckoutModal(productId, isPreOrder = false) {
  const products = await loadProducts();
  const p = products.find(x => x.id === productId);
  if (!p) return;
  const price = p.price === 'TBA' ? 0 : Number(p.price) || 0;
  const discount = Number(p.discount) || 0;
  const unit = price - discount;
  document.getElementById('co-product-id').value = p.id;
  document.getElementById('co-product-name').value = p.name;
  document.getElementById('co-color').value = p.color || '';
  document.getElementById('co-price').value = unit.toFixed(2);
  document.getElementById('co-unit-price-raw').value = unit.toString();
  document.getElementById('co-available-stock').value = String(p.stock);
  document.getElementById('co-qty').value = 1;
  document.getElementById('co-qty').max = p.stock;
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
    const preOrderPrice = Math.round((unit * 0.25) / 5) * 5;
    const deliveryFee = Number(document.getElementById('co-delivery').dataset.fee) || DELIVERY_FEE;
    document.getElementById('co-pay-now').value = preOrderPrice.toFixed(2);
    document.getElementById('co-due-amount').value = (unit - preOrderPrice + deliveryFee).toFixed(2);
    document.getElementById('co-payment-number').value = BKASH_NUMBER;
    document.getElementById('co-note').textContent = `Send money to ${BKASH_NUMBER} and provide transaction ID.`;
    document.getElementById('co-pay-now').style.display = 'block';
    document.getElementById('co-due-amount').style.display = 'block';
  }
  updateTotalInModal();
  const modal = document.getElementById('checkout-modal');
  modal.classList.add('show');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkout-modal');
  modal.classList.remove('show');
}

function updateTotalInModal() {
  const qty = Number(document.getElementById('co-qty').value) || 1;
  const unit = Number(document.getElementById('co-unit-price-raw').value) || 0;
  const delivery = Number(document.getElementById('co-delivery').dataset.fee) || DELIVERY_FEE;
  const subtotal = qty * unit;
  const total = subtotal + delivery;
  document.getElementById('co-total').value = total.toFixed(2);
  const paymentMethod = document.getElementById('co-payment').value;
  const isPreOrderMode = paymentMethod === 'Bkash' && document.getElementById('co-payment').disabled;
  const payNowEl = document.getElementById('co-pay-now');
  const dueEl = document.getElementById('co-due-amount');
  if (isPreOrderMode) {
    const upfrontPercent = 0.25;
    const upfront = Math.round((subtotal * upfrontPercent) / 5) * 5;
    payNowEl.value = upfront.toFixed(2);
    dueEl.value = (subtotal + delivery - upfront).toFixed(2);
    payNowEl.style.display = 'block';
    dueEl.style.display = 'block';
  } else if (paymentMethod) {
    const payNow = paymentMethod === 'Bkash' ? total : delivery;
    const dueAmount = paymentMethod === 'Bkash' ? 0 : subtotal;
    payNowEl.value = payNow.toFixed(2);
    dueEl.value = dueAmount.toFixed(2);
    payNowEl.style.display = 'block';
    dueEl.style.display = 'block';
  } else {
    payNowEl.style.display = 'none';
    dueEl.style.display = 'none';
  }
}

function handlePaymentChange(e) {
  const method = e.target.value;
  const payNowEl = document.getElementById('co-pay-now');
  const dueEl = document.getElementById('co-due-amount');
  const paymentNumberEl = document.getElementById('co-payment-number');
  const txnEl = document.getElementById('co-txn');
  const noteEl = document.getElementById('co-note');

  if (method === 'Bkash') {
    paymentNumberEl.value = BKASH_NUMBER;
    noteEl.textContent = `Send money to ${BKASH_NUMBER} and provide transaction ID.`;
    txnEl.required = true;
  } else if (method === 'Cash on Delivery') {
    paymentNumberEl.value = COD_NUMBER;
    noteEl.textContent = `Pay on delivery to ${COD_NUMBER}.`;
    txnEl.required = false;
    txnEl.value = '';
  } else {
    paymentNumberEl.value = '';
    noteEl.textContent = '';
    txnEl.required = false;
    txnEl.value = '';
  }
  updateTotalInModal();
}

async function submitCheckoutOrder(e) {
  e.preventDefault();
  const btn = document.getElementById('place-order-btn');
  btn.disabled = true;
  if (!document.getElementById('co-policy').checked) {
    alert('Please agree to the order policy.');
    btn.disabled = false;
    return;
  }
  const productId = document.getElementById('co-product-id').value;
  const qty = Number(document.getElementById('co-qty').value);
  const available = Number(document.getElementById('co-available-stock').value);
  if (!productId) {
    alert('Product ID is missing.');
    btn.disabled = false;
    return;
  }
  if (qty <= 0) {
    alert('Quantity must be at least 1.');
    btn.disabled = false;
    return;
  }
  if (qty > available && available !== -1) {
    alert(`Quantity exceeds available stock of ${available}.`);
    btn.disabled = false;
    return;
  }
  const unit = Number(document.getElementById('co-unit-price-raw').value);
  if (isNaN(unit)) {
    alert('Invalid unit price.');
    btn.disabled = false;
    return;
  }
  const delivery = Number(document.getElementById('co-delivery').dataset.fee);
  if (isNaN(delivery)) {
    alert('Invalid delivery fee.');
    btn.disabled = false;
    return;
  }
  const total = (qty * unit) + delivery;
  const orderData = {
    timeISO: new Date().toISOString(),
    productId,
    productName: document.getElementById('co-product-name').value,
    color: document.getElementById('co-color').value,
    unitPrice: unit,
    quantity: qty,
    deliveryFee: delivery,
    total,
    paid: Number(document.getElementById('co-pay-now').value) || 0,
    due: Number(document.getElementById('co-due-amount').value) || 0,
    customerName: document.getElementById('co-name').value.trim(),
    phone: document.getElementById('co-phone').value.trim(),
    address: document.getElementById('co-address').value.trim(),
    paymentMethod: document.getElementById('co-payment').value,
    paymentNumber: document.getElementById('co-payment-number').value.trim(),
    transactionId: document.getElementById('co-txn').value.trim().toUpperCase(),
    status: 'Pending'
  };
  if (!orderData.customerName || !orderData.phone || !orderData.address || !orderData.paymentMethod) {
    alert('Please fill all required fields.');
    btn.disabled = false;
    return;
  }
  if (orderData.paymentMethod === 'Bkash' && (!orderData.paymentNumber || !orderData.transactionId)) {
    alert('Please provide payment number and transaction ID for Bkash.');
    btn.disabled = false;
    return;
  }
  try {
    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'products', productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) {
        throw new Error('Product not found.');
      }
      const currentStock = Number(productSnap.data().stock);
      if (currentStock !== -1 && currentStock < qty && productSnap.data().availability !== 'Pre Order') {
        throw new Error(`Insufficient stock. Only ${currentStock} available.`);
      }
      if (currentStock !== -1 && productSnap.data().availability !== 'Pre Order') {
        const newStock = currentStock - qty;
        transaction.update(productRef, { stock: Number(newStock) });
      }
      await addDoc(collection(db, 'orders'), orderData);
    });
    alert('Order placed successfully!');
    closeCheckoutModal();
  } catch (err) {
    console.error('Error placing order:', err);
    alert('Error placing order: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}

// ====== ADMIN: ADD PRODUCT ======
async function addProduct(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('add-name').value.trim(),
    price: document.getElementById('add-price').value.trim() === 'TBA' ? 'TBA' : Number(document.getElementById('add-price').value) || 0,
    discount: Number(document.getElementById('add-discount').value) || 0,
    images: document.getElementById('add-images').value.split(',').map(u => u.trim()).filter(u => u),
    category: document.getElementById('add-category').value,
    color: document.getElementById('add-color').value.trim(),
    stock: Number(document.getElementById('add-stock').value) || 0,
    availability: document.getElementById('add-availability').value,
    description: document.getElementById('add-desc').value.trim()
  };
  try {
    await addDoc(collection(db, 'products'), data);
    e.target.reset();
    renderDataTable();
  } catch (err) {
    console.error('Add product error:', err);
    alert('Error adding product: ' + err.message);
  }
}

// ====== ADMIN: PRODUCTS TABLE ======
async function renderDataTable() {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;
  const products = await loadProducts();
  tbody.innerHTML = '';
  const cols = [
    { key: 'name' },
    { key: 'price' },
    { key: 'category' },
    { key: 'color' },
    { key: 'discount' },
    { key: 'stock' },
    { key: 'availability' }
  ];
  products.forEach(p => {
    const tr = document.createElement('tr');
    // Toggle details
    const tdToggle = document.createElement('td');
    tdToggle.className = 'toggle-details';
    tdToggle.innerHTML = 'Down Arrow';
    tdToggle.addEventListener('click', (e) => {
      const detailsRow = e.target.closest('tr').nextElementSibling;
      const isVisible = detailsRow.classList.contains('show');
      detailsRow.classList.toggle('show', !isVisible);
      e.target.textContent = isVisible ? 'Down Arrow' : 'Up Arrow';
    });
    tr.appendChild(tdToggle);
    // Main columns
    cols.forEach(col => {
      const td = document.createElement('td');
      td.contentEditable = true;
      td.textContent = p[col.key] != null ? String(p[col.key]) : '';
      td.addEventListener('blur', async (e) => {
        const val = e.target.textContent.trim();
        if (val === (p[col.key] != null ? String(p[col.key]) : '')) return;
        let updateValue = val;
        if (col.key === 'price') {
          if (val !== 'TBA' && isNaN(Number(val))) {
            alert('Price must be a number or "TBA".');
            e.target.textContent = p[col.key] != null ? String(p[col.key]) : '';
            return;
          }
          updateValue = val === 'TBA' ? 'TBA' : Number(val);
        } else if (col.key === 'discount' || col.key === 'stock') {
          if (isNaN(Number(val))) {
            alert(`${col.key.charAt(0).toUpperCase() + col.key.slice(1)} must be a number.`);
            e.target.textContent = p[col.key] != null ? String(p[col.key]) : '';
            return;
          }
          updateValue = Number(val);
        } else if (col.key === 'availability') {
          if (!['Ready', 'Pre Order', 'Upcoming'].includes(val)) {
            alert('Availability must be Ready, Pre Order, or Upcoming.');
            e.target.textContent = p[col.key] != null ? String(p[col.key]) : '';
            return;
          }
        }
        await updateProductField(p.id, col.key, updateValue);
        if (col.key === 'stock' || col.key === 'price' || col.key === 'availability') {
          const cur = (await loadProducts()).find(x => x.id === p.id);
          tr.querySelector('td[data-status="1"]').textContent = computeStatus(cur);
        }
      });
      tr.appendChild(td);
    });
    // Status column
    const tdStatus = document.createElement('td');
    tdStatus.dataset.status = '1';
    tdStatus.textContent = computeStatus(p);
    tr.appendChild(tdStatus);
    // Actions column
    const tdActions = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (confirm(`Delete "${p.name}"?`)) await deleteProductById(p.id);
    });
    tdActions.appendChild(del);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
    // Details row for Image URLs and Description
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = cols.length + 3;
    detailsCell.className = 'details-content';
    const imagesCell = document.createElement('div');
    imagesCell.contentEditable = true;
    imagesCell.textContent = p.images ? p.images.join(', ') : '';
    imagesCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.images ? p.images.join(', ') : '')) return;
      const imagesArray = val.split(/,\s*/).map(u => u.trim()).filter(u => u);
      await updateProductField(p.id, 'images', imagesArray);
    });
    const descCell = document.createElement('div');
    descCell.contentEditable = true;
    descCell.textContent = p.description != null ? p.description : '';
    descCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.description != null ? String(p.description) : '')) return;
      await updateProductField(p.id, 'description', val);
    });
    detailsCell.innerHTML = `<strong>Image URLs (comma-separated):</strong> `;
    detailsCell.appendChild(imagesCell);
    detailsCell.innerHTML += `<br><strong>Description:</strong> `;
    detailsCell.appendChild(descCell);
    detailsRow.appendChild(detailsCell);
    tbody.appendChild(detailsRow);
  });
}

function computeStatus(p) {
  if (p.availability === 'Upcoming') return 'Upcoming';
  if (p.availability === 'Pre Order') return 'Pre Order';
  return Number(p.stock) > 0 ? 'In Stock' : 'Out of Stock';
}

async function updateProductField(id, field, value) {
  try {
    await updateDoc(doc(db, 'products', id), { [field]: value });
  } catch (err) {
    console.error('Error updating product:', err);
    alert('Error updating product: ' + err.message);
  }
}

async function deleteProductById(id) {
  try {
    await deleteDoc(doc(db, 'products', id));
    renderDataTable();
  } catch (err) {
    console.error('Error deleting product:', err);
    alert('Error deleting product: ' + err.message);
  }
}

// ====== ADMIN: ORDERS TABLE ======
async function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  const orders = await loadOrders();
  tbody.innerHTML = '';
  orders.forEach(o => {
    const tr = document.createElement('tr');
    // Toggle button cell
    const tdToggle = document.createElement('td');
    tdToggle.className = 'toggle-details';
    tdToggle.innerHTML = 'Down Arrow';
    tdToggle.addEventListener('click', (e) => {
      const detailsRow = e.target.closest('tr').nextElementSibling;
      const isVisible = detailsRow.classList.contains('show');
      detailsRow.classList.toggle('show', !isVisible);
      e.target.textContent = isVisible ? 'Down Arrow' : 'Up Arrow';
    });
    tr.appendChild(tdToggle);
    // Main columns
    const tds = [
      new Date(o.timeISO).toLocaleString(),
      o.productName,
      o.color,
      o.quantity,
      '৳' + Number(o.deliveryFee).toFixed(2),
      '৳' + Number(o.paid).toFixed(2),
      '৳' + Number(o.due).toFixed(2),
      o.customerName,
      o.phone,
      o.address,
      o.paymentMethod,
      o.transactionId
    ];
    tds.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    // Status dropdown
    const tdStatus = document.createElement('td');
    const select = document.createElement('select');
    ['Pending', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'].forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.text = opt;
      if (o.status === opt) option.selected = true;
      select.appendChild(option);
    });
    select.style.backgroundColor = statusColors[o.status || 'Pending'];
    select.addEventListener('change', async (e) => {
      try {
        const newStatus = e.target.value;
        await updateDoc(doc(db, 'orders', o.id), { status: newStatus });
        select.style.backgroundColor = statusColors[newStatus];
      } catch (err) {
        console.error('Error updating order status:', err);
        alert('Error updating order status: ' + err.message);
      }
    });
    tdStatus.appendChild(select);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);
    // Details row for Unit Price
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 14;
    detailsCell.className = 'details-content';
    const unitPriceCell = document.createElement('div');
    unitPriceCell.textContent = `Unit Price: ৳${Number(o.unitPrice).toFixed(2)}`;
    detailsCell.appendChild(unitPriceCell);
    detailsRow.appendChild(detailsCell);
    tbody.appendChild(detailsRow);
  });
}

// ====== AUTH ======
function logoutAdmin() {
  try {
    signOut(auth);
    console.log('Logged out successfully');
  } catch (err) {
    console.error('Logout error:', err);
    alert('Error logging out: ' + err.message);
  }
}

// ====== ORDER STATUS BY PHONE ======
// Add this function inside script.js (before setupStatusForm)
async function searchOrdersByPhone() {
  const phone = document.getElementById('phone-input').value.trim();
  const resultsContainer = document.getElementById('order-results');
  if (!phone) {
    alert('Please enter a phone number.');
    return;
  }

  resultsContainer.innerHTML = '<p>Loading orders...</p>';

  try {
    const q = query(collection(db, 'orders'), where('phone', '==', phone), orderBy('timeISO', 'desc'));
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (orders.length === 0) {
      resultsContainer.innerHTML = '<p class="no-orders">No orders found for this phone number.</p>';
      return;
    }

    resultsContainer.innerHTML = '';
    const products = await loadProducts();
    const productMap = {};
    products.forEach(p => productMap[p.id] = p);

    orders.forEach(order => {
      const product = productMap[order.productId] || {};
      const images = product.images || [];
      const isPreOrder = order.paid > 0 && order.paid < order.total && product.availability === 'Pre Order';
      const orderedWhen = isPreOrder ? 'Pre Order' : (Number(product.stock) > 0 ? 'In Stock' : 'Out of Stock');
      const deliveryTime = isPreOrder ? '20–40 days' : '3–7 business days';

      const card = document.createElement('div');
      card.className = 'order-card';

      card.innerHTML = `
        <div class="order-card-header">
          <span class="toggle-icon">Right Arrow</span>
          <div>
            Order on ${new Date(order.timeISO).toLocaleDateString()} 
            <span class="status-badge" style="background: ${statusColors[order.status] || '#ccc'}; color: white; margin-left: 8px;">
              ${order.status}
            </span>
          </div>
        </div>
        <div class="order-card-body">
          <img src="${images[0] || ''}" alt="${order.productName}" class="order-image" onerror="this.src=''; this.style.display='none';">
          <div class="order-details">
            <div><strong>${order.productName}</strong></div>
            ${order.color ? `<div>Color: ${order.color}</div>` : ''}
            <div>Qty: ${order.quantity} × ৳${Number(order.unitPrice).toFixed(2)}</div>
            <div>Delivery: ৳${Number(order.deliveryFee).toFixed(2)}</div>
            <div><strong>Total: ৳${Number(order.total).toFixed(2)}</strong></div>
            <div>Paid: ৳${Number(order.paid).toFixed(2)} | Due: ৳${Number(order.due).toFixed(2)}</div>
            <div><strong>Ordered when:</strong> ${orderedWhen}</div>
            <div><strong>Est. Delivery:</strong> ${deliveryTime}</div>
            <div><strong>Payment:</strong> ${order.paymentMethod}${order.transactionId ? ` (TXN: ${order.transactionId})` : ''}</div>
            <div><strong>Address:</strong> ${order.address}</div>
          </div>
        </div>
      `;

      const header = card.querySelector('.order-card-header');
      const body = card.querySelector('.order-card-body');
      const icon = card.querySelector('.toggle-icon');

      header.addEventListener('click', () => {
        const isOpen = body.classList.contains('open');
        body.classList.toggle('open', !isOpen);
        icon.classList.toggle('open', !isOpen);
        icon.textContent = isOpen ? 'Right Arrow' : 'Down Arrow';
      });

      resultsContainer.appendChild(card);
    });
  } catch (err) {
    console.error('Error searching orders:', err);
    resultsContainer.innerHTML = '<p class="no-orders">Error loading orders. Please try again.</p>';
  }
}
// ====== ORDER STATUS PAGE ======
function setupStatusForm() {
  const form = document.getElementById('status-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await searchOrdersByPhone();
  });

  // Optional: Allow pressing Enter in input
  document.getElementById('phone-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchOrdersByPhone();
    }
  });
}

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  const isHome = !!document.getElementById('interest-products');
  const isProducts = !!document.getElementById('product-list');
  const isProduct = !!document.getElementById('product-section');
  const isAdmin = !!document.getElementById('admin-panel');
  const isStatus = !!document.getElementById('status-form');
  if (isHome) await initHomePage();
  if (isProducts) await initProductsPage();
  if (isProduct) await initProductPage();
  if (isStatus) setupStatusForm();
  // Admin page
  const loginPanel = document.getElementById('login-panel');
  const adminPanel = document.getElementById('admin-panel');
  const addForm = document.getElementById('add-product-form');
  if (addForm) addForm.addEventListener('submit', addProduct);
  if (loginPanel && adminPanel) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('User logged in:', user.email);
        loginPanel.style.display = 'none';
        adminPanel.style.display = 'block';
        await renderDataTable();
        await renderOrdersTable();
      } else {
        console.log('No user logged in');
        loginPanel.style.display = 'block';
        adminPanel.style.display = 'none';
      }
    });
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-pass').value;
        console.log('Attempting login with email:', email);
        try {
          await signInWithEmailAndPassword(auth, email, pass);
          console.log('Login successful');
        } catch (err) {
          console.error('Login failed:', err);
          alert('Login failed: ' + err.message);
        }
      });
    }
  }

});

