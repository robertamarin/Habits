import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase.js';
import { loadDay, loadHabits, migrateLocal } from './firestore.js';

const provider = new GoogleAuthProvider();

export function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function logOut() {
  return signOut(auth);
}

export function observeAuthState(onSignIn, onSignOut) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      await migrateLocal(user.uid);
      const habits = await loadHabits(user.uid);
      const todayData = await loadDay(user.uid);
      if (onSignIn) onSignIn(user, { habits, day: todayData });
    } else if (onSignOut) {
      onSignOut();
    }
  });
}
