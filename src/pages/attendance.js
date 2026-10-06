(function () {
'use strict';

let currentTab = 'daily';
let currentDate = today();
let students = [];
let periodCount = 7;

// 복합 상태 헬퍼 (예: "지각+조퇴")
function hasStatus(statusStr, val) {
  if (!statusStr) return val === '출석';
  return statusStr.split('+').includes(val);
}

function toggleStatus(current, val) {
  // 출석·결석은 단독 선택
  if (val === '출석' || val === '결석') return val;
  const parts = (current === '출석' || !current) ? [] : current.split('+').filter((v) => v !== '출석');
  const idx = parts.indexOf(val);
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(val);
  return parts.length ? parts.join('+') : '출석';
}

function isNonAttendance(statusStr) {
  return statusStr && statusStr !== '출석';
}

// 상태 문자열을 표시용 라벨로 변환 (예: '결과'→'외출', '지각+조퇴'→'지각·조퇴')
function statusLabels(statusStr) {
  return (statusStr || '')
    .split('+')
    .map((v) => (STATUS_MAP[v] ? STATUS_MAP[v].label : v))
    .join('·');
}

// 상태 문자열의 대표 색 (첫 번째 항목 기준)
function statusColor(statusStr) {
  const first = (statusStr || '').split('+')[0];
  return (STATUS_MAP[first] && STATUS_MAP[first].color) || 'var(--accent)';
}

// ── 교시별 사선('/') 관련 헬퍼 ────────────────────────────
// note 컬럼에 "1,2,3" 형태로 사선 그은 교시를 저장
function parsePeriods(note) {
  return String(note || '')
    .split(',')
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
}

function periodsToNote(periods) {
  return [...new Set(periods || [])].sort((a, b) => a - b).join(',');
}

// 사선 교시를 사람이 읽기 좋은 문구로 (예: '1~3교시' 또는 '2·4교시')
function formatPeriods(note) {
  const p = parsePeriods(note).sort((a, b) => a - b);
  if (!p.length) return '';
  const contiguous = p.every((v, i) => i === 0 || v === p[i - 1] + 1);
  if (contiguous && p.length > 1) return `${p[0]}~${p[p.length - 1]}교시`;
  return p.join('·') + '교시';
}

// 교시 칸을 노출할 상태인지 (지각·조퇴·외출일 때만)
function showsPeriods(statusStr) {
  return hasStatus(statusStr, '지각') || hasStatus(statusStr, '조퇴') || hasStatus(statusStr, '결과');
}

// 교시 클릭 시 채우기 방식: 지각=앞에서부터, 조퇴=뒤에서부터, 그 외=개별 토글
function periodFillMode(statusStr) {
  const late = hasStatus(statusStr, '지각');
  const early = hasStatus(statusStr, '조퇴');
  if (late && !early) return 'late';
  if (early && !late) return 'early';
  return 'toggle';
}

// 교시 p 클릭 시 다음 사선 집합 계산
function nextPeriods(current, p, mode, count) {
  const set = new Set(current || []);
  if (mode === 'late' || mode === 'early') {
    const target = [];
    if (mode === 'late') { for (let i = 1; i <= p; i++) target.push(i); }
    else { for (let i = p; i <= count; i++) target.push(i); }
    const isExact = target.length === set.size && target.every((x) => set.has(x));
    return isExact ? [] : target; // 같은 경계를 다시 누르면 해제
  }
  if (set.has(p)) set.delete(p); else set.add(p);
  return [...set].sort((a, b) => a - b);
}

// 한 학생의 교시 칸 HTML
function periodStripHtml(studentId, st) {
  if (!showsPeriods(st.status)) return '';
  const set = new Set(st.periods || []);
  const color = statusColor(st.status);
  const cells = [];
  for (let p = 1; p <= periodCount; p++) {
    const on = set.has(p);
    const inner = on
      ? `<span class="att-period-cell-idx is-on" style="--att-color:${color}">${p}</span>
         <span class="att-period-cell-slash" style="--att-color:${color}">/</span>`
      : `<span class="att-period-cell-idx">${p}</span>`;
    cells.push(`<button class="att-period-cell${on ? ' is-on' : ''}" data-id="${studentId}" data-p="${p}"
      style="${on ? `--att-color:${color};--att-bg:${color}18` : ''}">${inner}</button>`);
  }
  return `<div class="att-period-strip">
    <span class="att-period-strip-label">교시</span>${cells.join('')}
  </div>`;
}

// 교시 칸만 다시 그림
function rebuildPeriodStrip(studentId, st) {
  const wrap = document.querySelector(`.att-period-wrap[data-id="${studentId}"]`);
  if (wrap) wrap.innerHTML = periodStripHtml(studentId, st);
}

// DB에는 '결과'로 저장, UI에는 '외출'로 표시
const STATUSES = [
  { val: '출석', label: '출석', color: '#22c55e' },
  { val: '지각', label: '지각', color: '#eab308' },
  { val: '조퇴', label: '조퇴', color: '#8b5cf6' },
  { val: '결과', label: '외출', color: '#3b82f6' },
  { val: '결석', label: '결석', color: '#ef4444' },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.val, s]));

