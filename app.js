(function () {
  const STORAGE_KEY = 'habitStateV2';
  const randomId = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const today = () => new Date().toISOString().slice(0, 10);

  const defaultState = () => ({
    goals: [],
    completions: {},
    todos: [],
    breaks: [],
    logs: [],
    dreams: [],
    theme: 'dark',
    accent: '#7c3aed'
  });

  const normalizeCompletions = (source = {}) => {
    const output = {};
    Object.entries(source).forEach(([date, record]) => {
      const goals = record.goals || record.goalStatuses || {};
      output[date] = {
        goals: goals,
        todoCount: record.todoCount || 0
      };
    });
    return output;
  };

  const migrateLegacy = () => {
    const state = defaultState();
    try {
      const goals = JSON.parse(localStorage.getItem('habitGoals') || '[]');
      const completions = normalizeCompletions(JSON.parse(localStorage.getItem('habitCompletions') || '{}'));
      const todos = JSON.parse(localStorage.getItem('habitTodos') || '[]');
      const breaks = JSON.parse(localStorage.getItem('habitBreaks') || '[]');
      const theme = localStorage.getItem('habitTheme');
      const accent = localStorage.getItem('habitAccent');
      if (goals.length || Object.keys(completions).length || todos.length || breaks.length) {
        state.goals = goals.map((g, i) => ({
          id: g.id || randomId(),
          name: g.name || 'Untitled goal',
          group: g.group || '',
          target: g.target || 1,
          frequency: g.frequency || 'daily',
          days: g.days || [],
          times: g.times || 3,
          createdDate: g.createdDate || today(),
          archived: g.archived || false,
          archivedDate: g.archivedDate,
          order: typeof g.order === 'number' ? g.order : i
        }));
        state.completions = completions;
        state.todos = todos.map(t => ({
          id: t.id || randomId(),
          text: t.text || 'Task',
          completed: !!t.completed,
          dueDate: t.dueDate || '',
          completedDate: t.completedDate || ''
        }));
        state.breaks = breaks.map(b => ({ id: b.id || randomId(), name: b.name || 'Quit habit', startDate: b.startDate || today() }));
        state.theme = theme || state.theme;
        state.accent = accent || state.accent;
      }
    } catch (err) {
      console.warn('Migration skipped', err);
    }
    return state;
  };

  const loadState = () => {
    const base = defaultState();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return migrateLegacy();
    try {
      const parsed = JSON.parse(saved);
      parsed.completions = normalizeCompletions(parsed.completions || {});
      return { ...base, ...parsed };
    } catch (err) {
      console.error('Failed to parse state', err);
      return migrateLegacy();
    }
  };

  let state = loadState();
  let cachedToday = today();
  let timerId;
  let activePage = 'today';

  const persist = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const setTheme = (theme) => {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    persist();
  };

  const setAccent = (color) => {
    state.accent = color;
    document.documentElement.style.setProperty('--accent', color);
    persist();
  };

  const ensureRecord = (date) => {
    const existing = state.completions[date];
    if (existing) {
      if (existing.goalStatuses && !existing.goals) existing.goals = existing.goalStatuses;
    }
    state.completions[date] = state.completions[date] || { goals: {}, todoCount: 0 };
    return state.completions[date];
  };

  const isGoalDue = (goal, dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    if (goal.archived && goal.archivedDate && dateStr >= goal.archivedDate) return false;
    if (dateStr < goal.createdDate) return false;
    const weekday = date.getDay();
    switch (goal.frequency) {
      case 'weekdays':
        return weekday >= 1 && weekday <= 5;
      case 'custom':
        return (goal.days || []).includes(weekday);
      case 'week': {
        const { start } = getRange(dateStr, 'week');
        const count = countGoal(goal.id, start, dateStr);
        return count < (goal.times || 3);
      }
      case 'month': {
        const { start } = getRange(dateStr, 'month');
        const count = countGoal(goal.id, start, dateStr);
        return count < (goal.times || 10);
      }
      default:
        return true;
    }
  };

  const getRange = (dateStr, type) => {
    const date = new Date(dateStr + 'T00:00:00');
    if (type === 'week') {
      const diff = (date.getDay() + 6) % 7;
      const start = new Date(date);
      start.setDate(date.getDate() - diff);
      return { start: toISO(start) };
    }
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    return { start: toISO(start) };
  };

  const toISO = (d) => d.toISOString().slice(0, 10);

  const countGoal = (goalId, start, end) => {
    let cursor = new Date(start + 'T00:00:00');
    const limit = new Date(end + 'T00:00:00');
    let total = 0;
    while (cursor <= limit) {
      const key = toISO(cursor);
      total += state.completions[key]?.goals?.[goalId] || 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    return total;
  };

  const goalsForDate = (dateStr) => state.goals
    .filter((g) => !g.archived)
    .filter((g) => isGoalDue(g, dateStr))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const metrics = () => {
    const record = ensureRecord(cachedToday);
    const todayGoals = goalsForDate(cachedToday);
    const totalTargets = todayGoals.reduce((sum, g) => sum + (g.target || 1), 0);
    const completed = todayGoals.reduce((sum, g) => sum + Math.min(record.goals[g.id] || 0, g.target || 1), 0);
    const percent = totalTargets === 0 ? 0 : Math.round((completed / totalTargets) * 100);

    const year = new Date(cachedToday).getFullYear();
    let yearCount = 0;
    Object.entries(state.completions).forEach(([date, rec]) => {
      if (!date.startsWith(String(year))) return;
      yearCount += Object.values(rec.goals || {}).reduce((a, b) => a + Math.min(b, 999), 0);
      yearCount += rec.todoCount || 0;
    });

    const streak = computeStreak();
    const todayActions = completed + (record.todoCount || 0);

    return { percent, completed, totalTargets, yearCount, streak, todayActions, goalCount: todayGoals.length };
  };

  const summarizeRange = (range) => {
    const end = new Date(cachedToday + 'T00:00:00');
    const start = new Date(end);
    start.setDate(end.getDate() - (range - 1));
    const data = [];
    let longest = 0;
    let current = 0;
    let totalPct = 0;
    let daysCounted = 0;
    let bestDay = '';
    let bestTotal = 0;
    let totalActions = 0;
    let goalActions = 0;
    let todoActions = 0;

    let cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = toISO(cursor);
      const goalsDue = goalsForDate(dateStr);
      const record = state.completions[dateStr] || { goals: {}, todoCount: 0 };
      const target = goalsDue.reduce((s, g) => s + (g.target || 1), 0);
      const doneGoals = goalsDue.reduce((s, g) => s + Math.min(record.goals?.[g.id] || 0, g.target || 1), 0);
      const done = doneGoals + (record.todoCount || 0);
      data.push({ date: dateStr, done, target });

      if (target === 0 || done >= target) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
      totalPct += target ? (Math.min(done, target) / Math.max(target, 1)) : 1;
      daysCounted += 1;
      if (done > bestTotal) { bestTotal = done; bestDay = dateStr; }
      totalActions += done;
      goalActions += doneGoals;
      todoActions += record.todoCount || 0;
      cursor.setDate(cursor.getDate() + 1);
    }

    const averageCompletion = Math.round((totalPct / Math.max(daysCounted, 1)) * 100);
    const averageActions = Math.round(totalActions / Math.max(daysCounted, 1));

    return { data, longest, bestDay, bestTotal, averageCompletion, averageActions, totalActions, goalActions, todoActions };
  };

  const computeStreak = () => {
    let streak = 0;
    let cursor = new Date(cachedToday + 'T00:00:00');
    while (true) {
      const dateStr = toISO(cursor);
      const todaysGoals = goalsForDate(dateStr);
      const record = state.completions[dateStr];
      const allDone = todaysGoals.length === 0 || (record && todaysGoals.every(g => (record.goals?.[g.id] || 0) >= (g.target || 1)));
      if (!allDone) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  };

  const humanFrequency = (goal) => {
    switch (goal.frequency) {
      case 'weekdays': return 'Weekdays';
      case 'custom': return (goal.days || []).map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ') || 'Custom days';
      case 'week': return `${goal.times || 3}× per week`;
      case 'month': return `${goal.times || 10}× per month`;
      default: return 'Daily';
    }
  };

  const playTick = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 940;
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (_) { /* ignore */ }
  };

  const render = () => {
    cachedToday = today();
    qs('#today-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    renderThemeControls();
    renderStats();
    renderGoalsToday();
    renderTodos();
    renderSnapshot();
    renderBreaks();
    renderWeeklyGraphic();
    renderInsights();
    renderJournals();
    renderDreams();
    if (activePage === 'goals') renderGoalsPage();
    if (activePage === 'history') { renderHistory(); renderAnalytics(); }
  };

  const renderThemeControls = () => {
    const select = qs('#theme-select');
    const accentPicker = qs('#accent-picker');
    if (select) select.value = state.theme;
    if (accentPicker) accentPicker.value = state.accent;
    setTheme(state.theme);
    setAccent(state.accent);
  };

  const renderStats = () => {
    const { percent, completed, totalTargets, yearCount, streak, todayActions, goalCount } = metrics();
    const bar = qs('#progress-bar');
    const label = qs('#progress-label');
    if (bar) bar.style.width = `${percent}%`;
    if (label) label.textContent = `${percent}% • ${completed}/${totalTargets || 0} steps`;

    const grid = qs('#stat-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const tiles = [
      { label: 'Today', value: todayActions },
      { label: 'Goals active', value: goalCount },
      { label: 'Year actions', value: yearCount },
      { label: 'Streak', value: `${streak} days` }
    ];
    tiles.forEach(t => {
      const div = document.createElement('div');
      div.className = 'stat-tile';
      div.innerHTML = `<div class="label">${t.label}</div><div class="value">${t.value}</div>`;
      grid.appendChild(div);
    });

    const quote = qs('#quote');
    if (quote) {
      const lines = [
        'Small steps stack into big wins.',
        'Show up for five minutes.',
        'Keep the chain unbroken.',
        'Momentum beats motivation.'
      ];
      quote.textContent = lines[Math.floor(Math.random() * lines.length)];
    }
    const xp = qs('#xp-level');
    if (xp) {
      const level = Math.floor(yearCount / 30) + 1;
      xp.textContent = `Level ${level} · ${yearCount * 10} XP`;
    }
  };

  const renderGoalsToday = () => {
    const container = qs('#goal-list-today');
    const empty = qs('#empty-goals');
    if (!container) return;
    container.innerHTML = '';

    const activeGoals = goalsForDate(cachedToday);
    const record = ensureRecord(cachedToday);
    const completeCount = activeGoals.filter(g => (record.goals[g.id] || 0) >= (g.target || 1)).length;
    const summary = qs('#goal-summary');
    if (summary) summary.textContent = activeGoals.length ? `${completeCount}/${activeGoals.length} done` : 'No goals today';

    if (activeGoals.length === 0) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    activeGoals.forEach(goal => {
      const card = document.createElement('div');
      card.className = 'card';
      const done = record.goals[goal.id] || 0;
      const target = goal.target || 1;

      const left = document.createElement('div');
      left.className = 'left';
      left.innerHTML = `<strong>${goal.name}</strong><div class="muted">${humanFrequency(goal)} · Target ${target}${goal.group ? ` · ${goal.group}` : ''}</div>`;

      const controls = document.createElement('div');
      controls.className = 'switch';
      const minus = document.createElement('button');
      minus.className = 'ghost';
      minus.textContent = '-1';
      minus.disabled = done <= 0;
      minus.addEventListener('click', () => adjustGoal(goal.id, -1));
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = `${done}/${target}`;
      const plus = document.createElement('button');
      plus.className = 'ghost';
      plus.textContent = '+1';
      plus.disabled = done >= target;
      plus.addEventListener('click', () => adjustGoal(goal.id, 1));

      controls.append(minus, badge, plus);
      card.append(left, controls);
      container.appendChild(card);
    });
  };

  const adjustGoal = (goalId, delta) => {
    const goal = state.goals.find(g => g.id === goalId);
    const target = goal ? goal.target || 1 : 1;
    const record = ensureRecord(cachedToday);
    const current = record.goals[goalId] || 0;
    record.goals[goalId] = Math.min(Math.max(0, current + delta), target);
    persist();
    render();
    if (delta > 0) playTick();
  };

  const renderTodos = () => {
    const list = qs('#todo-list');
    if (!list) return;
    list.innerHTML = '';
    const sorted = state.todos.slice().sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.text.localeCompare(b.text);
    });

    if (!sorted.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No quick tasks yet. Add a tiny step.';
      list.appendChild(p);
    }

    sorted.forEach(todo => {
      const row = document.createElement('div');
      row.className = 'todo' + (todo.completed ? ' completed' : '');
      const left = document.createElement('div');
      left.className = 'left';
      left.innerHTML = `<div class="todo-title">${todo.text}</div><div class="todo-meta">${todo.dueDate ? `Due ${todo.dueDate}` : 'Flexible'}${todo.completedDate ? ` · done ${todo.completedDate}` : ''}</div>`;
      const actions = document.createElement('div');
      actions.className = 'actions';
      const toggle = document.createElement('button');
      toggle.className = 'ghost';
      toggle.textContent = todo.completed ? 'Undo' : 'Done';
      toggle.addEventListener('click', () => toggleTodo(todo.id));
      const remove = document.createElement('button');
      remove.className = 'ghost';
      remove.textContent = '✕';
      remove.addEventListener('click', () => removeTodo(todo.id));
      actions.appendChild(toggle);
      actions.appendChild(remove);
      row.appendChild(left);
      row.appendChild(actions);
      list.appendChild(row);
    });

    const countLabel = qs('#todo-today-count');
    const dueToday = state.todos.filter(t => !t.completed && (t.dueDate === cachedToday || !t.dueDate)).length;
    if (countLabel) countLabel.textContent = `${dueToday} tasks ready for today`;
  };

  const toggleTodo = (id) => {
    state.todos = state.todos.map(todo => {
      if (todo.id !== id) return todo;
      const dateRef = todo.dueDate || cachedToday;
      const record = ensureRecord(dateRef);
      if (todo.completed) {
        record.todoCount = Math.max(0, (record.todoCount || 0) - 1);
        return { ...todo, completed: false, completedDate: '' };
      }
      record.todoCount = (record.todoCount || 0) + 1;
      return { ...todo, completed: true, completedDate: dateRef };
    });
    persist();
    render();
  };

  const removeTodo = (id) => {
    const todo = state.todos.find(t => t.id === id);
    if (todo?.completed) {
      const record = ensureRecord(todo.completedDate || cachedToday);
      record.todoCount = Math.max(0, (record.todoCount || 0) - 1);
    }
    state.todos = state.todos.filter(t => t.id !== id);
    persist();
    render();
  };

  const clearCompleted = () => {
    state.todos.forEach(todo => {
      if (todo.completed && todo.completedDate) {
        const record = ensureRecord(todo.completedDate);
        record.todoCount = Math.max(0, (record.todoCount || 0) - 1);
      }
    });
    state.todos = state.todos.filter(t => !t.completed);
    persist();
    render();
  };

  const renderSnapshot = () => {
    const stats = metrics();
    const list = qs('#stat-list');
    if (!list) return;
    list.innerHTML = '';
    const entries = [
      { label: 'Percent complete', value: `${stats.percent}%`, detail: `${stats.completed}/${stats.totalTargets || 0} steps` },
      { label: 'Active goals', value: stats.goalCount, detail: 'scheduled today' },
      { label: 'Year total', value: stats.yearCount, detail: 'actions logged' },
      { label: 'Streak', value: `${stats.streak} days`, detail: 'keep it alive' }
    ];
    entries.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="label">${item.label}</div><div class="value">${item.value}</div><div class="muted">${item.detail}</div>`;
      list.appendChild(li);
    });
  };

  const renderWeeklyGraphic = () => {
    const container = qs('#week-graphic');
    if (!container) return;
    container.innerHTML = '';
    const { data } = summarizeRange(7);
    if (!data.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'Add goals or tasks to see the weekly action map.';
      container.appendChild(p);
      return;
    }
    const max = Math.max(...data.map(d => Math.max(d.done, d.target)), 1);
    data.forEach(entry => {
      const col = document.createElement('div');
      col.className = 'week-column';
      const label = document.createElement('div');
      label.className = 'week-label';
      label.textContent = new Date(entry.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
      const bar = document.createElement('div');
      bar.className = 'week-bar';
      const fill = document.createElement('div');
      fill.className = 'week-fill';
      fill.style.height = `${Math.max(8, Math.round((entry.done / max) * 100))}%`;
      bar.appendChild(fill);
      const micro = document.createElement('div');
      micro.className = 'week-micro';
      micro.textContent = `${entry.done} actions`;
      col.append(label, bar, micro);
      container.appendChild(col);
    });
  };

  const renderInsights = () => {
    const wrap = qs('#insight-cards');
    if (!wrap) return;
    const horizon = summarizeRange(30);
    const thisWeek = summarizeRange(7);
    const todayStats = metrics();
    wrap.innerHTML = '';
    const items = [
      { label: 'Avg completion (30d)', value: `${horizon.averageCompletion}%`, detail: `${horizon.averageActions} actions/day` },
      { label: 'Longest streak', value: `${computeStreak()} days`, detail: 'current + historical' },
      { label: 'Best day (30d)', value: horizon.bestDay || '—', detail: `${horizon.bestTotal} actions` },
      { label: 'This week', value: `${thisWeek.totalActions} actions`, detail: 'goal + todo' },
      { label: 'Active goals', value: todayStats.goalCount, detail: 'scheduled today' },
      { label: 'Todo momentum', value: thisWeek.todoActions, detail: 'tasks shipped in 7d' }
    ];
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'insight-card';
      card.innerHTML = `<div class="label">${item.label}</div><div class="value">${item.value}</div><div class="detail">${item.detail}</div>`;
      wrap.appendChild(card);
    });
  };

  const renderBreaks = () => {
    const list = qs('#break-list');
    const empty = qs('#break-empty');
    if (!list) return;
    list.innerHTML = '';
    if (timerId) clearInterval(timerId);

    if (!state.breaks.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    state.breaks.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach(item => {
      const row = document.createElement('div');
      row.className = 'break-row';
      row.innerHTML = `<div class="left"><strong>${item.name}</strong><div class="muted">since ${item.startDate}</div></div><div class="badge" data-start="${item.startDate}"></div>`;
      list.appendChild(row);
    });

    updateTimers();
    timerId = setInterval(updateTimers, 1000);
  };

  const renderJournals = () => {
    const list = qs('#journal-list');
    const dateInput = qs('#journal-date');
    if (dateInput && !dateInput.value) dateInput.value = cachedToday;
    if (!list) return;
    const query = (qs('#journal-search')?.value || '').toLowerCase();
    list.innerHTML = '';
    const entries = state.logs.slice().sort((a, b) => b.date.localeCompare(a.date));
    const filtered = entries.filter(e =>
      e.text.toLowerCase().includes(query) || (e.title || '').toLowerCase().includes(query)
    );
    if (!filtered.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = query ? 'No entries match your search.' : 'Log how the day went and reflect.';
      list.appendChild(p);
      return;
    }
    filtered.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'journal-entry';
      const head = document.createElement('div');
      head.className = 'entry-head';
      head.innerHTML = `<div><strong>${entry.title || 'Day log'}</strong><div class="entry-meta">${entry.date}</div></div>`;
      const remove = document.createElement('button');
      remove.className = 'ghost';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => removeJournal(entry.id));
      head.appendChild(remove);
      const body = document.createElement('div');
      body.textContent = entry.text;
      row.append(head, body);
      list.appendChild(row);
    });
  };

  const renderDreams = () => {
    const list = qs('#dream-list');
    const dateInput = qs('#dream-date');
    if (dateInput && !dateInput.value) dateInput.value = cachedToday;
    if (!list) return;
    const query = (qs('#dream-search')?.value || '').toLowerCase();
    list.innerHTML = '';
    const entries = state.dreams.slice().sort((a, b) => b.date.localeCompare(a.date));
    const filtered = entries.filter(e =>
      e.text.toLowerCase().includes(query) || (e.title || '').toLowerCase().includes(query)
    );
    if (!filtered.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = query ? 'No dreams match your search.' : 'Capture morning memories before they fade.';
      list.appendChild(p);
      return;
    }
    filtered.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'dream-entry';
      const head = document.createElement('div');
      head.className = 'entry-head';
      head.innerHTML = `<div><strong>${entry.title || 'Dream'}</strong><div class="entry-meta">${entry.date}</div></div>`;
      const remove = document.createElement('button');
      remove.className = 'ghost';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => removeDream(entry.id));
      head.appendChild(remove);
      const body = document.createElement('div');
      body.textContent = entry.text;
      row.append(head, body);
      list.appendChild(row);
    });
  };

  const updateTimers = () => {
    const now = Date.now();
    qsa('[data-start]').forEach(el => {
      const start = new Date(el.dataset.start + 'T00:00:00').getTime();
      const diff = Math.max(0, now - start);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      el.textContent = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    });
  };

  const renderGoalsPage = () => {
    const list = qs('#goal-list');
    const empty = qs('#goal-empty');
    if (!list) return;
    list.innerHTML = '';
    const items = state.goals.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!items.length && empty) empty.style.display = 'block'; else if (empty) empty.style.display = 'none';

    items.forEach(goal => {
      const row = document.createElement('div');
      row.className = 'goal-row';
      row.innerHTML = `
        <div class="left">
          <strong>${goal.name}</strong>
          <div class="meta">${humanFrequency(goal)} · Target ${goal.target}${goal.group ? ` · ${goal.group}` : ''}</div>
        </div>
        <div class="actions">
          <button class="ghost" aria-label="Archive">${goal.archived ? 'Unarchive' : 'Archive'}</button>
          <button class="ghost" aria-label="Delete">Delete</button>
        </div>`;
      const [archiveBtn, delBtn] = row.querySelectorAll('button');
      archiveBtn.addEventListener('click', () => toggleArchive(goal.id));
      delBtn.addEventListener('click', () => removeGoal(goal.id));
      list.appendChild(row);
    });

    const manage = qs('#break-manage');
    const manageEmpty = qs('#break-manage-empty');
    if (manage) manage.innerHTML = '';
    if (!state.breaks.length && manageEmpty) manageEmpty.style.display = 'block';
    if (state.breaks.length && manageEmpty) manageEmpty.style.display = 'none';
    state.breaks.forEach(item => {
      const row = document.createElement('div');
      row.className = 'goal-row';
      row.innerHTML = `<div class="left"><strong>${item.name}</strong><div class="meta">since ${item.startDate}</div></div><button class="ghost">Remove</button>`;
      row.querySelector('button').addEventListener('click', () => removeBreak(item.id));
      manage?.appendChild(row);
    });
  };

  const toggleArchive = (id) => {
    const date = cachedToday;
    state.goals = state.goals.map(g => g.id === id ? { ...g, archived: !g.archived, archivedDate: g.archived ? undefined : date } : g);
    persist();
    render();
  };

  const removeGoal = (id) => {
    state.goals = state.goals.filter(g => g.id !== id);
    Object.values(state.completions).forEach(r => delete r.goals?.[id]);
    persist();
    render();
  };

  const renderHistory = () => {
    const container = qs('#history-matrix');
    if (!container) return;
    container.innerHTML = '';
    if (!state.goals.length) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.textContent = 'No goals defined yet.';
      container.appendChild(p);
      return;
    }

    const dates = datesFromYearStart();
    const table = document.createElement('table');
    table.className = 'history-table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    const empty = document.createElement('th');
    empty.className = 'left';
    empty.textContent = 'Goal';
    headRow.appendChild(empty);
    dates.forEach(d => {
      const th = document.createElement('th');
      th.textContent = new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    state.goals.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach(goal => {
      const row = document.createElement('tr');
      const left = document.createElement('td');
      left.className = 'left';
      left.innerHTML = `<strong>${goal.name}</strong><div class="muted">${goal.createdDate}${goal.archived ? ' · archived' : ''}</div>`;
      row.appendChild(left);
      dates.forEach(date => {
        const cell = document.createElement('td');
        const applicable = isGoalDue(goal, date);
        if (!applicable) cell.className = 'idle';
        else {
          const record = state.completions[date];
          const done = (record?.goals?.[goal.id] || 0) >= (goal.target || 1);
          cell.className = done ? 'done' : 'miss';
          cell.textContent = done ? '•' : '';
        }
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  };

  const datesFromYearStart = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const out = [];
    while (start <= now) {
      out.push(toISO(start));
      start.setDate(start.getDate() + 1);
    }
    return out;
  };

  const renderAnalytics = () => {
    const range = Number(qs('#analytics-range')?.value || 7);
    const summaryData = summarizeRange(range);
    const data = summaryData.data;
    const summary = qs('#analytics-summary');
    if (summary) {
      summary.innerHTML = '';
      const items = [
        { label: 'Average completion', value: `${summaryData.averageCompletion}%` },
        { label: 'Longest streak', value: `${summaryData.longest} days` },
        { label: 'Best day', value: summaryData.bestDay || '—' },
        { label: 'Goals defined', value: state.goals.length }
      ];
      items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<div class="label">${item.label}</div><div class="value">${item.value}</div>`;
        summary.appendChild(card);
      });
    }

    const canvas = qs('#bar-chart');
    if (canvas?.getContext) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const max = Math.max(...data.map(d => d.done), 1);
      const barWidth = canvas.width / Math.max(data.length, 1);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent');
      data.forEach((entry, index) => {
        const height = (entry.done / max) * (canvas.height - 20);
        ctx.fillRect(index * barWidth, canvas.height - height, barWidth - 4, height);
      });
    }
  };

  const exportCsv = () => {
    const rows = [['Date', 'Goal ID', 'Goal count', 'Todos']];
    Object.entries(state.completions).forEach(([date, rec]) => {
      const goals = rec.goals || {};
      if (!Object.keys(goals).length) rows.push([date, '', 0, rec.todoCount || 0]);
      Object.entries(goals).forEach(([id, count]) => rows.push([date, id, count, rec.todoCount || 0]));
    });
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'habits.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // forms and nav
  const bindEvents = () => {
    qsa('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.target;
        activePage = target;
        qsa('.tab').forEach(t => t.classList.toggle('active', t === tab));
        qsa('.page').forEach(page => page.classList.toggle('hidden', page.id !== target));
        render();
      });
    });

    qs('#nudge-add-goal')?.addEventListener('click', () => {
      document.querySelector('.tab[data-target="goals"]')?.click();
      qs('#goal-input')?.focus();
    });
    qs('#open-quit')?.addEventListener('click', () => document.querySelector('.tab[data-target="goals"]')?.click());

    qs('#theme-select')?.addEventListener('change', (e) => setTheme(e.target.value));
    qs('#accent-picker')?.addEventListener('input', (e) => setAccent(e.target.value));

    qs('#goal-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = qs('#goal-input').value.trim();
      if (!name) return;
      const group = qs('#goal-group').value.trim();
      const target = Number(qs('#goal-target').value || 1);
      const frequency = qs('#goal-frequency').value;
      const times = Number(qs('#goal-times').value || 3);
      const days = qsa('#goal-days input:checked').map(c => Number(c.value));
      state.goals.push({
        id: randomId(),
        name,
        group,
        target: Math.max(1, target),
        frequency,
        times,
        days,
        createdDate: cachedToday,
        archived: false,
        order: state.goals.length
      });
      persist();
      e.target.reset();
      render();
    });

    qs('#todo-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = qs('#todo-input').value.trim();
      const due = qs('#todo-due').value;
      if (!text) return;
      state.todos.push({ id: randomId(), text, dueDate: due, completed: false, completedDate: '' });
      persist();
      e.target.reset();
      render();
    });

    qs('#clear-completed')?.addEventListener('click', clearCompleted);

    qs('#break-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = qs('#break-input').value.trim();
      const start = qs('#break-start').value || cachedToday;
      if (!name) return;
      state.breaks.push({ id: randomId(), name, startDate: start });
      persist();
      e.target.reset();
      qs('#break-start').value = cachedToday;
      render();
    });

    qs('#analytics-range')?.addEventListener('change', renderAnalytics);
    qs('#export-csv')?.addEventListener('click', exportCsv);

    qs('#journal-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = qs('#journal-text').value.trim();
      if (!text) return;
      const date = qs('#journal-date').value || cachedToday;
      const title = qs('#journal-title').value.trim();
      state.logs.push({ id: randomId(), date, title, text });
      persist();
      e.target.reset();
      qs('#journal-date').value = date;
      renderJournals();
    });
    qs('#journal-search')?.addEventListener('input', renderJournals);

    qs('#dream-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = qs('#dream-text').value.trim();
      if (!text) return;
      const date = qs('#dream-date').value || cachedToday;
      const title = qs('#dream-title').value.trim();
      state.dreams.push({ id: randomId(), date, title, text });
      persist();
      e.target.reset();
      qs('#dream-date').value = date;
      renderDreams();
    });
    qs('#dream-search')?.addEventListener('input', renderDreams);
  };

  const removeBreak = (id) => {
    state.breaks = state.breaks.filter(b => b.id !== id);
    persist();
    render();
  };

  const removeJournal = (id) => {
    state.logs = state.logs.filter(entry => entry.id !== id);
    persist();
    renderJournals();
  };

  const removeDream = (id) => {
    state.dreams = state.dreams.filter(entry => entry.id !== id);
    persist();
    renderDreams();
  };

  const refreshDay = () => {
    const now = today();
    if (now !== cachedToday) {
      cachedToday = now;
      render();
    }
  };

  // bootstrap
  qs('#break-start')?.setAttribute('value', cachedToday);
  bindEvents();
  render();
  setInterval(refreshDay, 60000);
})();
