const STORAGE_KEYS = {
  goals: 'habitGoals',
  completions: 'habitCompletions',
  todos: 'habitTodos',
  theme: 'habitTheme',
  accent: 'habitAccent'
};

const quotes = [
  'Small steps stack into big wins.',
  'Consistency beats intensity.',
  'Progress, not perfection.',
  'Show up, even briefly.',
  'Momentum begins with one action.',
  'Today is a great day to move forward.'
];

const audioContext = window.AudioContext ? new AudioContext() : null;

let today = getToday();
let goals = loadGoals();
let completions = loadCompletions();
let todos = loadTodos();

syncTodoCounts();

applySavedTheme();
initNavigation();
initThemeControls();
renderHome();
renderGoalsPage();
renderHistory();
setInterval(refreshToday, 60000);

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function refreshToday() {
  const current = getToday();
  if (current !== today) {
    today = current;
    renderHome();
    renderHistory();
  }
}

function loadGoals() {
  const stored = localStorage.getItem(STORAGE_KEYS.goals);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return parsed.map((goal, index) => ({
      ...goal,
      nameHistory: goal.nameHistory || [{ name: goal.name, from: goal.createdDate }],
      order: typeof goal.order === 'number' ? goal.order : index,
      target: goal.target || 1,
      frequency: goal.frequency || 'daily',
      times: goal.times || 3
    }));
  } catch {
    return [];
  }
}

function loadCompletions() {
  const stored = localStorage.getItem(STORAGE_KEYS.completions);
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    Object.values(parsed).forEach(record => {
      Object.entries(record.goalStatuses || {}).forEach(([id, value]) => {
        if (value === true) record.goalStatuses[id] = 1;
        if (value === false) record.goalStatuses[id] = 0;
      });
    });
    return parsed;
  } catch {
    return {};
  }
}

function loadTodos() {
  const stored = localStorage.getItem(STORAGE_KEYS.todos);
  if (!stored) return [];
  try {
    const todayStr = getToday();
    return JSON.parse(stored).map(todo => ({
      id: todo.id || generateId(),
      text: todo.text || 'Untitled task',
      dueDate: todo.dueDate || '',
      completed: !!todo.completed,
      completedDate: todo.completedDate || (todo.completed ? (todo.completedDate || todayStr) : '')
    }));
  } catch {
    return [];
  }
}

function saveGoals() {
  localStorage.setItem(STORAGE_KEYS.goals, JSON.stringify(goals));
}

function saveCompletions() {
  localStorage.setItem(STORAGE_KEYS.completions, JSON.stringify(completions));
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(todos));
}

function ensureDailyRecord(date) {
  if (!completions[date]) {
    completions[date] = { goalStatuses: {}, todoCount: 0 };
  }
  return completions[date];
}

function generateId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function initNavigation() {
  const links = document.querySelectorAll('.nav-link');
  links.forEach(link => {
    link.addEventListener('click', () => {
      const target = link.dataset.target;
      document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('hidden', page.id !== target);
      });
      links.forEach(btn => btn.classList.toggle('active', btn === link));
    });
  });
  const initialLink = document.querySelector('.nav-link[data-target="home"]');
  if (initialLink) initialLink.classList.add('active');
}

function initThemeControls() {
  const themeSelect = document.getElementById('theme-select');
  const accentPicker = document.getElementById('accent-picker');
  if (!themeSelect || !accentPicker) return;
  themeSelect.addEventListener('change', () => {
    setTheme(themeSelect.value);
  });
  accentPicker.addEventListener('input', () => {
    setAccent(accentPicker.value);
  });
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
  const savedAccent = localStorage.getItem(STORAGE_KEYS.accent) || '#22d3ee';
  setTheme(savedTheme, false);
  setAccent(savedAccent, false);
  const themeSelect = document.getElementById('theme-select');
  const accentPicker = document.getElementById('accent-picker');
  if (themeSelect) themeSelect.value = savedTheme;
  if (accentPicker) accentPicker.value = savedAccent;
}

