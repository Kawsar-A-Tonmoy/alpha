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
  { name: 'Keyboard and Mouse', bg: 'k&b.png' },
  { name: 'Accessories and Collectables', bg: 'c&a.png' }
];

// ==================== CART SYSTEM ====================
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(product, qty = 1) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    const newQty = existing.quantity + qty;
    if (product.availability === 'Ready' && newQty > product.stock) {
      alert('Not enough stock');
      return;
    }
    existing.quantity = newQty;
  } else {
    if (product.availability === 'Ready' && qty > product.stock) {
      alert('Not enough stock');
      return;
    }
    cart.push({ ...product, quantity: qty });
  }
  saveCart();
  updateCartCount();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  updateCartCount();
  renderCart();
}

function updateCartQty(id, newQty) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  if (newQty < 1) newQty = 1;
  if (item.availability === 'Ready' && newQty > item.stock) {
    alert('Not enough stock');
    return;
  }
  item.quantity = newQty;
  saveCart();
  updateCartCount();
  renderCart();
}

function updateCartCount() {
  const el = document.getElementById('cart-count');
  if (el) {
    const total = cart.reduce((sum, i) => sum + i.quantity, 0);
    el.textContent = `(${total})`;
  }
}

function openCart() {
  document.getElementById('cart-sidebar')?.classList.add('open');
  renderCart();
}

function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
}

