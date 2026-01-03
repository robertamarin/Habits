import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase.js';
import {
  loadDay,
  loadHabits,
  loadGoals,
  loadQuits,
  loadBooks,
  migrateLocal,
  loadDaysRange
} from './firestore.js';

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

// onSignIn(user, payload)
// payload includes habits + today day doc (completions/mood/tasks/journal/dreams/ideas)
// plus goals/quits and a year-range day cache for year overview.
export function observeAuthState(onSignIn, onSignOut) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      onSignOut?.();
      return;
    }

    try {
      await migrateLocal(user.uid);

      const [habits, goals, quits, books, todayData] = await Promise.all([
        loadHabits(user.uid),
        loadGoals(user.uid),
        loadQuits(user.uid),
        loadBooks(user.uid),
        loadDay(user.uid) // today by default
      ]);

      // Preload current-year days for year overview/heatmaps/pie ranges.
      // (Safe if empty; only reads what exists.)
      const year = new Date().getFullYear();
      const yearDays = await loadDaysRange(user.uid, `${year}-01-01`, `${year}-12-31`);

      onSignIn?.(user, { habits, goals, quits, books, day: todayData, yearDays });
    } catch (e) {
      console.warn('Auth succeeded, but Firestore load failed. Check Firestore rules/authorized domains.', e);
      onSignIn?.(
        user,
        { habits: [], goals: [], quits: [], books: [], day: { completions: {}, mood: null, tasks: [], journal: [], dreams: [], ideas: [] }, yearDays: {} }
      );
    }
  });
}
