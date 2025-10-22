import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAANaVQR8MbppZmhBkmZ2ptlzZEbwNMgAQ",
  authDomain: "thebeta-bca97.firebaseapp.com",
  projectId: "thebeta-bca97",
  storageBucket: "thebeta-bca97.firebasestorage.app",
  messagingSenderId: "430455154137",
  appId: "1:430455154137:web:f305f234ae17a0017aa5c8",
  measurementId: "G-JJEXR06M39"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, collection, addDoc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, query, where };