import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyA9VbrBPWipoisWnE_SADEIO1CgYKwrwEI",
  authDomain: "habits-8f7f1.firebaseapp.com",
  projectId: "habits-8f7f1",
  storageBucket: "habits-8f7f1.firebasestorage.app",
  messagingSenderId: "6344847102",
  appId: "1:6344847102:web:d1b342b0119d4c89ff7faf",
  measurementId: "G-4VLC0GT32M"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
