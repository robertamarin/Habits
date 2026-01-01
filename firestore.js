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
// Additional Firestore helpers for array operations could be imported if needed in future
// but for now arrays are read, updated and written back manually.

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
  if (snap.exists()) {
    const data = snap.data();
    // Ensure arrays exist; some old docs may lack these fields
    return {
      completions: data.completions || {},
      mood: data.mood ?? null,
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      journal: Array.isArray(data.journal) ? data.journal : [],
      dreams: Array.isArray(data.dreams) ? data.dreams : [],
      ideas: Array.isArray(data.ideas) ? data.ideas : []
    };
  }
  // Initialise day doc with default structure
  const initial = { completions: {}, mood: null, tasks: [], journal: [], dreams: [], ideas: [] };
  await setDoc(ref, initial);
  return initial;
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
    // initialise with defaults and mood
    await setDoc(ref, { completions: {}, mood: moodValue, tasks: [], journal: [], dreams: [], ideas: [] });
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

/**
 * Update or create a day document with the provided patch.
 * If the document doesn't exist it will be created with default structure.
 */
export async function updateDayFields(uid, date = new Date(), patch = {}) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, patch);
  } else {
    // Default structure
    const base = { completions: {}, mood: null, tasks: [], journal: [], dreams: [], ideas: [] };
    await setDoc(ref, { ...base, ...patch });
  }
}

/**
 * Append a task to the tasks array for a given day.
 */
export async function addTask(uid, date = new Date(), task) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Array.isArray(data.tasks) ? data.tasks.slice() : [];
    current.push(task);
    await updateDoc(ref, { tasks: current });
  } else {
    // create doc with default structure and tasks
    await setDoc(ref, {
      completions: {},
      mood: null,
      tasks: [task],
      journal: [],
      dreams: [],
      ideas: []
    });
  }
}

/**
 * Remove a task from a given day by id.
 */
export async function removeTask(uid, date = new Date(), taskId) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Array.isArray(data.tasks) ? data.tasks.slice() : [];
    const next = current.filter((t) => t.id !== taskId);
    await updateDoc(ref, { tasks: next });
  }
}

export async function addJournal(uid, date = new Date(), entry) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Array.isArray(data.journal) ? data.journal.slice() : [];
    current.push(entry);
    await updateDoc(ref, { journal: current });
  } else {
    await setDoc(ref, {
      completions: {},
      mood: null,
      tasks: [],
      journal: [entry],
      dreams: [],
      ideas: []
    });
  }
}

export async function removeJournal(uid, date = new Date(), entryId) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Array.isArray(data.journal) ? data.journal.slice() : [];
    const next = current.filter((j) => j.id !== entryId);
    await updateDoc(ref, { journal: next });
  }
}

export async function addDream(uid, date = new Date(), entry) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Array.isArray(data.dreams) ? data.dreams.slice() : [];
    current.push(entry);
    await updateDoc(ref, { dreams: current });
  } else {
    await setDoc(ref, {
      completions: {},
      mood: null,
      tasks: [],
      journal: [],
      dreams: [entry],
      ideas: []
    });
  }
}

export async function removeDream(uid, date = new Date(), entryId) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Array.isArray(data.dreams) ? data.dreams.slice() : [];
    const next = current.filter((d) => d.id !== entryId);
    await updateDoc(ref, { dreams: next });
  }
}

export async function addIdea(uid, date = new Date(), entry) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Array.isArray(data.ideas) ? data.ideas.slice() : [];
    current.push(entry);
    await updateDoc(ref, { ideas: current });
  } else {
    await setDoc(ref, {
      completions: {},
      mood: null,
      tasks: [],
      journal: [],
      dreams: [],
      ideas: [entry]
    });
  }
}

export async function removeIdea(uid, date = new Date(), entryId) {
  const key = dayKey(date);
  const ref = doc(db, 'users', uid, 'days', key);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Array.isArray(data.ideas) ? data.ideas.slice() : [];
    const next = current.filter((i) => i.id !== entryId);
    await updateDoc(ref, { ideas: next });
  }
}

// Goals
export async function loadGoals(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'goals'));
  const list = [];
  snap.forEach((docSnap) => {
    list.push({ id: docSnap.id, ...docSnap.data() });
  });
  return list;
}

export async function addGoal(uid, title, extra = {}) {
  const col = collection(db, 'users', uid, 'goals');
  const goalRef = extra.id ? doc(col, extra.id) : doc(col);
  await setDoc(goalRef, {
    title,
    created: Timestamp.now(),
    ...extra
  });
  return goalRef.id;
}

export async function updateGoal(uid, goalId, data) {
  const ref = doc(db, 'users', uid, 'goals', goalId);
  await setDoc(ref, { ...data }, { merge: true });
}

export async function removeGoal(uid, goalId) {
  const ref = doc(db, 'users', uid, 'goals', goalId);
  await deleteDoc(ref);
}

