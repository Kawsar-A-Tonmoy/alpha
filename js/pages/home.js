// js/pages/home.js
import { loadProducts, categories, shuffle, createCategoryCard, createProductCard } from '../products.js';
import { createShimmerCard, setupImageViewer } from '../ui-helpers.js';

export async function initHomePage() {
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