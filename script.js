import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
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

// Status colors (FIXED: Added quotes around Processing color value)
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

  // Auto In Stock badge
  const isInStock = Number(p.stock) > 0 && p.availability === 'Ready';

  // Generate slug
  const sameName = products.filter(other => other.name.toLowerCase() === p.name.toLowerCase());
  let slug = p.name.toLowerCase().replace(/\s+/g, '-');
  if (sameName.length > 1 && p.color) {
    slug += '-' + p.color.toLowerCase().replace(/\s+/g, '-');
  }

  const card = document.createElement('div');
  card.className = 'card product-card';
  card.innerHTML = `
    <img loading="lazy" src="${images[0] || ''}" alt="${p.name}" onerror="this.src=''; this.alt='Image not available';">
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
    <button class="add-to-cart-btn" ${isOOS || isUpcoming ? 'disabled' : ''}>Add to Cart</button>
  `;
  card.querySelector('.view-details-btn').addEventListener('click', () => {
    window.location.href = `product.html?slug=${slug}`;
  });
  card.querySelector('.add-to-cart-btn').addEventListener('click', () => addToCart(p.id));
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

// ====== CART AND WISHLIST ======
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function addToCart(productId, qty = 1) {
  const existing = cart.find(item => item.id === productId);
  if (existing) existing.qty += qty;
  else cart.push({ id: productId, qty });
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  alert('Added to cart!');
}

function updateCartCount() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  document.getElementById('cart-count').innerText = count;
}

async function openCartModal() {
  const modal = document.getElementById('cart-modal');
  modal.classList.add('show');
  const itemsDiv = document.getElementById('cart-items');
  itemsDiv.innerHTML = '';
  let total = 0;
  const products = await loadProducts();
  cart.forEach(item => {
    const p = products.find(p => p.id === item.id);
    if (p) {
      const itemDiv = document.createElement('div');
      itemDiv.innerHTML = `
        <h3>${p.name}</h3>
        <p>Qty: ${item.qty} - Price: ৳${(p.price - p.discount) * item.qty}</p>
      `;
      itemsDiv.appendChild(itemDiv);
      total += (p.price - p.discount) * item.qty;
    }
  });
  document.getElementById('cart-total-modal').innerText = `Total: ৳${total}`;
  document.getElementById('checkout-from-cart').onclick = () => openCheckoutModal(cart);
  document.getElementById('close-cart-btn').onclick = () => modal.classList.remove('show');
}

// ====== PAGE INIT ======
function initDarkMode() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
  }
  document.getElementById('dark-mode-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark') ? 'true' : 'false');
  });
}

function initSearch() {
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    if (window.location.pathname.includes('products.html')) {
      const list = document.getElementById('product-list');
      const cards = list.querySelectorAll('.product-card');
      cards.forEach(card => {
        const name = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = name.includes(term) ? '' : 'none';
      });
    } else {
      window.location.href = `products.html?search=${encodeURIComponent(term)}`;
    }
  });
}

function initNewsletter() {
  document.getElementById('newsletter-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    await addDoc(collection(db, 'subscribers'), { email, time: new Date().toISOString() });
    alert('Subscribed!');
  });
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/serviceworker.js');
  }
}

async function initHomePage() {
  initDarkMode();
  initSearch();
  initNewsletter();
  initPWA();
  updateCartCount();
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
  initDarkMode();
  initSearch();
  initNewsletter();
  initPWA();
  updateCartCount();
  const title = document.getElementById('products-title');
  const list = document.getElementById('product-list');
  if (!list) return;
  const urlParams = new URLSearchParams(window.location.search);
  const category = urlParams.get('category');
  const search = urlParams.get('search');
  if (category) title.innerText = category;
  else title.innerText = 'All Products';
  for (let i = 0; i < 8; i++) {
    list.appendChild(createShimmerCard());
  }
  const products = await loadProducts();
  list.innerHTML = '';
  let filtered = category ? products.filter(p => p.category === category) : products;
  if (search) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }
  filtered.forEach(p => list.appendChild(createProductCard(p, products)));
  setupImageViewer();
  initFilters(products);
}

