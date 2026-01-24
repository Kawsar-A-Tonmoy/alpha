// js/cart.js
import { productsMap } from './products.js';

export function getCart() {
  const cart = localStorage.getItem('cart');
  return cart ? JSON.parse(cart) : [];
}

export function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartUI();
}

export function addToCart(productId, qty = 1) {
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
}

export function removeFromCart(productId) {
  let cart = getCart();
  cart = cart.filter(item => item.id !== productId);
  saveCart(cart);
}

export function updateCartQuantity(productId, newQty) {
  if (newQty < 1) {
    removeFromCart(productId);
    return;
  }
  let cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (item) item.qty = newQty;
  saveCart(cart);
}

export function updateCartUI() {
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
          <button class="qty-minus" title="Decrease">-</button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-plus" title="Increase">+</button>
          <button class="remove-btn" title="Remove item">🗑️</button>
        </div>
      </div>
    `;

    const minusBtn = div.querySelector('.qty-minus');
    const plusBtn = div.querySelector('.qty-plus');
    const removeBtn = div.querySelector('.remove-btn');
    const qtyDisplay = div.querySelector('.qty-display');

    minusBtn.addEventListener('click', () => {
      updateCartQuantity(item.id, item.qty - 1);
      qtyDisplay.textContent = Math.max(1, item.qty - 1);
    });

    plusBtn.addEventListener('click', () => {
      updateCartQuantity(item.id, item.qty + 1);
      qtyDisplay.textContent = item.qty + 1;
    });

    removeBtn.addEventListener('click', () => {
      removeFromCart(item.id);
    });

    itemsContainer.appendChild(div);
  });

  if (totalEl) totalEl.innerHTML = `<strong>Total: ৳${total}</strong>`;
}