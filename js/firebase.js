// js/firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, orderBy, query, where, runTransaction } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Re-export Firestore and Auth functions
export {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc,
  orderBy, query, where, runTransaction,
  signInWithEmailAndPassword, signOut, onAuthStateChanged
};