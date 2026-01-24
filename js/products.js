// js/pages/products.js
import { loadProducts, createProductCard } from '../products.js';
import { createShimmerCard, setupImageViewer } from '../ui-helpers.js';

export async function initProductsPage() {
  const title = document.getElementById('products-title');
  const list = document.getElementById('product-list');
  if (!list) return;

  const urlParams = new URLSearchParams(window.location.search);
  const category = urlParams.get('category');
  if (category) title.innerText = category;
  else title.innerText = 'All Products';

  for (let i = 0; i < 8; i++) list.appendChild(createShimmerCard());

  const products = await loadProducts();
  list.innerHTML = '';
  const filtered = category ? products.filter(p => p.category === category) : products;
  filtered.forEach(p => list.appendChild(createProductCard(p, products)));

  setupImageViewer();
}