function setTheme(theme, persist = true) {
  document.documentElement.setAttribute('data-theme', theme);
  if (persist) localStorage.setItem(STORAGE_KEYS.theme, theme);
  renderSnapshot();
}

function setAccent(color, persist = true) {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--filled', color);
  if (persist) localStorage.setItem(STORAGE_KEYS.accent, color);
  renderSnapshot();
}

function renderHome() {
  const todayLabel = document.getElementById('today-label');
  todayLabel.textContent = new Date().toDateString();

  const activeGoals = getGoalsForDate(today);
  const grid = document.getElementById('daily-goal-grid');
  grid.innerHTML = '';

  const record = ensureDailyRecord(today);
  const completedCount = activeGoals.filter(goal => (record.goalStatuses[goal.id] || 0) >= (goal.target || 1)).length;
  const goalSummary = document.getElementById('goal-summary');
  if (activeGoals.length === 0) {
    document.getElementById('no-goals-message').style.display = 'block';
    goalSummary.textContent = '';
  } else {
    document.getElementById('no-goals-message').style.display = 'none';
    goalSummary.textContent = `${completedCount} / ${activeGoals.length} goals completed today`;
  }

  const grouped = groupGoals(activeGoals);
  Object.entries(grouped).forEach(([groupName, items]) => {
    if (groupName) {
      const heading = document.createElement('div');
      heading.className = 'group-heading';
      heading.textContent = groupName;
      grid.appendChild(heading);
    }
    items.forEach(goal => {
      const square = document.createElement('div');
      const doneCount = record.goalStatuses[goal.id] || 0;
      const done = doneCount >= (goal.target || 1);
      square.className = 'square' + (done ? ' completed' : '');
      square.dataset.goalId = goal.id;
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = getGoalNameForDate(goal, today);
      const targetLabel = document.createElement('div');
      targetLabel.className = 'meta';
      targetLabel.textContent = `Target ${goal.target || 1} · ${describeFrequency(goal)}`;
      square.appendChild(label);
      square.appendChild(targetLabel);
      if (!done) {
        square.addEventListener('click', () => {
          markGoalComplete(goal.id);
        });
      }
      grid.appendChild(square);
    });
  });

  const metrics = calculateMetrics();
  document.getElementById('today-count').textContent = metrics.today;
  document.getElementById('year-count').textContent = metrics.year;
  document.getElementById('streak-count').textContent = metrics.streak;
  renderProgressBar();
  renderTodos();
  renderQuoteAndXp(metrics);
  renderSnapshot(metrics);
}

function calculateMetrics() {
  const todayRecord = ensureDailyRecord(today);
  const todayTotal = Object.values(todayRecord.goalStatuses).reduce((sum, val) => sum + (val || 0), 0) + (todayRecord.todoCount || 0);
  const currentYear = new Date().getFullYear();
  let yearTotal = 0;
  let streak = 0;
  let dateCursor = new Date(today + 'T00:00:00');
  const goalCount = getGoalsForDate(today).length;

  Object.entries(completions).forEach(([date, record]) => {
    if (!date.startsWith(String(currentYear))) return;
    const goalsCompleted = Object.values(record.goalStatuses || {}).reduce((sum, val) => sum + (val || 0), 0);
    yearTotal += goalsCompleted + (record.todoCount || 0);
  });

  while (true) {
    const dateStr = formatDate(dateCursor);
    const applicableGoals = getGoalsForDate(dateStr);
    const record = completions[dateStr];
    const allDone = applicableGoals.length === 0 || (record && applicableGoals.every(g => (record.goalStatuses?.[g.id] || 0) >= (g.target || 1)));
    if (!allDone) break;
    streak += 1;
    dateCursor.setDate(dateCursor.getDate() - 1);
  }

  return { today: todayTotal, year: yearTotal, streak, goalCount };
}

