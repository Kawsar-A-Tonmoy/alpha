// js/admin-products.js
import { db, addDoc, collection, updateDoc, doc, deleteDoc } from './firebase.js';
import { loadProducts } from './products.js';

export async function addProduct(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('add-name').value.trim(),
    price: document.getElementById('add-price').value.trim() === 'TBA' ? 'TBA' : Number(document.getElementById('add-price').value) || 0,
    discount: Number(document.getElementById('add-discount').value) || 0,
    images: document.getElementById('add-images').value.split(',').map(u => u.trim()).filter(u => u),
    category: document.getElementById('add-category').value,
    color: document.getElementById('add-color').value.trim(),
    stock: Number(document.getElementById('add-stock').value) || 0,
    availability: document.getElementById('add-availability').value,
    hotDeal: !!document.getElementById('add-hotdeal')?.checked,
    description: document.getElementById('add-desc').value.trim(),
    detailedDescription: document.getElementById('add-detailed-desc').value.trim(),
    metaTitle: document.getElementById('add-meta-title').value.trim(),
    metaDescription: document.getElementById('add-meta-desc').value.trim()
  };
  try {
    await addDoc(collection(db, 'products'), data);
    e.target.reset();
    renderDataTable();
  } catch (err) {
    console.error('Add product error:', err);
    alert('Error adding product: ' + err.message);
  }
}

