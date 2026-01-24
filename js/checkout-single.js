// js/checkout-single.js
import { loadProducts } from './products.js';
import { calculateDeliveryFee } from './ui-helpers.js';
import { BKASH_NUMBER, COD_NUMBER, DELIVERY_FEE } from './config.js';
import { db, doc, runTransaction, updateDoc } from './firebase.js';

export async function openCheckoutModal(productId, isPreOrder = false) {
  const products = await loadProducts();
  const p = products.find(x => x.id === productId);
  if (!p) return;

  const price = p.price === 'TBA' ? 0 : Number(p.price) || 0;
  const discount = Number(p.discount) || 0;
  const unit = price - discount;

  document.getElementById('co-product-id').value = p.id;
  document.getElementById('co-product-name').value = p.name;
  document.getElementById('co-color').value = p.color || '';
  document.getElementById('co-price').value = unit.toFixed(2);
  document.getElementById('co-unit-price-raw').value = unit.toString();
  document.getElementById('co-available-stock').value = String(p.stock);
  document.getElementById('co-qty').value = 1;
  document.getElementById('co-qty').max = p.stock;
  document.getElementById('co-payment').value = isPreOrder ? 'Bkash' : '';
  document.getElementById('co-payment').disabled = isPreOrder;
  document.getElementById('co-payment-number').value = '';
  document.getElementById('co-txn').value = '';
  document.getElementById('co-name').value = '';
  document.getElementById('co-phone').value = '';
  document.getElementById('co-address').value = '';
  document.getElementById('co-note').textContent = '';
  document.getElementById('co-policy').checked = false;
  document.getElementById('co-pay-now').style.display = 'none';
  document.getElementById('co-due-amount').style.display = 'none';

  const deliveryFee = calculateDeliveryFee('');
  document.getElementById('co-delivery').value = `Delivery Charge = ${deliveryFee}`;
  document.getElementById('co-delivery').dataset.fee = deliveryFee;

  if (isPreOrder) {
    const preOrderPrice = Math.round((unit * 0.25) / 5) * 5;
    document.getElementById('co-pay-now').value = preOrderPrice.toFixed(2);
    document.getElementById('co-due-amount').value = (unit - preOrderPrice + deliveryFee).toFixed(2);
    document.getElementById('co-payment-number').value = BKASH_NUMBER;
    document.getElementById('co-note').textContent = `Send ৳${preOrderPrice} to ${BKASH_NUMBER} and enter transaction ID`;
    document.getElementById('co-pay-now').style.display = 'block';
    document.getElementById('co-due-amount').style.display = 'block';
  } else {
    document.getElementById('co-payment-number').value = '';
  }

  document.getElementById('co-total').value = 'Calculating...';
  document.getElementById('checkout-modal').classList.add('show');
  updateTotalInModal();
}

export function closeCheckoutModal() {
  document.getElementById('checkout-modal').classList.remove('show');
}

export function handlePaymentChange(e) {
  const method = e.target.value;
  const payNowEl = document.getElementById('co-pay-now');
  const dueEl = document.getElementById('co-due-amount');
  const paymentNumberEl = document.getElementById('co-payment-number');
  const txnEl = document.getElementById('co-txn');
  const noteEl = document.getElementById('co-note');

  if (method === 'Bkash') {
    const upfront = Math.round((subtotal * 0.25) / 5) * 5;
    paymentNumberEl.value = BKASH_NUMBER;
    noteEl.textContent = `Send ৳${upfront} to ${BKASH_NUMBER} and enter transaction ID.`;
    txnEl.required = true;
    payNowEl.style.display = 'block';
    dueEl.style.display = 'block';
  } else if (method === 'Cash on Delivery') {
    paymentNumberEl.value = COD_NUMBER;
    noteEl.textContent = `Pay delivery charge ৳${deliveryFee}. Remaining on delivery.`;
    txnEl.required = false;
    txnEl.value = '';
    payNowEl.style.display = 'block';
    dueEl.style.display = 'block';
  } else {
    paymentNumberEl.value = '';
    noteEl.textContent = '';
    txnEl.required = false;
    txnEl.value = '';
    payNowEl.style.display = 'none';
    dueEl.style.display = 'none';
  }
  updateTotalInModal();
}