function initFilters(products) {
  const colorFilters = document.getElementById('color-filters');
  const availFilters = document.getElementById('availability-filters');
  const uniqueColors = [...new Set(products.map(p => p.color).filter(Boolean))];
  uniqueColors.forEach(color => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" class="filter-color" value="${color}"> ${color}`;
    colorFilters.appendChild(label);
  });
  const uniqueAvail = [...new Set(products.map(p => p.availability))];
  uniqueAvail.forEach(avail => {
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" class="filter-avail" value="${avail}"> ${avail}`;
    availFilters.appendChild(label);
  });
  document.getElementById('apply-filters').addEventListener('click', () => applyFilters(products));
}

function applyFilters(products) {
  const minPrice = Number(document.getElementById('filter-price-min').value) || 0;
  const maxPrice = Number(document.getElementById('filter-price-max').value) || Infinity;
  const selectedColors = Array.from(document.querySelectorAll('.filter-color:checked')).map(ch => ch.value);
  const selectedAvail = Array.from(document.querySelectorAll('.filter-avail:checked')).map(ch => ch.value);
  const hotDeal = document.getElementById('filter-hot-deal').checked;
  let filtered = products.filter(p => {
    const price = p.price - p.discount;
    return price >= minPrice && price <= maxPrice &&
      (selectedColors.length === 0 || selectedColors.includes(p.color)) &&
      (selectedAvail.length === 0 || selectedAvail.includes(p.availability)) &&
      (!hotDeal || p.hotDeal);
  });
  const list = document.getElementById('product-list');
  list.innerHTML = '';
  filtered.forEach(p => list.appendChild(createProductCard(p, products)));
}

