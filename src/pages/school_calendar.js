(function () {
'use strict';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CUSTOM_EVENT_KEY = 'custom_calendar_events';
const CUSTOM_COLOR_OPTIONS = [
  ['#3b82f6', '파랑'],
  ['#10b981', '초록'],
  ['#f59e0b', '주황'],
  ['#ef4444', '빨강'],
  ['#8b5cf6', '보라'],
  ['#ec4899', '분홍'],
  ['#14b8a6', '청록'],
];

let year = new Date().getFullYear();
let month = new Date().getMonth() + 1;
let events = {};
let customEvents = [];
let selectedDate = '';

async function syncCloudIfPossible() {
  if (!window.syncCloudNow) return;
  try {
    await window.syncCloudNow();
  } catch (_) {}
}

function normalizeCustomEvents(items) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || !item.date || !item.name) continue;
    const normalized = {
      id: String(item.id || `custom-${item.date}-${String(item.name || '').trim()}`),
      date: String(item.date),
      name: String(item.name).trim(),
      color: String(item.color || '#3b82f6'),
      gcal_event_id: String(item.gcal_event_id || ''),
    };
    const dedupeKey = `${normalized.date}__${normalized.name}__${normalized.color}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(normalized);
  }
  return result;
}

function dedupeDayEvents() {
  for (const dateKey of Object.keys(events)) {
    const seen = new Set();
    events[dateKey] = (events[dateKey] || []).filter((event) => {
      const key = [
        event.source || '',
        event.date || dateKey,
        String(event.name || '').trim(),
        event.color || '',
        event.is_holiday ? 'holiday' : 'normal'
      ].join('__');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

async function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">학사 일정</h1>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="sc-add">일정 추가</button>
          <button class="cal-nav-btn" id="sc-p">◀</button>
          <span id="sc-l" style="font-size:15px;font-weight:700;min-width:120px;text-align:center"></span>
          <button class="cal-nav-btn" id="sc-n">▶</button>
          <button class="cal-today-btn" id="sc-t">오늘</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px">
        <div class="card" style="padding:16px">
          <div class="cal-dow-row" style="margin-bottom:8px">
            ${DAY_LABELS.map((day, index) => `<span class="cal-dow" style="color:${index === 0 ? 'var(--danger)' : index === 6 ? 'var(--accent)' : 'var(--text2)'}">${day}</span>`).join('')}
          </div>
          <div class="cal-grid" id="sc-grid"></div>
        </div>

        <div class="card" style="padding:16px;overflow-y:auto;max-height:680px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px">
            <div style="font-weight:700;font-size:13px" id="sc-el-title"></div>
            <div style="font-size:11px;color:var(--text3)" id="sc-selected-date"></div>
          </div>
          <div id="sc-el"></div>
        </div>
      </div>
    </div>
  `;
}

async function init() {
  document.getElementById('sc-p').onclick = async () => {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    await renderAll();
  };

  document.getElementById('sc-n').onclick = async () => {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    await renderAll();
  };

  document.getElementById('sc-t').onclick = async () => {
    const today = new Date();
    year = today.getFullYear();
    month = today.getMonth() + 1;
    selectedDate = formatDateKey(year, month, today.getDate());
    await renderAll();
  };

  document.getElementById('sc-add').onclick = async () => {
    await openAddEventModal(selectedDate || formatDateKey(year, month, 1));
  };

  await renderAll();
}

async function renderAll() {
  document.getElementById('sc-l').textContent = `${year}년 ${month}월`;
  customEvents = await loadCustomEvents();
  await loadSchoolEvents();

  if (!selectedDate || !selectedDate.startsWith(`${year}${String(month).padStart(2, '0')}`)) {
    selectedDate = '';
  }

  renderGrid();
  renderList();
}

