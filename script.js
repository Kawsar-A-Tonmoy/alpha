import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, setDoc } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { firebaseConfig, BKASH_NUMBER, COD_NUMBER, DELIVERY_FEE } from './config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let products = [];
let orders = [];

// Generate URL-friendly slug from product name and color
function generateProductSlug(name, color) {
  let slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  
  // Check if slug already exists
  const existingSlugs = products.filter(p => p.slug && p.slug.startsWith(slug));
  
  if (existingSlugs.length > 0) {
    // Add color to slug if duplicate exists
    const colorSlug = color ? '-' + color.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    slug = slug + colorSlug;
    
    // If still duplicate, add number
    const duplicates = products.filter(p => p.slug === slug);
    if (duplicates.length > 0) {
      slug = slug + '-' + (duplicates.length + 1);
    }
  }
  
  return slug;
}

// HOME PAGE (index.html)
if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
  loadHomePageProducts();
}

async function loadHomePageProducts() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    products = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    
    // Get 4 random products for "May Interest You"
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    const randomProducts = shuffled.slice(0, 4);
    
    const interestContainer = document.getElementById('interest-products');
    if (interestContainer) {
      interestContainer.innerHTML = randomProducts.map(p => createProductCard(p)).join('');
    }
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

// PRODUCTS PAGE (products.html)
if (window.location.pathname.includes('products.html')) {
  loadProductsPage();
  
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    // Check URL params for category
    const urlParams = new URLSearchParams(window.location.search);
    const categoryParam = urlParams.get('category');
    if (categoryParam) {
      categoryFilter.value = categoryParam;
    }
    
    categoryFilter.addEventListener('change', filterProducts);
  }
}

async function loadProductsPage() {
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    products = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    
    filterProducts();
  } catch (err) {
    console.error('Error loading products:', err);
  }
}

function filterProducts() {
  const categoryFilter = document.getElementById('category-filter');
  const selectedCategory = categoryFilter ? categoryFilter.value : 'all';
  
  let filteredProducts = products;
  if (selectedCategory !== 'all') {
    filteredProducts = products.filter(p => p.productCategory === selectedCategory);
  }
  
  const newProds = filteredProducts.filter(p => p.category === 'new');
  const hotDeals = filteredProducts.filter(p => p.category === 'hot');
  const allProds = filteredProducts.filter(p => p.category === 'all');
  
  const newContainer = document.getElementById('new-products');
  const hotContainer = document.getElementById('hot-deals');
  const allContainer = document.getElementById('all-products');
  
  if (newContainer) newContainer.innerHTML = newProds.map(p => createProductCard(p)).join('');
  if (hotContainer) hotContainer.innerHTML = hotDeals.map(p => createProductCard(p)).join('');
  if (allContainer) allContainer.innerHTML = allProds.map(p => createProductCard(p)).join('');
  
  // Update title
  const title = document.getElementById('all-products-title');
  if (title && selectedCategory !== 'all') {
    title.textContent = selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1) + ' Products';
  } else if (title) {
    title.textContent = 'All Products';
  }
}

function createProductCard(p) {
  const featuredImage = p.featuredImage || p.image || '';
  const stock = p.stock || 0;
  const availability = p.availability || 'Ready';
  const discount = p.discount || 0;
  const finalPrice = p.price - discount;
  
  let badge = '';
  if (stock === 0) badge = '<span class="badge oos">Out of Stock</span>';
  else if (availability === 'Pre Order') badge = '<span class="badge preorder">Pre Order</span>';
  else if (availability === 'Upcoming') badge = '<span class="badge upcoming">Upcoming</span>';
  
  const priceHTML = discount > 0 
    ? `<s>${p.price} tk</s> ${finalPrice} tk`
    : `${p.price} tk`;
  
  const slug = p.slug || generateProductSlug(p.name, p.color);
  
  return `
    <div class="card product-card" onclick="goToProduct('${slug}')">
      <img src="${featuredImage}" alt="${p.name}">
      <div class="badges">${badge}</div>
      <div class="product-name">${p.name}</div>
      <div class="muted">Color: ${p.color || 'N/A'}</div>
      <div class="price">${priceHTML}</div>
    </div>
  `;
}