const CATEGORY_OPTIONS = ['출석인정', '미인정', '질병'];
const CATEGORY_COLORS = {
  출석: '#22c55e',
  출석인정: 'var(--accent)',
  미인정: '#ef4444',
  질병: '#f59e0b',
};

const STATUS_COLS = [
  { key: 'absent', label: '결석', status: '결석', color: '#ef4444' },
  { key: 'result', label: '외출', status: '결과', color: '#3b82f6' },
  { key: 'late',   label: '지각', status: '지각', color: '#eab308' },
  { key: 'early',  label: '조퇴', status: '조퇴', color: '#8b5cf6' },
];

async function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">출결 관리</h1>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="daily">일일 출결</button>
        <button class="tab-btn" data-tab="stats">월별 통계</button>
      </div>
      <div id="att-content"></div>
    </div>
  `;
}

async function init() {
  const allStudents = await api.getStudents();
  periodCount = Math.min(12, Math.max(1, Number(await api.getSetting('period_count', '7')) || 7));
  const classYear = await api.getSetting('class_year', '');
  const classNum  = await api.getSetting('class_num', '');
  const myClass   = (classYear && classNum) ? `${classYear}학년 ${classNum}반` : '';
  // class_group이 비어있는 학생(기존 학생) 또는 우리 반과 일치하는 학생만 표시
  students = myClass
    ? allStudents.filter(s => !s.class_group || s.class_group === myClass)
    : allStudents;
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      currentTab = button.dataset.tab;
      renderTab();
    };
  });
  renderTab();
}

function renderTab() {
  const content = document.getElementById('att-content');
  if (!content) return;
  if (currentTab === 'daily') renderDaily(content);
  else renderStats(content);
}

async function renderDaily(container) {
  const attendance = await api.getAttendance(currentDate);
  const attendanceMap = Object.fromEntries(attendance.map((row) => [row.student_id, row]));

  // 상태 추적 맵
  const stateMap = {};
  students.forEach((s) => {
    const row = attendanceMap[s.id] || {};
    stateMap[s.id] = {
      status: row.status || '출석',
      category: row.category || '출석',
      reason: row.reason || '',
      periods: parsePeriods(row.note),
    };
  });

  function summaryHtml() {
    const counts = {};
    STATUSES.forEach((s) => { counts[s.val] = 0; });
    Object.values(stateMap).forEach((st) => {
      STATUSES.forEach((s) => { if (hasStatus(st.status, s.val)) counts[s.val]++; });
    });
    return STATUSES.map((s) => `
      <div class="att-summary-chip" style="--att-color:${s.color};--att-bg:${s.color}18;--att-border:${s.color}44">
        <span class="att-summary-dot"></span>
        <span class="att-summary-label">${s.label}</span>
        <strong id="sum-${s.val}" class="att-summary-count">${counts[s.val]}</strong>
      </div>
    `).join('');
  }

  container.innerHTML = `
    <div class="att-toolbar att-mb-10">
      <input type="date" class="input att-date-input" id="att-date" value="${currentDate}">
      <button class="btn btn-secondary btn-sm" id="att-all">전체 출석</button>
      <button class="btn btn-primary btn-sm" id="att-save">저장</button>
      <span id="att-saved-lbl" class="att-saved-lbl">✓ 저장됨</span>
    </div>
    <div id="att-summary" class="att-summary-row">${summaryHtml()}</div>
    <div class="tbl-wrap">
      <table class="att-table">
        <thead>
          <tr>
            <th class="att-col-num">번호</th>
            <th class="att-col-name">이름</th>
            <th class="att-col-status">출결 상태</th>
            <th class="att-col-cat">범주</th>
            <th>사유</th>
          </tr>
        </thead>
        <tbody id="att-tbody"></tbody>
      </table>
    </div>
  `;

  buildDailyRows(students, stateMap);

  function refreshSummary() {
    const counts = {};
    STATUSES.forEach((s) => { counts[s.val] = 0; });
    Object.values(stateMap).forEach((st) => {
      STATUSES.forEach((s) => { if (hasStatus(st.status, s.val)) counts[s.val]++; });
    });
    STATUSES.forEach((s) => {
      const el = document.getElementById(`sum-${s.val}`);
      if (el) el.textContent = counts[s.val];
    });
  }

  // 상태 버튼 이벤트 위임 (복합 선택: 지각+조퇴 등 가능, 출석·결석은 단독)
  const tbody = document.getElementById('att-tbody');
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.att-status-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const val = btn.dataset.val;
    stateMap[id].status = toggleStatus(stateMap[id].status, val);
    if (!isNonAttendance(stateMap[id].status)) stateMap[id].category = '출석';
    else if (stateMap[id].category === '출석') stateMap[id].category = '출석인정';

    // 버튼 스타일 업데이트
    tbody.querySelectorAll(`.att-status-btn[data-id="${id}"]`).forEach((b) => {
      const active = hasStatus(stateMap[id].status, b.dataset.val);
      b.classList.toggle('is-active', active);
    });

    // 범주 select 표시/숨김
    const catEl = tbody.querySelector(`.att-cat[data-id="${id}"]`);
    if (catEl) {
      catEl.classList.toggle('att-hidden', !isNonAttendance(stateMap[id].status));
      if (isNonAttendance(stateMap[id].status)) catEl.value = stateMap[id].category;
    }

    // 교시 칸 갱신 (지각·조퇴·외출이 아니면 사선 초기화)
    if (!showsPeriods(stateMap[id].status)) stateMap[id].periods = [];
    rebuildPeriodStrip(id, stateMap[id]);

    refreshSummary();
    saveSingleFromState(id, stateMap[id]);
  });

  // 교시 칸 클릭 (지각=앞에서부터, 조퇴=뒤에서부터, 외출=개별 토글)
  tbody.addEventListener('click', (e) => {
    const cell = e.target.closest('.att-period-cell');
    if (!cell) return;
    const id = cell.dataset.id;
    const p = Number(cell.dataset.p);
    const st = stateMap[id];
    st.periods = nextPeriods(st.periods, p, periodFillMode(st.status), periodCount);
    rebuildPeriodStrip(id, st);
    saveSingleFromState(id, st);
  });

  document.getElementById('att-date').onchange = async (event) => {
    currentDate = event.target.value;
    renderDaily(container);
  };

  document.getElementById('att-all').onclick = async () => {
    for (const student of students) {
      await api.setAttendance({ student_id: student.id, date: currentDate, period: 0, category: '출석', status: '출석', reason: '' });
    }
    toast('전체 출석 처리 완료', 'success');
    renderDaily(container);
  };

  document.getElementById('att-save').onclick = async () => {
    await saveAll(stateMap);
    const label = document.getElementById('att-saved-lbl');
    if (label) { label.style.display = ''; setTimeout(() => { label.style.display = 'none'; }, 2000); }
    toast('출결을 저장했습니다.', 'success');
  };
}

function buildDailyRows(studentList, stateMap) {
  const tbody = document.getElementById('att-tbody');
  if (!tbody) return;

  tbody.innerHTML = studentList.map((student) => {
    const st = stateMap[student.id];
    const statusBtns = STATUSES.map((s) => {
      const active = hasStatus(st.status, s.val);
      return `<button class="att-status-btn${active ? ' is-active' : ''}" data-id="${student.id}" data-val="${s.val}"
        style="--att-color:${s.color}"
      >${s.label}</button>`;
    }).join('');

    const catOpts = CATEGORY_OPTIONS.map((o) =>
      `<option value="${o}"${o === st.category ? ' selected' : ''}>${o}</option>`
    ).join('');

    return `
      <tr class="att-row">
        <td class="att-cell-center att-cell-sm">${student.number}</td>
        <td class="att-cell-strong att-cell-sm">${escapeHtml(student.name)}</td>
        <td>
          <div class="att-status-row">${statusBtns}</div>
          <div class="att-period-wrap" data-id="${student.id}">${periodStripHtml(student.id, st)}</div>
        </td>
        <td>
          <select class="input att-cat att-cat-select${isNonAttendance(st.status) ? '' : ' att-hidden'}" data-id="${student.id}"
            style="--att-cat-color:${CATEGORY_COLORS[st.category] || 'var(--border)'}">
            ${catOpts}
          </select>
        </td>
        <td>
          <input class="input att-reason att-reason-input" data-id="${student.id}"
            placeholder="사유" value="${escapeHtml(st.reason)}">
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.att-cat').forEach((select) => {
    select.onchange = () => {
      stateMap[select.dataset.id].category = select.value;
      select.style.setProperty('--att-cat-color', CATEGORY_COLORS[select.value] || 'var(--border)');
      saveSingleFromState(select.dataset.id, stateMap[select.dataset.id]);
    };
  });

  tbody.querySelectorAll('.att-reason').forEach((input) => {
    let composing = false;
    let saveTimer = null;
    const flushReason = () => { stateMap[input.dataset.id].reason = input.value.trim(); };
    const queueSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (!composing) {
          flushReason();
          saveSingleFromState(input.dataset.id, stateMap[input.dataset.id]);
        }
      }, 500);
    };
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; flushReason(); queueSave(); });
    // 즉시 stateMap 반영 — 상태 버튼 클릭 등 다른 저장 경로에서도 최신 사유가 반영됨
    input.addEventListener('input', () => { if (!composing) flushReason(); queueSave(); });
    input.addEventListener('blur', () => {
      if (saveTimer) clearTimeout(saveTimer);
      flushReason();
      saveSingleFromState(input.dataset.id, stateMap[input.dataset.id]);
    });
  });
}

