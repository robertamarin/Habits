(function () {
  const STORAGE_KEY = 'habitFreshV1';
  const today = () => new Date().toISOString().slice(0, 10);
  const randomId = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const defaultState = () => ({
    habits: [],
    days: {},
    theme: 'dark'
  });

  const loadState = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed);
    } catch (e) {
      console.warn('Resetting state after parse issue', e);
      return defaultState();
    }
  };

  const saveState = (state) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  const state = loadState();
  const dom = {
    todayLabel: document.getElementById('today-label'),
    progress: document.getElementById('progress-bar'),
    habitList: document.getElementById('habit-list'),
    emptyHabits: document.getElementById('empty-habits'),
    completeCount: document.getElementById('complete-count'),
    habitCount: document.getElementById('habit-count'),
    streak: document.getElementById('streak'),
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
    reset: document.getElementById('reset-data'),
    themeToggle: document.getElementById('theme-toggle'),
    history: document.getElementById('history')
  };

  const getDay = (date) => {
    if (!state.days[date]) {
      state.days[date] = { habits: {}, tasks: [], journal: [] };
    }
    return state.days[date];
  };

  const formatDate = (value) => {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
  };

  const shouldShowHabitToday = (habit, dateValue) => {
    const day = new Date(dateValue).getDay();
    if (habit.cadence === 'daily') return true;
    if (habit.cadence === 'weekdays') return day >= 1 && day <= 5;
    if (habit.cadence === 'custom') {
      return (habit.days || []).includes(day);
    }
    return true;
  };

  const renderChecklist = () => {
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
        saveState(state);
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
        saveState(state);
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
        saveState(state);
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
        saveState(state);
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
          saveState(state);
          renderJournal();
          renderHistory();
        });

        item.append(content, time, remove);
        dom.journalList.append(item);
      });
  };

  const renderProgress = () => {
    const date = today();
    const day = getDay(date);
    const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
    const total = todayHabits.length || 1;
    const done = todayHabits.filter((h) => day.habits[h.id]).length;
    const percent = Math.round((done / total) * 100);
    dom.completeCount.textContent = done;
    dom.progress.style.width = `${percent}%`;
    dom.progress.parentElement.setAttribute('aria-valuenow', percent);
    dom.streak.textContent = `${computeStreak()}+`;
    dom.progress.title = `${percent}% complete`;
  };

  const renderHistory = () => {
    const dates = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().slice(0, 10);
    });

    dom.history.innerHTML = '';

    dates.forEach((date) => {
      const day = state.days[date];
      const todayHabits = state.habits.filter((h) => shouldShowHabitToday(h, date));
      const total = todayHabits.length;
      const done = day ? todayHabits.filter((h) => day.habits && day.habits[h.id]).length : 0;
      const tasks = day ? `${day.tasks.filter((t) => t.done).length}/${(day.tasks || []).length}` : '0/0';
      const entry = document.createElement('div');
      entry.className = 'day';

      const heading = document.createElement('strong');
      heading.textContent = formatDate(date);
      const stats = document.createElement('div');
      stats.textContent = total ? `${done}/${total} habits` : 'No habits scheduled';
      const tasksLine = document.createElement('div');
      tasksLine.className = 'meta';
      tasksLine.textContent = `Tasks: ${tasks}`;

      entry.append(heading, stats, tasksLine);
      dom.history.append(entry);
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

  // Event wiring
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
    saveState(state);
    renderLibrary();
    renderChecklist();
    renderHistory();
  });

  dom.habitCadence.addEventListener('change', () => {
    const custom = dom.habitCadence.value === 'custom';
    dom.dayPicker.style.display = custom ? 'flex' : 'none';
  });

  dom.markAll.addEventListener('click', () => {
    const day = getDay(today());
    state.habits.forEach((h) => {
      if (shouldShowHabitToday(h, today())) {
        day.habits[h.id] = true;
      }
    });
    saveState(state);
    renderChecklist();
    renderHistory();
  });

  dom.taskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = dom.taskInput.value.trim();
    if (!title) return;
    const day = getDay(today());
    day.tasks.push({ id: randomId(), title, done: false });
    dom.taskInput.value = '';
    saveState(state);
    renderTasks();
    renderHistory();
  });

  dom.clearDone.addEventListener('click', () => {
    const day = getDay(today());
    day.tasks = day.tasks.filter((t) => !t.done);
    saveState(state);
    renderTasks();
    renderHistory();
  });

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
    saveState(state);
    renderJournal();
    renderHistory();
  });

  dom.reset.addEventListener('click', () => {
    if (!confirm('This clears all saved habits, tasks, and journal entries. Continue?')) return;
    Object.assign(state, defaultState());
    saveState(state);
    renderAll();
  });

  dom.themeToggle.addEventListener('change', () => {
    state.theme = dom.themeToggle.checked ? 'light' : 'dark';
    applyTheme();
    saveState(state);
  });

  const applyTheme = () => {
    const mode = state.theme || 'dark';
    if (mode === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    dom.themeToggle.checked = mode === 'light';
  };

  const renderAll = () => {
    dom.todayLabel.textContent = formatDate(today());
    renderChecklist();
    renderTasks();
    renderLibrary();
    renderJournal();
    renderHistory();
    renderProgress();
  };

  // Initial setup
  dom.dayPicker.style.display = dom.habitCadence.value === 'custom' ? 'flex' : 'none';
  applyTheme();
  renderAll();
})();
