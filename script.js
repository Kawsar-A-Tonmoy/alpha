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
  card.addEventListener('click', () => {
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
  `;
  return card;
}

async function displayInterestProducts() {
  const section = document.getElementById('interest-products');
  if (!section) return;
  section.innerHTML = `
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
  `;
  const products = await loadProducts();
  section.innerHTML = '';
  const shuffledProducts = shuffle(products).slice(0, 5);
  shuffledProducts.forEach(p => section.appendChild(createProductCard(p)));
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function displayFilteredProducts() {
  const section = document.getElementById('product-list');
  if (!section) return;
  section.innerHTML = `
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
  `;
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  const products = await loadProducts(category);
  section.innerHTML = '';
  if (category) {
    document.querySelector('h1').textContent = `Products - ${category.charAt(0).toUpperCase() + category.slice(1).replace('-', ' ')}`;
  }
  products.forEach(p => section.appendChild(createProductCard(p)));
}

async function displayOtherProducts(currentSlug) {
  const section = document.getElementById('other-products');
  if (!section) return;
  section.innerHTML = `
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
    <div class="shimmer-card"></div>
  `;
  const products = await loadProducts();
  section.innerHTML = '';
  const filteredProducts = products.filter(p => p.slug !== currentSlug);
  const shuffledProducts = shuffle(filteredProducts).slice(0, 4);
  shuffledProducts.forEach(p => section.appendChild(createProductCard(p)));
}

async function displayProductDetail() {
  const detail = document.getElementById('product-detail');
  if (!detail) return;
  detail.innerHTML = '<div class="shimmer-detail"></div>';
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
        ${images.map(img => `<img src="${img}" alt="${p.name}" class="thumbnail">`).join('')}
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
    document.querySelectorAll('.thumbnail').forEach(thumb => {
      thumb.addEventListener('click', () => {
        document.getElementById('main-image').src = thumb.src;
        viewerImg.src = thumb.src;
        viewerImg.alt = thumb.alt;
        viewer.classList.add('show');
      });
    });
    viewer.addEventListener('click', e => {
      if (e.target === viewer) viewer.classList.remove('show', 'zoomed');
    });
    closeViewer.addEventListener('click', () => viewer.classList.remove('show', 'zoomed'));
    viewerImg.addEventListener('dblclick', () => viewer.classList.toggle('zoomed'));
  }
  displayOtherProducts(slug);
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
  document.getElementById('co-address').value = '';
  document.getElementById('co-delivery').value = 'Delivery Charge = 0';
  document.getElementById('co-delivery').dataset.fee = '0';
  document.getElementById('co-total').value = '';
  document.getElementById('co-note').textContent = '';
  document.getElementById('checkout-modal').classList.add('show');
}

function updateTotalInModal() {
  const qty = Number(document.getElementById('co-qty').value) || 1;
  const unitPrice = Number(document.getElementById('co-unit-price-raw').value) || 0;
  const deliveryFee = Number(document.getElementById('co-delivery').dataset.fee) || 0;
  const total = (qty * unitPrice) + deliveryFee;
  document.getElementById('co-total').value = total.toFixed(2);
  const paymentMethod = document.getElementById('co-payment').value;
  if (paymentMethod === 'Bkash') {
    document.getElementById('co-pay-now').value = total.toFixed(2);
    document.getElementById('co-due-amount').value = '0.00';
  } else if (paymentMethod === 'Cash on Delivery') {
    document.getElementById('co-pay-now').value = '0.00';
    document.getElementById('co-due-amount').value = total.toFixed(2);
  }
}

function handlePaymentChange() {
  const paymentMethod = document.getElementById('co-payment').value;
  document.getElementById('co-payment-number').value = paymentMethod === 'Bkash' ? BKASH_NUMBER : paymentMethod === 'Cash on Delivery' ? COD_NUMBER : '';
  document.getElementById('co-note').textContent = paymentMethod === 'Bkash' ? 'Please send the payment to the provided number and enter the Transaction ID.' : '';
  updateTotalInModal();
}

async function submitCheckoutOrder(e) {
  e.preventDefault();
  const productId = document.getElementById('co-product-id').value;
  const qty = Number(document.getElementById('co-qty').value);
  const availableStock = Number(document.getElementById('co-available-stock').value);
  if (qty > availableStock) {
    alert('Requested quantity exceeds available stock.');
    return;
  }
  const paymentMethod = document.getElementById('co-payment').value;
  const txnId = document.getElementById('co-txn').value.trim();
  if (paymentMethod === 'Bkash' && !txnId) {
    alert('Transaction ID is required for Bkash payments.');
    return;
  }
  const order = {
    productId,
    productName: document.getElementById('co-product-name').value,
    color: document.getElementById('co-color').value,
    unitPrice: Number(document.getElementById('co-unit-price-raw').value),
    quantity: qty,
    deliveryFee: Number(document.getElementById('co-delivery').dataset.fee),
    total: Number(document.getElementById('co-total').value),
    paid: paymentMethod === 'Bkash' ? Number(document.getElementById('co-total').value) : 0,
    due: paymentMethod === 'Cash on Delivery' ? Number(document.getElementById('co-total').value) : 0,
    customerName: document.getElementById('co-name').value,
    phone: document.getElementById('co-phone').value,
    address: document.getElementById('co-address').value,
    paymentMethod,
    transactionId: txnId || 'N/A',
    status: 'Pending',
    timeISO: new Date().toISOString()
  };
  try {
    await runTransaction(db, async transaction => {
      const productRef = doc(db, 'products', productId);
      const product = await transaction.get(productRef);
      if (!product.exists()) throw new Error('Product does not exist.');
      const newStock = Number(product.data().stock) - qty;
      if (newStock < 0) throw new Error('Insufficient stock.');
      transaction.update(productRef, { stock: newStock });
      transaction.set(doc(collection(db, 'orders')), order);
    });
    alert('Order placed successfully!');
    closeCheckoutModal();
  } catch (err) {
    console.error('Error placing order:', err);
    alert('Error placing order: ' + err.message);
  }
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('show');
}

async function addProduct(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.querySelector('#prod-name').value.trim();
  const category = form.querySelector('#prod-cat').value;
  const color = form.querySelector('#prod-color').value.trim();
  const price = form.querySelector('#prod-price').value;
  const stock = form.querySelector('#prod-stock').value;
  const availability = form.querySelector('#prod-avail').value;
  const discount = form.querySelector('#prod-discount').value || 0;
  const images = form.querySelector('#prod-images').value.split(',').map(s => s.trim()).filter(Boolean);
  const description = form.querySelector('#prod-desc').value.trim();
  if (!name || !category || !price || !stock || !availability || images.length === 0) {
    alert('Please fill all required fields and provide at least one image URL.');
    return;
  }
  if (isNaN(price) || Number(price) < 0 || isNaN(stock) || Number(stock) < 0 || isNaN(discount) || Number(discount) < 0) {
    alert('Price, stock, and discount must be non-negative numbers.');
    return;
  }
  try {
    const slug = await generateUniqueSlug(name, color);
    await addDoc(collection(db, 'products'), {
      name,
      category,
      color,
      price: Number(price),
      stock: Number(stock),
      availability,
      discount: Number(discount),
      images,
      description,
      slug
    });
    alert('Product added successfully!');
    form.reset();
    renderDataTable();
  } catch (err) {
    console.error('Error adding product:', err);
    alert('Error adding product: ' + err.message);
  }
}

async function renderDataTable() {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const products = await loadProducts();
  const cols = [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'color', label: 'Color' },
    { key: 'price', label: 'Price' },
    { key: 'stock', label: 'Stock' },
    { key: 'availability', label: 'Availability' },
    { key: 'discount', label: 'Discount' }
  ];
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
    cols.forEach(col => {
      const td = document.createElement('td');
      td.contentEditable = true;
      td.textContent = p[col.key] != null ? String(p[col.key]) : '';
      td.addEventListener('blur', async e => {
        const val = e.target.textContent.trim();
        if (val === (p[col.key] != null ? String(p[col.key]) : '')) return;
        let updateValue = val;
        if (['price', 'stock', 'discount'].includes(col.key)) {
          if (isNaN(val) || Number(val) < 0) {
            alert(`${col.label} must be a non-negative number.`);
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

async function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const orders = await loadOrders();
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

function logoutAdmin() {
  try {
    signOut(auth);
  } catch (err) {
    console.error('Logout error:', err);
    alert('Error logging out: ' + err.message);
  }
}

function setupStatusForm() {
  const form = document.getElementById('status-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const txn = document.getElementById('txn-id').value.trim();
    if (!txn) return;
    try {
      const q = query(collection(db, 'orders'), where('transactionId', '==', txn));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return alert('Order not found.');
      const order = snapshot.docs[0].data();
      alert(`Status: ${order.status}\n${statusExplanations[order.status] || 'Unknown status.'}`);
    } catch (err) {
      console.error('Error fetching status:', err);
      alert('Error fetching status: ' + err.message);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
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