window.goToProduct = function(slug) {
  window.location.href = `product.html?slug=${slug}`;
};

// PRODUCT DETAIL PAGE (product.html)
if (window.location.pathname.includes('product.html')) {
  loadProductDetail();
}

async function loadProductDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');
  
  if (!slug) {
    alert('Product not found');
    window.location.href = 'products.html';
    return;
  }
  
  try {
    const snapshot = await getDocs(collection(db, 'products'));
    products = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
    
    const product = products.find(p => p.slug === slug);
    
    if (!product) {
      alert('Product not found');
      window.location.href = 'products.html';
      return;
    }
    
    displayProductDetail(product);
    setupCheckout(product);
  } catch (err) {
    console.error('Error loading product:', err);
    alert('Error loading product');
  }
}

function displayProductDetail(p) {
  document.title = p.name + ' - The Geek Shop';
  
  // Main image
  const mainImage = document.getElementById('main-product-image');
  const featuredImage = p.featuredImage || p.image || '';
  mainImage.src = featuredImage;
  mainImage.alt = p.name;
  
  // Thumbnail gallery
  const thumbnailGallery = document.getElementById('thumbnail-gallery');
  const allImages = [featuredImage, ...(p.additionalImages || [])].filter(img => img);
  
  thumbnailGallery.innerHTML = allImages.map((img, idx) => 
    `<img src="${img}" alt="Image ${idx + 1}" class="${idx === 0 ? 'active' : ''}" onclick="changeMainImage('${img}')">`
  ).join('');
  
  // Product info
  document.getElementById('product-name').textContent = p.name;
  
  // Badges
  const stock = p.stock || 0;
  const availability = p.availability || 'Ready';
  let badgeHTML = '';
  if (stock === 0) badgeHTML = '<span class="badge oos">Out of Stock</span>';
  else if (availability === 'Pre Order') badgeHTML = '<span class="badge preorder">Pre Order</span>';
  else if (availability === 'Upcoming') badgeHTML = '<span class="badge upcoming">Upcoming</span>';
  document.getElementById('product-badges').innerHTML = badgeHTML;
  
  // Price
  const discount = p.discount || 0;
  const finalPrice = p.price - discount;
  const priceHTML = discount > 0 
    ? `<s>${p.price} tk</s> ${finalPrice} tk`
    : `${p.price} tk`;
  document.getElementById('product-price').innerHTML = priceHTML;
  
  // Meta
  document.getElementById('product-color').textContent = p.color || 'N/A';
  document.getElementById('product-category').textContent = p.productCategory || 'N/A';
  document.getElementById('product-availability').textContent = availability;
  document.getElementById('product-stock').textContent = stock > 0 ? `${stock} units` : 'Out of stock';
  
  // Description
  document.getElementById('product-description').textContent = p.desc || 'No description available';
  
  // Quantity
  const qtyInput = document.getElementById('product-qty');
  qtyInput.max = stock;
  if (stock === 0) {
    qtyInput.disabled = true;
    document.getElementById('order-now-btn').disabled = true;
    document.getElementById('order-now-btn').textContent = 'Out of Stock';
  }
}

window.changeMainImage = function(imgSrc) {
  document.getElementById('main-product-image').src = imgSrc;
  
  // Update active thumbnail
  const thumbnails = document.querySelectorAll('.thumbnail-gallery img');
  thumbnails.forEach(thumb => {
    if (thumb.src === imgSrc) {
      thumb.classList.add('active');
    } else {
      thumb.classList.remove('active');
    }
  });
};

function setupCheckout(product) {
  const orderBtn = document.getElementById('order-now-btn');
  const modal = document.getElementById('checkout-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const checkoutForm = document.getElementById('checkout-form');
  
  orderBtn.addEventListener('click', () => {
    const qty = parseInt(document.getElementById('product-qty').value) || 1;
    openCheckoutModal(product, qty);
  });
  
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('show');
  });
  
  checkoutForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await placeOrder();
  });
  
  // Quantity change handler
  const coQty = document.getElementById('co-qty');
  if (coQty) {
    coQty.addEventListener('input', updateCheckoutTotal);
  }
  
  // Payment method change handler
  const coPayment = document.getElementById('co-payment');
  if (coPayment) {
    coPayment.addEventListener('change', updatePaymentInfo);
  }
}

