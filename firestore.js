import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase.js';
import { dayKey } from './utils.js';

export async function addHabit(uid, name, extra = {}) {
  const habitsCol = collection(db, 'users', uid, 'habits');
  const habitRef = extra.id ? doc(habitsCol, extra.id) : doc(habitsCol);
  await setDoc(habitRef, {
    name,
    isActive: true,
    createdAt: Timestamp.now(),
    ...extra
  });
  return habitRef.id;
}

export async function updateHabit(uid, habitId, data) {
  const habitRef = doc(db, 'users', uid, 'habits', habitId);
  await setDoc(habitRef, { ...data }, { merge: true });
}

export async function removeHabit(uid, habitId) {
  const habitRef = doc(db, 'users', uid, 'habits', habitId);
  await deleteDoc(habitRef);
}

export async function loadHabits(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'habits'));
  const list = [];
  snap.forEach((docSnap) => {
    list.push({ id: docSnap.id, ...docSnap.data() });
  });
  return list;
}

export async function loadDay(uid, date = new Date()) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();
  await setDoc(ref, { completions: {}, mood: null });
  return { completions: {}, mood: null };
}

export async function toggleCompletion(uid, habitId, date, done) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const field = `completions.${habitId}`;
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { [field]: done });
  } else {
    await setDoc(ref, { completions: { [habitId]: done }, mood: null });
  }
}

export async function setMood(uid, moodValue, date = new Date()) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { mood: moodValue });
  } else {
    await setDoc(ref, { completions: {}, mood: moodValue });
  }
}

export async function migrateLocal(uid) {
  const migrationFlag = `firebaseMigrated:${uid}`;
  if (localStorage.getItem(migrationFlag)) return;

  const habits = JSON.parse(localStorage.getItem('habits') || '[]');
  const days = JSON.parse(localStorage.getItem('completions') || '{}');
  const storedState = JSON.parse(localStorage.getItem('habitFreshV1') || 'null');

  if (storedState) {
    (storedState.habits || []).forEach((h) => {
      habits.push({
        id: h.id,
        name: h.name,
        isActive: h.isActive ?? true,
        createdAt: h.created || Timestamp.now()
      });
    });
    Object.entries(storedState.days || {}).forEach(([dateKeyValue, payload]) => {
      const normalized = dayKey(dateKeyValue);
      const existing = days[normalized] || {};
      days[normalized] = { ...existing, ...(payload?.habits || {}) };
    });
  }

  for (const h of habits) {
    const ref = h.id ? doc(db, 'users', uid, 'habits', h.id) : doc(collection(db, 'users', uid, 'habits'));
    await setDoc(ref, {
      name: h.name,
      isActive: h.isActive ?? true,
      createdAt: h.createdAt?.toDate ? h.createdAt.toDate() : h.createdAt || Timestamp.now()
    });
  }

  for (const [dateKeyValue, completions] of Object.entries(days)) {
    const ref = doc(db, 'users', uid, 'days', dayKey(dateKeyValue));
    await setDoc(ref, { completions, mood: null }, { merge: true });
  }

  localStorage.removeItem('habits');
  localStorage.removeItem('completions');
  localStorage.setItem(migrationFlag, 'done');
}