function renderCart() {
  const itemsEl = document.getElementById('cart-items');
  const totalsEl = document.getElementById('cart-totals');
  const checkoutBtn = document.getElementById('cart-checkout');
  if (!itemsEl || !totalsEl || !checkoutBtn) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p style="text-align:center; color:#666;">Cart is empty</p>';
    totalsEl.innerHTML = '';
    checkoutBtn.disabled = true;
    return;
  }

  checkoutBtn.disabled = false;
  itemsEl.innerHTML = '';
  let subtotal = 0;

  cart.forEach(item => {
    const finalPrice = Number(item.price) - Number(item.discount || 0);
    const lineTotal = finalPrice * item.quantity;
    subtotal += lineTotal;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.images[0] || ''}" alt="${item.name}">
      <div class="cart-item-info">
        <h3>${item.name}</h3>
        <div class="muted">${item.color || ''}</div>
        <div class="price">৳${finalPrice.toFixed(2)} × ${item.quantity} = ৳${lineTotal.toFixed(2)}</div>
        <div class="cart-item-qty">
          <button>-</button>
          <span>${item.quantity}</span>
          <button>+</button>
          <button>Remove</button>
        </div>
      </div>
    `;
    div.querySelectorAll('.cart-item-qty button')[0].onclick = () => updateCartQty(item.id, item.quantity - 1);
    div.querySelectorAll('.cart-item-qty button')[1].onclick = () => updateCartQty(item.id, item.quantity + 1);
    div.querySelectorAll('.cart-item-qty button')[3].onclick = () => removeFromCart(item.id);
    itemsEl.appendChild(div);
  });

  const delivery = Number(DELIVERY_FEE);
  const total = subtotal + delivery;
  totalsEl.innerHTML = `
    <div>Subtotal: ৳${subtotal.toFixed(2)}</div>
    <div>Delivery: ৳${delivery.toFixed(2)}</div>
    <div style="font-size:1.2rem; margin-top:8px;">Total: ৳${total.toFixed(2)}</div>
  `;
}

// ==================== PRODUCT CARD WITH HORIZONTAL BUTTONS ====================
function createProductCard(p, products) {
  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? price - Number(p.discount) : price;
  const images = p.images || [];

  const isInStock = Number(p.stock) > 0 && p.availability === 'Ready';

  const sameName = products.filter(other => other.name.toLowerCase() === p.name.toLowerCase());
  let slug = p.name.toLowerCase().replace(/\s+/g, '-');
  if (sameName.length > 1 && p.color) slug += '-' + p.color.toLowerCase().replace(/\s+/g, '-');

  const card = document.createElement('div');
  card.className = 'card product-card';
  card.innerHTML = `
    <img src="${images[0] || ''}" alt="${p.name}" onerror="this.src=''; this.alt='Image not available';">
    <div class="badges">
      ${p.hotDeal ? `<span class="badge hot">HOT DEAL</span>` : ''}
      ${isInStock ? `<span class="badge new">IN STOCK</span>` : ''}
      ${isOOS ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
      ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
      ${p.availability === 'Pre Order' ? `<span class="badge preorder">PRE ORDER</span>` : ''}
    </div>
    <h3>${p.name}</h3>
    <div class="muted">Color: ${p.color || '-'}</div>
    <div class="price">
      ${isUpcoming ? `TBA` : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ''}৳${finalPrice.toFixed(2)}`}
    </div>
  `;

  // Horizontal button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.justifyContent = 'space-between';
  buttonContainer.style.gap = '8px';
  buttonContainer.style.marginTop = '12px';

  const viewBtn = document.createElement('button');
  viewBtn.className = 'view-details-btn';
  viewBtn.textContent = 'View Details';
  viewBtn.style.flex = '1';
  viewBtn.onclick = () => location.href = `product.html?slug=${slug}`;
  buttonContainer.appendChild(viewBtn);

  if (!isUpcoming && !isOOS) {
    const addBtn = document.createElement('button');
    addBtn.className = 'secondary';
    addBtn.textContent = 'Add to Cart';
    addBtn.style.flex = '1';
    addBtn.onclick = (e) => {
      e.stopPropagation();
      addToCart(p, 1);
    };
    buttonContainer.appendChild(addBtn);
  }

  card.appendChild(buttonContainer);
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
async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlSlug = urlParams.get('slug');
  if (!urlSlug) {
    alert('Product not found');
    return;
  }

  // Shimmer placeholders
  const mainImg = document.getElementById('main-image');
  const thumbnailGallery = document.getElementById('thumbnail-gallery');
  const nameEl = document.getElementById('product-name');
  const colorEl = document.getElementById('product-color');
  const priceEl = document.getElementById('product-price');
  const badgesEl = document.getElementById('product-badges');
  const specEl = document.getElementById('product-spec');
  const descEl = document.getElementById('product-detailed-desc');
  const orderRow = document.getElementById('order-row');

  mainImg.parentNode.replaceChild(createMainImageShimmer(), mainImg);
  nameEl.innerHTML = ''; nameEl.appendChild(createInfoLineShimmer()); nameEl.appendChild(createInfoLineShimmer());
  colorEl.innerHTML = ''; colorEl.appendChild(createInfoLineShimmer());
  priceEl.innerHTML = ''; priceEl.appendChild(createInfoLineShimmer());
  badgesEl.innerHTML = ''; for (let i = 0; i < 2; i++) { badgesEl.appendChild(document.createElement('div')).className = 'shimmer-badge'; }
  specEl.innerHTML = ''; for (let i = 0; i < 3; i++) specEl.appendChild(createInfoLineShimmer());
  descEl.innerHTML = ''; for (let i = 0; i < 5; i++) descEl.appendChild(createInfoLineShimmer());
  orderRow.innerHTML = ''; orderRow.appendChild(createInfoLineShimmer());
  thumbnailGallery.innerHTML = ''; for (let i = 0; i < 3; i++) thumbnailGallery.appendChild(createThumbnailShimmer());

  const products = await loadProducts();
  let product = products.find(p => {
    let slug = p.name.toLowerCase().replace(/\s+/g, '-');
    const sameName = products.filter(other => other.name.toLowerCase() === p.name.toLowerCase());
    if (sameName.length > 1 && p.color) slug += '-' + p.color.toLowerCase().replace(/\s+/g, '-');
    return slug === urlSlug;
  });

  if (!product) {
    alert('Product not found');
    return;
  }

  // Fill real data
  const newMainImg = document.createElement('img');
  newMainImg.id = 'main-image';
  newMainImg.src = product.images[0] || '';
  newMainImg.alt = product.name;
  document.querySelector('.product-images').replaceChild(newMainImg, document.querySelector('.shimmer-image-placeholder'));

  nameEl.textContent = product.name;
  colorEl.textContent = product.color ? `Color: ${product.color}` : '';
  const hasDiscount = Number(product.discount) > 0;
  const price = Number(product.price) || 0;
  const finalPrice = hasDiscount ? price - Number(product.discount) : price;
  priceEl.innerHTML = hasDiscount ? `<s>৳${price.toFixed(2)}</s> ৳${finalPrice.toFixed(2)}` : `৳${finalPrice.toFixed(2)}`;

  badgesEl.innerHTML = '';
  const isUpcoming = product.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(product.stock) <= 0 && product.availability !== 'Pre Order';
  const isPreOrder = product.availability === 'Pre Order';
  const isInStock = Number(product.stock) > 0 && product.availability === 'Ready';
  badgesEl.innerHTML = `
    ${product.hotDeal ? `<span class="badge hot">HOT DEAL</span>` : ''}
    ${isInStock ? `<span class="badge new">IN STOCK</span>` : ''}
    ${isOOS ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
    ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
    ${isPreOrder ? `<span class="badge preorder">PRE ORDER</span>` : ''}
  `;

  specEl.textContent = product.description || '';
  descEl.innerHTML = product.detailedDescription || '';

  document.title = product.metaTitle || `${product.name} - The Geek Shop`;
  document.getElementById('meta-description').content = product.metaDescription || '';
  document.getElementById('canonical-link').href = window.location.href;

  // Thumbnails
  thumbnailGallery.innerHTML = '';
  (product.images || []).forEach(imgSrc => {
    const thumb = document.createElement('img');
    thumb.className = 'thumbnail';
    thumb.src = imgSrc;
    thumb.onclick = () => newMainImg.src = imgSrc;
    thumbnailGallery.appendChild(thumb);
  });

  // Order row: Quantity + Add to Cart + Buy Now
  orderRow.innerHTML = '';
  if (!isUpcoming && !isOOS) {
    const qtyWrapper = document.createElement('div');
    qtyWrapper.style.marginBottom = '12px';
    qtyWrapper.innerHTML = `
      <label style="display:block; margin-bottom:4px;">Quantity</label>
      <input class="qty" type="number" min="1" value="1" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:8px;" ${isPreOrder ? '' : `max="${product.stock}"`}>
    `;
    const qtyInput = qtyWrapper.querySelector('.qty');
    qtyInput.addEventListener('input', () => {
      let val = parseInt(qtyInput.value) || 1;
      if (val < 1) val = 1;
      if (!isPreOrder && val > product.stock) val = product.stock;
      qtyInput.value = val;
    });
    orderRow.appendChild(qtyWrapper);

    const btnWrapper = document.createElement('div');
    btnWrapper.style.display = 'flex';
    btnWrapper.style.gap = '10px';

    const addBtn = document.createElement('button');
    addBtn.className = 'secondary';
    addBtn.textContent = 'Add to Cart';
    addBtn.style.flex = '1';
    addBtn.onclick = () => addToCart(product, parseInt(qtyInput.value));
    btnWrapper.appendChild(addBtn);

    const buyBtn = document.createElement('button');
    buyBtn.textContent = isPreOrder ? 'Pre Order' : 'Buy Now';
    buyBtn.className = isPreOrder ? 'preorder-btn' : '';
    buyBtn.style.flex = '1';
    buyBtn.onclick = () => showCheckoutModal(false, product);
    btnWrapper.appendChild(buyBtn);

    orderRow.appendChild(btnWrapper);
  } else {
    orderRow.innerHTML = `<div class="muted">${isUpcoming ? 'Upcoming - Stay tuned' : 'Out of Stock'}</div>`;
  }

  setupImageViewer();

  const otherSection = document.getElementById('other-products');
  otherSection.innerHTML = '';
  const others = shuffle(products.filter(o => o.id !== product.id && o.availability !== 'Upcoming')).slice(0, 4);
  others.forEach(o => otherSection.appendChild(createProductCard(o, products)));
}

// ====== IMAGE VIEWER ======
function setupImageViewer() {
  const viewer = document.getElementById('image-viewer');
  const viewerImg = document.getElementById('viewer-img');
  const closeViewer = document.getElementById('close-viewer');
  if (!viewer || !closeViewer) return;
  closeViewer.onclick = () => viewer.classList.remove('show');
  viewer.onclick = (e) => { if (e.target === viewer) viewer.classList.remove('show'); };
  document.querySelectorAll('#main-image, .thumbnail').forEach(img => {
    img.onclick = () => {
      viewerImg.src = img.src;
      viewer.classList.add('show');
    };
  });
}

// ==================== CHECKOUT LOGIC ====================
let isMultiCheckout = false;
let currentSingleProduct = null;

function showCheckoutModal(multi = false, product = null) {
  isMultiCheckout = multi;
  currentSingleProduct = product;
  const modal = document.getElementById('checkout-modal');
  modal.classList.add('show');

  const singleRows = document.querySelectorAll('.single-only');
  const multiList = document.getElementById('co-items-list');
  const note = document.getElementById('co-note');

  document.getElementById('checkout-form').reset();
  document.getElementById('co-policy').checked = false;
  note.textContent = '';

  if (multi) {
    singleRows.forEach(r => r.style.display = 'none');
    multiList.style.display = 'block';
    multiList.innerHTML = '';
    let subtotal = 0;
    let hasPre = false;
    cart.forEach(item => {
      const fp = Number(item.price) - Number(item.discount || 0);
      const tot = fp * item.quantity;
      subtotal += tot;
      if (item.availability === 'Pre Order') hasPre = true;
      multiList.innerHTML += `
        <div class="co-item">
          <h4>${item.name}</h4>
          <div class="muted">Color: ${item.color || '-'}</div>
          <div>Qty: ${item.quantity} × ৳${fp.toFixed(2)} = ৳${tot.toFixed(2)}</div>
        </div>
      `;
    });
    const total = subtotal + Number(DELIVERY_FEE);
    document.getElementById('co-delivery').value = DELIVERY_FEE;
    document.getElementById('co-total').value = total.toFixed(2);
    if (hasPre) note.textContent = 'Pre-order items require 200tk advance per unit on COD.';
  } else {
    singleRows.forEach(r => r.style.display = 'grid');
    multiList.style.display = 'none';
    const fp = Number(product.price) - Number(product.discount || 0);
    document.getElementById('co-product-id').value = product.id;
    document.getElementById('co-product-name').value = product.name;
    document.getElementById('co-color').value = product.color || '-';
    document.getElementById('co-unit-price-raw').value = fp;
    document.getElementById('co-available-stock').value = product.stock;
    document.getElementById('co-qty').value = 1;
    document.getElementById('co-price').value = fp.toFixed(2);
    document.getElementById('co-delivery').value = DELIVERY_FEE;
    document.getElementById('co-total').value = (fp + Number(DELIVERY_FEE)).toFixed(2);
    if (product.availability === 'Pre Order') note.textContent = 'Pre-order requires 200tk advance per unit on COD.';
  }
}

function setupCheckout() {
  const form = document.getElementById('checkout-form');
  const payment = document.getElementById('co-payment');
  const qty = document.getElementById('co-qty');
  const close = document.getElementById('close-modal-btn');

  close.onclick = () => document.getElementById('checkout-modal').classList.remove('show');

  payment.onchange = () => {
    const method = payment.value;
    document.getElementById('co-payment-number').value = method === 'Bkash' ? BKASH_NUMBER : COD_NUMBER;

    let total = parseFloat(document.getElementById('co-total').value);
    let payNow = 0;
    let hasPre = false;

    if (isMultiCheckout) {
      hasPre = cart.some(i => i.availability === 'Pre Order');
      if (method === 'Cash on Delivery' && hasPre) {
        payNow = cart.reduce((s, i) => s + (i.availability === 'Pre Order' ? 200 * i.quantity : 0), 0);
      } else if (method === 'Bkash') payNow = total;
    } else {
      hasPre = currentSingleProduct.availability === 'Pre Order';
      const q = parseInt(qty.value) || 1;
      if (method === 'Cash on Delivery' && hasPre) payNow = 200 * q;
      else if (method === 'Bkash') payNow = total;
    }

    document.getElementById('co-pay-now').value = payNow.toFixed(2);
    document.getElementById('co-due-amount').value = (total - payNow).toFixed(2);
    document.getElementById('co-txn').required = payNow > 0;
  };

  qty.oninput = () => {
    if (isMultiCheckout) return;
    let q = parseInt(qty.value) || 1;
    if (q < 1) q = 1;
    const stock = parseInt(document.getElementById('co-available-stock').value);
    if (currentSingleProduct.availability === 'Ready' && q > stock) q = stock;
    qty.value = q;

    const unit = parseFloat(document.getElementById('co-unit-price-raw').value);
    const subtotal = unit * q;
    const total = subtotal + Number(DELIVERY_FEE);
    document.getElementById('co-price').value = subtotal.toFixed(2);
    document.getElementById('co-total').value = total.toFixed(2);
    payment.dispatchEvent(new Event('change'));
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!document.getElementById('co-policy').checked) return alert('Please agree to the order policy');

    const payNow = parseFloat(document.getElementById('co-pay-now').value);
    if (payNow > 0 && !document.getElementById('co-txn').value.trim()) return alert('Transaction ID is required for advance payment');

    const data = {
      timeISO: new Date().toISOString(),
      customerName: document.getElementById('co-name').value.trim(),
      phone: document.getElementById('co-phone').value.trim(),
      address: document.getElementById('co-address').value.trim(),
      paymentMethod: document.getElementById('co-payment').value,
      transactionId: document.getElementById('co-txn').value.trim(),
      deliveryFee: Number(DELIVERY_FEE),
      paid: payNow,
      due: parseFloat(document.getElementById('co-due-amount').value),
      total: parseFloat(document.getElementById('co-total').value),
      status: 'Pending',
      items: isMultiCheckout ? cart.map(i => ({
        productId: i.id,
        name: i.name,
        color: i.color || '',
        quantity: i.quantity,
        unitPrice: Number(i.price) - Number(i.discount || 0),
        availability: i.availability
      })) : [{
        productId: currentSingleProduct.id,
        name: currentSingleProduct.name,
        color: currentSingleProduct.color || '',
        quantity: parseInt(qty.value),
        unitPrice: parseFloat(document.getElementById('co-unit-price-raw').value),
        availability: currentSingleProduct.availability
      }]
    };

    try {
      await runTransaction(db, async (t) => {
        for (const item of data.items) {
          if (item.availability === 'Ready') {
            const ref = doc(db, 'products', item.productId);
            const snap = await t.get(ref);
            const currentStock = snap.data().stock || 0;
            if (currentStock < item.quantity) throw new Error('Insufficient stock');
            t.update(ref, { stock: currentStock - item.quantity });
          }
        }
      });

      await addDoc(collection(db, 'orders'), data);
      alert('Order placed successfully!');
      if (isMultiCheckout) {
        cart = [];
        saveCart();
        updateCartCount();
      }
      document.getElementById('checkout-modal').classList.remove('show');
    } catch (err) {
      alert('Error placing order: ' + (err.message || err));
    }
  };
}

