const KEY = 'todo-app-v1';
const THEME_KEY = 'todo-theme';
const PRIO = {
  high:   { label: 'أولوية عالية',  weight: 0 },
  medium: { label: 'أولوية متوسطة', weight: 1 },
  low:    { label: 'أولوية منخفضة', weight: 2 }
};
const EMPTY_TEXT = {
  all: 'ما في مهام بعد. أضف أول مهمة من الأعلى.',
  active: 'ما في مهام متبقية. شغل ممتاز!',
  done: 'لسا ما أنجزت أي مهمة.'
};

const $ = (s) => document.querySelector(s);
const state = { tasks: [], filter: 'all', editing: null };
let lastDeleted = null;

// ---------- التخزين ----------
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state.tasks)); } catch (e) { /* تجاهل */ }
}
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(data)) {
      state.tasks = data.filter((t) => t && typeof t.title === 'string' && PRIO[t.priority]);
    }
  } catch (e) { /* تجاهل */ }
}

// ---------- الوضع الداكن ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $('#themeBtn');
  btn.setAttribute('aria-pressed', theme === 'dark');
  btn.textContent = theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن';
}
function initTheme() {
  let theme = null;
  try { theme = localStorage.getItem(THEME_KEY); } catch (e) { /* تجاهل */ }
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);
}
$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* تجاهل */ }
});

// ---------- الرسائل ----------
function say(text, undo) {
  const m = $('#msg');
  m.textContent = text;
  if (undo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'تراجع';
    b.onclick = undo;
    m.append(b);
  }
}

// ---------- العمليات ----------
function addTask(title, priority) {
  const t = title.trim();
  if (!t) { say('اكتب عنوان المهمة أولًا.'); return false; }
  state.tasks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: t, priority, done: false, created: Date.now()
  });
  save(); say(''); render();
  return true;
}
function toggle(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (t) { t.done = !t.done; save(); render(); }
}
function remove(id) {
  const i = state.tasks.findIndex((x) => x.id === id);
  if (i < 0) return;
  lastDeleted = { task: state.tasks[i], index: i };
  state.tasks.splice(i, 1);
  save(); render();
  say('تم حذف المهمة.', () => {
    if (!lastDeleted) return;
    state.tasks.splice(Math.min(lastDeleted.index, state.tasks.length), 0, lastDeleted.task);
    lastDeleted = null; save(); say(''); render();
  });
}
function saveEdit(id, title, priority) {
  const t = state.tasks.find((x) => x.id === id);
  const v = title.trim();
  if (!t) return;
  if (!v) { say('عنوان المهمة ما بيصير يكون فاضي.'); return; }
  t.title = v; t.priority = priority;
  state.editing = null; save(); say(''); render();
}
function clearDone() {
  const n = state.tasks.filter((t) => t.done).length;
  if (!n) return;
  state.tasks = state.tasks.filter((t) => !t.done);
  lastDeleted = null; save(); say(`تم حذف ${n} من المهام المنجزة.`); render();
}

// ---------- العرض ----------
function visibleTasks() {
  return state.tasks
    .filter((t) => state.filter === 'all' || (state.filter === 'done' ? t.done : !t.done))
    .sort((a, b) =>
      (a.done - b.done) ||
      (PRIO[a.priority].weight - PRIO[b.priority].weight) ||
      (b.created - a.created));
}

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  kids.forEach((k) => e.append(k));
  return e;
}

