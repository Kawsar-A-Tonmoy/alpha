import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, orderBy, query, where, runTransaction, Timestamp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { firebaseConfig, BKASH_NUMBER, COD_NUMBER, DELIVERY_FEE } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let productsMap = new Map(); // To quickly access product data by ID

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

// ====== CART SYSTEM ======
function getCart() {
  const cart = localStorage.getItem('cart');
  return cart ? JSON.parse(cart) : [];
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

function addToCart(productId, qty = 1) {
  const product = productsMap.get(productId);
  if (!product || product.availability === 'Upcoming') return;

  const isOOS = Number(product.stock) <= 0 && product.availability !== 'Pre Order';
  if (isOOS) {
    alert('This product is out of stock!');
    return;
  }

  let cart = getCart();
  const existing = cart.find(item => item.id === productId);

  const finalPrice = Number(product.discount) > 0 
    ? (Number(product.price) - Number(product.discount)) 
    : Number(product.price);

  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: productId,
      name: product.name,
      color: product.color || '',
      price: finalPrice,
      image: product.images?.[0] || '',
      qty: qty
    });
  }
  saveCart(cart);
  alert('Added to cart!');
}

function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== productId);
  saveCart(cart);
}

function updateCartQuantity(productId, newQty) {
  if (newQty < 1) {
    removeFromCart(productId);
    return;
  }
  let cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) item.qty = newQty;
  saveCart(cart);
}

