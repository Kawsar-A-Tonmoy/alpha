// filter.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let filterSections = [];

async function loadFilterSections() {
  try {
    const snapshot = await getDocs(collection(db, 'filterSections'));
    filterSections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    window.filterSections = filterSections; // make accessible if needed
    return filterSections;
  } catch (err) {
    console.error('Error loading filter sections:', err);
    return [];
  }
}

function renderFilterCheckboxes(containerId, selected = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  filterSections.forEach(sec => {
    const sectionDiv = document.createElement('div');
    sectionDiv.innerHTML = `<h3>${sec.name}</h3>`;

    sec.tags?.forEach(tag => {
      const label = document.createElement('label');
      label.style.display = 'block';
      label.style.margin = '6px 0';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = `filter_${sec.name.replace(/\s+/g, '_')}`;
      input.value = tag;

      if (selected[sec.name]?.includes(tag)) {
        input.checked = true;
      }

      label.appendChild(input);
      label.append(` ${tag}`);
      sectionDiv.appendChild(label);
    });

    container.appendChild(sectionDiv);
  });
}

function getCurrentFilters() {
  const filters = {};
  filterSections.forEach(sec => {
    const checked = document.querySelectorAll(
      `#filter-tags input[name="filter_${sec.name.replace(/\s+/g, '_')}"]:checked`
    );
    if (checked.length > 0) {
      filters[sec.name] = Array.from(checked).map(cb => cb.value);
    }
  });
  return filters;
}

document.addEventListener('DOMContentLoaded', async () => {
  // Only run on pages that need filtering
  if (!document.getElementById('product-list') && 
      !document.getElementById('categoryProducts')) {
    return;
  }

  const listEl = document.getElementById('product-list') || document.getElementById('categoryProducts');
  if (!listEl) return;

  // Load filter sections once
  await loadFilterSections();
  renderFilterCheckboxes('filter-tags', {});

  // Get current products (assuming script.js sets window.allProducts or window.productsMap)
  const allProducts = window.allProducts || Array.from(window.productsMap?.values() || []);

  // Find realistic max price
  let maxPrice = 0;
  allProducts.forEach(p => {
    const effective = Number(p.price) - Number(p.discount || 0);
    if (effective > maxPrice) maxPrice = effective;
  });
  maxPrice = Math.ceil(maxPrice / 100) * 100 || 100000;

  const maxSlider = document.getElementById('max-slider');
  const maxInput  = document.getElementById('filter-max-price');

  if (maxSlider) {
    maxSlider.max = maxPrice;
    maxSlider.value = maxPrice;
    maxInput.placeholder = maxPrice.toLocaleString();
  }

  // Sync slider ↔ input (only max)
  maxSlider?.addEventListener('input', () => {
    let v = Number(maxSlider.value);
    maxInput.value = v;
  });

  maxInput?.addEventListener('input', () => {
    let v = Number(maxInput.value) || maxPrice;
    if (v > maxPrice) v = maxPrice;
    if (v < 0) v = 0;
    maxSlider.value = v;
  });

  // Apply filter
  document.getElementById('filter-form')?.addEventListener('submit', e => {
    e.preventDefault();

    const maxP = Number(maxInput?.value) || Infinity;
    const selected = getCurrentFilters();

    let filtered = allProducts.filter(p => {
      const price = Number(p.price) - Number(p.discount || 0);
      if (price > maxP) return false;

      for (const section in selected) {
        if (!p.filters?.[section] || 
            !selected[section].some(tag => p.filters[section].includes(tag))) {
          return false;
        }
      }
      return true;
    });

    // Force full list when no tags are selected AND price is unrestricted
    if (Object.keys(selected).length === 0 && maxP === Infinity) {
      filtered = allProducts;
    }

    // Keep category filter from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const cat = urlParams.get('category');
    if (cat) {
      filtered = filtered.filter(p => p.category === decodeURIComponent(cat));
    }

    listEl.innerHTML = '';
    if (filtered.length === 0) {
      listEl.innerHTML = '<p style="text-align:center; padding:40px;">No products match the selected filters.</p>';
    } else {
      filtered.forEach(p => {
        const card = createProductCard(p, filtered); // assumes this function exists globally
        listEl.appendChild(card);
      });
    }

    document.getElementById('filter-slider')?.classList.remove('open');
  });

  // Clear filters – now directly rebuilds the list (fixes "no products" bug)
  document.getElementById('clear-filter')?.addEventListener('click', () => {
    if (maxInput) maxInput.value = '';
    if (maxSlider) maxSlider.value = maxPrice;

    document.querySelectorAll('#filter-tags input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });

    // Directly show (almost) all products – respecting category if present
    listEl.innerHTML = '';

    let displayProducts = allProducts;

    const urlParams = new URLSearchParams(window.location.search);
    const cat = urlParams.get('category');
    if (cat) {
      displayProducts = allProducts.filter(p => p.category === decodeURIComponent(cat));
    }

    if (displayProducts.length === 0) {
      listEl.innerHTML = '<p style="text-align:center; padding:40px;">No products in this category.</p>';
    } else {
      displayProducts.forEach(p => {
        const card = createProductCard(p, displayProducts);
        listEl.appendChild(card);
      });
    }

    document.getElementById('filter-slider')?.classList.remove('open');
  });

  // Open / close slider
  document.getElementById('filter-btn')?.addEventListener('click', () => {
    document.getElementById('filter-slider')?.classList.add('open');
  });

  document.getElementById('close-filter')?.addEventListener('click', () => {
    document.getElementById('filter-slider')?.classList.remove('open');
  });
});
