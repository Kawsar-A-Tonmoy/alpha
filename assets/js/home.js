// home.js
(async function(){
  const interestList = document.getElementById('interest-list');
  const productsRef = db.collection('products');

  // get all products
  const snap = await productsRef.get();
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // pick 5 random
  const sample = all.sort(()=>0.5 - Math.random()).slice(0,5);
  sample.forEach(renderCard);

  function renderCard(p){
    const card = document.createElement('a');
    card.className = 'product-card card';
    card.href = `product.html?slug=${encodeURIComponent(p.slug)}`;
    card.innerHTML = `
      <div class="img" style="background-image:url(${p.featuredImage})"></div>
      <div class="body">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="muted">${escapeHtml(p.color || '')}</p>
        <div class="price">${p.price ? p.price + ' tk' : ''}</div>
      </div>
    `;
    interestList.appendChild(card);
  }

  // categories click
  document.querySelectorAll('.cat-card').forEach(btn=>{
    btn.addEventListener('click', ()=> {
      const cat = btn.dataset.cat;
      location.href = `products.html?category=${encodeURIComponent(cat)}`;
    });
  });

  // util
  function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) }
})();
