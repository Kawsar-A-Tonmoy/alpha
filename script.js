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

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/* --- Shimmer loading helpers --- */
function showLoadingShimmers(containerId, count = 4) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const shimmer = document.createElement('div');
    shimmer.className = 'card shimmer-card';
    shimmer.innerHTML = `
      <div class="shimmer-img"></div>
      <div class="shimmer-line short"></div>
      <div class="shimmer-line long"></div>
      <div class="shimmer-line medium"></div>
    `;
    container.appendChild(shimmer);
  }
}

/* --- Product card creation --- */
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
  card.style.cursor = 'default';

  card.innerHTML = `
    <img src="${featuredImage}" alt="${p.name}" onerror="this.src=''; this.alt='Image not available';">
    <div class="badges">
      ${isOOS ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
      ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
      ${isPreOrder ? `<span class="badge preorder">PRE ORDER</span>` : ''}
    </div>
    <h3 class="card-title" title="${p.name}">${p.name}</h3>
    <div class="muted">Color: ${p.color || '-'}</div>
    <div class="price">
      ${isUpcoming ? `TBA` : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s>` : ''} ৳${finalPrice.toFixed(2)}`}
    </div>
    <button class="${isPreOrder ? 'preorder-btn' : 'order-btn'}" 
      ${isOOS || isUpcoming ? 'disabled' : ''}>${isPreOrder ? 'Pre Order' : 'Order'}</button>
  `;

  const imgEl = card.querySelector('img');
  const titleEl = card.querySelector('.card-title');
  if (imgEl) imgEl.addEventListener('click', () => { window.location.href = `product.html?slug=${p.slug}`; });
  if (titleEl) titleEl.addEventListener('click', () => { window.location.href = `product.html?slug=${p.slug}`; });

  const btn = card.querySelector('button');
  if (btn && !isOOS && !isUpcoming) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await openCheckoutModal(p.id, isPreOrder);
    });
  }

  return card;
}
/* --- Display “May Interest You” --- */
async function displayInterestProducts() {
  const section = document.getElementById('interest-products');
  if (!section) return;

  showLoadingShimmers('interest-products', 4); // shimmer while loading

  let products = await loadProducts();
  section.innerHTML = ''; // clear shimmer
  products = shuffle(products).slice(0, 4);
  products.forEach(p => section.appendChild(createProductCard(p)));
}

/* --- Display products by category (for products.html) --- */
async function displayFilteredProducts() {
  const section = document.getElementById('product-list');
  if (!section) return;
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  const products = await loadProducts(category);
  if (category) {
    const h1 = document.querySelector('h1');
    if (h1) h1.textContent = `Products – ${category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}`;
  }
  products.forEach(p => section.appendChild(createProductCard(p)));
}

