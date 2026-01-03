import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  startAt,
  endAt,
  setDoc,
  Timestamp,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase.js';
import { dayKey } from './utils.js';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const emptyDayDoc = () => ({
  completions: {},
  mood: null,
  tasks: [],
  journal: [],
  dreams: [],
  ideas: []
});

const userDoc = (uid) => doc(db, 'users', uid);
const subcol = (uid, name) => collection(db, 'users', uid, name);

const clearCollection = async (uid, name) => {
  const snap = await getDocs(subcol(uid, name));
  const deletions = [];
  snap.forEach((docSnap) => deletions.push(deleteDoc(docSnap.ref)));
  await Promise.all(deletions);
};

export async function resetUserData(uid) {
  await Promise.all([
    clearCollection(uid, 'habits'),
    clearCollection(uid, 'days'),
    clearCollection(uid, 'goals'),
    clearCollection(uid, 'quits'),
    clearCollection(uid, 'books')
  ]);
}

// -----------------------------------------------------------------------------
// Habits
// -----------------------------------------------------------------------------

export async function addHabit(uid, name, extra = {}) {
  const habitsCol = subcol(uid, 'habits');
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
  const snap = await getDocs(subcol(uid, 'habits'));
  const list = [];
  snap.forEach((docSnap) => list.push({ id: docSnap.id, ...docSnap.data() }));
  return list;
}

// -----------------------------------------------------------------------------
// Days (completions, mood, tasks/journal/dreams/ideas)
// -----------------------------------------------------------------------------

export async function loadDay(uid, date = new Date()) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) return { ...emptyDayDoc(), ...snap.data() };
  const fresh = emptyDayDoc();
  await setDoc(ref, fresh);
  return fresh;
}

export async function saveDayPatch(uid, date, patch) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  await setDoc(ref, patch, { merge: true });
}

export async function toggleCompletion(uid, habitId, date, done) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const field = `completions.${habitId}`;
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { [field]: done });
  } else {
    await setDoc(ref, { ...emptyDayDoc(), completions: { [habitId]: done } });
  }
}

export async function setMood(uid, moodValue, date = new Date()) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { mood: moodValue });
  } else {
    await setDoc(ref, { ...emptyDayDoc(), mood: moodValue });
  }
}

// Range loader (useful for year overview / heatmaps)
// Loads documents where docId is between startKey and endKey (inclusive).
export async function loadDaysRange(uid, startKey, endKey) {
  const daysCol = subcol(uid, 'days');
  // NOTE: In web modular SDK, ordering by documentId requires importing documentId.
  // To avoid adding another import, we order by the built-in field path "__name__".
  const qy = query(daysCol, orderBy('__name__'), startAt(startKey), endAt(endKey));
  const snap = await getDocs(qy);
  const out = {};
  snap.forEach((d) => {
    out[d.id] = { ...emptyDayDoc(), ...d.data() };
  });
  return out;
}

// Convenience helpers for day lists
export async function upsertTaskList(uid, date, tasks) {
  return saveDayPatch(uid, date, { tasks });
}
export async function upsertJournalList(uid, date, journal) {
  return saveDayPatch(uid, date, { journal });
}
export async function upsertDreamList(uid, date, dreams) {
  return saveDayPatch(uid, date, { dreams });
}
export async function upsertIdeaList(uid, date, ideas) {
  return saveDayPatch(uid, date, { ideas });
}

// -----------------------------------------------------------------------------
// Goals + Quits as top-level subcollections
// -----------------------------------------------------------------------------

export async function loadGoals(uid) {
  const snap = await getDocs(subcol(uid, 'goals'));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}

export async function addGoal(uid, goal) {
  const ref = doc(db, 'users', uid, 'goals', goal.id);
  await setDoc(ref, goal, { merge: true });
}

export async function updateGoal(uid, goalId, patch) {
  const ref = doc(db, 'users', uid, 'goals', goalId);
  await setDoc(ref, patch, { merge: true });
}

export async function removeGoal(uid, goalId) {
  const ref = doc(db, 'users', uid, 'goals', goalId);
  await deleteDoc(ref);
}

export async function loadQuits(uid) {
  const snap = await getDocs(subcol(uid, 'quits'));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}

export async function addQuit(uid, quit) {
  const ref = doc(db, 'users', uid, 'quits', quit.id);
  await setDoc(ref, quit, { merge: true });
}

export async function updateQuit(uid, quitId, patch) {
  const ref = doc(db, 'users', uid, 'quits', quitId);
  await setDoc(ref, patch, { merge: true });
}

