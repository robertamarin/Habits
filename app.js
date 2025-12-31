(function () {
  const STORAGE_KEY = 'habitFreshV1';
  const PAGE = document.body.dataset.page || 'home';
  const today = () => new Date().toISOString().slice(0, 10);
  const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const defaultState = () => ({
    habits: [],
    days: {},
    theme: 'dark',
    title: "Robert's 2026 Habit Engine",
    accent: 'violet',
    quits: [],
    goals: [],
    currentYear: new Date().getFullYear(),
    hiddenSections: [],
    focusMode: false
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

  const state = loadState();

  const saveState = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const refreshFromStorage = (payload) => {
    const next = payload || loadState();
    Object.assign(state, defaultState(), next);
    renderTitle();
    applyTheme();
    applyAccent();
    if (isHome) renderAll();
    if (renderGoalsPage) renderGoalsPage();
  };

  const dom = {
    appTitle: document.getElementById('app-title'),
    todayLabel: document.getElementById('today-label'),
    progressRing: document.getElementById('progress-ring'),
    progressFill: document.querySelector('.ring-fill'),
    progressValue: document.getElementById('progress-value'),
    ringSubtext: document.getElementById('ring-subtext'),
    milestoneLabel: document.querySelector('.milestone-label'),
    habitList: document.getElementById('habit-list'),
    emptyHabits: document.getElementById('empty-habits'),
    completeCount: document.getElementById('complete-count'),
    habitCount: document.getElementById('habit-count'),
    streak: document.getElementById('streak'),
    momentum: document.getElementById('momentum'),
    streakBar: document.getElementById('streak-bar'),
    markAll: document.getElementById('mark-all'),
    taskForm: document.getElementById('task-form'),
    taskInput: document.getElementById('task-input'),
    taskList: document.getElementById('task-list'),
    taskCount: document.getElementById('task-count'),
    clearDone: document.getElementById('clear-done'),
    habitForm: document.getElementById('habit-form'),
    habitInput: document.getElementById('habit-input'),
    habitCadence: document.getElementById('habit-cadence'),
    habitIcon: document.getElementById('habit-icon'),
    habitColor: document.getElementById('habit-color'),
    dayPicker: document.getElementById('day-picker'),
    habitSubmit: document.getElementById('habit-submit'),
    habitEditHint: document.getElementById('habit-edit-hint'),
    library: document.getElementById('library'),
    journalForm: document.getElementById('journal-form'),
    journalTitle: document.getElementById('journal-title'),
    journalText: document.getElementById('journal-text'),
    journalList: document.getElementById('journal-list'),
    dreamForm: document.getElementById('dream-form'),
    dreamTitle: document.getElementById('dream-title'),
    dreamText: document.getElementById('dream-text'),
    dreamList: document.getElementById('dream-list'),
    reset: document.getElementById('reset-data'),
    themeToggle: document.getElementById('theme-toggle'),
    history: document.getElementById('history'),
    monthLabel: document.getElementById('month-label'),
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
    emptyQuit: document.getElementById('empty-quit'),
    habitTotal: document.getElementById('habit-total'),
    goalTotal: document.getElementById('goal-total'),
    dayDetail: document.getElementById('day-detail'),
    detailDate: document.getElementById('detail-date'),
    dayBreakdown: document.querySelector('.day-breakdown'),
    weeklyBars: document.getElementById('weekly-bars'),
    monthlyStrip: document.getElementById('monthly-strip'),
    historyMode: document.getElementById('history-mode'),
    historyToggle: document.getElementById('history-toggle'),
    winsPill: document.getElementById('wins-pill'),
    focusMode: document.getElementById('focus-mode'),
    exportData: document.getElementById('export-data'),
    exportCsv: document.getElementById('export-csv'),
    importData: document.getElementById('import-data'),
    importFile: document.getElementById('import-file'),
    journalSaved: document.getElementById('journal-saved'),
    dreamSaved: document.getElementById('dream-saved'),
    // Goals page
    goalForm: document.getElementById('goal-form'),
    goalInput: document.getElementById('goal-input'),
    goalList: document.getElementById('goal-list'),
    quitForm: document.getElementById('quit-form'),
    quitName: document.getElementById('quit-name'),
    quitDate: document.getElementById('quit-date'),
    quitLibrary: document.getElementById('quit-library')
  };

  const isHome = PAGE === 'home';
  const isGoals = PAGE === 'goals';
  let editingHabitId = null;
  let renderGoalsPage = null;
  let lastProgressPercent = 0;
  let historyExpanded = false;

  const getDay = (date) => {
    if (!state.days[date]) {
      state.days[date] = { habits: {}, tasks: [], journal: [], dreams: [] };
    } else {
      state.days[date].dreams = state.days[date].dreams || [];
      state.days[date].journal = state.days[date].journal || [];
      state.days[date].tasks = state.days[date].tasks || [];
      state.days[date].habits = state.days[date].habits || {};
    }
    return state.days[date];
  };

  const formatDate = (value, options = { weekday: 'long', month: 'long', day: 'numeric' }) =>
    new Intl.DateTimeFormat(undefined, options).format(new Date(value));

  const shouldShowHabitToday = (habit, dateValue) => {
    const day = new Date(dateValue).getDay();
    if (habit.cadence === 'daily') return true;
    if (habit.cadence === 'weekdays') return day >= 1 && day <= 5;
    if (habit.cadence === 'custom') return (habit.days || []).includes(day);
    return true;
  };

  const dateKeysBack = (count) => Array.from({ length: count }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const habitDoneOnDate = (habit, dateValue) => {
    const day = state.days[dateValue];
    if (!shouldShowHabitToday(habit, dateValue)) return null;
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
    Boolean(day && (Object.keys(day.habits || {}).length || (day.tasks || []).length || (day.journal || []).length || (day.dreams || []).length));

  const updateDayPickerVisibility = () => {
    if (!dom.dayPicker || !dom.habitCadence) return;
    const custom = dom.habitCadence.value === 'custom';
    dom.dayPicker.style.display = custom ? 'flex' : 'none';
  };

  const progressColor = (percent) => {
    const hue = Math.round((percent / 100) * 120);
    return `hsl(${hue}, 80%, 50%)`;
  };

  const completionColor = (percent, hasHabits, hasData = true) => {
    if (!hasData) return '#1f2937';
    if (hasHabits && percent === 0) return '#ef4444';
    if (!hasHabits) return '#1f2937';
    if (percent <= 25) return '#312e81';
    if (percent <= 50) return '#2563eb';
    if (percent <= 75) return '#0ea5e9';
    return 'var(--accent-strong)';
  };

  const renderTitle = () => {
    if (dom.appTitle) dom.appTitle.textContent = state.title;
    if (dom.titleInput) dom.titleInput.value = state.title;
    document.title = state.title;
  };

  const applyTheme = () => {
    const mode = state.theme || 'dark';
    if (mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (dom.themeToggle) dom.themeToggle.checked = mode === 'light';
  };

  const applyAccent = () => {
    document.documentElement.setAttribute('data-accent', state.accent || 'violet');
    if (dom.accentPicker) dom.accentPicker.value = state.accent;
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

  const applyFocusMode = () => {
    if (dom.focusMode) dom.focusMode.checked = !!state.focusMode;
    document.querySelectorAll('[data-focus-hidden]').forEach((node) => {
      node.classList.toggle('focus-hidden', !!state.focusMode);
    });
    document.querySelectorAll('[data-focus-visible]').forEach((node) => node.classList.remove('focus-hidden'));
  };

  const renderChecklist = () => {
    if (!dom.habitList) return;
    const date = today();
    const day = getDay(date);
    const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
    dom.habitCount.textContent = todayHabits.length;

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
      input.addEventListener('change', () => {
        day.habits[habit.id] = input.checked;
        saveState();
        renderProgress(true);
        renderHistory();
        miniFill.style.opacity = input.checked ? '1' : '0.5';
        badge.textContent = input.checked ? 'Done' : 'Pending';
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

      const sparkWrap = document.createElement('div');
      sparkWrap.className = 'sparkline-wrap';
      const spark = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      spark.setAttribute('viewBox', '0 0 80 34');
      spark.classList.add('sparkline');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.style.stroke = habit.color || 'var(--accent)';
      const history = habitHistory(habit, 14);
      const filtered = history.map((v) => (v === null ? 0 : v));
      const points = filtered.map((v, i) => {
        const x = (i / (filtered.length - 1)) * 80;
        const y = 30 - v * 24;
        return `${x},${y}`;
      });
      path.setAttribute('d', `M${points.join(' L')}`);
      spark.append(path);
      sparkWrap.append(spark);

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

      item.append(topRow, sparkWrap);
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
      dom.taskList.innerHTML = '<div class="empty">No wins yet</div>';
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
      time.textContent = formatDate(createdDate.toISOString().slice(0, 10), { month: 'short', day: 'numeric' });

      left.append(title, time);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost';
      remove.textContent = 'Delete';
      remove.addEventListener('click', () => {
        day.tasks = day.tasks.filter((t) => t.id !== task.id);
        saveState();
        renderTasks();
        renderHistory();
      });

      item.append(left, remove);
      dom.taskList.append(item);
    });

    dom.taskCount.textContent = `${day.tasks.length} logged`;
    if (dom.winsPill) {
      dom.winsPill.textContent = `Wins today: ${day.tasks.length}`;
      dom.winsPill.classList.add('wins-pulse');
      setTimeout(() => dom.winsPill && dom.winsPill.classList.remove('wins-pulse'), 260);
    }
  };

  const renderLibrary = () => {
    if (!dom.library) return;
    dom.library.innerHTML = '';
    if (!state.habits.length) {
      dom.library.innerHTML = '<div class="empty">No habits yet</div>';
      if (dom.habitTotal) dom.habitTotal.textContent = '0';
      return;
    }
    if (dom.habitTotal) dom.habitTotal.textContent = String(state.habits.length);

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
        if (dom.habitColor) dom.habitColor.value = habit.color || '#7c3aed';
        if (dom.habitSubmit) dom.habitSubmit.textContent = 'Update habit';
        if (dom.habitEditHint) dom.habitEditHint.textContent = 'Editing existing habit';
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
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
          if (dom.habitColor) dom.habitColor.value = '#7c3aed';
        }
        saveState();
        renderChecklist();
        renderLibrary();
        renderProgress();
        renderHistory();
      });

      actions.append(edit, remove);
      item.append(block, actions);
      dom.library.append(item);
    });
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
      return;
    }

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
        remove.addEventListener('click', () => {
          day.journal = day.journal.filter((j) => j.id !== entry.id);
          saveState();
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
        remove.addEventListener('click', () => {
          day.dreams = day.dreams.filter((j) => j.id !== entry.id);
          saveState();
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
      const key = d.toISOString().slice(0, 10);
      const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, key));
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

  const streakThrough = (dateValue) => {
    let streak = 0;
    const start = new Date(dateValue);
    for (let i = 0; i < 365; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, key));
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

  const dayCompletion = (date) => {
    const day = state.days[date];
    const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
    const total = todayHabits.length || 1;
    const done = day ? todayHabits.filter((h) => day.habits && day.habits[h.id]).length : 0;
    return Math.round((done / total) * 100);
  };

  const taskCompletion = (date) => {
    const day = state.days[date];
    if (!day || !day.tasks.length) return 0;
    return 100;
  };

  const renderProgress = (fromAction = false) => {
    if (!dom.progressFill) return;
    const date = today();
    const day = getDay(date);
    const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
    const total = todayHabits.length || 1;
    const done = todayHabits.filter((h) => day.habits[h.id]).length;
    const percent = Math.round((done / total) * 100);
    dom.completeCount.textContent = done;
    if (dom.progressValue) dom.progressValue.textContent = `${percent}%`;
    if (dom.ringSubtext) dom.ringSubtext.textContent = `${done} / ${todayHabits.length}`;
    const circumference = 440;
    const offset = circumference - (percent / 100) * circumference;
    dom.progressFill.style.strokeDashoffset = offset;
    dom.progressFill.style.stroke = `var(--accent-strong)`;
    if (fromAction && percent !== lastProgressPercent) {
      dom.progressFill.classList.add('wins-pulse');
      setTimeout(() => dom.progressFill && dom.progressFill.classList.remove('wins-pulse'), 300);
    }
    lastProgressPercent = percent;
    dom.streak.textContent = `${computeStreak()}`;
    renderStreakBar();
    renderStats();
    renderWeekly();
    renderMonthly();
  };

  const renderStreakBar = () => {
    if (!dom.streakBar) return;
    const streakCount = computeStreak();
    const percent = Math.min((streakCount / 60) * 100, 100);
    const fill = dom.streakBar.querySelector('.streak-fill');
    if (fill) fill.style.width = `${percent}%`;
    if (dom.streak) dom.streak.textContent = `${streakCount}`;
    const value = dom.streakBar.querySelector('.streak-value');
    if (value) value.textContent = `${streakCount}d`;
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
    const percents = dates.map((d) => dayCompletion(d));
    const avg = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
    dom.momentum.textContent = `${avg}%`;

    const todayPercent = percents[0];
    const yesterday = percents[1] || 0;
    const diff = todayPercent - yesterday;
    if (dom.pace) dom.pace.textContent = diff === 0 ? 'Even' : `${diff > 0 ? '+' : ''}${diff}%`;

    const best = Object.keys(state.days).reduce((max, key) => Math.max(max, dayCompletion(key)), 0);
    if (dom.bestDay) dom.bestDay.textContent = `${best}%`;

    if (dom.focusTime) {
      const tasksDone = getDay(today()).tasks.length;
      const minutes = tasksDone * 15;
      dom.focusTime.textContent = `${(minutes / 60).toFixed(1)}h`;
    }
  };

  const renderWeekly = () => {
    if (!dom.weeklyBars) return;
    const todayDate = new Date();
    const start = new Date(todayDate);
    const offset = (todayDate.getDay() + 6) % 7; // Monday start
    start.setDate(todayDate.getDate() - offset);
    const dates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    dom.weeklyBars.innerHTML = '';
    dates.forEach((date) => {
      const percent = dayCompletion(date);
      const bar = document.createElement('div');
      bar.className = 'bar';
      const dayLabel = document.createElement('label');
      dayLabel.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(date));
      const fill = document.createElement('span');
      fill.style.height = `${percent}%`;
       bar.title = `${formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}: ${percent}% complete`;
      bar.append(dayLabel, fill);
      if (date === today()) bar.classList.add('today');
      dom.weeklyBars.append(bar);
    });
  };

  const renderMonthly = () => {
    if (!dom.monthlyStrip) return;
    const todayDate = new Date();
    const activeYear = dom.yearPicker ? Number(dom.yearPicker.value || todayDate.getFullYear()) : todayDate.getFullYear();
    dom.monthlyStrip.innerHTML = '';
    const monthStart = new Date(activeYear, todayDate.getMonth(), 1);
    const dates = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(monthStart);
      d.setDate(monthStart.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
    dates.forEach((date) => {
      const percent = dayCompletion(date);
      const todaysHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
      const hasHabits = todaysHabits.length > 0;
      const day = state.days[date];
      const done = todaysHabits.filter((h) => day?.habits?.[h.id]).length;
      const wins = (day?.tasks || []).length;
      const hasData = hasActivity(day);
      const button = document.createElement('button');
      const color = completionColor(percent, hasHabits, hasData);
      if (color.startsWith('#') && color.length === 7) {
        const intensity = Math.max(0.15, Math.min(percent / 100, 1));
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        button.style.background = `rgba(${r}, ${g}, ${b}, ${intensity})`;
      } else {
        button.style.background = color;
      }
      button.title = `${formatDate(date, { month: 'short', day: 'numeric' })}: ${done}/${todaysHabits.length} habits, ${wins} wins`;
      button.addEventListener('click', () => openDayDetail(date));
      dom.monthlyStrip.append(button);
    });
  };

  const renderHistory = () => {
    if (!dom.history) return;
    if (dom.historyToggle) dom.historyToggle.textContent = historyExpanded ? 'Collapse year view' : 'Expand year view';
    const todayDate = new Date();
    const safeYear = Math.min(state.currentYear || todayDate.getFullYear(), todayDate.getFullYear());
    state.currentYear = safeYear;
    const currentYearValue = safeYear;
    const storedYears = Object.keys(state.days).map((key) => new Date(key).getFullYear());
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
        return d.toISOString().slice(0, 10);
      });
      dates.forEach((date) => {
        const todaysHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
        const total = todaysHabits.length;
        const day = state.days[date];
        const hasData = hasActivity(day);
        const done = todaysHabits.filter((h) => day?.habits?.[h.id]).length;
        const percent = total ? Math.round((done / total) * 100) : 0;
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'day-tile';
        tile.style.background = completionColor(percent, total > 0, hasData);
        const heading = document.createElement('strong');
        heading.textContent = formatDate(date, { month: 'short', day: 'numeric' });
        const stats = document.createElement('div');
        stats.className = 'meta';
        stats.textContent = total ? `${done}/${total} habits` : 'No data';
        const wins = (day?.tasks || []).length;
        tile.title = `Habits: ${done}/${total || 0}\nWins: ${wins}\nStreak: ${streakThrough(date)}d`;
        tile.append(heading, stats);
        tile.addEventListener('click', () => openDayDetail(date));
        dom.history.append(tile);
      });
      return;
    }

    const daysInRange = Math.floor((end - start) / 86400000) + 1;
    const dates = Array.from({ length: daysInRange }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    dates.forEach((date) => {
      const todaysHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
      const total = todaysHabits.length;
      const day = state.days[date];
      const hasData = hasActivity(day);
      const done = todaysHabits.filter((h) => day?.habits?.[h.id]).length;
      const percent = total ? Math.round((done / total) * 100) : 0;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'day-tile';
      tile.style.background = completionColor(percent, total > 0, hasData);

      const heading = document.createElement('strong');
      heading.textContent = formatDate(date, { month: 'short', day: 'numeric' });
      const stats = document.createElement('div');
      stats.className = 'meta';
      stats.textContent = total ? `${percent}%` : 'No data';
      const wins = (day?.tasks || []).length;
      tile.title = `Habits: ${done}/${total || 0}\nWins: ${wins}\nStreak: ${streakThrough(date)}d`;

      tile.append(heading, stats);
      tile.addEventListener('click', () => openDayDetail(date));
      dom.history.append(tile);
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
    const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
    const done = todayHabits.filter((h) => day.habits[h.id]).length;
    const habitsPercent = dayCompletion(date);
    habitsBlock.innerHTML = `<h4 id="detail-habits">Habits</h4><p class="muted">${done}/${todayHabits.length || 0} done (${habitsPercent}%)</p>`;
    const habitsProgress = document.createElement('div');
    habitsProgress.className = 'tiny-progress';
    const habitsFill = document.createElement('span');
    habitsFill.style.width = `${habitsPercent}%`;
    habitsFill.style.background = progressColor(habitsPercent);
    habitsProgress.append(habitsFill);
    habitsBlock.append(habitsProgress);
    wrap.append(habitsBlock);

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
    if (!dom.quitList) return;
    dom.quitList.innerHTML = '';
    if (!state.quits.length) {
      dom.emptyQuit.classList.remove('hidden');
      return;
    }
    dom.emptyQuit.classList.add('hidden');
    state.quits.forEach((quit) => {
      const row = document.createElement('div');
      row.className = 'quit-row';
      row.dataset.date = quit.date;
      const left = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = quit.name;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `Quit on ${formatDate(quit.date, { month: 'long', day: 'numeric', year: 'numeric' })}`;
      left.append(name, meta);

      const timer = document.createElement('span');
      timer.className = 'badge';
      timer.dataset.timer = quit.date;
      timer.textContent = '';

      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'ghost';
      reset.textContent = 'Reset';
      reset.addEventListener('click', () => {
        if (!confirm('Reset this quit timer to today?')) return;
        quit.date = today();
        saveState();
        renderQuitList();
      });

      row.append(left, timer, reset);
      dom.quitList.append(row);
    });
    updateQuitTimers();
  };

  const renderTotals = () => {
    if (dom.goalTotal) dom.goalTotal.textContent = String(state.goals.length);
    if (dom.habitTotal) dom.habitTotal.textContent = String(state.habits.length);
  };

  const updateQuitTimers = () => {
    const timers = document.querySelectorAll('[data-timer]');
    timers.forEach((node) => {
      const start = new Date(node.dataset.timer);
      const diff = Date.now() - start.getTime();
      if (diff < 0) {
        node.textContent = 'Starting soon';
        return;
      }
      const seconds = Math.floor(diff / 1000);
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
    if (!isHome) return;
    if (dom.todayLabel) dom.todayLabel.textContent = formatDate(today());
    renderTitle();
    applyTheme();
    applyAccent();
    applyHiddenSections();
    applyFocusMode();
    syncHiddenSectionToggles();
    renderChecklist();
    renderTasks();
    renderLibrary();
    renderJournal();
    renderDreams();
    renderQuitList();
    renderTotals();
    renderHistory();
    renderProgress();
  };

  // Shared habit form handling (Goals page + future use)
  if (dom.dayPicker && dom.habitCadence) {
    updateDayPickerVisibility();
    dom.habitCadence.addEventListener('change', updateDayPickerVisibility);
  }

  if (dom.habitForm) {
    dom.habitForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = dom.habitInput.value.trim();
      if (!name) return;
      const cadence = dom.habitCadence.value;
      const days = Array.from(dom.dayPicker.querySelectorAll('input:checked')).map((d) => Number(d.value));
      const icon = dom.habitIcon ? dom.habitIcon.value : '';
      const color = dom.habitColor ? dom.habitColor.value : '#7c3aed';
      if (editingHabitId) {
        const existing = state.habits.find((h) => h.id === editingHabitId);
        if (existing) {
          existing.name = name;
          existing.cadence = cadence;
          existing.days = days;
          existing.icon = icon;
          existing.color = color;
        }
      } else {
        const habit = { id: randomId(), name, cadence, days, icon, color };
        state.habits.push(habit);
      }
      dom.habitInput.value = '';
      dom.dayPicker.querySelectorAll('input').forEach((i) => (i.checked = false));
      if (dom.habitIcon) dom.habitIcon.value = '';
      if (dom.habitColor) dom.habitColor.value = '#7c3aed';
      editingHabitId = null;
      if (dom.habitSubmit) dom.habitSubmit.textContent = 'Add habit';
      if (dom.habitEditHint) dom.habitEditHint.textContent = 'Add to today\'s checklist';
      saveState();
      renderLibrary();
      renderChecklist();
      renderHistory();
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
      if (isHome) renderAll();
      if (renderGoalsPage) renderGoalsPage();
    });
  }

  if (dom.themeToggle) {
    dom.themeToggle.addEventListener('change', () => {
      state.theme = dom.themeToggle.checked ? 'light' : 'dark';
      applyTheme();
      saveState();
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

  if (dom.focusMode) {
    dom.focusMode.checked = !!state.focusMode;
    dom.focusMode.addEventListener('change', () => {
      state.focusMode = dom.focusMode.checked;
      saveState();
      applyFocusMode();
    });
  }

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
      if (!habitsById[id]) habitsById[id] = { id, name, cadence: 'daily', days: [], icon: '', color: '#7c3aed' };
      if (!days[date]) days[date] = { habits: {}, tasks: [], journal: [], dreams: [] };
      days[date].habits[id] = done;
    });
    return { habits: Object.values(habitsById), days };
  };

  if (dom.exportCsv) {
    dom.exportCsv.addEventListener('click', exportCsvData);
  }

  if (dom.importData && dom.importFile) {
    dom.importData.addEventListener('click', () => dom.importFile.click());
    dom.importFile.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
          let payload = null;
          if (file.name.endsWith('.json')) {
            payload = JSON.parse(text);
          } else if (file.name.endsWith('.csv')) {
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

  // Events: Home page
  if (isHome) {
    if (dom.markAll) {
      dom.markAll.addEventListener('click', () => {
        const day = getDay(today());
        state.habits.forEach((h) => {
          if (shouldShowHabitToday(h, today())) {
            day.habits[h.id] = true;
          }
        });
        saveState();
        renderChecklist();
        renderHistory();
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
      dom.taskForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const title = dom.taskInput.value.trim();
        if (!title) return;
        const day = getDay(today());
        day.tasks.push({ id: randomId(), title, created: Date.now() });
        dom.taskInput.value = '';
        saveState();
        renderTasks();
        renderHistory();
      });
    }

    if (dom.clearDone) {
      dom.clearDone.addEventListener('click', () => {
        const day = getDay(today());
        day.tasks = [];
        saveState();
        renderTasks();
        renderHistory();
      });
    }

    if (dom.journalForm) {
      dom.journalForm.addEventListener('submit', (event) => {
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
        renderJournal();
        renderHistory();
      });
    }

    if (dom.dreamForm) {
      dom.dreamForm.addEventListener('submit', (event) => {
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
        renderDreams();
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

    renderAll();
    setInterval(updateQuitTimers, 1000);
  }

  // Events: Goals page
  if (isGoals) {
    if (dom.goalForm) {
      dom.goalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = dom.goalInput.value.trim();
        if (!text) return;
        state.goals.push({ id: randomId(), title: text, created: Date.now() });
        dom.goalInput.value = '';
        saveState();
        renderGoals();
      });
    }

    if (dom.quitForm) {
      dom.quitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = dom.quitName.value.trim();
        const date = dom.quitDate.value || today();
        if (!name) return;
        state.quits.push({ id: randomId(), name, date });
        dom.quitName.value = '';
        dom.quitDate.value = today();
        saveState();
        renderQuitLibrary();
      });
    }

    const renderGoals = () => {
      if (!dom.goalList) return;
      dom.goalList.innerHTML = '';
      renderTotals();
      if (!state.goals.length) {
        dom.goalList.innerHTML = '<div class="empty">Add your big targets for 2026.</div>';
        return;
      }
      state.goals
        .slice()
        .sort((a, b) => b.created - a.created)
        .forEach((goal) => {
          const row = document.createElement('div');
          row.className = 'goal-row';
          const title = document.createElement('strong');
          title.textContent = goal.title;
          const meta = document.createElement('div');
          meta.className = 'meta';
          meta.textContent = formatDate(new Date(goal.created).toISOString().slice(0, 10));
          const actions = document.createElement('div');
          actions.className = 'row';
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.className = 'ghost';
          edit.textContent = 'Edit';
          edit.addEventListener('click', () => {
            const next = prompt('Update your goal', goal.title);
            if (!next || !next.trim()) return;
            goal.title = next.trim();
            saveState();
            renderGoals();
          });
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'ghost';
          remove.textContent = 'Delete';
          remove.addEventListener('click', () => {
            state.goals = state.goals.filter((g) => g.id !== goal.id);
            saveState();
            renderGoals();
          });
          actions.append(edit, remove);
          row.append(title, meta, actions);
          dom.goalList.append(row);
        });
    };

    const renderQuitLibrary = () => {
      if (!dom.quitLibrary) return;
      dom.quitLibrary.innerHTML = '';
      if (!state.quits.length) {
        dom.quitLibrary.innerHTML = '<div class="empty">List habits you are quitting and log the date.</div>';
        return;
      }
      state.quits.forEach((quit) => {
        const row = document.createElement('div');
        row.className = 'goal-row';
        const name = document.createElement('strong');
        name.textContent = quit.name;
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `Quit on ${formatDate(quit.date, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        const actions = document.createElement('div');
        actions.className = 'row';
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'ghost';
        reset.textContent = 'Reset';
        reset.addEventListener('click', () => {
          if (!confirm('Reset this quit timer to today?')) return;
          quit.date = today();
          saveState();
          renderQuitLibrary();
          renderQuitList();
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ghost';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => {
          state.quits = state.quits.filter((q) => q.id !== quit.id);
          saveState();
          renderQuitLibrary();
          renderQuitList();
        });
        actions.append(reset, remove);
        row.append(name, meta, actions);
        dom.quitLibrary.append(row);
      });
    };

    renderGoalsPage = () => {
      renderTitle();
      applyTheme();
      applyAccent();
      applyHiddenSections();
      applyFocusMode();
      syncHiddenSectionToggles();
      if (dom.quitDate) dom.quitDate.value = today();
      renderLibrary();
      renderTotals();
      renderGoals();
      renderQuitLibrary();
    };

    renderGoalsPage();
  }

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
