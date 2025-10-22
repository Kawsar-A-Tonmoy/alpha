import { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, setDoc, doc, getDoc } from './firebase.js';

if (document.getElementById('registerForm')) {
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const address = document.getElementById('address').value;
    const password = document.getElementById('password').value;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), { phone, email, address, isAdmin: false, cart: [], orders: [] });
      alert('Registered! Redirecting to home.');
      window.location.href = 'index.html';
    } catch (error) {
      alert(error.message);
    }
  });
}

if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const loginId = document.getElementById('loginId').value;
    const password = document.getElementById('password').value;
    const email = loginId.includes('@') ? loginId : `${loginId}@phone.example.com`; // Simple hack for phone login; use proper phone auth in production
    try {
      await signInWithEmailAndPassword(auth, email, password);
      alert('Logged in! Redirecting to home.');
      window.location.href = 'index.html';
    } catch (error) {
      alert(error.message);
    }
  });
}

// On other pages, check admin link
auth.onAuthStateChanged(async (user) => {
  const adminLink = document.getElementById('adminLink');
  if (adminLink && user) {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists() && userDoc.data().isAdmin) {
      adminLink.style.display = 'block';
    }
  }
});