function updateCartUI() {
  const cart = getCart();
  const countEl = document.getElementById('cart-count');
  if (countEl) {
    countEl.textContent = cart.reduce((sum, i) => sum + i.qty, 0);
  }

  const itemsContainer = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  const emptyMsg = document.getElementById('cart-empty');
  if (!itemsContainer) return;

  if (cart.length === 0) {
    itemsContainer.innerHTML = '';
    if (totalEl) totalEl.innerHTML = '<strong>Total: ৳0</strong>';
    if (emptyMsg) emptyMsg.style.display = 'block';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';
  itemsContainer.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.qty;
    total += itemTotal;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.image}" alt="${item.name}" onerror="this.style.display='none'">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <div class="muted">Color: ${item.color || '-'}</div>
        <div>৳${item.price} × ${item.qty} = ৳${itemTotal}</div>
        <div class="cart-item-controls">
          <button>-</button>
          <span>${item.qty}</span>
          <button>+</button>
          <button style="background:#dc2626; margin-left:auto;">Remove</button>
        </div>
      </div>
    `;

    // Fixed button indexing to avoid undefined error
    const buttons = div.querySelectorAll('.cart-item-controls button');
    buttons[0].onclick = () => updateCartQuantity(item.id, item.qty - 1); // Decrease
    buttons[1].onclick = () => updateCartQuantity(item.id, item.qty + 1); // Increase
    buttons[2].onclick = () => removeFromCart(item.id);                   // Remove

    itemsContainer.appendChild(div);
  });

  if (totalEl) totalEl.innerHTML = `<strong>Total: ৳${total}</strong>`;
}

// Categories for home
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
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    products.forEach(p => productsMap.set(p.id, p));
    return products;
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
      ${p.availability === 'Pre Order' ? `<span class="badge preorder">PRE ORDER</span>` : ''}
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

  if (!isUpcoming) {
    const addBtn = document.createElement('button');
    addBtn.className = 'add-to-cart-btn';
    addBtn.textContent = isOOS ? 'Out of Stock' : 'Add to Cart';
    addBtn.disabled = isOOS;
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCart(p.id, 1);
    });
    card.appendChild(addBtn);
  }

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

async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlSlug = urlParams.get('slug');
  if (!urlSlug) {
    document.getElementById('product-section').innerHTML = '<p>Product not found.</p>';
    return;
  }

  // Shimmer loading
  const mainImg = document.getElementById('main-image');
  const thumbnailGallery = document.getElementById('thumbnail-gallery');
  const productName = document.getElementById('product-name');
  const productColor = document.getElementById('product-color');
  const productPrice = document.getElementById('product-price');
  const productBadges = document.getElementById('product-badges');
  const productSpec = document.getElementById('product-spec');
  const productDesc = document.getElementById('product-detailed-desc');
  const orderRow = document.getElementById('order-row');
  const otherProducts = document.getElementById('other-products');

  mainImg.replaceWith(createMainImageShimmer());
  for (let i = 0; i < 4; i++) thumbnailGallery.appendChild(createThumbnailShimmer());
  productName.replaceWith(createInfoLineShimmer());
  productColor.replaceWith(createInfoLineShimmer());
  productPrice.replaceWith(createInfoLineShimmer());
  for (let i = 0; i < 2; i++) productBadges.appendChild(createInfoLineShimmer());
  productSpec.replaceWith(createInfoLineShimmer());
  for (let i = 0; i < 3; i++) productDesc.appendChild(createInfoLineShimmer());
  orderRow.appendChild(createInfoLineShimmer());
  for (let i = 0; i < 4; i++) otherProducts.appendChild(createShimmerCard());

  const products = await loadProducts();
  let product = products.find(p => {
    const sameName = products.filter(other => other.name.toLowerCase() === p.name.toLowerCase());
    let slug = p.name.toLowerCase().replace(/\s+/g, '-');
    if (sameName.length > 1 && p.color) {
      slug += '-' + p.color.toLowerCase().replace(/\s+/g, '-');
    }
    return slug === urlSlug;
  });

  if (!product) {
    document.getElementById('product-section').innerHTML = '<p>Product not found.</p>';
    return;
  }

  window.currentProduct = product;

  // Update meta
  document.title = product.metaTitle || product.name;
  document.getElementById('meta-description').content = product.metaDesc || '';
  document.getElementById('canonical-link').href = window.location.href;

  const images = product.images || [];
  const mainImage = document.createElement('img');
  mainImage.id = 'main-image';
  mainImage.src = images[0] || '';
  mainImage.alt = product.name;
  document.querySelector('.shimmer-image-placeholder').replaceWith(mainImage);

  thumbnailGallery.innerHTML = '';
  images.forEach((imgSrc, i) => {
    const thumb = document.createElement('img');
    thumb.className = 'thumbnail';
    thumb.src = imgSrc;
    thumb.alt = `${product.name} thumbnail ${i + 1}`;
    thumb.addEventListener('click', () => mainImage.src = imgSrc);
    thumbnailGallery.appendChild(thumb);
  });

  const nameH1 = document.createElement('h1');
  nameH1.id = 'product-name';
  nameH1.textContent = product.name;
  document.querySelector('.shimmer-line').replaceWith(nameH1);

  const colorDiv = document.createElement('div');
  colorDiv.id = 'product-color';
  colorDiv.className = 'muted';
  colorDiv.textContent = `Color: ${product.color || '-'}`;
  document.querySelectorAll('.shimmer-line')[1].replaceWith(colorDiv);

  const priceDiv = document.createElement('div');
  priceDiv.id = 'product-price';
  priceDiv.className = 'price';
  priceDiv.innerHTML = product.availability === 'Upcoming' ? 'TBA' : (Number(product.discount) > 0 ? `<s>৳${Number(product.price).toFixed(2)}</s> ৳${(Number(product.price) - Number(product.discount)).toFixed(2)}` : `৳${Number(product.price).toFixed(2)}`);
  document.querySelectorAll('.shimmer-line')[2].replaceWith(priceDiv);

  productBadges.innerHTML = '';
  const isOOS = Number(product.stock) <= 0 && product.availability !== 'Pre Order' && product.availability !== 'Upcoming';
  const isInStock = Number(product.stock) > 0 && product.availability === 'Ready';
  if (product.hotDeal) productBadges.innerHTML += '<span class="badge hot">HOT DEAL</span>';
  if (isInStock) productBadges.innerHTML += '<span class="badge new">IN STOCK</span>';
  if (isOOS) productBadges.innerHTML += '<span class="badge oos">OUT OF STOCK</span>';
  if (product.availability === 'Upcoming') productBadges.innerHTML += '<span class="badge upcoming">UPCOMING</span>';
  if (product.availability === 'Pre Order') productBadges.innerHTML += '<span class="badge preorder">PRE ORDER</span>';

  const specP = document.createElement('p');
  specP.id = 'product-spec';
  specP.innerHTML = product.desc || '';
  document.querySelectorAll('.shimmer-line')[3].replaceWith(specP);

  productDesc.innerHTML = product.detailedDesc || '';

  orderRow.innerHTML = '';
  const isUpcoming = product.availability === 'Upcoming';
  const isPreOrder = product.availability === 'Pre Order';
  const button = document.createElement('button');
  button.textContent = isUpcoming ? 'Coming Soon' : (isOOS ? 'Out of Stock' : (isPreOrder ? 'Pre Order' : 'Order Now'));
  button.disabled = isUpcoming || isOOS;
  button.className = isPreOrder ? 'preorder-btn' : '';
  button.addEventListener('click', openCheckoutModal);
  orderRow.appendChild(button);

  otherProducts.innerHTML = '';
  const shuffled = shuffle(products.filter(p2 => p2.id !== product.id && p2.availability !== 'Upcoming')).slice(0, 4);
  shuffled.forEach(p2 => otherProducts.appendChild(createProductCard(p2, products)));

  setupImageViewer();
  updateCartUI();

  // Add "Add to Cart" button on single product page
  const orderRowElement = document.getElementById('order-row');
  if (orderRowElement && window.currentProduct) {
    const isUpcomingCurrent = window.currentProduct.availability === 'Upcoming';
    const isOOSCurrent = Number(window.currentProduct.stock) <= 0 && window.currentProduct.availability !== 'Pre Order';
    if (!isUpcomingCurrent) {
      const addBtn = document.createElement('button');
      addBtn.className = 'add-to-cart-btn';
      addBtn.style.marginTop = '16px';
      addBtn.style.width = '100%';
      addBtn.textContent = isOOSCurrent ? 'Out of Stock' : 'Add to Cart';
      addBtn.disabled = isOOSCurrent;
      addBtn.addEventListener('click', () => {
        const qtyInput = document.getElementById('co-qty');
        const qty = qtyInput ? parseInt(qtyInput.value) || 1 : 1;
        addToCart(window.currentProduct.id, qty);
      });
      orderRowElement.appendChild(addBtn);
    }
  }
}

function setupImageViewer() {
  document.querySelectorAll('.product-card img, .thumbnail, #main-image').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      const viewer = document.getElementById('image-viewer');
      const viewerImg = document.getElementById('viewer-img');
      viewerImg.src = img.src;
      viewer.classList.add('show');
    });
  });

  document.getElementById('close-viewer')?.addEventListener('click', () => {
    document.getElementById('image-viewer').classList.remove('show');
  });
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

// ====== DOM LOADED ======
document.addEventListener('DOMContentLoaded', async () => {
  updateCartUI();

  // Cart slider controls
  document.getElementById('cart-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('cart-slider').classList.add('open');
  });

  document.getElementById('close-cart')?.addEventListener('click', () => {
    document.getElementById('cart-slider').classList.remove('open');
  });

  // Open cart checkout modal
  document.getElementById('checkout-cart')?.addEventListener('click', () => {
    const cart = getCart();
    if (cart.length === 0) {
      alert('Your cart is empty!');
      return;
    }
    document.getElementById('cart-slider').classList.remove('open');
    document.getElementById('cart-checkout-modal').classList.add('show');

    const itemsDiv = document.getElementById('cart-co-items');
    itemsDiv.innerHTML = '<h3>Order Items:</h3>';
    let subtotal = 0;
    cart.forEach(item => {
      const line = document.createElement('p');
      line.textContent = `${item.name} (${item.color || 'N/A'}) × ${item.qty} = ৳${item.price * item.qty}`;
      itemsDiv.appendChild(line);
      subtotal += item.price * item.qty;
    });

    const total = subtotal + Number(DELIVERY_FEE);
    document.getElementById('cart-co-delivery').value = `৳${DELIVERY_FEE}`;
    document.getElementById('cart-co-total').value = `৳${total}`;

    const paymentSelect = document.getElementById('cart-co-payment');
    paymentSelect.onchange = () => {
      const number = paymentSelect.value === 'Bkash' ? BKASH_NUMBER : COD_NUMBER;
      document.getElementById('cart-co-payment-number').value = number;
      const payNow = paymentSelect.value === 'Cash on Delivery' ? DELIVERY_FEE : total;
      document.getElementById('cart-co-pay-now').value = `৳${payNow}`;
      document.getElementById('cart-co-due-amount').value = `৳${total - payNow}`;
    };
    paymentSelect.value = '';
    paymentSelect.onchange();
  });

  // Close cart checkout modal
  document.getElementById('cart-close-modal-btn')?.addEventListener('click', () => {
    document.getElementById('cart-checkout-modal').classList.remove('show');
  });

  // Submit cart checkout
  document.getElementById('cart-checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cart = getCart();
    if (cart.length === 0) return;

    const orders = cart.map(item => ({
      productId: item.id,
      productName: item.name,
      color: item.color || '',
      quantity: item.qty,
      unitPrice: item.price,
      deliveryFee: DELIVERY_FEE,
      paid: Number(document.getElementById('cart-co-pay-now').value.replace(/[^0-9.-]+/g, '')),
      due: Number(document.getElementById('cart-co-due-amount').value.replace(/[^0-9.-]+/g, '')),
      customerName: document.getElementById('cart-co-name').value,
      phone: document.getElementById('cart-co-phone').value,
      address: document.getElementById('cart-co-address').value,
      paymentMethod: document.getElementById('cart-co-payment').value,
      transactionId: document.getElementById('cart-co-txn').value.trim(),
      status: 'Pending',
      timeISO: Timestamp.now().toDate().toISOString()
    }));

    try {
      for (const order of orders) {
        await addDoc(collection(db, 'orders'), order);
      }
      alert('Order placed successfully!');
      localStorage.removeItem('cart');
      updateCartUI();
      document.getElementById('cart-checkout-modal').classList.remove('show');
    } catch (err) {
      console.error(err);
      alert('Error placing order: ' + err.message);
    }
  });

  // Page detection & initialization
  const isHome = !!document.getElementById('interest-products');
  const isProducts = !!document.getElementById('product-list');
  const isProduct = !!document.getElementById('product-section');
  const isAdmin = !!document.getElementById('admin-panel');
  const isStatus = !!document.getElementById('status-form');

  if (isHome) await initHomePage();
  if (isProducts) await initProductsPage();
  if (isProduct) await initProductPage();
  if (isStatus) setupStatusForm();

  // Admin panel logic
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
