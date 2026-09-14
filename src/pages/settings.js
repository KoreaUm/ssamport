(function () {
const MODEL_OPTIONS = {
  claude: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { value: 'claude-opus-5', label: 'Claude Opus 5' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
};

const MENU_PAGE_OPTIONS = [
  { key: 'students',         label: '학생 명단' },
  { key: 'attendance',       label: '출석 관리' },
  { key: 'daily_memo',       label: '학급 메모' },
  { key: 'timetable',        label: '시간표 관리' },
  { key: 'seating',          label: '자리 배치' },
  { key: 'counseling',       label: '상담 일지' },
  { key: 'observations',     label: '관찰 기록' },
  { key: 'lessons',          label: '수업 지도' },
  { key: 'assessments',      label: '수행평가' },
  { key: 'submissions',      label: '제출물 관리' },
  { key: 'statistics',       label: '통계와 출력' },
  { key: 'ai_analysis',      label: 'AI 분석' },
  { key: 'official_document',label: '공문서 작성' },
  { key: 'meal',             label: '급식 메뉴' },
  { key: 'school_calendar',  label: '학사 일정' },
  { key: 'calculator',       label: '계산기' },
  { key: 'lesson_materials', label: '수업자료제작' },
  { key: 'todos',            label: '할일 목록' },
  { key: 'sticky_notes',     label: '스티커 메모' },
  { key: 'hwp_formatter',    label: '한글 자동 서식' },
  { key: 'settings',         label: '설정' },
];

const DEFAULT_MENU_GROUPS = [
  { key: 'class',    label: '학급',     items: ['students', 'attendance', 'daily_memo', 'timetable', 'seating'] },
  { key: 'records',  label: '기록·평가', items: ['counseling', 'observations', 'lessons', 'ai_analysis', 'assessments', 'submissions', 'statistics'] },
  { key: 'work',     label: '업무·문서', items: ['official_document', 'hwp_formatter', 'meal', 'school_calendar', 'calculator', 'lesson_materials', 'todos', 'sticky_notes'] },
  { key: 'settings', label: '설정',     items: ['settings'] },
];

const DEFAULT_SHORTCUTS = [
  { type: 'url', label: 'NEIS', value: 'https://neis.go.kr' },
  { type: 'url', label: 'K-에듀파인', value: 'https://klef.jne.go.kr' },
];

let schoolResults = [];
let menuConfigState = cloneMenuGroups(DEFAULT_MENU_GROUPS);
let shortcutState = cloneShortcuts(DEFAULT_SHORTCUTS);
let subjectColorState = {};
let menuAutosaveTimer = null;
let shortcutAutosaveTimer = null;

async function render(container) {
  const settings = await api.getAllSettings();
  const appMeta = await api.getAppMeta();
  const authState = window.appAuthGetState ? window.appAuthGetState() : null;
  const savedEngine = settings.ai_engine || 'local_lite';
  const provider = (savedEngine === 'claude' || savedEngine === 'gemini') ? savedEngine : (settings.ai_provider || 'claude');
  const model = settings.ai_model || MODEL_OPTIONS[provider][0].value;
  const aiEngine = savedEngine === 'cloud' ? provider : (savedEngine === 'rule' ? 'local_lite' : savedEngine);
  const classTimetableCount = parseClassTimetableCount(settings.class_timetable_json);
  const classTimetableFileName = settings.class_timetable_file_name || '';
  const classSubjects = parseClassTimetableSubjects(settings.class_timetable_json);
  const versionLabel = buildVersionLabel(appMeta);
  menuConfigState = parseMenuGroups(settings.menu_groups_config);
  // 구버전 "tools" 그룹 감지 → 즉시 기본값으로 마이그레이션
  const _hasOldTools = menuConfigState.some((g) => g.key === 'tools' && Array.isArray(g.items) && g.items.length >= 5);
  if (_hasOldTools) {
    menuConfigState = cloneMenuGroups(DEFAULT_MENU_GROUPS);
    scheduleMenuAutosave();
  }
  // 삭제된 페이지 키를 저장된 메뉴 설정에서 제거
  const _REMOVED_KEYS = new Set(['doc_deadline', 'neis_helper', 'class_budget', 'newsletter', 'efficiency']);
  const _hadRemovedKeys = menuConfigState.some((g) => g.items && g.items.some((k) => _REMOVED_KEYS.has(k)));
  if (_hadRemovedKeys) {
    menuConfigState.forEach((g) => {
      if (g.items) g.items = g.items.filter((k) => !_REMOVED_KEYS.has(k));
    });
    scheduleMenuAutosave();
  }
  shortcutState = parseShortcuts(settings.quick_links_config);
  subjectColorState = parseSubjectColors(settings.class_timetable_subject_colors, classSubjects);

  container.innerHTML = `
    <div class="page-wrap settings-page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">\uD658\uACBD \uC124\uC815</h1>
      </div>

      <div class="settings-layout">
      <aside class="settings-nav">
        <button data-settings-target="settings-app">앱</button>
        <button data-settings-target="settings-account">계정</button>
        <button data-settings-target="settings-class">학급</button>
        <button data-settings-target="settings-menu">메뉴</button>
        <button data-settings-target="settings-ai">AI</button>
        <button data-settings-target="settings-backup">백업</button>
      </aside>
      <div class="settings-stack">
        <section class="card settings-card" id="settings-app">
          <div class="settings-head">
            <div>
              <div class="settings-title">앱 버전</div>
              <div class="settings-note" id="app-version-label">${escapeHtml(versionLabel)}</div>
            </div>
          </div>
        </section>

        <section class="card settings-card" id="settings-account">
          <div class="settings-head">
            <div>
              <div class="settings-title">Firebase 계정</div>
              <div class="settings-note">${authState?.email ? `${escapeHtml(authState.email)} · ${authState.isAdmin ? '관리자' : '사용자'}` : '로그인 정보 없음'}</div>
            </div>
          </div>
          <div class="settings-actions">
            <button class="btn btn-secondary btn-sm" id="cloud-pull-btn">설정/시간표 불러오기</button>
            <button class="btn btn-secondary btn-sm" id="cloud-push-btn">설정/시간표 동기화</button>
            ${authState?.isAdmin ? '<button class="btn btn-secondary btn-sm" id="open-user-management-btn">회원 관리</button>' : ''}
            <button class="btn btn-primary btn-sm" id="auth-logout-btn">로그아웃</button>
          </div>
        </section>

        <section class="card settings-card" id="settings-class">
          <div class="settings-head">
            <div class="settings-title">\uD559\uAE09 \uC815\uBCF4</div>
          </div>
          <div class="form-row row-2">
            <div><label>\uD559\uB144</label><input class="input" id="sy" value="${escapeHtml(settings.class_year || '')}" placeholder="\uC608: 3"></div>
            <div><label>\uBC18</label><input class="input" id="sn" value="${escapeHtml(settings.class_num || '')}" placeholder="\uC608: 2"></div>
          </div>
          <div class="form-row"><label>\uAD50\uC0AC\uBA85</label><input class="input" id="st" value="${escapeHtml(settings.teacher_name || '')}" placeholder="\uC608: \uC784\uC7AC\uD658"></div>
          <div class="form-row"><label>\uB0A0\uC528 \uC9C0\uC5ED</label><input class="input" id="sr" value="${escapeHtml(settings.weather_region || '\uC11C\uC6B8')}" placeholder="\uC608: \uC11C\uC6B8"></div>
          <div class="form-row"><label>\uD558\uB8E8 \uAD50\uC2DC \uC218</label><input class="input" id="spc" type="number" min="1" max="12" value="${escapeHtml(settings.period_count || '7')}" placeholder="\uC608: 7"></div>
          <div class="settings-actions">
            <button class="btn btn-primary btn-sm" id="sv-cl">\uC800\uC7A5</button>
          </div>
        </section>

        <section class="card settings-card" id="settings-menu">
          <div class="settings-head">
            <div>
              <div class="settings-title">\uC0C1\uB2E8 \uBA54\uB274 \uAD6C\uC131</div>
              <div class="settings-note">\uD648\uC740 \uB300\uC2DC\uBCF4\uB4DC\uB85C \uACE0\uC815\uB418\uACE0, \uB098\uBA38\uC9C0 \uBC94\uC8FC\uB294 \uC774\uB984\uACFC \uC21C\uC11C, \uD3EC\uD568\uD560 \uBA54\uB274\uB97C \uC790\uC720\uB86D\uAC8C \uBC14\uAFC0 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</div>
            </div>
          </div>
          <div id="menu-config-editor" class="menu-editor"></div>
          <div class="settings-actions">
            <button class="btn btn-secondary btn-sm" id="menu-add-group">\uBC94\uC8FC \uCD94\uAC00</button>
            <button class="btn btn-secondary btn-sm" id="menu-reset-default">\uAE30\uBCF8\uAC12 \uBCF5\uC6D0</button>
            <button class="btn btn-primary btn-sm" id="menu-save">\uBA54\uB274 \uC800\uC7A5</button>
          </div>
        </section>

        <section class="card settings-card" id="settings-neis">
          <div class="settings-head">
            <div>
              <div class="settings-title">NEIS \uC124\uC815</div>
              <div class="settings-note">\uD559\uAD50\uB97C \uAC80\uC0C9\uD574 \uC120\uD0DD\uD558\uBA74 \uAD50\uC721\uCCAD \uCF54\uB4DC\uC640 \uD559\uAD50 \uCF54\uB4DC\uAC00 \uC790\uB3D9\uC73C\uB85C \uCC44\uC6CC\uC9D1\uB2C8\uB2E4.</div>
            </div>
          </div>
          <div class="form-row">
            <label>\uD559\uAD50 \uAC80\uC0C9</label>
            <div style="display:flex;gap:8px">
              <input class="input" id="school-keyword" placeholder="\uD559\uAD50\uBA85\uC744 \uC785\uB825\uD558\uC138\uC694">
              <button class="btn btn-secondary" id="school-search-btn">\uAC80\uC0C9</button>
            </div>
          </div>
          <div class="form-row">
            <label>\uAC80\uC0C9 \uACB0\uACFC</label>
            <select class="input" id="school-results" size="6">
              <option value="">\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</option>
            </select>
          </div>
          <div class="form-row"><label>\uAD50\uC721\uCCAD \uCF54\uB4DC</label><input class="input" id="se" value="${escapeHtml(settings.edu_office_code || '')}" placeholder="\uC608: B10"></div>
          <div class="form-row"><label>\uD559\uAD50 \uCF54\uB4DC</label><input class="input" id="ss" value="${escapeHtml(settings.school_code || '')}" placeholder="\uD559\uAD50 \uCF54\uB4DC"></div>
          <div class="settings-actions">
            <button class="btn btn-primary btn-sm" id="sv-ne">\uC800\uC7A5</button>
          </div>
        </section>

        <section class="card settings-card" id="settings-timetable">
          <div class="settings-head">
            <div>
              <div class="settings-title">\uD559\uAE09 \uC2DC\uAC04\uD45C \uC5C5\uB85C\uB4DC</div>
              <div class="settings-note">NEIS\uC5D0\uC11C \uB2E4\uC6B4\uBC1B\uC740 \uD559\uAE09 \uC2DC\uAC04\uD45C \uC5D1\uC140 \uD30C\uC77C\uC744 \uC62C\uB9AC\uBA74 \uD648 \uD654\uBA74\uC5D0 \uBC14\uB85C \uBC18\uC601\uB429\uB2C8\uB2E4.</div>
            </div>
          </div>
          <input type="file" id="class-timetable-file" accept=".xlsx,.xls" style="display:none">
          <div class="form-row">
            <label>\uD604\uC7AC \uC0C1\uD0DC</label>
            <div id="class-timetable-status" class="settings-note">
              ${escapeHtml(classTimetableFileName || (classTimetableCount ? `\uC5C5\uB85C\uB4DC\uB41C \uC218\uC5C5 ${classTimetableCount}\uCE78` : '\uC544\uC9C1 \uC5C5\uB85C\uB4DC\uB41C \uD559\uAE09 \uC2DC\uAC04\uD45C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.'))}
            </div>
          </div>
          <div class="settings-actions">
            <button class="btn btn-secondary btn-sm" id="class-timetable-pick">\uC5D1\uC140 \uD30C\uC77C \uC120\uD0DD</button>
          </div>
        </section>

        <section class="card settings-card">
          <div class="settings-head">
            <div>
              <div class="settings-title">학급 시간표 색상</div>
              <div class="settings-note">과목마다 원하는 파스텔 색을 직접 지정할 수 있습니다. 대시보드 학급 시간표에 바로 반영됩니다.</div>
            </div>
          </div>
          <div id="subject-color-editor" class="menu-editor"></div>
          <div class="settings-actions">
            <button class="btn btn-secondary btn-sm" id="subject-color-reset">기본색 복원</button>
            <button class="btn btn-primary btn-sm" id="subject-color-save">색상 저장</button>
          </div>
        </section>

        <section class="card settings-card" id="settings-ai">
          <div class="settings-head">
            <div class="settings-title">AI \uC124\uC815</div>
          </div>
          <div class="ai-engine-list">
            <label class="ai-engine-option ${aiEngine === 'local_lite' ? 'selected' : ''}">
              <input type="radio" name="ai-engine" value="local_lite" ${aiEngine === 'local_lite' ? 'checked' : ''}>
              <div><b>Local AI Lite · qwen2.5:3b</b><span>보안: 외부 전송 없음 · 용도: 학생/상담 기본값 · 특징: 빠른 편, 1.5B보다 안정적</span></div>
            </label>
            <label class="ai-engine-option ${aiEngine === 'local_basic' ? 'selected' : ''}">
              <input type="radio" name="ai-engine" value="local_basic" ${aiEngine === 'local_basic' ? 'checked' : ''}>
              <div><b>Local AI Basic · Gemma 4 E2B</b><span>보안: 외부 전송 없음 · 용도: 더 나은 문장 품질 · 특징: 느릴 수 있음, 8GB RAM 이상 권장</span></div>
            </label>
            <label class="ai-engine-option ${aiEngine === 'local_pro' ? 'selected' : ''}">
              <input type="radio" name="ai-engine" value="local_pro" ${aiEngine === 'local_pro' ? 'checked' : ''}>
              <div><b>Local AI Pro · Gemma 4 E4B</b><span>보안: 외부 전송 없음 · 용도: 고품질 로컬 분석 · 특징: 가장 무거움, 16GB RAM 이상 권장</span></div>
            </label>
            <label class="ai-engine-option danger ${aiEngine === 'claude' ? 'selected' : ''}">
              <input type="radio" name="ai-engine" value="claude" ${aiEngine === 'claude' ? 'checked' : ''}>
              <div><b>Claude 외부 AI</b><span>보안: 외부 서버 전송 가능 · 보호: 동의 필수, 민감 페이지는 로컬 우선/익명화 · 주의: 학생정보 입력 금지 권장</span></div>
            </label>
            <label class="ai-engine-option danger ${aiEngine === 'gemini' ? 'selected' : ''}">
              <input type="radio" name="ai-engine" value="gemini" ${aiEngine === 'gemini' ? 'checked' : ''}>
              <div><b>Gemini 외부 AI</b><span>보안: 외부 서버 전송 가능 · 보호: 동의 필수, 민감 페이지는 로컬 우선/익명화 · 주의: 학생정보 입력 금지 권장</span></div>
            </label>
          </div>
          <div class="settings-note" style="margin-bottom:12px">AI 도우미는 모든 페이지 상단의 <b>AI 도우미</b> 버튼으로 열 수 있습니다.</div>
          <div class="ai-model-status" id="ai-model-status">AI 엔진 상태를 확인하는 중...</div>
          <div class="settings-actions" style="margin-bottom:12px">
            <button class="btn btn-primary btn-sm" id="ai-ollama-install-btn">로컬 AI 자동 설치/확인</button>
            <button class="btn btn-primary btn-sm" id="ai-engine-apply-btn">엔진 적용/확인</button>
          </div>
          <details class="ai-advanced-tools">
            <summary>고급 설정: GGUF 직접 연결</summary>
            <div class="settings-actions" style="margin-top:10px;margin-bottom:12px">
              <button class="btn btn-secondary btn-sm" id="ai-model-download-btn">모델 다운로드 페이지</button>
              <button class="btn btn-secondary btn-sm" id="ai-model-folder-btn">모델 폴더 열기</button>
              <button class="btn btn-secondary btn-sm" id="ai-model-pick-btn">모델 파일 선택</button>
              <button class="btn btn-secondary btn-sm" id="ai-runtime-download-btn">실행 엔진 다운로드</button>
              <button class="btn btn-secondary btn-sm" id="ai-runtime-folder-btn">실행 엔진 폴더</button>
            </div>
          </details>
          <div class="form-row">
            <label>외부 AI 제공업체</label>
            <select class="input" id="sp">
              <option value="claude" ${provider === 'claude' ? 'selected' : ''}>Claude (Anthropic)</option>
              <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Gemini (Google)</option>
            </select>
          </div>
          <div class="form-row"><label>외부 AI API \uD0A4</label><input class="input" type="password" id="sk" value="${escapeHtml(settings.ai_api_key || '')}" placeholder="Claude/Gemini를 사용할 때만 입력"></div>
          <div class="form-row">
            <label>\uBAA8\uB378</label>
            <select class="input" id="sm"></select>
          </div>
          <div class="settings-actions">
            <button class="btn btn-secondary btn-sm" id="ai-helper-test-btn">AI 도우미 열기</button>
            <button class="btn btn-primary btn-sm" id="sv-ai">\uC800\uC7A5</button>
          </div>
        </section>

        <section class="card settings-card" id="settings-google">
          <div class="settings-head">
            <div>
              <div class="settings-title">✅ Google 계정 연동</div>
              <div class="settings-note">할일은 Google Tasks에 동기화하고, 일정형 마감은 Google 캘린더와 함께 사용할 수 있습니다.</div>
            </div>
          </div>

          ${settings.gcal_refresh_token ? `
          <div style="background:var(--success);color:#fff;border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px">
            <span>✅ Google 계정 연동됨</span>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:none" id="gcal-connect">권한 다시 연결</button>
              <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:none" id="gcal-disconnect">연동 해제</button>
            </div>
          </div>` : `
          <div style="background:var(--bg2,#f4f6fb);border-radius:10px;padding:14px 16px;margin-bottom:14px;font-size:13px;line-height:1.8">
            <b>사용자는 Google 계정 연결만 하면 됩니다.</b><br>
            <span style="color:var(--text2)">
              OAuth 앱 설정은 쌤포트 배포판에 포함됩니다. 선생님은 아래 버튼을 눌러 개인 Google 계정으로 로그인하고 Calendar/Tasks 권한만 허용해 주세요.
            </span>
          </div>
          <div id="gcal-status" style="font-size:12px;color:var(--text3);margin-bottom:4px">연동되지 않음</div>
          `}

          ${!settings.gcal_refresh_token ? `
          <div style="background:#fff8e1;border-radius:8px;padding:10px 14px;font-size:12px;color:#7a5c00;margin-bottom:12px">
            💡 학교 Google 계정은 기관 정책으로 차단될 수 있습니다. 가능하면 개인 Gmail 계정으로 연결해 주세요.
          </div>
          <div class="settings-actions">
            <button class="btn btn-primary" id="gcal-connect">🔗 Google 계정 연결하기</button>
          </div>` : ''}
        </section>

        <section class="card settings-card" id="settings-backup">
          <div class="settings-head">
            <div>
              <div class="settings-title">\uB370\uC774\uD130 \uBC31\uC5C5 / \uBCF5\uC6D0</div>
              <div class="settings-note">\uC5EC\uB7EC \uCEF4\uD4E8\uD130\uC5D0\uC11C \uC4F8 \uB54C\uB294 \uD55C \uCABD\uC5D0\uC11C \uBC31\uC5C5\uD55C \uD30C\uC77C\uC744 \uB2E4\uB978 \uCABD\uC5D0\uC11C \uBCF5\uC6D0\uD558\uBA74 \uC548\uC815\uC801\uC73C\uB85C \uC62E\uAE38 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</div>
            </div>
          </div>
          <div class="settings-actions">
            <button class="btn btn-secondary btn-sm" id="export-backup-btn">\uBC31\uC5C5 \uC800\uC7A5</button>
            <button class="btn btn-primary btn-sm" id="import-backup-btn">\uBC31\uC5C5 \uBCF5\uC6D0</button>
          </div>
        </section>

        <section class="card settings-card">
          <div class="settings-head">
            <div>
              <div class="settings-title">\uBC14\uB85C\uAC00\uAE30</div>
              <div class="settings-note">\uC6F9\uC0AC\uC774\uD2B8 URL\uACFC \uD3F4\uB354 \uACBD\uB85C\uB97C \uC800\uC7A5\uD558\uBA74 \uD648 \uD654\uBA74\uC5D0\uC11C \uBC14\uB85C \uC5F4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</div>
            </div>
          </div>
          <div id="shortcut-editor" class="menu-editor"></div>
          <div class="settings-actions">
            <button class="btn btn-secondary btn-sm" id="shortcut-add-url">URL \uCD94\uAC00</button>
            <button class="btn btn-secondary btn-sm" id="shortcut-add-folder">\uD3F4\uB354 \uCD94\uAC00</button>
            <button class="btn btn-primary btn-sm" id="shortcut-save">\uBC14\uB85C\uAC00\uAE30 \uC800\uC7A5</button>
          </div>
        </section>

        <section class="card settings-card">
          <div class="settings-head">
            <div>
              <div class="settings-title">프로그램 패치 적용</div>
              <div class="settings-note">패치용 app.asar 파일을 고르면 프로그램이 종료된 뒤 자동으로 교체되고 다시 실행됩니다.</div>
            </div>
          </div>
          <div class="settings-actions">
            <button class="btn btn-primary btn-sm" id="apply-patch-btn">패치 적용하기</button>
          </div>
        </section>
      </div>
      </div>
    </div>
  `;

  renderModelSelect(provider, model);
  renderMenuConfigEditor();
  renderShortcutEditor();
  renderSubjectColorEditor();
  document.getElementById('subject-color-editor')?.closest('.settings-card')?.remove();
}

async function init() {
  const autosaveTimers = {};
  let currentAiEngine = document.querySelector('input[name="ai-engine"]:checked')?.value || 'local_lite';
  const selectedAiEngine = () => document.querySelector('input[name="ai-engine"]:checked')?.value || 'local_lite';
  const isExternalAiEngine = (engine) => engine === 'claude' || engine === 'gemini';
  const externalAiLabel = (engine) => engine === 'gemini' ? 'Gemini' : 'Claude';
  const setAiEngineSelection = (engine) => {
    document.querySelectorAll('input[name="ai-engine"]').forEach((input) => {
      input.checked = input.value === engine;
      input.closest('.ai-engine-option')?.classList.toggle('selected', input.checked);
    });
  };
  const confirmExternalAiConsent = (engine) => {
    const label = externalAiLabel(engine);
    const text = [
      `${label} 외부 AI를 사용하면 질문, 상담 문장, 성적/학생 관련 내용 등 사용자가 입력한 정보가 외부 AI 서버로 전송될 수 있습니다.`,
      '',
      '학생 상담, 성적, 개인정보, 민감정보를 입력할 경우 그에 따른 개인정보 보호 책임은 사용자에게 있습니다.',
      '민감정보는 가능하면 Local AI를 사용하세요. Local AI는 모델과 실행 엔진이 내 PC에서만 동작하므로 외부 전송이 없습니다.',
      '',
      '계속하려면 아래 입력창에 정확히 "동의합니다"를 입력하세요.'
    ].join('\n');
    return window.prompt(text, '') === '동의합니다';
  };
  const refreshAiStatus = async () => {
    const box = document.getElementById('ai-model-status');
    if (!box || !api.getAiEngineStatus) return;
    const status = await api.getAiEngineStatus(selectedAiEngine());
    const ready = status?.ready;
    box.className = `ai-model-status ${ready ? 'ready' : 'not-ready'}`;
    box.innerHTML = `
      <b>${escapeHtml(status?.label || 'AI 엔진')}</b>
      <span>${escapeHtml(status?.message || status?.error || '상태를 확인할 수 없습니다.')}</span>
      ${status?.modelDir ? `<small>모델 폴더: ${escapeHtml(status.modelDir)}</small>` : ''}
      ${status?.modelPath ? `<small>모델 파일: ${escapeHtml(status.modelPath)}</small>` : ''}
      ${status?.model ? `<small>Ollama 모델: ${escapeHtml(status.model)}</small>` : ''}
      ${status?.ollamaPath ? `<small>Ollama 위치: ${escapeHtml(status.ollamaPath)}</small>` : ''}
      ${status?.runtimeDir ? `<small>실행 엔진 폴더: ${escapeHtml(status.runtimeDir)}</small>` : ''}
      ${status?.runtimePath ? `<small>실행 엔진: ${escapeHtml(status.runtimePath)}</small>` : ''}
    `;
  };
  const renderOllamaProgress = (progress = {}) => {
    const box = document.getElementById('ai-model-status');
    if (!box) return;
    const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, progress.percent)) : null;
    box.className = `ai-model-status ${progress.step === 'done' ? 'ready' : 'not-ready'}`;
    box.innerHTML = `
      <b>${escapeHtml(progress.step === 'done' ? '로컬 AI 준비 완료' : '로컬 AI 준비 중')}</b>
      <span>${escapeHtml(progress.message || '진행 상황을 확인하는 중입니다.')}</span>
      ${percent == null ? '' : `
        <div class="ai-progress-track"><div class="ai-progress-fill" style="width:${percent}%"></div></div>
        <small>진행률: ${percent}%</small>
      `}
      ${progress.detail ? `<small>${escapeHtml(progress.detail)}</small>` : ''}
    `;
  };
  if (window.__removeOllamaInstallProgress) window.__removeOllamaInstallProgress();
  if (api.onOllamaInstallProgress) {
    window.__removeOllamaInstallProgress = api.onOllamaInstallProgress(renderOllamaProgress);
  }
  const autosaveSetting = (id, key, options = {}) => {
    const element = document.getElementById(id);
    if (!element) return;
    const delay = options.delay || 500;
    const eventName = options.event || (element.tagName === 'SELECT' ? 'change' : 'input');
    element.addEventListener(eventName, () => {
      if (autosaveTimers[key]) clearTimeout(autosaveTimers[key]);
      autosaveTimers[key] = setTimeout(async () => {
        const value = options.read ? options.read(element) : element.value.trim();
        await api.setSetting(key, value);
        if (options.after) await options.after();
      }, delay);
    });
  };

  autosaveSetting('sy', 'class_year', { after: () => window.updateClassInfo?.() });
  autosaveSetting('sn', 'class_num', { after: () => window.updateClassInfo?.() });
  autosaveSetting('st', 'teacher_name', { after: () => window.updateClassInfo?.() });
  autosaveSetting('sr', 'weather_region');
  autosaveSetting('spc', 'period_count', { read: (el) => String(Math.min(12, Math.max(1, Number(el.value) || 7))) });
  autosaveSetting('se', 'edu_office_code');
  autosaveSetting('ss', 'school_code');
  document.querySelectorAll('input[name="ai-engine"]').forEach((input) => {
    input.addEventListener('change', async () => {
      const nextEngine = input.value;
      if (isExternalAiEngine(nextEngine) && !confirmExternalAiConsent(nextEngine)) {
        setAiEngineSelection(currentAiEngine);
        toast('외부 AI 사용 동의가 없어 이전 설정으로 되돌렸습니다.', 'warning', 4500);
        return;
      }
      setAiEngineSelection(nextEngine);
      currentAiEngine = nextEngine;
      await api.setSetting('ai_engine', nextEngine);
      if (isExternalAiEngine(nextEngine)) {
        await api.setSetting('ai_provider', nextEngine);
        await api.setSetting('ai_external_consent_provider', nextEngine);
        await api.setSetting('ai_external_consent_at', new Date().toISOString());
        const providerSelect = document.getElementById('sp');
        if (providerSelect) {
          providerSelect.value = nextEngine;
          renderModelSelect(nextEngine, MODEL_OPTIONS[nextEngine][0].value);
        }
      }
      await refreshAiStatus();
      toast(isExternalAiEngine(nextEngine) ? `${externalAiLabel(nextEngine)} 외부 AI 설정을 저장했습니다.` : '로컬 AI 설정을 저장했습니다. 로컬 AI는 외부 전송이 없습니다.', 'success');
    });
  });
  document.querySelectorAll('.settings-nav button').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById(button.dataset.settingsTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  document.getElementById('ai-ollama-install-btn')?.addEventListener('click', async () => {
    const engine = selectedAiEngine();
    if (isExternalAiEngine(engine)) {
      toast('로컬 AI를 선택한 뒤 자동 설치를 실행해 주세요.', 'warning');
      return;
    }
    const button = document.getElementById('ai-ollama-install-btn');
    if (button) {
      button.disabled = true;
      button.textContent = '로컬 AI 준비 중...';
    }
    const box = document.getElementById('ai-model-status');
    if (box) {
      renderOllamaProgress({
        step: 'start',
        percent: 1,
        message: 'Ollama 설치 확인, 실행, 모델 다운로드, 작동 테스트를 시작합니다. 모델 다운로드는 처음 한 번만 오래 걸립니다.'
      });
    }
    const result = await api.installOllamaAi(engine);
    if (button) {
      button.disabled = false;
      button.textContent = '로컬 AI 자동 설치/확인';
    }
    await refreshAiStatus();
    toast(result?.message || result?.error || '로컬 AI 준비 작업이 끝났습니다.', result?.success ? 'success' : 'warning', 7000);
  });
  document.getElementById('ai-model-download-btn')?.addEventListener('click', async () => {
    const engine = selectedAiEngine();
    if (isExternalAiEngine(engine)) {
      toast('로컬 AI 엔진을 선택하면 모델 다운로드 페이지를 열 수 있습니다.', 'warning');
      return;
    }
    await api.openAiModelDownload(engine);
  });
  document.getElementById('ai-model-folder-btn')?.addEventListener('click', async () => {
    await api.openAiModelFolder();
  });
  document.getElementById('ai-runtime-download-btn')?.addEventListener('click', async () => {
    if (!api.openAiRuntimeDownload) {
      toast('실행 엔진 다운로드 기능을 사용할 수 없습니다.', 'warning');
      return;
    }
    await api.openAiRuntimeDownload();
  });
  document.getElementById('ai-runtime-folder-btn')?.addEventListener('click', async () => {
    if (!api.openAiRuntimeFolder) {
      toast('실행 엔진 폴더를 열 수 없습니다.', 'warning');
      return;
    }
    await api.openAiRuntimeFolder();
  });
  document.getElementById('ai-model-pick-btn')?.addEventListener('click', async () => {
    const engine = selectedAiEngine();
    if (isExternalAiEngine(engine)) {
      toast('로컬 AI 엔진을 선택한 뒤 모델 파일을 지정해 주세요.', 'warning');
      return;
    }
    const result = await api.selectAiModelFile(engine);
    if (result?.cancelled) return;
    if (result?.error) return toast(result.error, 'error');
    await refreshAiStatus();
    toast(result?.ready ? '모델 파일을 연결했습니다.' : '모델 파일 상태를 확인해 주세요.', result?.ready ? 'success' : 'warning');
  });
  document.getElementById('ai-engine-apply-btn')?.addEventListener('click', async () => {
    const result = await api.applyAiEngine(selectedAiEngine());
    await refreshAiStatus();
    if (result?.applied) toast(result.message || 'AI 엔진이 준비되었습니다.', 'success');
    else toast(result?.message || result?.error || 'AI 엔진을 적용할 수 없습니다.', 'warning', 4500);
  });
  await refreshAiStatus();
  document.getElementById('sp')?.addEventListener('change', async (event) => {
    const provider = event.target.value;
    if (!confirmExternalAiConsent(provider)) {
      event.target.value = isExternalAiEngine(currentAiEngine) ? currentAiEngine : 'claude';
      toast('외부 AI 사용 동의가 없어 제공업체 변경을 취소했습니다.', 'warning', 4500);
      return;
    }
    await api.setSetting('ai_provider', provider);
    await api.setSetting('ai_engine', provider);
    await api.setSetting('ai_external_consent_provider', provider);
    await api.setSetting('ai_external_consent_at', new Date().toISOString());
    currentAiEngine = provider;
    setAiEngineSelection(provider);
    renderModelSelect(provider, MODEL_OPTIONS[provider][0].value);
    await refreshAiStatus();
    toast(`${externalAiLabel(provider)} 외부 AI 설정을 저장했습니다. 민감정보 입력에 주의해 주세요.`, 'success');
  });
  autosaveSetting('sk', 'ai_api_key');
  autosaveSetting('sm', 'ai_model', { event: 'change', read: (element) => element.value });

  document.getElementById('cloud-pull-btn')?.addEventListener('click', async () => {
    if (!window.pullCloudNow) return;
    const ok = await window.pullCloudNow();
    toast(ok ? '학생 정보 제외 항목만 클라우드에서 불러왔습니다.' : '불러올 클라우드 내용이 없습니다.', ok ? 'success' : 'warning');
    if (ok && window.navigateTo) {
      await window.navigateTo('settings');
      return;
    }
    if (window.updateClassInfo) await window.updateClassInfo();
  });

  document.getElementById('cloud-push-btn')?.addEventListener('click', async () => {
    if (!window.syncCloudNow) return;
    const ok = await window.syncCloudNow();
    toast(ok ? '학생 정보 제외 항목만 클라우드와 동기화했습니다.' : '동기화할 수 있는 로그인 상태가 아닙니다.', ok ? 'success' : 'warning');
  });

  document.getElementById('auth-logout-btn')?.addEventListener('click', async () => {
    if (!window.appAuthLogout) return;
    await window.appAuthLogout();
  });

  document.getElementById('open-user-management-btn')?.addEventListener('click', () => {
    if (window.navigateTo) window.navigateTo('user_management');
  });

  document.getElementById('sv-cl').onclick = async () => {
    await api.setSetting('class_year', document.getElementById('sy').value.trim());
    await api.setSetting('class_num', document.getElementById('sn').value.trim());
    await api.setSetting('teacher_name', document.getElementById('st').value.trim());
    await api.setSetting('weather_region', document.getElementById('sr').value.trim());
    await api.setSetting('period_count', String(Math.min(12, Math.max(1, Number(document.getElementById('spc').value) || 7))));
    toast('\uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4', 'success');
    if (typeof updateClassInfo === 'function') updateClassInfo();
  };

  document.getElementById('menu-add-group').onclick = () => {
    menuConfigState.push({
      key: `custom_${Date.now()}`,
      label: `\uC0C8 \uBC94\uC8FC ${menuConfigState.length + 1}`,
      items: [],
    });
    renderMenuConfigEditor();
    scheduleMenuAutosave();
  };

  document.getElementById('menu-reset-default').onclick = () => {
    menuConfigState = cloneMenuGroups(DEFAULT_MENU_GROUPS);
    renderMenuConfigEditor();
    scheduleMenuAutosave();
    toast('\uAE30\uBCF8 \uBA54\uB274 \uAD6C\uC131\uC744 \uBD88\uB7EC\uC654\uC2B5\uB2C8\uB2E4.', 'success');
  };

  document.getElementById('menu-save').onclick = saveMenuConfig;

  document.getElementById('school-search-btn').onclick = searchSchools;
  document.getElementById('school-keyword').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchSchools();
    }
  });
  document.getElementById('school-results').onchange = applySelectedSchool;

  document.getElementById('sv-ne').onclick = async () => {
    await api.setSetting('edu_office_code', document.getElementById('se').value.trim());
    await api.setSetting('school_code', document.getElementById('ss').value.trim());
    toast('\uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4', 'success');
  };

  document.getElementById('class-timetable-pick').onclick = () => {
    document.getElementById('class-timetable-file').click();
  };

  document.getElementById('class-timetable-file').onchange = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const base64 = arrayBufferToBase64(await file.arrayBuffer());
    const result = await api.importClassTimetableExcel({ name: file.name, data: base64 });
    if (result?.error) {
      toast(result.error, 'error');
      return;
    }
    const status = document.getElementById('class-timetable-status');
    if (status) {
      status.textContent = `${file.name} · ${result.count}칸 반영됨`;
    }
    const refreshed = await api.getAllSettings();
    await api.setSetting('class_timetable_json', refreshed.class_timetable_json || '[]');
    await api.setSetting('class_timetable_file_name', refreshed.class_timetable_file_name || file.name);
    subjectColorState = parseSubjectColors(refreshed.class_timetable_subject_colors, parseClassTimetableSubjects(refreshed.class_timetable_json));
    renderSubjectColorEditor();
    if (window.__pages?.dashboard?.refresh) await window.__pages.dashboard.refresh();
    toast('\uD559\uAE09 \uC2DC\uAC04\uD45C\uAC00 \uBC18\uC601\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
    event.target.value = '';
  };

  document.getElementById('subject-color-reset')?.addEventListener('click', () => {
    const currentSubjects = Array.from(document.querySelectorAll('.subject-color-input')).map((input) => input.dataset.subject).filter(Boolean);
    subjectColorState = buildDefaultSubjectColors(currentSubjects);
    renderSubjectColorEditor();
    api.setSetting('class_timetable_subject_colors', JSON.stringify(subjectColorState));
  });

  document.getElementById('subject-color-save')?.addEventListener('click', async () => {
    await api.setSetting('class_timetable_subject_colors', JSON.stringify(subjectColorState));
    if (window.__pages?.dashboard?.refresh) await window.__pages.dashboard.refresh();
    toast('학급 시간표 색상을 저장했습니다.', 'success');
  });

  document.getElementById('sp').onchange = () => {
    renderModelSelect(document.getElementById('sp').value);
  };

  document.getElementById('sv-ai').onclick = async () => {
    const selectedEngine = document.querySelector('input[name="ai-engine"]:checked')?.value || 'local_lite';
    if (isExternalAiEngine(selectedEngine) && !confirmExternalAiConsent(selectedEngine)) {
      toast('외부 AI 사용 동의가 없어 저장하지 않았습니다.', 'warning', 4500);
      return;
    }
    await api.setSetting('ai_engine', selectedEngine);
    await api.setSetting('ai_provider', isExternalAiEngine(selectedEngine) ? selectedEngine : document.getElementById('sp').value);
    if (isExternalAiEngine(selectedEngine)) {
      await api.setSetting('ai_external_consent_provider', selectedEngine);
      await api.setSetting('ai_external_consent_at', new Date().toISOString());
    }
    await api.setSetting('ai_api_key', document.getElementById('sk').value.trim());
    await api.setSetting('ai_model', document.getElementById('sm').value);
    toast('\uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4', 'success');
  };

  document.getElementById('ai-helper-test-btn')?.addEventListener('click', () => {
    window.openAiHelper?.('현재 AI 설정에서 무엇을 할 수 있어?');
  });

  document.getElementById('shortcut-add-url').onclick = () => {
    shortcutState.push({ type: 'url', label: '새 웹사이트', value: 'https://' });
    renderShortcutEditor();
    scheduleShortcutAutosave();
  };

  document.getElementById('shortcut-add-folder').onclick = () => {
    shortcutState.push({ type: 'path', label: '새 폴더', value: '' });
    renderShortcutEditor();
    scheduleShortcutAutosave();
  };

  document.getElementById('shortcut-save').onclick = saveShortcuts;

  document.getElementById('export-backup-btn').onclick = async () => {
    const result = await api.exportBackup();
    if (result?.cancelled) return;
    if (result?.error) {
      toast(result.error, 'error');
      return;
    }
    toast('\uBC31\uC5C5 \uD30C\uC77C\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.', 'success');
  };

  document.getElementById('import-backup-btn').onclick = async () => {
    const result = await api.importBackup();
    if (result?.cancelled) return;
    if (result?.error) {
      toast(result.error, 'error');
      return;
    }
    toast('\uBC31\uC5C5\uC744 \uBCF5\uC6D0\uD588\uC2B5\uB2C8\uB2E4. \uD654\uBA74\uC744 \uC0C8\uB85C \uBD88\uB7EC\uC635\uB2C8\uB2E4.', 'success');
  };

  document.getElementById('apply-patch-btn').onclick = async () => {
    const result = await api.applyAppPatch();
    if (result?.cancelled) return;
    if (result?.error) {
      toast(result.error, 'error');
      return;
    }
    toast('패치 적용을 시작합니다. 잠시 후 프로그램이 다시 열립니다.', 'success', 3000);
  };

  // ── Google Calendar OAuth ──
  document.getElementById('gcal-connect')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('gcal-status');
    if (statusEl) { statusEl.style.color = 'var(--text2)'; statusEl.textContent = '🔄 브라우저에서 로그인 후 허용 클릭...'; }

    const result = await api.gcalOAuthStart();
    if (result?.error) {
      if (statusEl) { statusEl.style.color = 'var(--danger)'; statusEl.textContent = '❌ ' + result.error; }
      toast(result.error, 'error');
      return;
    }
    await api.setSetting('gcal_refresh_token', result.refresh_token);
    toast('Google 계정 연동 완료! 페이지를 새로고침합니다.', 'success');
    setTimeout(() => window.registerPage && window.__pages?.settings?.refresh
      ? window.__pages.settings.refresh()
      : window.navigateTo?.('settings'), 1500);
  });

  document.getElementById('gcal-disconnect')?.addEventListener('click', async () => {
    await api.setSetting('gcal_refresh_token', '');
    toast('연동이 해제되었습니다', 'success');
    setTimeout(() => window.__pages?.settings?.refresh
      ? window.__pages.settings.refresh()
      : window.navigateTo?.('settings'), 800);
  });
}