function openCheckoutModal(product, qty) {
  const modal = document.getElementById('checkout-modal');
  const discount = product.discount || 0;
  const unitPrice = product.price - discount;
  
  document.getElementById('co-product-id').value = product.id;
  document.getElementById('co-product-name').value = product.name;
  document.getElementById('co-color').value = product.color || '';
  document.getElementById('co-price').value = unitPrice + ' tk';
  document.getElementById('co-unit-price-raw').value = unitPrice;
  document.getElementById('co-available-stock').value = product.stock || 0;
  document.getElementById('co-qty').value = qty;
  document.getElementById('co-qty').max = product.stock || 0;
  document.getElementById('co-delivery').value = DELIVERY_FEE + ' tk';
  
  updateCheckoutTotal();
  modal.classList.add('show');
}

function updateCheckoutTotal() {
  const unitPrice = parseFloat(document.getElementById('co-unit-price-raw').value) || 0;
  const qty = parseInt(document.getElementById('co-qty').value) || 1;
  const availableStock = parseInt(document.getElementById('co-available-stock').value) || 0;
  
  if (qty > availableStock) {
    document.getElementById('co-qty').value = availableStock;
    return;
  }
  
  const subtotal = unitPrice * qty;
  const total = subtotal + DELIVERY_FEE;
  document.getElementById('co-total').value = total + ' tk';
  
  updatePaymentInfo();
}

function updatePaymentInfo() {
  const paymentMethod = document.getElementById('co-payment').value;
  const total = parseFloat(document.getElementById('co-total').value) || 0;
  const availability = products.find(p => p.id === document.getElementById('co-product-id').value)?.availability;
  
  let payNow = 0;
  let paymentNumber = '';
  let note = '';
  
  if (paymentMethod === 'Cash on Delivery') {
    paymentNumber = COD_NUMBER;
    if (availability === 'Pre Order') {
      payNow = Math.ceil(total * 0.25);
      note = 'Pre-order requires 25% advance payment. Pay the rest on delivery.';
    } else {
      payNow = 0;
      note = 'Pay full amount on delivery.';
    }
  } else if (paymentMethod === 'Bkash') {
    paymentNumber = BKASH_NUMBER;
    if (availability === 'Pre Order') {
      payNow = Math.ceil(total * 0.25);
      note = 'Pre-order requires 25% advance payment. Send money to the Bkash number and enter transaction ID.';
    } else {
      payNow = total;
      note = 'Send full payment to the Bkash number and enter transaction ID.';
    }
  }
  
  const dueAmount = total - payNow;
  
  document.getElementById('co-payment-number').value = paymentNumber;
  document.getElementById('co-pay-now').value = payNow + ' tk';
  document.getElementById('co-due-amount').value = dueAmount + ' tk';
  document.getElementById('co-note').textContent = note;
}

async function placeOrder() {
  const productId = document.getElementById('co-product-id').value;
  const qty = parseInt(document.getElementById('co-qty').value);
  const name = document.getElementById('co-name').value;
  const phone = document.getElementById('co-phone').value;
  const address = document.getElementById('co-address').value;
  const paymentMethod = document.getElementById('co-payment').value;
  const txnId = document.getElementById('co-txn').value;
  const policyChecked = document.getElementById('co-policy').checked;
  
  if (!policyChecked) {
    alert('Please agree to the order policy');
    return;
  }
  
  const product = products.find(p => p.id === productId);
  if (!product) {
    alert('Product not found');
    return;
  }
  
  if (qty > product.stock) {
    alert('Not enough stock available');
    return;
  }
  
  const discount = product.discount || 0;
  const unitPrice = product.price - discount;
  const subtotal = unitPrice * qty;
  const total = subtotal + DELIVERY_FEE;
  
  let payNow = 0;
  if (paymentMethod === 'Bkash') {
    payNow = product.availability === 'Pre Order' ? Math.ceil(total * 0.25) : total;
  } else if (paymentMethod === 'Cash on Delivery' && product.availability === 'Pre Order') {
    payNow = Math.ceil(total * 0.25);
  }
  
  const dueAmount = total - payNow;
  
  try {
    const orderData = {
      productId: productId,
      productName: product.name,
      color: product.color || '',
      qty: qty,
      unitPrice: unitPrice,
      delivery: DELIVERY_FEE,
      total: total,
      paid: payNow,
      due: dueAmount,
      name: name,
      phone: phone,
      address: address,
      payment: paymentMethod,
      txnId: txnId || '',
      status: 'Pending',
      timestamp: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'orders'), orderData);
    
    // Update product stock
    const newStock = product.stock - qty;
    await updateDoc(doc(db, 'products', productId), { stock: newStock });
    
    alert('Order placed successfully! You will receive confirmation soon.');
    document.getElementById('checkout-modal').classList.remove('show');
    document.getElementById('checkout-form').reset();
    
    // Redirect to status page
    window.location.href = 'status.html';
  } catch (err) {
    console.error('Error placing order:', err);
    alert('Error placing order. Please try again.');
  }
}