function taskItem(t) {
  const li = el('li', { className: 'task' + (t.done ? ' done' : '') });
  li.dataset.p = t.priority;
  li.dataset.id = t.id;

  if (state.editing === t.id) {
    const input = el('input', { type: 'text', value: t.title, maxLength: 120 });
    input.setAttribute('aria-label', 'تعديل عنوان المهمة');
    input.dataset.role = 'edit-title';
    const sel = el('select');
    sel.setAttribute('aria-label', 'الأولوية');
    sel.dataset.role = 'edit-prio';
    Object.entries(PRIO).forEach(([k, v]) => {
      const o = el('option', { value: k, textContent: v.label });
      if (k === t.priority) o.selected = true;
      sel.append(o);
    });
    const row = el('div', { className: 'edit-row' },
      input, sel,
      el('button', { type: 'button', className: 'primary', textContent: 'حفظ' }),
      el('button', { type: 'button', textContent: 'إلغاء' }));
    row.children[2].dataset.act = 'save';
    row.children[3].dataset.act = 'cancel';
    li.append(row);
    return li;
  }

  const cb = el('input', { type: 'checkbox', checked: t.done, id: 'c-' + t.id });
  cb.dataset.act = 'toggle';
  const label = el('label', { className: 't-title', htmlFor: 'c-' + t.id, textContent: t.title });
  const tag = el('span', { className: 'tag', textContent: PRIO[t.priority].label });
  const body = el('div', { className: 'body' }, label, el('br'), tag);
  const edit = el('button', { type: 'button', textContent: 'تعديل' });
  edit.dataset.act = 'edit';
  edit.setAttribute('aria-label', 'تعديل: ' + t.title);
  const del = el('button', { type: 'button', className: 'del', textContent: 'حذف' });
  del.dataset.act = 'delete';
  del.setAttribute('aria-label', 'حذف: ' + t.title);
  li.append(cb, body, el('div', { className: 'acts' }, edit, del));
  return li;
}

function render() {
  const list = $('#list');
  list.innerHTML = '';
  const items = visibleTasks();
  items.forEach((t) => list.append(taskItem(t)));

  const empty = $('#empty');
  empty.hidden = items.length > 0;
  empty.textContent = EMPTY_TEXT[state.filter];

  const left = state.tasks.filter((t) => !t.done).length;
  $('#count').textContent = left === 0 ? 'لا مهام متبقية'
    : left === 1 ? 'مهمة واحدة متبقية'
    : left === 2 ? 'مهمتان متبقيتان'
    : left + (left <= 10 ? ' مهام متبقية' : ' مهمة متبقية');
  $('#clearDone').hidden = !state.tasks.some((t) => t.done);

  document.querySelectorAll('[data-filter]').forEach((b) =>
    b.setAttribute('aria-pressed', b.dataset.filter === state.filter));

  const editInput = list.querySelector('[data-role="edit-title"]');
  if (editInput) { editInput.focus(); editInput.setSelectionRange(editInput.value.length, editInput.value.length); }
}

// ---------- الأحداث ----------
$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (addTask($('#title').value, $('#prio').value)) {
    $('#title').value = '';
    $('#title').focus();
  }
});

$('#list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const li = btn.closest('.task');
  const id = li.dataset.id;
  switch (btn.dataset.act) {
    case 'toggle': toggle(id); break;
    case 'delete': remove(id); break;
    case 'edit': state.editing = id; render(); break;
    case 'cancel': state.editing = null; render(); break;
    case 'save':
      saveEdit(id,
        li.querySelector('[data-role="edit-title"]').value,
        li.querySelector('[data-role="edit-prio"]').value);
      break;
  }
});

$('#list').addEventListener('keydown', (e) => {
  const li = e.target.closest('.task');
  if (!li || state.editing !== li.dataset.id) return;
  if (e.key === 'Enter' && e.target.dataset.role === 'edit-title') {
    e.preventDefault();
    saveEdit(li.dataset.id,
      li.querySelector('[data-role="edit-title"]').value,
      li.querySelector('[data-role="edit-prio"]').value);
  } else if (e.key === 'Escape') {
    state.editing = null; render();
  }
});

document.querySelectorAll('[data-filter]').forEach((b) =>
  b.addEventListener('click', () => { state.filter = b.dataset.filter; render(); }));
$('#clearDone').addEventListener('click', clearDone);

// ---------- البداية ----------
$('#today').textContent = new Date().toLocaleDateString('ar-u-nu-latn',
  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
initTheme();
load();
render();