/* --- Individual Product Detail Page --- */
async function displayProductDetail() {
  const detail = document.getElementById('product-detail');
  if (!detail) return;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) { detail.innerHTML = '<p>Product not found.</p>'; return; }

  const p = await loadProductBySlug(slug);
  if (!p) { detail.innerHTML = '<p>Product not found.</p>'; return; }

  document.title = `${p.name} – The Geek Shop`;

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
        ${isUpcoming ? `TBA` : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s>` : ''} ৳${finalPrice.toFixed(2)}`}
      </div>
      <div class="muted">Color: ${p.color || '-'}</div>
      <div>Availability: ${p.availability}</div>
      <div class="description">${p.description || ''}</div>
      <button ${isOOS || isUpcoming ? 'disabled' : ''}
              id="order-btn"
              class="${isPreOrder ? 'preorder-btn' : 'order-btn'}">
              ${isPreOrder ? 'Pre Order' : 'Order'}
      </button>
    </div>
  `;
  detail.innerHTML = html;

  if (!isOOS && !isUpcoming) {
    const orderBtn = document.getElementById('order-btn');
    if (orderBtn) orderBtn.addEventListener('click', () => openCheckoutModal(p.id, isPreOrder));
  }

  // image viewer
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
    viewer.addEventListener('click', e => { if (e.target === viewer) viewer.classList.remove('show', 'zoomed'); });
    closeViewer.addEventListener('click', () => viewer.classList.remove('show', 'zoomed'));
    viewerImg.addEventListener('dblclick', () => viewer.classList.toggle('zoomed'));
  }
}

/* --- “Other Products” Section --- */
async function displayOtherProducts() {
  const section = document.getElementById('other-products');
  if (!section) return;

  showLoadingShimmers('other-products', 4); // shimmer while loading

  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) { section.innerHTML = ''; return; }

  const current = await loadProductBySlug(slug);
  if (!current) { section.innerHTML = ''; return; }

  let allProducts = await loadProducts();
  const related = allProducts.filter(p => p.category === current.category && p.slug !== current.slug);
  const random = allProducts.filter(p => p.category !== current.category);

  const combined = [...related.slice(0, 3)];
  if (random.length) combined.push(random[Math.floor(Math.random() * random.length)]);

  section.innerHTML = ''; // clear shimmer
  combined.forEach(p => section.appendChild(createProductCard(p)));
}

/* --- Delivery and Checkout Helpers --- */
function calculateDeliveryFee(address) {
  const lower = address.toLowerCase();
  if (lower.includes('savar')) return 70;
  else if (lower.includes('dhaka')) return 110;
  return 150;
}

function updateDeliveryCharge() {
  const address = document.getElementById('co-address').value.trim();
  const deliveryFee = calculateDeliveryFee(address);
  document.getElementById('co-delivery').value = `Delivery Charge = ${deliveryFee}`;
  document.getElementById('co-delivery').dataset.fee = deliveryFee;
  updateTotalInModal();
}
/* --- Open Checkout Modal --- */
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
  document.getElementById('checkout-modal').classList.add('show');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('show');
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
    const preOrderPrice = Math.round((unit * 0.25) / 5) * 5;
    payNowEl.value = (qty * preOrderPrice).toFixed(2);
    dueEl.value = (total - qty * preOrderPrice).toFixed(2);
  }
}

/* --- Payment Method Handler --- */
function handlePaymentChange(e) {
  const method = e.target.value;
  const txn = document.getElementById('co-txn');
  const number = document.getElementById('co-payment-number');
  const note = document.getElementById('co-note');
  const payNow = document.getElementById('co-pay-now');
  const due = document.getElementById('co-due-amount');

  if (method === 'Bkash') {
    number.value = BKASH_NUMBER;
    note.textContent = `Send money to ${BKASH_NUMBER} and provide transaction ID.`;
    txn.required = true;
    payNow.style.display = 'block';
    due.style.display = 'block';
    const total = Number(document.getElementById('co-total').value) || 0;
    payNow.value = total.toFixed(2);
    due.value = '0.00';
  } else if (method === 'Cash on Delivery') {
    number.value = COD_NUMBER;
    note.textContent = '';
    txn.required = false;
    payNow.style.display = 'block';
    due.style.display = 'block';
    payNow.value = '0.00';
    due.value = document.getElementById('co-total').value;
  } else {
    number.value = '';
    note.textContent = '';
    txn.required = false;
    payNow.style.display = 'none';
    due.style.display = 'none';
  }
}

/* --- Submit Checkout Order --- */
async function submitCheckoutOrder(e) {
  e.preventDefault();

  const id = document.getElementById('co-product-id').value;
  const qty = Number(document.getElementById('co-qty').value);
  const available = Number(document.getElementById('co-available-stock').value);
  if (qty > available) return alert('Quantity exceeds available stock.');
  if (!document.getElementById('co-policy').checked) return alert('You must agree to the order policy.');

  const paymentMethod = document.getElementById('co-payment').value;
  const txnId =
    paymentMethod === 'Cash on Delivery'
      ? Math.random().toString(36).substring(2, 10).toUpperCase()
      : document.getElementById('co-txn').value.trim();
  if (paymentMethod === 'Bkash' && !txnId) return alert('Transaction ID is required for Bkash.');

  const p = await getDoc(doc(db, 'products', id));
  if (!p.exists()) return;
  const data = p.data();

  const unit = Number(document.getElementById('co-unit-price-raw').value);
  const deliveryFee = Number(document.getElementById('co-delivery').dataset.fee);
  const subtotal = qty * unit;
  const total = subtotal + deliveryFee;
  let paid = 0;
  let due = total;
  const isPreOrder = data.availability === 'Pre Order';

  if (isPreOrder) {
    const preOrderPrice = Math.round((unit * 0.25) / 5) * 5;
    paid = qty * preOrderPrice;
    due = total - paid;
  } else if (paymentMethod === 'Bkash') {
    paid = total;
    due = 0;
  }

  const order = {
    productId: id,
    productName: data.name,
    color: data.color || '',
    unitPrice: unit,
    quantity: qty,
    deliveryFee,
    paid,
    due,
    customerName: document.getElementById('co-name').value.trim(),
    phone: document.getElementById('co-phone').value.trim(),
    address: document.getElementById('co-address').value.trim(),
    paymentMethod,
    transactionId: txnId,
    status: 'Pending',
    timeISO: new Date().toISOString()
  };

  try {
    await runTransaction(db, async (transaction) => {
      const freshP = await transaction.get(doc(db, 'products', id));
      if (!freshP.exists) throw new Error('Product not found');
      const freshData = freshP.data();
      if (freshData.stock < qty) throw new Error('Insufficient stock');
      transaction.update(doc(db, 'products', id), { stock: freshData.stock - qty });
      transaction.set(doc(collection(db, 'orders')), order);
    });
    alert(`Order placed! Transaction ID: ${txnId}`);
    closeCheckoutModal();
  } catch (err) {
    console.error('Order error:', err);
    alert('Error placing order: ' + err.message);
  }
}
/* --- Admin: Add Product --- */
async function addProduct(e) {
  e.preventDefault();
  const name = document.getElementById('add-name').value.trim();
  const price = document.getElementById('add-price').value.trim();
  const discount = Number(document.getElementById('add-discount').value) || 0;
  const imagesStr = document.getElementById('add-images').value.trim();
  const images = imagesStr.split(',').map(s => s.trim()).filter(Boolean);
  if (!images.length) return alert('At least one image URL is required.');
  const category = document.getElementById('add-category').value;
  const color = document.getElementById('add-color').value.trim();
  const stock = Number(document.getElementById('add-stock').value) || 0;
  const availability = document.getElementById('add-availability').value;
  const description = document.getElementById('add-desc').value.trim();
  const slug = await generateUniqueSlug(name, color);
  const product = {
    name,
    price: price === 'TBA' ? 'TBA' : Number(price),
    discount,
    images,
    category,
    color,
    stock,
    availability,
    description,
    slug
  };
  try {
    await addDoc(collection(db, 'products'), product);
    e.target.reset();
    renderDataTable();
  } catch (err) {
    console.error('Add product error:', err);
    alert('Error adding product: ' + err.message);
  }
}

/* --- Render Admin Products Table --- */
async function renderDataTable() {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;
  const products = await loadProducts();
  tbody.innerHTML = '';
  products.forEach(p => {
    const tr = document.createElement('tr');

    const tdToggle = document.createElement('td');
    tdToggle.className = 'toggle-details';
    tdToggle.innerHTML = '▼';
    tdToggle.addEventListener('click', e => {
      const detailsRow = e.target.closest('tr').nextElementSibling;
      const isVisible = detailsRow.classList.contains('show');
      detailsRow.classList.toggle('show', !isVisible);
      e.target.textContent = isVisible ? '▼' : '▲';
    });
    tr.appendChild(tdToggle);

    const cols = [
      { key: 'name' },
      { key: 'price' },
      { key: 'category' },
      { key: 'color' },
      { key: 'discount' },
      { key: 'stock' },
      { key: 'availability' }
    ];

    cols.forEach(col => {
      const td = document.createElement('td');
      td.contentEditable = true;
      td.textContent = p[col.key] != null ? String(p[col.key]) : '';
      td.addEventListener('blur', async e => {
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
        if (col.key === 'name' || col.key === 'color') {
          const updatedP = (await loadProducts()).find(x => x.id === p.id);
          const newSlug = await generateUniqueSlug(updatedP.name, updatedP.color, p.id);
          if (newSlug !== updatedP.slug) await updateProductField(p.id, 'slug', newSlug);
        }
        if (col.key === 'stock' || col.key === 'price' || col.key === 'availability') {
          const cur = (await loadProducts()).find(x => x.id === p.id);
          tr.querySelector('td[data-status="1"]').textContent = computeStatus(cur);
        }
      });
      tr.appendChild(td);
    });

    const tdStatus = document.createElement('td');
    tdStatus.dataset.status = '1';
    tdStatus.textContent = computeStatus(p);
    tr.appendChild(tdStatus);

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

    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = cols.length + 3;
    detailsCell.className = 'details-content';

    const imagesCell = document.createElement('div');
    imagesCell.contentEditable = true;
    imagesCell.textContent = p.images ? p.images.join(', ') : '';
    imagesCell.addEventListener('blur', async e => {
      const val = e.target.textContent.trim();
      const newImages = val.split(',').map(s => s.trim()).filter(Boolean);
      if (newImages.length === 0) {
        alert('At least one image URL is required.');
        e.target.textContent = p.images ? p.images.join(', ') : '';
        return;
      }
      await updateProductField(p.id, 'images', newImages);
    });

    const descCell = document.createElement('div');
    descCell.contentEditable = true;
    descCell.textContent = p.description != null ? p.description : '';
    descCell.addEventListener('blur', async e => {
      const val = e.target.textContent.trim();
      if (val === (p.description != null ? String(p.description) : '')) return;
      await updateProductField(p.id, 'description', val);
    });

    detailsCell.innerHTML = `<strong>Image URLs (comma separated):</strong> `;
    detailsCell.appendChild(imagesCell);
    detailsCell.innerHTML += `<br><strong>Description:</strong> `;
    detailsCell.appendChild(descCell);
    detailsRow.appendChild(detailsCell);
    tbody.appendChild(detailsRow);
  });
}

/* --- Helper: compute status string --- */
function computeStatus(p) {
  if (p.availability === 'Upcoming') return 'Upcoming';
  if (p.availability === 'Pre Order') return 'Pre Order';
  return Number(p.stock) > 0 ? 'In Stock' : 'Out of Stock';
}

/* --- Update / Delete product helpers --- */
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

/* --- Render Orders Table --- */
async function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  const orders = await loadOrders();
  tbody.innerHTML = '';
  orders.forEach(o => {
    const tr = document.createElement('tr');
    const tdToggle = document.createElement('td');
    tdToggle.className = 'toggle-details';
    tdToggle.innerHTML = '▼';
    tdToggle.addEventListener('click', e => {
      const detailsRow = e.target.closest('tr').nextElementSibling;
      const isVisible = detailsRow.classList.contains('show');
      detailsRow.classList.toggle('show', !isVisible);
      e.target.textContent = isVisible ? '▼' : '▲';
    });
    tr.appendChild(tdToggle);

    const tds = [
      new Date(o.timeISO).toLocaleString(),
      o.productName,
      o.color,
      o.quantity,
      '৳' + Number(o.due).toFixed(2),
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
    select.addEventListener('change', async e => {
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

function setupAuth() {
  const loginForm = document.getElementById('login-form');
  const adminPanel = document.getElementById('admin-panel');
  const logoutBtn = document.getElementById('logout-btn');

  if (!loginForm || !adminPanel) return;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginForm.style.display = 'none';
      adminPanel.style.display = 'block';
      renderDataTable();
      renderOrdersTable();
    } else {
      loginForm.style.display = 'block';
      adminPanel.style.display = 'none';
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await signOut(auth);
    });
  }
}

/* --- Order Status Page --- */
async function displayStatus() {
  const section = document.getElementById('status-section');
  if (!section) return;

  const params = new URLSearchParams(window.location.search);
  const txnId = params.get('txn');
  if (!txnId) {
    section.innerHTML = '<p>Enter a transaction ID to view status.</p>';
    return;
  }

  const q = query(collection(db, 'orders'), where('transactionId', '==', txnId));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    section.innerHTML = '<p>No order found for this transaction ID.</p>';
    return;
  }

  const order = snapshot.docs[0].data();
  const color = statusColors[order.status] || '#999';
  const expl = statusExplanations[order.status] || '';
  section.innerHTML = `
    <div class="order-status">
      <h2>Order Status: <span style="color:${color}">${order.status}</span></h2>
      <p>${expl}</p>
      <p><strong>Product:</strong> ${order.productName}</p>
      <p><strong>Quantity:</strong> ${order.quantity}</p>
      <p><strong>Customer:</strong> ${order.customerName}</p>
      <p><strong>Phone:</strong> ${order.phone}</p>
      <p><strong>Address:</strong> ${order.address}</p>
      <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
      <p><strong>Transaction ID:</strong> ${order.transactionId}</p>
    </div>
  `;
}

/* --- DOMContentLoaded initialization --- */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.endsWith('index.html') || path === '/' || path === '') {
    displayInterestProducts();
  }
  if (path.endsWith('products.html')) {
    displayFilteredProducts();
  }
  if (path.endsWith('product.html')) {
    displayProductDetail();
    displayOtherProducts(); // new addition
  }
  if (path.endsWith('admin.html')) {
    setupAuth();
  }
  if (path.endsWith('status.html')) {
    displayStatus();
  }

  const modal = document.getElementById('checkout-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  if (modal && closeBtn) {
    closeBtn.addEventListener('click', closeCheckoutModal);
  }
  const qtyInput = document.getElementById('co-qty');
  if (qtyInput) qtyInput.addEventListener('input', updateTotalInModal);
  const paymentSelect = document.getElementById('co-payment');
  if (paymentSelect) paymentSelect.addEventListener('change', handlePaymentChange);
  const addressInput = document.getElementById('co-address');
  if (addressInput) addressInput.addEventListener('input', updateDeliveryCharge);
  const checkoutForm = document.getElementById('checkout-form');
  if (checkoutForm) checkoutForm.addEventListener('submit', submitCheckoutOrder);
});


