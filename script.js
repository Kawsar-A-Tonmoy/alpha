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
  const cartCountEl = document.getElementById('cart-count');
  if (cartCountEl) cartCountEl.innerText = count;
}

async function openCartSidebar() {
  const sidebar = document.getElementById('cart-sidebar');
  if (!sidebar) return;
  sidebar.classList.add('open');
  const itemsDiv = document.getElementById('cart-items');
  itemsDiv.innerHTML = '';
  let total = 0;
  const products = await loadProducts();
  cart.forEach(item => {
    const p = products.find(p => p.id === item.id);
    if (p) {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'cart-item';
      itemDiv.innerHTML = `
        <h3>${p.name}</h3>
        <p>Qty: ${item.qty} - Price: ৳${(p.price - p.discount) * item.qty}</p>
      `;
      itemsDiv.appendChild(itemDiv);
      total += (p.price - p.discount) * item.qty;
    }
  });
  document.getElementById('cart-total').innerText = `Total: ৳${total}`;
  document.getElementById('checkout-cart').onclick = () => openCheckoutModal(cart);
  document.getElementById('close-cart-sidebar').onclick = () => sidebar.classList.remove('open');
}

// ====== PAGE INIT ======
function initDarkMode() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
  }
  const toggleBtn = document.getElementById('dark-mode-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('darkMode', document.body.classList.contains('dark') ? 'true' : 'false');
    });
  }
}

function initSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
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
}

function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = e.target.querySelector('input[type="email"]').value;
      try {
        await addDoc(collection(db, 'subscribers'), { email, time: new Date().toISOString() });
        alert('Subscribed!');
      } catch (err) {
        console.error('Subscription error:', err);
      }
    });
  }
}

function initPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/serviceworker.js').catch(err => console.error('PWA registration failed:', err));
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
  initCart();
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
  initCart();
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
  // Real-time updates
  const filterInputs = document.querySelectorAll('#filters input');
  filterInputs.forEach(input => {
    const eventType = input.type === 'checkbox' ? 'change' : 'input';
    input.addEventListener(eventType, () => applyFilters(products));
  });
  // Clear filters
  document.getElementById('clear-filters').addEventListener('click', () => {
    filterInputs.forEach(input => {
      if (input.type === 'checkbox') input.checked = false;
      else input.value = '';
    });
    applyFilters(products);
  });
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

  // Shimmer
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

  let products;
  try {
    products = await loadProducts();
  } catch (err) {
    console.error('Failed to load products:', err);
    // Clear shimmers on error
    mainImageContainer.innerHTML = '';
    thumbnailGallery.innerHTML = '';
    productInfo.innerHTML = '';
    alert('Error loading product data');
    return;
  }

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
    console.error('Product not found for slug:', urlSlug);
    mainImageContainer.innerHTML = '';
    thumbnailGallery.innerHTML = '';
    productInfo.innerHTML = '';
    alert('Product not found');
    return;
  }

  console.log('Loaded product:', product); // Debug

  // Set title, meta, canonical
  document.title = product.name;
  const metaDesc = document.getElementById('meta-description');
  if (metaDesc) metaDesc.content = product.desc || '';
  const canonical = document.getElementById('canonical-link');
  if (canonical) canonical.href = window.location.href;

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
  if (product.availability !== 'Upcoming' && Number(product.stock) <= 0 && product.availability !== 'Pre Order') badges.innerHTML += `<span class="badge oos">OUT OF STOCK</span>`;
  if (product.availability === 'Upcoming') badges.innerHTML += `<span class="badge upcoming">UPCOMING</span>`;
  if (product.availability === 'Pre Order') badges.innerHTML += `<span class="badge preorder">PRE ORDER</span>`;
  document.getElementById('product-spec').innerText = product.desc || product.spec || 'No specification available'; // Fallback to desc if spec missing
  document.getElementById('product-detailed-desc').innerHTML = (product.desc || product.detailedDesc || '').replace(/\n/g, '<br>'); // Fallback

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

  const addToCartBtn = document.getElementById('add-to-cart-btn');
  if (addToCartBtn) addToCartBtn.addEventListener('click', () => addToCart(product.id));

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

  const closeModalBtn = document.getElementById('close-modal-btn');
  if (closeModalBtn) closeModalBtn.onclick = closeCheckoutModal;
  const form = document.getElementById('checkout-form');
  if (form) form.addEventListener('submit', submitCheckoutOrder);
  const paymentSelect = document.getElementById('co-payment');
  if (paymentSelect) paymentSelect.addEventListener('change', updatePaymentInfo);
  setupImageViewer();
  initReviews(product.id);
  initCart();
}

function initCart() {
  const cartLink = document.getElementById('cart-link');
  if (cartLink) {
    cartLink.addEventListener('click', (e) => {
      e.preventDefault();
      openCartSidebar();
    });
  }
}

// ... (rest of the code remains the same, including initReviews, openCheckoutModal, etc.)
const path = window.location.pathname;
if (path.endsWith('index.html') || path === '/alpha/') {
  initHomePage();
} else if (path.endsWith('products.html')) {
  initProductsPage();
} else if (path.endsWith('product.html')) {
  initProductPage();
} else if (path.endsWith('admin.html')) {
  initUserAuth();
} else if (path.endsWith('status.html')) {
  initUserAuth();
} else if (path.endsWith('login.html')) {
  initUserAuth();
}
