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
    <button ${isOOS || isUpcoming ? 'disabled' : ''} class="${isPreOrder ? 'preorder-btn' : 'order-btn'}" data-product-id="${p.id}">${isPreOrder ? 'Pre Order' : 'Order'}</button>
  `;
  if (!isOOS && !isUpcoming) {
    card.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click from navigating
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
  // Display Other Products
  const otherSection = document.getElementById('other-products');
  if (otherSection) {
    let otherProducts = await loadProducts();
    otherProducts = otherProducts.filter(product => product.id !== p.id);
    otherProducts = shuffle(otherProducts).slice(0, 4);
    otherProducts.forEach(product => otherSection.appendChild(createProductCard(product)));
  }
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
  document.getElementById('co-delivery').value = '';
  document.getElementById('co-delivery').dataset.fee = '0';
  document.getElementById('co-address').value = '';
  document.getElementById('co-payment-number').value = '';
  document.getElementById('co-pay-now').value = '';
  document.getElementById('co-due-amount').value = '';
  document.getElementById('co-txn').value = '';
  document.getElementById('co-policy').checked = false;
  document.getElementById('co-note').textContent = isPreOrder ? 'Note: This is a pre-order. Products will be shipped once available.' : '';
  updateTotalInModal();
  document.getElementById('checkout-modal').style.display = 'block';
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').style.display = 'none';
}

function updateTotalInModal() {
  const qty = Number(document.getElementById('co-qty').value) || 1;
  const unitPrice = Number(document.getElementById('co-unit-price-raw').value) || 0;
  const deliveryFee = Number(document.getElementById('co-delivery').dataset.fee) || 0;
  const total = (unitPrice * qty) + deliveryFee;
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
  document.getElementById('co-payment-number').value = paymentMethod === 'Bkash' ? BKASH_NUMBER : (paymentMethod === 'Cash on Delivery' ? COD_NUMBER : '');
  updateTotalInModal();
}

async function submitCheckoutOrder(e) {
  e.preventDefault();
  const productId = document.getElementById('co-product-id').value;
  const qty = Number(document.getElementById('co-qty').value);
  const address = document.getElementById('co-address').value.trim();
  const paymentMethod = document.getElementById('co-payment').value;
  const transactionId = document.getElementById('co-txn').value.trim();
  const name = document.getElementById('co-name').value.trim();
  const phone = document.getElementById('co-phone').value.trim();
  const unitPrice = Number(document.getElementById('co-unit-price-raw').value);
  const deliveryFee = Number(document.getElementById('co-delivery').dataset.fee);
  const total = Number(document.getElementById('co-total').value);
  const availableStock = Number(document.getElementById('co-available-stock').value);
  
  if (qty > availableStock) {
    alert('Requested quantity exceeds available stock.');
    return;
  }
  if (paymentMethod === 'Bkash' && !transactionId) {
    alert('Transaction ID is required for Bkash payments.');
    return;
  }
  if (!document.getElementById('co-policy').checked) {
    alert('You must agree to the order policy.');
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'products', productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error('Product not found.');
      const productData = productSnap.data();
      const newStock = Number(productData.stock) - qty;
      if (newStock < 0) throw new Error('Insufficient stock.');
      transaction.update(productRef, { stock: newStock });
      const orderData = {
        productId,
        productName: productData.name,
        color: productData.color || '',
        quantity: qty,
        unitPrice,
        delivery: deliveryFee,
        paid: paymentMethod === 'Bkash' ? total : 0,
        due: paymentMethod === 'Cash on Delivery' ? total : 0,
        customerName: name,
        phone,
        address,
        paymentMethod,
        transactionId: transactionId || '',
        status: 'Pending',
        timeISO: new Date().toISOString()
      };
      await transaction.set(doc(collection(db, 'orders')), orderData);
    });
    alert('Order placed successfully!');
    closeCheckoutModal();
  } catch (err) {
    console.error('Error placing order:', err);
    alert('Error placing order: ' + err.message);
  }
}

async function addProduct(e) {
  e.preventDefault();
  const name = document.getElementById('add-name').value.trim();
  const price = document.getElementById('add-price').value.trim();
  const discount = document.getElementById('add-discount').value.trim();
  const images = document.getElementById('add-images').value.split(',').map(s => s.trim()).filter(Boolean);
  const category = document.getElementById('add-category').value;
  const color = document.getElementById('add-color').value.trim();
  const stock = document.getElementById('add-stock').value;
  const availability = document.getElementById('add-availability').value;
  const description = document.getElementById('add-desc').value.trim();

  if (images.length === 0) {
    alert('At least one image URL is required.');
    return;
  }
  if (isNaN(price) || Number(price) <= 0) {
    alert('Price must be a valid number greater than 0.');
    return;
  }
  if (isNaN(discount) || Number(discount) < 0) {
    alert('Discount must be a valid number.');
    return;
  }
  if (isNaN(stock) || Number(stock) < 0) {
    alert('Stock must be a valid number.');
    return;
  }

  try {
    const slug = await generateUniqueSlug(name, color);
    const productData = {
      name,
      price,
      discount: Number(discount) || 0,
      images,
      category,
      color: color || '',
      stock: Number(stock) || 0,
      availability,
      description: description || '',
      slug
    };
    await addDoc(collection(db, 'products'), productData);
    alert('Product added successfully!');
    e.target.reset();
    renderDataTable();
  } catch (err) {
    console.error('Error adding product:', err);
    alert('Error adding product: ' + err.message);
  }
}

async function renderDataTable() {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;
  const products = await loadProducts();
  tbody.innerHTML = '';
  const cols = [
    { key: 'name', editable: true },
    { key: 'price', editable: true, numeric: true },
    { key: 'category', editable: true },
    { key: 'color', editable: true },
    { key: 'discount', editable: true, numeric: true },
    { key: 'stock', editable: true, numeric: true },
    { key: 'availability', editable: true }
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
      td.textContent = p[col.key] != null ? String(p[col.key]) : '';
      if (col.editable) {
        td.contentEditable = true;
        td.addEventListener('blur', async e => {
          const val = e.target.textContent.trim();
          let updateValue = val;
          if (col.numeric) {
            if (isNaN(val) || (col.key !== 'discount' && Number(val) <= 0) || (col.key === 'discount' && Number(val) < 0)) {
              alert(`${col.key.charAt(0).toUpperCase() + col.key.slice(1)} must be a valid number.`);
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
      }
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