function getEffectiveMenuPageOptions() {
  const isAdmin = window.appAuthGetState ? window.appAuthGetState()?.isAdmin : false;
  const extra = isAdmin ? [{ key: 'user_management', label: '\uD68C\uC6D0 \uAD00\uB9AC' }] : [];
  return MENU_PAGE_OPTIONS.concat(extra);
}

function renderMenuConfigEditor() {
  const root = document.getElementById('menu-config-editor');
  if (!root) return;

  const allOptions = getEffectiveMenuPageOptions();
  const assigned = new Set(menuConfigState.flatMap((group) => group.items));

  root.innerHTML = menuConfigState.map((group, groupIndex) => {
    const availableOptions = allOptions
      .filter((page) => !assigned.has(page.key) || group.items.includes(page.key))
      .filter((page) => !group.items.includes(page.key))
      .map((page) => `<option value="${page.key}">${page.label}</option>`)
      .join('');

    return `
      <div class="menu-group-card">
        <div class="menu-group-toolbar">
          <div class="menu-group-toolbar-main">
            <input class="input menu-group-label" data-group-index="${groupIndex}" value="${escapeHtml(group.label)}" placeholder="\uBC94\uC8FC \uC774\uB984">
          </div>
          <div class="menu-item-actions">
            <button class="btn btn-secondary btn-xs menu-group-up" data-group-index="${groupIndex}" ${groupIndex === 0 ? 'disabled' : ''}>\uC704</button>
            <button class="btn btn-secondary btn-xs menu-group-down" data-group-index="${groupIndex}" ${groupIndex === menuConfigState.length - 1 ? 'disabled' : ''}>\uC544\uB798</button>
            <button class="btn btn-danger btn-xs menu-group-remove" data-group-index="${groupIndex}" ${menuConfigState.length === 1 ? 'disabled' : ''}>\uC0AD\uC81C</button>
          </div>
        </div>

        <div class="menu-items-list">
          ${group.items.map((itemKey, itemIndex) => {
            const item = allOptions.find((page) => page.key === itemKey);
            if (!item) return '';
            return `
              <div class="menu-item-row">
                <span class="menu-item-name">${item.label}</span>
                <div class="menu-item-actions">
                  <button class="btn btn-secondary btn-xs menu-item-up" data-group-index="${groupIndex}" data-item-index="${itemIndex}" ${itemIndex === 0 ? 'disabled' : ''}>\uC704</button>
                  <button class="btn btn-secondary btn-xs menu-item-down" data-group-index="${groupIndex}" data-item-index="${itemIndex}" ${itemIndex === group.items.length - 1 ? 'disabled' : ''}>\uC544\uB798</button>
                  <button class="btn btn-danger btn-xs menu-item-remove" data-group-index="${groupIndex}" data-item-index="${itemIndex}">\uC81C\uAC70</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="menu-add-row">
          <select class="input menu-add-select" data-group-index="${groupIndex}" style="max-width:260px">
            <option value="">\uCD94\uAC00\uD560 \uBA54\uB274 \uC120\uD0DD</option>
            ${availableOptions}
          </select>
          <button class="btn btn-secondary btn-xs menu-item-add" data-group-index="${groupIndex}">\uBA54\uB274 \uCD94\uAC00</button>
        </div>
      </div>
    `;
  }).join('');

  bindMenuConfigEvents();
}

function renderShortcutEditor() {
  const root = document.getElementById('shortcut-editor');
  if (!root) return;

  root.innerHTML = shortcutState.map((item, index) => `
    <div class="menu-group-card">
      <div class="menu-group-toolbar">
        <div class="menu-group-toolbar-main">
          <input class="input shortcut-label" data-index="${index}" value="${escapeHtml(item.label || '')}" placeholder="\uBC14\uB85C\uAC00\uAE30 \uC774\uB984">
          <select class="input shortcut-type" data-index="${index}" style="max-width:120px">
            <option value="url" ${item.type === 'url' ? 'selected' : ''}>URL</option>
            <option value="path" ${item.type === 'path' ? 'selected' : ''}>\uD3F4\uB354</option>
          </select>
        </div>
        <div class="menu-item-actions">
          <button class="btn btn-secondary btn-xs shortcut-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>\uC704</button>
          <button class="btn btn-secondary btn-xs shortcut-down" data-index="${index}" ${index === shortcutState.length - 1 ? 'disabled' : ''}>\uC544\uB798</button>
          <button class="btn btn-danger btn-xs shortcut-remove" data-index="${index}">\uC0AD\uC81C</button>
        </div>
      </div>
      <input class="input shortcut-value" data-index="${index}" value="${escapeHtml(item.value || '')}" placeholder="${item.type === 'url' ? 'https://example.com' : 'C:\\\\Users\\\\...'}">
    </div>
  `).join('');

  bindShortcutEvents();
}

function bindShortcutEvents() {
  document.querySelectorAll('.shortcut-label').forEach((input) => {
    input.oninput = (event) => {
      shortcutState[Number(event.target.dataset.index)].label = event.target.value;
      scheduleShortcutAutosave();
    };
  });

  document.querySelectorAll('.shortcut-type').forEach((select) => {
    select.onchange = (event) => {
      shortcutState[Number(event.target.dataset.index)].type = event.target.value;
      renderShortcutEditor();
      scheduleShortcutAutosave();
    };
  });

  document.querySelectorAll('.shortcut-value').forEach((input) => {
    input.oninput = (event) => {
      shortcutState[Number(event.target.dataset.index)].value = event.target.value;
      scheduleShortcutAutosave();
    };
  });

  document.querySelectorAll('.shortcut-up').forEach((button) => {
    button.onclick = () => {
      moveShortcutItem(Number(button.dataset.index), -1);
      scheduleShortcutAutosave();
    };
  });

  document.querySelectorAll('.shortcut-down').forEach((button) => {
    button.onclick = () => {
      moveShortcutItem(Number(button.dataset.index), 1);
      scheduleShortcutAutosave();
    };
  });

  document.querySelectorAll('.shortcut-remove').forEach((button) => {
    button.onclick = () => {
      shortcutState.splice(Number(button.dataset.index), 1);
      renderShortcutEditor();
      scheduleShortcutAutosave();
    };
  });
}

async function saveShortcuts() {
  const cleaned = sanitizeShortcuts(shortcutState);
  shortcutState = cleaned;
  await api.setSetting('quick_links_config', JSON.stringify(cleaned));
  if (window.__pages?.dashboard?.refresh) await window.__pages.dashboard.refresh();
  if (window.refreshShortcuts) await window.refreshShortcuts();
  toast('\uBC14\uB85C\uAC00\uAE30\uAC00 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
  renderShortcutEditor();
}

function scheduleShortcutAutosave() {
  if (shortcutAutosaveTimer) clearTimeout(shortcutAutosaveTimer);
  shortcutAutosaveTimer = setTimeout(async () => {
    shortcutAutosaveTimer = null;
    const cleaned = sanitizeShortcuts(shortcutState);
    shortcutState = cleaned;
    await api.setSetting('quick_links_config', JSON.stringify(cleaned));
    if (window.__pages?.dashboard?.refresh) await window.__pages.dashboard.refresh();
    if (window.refreshShortcuts) await window.refreshShortcuts();
  }, 500);
}

function bindMenuConfigEvents() {
  document.querySelectorAll('.menu-group-label').forEach((input) => {
    input.addEventListener('input', (event) => {
      const groupIndex = Number(event.target.dataset.groupIndex);
      menuConfigState[groupIndex].label = event.target.value;
      scheduleMenuAutosave();
    });
  });

  document.querySelectorAll('.menu-group-up').forEach((button) => {
    button.onclick = () => {
      moveArrayItem(menuConfigState, Number(button.dataset.groupIndex), -1);
      scheduleMenuAutosave();
    };
  });

  document.querySelectorAll('.menu-group-down').forEach((button) => {
    button.onclick = () => {
      moveArrayItem(menuConfigState, Number(button.dataset.groupIndex), 1);
      scheduleMenuAutosave();
    };
  });

  document.querySelectorAll('.menu-group-remove').forEach((button) => {
    button.onclick = () => {
      const index = Number(button.dataset.groupIndex);
      if (menuConfigState.length === 1) return;
      menuConfigState.splice(index, 1);
      renderMenuConfigEditor();
      scheduleMenuAutosave();
    };
  });

  document.querySelectorAll('.menu-item-up').forEach((button) => {
    button.onclick = () => {
      const groupIndex = Number(button.dataset.groupIndex);
      moveArrayItem(menuConfigState[groupIndex].items, Number(button.dataset.itemIndex), -1);
      scheduleMenuAutosave();
    };
  });

  document.querySelectorAll('.menu-item-down').forEach((button) => {
    button.onclick = () => {
      const groupIndex = Number(button.dataset.groupIndex);
      moveArrayItem(menuConfigState[groupIndex].items, Number(button.dataset.itemIndex), 1);
      scheduleMenuAutosave();
    };
  });

  document.querySelectorAll('.menu-item-remove').forEach((button) => {
    button.onclick = () => {
      const groupIndex = Number(button.dataset.groupIndex);
      const itemIndex = Number(button.dataset.itemIndex);
      menuConfigState[groupIndex].items.splice(itemIndex, 1);
      if (!menuConfigState[groupIndex].items.length && menuConfigState.length > 1) {
        menuConfigState.splice(groupIndex, 1);
      }
      renderMenuConfigEditor();
      scheduleMenuAutosave();
    };
  });

  document.querySelectorAll('.menu-item-add').forEach((button) => {
    button.onclick = () => {
      const groupIndex = Number(button.dataset.groupIndex);
      const select = document.querySelector(`.menu-add-select[data-group-index="${groupIndex}"]`);
      const value = select.value;
      if (!value) {
        toast('\uCD94\uAC00\uD560 \uBA54\uB274\uB97C \uC120\uD0DD\uD558\uC138\uC694.', 'warning');
        return;
      }
      if (!menuConfigState[groupIndex].items.includes(value)) {
        removeItemEverywhere(value);
        menuConfigState[groupIndex].items.push(value);
      }
      renderMenuConfigEditor();
      scheduleMenuAutosave();
    };
  });
}

async function saveMenuConfig() {
  const cleaned = sanitizeMenuConfig(menuConfigState);
  menuConfigState = cleaned;
  await api.setSetting('menu_groups_config', JSON.stringify(cleaned));
  if (window.reloadTopNavigation) await window.reloadTopNavigation();
  toast('\uC0C1\uB2E8 \uBA54\uB274 \uAD6C\uC131\uC774 \uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.', 'success');
  renderMenuConfigEditor();
}

function scheduleMenuAutosave() {
  if (menuAutosaveTimer) clearTimeout(menuAutosaveTimer);
  menuAutosaveTimer = setTimeout(async () => {
    menuAutosaveTimer = null;
    const cleaned = sanitizeMenuConfig(menuConfigState);
    menuConfigState = cleaned;
    await api.setSetting('menu_groups_config', JSON.stringify(cleaned));
    if (window.reloadTopNavigation) await window.reloadTopNavigation();
  }, 500);
}

function sanitizeMenuConfig(groups) {
  const used = new Set();
  const next = groups.map((group, index) => {
    const label = String(group.label || '').trim() || `\uBC94\uC8FC ${index + 1}`;
    const key = String(group.key || `group_${index}`).trim() || `group_${index}`;
    const items = group.items.filter((itemKey) => {
      if (!getEffectiveMenuPageOptions().some((page) => page.key === itemKey)) return false;
      if (used.has(itemKey)) return false;
      used.add(itemKey);
      return true;
    });
    return { key, label, items };
  }).filter((group) => group.items.length > 0);

  getEffectiveMenuPageOptions().forEach((page) => {
    if (!used.has(page.key)) {
      if (!next.length) next.push({ key: 'group_0', label: '\uAE30\uD0C0', items: [] });
      next[next.length - 1].items.push(page.key);
    }
  });

  return next.length ? next : cloneMenuGroups(DEFAULT_MENU_GROUPS);
}

function parseMenuGroups(raw) {
  if (!raw) return cloneMenuGroups(DEFAULT_MENU_GROUPS);
  try {
    return sanitizeMenuConfig(JSON.parse(raw));
  } catch (error) {
    return cloneMenuGroups(DEFAULT_MENU_GROUPS);
  }
}

function cloneMenuGroups(groups) {
  return groups.map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items.slice(),
  }));
}

function cloneShortcuts(items) {
  return items.map((item) => ({ type: item.type, label: item.label, value: item.value }));
}

function parseClassTimetableCount(raw) {
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (error) {
    return 0;
  }
}

function parseShortcuts(raw) {
  if (!raw) return cloneShortcuts(DEFAULT_SHORTCUTS);
  try {
    return sanitizeShortcuts(JSON.parse(raw));
  } catch (error) {
    return cloneShortcuts(DEFAULT_SHORTCUTS);
  }
}

function sanitizeShortcuts(items) {
  const next = Array.isArray(items) ? items.map((item) => ({
    type: item.type === 'path' ? 'path' : 'url',
    label: String(item.label || '').trim(),
    value: String(item.value || '').trim(),
  })).filter((item) => item.label && item.value) : [];
  return next;
}

function moveArrayItem(list, index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(nextIndex, 0, item);
  renderMenuConfigEditor();
}

function moveShortcutItem(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= shortcutState.length) return;
  const [item] = shortcutState.splice(index, 1);
  shortcutState.splice(nextIndex, 0, item);
  renderShortcutEditor();
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function buildVersionLabel(appMeta) {
  const version = appMeta?.version || '알 수 없음';
  const patchedAt = formatPatchedAt(appMeta?.patchedAt);
  return patchedAt ? `버전 ${version} · 패치 ${patchedAt}` : `버전 ${version}`;
}

function formatPatchedAt(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function removeItemEverywhere(itemKey) {
  menuConfigState.forEach((group) => {
    group.items = group.items.filter((entry) => entry !== itemKey);
  });
}

async function searchSchools() {
  const keyword = document.getElementById('school-keyword').value.trim();
  if (!keyword) {
    toast('\uD559\uAD50\uBA85\uC744 \uC785\uB825\uD558\uC138\uC694.', 'warning');
    return;
  }
  const select = document.getElementById('school-results');
  select.innerHTML = '<option value="">\uAC80\uC0C9 \uC911...</option>';
  schoolResults = await api.neisSearchSchools(keyword);
  if (!schoolResults.length) {
    select.innerHTML = '<option value="">\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.</option>';
    toast('\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.', 'warning');
    return;
  }
  select.innerHTML = schoolResults.map((school, index) =>
    `<option value="${index}">${escapeHtml(`${school.schoolName} (${school.officeName})`)}</option>`
  ).join('');
  select.selectedIndex = 0;
  applySelectedSchool();
}

function applySelectedSchool() {
  const select = document.getElementById('school-results');
  const item = schoolResults[Number(select.value)];
  if (!item) return;
  document.getElementById('se').value = item.eduCode || '';
  document.getElementById('ss').value = item.schoolCode || '';
  api.setSetting('edu_office_code', item.eduCode || '');
  api.setSetting('school_code', item.schoolCode || '');
  toast(`${item.schoolName} \uCF54\uB4DC\uAC00 \uC785\uB825\uB418\uC5C8\uC2B5\uB2C8\uB2E4.`, 'success', 1800);
}

function renderModelSelect(provider, selectedModel) {
  const select = document.getElementById('sm');
  if (!select) return;
  const models = MODEL_OPTIONS[provider] || MODEL_OPTIONS.claude;
  const nextModel = selectedModel && models.some((model) => model.value === selectedModel)
    ? selectedModel
    : models[0].value;
  select.innerHTML = models.map((model) =>
    `<option value="${model.value}" ${model.value === nextModel ? 'selected' : ''}>${model.label}</option>`
  ).join('');
}

function parseClassTimetableSubjects(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.map((item) => String(item?.subject || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ko'));
  } catch (error) {
    return [];
  }
}

function parseSubjectColors(raw, subjects) {
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (error) {
    parsed = {};
  }
  const next = buildDefaultSubjectColors(subjects);
  subjects.forEach((subject) => {
    const value = String(parsed?.[subject] || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(value)) next[subject] = value;
  });
  return next;
}

function buildDefaultSubjectColors(subjects) {
  const palette = [
    '#93c5fd','#86efac','#fdba74','#f9a8d4','#c4b5fd','#67e8f9','#fca5a5','#bef264',
    '#7dd3fc','#fcd34d','#6ee7b7','#f0abfc','#a5b4fc','#fda4af','#99f6e4','#d9f99d',
    '#bfdbfe','#bbf7d0','#fed7aa','#f5d0fe','#ddd6fe','#a7f3d0','#fde68a','#fecdd3'
  ];
  const next = {};
  subjects.forEach((subject, index) => {
    next[subject] = palette[index % palette.length];
  });
  return next;
}

function renderSubjectColorEditor() {
  const root = document.getElementById('subject-color-editor');
  if (!root) return;
  const subjects = Object.keys(subjectColorState);
  if (!subjects.length) {
    root.innerHTML = '<div class="settings-note">학급 시간표 엑셀을 업로드하면 과목별 색상을 설정할 수 있습니다.</div>';
    return;
  }
  root.innerHTML = subjects.map((subject) => `
    <div class="menu-group-card" style="padding:12px 14px">
      <div style="display:flex;align-items:center;gap:12px">
        <input type="color" class="subject-color-input" data-subject="${escapeHtml(subject)}" value="${escapeHtml(subjectColorState[subject])}" style="width:44px;height:32px;border:none;background:none;padding:0;cursor:pointer">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--text)">${escapeHtml(subject)}</div>
          <div style="margin-top:6px;display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:${escapeHtml(subjectColorState[subject])};color:#fff;font-size:11px;font-weight:700">${escapeHtml(subject)}</div>
        </div>
      </div>
    </div>
  `).join('');
  root.querySelectorAll('.subject-color-input').forEach((input) => {
    input.oninput = (event) => {
      subjectColorState[event.target.dataset.subject] = event.target.value;
      api.setSetting('class_timetable_subject_colors', JSON.stringify(subjectColorState));
      renderSubjectColorEditor();
    };
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.registerPage('settings', { render, init });
})();
