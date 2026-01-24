// js/pages/product-detail.js
import { loadProducts, shuffle, createProductCard } from '../products.js';
import { createMainImageShimmer, createThumbnailShimmer, createInfoLineShimmer, setupImageViewer } from '../ui-helpers.js';
import { addToCart } from '../cart.js';
import { openCheckoutModal } from '../checkout-single.js';

export async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlSlug = urlParams.get('slug');
  if (!urlSlug) {
    alert('Product not found');
    return;
  }

  const mainImg = document.getElementById('main-image');
  const thumbnailGallery = document.getElementById('thumbnail-gallery');
  const nameEl = document.getElementById('product-name');
  const colorEl = document.getElementById('product-color');
  const priceEl = document.getElementById('product-price');
  const badgesEl = document.getElementById('product-badges');
  const specEl = document.getElementById('product-spec');
  const descEl = document.getElementById('product-detailed-desc');
  const orderRow = document.getElementById('order-row');

  mainImg.parentNode.replaceChild(createMainImageShimmer(), mainImg);
  nameEl.innerHTML = '';
  nameEl.appendChild(createInfoLineShimmer());
  nameEl.appendChild(createInfoLineShimmer());
  colorEl.innerHTML = '';
  colorEl.appendChild(createInfoLineShimmer());
  priceEl.innerHTML = '';
  priceEl.appendChild(createInfoLineShimmer());
  badgesEl.innerHTML = '';
  for (let i = 0; i < 2; i++) {
    const badge = document.createElement('div');
    badge.className = 'shimmer-badge';
    badgesEl.appendChild(badge);
  }
  specEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const line = createInfoLineShimmer();
    line.style.width = `${70 + Math.random() * 20}%`;
    specEl.appendChild(line);
  }
  descEl.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const line = createInfoLineShimmer();
    line.style.width = `${70 + Math.random() * 20}%`;
    descEl.appendChild(line);
  }
  orderRow.innerHTML = '';
  const btnShimmer = document.createElement('div');
  btnShimmer.className = 'shimmer-button';
  orderRow.appendChild(btnShimmer);
  for (let i = 0; i < 3; i++) {
    thumbnailGallery.appendChild(createThumbnailShimmer());
  }
  const otherSection = document.getElementById('other-products');
  for (let i = 0; i < 4; i++) {
    otherSection.appendChild(createShimmerCard());
  }

  const products = await loadProducts();
  let product = null;
  for (const p of products) {
    const sameName = products.filter(other => other.name.toLowerCase() === p.name.toLowerCase());
    let slug = p.name.toLowerCase().replace(/\s+/g, '-');
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

  document.title = product.metaTitle || product.name;
  document.querySelector('#meta-description').setAttribute('content', product.metaDescription || '');
  const sameName = products.filter(p => p.name.toLowerCase() === product.name.toLowerCase());
  let slug = product.name.toLowerCase().replace(/\s+/g, '-');
  if (sameName.length > 1 && product.color) {
    slug += '-' + product.color.toLowerCase().replace(/\s+/g, '-');
  }
  document.getElementById('canonical-link').href = `/product/${slug}`;

  const images = product.images || [];
  const realMainImg = document.createElement('img');
  realMainImg.id = 'main-image';
  realMainImg.src = images[0] || '';
  realMainImg.alt = product.name;
  document.querySelector('.shimmer-image-placeholder').parentNode.replaceChild(realMainImg, document.querySelector('.shimmer-image-placeholder'));

  nameEl.innerHTML = product.name;
  colorEl.innerText = `Color: ${product.color || '-'}`;

  const isUpcoming = product.availability === 'Upcoming';
  const hasDiscount = Number(product.discount) > 0;
  const price = Number(product.price) || 0;
  const finalPrice = hasDiscount ? (price - Number(product.discount)) : price;
  const isInStock = Number(product.stock) > 0 && product.availability === 'Ready';

  priceEl.innerHTML = isUpcoming ? 'TBA' : `${hasDiscount ? `<s>৳${price.toFixed(2)}</s> ` : ''}৳${finalPrice.toFixed(2)}`;

  badgesEl.innerHTML = `
    ${product.hotDeal ? `<span class="badge hot">HOT DEAL</span>` : ''}
    ${isInStock ? `<span class="badge new">IN STOCK</span>` : ''}
    ${!isUpcoming && Number(product.stock) <= 0 && product.availability !== 'Pre Order' ? `<span class="badge oos">OUT OF STOCK</span>` : ''}
    ${isUpcoming ? `<span class="badge upcoming">UPCOMING</span>` : ''}
    ${product.availability === 'Pre Order' ? `<span class="badge preorder">PRE ORDER</span>` : ''}
  `;

  specEl.innerText = product.description || '';
  descEl.innerHTML = product.detailedDescription ? product.detailedDescription.replace(/\n/g, '') : '';

  const button = document.createElement('button');
  if (isUpcoming) {
    button.textContent = 'Upcoming - Stay Tuned';
    button.disabled = true;
  } else if (product.availability === 'Pre Order') {
    button.className = 'preorder-btn';
    button.textContent = 'Pre Order';
    button.onclick = () => openCheckoutModal(product.id, true);
  } else if (Number(product.stock) > 0) {
    button.textContent = 'Order Now';
    button.onclick = () => openCheckoutModal(product.id);
  } else {
    button.textContent = 'Out of Stock';
    button.disabled = true;
  }
  orderRow.innerHTML = '';
  orderRow.appendChild(button);

  const addToCartBtn = document.createElement('button');
  addToCartBtn.innerHTML = '🛒';
  addToCartBtn.title = 'Add to Cart';
  addToCartBtn.style.marginTop = '';
  addToCartBtn.style.width = '100%';
  addToCartBtn.style.padding = '14px';
  addToCartBtn.style.fontSize = '24px';
  addToCartBtn.style.backgroundColor = '#10b981';
  addToCartBtn.style.color = 'white';
  addToCartBtn.style.border = 'none';
  addToCartBtn.style.borderRadius = '12px';
  addToCartBtn.style.cursor = 'pointer';
  addToCartBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

  const isOOS = !isUpcoming && Number(product.stock) <= 0 && product.availability !== 'Pre Order';

  if (isUpcoming || isOOS) {
    addToCartBtn.innerHTML = isUpcoming ? '⏳' : '❌';
    addToCartBtn.title = isUpcoming ? 'Upcoming' : 'Out of Stock';
    addToCartBtn.disabled = true;
    addToCartBtn.style.backgroundColor = '#6b7280';
    addToCartBtn.style.cursor = 'not-allowed';
  } else {
    addToCartBtn.onclick = () => {
      const qtyInput = document.getElementById('co-qty');
      const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
      addToCart(product.id, qty);
      alert('Added to cart!');
    };
  }

  orderRow.appendChild(addToCartBtn);
  thumbnailGallery.innerHTML = '';
  if (images.length > 1) {
    images.slice(1).forEach(src => {
      const thumb = document.createElement('img');
      thumb.src = src;
      thumb.alt = product.name;
      thumb.className = 'thumbnail';
      thumb.onclick = () => { realMainImg.src = src; };
      thumbnailGallery.appendChild(thumb);
    });
  }

  otherSection.innerHTML = '';
  const eligible = products.filter(p => p.availability !== 'Upcoming' && p.id !== product.id);
  const random4 = shuffle(eligible).slice(0, 4);
  random4.forEach(p => otherSection.appendChild(createProductCard(p, products)));

  document.getElementById('close-modal-btn').onclick = closeCheckoutModal;
  const form = document.getElementById('checkout-form');
  form.addEventListener('submit', submitCheckoutOrder);
  document.getElementById('co-payment').addEventListener('change', handlePaymentChange);
  document.getElementById('co-qty').addEventListener('input', updateTotalInModal);
  document.getElementById('co-address').addEventListener('input', updateDeliveryCharge);
  setupImageViewer();

  realMainImg.addEventListener('click', () => {
    document.getElementById('viewer-img').src = realMainImg.src;
    document.getElementById('image-viewer').classList.add('show');
  });
}