function markGoalComplete(goalId) {
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return;
  const record = ensureDailyRecord(today);
  const current = record.goalStatuses[goalId] || 0;
  if (current >= (goal.target || 1)) return;
  record.goalStatuses[goalId] = current + 1;
  completions[today] = record;
  saveCompletions();
  renderHome();
  renderHistory();
  playChime();
  triggerVibration();
  if (isDayComplete(record)) {
    showConfetti();
  }
}

function renderGoalsPage() {
  const goalList = document.getElementById('goal-list');
  goalList.innerHTML = '';
  const sortedGoals = [...goals].sort((a, b) => a.order - b.order);

  sortedGoals.forEach(goal => {
    const li = document.createElement('li');
    li.className = 'goal-row';
    li.draggable = true;
    li.dataset.id = goal.id;

    const nameInput = document.createElement('input');
    nameInput.value = goal.name;
    nameInput.disabled = goal.archived;
    nameInput.addEventListener('change', (e) => {
      const newName = e.target.value.trim();
      if (!newName || newName === goal.name) return;
      renameGoal(goal.id, newName);
    });

    const meta = document.createElement('div');
    meta.className = 'meta';
    const freqLabel = describeFrequency(goal);
    meta.textContent = `${goal.archived ? 'Archived' : 'Active'} · ${freqLabel} · Target ${goal.target || 1}`;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.marginLeft = 'auto';

    if (!goal.archived) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'goal-action';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => archiveGoal(goal.id));
      actions.appendChild(deleteBtn);
    }

    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '↕';

    li.appendChild(dragHandle);
    li.appendChild(nameInput);
    li.appendChild(meta);
    li.appendChild(actions);
    goalList.appendChild(li);
  });

  enableGoalDrag(goalList);
}

function describeFrequency(goal) {
  switch (goal.frequency) {
    case 'weekdays':
      return 'Weekdays';
    case 'custom':
      return `Days: ${goal.days?.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ') || 'None'}`;
    case 'week':
      return `${goal.times || 3}× / week`;
    case 'month':
      return `${goal.times || 10}× / month`;
    default:
      return 'Daily';
  }
}

function enableGoalDrag(list) {
  let dragging;
  list.querySelectorAll('.goal-row').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      dragging = row;
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = e.currentTarget;
      if (dragging === target) return;
      const rect = target.getBoundingClientRect();
      const shouldSwap = (e.clientY - rect.top) / rect.height > 0.5;
      if (shouldSwap) {
        target.insertAdjacentElement('afterend', dragging);
      } else {
        target.insertAdjacentElement('beforebegin', dragging);
      }
    });
    row.addEventListener('dragend', () => {
      persistGoalOrder(list);
    });
  });
}

function persistGoalOrder(list) {
  const ids = Array.from(list.children).map(li => li.dataset.id);
  goals = goals.map(goal => ({ ...goal, order: ids.indexOf(goal.id) }));
  saveGoals();
}

function renameGoal(goalId, newName) {
  goals = goals.map(goal => {
    if (goal.id !== goalId) return goal;
    const history = goal.nameHistory || [{ name: goal.name, from: goal.createdDate }];
    history.push({ name: newName, from: today });
    return { ...goal, name: newName, nameHistory: history };
  });
  saveGoals();
  renderHome();
  renderHistory();
  renderGoalsPage();
}

function archiveGoal(goalId) {
  goals = goals.map(goal => goal.id === goalId ? { ...goal, archived: true, archivedDate: today } : goal);
  saveGoals();
  renderHome();
  renderHistory();
  renderGoalsPage();
}

function addGoal(name) {
  const id = generateId();
  const createdDate = today;
  const frequency = document.getElementById('goal-frequency')?.value || 'daily';
  const days = Array.from(document.querySelectorAll('#goal-days input:checked')).map(c => Number(c.value));
  const times = Number(document.getElementById('goal-times')?.value || 3);
  const target = Number(document.getElementById('goal-target')?.value || 1);
  const group = document.getElementById('goal-group')?.value || '';
  const goal = {
    id,
    name,
    createdDate,
    archived: false,
    nameHistory: [{ name, from: createdDate }],
    frequency,
    days,
    times,
    target,
    group,
    order: goals.length
  };
  goals.push(goal);
  const record = ensureDailyRecord(today);
  record.goalStatuses[id] = record.goalStatuses[id] || 0;
  completions[today] = record;
  saveCompletions();
  saveGoals();
  renderHome();
  renderHistory();
  renderGoalsPage();
}