export function updateTotalInModal() {
  const qty = Number(document.getElementById('co-qty').value) || 1;
  const unit = Number(document.getElementById('co-unit-price-raw').value) || 0;
  const delivery = Number(document.getElementById('co-delivery').dataset.fee) || DELIVERY_FEE;
  const subtotal = qty * unit;
  const total = subtotal + delivery;
  document.getElementById('co-total').value = total.toFixed(2);

  const paymentMethod = document.getElementById('co-payment').value;
  const isPreOrderMode = paymentMethod === 'Bkash' && document.getElementById('co-payment').disabled;
  const payNowEl = document.getElementById('co-pay-now');
  const dueEl = document.getElementById('co-due-amount');

  if (isPreOrderMode) {
    const upfront = Math.round((subtotal * 0.25) / 5) * 5;
    payNowEl.value = upfront.toFixed(2);
    dueEl.value = (subtotal + delivery - upfront).toFixed(2);
  } else if (paymentMethod) {
    const payNow = paymentMethod === 'Bkash' ? total : delivery;
    const dueAmount = paymentMethod === 'Bkash' ? 0 : subtotal;
    payNowEl.value = payNow.toFixed(2);
    dueEl.value = dueAmount.toFixed(2);
  } else {
    payNowEl.style.display = 'none';
    dueEl.style.display = 'none';
  }
}

export function updateDeliveryCharge() {
  const address = document.getElementById('co-address').value.trim();
  const deliveryFee = calculateDeliveryFee(address);
  document.getElementById('co-delivery').value = `Delivery Charge = ${deliveryFee}`;
  document.getElementById('co-delivery').dataset.fee = deliveryFee;
  updateTotalInModal();
}

export async function submitCheckoutOrder(e) {
  e.preventDefault();
  const btn = document.getElementById('place-order-btn');
  btn.disabled = true;

  if (!document.getElementById('co-policy').checked) {
    alert('Please agree to the order policy.');
    btn.disabled = false;
    return;
  }

  const productId = document.getElementById('co-product-id').value;
  const qty = Number(document.getElementById('co-qty').value);
  const available = Number(document.getElementById('co-available-stock').value);

  if (!productId) { alert('Product ID is missing.'); btn.disabled = false; return; }
  if (qty <= 0) { alert('Quantity must be at least 1.'); btn.disabled = false; return; }
  if (qty > available && available !== -1) { alert(`Quantity exceeds available stock of ${available}.`); btn.disabled = false; return; }

  const unit = Number(document.getElementById('co-unit-price-raw').value);
  if (isNaN(unit)) { alert('Invalid unit price.'); btn.disabled = false; return; }

  const delivery = Number(document.getElementById('co-delivery').dataset.fee);
  if (isNaN(delivery)) { alert('Invalid delivery fee.'); btn.disabled = false; return; }

  const total = (qty * unit) + delivery;

  const products = await loadProducts();
  const currentProduct = products.find(p => p.id === productId);

  if (!currentProduct) {
    alert('Product not found. Please refresh and try again.');
    btn.disabled = false;
    return;
  }

  const orderData = {
    timeISO: new Date().toISOString(),
    productId,
    productName: document.getElementById('co-product-name').value,
    color: document.getElementById('co-color').value,
    unitPrice: unit,
    quantity: qty,
    deliveryFee: delivery,
    total,
    paid: Number(document.getElementById('co-pay-now').value) || 0,
    due: Number(document.getElementById('co-due-amount').value) || 0,
    customerName: document.getElementById('co-name').value.trim(),
    phone: document.getElementById('co-phone').value.trim(),
    address: document.getElementById('co-address').value.trim(),
    paymentMethod: document.getElementById('co-payment').value,
    paymentNumber: document.getElementById('co-payment-number').value.trim(),
    transactionId: document.getElementById('co-txn').value.trim().toUpperCase(),
    status: 'Pending',
    wasPreOrder: currentProduct.availability === 'Pre Order'
  };

  if (!orderData.customerName || !orderData.phone || !orderData.address || !orderData.paymentMethod) {
    alert('Please fill all required fields.');
    btn.disabled = false;
    return;
  }
  if (orderData.paymentMethod === 'Bkash' && (!orderData.paymentNumber || !orderData.transactionId)) {
    alert('Please provide payment number and transaction ID for Bkash.');
    btn.disabled = false;
    return;
  }

  try {
    await runTransaction(db, async (transaction) => {
      const productRef = doc(db, 'products', productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error('Product not found.');

      const currentStock = Number(productSnap.data().stock);
      if (currentStock !== -1 && currentStock < qty && productSnap.data().availability !== 'Pre Order') {
        throw new Error(`Insufficient stock. Only ${currentStock} available.`);
      }
      if (currentStock !== -1 && productSnap.data().availability !== 'Pre Order') {
        transaction.update(productRef, { stock: currentStock - qty });
      }

      const newOrderRef = doc(collection(db, 'orders'));
      transaction.set(newOrderRef, orderData);
    });

    alert('Order placed successfully!');
    closeCheckoutModal();
  } catch (err) {
    console.error('Error placing order:', err);
    alert('Error placing order: ' + err.message);
  } finally {
    btn.disabled = false;
  }
}