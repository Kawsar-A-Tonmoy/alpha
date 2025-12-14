import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, orderBy, query, where, runTransaction, setDoc, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { firebaseConfig, BKASH_NUMBER, COD_NUMBER, DELIVERY_FEE } from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

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
}

async function initProductsPage() {
  const list = document.getElementById('product-list');
  if (!list) return;
  for (let i = 0; i < 8; i++) {
    list.appendChild(createShimmerCard());
  }
  const products = await loadProducts();
  list.innerHTML = '';
  const urlParams = new URLSearchParams(window.location.search);
  const category = urlParams.get('category');
  const filtered = category ? products.filter(p => p.category === category) : products;
  if (category) {
    document.getElementById('products-title').textContent = category;
  }
  filtered.forEach(p => list.appendChild(createProductCard(p, products)));
}

async function initProductPage() {
  const section = document.getElementById('product-section');
  const otherSection = document.getElementById('other-products');
  if (!section || !otherSection) return;

  // Shimmers
  section.querySelector('.product-images').appendChild(createMainImageShimmer());
  for (let i = 0; i < 3; i++) {
    section.querySelector('#thumbnail-gallery').appendChild(createThumbnailShimmer());
  }
  section.querySelector('.product-info').appendChild(createInfoLineShimmer());
  section.querySelector('.product-info').appendChild(createInfoLineShimmer());
  section.querySelector('.product-info').appendChild(createInfoLineShimmer());
  section.querySelector('.product-info').appendChild(createInfoLineShimmer());
  for (let i = 0; i < 3; i++) {
    otherSection.appendChild(createShimmerCard());
  }

  const products = await loadProducts();
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  const p = products.find(prod => {
    let prodSlug = prod.name.toLowerCase().replace(/\s+/g, '-');
    if (products.filter(other => other.name.toLowerCase() === prod.name.toLowerCase()).length > 1 && prod.color) {
      prodSlug += '-' + prod.color.toLowerCase().replace(/\s+/g, '-');
    }
    return prodSlug === slug;
  });
  if (!p) {
    section.innerHTML = '<h2>Product not found</h2>';
    return;
  }

  const isUpcoming = p.availability === 'Upcoming';
  const isOOS = !isUpcoming && Number(p.stock) <= 0 && p.availability !== 'Pre Order';
  const isPreOrder = p.availability === 'Pre Order';
  const hasDiscount = Number(p.discount) > 0;
  const price = Number(p.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(p.discount)) : price;
  const images = p.images || [];
  const isInStock = Number(p.stock) > 0 && p.availability === 'Ready';

  // Clear shimmers
  section.querySelector('.product-images').innerHTML = '';
  section.querySelector('#thumbnail-gallery').innerHTML = '';
  section.querySelector('.product-info').innerHTML = '';

  const mainImg = document.createElement('img');
  mainImg.src = images[0] || '';
  mainImg.alt = p.name;
  mainImg.onerror = () => { mainImg.src = ''; mainImg.alt = 'Image not available'; };
  mainImg.addEventListener('click', () => openImageViewer(images[0]));
  section.querySelector('.product-images').appendChild(mainImg);

  images.forEach((imgUrl, i) => {
    const thumb = document.createElement('img');
    thumb.className = 'thumbnail';
    thumb.src = imgUrl;
    thumb.alt = `${p.name} thumbnail ${i + 1}`;
    thumb.onerror = () => { thumb.src = ''; thumb.alt = 'Image not available'; };
    thumb.addEventListener('click', () => {
      mainImg.src = imgUrl;
      openImageViewer(imgUrl);
    });
    section.querySelector('#thumbnail-gallery').appendChild(thumb);
  });

  const nameH1 = document.createElement('h1');
  nameH1.textContent = p.name;
  section.querySelector('.product-info').appendChild(nameH1);

  const colorDiv = document.createElement('div');
  colorDiv.className = 'muted';
  colorDiv.textContent = `Color: ${p.color || '-'}`;
  section.querySelector('.product-info').appendChild(colorDiv);

  const priceDiv = document.createElement('div');
  priceDiv.className = 'price';
  priceDiv.innerHTML = isUpcoming ? `TBA` : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ``}৳${finalPrice.toFixed(2)}`;
  section.querySelector('.product-info').appendChild(priceDiv);

  const badgesDiv = document.createElement('div');
  badgesDiv.className = 'badges';
  if (p.hotDeal) badgesDiv.innerHTML += `<span class="badge hot">HOT DEAL</span>`;
  if (isInStock) badgesDiv.innerHTML += `<span class="badge new">IN STOCK</span>`;
  if (isOOS) badgesDiv.innerHTML += `<span class="badge oos">OUT OF STOCK</span>`;
  if (isUpcoming) badgesDiv.innerHTML += `<span class="badge upcoming">UPCOMING</span>`;
  if (isPreOrder) badgesDiv.innerHTML += `<span class="badge preorder">PRE ORDER</span>`;
  section.querySelector('.product-info').appendChild(badgesDiv);

  const descP = document.createElement('p');
  descP.className = 'desc';
  descP.textContent = p.description || '';
  section.querySelector('.product-info').appendChild(descP);

  const orderRow = document.createElement('div');
  orderRow.className = 'order-row';
  orderRow.innerHTML = `
    <input class="qty" type="number" min="1" value="1">
  `;
  const orderBtn = document.createElement('button');
  orderBtn.textContent = isPreOrder ? 'Pre Order Now' : 'Order Now';
  orderBtn.className = isPreOrder ? 'preorder-btn' : '';
  orderBtn.disabled = isOOS || isUpcoming;
  orderBtn.addEventListener('click', () => {
    const qty = Number(orderRow.querySelector('.qty').value) || 1;
    const item = {
      productId: p.id,
      name: p.name,
      color: p.color || '',
      qty: qty,
      unitPrice: finalPrice,
      discount: Number(p.discount) || 0,
      availability: p.availability
    };
    openCheckoutModal([item]);
  });
  orderRow.appendChild(orderBtn);

  const addToCartBtn = document.createElement('button');
  addToCartBtn.textContent = 'Add to Cart';
  addToCartBtn.disabled = isOOS || isUpcoming;
  addToCartBtn.addEventListener('click', async () => {
    if (!currentUser) {
      window.location.href = 'user.html';
      return;
    }
    const qty = Number(orderRow.querySelector('.qty').value) || 1;
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');
        let cart = userSnap.data().cart || [];
        const existingIndex = cart.findIndex(c => c.productId === p.id);
        if (existingIndex !== -1) {
          cart[existingIndex].quantity += qty;
        } else {
          cart.push({ productId: p.id, quantity: qty });
        }
        transaction.update(userRef, { cart });
      });
      alert('Added to cart');
    } catch (err) {
      alert('Error adding to cart: ' + err.message);
    }
  });
  orderRow.appendChild(addToCartBtn);

  section.querySelector('.product-info').appendChild(orderRow);

  // Other products
  otherSection.innerHTML = '';
  const sameCategory = products.filter(other => other.category === p.category && other.id !== p.id);
  const random3 = shuffle(sameCategory).slice(0, 3);
  random3.forEach(other => otherSection.appendChild(createProductCard(other, products)));
}

// ====== IMAGE VIEWER ======
function openImageViewer(src) {
  const viewer = document.getElementById('image-viewer');
  const img = document.getElementById('viewer-img');
  img.src = src;
  viewer.style.display = 'flex';
}
document.getElementById('close-viewer')?.addEventListener('click', () => {
  document.getElementById('image-viewer').style.display = 'none';
});
document.getElementById('image-viewer')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.style.display = 'none';
  }
});

// ====== CHECKOUT MODAL ======
let currentItems = [];
function openCheckoutModal(items) {
  currentItems = items;
  const modal = document.getElementById('checkout-modal');
  const itemsList = document.createElement('div');
  itemsList.id = 'co-items-list';
  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.innerHTML = `
      <div><strong>${item.name}</strong></div>
      <div class="muted">Color: ${item.color || '-'}</div>
      <div class="muted">Quantity: ${item.qty}</div>
      <div class="price">৳${(item.unitPrice * item.qty).toFixed(2)}</div>
    `;
    itemsList.appendChild(itemDiv);
  });
  document.getElementById('checkout-form').insertBefore(itemsList, document.getElementById('co-delivery').parentNode.parentNode);

  const anyPreOrder = items.some(item => item.availability === 'Pre Order');
  const grandTotal = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0) + DELIVERY_FEE;
  document.getElementById('co-delivery').value = `৳${DELIVERY_FEE.toFixed(2)}`;
  document.getElementById('co-total').value = `৳${grandTotal.toFixed(2)}`;
  document.getElementById('co-payment-number').value = '';
  document.getElementById('co-txn').required = false;
  document.getElementById('co-note').textContent = anyPreOrder ? '25% advance required for pre-order.' : '';

  if (currentUser) {
    getDoc(doc(db, 'users', currentUser.uid)).then(userSnap => {
      if (userSnap.exists()) {
        const data = userSnap.data();
        document.getElementById('co-name').value = data.name || '';
        document.getElementById('co-phone').value = data.phone || '';
        document.getElementById('co-address').value = data.address || '';
      }
    });
  }

  modal.style.display = 'flex';
  updatePayAmounts();
}

function updatePayAmounts() {
  const payment = document.getElementById('co-payment').value;
  const grandTotal = Number(document.getElementById('co-total').value.replace('৳', ''));
  const anyPreOrder = currentItems.some(item => item.availability === 'Pre Order');
  let payNow = 0;
  let due = grandTotal;
  if (payment === 'Bkash') {
    if (anyPreOrder) {
      payNow = grandTotal * 0.25;
      due = grandTotal - payNow;
    } else {
      payNow = grandTotal;
      due = 0;
    }
    document.getElementById('co-txn').required = true;
  } else if (payment === 'Cash on Delivery') {
    payNow = 0;
    due = grandTotal;
    document.getElementById('co-txn').required = false;
  }
  document.getElementById('co-pay-now').value = `৳${payNow.toFixed(2)}`;
  document.getElementById('co-due-amount').value = `৳${due.toFixed(2)}`;
  document.getElementById('co-payment-number').value = payment === 'Bkash' ? BKASH_NUMBER : COD_NUMBER;
}

async function placeOrder(e) {
  e.preventDefault();
  const name = document.getElementById('co-name').value;
  const phone = document.getElementById('co-phone').value;
  const address = document.getElementById('co-address').value;
  const payment = document.getElementById('co-payment').value;
  const txn = document.getElementById('co-txn').value;
  const paid = Number(document.getElementById('co-pay-now').value.replace('৳', ''));
  const due = Number(document.getElementById('co-due-amount').value.replace('৳', ''));
  const deliveryFee = DELIVERY_FEE;
  const timeISO = new Date().toISOString();
  const anyPreOrder = currentItems.some(item => item.availability === 'Pre Order');

  if (!document.getElementById('co-policy').checked) {
    alert('Please agree to the policy.');
    return;
  }
  if (payment === 'Bkash' && !txn) {
    alert('Transaction ID required for Bkash.');
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const productRefs = [];
      currentItems.forEach(item => {
        if (item.availability === 'Ready') {
          const prodRef = doc(db, 'products', item.productId);
          const prodSnap = transaction.get(prodRef);
          productRefs.push({ ref: prodRef, snap: prodSnap, item });
        }
      });
      for (const { snap, item } of productRefs) {
        if (!snap.exists()) throw new Error('Product not found');
        const stock = snap.data().stock || 0;
        if (stock < item.qty) throw new Error('Insufficient stock for ' + item.name);
      }
      for (const { ref, item } of productRefs) {
        transaction.update(ref, { stock: firebase.firestore.FieldValue.increment(-item.qty) });
      }

      await addDoc(collection(db, 'orders'), {
        items: currentItems.map(item => ({
          productId: item.productId,
          name: item.name,
          color: item.color,
          quantity: item.qty,
          unitPrice: item.unitPrice,
          discount: item.discount
        })),
        customerName: name,
        phone,
        address,
        paymentMethod: payment,
        transactionId: txn || '',
        paid,
        due,
        deliveryFee,
        timeISO,
        status: 'Pending'
      });
    });

    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), { cart: [] });
    }

    alert('Order placed! Txn ID: ' + txn);
    document.getElementById('checkout-modal').style.display = 'none';
    document.getElementById('checkout-form').reset();
  } catch (err) {
    alert('Error placing order: ' + err.message);
  }
}

document.getElementById('close-modal-btn')?.addEventListener('click', () => {
  document.getElementById('checkout-modal').style.display = 'none';
  document.getElementById('co-items-list')?.remove();
});
document.getElementById('co-payment')?.addEventListener('change', updatePayAmounts);
document.getElementById('checkout-form')?.addEventListener('submit', placeOrder);

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

    const cells = [
      p.name,
      p.price,
      p.category,
      p.color || '-',
      p.discount || 0,
      p.stock || 0,
      p.availability,
      p.hotDeal ? 'Hot Deal' : ''
    ];
    cells.forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      td.contentEditable = true;
      td.addEventListener('blur', async (e) => {
        const field = ['name', 'price', 'category', 'color', 'discount', 'stock', 'availability', 'hotDeal'][cells.indexOf(text)];
        const newVal = field === 'hotDeal' ? e.target.textContent === 'Hot Deal' : e.target.textContent;
        try {
          await updateDoc(doc(db, 'products', p.id), { [field]: newVal });
        } catch (err) {
          alert('Update failed: ' + err.message);
        }
      });
      tr.appendChild(td);
    });

    const tdStatus = document.createElement('td');
    tdStatus.textContent = p.status || 'Active';
    tdStatus.contentEditable = true;
    tdStatus.addEventListener('blur', async (e) => {
      try {
        await updateDoc(doc(db, 'products', p.id), { status: e.target.textContent });
      } catch (err) {
        alert('Update failed: ' + err.message);
      }
    });
    tr.appendChild(tdStatus);

    const tdActions = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteProductById(p.id));
    tdActions.appendChild(deleteBtn);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);

    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 11;
    detailsCell.className = 'details-content';
    detailsCell.innerHTML = `
      <div>Images: ${p.images?.join(', ') || ''}</div>
      <div>Description: ${p.description || ''}</div>
    `;
    detailsRow.appendChild(detailsCell);
    tbody.appendChild(detailsRow);
  });
}

async function addProduct(e) {
  e.preventDefault();
  const name = document.getElementById('add-name').value;
  const price = Number(document.getElementById('add-price').value);
  const discount = Number(document.getElementById('add-discount').value);
  const images = document.getElementById('add-images').value.split(',').map(i => i.trim());
  const category = document.getElementById('add-category').value;
  const color = document.getElementById('add-color').value;
  const stock = Number(document.getElementById('add-stock').value);
  const availability = document.getElementById('add-availability').value;
  const hotDeal = document.getElementById('add-hotdeal').checked;
  const desc = document.getElementById('add-desc').value;

  try {
    await addDoc(collection(db, 'products'), {
      name, price, discount, images, category, color, stock, availability, hotDeal, description: desc
    });
    e.target.reset();
    renderDataTable();
  } catch (err) {
    alert('Error adding product: ' + err.message);
  }
}
async function updateProductById(id, updates) {
  try {
    await updateDoc(doc(db, 'products', id), updates);
    renderDataTable();
  } catch (err) {
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

    const productNames = o.items.map(i => `${i.name} (${i.color || '-'})`).join(', ');
    const colors = o.items.length > 1 ? 'Multiple' : o.items[0].color || '-';
    const qtys = o.items.reduce((sum, i) => sum + i.quantity, 0);

    const tds = [
      new Date(o.timeISO).toLocaleString(),
      productNames,
      colors,
      qtys,
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
    o.items.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.textContent = `Item: ${item.name} (${item.color || '-'}), Qty: ${item.quantity}, Unit Price: ৳${Number(item.unitPrice).toFixed(2)}`;
      detailsCell.appendChild(itemDiv);
    });
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

// ====== USER PAGE ======
async function initUserPage() {
  const loginPanel = document.getElementById('user-login-panel');
  const registerPanel = document.getElementById('user-register-panel');
  const infoPanel = document.getElementById('user-info-panel');
  const cartSection = document.getElementById('user-cart-section');

  if (currentUser) {
    loginPanel.style.display = 'none';
    registerPanel.style.display = 'none';
    infoPanel.style.display = 'block';
    cartSection.style.display = 'block';

    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      document.getElementById('user-name').value = data.name || '';
      document.getElementById('user-address').value = data.address || '';
      document.getElementById('user-phone').value = data.phone || '';
    }

    // Render cart
    await renderUserCart(userDoc.data().cart || []);
  } else {
    loginPanel.style.display = 'block';
    registerPanel.style.display = 'block';
    infoPanel.style.display = 'none';
    cartSection.style.display = 'none';
  }

  document.getElementById('user-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('user-email').value;
    const pass = document.getElementById('user-pass').value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  });

  document.getElementById('user-register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const address = document.getElementById('reg-address').value;
    const phone = document.getElementById('reg-phone').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name,
        address,
        phone,
        isAdmin: false,
        cart: []
      });
    } catch (err) {
      alert('Registration failed: ' + err.message);
    }
  });

  document.getElementById('user-info-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('user-name').value;
    const address = document.getElementById('user-address').value;
    const phone = document.getElementById('user-phone').value;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { name, address, phone });
      alert('Info updated');
    } catch (err) {
      alert('Error updating info: ' + err.message);
    }
  });

  document.getElementById('user-logout')?.addEventListener('click', () => signOut(auth));
}

async function renderUserCart(cart) {
  const cartList = document.getElementById('user-cart-list');
  cartList.innerHTML = '';
  const products = await loadProducts();
  let total = 0;
  cart.forEach(async (c, index) => {
    const product = products.find(p => p.id === c.productId);
    if (!product) return;
    const finalPrice = product.price - (product.discount || 0);
    const itemTotal = finalPrice * c.quantity;
    total += itemTotal;

    const card = document.createElement('div');
    card.className = 'card order-status-card';
    card.innerHTML = `
      <div class="order-status-left">
        <div><strong>${product.name}</strong></div>
        <div class="muted">Color: ${product.color || '-'}</div>
        <div class="muted">Quantity: <input type="number" value="${c.quantity}" min="1"></div>
        <div class="price">৳${itemTotal.toFixed(2)}</div>
      </div>
      <div>
        <button class="update-qty">Update Qty</button>
        <button class="remove-item danger">Remove</button>
      </div>
    `;
    card.querySelector('.update-qty').addEventListener('click', async () => {
      const newQty = Number(card.querySelector('input').value);
      if (newQty > 0) {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          [`cart.${index}.quantity`]: newQty
        });
        renderUserCart((await getDoc(doc(db, 'users', currentUser.uid))).data().cart);
      }
    });
    card.querySelector('.remove-item').addEventListener('click', async () => {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        cart: arrayRemove(cart[index])
      });
      renderUserCart((await getDoc(doc(db, 'users', currentUser.uid))).data().cart);
    });
    cartList.appendChild(card);
  });
  document.getElementById('user-cart-total').textContent = `Total: ৳${total.toFixed(2)}`;
  document.getElementById('user-checkout-btn').addEventListener('click', async () => {
    const items = cart.map(c => {
      const p = products.find(pr => pr.id === c.productId);
      return {
        productId: c.productId,
        name: p.name,
        color: p.color || '',
        qty: c.quantity,
        unitPrice: p.price - (p.discount || 0),
        discount: p.discount || 0,
        availability: p.availability
      };
    });
    openCheckoutModal(items);
  });
}

// ====== INIT ======
document.addEventListener('DOMContentLoaded', async () => {
  const isHome = !!document.getElementById('interest-products');
  const isProducts = !!document.getElementById('product-list');
  const isProduct = !!document.getElementById('product-section');
  const isAdmin = !!document.getElementById('admin-panel');
  const isStatus = !!document.getElementById('status-form');
  const isUser = !!document.getElementById('user-panel');

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (isAdmin) {
      const loginPanel = document.getElementById('login-panel');
      const adminPanel = document.getElementById('admin-panel');
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().isAdmin) {
          loginPanel.style.display = 'none';
          adminPanel.style.display = 'block';
          await renderDataTable();
          await renderOrdersTable();
        } else {
          loginPanel.style.display = 'block';
          adminPanel.style.display = 'none';
        }
      } else {
        loginPanel.style.display = 'block';
        adminPanel.style.display = 'none';
      }
    }
    if (isUser) {
      initUserPage();
    }
  });

  if (isHome) await initHomePage();
  if (isProducts) await initProductsPage();
  if (isProduct) await initProductPage();
  if (isStatus) setupStatusForm();
  if (isUser) initUserPage();

  const addForm = document.getElementById('add-product-form');
  if (addForm) addForm.addEventListener('submit', addProduct);

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
});