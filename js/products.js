import { db, auth, collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where } from './firebase.js';

export async function loadProducts() {
  const products = await getDocs(collection(db, 'products'));
  const productArray = products.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const random4 = productArray.sort(() => 0.5 - Math.random()).slice(0, 4);
  const container = document.getElementById('mayInterest');
  container.innerHTML = '';
  random4.forEach(prod => container.appendChild(renderProductCard(prod)));
}

export async function loadCategoryProducts() {
  const urlParams = new URLSearchParams(window.location.search);
  const cat = urlParams.get('cat');
  const q = query(collection(db, 'products'), where('category', '==', cat));
  const products = await getDocs(q);
  const container = document.getElementById('categoryProducts');
  container.innerHTML = '';
  products.forEach(doc => {
    const prod = { id: doc.id, ...doc.data() };
    container.appendChild(renderProductCard(prod));
  });
}

export async function loadProduct() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const prodDoc = await getDoc(doc(db, 'products', id));
  const prod = prodDoc.data();
  document.getElementById('name').textContent = prod.name;
  document.getElementById('color').textContent = `Color: ${prod.color}`;
  document.getElementById('price').textContent = `Price: ${prod.price} (Discount: ${prod.discount || 0})`;
  document.getElementById('description').textContent = prod.description;

  const imagesDiv = document.getElementById('images');
  imagesDiv.innerHTML = `<img src="${prod.featureImage}" alt="${prod.name}" style="width:100%;">`;
  prod.showcaseImages.forEach(img => imagesDiv.innerHTML += `<img src="${img}" alt="Showcase" style="width:100%; margin-top:10px;">`);

  const orderBtn = document.getElementById('orderBtn');
  if (prod.availability === 'upcoming') {
    orderBtn.textContent = 'Upcoming';
    orderBtn.classList.add('grayed');
    orderBtn.disabled = true;
  } else if (prod.availability === 'preorder') {
    orderBtn.textContent = 'Pre Order';
    orderBtn.onclick = () => showOrderForm([{ ...prod, id, quantity: 1 }]);
  } else {
    orderBtn.textContent = 'Order';
    orderBtn.onclick = () => showOrderForm([{ ...prod, id, quantity: 1 }]);
  }

  document.getElementById('addToCartBtn').onclick = () => addToCart(id, 1);

  // Related products
  const allProducts = await getDocs(collection(db, 'products'));
  const random4 = allProducts.docs.map(d => ({ id: d.id, ...d.data() })).sort(() => 0.5 - Math.random()).slice(0, 4);
  const related = document.getElementById('related');
  random4.forEach(p => related.appendChild(renderProductCard(p)));
}

function renderProductCard(prod) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.innerHTML = `
    <img src="${prod.featureImage}" alt="${prod.name}" style="width:100%;">
    <h3>${prod.name}</h3>
    <p>Color: ${prod.color}</p>
    <p>Price: ${prod.price} ${prod.discount ? `(Discount: ${prod.discount})` : ''}</p>
  `;
  const addCartBtn = document.createElement('button');
  addCartBtn.className = 'button';
  addCartBtn.textContent = 'Add to Cart';
  addCartBtn.onclick = () => addToCart(prod.id, 1);
  card.appendChild(addCartBtn);

  const orderBtn = document.createElement('button');
  orderBtn.className = 'button';
  if (prod.availability === 'upcoming') {
    orderBtn.textContent = 'Upcoming';
    orderBtn.classList.add('grayed');
    orderBtn.disabled = true;
  } else if (prod.availability === 'preorder') {
    orderBtn.textContent = 'Pre Order';
    orderBtn.onclick = () => showOrderForm([{ ...prod, id: prod.id, quantity: 1 }]);
  } else {
    orderBtn.textContent = 'Order';
    orderBtn.onclick = () => showOrderForm([{ ...prod, id: prod.id, quantity: 1 }]);
  }
  card.appendChild(orderBtn);

  card.onclick = (e) => {
    if (!e.target.closest('button')) window.location.href = `product.html?id=${prod.id}`;
  };
  return card;
}

// Admin functions
if (document.getElementById('addProductForm')) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) return window.location.href = 'login.html';
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.data().isAdmin) return window.location.href = 'index.html';

    // Load products for edit/remove
    const products = await getDocs(collection(db, 'products'));
    const list = document.getElementById('productList');
    products.forEach((pDoc) => {
      const prod = pDoc.data();
      const div = document.createElement('div');
      div.innerHTML = `<p>${prod.name} - ${prod.color}</p>`;
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.onclick = () => {
        // Populate form with data, change submit to update
        document.getElementById('name').value = prod.name;
        // ... fill others
        document.getElementById('addProductForm').onsubmit = async (e) => {
          e.preventDefault();
          // Get values, updateDoc(doc(db, 'products', pDoc.id), data);
          alert('Updated!');
        };
      };
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.onclick = () => deleteDoc(doc(db, 'products', pDoc.id)).then(() => alert('Deleted!'));
      div.append(editBtn, deleteBtn);
      list.appendChild(div);
    });
  });

  document.getElementById('addProductForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('name').value,
      color: document.getElementById('color').value,
      price: parseFloat(document.getElementById('price').value),
      discount: parseFloat(document.getElementById('discount').value || 0),
      featureImage: document.getElementById('featureImage').value,
      showcaseImages: document.getElementById('showcaseImages').value.split(',').map(s => s.trim()) || [],
      stock: parseInt(document.getElementById('stock').value),
      availability: document.getElementById('availability').value,
      category: document.getElementById('category').value,
      description: document.getElementById('description').value,
      slug: document.getElementById('name').value.toLowerCase().replace(/\s+/g, '-') + '-' + document.getElementById('color').value.toLowerCase() // Simple slug
    };
    await addDoc(collection(db, 'products'), data);
    alert('Product added!');
    document.getElementById('addProductForm').reset();
  });
}