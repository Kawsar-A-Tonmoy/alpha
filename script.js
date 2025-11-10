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

const statusColors = {
  Pending: '#eab308',
  Processing: '#3b82f6',
  Dispatched: '#eab308',
  Delivered: '#22c55e',
  Cancelled: '#ef4444'
};

const categories = [
  { name: 'Keycaps', bg: 'k.png' },
  { name: 'Switches', bg: 's.png' },
  { name: 'Keyboard and Mouse', bg: 'k&b.png' },
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
function createMainImageShimmer() {
  const img = document.createElement('div');
  img.className = 'shimmer-image-placeholder';
  return img;
}
function createThumbnailShimmer() {
  const thumb = document.createElement('div');
  thumb.className = 'thumbnail shimmer-thumbnail';
  return thumb;
}
function createInfoLineShimmer() {
  const line = document.createElement('div');
  line.className = 'shimmer-line';
  return line;
}

// ====== PRODUCT CARD ======
function createProductCard(p, products) {
  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const isPreOrder = p.availability === 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(p.discount)) : price;
  const images = p.images || [];

  // Generate slug
  let slug = p.name.toLowerCase().replace(/\s+/g, '-');
  if (p.variants && p.variants.length > 0) {
    slug += `-${(p.variantType || 'variant').toLowerCase()}`;
  }

  const card = document.createElement('div');
  card.className = 'card product-card';
  card.innerHTML = `
    <img src="${images[0] || ''}" alt="${p.name}" onerror="this.src=''; this.alt='Image not available';">
    <div class="badges">
      ${p.category === 'new' ? `<span class="badge new">IN STOCK</span>` : ``}
      ${p.category === 'hot' ? `<span class="badge hot">HOT DEAL</span>` : ``}
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
    window.location.href = `product.html?slug=${slug}`;
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
  categories.forEach(c => categoriesSection.appendChild(createCategoryCard(c)));
  for (let i = 0; i < 4; i++) {
    interestSection.appendChild(createShimmerCard());
  }
  const products = await loadProducts();
  interestSection.innerHTML = '';
  const eligible = products.filter(p => p.availability !== 'Upcoming');
  const random4 = shuffle(eligible).slice(0, 4);
  random4.forEach(p => interestSection.appendChild(createProductCard(p, products)));
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
  for (let i = 0; i < 8; i++) {
    list.appendChild(createShimmerCard());
  }
  const products = await loadProducts();
  list.innerHTML = '';
  const filtered = category ? products.filter(p => p.category === category) : products;
  filtered.forEach(p => list.appendChild(createProductCard(p, products)));
  setupImageViewer();
}

// ====== PRODUCT PAGE WITH VARIANTS ======
let currentVariant = null;
let currentProduct = null;

async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlSlug = urlParams.get('slug');
  if (!urlSlug) {
    alert('Product not found');
    return;
  }

  // Shimmer
  const mainImg = document.getElementById('main-image');
  const thumbnailGallery = document.getElementById('thumbnail-gallery');
  const nameEl = document.getElementById('product-name');
  const colorEl = document.getElementById('product-color');
  const priceEl = document.getElementById('product-price');
  const badgesEl = document.getElementById('product-badges');
  const descEl = document.getElementById('product-desc');
  const orderRow = document.getElementById('order-row');
  const variantSelector = document.getElementById('variant-selector');
  const variantLabel = document.getElementById('variant-label');
  const variantSelect = document.getElementById('variant-select');

  mainImg.parentNode.replaceChild(createMainImageShimmer(), mainImg);
  nameEl.innerHTML = ''; nameEl.appendChild(createInfoLineShimmer()); nameEl.appendChild(createInfoLineShimmer());
  colorEl.innerHTML = ''; colorEl.appendChild(createInfoLineShimmer());
  priceEl.innerHTML = ''; priceEl.appendChild(createInfoLineShimmer());
  badgesEl.innerHTML = ''; for (let i = 0; i < 2; i++) { const b = document.createElement('div'); b.className = 'shimmer-badge'; badgesEl.appendChild(b); }
  descEl.innerHTML = ''; for (let i = 0; i < 3; i++) { const l = createInfoLineShimmer(); l.style.width = `${70 + Math.random() * 20}%`; descEl.appendChild(l); }
  orderRow.innerHTML = ''; const btnShimmer = document.createElement('div'); btnShimmer.className = 'shimmer-button'; orderRow.appendChild(btnShimmer);
  for (let i = 0; i < 3; i++) thumbnailGallery.appendChild(createThumbnailShimmer());

  const otherSection = document.getElementById('other-products');
  for (let i = 0; i < 4; i++) otherSection.appendChild(createShimmerCard());

  // Load data
  const products = await loadProducts();
  let product = null;
  for (const p of products) {
    let slug = p.name.toLowerCase().replace(/\s+/g, '-');
    if (p.variants && p.variants.length > 0) {
      slug += `-${(p.variantType || 'variant').toLowerCase()}`;
    }
    if (slug === urlSlug) {
      product = p;
      break;
    }
  }
  if (!product) {
    alert('Product not found');
    return;
  }

  currentProduct = product;
  document.title = product.name;
  document.getElementById('canonical-link').href = `/product/${urlSlug}`;

  const images = product.images || [];
  const realMainImg = document.createElement('img');
  realMainImg.id = 'main-image';
  realMainImg.src = images[0] || '';
  realMainImg.alt = product.name;
  document.querySelector('.shimmer-image-placeholder').parentNode.replaceChild(realMainImg, document.querySelector('.shimmer-image-placeholder'));

  nameEl.innerHTML = product.name;
  colorEl.innerText = `Color: ${product.color || '-'}`;
  descEl.innerText = product.description || '';

  const isUpcoming = product.availability === 'Upcoming';
  const isPreOrder = product.availability === 'Pre Order';

  // Variants
  if (product.variants && product.variants.length > 0) {
    variantLabel.textContent = `${product.variantType || 'Variant'}:`;
    variantSelect.innerHTML = '';
    product.variants.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = v.name;
      variantSelect.appendChild(opt);
    });
    variantSelector.style.display = 'block';

    variantSelect.onchange = () => {
      const selected = product.variants.find(v => v.id === variantSelect.value);
      currentVariant = selected;
      updateVariantUI(product, selected);
    };

    currentVariant = product.variants[0];
    variantSelect.value = currentVariant.id;
  } else {
    currentVariant = {
      id: 'base',
      name: 'Default',
      price: product.price,
      discount: product.discount,
      images: product.images,
      stock: product.stock
    };
    variantSelector.style.display = 'none';
  }

  updateVariantUI(product, currentVariant);

  function updateVariantUI(p, v) {
    const finalPrice = v.price - (v.discount || 0);
    realMainImg.src = v.images[0] || p.images[0] || '';
    priceEl.innerHTML = v.discount > 0
      ? `<s>৳${v.price}</s> ৳${finalPrice}`
      : `৳${finalPrice}`;

    // Update thumbnails
    thumbnailGallery.innerHTML = '';
    (v.images || p.images || []).forEach(src => {
      const thumb = document.createElement('img');
      thumb.className = 'thumbnail';
      thumb.src = src;
      thumb.onclick = () => { realMainImg.src = src; };
      thumbnailGallery.appendChild(thumb);
    });

    badgesEl.innerHTML = `
      ${p.category === 'new' ? `<span class="badge new">NEW</span>` : ''}
      ${p.category === 'hot' ? `<span class="badge hot">HOT</span>` : ''}
      ${!isUpcoming && Number(v.stock) <= 0 && p.availability !== 'Pre Order' ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
      ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
      ${isPreOrder ? `<span class="badge preorder">PRE ORDER</span>` : ''}
    `;

    const button = document.createElement('button');
    if (isUpcoming) {
      button.textContent = 'Upcoming - Stay Tuned';
      button.disabled = true;
    } else if (isPreOrder) {
      button.className = 'preorder-btn';
      button.textContent = 'Pre Order';
      button.onclick = () => openCheckoutModal(p.id, v.id, true);
    } else if (Number(v.stock) > 0) {
      button.textContent = 'Add to Cart';
      button.onclick = () => openCheckoutModal(p.id, v.id, false);
    } else {
      button.textContent = 'Out of Stock';
      button.disabled = true;
    }
    orderRow.innerHTML = '';
    orderRow.appendChild(button);
  }

  // Load other products
  const otherProducts = products.filter(p => p.id !== product.id);
  const shuffled = shuffle(otherProducts).slice(0, 4);
  otherSection.innerHTML = '';
  shuffled.forEach(p => otherSection.appendChild(createProductCard(p, products)));

  setupImageViewer();
}

function openCheckoutModal(productId, variantId, isPreOrder) {
  const modal = document.getElementById('checkout-modal');
  const form = document.getElementById('checkout-form');
  const product = currentProduct;
  const variant = currentVariant;

  document.getElementById('co-product-id').value = productId;
  document.getElementById('co-variant-id').value = variantId;
  document.getElementById('co-product-name').value = product.name;
  document.getElementById('co-variant-name').value = variant.name;
  document.getElementById('co-unit-price-raw').value = variant.price - (variant.discount || 0);
  document.getElementById('co-available-stock').value = variant.stock || product.stock;

  const updateTotal = () => {
    const qty = Number(document.getElementById('co-qty').value) || 1;
    const unit = Number(document.getElementById('co-unit-price-raw').value);
    const total = qty * unit + DELIVERY_FEE;
    const payment = document.getElementById('co-payment').value;

    document.getElementById('co-price').value = `৳${unit.toFixed(2)}`;
    document.getElementById('co-delivery').value = `৳${DELIVERY_FEE.toFixed(2)}`;
    document.getElementById('co-total').value = `৳${total.toFixed(2)}`;

    if (payment === 'Bkash') {
      document.getElementById('co-payment-number').value = BKASH_NUMBER;
      document.getElementById('co-pay-now').value = `৳${total.toFixed(2)}`;
      document.getElementById('co-due-amount').value = '৳0.00';
    } else if (payment === 'Cash on Delivery') {
      document.getElementById('co-payment-number').value = COD_NUMBER;
      document.getElementById('co-pay-now').value = '৳0.00';
      document.getElementById('co-due-amount').value = `৳${total.toFixed(2)}`;
    }
  };

  document.getElementById('co-qty').oninput = updateTotal;
  document.getElementById('co-payment').onchange = updateTotal;

  updateTotal();
  modal.classList.add('show');
}

document.getElementById('close-modal-btn')?.addEventListener('click', () => {
  document.getElementById('checkout-modal').classList.remove('show');
});

document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    productId: document.getElementById('co-product-id').value,
    variantId: document.getElementById('co-variant-id').value,
    productName: document.getElementById('co-product-name').value,
    variantName: document.getElementById('co-variant-name').value,
    unitPrice: Number(document.getElementById('co-unit-price-raw').value),
    quantity: Number(document.getElementById('co-qty').value),
    deliveryFee: DELIVERY_FEE,
    paid: document.getElementById('co-payment').value === 'Bkash' ? Number(document.getElementById('co-total').value.replace(/[^\d.]/g, '')) : 0,
    due: document.getElementById('co-payment').value === 'Cash on Delivery' ? Number(document.getElementById('co-total').value.replace(/[^\d.]/g, '')) : 0,
    customerName: document.getElementById('co-name').value,
    phone: document.getElementById('co-phone').value,
    address: document.getElementById('co-address').value,
    paymentMethod: document.getElementById('co-payment').value,
    transactionId: document.getElementById('co-txn').value.trim() || null,
    status: 'Pending',
    timeISO: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, 'orders'), data);
    alert('Order placed successfully!');
    document.getElementById('checkout-modal').classList.remove('show');
    e.target.reset();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

// ====== ADMIN: ADD PRODUCT WITH VARIANTS ======
let variantCounter = 0;
document.getElementById('add-variant-type')?.addEventListener('input', (e) => {
  const container = document.getElementById('variants-container');
  container.style.display = e.target.value.trim() ? 'block' : 'none';
  if (!e.target.value.trim()) document.getElementById('variants-list').innerHTML = '';
});

document.getElementById('add-variant-btn')?.addEventListener('click', () => {
  const list = document.getElementById('variants-list');
  const div = document.createElement('div');
  div.className = 'variant-item card';
  div.style.padding = '12px';
  div.innerHTML = `
    <div class="row">
      <div><input placeholder="Variant Name (e.g. Black)" class="variant-name" required></div>
      <div><input type="number" placeholder="Price (tk)" class="variant-price" min="0" required></div>
    </div>
    <div class="row">
      <div><input type="number" placeholder="Discount (tk)" class="variant-discount" min="0" value="0"></div>
      <div><input type="number" placeholder="Stock" class="variant-stock" min="0" value="0"></div>
    </div>
    <div><input placeholder="Image URLs (comma-separated)" class="variant-images" required></div>
    <button type="button" class="variant-remove danger" style="margin-top: 8px;">Remove</button>
  `;
  div.querySelector('.variant-remove').onclick = () => div.remove();
  list.appendChild(div);
});

document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const variantType = document.getElementById('add-variant-type').value.trim();
  const variants = [];
  if (variantType) {
    document.querySelectorAll('.variant-item').forEach(item => {
      const name = item.querySelector('.variant-name').value.trim();
      const price = Number(item.querySelector('.variant-price').value);
      const discount = Number(item.querySelector('.variant-discount').value) || 0;
      const stock = Number(item.querySelector('.variant-stock').value) || 0;
      const images = item.querySelector('.variant-images').value.split(',').map(u => u.trim()).filter(u => u);
      if (name && price > 0 && images.length > 0) {
        variants.push({ id: Date.now() + Math.random(), name, price, discount, stock, images });
      }
    });
  }

  const data = {
    name: document.getElementById('add-name').value.trim(),
    price: Number(document.getElementById('add-price').value),
    discount: Number(document.getElementById('add-discount').value) || 0,
    images: document.getElementById('add-images').value.split(',').map(u => u.trim()).filter(u => u),
    category: document.getElementById('add-category').value,
    color: document.getElementById('add-color').value.trim(),
    stock: Number(document.getElementById('add-stock').value) || 0,
    availability: document.getElementById('add-availability').value,
    description: document.getElementById('add-desc').value.trim(),
    variantType: variantType || null,
    variants: variants.length > 0 ? variants : null
  };

  try {
    await addDoc(collection(db, 'products'), data);
    e.target.reset();
    document.getElementById('variants-container').style.display = 'none';
    document.getElementById('variants-list').innerHTML = '';
    renderDataTable();
  } catch (err) {
    console.error('Add product error:', err);
    alert('Error adding product: ' + err.message);
  }
});

// ====== ADMIN: PRODUCTS TABLE ======
async function renderDataTable() {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;
  const products = await loadProducts();
  tbody.innerHTML = '';
  products.forEach(p => {
    const tr = document.createElement('tr');
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

    const cols = ['name', 'price', 'category', 'color', 'discount', 'stock', 'availability'];
    cols.forEach(col => {
      const td = document.createElement('td');
      td.contentEditable = true;
      td.textContent = p[col] != null ? String(p[col]) : '';
      td.addEventListener('blur', async (e) => {
        const val = e.target.textContent.trim();
        if (val === (p[col] != null ? String(p[col]) : '')) return;
        let updateValue = val;
        if (col === 'price' || col === 'discount' || col === 'stock') {
          updateValue = Number(val);
        }
        await updateDoc(doc(db, 'products', p.id), { [col]: updateValue });
      });
      tr.appendChild(td);
    });

    const tdStatus = document.createElement('td');
    tdStatus.textContent = computeStatus(p);
    tr.appendChild(tdStatus);

    const tdActions = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (confirm(`Delete "${p.name}"?`)) {
        await deleteDoc(doc(db, 'products', p.id));
        renderDataTable();
      }
    });
    tdActions.appendChild(del);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);

    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 10;
    detailsCell.className = 'details-content';
    detailsCell.innerHTML = `<strong>Description:</strong> <div contenteditable="true">${p.description || ''}</div><br>`;
    const descDiv = detailsCell.querySelector('div');
    descDiv.addEventListener('blur', async () => {
      await updateDoc(doc(db, 'products', p.id), { description: descDiv.textContent.trim() });
    });
    detailsRow.appendChild(detailsCell);
    tbody.appendChild(detailsRow);
  });
}

function computeStatus(p) {
  if (p.availability === 'Upcoming') return 'Upcoming';
  if (p.availability === 'Pre Order') return 'Pre Order';
  return Number(p.stock) > 0 ? 'In Stock' : 'Out of Stock';
}

// ====== ADMIN: ORDERS TABLE ======
async function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  const orders = await loadOrders();
  tbody.innerHTML = '';
  orders.forEach(o => {
    const tr = document.createElement('tr');
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

    const tds = [
      new Date(o.timeISO).toLocaleString(),
      o.productName,
      o.variantName || '-',
      o.quantity,
      '৳' + Number(o.deliveryFee).toFixed(2),
      '৳' + Number(o.paid).toFixed(2),
      '৳' + Number(o.due).toFixed(2),
      o.customerName,
      o.phone,
      o.address,
      o.paymentMethod,
      o.transactionId || '-'
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
    select.addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      await updateDoc(doc(db, 'orders', o.id), { status: newStatus });
      select.style.backgroundColor = statusColors[newStatus];
    });
    tdStatus.appendChild(select);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);

    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 14;
    detailsCell.className = 'details-content';
    detailsCell.innerHTML = `<strong>Unit Price:</strong> ৳${Number(o.unitPrice).toFixed(2)}`;
    detailsRow.appendChild(detailsCell);
    tbody.appendChild(detailsRow);
  });
}

// ====== ADMIN TABS ======
document.getElementById('tab-products')?.addEventListener('click', () => {
  document.getElementById('tab-products').classList.add('active');
  document.getElementById('tab-orders').classList.remove('active');
  document.getElementById('section-products').style.display = 'block';
  document.getElementById('section-orders').style.display = 'none';
  renderDataTable();
});
document.getElementById('tab-orders')?.addEventListener('click', () => {
  document.getElementById('tab-orders').classList.add('active');
  document.getElementById('tab-products').classList.remove('active');
  document.getElementById('section-orders').style.display = 'block';
  document.getElementById('section-products').style.display = 'none';
  renderOrdersTable();
});

// ====== IMAGE VIEWER ======
function setupImageViewer() {
  const viewer = document.getElementById('image-viewer');
  const img = document.getElementById('viewer-img');
  const close = document.getElementById('close-viewer');
  document.querySelectorAll('#main-image, .thumbnail').forEach(el => {
    el.onclick = () => {
      img.src = el.src;
      viewer.classList.add('show');
    };
  });
  close.onclick = () => viewer.classList.remove('show');
  viewer.onclick = (e) => { if (e.target === viewer) viewer.classList.remove('show'); };
}

// ====== AUTH & INIT ======
function logoutAdmin() {
  signOut(auth);
}

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

  if (isAdmin) {
    onAuthStateChanged(auth, async (user) => {
      document.getElementById('login-panel').style.display = user ? 'none' : 'block';
      document.getElementById('admin-panel').style.display = user ? 'block' : 'none';
      if (user) {
        renderDataTable();
        renderOrdersTable();
      }
    });

    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value;
      const pass = document.getElementById('admin-pass').value;
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (err) {
        alert('Login failed: ' + err.message);
      }
    });
  }
});

// Status page
function setupStatusForm() {
  const form = document.getElementById('status-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txn = document.getElementById('txn-id').value.trim();
    if (!txn) return;
    const q = query(collection(db, 'orders'), where('transactionId', '==', txn));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      alert('Order not found.');
      return;
    }
    const order = snapshot.docs[0].data();
    alert(`Status: ${order.status}\n${statusExplanations[order.status] || ''}`);
  });
}