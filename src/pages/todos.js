(function () {
'use strict';

const TODO_ORDER_KEY = 'todo_manual_order';

let currentFilter = 'all';
let currentDateFilter = '';
let currentCategory = '';
let todoOrder = [];
let lastSortedTodoIds = [];
let lastVisibleTodoIds = [];

async function syncCloudIfPossible() {
  if (!window.syncCloudNow) return;
  try {
    await window.syncCloudNow();
  } catch (_) {}
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">할일 관리</h1>
      </div>

      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-primary btn-sm" id="todos-add-btn">+ 할일 추가</button>
        <button class="btn btn-secondary btn-sm" id="todos-reset-order-btn">정렬 초기화</button>
        <button class="btn btn-secondary btn-sm" id="todos-sync-btn" title="Google Tasks와 동기화">🔄 동기화</button>
        <span id="todos-sync-status" style="font-size:11px;color:var(--text3)"></span>
        <div style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap;align-items:center">
          <div style="display:flex;gap:2px">
            <button class="btn btn-sm todos-filter-btn active" data-filter="all">전체</button>
            <button class="btn btn-sm todos-filter-btn" data-filter="active">진행중</button>
            <button class="btn btn-sm todos-filter-btn" data-filter="done">완료</button>
          </div>
          <select class="input" id="todos-date-filter" style="font-size:12px;padding:3px 6px;height:auto;min-width:110px">
            <option value="">전체 기간</option>
            <option value="today">오늘</option>
            <option value="week">7일 이내</option>
            <option value="overdue">기한 지남</option>
          </select>
          <select class="input" id="todos-cat-filter" style="font-size:12px;padding:3px 6px;height:auto;min-width:110px">
            <option value="">전체 카테고리</option>
          </select>
        </div>
      </div>

      <div id="todos-stats" style="display:flex;gap:16px;margin-bottom:14px;font-size:13px;color:var(--text2)"></div>
      <div id="todos-sort-hint" style="font-size:12px;color:var(--text3);margin-bottom:10px"></div>
      <div id="todos-list"></div>
    </div>
  `;
}

async function runGoogleSync(showStatus = true) {
  if (!window.syncWithGoogleTasks) return;
  const statusEl = document.getElementById('todos-sync-status');
  const syncBtn = document.getElementById('todos-sync-btn');
  if (syncBtn) syncBtn.disabled = true;
  if (showStatus && statusEl) statusEl.textContent = '동기화 중…';
  try {
    const result = await window.syncWithGoogleTasks();
    if (result && result.ok) {
      if (showStatus && statusEl) {
        const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        statusEl.textContent = `마지막 동기화 ${now}`;
      }
      await refreshList();
    } else if (result && result.skipped) {
      if (showStatus && statusEl) statusEl.textContent = '';
    }
  } catch (_) {}
  if (syncBtn) syncBtn.disabled = false;
}

async function init() {
  document.getElementById('todos-add-btn').onclick = () => openEditModal(null);
  document.getElementById('todos-reset-order-btn').onclick = async () => {
    if (!confirm('사용자 순서를 지우고 마감일 기준 정렬로 되돌릴까요?')) return;
    await saveTodoOrder([]);
    await syncCloudIfPossible();
    await refreshList();
  };

  document.getElementById('todos-sync-btn').onclick = () => runGoogleSync(true);

  // 페이지 진입 시 백그라운드 동기화 (목록 먼저 표시 후)
  refreshList().then(() => runGoogleSync(true));

  document.querySelectorAll('.todos-filter-btn').forEach((button) => {
    button.onclick = () => {
      currentFilter = button.dataset.filter;
      document.querySelectorAll('.todos-filter-btn').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      refreshList();
    };
  });

  document.getElementById('todos-date-filter').onchange = (event) => {
    currentDateFilter = event.target.value;
    refreshList();
  };

  document.getElementById('todos-cat-filter').onchange = (event) => {
    currentCategory = event.target.value;
    refreshList();
  };
}

async function refreshList() {
  try {
    const todos = await api.getTodos(true);
    todoOrder = await loadTodoOrder();
    renderStats(todos);
    populateCategoryFilter(todos);
    renderSortHint(todos);
    renderTodoList(todos);
  } catch (error) {
    const list = document.getElementById('todos-list');
    if (list) {
      list.innerHTML = '<div style="color:var(--danger);padding:16px">할일 목록을 불러오지 못했습니다.</div>';
    }
  }
}

function renderStats(todos) {
  const element = document.getElementById('todos-stats');
  if (!element) return;

  const total = todos.length;
  const done = todos.filter((todo) => todo.is_done).length;
  const active = total - done;

  element.innerHTML = `
    <span>전체 <strong>${total}</strong>개</span>
    <span>완료 <strong style="color:var(--success,#22c55e)">${done}</strong>개</span>
    <span>진행중 <strong style="color:var(--primary,#3b82f6)">${active}</strong>개</span>
  `;
}

function renderSortHint(todos) {
  const element = document.getElementById('todos-sort-hint');
  if (!element) return;

  const hasManualOrder = Array.isArray(todoOrder) && todoOrder.some((id) => todos.some((todo) => todo.id === id));
  element.textContent = hasManualOrder
    ? '기본은 마감일 임박순이며, 위/아래 버튼으로 바꾼 사용자 순서를 함께 기억합니다.'
    : '기본 정렬은 마감일이 가까운 순서입니다. 위/아래 버튼으로 원하는 순서를 저장할 수 있습니다.';
}

function populateCategoryFilter(todos) {
  const select = document.getElementById('todos-cat-filter');
  if (!select) return;

  const categories = [...new Set(todos.map((todo) => todo.category).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'ko'));
  select.innerHTML = '<option value="">전체 카테고리</option>';

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    option.selected = category === currentCategory;
    select.appendChild(option);
  }
}

function renderTodoList(allTodos) {
  const list = document.getElementById('todos-list');
  if (!list) return;

  const sorted = sortTodos(allTodos, todoOrder);
  lastSortedTodoIds = sorted.map((todo) => todo.id);

  const filtered = sorted.filter((todo) => passesTodoFilters(todo));
  lastVisibleTodoIds = filtered.map((todo) => todo.id);

  if (!filtered.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">조건에 맞는 할일이 없습니다.</div>';
    return;
  }

  list.innerHTML = filtered.map((todo) => renderTodoRow(todo)).join('');

  list.querySelectorAll('.todo-check').forEach((checkbox) => {
    checkbox.onchange = async () => {
      await api.toggleTodo(Number(checkbox.dataset.id));
      await syncCloudIfPossible();
      await refreshList();
    };
  });

  list.querySelectorAll('.todo-edit-btn').forEach((button) => {
    button.onclick = async () => {
      const todos = await api.getTodos(true);
      const todo = todos.find((item) => item.id === Number(button.dataset.id));
      if (todo) openEditModal(todo);
    };
  });

  list.querySelectorAll('.todo-del-btn').forEach((button) => {
    button.onclick = async () => {
      if (!confirm('이 할일을 삭제할까요?')) return;
      await api.deleteTodo(Number(button.dataset.id));
      await syncCloudIfPossible();
      await refreshList();
    };
  });

  list.querySelectorAll('.todo-move-btn').forEach((button) => {
    button.onclick = async () => {
      await moveTodo(Number(button.dataset.id), Number(button.dataset.dir));
    };
  });

  list.querySelectorAll('.todo-row').forEach((row) => {
    row.onclick = async () => {
      const todos = await api.getTodos(true);
      const todo = todos.find((item) => item.id === Number(row.dataset.id));
      if (todo) openEditModal(todo);
    };
  });
}

function renderTodoRow(todo) {
  const done = Boolean(todo.is_done);
  const deadlineLabel = formatDeadlineLabel(todo.deadline);
  const priorityLabel = todo.priority || '보통';
  const priorityColor = done ? 'var(--text3)' : priorityLabel === '높음' ? 'var(--danger)' : priorityLabel === '낮음' ? 'var(--text3)' : 'var(--text)';
  const sourceBadge = todo.source_text ? '<span class="todo-source-badge">원문</span>' : '';

  return `
    <div class="todo-row card" data-id="${todo.id}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:6px;cursor:pointer;${done ? 'opacity:0.58;' : ''}">
      <input type="checkbox" class="todo-check" data-id="${todo.id}" ${done ? 'checked' : ''} style="cursor:pointer;flex-shrink:0" onclick="event.stopPropagation()">
      <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:0">
        <div style="font-size:13px;${done ? 'text-decoration:line-through;color:var(--text3)' : ''}">${esc(todo.title)}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:var(--text2)">
          ${deadlineLabel ? `<span class="todo-deadline">${deadlineLabel}</span>` : '<span>마감일 없음</span>'}
          <span style="font-weight:600;color:${priorityColor}">${esc(priorityLabel)}</span>
          ${todo.category ? `<span style="background:var(--bg2,#f3f4f6);padding:1px 6px;border-radius:10px">${esc(todo.category)}</span>` : ''}
          ${sourceBadge}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-shrink:0" onclick="event.stopPropagation()">
        <button class="btn btn-secondary btn-sm todo-move-btn" data-id="${todo.id}" data-dir="-1" style="font-size:11px;padding:2px 6px">↑</button>
        <button class="btn btn-secondary btn-sm todo-move-btn" data-id="${todo.id}" data-dir="1" style="font-size:11px;padding:2px 6px">↓</button>
        <button class="btn btn-secondary btn-sm todo-edit-btn" data-id="${todo.id}" style="font-size:11px;padding:2px 7px">수정</button>
        <button class="btn btn-danger btn-sm todo-del-btn" data-id="${todo.id}" style="font-size:11px;padding:2px 7px">삭제</button>
      </div>
    </div>
  `;
}

function passesTodoFilters(todo) {
  const todayStr = today();

  if (currentFilter === 'active' && todo.is_done) return false;
  if (currentFilter === 'done' && !todo.is_done) return false;

  if (currentDateFilter === 'today' && todo.deadline !== todayStr) return false;

  if (currentDateFilter === 'week') {
    if (!todo.deadline) return false;
    const due = new Date(`${todo.deadline}T00:00:00`);
    const start = new Date(`${todayStr}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    if (due < start || due > end) return false;
  }

  if (currentDateFilter === 'overdue') {
    if (!todo.deadline || todo.deadline >= todayStr) return false;
  }

  if (currentCategory && todo.category !== currentCategory) return false;

  return true;
}

function sortTodos(todos, manualOrder) {
  const active = applyManualOrder(baseSort(todos.filter((todo) => !todo.is_done)), manualOrder);
  const done = applyManualOrder(baseSort(todos.filter((todo) => !!todo.is_done)), manualOrder);
  return [...active, ...done];
}

function baseSort(todos) {
  return [...todos].sort((a, b) => {
    const aDeadline = normalizeDeadline(a.deadline);
    const bDeadline = normalizeDeadline(b.deadline);
    if (aDeadline !== bDeadline) return aDeadline.localeCompare(bDeadline);
    return String(b.created_at || '').localeCompare(String(a.created_at || ''));
  });
}

function applyManualOrder(todos, manualOrder) {
  if (!Array.isArray(manualOrder) || !manualOrder.length) return todos;

  const todoMap = new Map(todos.map((todo) => [todo.id, todo]));
  const ordered = [];
  const used = new Set();

  for (const id of manualOrder) {
    const todo = todoMap.get(Number(id));
    if (!todo || used.has(todo.id)) continue;
    ordered.push(todo);
    used.add(todo.id);
  }

  for (const todo of todos) {
    if (used.has(todo.id)) continue;
    ordered.push(todo);
  }

  return ordered;
}

async function moveTodo(id, direction) {
  const currentIndex = lastVisibleTodoIds.indexOf(id);
  const targetIndex = currentIndex + direction;
  if (currentIndex === -1 || targetIndex < 0 || targetIndex >= lastVisibleTodoIds.length) return;

  const swapId = lastVisibleTodoIds[targetIndex];
  const nextOrder = [...lastSortedTodoIds];
  const sourceOrderIndex = nextOrder.indexOf(id);
  const targetOrderIndex = nextOrder.indexOf(swapId);
  if (sourceOrderIndex === -1 || targetOrderIndex === -1) return;

  [nextOrder[sourceOrderIndex], nextOrder[targetOrderIndex]] = [nextOrder[targetOrderIndex], nextOrder[sourceOrderIndex]];
  await saveTodoOrder(nextOrder);
  await syncCloudIfPossible();
  await refreshList();
}

async function loadTodoOrder() {
  try {
    const raw = await api.getSetting(TODO_ORDER_KEY, '[]');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [];
  } catch (error) {
    return [];
  }
}

async function saveTodoOrder(order) {
  todoOrder = Array.from(new Set((order || []).map((item) => Number(item)).filter((item) => Number.isFinite(item))));
  await api.setSetting(TODO_ORDER_KEY, JSON.stringify(todoOrder));
}

function formatDeadlineLabel(deadline) {
  if (!deadline) return '';
  const todayStr = today();
  if (deadline < todayStr) return `기한 지남 · ${deadline.slice(5)}`;
  if (deadline === todayStr) return `오늘 마감 · ${deadline.slice(5)}`;
  return `마감 ${deadline.slice(5)}`;
}

function normalizeDeadline(deadline) {
  return deadline || '9999-12-31';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function extractDateFromTitle(title) {
  const now = new Date();
  const year = now.getFullYear();
  const curMonth = now.getMonth() + 1;

  // 2026-05-15 또는 2026.05.15
  const isoMatch = title.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2,'0')}-${isoMatch[3].padStart(2,'0')}`;
  }
  // 5월 15일 / 5월15일 / 5.15
  const korMatch = title.match(/(\d{1,2})월\s*(\d{1,2})일?/);
  if (korMatch) {
    const m = parseInt(korMatch[1]);
    const d = korMatch[2].padStart(2, '0');
    // 이미 지난 달이면 내년으로
    const useYear = m < curMonth ? year + 1 : year;
    return `${useYear}-${String(m).padStart(2,'0')}-${d}`;
  }
  // 5/15 또는 5-15
  const slashMatch = title.match(/(\d{1,2})[\/\-](\d{1,2})(?!\d)/);
  if (slashMatch) {
    const m = parseInt(slashMatch[1]);
    const d = slashMatch[2].padStart(2, '0');
    if (m >= 1 && m <= 12) {
      const useYear = m < curMonth ? year + 1 : year;
      return `${useYear}-${String(m).padStart(2,'0')}-${d}`;
    }
  }
  return null;
}

function openEditModal(todo) {
  const isNew = !todo;
  const todayStr = today();

  const modalHtml = `
    <div style="min-width:300px;max-width:420px">
      <h3 style="margin:0 0 16px;font-size:15px">${isNew ? '할일 추가' : '할일 수정'}</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">제목 *</label>
          <input class="input" id="todo-modal-title" placeholder="할일 제목" value="${esc(todo?.title || '')}" style="width:100%;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">마감일</label>
          <input class="input" type="date" id="todo-modal-deadline" value="${esc(todo?.deadline || todayStr)}" style="width:100%;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">중요도</label>
          <select class="input" id="todo-modal-priority" style="width:100%;box-sizing:border-box">
            <option value="높음" ${todo?.priority === '높음' ? 'selected' : ''}>높음</option>
            <option value="보통" ${!todo || !todo?.priority || todo?.priority === '보통' ? 'selected' : ''}>보통</option>
            <option value="낮음" ${todo?.priority === '낮음' ? 'selected' : ''}>낮음</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">카테고리</label>
          <input class="input" id="todo-modal-category" placeholder="예: 업무, 개인, 수업" value="${esc(todo?.category || '')}" style="width:100%;box-sizing:border-box">
        </div>
        ${todo?.source_text ? `
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">원문</label>
            <div class="input" style="min-height:88px;white-space:pre-wrap">${esc(todo.source_text)}</div>
          </div>
        ` : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end">
        ${!isNew ? '<button class="btn btn-danger btn-sm" id="todo-modal-delete">삭제</button>' : ''}
        <button class="btn btn-secondary btn-sm" id="todo-modal-cancel">취소</button>
        <button class="btn btn-primary btn-sm" id="todo-modal-save">저장</button>
      </div>
    </div>
  `;

  if (typeof showModal === 'function') {
    showModal(modalHtml);
  } else {
    const overlay = document.createElement('div');
    overlay.id = 'todos-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998;display:flex;align-items:center;justify-content:center';
    overlay.innerHTML = `<div style="background:var(--card-bg,#fff);border-radius:10px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.2)">${modalHtml}</div>`;
    document.body.appendChild(overlay);
  }

  setTimeout(() => {
    document.getElementById('todo-modal-cancel').onclick = closeModalHelper;

    // 제목에서 날짜 자동 감지 → 마감일 자동 입력
    const titleInput = document.getElementById('todo-modal-title');
    const deadlineInput = document.getElementById('todo-modal-deadline');
    let deadlineManuallyChanged = !isNew; // 수정 모드면 이미 설정된 날짜 유지

    deadlineInput.addEventListener('change', () => { deadlineManuallyChanged = true; });

    titleInput.addEventListener('input', () => {
      if (deadlineManuallyChanged) return;
      const detected = extractDateFromTitle(titleInput.value);
      if (detected) deadlineInput.value = detected;
    });

    document.getElementById('todo-modal-save').onclick = async () => {
      const title = document.getElementById('todo-modal-title').value.trim();
      if (!title) {
        toast('제목을 입력해 주세요.', 'error');
        return;
      }

      const payload = {
        title,
        deadline: document.getElementById('todo-modal-deadline').value || '',
        priority: document.getElementById('todo-modal-priority').value || '보통',
        category: document.getElementById('todo-modal-category').value.trim() || '',
      };

      if (isNew) {
        await api.addTodo(payload);
      } else {
        await api.updateTodo(todo.id, payload);
      }

      await syncCloudIfPossible();
      closeModalHelper();
      await refreshList();
    };

    if (!isNew) {
      document.getElementById('todo-modal-delete').onclick = async () => {
        if (!confirm('이 할일을 삭제할까요?')) return;
        await api.deleteTodo(todo.id);
        await syncCloudIfPossible();
        closeModalHelper();
        await refreshList();
      };
    }

    document.getElementById('todo-modal-title')?.focus();
  }, 30);
}

function closeModalHelper() {
  if (typeof closeModal === 'function') {
    closeModal();
    return;
  }
  document.getElementById('todos-modal-overlay')?.remove();
}

function esc(value) {
  if (typeof escapeHtml === 'function') return escapeHtml(value);
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.registerPage('todos', { render, init, refresh: init });
})();
