(function () {
'use strict';

const SETTING_KEY = 'seating_data';
let rows = 5, cols = 6;
let assignments = []; // 길이 = rows*cols, 값 = studentId or null
let blocked = [];     // 길이 = rows*cols, true = 사용 안 함(막힌 자리)
let locked = [];      // 길이 = rows*cols, true = 고정(랜덤 배치 시 유지)
let students = [];   // 우리 반 학생 목록
let selectedIdx = null; // 선택된 좌석 인덱스
let mode = 'move';   // 'move' | 'lock' | 'block'

// ── 초기화 ──────────────────────────────────────────────
async function render(c) {
  c.innerHTML = `
  <div class="page-wrap">
    <div class="page-header">
      <h1 class="page-header-title">🪑 자리 배치</h1>
      <div class="page-header-actions">
        <label style="font-size:13px;color:var(--text2)">행
          <input type="number" id="seat-rows" class="input" min="1" max="12" style="width:54px;margin:0 8px 0 4px">
        </label>
        <label style="font-size:13px;color:var(--text2)">열
          <input type="number" id="seat-cols" class="input" min="1" max="12" style="width:54px;margin:0 12px 0 4px">
        </label>
        <button class="btn btn-secondary" id="seat-resize">적용</button>
        <button class="btn btn-secondary" id="seat-mode-lock">🔒 고정</button>
        <button class="btn btn-secondary" id="seat-mode-block">🚫 자리 막기</button>
        <button class="btn btn-secondary" id="seat-random">🔀 랜덤 배치</button>
        <button class="btn btn-secondary" id="seat-reset">초기화</button>
        <button class="btn btn-primary" id="seat-img">📷 이미지 저장</button>
      </div>
    </div>
    <div id="seat-info" style="font-size:12px;color:var(--text3);margin-bottom:8px"></div>
    <div id="seat-hint" style="font-size:12px;color:var(--accent);margin-bottom:8px;min-height:16px"></div>
    <div id="seat-wrap">
      <div style="font-size:11px;color:var(--text3);text-align:center;margin-bottom:4px">↑ 교실 뒤쪽</div>
      <div id="seat-grid"></div>
      <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:4px">교사 시점 (칠판 쪽) ↓</div>
      <div id="seat-board">📋 칠판</div>
    </div>
  </div>`;
}

async function init() {
  // 우리 반 학생 로드
  const allStudents = await api.getStudents();
  const classYear   = await api.getSetting('class_year', '');
  const classNum    = await api.getSetting('class_num', '');
  const myClass     = (classYear && classNum) ? `${classYear}학년 ${classNum}반` : '';
  students = myClass
    ? allStudents.filter(s => !s.class_group || s.class_group === myClass)
    : allStudents;
  students.sort((a, b) => a.number - b.number);

  // 저장된 배치 불러오기
  try {
    const raw = await api.getSetting(SETTING_KEY, '');
    if (raw) {
      const d = JSON.parse(raw);
      rows = d.rows || 5;
      cols = d.cols || 6;
      assignments = d.assignments || [];
      blocked = d.blocked || [];
      locked  = d.locked  || [];
    }
  } catch (_) {}

  // 기본값 / 길이 보정
  const size = rows * cols;
  if (!assignments.length) assignments = Array(size).fill(null);
  blocked = normalizeBool(blocked, size);
  locked  = normalizeBool(locked, size);

  document.getElementById('seat-rows').value = rows;
  document.getElementById('seat-cols').value = cols;

  document.getElementById('seat-resize').onclick     = applySize;
  document.getElementById('seat-random').onclick     = randomize;
  document.getElementById('seat-reset').onclick      = resetSeats;
  document.getElementById('seat-img').onclick        = downloadImage;
  document.getElementById('seat-mode-lock').onclick  = () => toggleMode('lock');
  document.getElementById('seat-mode-block').onclick = () => toggleMode('block');

  renderGrid();
  updateInfo();
  updateModeButtons();
}

// 불리언 배열을 size 길이로 보정
function normalizeBool(arr, size) {
  const out = Array(size).fill(false);
  for (let i = 0; i < Math.min(arr.length, size); i++) out[i] = !!arr[i];
  return out;
}

// ── 모드 전환 ────────────────────────────────────────────
function toggleMode(m) {
  mode = (mode === m) ? 'move' : m;
  selectedIdx = null;
  updateModeButtons();
  renderGrid();
  updateInfo();
}

function updateModeButtons() {
  const setActive = (id, active) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('btn-primary', active);
    el.classList.toggle('btn-secondary', !active);
  };
  setActive('seat-mode-lock', mode === 'lock');
  setActive('seat-mode-block', mode === 'block');

  const hint = document.getElementById('seat-hint');
  if (hint) {
    hint.textContent =
      mode === 'lock'  ? '🔒 고정 모드: 학생이 앉은 자리를 클릭하면 고정/해제됩니다. (랜덤 배치 시 그대로 유지)' :
      mode === 'block' ? '🚫 자리 막기 모드: 빈 자리를 클릭하면 사용 안 함(✕)으로 막거나 풉니다.' :
      '';
  }
}

// ── 크기 변경 ────────────────────────────────────────────
function applySize() {
  const newRows = Math.max(1, Math.min(12, parseInt(document.getElementById('seat-rows').value) || rows));
  const newCols = Math.max(1, Math.min(12, parseInt(document.getElementById('seat-cols').value) || cols));
  const newSize = newRows * newCols;
  const old = assignments.slice();
  const oldBlocked = blocked.slice();
  const oldLocked  = locked.slice();
  assignments = Array(newSize).fill(null);
  blocked = Array(newSize).fill(false);
  locked  = Array(newSize).fill(false);
  for (let i = 0; i < Math.min(old.length, newSize); i++) {
    assignments[i] = old[i];
    blocked[i] = !!oldBlocked[i];
    locked[i]  = !!oldLocked[i];
  }
  rows = newRows; cols = newCols;
  selectedIdx = null;
  renderGrid();
  updateInfo();
  save();
}

// ── 랜덤 배치 ────────────────────────────────────────────
function randomize() {
  const size = rows * cols;
  // 고정된 자리에 앉은 학생은 그대로 유지
  const lockedIds = new Set();
  for (let i = 0; i < size; i++) {
    if (locked[i] && assignments[i]) lockedIds.add(assignments[i]);
  }
  // 배치 대상 = 고정되지 않은 학생
  const ids = students.map(s => s.id).filter(id => !lockedIds.has(id));
  // Fisher-Yates shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const next = Array(size).fill(null);
  // 고정 자리 먼저 유지
  for (let i = 0; i < size; i++) {
    if (locked[i] && assignments[i]) next[i] = assignments[i];
  }
  // 나머지 학생을 사용 가능한(막히지 않고 비어있는) 자리에 채움
  let k = 0;
  for (let i = 0; i < size && k < ids.length; i++) {
    if (blocked[i] || next[i]) continue;
    next[i] = ids[k++];
  }
  assignments = next;
  selectedIdx = null;
  renderGrid();
  updateInfo();
  save();
  if (k < ids.length) {
    toast(`자리가 부족해 ${ids.length - k}명이 미배치되었습니다.`, 'warning');
  } else {
    toast('랜덤 배치 완료!', 'success');
  }
}

// ── 초기화 ───────────────────────────────────────────────
function resetSeats() {
  if (!confirm('모든 자리 배치와 고정을 초기화하시겠습니까? (막아둔 자리는 유지됩니다)')) return;
  const size = rows * cols;
  assignments = Array(size).fill(null);
  locked = Array(size).fill(false);
  selectedIdx = null;
  mode = 'move';
  updateModeButtons();
  renderGrid();
  updateInfo();
  save();
}

// ── 교사 시점 표시 순서 (행 역순 + 열 역순 = 180° 회전) ──
function teacherViewOrder() {
  const order = [];
  for (let r = rows - 1; r >= 0; r--)
    for (let c = cols - 1; c >= 0; c--)
      order.push(r * cols + c);
  return order;
}

// ── 그리드 렌더 (교사 시점: 칠판 아래, 학생 위쪽부터) ───
function renderGrid() {
  const grid = document.getElementById('seat-grid');
  if (!grid) return;
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';

  for (const i of teacherViewOrder()) {
    const isBlocked = blocked[i];
    const sid = isBlocked ? null : assignments[i];
    const s   = sid ? studentMap[sid] : null;
    const div = document.createElement('div');
    div.className = 'seat-cell'
      + (selectedIdx === i ? ' selected' : '')
      + (isBlocked ? ' blocked' : (s ? '' : ' empty'))
      + (locked[i] && s ? ' locked' : '');
    div.dataset.idx = i;
    if (isBlocked) {
      div.innerHTML = `<span class="seat-x">✕</span>`;
    } else if (s) {
      div.innerHTML = `${locked[i] ? '<span class="seat-lock">🔒</span>' : ''}`
        + `<span class="seat-num">${s.number}번</span><span class="seat-name">${s.name}</span>`;
    } else {
      div.innerHTML = `<span class="seat-empty">빈 자리</span>`;
    }
    div.onclick = () => handleSeatClick(i);
    grid.appendChild(div);
  }
}

// ── 클릭: 모드별 동작 ────────────────────────────────────
function handleSeatClick(idx) {
  // 자리 막기 모드
  if (mode === 'block') {
    if (assignments[idx] && !blocked[idx]) {
      toast('학생이 배치된 자리는 막을 수 없습니다. 먼저 자리를 비워주세요.', 'warning');
      return;
    }
    blocked[idx] = !blocked[idx];
    if (blocked[idx]) locked[idx] = false; // 막힌 자리는 고정 해제
    renderGrid();
    updateInfo();
    save();
    return;
  }

  // 고정 모드
  if (mode === 'lock') {
    if (!assignments[idx] || blocked[idx]) {
      toast('학생이 앉아 있는 자리만 고정할 수 있습니다.', 'warning');
      return;
    }
    locked[idx] = !locked[idx];
    renderGrid();
    updateInfo();
    save();
    return;
  }

  // 이동(스왑) 모드 — 막힌 자리는 선택 불가
  if (blocked[idx]) return;

  if (selectedIdx === null) {
    selectedIdx = idx;
  } else if (selectedIdx === idx) {
    selectedIdx = null;
  } else if (blocked[selectedIdx]) {
    selectedIdx = idx;
  } else {
    // 스왑 (고정 정보는 자리 위치에 남고 학생만 교환)
    [assignments[selectedIdx], assignments[idx]] = [assignments[idx], assignments[selectedIdx]];
    selectedIdx = null;
    save();
  }
  renderGrid();
  updateInfo();
}

// ── 정보 표시 ────────────────────────────────────────────
function updateInfo() {
  const el = document.getElementById('seat-info');
  if (!el) return;
  const total      = rows * cols;
  const blockedCnt = blocked.filter(Boolean).length;
  const usable     = total - blockedCnt;
  const assigned   = assignments.filter((id, i) => id && !blocked[i]).length;
  const lockedCnt  = locked.filter((v, i) => v && assignments[i] && !blocked[i]).length;
  const unassigned = students.filter(s => !assignments.includes(s.id)).length;
  let txt = `총 ${total}자리 · 사용가능 ${usable} · 배치됨 ${assigned}명 · 미배치 ${unassigned}명`;
  if (blockedCnt) txt += ` · 막힌자리 ${blockedCnt}`;
  if (lockedCnt)  txt += ` · 고정 ${lockedCnt}`;
  if (mode === 'move' && selectedIdx !== null) txt += ' · 다른 자리를 선택하면 스왑됩니다';
  el.textContent = txt;
}

// ── 저장 ─────────────────────────────────────────────────
async function save() {
  await api.setSetting(SETTING_KEY, JSON.stringify({ rows, cols, assignments, blocked, locked }));
}

// ── 이미지 저장 ──────────────────────────────────────────
async function downloadImage() {
  const classYear = await api.getSetting('class_year', '');
  const classNum  = await api.getSetting('class_num', '');
  const title     = (classYear && classNum) ? `${classYear}학년 ${classNum}반 자리 배치` : '자리 배치';

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const PAD  = 28, GAP = 10;
  const CW   = 90, CH = 54;   // 셀 크기
  const BOARD_H = 40, TITLE_H = 40;
  const W = PAD * 2 + cols * CW + (cols - 1) * GAP;
  // 위: 제목 / 중간: 학생 좌석 / 아래: 칠판 + 패딩
  const H = TITLE_H + GAP + rows * CH + (rows - 1) * GAP + GAP + BOARD_H + PAD;

  const canvas = document.createElement('canvas');
  const dpr    = 2; // 고해상도
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 배경
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, W, H);

  // 제목
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 16px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, 26);

  // 좌석 (교사 시점: 뒷줄 → 앞줄, 오른쪽→왼쪽)
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i   = r * cols + c;
      const isBlocked = blocked[i];
      const sid = isBlocked ? null : assignments[i];
      const s   = sid ? studentMap[sid] : null;
      // 화면상 위치: r=rows-1이 displayRow=0(맨 위), c=cols-1이 displayCol=0(맨 왼)
      const displayRow = (rows - 1 - r);
      const displayCol = (cols - 1 - c);
      const x   = PAD + displayCol * (CW + GAP);
      const y   = TITLE_H + GAP + displayRow * (CH + GAP);

      // 막힌 자리: 회색 + ✕
      if (isBlocked) {
        ctx.fillStyle = '#e5e7eb';
        roundRect(ctx, x, y, CW, CH, 6);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth   = 1;
        roundRectStroke(ctx, x, y, CW, CH, 6);
        ctx.fillStyle = '#9ca3af';
        ctx.font      = 'bold 20px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✕', x + CW / 2, y + CH / 2 + 7);
        continue;
      }

      // 카드 배경
      ctx.fillStyle = s ? '#ffffff' : '#f0f0f0';
      roundRect(ctx, x, y, CW, CH, 6);

      // 카드 테두리 (고정된 자리는 더 진하게)
      ctx.strokeStyle = s ? (locked[i] ? '#1d4ed8' : '#4f80e1') : '#d0d0d0';
      ctx.lineWidth   = s ? (locked[i] ? 2 : 1.5) : 1;
      roundRectStroke(ctx, x, y, CW, CH, 6);

      if (s) {
        if (locked[i]) {
          ctx.font      = '11px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('🔒', x + 5, y + 14);
        }
        ctx.fillStyle = '#6b7280';
        ctx.font      = '11px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${s.number}번`, x + CW / 2, y + 18);
        ctx.fillStyle = '#111827';
        ctx.font      = 'bold 14px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        ctx.fillText(s.name, x + CW / 2, y + 36);
      } else {
        ctx.fillStyle = '#c0c0c0';
        ctx.font      = '12px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('빈 자리', x + CW / 2, y + CH / 2 + 4);
      }
    }
  }

  // 칠판 (이미지 맨 아래)
  const bx = PAD, bh = BOARD_H;
  const by = TITLE_H + GAP + rows * CH + (rows - 1) * GAP + GAP;
  const bw = W - PAD * 2;
  ctx.fillStyle = '#2d6a4f';
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📋 칠판', W / 2, by + bh / 2 + 5);

  // 다운로드
  const url = canvas.toDataURL('image/png');
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `자리배치_${title.replace(/\s/g, '_')}.png`;
  a.click();
  toast('이미지로 저장되었습니다!', 'success');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function roundRectStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

window.registerPage('seating', { render, init });
})();