async function initProductPage() {
  initDarkMode();
  initSearch();
  initNewsletter();
  initPWA();
  updateCartCount();
  const urlParams = new URLSearchParams(window.location.search);
  const urlSlug = urlParams.get('slug');
  if (!urlSlug) {
    alert('Product not found');
    return;
  }

  // Shimmer ...
  const productSection = document.getElementById('product-section');
  const mainImageContainer = productSection.querySelector('.product-images');
  mainImageContainer.appendChild(createMainImageShimmer());
  const thumbnailGallery = document.getElementById('thumbnail-gallery');
  for (let i = 0; i < 3; i++) {
    thumbnailGallery.appendChild(createThumbnailShimmer());
  }
  const productInfo = productSection.querySelector('.product-info');
  productInfo.appendChild(createInfoLineShimmer());
  productInfo.appendChild(createInfoLineShimmer());
  productInfo.appendChild(createInfoLineShimmer());

  const products = await loadProducts();
  let product = null;
  for (const p of products) {
    let slug = p.name.toLowerCase().replace(/\s+/g, '-');
    const sameName = products.filter(other => other.name.toLowerCase() === p.name.toLowerCase());
    if (sameName.length > 1 && p.color) {
      slug += '-' + p.color.toLowerCase().replace(/\s+/g, '-');
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

  // Set title, meta, canonical
  document.title = product.name;
  document.getElementById('meta-description').content = product.desc || '';
  document.getElementById('canonical-link').href = window.location.href;

  const images = product.images || [];
  const realMainImg = document.createElement('img');
  realMainImg.id = 'main-image';
  realMainImg.loading = 'lazy';
  realMainImg.src = images[0] || '';
  realMainImg.alt = product.name;
  mainImageContainer.innerHTML = '';
  mainImageContainer.appendChild(realMainImg);

  document.getElementById('product-name').innerText = product.name;
  document.getElementById('product-color').innerText = `Color: ${product.color || '-'}`;
  const hasDiscount = Number(product.discount) > 0;
  const price = Number(product.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(product.discount)) : price;
  document.getElementById('product-price').innerHTML = product.availability === 'Upcoming' ? 'TBA' : (hasDiscount ? `<s>৳${price.toFixed(2)}</s> ৳${finalPrice.toFixed(2)}` : `৳${finalPrice.toFixed(2)}`);
  const badges = document.getElementById('product-badges');
  if (product.hotDeal) badges.innerHTML += `<span class="badge hot">HOT DEAL</span>`;
  if (Number(product.stock) > 0 && product.availability === 'Ready') badges.innerHTML += `<span class="badge new">IN STOCK</span>`;
  if (!product.availability === 'Upcoming' && Number(product.stock) <= 0 && product.availability !== 'Pre Order') badges.innerHTML += `<span class="badge oos">OUT OF STOCK</span>`;
  if (product.availability === 'Upcoming') badges.innerHTML += `<span class="badge upcoming">UPCOMING</span>`;
  if (product.availability === 'Pre Order') badges.innerHTML += `<span class="badge preorder">PRE ORDER</span>`;
  document.getElementById('product-spec').innerText = product.spec || '';
  document.getElementById('product-detailed-desc').innerHTML = (product.detailedDesc || '').replace(/\n/g, '<br>');

  const isUpcoming = product.availability === 'Upcoming';
  const orderRow = document.getElementById('order-row');
  const button = document.createElement('button');
  if (isUpcoming) {
    button.textContent = 'Upcoming - Stay Tuned';
    button.disabled = true;
  } else if (product.availability === 'Pre Order') {
    button.className = 'preorder-btn';
    button.textContent = 'Pre Order';
    button.onclick = () => openCheckoutModal([{id: product.id, qty: 1}], true);
  } else if (Number(product.stock) > 0) {
    button.textContent = 'Order Now';
    button.onclick = () => openCheckoutModal([{id: product.id, qty: 1}]);
  } else {
    button.textContent = 'Out of Stock';
    button.disabled = true;
  }
  orderRow.innerHTML = '';
  orderRow.appendChild(button);

  document.getElementById('add-to-cart-btn').addEventListener('click', () => addToCart(product.id));

  thumbnailGallery.innerHTML = '';
  if (images.length > 1) {
    images.slice(1).forEach(src => {
      const thumb = document.createElement('img');
      thumb.loading = 'lazy';
      thumb.src = src;
      thumb.alt = product.name;
      thumb.className = 'thumbnail';
      thumb.onclick = () => { realMainImg.src = src; };
      thumbnailGallery.appendChild(thumb);
    });
  }

  // Other products
  const otherProducts = document.getElementById('other-products');
  const randomOthers = shuffle(products.filter(p => p.id !== product.id && p.availability !== 'Upcoming')).slice(0, 4);
  randomOthers.forEach(p => otherProducts.appendChild(createProductCard(p, products)));

  document.getElementById('close-modal-btn').onclick = closeCheckoutModal;
  const form = document.getElementById('checkout-form');
  form.addEventListener('submit', submitCheckoutOrder);
  document.getElementById('co-payment').addEventListener('change', updatePaymentInfo);
  setupImageViewer();
  initReviews(product.id);
}

async function initReviews(productId) {
  const reviewsList = document.getElementById('reviews-list');
  const snap = await getDocs(query(collection(db, 'reviews'), where('productId', '==', productId)));
  reviewsList.innerHTML = '';
  let totalRating = 0;
  snap.docs.forEach(d => {
    const r = d.data();
    const div = document.createElement('div');
    div.innerHTML = `<p>Rating: ${r.rating} - ${r.text}</p>`;
    reviewsList.appendChild(div);
    totalRating += r.rating;
  });
  const count = snap.docs.length;
  document.getElementById('avg-rating').innerText = count ? (totalRating / count).toFixed(1) : '0';
  document.getElementById('review-count').innerText = count;

  document.getElementById('review-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!auth.currentUser) {
      alert('Login to review');
      return;
    }
    const text = document.getElementById('review-text').value;
    const rating = Number(document.getElementById('review-rating').value);
    await addDoc(collection(db, 'reviews'), { productId, text, rating, userId: auth.currentUser.uid, time: new Date().toISOString() });
    initReviews(productId);
  });
}