async function saveSingleFromState(studentId, st) {
  await api.setAttendance({
    student_id: Number(studentId),
    date: currentDate,
    period: 0,
    category: st.status === '출석' ? '출석' : st.category,
    status: st.status,
    reason: st.reason,
    note: periodsToNote(st.periods),
  });
}

async function saveAll(stateMap) {
  const tbody = document.getElementById('att-tbody');
  if (tbody && document.activeElement && tbody.contains(document.activeElement)) {
    document.activeElement.blur();
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  for (const [id, st] of Object.entries(stateMap)) {
    await saveSingleFromState(id, st);
  }
}

async function renderStats(container) {
  const now = new Date();
  container.innerHTML = `
    <div class="att-toolbar att-mb-14">
      <input type="number" class="input att-year-input" id="sy" value="${now.getFullYear()}">년
      <select class="input att-month-select" id="sm">
        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === now.getMonth() + 1 ? ' selected' : ''}>${i + 1}월</option>`).join('')}
      </select>
      <button class="btn btn-primary btn-sm" id="sl">조회</button>
      <button class="btn btn-secondary btn-sm" id="sl-all">전체 내역</button>
    </div>
    <div id="stats-summary" class="att-stats-summary-row"></div>
    <div class="tbl-wrap">
      <table class="att-stats-table">
        <thead>
          <tr>
            <th class="att-stats-col-num">번호</th>
            <th class="att-stats-col-name">이름</th>
            ${STATUS_COLS.map((c) => `
              <th class="att-stats-col-status">
                <span class="att-stats-col-head">
                  <span class="att-stats-dot" style="--att-color:${c.color}"></span>
                  ${c.label}
                </span>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody id="st-body"></tbody>
      </table>
    </div>
  `;

  async function load() {
    const year = Number(document.getElementById('sy').value);
    const month = Number(document.getElementById('sm').value);
    const stats = await api.getAttendanceStats(year, month);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    const records = await api.getAttendanceRange(start, end);
    const recordMap = {};
    records.forEach((r) => {
      if (!recordMap[r.student_id]) recordMap[r.student_id] = [];
      recordMap[r.student_id].push(r);
    });

    // 전체 합계 카드
    const totals = {};
    STATUS_COLS.forEach((c) => { totals[c.key] = 0; });
    stats.forEach((row) => { STATUS_COLS.forEach((c) => { totals[c.key] += row[c.key] || 0; }); });

    document.getElementById('stats-summary').innerHTML = STATUS_COLS.map((c) => `
      <div class="att-stat-card" style="--att-color:${c.color};--att-bg:${c.color}15;--att-border:${c.color}44">
        <div class="att-stat-card-label">${c.label}</div>
        <div class="att-stat-card-value">${totals[c.key]}</div>
        <div class="att-stat-card-sub">누계</div>
      </div>
    `).join('');

    document.getElementById('st-body').innerHTML = stats.map((row) => {
      const cells = STATUS_COLS.map((c) => {
        const count = row[c.key] || 0;
        if (count === 0) {
          return `<td class="att-cell-center"><span class="att-dash">—</span></td>`;
        }
        return `
          <td class="att-cell-center">
            <button class="att-badge-num" data-sid="${row.student_id || row.id}" data-status="${c.status}" data-name="${escapeHtml(row.name)}" data-label="${c.label}" data-color="${c.color}"
              style="--att-color:${c.color};--att-bg:${c.color}18;--att-border:${c.color}55"
            >${count}</button>
          </td>
        `;
      }).join('');
      return `<tr>
        <td class="att-cell-center">${row.number}</td>
        <td class="att-cell-strong">${escapeHtml(row.name)}</td>
        ${cells}
      </tr>`;
    }).join('');

    document.querySelectorAll('.att-badge-num[data-status]').forEach((button) => {
      button.onclick = () => {
        const sid = Number(button.dataset.sid);
        const status = button.dataset.status;
        const name = button.dataset.name;
        const label = button.dataset.label;
        const color = button.dataset.color;
        const studentRecords = (recordMap[sid] || [])
          .filter((r) => hasStatus(r.status, status) && r.category !== '출석')
          .sort((a, b) => a.date.localeCompare(b.date));

        const rows = studentRecords.length
          ? studentRecords.map((r, i) => `
              <tr class="att-modal-row${i % 2 === 1 ? ' att-modal-row-alt' : ''}">
                <td class="att-modal-cell att-modal-cell-nowrap">${formatDate(r.date)}</td>
                <td class="att-modal-cell">
                  <span class="att-pill" style="--att-color:${CATEGORY_COLORS[r.category] || color}">${r.category} · ${label}</span>
                  ${formatPeriods(r.note) ? `<span class="att-period-note">${formatPeriods(r.note)}</span>` : ''}
                </td>
                <td class="att-modal-cell att-modal-cell-muted">${escapeHtml(r.reason || '—')}</td>
              </tr>
            `).join('')
          : `<tr><td colspan="3" class="att-modal-empty">기록 없음</td></tr>`;

        showModal(`
          <div class="modal-header">
            <h3 class="modal-title">
              <span class="att-modal-dot" style="--att-color:${color}"></span>
              ${name} · ${label} 내역
            </h3>
            <button class="btn btn-secondary btn-sm" data-close>닫기</button>
          </div>
          <table class="att-modal-table att-mt-16">
            <colgroup><col style="width:110px"><col style="width:140px"><col></colgroup>
            <thead>
              <tr class="att-modal-thead-row">
                <th class="att-modal-th">날짜</th>
                <th class="att-modal-th">유형</th>
                <th class="att-modal-th">사유</th>
              </tr>
            </thead>
            <tbody class="att-modal-tbody">${rows}</tbody>
          </table>
        `);
      };
    });
    const allBtn = document.getElementById('sl-all');
    if (allBtn) allBtn.onclick = () => showAllRecords(stats, recordMap, year, month);
  }

  document.getElementById('sl').onclick = load;
  await load();
}

// 해당 월의 모든 학생 비출석 내역을 날짜별로 묶어 보여줌 (NEIS 일별 입력 흐름에 맞춤)
function showAllRecords(stats, recordMap, year, month) {
  // 날짜 → [{번호, 이름, 기록}] 형태로 그룹화
  const byDate = {};
  stats.forEach((s) => {
    const sid = s.student_id || s.id;
    (recordMap[sid] || [])
      .filter((r) => isNonAttendance(r.status) && r.category !== '출석')
      .forEach((r) => {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push({ number: s.number || 0, name: s.name, record: r });
      });
  });

  const dates = Object.keys(byDate).sort((a, b) => a.localeCompare(b));
  const sections = [];
  dates.forEach((date) => {
    const entries = byDate[date].sort((a, b) => a.number - b.number);
    sections.push(`
      <tr class="att-modal-date-row">
        <td colspan="4" class="att-modal-date-cell">📅 ${formatDate(date)}</td>
      </tr>
    `);
    entries.forEach(({ number, name, record: r }) => {
      const color = statusColor(r.status);
      sections.push(`
        <tr class="att-modal-row">
          <td class="att-modal-cell-sm att-modal-cell-sm-center">${number}</td>
          <td class="att-modal-cell-sm att-modal-cell-sm-strong">${escapeHtml(name)}</td>
          <td class="att-modal-cell-sm">
            <span class="att-pill-sm" style="--att-color:${color}">${r.category} · ${statusLabels(r.status)}</span>
            ${formatPeriods(r.note) ? `<span class="att-period-note">${formatPeriods(r.note)}</span>` : ''}
          </td>
          <td class="att-modal-cell-sm att-modal-cell-sm-muted">${escapeHtml(r.reason || '—')}</td>
        </tr>
      `);
    });
  });

  const body = sections.length
    ? sections.join('')
    : `<tr><td colspan="4" class="att-modal-empty">해당 월 비출석 내역이 없습니다.</td></tr>`;

  showModal(`
    <div class="modal-header">
      <h3 class="modal-title">${year}년 ${month}월 전체 출결 내역 (일별)</h3>
      <button class="btn btn-secondary btn-sm" data-close>닫기</button>
    </div>
    <div class="att-modal-scroll att-mt-16">
      <table class="att-modal-table">
        <colgroup><col style="width:50px"><col style="width:100px"><col style="width:160px"><col></colgroup>
        <thead>
          <tr class="att-modal-thead-row-sticky">
            <th class="att-modal-th-sm att-modal-th-sm-center">번호</th>
            <th class="att-modal-th-sm">이름</th>
            <th class="att-modal-th-sm">유형</th>
            <th class="att-modal-th-sm">사유</th>
          </tr>
        </thead>
        <tbody class="att-modal-tbody">${body}</tbody>
      </table>
    </div>
  `);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.registerPage('attendance', { render, init, refresh: init });
})();