// Quits
export async function loadQuits(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'quits'));
  const list = [];
  snap.forEach((docSnap) => {
    list.push({ id: docSnap.id, ...docSnap.data() });
  });
  return list;
}

export async function addQuit(uid, name, date, extra = {}) {
  const col = collection(db, 'users', uid, 'quits');
  const quitRef = extra.id ? doc(col, extra.id) : doc(col);
  await setDoc(quitRef, {
    name,
    date,
    created: Timestamp.now(),
    ...extra
  });
  return quitRef.id;
}

export async function updateQuit(uid, quitId, data) {
  const ref = doc(db, 'users', uid, 'quits', quitId);
  await setDoc(ref, { ...data }, { merge: true });
}

export async function removeQuit(uid, quitId) {
  const ref = doc(db, 'users', uid, 'quits', quitId);
  await deleteDoc(ref);
}



// import {
//   collection,
//   deleteDoc,
//   doc,
//   getDoc,
//   getDocs,
//   setDoc,
//   Timestamp,
//   updateDoc
// } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
// import { db } from './firebase.js';
// import { dayKey } from './utils.js';

// export async function addHabit(uid, name, extra = {}) {
//   const habitsCol = collection(db, 'users', uid, 'habits');
//   const habitRef = extra.id ? doc(habitsCol, extra.id) : doc(habitsCol);
//   await setDoc(habitRef, {
//     name,
//     isActive: true,
//     createdAt: Timestamp.now(),
//     ...extra
//   });
//   return habitRef.id;
// }

// export async function updateHabit(uid, habitId, data) {
//   const habitRef = doc(db, 'users', uid, 'habits', habitId);
//   await setDoc(habitRef, { ...data }, { merge: true });
// }

// export async function removeHabit(uid, habitId) {
//   const habitRef = doc(db, 'users', uid, 'habits', habitId);
//   await deleteDoc(habitRef);
// }

// export async function loadHabits(uid) {
//   const snap = await getDocs(collection(db, 'users', uid, 'habits'));
//   const list = [];
//   snap.forEach((docSnap) => {
//     list.push({ id: docSnap.id, ...docSnap.data() });
//   });
//   return list;
// }

// export async function loadDay(uid, date = new Date()) {
//   const key = dayKey(date);
//   const ref = doc(db, 'users', uid, 'days', key);
//   const snap = await getDoc(ref);
//   if (snap.exists()) return snap.data();
//   await setDoc(ref, { completions: {}, mood: null });
//   return { completions: {}, mood: null };
// }

// export async function toggleCompletion(uid, habitId, date, done) {
//   const key = dayKey(date);
//   const ref = doc(db, 'users', uid, 'days', key);
//   const field = `completions.${habitId}`;
//   const snap = await getDoc(ref);
//   if (snap.exists()) {
//     await updateDoc(ref, { [field]: done });
//   } else {
//     await setDoc(ref, { completions: { [habitId]: done }, mood: null });
//   }
// }

// export async function setMood(uid, moodValue, date = new Date()) {
//   const key = dayKey(date);
//   const ref = doc(db, 'users', uid, 'days', key);
//   const snap = await getDoc(ref);
//   if (snap.exists()) {
//     await updateDoc(ref, { mood: moodValue });
//   } else {
//     await setDoc(ref, { completions: {}, mood: moodValue });
//   }
// }

// export async function migrateLocal(uid) {
//   const migrationFlag = `firebaseMigrated:${uid}`;
//   if (localStorage.getItem(migrationFlag)) return;

//   const habits = JSON.parse(localStorage.getItem('habits') || '[]');
//   const days = JSON.parse(localStorage.getItem('completions') || '{}');
//   const storedState = JSON.parse(localStorage.getItem('habitFreshV1') || 'null');

//   if (storedState) {
//     (storedState.habits || []).forEach((h) => {
//       habits.push({
//         id: h.id,
//         name: h.name,
//         isActive: h.isActive ?? true,
//         createdAt: h.created || Timestamp.now()
//       });
//     });
//     Object.entries(storedState.days || {}).forEach(([dateKeyValue, payload]) => {
//       const normalized = dayKey(dateKeyValue);
//       const existing = days[normalized] || {};
//       days[normalized] = { ...existing, ...(payload?.habits || {}) };
//     });
//   }

//   for (const h of habits) {
//     const ref = h.id ? doc(db, 'users', uid, 'habits', h.id) : doc(collection(db, 'users', uid, 'habits'));
//     await setDoc(ref, {
//       name: h.name,
//       isActive: h.isActive ?? true,
//       createdAt: h.createdAt?.toDate ? h.createdAt.toDate() : h.createdAt || Timestamp.now()
//     });
//   }

//   for (const [dateKeyValue, completions] of Object.entries(days)) {
//     const ref = doc(db, 'users', uid, 'days', dayKey(dateKeyValue));
//     await setDoc(ref, { completions, mood: null }, { merge: true });
//   }

//   localStorage.removeItem('habits');
//   localStorage.removeItem('completions');
//   localStorage.setItem(migrationFlag, 'done');
// }