async function openCheckoutModal(items, isPreOrder = false) {
  const modal = document.getElementById('checkout-modal');
  modal.classList.add('show');
  const itemsDiv = document.getElementById('checkout-items');
  itemsDiv.innerHTML = '';
  let total = 0;
  const products = await loadProducts();
  items.forEach(item => {
    const p = products.find(p => p.id === item.id);
    if (p) {
      const div = document.createElement('div');
      div.innerHTML = `<p>${p.name} x ${item.qty} - ৳${(p.price - p.discount) * item.qty}</p>`;
      itemsDiv.appendChild(div);
      total += (p.price - p.discount) * item.qty;
    }
  });
  total += DELIVERY_FEE;
  document.getElementById('co-delivery').value = DELIVERY_FEE.toFixed(2);
  document.getElementById('co-total').value = total.toFixed(2);
  updatePaymentInfo();
  if (isPreOrder) {
    document.getElementById('co-note').innerText = '25% advance for pre order';
  }
}

function updatePaymentInfo() {
  const payment = document.getElementById('co-payment').value;
  const total = Number(document.getElementById('co-total').value);
  const payNow = total; // Update for pre order if needed
  const due = 0;
  document.getElementById('co-pay-now').value = payNow.toFixed(2);
  document.getElementById('co-due-amount').value = due.toFixed(2);
  const number = payment === 'Bkash' ? BKASH_NUMBER : COD_NUMBER;
  document.getElementById('co-payment-number').value = number;
  document.getElementById('co-txn').disabled = payment === 'Cash on Delivery';
}

async function submitCheckoutOrder(e) {
  e.preventDefault();
  const data = {
    items: cart, // array of {id, qty}
    delivery: DELIVERY_FEE,
    paid: Number(document.getElementById('co-pay-now').value),
    due: Number(document.getElementById('co-due-amount').value),
    name: document.getElementById('co-name').value,
    phone: document.getElementById('co-phone').value,
    address: document.getElementById('co-address').value,
    payment: document.getElementById('co-payment').value,
    txn: document.getElementById('co-txn').value,
    timeISO: new Date().toISOString(),
    status: 'Pending'
  };
  await addDoc(collection(db, 'orders'), data);
  cart = [];
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
  closeCheckoutModal();
  alert('Order placed!');
}

function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('show');
}

function setupImageViewer() {
  const viewer = document.getElementById('image-viewer');
  const viewerImg = document.getElementById('viewer-img');
  const closeViewer = document.getElementById('close-viewer');
  document.querySelectorAll('.product-card img, #main-image, .thumbnail').forEach(img => {
    img.addEventListener('click', () => {
      viewerImg.src = img.src;
      viewer.classList.add('show');
    });
  });
  closeViewer.addEventListener('click', () => viewer.classList.remove('show'));
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) viewer.classList.remove('show');
  });
}

// User auth for customers
async function initUserAuth() {
  onAuthStateChanged(auth, user => {
    if (user) {
      // Update UI for logged in
    }
  });
  document.getElementById('login-form-user')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('user-email').value;
    const pass = document.getElementById('user-pass').value;
    await signInWithEmailAndPassword(auth, email, pass);
    window.location.href = 'index.html';
  });
  document.getElementById('register-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    await createUserWithEmailAndPassword(auth, email, pass);
    window.location.href = 'index.html';
  });
}

// Init based on page
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/alpha/') {
  initHomePage();
} else if (window.location.pathname.endsWith('products.html')) {
  initProductsPage();
} else if (window.location.pathname.endsWith('product.html')) {
  initProductPage();
} else if (window.location.pathname.endsWith('admin.html')) {
  // Original admin init code here (assuming you have it from original)
  initUserAuth();
} else if (window.location.pathname.endsWith('status.html')) {
  // Original status init code here
  initUserAuth();
} else if (window.location.pathname.endsWith('cart.html')) {
  initDarkMode();
  initSearch();
  initNewsletter();
  initPWA();
  updateCartCount();
  // Load cart items into #cart-list similar to openCartModal
  const cartList = document.getElementById('cart-list');
  // ... (implement loading cart items here, similar to modal)
  document.getElementById('checkout-cart').onclick = () => openCheckoutModal(cart);
} else if (window.location.pathname.endsWith('login.html')) {
  initUserAuth();
}