// ====== ADMIN SECTION (unchanged from your original) ======
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

    const nameCell = document.createElement('td');
    nameCell.contentEditable = true;
    nameCell.textContent = p.name;
    nameCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === p.name) return;
      await updateProductField(p.id, 'name', val);
    });
    tr.appendChild(nameCell);

    const priceCell = document.createElement('td');
    priceCell.contentEditable = true;
    priceCell.textContent = p.price;
    priceCell.addEventListener('blur', async (e) => {
      const val = Number(e.target.textContent.trim());
      if (isNaN(val) || val === Number(p.price)) return;
      await updateProductField(p.id, 'price', val);
    });
    tr.appendChild(priceCell);

    const categoryCell = document.createElement('td');
    categoryCell.contentEditable = true;
    categoryCell.textContent = p.category;
    categoryCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === p.category) return;
      await updateProductField(p.id, 'category', val);
    });
    tr.appendChild(categoryCell);

    const colorCell = document.createElement('td');
    colorCell.contentEditable = true;
    colorCell.textContent = p.color || '';
    colorCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.color || '')) return;
      await updateProductField(p.id, 'color', val);
    });
    tr.appendChild(colorCell);

    const discountCell = document.createElement('td');
    discountCell.contentEditable = true;
    discountCell.textContent = p.discount || '0';
    discountCell.addEventListener('blur', async (e) => {
      const val = Number(e.target.textContent.trim());
      if (isNaN(val) || val === Number(p.discount || 0)) return;
      await updateProductField(p.id, 'discount', val);
    });
    tr.appendChild(discountCell);

    const stockCell = document.createElement('td');
    stockCell.contentEditable = true;
    stockCell.textContent = p.stock || '0';
    stockCell.addEventListener('blur', async (e) => {
      const val = Number(e.target.textContent.trim());
      if (isNaN(val) || val === Number(p.stock || 0)) return;
      await updateProductField(p.id, 'stock', val);
    });
    tr.appendChild(stockCell);

    const availabilityCell = document.createElement('td');
    const availSelect = document.createElement('select');
    ['Ready', 'Pre Order', 'Upcoming'].forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.text = opt;
      if (p.availability === opt) option.selected = true;
      availSelect.appendChild(option);
    });
    availSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      await updateProductField(p.id, 'availability', val);
    });
    availabilityCell.appendChild(availSelect);
    tr.appendChild(availabilityCell);

    const hotDealCell = document.createElement('td');
    const hotCheckbox = document.createElement('input');
    hotCheckbox.type = 'checkbox';
    hotCheckbox.checked = !!p.hotDeal;
    hotCheckbox.addEventListener('change', async (e) => {
      await updateProductField(p.id, 'hotDeal', e.target.checked);
    });
    hotDealCell.appendChild(hotCheckbox);
    tr.appendChild(hotDealCell);

    const statusCell = document.createElement('td');
    statusCell.textContent = computeStatus(p);
    tr.appendChild(statusCell);

    const actionsCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      if (confirm('Delete product?')) deleteProductById(p.id);
    };
    actionsCell.appendChild(deleteBtn);
    tr.appendChild(actionsCell);
    tbody.appendChild(tr);

    // Details row
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 11;
    detailsCell.className = 'details-content';

    const imagesCell = document.createElement('div');
    imagesCell.contentEditable = true;
    imagesCell.textContent = (p.images || []).join(',');
    imagesCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim().split(',').map(s => s.trim()).filter(Boolean);
      if (JSON.stringify(val) === JSON.stringify(p.images || [])) return;
      await updateProductField(p.id, 'images', val);
    });

    const specCell = document.createElement('div');
    specCell.contentEditable = true;
    specCell.textContent = p.description != null ? p.description : '';
    specCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.description != null ? String(p.description) : '')) return;
      await updateProductField(p.id, 'description', val);
    });

    const detailedDescCell = document.createElement('div');
    detailedDescCell.contentEditable = true;
    detailedDescCell.textContent = p.detailedDescription != null ? p.detailedDescription : '';
    detailedDescCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.detailedDescription != null ? String(p.detailedDescription) : '')) return;
      await updateProductField(p.id, 'detailedDescription', val);
    });

    const metaTitleCell = document.createElement('div');
    metaTitleCell.contentEditable = true;
    metaTitleCell.textContent = p.metaTitle != null ? p.metaTitle : '';
    metaTitleCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.metaTitle != null ? String(p.metaTitle) : '')) return;
      await updateProductField(p.id, 'metaTitle', val);
    });

    const metaDescCell = document.createElement('div');
    metaDescCell.contentEditable = true;
    metaDescCell.textContent = p.metaDescription != null ? p.metaDescription : '';
    metaDescCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.metaDescription != null ? String(p.metaDescription) : '')) return;
      await updateProductField(p.id, 'metaDescription', val);
    });

    detailsCell.innerHTML = `<strong>Image URLs (comma-separated):</strong> `;
    detailsCell.appendChild(imagesCell);
    detailsCell.innerHTML += `<br><strong>Specification:</strong> `;
    detailsCell.appendChild(specCell);
    detailsCell.innerHTML += `<br><strong>Description:</strong> `;
    detailsCell.appendChild(detailedDescCell);
    detailsCell.innerHTML += `<br><strong>Meta Title:</strong> `;
    detailsCell.appendChild(metaTitleCell);
    detailsCell.innerHTML += `<br><strong>Meta Description:</strong> `;
    detailsCell.appendChild(metaDescCell);
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

    const isMulti = Array.isArray(o.items);
    const productCell = isMulti ? o.items.map(i => i.name).join('<br>') : o.productName;
    const colorCell = isMulti ? o.items.map(i => i.color || '-').join('<br>') : o.color || '-';
    const qtyCell = isMulti ? o.items.map(i => i.quantity).join('<br>') : o.quantity;

    const tds = [
      new Date(o.timeISO).toLocaleString(),
      productCell,
      colorCell,
      qtyCell,
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
      td.innerHTML = v;
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
    if (isMulti) {
      unitPriceCell.innerHTML = o.items.map(i => `${i.name}: ৳${Number(i.unitPrice).toFixed(2)}`).join('<br>');
    } else {
      unitPriceCell.textContent = `Unit Price: ৳${Number(o.unitPrice).toFixed(2)}`;
    }
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

// ====== ORDER STATUS PAGE ======
function setupStatusForm() {
  const form = document.getElementById('status-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const txn = document.getElementById('txn-id').value.trim();
    if (!txn) return;
    try {
      const q = query(collection(db, 'orders'), where('transactionId', '==', txn));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert('Order not found.');
        return;
      }
      const order = snapshot.docs[0].data();
      const status = order.status;
      alert(`Status: ${status}\n${statusExplanations[status] || 'Unknown status.'}`);
    } catch (err) {
      console.error('Error fetching status:', err);
      alert('Error fetching status: ' + err.message);
    }
  });
}

