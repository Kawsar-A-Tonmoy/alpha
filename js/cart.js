import { auth, db, doc, getDoc, updateDoc, addDoc, collection } from './firebase.js';
import { renderProductCard } from './products.js'; // Assume exported

const DELIVERY_CHARGE = 100;
const BKASH_ACCOUNT = '0123456789'; // Replace with real number

export function addToCart(productId, quantity) {
  if (auth.currentUser) {
    getDoc(doc(db, 'users', auth.currentUser.uid)).then(userDoc => {
      let cart = userDoc.data().cart || [];
      const existing = cart.find(item => item.productId === productId);
      if (existing) existing.quantity += quantity;
      else cart.push({ productId, quantity });
      updateDoc(doc(db, 'users', auth.currentUser.uid), { cart });
    });
  } else {
    let cart = JSON.parse(localStorage.getItem('cart')) || [];
    const existing = cart.find(item => item.productId === productId);
    if (existing) existing.quantity += quantity;
    else cart.push({ productId, quantity });
    localStorage.setItem('cart', JSON.stringify(cart));
  }
  alert('Added to cart!');
}

export async function loadCart() {
  let cartItems = [];
  if (auth.currentUser) {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    cartItems = userDoc.data().cart || [];
  } else {
    cartItems = JSON.parse(localStorage.getItem('cart')) || [];
  }

  const container = document.getElementById('cartItems');
  container.innerHTML = '';
  for (const item of cartItems) {
    const prodDoc = await getDoc(doc(db, 'products', item.productId));
    const prod = { id: item.productId, ...prodDoc.data(), quantity: item.quantity };
    container.appendChild(renderProductCard(prod)); // Reuse card, but adjust for quantity
  }

  document.getElementById('buyAll').onclick = async () => {
    const fullItems = await Promise.all(cartItems.map(async item => {
      const prodDoc = await getDoc(doc(db, 'products', item.productId));
      return { ...prodDoc.data(), id: item.productId, quantity: item.quantity };
    }));
    showOrderForm(fullItems);
  };
}

export async function showOrderForm(items) {
  const isLoggedIn = !!auth.currentUser;
  let userData = { name: '', address: '', phone: '' };
  if (isLoggedIn) {
    const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
    userData = userDoc.data();
    const useSaved = confirm('Use saved info?');
    if (!useSaved) userData = { name: '', address: '', phone: '' };
  }

  let total = 0;
  let isPreorder = false;
  let stockChecks = [];
  items.forEach(item => {
    if (item.availability === 'preorder') isPreorder = true;
    if (item.availability === 'instock' && item.quantity > item.stock) {
      stockChecks.push(`Quantity for ${item.name} exceeds stock (${item.stock})! Capped to ${item.stock}.`);
      item.quantity = item.stock;
    }
    total += (item.price - (item.discount || 0)) * item.quantity;
  });
  if (stockChecks.length) alert(stockChecks.join('\n'));

  const popup = document.getElementById('popup');
  popup.style.display = 'block';
  popup.innerHTML = `
    <h2>Order Form</h2>
    <form id="orderForm">
      <input id="name" placeholder="Name" value="${userData.name || ''}" required>
      <input id="address" placeholder="Address" value="${userData.address || ''}" required>
      <input id="phone" placeholder="Phone" value="${userData.phone || ''}" required>
      <p>Items: ${items.map(i => `${i.name} (${i.quantity})`).join(', ')}</p>
      <p>Total Product Price: ${total}</p>
      <p>Delivery Charge: ${DELIVERY_CHARGE}</p>
      <select id="paymentMethod" required>
        <option value="">Select Payment</option>
        <option value="bkash">Bkash (Full Payment)</option>
        <option value="cod">Cash on Delivery (Pay Delivery Charge First)</option>
      </select>
      <button type="submit" class="button">Confirm Order</button>
      <button type="button" class="button" onclick="document.getElementById('popup').style.display='none'">Cancel</button>
    </form>
  `;

  document.getElementById('orderForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const paymentMethod = document.getElementById('paymentMethod').value;
    let payAmount = 0;
    let due = 0;
    let updateStock = false;

    if (isPreorder) {
      payAmount = Math.round((total * 0.25) / 5) * 5; // Round to nearest 5
      due = total - payAmount + DELIVERY_CHARGE;
    } else {
      updateStock = true;
      if (paymentMethod === 'bkash') {
        payAmount = total + DELIVERY_CHARGE;
        due = 0;
      } else if (paymentMethod === 'cod') {
        payAmount = DELIVERY_CHARGE;
        due = total;
      }
    }

    // Generate tracking code
    const trackingCode = Math.random().toString(36).substring(2,6).toUpperCase() + '-' + Math.random().toString(36).substring(2,4).toUpperCase();

    // Save order
    const orderData = {
      userId: auth.currentUser ? auth.currentUser.uid : null,
      items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
      total,
      due,
      paymentMethod,
      trackingCode,
      status: 'Pending',
      name: document.getElementById('name').value,
      address: document.getElementById('address').value,
      phone: document.getElementById('phone').value
    };
    const orderRef = await addDoc(collection(db, 'orders'), orderData);

    if (isLoggedIn) {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        orders: [...(userData.orders || []), orderRef.id],
        cart: [] // Clear cart
      });
    } else {
      localStorage.removeItem('cart');
    }

    // Update stock if instock
    if (updateStock) {
      for (const item of items) {
        if (item.availability === 'instock') {
          await updateDoc(doc(db, 'products', item.id), { stock: item.stock - item.quantity });
        }
      }
    }

    // Show confirmation with payment instructions
    popup.innerHTML = `
      <h2>Order Confirmed!</h2>
      <p>Tracking Code: ${trackingCode} (Save this!)</p>
      <p>Pay ${payAmount} to Bkash Account: ${BKASH_ACCOUNT}</p>
      <p>Due on Delivery: ${due}</p>
      <p>Send transaction ID to our support if needed.</p>
      <button onclick="location.reload()">Close</button>
    `;
  });
}

// Call in product/cart pages as needed