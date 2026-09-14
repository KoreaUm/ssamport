(function () {
'use strict';

const STORAGE_KEY = 'sticky_notes_v1';
const COLORS = [
  { id: 'yellow', label: '노랑', bg: '#fff9c4', border: '#f9e44e' },
  { id: 'green',  label: '초록', bg: '#c8e6c9', border: '#81c784' },
  { id: 'blue',   label: '파랑', bg: '#bbdefb', border: '#64b5f6' },
  { id: 'pink',   label: '분홍', bg: '#f8bbd9', border: '#f48fb1' },
  { id: 'purple', label: '보라', bg: '#e1bee7', border: '#ce93d8' },
  { id: 'orange', label: '주황', bg: '#ffe0b2', border: '#ffb74d' },
];

let notes = [];
let filterColor = 'all';
let saveTimer = null;

function getColor(id) {
  return COLORS.find(c => c.id === id) || COLORS[0];
}

async function loadNotes() {
  try {
    const raw = await api.getSetting(STORAGE_KEY, '[]');
    notes = JSON.parse(raw || '[]');
    if (!Array.isArray(notes)) notes = [];
  } catch (e) { notes = []; }
}

async function saveNotes() {
  try {
    await api.setSetting(STORAGE_KEY, JSON.stringify(notes));
    // 대시보드 위젯도 갱신
    if (window.__refreshStickyWidget) window.__refreshStickyWidget();
  } catch (e) {}
}

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNotes, 600);
}

function createNote(colorId = 'yellow') {
  return {
    id: 'sn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    content: '',
    color: colorId,
    pinned: false,
    created_at: Date.now(),
    updated_at: Date.now(),
  };
}

function sortedNotes() {
  const filtered = filterColor === 'all' ? notes : notes.filter(n => n.color === filterColor);
  return [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated_at - a.updated_at;
  });
}

function renderPage(c) {
  c.innerHTML = `
<div class="sn-page">
  <div class="sn-toolbar">
    <div class="sn-toolbar-left">
      <button class="btn btn-primary btn-sm" id="sn-add-btn">+ 새 메모</button>
      <div class="sn-color-filters" id="sn-color-filters">
        <button class="sn-cf-btn ${filterColor === 'all' ? 'active' : ''}" data-color="all">전체</button>
        ${COLORS.map(c => `<button class="sn-cf-btn ${filterColor === c.id ? 'active' : ''}" data-color="${c.id}" style="background:${c.bg};border-color:${c.border}">${c.label}</button>`).join('')}
      </div>
    </div>
    <span class="sn-count" id="sn-count"></span>
  </div>
  <div class="sn-grid" id="sn-grid"></div>
</div>`;

  document.getElementById('sn-add-btn').onclick = () => addNote();
  document.getElementById('sn-color-filters').onclick = (e) => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    filterColor = btn.dataset.color;
    renderGrid();
    document.querySelectorAll('.sn-cf-btn').forEach(b => b.classList.toggle('active', b.dataset.color === filterColor));
  };

  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('sn-grid');
  const count = document.getElementById('sn-count');
  if (!grid) return;

  const list = sortedNotes();
  if (count) count.textContent = `${list.length}개`;

  if (list.length === 0) {
    grid.innerHTML = `<div class="sn-empty">📝 메모가 없습니다. 새 메모를 추가해보세요!</div>`;
    return;
  }

  grid.innerHTML = list.map(note => {
    const col = getColor(note.color);
    const preview = (note.content || '').slice(0, 2);
    return `
<div class="sn-card" data-id="${note.id}" style="background:${col.bg};border-color:${col.border}">
  <div class="sn-card-top">
    <div class="sn-color-picker-row" data-id="${note.id}">
      ${COLORS.map(cl => `<button class="sn-cp-dot ${note.color === cl.id ? 'active' : ''}" data-color="${cl.id}" style="background:${cl.bg};border-color:${cl.border}" title="${cl.label}"></button>`).join('')}
    </div>
    <div class="sn-card-actions">
      <button class="sn-pin-btn ${note.pinned ? 'pinned' : ''}" data-id="${note.id}" title="${note.pinned ? '고정 해제' : '고정'}">📌</button>
      <button class="sn-del-btn" data-id="${note.id}" title="삭제">✕</button>
    </div>
  </div>
  <textarea class="sn-textarea" data-id="${note.id}" placeholder="메모를 입력하세요...">${note.content || ''}</textarea>
</div>`;
  }).join('');

  // 이벤트 바인딩
  grid.querySelectorAll('.sn-textarea').forEach(ta => {
    ta.addEventListener('input', (e) => {
      const note = notes.find(n => n.id === e.target.dataset.id);
      if (note) { note.content = e.target.value; note.updated_at = Date.now(); debouncedSave(); }
    });
    // 자동 높이
    ta.addEventListener('input', autoResize);
    autoResize.call(ta);
  });

  grid.querySelectorAll('.sn-del-btn').forEach(btn => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('이 메모를 삭제할까요?')) return;
      notes = notes.filter(n => n.id !== id);
      saveNotes();
      renderGrid();
    };
  });

  grid.querySelectorAll('.sn-pin-btn').forEach(btn => {
    btn.onclick = (e) => {
      const id = e.currentTarget.dataset.id;
      const note = notes.find(n => n.id === id);
      if (note) { note.pinned = !note.pinned; note.updated_at = Date.now(); saveNotes(); renderGrid(); }
    };
  });

  grid.querySelectorAll('.sn-color-picker-row').forEach(row => {
    row.querySelectorAll('.sn-cp-dot').forEach(dot => {
      dot.onclick = (e) => {
        e.stopPropagation();
        const id = row.dataset.id;
        const note = notes.find(n => n.id === id);
        if (note) {
          note.color = dot.dataset.color;
          note.updated_at = Date.now();
          saveNotes();
          renderGrid();
        }
      };
    });
  });
}

function autoResize() {
  this.style.height = 'auto';
  this.style.height = Math.max(100, this.scrollHeight) + 'px';
}

function addNote(colorId = 'yellow') {
  const note = createNote(colorId);
  notes.unshift(note);
  saveNotes();
  filterColor = 'all';
  renderGrid();
  // 첫 번째 textarea 포커스
  setTimeout(() => {
    const first = document.querySelector('.sn-textarea');
    if (first) first.focus();
  }, 50);
}

window.registerPage('sticky_notes', {
  async render(c) {
    await loadNotes();
    renderPage(c);
  },
  refresh() {
    loadNotes().then(() => renderGrid());
  }
});

})();
