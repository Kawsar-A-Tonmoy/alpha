import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, orderBy, query, where, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
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

const categories = [
  { name: 'Keycaps', bg: 'k.png' },
  { name: 'Switches', bg: 's.png' },
  { name: 'Keyboard and Mouse', bg: 'k&b.png' },
  { name: 'Accessories and Collectables', bg: 'c&a.png' }
];

// ====== CART MANAGEMENT ======
let cart = JSON.parse(localStorage.getItem('geekshop_cart') || '[]');

function saveCart() {
  localStorage.setItem('geekshop_cart', JSON.stringify(cart));
  updateCartUI();
}

function addToCart(product, qty = 1) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ ...product, qty });
  }
  saveCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
}

function updateCartQuantity(id, qty) {
  qty = parseInt(qty);
  if (qty <= 0) {
    removeFromCart(id);
    return;
  }
  const item = cart.find(i => i.id === id);
  if (item) item.qty = qty;
  saveCart();
}

function updateCartUI() {
  document.querySelectorAll('#cart-count').forEach(el => {
    el.textContent = cart.reduce((sum, i) => sum + i.qty, 0);
  });

  document.querySelectorAll('#cart-total').forEach(el => {
    const total = cart.reduce((sum, i) => sum + (i.finalPrice || 0) * i.qty, 0);
    el.textContent = total.toFixed(2);
  });

  const itemsContainer = document.getElementById('cart-items');
  if (itemsContainer) {
    if (cart.length === 0) {
      itemsContainer.innerHTML = '<p style="text-align:center;color:#6b7280;padding:40px 20px;">Your cart is empty</p>';
      return;
    }
    itemsContainer.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.images?.[0] || ''}" alt="${item.name}">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <div class="muted">Color: ${item.color || '-'}</div>
          <div class="price">৳${(item.finalPrice || 0).toFixed(2)} × ${item.qty}</div>
        </div>
        <div class="cart-item-controls">
          <button onclick="updateCartQuantity('${item.id}', ${item.qty - 1})">-</button>
          <input type="number" min="1" value="${item.qty}" onchange="updateCartQuantity('${item.id}', this.value)" style="width:50px;">
          <button onclick="updateCartQuantity('${item.id}', ${item.qty + 1})">+</button><br>
          <button style="background:#dc2626;color:white;padding:4px 8px;border-radius:4px;font-size:12px;margin-top:4px;" onclick="removeFromCart('${item.id}')">Remove</button>
        </div>
      </div>
    `).join('');
  }
}

// Make global
window.updateCartQuantity = updateCartQuantity;
window.removeFromCart = removeFromCart;

// ====== SINGLE PRODUCT QUICK CHECKOUT ======
function setupSingleCheckout(product) {
  const modal = document.getElementById('checkout-modal');
  const form = document.getElementById('checkout-form');
  const closeBtn = document.getElementById('close-modal-btn');
  const qtyInput = document.getElementById('quick-qty') || document.getElementById('co-qty');
  const stockWarning = document.getElementById('stock-warning');
  const priceEl = document.getElementById('co-price');
  const totalEl = document.getElementById('co-total');
  const unitPriceHidden = document.getElementById('co-unit-price-raw');
  const stockHidden = document.getElementById('co-available-stock');

  // Populate form
  document.getElementById('co-product-id').value = product.id;
  document.getElementById('co-product-name').value = product.name;
  document.getElementById('co-color').value = product.color || '-';
  document.getElementById('co-price').value = `৳${product.finalPrice?.toFixed(2) || 0}`;
  unitPriceHidden.value = product.finalPrice || 0;
  stockHidden.value = product.stock || 0;
  document.getElementById('co-qty').value = 1;

  function updateTotal() {
    const qty = parseInt(qtyInput.value) || 1;
    const unitPrice = parseFloat(unitPriceHidden.value);
    const delivery = 60;
    const total = (unitPrice * qty) + delivery;
    totalEl.value = total.toFixed(2);

    // Stock check
    const stock = parseInt(stockHidden.value);
    if (qty > stock && product.availability === 'Ready') {
      stockWarning.textContent = `Only ${stock} in stock`;
      stockWarning.style.display = 'block';
      document.getElementById('quick-buy-btn') && (document.getElementById('quick-buy-btn').disabled = true);
    } else {
      stockWarning.style.display = 'none';
      document.getElementById('quick-buy-btn') && (document.getElementById('quick-buy-btn').disabled = false);
    }
  }

  qtyInput.addEventListener('input', updateTotal);
  updateTotal();

  // Payment logic
  const paymentSelect = document.getElementById('co-payment');
  const payNow = document.getElementById('co-pay-now');
  const due = document.getElementById('co-due-amount');
  const payNum = document.getElementById('co-payment-number');

  paymentSelect.onchange = function() {
    const total = parseFloat(totalEl.value);
    if (this.value === 'Bkash') {
      payNow.value = total.toFixed(2);
      due.value = '0.00';
      payNum.value = BKASH_NUMBER || '01700000000';
    } else if (this.value === 'Cash on Delivery') {
      payNow.value = '0.00';
      due.value = total.toFixed(2);
      payNum.value = COD_NUMBER || '01960902526';
    } else {
      payNow.value = '';
      due.value = '';
      payNum.value = '';
    }
  };

  // Form submit
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!document.getElementById('co-policy').checked) {
      alert('Please agree to the order policy');
      return;
    }

    const qty = parseInt(document.getElementById('co-qty').value);
    try {
      await runTransaction(db, async (transaction) => {
        const prodRef = doc(db, 'products', product.id);
        const prodSnap = await transaction.get(prodRef);
        const data = prodSnap.data();
        if (data.availability !== 'Ready' || Number(data.stock) < qty) {
          throw `Not enough stock. Only ${data.stock} available.`;
        }
        transaction.update(prodRef, { stock: Number(data.stock) - qty });

        const orderData = {
          items: [{
            productId: product.id,
            name: product.name,
            color: product.color || null,
            qty,
            unitPrice: product.finalPrice
          }],
          subtotal: product.finalPrice * qty,
          deliveryFee: 60,
          total: parseFloat(totalEl.value),
          paid: parseFloat(payNow.value) || 0,
          due: parseFloat(due.value) || 0,
          customerName: document.getElementById('co-name').value,
          phone: document.getElementById('co-phone').value,
          address: document.getElementById('co-address').value,
          paymentMethod: paymentSelect.value,
          transactionId: document.getElementById('co-txn').value.trim() || null,
          status: 'Pending',
          timeISO: serverTimestamp()
        };
        await transaction.set(doc(collection(db, 'orders')), orderData);
      });

      showSuccessPopup();
      modal.classList.remove('show');
      form.reset();
    } catch (err) {
      alert('Error: ' + (err.message || err));
    }
  };

  closeBtn.onclick = () => modal.classList.remove('show');
}

// ====== SUCCESS POPUP ======
function showSuccessPopup() {
  const popup = document.getElementById('success-popup');
  popup.classList.add('show');
  document.getElementById('close-success').onclick = () => popup.classList.remove('show');
}

// ====== UTIL & PAGE FUNCTIONS (unchanged core logic) ======
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

// Shimmer & Card creation functions (unchanged - keep your existing ones)
function createShimmerCard() {
  const card = document.createElement('div');
  card.className = 'card product-card shimmer-placeholder';
  card.innerHTML = `
    <div class="shimmer-image"></div>
    <div class="shimmer-badges"><div class="shimmer-badge"></div><div class="shimmer-badge"></div></div>
    <div class="shimmer-title"></div>
    <div class="shimmer-muted"></div>
    <div class="shimmer-price"></div>
    <div class="shimmer-button"></div>
  `;
  return card;
}

function createProductCard(p, products) {
  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const isPreOrder = p.availability === 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(p.discount)) : price;
  const images = p.images || [];

  const isInStock = Number(p.stock) > 0 && p.availability === 'Ready';

  const sameName = products.filter(other => other.name.toLowerCase() === p.name.toLowerCase());
  let slug = p.name.toLowerCase().replace(/\s+/g, '-');
  if (sameName.length > 1 && p.color) {
    slug += '-' + p.color.toLowerCase().replace(/\s+/g, '-');
  }

  const card = document.createElement('div');
  card.className = 'card product-card';
  card.innerHTML = `
    <img src="${images[0] || ''}" alt="${p.name}" onerror="this.src=''; this.alt='Image not available';">
    <div class="badges">
      ${p.hotDeal ? `<span class="badge hot">HOT DEAL</span>` : ''}
      ${isInStock ? `<span class="badge new">IN STOCK</span>` : ''}
      ${isOOS ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
      ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
      ${isPreOrder ? `<span class="badge preorder">PRE ORDER</span>` : ''}
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

// Page init functions (home, products, product detail - keep existing logic)
async function initHomePage() {
  const interestSection = document.getElementById('interest-products');
  const categoriesSection = document.getElementById('categories');
  if (!interestSection || !categoriesSection) return;
  categories.forEach(c => categoriesSection.appendChild(createCategoryCard(c)));
  for (let i = 0; i < 4; i++) interestSection.appendChild(createShimmerCard());
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
  title.textContent = category || 'All Products';
  for (let i = 0; i < 8; i++) list.appendChild(createShimmerCard());
  const products = await loadProducts();
  list.innerHTML = '';
  const filtered = category ? products.filter(p => p.category === category) : products;
  filtered.forEach(p => list.appendChild(createProductCard(p, products)));
  setupImageViewer();
}

async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  if (!slug) return;

  const products = await loadProducts();
  let product = null;
  for (const p of products) {
    let testSlug = p.name.toLowerCase().replace(/\s+/g, '-');
    if (products.filter(o => o.name.toLowerCase() === p.name.toLowerCase()).length > 1 && p.color) {
      testSlug += '-' + p.color.toLowerCase().replace(/\s+/g, '-');
    }
    if (testSlug === slug) {
      product = p;
      break;
    }
  }
  if (!product) {
    document.querySelector('main').innerHTML = '<h1 style="text-align:center;margin:50px;">Product not found</h1>';
    return;
  }

  // Calculate final price
  const hasDiscount = Number(product.discount) > 0;
  const price = Number(product.price);
  const finalPrice = hasDiscount ? price - Number(product.discount) : price;
  product.finalPrice = finalPrice;

  // Populate product page
  document.title = `${product.name} - The Geek Shop`;
  document.getElementById('meta-description').setAttribute('content', product.metaDesc || '');
  document.getElementById('canonical-link').setAttribute('href', window.location.href);

  document.getElementById('product-name').textContent = product.name;
  document.getElementById('product-color').textContent = `Color: ${product.color || '-'}`;
  document.getElementById('product-price').innerHTML = hasDiscount 
    ? `<s>৳${price.toFixed(2)}</s> ৳${finalPrice.toFixed(2)}`
    : `৳${finalPrice.toFixed(2)}`;
  document.getElementById('product-spec').textContent = product.desc || '';

  // Badges
  const badges = document.getElementById('product-badges');
  badges.innerHTML = '';
  if (product.hotDeal) badges.innerHTML += '<span class="badge hot">HOT DEAL</span> ';
  if (Number(product.stock) > 0 && product.availability === 'Ready') badges.innerHTML += '<span class="badge new">IN STOCK</span>';
  else if (product.availability !== 'Pre Order' && Number(product.stock) <= 0) badges.innerHTML += '<span class="badge oos">OUT OF STOCK</span>';

  // Images
  const mainImg = document.getElementById('main-image');
  mainImg.src = product.images?.[0] || '';
  mainImg.alt = product.name;
  const gallery = document.getElementById('thumbnail-gallery');
  gallery.innerHTML = '';
  (product.images || []).forEach((src, i) => {
    const thumb = document.createElement('img');
    thumb.src = src;
    thumb.className = 'thumbnail';
    thumb.onclick = () => mainImg.src = src;
    gallery.appendChild(thumb);
  });

  document.getElementById('product-detailed-desc').innerHTML = product.detailedDesc || 'No description available.';

  // Buttons
  document.getElementById('quick-buy-btn').onclick = () => {
    const qty = parseInt(document.getElementById('quick-qty').value);
    if (product.availability !== 'Ready' || Number(product.stock) < qty) {
      alert('Not enough stock or not available for immediate purchase');
      return;
    }
    setupSingleCheckout(product);
    document.getElementById('checkout-modal').classList.add('show');
  };

  document.getElementById('add-to-cart-btn').onclick = () => {
    addToCart(product, parseInt(document.getElementById('quick-qty').value));
    alert('Added to cart!');
  };

  // Other products
  const otherList = document.getElementById('other-products');
  const others = products.filter(p => p.id !== product.id).slice(0, 8);
  otherList.innerHTML = '';
  others.forEach(p => otherList.appendChild(createProductCard(p, products)));

  setupImageViewer();
  updateCartUI();
}

// ====== CART PANEL & MULTI CHECKOUT ======
function setupCartPanel() {
  const cartLink = document.getElementById('cart-link');
  const cartPanel = document.getElementById('cart-panel');
  const overlay = document.getElementById('cart-overlay');
  const closeCart = document.getElementById('close-cart');
  const checkoutBtn = document.getElementById('checkout-btn');
  const multiModal = document.getElementById('multi-checkout-modal');
  const closeMulti = document.getElementById('close-multi-modal-btn');

  if (cartLink) {
    cartLink.onclick = (e) => {
      e.preventDefault();
      cartPanel.classList.add('open');
      overlay.classList.add('show');
      updateCartUI();
    };
  }

  if (closeCart) closeCart.onclick = () => {
    cartPanel.classList.remove('open');
    overlay.classList.remove('show');
  };

  if (overlay) overlay.onclick = () => {
    cartPanel.classList.remove('open');
    overlay.classList.remove('show');
  };

  if (checkoutBtn) {
    checkoutBtn.onclick = () => {
      if (cart.length === 0) return alert('Cart is empty!');
      cartPanel.classList.remove('open');
      overlay.classList.remove('show');
      
      const list = document.getElementById('co-products-list');
      let subtotal = 0;
      list.innerHTML = '<h3>Your Cart</h3>';
      cart.forEach(item => {
        const itemTotal = (item.finalPrice || 0) * item.qty;
        subtotal += itemTotal;
        list.innerHTML += `
          <div style="padding:8px 0;border-bottom:1px solid #eee;">
            <strong>${item.name}</strong> (${item.color || 'N/A'}) × ${item.qty}<br>
            <small>৳${itemTotal.toFixed(2)}</small>
          </div>
        `;
      });
      
      const delivery = 60;
      const total = subtotal + delivery;
      document.getElementById('co-delivery-multi').value = delivery;
      document.getElementById('co-total-multi').value = total.toFixed(2);

      // Payment handlers (multi)
      const paySelect = document.getElementById('co-payment-multi');
      const payNow = document.getElementById('co-pay-now-multi');
      const dueAmt = document.getElementById('co-due-amount-multi');
      const payNum = document.getElementById('co-payment-number-multi');

      paySelect.onchange = () => {
        if (paySelect.value === 'Bkash') {
          payNow.value = total.toFixed(2);
          dueAmt.value = '0.00';
          payNum.value = BKASH_NUMBER || '01700000000';
        } else if (paySelect.value === 'Cash on Delivery') {
          payNow.value = '0.00';
          dueAmt.value = total.toFixed(2);
          payNum.value = COD_NUMBER || '01960902526';
        }
      };

      multiModal.classList.add('show');
    };
  }

  if (closeMulti) closeMulti.onclick = () => multiModal.classList.remove('show');

  // Multi checkout form
  const multiForm = document.getElementById('multi-checkout-form');
  if (multiForm) {
    multiForm.onsubmit = async (e) => {
      e.preventDefault();
      if (!document.getElementById('co-policy-multi').checked) return alert('Please agree to policy');

      try {
        await runTransaction(db, async (transaction) => {
          for (const item of cart) {
            const prodRef = doc(db, 'products', item.id);
            const prodSnap = await transaction.get(prodRef);
            const data = prodSnap.data();
            if (data.availability !== 'Ready' || Number(data.stock) < item.qty) {
              throw `Insufficient stock for ${item.name}`;
            }
          }

          for (const item of cart) {
            const prodRef = doc(db, 'products', item.id);
            const prodSnap = await transaction.get(prodRef);
            const data = prodSnap.data();
            transaction.update(prodRef, { stock: Number(data.stock) - item.qty });
          }

          const orderData = {
            items: cart.map(i => ({
              productId: i.id,
              name: i.name,
              color: i.color || null,
              qty: i.qty,
              unitPrice: i.finalPrice || 0
            })),
            subtotal: cart.reduce((s, i) => s + (i.finalPrice || 0) * i.qty, 0),
            deliveryFee: 60,
            total: parseFloat(document.getElementById('co-total-multi').value),
            paid: parseFloat(document.getElementById('co-pay-now-multi').value) || 0,
            due: parseFloat(document.getElementById('co-due-amount-multi').value) || 0,
            customerName: document.getElementById('co-name-multi').value,
            phone: document.getElementById('co-phone-multi').value,
            address: document.getElementById('co-address-multi').value,
            paymentMethod: document.getElementById('co-payment-multi').value,
            transactionId: document.getElementById('co-txn-multi').value.trim() || null,
            status: 'Pending',
            timeISO: serverTimestamp()
          };

          await transaction.set(doc(collection(db, 'orders')), orderData);
        });

        showSuccessPopup();
        cart = [];
        saveCart();
        multiModal.classList.remove('show');
        multiForm.reset();
      } catch (err) {
        alert('Error: ' + (err.message || err));
      }
    };
  }
}

// ====== COMMON SETUP ======
function setupImageViewer() {
  const viewer = document.getElementById('image-viewer');
  if (!viewer) return;
  
  document.querySelectorAll('img:not(#viewer-img)').forEach(img => {
    img.style.cursor = 'pointer';
    img.onclick = () => {
      document.getElementById('viewer-img').src = img.src;
      viewer.classList.add('show');
    };
  });

  document.getElementById('close-viewer').onclick = () => viewer.classList.remove('show');
  viewer.onclick = (e) => { if (e.target === viewer) viewer.classList.remove('show'); };
}

// Admin functions (keep existing - just update renderOrdersTable for multi-items)
async function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  
  const orders = await loadOrders();
  tbody.innerHTML = '';
  
  orders.forEach(async (o) => {
    const tr = document.createElement('tr');
    const toggle = document.createElement('td');
    toggle.textContent = '▼';
    toggle.className = 'toggle-details';
    toggle.onclick = (e) => {
      const details = tr.nextElementSibling;
      details.classList.toggle('show');
      toggle.textContent = details.classList.contains('show') ? '▲' : '▼';
    };
    tr.appendChild(toggle);

    const itemsSummary = o.items?.map(i => `${i.name}×${i.qty}`).join(', ') || o.productName || 'N/A';
    const rowData = [
      new Date(o.timeISO?.toDate() || Date.now()).toLocaleString(),
      itemsSummary,
      o.customerName,
      o.phone,
      `৳${(o.deliveryFee || 60).toFixed(2)}`,
      `৳${(o.paid || 0).toFixed(2)}`,
      `৳${(o.due || 0).toFixed(2)}`,
      o.paymentMethod || '-',
      o.transactionId || '-'
    ];

    rowData.forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });

    const statusTd = document.createElement('td');
    const select = document.createElement('select');
    Object.keys(statusColors).forEach(status => {
      const opt = document.createElement('option');
      opt.value = status;
      opt.textContent = status;
      if (status === o.status) opt.selected = true;
      select.appendChild(opt);
    });
    select.style.backgroundColor = statusColors[o.status || 'Pending'];
    select.onchange = async () => {
      await updateDoc(doc(db, 'orders', o.id), { status: select.value });
      select.style.backgroundColor = statusColors[select.value];
    };
    statusTd.appendChild(select);
    tr.appendChild(statusTd);

    tbody.appendChild(tr);

    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsTd = document.createElement('td');
    detailsTd.colSpan = 11;
    detailsTd.style.padding = '16px';
    detailsTd.style.background = '#f9fafb';
    if (o.items) {
      detailsTd.innerHTML = o.items.map(item => `
        <div style="margin-bottom:12px;padding:8px;background:white;border-radius:6px;">
          <strong>${item.name}</strong> (${item.color || 'N/A'}) × ${item.qty}<br>
          Unit: ৳${item.unitPrice?.toFixed(2)} | Total: ৳${(item.unitPrice * item.qty).toFixed(2)}
        </div>
      `).join('');
    }
    detailsRow.appendChild(detailsTd);
    tbody.appendChild(detailsRow);
  });
}

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  updateCartUI();
  setupCartPanel();
  setupImageViewer();

  const isHome = !!document.getElementById('interest-products');
  const isProducts = !!document.getElementById('product-list');
  const isProduct = !!document.getElementById('product-section');
  const isAdmin = !!document.getElementById('admin-panel');
  const isStatus = !!document.getElementById('status-form');

  if (isHome) await initHomePage();
  if (isProducts) await initProductsPage();
  if (isProduct) await initProductPage();
  if (isStatus) setupStatusForm();

  // Admin setup
  const loginPanel = document.getElementById('login-panel');
  const adminPanel = document.getElementById('admin-panel');
  if (loginPanel && adminPanel) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        loginPanel.style.display = 'none';
        adminPanel.style.display = 'block';
        // Call your existing admin render functions
        if (typeof renderDataTable === 'function') await renderDataTable();
        await renderOrdersTable();
      } else {
        loginPanel.style.display = 'block';
        adminPanel.style.display = 'none';
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

window.logoutAdmin = () => signOut(auth);
window.renderDataTable = async () => { /* your existing function */ };