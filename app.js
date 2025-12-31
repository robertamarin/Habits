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
    currentMonth: '2025-12-01'
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

  const dom = {
    appTitle: document.getElementById('app-title'),
    todayLabel: document.getElementById('today-label'),
    progress: document.getElementById('progress-bar'),
    habitList: document.getElementById('habit-list'),
    emptyHabits: document.getElementById('empty-habits'),
    completeCount: document.getElementById('complete-count'),
    habitCount: document.getElementById('habit-count'),
    streak: document.getElementById('streak'),
    momentum: document.getElementById('momentum'),
    markAll: document.getElementById('mark-all'),
    taskForm: document.getElementById('task-form'),
    taskInput: document.getElementById('task-input'),
    taskList: document.getElementById('task-list'),
    taskCount: document.getElementById('task-count'),
    clearDone: document.getElementById('clear-done'),
    habitForm: document.getElementById('habit-form'),
    habitInput: document.getElementById('habit-input'),
    habitCadence: document.getElementById('habit-cadence'),
    dayPicker: document.getElementById('day-picker'),
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
    prevMonth: document.getElementById('prev-month'),
    nextMonth: document.getElementById('next-month'),
    settingsButton: document.getElementById('settings-button'),
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    titleInput: document.getElementById('title-input'),
    accentPicker: document.getElementById('accent-picker'),
    pace: document.getElementById('pace'),
    focusTime: document.getElementById('focus-time'),
    bestDay: document.getElementById('best-day'),
    quitList: document.getElementById('quit-list'),
    emptyQuit: document.getElementById('empty-quit'),
    dayDetail: document.getElementById('day-detail'),
    detailDate: document.getElementById('detail-date'),
    dayBreakdown: document.querySelector('.day-breakdown'),
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

  const progressColor = (percent) => {
    const hue = Math.round((percent / 100) * 120);
    return `hsl(${hue}, 80%, 50%)`;
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

    todayHabits.forEach((habit) => {
      const item = document.createElement('div');
      item.className = 'habit-item';

      const box = document.createElement('label');
      box.className = 'checkbox';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = Boolean(day.habits[habit.id]);
      input.addEventListener('change', () => {
        day.habits[habit.id] = input.checked;
        saveState();
        renderProgress();
        renderHistory();
      });

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = habit.name;

      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = habit.cadence === 'custom' ? `Days: ${(habit.days || []).length}` : habit.cadence;

      const left = document.createElement('div');
      left.append(box);
      box.append(input);
      const labels = document.createElement('div');
      labels.append(title, meta);
      left.append(labels);

      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = input.checked ? 'Done' : 'Pending';

      item.append(left, badge);
      dom.habitList.append(item);
    });

    renderProgress();
  };

  const renderTasks = () => {
    if (!dom.taskList) return;
    const day = getDay(today());
    dom.taskList.innerHTML = '';
    if (!day.tasks.length) {
      dom.taskList.innerHTML = '<div class="empty">No tasks yet</div>';
    }

    day.tasks.forEach((task) => {
      const item = document.createElement('div');
      item.className = 'task';

      const left = document.createElement('label');
      left.className = 'checkbox';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = task.done;
      input.addEventListener('change', () => {
        task.done = input.checked;
        saveState();
        renderTasks();
        renderHistory();
      });

      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = task.title;

      left.append(input, title);
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

    const done = day.tasks.filter((t) => t.done).length;
    dom.taskCount.textContent = `${done}/${day.tasks.length} done`;
  };

  const renderLibrary = () => {
    if (!dom.library) return;
    dom.library.innerHTML = '';
    if (!state.habits.length) {
      dom.library.innerHTML = '<div class="empty">No habits yet</div>';
      return;
    }

    state.habits.forEach((habit) => {
      const item = document.createElement('div');
      item.className = 'habit-item';

      const block = document.createElement('div');
      block.className = 'checkbox';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = habit.name;
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = habit.cadence === 'custom'
        ? `Specific days (${(habit.days || []).length})`
        : habit.cadence;

      block.append(title, meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        const date = today();
        const day = getDay(date);
        delete day.habits[habit.id];
        state.habits = state.habits.filter((h) => h.id !== habit.id);
        saveState();
        renderChecklist();
        renderLibrary();
        renderProgress();
        renderHistory();
      });

      item.append(block, remove);
      dom.library.append(item);
    });
  };

  const renderJournal = () => {
    if (!dom.journalList) return;
    const date = today();
    const day = getDay(date);
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
      const day = state.days[key];
      if (!day) break;
      const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, key));
      const total = todayHabits.length;
      const done = todayHabits.filter((h) => day.habits && day.habits[h.id]).length;
      if (total && done === total) {
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

  const renderProgress = () => {
    if (!dom.progress) return;
    const date = today();
    const day = getDay(date);
    const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
    const total = todayHabits.length || 1;
    const done = todayHabits.filter((h) => day.habits[h.id]).length;
    const percent = Math.round((done / total) * 100);
    dom.completeCount.textContent = done;
    dom.progress.style.width = `${percent}%`;
    dom.progress.style.background = progressColor(percent);
    dom.progress.parentElement.setAttribute('aria-valuenow', percent);
    dom.streak.textContent = `${computeStreak()}+`;
    dom.progress.title = `${percent}% complete`;
    renderStats();
  };

  const renderStats = () => {
    if (!dom.momentum) return;
    const dates = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });
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
      const tasksDone = getDay(today()).tasks.filter((t) => t.done).length;
      const minutes = tasksDone * 15;
      dom.focusTime.textContent = `${(minutes / 60).toFixed(1)}h`;
    }
  };

  const renderHistory = () => {
    if (!dom.history) return;
    const monthStart = new Date(state.currentMonth);
    const month = monthStart.getMonth();
    const year = monthStart.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dates = Array.from({ length: daysInMonth }).map((_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().slice(0, 10);
    });

    if (dom.monthLabel) dom.monthLabel.textContent = formatDate(monthStart.toISOString().slice(0, 10), { month: 'long', year: 'numeric' });
    dom.history.innerHTML = '';

    dates.forEach((date) => {
      const percent = dayCompletion(date);
      const day = state.days[date];
      const tasks = day ? `${day.tasks.filter((t) => t.done).length}/${(day.tasks || []).length}` : '0/0';
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'day-tile';
      tile.style.background = `linear-gradient(160deg, ${progressColor(percent)}, rgba(255,255,255,0.08))`;

      const heading = document.createElement('strong');
      heading.textContent = new Date(date).getDate();
      const stats = document.createElement('div');
      stats.textContent = `${percent}%`;
      const bar = document.createElement('div');
      bar.className = 'tiny-progress';
      const barFill = document.createElement('span');
      barFill.style.width = `${percent}%`;
      barFill.style.background = progressColor(percent);
      bar.append(barFill);

      const tasksLine = document.createElement('div');
      tasksLine.className = 'meta';
      tasksLine.textContent = `Tasks ${tasks}`;

      tile.append(heading, stats, bar, tasksLine);
      tile.addEventListener('click', () => openDayDetail(date));
      dom.history.append(tile);
    });
  };

  const openDayDetail = (date) => {
    if (!dom.dayDetail) return;
    const day = getDay(date);
    dom.detailDate.textContent = formatDate(date);

    const wrap = document.createElement('div');
    wrap.className = 'stack';

    const habitsBlock = document.createElement('div');
    habitsBlock.className = 'panelish';
    const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
    const done = todayHabits.filter((h) => day.habits[h.id]).length;
    habitsBlock.innerHTML = `<h4>Habits</h4><p class="muted">${done}/${todayHabits.length || 0} done</p>`;
    wrap.append(habitsBlock);

    const tasksBlock = document.createElement('div');
    tasksBlock.className = 'panelish';
    tasksBlock.innerHTML = '<h4>One-off wins</h4>';
    const taskList = document.createElement('ul');
    taskList.className = 'bullet';
    (day.tasks || []).forEach((t) => {
      const li = document.createElement('li');
      li.textContent = `${t.done ? '✅' : '⬜'} ${t.title}`;
      taskList.append(li);
    });
    tasksBlock.append(taskList);
    wrap.append(tasksBlock);

    const journalBlock = document.createElement('div');
    journalBlock.className = 'panelish';
    journalBlock.innerHTML = '<h4>Daily reflection</h4>';
    if (!day.journal.length) {
      journalBlock.append(spanMuted('No reflections yet'));
    } else {
      day.journal.forEach((entry) => {
        const div = document.createElement('div');
        div.className = 'note-line';
        div.textContent = `${entry.title || 'Untitled'} — ${entry.text}`;
        journalBlock.append(div);
      });
    }
    wrap.append(journalBlock);

    const dreamBlock = document.createElement('div');
    dreamBlock.className = 'panelish';
    dreamBlock.innerHTML = '<h4>Dream log</h4>';
    if (!day.dreams.length) {
      dreamBlock.append(spanMuted('No dream logged'));
    } else {
      day.dreams.forEach((entry) => {
        const div = document.createElement('div');
        div.className = 'note-line';
        div.textContent = `${entry.title || 'Dream'} — ${entry.text}`;
        dreamBlock.append(div);
      });
    }
    wrap.append(dreamBlock);

    dom.dayBreakdown.innerHTML = '';
    dom.dayBreakdown.append(wrap);
    dom.dayDetail.showModal();
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

      row.append(left, timer);
      dom.quitList.append(row);
    });
    updateQuitTimers();
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

  const clampMonth = (date) => {
    const min = new Date('2025-12-01');
    if (date < min) return min;
    return date;
  };

  const changeMonth = (delta) => {
    const base = new Date(state.currentMonth);
    base.setMonth(base.getMonth() + delta);
    const clamped = clampMonth(base);
    state.currentMonth = clamped.toISOString().slice(0, 10);
    saveState();
    renderHistory();
  };

  const renderAll = () => {
    if (!isHome) return;
    if (dom.todayLabel) dom.todayLabel.textContent = formatDate(today());
    renderTitle();
    applyTheme();
    applyAccent();
    renderChecklist();
    renderTasks();
    renderLibrary();
    renderJournal();
    renderDreams();
    renderQuitList();
    renderHistory();
    renderProgress();
  };

  // Events: Home page
  if (isHome) {
    if (dom.dayPicker && dom.habitCadence) {
      dom.dayPicker.style.display = dom.habitCadence.value === 'custom' ? 'flex' : 'none';
    }

    if (dom.habitForm) {
      dom.habitForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = dom.habitInput.value.trim();
        if (!name) return;
        const cadence = dom.habitCadence.value;
        const days = Array.from(dom.dayPicker.querySelectorAll('input:checked')).map((d) => Number(d.value));
        const habit = { id: randomId(), name, cadence, days };
        state.habits.push(habit);
        dom.habitInput.value = '';
        dom.dayPicker.querySelectorAll('input').forEach((i) => (i.checked = false));
        saveState();
        renderLibrary();
        renderChecklist();
        renderHistory();
      });
    }

    if (dom.habitCadence) {
      dom.habitCadence.addEventListener('change', () => {
        const custom = dom.habitCadence.value === 'custom';
        dom.dayPicker.style.display = custom ? 'flex' : 'none';
      });
    }

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

    if (dom.taskForm) {
      dom.taskForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const title = dom.taskInput.value.trim();
        if (!title) return;
        const day = getDay(today());
        day.tasks.push({ id: randomId(), title, done: false });
        dom.taskInput.value = '';
        saveState();
        renderTasks();
        renderHistory();
      });
    }

    if (dom.clearDone) {
      dom.clearDone.addEventListener('click', () => {
        const day = getDay(today());
        day.tasks = day.tasks.filter((t) => !t.done);
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
        saveState();
        renderDreams();
        renderHistory();
      });
    }

    if (dom.reset) {
      dom.reset.addEventListener('click', () => {
        if (!confirm('This clears all saved habits, tasks, journals, dreams, and goals. Continue?')) return;
        Object.assign(state, defaultState());
        saveState();
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

    if (dom.settingsButton && dom.settingsModal) {
      dom.settingsButton.addEventListener('click', () => {
        dom.settingsModal.showModal();
        if (dom.titleInput) dom.titleInput.value = state.title;
      });
    }
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

    if (dom.prevMonth) dom.prevMonth.addEventListener('click', () => changeMonth(-1));
    if (dom.nextMonth) dom.nextMonth.addEventListener('click', () => changeMonth(1));
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
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'ghost';
          remove.textContent = 'Delete';
          remove.addEventListener('click', () => {
            state.goals = state.goals.filter((g) => g.id !== goal.id);
            saveState();
            renderGoals();
          });
          row.append(title, meta, remove);
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
        meta.textContent = `Quit on ${quit.date}`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ghost';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => {
          state.quits = state.quits.filter((q) => q.id !== quit.id);
          saveState();
          renderQuitLibrary();
        });
        row.append(name, meta, remove);
        dom.quitLibrary.append(row);
      });
    };

    const renderGoalsPage = () => {
      renderTitle();
      applyTheme();
      applyAccent();
      if (dom.quitDate) dom.quitDate.value = today();
      renderGoals();
      renderQuitLibrary();
    };

    renderGoalsPage();
  }
})();
