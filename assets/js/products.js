// products.js
(async function(){
  const grid = document.getElementById('products-grid');
  const params = new URLSearchParams(location.search);
  const categoryFilter = params.get('category');

  let query = db.collection('products').orderBy('createdAt','desc');
  if (categoryFilter) query = query.where('category','==', categoryFilter);

  const snap = await query.get();
  snap.docs.forEach(d => {
    const p = { id: d.id, ...d.data() };
    const a = document.createElement('a');
    a.className = 'product-card card';
    a.href = `product.html?slug=${encodeURIComponent(p.slug)}`;
    a.innerHTML = `
      <div class="img" style="background-image:url(${p.featuredImage})"></div>
      <div class="body">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="muted">${escapeHtml(p.color||'')}</p>
        <div class="price">${p.price ? p.price + ' tk' : ''}</div>
      </div>
    `;
    grid.appendChild(a);
  });

  function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) }
})();
