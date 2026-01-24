// js/checkout-cart.js
import { getCart, saveCart, updateCartUI } from './cart.js';
import { loadProducts } from './products.js';
import { calculateDeliveryFee } from './ui-helpers.js';
import { BKASH_NUMBER, COD_NUMBER } from './config.js';
import { db, collection, doc, runTransaction } from './firebase.js';

export function setupCartCheckout() {
  document.getElementById('checkout-cart')?.addEventListener('click', async () => {
    const cart = getCart();
    if (cart.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    const products = await loadProducts();
    let subtotal = 0;
    let hasPreOrder = false;

    cart.forEach(item => {
      const p = products.find(pr => pr.id === item.id);
      if (!p) throw new Error('Product not found in cart');
      const unitPrice = Number(p.price) - Number(p.discount || 0);
      subtotal += unitPrice * item.qty;
      if (p.availability === 'Pre Order') hasPreOrder = true;
    });

    document.getElementById('cart-slider').classList.remove('open');
    document.getElementById('cart-checkout-modal').classList.add('show');

    const itemsDiv = document.getElementById('cart-co-items');
    itemsDiv.innerHTML = '<h3>Order Summary</h3>';
    cart.forEach(item => {
      const p = products.find(pr => pr.id === item.id);
      const unitPrice = Number(p.price) - Number(p.discount || 0);
      const line = document.createElement('p');
      line.innerHTML = `<strong>${item.name}</strong> ${item.color ? '(' + item.color + ')' : ''} × ${item.qty}<br>
                        ৳${unitPrice.toFixed(2)} × ${item.qty} = ৳${(unitPrice * item.qty).toFixed(2)}`;
      itemsDiv.appendChild(line);
    });

    document.getElementById('cart-co-payment').value = hasPreOrder ? 'Bkash' : '';
    document.getElementById('cart-co-payment').disabled = hasPreOrder;
    document.getElementById('cart-co-payment-number').value = '';
    document.getElementById('cart-co-txn').value = '';
    document.getElementById('cart-co-name').value = '';
    document.getElementById('cart-co-phone').value = '';
    document.getElementById('cart-co-address').value = '';
    document.getElementById('cart-co-note').textContent = '';
    document.getElementById('cart-co-policy').checked = false;
    document.getElementById('cart-co-pay-now').style.display = 'none';
    document.getElementById('cart-co-due-amount').style.display = 'none';

    const initialDelivery = calculateDeliveryFee('');
    document.getElementById('cart-co-delivery').value = `Delivery Charge = ${initialDelivery}`;
    document.getElementById('cart-co-delivery').dataset.fee = initialDelivery;

    function updateCartCheckoutTotals() {
      const address = document.getElementById('cart-co-address').value.trim();
      const deliveryFee = calculateDeliveryFee(address);
      document.getElementById('cart-co-delivery').value = `Delivery Charge = ${deliveryFee}`;
      document.getElementById('cart-co-delivery').dataset.fee = deliveryFee;

      const total = subtotal + deliveryFee;
      document.getElementById('cart-co-total').value = total.toFixed(2);

      const method = document.getElementById('cart-co-payment').value;
      const payNowEl = document.getElementById('cart-co-pay-now');
      const dueEl = document.getElementById('cart-co-due-amount');
      const numberEl = document.getElementById('cart-co-payment-number');
      const txnEl = document.getElementById('cart-co-txn');
      const noteEl = document.getElementById('cart-co-note');

      if (hasPreOrder) {
        const upfront = Math.round((subtotal * 0.25) / 5) * 5;
        payNowEl.value = upfront.toFixed(2);
        dueEl.value = (total - upfront).toFixed(2);
        numberEl.value = BKASH_NUMBER;
        noteEl.textContent = `Send ৳${upfront} to ${BKASH_NUMBER} and enter transaction ID.`;
        txnEl.required = true;
        payNowEl.style.display = 'block';
        dueEl.style.display = 'block';
      } else if (method === 'Bkash') {
        payNowEl.value = total.toFixed(2);
        dueEl.value = "0.00";
        numberEl.value = BKASH_NUMBER;
        noteEl.textContent = `Send full amount ৳${total.toFixed(2)} to ${BKASH_NUMBER} and provide transaction ID.`;
        txnEl.required = true;
        payNowEl.style.display = 'block';
        dueEl.style.display = 'block';
      } else if (method === 'Cash on Delivery') {
        payNowEl.value = deliveryFee.toFixed(2);
        dueEl.value = subtotal.toFixed(2);
        numberEl.value = COD_NUMBER;
        noteEl.textContent = `Pay delivery charge ৳${deliveryFee}. Remaining on delivery.`;
        txnEl.required = false;
        txnEl.value = '';
        payNowEl.style.display = 'block';
        dueEl.style.display = 'block';
      } else {
        payNowEl.style.display = 'none';
        dueEl.style.display = 'none';
        numberEl.value = '';
        noteEl.textContent = '';
        txnEl.required = false;
      }
    }

    document.getElementById('cart-co-address').addEventListener('input', updateCartCheckoutTotals);
    document.getElementById('cart-co-payment').addEventListener('change', updateCartCheckoutTotals);
    updateCartCheckoutTotals();
  });

  document.getElementById('cart-close-modal-btn')?.addEventListener('click', () => {
    document.getElementById('cart-checkout-modal').classList.remove('show');
  });

  document.getElementById('cart-checkout-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.querySelector('#cart-checkout-form button[type="submit"]');
    if (!btn) return;
    btn.disabled = true;

    if (!document.getElementById('cart-co-policy').checked) {
      alert('Please agree to the order policy.');
      btn.disabled = false;
      return;
    }

    const cart = getCart();
    if (cart.length === 0) {
      alert('Cart is empty!');
      btn.disabled = false;
      return;
    }

    const products = await loadProducts();
    const deliveryFee = Number(document.getElementById('cart-co-delivery').dataset.fee);
    let subtotal = 0;

    const items = cart.map(item => {
      const p = products.find(pr => pr.id === item.id);
      if (!p) throw new Error('Product missing');
      const unitPrice = Number(p.price) - Number(p.discount || 0);
      subtotal += unitPrice * item.qty;
      return {
        productId: item.id,
        productName: item.name,
        color: item.color || '',
        unitPrice,
        quantity: item.qty,
        wasPreOrder: p.availability === 'Pre Order'
      };
    });
    const total = subtotal + deliveryFee;
    const paid = Number(document.getElementById('cart-co-pay-now').value) || 0;
    const due = Number(document.getElementById('cart-co-due-amount').value) || 0;

    const orderData = {
      timeISO: new Date().toISOString(),
      items,
      deliveryFee,
      total,
      paid,
      due,
      customerName: document.getElementById('cart-co-name').value.trim(),
      phone: document.getElementById('cart-co-phone').value.trim(),
      address: document.getElementById('cart-co-address').value.trim(),
      paymentMethod: document.getElementById('cart-co-payment').value,
      paymentNumber: document.getElementById('cart-co-payment-number').value.trim(),
      transactionId: document.getElementById('cart-co-txn').value.trim().toUpperCase(),
      status: 'Pending'
    };

    if (!orderData.customerName || !orderData.phone || !orderData.address || !orderData.paymentMethod) {
      alert('Please fill all required fields.');
      btn.disabled = false;
      return;
    }
    if (orderData.paymentMethod === 'Bkash' && !orderData.transactionId) {
      alert('Transaction ID is required for Bkash payment.');
      btn.disabled = false;
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const productRefs = items.map(item => doc(db, 'products', item.productId));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        for (let i = 0; i < items.length; i++) {
          const snap = productSnaps[i];
          if (!snap.exists()) throw new Error('Product not found');

          const data = snap.data();
          const currentStock = Number(data.stock);
          const item = items[i];

          if (currentStock !== -1 && data.availability !== 'Pre Order' && currentStock < item.quantity) {
            throw new Error(`Not enough stock for ${item.productName}. Only ${currentStock} left.`);
          }

          if (currentStock !== -1 && data.availability !== 'Pre Order') {
            transaction.update(productRefs[i], { stock: currentStock - item.quantity });
          }
        }

        const newOrderRef = doc(collection(db, 'orders'));
        transaction.set(newOrderRef, orderData);
      });

      alert('Order placed successfully!');
      localStorage.removeItem('cart');
      updateCartUI();
      document.getElementById('cart-checkout-modal').classList.remove('show');
    } catch (err) {
      console.error('Error placing order:', err);
      alert('Error placing order: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });
}