async function loadSchoolEvents() {
  events = {};
  const edu = await api.getSetting('edu_office_code', '');
  const school = await api.getSetting('school_code', '');

  if (edu && school) {
    const yearMonth = `${year}${String(month).padStart(2, '0')}`;
    const schoolEvents = await api.neisGetCalendar(edu, school, yearMonth) || [];
    for (const event of schoolEvents) {
      if (!event?.date) continue;
      const normalized = {
        id: `neis-${event.date}-${event.name || ''}`,
        date: String(event.date),
        name: String(event.name || ''),
        is_holiday: Boolean(event.is_holiday),
        source: 'school',
      };
      (events[normalized.date] = events[normalized.date] || []).push(normalized);
    }
  }

  for (const event of customEvents) {
    if (!event.date || !event.date.startsWith(`${year}${String(month).padStart(2, '0')}`)) continue;
    const normalized = {
      id: event.id,
      date: event.date,
      name: event.name || '',
      color: event.color || '#3b82f6',
      is_holiday: false,
      source: 'custom',
    };
    (events[normalized.date] = events[normalized.date] || []).push(normalized);
  }

  dedupeDayEvents();
  for (const dateKey of Object.keys(events)) {
    events[dateKey].sort((a, b) => {
      if (a.source === b.source) return String(a.name).localeCompare(String(b.name), 'ko');
      return a.source === 'school' ? -1 : 1;
    });
  }
}

function renderGrid() {
  const grid = document.getElementById('sc-grid');
  grid.innerHTML = '';

  const now = new Date();
  const firstDay = new Date(year, month - 1, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let i = 0; i < startDay; i += 1) {
    grid.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const dateKey = formatDateKey(year, month, day);
    const dayEvents = events[dateKey] || [];
    const isToday = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
    const isHoliday = dayEvents.some((event) => event.is_holiday);
    const isSelected = selectedDate === dateKey;

    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-cell' + (isToday ? ' today' : isHoliday ? ' holiday' : dayOfWeek === 0 ? ' sun' : dayOfWeek === 6 ? ' sat' : '') + (isSelected ? ' active' : '');
    cell.style.minHeight = '88px';
    cell.style.width = '100%';
    cell.style.textAlign = 'left';
    cell.style.background = '#fff';
    cell.style.cursor = 'pointer';
    cell.style.position = 'relative';
    cell.style.border = isSelected ? '2px solid var(--primary)' : '1px solid var(--border)';

    cell.onclick = () => {
      selectedDate = dateKey;
      renderGrid();
      renderList();
    };

    cell.ondblclick = async () => {
      selectedDate = dateKey;
      renderGrid();
      renderList();
      await openAddEventModal(dateKey);
    };

    const dayLabel = document.createElement('div');
    dayLabel.className = 'cal-day';
    dayLabel.textContent = day;
    cell.appendChild(dayLabel);

    for (const event of dayEvents.slice(0, 3)) {
      const item = document.createElement('div');
      item.className = 'cal-event' + (event.is_holiday ? ' is-holiday' : ' normal');
      item.textContent = truncateText(event.name || '', 10);
      if (event.source === 'custom') {
        item.style.background = `${event.color || '#3b82f6'}22`;
        item.style.color = event.color || '#3b82f6';
        item.style.borderLeft = `3px solid ${event.color || '#3b82f6'}`;
      }
      cell.appendChild(item);
    }

    if (dayEvents.length > 3) {
      const more = document.createElement('div');
      more.style.fontSize = '11px';
      more.style.color = 'var(--text3)';
      more.style.marginTop = '3px';
      more.textContent = `+${dayEvents.length - 3}개`;
      cell.appendChild(more);
    }

    grid.appendChild(cell);
  }
}

