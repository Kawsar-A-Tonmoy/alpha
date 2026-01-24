// js/main.js
import { updateCartUI } from './cart.js';
import { setupImageViewer } from './ui-helpers.js';
import { setupCartCheckout } from './checkout-cart.js';
import { addProduct } from './admin-products.js';
import { renderDataTable } from './admin-products.js';
import { renderOrdersTable } from './admin-orders.js';
import { initHomePage } from './pages/home.js';
import { initProductsPage } from './pages/products.js';
import { initProductPage } from './pages/product-detail.js';
import { auth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from './firebase.js';

function logoutAdmin() {
  try {
    signOut(auth);
    console.log('Logged out successfully');
  } catch (err) {
    console.error('Logout error:', err);
    alert('Error logging out: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  updateCartUI();

  document.getElementById('cart-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('cart-slider').classList.add('open');
  });

  document.getElementById('close-cart')?.addEventListener('click', () => {
    document.getElementById('cart-slider').classList.remove('open');
  });

  setupCartCheckout();

  const isHome = !!document.getElementById('interest-products');
  const isProducts = !!document.getElementById('product-list');
  const isProduct = !!document.getElementById('product-section');
  const isAdmin = !!document.getElementById('admin-panel');

  if (isHome) await initHomePage();
  if (isProducts) await initProductsPage();
  if (isProduct) await initProductPage();

  const loginPanel = document.getElementById('login-panel');
  const adminPanel = document.getElementById('admin-panel');
  const addForm = document.getElementById('add-product-form');
  if (addForm) addForm.addEventListener('submit', addProduct);

  if (loginPanel && adminPanel) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('User logged in:', user.email);
        loginPanel.style.display = 'none';
        adminPanel.style.display = 'block';
        await renderDataTable();
        await renderOrdersTable();
      } else {
        console.log('No user logged in');
        loginPanel.style.display = 'block';
        adminPanel.style.display = 'none';
      }
    });

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-pass').value;
        try {
          await signInWithEmailAndPassword(auth, email, pass);
          console.log('Login successful');
        } catch (err) {
          console.error('Login failed:', err);
          alert('Login failed: ' + err.message);
        }
      });
    }
  }

  // Attach logout if needed, e.g., to a button
  // document.getElementById('logout-btn')?.addEventListener('click', logoutAdmin);
});