export async function renderDataTable() {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;
  const products = await loadProducts();
  tbody.innerHTML = '';
  const cols = [
    { key: 'name' },
    { key: 'price' },
    { key: 'category' },
    { key: 'color' },
    { key: 'discount' },
    { key: 'stock' },
    { key: 'availability' }
  ];
  products.forEach(p => {
    const tr = document.createElement('tr');
    const tdToggle = document.createElement('td');
    tdToggle.className = 'toggle-details';
    tdToggle.innerHTML = 'Down Arrow';
    tdToggle.addEventListener('click', (e) => {
      const detailsRow = e.target.closest('tr').nextElementSibling;
      const isVisible = detailsRow.classList.contains('show');
      detailsRow.classList.toggle('show', !isVisible);
      e.target.textContent = isVisible ? 'Down Arrow' : 'Up Arrow';
    });
    tr.appendChild(tdToggle);

    cols.forEach(col => {
      const td = document.createElement('td');
      td.contentEditable = true;
      td.textContent = p[col.key] != null ? String(p[col.key]) : '';
      td.addEventListener('blur', async (e) => {
        const val = e.target.textContent.trim();
        if (val === (p[col.key] != null ? String(p[col.key]) : '')) return;

        let updateValue = val;
        if (col.key === 'price') {
          if (val !== 'TBA' && isNaN(Number(val))) {
            alert('Price must be a number or "TBA".');
            e.target.textContent = p[col.key] != null ? String(p[col.key]) : '';
            return;
          }
          updateValue = val === 'TBA' ? 'TBA' : Number(val);
        } else if (col.key === 'discount' || col.key === 'stock') {
          if (isNaN(Number(val))) {
            alert(`${col.key.charAt(0).toUpperCase() + col.key.slice(1)} must be a number.`);
            e.target.textContent = p[col.key] != null ? String(p[col.key]) : '';
            return;
          }
          updateValue = Number(val);
        } else if (col.key === 'availability') {
          if (!['Ready', 'Pre Order', 'Upcoming'].includes(val)) {
            alert('Availability must be Ready, Pre Order, or Upcoming.');
            e.target.textContent = p[col.key] != null ? String(p[col.key]) : '';
            return;
          }
        }
        await updateProductField(p.id, col.key, updateValue);
        if (col.key === 'stock' || col.key === 'availability') {
          const cur = (await loadProducts()).find(x => x.id === p.id);
          tr.querySelector('td[data-status="1"]').textContent = computeStatus(cur);
        }
      });
      tr.appendChild(td);
    });

    const tdHotDeal = document.createElement('td');
    const hotDealInput = document.createElement('input');
    hotDealInput.type = 'checkbox';
    hotDealInput.checked = !!p.hotDeal;
    hotDealInput.addEventListener('change', async () => {
      await updateProductField(p.id, 'hotDeal', hotDealInput.checked);
    });
    tdHotDeal.appendChild(hotDealInput);
    tr.appendChild(tdHotDeal);

    const tdStatus = document.createElement('td');
    tdStatus.dataset.status = '1';
    tdStatus.textContent = computeStatus(p);
    tr.appendChild(tdStatus);

    const tdActions = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (confirm(`Delete "${p.name}"?`)) await deleteProductById(p.id);
    });
    tdActions.appendChild(del);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);

    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = cols.length + 4;
    detailsCell.className = 'details-content';

    const imagesCell = document.createElement('div');
    imagesCell.contentEditable = true;
    imagesCell.textContent = p.images ? p.images.join(', ') : '';
    imagesCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.images ? p.images.join(', ') : '')) return;
      const imagesArray = val.split(/,\s*/).map(u => u.trim()).filter(u => u);
      await updateProductField(p.id, 'images', imagesArray);
    });

    const specCell = document.createElement('div');
    specCell.contentEditable = true;
    specCell.textContent = p.description != null ? p.description : '';
    specCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.description != null ? String(p.description) : '')) return;
      await updateProductField(p.id, 'description', val);
    });

    const detailedDescCell = document.createElement('div');
    detailedDescCell.contentEditable = true;
    detailedDescCell.textContent = p.detailedDescription != null ? p.detailedDescription : '';
    detailedDescCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.detailedDescription != null ? String(p.detailedDescription) : '')) return;
      await updateProductField(p.id, 'detailedDescription', val);
    });

    const metaTitleCell = document.createElement('div');
    metaTitleCell.contentEditable = true;
    metaTitleCell.textContent = p.metaTitle != null ? p.metaTitle : '';
    metaTitleCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.metaTitle != null ? String(p.metaTitle) : '')) return;
      await updateProductField(p.id, 'metaTitle', val);
    });

    const metaDescCell = document.createElement('div');
    metaDescCell.contentEditable = true;
    metaDescCell.textContent = p.metaDescription != null ? p.metaDescription : '';
    metaDescCell.addEventListener('blur', async (e) => {
      const val = e.target.textContent.trim();
      if (val === (p.metaDescription != null ? String(p.metaDescription) : '')) return;
      await updateProductField(p.id, 'metaDescription', val);
    });

    detailsCell.innerHTML = `<strong>Image URLs (comma-separated):</strong> `;
    detailsCell.appendChild(imagesCell);
    detailsCell.innerHTML += `<br><strong>Specification:</strong> `;
    detailsCell.appendChild(specCell);
    detailsCell.innerHTML += `<br><strong>Description:</strong> `;
    detailsCell.appendChild(detailedDescCell);
    detailsCell.innerHTML += `<br><strong>Meta Title:</strong> `;
    detailsCell.appendChild(metaTitleCell);
    detailsCell.innerHTML += `<br><strong>Meta Description:</strong> `;
    detailsCell.appendChild(metaDescCell);
    detailsRow.appendChild(detailsCell);
    tbody.appendChild(detailsRow);
  });
}

function computeStatus(p) {
  if (p.availability === 'Upcoming') return 'Upcoming';
  if (p.availability === 'Pre Order') return 'Pre Order';
  return Number(p.stock) > 0 ? 'In Stock' : 'Out of Stock';
}

async function updateProductField(id, field, value) {
  try {
    await updateDoc(doc(db, 'products', id), { [field]: value });
  } catch (err) {
    console.error('Error updating product:', err);
    alert('Error updating product: ' + err.message);
  }
}

async function deleteProductById(id) {
  try {
    await deleteDoc(doc(db, 'products', id));
    renderDataTable();
  } catch (err) {
    console.error('Error deleting product:', err);
    alert('Error deleting product: ' + err.message);
  }
}