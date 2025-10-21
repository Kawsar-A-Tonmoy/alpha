// admin.js
(function(){
  const form = document.getElementById('product-form');
  const existingGrid = document.getElementById('existing-grid');

  loadExisting();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const color = document.getElementById('color').value.trim();
    const category = document.getElementById('category').value;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const desc = document.getElementById('description').value;
    const featuredFile = document.getElementById('featured-file').files[0];
    const otherFiles = Array.from(document.getElementById('other-files').files || []);

    if (!name || !featuredFile) { alert('Name and featured image required'); return; }

    // generate slug (base)
    let base = slugify(name);
    if (color) base += '-' + slugify(color);

    let slug = base;
    // ensure unique slug: query products for slug
    let i = 1;
    while (true) {
      const snap = await db.collection('products').where('slug','==',slug).limit(1).get();
      if (snap.empty) break;
      slug = `${base}-${i++}`;
    }

    // upload featured
    const timestamp = Date.now();
    const featRef = storage.ref().child(`products/${slug}/featured-${timestamp}`);
    const featSnap = await featRef.put(featuredFile);
    const featURL = await featSnap.ref.getDownloadURL();

    // upload other images
    const otherURLs = [];
    for (const f of otherFiles){
      const r = storage.ref().child(`products/${slug}/img-${Date.now()}-${f.name}`);
      const s = await r.put(f);
      otherURLs.push(await s.ref.getDownloadURL());
    }

    const productData = {
      name, color, category, price, description: desc,
      featuredImage: featURL, images: otherURLs, slug,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('products').add(productData);
    alert('Product added');
    form.reset();
    existingGrid.innerHTML = '';
    loadExisting();
  });

  async function loadExisting(){
    const snap = await db.collection('products').orderBy('createdAt','desc').get();
    snap.docs.forEach(d=>{
      const p = d.data();
      const a = document.createElement('a');
      a.className = 'product-card card';
      a.href = `product.html?slug=${encodeURIComponent(p.slug)}`;
      a.target = '_blank';
      a.innerHTML = `
        <div class="img" style="background-image:url(${p.featuredImage})"></div>
        <div class="body">
          <h3>${escapeHtml(p.name)}</h3>
          <p class="muted">${escapeHtml(p.color||'')}</p>
          <div class="price">${p.price ? p.price + ' tk' : ''}</div>
        </div>
      `;
      existingGrid.appendChild(a);
    });
  }

  function slugify(s){
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  }
  function escapeHtml(s){ return (s||'').toString().replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) }
})();