export async function removeQuit(uid, quitId) {
  const ref = doc(db, 'users', uid, 'quits', quitId);
  await deleteDoc(ref);
}

// -----------------------------------------------------------------------------
// Books (annual reading log)
// -----------------------------------------------------------------------------

export async function loadBooks(uid) {
  const snap = await getDocs(subcol(uid, 'books'));
  const list = [];
  snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
  return list;
}

export async function addBook(uid, book) {
  const ref = doc(db, 'users', uid, 'books', book.id);
  await setDoc(ref, book, { merge: true });
}

export async function updateBook(uid, bookId, patch) {
  const ref = doc(db, 'users', uid, 'books', bookId);
  await setDoc(ref, patch, { merge: true });
}

export async function removeBook(uid, bookId) {
  const ref = doc(db, 'users', uid, 'books', bookId);
  await deleteDoc(ref);
}

// -----------------------------------------------------------------------------
// Migration from localStorage (habitFreshV1 + legacy keys)
// -----------------------------------------------------------------------------

export async function migrateLocal(uid) {
  const migrationFlag = `firebaseMigrated:${uid}`;
  if (localStorage.getItem(migrationFlag)) return;

  const habits = JSON.parse(localStorage.getItem('habits') || '[]');
  const days = JSON.parse(localStorage.getItem('completions') || '{}');
  const storedState = JSON.parse(localStorage.getItem('habitFreshV1') || 'null');

  // Collect richer state from storedState if present
  const extraDays = {};
  const goals = [];
  const quits = [];
  const books = [];

  if (storedState) {
    // habits
    (storedState.habits || []).forEach((h) => {
      habits.push({
        id: h.id,
        name: h.name,
        isActive: h.isActive ?? true,
        createdAt: h.created || Timestamp.now(),
        cadence: h.cadence,
        days: h.days,
        icon: h.icon,
        color: h.color
      });
    });

    // goals/quits (if present)
    (storedState.goals || []).forEach((g) => goals.push(g));
    (storedState.quits || []).forEach((q) => quits.push(q));
    (storedState.books || []).forEach((b) => books.push(b));

    // day payloads
    Object.entries(storedState.days || {}).forEach(([dateKeyValue, payload]) => {
      const normalized = dayKey(dateKeyValue);
      const p = payload || {};
      const fromHabits = p?.habits || {};
      const existing = days[normalized] || {};
      days[normalized] = { ...existing, ...fromHabits };

      // carry over lists if they exist
      extraDays[normalized] = {
        tasks: Array.isArray(p.tasks) ? p.tasks : [],
        journal: Array.isArray(p.journal) ? p.journal : [],
        dreams: Array.isArray(p.dreams) ? p.dreams : [],
        ideas: Array.isArray(p.ideas) ? p.ideas : []
      };
    });
  }

  // Write habits
  for (const h of habits) {
    const ref = h.id
      ? doc(db, 'users', uid, 'habits', h.id)
      : doc(subcol(uid, 'habits'));
    await setDoc(ref, {
      name: h.name,
      isActive: h.isActive ?? true,
      cadence: h.cadence || 'daily',
      days: h.days || [],
      icon: h.icon || '',
      color: h.color || '#5563ff',
      createdAt: h.createdAt?.toDate ? h.createdAt.toDate() : h.createdAt || Timestamp.now()
    });
  }

  // Write day docs
  for (const [dateKeyValue, completions] of Object.entries(days)) {
    const key = dayKey(dateKeyValue);
    const ref = doc(db, 'users', uid, 'days', key);
    const lists = extraDays[key] || {};
    await setDoc(
      ref,
      {
        ...emptyDayDoc(),
        completions: completions || {},
        mood: null,
        ...lists
      },
      { merge: true }
    );
  }

  // Write goals
  for (const g of goals) {
    if (!g) continue;
    const id = g.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await addGoal(uid, { id, title: g.title || g.text || '', created: g.created || Date.now() });
  }

  // Write quits
  for (const q of quits) {
    if (!q) continue;
    const id = q.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await addQuit(uid, { id, name: q.name || q.text || '', date: q.date || dayKey(new Date()), created: q.created || Date.now() });
  }

  // Write books
  for (const b of books) {
    if (!b) continue;
    const id = b.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await addBook(uid, {
      id,
      title: b.title || b.name || '',
      notes: b.notes || b.text || '',
      created: b.created || Date.now(),
      updated: b.updated || Date.now()
    });
  }

  // cleanup
  localStorage.removeItem('habits');
  localStorage.removeItem('completions');
  localStorage.setItem(migrationFlag, 'done');
}
