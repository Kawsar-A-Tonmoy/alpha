// product.js
(async function(){
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');
  if (!slug) {
    document.getElementById('product-detail').innerHTML = '<p>Product not found.</p>';
    return;
  }

  const q = await db.collection('products').where('slug','==', slug).limit(1).get();
  if (q.empty) {
    document.getElementById('product-detail').innerHTML = '<p>Product not found.</p>';
    return;
  }
  const data = q.docs[0].data();

  document.getElementById('p-name').textContent = data.name;
  document.getElementById('p-category').textContent = data.category || '';
  document.getElementById('p-price').textContent = data.price ? data.price + ' tk' : '';
  document.getElementById('p-desc').innerHTML = data.description || '';

  const featured = document.getElementById('featured-img');
  featured.src = data.featuredImage;
  const thumbs = document.getElementById('thumbs');

  (data.images || []).forEach(url=>{
    const im = document.createElement('img');
    im.src = url;
    im.alt = data.name;
    im.addEventListener('click', ()=> featured.src = url);
    thumbs.appendChild(im);
  });

  // canonical link
  const canonical = document.getElementById('canonicalLink');
  canonical.href = location.href;
})();