function renderList() {
  const list = document.getElementById('sc-el');
  const title = document.getElementById('sc-el-title');
  const selectedDateLabel = document.getElementById('sc-selected-date');
  const monthPrefix = `${year}${String(month).padStart(2, '0')}`;
  const monthEvents = [];

  for (const [dateKey, dayEvents] of Object.entries(events)) {
    if (!dateKey.startsWith(monthPrefix)) continue;
    for (const event of dayEvents) monthEvents.push({ dateKey, event });
  }

  monthEvents.sort((a, b) => {
    const byDate = a.dateKey.localeCompare(b.dateKey);
    if (byDate !== 0) return byDate;
    if (a.event.source === b.event.source) return String(a.event.name).localeCompare(String(b.event.name), 'ko');
    return a.event.source === 'school' ? -1 : 1;
  });

  const visibleEvents = selectedDate ? monthEvents.filter(({ dateKey }) => dateKey === selectedDate) : monthEvents;
  title.textContent = selectedDate ? `${formatDateLabel(selectedDate)} 일정` : `${year}년 ${month}월 일정`;
  selectedDateLabel.textContent = selectedDate ? '선택한 날짜 일정만 보고 있습니다.' : '날짜를 클릭하면 하루 일정만 볼 수 있어요.';

  if (!visibleEvents.length) {
    list.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px;color:var(--text3);font-size:13px">
        <div>표시할 일정이 없습니다.</div>
        <button class="btn btn-secondary btn-sm" id="sc-empty-add">일정 추가</button>
      </div>
    `;
    document.getElementById('sc-empty-add')?.addEventListener('click', async () => {
      await openAddEventModal(selectedDate || formatDateKey(year, month, 1));
    });
    return;
  }

  let previousDate = '';
  list.innerHTML = visibleEvents.map(({ dateKey, event }) => {
    const date = new Date(Number(dateKey.slice(0, 4)), Number(dateKey.slice(4, 6)) - 1, Number(dateKey.slice(6, 8)));
    const badgeClass = event.is_holiday ? 'badge-danger' : event.source === 'custom' ? 'badge-primary' : 'badge-accent';
    const badgeText = event.is_holiday ? '휴일' : event.source === 'custom' ? '내 일정' : '학사';
    const deleteButton = event.source === 'custom'
      ? `<button class="btn btn-secondary btn-sm sc-del-btn" data-id="${escapeHtml(event.id)}" style="padding:4px 8px;font-size:11px">삭제</button>`
      : '';
    const rowClass = previousDate && previousDate !== dateKey ? 'sc-list-row group-start' : 'sc-list-row';
    previousDate = dateKey;
    const badgeStyle = event.source === 'custom' && event.color
      ? `background:${event.color};color:#fff;`
      : '';

    return `
      <div class="${rowClass}">
        <span style="font-size:11px;color:var(--text2);font-weight:600;width:92px;flex-shrink:0">${date.getMonth() + 1}/${date.getDate()} (${DAY_LABELS[date.getDay()]})</span>
        <span class="badge ${badgeClass}" style="flex-shrink:0;${badgeStyle}">${badgeText}</span>
        <span style="font-size:13px;flex:1;min-width:0">${escapeHtml(event.name)}</span>
        ${deleteButton}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.sc-del-btn').forEach((button) => {
    button.onclick = async () => {
      const eventId = button.dataset.id;
      const target = customEvents.find((item) => item.id === eventId);
      if (!target) return;
      if (!confirm(`"${target.name}" 일정을 삭제할까요?`)) return;
      if (target.gcal_event_id && window.deleteGoogleCalendarCustomEvent) {
        await window.deleteGoogleCalendarCustomEvent(target.gcal_event_id);
      }
      customEvents = customEvents.filter((item) => item.id !== eventId);
      await saveCustomEvents();
      await renderAll();
    };
  });
}

async function openAddEventModal(defaultDate) {
  if (typeof showModal !== 'function') {
    await openAddEventFallback(defaultDate);
    return;
  }

  showModal(`
    <div class="modal-header">
      <span class="modal-title">일정 추가</span>
      <button class="modal-close" data-close>✕</button>
    </div>
    <div class="modal-body" style="display:grid;gap:12px">
      <label style="display:grid;gap:6px">
        <span style="font-size:13px;color:var(--text2)">날짜</span>
        <input id="scm-date" class="input" type="date" value="${toInputDate(defaultDate)}">
      </label>
      <label style="display:grid;gap:6px">
        <span style="font-size:13px;color:var(--text2)">내용</span>
        <input id="scm-name" class="input" type="text" placeholder="일정 내용을 입력하세요">
      </label>
      <label style="display:grid;gap:6px">
        <span style="font-size:13px;color:var(--text2)">색상</span>
        <select id="scm-color" class="input">
          ${CUSTOM_COLOR_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
        </select>
      </label>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btn-secondary" data-close>취소</button>
        <button class="btn btn-primary" id="scm-save">저장</button>
      </div>
    </div>
  `);

  setTimeout(() => {
    const nameInput = document.getElementById('scm-name');
    const saveButton = document.getElementById('scm-save');
    if (!nameInput || !saveButton) return;
    nameInput.focus();

    const submit = async () => {
      const dateValue = String(document.getElementById('scm-date')?.value || '').replace(/\D/g, '');
      const nameValue = String(nameInput.value || '').trim();
      const colorValue = String(document.getElementById('scm-color')?.value || '#3b82f6');
      if (!/^\d{8}$/.test(dateValue)) {
        alert('날짜를 올바르게 입력해 주세요.');
        return;
      }
      if (!nameValue) {
        alert('일정 내용을 입력해 주세요.');
        nameInput.focus();
        return;
      }

      const customEvent = {
        id: createCustomEventId(),
        date: dateValue,
        name: nameValue,
        color: colorValue,
      };
      if (window.addGoogleCalendarCustomEvent) {
        customEvent.gcal_event_id = await window.addGoogleCalendarCustomEvent(customEvent) || '';
      }
      customEvents.push(customEvent);

      selectedDate = dateValue;
      year = Number(dateValue.slice(0, 4));
      month = Number(dateValue.slice(4, 6));
      await saveCustomEvents();
      document.querySelector('.modal-backdrop [data-close]')?.click();
      await renderAll();
    };

    saveButton.onclick = submit;
    nameInput.onkeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    };
  }, 0);
}

async function openAddEventFallback(defaultDate) {
  const dateInput = prompt('날짜를 입력해 주세요. 예: 20260422', defaultDate || '');
  if (!dateInput) return;
  const normalizedDate = String(dateInput).replace(/\D/g, '');
  if (!/^\d{8}$/.test(normalizedDate)) {
    alert('날짜는 YYYYMMDD 형식으로 입력해 주세요.');
    return;
  }
  const titleInput = prompt('일정 내용을 입력해 주세요.', '');
  const nameValue = String(titleInput || '').trim();
  if (!nameValue) return;

  customEvents.push({
    id: createCustomEventId(),
    date: normalizedDate,
    name: nameValue,
    color: '#3b82f6',
  });

  selectedDate = normalizedDate;
  year = Number(normalizedDate.slice(0, 4));
  month = Number(normalizedDate.slice(4, 6));
  await saveCustomEvents();
  await renderAll();
}

async function loadCustomEvents() {
  try {
    const raw = await api.getSetting(CUSTOM_EVENT_KEY, '[]');
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    return normalizeCustomEvents(parsed);
  } catch (error) {
    return [];
  }
}

async function saveCustomEvents() {
  customEvents = normalizeCustomEvents(customEvents);
  await api.setSetting(CUSTOM_EVENT_KEY, JSON.stringify(customEvents));
  await syncCloudIfPossible();
}

function formatDateKey(inputYear, inputMonth, inputDay) {
  return `${inputYear}${String(inputMonth).padStart(2, '0')}${String(inputDay).padStart(2, '0')}`;
}

function formatDateLabel(dateKey) {
  return `${dateKey.slice(0, 4)}.${dateKey.slice(4, 6)}.${dateKey.slice(6, 8)}`;
}

function toInputDate(dateKey) {
  if (!/^\d{8}$/.test(String(dateKey || ''))) return '';
  return `${dateKey.slice(0, 4)}-${dateKey.slice(4, 6)}-${dateKey.slice(6, 8)}`;
}

function createCustomEventId() {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function truncateText(text, maxLength) {
  const value = String(text || '');
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.registerPage('school_calendar', { render, init });
})();