function syncTodoCounts() {
  const countByDate = {};
  todos.forEach(todo => {
    if (todo.completed && todo.completedDate) {
      countByDate[todo.completedDate] = (countByDate[todo.completedDate] || 0) + 1;
    }
  });
  Object.entries(countByDate).forEach(([date, count]) => {
    const record = ensureDailyRecord(date);
    record.todoCount = count;
    completions[date] = record;
  });
  Object.keys(completions).forEach(date => {
    if (!countByDate[date]) {
      completions[date].todoCount = 0;
    }
  });
  saveCompletions();
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  if (!list) return;
  list.innerHTML = '';

  const sorted = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.text.localeCompare(b.text);
  });

  if (sorted.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'subtle';
    empty.textContent = 'No tasks yet. Add a quick win to keep momentum.';
    list.appendChild(empty);
  }

  sorted.forEach(todo => {
    const card = document.createElement('div');
    card.className = 'todo-card' + (todo.completed ? ' completed' : '');

    const label = document.createElement('label');
    label.className = 'todo-label';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(todo.id, checkbox.checked));

    const textWrap = document.createElement('div');
    const title = document.createElement('div');
    title.className = 'todo-title';
    title.textContent = todo.text;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const due = todo.dueDate ? `Due ${todo.dueDate}` : 'Flexible';
    meta.textContent = due + (todo.completedDate ? ` · done ${todo.completedDate}` : '');
    textWrap.appendChild(title);
    textWrap.appendChild(meta);

    label.appendChild(checkbox);
    label.appendChild(textWrap);

    const remove = document.createElement('button');
    remove.className = 'ghost';
    remove.setAttribute('aria-label', 'Remove task');
    remove.textContent = '✕';
    remove.addEventListener('click', () => removeTodo(todo.id));

    card.appendChild(label);
    card.appendChild(remove);
    list.appendChild(card);
  });

  const dueToday = todos.filter(t => !t.completed && (t.dueDate === today || !t.dueDate)).length;
  const countLabel = document.getElementById('todo-today-count');
  if (countLabel) countLabel.textContent = `${dueToday} tasks ready for today`;
}

function toggleTodo(id, done) {
  const target = todos.find(todo => todo.id === id);
  const completionDate = target?.dueDate || today;
  todos = todos.map(todo => {
    if (todo.id !== id) return todo;
    return done
      ? { ...todo, completed: true, completedDate: completionDate }
      : { ...todo, completed: false, completedDate: '' };
  });
  syncTodoCounts();
  saveTodos();
  renderHome();
  renderHistory();
  renderTodos();
  renderSnapshot();
  if (done) {
    playChime();
  }
}

function removeTodo(id) {
  todos = todos.filter(todo => todo.id !== id);
  saveTodos();
  syncTodoCounts();
  renderHome();
  renderHistory();
  renderTodos();
  renderSnapshot();
}

function clearCompletedTodos() {
  todos = todos.filter(todo => !todo.completed);
  saveTodos();
  syncTodoCounts();
  renderHome();
  renderHistory();
  renderTodos();
}

