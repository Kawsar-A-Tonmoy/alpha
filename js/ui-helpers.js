// js/ui-helpers.js
export const statusExplanations = {
  Pending: 'Order received, waiting for processing.',
  Processing: 'Your order is being prepared.',
  Dispatched: 'Your order has been shipped.',
  Delivered: 'Your order has been delivered.',
  Cancelled: 'Your order has been cancelled.'
};

export const statusColors = {
  Pending: '#eab308',
  Processing: '#3b82f6',
  Dispatched: '#eab308',
  Delivered: '#22c55e',
  Cancelled: '#ef4444'
};

export function createShimmerCard() {
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

export function createMainImageShimmer() {
  const img = document.createElement('div');
  img.className = 'shimmer-image-placeholder';
  return img;
}

export function createThumbnailShimmer() {
  const thumb = document.createElement('div');
  thumb.className = 'thumbnail shimmer-thumbnail';
  return thumb;
}

export function createInfoLineShimmer() {
  const line = document.createElement('div');
  line.className = 'shimmer-line';
  return line;
}

export function setupImageViewer() {
  const viewer = document.getElementById('image-viewer');
  const viewerImg = document.getElementById('viewer-img');
  const closeViewer = document.getElementById('close-viewer');

  if (!viewer || !viewerImg || !closeViewer) return;

  document.querySelectorAll('.product-card img, #main-image').forEach(img => {
    img.style.cursor = 'pointer';
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      viewerImg.src = img.src;
      viewerImg.alt = img.alt;
      viewer.classList.add('show');
    });
  });

  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) {
      viewer.classList.remove('show');
      viewer.classList.remove('zoomed');
    }
  });

  closeViewer.addEventListener('click', () => {
    viewer.classList.remove('show');
    viewer.classList.remove('zoomed');
  });

  viewerImg.addEventListener('dblclick', () => {
    viewer.classList.toggle('zoomed');
  });
}

export function calculateDeliveryFee(address) {
  const lowerAddr = address.toLowerCase();
  if (lowerAddr.includes("savar")) return 70;
  else if (lowerAddr.includes("dhaka")) return 110;
  return 150;
}