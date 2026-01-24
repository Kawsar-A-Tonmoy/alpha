// js/admin-orders.js
import { loadOrders } from './products.js';
import { db, updateDoc, doc } from './firebase.js';
import { statusColors } from './ui-helpers.js';

export async function renderOrdersTable() {
  const tbody = document.getElementById('orders-body');
  if (!tbody) return;
  const orders = await loadOrders();
  tbody.innerHTML = '';
  orders.forEach(o => {
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

    let productName, color, quantity;
    if (o.items && o.items.length > 0) {
      productName = o.items.length > 1 ? `${o.items[0].productName} + ${o.items.length - 1} more` : o.items[0].productName;
      color = o.items.map(i => i.color).filter(c => c).join(', ') || '-';
      quantity = o.items.reduce((s, i) => s + i.quantity, 0);
    } else {
      productName = o.productName;
      color = o.color;
      quantity = o.quantity;
    }

    const tds = [
      new Date(o.timeISO).toLocaleString(),
      productName,
      color,
      quantity,
      '৳' + Number(o.deliveryFee).toFixed(2),
      '৳' + Number(o.paid).toFixed(2),
      '৳' + Number(o.due).toFixed(2),
      o.customerName,
      o.phone,
      o.address,
      o.paymentMethod,
      o.transactionId
    ];
    tds.forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });

    const tdStatus = document.createElement('td');
    const select = document.createElement('select');
    ['Pending', 'Processing', 'Dispatched', 'Delivered', 'Cancelled'].forEach(opt => {
      const option = document.createElement('option');
      option.value = opt;
      option.text = opt;
      if (o.status === opt) option.selected = true;
      select.appendChild(option);
    });
    select.style.backgroundColor = statusColors[o.status || 'Pending'];
    select.addEventListener('change', async (e) => {
      try {
        const newStatus = e.target.value;
        await updateDoc(doc(db, 'orders', o.id), { status: newStatus });
        select.style.backgroundColor = statusColors[newStatus];
      } catch (err) {
        console.error('Error updating order status:', err);
        alert('Error updating order status: ' + err.message);
      }
    });
    tdStatus.appendChild(select);
    tr.appendChild(tdStatus);
    tbody.appendChild(tr);

    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    const detailsCell = document.createElement('td');
    detailsCell.colSpan = 14;
    detailsCell.className = 'details-content';

    if (o.items && o.items.length > 0) {
      detailsCell.innerHTML = '<strong>Items:</strong><br>';
      o.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.textContent = `${item.productName} (${item.color || '-'}) x ${item.quantity} @ ৳${Number(item.unitPrice).toFixed(2)} = ৳${(item.unitPrice * item.quantity).toFixed(2)}`;
        detailsCell.appendChild(itemDiv);
      });
    } else {
      const unitPriceCell = document.createElement('div');
      unitPriceCell.textContent = `Unit Price: ৳${Number(o.unitPrice).toFixed(2)}`;
      detailsCell.appendChild(unitPriceCell);
    }

    detailsRow.appendChild(detailsCell);
    tbody.appendChild(detailsRow);
  });
}