function renderHistory() {
  const container = document.getElementById('history-matrix');
  container.innerHTML = '';
  const allGoals = [...goals].sort((a, b) => a.order - b.order);
  if (allGoals.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'subtle';
    empty.textContent = 'No goals defined yet.';
    container.appendChild(empty);
    return;
  }

  const dates = getDatesFromYearStart();
  const table = document.createElement('table');
  table.className = 'history-table';

  const headerRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'sticky';
  corner.textContent = '';
  headerRow.appendChild(corner);

  dates.forEach(date => {
    const th = document.createElement('th');
    th.className = 'date-header';
    const dateObj = new Date(date + 'T00:00:00');
    th.textContent = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
    th.title = date;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  allGoals.forEach(goal => {
    const row = document.createElement('tr');
    const sticky = document.createElement('th');
    sticky.className = 'sticky';
    const currentName = getGoalNameForDate(goal, today);
    sticky.innerHTML = `<div class="name">${currentName}</div><div class="meta">since ${goal.createdDate}${goal.archived ? ' · archived' : ''}</div>`;
    row.appendChild(sticky);

    dates.forEach(date => {
      const td = document.createElement('td');
      td.className = 'square-cell';
      const archived = goal.archivedDate && date >= goal.archivedDate;
      if (date < goal.createdDate || archived || !isGoalDue(goal, date)) {
        td.classList.add('inactive');
      } else {
        const record = completions[date];
        const doneCount = record?.goalStatuses?.[goal.id] || 0;
        const done = doneCount >= (goal.target || 1);
        td.classList.add(done ? 'completed' : 'empty');
      }
      td.title = getGoalNameForDate(goal, date);
      row.appendChild(td);
    });
    table.appendChild(row);
  });

  container.appendChild(table);

  const legend = document.createElement('div');
  legend.className = 'history-legend';
  legend.innerHTML = `
    <div><span class="swatch completed"></span> Completed</div>
    <div><span class="swatch empty"></span> Missed</div>
    <div><span class="swatch inactive"></span> Not applicable</div>
  `;
  container.appendChild(legend);
}

function getDatesFromYearStart() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dates = [];
  while (start <= now) {
    dates.push(formatDate(start));
    start.setDate(start.getDate() + 1);
  }
  return dates;
}

function formatDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getGoalNameForDate(goal, date) {
  const history = (goal.nameHistory && goal.nameHistory.length ? [...goal.nameHistory] : [{ name: goal.name, from: goal.createdDate }])
    .sort((a, b) => a.from.localeCompare(b.from));
  let name = history[0].name;
  history.forEach(entry => {
    if (entry.from <= date) name = entry.name;
  });
  return name;
}

function renderAnalytics() {
  const range = Number(document.getElementById('analytics-range')?.value || 7);
  const end = new Date(today + 'T00:00:00');
  const start = new Date(today + 'T00:00:00');
  start.setDate(end.getDate() - (range - 1));
  const data = [];
  let longestStreak = 0;
  let currentStreak = 0;
  let totalCompletion = 0;
  let totalDays = 0;
  let bestDay = '';
  let bestCount = 0;
  let cursor = new Date(start);
  while (cursor <= end) {
    const dateStr = formatDate(cursor);
    const record = completions[dateStr] || {};
    const goalsDue = getGoalsForDate(dateStr);
    const goalsCompleted = goalsDue.reduce((sum, g) => sum + Math.min(record.goalStatuses?.[g.id] || 0, g.target || 1), 0);
    const goalTarget = goalsDue.reduce((sum, g) => sum + (g.target || 1), 0);
    const todosCompleted = record.todoCount || 0;
    const total = goalsCompleted + todosCompleted;
    data.push({ date: dateStr, total, goalTarget });
    if (goalTarget === 0 || goalsCompleted >= goalTarget) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
    totalCompletion += goalTarget ? (goalsCompleted / goalTarget) : 1;
    totalDays += 1;
    if (total > bestCount) {
      bestCount = total;
      bestDay = dateStr;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const summary = document.getElementById('analytics-summary');
  if (summary) {
    summary.innerHTML = '';
    const items = [
      `Average completion: ${(totalCompletion / totalDays * 100).toFixed(0)}%`,
      `Longest streak: ${longestStreak} days`,
      `Best day: ${bestDay || 'N/A'} (${bestCount} actions)`,
      `Goals defined: ${goals.length}`
    ];
    items.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      summary.appendChild(li);
    });
  }

  const canvas = document.getElementById('bar-chart');
  if (canvas?.getContext) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const max = Math.max(...data.map(d => d.total), 1);
    const barWidth = canvas.width / Math.max(data.length, 1);
    data.forEach((entry, index) => {
      const height = (entry.total / max) * (canvas.height - 20);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#22d3ee';
      ctx.fillRect(index * barWidth, canvas.height - height, barWidth - 4, height);
    });
  }
}

