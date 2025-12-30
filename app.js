const STORAGE_KEYS = {
  goals: 'habitGoals',
  completions: 'habitCompletions',
  todos: 'habitTodos'
};

let goals = loadGoals();
let completions = loadCompletions();
let todos = loadTodos();

let today = getToday();

initNavigation();
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
    return parsed.map(goal => ({
      ...goal,
      nameHistory: goal.nameHistory || [{ name: goal.name, from: goal.createdDate }]
    }));
  } catch {
    return [];
  }
}

function loadCompletions() {
  const stored = localStorage.getItem(STORAGE_KEYS.completions);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

function loadTodos() {
  const stored = localStorage.getItem(STORAGE_KEYS.todos);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
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

function renderHome() {
  const todayLabel = document.getElementById('today-label');
  todayLabel.textContent = new Date().toDateString();

  const activeGoals = goals.filter(goal => !goal.archived);
  const grid = document.getElementById('daily-goal-grid');
  grid.innerHTML = '';

  const record = ensureDailyRecord(today);
  const completedCount = activeGoals.filter(goal => record.goalStatuses[goal.id]).length;
  const goalSummary = document.getElementById('goal-summary');
  if (activeGoals.length === 0) {
    document.getElementById('no-goals-message').style.display = 'block';
    goalSummary.textContent = '';
  } else {
    document.getElementById('no-goals-message').style.display = 'none';
    goalSummary.textContent = `${completedCount} / ${activeGoals.length} goals completed today`;
  }

  activeGoals.forEach(goal => {
    const square = document.createElement('div');
    square.className = 'square' + (record.goalStatuses[goal.id] ? ' completed' : '');
    square.dataset.goalId = goal.id;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = getGoalNameForDate(goal, today);
    square.appendChild(label);
    if (!record.goalStatuses[goal.id]) {
      square.addEventListener('click', () => {
        markGoalComplete(goal.id);
      });
    }
    grid.appendChild(square);
  });

  const metrics = calculateMetrics();
  document.getElementById('today-count').textContent = metrics.today;
  document.getElementById('year-count').textContent = metrics.year;

  renderTodos();
}

function calculateMetrics() {
  const todayRecord = ensureDailyRecord(today);
  const todayTotal = Object.values(todayRecord.goalStatuses).filter(Boolean).length + (todayRecord.todoCount || 0);
  const currentYear = new Date().getFullYear();
  let yearTotal = 0;
  Object.entries(completions).forEach(([date, record]) => {
    if (!date.startsWith(String(currentYear))) return;
    const goalsCompleted = Object.values(record.goalStatuses || {}).filter(Boolean).length;
    yearTotal += goalsCompleted + (record.todoCount || 0);
  });
  return { today: todayTotal, year: yearTotal };
}

function markGoalComplete(goalId) {
  const record = ensureDailyRecord(today);
  if (record.goalStatuses[goalId]) return;
  record.goalStatuses[goalId] = true;
  completions[today] = record;
  saveCompletions();
  renderHome();
  renderHistory();
}

function renderGoalsPage() {
  const goalList = document.getElementById('goal-list');
  goalList.innerHTML = '';
  const sortedGoals = [...goals].sort((a, b) => a.createdDate.localeCompare(b.createdDate));

  sortedGoals.forEach(goal => {
    const li = document.createElement('li');
    li.className = 'goal-row';

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
    meta.textContent = goal.archived ? 'Archived' : `Active since ${goal.createdDate}`;

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

    li.appendChild(nameInput);
    li.appendChild(meta);
    li.appendChild(actions);
    goalList.appendChild(li);
  });
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
  const goal = { id, name, createdDate, archived: false, nameHistory: [{ name, from: createdDate }] };
  goals.push(goal);
  saveGoals();
  renderHome();
  renderHistory();
  renderGoalsPage();
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  list.innerHTML = '';
  const sorted = [...todos].sort((a, b) => Number(a.completed) - Number(b.completed));

  sorted.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' completed' : '');
    const label = document.createElement('div');
    label.textContent = todo.text;

    const dateMeta = document.createElement('div');
    dateMeta.className = 'meta';
    dateMeta.textContent = todo.completed ? `Done ${todo.completedDate}` : 'Open';

    const btn = document.createElement('button');
    if (todo.completed) {
      btn.textContent = 'Completed';
      btn.disabled = true;
    } else {
      btn.textContent = 'Mark complete';
      btn.addEventListener('click', () => completeTodo(todo.id));
    }

    li.appendChild(label);
    li.appendChild(dateMeta);
    li.appendChild(btn);
    list.appendChild(li);
  });
}

function completeTodo(id) {
  let changed = false;
  todos = todos.map(todo => {
    if (todo.id !== id || todo.completed) return todo;
    changed = true;
    return { ...todo, completed: true, completedDate: today };
  });
  if (!changed) return;
  const record = ensureDailyRecord(today);
  record.todoCount = (record.todoCount || 0) + 1;
  completions[today] = record;
  saveTodos();
  saveCompletions();
  renderHome();
  renderHistory();
}

function clearCompletedTodos() {
  todos = todos.filter(todo => !todo.completed);
  saveTodos();
  renderTodos();
}

function renderHistory() {
  const container = document.getElementById('history-matrix');
  container.innerHTML = '';
  const allGoals = [...goals].sort((a, b) => a.createdDate.localeCompare(b.createdDate));
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
      if (date < goal.createdDate || archived) {
        td.classList.add('inactive');
      } else {
        const record = completions[date];
        const done = record && record.goalStatuses && record.goalStatuses[goal.id];
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
  });
}

const todoForm = document.getElementById('todo-form');
if (todoForm) {
  todoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;
    const item = { id: generateId(), text, completed: false };
    todos.push(item);
    saveTodos();
    input.value = '';
    renderTodos();
  });
}

const clearCompletedBtn = document.getElementById('clear-completed');
if (clearCompletedBtn) {
  clearCompletedBtn.addEventListener('click', () => {
    clearCompletedTodos();
  });
}