// ====== ADMIN: ADD PRODUCT ======
async function addProduct(e) {
  e.preventDefault();
  const name = document.getElementById('add-name').value.trim();
  const price = Number(document.getElementById('add-price').value.trim());
  const discount = Number(document.getElementById('add-discount').value.trim());
  const images = document.getElementById('add-images').value.trim().split(',').map(s => s.trim()).filter(Boolean);
  const category = document.getElementById('add-category').value;
  const color = document.getElementById('add-color').value.trim();
  const stock = Number(document.getElementById('add-stock').value.trim());
  const availability = document.getElementById('add-availability').value;
  const hotDeal = document.getElementById('add-hotdeal').checked;
  const description = document.getElementById('add-desc').value.trim();
  const detailedDescription = document.getElementById('add-detailed-desc').value.trim();
  const metaTitle = document.getElementById('add-meta-title').value.trim();
  const metaDescription = document.getElementById('add-meta-desc').value.trim();

  if (!name || isNaN(price) || images.length === 0) {
    alert('Invalid input');
    return;
  }

  try {
    await addDoc(collection(db, 'products'), {
      name,
      price,
      discount,
      images,
      category,
      color: color || null,
      stock,
      availability,
      hotDeal,
      description: description || null,
      detailedDescription: detailedDescription || null,
      metaTitle: metaTitle || null,
      metaDescription: metaDescription || null
    });
    alert('Product added');
    document.getElementById('add-product-form').reset();
    renderDataTable();
  } catch (err) {
    console.error('Error adding product:', err);
    alert('Error adding product: ' + err.message);
  }
}

// ====== DOM LOADED ======
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

  // Admin setup (unchanged)
  const loginPanel = document.getElementById('login-panel');
  const adminPanel = document.getElementById('admin-panel');
  const addForm = document.getElementById('add-product-form');
  if (addForm) addForm.addEventListener('submit', addProduct);

  if (loginPanel && adminPanel) {
    onAuthStateChanged(auth, async (user) => {
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
      loginForm.addEventListener('submit', async (e) => {
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
  }

  // Cart UI bindings
  updateCartCount();
  document.getElementById('cart-btn')?.addEventListener('click', openCart);
  document.getElementById('close-cart')?.addEventListener('click', closeCart);
  document.getElementById('cart-checkout')?.addEventListener('click', () => {
    closeCart();
    showCheckoutModal(true);
  });
  if (document.getElementById('checkout-form')) setupCheckout();
});