// STATUS PAGE (status.html)
if (window.location.pathname.includes('status.html')) {
  const statusForm = document.getElementById('status-form');
  if (statusForm) {
    statusForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const txnId = document.getElementById('txn-id').value;
      await checkOrderStatus(txnId);
    });
  }
}

async function checkOrderStatus(txnId) {
  try {
    const q = query(collection(db, 'orders'), where('txnId', '==', txnId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      alert('No order found with this transaction ID');
      return;
    }
    
    const order = snapshot.docs[0].data();
    alert(`Order Status: ${order.status}\nProduct: ${order.productName}\nTotal: ${order.total} tk\nPaid: ${order.paid} tk\nDue: ${order.due} tk`);
  } catch (err) {
    console.error('Error checking status:', err);
    alert('Error checking order status');
  }
}

// ADMIN PAGE (admin.html)
if (window.location.pathname.includes('admin.html')) {
  const loginPanel = document.getElementById('login-panel');
  const adminPanel = document.getElementById('admin-panel');
  const loginForm = document.getElementById('login-form');
  
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginPanel.style.display = 'none';
      adminPanel.style.display = 'block';
      loadAdminData();
    } else {
      loginPanel.style.display = 'block';
      adminPanel.style.display = 'none';
    }
  });
  
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value;
      const password = document.getElementById('admin-pass').value;
      
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        alert('Login failed: ' + err.message);
      }
    });
  }
  
  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await addProduct();
    });
  }
}

window.logoutAdmin = async function() {
  try {
    await signOut(auth);
  } catch (err) {
    alert('Logout failed: ' + err.message);
  }
};

window.addImageInput = function() {
  const container = document.getElementById('additional-images-container');
  const div = document.createElement('div');
  div.className = 'image-url-item';
  div.innerHTML = `
    <input type="text" class="additional-image-input" placeholder="https://example.com/image.jpg">
    <button type="button" class="danger" onclick="removeImageInput(this)">Remove</button>
  `;
  container.appendChild(div);
};

window.removeImageInput = function(btn) {
  btn.parentElement.remove();
};

async function addProduct() {
  const name = document.getElementById('add-name').value;
  const price = parseFloat(document.getElementById('add-price').value);
  const discount = parseFloat(document.getElementById('add-discount').value) || 0;
  const productCategory = document.getElementById('add-product-category').value;
  const category = document.getElementById('add-category').value;
  const color = document.getElementById('add-color').value;
  const stock = parseInt(document.getElementById('add-stock').value) || 0;
  const availability = document.getElementById('add-availability').value;
  const desc = document.getElementById('add-desc').value;
  const featuredImage = document.getElementById('add-featured-image').value;
  
  // Get additional images
  const additionalImageInputs = document.querySelectorAll('.additional-image-input');
  const additionalImages = Array.from(additionalImageInputs)
    .map(input => input.value.trim())
    .filter(url => url);
  
  // Generate slug
  const slug = generateProductSlug(name, color);
  
  try {
    const productData = {
      name,
      price,
      discount,
      productCategory,
      category,
      color,
      stock,
      availability,
      desc,
      featuredImage,
      additionalImages,
      slug,
      image: featuredImage, // Keep for backward compatibility
      createdAt: new Date().toISOString()
    };
    
    await addDoc(collection(db, 'products'), productData);
    alert('Product added successfully!');
    document.getElementById('add-product-form').reset();
    document.getElementById('additional-images-container').innerHTML = `
      <div class="image-url-item">
        <input type="text" class="additional-image-input" placeholder="https://example.com/image2.jpg">
        <button type="button" class="danger" onclick="removeImageInput(this)">Remove</button>
      </div>
    `;
    loadAdminData();
  } catch (err) {
    console.error('Error adding product:', err);
    alert('Error adding product');
  }
}

