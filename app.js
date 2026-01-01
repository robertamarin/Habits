import { signIn, signInWithGoogle, signUp, logOut, observeAuthState } from './auth.js';
import {
  addHabit as addHabitRemote,
  removeHabit as removeHabitRemote,
  loadDay as loadDayRemote,
  upsertTaskList as upsertTaskListRemote,
  upsertJournalList as upsertJournalListRemote,
  upsertDreamList as upsertDreamListRemote,
  upsertIdeaList as upsertIdeaListRemote,
  addGoal as addGoalRemote,
  updateGoal as updateGoalRemote,
  removeGoal as removeGoalRemote,
  addQuit as addQuitRemote,
  updateQuit as updateQuitRemote,
  removeQuit as removeQuitRemote,
  setMood as setMoodRemote,
  toggleCompletion as toggleCompletionRemote,
  updateHabit as updateHabitRemote
} from './firestore.js';
import { dayKey, parseDateValue, randomId, startOfDayIso, startOfMonthKey, today } from './utils.js';

(function () {
  const STORAGE_KEY = 'habitFreshV1';

  const defaultState = () => ({
    habits: [],
    days: {},
    mood: {},
    theme: 'light',
    title: "Robert's 2026 Habit Engine",
    accent: 'violet',
    quits: [],
    goals: [],
    currentYear: new Date().getFullYear(),
    hiddenSections: [],
    selectedDate: today(),
    heatmapFilter: 'all',
    monthCursor: startOfMonthKey()
  });

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch (e) {
      console.warn('Resetting state after parse issue', e);
      return defaultState();
    }
  };

  const normalizeDayKeys = () => {
    const nextDays = {};
    Object.entries(state.days || {}).forEach(([key, value]) => {
      const normalized = dayKey(key);
      const existing = nextDays[normalized] || { habits: {}, tasks: [], journal: [], dreams: [], ideas: [] };
      const incoming = Object.assign({ habits: {}, tasks: [], journal: [], dreams: [], ideas: [] }, value);
      nextDays[normalized] = {
        habits: Object.assign({}, existing.habits, incoming.habits),
        tasks: [...(existing.tasks || []), ...(incoming.tasks || [])],
        journal: [...(existing.journal || []), ...(incoming.journal || [])],
        dreams: [...(existing.dreams || []), ...(incoming.dreams || [])],
        ideas: [...(existing.ideas || []), ...(incoming.ideas || [])]
      };
    });
    state.days = nextDays;
  };

  const normalizeMoodKeys = () => {
    const nextMood = {};
    Object.entries(state.mood || {}).forEach(([key, value]) => {
      if (!value) return;
      nextMood[dayKey(key)] = value;
    });
    state.mood = nextMood;
  };

  const state = loadState();
  normalizeDayKeys();
  normalizeMoodKeys();

  const selectedDate = () => {
    const chosen = dayKey(state.selectedDate || today());
    const todayStart = today();
    const candidate = parseDateValue(chosen);
    candidate.setHours(12, 0, 0, 0);
    const now = parseDateValue(todayStart);
    now.setHours(12, 0, 0, 0);
    return candidate > now ? todayStart : chosen;
  };

  const seedHabitCreationDates = () => {
    const earliestById = {};
    Object.keys(state.days || {}).forEach((date) => {
      const day = state.days[date];
      Object.keys(day?.habits || {}).forEach((id) => {
        if (!earliestById[id] || date < earliestById[id]) earliestById[id] = date;
      });
    });
    state.habits.forEach((habit) => {
      if (!habit.created) habit.created = earliestById[habit.id] || today();
    });
  };

  seedHabitCreationDates();

  const hydrateFromRemote = (payload = {}) => {
    const todayKeyValue = today();
    const { habits = [], day = {}, goals = [], quits = [], yearDays = {} } = payload;
    state.habits = habits.map((h) => ({
      id: h.id,
      name: h.name,
      cadence: h.cadence || 'daily',
      days: h.days || [],
      icon: h.icon || '',
      color: h.color || '#5563ff',
      created: h.createdAt?.toDate ? dayKey(h.createdAt.toDate()) : dayKey(h.createdAt || h.created || todayKeyValue)
    }));
    // Merge today's day document
    const completions = day.completions || {};
    const dayState = getDay(todayKeyValue);
    dayState.habits = { ...dayState.habits, ...completions };
    dayState.tasks = Array.isArray(day.tasks) ? day.tasks : (dayState.tasks || []);
    dayState.journal = Array.isArray(day.journal) ? day.journal : (dayState.journal || []);
    dayState.dreams = Array.isArray(day.dreams) ? day.dreams : (dayState.dreams || []);
    dayState.ideas = Array.isArray(day.ideas) ? day.ideas : (dayState.ideas || []);

    if (day.mood !== undefined && day.mood !== null) state.mood[todayKeyValue] = day.mood;

    // Top-level lists
    state.goals = Array.isArray(goals) ? goals : [];
    state.quits = Array.isArray(quits) ? quits : [];

    // Year cache (optional): merge remote year days into local state.days so year view/pie charts work.
    Object.entries(yearDays || {}).forEach(([k, v]) => {
      const key = dayKey(k);
      const existing = state.days[key] || { habits: {}, tasks: [], journal: [], dreams: [], ideas: [] };
      const payloadDay = v || {};
      state.days[key] = {
        habits: { ...(existing.habits || {}), ...(payloadDay.completions || {}) },
        tasks: Array.isArray(payloadDay.tasks) ? payloadDay.tasks : (existing.tasks || []),
        journal: Array.isArray(payloadDay.journal) ? payloadDay.journal : (existing.journal || []),
        dreams: Array.isArray(payloadDay.dreams) ? payloadDay.dreams : (existing.dreams || []),
        ideas: Array.isArray(payloadDay.ideas) ? payloadDay.ideas : (existing.ideas || [])
      };
      if (payloadDay.mood !== undefined && payloadDay.mood !== null) state.mood[key] = payloadDay.mood;
    });

    saveState();
    renderAll();
  };

  const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const refreshFromStorage = (payload) => {
    const next = payload || loadState();
    Object.assign(state, defaultState(), next);
    normalizeDayKeys();
    normalizeMoodKeys();
    seedHabitCreationDates();
    renderTitle();
    applyTheme();
    applyAccent();
    renderAll();
  };

  const dom = {
    appTitle: document.getElementById('app-title'),
    todayLabel: document.getElementById('today-label'),
    progressRing: document.getElementById('progress-ring'),
    progressFill: document.querySelector('#progress-ring .ring-fill'),
    progressValue: document.getElementById('progress-value'),
    ringSubtext: document.getElementById('ring-subtext'),
    milestoneLabel: document.querySelector('.milestone-label'),
    streakRing: document.getElementById('streak-ring'),
    streakFill: document.querySelector('#streak-ring .ring-fill'),
    summaryHabits: document.getElementById('summary-habits'),
    summaryStreak: document.getElementById('summary-streak'),
    summaryLongest: document.getElementById('summary-longest'),
    summaryRate: document.getElementById('summary-rate'),
    summaryWins: document.getElementById('summary-wins'),
    summaryGoals: document.getElementById('summary-goals'),
    moodSelect: document.getElementById('mood-select'),
    saveMood: document.getElementById('save-mood'),
    moodStatus: document.getElementById('mood-status'),
    moodDateLabel: document.getElementById('mood-date-label'),
    pieHabit: document.getElementById('pie-habit'),
    pieRange: document.getElementById('pie-range'),
    pieVisual: document.getElementById('pie-visual'),
    pieCount: document.getElementById('pie-count'),
    piePercent: document.getElementById('pie-percent'),
    pieDetail: document.getElementById('pie-detail'),
    habitList: document.getElementById('habit-list'),
    emptyHabits: document.getElementById('empty-habits'),
    streak: document.getElementById('streak'),
    momentum: document.getElementById('momentum'),
    streakBar: document.getElementById('streak-bar'),
    markAll: document.getElementById('mark-all'),
    taskForm: document.getElementById('task-form'),
    taskInput: document.getElementById('task-input'),
    taskList: document.getElementById('task-list'),
    taskCount: document.getElementById('task-count'),
    habitForm: document.getElementById('habit-form'),
    habitInput: document.getElementById('habit-input'),
    habitCadence: document.getElementById('habit-cadence'),
    habitIcon: document.getElementById('habit-icon'),
    habitColor: document.getElementById('habit-color'),
    dayPicker: document.getElementById('day-picker'),
    habitSubmit: document.getElementById('habit-submit'),
    habitEditHint: document.getElementById('habit-edit-hint'),
    libraryList: document.getElementById('library-list'),
    journalForm: document.getElementById('journal-form'),
    journalTitle: document.getElementById('journal-title'),
    journalText: document.getElementById('journal-text'),
    journalList: document.getElementById('journal-list'),
    dreamForm: document.getElementById('dream-form'),
    dreamTitle: document.getElementById('dream-title'),
    dreamText: document.getElementById('dream-text'),
    dreamList: document.getElementById('dream-list'),
    ideaForm: document.getElementById('idea-form'),
    ideaTitle: document.getElementById('idea-title'),
    ideaText: document.getElementById('idea-text'),
    ideaList: document.getElementById('idea-list'),
    ideaSaved: document.getElementById('idea-saved'),
    reset: document.getElementById('reset-data'),
    themeToggle: document.getElementById('theme-toggle'),
    history: document.getElementById('history'),
    yearPicker: document.getElementById('year-picker'),
    settingsButton: document.getElementById('settings-button'),
    settingsButtonTop: document.getElementById('settings-button-top'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    titleInput: document.getElementById('title-input'),
    accentPicker: document.getElementById('accent-picker'),
    pace: document.getElementById('pace'),
    focusTime: document.getElementById('focus-time'),
    bestDay: document.getElementById('best-day'),
    quitList: document.getElementById('quit-list'),
    quitManageList: document.getElementById('quit-manage-list'),
    emptyQuit: document.getElementById('empty-quit'),
    calendarMonth: document.getElementById('calendar-month'),
    prevMonth: document.getElementById('prev-month'),
    nextMonth: document.getElementById('next-month'),
    heatmapFilter: document.getElementById('heatmap-filter'),
    dayDetail: document.getElementById('day-detail'),
    detailDate: document.getElementById('detail-date'),
    dayBreakdown: document.querySelector('.day-breakdown'),
    weeklyBars: document.getElementById('weekly-bars'),
    monthlyStrip: document.getElementById('monthly-strip'),
    historyMode: document.getElementById('history-mode'),
    historyToggle: document.getElementById('history-toggle'),
    winsPill: document.getElementById('wins-pill'),
    toolbar: document.querySelector('.toolbar'),
    toolbarToggle: document.getElementById('toolbar-toggle'),
    momentumBar: document.querySelector('.meter-bar span'),
    exportData: document.getElementById('export-data'),
    exportCsv: document.getElementById('export-csv'),
    importJson: document.getElementById('import-json'),
    importCsv: document.getElementById('import-csv'),
    importFile: document.getElementById('import-file'),
    journalSaved: document.getElementById('journal-saved'),
    dreamSaved: document.getElementById('dream-saved'),
    goalForm: document.getElementById('goal-form'),
    goalInput: document.getElementById('goal-input'),
    goalList: document.getElementById('goal-list'),
    goalManageList: document.getElementById('goal-manage-list'),
    quitForm: document.getElementById('quit-form'),
    quitName: document.getElementById('quit-name'),
    quitDate: document.getElementById('quit-date'),
    journalCard: document.querySelector('.journal-card'),
    notesCta: document.getElementById('notes-cta'),
    habitDate: document.getElementById('habit-date'),
    moodQuick: document.getElementById('mood-quick'),
    authPanel: document.getElementById('auth-panel'),
    appShell: document.getElementById('app-shell'),
    signupForm: document.getElementById('signup-form'),
    signupEmail: document.getElementById('signup-email'),
    signupPassword: document.getElementById('signup-password'),
    signinForm: document.getElementById('signin-form'),
    signinEmail: document.getElementById('signin-email'),
    signinPassword: document.getElementById('signin-password'),
    googleSignin: document.getElementById('google-signin'),
    authMessage: document.getElementById('auth-message'),
    logoutButton: document.getElementById('logout-button'),
    userBadge: document.getElementById('user-badge')
  };

  const moodFaces = { 1: '😞', 2: '😐', 3: '🙂', 4: '😃', 5: '🤩' };
  const moodLabels = {
    1: 'Low',
    2: 'Flat',
    3: 'Okay',
    4: 'Good',
    5: 'Great'
  };

  let editingHabitId = null;
  let lastProgressPercent = 0;
  let historyExpanded = false;
  let currentUser = null;

  const showAuthPanel = (message) => {
    if (dom.appShell) dom.appShell.classList.add('hidden');
    if (dom.authPanel) dom.authPanel.classList.remove('hidden');
    if (dom.authMessage && message) dom.authMessage.textContent = message;
  };

  const showApp = (user) => {
    if (dom.authPanel) dom.authPanel.classList.add('hidden');
    if (dom.appShell) dom.appShell.classList.remove('hidden');
    if (dom.logoutButton) dom.logoutButton.classList.remove('hidden');
    if (dom.userBadge) {
      dom.userBadge.textContent = user?.email || 'Signed in';
      dom.userBadge.classList.remove('hidden');
    }
  };

  const getDay = (date) => {
    const key = dayKey(date);
    if (!state.days[key]) {
      state.days[key] = { habits: {}, tasks: [], journal: [], dreams: [], ideas: [] };
    } else {
      state.days[key].dreams = state.days[key].dreams || [];
      state.days[key].journal = state.days[key].journal || [];
      state.days[key].tasks = state.days[key].tasks || [];
      state.days[key].habits = state.days[key].habits || {};
      state.days[key].ideas = state.days[key].ideas || [];
    }
    return state.days[key];
  };

  const formatDate = (value, options = { weekday: 'long', month: 'long', day: 'numeric' }) =>
    new Intl.DateTimeFormat(undefined, options).format(parseDateValue(value));

  const shouldShowHabitToday = (habit, dateValue) => {
    const day = parseDateValue(dateValue).getDay();
    if (habit.cadence === 'daily') return true;
    if (habit.cadence === 'weekdays') return day >= 1 && day <= 5;
    if (habit.cadence === 'custom') return (habit.days || []).includes(day);
    return true;
  };

  const isHabitActiveOn = (habit, dateValue) => {
    const target = typeof dateValue === 'string' ? dateValue : dayKey(dateValue);
    const created = habit.created ? dayKey(habit.created) : null;
    if (created && created > target) return false;
    return shouldShowHabitToday(habit, target);
  };

  const activeHabitsForDate = (dateValue, filterId = 'all') =>
    state.habits.filter((h) => (filterId === 'all' ? true : h.id === filterId) && isHabitActiveOn(h, dateValue));

  const dateKeysBack = (count) => Array.from({ length: count }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return dayKey(d);
  });

  const habitDoneOnDate = (habit, dateValue) => {
    const key = dayKey(dateValue);
    const day = state.days[key];
    if (!isHabitActiveOn(habit, dateValue)) return null;
    return Boolean(day && day.habits && day.habits[habit.id]);
  };

  const habitHistory = (habit, days = 7) => {
    const dates = dateKeysBack(days).reverse();
    return dates.map((date) => {
      const done = habitDoneOnDate(habit, date);
      return done === null ? null : Number(done);
    });
  };

  const hasActivity = (day) =>
    Boolean(day && (Object.keys(day.habits || {}).length || (day.tasks || []).length || (day.journal || []).length || (day.dreams || []).length || (day.ideas || []).length));

  const updateDayPickerVisibility = () => {
    if (!dom.dayPicker || !dom.habitCadence) return;
    const custom = dom.habitCadence.value === 'custom';
    dom.dayPicker.style.display = custom ? 'flex' : 'none';
  };

  const completionLevel = (percent, hasHabits, hasData = true) => {
    if (!hasData || !hasHabits || percent === null) return 0;
    if (percent >= 95) return 1;
    if (percent >= 70) return 2;
    if (percent >= 35) return 3;
    return 4;
  };

  const renderTitle = () => {
    if (dom.appTitle) dom.appTitle.textContent = state.title;
    if (dom.titleInput) dom.titleInput.value = state.title;
    document.title = state.title;
  };

  const applyTheme = () => {
    const mode = state.theme || 'light';
    if (mode === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (dom.themeToggle) dom.themeToggle.checked = mode === 'light';
  };

  const applyAccent = () => {
    const palette = ['violet', 'mint', 'amber'];
    const accent = palette.includes(state.accent) ? state.accent : 'violet';
    state.accent = accent;
    document.documentElement.setAttribute('data-accent', accent);
    if (dom.accentPicker) dom.accentPicker.value = accent;
  };

  const applyHiddenSections = () => {
    document.querySelectorAll('[data-section]').forEach((section) => {
      const shouldHide = state.hiddenSections.includes(section.dataset.section);
      section.classList.toggle('hidden', shouldHide);
    });
  };

  const syncHiddenSectionToggles = () => {
    document.querySelectorAll('[data-section-toggle]').forEach((input) => {
      input.checked = state.hiddenSections.includes(input.value);
    });
  };

  const renderMoodPicker = () => {
    if (!dom.moodSelect) return;
    const date = selectedDate();
    const saved = state.mood[date];
    dom.moodSelect.value = saved ? String(saved) : dom.moodSelect.value || '3';
    if (dom.moodDateLabel) dom.moodDateLabel.textContent = formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });
    if (dom.moodStatus) {
      dom.moodStatus.textContent = saved ? `${moodFaces[saved] || '🙂'} ${moodLabels[saved]}` : 'Not saved';
      dom.moodStatus.classList.toggle('badge', Boolean(saved));
    }
    if (dom.moodQuick) {
      const currentValue = Number(dom.moodSelect.value || '3');
      dom.moodQuick.querySelectorAll('[data-mood-value]').forEach((button) => {
        const value = Number(button.dataset.moodValue);
        const active = currentValue === value;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
  };

  const renderChecklist = () => {
    if (!dom.habitList) return;
    const date = selectedDate();
    const day = getDay(date);
    const todayHabits = activeHabitsForDate(date);

    dom.habitList.innerHTML = '';
    if (!todayHabits.length) {
      dom.emptyHabits.classList.remove('hidden');
    } else {
      dom.emptyHabits.classList.add('hidden');
    }

    const reorder = (fromId, toId) => {
      const fromIndex = state.habits.findIndex((h) => h.id === fromId);
      const toIndex = state.habits.findIndex((h) => h.id === toId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
      const [moved] = state.habits.splice(fromIndex, 1);
      state.habits.splice(toIndex, 0, moved);
      saveState();
      renderChecklist();
      renderLibrary();
    };

    todayHabits.forEach((habit) => {
      const item = document.createElement('div');
      item.className = 'habit-item';
      item.dataset.id = habit.id;
      item.draggable = true;

      const handle = document.createElement('span');
      handle.textContent = '☰';
      handle.className = 'habit-handle';

      const body = document.createElement('div');
      body.className = 'habit-body';

      const mini = document.createElement('div');
      mini.className = 'mini-ring';
      const miniSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      miniSvg.setAttribute('viewBox', '0 0 40 40');
      const miniBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      miniBg.setAttribute('cx', '20');
      miniBg.setAttribute('cy', '20');
      miniBg.setAttribute('r', '16');
      miniBg.classList.add('mini-bg');
      const miniFill = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      miniFill.setAttribute('cx', '20');
      miniFill.setAttribute('cy', '20');
      miniFill.setAttribute('r', '16');
      miniFill.classList.add('mini-fill');
      miniFill.style.stroke = habit.color || 'var(--accent-strong)';
      miniSvg.append(miniBg, miniFill);
      mini.append(miniSvg);

      const consistency = habitHistory(habit, 7);
      const validDays = consistency.filter((v) => v !== null);
      const doneCount = validDays.filter(Boolean).length;
      const totalConsidered = validDays.length || 1;
      const consistencyPercent = Math.round((doneCount / totalConsidered) * 100);
      const circumference = 2 * Math.PI * 16;
      const miniOffset = circumference - (consistencyPercent / 100) * circumference;
      miniFill.style.strokeDasharray = `${circumference}`;
      miniFill.style.strokeDashoffset = miniOffset;
      miniFill.style.opacity = day.habits[habit.id] ? '1' : '0.5';

      const box = document.createElement('label');
      box.className = 'checkbox';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(day.habits[habit.id]);
      input.addEventListener('change', async () => {
        day.habits[habit.id] = input.checked;
        saveState();
        renderProgress(true);
        renderHistory();
        miniFill.style.opacity = input.checked ? '1' : '0.5';
        badge.textContent = input.checked ? 'Done' : 'Pending';
        if (currentUser) {
          await toggleCompletionRemote(currentUser.uid, habit.id, date, input.checked);
        }
      });

      const labels = document.createElement('div');
      labels.className = 'habit-meta';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = habit.icon ? `${habit.icon} ${habit.name}` : habit.name;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = habit.cadence === 'custom' ? `Days: ${(habit.days || []).length}` : habit.cadence;
      labels.append(title, meta);

      box.append(input, labels);

      body.append(mini, box);

      const actions = document.createElement('div');
      actions.className = 'habit-actions';
      actions.append(handle);

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = input.checked ? 'Done' : 'Pending';
      badge.style.borderColor = habit.color || 'var(--border)';

      const topRow = document.createElement('div');
      topRow.className = 'row between';
      topRow.append(body, badge, actions);

      item.append(topRow);
      dom.habitList.append(item);

      item.addEventListener('dragstart', () => item.classList.add('dragging'));
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', (event) => {
        event.preventDefault();
        const source = document.querySelector('.habit-item.dragging');
        if (!source) return;
        const fromId = source.dataset.id;
        if (fromId !== habit.id) reorder(fromId, habit.id);
      });
    });

    renderProgress();
  };

  const renderTasks = () => {
    if (!dom.taskList) return;
    const day = getDay(today());
    dom.taskList.innerHTML = '';
    if (!day.tasks.length) {
      dom.taskList.innerHTML = '<div class="empty">No wins yet—log your first quick win.</div>';
      if (dom.taskCount) dom.taskCount.textContent = 'No wins yet';
      if (dom.winsPill) dom.winsPill.textContent = '0';
      return;
    }

    day.tasks.forEach((task) => {
      const item = document.createElement('div');
      item.className = 'task';

      const left = document.createElement('div');
      left.className = 'task-text';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = task.title;
      const time = document.createElement('span');
      time.className = 'meta';
      const createdDate = task.created ? new Date(task.created) : new Date(today());
      const dateText = formatDate(dayKey(createdDate), { month: 'short', day: 'numeric' });
      const timeText = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      time.textContent = `${dateText} · ${timeText}`;

      left.append(title, time);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost';
      remove.textContent = 'Delete';
      remove.addEventListener('click', async () => {
        day.tasks = day.tasks.filter((t) => t.id !== task.id);
        saveState();
        if (currentUser?.uid) {
          try {
            await upsertTaskListRemote(currentUser.uid, today(), day.tasks);
          } catch (e) {
            console.warn('Failed to save tasks to Firestore', e);
          }
        }
        renderTasks();
        renderHistory();
      });

      item.append(left, remove);
      dom.taskList.append(item);
    });

    dom.taskCount.textContent = `${day.tasks.length} logged`;
    if (dom.winsPill) {
      dom.winsPill.textContent = `${day.tasks.length}`;
      dom.winsPill.classList.add('wins-pulse');
      setTimeout(() => dom.winsPill && dom.winsPill.classList.remove('wins-pulse'), 260);
    }
    renderDashboardSummary();
  };

  const renderLibrary = () => {
    if (!dom.libraryList) return;
    dom.libraryList.innerHTML = '';
    if (!state.habits.length) {
      dom.libraryList.innerHTML = '<div class="empty">No habits yet</div>';
      return;
    }

    state.habits.forEach((habit) => {
      const item = document.createElement('div');
      item.className = 'habit-item';

      const block = document.createElement('div');
      block.className = 'checkbox';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = habit.icon ? `${habit.icon} ${habit.name}` : habit.name;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = habit.cadence === 'custom'
        ? `Specific days (${(habit.days || []).length})`
        : habit.cadence;
      if (habit.color) meta.style.color = habit.color;

      block.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'row';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'ghost';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => {
        editingHabitId = habit.id;
        dom.habitInput.value = habit.name;
        dom.habitCadence.value = habit.cadence;
        updateDayPickerVisibility();
        if (habit.cadence === 'custom') {
          dom.dayPicker.querySelectorAll('input').forEach((i) => {
            i.checked = (habit.days || []).includes(Number(i.value));
          });
        } else {
          dom.dayPicker.querySelectorAll('input').forEach((i) => (i.checked = false));
        }
        if (dom.habitIcon) dom.habitIcon.value = habit.icon || '';
        if (dom.habitColor) dom.habitColor.value = habit.color || '#5563ff';
        if (dom.habitSubmit) dom.habitSubmit.textContent = 'Update habit';
        if (dom.habitEditHint) dom.habitEditHint.textContent = 'Editing existing habit';
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost';
      remove.textContent = 'Remove';
      remove.addEventListener('click', async () => {
        const date = today();
        const day = getDay(date);
        delete day.habits[habit.id];
        state.habits = state.habits.filter((h) => h.id !== habit.id);
        if (editingHabitId === habit.id) {
          editingHabitId = null;
          if (dom.habitSubmit) dom.habitSubmit.textContent = 'Add habit';
          if (dom.habitEditHint) dom.habitEditHint.textContent = 'Add to today\'s checklist';
          if (dom.habitInput) dom.habitInput.value = '';
          if (dom.habitIcon) dom.habitIcon.value = '';
          if (dom.habitColor) dom.habitColor.value = '#5563ff';
        }
        saveState();
        renderChecklist();
        renderLibrary();
        renderProgress();
        renderHistory();
        if (currentUser) await removeHabitRemote(currentUser.uid, habit.id);
      });

      actions.append(edit, remove);
      item.append(block, actions);
      dom.libraryList.append(item);
    });
    renderDashboardSummary();
    renderHeatmapFilter();
  };

  const renderJournal = () => {
    if (!dom.journalList) return;
    const date = today();
    const day = getDay(date);
    if (dom.journalSaved) dom.journalSaved.textContent = day.journal.length ? 'Saved' : 'Unsaved';
    if (dom.journalSaved) dom.journalSaved.classList.toggle('badge', day.journal.length > 0);
    dom.journalList.innerHTML = '';
    if (!day.journal.length) {
      dom.journalList.innerHTML = '<div class="empty">No entries yet</div>';
      if (dom.notesCta) dom.notesCta.classList.add('hidden');
      if (dom.journalCard) dom.journalCard.classList.remove('collapsed');
      return;
    }
    if (dom.notesCta) dom.notesCta.classList.add('hidden');
    if (dom.journalCard) dom.journalCard.classList.remove('collapsed');

    day.journal
      .slice()
      .sort((a, b) => b.created - a.created)
      .forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'journal-item';
        const content = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = entry.title || 'Untitled note';
        const text = document.createElement('p');
        text.textContent = entry.text;
        content.append(title, text);

        const time = document.createElement('span');
        time.className = 'meta';
        time.textContent = new Date(entry.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ghost';
        remove.textContent = 'Delete';
        remove.addEventListener('click', async () => {
          day.journal = day.journal.filter((j) => j.id !== entry.id);
          saveState();
          if (currentUser?.uid) {
            try {
              await upsertJournalListRemote(currentUser.uid, date, day.journal);
            } catch (e) {
              console.warn('Failed to save journal to Firestore', e);
            }
          }
          renderJournal();
          renderHistory();
        });

        item.append(content, time, remove);
        dom.journalList.append(item);
      });
  };

  const renderDreams = () => {
    if (!dom.dreamList) return;
    const date = today();
    const day = getDay(date);
    if (dom.dreamSaved) dom.dreamSaved.textContent = day.dreams.length ? 'Saved' : 'Unsaved';
    if (dom.dreamSaved) dom.dreamSaved.classList.toggle('badge', day.dreams.length > 0);
    dom.dreamList.innerHTML = '';
    if (!day.dreams.length) {
      dom.dreamList.innerHTML = '<div class="empty">No dreams yet</div>';
      return;
    }
    day.dreams
      .slice()
      .sort((a, b) => b.created - a.created)
      .forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'journal-item';
        const content = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = entry.title || 'Dream';
        const text = document.createElement('p');
        text.textContent = entry.text;
        content.append(title, text);

        const time = document.createElement('span');
        time.className = 'meta';
        time.textContent = new Date(entry.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ghost';
        remove.textContent = 'Delete';
        remove.addEventListener('click', async () => {
          day.dreams = day.dreams.filter((j) => j.id !== entry.id);
          saveState();
          if (currentUser?.uid) {
            try {
              await upsertDreamListRemote(currentUser.uid, date, day.dreams);
            } catch (e) {
              console.warn('Failed to save dreams to Firestore', e);
            }
          }
          renderDreams();
          renderHistory();
        });

        item.append(content, time, remove);
        dom.dreamList.append(item);
      });
  };

  const computeStreak = () => {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const todayHabits = activeHabitsForDate(key);
      const day = state.days[key];
      if (!day && !todayHabits.length) continue;
      if (!day) break;
      const total = todayHabits.length;
      const done = todayHabits.filter((h) => day.habits && day.habits[h.id]).length;
      if (!total) continue;
      if (done === total) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  };

  const computeLongestStreak = () => {
    const dates = dateKeysBack(365).reverse();
    let longest = 0;
    let current = 0;
    dates.forEach((date) => {
      const todaysHabits = activeHabitsForDate(date);
      if (!todaysHabits.length) {
        return;
      }
      const day = state.days[date];
      const done = todaysHabits.filter((h) => day?.habits?.[h.id]).length;
      if (done === todaysHabits.length) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    });
    return longest;
  };

  const streakThrough = (dateValue) => {
    let streak = 0;
    const start = parseDateValue(dateValue);
    for (let i = 0; i < 365; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() - i);
      const key = dayKey(d);
      const todayHabits = activeHabitsForDate(key);
      const day = state.days[key];
      if (!day && !todayHabits.length) continue;
      if (!day) break;
      const total = todayHabits.length;
      const done = todayHabits.filter((h) => day.habits && day.habits[h.id]).length;
      if (!total) continue;
      if (done === total) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  };

  const dayCompletion = (date, filterId = 'all') => {
    const key = dayKey(date);
    const day = state.days[key];
    const todaysHabits = activeHabitsForDate(key, filterId);
    const total = todaysHabits.length;
    const done = day ? todaysHabits.filter((h) => day.habits && day.habits[h.id]).length : 0;
    if (!total) return null;
    return Math.round((done / total) * 100);
  };

  const taskCompletion = (date) => {
    const day = state.days[date];
    if (!day || !day.tasks.length) return 0;
    return 100;
  };

  const renderProgress = (fromAction = false) => {
    if (!dom.progressFill) return;
    const date = selectedDate();
    const day = getDay(date);
    const todayHabits = activeHabitsForDate(date);
    const total = todayHabits.length;
    const done = todayHabits.filter((h) => day.habits[h.id]).length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    if (dom.progressValue) dom.progressValue.textContent = `${percent}%`;
    if (dom.ringSubtext) dom.ringSubtext.textContent = `${done} of ${todayHabits.length} habits`;
    if (dom.progressRing) dom.progressRing.setAttribute('title', `${percent}% complete (${done}/${todayHabits.length})`);
    const circumference = 440;
    const offset = circumference - (percent / 100) * circumference;
    dom.progressFill.style.strokeDashoffset = offset;
    dom.progressFill.style.stroke = 'var(--accent)';
    if (fromAction && percent !== lastProgressPercent) {
      dom.progressFill.classList.add('wins-pulse');
      setTimeout(() => dom.progressFill && dom.progressFill.classList.remove('wins-pulse'), 300);
    }
    lastProgressPercent = percent;
    dom.streak.textContent = `${computeStreak()}d`;
    renderStreakBar();
    renderStats();
    renderWeekly();
    renderMonthly();
    renderDashboardSummary(percent, done, todayHabits.length, day.tasks.length);
    renderCompletionPie();
  };

  const renderStreakBar = () => {
    if (!dom.streakBar) return;
    const streakCount = computeStreak();
    const percent = Math.min((streakCount / 60) * 100, 100);
    const circumference = 440;
    const offset = circumference - (percent / 100) * circumference;
    if (dom.streakFill) dom.streakFill.style.strokeDashoffset = offset;
    if (dom.streakFill) dom.streakFill.style.strokeDasharray = `${circumference}`;
    if (dom.streak) dom.streak.textContent = `${streakCount}d`;
    dom.streakBar.setAttribute('title', `Current streak: ${streakCount} day${streakCount === 1 ? '' : 's'}`);
    const milestones = [7, 14, 30, 60];
    const reached = milestones.filter((m) => streakCount >= m).pop();
    if (dom.milestoneLabel) {
      if (reached) {
        dom.milestoneLabel.textContent = `Milestone: ${reached} days`;
        dom.streakBar.classList.add('wins-pulse');
        setTimeout(() => dom.streakBar && dom.streakBar.classList.remove('wins-pulse'), 400);
      } else {
        const next = milestones.find((m) => m > streakCount) || 60;
        dom.milestoneLabel.textContent = `Next milestone: ${next} days`;
      }
    }
  };

  const renderStats = () => {
    if (!dom.momentum) return;
    const dates = dateKeysBack(7);
    const percents = dates.map((d) => dayCompletion(d)).filter((v) => v !== null);
    const avg = percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0;
    dom.momentum.textContent = `${avg}%`;

    const todayPercent = dayCompletion(today()) ?? 0;
    const yesterday = dayCompletion(dateKeysBack(2)[1]) ?? 0;
    const diff = todayPercent - yesterday;
    if (dom.pace) dom.pace.textContent = diff === 0 ? 'Even' : `${diff > 0 ? '+' : ''}${diff}%`;

    const best = Object.keys(state.days).reduce((max, key) => {
      const value = dayCompletion(key);
      if (value === null) return max;
      return Math.max(max, value);
    }, 0);
    if (dom.bestDay) dom.bestDay.textContent = `${best}%`;

    if (dom.focusTime) {
      const tasksDone = getDay(today()).tasks.length;
      const minutes = tasksDone * 15;
      dom.focusTime.textContent = `${(minutes / 60).toFixed(1)}h`;
    }
    if (dom.momentumBar) dom.momentumBar.style.width = `${avg}%`;

  };

  const renderCompletionPie = () => {
    if (!dom.pieVisual) return;
    if (dom.pieHabit) {
      dom.pieHabit.innerHTML = '';
      state.habits.forEach((habit) => {
        const opt = document.createElement('option');
        opt.value = habit.id;
        opt.textContent = habit.name;
        dom.pieHabit.append(opt);
      });
    }

    if (!state.habits.length) {
      if (dom.pieCount) dom.pieCount.textContent = '0/0';
      if (dom.piePercent) dom.piePercent.textContent = '0%';
      if (dom.pieDetail) dom.pieDetail.textContent = 'Add a habit to see insights.';
      dom.pieVisual.style.background = 'conic-gradient(var(--panel-soft) 0deg, var(--panel-soft) 360deg)';
      return;
    }

    const fallbackHabitId = state.habits[0].id;
    const selectedHabitId = dom.pieHabit && state.habits.some((h) => h.id === dom.pieHabit.value)
      ? dom.pieHabit.value
      : fallbackHabitId;
    if (dom.pieHabit) dom.pieHabit.value = selectedHabitId;

    const daysBack = Number(dom.pieRange ? dom.pieRange.value : 14) || 14;
    const anchor = parseDateValue(selectedDate());
    anchor.setHours(12, 0, 0, 0);
    const dates = Array.from({ length: daysBack }).map((_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      return dayKey(d);
    });

    const habit = state.habits.find((h) => h.id === selectedHabitId);
    const activeDates = dates.filter((date) => habit && isHabitActiveOn(habit, date));
    const totalDays = activeDates.length;
    const completedDays = activeDates.filter((date) => state.days[date]?.habits?.[selectedHabitId]).length;
    const missedDays = Math.max(0, totalDays - completedDays);
    const percent = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;
    const fillStop = totalDays ? (completedDays / totalDays) * 100 : 0;
    dom.pieVisual.style.background = `conic-gradient(var(--accent-strong) 0% ${fillStop}%, color-mix(in srgb, var(--accent-soft) 50%, var(--border)) ${fillStop}% 100%)`;
    if (dom.pieCount) dom.pieCount.textContent = `${completedDays}/${totalDays || daysBack}`;
    if (dom.piePercent) dom.piePercent.textContent = `${percent}%`;
    if (dom.pieDetail) {
      dom.pieDetail.textContent = totalDays
        ? `${completedDays} completed · ${missedDays} missed in ${daysBack} days`
        : 'No active days in this range.';
    }
  };

  const renderWeekly = () => {
    if (!dom.weeklyBars) return;
    if (!state.habits.length) {
      dom.weeklyBars.innerHTML = '<div class="empty">Add habits to see weekly progress.</div>';
      return;
    }
    const todayDate = new Date();
    const start = new Date(todayDate);
    const offset = (todayDate.getDay() + 6) % 7; // Monday start
    start.setDate(todayDate.getDate() - offset);
    const dates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return dayKey(d);
    });
    dom.weeklyBars.innerHTML = '';
    const percents = dates.map((date) => dayCompletion(date));
    percents.forEach((percent, index) => {
      const date = dates[index];
      const row = document.createElement('div');
      row.className = 'week-row';
      const label = document.createElement('div');
      label.className = 'week-label';
      label.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(parseDateValue(date));
      const track = document.createElement('div');
      track.className = 'week-track';
      const fill = document.createElement('span');
      fill.className = 'week-fill';
      const safePercent = percent ?? 0;
      fill.style.width = `${safePercent}%`;
      fill.title = percent === null
        ? `${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}: No active habits`
        : `${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}: ${percent}% complete`;
      track.append(fill);
      const value = document.createElement('div');
      value.className = 'week-value';
      value.textContent = percent === null ? '—' : `${percent}%`;
      row.append(label, track, value);
      dom.weeklyBars.append(row);
    });
  };

  const renderMonthly = () => {
    if (!dom.monthlyStrip) return;
    renderHeatmapFilter();
    dom.monthlyStrip.innerHTML = '';
    const cursor = parseDateValue(state.monthCursor || startOfMonthKey());
    cursor.setHours(12, 0, 0, 0);
    const monthStart = Number.isNaN(cursor.getTime()) ? parseDateValue(startOfMonthKey()) : cursor;
    monthStart.setDate(1);
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const start = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthStart);
    if (dom.calendarMonth) dom.calendarMonth.textContent = monthLabel;
    const leadingBlanks = start.getDay();
    for (let i = 0; i < leadingBlanks; i++) {
      const spacer = document.createElement('div');
      spacer.className = 'calendar-empty';
      spacer.setAttribute('aria-hidden', 'true');
      dom.monthlyStrip.append(spacer);
    }

    const filterId = state.heatmapFilter || 'all';

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateObj = new Date(year, month, dayNum);
      const date = dayKey(dateObj);
      const todaysHabits = activeHabitsForDate(date, filterId);
      const hasHabits = todaysHabits.length > 0;
      const dayState = state.days[date];
      const done = todaysHabits.filter((h) => dayState?.habits?.[h.id]).length;
      const wins = (dayState?.tasks || []).length;
      const hasData = hasActivity(dayState);
      const percent = hasHabits ? Math.round((done / todaysHabits.length) * 100) : null;
      const level = completionLevel(percent, hasHabits, hasData);

      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.level = String(level);
      button.textContent = String(dayNum);
      if (date === today()) button.classList.add('today');
      const habitLabel = hasHabits
        ? `${done}/${todaysHabits.length} habits`
        : 'No active habits';
      const percentLabel = percent === null ? '' : ` · ${percent}%`;
      button.title = `${formatDate(date, { month: 'short', day: 'numeric' })}: ${habitLabel}${percentLabel} · ${wins} wins`;
      button.setAttribute('aria-label', `${formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}: ${habitLabel}`);
      button.addEventListener('click', () => openDayDetail(date));
      dom.monthlyStrip.append(button);
    }

    const totalCells = leadingBlanks + daysInMonth;
    const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 0; i < trailing; i++) {
      const spacer = document.createElement('div');
      spacer.className = 'calendar-empty';
      spacer.setAttribute('aria-hidden', 'true');
      dom.monthlyStrip.append(spacer);
    }
  };

  const renderHeatmapFilter = () => {
    if (!dom.heatmapFilter) return;
    const current = state.heatmapFilter || 'all';
    dom.heatmapFilter.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All';
    dom.heatmapFilter.append(allOption);
    state.habits.forEach((habit) => {
      const opt = document.createElement('option');
      opt.value = habit.id;
      opt.textContent = habit.name;
      dom.heatmapFilter.append(opt);
    });
    const exists = current === 'all' || state.habits.some((h) => h.id === current);
    dom.heatmapFilter.value = exists ? current : 'all';
    state.heatmapFilter = dom.heatmapFilter.value;
  };

  const changeMonth = (delta) => {
    const base = parseDateValue(state.monthCursor || startOfMonthKey());
    base.setHours(12, 0, 0, 0);
    if (Number.isNaN(base.getTime())) base.setTime(parseDateValue(startOfMonthKey()).getTime());
    base.setDate(1);
    base.setMonth(base.getMonth() + delta);
    const todayStart = parseDateValue(startOfMonthKey());
    todayStart.setHours(12, 0, 0, 0);
    if (base > todayStart) base.setTime(todayStart.getTime());
    state.monthCursor = startOfMonthKey(base);
    saveState();
    renderMonthly();
  };

  const renderHistory = () => {
    if (!dom.history) return;
    if (dom.historyToggle) dom.historyToggle.textContent = historyExpanded ? 'Collapse year view' : 'Expand year view';
    const todayDate = new Date();
    const safeYear = Math.min(state.currentYear || todayDate.getFullYear(), todayDate.getFullYear());
    state.currentYear = safeYear;
    const currentYearValue = safeYear;
    const storedYears = Object.keys(state.days).map((key) => parseDateValue(key).getFullYear());
    const minYear = Math.min(...(storedYears.length ? storedYears : [currentYearValue, 2025]));
    const maxYear = todayDate.getFullYear();
    if (dom.yearPicker) {
      dom.yearPicker.innerHTML = '';
      for (let y = maxYear; y >= minYear; y--) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = y;
        if (y === currentYearValue) opt.selected = true;
        dom.yearPicker.append(opt);
      }
    }
    const mode = dom.historyMode ? dom.historyMode.value : 'year';
    dom.history.classList.toggle('collapsed', !historyExpanded);
    if (!historyExpanded) return;
    const year = currentYearValue;
    const start = new Date(year, 0, 1);
    const end = new Date(Math.min(todayDate.getTime(), new Date(year, 11, 31).getTime()));
    dom.history.innerHTML = '';

    if (mode === 'month') {
      const monthStart = new Date(year, todayDate.getMonth(), 1);
      const daysInMonth = new Date(year, todayDate.getMonth() + 1, 0).getDate();
      const dates = Array.from({ length: daysInMonth }).map((_, i) => {
        const d = new Date(monthStart);
        d.setDate(monthStart.getDate() + i);
        return dayKey(d);
      });
      dates.forEach((date) => {
        const todaysHabits = activeHabitsForDate(date);
        const total = todaysHabits.length;
        const day = state.days[date];
        const hasData = hasActivity(day);
        const done = todaysHabits.filter((h) => day?.habits?.[h.id]).length;
        const percent = total ? Math.round((done / total) * 100) : null;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'day-tile';
        tile.dataset.level = String(completionLevel(percent, total > 0, hasData));
        const heading = document.createElement('strong');
        heading.textContent = formatDate(date, { month: 'short', day: 'numeric' });
        const stats = document.createElement('div');
        stats.className = 'meta';
        stats.textContent = total ? `${done}/${total} habits` : 'No active habits';
        const wins = (day?.tasks || []).length;
        tile.title = `Habits: ${done}/${total || 0}\nWins: ${wins}\nStreak: ${streakThrough(date)}d`;
        tile.append(heading, stats);
        const moodValue = state.mood[date];
        if (moodValue) {
          const moodBadge = document.createElement('span');
          moodBadge.className = 'mood-marker';
          moodBadge.textContent = `${moodFaces[moodValue] || '🙂'} ${moodLabels[moodValue]}`;
          moodBadge.title = `Mood: ${moodLabels[moodValue]}`;
          tile.append(moodBadge);
        }
        tile.addEventListener('click', () => openDayDetail(date));
        dom.history.append(tile);
      });
      return;
    }

    const daysInRange = Math.floor((end - start) / 86400000) + 1;
    const dates = Array.from({ length: daysInRange }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return dayKey(d);
    });

    dates.forEach((date) => {
      const todaysHabits = activeHabitsForDate(date);
      const total = todaysHabits.length;
      const day = state.days[date];
      const hasData = hasActivity(day);
      const done = todaysHabits.filter((h) => day?.habits?.[h.id]).length;
      const percent = total ? Math.round((done / total) * 100) : null;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'day-tile';
      tile.dataset.level = String(completionLevel(percent, total > 0, hasData));

      const heading = document.createElement('strong');
      heading.textContent = formatDate(date, { month: 'short', day: 'numeric' });
      const stats = document.createElement('div');
      stats.className = 'meta';
      stats.textContent = total && percent !== null ? `${percent}%` : 'No active habits';
      const wins = (day?.tasks || []).length;
      tile.title = `Habits: ${done}/${total || 0}\nWins: ${wins}\nStreak: ${streakThrough(date)}d`;

      tile.append(heading, stats);
      const moodValue = state.mood[date];
      if (moodValue) {
        const moodBadge = document.createElement('span');
        moodBadge.className = 'mood-marker';
        moodBadge.textContent = `${moodFaces[moodValue] || '🙂'} ${moodLabels[moodValue]}`;
        moodBadge.title = `Mood: ${moodLabels[moodValue]}`;
        tile.append(moodBadge);
      }
      tile.addEventListener('click', () => openDayDetail(date));
      dom.history.append(tile);
    });
  };

  const renderIdeas = () => {
    if (!dom.ideaList) return;
    const date = today();
    const day = getDay(date);
    if (dom.ideaSaved) dom.ideaSaved.textContent = day.ideas.length ? 'Saved' : 'Unsaved';
    if (dom.ideaSaved) dom.ideaSaved.classList.toggle('badge', day.ideas.length > 0);
    dom.ideaList.innerHTML = '';
    if (!day.ideas.length) {
      dom.ideaList.innerHTML = '<div class="empty">No ideas yet</div>';
      return;
    }
    day.ideas
      .slice()
      .sort((a, b) => b.created - a.created)
      .forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'journal-item';
        const content = document.createElement('div');
        const title = document.createElement('h4');
        title.textContent = entry.title || 'Idea';
        const text = document.createElement('p');
        text.textContent = entry.text;
        content.append(title, text);

        const time = document.createElement('span');
        time.className = 'meta';
        time.textContent = new Date(entry.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ghost';
        remove.textContent = 'Delete';
        remove.addEventListener('click', async () => {
          day.ideas = day.ideas.filter((j) => j.id !== entry.id);
          saveState();
          if (currentUser?.uid) {
            try {
              await upsertIdeaListRemote(currentUser.uid, date, day.ideas);
            } catch (e) {
              console.warn('Failed to save ideas to Firestore', e);
            }
          }
          renderIdeas();
          renderHistory();
        });

        item.append(content, time, remove);
        dom.ideaList.append(item);
      });
  };

  const openDayDetail = (date, focusSection) => {
    if (!dom.dayDetail) return;
    const day = getDay(date);
    dom.detailDate.textContent = formatDate(date);

    const wrap = document.createElement('div');
    wrap.className = 'stack';

    const habitsBlock = document.createElement('div');
    habitsBlock.className = 'panelish';
    const todayHabits = activeHabitsForDate(date);
    const done = todayHabits.filter((h) => day.habits[h.id]).length;
    const habitsPercent = dayCompletion(date) ?? 0;
    const habitsLabel = todayHabits.length ? `${done}/${todayHabits.length || 0} done (${habitsPercent}%)` : 'No active habits';
    habitsBlock.innerHTML = `<h4 id="detail-habits">Habits</h4><p class="muted">${habitsLabel}</p>`;
    const habitsProgress = document.createElement('div');
    habitsProgress.className = 'tiny-progress';
    const habitsFill = document.createElement('span');
    habitsFill.style.width = `${habitsPercent}%`;
    habitsFill.style.background = 'linear-gradient(90deg, var(--accent-strong), var(--accent))';
    habitsProgress.append(habitsFill);
    habitsBlock.append(habitsProgress);
    wrap.append(habitsBlock);

    const moodBlock = document.createElement('div');
    moodBlock.className = 'panelish';
    moodBlock.innerHTML = '<h4 id="detail-mood">Mood</h4>';
    const moodValue = state.mood[dayKey(date)];
    if (moodValue) {
      const moodLine = document.createElement('p');
      moodLine.className = 'muted';
      moodLine.textContent = `${moodFaces[moodValue] || '🙂'} ${moodLabels[moodValue]}`;
      moodBlock.append(moodLine);
    } else {
      moodBlock.append(spanMuted('No mood logged'));
    }
    wrap.append(moodBlock);

    const tasksBlock = document.createElement('div');
    tasksBlock.className = 'panelish';
    tasksBlock.innerHTML = `<h4 id="detail-tasks">One-off wins</h4><p class="muted">${day.tasks.length || 0} wins logged</p>`;
    const taskList = document.createElement('ul');
    taskList.className = 'bullet';
    (day.tasks || []).forEach((t) => {
      const li = document.createElement('li');
      li.textContent = `✅ ${t.title}`;
      taskList.append(li);
    });
    tasksBlock.append(taskList);
    wrap.append(tasksBlock);

    const journalBlock = document.createElement('div');
    journalBlock.className = 'panelish';
    journalBlock.innerHTML = '<h4 id="detail-journal">Daily reflection</h4>';
    if (!day.journal.length) {
      journalBlock.append(spanMuted('No reflections yet'));
    } else {
      day.journal.forEach((entry) => {
        const div = document.createElement('div');
        div.className = 'note-line';
        div.textContent = `${entry.title || 'Untitled'} — ${entry.text}`;
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'chip ghost';
        open.textContent = 'Open entry';
        open.addEventListener('click', () => showEntryModal(entry.title || 'Journal entry', entry.text));
        div.append(open);
        journalBlock.append(div);
      });
    }
    wrap.append(journalBlock);

    const dreamBlock = document.createElement('div');
    dreamBlock.className = 'panelish';
    dreamBlock.innerHTML = '<h4 id="detail-dreams">Dream log</h4>';
    if (!day.dreams.length) {
      dreamBlock.append(spanMuted('No dream logged'));
    } else {
      day.dreams.forEach((entry) => {
        const div = document.createElement('div');
        div.className = 'note-line';
        div.textContent = `${entry.title || 'Dream'} — ${entry.text}`;
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'chip ghost';
        open.textContent = 'Open dream';
        open.addEventListener('click', () => showEntryModal(entry.title || 'Dream', entry.text));
        div.append(open);
        dreamBlock.append(div);
      });
    }
    wrap.append(dreamBlock);

    const ideaBlock = document.createElement('div');
    ideaBlock.className = 'panelish';
    ideaBlock.innerHTML = '<h4 id="detail-ideas">Ideas</h4>';
    if (!day.ideas.length) {
      ideaBlock.append(spanMuted('No ideas captured'));
    } else {
      day.ideas.forEach((entry) => {
        const div = document.createElement('div');
        div.className = 'note-line';
        div.textContent = `${entry.title || 'Idea'} — ${entry.text}`;
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'chip ghost';
        open.textContent = 'Open idea';
        open.addEventListener('click', () => showEntryModal(entry.title || 'Idea', entry.text));
        div.append(open);
        ideaBlock.append(div);
      });
    }
    wrap.append(ideaBlock);

    dom.dayBreakdown.innerHTML = '';
    dom.dayBreakdown.append(wrap);
    dom.dayDetail.showModal();
    if (focusSection) {
      const anchor = document.getElementById(`detail-${focusSection}`);
      if (anchor) anchor.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const showEntryModal = (title, text) => {
    const modal = document.createElement('dialog');
    const head = document.createElement('div');
    head.className = 'modal-head';
    const heading = document.createElement('h4');
    heading.textContent = title;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ghost';
    close.textContent = 'Close';
    head.append(heading, close);
    const body = document.createElement('p');
    body.textContent = text;
    modal.append(head, body);
    modal.addEventListener('close', () => modal.remove());
    close.addEventListener('click', () => modal.close());
    document.body.append(modal);
    modal.showModal();
  };

  const spanMuted = (text) => {
    const span = document.createElement('span');
    span.className = 'muted';
    span.textContent = text;
    return span;
  };

  const renderQuitList = () => {
    const buildRow = (quit, allowReset = false) => {
      const row = document.createElement('div');
      row.className = 'quit-row';
      row.dataset.date = quit.date;
      const left = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = quit.name;
      const meta = document.createElement('div');
      meta.className = 'meta-line';
      const quitDateText = formatDate(quit.date, { month: 'long', day: 'numeric', year: 'numeric' });
      const quitDate = document.createElement('span');
      quitDate.textContent = `Quit on ${quitDateText}`;
      const timer = document.createElement('span');
      timer.className = 'elapsed';
      timer.dataset.timer = quit.date;
      timer.dataset.dateLabel = quitDateText;
      timer.textContent = '';
      timer.title = 'Time since quitting';
      meta.append(quitDate, timer);
      left.append(name, meta);

      if (allowReset) {
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'Reset';
        reset.addEventListener('click', async () => {
          if (!confirm('Reset this quit timer to today?')) return;
          quit.date = startOfDayIso();
          saveState();
          if (currentUser?.uid) {
            try {
              await updateQuitRemote(currentUser.uid, quit.id, { date: quit.date });
            } catch (e) {
              console.warn('Failed to reset quit timer in Firestore', e);
            }
          }
          renderQuitList();
        });
        row.append(left, reset);
      } else {
        row.append(left);
      }
      return row;
    };

    if (dom.quitList) {
      dom.quitList.innerHTML = '';
      if (!state.quits.length) {
        if (dom.emptyQuit) dom.emptyQuit.classList.remove('hidden');
      } else {
        if (dom.emptyQuit) dom.emptyQuit.classList.add('hidden');
        state.quits.forEach((quit) => dom.quitList.append(buildRow(quit, false)));
      }
    }

    if (dom.quitManageList) {
      dom.quitManageList.innerHTML = '';
      if (!state.quits.length) {
        dom.quitManageList.innerHTML = '<div class="empty">No retired habits yet.</div>';
      } else {
        state.quits.forEach((quit) => dom.quitManageList.append(buildRow(quit, true)));
      }
    }

    updateQuitTimers();
  };

  const renderGoals = () => {
    const sortedGoals = state.goals
      .slice()
      .sort((a, b) => (b.created || 0) - (a.created || 0));

    if (dom.goalList) {
      dom.goalList.innerHTML = '';
      if (!sortedGoals.length) {
        dom.goalList.innerHTML = '<div class="empty">No goals logged yet.</div>';
      } else {
        sortedGoals.forEach((goal) => {
          const row = document.createElement('div');
          row.className = 'goal-row view-only';
          const title = document.createElement('strong');
          title.textContent = goal.title;
          const meta = document.createElement('div');
          meta.className = 'meta';
          const createdDate = goal.created ? new Date(goal.created) : new Date();
          meta.textContent = formatDate(dayKey(createdDate));
          row.append(title, meta);
          dom.goalList.append(row);
        });
      }
    }

    if (dom.goalManageList) {
      dom.goalManageList.innerHTML = '';
      if (!sortedGoals.length) {
        dom.goalManageList.innerHTML = '<div class="empty">Add your big targets for 2026.</div>';
      } else {
        sortedGoals.forEach((goal) => {
          const row = document.createElement('div');
          row.className = 'goal-row';
          const title = document.createElement('strong');
          title.textContent = goal.title;
          const meta = document.createElement('div');
          meta.className = 'meta';
          const createdDate = goal.created ? new Date(goal.created) : new Date();
          meta.textContent = formatDate(dayKey(createdDate));
          const actions = document.createElement('div');
          actions.className = 'row';
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'ghost';
          edit.textContent = 'Edit';
          edit.addEventListener('click', async () => {
            const next = prompt('Update your goal', goal.title);
            if (!next || !next.trim()) return;
            goal.title = next.trim();
            saveState();
            if (currentUser?.uid) {
              try {
                await updateGoalRemote(currentUser.uid, goal.id, { title: goal.title });
              } catch (e) {
                console.warn('Failed to update goal in Firestore', e);
              }
            }
            renderGoals();
            renderDashboardSummary();
          });
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'ghost';
          remove.textContent = 'Delete';
          remove.addEventListener('click', async () => {
            state.goals = state.goals.filter((g) => g.id !== goal.id);
            saveState();
            if (currentUser?.uid) {
              try {
                await removeGoalRemote(currentUser.uid, goal.id);
              } catch (e) {
                console.warn('Failed to remove goal from Firestore', e);
              }
            }
            renderGoals();
            renderDashboardSummary();
          });
          actions.append(edit, remove);
          row.append(title, meta, actions);
          dom.goalManageList.append(row);
        });
      }
    }

    renderDashboardSummary();
  };

  const renderDashboardSummary = (todayPercent, done = null, total = null, wins = null) => {
    if (dom.summaryHabits) dom.summaryHabits.textContent = String(state.habits.length);
    const streakCount = computeStreak();
    const longest = computeLongestStreak();
    if (dom.summaryStreak) dom.summaryStreak.textContent = `${streakCount}d`;
    if (dom.summaryLongest) dom.summaryLongest.textContent = `${longest}d`;
    const targetDate = selectedDate();
    const percent = todayPercent ?? (dayCompletion(targetDate) ?? 0);
    if (dom.summaryRate) dom.summaryRate.textContent = `${percent}%`;
    const day = getDay(targetDate);
    const winsCount = wins ?? day.tasks.length;
    if (dom.summaryWins) dom.summaryWins.textContent = String(winsCount);
    if (dom.summaryGoals) dom.summaryGoals.textContent = String(state.goals.length);
  };

  const updateQuitTimers = () => {
    const timers = document.querySelectorAll('[data-timer]');
    timers.forEach((node) => {
      const start = new Date(node.dataset.timer);
      if (Number.isNaN(start.getTime())) {
        node.textContent = '0d 0h 0m 0s';
        return;
      }
      const diff = Date.now() - start.getTime();
      const seconds = Math.max(0, Math.floor(diff / 1000));
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      node.textContent = `${days}d ${hours}h ${minutes}m ${secs}s`;
    });
  };

  const changeYear = (year) => {
    state.currentYear = year;
    saveState();
    renderHistory();
  };

  const renderAll = () => {
    state.selectedDate = selectedDate();
    if (dom.todayLabel) dom.todayLabel.textContent = formatDate(state.selectedDate);
    if (dom.habitDate) {
      dom.habitDate.value = state.selectedDate;
      dom.habitDate.max = today();
    }
    renderTitle();
    applyTheme();
    applyAccent();
    applyHiddenSections();
    syncHiddenSectionToggles();
    const currentMonthStart = startOfMonthKey();
    const chosenMonth = state.monthCursor || currentMonthStart;
    const cursorDate = parseDateValue(chosenMonth);
    cursorDate.setHours(12, 0, 0, 0);
    const clampDate = parseDateValue(currentMonthStart);
    clampDate.setHours(12, 0, 0, 0);
    if (cursorDate > clampDate) state.monthCursor = currentMonthStart;
    state.monthCursor = state.monthCursor || currentMonthStart;
    renderHeatmapFilter();
    if (dom.quitDate) dom.quitDate.value = today();
    renderChecklist();
    renderTasks();
    renderLibrary();
    renderJournal();
    renderDreams();
    renderIdeas();
    renderQuitList();
    renderGoals();
    renderHistory();
    renderMoodPicker();
    renderProgress();
  };

  // Shared habit form handling (Goals page + future use)
  if (dom.dayPicker && dom.habitCadence) {
    updateDayPickerVisibility();
    dom.habitCadence.addEventListener('change', updateDayPickerVisibility);
  }

  if (dom.habitForm) {
    dom.habitForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const name = dom.habitInput.value.trim();
      if (!name) return;
      const cadence = dom.habitCadence ? dom.habitCadence.value : 'daily';
      const dayInputs = dom.dayPicker ? Array.from(dom.dayPicker.querySelectorAll('input:checked')) : [];
      const days = dayInputs.map((d) => Number(d.value));
      const icon = dom.habitIcon ? dom.habitIcon.value : '';
      const color = dom.habitColor ? dom.habitColor.value : '#5563ff';
      const createdNew = !editingHabitId;
      if (!createdNew) {
        const existing = state.habits.find((h) => h.id === editingHabitId);
        if (existing) {
          existing.name = name;
          existing.cadence = cadence;
          existing.days = days;
          existing.icon = icon;
          existing.color = color;
          if (currentUser) {
            await updateHabitRemote(currentUser.uid, existing.id, {
              name,
              cadence,
              days,
              icon,
              color
            });
          }
        }
      } else {
        const habit = { id: randomId(), name, cadence, days, icon, color, created: today() };
        state.habits.push(habit);
        if (currentUser) {
          await addHabitRemote(currentUser.uid, name, habit);
        }
      }
      dom.habitInput.value = '';
      if (dom.dayPicker) dom.dayPicker.querySelectorAll('input').forEach((i) => (i.checked = false));
      if (dom.habitIcon) dom.habitIcon.value = '';
      if (dom.habitColor) dom.habitColor.value = '#5563ff';
      editingHabitId = null;
      if (dom.habitSubmit) dom.habitSubmit.textContent = 'Add habit';
      if (dom.habitEditHint) dom.habitEditHint.textContent = 'Add to today\'s checklist';
      if (createdNew) {
        const todayKey = today();
        state.selectedDate = todayKey;
        getDay(todayKey);
        if (dom.habitDate) dom.habitDate.value = todayKey;
      }
      saveState();
      renderLibrary();
      renderChecklist();
      renderHistory();
      renderProgress();
      renderMoodPicker();
    });
  }

  if (dom.reset) {
    dom.reset.addEventListener('click', () => {
      if (!confirm('This clears all saved habits, tasks, journals, dreams, and goals. Continue?')) return;
      Object.assign(state, defaultState());
      saveState();
      renderTitle();
      applyTheme();
      applyAccent();
      renderAll();
    });
  }

  if (dom.themeToggle) {
    dom.themeToggle.addEventListener('change', () => {
      state.theme = dom.themeToggle.checked ? 'light' : 'dark';
      applyTheme();
      saveState();
    });
  }

  const saveMoodForDay = async () => {
    if (!dom.moodSelect) return;
    const value = Number(dom.moodSelect.value);
    const date = selectedDate();
    state.mood[date] = value;
    saveState();
    renderMoodPicker();
    renderHistory();
    if (currentUser) {
      await setMoodRemote(currentUser.uid, value, date);
    }
  };

  if (dom.saveMood && dom.moodSelect) {
    dom.saveMood.addEventListener('click', saveMoodForDay);
  }
  if (dom.moodQuick) {
    dom.moodQuick.querySelectorAll('[data-mood-value]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = Number(button.dataset.moodValue);
        if (dom.moodSelect) dom.moodSelect.value = String(value);
        saveMoodForDay();
      });
    });
  }

  const openSettings = () => {
    if (!dom.settingsModal) return;
    dom.settingsModal.showModal();
    if (dom.titleInput) dom.titleInput.value = state.title;
    syncHiddenSectionToggles();
  };

  if (dom.settingsButton) dom.settingsButton.addEventListener('click', openSettings);
  if (dom.settingsButtonTop) dom.settingsButtonTop.addEventListener('click', openSettings);
  if (dom.closeSettings && dom.settingsModal) {
    dom.closeSettings.addEventListener('click', () => dom.settingsModal.close());
  }

  if (dom.titleInput) {
    dom.titleInput.addEventListener('input', () => {
      state.title = dom.titleInput.value.trim() || defaultState().title;
      renderTitle();
      saveState();
    });
  }

  if (dom.accentPicker) {
    dom.accentPicker.addEventListener('change', () => {
      state.accent = dom.accentPicker.value;
      applyAccent();
      saveState();
    });
  }

  document.querySelectorAll('[data-section-toggle]').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.checked) {
        if (!state.hiddenSections.includes(input.value)) state.hiddenSections.push(input.value);
      } else {
        state.hiddenSections = state.hiddenSections.filter((v) => v !== input.value);
      }
      saveState();
      applyHiddenSections();
    });
  });

  const toggleToolbar = () => {
    if (!dom.toolbar) return;
    dom.toolbar.classList.toggle('is-open');
  };
  if (dom.toolbarToggle) dom.toolbarToggle.addEventListener('click', toggleToolbar);

  if (dom.exportData) {
    dom.exportData.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'habit-engine-data.json';
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  const exportCsvData = () => {
    const header = ['date', 'habitId', 'habitName', 'done'];
    const rows = [header.join(',')];
    Object.keys(state.days).forEach((date) => {
      const day = state.days[date];
      state.habits.forEach((habit) => {
        const done = day?.habits?.[habit.id] ? 1 : 0;
        rows.push([date, habit.id, `"${habit.name.replace(/"/g, '""')}"`, done].join(','));
      });
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'habit-engine-data.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvImport = (text) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return null;
    const [headerLine, ...rows] = lines;
    const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
    const dateIdx = headers.indexOf('date');
    const idIdx = headers.indexOf('habitid');
    const nameIdx = headers.indexOf('habitname');
    const doneIdx = headers.indexOf('done');
    if (dateIdx === -1 || nameIdx === -1 || doneIdx === -1) return null;
    const habitsById = {};
    const days = {};
    rows.forEach((line) => {
      const cols = line.match(/("([^"]|"")*"|[^,]+)/g) || [];
      const date = (cols[dateIdx] || '').replace(/"/g, '');
      const id = idIdx === -1 ? `csv-${cols[nameIdx]}` : (cols[idIdx] || '').replace(/"/g, '');
      const name = (cols[nameIdx] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
      const done = Number(cols[doneIdx]) === 1;
      if (!habitsById[id]) habitsById[id] = { id, name, cadence: 'daily', days: [], icon: '', color: '#5563ff' };
      if (!days[date]) days[date] = { habits: {}, tasks: [], journal: [], dreams: [] };
      days[date].habits[id] = done;
    });
    return { habits: Object.values(habitsById), days };
  };

  if (dom.exportCsv) {
    dom.exportCsv.addEventListener('click', exportCsvData);
  }

  const triggerImport = (mode) => {
    if (!dom.importFile) return;
    dom.importFile.dataset.mode = mode;
    dom.importFile.accept = mode === 'csv' ? '.csv' : '.json,.csv';
    dom.importFile.click();
  };

  if (dom.importJson && dom.importFile) dom.importJson.addEventListener('click', () => triggerImport('json'));
  if (dom.importCsv && dom.importFile) dom.importCsv.addEventListener('click', () => triggerImport('csv'));

  if (dom.importFile) {
    dom.importFile.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
          let payload = null;
          const mode = dom.importFile.dataset.mode;
          if (file.name.endsWith('.json') || mode === 'json') {
            payload = JSON.parse(text);
          } else if (file.name.endsWith('.csv') || mode === 'csv') {
            payload = parseCsvImport(text);
          }
          if (!payload) throw new Error('Unsupported file format');
          refreshFromStorage(payload);
          saveState();
          alert('Import complete');
        } catch (e) {
          alert('Unable to import data. Please use a valid JSON or CSV export.');
          console.error(e);
        } finally {
          dom.importFile.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  if (dom.prevMonth) dom.prevMonth.addEventListener('click', () => changeMonth(-1));
  if (dom.nextMonth) dom.nextMonth.addEventListener('click', () => changeMonth(1));
  if (dom.heatmapFilter) {
    dom.heatmapFilter.addEventListener('change', () => {
      state.heatmapFilter = dom.heatmapFilter.value;
      saveState();
      renderMonthly();
    });
  }

  if (dom.pieHabit) dom.pieHabit.addEventListener('change', renderCompletionPie);
  if (dom.pieRange) dom.pieRange.addEventListener('change', renderCompletionPie);

  if (dom.notesCta && dom.journalCard) {
    dom.notesCta.addEventListener('click', () => {
      dom.journalCard.classList.remove('collapsed');
      dom.notesCta.classList.add('hidden');
      if (dom.journalTitle) dom.journalTitle.focus();
    });
  }

  if (dom.markAll) {
    dom.markAll.addEventListener('click', async () => {
      const date = selectedDate();
      const day = getDay(date);
      activeHabitsForDate(date).forEach((h) => {
        day.habits[h.id] = true;
      });
      saveState();
      renderChecklist();
      renderHistory();
      if (currentUser) {
        await Promise.all(
          activeHabitsForDate(date).map((h) => toggleCompletionRemote(currentUser.uid, h.id, date, true))
        );
      }
    });
  }

  if (dom.habitDate) {
    dom.habitDate.addEventListener('change', async () => {
      const next = dom.habitDate.value || today();
      state.selectedDate = dayKey(next);
      if (dom.todayLabel) dom.todayLabel.textContent = formatDate(state.selectedDate);

      // Pull the selected day from Firestore so the dashboard looks identical
      // on any device (yesterday/any date will populate correctly after login).
      if (currentUser?.uid) {
        try {
          const remote = await loadDayRemote(currentUser.uid, state.selectedDate);
          const dayState = getDay(state.selectedDate);
          dayState.habits = { ...dayState.habits, ...(remote.completions || {}) };
          dayState.tasks = Array.isArray(remote.tasks) ? remote.tasks : (dayState.tasks || []);
          dayState.journal = Array.isArray(remote.journal) ? remote.journal : (dayState.journal || []);
          dayState.dreams = Array.isArray(remote.dreams) ? remote.dreams : (dayState.dreams || []);
          dayState.ideas = Array.isArray(remote.ideas) ? remote.ideas : (dayState.ideas || []);
          if (remote.mood !== undefined && remote.mood !== null) state.mood[state.selectedDate] = remote.mood;
        } catch (e) {
          console.warn('Failed to load selected day from Firestore', e);
        }
      }
      saveState();
      renderChecklist();
      renderProgress();
      renderHistory();
      renderMoodPicker();
    });
  }

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.tab-body').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.tabPanel !== target);
      });
    });
  });

  if (dom.taskForm) {
    dom.taskForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = dom.taskInput.value.trim();
      if (!title) return;
      const day = getDay(today());
      day.tasks.push({ id: randomId(), title, created: Date.now() });
      dom.taskInput.value = '';
      saveState();
      if (currentUser?.uid) {
        try {
          await upsertTaskListRemote(currentUser.uid, today(), day.tasks);
        } catch (e) {
          console.warn('Failed to save tasks to Firestore', e);
        }
      }
      renderTasks();
      renderHistory();
    });
  }

  if (dom.goalForm) {
    dom.goalForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = dom.goalInput.value.trim();
      if (!text) return;
      const goal = { id: randomId(), title: text, created: Date.now() };
      state.goals.push(goal);
      dom.goalInput.value = '';
      saveState();
      if (currentUser?.uid) {
        try {
          await addGoalRemote(currentUser.uid, goal);
        } catch (e) {
          console.warn('Failed to save goal to Firestore', e);
        }
      }
      renderGoals();
      renderDashboardSummary();
    });
  }

  if (dom.quitForm) {
    dom.quitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = dom.quitName.value.trim();
      const date = dom.quitDate.value || today();
      if (!name) return;
      const storedDate = startOfDayIso(date);
      const quit = { id: randomId(), name, date: storedDate, created: Date.now() };
      state.quits.push(quit);
      dom.quitName.value = '';
      dom.quitDate.value = today();
      saveState();
      if (currentUser?.uid) {
        try {
          await addQuitRemote(currentUser.uid, quit);
        } catch (e) {
          console.warn('Failed to save quit to Firestore', e);
        }
      }
      renderQuitList();
    });
  }

  if (dom.journalForm) {
    dom.journalForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = dom.journalText.value.trim();
      if (!text) return;
      const entry = {
        id: randomId(),
        title: dom.journalTitle.value.trim(),
        text,
        created: Date.now()
      };
      const day = getDay(today());
      day.journal.push(entry);
      dom.journalTitle.value = '';
      dom.journalText.value = '';
      if (dom.journalSaved) dom.journalSaved.textContent = 'Saved';
      saveState();
      if (currentUser?.uid) {
        try {
          await upsertJournalListRemote(currentUser.uid, today(), day.journal);
        } catch (e) {
          console.warn('Failed to save journal to Firestore', e);
        }
      }
      renderJournal();
      renderHistory();
    });
  }

  if (dom.dreamForm) {
    dom.dreamForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = dom.dreamText.value.trim();
      if (!text) return;
      const entry = {
        id: randomId(),
        title: dom.dreamTitle.value.trim(),
        text,
        created: Date.now()
      };
      const day = getDay(today());
      day.dreams.push(entry);
      dom.dreamTitle.value = '';
      dom.dreamText.value = '';
      if (dom.dreamSaved) dom.dreamSaved.textContent = 'Saved';
      saveState();
      if (currentUser?.uid) {
        try {
          await upsertDreamListRemote(currentUser.uid, today(), day.dreams);
        } catch (e) {
          console.warn('Failed to save dreams to Firestore', e);
        }
      }
      renderDreams();
      renderHistory();
    });
  }

  if (dom.ideaForm) {
    dom.ideaForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = dom.ideaText.value.trim();
      if (!text) return;
      const entry = {
        id: randomId(),
        title: dom.ideaTitle.value.trim(),
        text,
        created: Date.now()
      };
      const day = getDay(today());
      day.ideas.push(entry);
      dom.ideaTitle.value = '';
      dom.ideaText.value = '';
      if (dom.ideaSaved) dom.ideaSaved.textContent = 'Saved';
      saveState();
      if (currentUser?.uid) {
        try {
          await upsertIdeaListRemote(currentUser.uid, today(), day.ideas);
        } catch (e) {
          console.warn('Failed to save ideas to Firestore', e);
        }
      }
      renderIdeas();
      renderHistory();
    });
  }

  if (dom.yearPicker) {
    dom.yearPicker.addEventListener('change', () => changeYear(Number(dom.yearPicker.value)));
  }
  if (dom.historyMode) {
    dom.historyMode.addEventListener('change', renderHistory);
  }
  if (dom.historyToggle) {
    dom.historyToggle.addEventListener('click', () => {
      historyExpanded = !historyExpanded;
      renderHistory();
    });
  }
  if (dom.dayDetail && document.getElementById('close-detail')) {
    document.getElementById('close-detail').addEventListener('click', () => dom.dayDetail.close());
  }

  const setAuthMessage = (message) => {
    if (dom.authMessage) dom.authMessage.textContent = message;
  };

  if (dom.signupForm) {
    dom.signupForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = dom.signupEmail.value.trim();
      const password = dom.signupPassword.value;
      if (!email || !password) return;
      try {
        await signUp(email, password);
        setAuthMessage('Account created—signing you in…');
      } catch (error) {
        setAuthMessage(error.message || 'Unable to sign up.');
      }
    });
  }

  if (dom.signinForm) {
    dom.signinForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = dom.signinEmail.value.trim();
      const password = dom.signinPassword.value;
      if (!email || !password) return;
      try {
        await signIn(email, password);
        setAuthMessage('Signed in—loading your data…');
      } catch (error) {
        setAuthMessage(error.message || 'Unable to sign in.');
      }
    });
  }

  if (dom.googleSignin) {
    dom.googleSignin.addEventListener('click', async () => {
      try {
        await signInWithGoogle();
        setAuthMessage('Signed in—loading your data…');
      } catch (error) {
        setAuthMessage(error.message || 'Google sign-in failed.');
      }
    });
  }

  if (dom.logoutButton) {
    dom.logoutButton.addEventListener('click', () => {
      logOut();
      showAuthPanel('Signed out. Sign back in to continue.');
    });
  }

  observeAuthState(
    (user, payload) => {
      currentUser = user;
      showApp(user);
      hydrateFromRemote(payload);
    },
    () => {
      currentUser = null;
      Object.assign(state, defaultState());
      saveState();
      renderAll();
      if (dom.userBadge) dom.userBadge.classList.add('hidden');
      if (dom.logoutButton) dom.logoutButton.classList.add('hidden');
      showAuthPanel('Use email + password to create your account or sign back in.');
    }
  );

  renderAll();
  setInterval(updateQuitTimers, 1000);

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    try {
      const next = event.newValue ? JSON.parse(event.newValue) : defaultState();
      refreshFromStorage(next);
    } catch (e) {
      console.warn('Unable to sync state from storage', e);
    }
  });
})();
