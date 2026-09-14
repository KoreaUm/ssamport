(function(){
'use strict';
// ── 상태
let calYear, calMonth, calEvents={}, clockTimer;
let neisWeekOffset = 0;
let editMode = false;
const LAYOUT_KEY = 'dashboard_layout_v4';
const GRID_SIZE = 8;
const CARD_MIN_WIDTH = 120;
const CARD_MIN_HEIGHT = 70;
const CUSTOM_EVENT_KEY = 'custom_calendar_events';
const TEACHER_TT_NUMBER_COLOR_ENABLED_KEY = 'teacher_timetable_number_colors_enabled';
const TEACHER_TT_NUMBER_COLORS_KEY = 'teacher_timetable_number_colors';

// 카드 ID → 표시 라벨 매핑
const WIDGET_LABELS = {
  'cal-card':            '📅 달력',
  'clock-card':          '🕐 시계/날씨',
  'w-todo':              '✅ 할일',
  'w-sched':             '📅 학사일정',
  'w-meal':              '🍱 급식',
  'w-dday-setup':        '📅 D-Day 설정',
  'w-dday-list':         '📅 D-Day 목록',
  'w-personal-tt':       '🗓️ 개인 시간표',
  'w-teacher-contact':   '📞 교사 연락처',
  'w-student-contact':   '👤 학생 연락처',
  'w-shortcuts':         '🔗 바로가기',
  'w-school-tt':         '🏫 학급 시간표',
  'w-ai':                '🤖 AI 할일 추출',
  'w-sticky':            '📝 스티커 메모',
};

const DEFAULT_POSITIONS = {
  'cal-card':           {x:0,   y:0,   w:390, h:380},
  'clock-card':         {x:0,   y:388, w:390, h:110},
  'w-todo':             {x:398, y:0,   w:350, h:280},
  'w-sched':            {x:398, y:288, w:350, h:180},
  'w-meal':             {x:398, y:476, w:350, h:220},
  'w-ai':               {x:398, y:704, w:350, h:160},
  'w-shortcuts':        {x:756, y:0,   w:340, h:120},
  'w-dday-setup':       {x:756, y:128, w:340, h:60},
  'w-school-tt':        {x:756, y:196, w:340, h:310},
  'w-personal-tt':      {x:756, y:514, w:340, h:280},
  'w-teacher-contact':  {x:756, y:802, w:165, h:110},
  'w-student-contact':  {x:929, y:802, w:165, h:110},
  'w-dday-list':        {x:756, y:920, w:340, h:150},
  'w-sticky':           {x:1104, y:0,   w:340, h:280},
};

async function syncCloudIfPossible(){
  if(!window.syncCloudNow) return;
  try{
    await window.syncCloudNow();
  }catch(_){}
}

function dedupeCalendarEvents(){
  for(const dateKey of Object.keys(calEvents||{})){
    const seen=new Set();
    calEvents[dateKey]=(calEvents[dateKey]||[]).filter(ev=>{
      const key=[
        ev.source||'',
        ev.date||dateKey,
        String(ev.name||'').trim(),
        ev.color||'',
        ev.is_holiday?'holiday':'normal'
      ].join('__');
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

// ─────────────────────────────────────────────────────────
// render
// ─────────────────────────────────────────────────────────
async function render(c){
  const t = new Date();
  calYear = t.getFullYear();
  calMonth = t.getMonth()+1;
  c.innerHTML = `
<div id="dashboard">

  <div class="card sb-card" id="cal-card">
    <div class="cal-header">
      <button class="sb-dropdown-btn">📅 캘린더 ▾</button>
      <div class="cal-nav-center">
        <button class="cal-nav-btn" id="cal-prev">◀</button>
        <span class="cal-month-lbl" id="cal-month-lbl"></span>
        <button class="cal-nav-btn" id="cal-next">▶</button>
        <button class="cal-today-btn" id="cal-today-btn">오늘</button>
      </div>
      <button class="btn btn-secondary btn-xs" id="cal-add-btn">+ 추가</button>
      <button class="cal-tool-btn" id="cal-refresh-btn" title="새로고침">↻</button>
    </div>
    <div class="cal-dow-row">
      <span class="cal-dow cal-dow-sun">일</span>
      <span class="cal-dow">월</span><span class="cal-dow">화</span>
      <span class="cal-dow">수</span><span class="cal-dow">목</span>
      <span class="cal-dow">금</span>
      <span class="cal-dow cal-dow-sat">토</span>
    </div>
    <div class="cal-grid" id="cal-grid"></div>
  </div>

  <div class="card sb-card" id="clock-card">
    <div class="clock-inner">
      <div>
        <div id="clock-time"></div>
        <div id="clock-date"></div>
      </div>
      <div class="weather-right">
        <div id="weather-icon">☁️</div>
        <div id="weather-temp">--°C</div>
        <div id="weather-loc"></div>
        <div id="weather-air"></div>
      </div>
    </div>
  </div>

  <div class="card sb-card" id="w-todo" data-widget="todo" style="overflow:hidden;display:flex;flex-direction:column">
    <div class="card-header">
      <span class="card-title">✅ 오늘의 할일</span>
      <div style="display:flex;align-items:center;gap:5px">
        <button class="btn btn-secondary btn-xs" id="todo-sort-btn" onclick="window.__dtTogSort()" title="마감일 순으로 정렬">마감순↑</button>
        <button class="sb-sel" id="todo-cleanup-btn" onclick="window.__dtTogHideDone()" title="완료된 할일 숨기기" style="cursor:pointer;font-size:13px;padding:0 6px">✅</button>
        <button class="btn btn-primary btn-xs" id="todo-add-btn" onclick="window.__dtAdd('')">+ 추가</button>
      </div>
    </div>
    <div class="scroll-area" id="todo-by-date" style="flex:1;padding:0 0 6px"></div>
  </div>

  <div class="card sb-card" id="w-sched" data-widget="sched" style="display:flex;flex-direction:column">
    <div class="card-header">
      <div style="display:flex;align-items:center;gap:4px">
        <button class="cal-nav-btn" id="sched-prev">◀</button>
        <span class="card-title" id="sched-title">📅 학사일정</span>
        <button class="cal-nav-btn" id="sched-next">▶</button>
      </div>
    </div>
    <div class="scroll-area" id="sched-list" style="padding:0 12px 8px;flex:1"></div>
  </div>

  <div class="card sb-card" id="w-meal" data-widget="meal" style="display:flex;flex-direction:column">
    <div class="card-header">
      <span class="card-title">🍱 오늘의 급식</span>
      <select class="sb-sel" id="meal-date-sel" style="max-width:130px"></select>
    </div>
    <div class="scroll-area" id="meal-list" style="padding:0 10px 8px;flex:1"></div>
  </div>

  <div class="card sb-card dday-setup-card" id="w-dday-setup" data-widget="dday-setup">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px">
      <span class="card-title">📅 D-Day 설정</span>
      <button class="btn btn-primary btn-xs" id="dday-add-btn">+ 추가</button>
    </div>
  </div>

  <div class="card sb-card" id="w-personal-tt" data-widget="personal-tt">
    <div class="card-header">
      <span class="card-title">🗓️ 개인 시간표</span>
      <div style="display:flex;align-items:center;gap:4px">
        <label class="toggle-switch toggle-switch-sm" title="같은 번호는 같은 색으로 표시">
          <input type="checkbox" id="tt-number-color-toggle">
          <span class="toggle-track"></span>
        </label>
        <button class="btn-icon-flat" onclick="navigateTo('timetable')" title="편집">✏️</button>
      </div>
    </div>
    <div id="tt-grid-wrap" style="padding:2px 8px 8px"></div>
  </div>

  <div class="card sb-card" id="w-teacher-contact" data-widget="teacher-contact" style="overflow:hidden;display:flex;flex-direction:column">
    <div class="card-header" style="padding:8px 10px 0">
      <span class="card-title" style="font-size:11px">📞 교사 연락처</span>
    </div>
    <div style="padding:4px 8px 8px;display:flex;flex-direction:column;flex:1;min-height:0">
      <input class="sb-mini-input" id="teacher-q" placeholder="🔍 검색...">
      <div id="teacher-list" style="margin-top:3px;flex:1;overflow-y:auto;min-height:0"></div>
    </div>
  </div>

  <div class="card sb-card" id="w-student-contact" data-widget="student-contact" style="overflow:hidden;display:flex;flex-direction:column">
    <div class="card-header" style="padding:8px 10px 0">
      <span class="card-title" style="font-size:11px">👤 학생 연락처</span>
    </div>
    <div style="padding:4px 8px 8px;display:flex;flex-direction:column;flex:1;min-height:0">
      <input class="sb-mini-input" id="student-q" placeholder="🔍 검색...">
      <div id="student-list" style="margin-top:3px;flex:1;overflow-y:auto;min-height:0"></div>
    </div>
  </div>

  <div class="card sb-card" id="w-dday-list" data-widget="dday-list">
    <div class="card-header">
      <span class="card-title">📅 D-Day 목록</span>
    </div>
    <div id="dday-list" style="padding:2px 12px 10px;display:flex;flex-direction:column;gap:3px;max-height:100px;overflow-y:auto"></div>
  </div>

  <div class="card sb-card" id="w-shortcuts" data-widget="shortcuts">
    <div class="card-header">
      <span class="card-title">빠른 바로가기</span>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="btn btn-secondary btn-xs" onclick="window.__showShortcutModal()">+ 추가</button>
        <button class="btn-icon-flat" onclick="navigateTo('settings')" title="설정">⚙</button>
      </div>
    </div>
    <div id="shortcut-list" style="padding:4px 12px 12px;display:flex;flex-wrap:wrap;gap:8px"></div>
  </div>

  <div class="card sb-card" id="w-school-tt" data-widget="school-tt" style="overflow:hidden;display:flex;flex-direction:column">
    <div class="card-header">
      <span class="card-title">🏫 학급 시간표</span>
      <div style="display:flex;align-items:center;gap:3px">
        <select class="sb-sel" id="neis-grade-sel" style="width:58px"></select>
        <select class="sb-sel" id="neis-class-sel" style="width:44px"></select>
        <button class="cal-nav-btn" id="neis-prev">◀</button>
        <span id="neis-week-lbl" style="font-size:10px;color:var(--text3);white-space:nowrap;min-width:36px;text-align:center">이번주</span>
        <button class="cal-nav-btn" id="neis-next">▶</button>
      </div>
    </div>
    <div id="neis-tt-wrap" style="padding:0 6px 6px;flex:1;overflow:hidden"></div>
  </div>

  <div class="card sb-card" id="w-ai" data-widget="ai">
    <div class="card-header">
      <span class="card-title">🤖 AI 할일 추출</span>
      <span class="badge badge-accent" style="font-size:10px">카카오톡·공문</span>
    </div>
    <div style="padding:6px 12px 12px;display:flex;flex-direction:column;gap:6px">
      <textarea id="ai-input" class="input" style="height:60px;resize:none;font-size:11px" placeholder="카카오톡 메시지, 공문을 붙여넣으세요..."></textarea>
      <div id="ai-result" style="font-size:11px;color:var(--text2);display:none;padding:4px 0"></div>
      <div style="display:flex;gap:5px">
        <button class="btn btn-primary btn-sm" id="ai-run-btn" style="flex:1;font-size:11px">🤖 AI 추출</button>
        <button class="btn btn-secondary btn-sm" id="ai-clear-btn" style="font-size:11px">지우기</button>
      </div>
    </div>
  </div>

  <div class="card sb-card" id="w-sticky" data-widget="sticky" style="overflow:hidden;display:flex;flex-direction:column">
    <div class="card-header">
      <span class="card-title">📝 스티커 메모</span>
      <button class="btn btn-primary btn-xs" id="sticky-add-btn">+ 추가</button>
    </div>
    <div id="sticky-widget-list" style="flex:1;overflow-y:auto;padding:4px 8px 8px;display:flex;flex-direction:column;gap:6px"></div>
    <div style="padding:4px 8px 8px;text-align:center">
      <button class="btn btn-secondary btn-xs" onclick="navigateTo('sticky_notes')" style="width:100%;font-size:11px">전체 보기 →</button>
    </div>
  </div>

</div>`;
}

// ─────────────────────────────────────────────────────────
// init
// ─────────────────────────────────────────────────────────
async function init(){
  document.getElementById('cal-prev').onclick = () => changeMonth(-1);
  document.getElementById('cal-next').onclick = () => changeMonth(1);
  document.getElementById('cal-today-btn').onclick = goToday;
  document.getElementById('cal-add-btn').onclick = () => openDashboardCalendarEventPrompt();
  document.getElementById('cal-refresh-btn').onclick = () => { calEvents={}; loadNeisCalendar(); };
  document.querySelector('.sb-dropdown-btn').onclick = () => navigateTo('school_calendar');
  document.getElementById('sched-prev').onclick = () => changeMonth(-1);
  document.getElementById('sched-next').onclick = () => changeMonth(1);
  document.getElementById('dday-add-btn').onclick = showDdayModal;
  document.getElementById('teacher-q').oninput = e => refreshTeachers(e.target.value);
  document.getElementById('student-q').oninput = e => refreshStudents(e.target.value);
  document.getElementById('tt-number-color-toggle')?.addEventListener('change', toggleTeacherTimetableNumberColors);
  buildMealDateSel();
  document.getElementById('meal-date-sel').onchange = e => loadMeal(e.target.value);
  buildNeisSelects();
  document.getElementById('neis-grade-sel').onchange = renderSchoolTT;
  document.getElementById('neis-class-sel').onchange = renderSchoolTT;
  document.getElementById('neis-prev').onclick = () => { neisWeekOffset--; renderSchoolTT(); };
  document.getElementById('neis-next').onclick = () => { neisWeekOffset++; renderSchoolTT(); };
  document.getElementById('ai-run-btn').onclick = runAI;
  document.getElementById('ai-clear-btn').onclick = () => {
    document.getElementById('ai-input').value = '';
    const r = document.getElementById('ai-result');
    r.style.display = 'none';
  };
  const schoolTitle=document.querySelector('#w-school-tt .card-title');
  if(schoolTitle) schoolTitle.textContent='🏫 학급 시간표';
  const gradeSel=document.getElementById('neis-grade-sel');
  const classSel=document.getElementById('neis-class-sel');
  const prevBtn=document.getElementById('neis-prev');
  const nextBtn=document.getElementById('neis-next');
  if(gradeSel) gradeSel.style.display='none';
  if(classSel) classSel.style.display='none';
  if(prevBtn) prevBtn.style.display='none';
  if(nextBtn) nextBtn.style.display='none';
  const weekLbl=document.getElementById('neis-week-lbl');
  if(weekLbl){
    weekLbl.style.minWidth='auto';
    weekLbl.textContent='NEIS 엑셀';
  }

  updateClock();
  if(clockTimer) clearInterval(clockTimer);
  clockTimer = setInterval(updateClock, 1000);

  await restoreLayout();

  // 숨긴 카드 복원 적용
  try {
    const hiddenRaw = await api.getSetting('hidden_widgets', '[]');
    const hiddenList = JSON.parse(hiddenRaw || '[]');
    if (Array.isArray(hiddenList)) {
      hiddenList.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }
  } catch(e) {}

  // 스티커 메모 위젯 갱신 훅
  window.__refreshStickyWidget = refreshStickyWidget;

  await Promise.all([
    loadNeisCalendar(),
    refreshTodos(),
    refreshDdays(),
    refreshShortcuts(),
    refreshTimetable(),
    refreshTeachers(),
    refreshStudents(),
    loadWeather(),
    loadMeal(),
    renderSchoolTT(),
    refreshStickyWidget(),
  ]);
}

// ─────────────────────────────────────────────────────────
// 달력
// ─────────────────────────────────────────────────────────
function renderCalendar(){
  const lbl = document.getElementById('cal-month-lbl');
  if(lbl) lbl.textContent = `${calYear}년 ${calMonth}월`;
  const grid = document.getElementById('cal-grid');
  if(!grid) return;
  grid.innerHTML = '';
  const now = new Date();
  const first = new Date(calYear, calMonth-1, 1);
  const startDow = first.getDay();
  const dim = new Date(calYear, calMonth, 0).getDate();
  for(let i=0; i<startDow; i++){
    const e = document.createElement('div');
    e.className = 'cal-cell cal-empty';
    grid.appendChild(e);
  }
  for(let d=1; d<=dim; d++){
    const dt = new Date(calYear, calMonth-1, d);
    const dow = dt.getDay();
    const ds = `${calYear}${String(calMonth).padStart(2,'0')}${String(d).padStart(2,'0')}`;
    const evs = calEvents[ds] || [];
    const isToday = d===now.getDate() && calMonth===now.getMonth()+1 && calYear===now.getFullYear();
    const isHol = evs.some(e=>e.is_holiday);
    let cls = 'cal-cell';
    if(isToday) cls += ' today';
    else if(isHol) cls += ' holiday';
    else if(dow===0) cls += ' sun';
    else if(dow===6) cls += ' sat';
    const cell = document.createElement('div');
    cell.className = cls;
    cell.ondblclick = () => openDashboardCalendarEventPrompt(ds);
    const dl = document.createElement('div');
    dl.className = 'cal-day';
    dl.textContent = d;
    cell.appendChild(dl);
    for(const ev of evs.slice(0,2)){
      const el = document.createElement('div');
      el.className = 'cal-ev' + (ev.is_holiday ? ' hol' : ' nrm');
      if(ev.source==='custom') el.className += ' custom';
      el.textContent = (ev.name||'').slice(0,4);
      cell.appendChild(el);
    }
    grid.appendChild(cell);
  }
  refreshSchedule();
}

function changeMonth(d){ calMonth+=d; if(calMonth>12){calMonth=1;calYear++;}if(calMonth<1){calMonth=12;calYear--;} renderCalendar(); loadNeisCalendar(); }
function goToday(){ const t=new Date(); calYear=t.getFullYear(); calMonth=t.getMonth()+1; renderCalendar(); loadNeisCalendar(); }

async function loadDashboardCustomEvents(){
  try{
    const raw=await api.getSetting(CUSTOM_EVENT_KEY,'[]');
    const parsed=JSON.parse(raw||'[]');
    if(!Array.isArray(parsed)) return [];
    return parsed
      .filter((item)=>item&&item.id&&item.date&&item.name)
      .map((item)=>({id:String(item.id),date:String(item.date),name:String(item.name),source:'custom',is_holiday:false}));
  }catch(e){
    return [];
  }
}

async function saveDashboardCustomEvents(events){
  await api.setSetting(CUSTOM_EVENT_KEY, JSON.stringify(events));
}

function formatDashboardDateKey(inputYear,inputMonth,inputDay){
  return `${inputYear}${String(inputMonth).padStart(2,'0')}${String(inputDay).padStart(2,'0')}`;
}

async function openDashboardCalendarEventPrompt(defaultDate){
  const dateInput=prompt('일정 날짜를 입력하세요. 예: 20260422', defaultDate||formatDashboardDateKey(calYear, calMonth, 1));
  if(!dateInput) return;
  const normalizedDate=String(dateInput).replace(/\D/g,'');
  if(!/^\d{8}$/.test(normalizedDate)){
    alert('날짜는 YYYYMMDD 형식으로 입력해 주세요.');
    return;
  }
  const nameInput=prompt('일정 내용을 입력하세요.', '');
  if(!nameInput) return;

  const customEvents=await loadDashboardCustomEvents();
  customEvents.push({
    id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    date:normalizedDate,
    name:String(nameInput).trim(),
  });
  await saveDashboardCustomEvents(customEvents);

  const nextYear=Number(normalizedDate.slice(0,4));
  const nextMonth=Number(normalizedDate.slice(4,6));
  if(nextYear!==calYear||nextMonth!==calMonth){
    calYear=nextYear;
    calMonth=nextMonth;
  }
  await loadNeisCalendar();
}

async function deleteDashboardCalendarEvent(eventId){
  const customEvents=await loadDashboardCustomEvents();
  const target=customEvents.find((item)=>item.id===eventId);
  if(!target) return;
  if(!confirm(`"${target.name}" 일정을 삭제할까요?`)) return;
  if(target.gcal_event_id && window.deleteGoogleCalendarCustomEvent){
    await window.deleteGoogleCalendarCustomEvent(target.gcal_event_id);
  }
  await saveDashboardCustomEvents(customEvents.filter((item)=>item.id!==eventId));
  await loadNeisCalendar();
}

async function loadNeisCalendar(){
  const edu = await api.getSetting('edu_office_code','');
  const sch = await api.getSetting('school_code','');
  calEvents={};
  const ym = `${calYear}${String(calMonth).padStart(2,'0')}`;
  if(edu&&sch){
    try{
      const evs = await api.neisGetCalendar(edu, sch, ym)||[];
      for(const ev of evs) if(ev.date)(calEvents[ev.date]=calEvents[ev.date]||[]).push({...ev,source:'school'});
    }catch(e){}
  }
  const customEvents=await loadDashboardCustomEvents();
  for(const ev of customEvents){
    if(!ev.date.startsWith(ym)) continue;
    (calEvents[ev.date]=calEvents[ev.date]||[]).push(ev);
  }
  dedupeCalendarEvents();
  renderCalendar();
}

function refreshSchedule(){
  const list = document.getElementById('sched-list');
  const title = document.getElementById('sched-title');
  if(!list) return;
  if(title) title.textContent = `📅 ${calYear}년 ${calMonth}월`;
  const all=[];
  for(const[ds,evs] of Object.entries(calEvents)) for(const ev of evs) all.push({ds,ev});
  all.sort((a,b)=>a.ds.localeCompare(b.ds));
  if(!all.length){list.innerHTML='<div class="sb-empty">이달 학사일정이 없습니다.</div>';return;}
  const days=['일','월','화','수','목','금','토'];
  list.innerHTML=all.slice(0,12).map(({ds,ev})=>{
    const d=new Date(+ds.slice(0,4),+ds.slice(4,6)-1,+ds.slice(6,8));
    const lbl=`${d.getMonth()+1}/${d.getDate()} (${days[d.getDay()]})`;
    const col=ev.is_holiday?'var(--danger)':'var(--accent)';
    return `<div class="sched-row"><span class="sched-date">${lbl}</span><span class="sched-tag" style="background:${col}">${ev.is_holiday?'휴일':'일정'}</span><span class="sched-name">${ev.name||''}</span></div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// 시계 / 날씨
// ─────────────────────────────────────────────────────────
window.__calEvtDel=async(id)=>{await deleteDashboardCalendarEvent(id);};

function refreshSchedule(){
  const list=document.getElementById('sched-list');
  const title=document.getElementById('sched-title');
  if(!list) return;
  if(title) title.textContent=`학사 일정 ${calYear}.${String(calMonth).padStart(2,'0')}`;

  const all=[];
  for(const [ds, evs] of Object.entries(calEvents)) for(const ev of evs) all.push({ds, ev});
  all.sort((a,b)=>a.ds.localeCompare(b.ds));

  if(!all.length){
    list.innerHTML='<div class="sb-empty">이번 달 일정이 없습니다.</div>';
    return;
  }

  const days=['일','월','화','수','목','금','토'];
  list.innerHTML=all.slice(0,12).map(({ds,ev})=>{
    const d=new Date(+ds.slice(0,4), +ds.slice(4,6)-1, +ds.slice(6,8));
    const lbl=`${d.getMonth()+1}/${d.getDate()} (${days[d.getDay()]})`;
    const isCustom=ev.source==='custom';
    const tag=ev.is_holiday?'휴일':isCustom?'내 일정':'일정';
    const col=ev.is_holiday?'var(--danger)':isCustom?'var(--primary)':'var(--accent)';
    const delBtn=isCustom?`<button class="sched-del-btn" data-id="${ev.id}" onclick="event.stopPropagation();window.__calEvtDel('${ev.id}')">삭제</button>`:'';
    return `<div class="sched-row"><span class="sched-date">${lbl}</span><span class="sched-tag" style="background:${col}">${tag}</span><span class="sched-name">${ev.name||''}</span>${delBtn}</div>`;
  }).join('');
}

async function openDashboardCalendarEventPrompt(defaultDate){
  const initialDate=defaultDate||formatDashboardDateKey(calYear, calMonth, 1);
  showModal(`
    <div class="modal-header">
      <span class="modal-title">일정 추가</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body">
      <div class="form-row"><label>날짜</label><input class="input" type="date" id="dash-cal-date" value="${initialDate.slice(0,4)}-${initialDate.slice(4,6)}-${initialDate.slice(6,8)}"></div>
      <div class="form-row"><label>내용</label><input class="input" id="dash-cal-name" placeholder="예: 회의, 상담, 연수"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="dash-cal-save">저장</button>
    </div>
  `);

  setTimeout(()=>{
    document.getElementById('dash-cal-name')?.focus();
    const saveButton=document.getElementById('dash-cal-save');
    if(!saveButton) return;
    saveButton.onclick=async()=>{
      const dateValue=document.getElementById('dash-cal-date')?.value||'';
      const nameValue=document.getElementById('dash-cal-name')?.value.trim()||'';
      const normalizedDate=dateValue.replace(/\D/g,'');
      if(!/^\d{8}$/.test(normalizedDate)){ toast('날짜를 입력해 주세요.', 'error'); return; }
      if(!nameValue){ toast('일정 내용을 입력해 주세요.', 'error'); return; }
      const customEvents=await loadDashboardCustomEvents();
      customEvents.push({ id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, date:normalizedDate, name:nameValue });
      await saveDashboardCustomEvents(customEvents);
      const nextYear=Number(normalizedDate.slice(0,4));
      const nextMonth=Number(normalizedDate.slice(4,6));
      if(nextYear!==calYear||nextMonth!==calMonth){ calYear=nextYear; calMonth=nextMonth; }
      closeModal();
      await loadNeisCalendar();
      toast('일정을 추가했습니다.', 'success');
    };
  },0);
}

function updateClock(){
  const n=new Date();
  const h=n.getHours(),m=n.getMinutes(),s=n.getSeconds();
  const ampm=h<12?'오전':'오후'; const hh=h%12||12;
  const el=document.getElementById('clock-time');
  if(el) el.textContent=`${ampm} ${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const days=['일','월','화','수','목','금','토'];
  const dl=document.getElementById('clock-date');
  if(dl) dl.textContent=`${n.getFullYear()}년 ${n.getMonth()+1}월 ${n.getDate()}일 ${days[n.getDay()]}요일`;
}

async function loadWeather(){
  const region=await api.getSetting('weather_region','서울');
  try{
    const w=await api.neisGetWeather(region);
    if(!w||w.error) return;
    const ei=document.getElementById('weather-icon'),et=document.getElementById('weather-temp');
    const el=document.getElementById('weather-loc'),ea=document.getElementById('weather-air');
    if(ei) ei.textContent=w.emoji||'☁️';
    if(et) et.textContent=`${w.temp}°C`;
    if(el) el.textContent=`${region} · 습도 ${w.humidity}%`;
    if(ea&&w.pm10!=null){
      const lv=w.pm10<=30?'좋음':w.pm10<=80?'보통':w.pm10<=150?'나쁨':'매우나쁨';
      // 연한 배경에서도 보이도록 진한 글씨 + 연한 배경 배지로 표시
      const cl=w.pm10<=30?'#15803d':w.pm10<=80?'#a16207':w.pm10<=150?'#b91c1c':'#7e22ce';
      const bg=w.pm10<=30?'#dcfce7':w.pm10<=80?'#fef9c3':w.pm10<=150?'#fee2e2':'#f3e8ff';
      ea.innerHTML=`<span style="color:${cl};background:${bg};font-weight:700;padding:1px 7px;border-radius:8px;font-size:0.85em">미세 ${lv}</span>`;
    }
  }catch(e){}
}

// ─────────────────────────────────────────────────────────
// 급식
// ─────────────────────────────────────────────────────────
function buildMealDateSel(){
  const sel=document.getElementById('meal-date-sel');
  if(!sel)return;
  const now=new Date();
  const days=['일','월','화','수','목','금','토'];
  const opts=[];
  for(let i=-1;i<=5;i++){
    const d=new Date(now); d.setDate(d.getDate()+i);
    // toISOString()은 UTC 기준이라 한국(UTC+9)에서 오전 9시 전에 하루 전 날짜가 됨
    // 로컬 날짜 기준으로 직접 생성
    const ds=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    opts.push(`<option value="${ds}"${i===0?' selected':''}>${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})</option>`);
  }
  sel.innerHTML=opts.join('');
}

async function loadMeal(dateStr){
  const sel=document.getElementById('meal-date-sel');
  const _ld=new Date();
  const _lds=`${_ld.getFullYear()}${String(_ld.getMonth()+1).padStart(2,'0')}${String(_ld.getDate()).padStart(2,'0')}`;
  const ds=dateStr||(sel?sel.value:null)||_lds;
  const list=document.getElementById('meal-list');
  if(!list)return;
  const edu=await api.getSetting('edu_office_code',''),sch=await api.getSetting('school_code','');
  if(!edu||!sch){list.innerHTML='<div class="sb-empty">설정에서 학교 코드를 입력하세요</div>';return;}
  list.innerHTML='<div class="sb-empty">불러오는 중...</div>';
  try{
    const meal=await api.neisGetMeal(edu,sch,ds);
    if(!meal||meal.error||!Object.keys(meal).length){list.innerHTML='<div class="sb-empty">오늘은 급식이 없습니다.</div>';return;}
    const icons={조식:'🌅',중식:'★',석식:'🌙'};
    let html='';
    for(const type of['조식','중식','석식']){
      if(!meal[type])continue;
      const{menu=[],cal=''}=meal[type];
      html+=`<div class="meal-type-row"><span class="meal-type-icon">${icons[type]||'🍽️'} ${type}</span><span class="meal-kcal">${cal}</span></div>`;
      html+=menu.slice(0,8).map(m=>`<div class="meal-item">${m}</div>`).join('');
    }
    list.innerHTML=html;
  }catch(e){list.innerHTML='<div class="sb-empty">급식 정보를 불러올 수 없습니다.</div>';}
}

// ─────────────────────────────────────────────────────────
// 할일 (날짜별 그룹)
// ─────────────────────────────────────────────────────────
const TODO_ORDER_KEY = 'todo_manual_order';
const TODO_HIDE_DONE_KEY = 'todo_hide_done';
let dashTodoHideDone = false;

function sortDashboardTodos(todos, manualOrder){
  const active=applyDashboardTodoOrder(baseDashboardTodoSort(todos.filter(todo=>!todo.is_done)), manualOrder);
  const done=applyDashboardTodoOrder(baseDashboardTodoSort(todos.filter(todo=>!!todo.is_done)), manualOrder);
  return [...active,...done];
}

function getDashboardVisibleTodos(todos, manualOrder){
  const active=applyDashboardTodoOrder(baseDashboardTodoSort(todos.filter(todo=>!todo.is_done)), manualOrder);
  if(dashTodoHideDone) return active;
  const done=baseDashboardTodoSort(todos.filter(todo=>!!todo.is_done)).slice(0,5);
  return [...active,...done];
}

function baseDashboardTodoSort(todos){
  return [...todos].sort((a,b)=>{
    const aDeadline=a.deadline||'9999-12-31';
    const bDeadline=b.deadline||'9999-12-31';
    if(aDeadline!==bDeadline) return aDeadline.localeCompare(bDeadline);
    return String(b.created_at||'').localeCompare(String(a.created_at||''));
  });
}

function applyDashboardTodoOrder(todos, manualOrder){
  if(!Array.isArray(manualOrder)||!manualOrder.length) return todos;
  const todoMap=new Map(todos.map(todo=>[todo.id,todo]));
  const ordered=[];
  const used=new Set();
  for(const rawId of manualOrder){
    const todo=todoMap.get(Number(rawId));
    if(!todo||used.has(todo.id)) continue;
    ordered.push(todo);
    used.add(todo.id);
  }
  for(const todo of todos){
    if(used.has(todo.id)) continue;
    ordered.push(todo);
  }
  return ordered;
}

async function loadDashboardTodoOrder(){
  try{
    const raw=await api.getSetting(TODO_ORDER_KEY,'[]');
    const parsed=JSON.parse(raw||'[]');
    return Array.isArray(parsed)?parsed.map(id=>Number(id)).filter(id=>Number.isFinite(id)):[];
  }catch(e){
    return [];
  }
}

async function saveDashboardTodoOrder(order){
  const normalized=Array.from(new Set((order||[]).map(id=>Number(id)).filter(id=>Number.isFinite(id))));
  await api.setSetting(TODO_ORDER_KEY, JSON.stringify(normalized));
}

async function refreshTodos(){
  const container=document.getElementById('todo-by-date');
  if(!container)return;
  try{
    const saved=await api.getSetting(TODO_HIDE_DONE_KEY,'false');
    dashTodoHideDone=saved==='true';
  }catch(e){}
  const hideBtn=document.getElementById('todo-cleanup-btn');
  if(hideBtn){
    hideBtn.title=dashTodoHideDone?'완료된 할일 표시':'완료된 할일 숨기기';
    hideBtn.style.background=dashTodoHideDone?'var(--accent)':'';
    hideBtn.style.color=dashTodoHideDone?'#fff':'';
    hideBtn.style.borderColor=dashTodoHideDone?'var(--accent)':'';
  }
  const todoItems=await api.getTodos(true);
  window.__todoMap=Object.fromEntries(todoItems.map(todo=>[todo.id,todo]));
  const manualOrder=await loadDashboardTodoOrder();
  const sorted=getDashboardVisibleTodos(todoItems, manualOrder);
  if(!sorted.length){
    container.innerHTML='<div class="todo-empty-day">할 일이 없습니다.</div>';
    return;
  }
  container.innerHTML=sorted.map(todo=>renderTodoRow(todo)).join('');
  bindDashboardTodoDragSort(container);
  return;
  if(controls) controls.innerHTML=`<button class="btn btn-primary btn-xs" onclick="window.__dtAdd('')">+ 추가</button>`;
  const all=await api.getTodos(true);
  const days=['일','월','화','수','목','금','토'];
  const now=new Date(); now.setHours(0,0,0,0);
  let html='';
  for(let i=startOffset;i<startOffset+span;i++){
    const d=new Date(now); d.setDate(d.getDate()+i);
    const ds=d.toISOString().slice(0,10);
    const label=`${d.getMonth()+1}/${d.getDate()} (${days[d.getDay()]})`;
    const dayTodos=all.filter(t=>t.deadline===ds);
    html+=`<div class="todo-date-group"><div class="todo-date-header"><span class="todo-date-lbl">${label}</span><button class="todo-date-add" onclick="window.__dtAdd('${ds}')">+</button><button class="todo-date-menu">···</button></div>`;
    if(!dayTodos.length) html+=`<div class="todo-empty-day">할 일이 없습니다</div>`;
    else html+=dayTodos.map(t=>{
      const done=!!t.is_done;
      const pc=done?'var(--text3)':t.priority==='높음'?'var(--danger)':'var(--text)';
      return `<div class="todo-row${done?' done':''}"><input type="checkbox" class="todo-chk" ${done?'checked':''} onchange="window.__dtTog(${t.id})"><span class="todo-txt" style="color:${pc}">${t.title}</span><button class="todo-del-btn" onclick="window.__dtDel(${t.id})">×</button></div>`;
    }).join('');
    html+=`</div>`;
  }
  const rangeStart=new Date(now); rangeStart.setDate(rangeStart.getDate()+startOffset);
  const rangeEnd=new Date(now); rangeEnd.setDate(rangeEnd.getDate()+startOffset+span-1);
  const extras=all.filter(t=>{
    if(!t.deadline)return !t.is_done;
    const td=new Date(t.deadline); td.setHours(0,0,0,0);
    return td<rangeStart||td>rangeEnd;
  });
  if(extras.length){
    html+=`<div class="todo-date-group"><div class="todo-date-header"><span class="todo-date-lbl" style="color:var(--text3)">기타</span></div>${extras.slice(0,5).map(t=>{const done=!!t.is_done;return`<div class="todo-row${done?' done':''}"><input type="checkbox" class="todo-chk" ${done?'checked':''} onchange="window.__dtTog(${t.id})"><span class="todo-txt">${t.title}</span>${t.deadline?`<span style="font-size:10px;color:var(--text3)">${t.deadline.slice(5)}</span>`:''}<button class="todo-del-btn" onclick="window.__dtDel(${t.id})">×</button></div>`;}).join('')}</div>`;
  }
  container.innerHTML=html;
}
window.__dtTog=async(id)=>{await api.toggleTodo(id);await syncCloudIfPossible();refreshTodos();};
window.__dtDel=async(id)=>{await api.deleteTodo(id);await syncCloudIfPossible();refreshTodos();};
window.__dtAdd=(ds)=>showTodoModal(ds);
window.__dtOpen=(id)=>showTodoEdit(id);
window.__dtTogSort=async()=>{
  await saveDashboardTodoOrder([]);
  refreshTodos();
};

function bindDashboardTodoDragSort(container){
  let draggedRow=null;
  const rows=[...container.querySelectorAll('.todo-row[data-id]')];

  rows.forEach((row)=>{
    row.draggable=true;

    row.addEventListener('dragstart',(event)=>{
      draggedRow=row;
      row.classList.add('dragging');
      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('text/plain', row.dataset.id||'');
      }
    });

    row.addEventListener('dragend',()=>{
      row.classList.remove('dragging');
      container.querySelectorAll('.todo-row.drop-target').forEach((item)=>item.classList.remove('drop-target'));
      draggedRow=null;
    });

    row.addEventListener('dragover',(event)=>{
      event.preventDefault();
      if(!draggedRow||draggedRow===row) return;
      const rect=row.getBoundingClientRect();
      const shouldInsertBefore=event.clientY < rect.top + rect.height / 2;
      row.classList.add('drop-target');
      if(shouldInsertBefore) container.insertBefore(draggedRow, row);
      else container.insertBefore(draggedRow, row.nextSibling);
    });

    row.addEventListener('dragleave',()=>{
      row.classList.remove('drop-target');
    });

    row.addEventListener('drop',async(event)=>{
      event.preventDefault();
      row.classList.remove('drop-target');
      if(!draggedRow) return;
      const order=[...container.querySelectorAll('.todo-row[data-id]')].map((item)=>Number(item.dataset.id)).filter((id)=>Number.isFinite(id));
      await saveDashboardTodoOrder(order);
      refreshTodos();
    });
  });
}

window.__dtTogHideDone=async()=>{
  dashTodoHideDone=!dashTodoHideDone;
  await api.setSetting(TODO_HIDE_DONE_KEY,String(dashTodoHideDone));
  refreshTodos();
};

function renderTodoRow(todo){
  const done=!!todo.is_done;
  const priorityColor=done?'var(--text3)':todo.priority==='높음'?'var(--danger)':'var(--text)';
  const deadlineLabel=formatTodoDeadline(todo.deadline);
  const sourceBadge=todo.source_text?'<span class="todo-source-badge">원문</span>':'';
  return `<div class="todo-row${done?' done':''}" onclick="window.__dtOpen(${todo.id})"><input type="checkbox" class="todo-chk" ${done?'checked':''} onchange="event.stopPropagation();window.__dtTog(${todo.id})"><div class="todo-main"><span class="todo-txt" style="color:${priorityColor}">${escapeHtml(todo.title)}</span><div class="todo-meta">${deadlineLabel?`<span class="todo-deadline">${deadlineLabel}</span>`:''}${sourceBadge}</div></div><button class="todo-del-btn" onclick="event.stopPropagation();window.__dtDel(${todo.id})">×</button></div>`;
}

function renderTodoRow(todo){
  const done=!!todo.is_done;
  const priorityColor=done?'var(--text3)':todo.priority==='?믪쓬'?'var(--danger)':todo.priority==='??쓬'?'var(--text3)':'var(--text)';
  const deadlineLabel=formatTodoDeadline(todo.deadline);
  const sourceBadge=todo.source_text?'<span class="todo-source-badge">원문</span>':'';
  return `<div class="todo-row${done?' done':''}" data-id="${todo.id}" onclick="window.__dtOpen(${todo.id})"><span class="todo-drag-handle" title="드래그해서 순서 변경" onclick="event.stopPropagation()">⋮⋮</span><input type="checkbox" class="todo-chk" ${done?'checked':''} onchange="event.stopPropagation();window.__dtTog(${todo.id})"><div class="todo-main"><span class="todo-txt" style="color:${priorityColor}">${escapeHtml(todo.title)}</span><div class="todo-meta">${deadlineLabel?`<span class="todo-deadline">${deadlineLabel}</span>`:''}${sourceBadge}</div></div><button class="todo-del-btn" onclick="event.stopPropagation();window.__dtDel(${todo.id})">횞</button></div>`;
}

function renderTodoRow(todo){
  const done=!!todo.is_done;
  const priorityColor=done?'var(--text3)':todo.priority==='높음'?'var(--danger)':todo.priority==='낮음'?'var(--text3)':'var(--text)';
  const deadlineLabel=formatTodoDeadline(todo.deadline);
  const sourceBadge=todo.source_text?'<span class="todo-source-badge">원문</span>':'';
  return `<div class="todo-row${done?' done':''}" data-id="${todo.id}" onclick="window.__dtOpen(${todo.id})"><span class="todo-drag-handle" title="드래그해서 순서 변경" onclick="event.stopPropagation()">⋮⋮</span><input type="checkbox" class="todo-chk" ${done?'checked':''} onchange="event.stopPropagation();window.__dtTog(${todo.id})"><div class="todo-main"><span class="todo-txt" style="color:${priorityColor}">${escapeHtml(todo.title)}</span><div class="todo-meta">${deadlineLabel?`<span class="todo-deadline">${deadlineLabel}</span>`:''}${sourceBadge}</div></div><button class="todo-del-btn" onclick="event.stopPropagation();window.__dtDel(${todo.id})">×</button></div>`;
}

function formatTodoDeadline(deadline){
  if(!deadline) return '';
  return deadline.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3');
}

function showTodoEdit(id){
  const todo=window.__todoMap?.[id];
  if(!todo) return;
  const source=todo.source_text?escapeHtml(todo.source_text).replace(/\n/g,'<br>'):'';
  showModal(`
    <div class="modal-header">
      <span class="modal-title">할일 수정</span>
      <button class="modal-close" data-close>✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row"><label>제목 *</label><input class="input" id="td-edit-title" value="${escapeHtml(todo.title)}"></div>
      <div class="form-row"><label>마감일</label><input class="input" type="date" id="td-edit-dl" value="${todo.deadline||''}"></div>
      <div class="form-row row-2">
        <div><label>중요도</label>
          <select class="input" id="td-edit-pri">
            <option${todo.priority==='높음'?' selected':''}>높음</option>
            <option${todo.priority==='보통'?' selected':''}>보통</option>
            <option${todo.priority==='낮음'?' selected':''}>낮음</option>
          </select>
        </div>
        <div><label>카테고리</label>
          <select class="input" id="td-edit-cat">
            ${['제출','회신','안내','행사','AI추출','기타'].map(c=>`<option${todo.category===c?' selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      ${source?`<div class="form-row"><label>원문</label><div class="input todo-source-box">${source}</div></div>`:''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-danger btn-sm" id="td-edit-del">삭제</button>
      <div style="flex:1"></div>
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="td-edit-save">저장</button>
    </div>`);

  setTimeout(()=>document.getElementById('td-edit-title')?.focus(),50);

  document.getElementById('td-edit-save').onclick=async()=>{
    const title=document.getElementById('td-edit-title').value.trim();
    if(!title){toast('제목을 입력하세요','error');return;}
    await api.updateTodo(id,{
      title,
      deadline:document.getElementById('td-edit-dl').value,
      priority:document.getElementById('td-edit-pri').value,
      category:document.getElementById('td-edit-cat').value,
    });
    await syncCloudIfPossible();
    closeModal();
    refreshTodos();
    toast('수정되었습니다.','success');
  };

  document.getElementById('td-edit-del').onclick=async()=>{
    if(!confirm('이 할일을 삭제할까요?')) return;
    await api.deleteTodo(id);
    await syncCloudIfPossible();
    closeModal();
    refreshTodos();
  };
}

function escapeHtml(value=''){
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function showTodoModal(ds=''){
  showModal(`<div class="modal-header"><span class="modal-title">할일 추가</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row"><label>제목 *</label><input class="input" id="td-title" placeholder="할일 제목"></div>
    <div class="form-row"><label>마감일</label><input class="input" type="date" id="td-dl" value="${ds||today()}"></div>
    <div class="form-row row-2">
      <div><label>중요도</label><select class="input" id="td-pri"><option>높음</option><option selected>보통</option><option>낮음</option></select></div>
      <div><label>카테고리</label><select class="input" id="td-cat"><option>제출</option><option>회신</option><option>안내</option><option>행사</option><option>기타</option></select></div>
    </div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-close>취소</button><button class="btn btn-primary" id="td-save">추가</button></div>`);
  setTimeout(()=>document.getElementById('td-title')?.focus(),50);
  document.getElementById('td-save').onclick=async()=>{
    const title=document.getElementById('td-title').value.trim();
    if(!title){toast('제목을 입력하세요','error');return;}
    const deadline=document.getElementById('td-dl').value;
    const priority=document.getElementById('td-pri').value;
    const category=document.getElementById('td-cat').value;
    const newId=await api.addTodo({title,deadline,priority,category});
    await syncCloudIfPossible();
    closeModal();refreshTodos();
  };
}

// ─────────────────────────────────────────────────────────
// Google Calendar 연동
// ─────────────────────────────────────────────────────────
async function gcalGetToken(){
  const rt=await api.getSetting('gcal_refresh_token','');
  if(!rt) return null;
  const res=await api.gcalRefreshToken(rt);
  return res?.access_token||null;
}

async function gcalSyncTodo(todo){
  try{
    const token=await gcalGetToken();
    if(!token) return;
    const start=todo.deadline||today();
    const end=(()=>{const d=new Date(start);d.setDate(d.getDate()+1);return d.toISOString().slice(0,10);})();
    const event={
      summary:`[할일] ${todo.title}`,
      description:`우선순위: ${todo.priority||'보통'} | 카테고리: ${todo.category||'기타'}`,
      start:{date:start}, end:{date:end},
      colorId:todo.priority==='높음'?'11':todo.priority==='낮음'?'2':'5',
      reminders:{useDefault:false,overrides:[{method:'popup',minutes:480}]},
    };
    const created=await api.gcalAddEvent(token,event);
    if(created.id&&todo.id) await api.setTodoGcalId(todo.id,created.id);
  }catch(e){}
}

// ─────────────────────────────────────────────────────────
// D-Day
// ─────────────────────────────────────────────────────────
async function refreshDdays(){
  const list=document.getElementById('dday-list');
  if(!list)return;
  const ddays=await api.getDdays();
  if(!ddays.length){list.innerHTML='<div class="sb-empty">D-Day를 추가해 보세요.</div>';return;}
  list.innerHTML=ddays.map(dd=>{
    const diff=diffDays(dd.target_date);
    const str=diff===0?'D-Day':diff>0?`D-${diff}`:`D+${-diff}`;
    return `<div class="dday-row"><span class="dday-chip" style="background:${dd.color}">${str}</span><span class="dday-title">${dd.title}</span><span class="dday-date">${dd.target_date.slice(5)}</span><button class="del-btn" onclick="window.__dtDelDD(${dd.id})">×</button></div>`;
  }).join('');
}
window.__dtDelDD=async(id)=>{await api.deleteDday(id);refreshDdays();};

async function refreshShortcuts(){
  const wrap=document.getElementById('shortcut-list');
  if(!wrap)return;
  let items=[];
  try{
    const raw=await api.getSetting('quick_links_config','[]');
    const parsed=JSON.parse(raw||'[]');
    if(Array.isArray(parsed)) items=parsed.filter(item=>item&&item.label&&item.value);
  }catch(e){}
  if(!items.length){
    wrap.innerHTML='<div class="sb-empty">설정에서 웹사이트와 폴더 바로가기를 추가해보세요.</div>';
    return;
  }
  window.__shortcutItems=items;
  wrap.innerHTML=items.map((item,index)=>{
    const icon=item.type==='path'?'📁':'🌐';
    return `<button class="shortcut-chip" onclick="window.__openShortcut(${index})">${icon} ${escapeHtml(item.label)}</button>`;
  }).join('');
}
window.__openShortcut=async(index)=>{
  const item=window.__shortcutItems?.[index];
  if(!item)return;
  try{
    if(item.type==='path') await api.openPath(item.value);
    else await api.openUrl(item.value);
  }catch(e){
    toast('바로가기를 열 수 없습니다.','error');
  }
};

// ─────────────────────────────────────────────────────────
// 스티커 메모 위젯
// ─────────────────────────────────────────────────────────
const STICKY_COLORS = [
  { id: 'yellow', bg: '#fff9c4', border: '#f9e44e' },
  { id: 'green',  bg: '#c8e6c9', border: '#81c784' },
  { id: 'blue',   bg: '#bbdefb', border: '#64b5f6' },
  { id: 'pink',   bg: '#f8bbd9', border: '#f48fb1' },
  { id: 'purple', bg: '#e1bee7', border: '#ce93d8' },
  { id: 'orange', bg: '#ffe0b2', border: '#ffb74d' },
];
async function refreshStickyWidget(){
  const wrap = document.getElementById('sticky-widget-list');
  const addBtn = document.getElementById('sticky-add-btn');
  if(!wrap) return;

  let notes = [];
  try {
    const raw = await api.getSetting('sticky_notes_v1', '[]');
    notes = JSON.parse(raw || '[]');
    if(!Array.isArray(notes)) notes = [];
  } catch(e) { notes = []; }

  // 고정된 것 먼저, 그 다음 최근 수정순
  notes = [...notes].sort((a,b)=>{
    if(a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated_at - a.updated_at;
  });

  if(addBtn) {
    addBtn.onclick = async () => {
      let notes2 = [];
      try {
        const raw2 = await api.getSetting('sticky_notes_v1', '[]');
        notes2 = JSON.parse(raw2 || '[]');
        if(!Array.isArray(notes2)) notes2 = [];
      } catch(e) {}
      const newNote = {
        id: 'sn_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
        content: '', color: 'yellow', pinned: false,
        created_at: Date.now(), updated_at: Date.now()
      };
      notes2.unshift(newNote);
      await api.setSetting('sticky_notes_v1', JSON.stringify(notes2));
      navigateTo('sticky_notes');
    };
  }

  if(!notes.length){
    wrap.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px 0">메모가 없습니다</div>';
    return;
  }

  // 최대 5개만 미리보기
  const preview = notes.slice(0, 5);
  wrap.innerHTML = preview.map(n => {
    const col = STICKY_COLORS.find(c=>c.id===n.color) || STICKY_COLORS[0];
    const text = (n.content || '').slice(0, 60) || '(빈 메모)';
    const pin = n.pinned ? '📌 ' : '';
    return `<div class="sticky-widget-chip" style="background:${col.bg};border-color:${col.border}" onclick="navigateTo('sticky_notes')" title="${escapeHtml(n.content||'')}">
      ${pin}${escapeHtml(text)}${(n.content||'').length > 60 ? '…' : ''}
    </div>`;
  }).join('');
}

function showDdayModal(){
  const COLORS=[['#6366f1','인디고'],['#ef4444','빨강'],['#f59e0b','노랑'],['#10b981','초록'],['#3b82f6','파랑'],['#8b5cf6','보라'],['#ec4899','분홍']];
  showModal(`<div class="modal-header"><span class="modal-title">D-Day 추가</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row"><label>이름 *</label><input class="input" id="dd-title" placeholder="예: 수능, 방학"></div>
    <div class="form-row"><label>날짜</label><input class="input" type="date" id="dd-date" value="${today()}"></div>
    <div class="form-row"><label>색상</label><select class="input" id="dd-col">${COLORS.map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-close>취소</button><button class="btn btn-primary" id="dd-save">추가</button></div>`);
  document.getElementById('dd-save').onclick=async()=>{
    const title=document.getElementById('dd-title').value.trim();
    if(!title){toast('이름을 입력하세요','error');return;}
    await api.addDday({title,target_date:document.getElementById('dd-date').value,color:document.getElementById('dd-col').value});
    closeModal();refreshDdays();
  };
}

// ─────────────────────────────────────────────────────────
// 개인 시간표
// ─────────────────────────────────────────────────────────
function extractTeacherTimetableNumber(cell){
  if(!cell) return '';
  const candidates=[cell.room, cell.subject, cell.teacher].map(value=>String(value||''));
  for(const text of candidates){
    const match=text.match(/(?:^|[^\d])(\d{2,4})(?=$|[^\d])/);
    if(match) return match[1];
  }
  return '';
}

function buildTeacherNumberPalette(number, overrides){
  const override=String((overrides||{})[number]||'').trim();
  if(/^#[0-9a-fA-F]{6}$/.test(override)) return buildPastelColorSet(override);
  const colors=['#60a5fa','#34d399','#f59e0b','#f472b6','#a78bfa','#22d3ee','#fb7185','#84cc16','#38bdf8','#f97316','#14b8a6','#818cf8'];
  let hash=0;
  String(number||'').split('').forEach(ch=>{ hash=(hash*31+ch.charCodeAt(0))&0xffff; });
  return buildPastelColorSet(colors[hash%colors.length]);
}

async function loadTeacherTimetableNumberColorSettings(){
  let enabledRaw='false';
  let overrides={};
  try{ enabledRaw=await api.getSetting(TEACHER_TT_NUMBER_COLOR_ENABLED_KEY,'false'); }catch(e){}
  try{
    const raw=await api.getSetting(TEACHER_TT_NUMBER_COLORS_KEY,'{}');
    const parsed=JSON.parse(raw||'{}');
    if(parsed&&typeof parsed==='object') overrides=parsed;
  }catch(e){}
  return { enabled: enabledRaw === 'true', overrides };
}

async function toggleTeacherTimetableNumberColors(){
  const current=await api.getSetting(TEACHER_TT_NUMBER_COLOR_ENABLED_KEY,'false');
  const next=current === 'true' ? 'false' : 'true';
  await api.setSetting(TEACHER_TT_NUMBER_COLOR_ENABLED_KEY,next);
  await refreshTimetable();
}

async function openTeacherNumberColorPrompt(number, currentColor){
  const initialColor=/^#[0-9a-fA-F]{6}$/.test(String(currentColor||''))?currentColor:'#60a5fa';
  showModal(`
    <div class="modal-header">
      <span class="modal-title">시간표 번호 색상</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body" style="display:grid;gap:14px">
      <div style="font-size:14px;font-weight:700;color:var(--text)">번호 ${escapeHtml(number)}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <input id="teacher-tt-number-color" type="color" value="${initialColor}" style="width:48px;height:36px;border:none;background:none;padding:0;cursor:pointer">
        <div id="teacher-tt-number-preview" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:12px;background:${buildPastelColorSet(initialColor)[0]};color:${buildPastelColorSet(initialColor)[1]};border-left:4px solid ${initialColor};font-weight:700">${escapeHtml(number)}</div>
      </div>
      <div style="font-size:12px;color:var(--text3)">같은 번호가 들어간 시간표 칸은 같은 색으로 표시됩니다.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="teacher-tt-number-reset">기본색</button>
      <button class="btn btn-primary" id="teacher-tt-number-save">저장</button>
    </div>
  `);

  setTimeout(()=>{
    const colorInput=document.getElementById('teacher-tt-number-color');
    const preview=document.getElementById('teacher-tt-number-preview');
    const paintPreview=()=>{
      const palette=buildPastelColorSet(colorInput?.value||initialColor);
      if(preview) preview.style.cssText=`display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:12px;background:${palette[0]};color:${palette[1]};border-left:4px solid ${palette[2]};font-weight:700`;
    };
    colorInput?.addEventListener('input', paintPreview);
    document.getElementById('teacher-tt-number-reset')?.addEventListener('click', async ()=>{
      const raw=await api.getSetting(TEACHER_TT_NUMBER_COLORS_KEY,'{}');
      let parsed={};
      try{ parsed=JSON.parse(raw||'{}')||{}; }catch(e){}
      delete parsed[number];
      await api.setSetting(TEACHER_TT_NUMBER_COLORS_KEY,JSON.stringify(parsed));
      closeModal();
      await refreshTimetable();
    });
    document.getElementById('teacher-tt-number-save')?.addEventListener('click', async ()=>{
      const raw=await api.getSetting(TEACHER_TT_NUMBER_COLORS_KEY,'{}');
      let parsed={};
      try{ parsed=JSON.parse(raw||'{}')||{}; }catch(e){}
      parsed[number]=colorInput?.value||initialColor;
      await api.setSetting(TEACHER_TT_NUMBER_COLORS_KEY,JSON.stringify(parsed));
      closeModal();
      await refreshTimetable();
    });
  },0);
}

async function refreshTimetable(){
  const wrap=document.getElementById('tt-grid-wrap');
  if(!wrap)return;
  const now=new Date(),dow=now.getDay();
  const DAYS=['월','화','수','목','금'];
  const todayIdx=dow>=1&&dow<=5?dow-1:-1;
  const tt=await api.getTimetable();
  const numberSettings=await loadTeacherTimetableNumberColorSettings();
  const toggle=document.getElementById('tt-number-color-toggle');
  if(toggle) toggle.checked = !!numberSettings.enabled;
  const map={};
  for(const e of tt) map[`${e.day_of_week}_${e.period}`]=e;
  let html='<div class="tt-grid"><div></div>';
  for(let d=0;d<5;d++) html+=`<div class="tt-head${d===todayIdx?' today':''}">${DAYS[d]}</div>`;
  for(let p=1;p<=7;p++){
    html+=`<div class="tt-period">${p}</div>`;
    for(let d=0;d<5;d++){
      const cell=map[`${d}_${p}`],subj=cell?cell.subject:'',room=cell?cell.room:'';
      const cls=!subj?'':'my';
      const display=subj||'';
      const title=[subj,room].filter(Boolean).join(' · ');
      const number=extractTeacherTimetableNumber(cell);
      const palette=numberSettings.enabled&&number?buildTeacherNumberPalette(number,numberSettings.overrides):null;
      const style=palette?`background:${palette[0]};color:${palette[1]};border-left:4px solid ${palette[2]};cursor:pointer;`:'';
      html+=`<div class="tt-cell ${cls}" data-number="${escapeHtml(number)}" title="${escapeHtml(title||subj||'')}" style="${style}">${escapeHtml(display)}</div>`;
    }
  }
  html+='</div>';
  wrap.innerHTML=html;
  if(numberSettings.enabled){
    wrap.querySelectorAll('.tt-cell[data-number]').forEach(cell=>{
      const number=cell.dataset.number;
      if(!number) return;
      cell.onclick=()=>openTeacherNumberColorPrompt(number,numberSettings.overrides[number]||'');
    });
  }
}

// ─────────────────────────────────────────────────────────
// 연락처
// ─────────────────────────────────────────────────────────
async function refreshTeachers(q=''){
  const list=document.getElementById('teacher-list');
  if(!list)return;
  list.innerHTML='<div style="font-size:11px;color:var(--text3)">설정에서 교사 연락처를 등록하세요</div>';
}
async function refreshStudents(q=''){
  const list=document.getElementById('student-list');
  if(!list)return;
  let students=await api.getStudents();
  if(q) students=students.filter(s=>s.name.includes(q)||String(s.number).includes(q));
  if(!students.length){list.innerHTML='<div style="font-size:11px;color:var(--text3)">학생 없음</div>';return;}
  list.innerHTML=students.slice(0,6).map(s=>{
    const ph=s.phone||s.parent_phone||'';
    return `<div style="display:flex;align-items:center;padding:2px 0;font-size:11px;gap:4px"><span style="color:var(--text2)">${s.number}번</span><span style="color:var(--text);font-weight:600">${s.name}</span>${ph?`<span style="color:var(--text3);margin-left:auto">${ph}</span>`:''}</div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// 학반 시간표 (주간 뷰)
// ─────────────────────────────────────────────────────────
function buildNeisSelects(){
  const gSel=document.getElementById('neis-grade-sel');
  const cSel=document.getElementById('neis-class-sel');
  if(gSel) gSel.innerHTML=[1,2,3].map(n=>`<option>${n}학년</option>`).join('');
  if(cSel) cSel.innerHTML=[1,2,3,4,5,6,7,8,9,10].map(n=>`<option>${n}반</option>`).join('');
  api.getSetting('class_year','1').then(y=>{if(gSel)gSel.value=`${y}학년`;});
  api.getSetting('class_num','1').then(n=>{if(cSel)cSel.value=`${n}반`;});
}
function subjectColor(name){
  if(!name)return'';
  const PALETTE=[
    ['#dbeafe','#1d4ed8'],
    ['#fee2e2','#dc2626'],
    ['#dcfce7','#15803d'],
    ['#fef3c7','#b45309'],
    ['#ede9fe','#7c3aed'],
    ['#e0f2fe','#0369a1'],
    ['#fae8ff','#a21caf'],
    ['#fce7f3','#be185d'],
    ['#ecfccb','#4d7c0f'],
    ['#ffedd5','#c2410c'],
    ['#cffafe','#0f766e'],
    ['#e0e7ff','#4338ca'],
    ['#f3e8ff','#9333ea'],
    ['#fef2f2','#b91c1c'],
    ['#ecfeff','#155e75'],
    ['#f7fee7','#3f6212']
  ];
  let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff;
  const idx=h%PALETTE.length;
  return `background:${PALETTE[idx][0]};color:${PALETTE[idx][1]};`;
}

function buildPastelColorSet(hex){
  const match=String(hex||'').trim().match(/^#?([0-9a-fA-F]{6})$/);
  if(!match) return ['#f8fafc','#334155','#cbd5e1'];
  const value=match[1];
  const r=parseInt(value.slice(0,2),16);
  const g=parseInt(value.slice(2,4),16);
  const b=parseInt(value.slice(4,6),16);
  const bg=`rgba(${r}, ${g}, ${b}, 0.10)`;
  const text=`rgb(${Math.round(r*0.55)}, ${Math.round(g*0.55)}, ${Math.round(b*0.55)})`;
  return [bg,text,`#${value}`];
}

async function openSchoolTTSubjectColorPrompt(subject, currentColor){
  const initialColor=/^#[0-9a-fA-F]{6}$/.test(String(currentColor||''))?currentColor:'#93c5fd';
  showModal(`
    <div class="modal-header">
      <span class="modal-title">과목 색상</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body" style="display:grid;gap:14px">
      <div style="font-size:14px;font-weight:700;color:var(--text)">${escapeHtml(subject)}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <input id="school-tt-color" type="color" value="${initialColor}" style="width:48px;height:36px;border:none;background:none;padding:0;cursor:pointer">
        <div id="school-tt-preview" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:12px;background:${buildPastelColorSet(initialColor)[0]};color:${buildPastelColorSet(initialColor)[1]};border-left:4px solid ${initialColor};font-weight:700">${escapeHtml(subject)}</div>
      </div>
      <div style="font-size:12px;color:var(--text3)">대시보드에서 바로 과목 색을 바꿀 수 있습니다.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" id="school-tt-reset">기본색</button>
      <button class="btn btn-primary" id="school-tt-save">저장</button>
    </div>
  `);

  setTimeout(()=>{
    const colorInput=document.getElementById('school-tt-color');
    const preview=document.getElementById('school-tt-preview');
    const paintPreview=()=>{
      const palette=buildPastelColorSet(colorInput?.value||initialColor);
      if(preview) preview.style.cssText=`display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:12px;background:${palette[0]};color:${palette[1]};border-left:4px solid ${palette[2]};font-weight:700`;
    };
    colorInput?.addEventListener('input', paintPreview);
    document.getElementById('school-tt-reset')?.addEventListener('click', ()=>{
      if(colorInput) colorInput.value='#93c5fd';
      paintPreview();
    });
    document.getElementById('school-tt-save')?.addEventListener('click', async ()=>{
      const raw=await api.getSetting('class_timetable_subject_colors','{}');
      let parsed={};
      try{ parsed=JSON.parse(raw||'{}')||{}; }catch(e){}
      parsed[subject]=colorInput?.value||initialColor;
      await api.setSetting('class_timetable_subject_colors', JSON.stringify(parsed));
      closeModal();
      await renderSchoolTT();
    });
  },0);
}

async function renderSchoolTT(){
  const wrap=document.getElementById('neis-tt-wrap'),weekLbl=document.getElementById('neis-week-lbl');
  if(!wrap)return;
  const now=new Date(),dow=now.getDay();
  const monday=new Date(now);
  monday.setDate(now.getDate()-(dow===0?6:dow-1)+neisWeekOffset*7);
  const DAYS=['월','화','수','목','금'];
  const dates=[];
  for(let i=0;i<5;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);dates.push(d);}
  if(weekLbl){
    if(neisWeekOffset===0)weekLbl.textContent='이번주';
    else if(neisWeekOffset===-1)weekLbl.textContent='지난주';
    else if(neisWeekOffset===1)weekLbl.textContent='다음주';
    else weekLbl.textContent=`${neisWeekOffset>0?'+':''}${neisWeekOffset}주`;
  }
  const tt=await api.getTimetable();
  const map={};
  for(const e of tt) map[`${e.day_of_week}_${e.period}`]=e;
  const todayDow=now.getDay();
  const todayIdx=todayDow>=1&&todayDow<=5&&neisWeekOffset===0?todayDow-1:-1;
  let html='<table class="neis-tt-table"><thead><tr><th></th>';
  for(let d=0;d<5;d++){
    const dt=dates[d];
    html+=`<th${d===todayIdx?' class="neis-today-col"':''}>${DAYS[d]}<br><span style="font-size:9px;font-weight:400">(${dt.getMonth()+1}/${dt.getDate()})</span></th>`;
  }
  html+='</tr></thead><tbody>';
  for(let p=1;p<=7;p++){
    html+=`<tr><td class="neis-period">${p}</td>`;
    for(let d=0;d<5;d++){
      const cell=map[`${d}_${p}`],subj=cell?cell.subject:'';
      const style=subjectColor(subj);
      html+=`<td class="neis-cell" style="${style}">${subj.slice(0,5)||'-'}</td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  wrap.innerHTML=html;
}

// ─────────────────────────────────────────────────────────
// AI 할일 추출
// ─────────────────────────────────────────────────────────
async function runAI(){
  const text=document.getElementById('ai-input').value.trim();
  if(!text){toast('텍스트를 입력하세요','error');return;}
  const engine=await api.getSetting('ai_engine','local_lite');
  const model=await api.getSetting('ai_model','claude-opus-5');
  const provider=await api.getSetting('ai_provider','claude');
  const useLocal=engine==='local_lite';
  const apiKey=useLocal?'':await api.getSetting('ai_api_key','');
  if(!useLocal&&!apiKey){toast('설정에서 AI API 키를 입력하세요','error');return;}
  const btn=document.getElementById('ai-run-btn'),res=document.getElementById('ai-result');
  btn.disabled=true;btn.textContent='분석 중...';res.style.display='block';res.textContent='AI가 분석 중입니다...';
  const result=await api.aiExtractTodos(apiKey,model,useLocal?'local_lite':provider,text);
  const parsedTodos=parseAITodoLines(result?.result||'');
  btn.disabled=false;btn.textContent='🤖 AI 추출';
  if(result?.error){res.style.color='var(--danger)';res.textContent=`오류: ${result.error}`;return;}
  if(!parsedTodos.length){res.style.color='var(--warning)';res.textContent='추출된 할일이 없습니다.';return;}
  res.style.display='none';
  showModal(`
    <div class="modal-header">
      <span class="modal-title">🤖 AI 추출 결과</span>
      <button class="modal-close" data-close>✕</button>
    </div>
    <div class="modal-body" style="padding:12px 20px;max-height:400px;overflow-y:auto">
      <p style="margin:0 0 10px;font-size:13px;color:var(--text2)">추가할 할일을 선택하세요. (${parsedTodos.length}개 추출됨)</p>
      <div style="display:flex;flex-direction:column;gap:6px" id="ai-todo-list">
        ${parsedTodos.map((t,i)=>`
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg)">
            <input type="checkbox" data-ai-idx="${i}" checked style="margin-top:2px;flex-shrink:0">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:500;color:var(--text)">${escapeHtml(t.title)}</div>
              ${t.deadline?`<div style="font-size:11px;color:var(--text3);margin-top:2px">📅 ${t.deadline}</div>`:''}
            </div>
          </label>`).join('')}
      </div>
    </div>
    <div class="modal-footer" style="display:flex;align-items:center;justify-content:space-between">
      <button class="btn btn-secondary btn-sm" id="ai-sel-toggle" style="font-size:12px">전체 해제</button>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" data-close>취소</button>
        <button class="btn btn-primary" id="ai-confirm-btn">추가</button>
      </div>
    </div>`);

  document.getElementById('ai-sel-toggle').onclick=function(){
    const checks=[...document.querySelectorAll('#ai-todo-list input[type=checkbox]')];
    const allChecked=checks.every(c=>c.checked);
    checks.forEach(c=>c.checked=!allChecked);
    this.textContent=allChecked?'전체 선택':'전체 해제';
  };

  document.getElementById('ai-confirm-btn').onclick=async()=>{
    const checks=[...document.querySelectorAll('#ai-todo-list input[type=checkbox]')];
    const selected=checks.filter(c=>c.checked).map(c=>parsedTodos[Number(c.dataset.aiIdx)]).filter(Boolean);
    if(!selected.length){toast('선택된 항목이 없습니다.','error');return;}
    for(const todo of selected){
      await api.addTodo({...todo,priority:'보통',category:'AI추출',is_ai_generated:true,source_text:text});
    }
    await syncCloudIfPossible();
    closeModal();
    document.getElementById('ai-input').value='';
    refreshTodos();
    toast(`할일 ${selected.length}개를 추가했습니다.`,'success');
  };
  return;
  btn.disabled=false;btn.textContent='🤖 AI 추출';
  if(result.error){res.style.color='var(--danger)';res.textContent=`오류: ${result.error}`;return;}
  const lines=(result.result||'').split('\n');let saved=0;
  for(const line of lines){
    const t=line.trim();
    if(t.startsWith('- [ ]')||t.startsWith('- [x]')){
      let txt=t.slice(5).trim(),dl='';
      const m=txt.match(/\(기한:\s*(\d{4}-\d{2}-\d{2})\)/);
      if(m){dl=m[1];txt=txt.replace(m[0],'').trim();}
      if(txt){await api.addTodo({title:txt,deadline:dl,priority:'보통',category:'AI추출',is_ai_generated:true});saved++;}
    }
  }
  if(saved){res.style.color='var(--success)';res.textContent=`✅ 할일 ${saved}개 추가!`;document.getElementById('ai-input').value='';refreshTodos();}
  else{res.style.color='var(--warning)';res.textContent='추출된 할일이 없습니다.';}
}

// ─────────────────────────────────────────────────────────
// AI 텍스트 파싱
// ─────────────────────────────────────────────────────────
function parseAITodoLines(rawText){
  const lines=String(rawText||'').split('\n').map(line=>line.trim()).filter(Boolean);
  const todos=[];
  for(const line of lines){
    let text=line.replace(/^[-*]\s*\[[ xX]?\]\s*/,'').replace(/^[-*•]\s*/,'').replace(/^\d+\.\s*/,'').trim();
    if(!text) continue;
    let deadline='';
    const dateMatch=text.match(/(\d{4}-\d{2}-\d{2})/);
    if(dateMatch){
      deadline=dateMatch[1];
      text=text.replace(/\(?\s*(기한|마감|due)?\s*:?\s*\d{4}-\d{2}-\d{2}\s*\)?/i,'').trim();
    }
    text=text.replace(/\(\s*\)$/,'').trim();
    if(text) todos.push({title:text,deadline});
  }
  return todos;
}

// ─────────────────────────────────────────────────────────
// 카드 이동 (자유 배치)
// ─────────────────────────────────────────────────────────

function setEditMode(active){
  editMode=active;
  const dash=document.getElementById('dashboard');
  if(!dash)return;
  if(active){
    dash.classList.add('edit-mode');
    dash.querySelectorAll('.sb-card[id]').forEach(card=>{
      enableCardMove(card);
    });
    addResizeHandles();
    addCardHideButtons();
    showHiddenPanel();
    toast('카드를 원하는 위치로 자유롭게 옮기고 크기도 직접 조절해보세요.','default',4000);
  }else{
    dash.classList.remove('edit-mode');
    dash.querySelectorAll('.sb-card[id]').forEach(card=>{
      card.onmousedown=null;
      card.classList.remove('dragging');
    });
    dash.querySelectorAll('.card-resize-handle,.card-corner-handle').forEach(h=>h.remove());
    dash.querySelectorAll('.card-hide-btn').forEach(btn=>btn.remove());
    const panel=document.getElementById('hidden-widgets-panel');
    if(panel) panel.remove();
    updateDashboardCanvasSize();
    saveLayout();
  }
}

function enableCardMove(card){
  const dash=document.getElementById('dashboard');
  card.onmousedown=e=>{
    if(e.target.closest('.card-resize-handle,.card-corner-handle,.card-hide-btn,button,input,select,textarea,a')) return;
    e.preventDefault();
    const startX=e.clientX,startY=e.clientY;
    const startLeft=card.offsetLeft,startTop=card.offsetTop;
    card.classList.add('dragging');
    card.style.zIndex='100';
    const onMove=e=>{
      card.style.left=snapToGrid(Math.max(0,startLeft+e.clientX-startX))+'px';
      card.style.top=snapToGrid(Math.max(0,startTop+e.clientY-startY))+'px';
      clampCardToDashboard(card,dash);
      updateDashboardCanvasSize();
    };
    const onUp=()=>{
      card.classList.remove('dragging');
      card.style.zIndex='';
      clampCardToDashboard(card,dash);
      updateDashboardCanvasSize();
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
      saveLayout();
    };
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  };
}

// 편집 모드 진입 시 각 카드 헤더에 숨기기 버튼 추가
function addCardHideButtons(){
  const dash=document.getElementById('dashboard');
  if(!dash)return;
  Object.keys(WIDGET_LABELS).forEach(id=>{
    const card=document.getElementById(id);
    if(!card||card.style.display==='none') return;
    if(card.querySelector('.card-hide-btn')) return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='card-hide-btn';
    btn.textContent='👁 숨기기';
    btn.style.cssText='position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.15);border:none;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:11px;color:var(--text2);z-index:10;';
    btn.onclick=async(e)=>{
      e.stopPropagation();
      card.style.display='none';
      btn.remove();
      // hidden_widgets 목록에 추가하여 저장
      try{
        const raw=await api.getSetting('hidden_widgets','[]');
        const list=JSON.parse(raw||'[]');
        if(!list.includes(id)) list.push(id);
        await api.setSetting('hidden_widgets',JSON.stringify(list));
        await syncCloudIfPossible();
      }catch(err){}
      // 패널 갱신
      showHiddenPanel();
      updateDashboardCanvasSize();
    };
    card.appendChild(btn);
  });
}

// 숨긴 카드를 복원할 수 있는 플로팅 패널 표시/갱신
async function showHiddenPanel(){
  // 기존 패널 제거 후 재생성
  const existing=document.getElementById('hidden-widgets-panel');
  if(existing) existing.remove();

  let hiddenList=[];
  try{
    const raw=await api.getSetting('hidden_widgets','[]');
    hiddenList=JSON.parse(raw||'[]');
    if(!Array.isArray(hiddenList)) hiddenList=[];
  }catch(e){}

  const panel=document.createElement('div');
  panel.id='hidden-widgets-panel';
  panel.style.cssText='position:fixed;bottom:20px;right:20px;z-index:9999;background:var(--card-bg,#fff);border:1px solid var(--border,#ddd);border-radius:8px;padding:10px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.18);display:flex;align-items:center;gap:8px;flex-wrap:wrap;max-width:480px;';

  const label=document.createElement('span');
  label.textContent='숨긴 카드';
  label.style.cssText='font-size:12px;color:var(--text2);white-space:nowrap;';
  panel.appendChild(label);

  const autoArrangeBtn=document.createElement('button');
  autoArrangeBtn.type='button';
  autoArrangeBtn.textContent='자동 배치';
  autoArrangeBtn.style.cssText='font-size:11px;padding:3px 8px;border:1px solid var(--border,#ddd);background:var(--bg2,#f5f5f5);border-radius:4px;cursor:pointer;white-space:nowrap;';
  autoArrangeBtn.onclick=()=>{
    autoArrangeCards();
    toast('카드를 크기에 맞춰 자동 배치했습니다.','success');
  };
  panel.appendChild(autoArrangeBtn);

  if(hiddenList.length===0){
    const empty=document.createElement('span');
    empty.textContent='숨긴 카드 없음';
    empty.style.cssText='font-size:11px;color:var(--text3);white-space:nowrap;';
    panel.appendChild(empty);
  }

  hiddenList.forEach(id=>{
    const labelText=WIDGET_LABELS[id]||id;
    const restoreBtn=document.createElement('button');
    restoreBtn.type='button';
    restoreBtn.textContent=`${labelText} 복원`;
    restoreBtn.style.cssText='font-size:11px;padding:3px 8px;border:1px solid var(--border,#ddd);background:var(--bg2,#f5f5f5);border-radius:4px;cursor:pointer;white-space:nowrap;';
    restoreBtn.onclick=async()=>{
      const card=document.getElementById(id);
      if(card){
        // flex 레이아웃 보존: flex-direction이 설정된 카드는 flex로 복원
        card.style.display = card.style.flexDirection ? 'flex' : '';
        // 다른 카드 앞으로 - dashboard 마지막 자식으로 이동
        const dash=document.getElementById('dashboard');
        if(dash && card.parentNode===dash) dash.appendChild(card);
      }
      // hidden_widgets 목록에서 제거
      try{
        const raw2=await api.getSetting('hidden_widgets','[]');
        const list2=JSON.parse(raw2||'[]');
        const next=list2.filter(x=>x!==id);
        await api.setSetting('hidden_widgets',JSON.stringify(next));
        await syncCloudIfPossible();
      }catch(err){}
      // 패널 갱신
      showHiddenPanel();
      updateDashboardCanvasSize();
    };
    panel.appendChild(restoreBtn);
  });

  document.body.appendChild(panel);
}



function addResizeHandles(){
  const dash=document.getElementById('dashboard');
  if(!dash)return;
  dash.querySelectorAll('.sb-card[id]').forEach(card=>{
    if(card.querySelector('.card-resize-handle'))return;
    // 하단 높이 핸들
    const hHandle=document.createElement('div');
    hHandle.className='card-resize-handle';
    card.appendChild(hHandle);
    hHandle.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      const startY=e.clientY,startH=card.offsetHeight;
      document.body.style.cursor='row-resize';document.body.style.userSelect='none';
      const onMove=e=>{
        card.style.height=snapToGrid(Math.max(CARD_MIN_HEIGHT,startH+e.clientY-startY))+'px';
        clampCardToDashboard(card,dash);
        updateDashboardCanvasSize();
      };
      const onUp=()=>{
        document.body.style.cursor='';document.body.style.userSelect='';
        clampCardToDashboard(card,dash);
        updateDashboardCanvasSize();
        document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
        saveLayout();
      };
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
    const rowHandle=document.createElement('div');
    rowHandle.className='card-row-resize-handle';
    card.appendChild(rowHandle);
    rowHandle.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      const startX=e.clientX,startW=card.offsetWidth;
      document.body.style.cursor='col-resize';document.body.style.userSelect='none';
      const onMove=e=>{
        card.style.width=snapToGrid(Math.max(CARD_MIN_WIDTH,startW+e.clientX-startX))+'px';
        clampCardToDashboard(card,dash);
        updateDashboardCanvasSize();
      };
      const onUp=()=>{
        document.body.style.cursor='';document.body.style.userSelect='';
        clampCardToDashboard(card,dash);
        updateDashboardCanvasSize();
        document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
        saveLayout();
      };
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
    // 우하단 대각선 핸들 (너비+높이)
    const cHandle=document.createElement('div');
    cHandle.className='card-corner-handle';
    card.appendChild(cHandle);
    cHandle.addEventListener('mousedown',e=>{
      e.preventDefault();e.stopPropagation();
      const startX=e.clientX,startY=e.clientY;
      const startW=card.offsetWidth,startH=card.offsetHeight;
      document.body.style.cursor='nwse-resize';document.body.style.userSelect='none';
      const onMove=e=>{
        const dx=e.clientX-startX,dy=e.clientY-startY;
        card.style.width=snapToGrid(Math.max(CARD_MIN_WIDTH,startW+dx))+'px';
        card.style.height=snapToGrid(Math.max(CARD_MIN_HEIGHT,startH+dy))+'px';
        clampCardToDashboard(card,dash);
        updateDashboardCanvasSize();
      };
      const onUp=()=>{
        document.body.style.cursor='';document.body.style.userSelect='';
        clampCardToDashboard(card,dash);
        updateDashboardCanvasSize();
        document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
        saveLayout();
      };
      document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
    });
  });
}


// ─────────────────────────────────────────────────────────
// 레이아웃 저장/복원 (절대 위치 기반)
// ─────────────────────────────────────────────────────────
function saveLayout(){
  try{
    const positions={};
    document.querySelectorAll('#dashboard .sb-card[id]').forEach(c=>{
      positions[c.id]={
        x:c.offsetLeft, y:c.offsetTop,
        w:c.offsetWidth, h:c.offsetHeight
      };
    });
    const payload=JSON.stringify({positions});
    localStorage.setItem(LAYOUT_KEY,payload);
    localStorage.setItem('dashLayout2',payload);
    if(window.api?.setSetting) window.api.setSetting(LAYOUT_KEY,payload).then(()=>syncCloudIfPossible()).catch(()=>{});
  }catch(e){}
}

async function restoreLayout(){
  try{
    let saved='';
    if(window.api?.getSetting){
      saved=await window.api.getSetting(LAYOUT_KEY,'');
      if(saved){
        localStorage.setItem(LAYOUT_KEY,saved);
        localStorage.setItem('dashLayout2',saved);
      }
    }
    if(!saved) saved=localStorage.getItem(LAYOUT_KEY)||localStorage.getItem('dashLayout2');
    const parsed=saved?JSON.parse(saved):null;
    const positions=parsed?.positions||null;

    document.querySelectorAll('#dashboard .sb-card[id]').forEach(card=>{
      const pos=positions?.[card.id]||DEFAULT_POSITIONS[card.id];
      if(pos){
        card.style.left=snapToGrid(pos.x)+'px';
        card.style.top=snapToGrid(pos.y)+'px';
        card.style.width=snapToGrid(pos.w)+'px';
        card.style.height=snapToGrid(pos.h)+'px';
        clampCardToDashboard(card,document.getElementById('dashboard'));
      }
    });
    updateDashboardCanvasSize();
  }catch(e){}
}

function snapToGrid(value){
  return Math.round(Number(value||0)/GRID_SIZE)*GRID_SIZE;
}

function clampCardToDashboard(card,dash){
  if(!card||!dash) return;
  const left=Math.max(0,card.offsetLeft);
  const top=Math.max(0,card.offsetTop);
  card.style.left=snapToGrid(left)+'px';
  card.style.top=snapToGrid(top)+'px';
  if(card.offsetWidth<CARD_MIN_WIDTH) card.style.width=CARD_MIN_WIDTH+'px';
  if(card.offsetHeight<CARD_MIN_HEIGHT) card.style.height=CARD_MIN_HEIGHT+'px';
}

function autoArrangeCards(){
  const dash=document.getElementById('dashboard');
  if(!dash) return;
  const gap=GRID_SIZE;
  const padding=GRID_SIZE;
  const maxWidth=Math.max(dash.clientWidth - padding, 400);
  const cards=[...dash.querySelectorAll('.sb-card[id]')]
    .filter(card=>card.style.display!=='none')
    .sort((a,b)=>{
      if(a.offsetTop!==b.offsetTop) return a.offsetTop-b.offsetTop;
      return a.offsetLeft-b.offsetLeft;
    });

  let cursorX=padding;
  let cursorY=padding;
  let rowHeight=0;

  cards.forEach(card=>{
    const cardWidth=snapToGrid(Math.max(CARD_MIN_WIDTH, card.offsetWidth));
    const cardHeight=snapToGrid(Math.max(CARD_MIN_HEIGHT, card.offsetHeight));
    if(cursorX!==padding && cursorX + cardWidth > maxWidth){
      cursorX=padding;
      cursorY+=rowHeight+gap;
      rowHeight=0;
    }
    card.style.left=cursorX+'px';
    card.style.top=cursorY+'px';
    card.style.width=cardWidth+'px';
    card.style.height=cardHeight+'px';
    cursorX+=cardWidth+gap;
    rowHeight=Math.max(rowHeight, cardHeight);
  });

  updateDashboardCanvasSize();
  saveLayout();
}

function updateDashboardCanvasSize(){
  const dash=document.getElementById('dashboard');
  if(!dash) return;
  let maxBottom=0;
  dash.querySelectorAll('.sb-card[id]').forEach(card=>{
    if(card.style.display==='none') return;
    maxBottom=Math.max(maxBottom,card.offsetTop+card.offsetHeight);
  });
  dash.style.minHeight=Math.max(maxBottom+40,dash.clientHeight||0)+'px';
}

refreshShortcuts=async function(){
  const wrap=document.getElementById('shortcut-list');
  if(!wrap)return;
  let items=[];
  try{
    const raw=await api.getSetting('quick_links_config','[]');
    const parsed=JSON.parse(raw||'[]');
    if(Array.isArray(parsed)) items=parsed.filter(item=>item&&item.label&&item.value);
  }catch(e){}
  if(!items.length){
    wrap.innerHTML='<div class="sb-empty" style="width:100%">홈에서 웹사이트와 폴더 바로가기를 바로 추가해보세요.</div>';
    window.__shortcutItems=[];
    return;
  }
  window.__shortcutItems=items;
  wrap.innerHTML=items.map((item,index)=>{
    const icon=item.type==='path'?'📁':'🌐';
    return `<button class="shortcut-chip" onclick="window.__openShortcut(${index})">${icon} ${escapeHtml(item.label)}</button>`;
  }).join('');
};
window.refreshShortcuts=refreshShortcuts;

window.__openShortcut=async(index)=>{
  const item=window.__shortcutItems?.[index];
  if(!item)return;
  try{
    if(item.type==='path') await api.openPath(item.value);
    else await api.openUrl(item.value);
  }catch(e){
    toast('바로가기를 열 수 없습니다.','error');
  }
};

window.__showShortcutModal=async(index)=>{
  let currentItems=[];
  try{
    const raw=await api.getSetting('quick_links_config','[]');
    const parsed=JSON.parse(raw||'[]');
    if(Array.isArray(parsed)) currentItems=parsed.filter(item=>item&&item.label&&item.value);
  }catch(e){}
  const current=index!=null?currentItems[index]:null;
  showModal(`<div class="modal-header"><span class="modal-title">${current?'바로가기 수정':'바로가기 추가'}</span><button class="modal-close" data-close>×</button></div>
  <div class="modal-body">
    <div class="form-row"><label>이름</label><input class="input" id="shortcut-label" placeholder="예: 학교 홈페이지" value="${escapeHtml(current?.label||'')}"></div>
    <div class="form-row"><label>종류</label><select class="input" id="shortcut-type">
      <option value="url"${current?.type!=='path'?' selected':''}>온라인 링크</option>
      <option value="path"${current?.type==='path'?' selected':''}>폴더</option>
    </select></div>
    <div class="form-row"><label>주소</label><input class="input" id="shortcut-value" placeholder="https://... 또는 C:\\폴더\\경로" value="${escapeHtml(current?.value||'')}"></div>
  </div>
  <div class="modal-footer">
    ${current?'<button class="btn btn-secondary" id="shortcut-delete">삭제</button>':''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="shortcut-save">저장</button>
  </div>`);
  document.getElementById('shortcut-save').onclick=async()=>{
    const label=document.getElementById('shortcut-label').value.trim();
    const type=document.getElementById('shortcut-type').value;
    const value=document.getElementById('shortcut-value').value.trim();
    if(!label||!value){
      toast('이름과 주소를 입력하세요.','error');
      return;
    }
    const next=currentItems.slice();
    const payload={label,value,type:type==='path'?'path':'url'};
    if(index!=null) next[index]=payload;
    else next.push(payload);
    await api.setSetting('quick_links_config',JSON.stringify(next));
    closeModal();
    await refreshShortcuts();
    toast('바로가기를 저장했습니다.','success');
  };
  if(current){
    document.getElementById('shortcut-delete').onclick=async()=>{
      const next=currentItems.filter((_,itemIndex)=>itemIndex!==index);
      await api.setSetting('quick_links_config',JSON.stringify(next));
      closeModal();
      await refreshShortcuts();
      toast('바로가기를 삭제했습니다.','success');
    };
  }
};

buildNeisSelects=function(){};

renderSchoolTT=async function(){
  const wrap=document.getElementById('neis-tt-wrap');
  const weekLbl=document.getElementById('neis-week-lbl');
  if(!wrap)return;
  if(weekLbl) weekLbl.textContent='NEIS 엑셀';
  let items=[];
  let subjectColorOverrides={};
  try{
    const raw=await api.getSetting('class_timetable_json','[]');
    const parsed=JSON.parse(raw||'[]');
    if(Array.isArray(parsed)) items=parsed;
  }catch(e){}
  try{
    const rawColors=await api.getSetting('class_timetable_subject_colors','{}');
    const parsedColors=JSON.parse(rawColors||'{}');
    if(parsedColors&&typeof parsedColors==='object') subjectColorOverrides=parsedColors;
  }catch(e){}
  if(!items.length){
    wrap.innerHTML='<div class="sb-empty" style="padding:18px 12px">설정에서 NEIS 학급 시간표 엑셀 파일을 업로드해 주세요.</div>';
    return;
  }
  const days=['월','화','수','목','금'];
  const map={};
  const subjectKeys=[];
  const subjectCounts={};
  let maxPeriod=7;
  items.forEach((entry)=>{
    if(entry&&Number.isInteger(entry.day_of_week)&&Number.isInteger(entry.period)){
      map[`${entry.day_of_week}_${entry.period}`]=entry;
      maxPeriod=Math.max(maxPeriod,entry.period);
      const subjectKey=String(entry.subject||'').trim();
      if(subjectKey){
        if(!subjectKeys.includes(subjectKey)) subjectKeys.push(subjectKey);
        subjectCounts[subjectKey]=(subjectCounts[subjectKey]||0)+1;
      }
    }
  });
  subjectKeys.sort((a,b)=>(subjectCounts[b]-subjectCounts[a])||a.localeCompare(b,'ko'));
  const hueOrder=[
    0,18,32,45,58,72,86,102,118,135,150,165,
    182,198,214,230,246,262,278,294,310,326,342,
    12,38,64,92,126,156,188,220,252,284,316,348
  ];
  const subjectColorMap={};
  subjectKeys.forEach((key,index)=>{
    const override=String(subjectColorOverrides[key]||'').trim();
    if(/^#[0-9a-fA-F]{6}$/.test(override)){
      subjectColorMap[key]=buildPastelColorSet(override);
      return;
    }
    const hue=hueOrder[index%hueOrder.length];
    subjectColorMap[key]=[
      `hsl(${hue} 50% 97%)`,
      `hsl(${hue} 42% 34%)`,
      `hsl(${hue} 72% 68%)`
    ];
  });
  let html='<table class="neis-tt-table"><thead><tr><th></th>';
  for(let dayIndex=0;dayIndex<5;dayIndex++){
    html+=`<th>${days[dayIndex]}</th>`;
  }
  html+='</tr></thead><tbody>';
  for(let period=1;period<=maxPeriod;period++){
    html+=`<tr><td class="neis-period">${period}</td>`;
    for(let dayIndex=0;dayIndex<5;dayIndex++){
      const cell=map[`${dayIndex}_${period}`];
      const subject=cell?String(cell.subject||''):'';
      const teacher=cell?String(cell.teacher||''):'';
      const palette=subject?subjectColorMap[subject]:null;
      const style=palette
        ? `background:${palette[0]};color:#334155;border-left:4px solid ${palette[2]};cursor:pointer;`
        : 'background:#f8fafc;color:#334155;';
      html+=`<td class="neis-cell" data-subject="${escapeHtml(subject)}" style="${style}">
        ${subject ? `<div style="font-weight:700;line-height:1.25;color:${palette ? palette[1] : '#334155'}">${escapeHtml(subject)}</div>` : '<div>-</div>'}
        ${teacher ? `<div style="margin-top:5px;font-size:11px;color:${palette ? palette[1] : '#64748b'};line-height:1.2;font-weight:600;opacity:.82">${escapeHtml(teacher)}</div>` : ''}
      </td>`;
    }
    html+='</tr>';
  }
  html+='</tbody></table>';
  wrap.innerHTML=html;
  const cells=Array.from(wrap.querySelectorAll('.neis-cell[data-subject]')).filter((cell)=>cell.dataset.subject);
  cells.forEach((cell)=>{
    cell.onmouseenter=()=>{
      const subject=cell.dataset.subject;
      cells.forEach((target)=>target.classList.toggle('same-subject-hover', target.dataset.subject===subject));
    };
    cell.onmouseleave=()=>{
      cells.forEach((target)=>target.classList.remove('same-subject-hover'));
    };
    cell.onclick=()=>{
      const subject=cell.dataset.subject;
      if(!subject) return;
      const currentColor=subjectColorOverrides[subject]||'';
      openSchoolTTSubjectColorPrompt(subject, currentColor);
    };
  });
};

window.__calEvtDel = async (id) => {
  await deleteDashboardCalendarEvent(id);
};

openDashboardCalendarEventPrompt = async function (defaultDate) {
  const initialDate = defaultDate || formatDashboardDateKey(calYear, calMonth, 1);
  showModal(`
    <div class="modal-header">
      <span class="modal-title">일정 추가</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <label>날짜</label>
        <input class="input" type="date" id="dash-cal-date" value="${initialDate.slice(0,4)}-${initialDate.slice(4,6)}-${initialDate.slice(6,8)}">
      </div>
      <div class="form-row">
        <label>내용</label>
        <input class="input" id="dash-cal-name" placeholder="예: 회의, 상담, 연수">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="dash-cal-save">저장</button>
    </div>
  `);

  setTimeout(() => {
    document.getElementById('dash-cal-name')?.focus();
    const saveButton = document.getElementById('dash-cal-save');
    if (!saveButton) return;
    saveButton.onclick = async () => {
      const dateValue = document.getElementById('dash-cal-date')?.value || '';
      const nameValue = document.getElementById('dash-cal-name')?.value.trim() || '';
      const normalizedDate = dateValue.replace(/\D/g, '');
      if (!/^\d{8}$/.test(normalizedDate)) {
        toast('날짜를 입력해 주세요.', 'error');
        return;
      }
      if (!nameValue) {
        toast('일정 내용을 입력해 주세요.', 'error');
        return;
      }
      const customEvents = await loadDashboardCustomEvents();
      customEvents.push({
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: normalizedDate,
        name: nameValue,
      });
      await saveDashboardCustomEvents(customEvents);
      const nextYear = Number(normalizedDate.slice(0, 4));
      const nextMonth = Number(normalizedDate.slice(4, 6));
      if (nextYear !== calYear || nextMonth !== calMonth) {
        calYear = nextYear;
        calMonth = nextMonth;
      }
      closeModal();
      await loadNeisCalendar();
      toast('일정을 추가했습니다.', 'success');
    };
  }, 0);
};

refreshSchedule = function () {
  const list = document.getElementById('sched-list');
  const title = document.getElementById('sched-title');
  if (!list) return;
  if (title) title.textContent = `학사 일정 ${calYear}.${String(calMonth).padStart(2, '0')}`;

  const all = [];
  for (const [ds, evs] of Object.entries(calEvents)) {
    for (const ev of evs) all.push({ ds, ev });
  }
  all.sort((a, b) => a.ds.localeCompare(b.ds));

  if (!all.length) {
    list.innerHTML = '<div class="sb-empty">이번 달 일정이 없습니다.</div>';
    return;
  }

  const days = ['일', '월', '화', '수', '목', '금', '토'];
  list.innerHTML = all.slice(0, 12).map(({ ds, ev }) => {
    const date = new Date(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6, 8));
    const label = `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
    const isCustom = ev.source === 'custom';
    const tag = ev.is_holiday ? '휴일' : isCustom ? '내 일정' : '일정';
    const color = ev.is_holiday ? 'var(--danger)' : isCustom ? 'var(--primary)' : 'var(--accent)';
    const deleteButton = isCustom
      ? `<button class="sched-del-btn" onclick="event.stopPropagation();window.__calEvtDel('${ev.id}')">삭제</button>`
      : '';
    return `<div class="sched-row"><span class="sched-date">${label}</span><span class="sched-tag" style="background:${color}">${tag}</span><span class="sched-name">${escapeHtml(ev.name || '')}</span>${deleteButton}</div>`;
  }).join('');
};

renderTodoRow = function (todo) {
  const done = !!todo.is_done;
  const priorityColor = done ? 'var(--text3)' : todo.priority === '높음' ? 'var(--danger)' : todo.priority === '낮음' ? 'var(--text3)' : 'var(--text)';
  const deadlineLabel = formatTodoDeadline(todo.deadline);
  const sourceBadge = !done && todo.source_text ? '<span class="todo-source-badge">원문</span>' : '';
  return `<div class="todo-row${done ? ' done' : ''}" data-id="${todo.id}" onclick="window.__dtOpen(${todo.id})"><span class="todo-drag-handle" title="드래그해서 순서 변경" onclick="event.stopPropagation()">⋮⋮</span><input type="checkbox" class="todo-chk" ${done ? 'checked' : ''} onclick="event.stopPropagation()" onchange="window.__dtTog(${todo.id})"><div class="todo-main"><span class="todo-txt" style="color:${priorityColor}">${escapeHtml(todo.title)}</span><div class="todo-meta">${deadlineLabel ? `<span class="todo-deadline">${deadlineLabel}</span>` : ''}${sourceBadge}</div></div><button class="todo-del-btn" onclick="event.stopPropagation();window.__dtDel(${todo.id})">×</button></div>`;
};

loadDashboardCustomEvents = async function () {
  try {
    const raw = await api.getSetting(CUSTOM_EVENT_KEY, '[]');
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    return parsed
      .filter((item) => item && item.date && item.name)
      .map((item) => ({
        id: String(item.id || `custom-${item.date}-${String(item.name || '').trim()}`),
        date: String(item.date),
        name: String(item.name).trim(),
        color: String(item.color || '#3b82f6'),
        source: 'custom',
        is_holiday: false,
      }))
      .filter((item) => {
        const dedupeKey = `${item.date}__${item.name}__${item.color}`;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });
  } catch (error) {
    return [];
  }
};

saveDashboardCustomEvents = async function (events) {
  const seen = new Set();
  const normalized = (Array.isArray(events) ? events : []).filter((item) => item && item.date && item.name).map((item) => ({
    id: String(item.id || `custom-${item.date}-${String(item.name || '').trim()}`),
    date: String(item.date),
    name: String(item.name).trim(),
    color: String(item.color || '#3b82f6'),
    gcal_event_id: String(item.gcal_event_id || ''),
  })).filter((item) => {
    const dedupeKey = `${item.date}__${item.name}__${item.color}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });
  await api.setSetting(CUSTOM_EVENT_KEY, JSON.stringify(normalized));
  await syncCloudIfPossible();
};

renderCalendar = function () {
  const lbl = document.getElementById('cal-month-lbl');
  if (lbl) lbl.textContent = `${calYear}.${String(calMonth).padStart(2, '0')}`;
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const now = new Date();
  const first = new Date(calYear, calMonth - 1, 1);
  const startDow = first.getDay();
  const dim = new Date(calYear, calMonth, 0).getDate();
  for (let i = 0; i < startDow; i += 1) {
    const empty = document.createElement('div');
    empty.className = 'cal-cell cal-empty';
    grid.appendChild(empty);
  }
  for (let d = 1; d <= dim; d += 1) {
    const dt = new Date(calYear, calMonth - 1, d);
    const dow = dt.getDay();
    const ds = `${calYear}${String(calMonth).padStart(2, '0')}${String(d).padStart(2, '0')}`;
    const evs = calEvents[ds] || [];
    const isToday = d === now.getDate() && calMonth === now.getMonth() + 1 && calYear === now.getFullYear();
    const isHol = evs.some((event) => event.is_holiday);
    let cls = 'cal-cell';
    if (isToday) cls += ' today';
    else if (isHol) cls += ' holiday';
    else if (dow === 0) cls += ' sun';
    else if (dow === 6) cls += ' sat';
    const cell = document.createElement('div');
    cell.className = cls;
    cell.ondblclick = () => openDashboardCalendarEventPrompt(ds);
    const dl = document.createElement('div');
    dl.className = 'cal-day';
    dl.textContent = d;
    cell.appendChild(dl);
    for (const ev of evs.slice(0, 2)) {
      const el = document.createElement('div');
      const isCustom = ev.source === 'custom';
      el.className = 'cal-ev' + (ev.is_holiday ? ' hol' : ' nrm') + (isCustom ? ' custom' : '');
      el.textContent = (ev.name || '').slice(0, 6);
      if (isCustom && ev.color) {
        el.style.background = `${ev.color}22`;
        el.style.color = ev.color;
        el.style.borderLeft = `3px solid ${ev.color}`;
      }
      cell.appendChild(el);
    }
    grid.appendChild(cell);
  }
  refreshSchedule();
};

openDashboardCalendarEventPrompt = async function (defaultDate) {
  const initialDate = defaultDate || formatDashboardDateKey(calYear, calMonth, 1);
  showModal(`<div class="modal-header"><span class="modal-title">일정 추가</span><button class="modal-close" data-close>×</button></div>
  <div class="modal-body">
    <div class="form-row"><label>날짜</label><input class="input" type="date" id="dash-cal-date" value="${initialDate.slice(0,4)}-${initialDate.slice(4,6)}-${initialDate.slice(6,8)}"></div>
    <div class="form-row"><label>내용</label><input class="input" id="dash-cal-name" placeholder="예: 회의, 상담, 연수"></div>
    <div class="form-row"><label>색상</label><select class="input" id="dash-cal-color"><option value="#3b82f6">파랑</option><option value="#10b981">초록</option><option value="#f59e0b">주황</option><option value="#ef4444">빨강</option><option value="#8b5cf6">보라</option><option value="#ec4899">분홍</option><option value="#14b8a6">청록</option></select></div>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-close>취소</button><button class="btn btn-primary" id="dash-cal-save">저장</button></div>`);
  setTimeout(() => {
    document.getElementById('dash-cal-name')?.focus();
    const saveButton = document.getElementById('dash-cal-save');
    if (!saveButton) return;
    saveButton.onclick = async () => {
      const dateValue = document.getElementById('dash-cal-date')?.value || '';
      const nameValue = document.getElementById('dash-cal-name')?.value.trim() || '';
      const colorValue = document.getElementById('dash-cal-color')?.value || '#3b82f6';
      const normalizedDate = dateValue.replace(/\D/g, '');
      if (!/^\d{8}$/.test(normalizedDate)) return toast('날짜를 입력해 주세요.', 'error');
      if (!nameValue) return toast('일정 내용을 입력해 주세요.', 'error');
      const customEvents = await loadDashboardCustomEvents();
      const customEvent = { id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, date: normalizedDate, name: nameValue, color: colorValue };
      if (window.addGoogleCalendarCustomEvent) {
        customEvent.gcal_event_id = await window.addGoogleCalendarCustomEvent(customEvent) || '';
      }
      customEvents.push(customEvent);
      await saveDashboardCustomEvents(customEvents);
      const nextYear = Number(normalizedDate.slice(0, 4));
      const nextMonth = Number(normalizedDate.slice(4, 6));
      if (nextYear !== calYear || nextMonth !== calMonth) { calYear = nextYear; calMonth = nextMonth; }
      closeModal();
      await loadNeisCalendar();
      toast('일정을 추가했습니다.', 'success');
    };
  }, 0);
};

refreshSchedule = function () {
  const list = document.getElementById('sched-list');
  const title = document.getElementById('sched-title');
  if (!list) return;
  if (title) title.textContent = `학사 일정 ${calYear}.${String(calMonth).padStart(2, '0')}`;
  const all = [];
  for (const [ds, evs] of Object.entries(calEvents)) for (const ev of evs) all.push({ ds, ev });
  all.sort((a, b) => a.ds.localeCompare(b.ds));
  if (!all.length) {
    list.innerHTML = '<div class="sb-empty">이번 달 일정이 없습니다.</div>';
    return;
  }
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  let previousDate = '';
  list.innerHTML = all.slice(0, 12).map(({ ds, ev }) => {
    const date = new Date(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6, 8));
    const label = `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
    const isCustom = ev.source === 'custom';
    const tag = ev.is_holiday ? '휴일' : isCustom ? '내 일정' : '일정';
    const color = ev.is_holiday ? 'var(--danger)' : isCustom ? (ev.color || '#3b82f6') : 'var(--accent)';
    const deleteButton = isCustom ? `<button class="sched-del-btn" onclick="event.stopPropagation();window.__calEvtDel('${ev.id}')">삭제</button>` : '';
    const rowClass = previousDate && previousDate !== ds ? 'sched-row group-start' : 'sched-row';
    previousDate = ds;
    return `<div class="${rowClass}"><span class="sched-date">${label}</span><span class="sched-tag" style="background:${color}">${tag}</span><span class="sched-name">${escapeHtml(ev.name || '')}</span>${deleteButton}</div>`;
  }).join('');
};

window.registerPage('dashboard',{render,init,refresh:init,setEditMode});
})();