function downloadCsv() {
  const rows = [['Date', 'Goal ID', 'Goal count', 'Todos']];
  Object.entries(completions).forEach(([date, record]) => {
    Object.entries(record.goalStatuses || {}).forEach(([goalId, count]) => {
      rows.push([date, goalId, count, record.todoCount || 0]);
    });
    if (!record.goalStatuses || Object.keys(record.goalStatuses).length === 0) {
      rows.push([date, '', 0, record.todoCount || 0]);
    }
  });
  const csv = rows.map(r => r.join(',')).join('\\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'habits.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function groupGoals(list) {
  return list.reduce((acc, goal) => {
    const key = goal.group || '';
    acc[key] = acc[key] || [];
    acc[key].push(goal);
    return acc;
  }, {});
}

function getGoalsForDate(dateStr) {
  return goals
    .filter(goal => !goal.archived)
    .filter(goal => isGoalDue(goal, dateStr))
    .sort((a, b) => a.order - b.order);
}

function isGoalDue(goal, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.getDay();
  if (goal.archived && dateStr >= goal.archivedDate) return false;
  if (dateStr < goal.createdDate) return false;
  switch (goal.frequency) {
    case 'weekdays':
      return day >= 1 && day <= 5;
    case 'custom':
      return goal.days?.includes(day);
    case 'week': {
      const { start } = getRange(dateStr, 'week');
      const completed = countGoalCompletions(goal.id, start, dateStr);
      return completed < (goal.times || 3);
    }
    case 'month': {
      const { start } = getRange(dateStr, 'month');
      const completed = countGoalCompletions(goal.id, start, dateStr);
      return completed < (goal.times || 10);
    }
    default:
      return true;
  }
}

function getRange(dateStr, type) {
  const date = new Date(dateStr + 'T00:00:00');
  if (type === 'week') {
    const diff = (date.getDay() + 6) % 7;
    const start = new Date(date);
    start.setDate(date.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatDate(start), end: formatDate(end) };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: formatDate(start), end: formatDate(end) };
}

function countGoalCompletions(goalId, start, end) {
  let cursor = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  let total = 0;
  while (cursor <= endDate) {
    const dateStr = formatDate(cursor);
    const record = completions[dateStr];
    total += record?.goalStatuses?.[goalId] || 0;
    cursor.setDate(cursor.getDate() + 1);
  }
  return total;
}

function isDayComplete(record) {
  const dueGoals = getGoalsForDate(today);
  return dueGoals.every(goal => (record.goalStatuses[goal.id] || 0) >= (goal.target || 1));
}

function getProgressDetails() {
  const bar = document.getElementById('progress-bar');
  const record = ensureDailyRecord(today);
  const goalsDue = getGoalsForDate(today);
  const totalTargets = goalsDue.reduce((sum, g) => sum + (g.target || 1), 0);
  const completed = goalsDue.reduce((sum, g) => sum + Math.min(record.goalStatuses[g.id] || 0, g.target || 1), 0);
  const percent = totalTargets === 0 ? 0 : Math.min(100, Math.round((completed / totalTargets) * 100));
  return { bar, record, goalsDue, totalTargets, completed, percent };
}

function renderProgressBar() {
  const { bar, totalTargets, completed, percent } = getProgressDetails();
  if (!bar) return;
  bar.textContent = '';
  bar.style.width = `${percent}%`;
  const label = document.getElementById('progress-label');
  if (label) {
    label.textContent = totalTargets === 0
      ? 'Add goals to see your momentum'
      : `${percent}% · ${completed}/${totalTargets} steps`;
  }
}

function renderQuoteAndXp(metrics) {
  const quoteEl = document.getElementById('quote');
  if (quoteEl) quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
  const xpEl = document.getElementById('xp-level');
  if (xpEl) {
    const xp = metrics.year * 10;
    const level = Math.floor(xp / 200) + 1;
    xpEl.textContent = `Level ${level} · ${xp} XP`;
  }
}

function renderSnapshot(metrics = calculateMetrics()) {
  const statList = document.getElementById('stat-list');
  const { totalTargets, completed, percent } = getProgressDetails();
  const dueToday = todos.filter(t => !t.completed && (t.dueDate === today || !t.dueDate)).length;

  if (statList) {
    statList.innerHTML = '';
    const entries = [
      { label: 'Today', value: `${percent}%`, detail: `${completed}/${totalTargets || 0} steps complete` },
      { label: 'Goals active', value: metrics.goalCount, detail: 'in rotation for today' },
      { label: 'Year total', value: metrics.year, detail: 'actions logged' },
      { label: 'Streak', value: `${metrics.streak} days`, detail: 'keep the chain alive' },
      { label: 'To-dos', value: dueToday, detail: 'ready to check off' }
    ];
    entries.forEach(entry => {
      const li = document.createElement('li');
      li.innerHTML = `<div class="stat-label">${entry.label}</div><div class="stat-value">${entry.value}</div><div class="meta">${entry.detail}</div>`;
      statList.appendChild(li);
    });
  }

  const accentPreview = document.getElementById('accent-preview');
  if (accentPreview) {
    const accentColor = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#22d3ee').trim();
    accentPreview.style.background = accentColor;
    accentPreview.style.boxShadow = `0 0 0 8px color-mix(in srgb, ${accentColor} 18%, transparent)`;
  }

  const themeNote = document.getElementById('theme-note');
  if (themeNote) {
    const mode = document.documentElement.getAttribute('data-theme') || 'dark';
    themeNote.textContent = `Using ${mode} mode with your accent`;
  }
}

function playChime() {
  if (!audioContext) return;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, audioContext.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.3);
  osc.start();
  osc.stop(audioContext.currentTime + 0.35);
}

function triggerVibration() {
  if (navigator.vibrate) navigator.vibrate(30);
}

function showConfetti() {
  const existing = document.getElementById('confetti');
  if (existing) existing.remove();
  const container = document.createElement('div');
  container.id = 'confetti';
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.backgroundColor = `hsl(${Math.random() * 360}, 80%, 60%)`;
    container.appendChild(piece);
  }
  document.body.appendChild(container);
  setTimeout(() => container.remove(), 2000);
}

// Event bindings
const goalForm = document.getElementById('goal-form');
if (goalForm) {
  goalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('goal-input');
    const name = input.value.trim();
    if (!name) return;
    addGoal(name);
    input.value = '';
    const group = document.getElementById('goal-group');
    if (group) group.value = '';
  });
}

const todoForm = document.getElementById('todo-form');
if (todoForm) {
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('todo-input');
    const due = document.getElementById('todo-due');
    const text = input.value.trim();
    if (!text) return;
    const item = {
      id: generateId(),
      text,
      completed: false,
      dueDate: due?.value || '',
      completedDate: ''
    };
    todos.push(item);
    saveTodos();
    syncTodoCounts();
    input.value = '';
    if (due) due.value = '';
    renderTodos();
    renderSnapshot();
  });
}

const clearCompletedBtn = document.getElementById('clear-completed');
if (clearCompletedBtn) {
  clearCompletedBtn.addEventListener('click', () => {
    clearCompletedTodos();
  });
}

const analyticsRange = document.getElementById('analytics-range');
if (analyticsRange) {
  analyticsRange.addEventListener('change', renderAnalytics);
}

const exportCsvBtn = document.getElementById('export-csv');
if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', downloadCsv);
}

renderAnalytics();