async function loadAdminData() {
  try {
    const productsSnapshot = await getDocs(collection(db, 'products'));
    products = productsSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
    
    const ordersSnapshot = await getDocs(query(collection(db, 'orders'), orderBy('timestamp', 'desc')));
    orders = ordersSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
    
    displayAdminProducts();
    displayAdminOrders();
  } catch (err) {
    console.error('Error loading admin data:', err);
  }
}

function displayAdminProducts() {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;
  
  tbody.innerHTML = products.map(p => {
    const stock = p.stock || 0;
    const availability = p.availability || 'Ready';
    let status = 'Active';
    if (stock === 0) status = 'Out of Stock';
    else if (availability === 'Upcoming') status = 'Upcoming';
    else if (availability === 'Pre Order') status = 'Pre Order';
    
    return `
      <tr>
        <td>
          <button class="toggle-details" onclick="toggleProductDetails('${p.id}')">▼</button>
        </td>
        <td contenteditable="true" onblur="updateProduct('${p.id}', 'name', this.textContent)">${p.name}</td>
        <td contenteditable="true" onblur="updateProduct('${p.id}', 'price', this.textContent)">${p.price}</td>
        <td contenteditable="true" onblur="updateProduct('${p.id}', 'productCategory', this.textContent)">${p.productCategory || 'N/A'}</td>
        <td contenteditable="true" onblur="updateProduct('${p.id}', 'category', this.textContent)">${p.category}</td>
        <td contenteditable="true" onblur="updateProduct('${p.id}', 'color', this.textContent)">${p.color || ''}</td>
        <td contenteditable="true" onblur="updateProduct('${p.id}', 'discount', this.textContent)">${p.discount || 0}</td>
        <td contenteditable="true" onblur="updateProduct('${p.id}', 'stock', this.textContent)">${stock}</td>
        <td contenteditable="true" onblur="updateProduct('${p.id}', 'availability', this.textContent)">${availability}</td>
        <td>${status}</td>
        <td>
          <button class="danger" onclick="deleteProduct('${p.id}')">Delete</button>
        </td>
      </tr>
      <tr class="details-row" id="details-${p.id}">
        <td colspan="11" class="details-content">
          <div>
            <strong>Description:</strong>
            <textarea onblur="updateProduct('${p.id}', 'desc', this.value)" style="width: 100%; min-height: 80px;">${p.desc || ''}</textarea>
          </div>
          <div style="margin-top: 10px;">
            <strong>Featured Image:</strong>
            <input type="text" value="${p.featuredImage || p.image || ''}" onblur="updateProduct('${p.id}', 'featuredImage', this.value)" style="width: 100%;">
          </div>
          <div style="margin-top: 10px;">
            <strong>Additional Images:</strong>
            <div id="admin-images-${p.id}">
              ${(p.additionalImages || []).map((img, idx) => `
                <div style="display: flex; gap: 8px; margin-top: 5px;">
                  <input type="text" value="${img}" onblur="updateProductImage('${p.id}', ${idx}, this.value)" style="flex: 1;">
                  <button class="danger" onclick="removeProductImage('${p.id}', ${idx})">Remove</button>
                </div>
              `).join('')}
            </div>
            <button class="secondary" onclick="addProductImage('${p.id}')" style="margin-top: 8px;">+ Add Image</button>
          </div>
          <div style="margin-top: 10px;">
            <strong>Product URL:</strong> 
            <a href="product.html?slug=${p.slug}" target="_blank">product.html?slug=${p.slug}</a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.toggleProductDetails = function(productId) {
  const detailsRow = document.getElementById('details-' + productId);
  if (detailsRow) {
    detailsRow.classList.toggle('show');
  }
};

window.updateProduct = async function(productId, field, value) {
  try {
    let updateValue = value;
    if (field === 'price' || field === 'discount' || field === 'stock') {
      updateValue = parseFloat(value) || 0;
    }
    
    const updateData = { [field]: updateValue };
    
    // If name or color changed, regenerate slug
    if (field === 'name' || field === 'color') {
      const product = products.find(p => p.id === productId);
      const newName = field === 'name' ? value : product.name;
      const newColor = field === 'color' ? value : product.color;
      updateData.slug = generateProductSlug(newName, newColor);
    }
    
    await updateDoc(doc(db, 'products', productId), updateData);
    await loadAdminData();
  } catch (err) {
    console.error('Error updating product:', err);
    alert('Error updating product');
  }
};

window.updateProductImage = async function(productId, imageIndex, newValue) {
  try {
    const product = products.find(p => p.id === productId);
    const additionalImages = [...(product.additionalImages || [])];
    additionalImages[imageIndex] = newValue;
    
    await updateDoc(doc(db, 'products', productId), { additionalImages });
    await loadAdminData();
  } catch (err) {
    console.error('Error updating image:', err);
    alert('Error updating image');
  }
};

window.removeProductImage = async function(productId, imageIndex) {
  try {
    const product = products.find(p => p.id === productId);
    const additionalImages = [...(product.additionalImages || [])];
    additionalImages.splice(imageIndex, 1);
    
    await updateDoc(doc(db, 'products', productId), { additionalImages });
    await loadAdminData();
  } catch (err) {
    console.error('Error removing image:', err);
    alert('Error removing image');
  }
};

window.addProductImage = async function(productId) {
  const newUrl = prompt('Enter image URL:');
  if (!newUrl) return;
  
  try {
    const product = products.find(p => p.id === productId);
    const additionalImages = [...(product.additionalImages || []), newUrl];
    
    await updateDoc(doc(db, 'products', productId), { additionalImages });
    await loadAdminData();
  } catch (err) {
    console.error('Error adding image:', err);
    alert('Error adding image');
  }
};

window.deleteProduct = async function(productId) {
  if (!confirm('Are you sure you want to delete this product?')) return;
  
  try {
    await deleteDoc(doc(db, 'products', productId));
    alert('Product deleted successfully');
    await loadAdminData();
  } catch (err) {
    console.error('Error deleting product:', err);
    alert('Error deleting product');
  }
};

function displayAdminOrders() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  
  tbody.innerHTML = orders.map(o => {
    const date = new Date(o.timestamp).toLocaleString();
    
    return `
      <tr>
        <td>
          <button class="toggle-details" onclick="toggleOrderDetails('${o.id}')">▼</button>
        </td>
        <td>${date}</td>
        <td>${o.productName}</td>
        <td>${o.color || 'N/A'}</td>
        <td>${o.qty}</td>
        <td>${o.delivery} tk</td>
        <td>${o.paid} tk</td>
        <td>${o.due} tk</td>
        <td>${o.name}</td>
        <td>${o.phone}</td>
        <td>${o.address}</td>
        <td>${o.payment}</td>
        <td>${o.txnId || 'N/A'}</td>
        <td contenteditable="true" onblur="updateOrder('${o.id}', 'status', this.textContent)">${o.status}</td>
      </tr>
      <tr class="details-row" id="order-details-${o.id}">
        <td colspan="14" class="details-content">
          <div><strong>Total:</strong> ${o.total} tk</div>
          <div><strong>Unit Price:</strong> ${o.unitPrice} tk</div>
        </td>
      </tr>
    `;
  }).join('');
}

window.toggleOrderDetails = function(orderId) {
  const detailsRow = document.getElementById('order-details-' + orderId);
  if (detailsRow) {
    detailsRow.classList.toggle('show');
  }
};

window.updateOrder = async function(orderId, field, value) {
  try {
    await updateDoc(doc(db, 'orders', orderId), { [field]: value });
    await loadAdminData();
  } catch (err) {
    console.error('Error updating order:', err);
    alert('Error updating order');
  }
};