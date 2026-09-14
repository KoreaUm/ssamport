(function () {
'use strict';

let records = [];
let quickLinks = [];
let publicCompanyRules = [];
let unlocked = false;
let searchText = '';
let typeFilter = 'all';
let gradeMaxFilter = '';
let selectedStudentId = '';
let publicRuleYearFilter = '';
let publicRuleQuickFilter = 'all';

window.appGradesLock = function () {
  unlocked = false;
  selectedStudentId = '';
  document.removeEventListener('keydown', handleGradesShortcutKeys);
};

const TEMPLATE_HEADERS = [
  '구분', '졸업년도', '이름', '학년', '반', '학번', '평균내신', '출결요약',
  '자격증', '희망회사', '희망직무', '취업회사', '취업직무', '지역', '비고'
];

function hasAccess() {
  return !!(window.appGradesCanUse && window.appGradesCanUse());
}

async function render(container) {
  if (!hasAccess()) {
    container.innerHTML = `
      <div class="page-wrap" style="max-width:920px">
        <div class="page-header"><h1 class="page-header-title">취업 데이터 관리</h1></div>
        <section class="card settings-card">
          <div class="settings-title">접근 권한이 없습니다.</div>
          <div class="settings-note" style="margin-top:6px">관리자가 성적관리 권한을 부여한 교사만 사용할 수 있습니다.</div>
        </section>
      </div>`;
    return;
  }

  if (!unlocked) {
    container.innerHTML = `
      <div class="page-wrap" style="max-width:520px">
        <div class="page-header"><h1 class="page-header-title">취업 데이터 관리</h1></div>
        <section class="card settings-card">
          <div class="settings-title">보안 확인</div>
          <div class="settings-note" style="margin-top:6px">학생 성적, 자격증, 취업 정보가 포함되어 있습니다. 성적관리 비밀번호를 입력해야 열람할 수 있습니다.</div>
          <div class="form-row" style="margin-top:16px">
            <label>성적관리 비밀번호</label>
            <input class="input" id="grades-password-input" type="password" autocomplete="current-password" placeholder="비밀번호 입력">
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="grades-password-submit">입장</button>
            <span id="grades-password-status" class="settings-note"></span>
          </div>
        </section>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-wrap grades-secret-shell" style="max-width:none">
      <div class="grades-hero">
        <div class="grades-hero-copy">
          <div class="grades-kicker">SECURE CAREER INTELLIGENCE</div>
          <h1 class="grades-title">취업 데이터 관리</h1>
          <div class="grades-subtitle">외부 API 없이, 이 프로그램 안의 현학생/졸업생 데이터만으로 취업 가능성과 준비 전략을 분석합니다.</div>
        </div>
        <div class="grades-hero-actions">
          <button class="btn btn-secondary btn-sm" id="career-template-btn">CSV 양식 다운로드</button>
          <button class="btn btn-secondary btn-sm" id="career-import-btn">CSV 올리기</button>
          <button class="btn btn-secondary btn-sm" id="career-export-btn">CSV 내려받기</button>
          <button class="btn btn-primary btn-sm" id="career-add-btn">+ 학생 데이터 추가</button>
          <input type="file" id="career-import-input" accept=".csv" style="display:none">
        </div>
      </div>

      <section class="card settings-card grades-panel" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div class="settings-title">온라인 빠른 바로가기</div>
            <div class="settings-note" style="margin-top:4px">성적관리 페이지 안에서만 쓰는 온라인 자료 링크입니다.</div>
          </div>
          <button class="btn btn-primary btn-sm" id="quick-link-add-btn">+ 링크 추가</button>
        </div>
        <div id="quick-link-list" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px"></div>
      </section>

      <section style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-bottom:16px">
        <div class="card settings-card grades-panel grades-analysis-panel">
          <div class="settings-title">학생 이름으로 분석</div>
          <div class="settings-note" style="margin:4px 0 14px">현학생 이름을 검색하면 내신, 자격증, 희망회사를 불러오고 졸업생 데이터를 기준으로 가능성이 있는 회사를 보여줍니다.</div>
          <div class="form-row">
            <label>현학생 검색</label>
            <input class="input" id="student-search-input" placeholder="예: 홍길동">
          </div>
          <div id="student-search-results" style="display:grid;gap:8px;margin:10px 0"></div>
          <div id="student-analysis-result"></div>
        </div>

        <div class="card settings-card grades-panel grades-analysis-panel">
          <div class="settings-title">회사 이름으로 분석</div>
          <div class="settings-note" style="margin:4px 0 14px">회사명을 검색하면 그 회사에 합격한 졸업생들의 평균 내신, 자격증, 세부 데이터를 확인합니다.</div>
          <div class="form-row">
            <label>회사/직무 검색</label>
            <input class="input" id="company-search-input" placeholder="예: 삼성, 전기, 자동화">
          </div>
          <button class="btn btn-primary btn-sm" id="company-search-btn">회사 데이터 조회</button>
          <div id="company-analysis-result" style="margin-top:14px"></div>
        </div>
      </section>

      <section class="card settings-card grades-panel grades-ai-panel" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div class="grades-kicker">LOCAL AI BRIEFING</div>
            <div class="settings-title">로컬 AI 상담 요약</div>
            <div class="settings-note" style="margin-top:4px">외부 서버로 데이터를 보내지 않고, 현재 저장된 졸업생/현학생 데이터만 읽어서 상담용 요약과 데이터 오류 후보를 만듭니다.</div>
          </div>
          <button class="btn btn-primary btn-sm" id="local-ai-run-btn">AI 요약 생성</button>
        </div>
        <div id="local-ai-result" style="margin-top:14px"></div>
      </section>

      <section class="card settings-card grades-panel" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div class="grades-kicker">OFFICIAL PUBLIC HIRING DATA</div>
            <div class="settings-title">기관별 자격증 가산점 조회</div>
            <div class="settings-note" style="margin-top:4px">기업/공공기관에 취업할 때 어떤 자격증이 가산점인지, 몇 점 또는 몇 %인지 공식 공고 근거로 확인합니다.</div>
          </div>
        </div>
        <div class="form-row row-2" style="margin-top:14px">
          <div><label>기관/기업명</label><input class="input" id="public-rule-company-input" placeholder="예: 한국전력공사, 한국수자원공사"></div>
          <div><label>자격증/분야</label><input class="input" id="public-rule-cert-input" placeholder="예: 전기기능사, 한국사, 컴퓨터활용능력"></div>
        </div>
        <div id="public-rule-year-tabs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <button class="btn btn-primary btn-sm" id="public-rule-search-btn">가산점 조회</button>
          <button class="btn btn-secondary btn-sm" id="public-rule-finance-btn">금융권만 보기</button>
          <button class="btn btn-secondary btn-sm" id="public-rule-verified-btn">검증된 가산점만 보기</button>
          <label class="settings-note" style="display:flex;align-items:center;gap:6px">
            <input type="checkbox" id="public-rule-include-restricted">
            제한전형 포함
          </label>
          <button class="btn btn-secondary btn-sm" id="public-rule-reset-btn">전체 보기</button>
        </div>
        <div id="public-company-rules-summary"></div>
      </section>

      <section class="card settings-card grades-panel" style="margin-bottom:16px">
        <div class="settings-title">직접 조건으로 분석</div>
        <div class="settings-note" style="margin:4px 0 14px">아직 현학생 데이터를 올리지 않았을 때 임시로 조건을 입력해서 조회할 수 있습니다.</div>
        <div class="form-row row-2">
          <div><label>학생 이름</label><input class="input" id="rec-name" placeholder="예: 홍길동"></div>
          <div><label>현재 평균 내신</label><input class="input" id="rec-grade" type="number" step="0.01" placeholder="예: 3.2"></div>
        </div>
        <div class="form-row row-2">
          <div><label>보유 자격증</label><input class="input" id="rec-certs" placeholder="예: 전기기능사, 승강기기능사"></div>
          <div><label>희망 회사/분야</label><input class="input" id="rec-company" placeholder="예: A회사 또는 전기"></div>
        </div>
        <button class="btn btn-primary btn-sm" id="rec-run-btn">졸업생 데이터로 조회</button>
        <div id="recommendation-result" style="margin-top:14px"></div>
      </section>

      <section class="card settings-card grades-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <div class="settings-title">현학생 / 졸업생 데이터</div>
            <div class="settings-note">CSV로 현학생과 졸업생을 함께 올릴 수 있습니다. 자격증은 쉼표로 구분합니다.</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select class="input" id="career-type-filter" style="max-width:150px">
              <option value="all">전체</option>
              <option value="current">현학생</option>
              <option value="graduate">졸업생</option>
            </select>
            <input class="input" id="career-grade-max" style="max-width:130px" type="number" step="0.01" min="1" max="9" placeholder="내신 이하">
            <input class="input" id="career-search" style="max-width:260px" placeholder="이름, 회사, 자격증 검색">
            <button class="btn btn-secondary btn-sm" id="career-select-all-btn">전체선택</button>
            <button class="btn btn-danger btn-sm" id="career-delete-selected-btn" style="display:none">선택삭제 (<span id="career-selected-count">0</span>)</button>
          </div>
        </div>
        <div id="career-table-wrap" style="overflow:auto;max-height:560px"></div>
      </section>
    </div>`;
}

async function init() {
  if (!hasAccess()) return;
  if (!unlocked) {
    bindPasswordGate();
    return;
  }
  await loadRecords();
  await loadPublicCompanyRules();
  await loadQuickLinks();
  bindActions();
  renderQuickLinks();
  renderPublicRuleYearTabs();
  renderPublicCompanyRulesSummary();
  renderTable();
  renderStudentSearch('');
}

function bindPasswordGate() {
  const input = document.getElementById('grades-password-input');
  const button = document.getElementById('grades-password-submit');
  const status = document.getElementById('grades-password-status');
  const submit = async () => {
    const typed = String(input?.value || '').trim();
    if (!typed) {
      if (status) status.textContent = '비밀번호를 입력해 주세요.';
      return;
    }
    try {
      await window.appGradesVerifyPassword(typed);
      unlocked = true;
      await render(document.getElementById('page-content'));
      await init();
    } catch (error) {
      if (status) status.textContent = formatPasswordError(error);
    }
  };
  input?.focus();
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });
  button?.addEventListener('click', submit);
}

function formatPasswordError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (code.includes('not-found') || message.includes('not-found')) {
    return '성적관리 보안 설정을 찾지 못했습니다. Functions 배포 상태를 확인해 주세요.';
  }
  if (code.includes('permission-denied')) return '비밀번호가 맞지 않거나 성적관리 권한이 없습니다.';
  if (code.includes('unauthenticated')) return (message || '로그인이 필요합니다. 앱을 완전히 종료한 뒤 다시 로그인해 주세요.') + ' / 코드: ' + code;
  return message || '비밀번호 확인에 실패했습니다.';
}

async function loadRecords() {
  records = (await window.appCareerListRecords()).map(normalizeRecord);
}

async function loadPublicCompanyRules() {
  if (publicCompanyRules.length) return;
  try {
    if (window.api?.getPublicCompanyRules) {
      const rows = await window.api.getPublicCompanyRules();
      if (Array.isArray(rows)) {
        publicCompanyRules = rows.map(normalizePublicCompanyRule);
        return;
      }
    }
    const response = await fetch('../public_company_highschool_certificate_bonus.json');
    if (!response.ok) throw new Error('public company rules not found');
    const rows = await response.json();
    publicCompanyRules = Array.isArray(rows) ? rows.map(normalizePublicCompanyRule) : [];
  } catch (error) {
    publicCompanyRules = [];
  }
}

function renderPublicCompanyRulesSummary() {
  const root = document.getElementById('public-company-rules-summary');
  if (!root) return;
  if (!publicCompanyRules.length) {
    root.innerHTML = '<div class="grades-ai-empty">공식 공고 근거 데이터 파일을 아직 읽지 못했습니다. 앱을 완전히 재시작해 주세요.</div>';
    return;
  }
  const companyQuery = document.getElementById('public-rule-company-input')?.value || '';
  const certQuery = document.getElementById('public-rule-cert-input')?.value || '';
  const includeRestricted = !!document.getElementById('public-rule-include-restricted')?.checked;
  const companyQ = normalize(companyQuery);
  const certQ = normalize(certQuery);
  const rows = publicCompanyRules
    .filter((rule) => ruleMatchesAcademicYear(rule, publicRuleYearFilter))
    .filter((rule) => includeRestricted || !isRestrictedPublicRule(rule))
    .filter((rule) => /가산점|서류 점수|응시자격|우대사항/.test(rule.qualification_type))
    .filter((rule) => publicRuleQuickFilter !== 'finance' || isFinancePublicRule(rule))
    .filter((rule) => publicRuleQuickFilter !== 'verified' || isScoreablePublicRule(rule))
    .filter((rule) => {
      if (!companyQ) return true;
      if (companyQ === '금융' || companyQ === '금융권') return isFinancePublicRule(rule);
      return normalize([rule.institution, rule.notice_title, rule.job_category].join(' ')).includes(companyQ);
    })
    .filter((rule) => {
      if (!certQ) return true;
      return normalize([rule.certificate_name, rule.certificate_level, rule.conditions, rule.notes].join(' ')).includes(certQ);
    })
    .sort((a, b) => {
      const aScoreable = isScoreablePublicRule(a) ? 0 : 1;
      const bScoreable = isScoreablePublicRule(b) ? 0 : 1;
      return aScoreable - bScoreable
        || comparePublicRuleDateDesc(a, b)
        || String(a.institution).localeCompare(String(b.institution), 'ko');
    });
  const scoreable = rows.filter(isScoreablePublicRule).length;
  const eligibility = rows.filter((rule) => rule.qualification_type === '응시자격').length;
  const financeRows = rows.filter(isFinancePublicRule).length;
  const yearLabel = getPublicRuleYearLabel(publicRuleYearFilter);
  root.innerHTML = `
    <div class="grades-ai-grid">
      <div class="grades-ai-card">
        <div class="grades-ai-label">${escapeHtml(yearLabel)} 조회 결과</div>
        <div class="grades-ai-big">${rows.length}건</div>
        <div class="grades-ai-copy">가산점/서류점수 ${scoreable}건 · 응시자격 ${eligibility}건 · 금융권 ${financeRows}건 · 부분확인/과거공고 ${rows.length - scoreable - eligibility}건 · 장애인/보훈 등 제한전형 기본 제외</div>
      </div>
      <div class="grades-ai-card">
        <div class="grades-ai-label">연도 기준</div>
        <div class="grades-ai-copy">${escapeHtml(getPublicRuleYearDescription(publicRuleYearFilter))}</div>
      </div>
    </div>
    <div class="grades-ai-section">
      <div class="grades-ai-section-title">가산점/응시자격 상세</div>
      ${rows.length ? rows.map((rule) => renderPublicRuleLookupRow(rule)).join('') : `<div class="settings-note">${escapeHtml(yearLabel)}에서 검색 조건에 맞는 공식 근거가 없습니다. 아직 공고가 안 떴을 수 있으니 다른 연도 탭도 함께 확인해 주세요.</div>`}
    </div>`;
  bindPublicSourceButtons(root);
  updatePublicRuleYearTabs();
  updatePublicRuleFilterBtns();
}

function getPublicRuleYears() {
  return unique(publicCompanyRules.map(getPublicRuleDisplayYear).filter(Boolean))
    .filter((year) => /^\d{4}$/.test(year))
    .sort((a, b) => Number(b) - Number(a))
    .slice(0, 5);
}

function renderPublicRuleYearTabs() {
  const root = document.getElementById('public-rule-year-tabs');
  if (!root) return;
  const years = getPublicRuleYears();
  if (years.length && (!publicRuleYearFilter || (!years.includes(publicRuleYearFilter) && publicRuleYearFilter !== 'all'))) {
    publicRuleYearFilter = years[0];
  }
  root.innerHTML = [
    ...years.map((year) => `<button class="btn btn-sm public-rule-year-tab" data-year="${escapeHtml(year)}">${escapeHtml(year)}학년도</button>`),
    '<button class="btn btn-sm public-rule-year-tab" data-year="all">전체연도</button>'
  ].join('');
  root.querySelectorAll('.public-rule-year-tab').forEach((button) => {
    button.addEventListener('click', () => {
      publicRuleYearFilter = button.dataset.year || 'all';
      renderPublicCompanyRulesSummary();
    });
  });
  updatePublicRuleYearTabs();
}

function ruleMatchesAcademicYear(rule, filter) {
  const year = getPublicRuleDisplayYear(rule);
  if (filter === 'all') return true;
  return year === filter;
}

function getPublicRuleYearLabel(filter) {
  if (/^\d{4}$/.test(String(filter || ''))) return `${filter}학년도`;
  return '전체연도';
}

function getPublicRuleYearDescription(filter) {
  if (/^\d{4}$/.test(String(filter || ''))) return `${filter}학년도 탭은 접수 시작일이 ${filter}년인 공고를 우선 보여줍니다. 공고명 연도와 접수기간이 다르면 접수기간을 기준으로 분류합니다.`;
  return '전체연도 탭은 최근 5년 범위에 수집된 모든 공고를 함께 보여줍니다. 최신 추천에는 접수기간이 가장 가까운 연도 탭을 우선 확인하세요.';
}

function updatePublicRuleYearTabs() {
  document.querySelectorAll('.public-rule-year-tab').forEach((button) => {
    const active = button.dataset.year === publicRuleYearFilter;
    button.classList.toggle('btn-primary', active);
    button.classList.toggle('btn-secondary', !active);
  });
}

function updatePublicRuleFilterBtns() {
  const isFinance = publicRuleQuickFilter === 'finance';
  const isVerified = publicRuleQuickFilter === 'verified';
  const isReset = publicRuleQuickFilter === 'all';
  const financeBtn = document.getElementById('public-rule-finance-btn');
  const verifiedBtn = document.getElementById('public-rule-verified-btn');
  const resetBtn = document.getElementById('public-rule-reset-btn');
  if (financeBtn) { financeBtn.classList.toggle('btn-primary', isFinance); financeBtn.classList.toggle('btn-secondary', !isFinance); }
  if (verifiedBtn) { verifiedBtn.classList.toggle('btn-primary', isVerified); verifiedBtn.classList.toggle('btn-secondary', !isVerified); }
  if (resetBtn) { resetBtn.classList.toggle('btn-primary', isReset); resetBtn.classList.toggle('btn-secondary', !isReset); }
}

function getPublicRuleDisplayYear(rule) {
  return extractFirstYear(rule?.application_period)
    || extractFirstYear(rule?.posted_date)
    || String(rule?.recruitment_year || '').trim();
}

function extractFirstYear(value) {
  const match = String(value || '').match(/20\d{2}/);
  return match ? match[0] : '';
}

function getPublicRuleDateKey(rule) {
  const source = rule?.application_period || rule?.posted_date || rule?.recruitment_year || '';
  const match = String(source).match(/(20\d{2})[.\-/년\s]*(\d{1,2})?[.\-/월\s]*(\d{1,2})?/);
  if (!match) return Number(getPublicRuleDisplayYear(rule) || 0) * 10000;
  const year = Number(match[1] || 0);
  const month = Number(match[2] || 1);
  const day = Number(match[3] || 1);
  return year * 10000 + month * 100 + day;
}

function comparePublicRuleDateDesc(a, b) {
  return getPublicRuleDateKey(b) - getPublicRuleDateKey(a);
}

function isScoreablePublicRule(rule) {
  return rule.status === '검증됨' && /가산점|서류 점수/.test(rule.qualification_type);
}

function renderPublicRuleLookupRow(rule) {
  const statusClass = rule.status === '검증됨' ? 'verified' : (rule.status === '부분확인' ? 'partial' : 'expired');
  const isScore = /가산점|서류 점수/.test(rule.qualification_type);
  const scoreText = rule.bonus_score || (isScore ? '점수 확인불가' : '가산점 아님');
  return `
    <div class="grades-public-card ${rule.status === '검증됨' ? '' : 'muted'}">
      <div class="grades-result-header">
        <b>${escapeHtml(rule.institution)}</b>
        <span class="grades-rule-status ${statusClass}">${escapeHtml(rule.status)}</span>
      </div>
      <div class="grades-result-meta">${escapeHtml(rule.notice_title || '-')}</div>
      <div class="grades-result-detail"><b>직무/전형</b>: ${escapeHtml(rule.job_category || '-')}</div>
      <div class="grades-result-detail"><b>반영 방식</b>: ${escapeHtml(rule.qualification_type || '-')} · ${escapeHtml(rule.bonus_stage || '-')}</div>
      <div class="grades-result-detail"><b>가산점/점수</b>: ${escapeHtml(scoreText)}</div>
      <div class="grades-result-detail"><b>대상 자격증</b>: ${escapeHtml(rule.certificate_name || '-')} ${rule.certificate_level ? `· ${escapeHtml(rule.certificate_level)}` : ''}</div>
      <div class="grades-result-detail"><b>인정 조건</b>: ${escapeHtml(rule.conditions || rule.max_bonus || '-')}</div>
      <div class="grades-source-quote">근거: ${escapeHtml(rule.source_quote || '-')} · ${escapeHtml(rule.page_or_section || '')}</div>
      <div class="grades-public-actions">
        <span>${escapeHtml(rule.application_period || '')}</span>
        ${rule.source_url ? `<button class="btn btn-secondary btn-sm public-source-btn" data-url="${escapeHtml(rule.source_url)}">공식 출처</button>` : ''}
      </div>
    </div>`;
}

async function loadQuickLinks() {
  quickLinks = window.appCareerListLinks ? await window.appCareerListLinks() : [];
}

function bindActions() {
  document.removeEventListener('keydown', handleGradesShortcutKeys);
  document.addEventListener('keydown', handleGradesShortcutKeys);
  document.getElementById('career-template-btn')?.addEventListener('click', downloadTemplate);
  document.getElementById('career-export-btn')?.addEventListener('click', exportRecords);
  document.getElementById('career-import-btn')?.addEventListener('click', () => document.getElementById('career-import-input')?.click());
  document.getElementById('career-import-input')?.addEventListener('change', (event) => importCSV(event.target.files?.[0]));
  document.getElementById('career-add-btn')?.addEventListener('click', () => openRecordModal());
  document.getElementById('quick-link-add-btn')?.addEventListener('click', () => openQuickLinkModal());
  document.getElementById('rec-run-btn')?.addEventListener('click', runManualRecommendation);
  document.getElementById('local-ai-run-btn')?.addEventListener('click', runLocalAiBriefing);
  document.getElementById('public-rule-search-btn')?.addEventListener('click', () => {
    publicRuleQuickFilter = 'search';
    renderPublicCompanyRulesSummary();
  });
  document.getElementById('public-rule-finance-btn')?.addEventListener('click', () => {
    publicRuleQuickFilter = 'finance';
    renderPublicCompanyRulesSummary();
  });
  document.getElementById('public-rule-verified-btn')?.addEventListener('click', () => {
    publicRuleQuickFilter = 'verified';
    renderPublicCompanyRulesSummary();
  });
  document.getElementById('public-rule-reset-btn')?.addEventListener('click', () => {
    const companyInput = document.getElementById('public-rule-company-input');
    const certInput = document.getElementById('public-rule-cert-input');
    const includeRestricted = document.getElementById('public-rule-include-restricted');
    if (companyInput) companyInput.value = '';
    if (certInput) certInput.value = '';
    if (includeRestricted) includeRestricted.checked = false;
    publicRuleQuickFilter = 'all';
    renderPublicCompanyRulesSummary();
  });
  document.getElementById('public-rule-include-restricted')?.addEventListener('change', renderPublicCompanyRulesSummary);
  document.getElementById('public-rule-company-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      publicRuleQuickFilter = 'search';
      renderPublicCompanyRulesSummary();
    }
  });
  document.getElementById('public-rule-cert-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      publicRuleQuickFilter = 'search';
      renderPublicCompanyRulesSummary();
    }
  });
  document.getElementById('company-search-btn')?.addEventListener('click', runCompanySearch);
  document.getElementById('company-search-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runCompanySearch();
  });
  document.getElementById('student-search-input')?.addEventListener('input', (event) => {
    renderStudentSearch(event.target.value || '');
  });
  document.getElementById('career-search')?.addEventListener('input', (event) => {
    searchText = event.target.value || '';
    renderTable();
  });
  document.getElementById('career-type-filter')?.addEventListener('change', (event) => {
    typeFilter = event.target.value || 'all';
    renderTable();
  });
  document.getElementById('career-grade-max')?.addEventListener('input', (event) => {
    gradeMaxFilter = event.target.value || '';
    renderTable();
  });
  document.getElementById('career-select-all-btn')?.addEventListener('click', () => {
    const checks = document.querySelectorAll('.career-row-check');
    const allChecked = Array.from(checks).every((c) => c.checked);
    checks.forEach((c) => { c.checked = !allChecked; });
    updateSelectionUI();
  });
  document.getElementById('career-delete-selected-btn')?.addEventListener('click', deleteSelectedRecords);
}

function renderQuickLinks() {
  const root = document.getElementById('quick-link-list');
  if (!root) return;
  if (!quickLinks.length) {
    root.innerHTML = '<div class="settings-note">등록된 온라인 바로가기가 없습니다. 자주 여는 취업/성적 자료 링크를 추가해 주세요.</div>';
    return;
  }
  root.innerHTML = quickLinks.map((link) => `
    <div class="menu-group-card" style="padding:14px 16px">
      <div class="grades-quick-link-title">${escapeHtml(link.title)}</div>
      ${link.note ? `<div class="grades-quick-link-note">${escapeHtml(link.note)}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm quick-link-open-btn" data-url="${escapeHtml(link.url)}">열기</button>
        <button class="btn btn-secondary btn-sm quick-link-edit-btn" data-id="${escapeHtml(link.id)}">수정</button>
        <button class="btn btn-danger btn-sm quick-link-delete-btn" data-id="${escapeHtml(link.id)}">삭제</button>
      </div>
    </div>
  `).join('');

  root.querySelectorAll('.quick-link-open-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const url = button.dataset.url || '';
      if (window.api?.openUrl) window.api.openUrl(url);
      else window.open(url, '_blank');
    });
  });
  root.querySelectorAll('.quick-link-edit-btn').forEach((button) => {
    button.addEventListener('click', () => openQuickLinkModal(quickLinks.find((link) => link.id === button.dataset.id)));
  });
  root.querySelectorAll('.quick-link-delete-btn').forEach((button) => {
    button.addEventListener('click', () => deleteQuickLink(button.dataset.id));
  });
}

function openQuickLinkModal(link) {
  const isEdit = !!link;
  showModal(`
    <div class="modal-header">
      <span class="modal-title">${isEdit ? '온라인 바로가기 수정' : '온라인 바로가기 추가'}</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body" style="display:grid;gap:12px">
      <div class="form-row"><label>이름</label><input class="input" id="quick-link-title" value="${escapeHtml(link?.title || '')}" placeholder="예: 취업 포털"></div>
      <div class="form-row"><label>주소</label><input class="input" id="quick-link-url" value="${escapeHtml(link?.url || '')}" placeholder="https://..."></div>
      <div class="form-row"><label>메모</label><input class="input" id="quick-link-note" value="${escapeHtml(link?.note || '')}" placeholder="예: 졸업생 취업처 확인용"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="quick-link-save-btn">저장</button>
    </div>`);

  setTimeout(() => {
    document.getElementById('quick-link-title')?.focus();
    document.getElementById('quick-link-save-btn')?.addEventListener('click', async () => {
      const data = {
        id: link?.id,
        title: document.getElementById('quick-link-title')?.value.trim() || '',
        url: document.getElementById('quick-link-url')?.value.trim() || '',
        note: document.getElementById('quick-link-note')?.value.trim() || '',
        sortOrder: link?.sortOrder || Date.now()
      };
      try {
        await window.appCareerSaveLink(data);
        closeModal();
        await loadQuickLinks();
        renderQuickLinks();
        toast('온라인 바로가기를 저장했습니다.', 'success');
      } catch (error) {
        toast(error?.message || '온라인 바로가기를 저장하지 못했습니다.', 'error');
      }
    });
  }, 0);
}

async function deleteQuickLink(id) {
  if (!confirm('이 온라인 바로가기를 삭제할까요?')) return;
  try {
    await window.appCareerDeleteLink(id);
    await loadQuickLinks();
    renderQuickLinks();
    toast('온라인 바로가기를 삭제했습니다.', 'success');
  } catch (error) {
    toast(error?.message || '바로가기 삭제에 실패했습니다.', 'error');
  }
}

function renderStudentSearch(query) {
  const root = document.getElementById('student-search-results');
  if (!root) return;
  const q = normalize(query);
  const currentStudents = getCurrentStudents();
  const matches = (q ? currentStudents.filter((row) => normalize([row.name, row.schoolNumber, row.className, row.desiredCompany, row.certificates.join(',')].join(' ')).includes(q)) : currentStudents)
    .slice(0, 8);

  if (!matches.length) {
    root.innerHTML = '<div class="settings-note">검색되는 현학생 데이터가 없습니다. CSV에서 구분을 "현학생"으로 올리거나 학생 데이터를 추가해 주세요.</div>';
    selectedStudentId = '';
    document.getElementById('student-analysis-result').innerHTML = '';
    return;
  }

  root.innerHTML = matches.map((row) => `
    <button class="btn btn-secondary btn-sm student-pick-btn" data-id="${escapeHtml(row.id)}" style="justify-content:flex-start;text-align:left">
      ${escapeHtml(row.name)} · ${escapeHtml(row.className || '-')} · 내신 ${escapeHtml(row.gradeAverage || '-')} · ${escapeHtml((row.certificates || []).slice(0, 3).join(', ') || '자격증 없음')}
    </button>
  `).join('');

  root.querySelectorAll('.student-pick-btn').forEach((button) => {
    button.addEventListener('click', () => {
      selectedStudentId = button.dataset.id || '';
      const student = records.find((row) => row.id === selectedStudentId);
      if (student) renderStudentAnalysis(student);
    });
  });
}

function renderStudentAnalysis(student) {
  const root = document.getElementById('student-analysis-result');
  if (!root) return;
  const result = analyzeStudent(student);
  root.innerHTML = result;
  bindPublicSourceButtons(root);
}

function runCompanySearch() {
  const query = document.getElementById('company-search-input')?.value.trim() || '';
  const root = document.getElementById('company-analysis-result');
  if (!root) return;
  root.innerHTML = analyzeCompany(query);
}

function runManualRecommendation() {
  const student = {
    name: document.getElementById('rec-name')?.value.trim() || '현재 학생',
    gradeAverage: Number(document.getElementById('rec-grade')?.value || 0),
    certificates: splitList(document.getElementById('rec-certs')?.value || ''),
    desiredCompany: document.getElementById('rec-company')?.value.trim() || '',
    desiredRole: ''
  };
  const root = document.getElementById('recommendation-result');
  root.innerHTML = analyzeStudent(student);
  bindPublicSourceButtons(root);
}

function runLocalAiBriefing() {
  const root = document.getElementById('local-ai-result');
  if (!root) return;
  root.innerHTML = buildLocalAiBriefing();
}

function buildLocalAiBriefing() {
  const currentStudents = getCurrentStudents();
  const graduates = getGraduateRows();
  const employed = graduates.filter((row) => row.employmentCompany);
  const issues = detectDataIssues();
  const companyStats = buildCompanyStats(employed).slice(0, 6);
  const ruleStats = {
    total: publicCompanyRules.length,
    verified: publicCompanyRules.filter((rule) => rule.status === '검증됨').length
  };
  const studentGaps = currentStudents
    .map((student) => ({ student, summary: getStudentReadinessSummary(student, graduates) }))
    .sort((a, b) => b.summary.priority - a.summary.priority)
    .slice(0, 6);

  if (!records.length) {
    return '<div class="grades-ai-empty">분석할 데이터가 아직 없습니다. CSV로 현학생/졸업생 데이터를 먼저 올려 주세요.</div>';
  }

  return `
    <div class="grades-ai-grid">
      <div class="grades-ai-card">
        <div class="grades-ai-label">데이터 상태</div>
        <div class="grades-ai-big">${records.length}건</div>
        <div class="grades-ai-copy">현학생 ${currentStudents.length}명 · 취업 졸업생 ${employed.length}명 · 회사 ${companyStats.length}개 이상</div>
      </div>
      <div class="grades-ai-card">
        <div class="grades-ai-label">AI 판단</div>
        <div class="grades-ai-copy">${escapeHtml(makeOverallAdvice(currentStudents, employed, issues))}</div>
      </div>
      <div class="grades-ai-card">
        <div class="grades-ai-label">공식 공고 근거</div>
        <div class="grades-ai-big">${ruleStats.verified}/${ruleStats.total}</div>
        <div class="grades-ai-copy">검증된 자격증/응시자격 규칙만 추천 점수에 반영합니다.</div>
      </div>
    </div>

    <div class="grades-ai-section">
      <div class="grades-ai-section-title">상담 우선순위 후보</div>
      ${studentGaps.length ? studentGaps.map(({ student, summary }) => `
        <div class="grades-ai-row">
          <b>${escapeHtml(student.name || '이름 없음')}</b>
          <span>${escapeHtml(summary.text)}</span>
        </div>`).join('') : '<div class="settings-note">현학생 데이터가 없어 상담 우선순위를 만들 수 없습니다.</div>'}
    </div>

    <div class="grades-ai-section">
      <div class="grades-ai-section-title">회사별 핵심 조건</div>
      ${companyStats.length ? companyStats.map((item) => `
        <div class="grades-ai-row">
          <b>${escapeHtml(item.company)}</b>
          <span>합격 ${item.count}명 · 평균 내신 ${item.avgGrade ? item.avgGrade.toFixed(2) : '-'} · 주요 자격증 ${escapeHtml(item.topCerts.join(', ') || '-')}</span>
        </div>`).join('') : '<div class="settings-note">취업 회사가 입력된 졸업생 데이터가 없습니다.</div>'}
    </div>

    <div class="grades-ai-section">
      <div class="grades-ai-section-title">데이터 정리 필요 후보</div>
      ${issues.length ? issues.slice(0, 10).map((issue) => `
        <div class="grades-ai-row warning">
          <b>${escapeHtml(issue.title)}</b>
          <span>${escapeHtml(issue.detail)}</span>
        </div>`).join('') : '<div class="grades-ai-row good"><b>좋음</b><span>큰 데이터 오류 후보를 찾지 못했습니다.</span></div>'}
    </div>`;
}

function makeOverallAdvice(currentStudents, employed, issues) {
  if (!currentStudents.length && !employed.length) return '현학생과 졸업생 데이터를 모두 올리면 추천 정확도가 올라갑니다.';
  if (!currentStudents.length) return '졸업생 데이터는 있으나 현학생 데이터가 부족합니다. 현학생 CSV를 올리면 학생별 상담 요약이 가능해집니다.';
  if (!employed.length) return '현학생 데이터는 있으나 취업한 졸업생 데이터가 부족합니다. 합격 졸업생 데이터를 먼저 모아 주세요.';
  if (issues.length >= 5) return '분석은 가능하지만 회사명/자격증명 표기가 흔들립니다. 데이터 정리를 먼저 하면 추천 결과가 더 정확해집니다.';
  return '상담에 사용할 수 있는 기본 데이터가 준비되어 있습니다. 학생 이름 검색과 회사 검색을 함께 사용하면 좋습니다.';
}

function getStudentReadinessSummary(student, graduates) {
  const desired = [student.desiredCompany, student.desiredRole].filter(Boolean).join(' ');
  const pool = desired ? graduates.filter((row) => recordMatchesCompany(row, desired)) : graduates;
  const usablePool = pool.length ? pool : graduates;
  const avgGrade = average(usablePool.map((row) => Number(row.gradeAverage)).filter((value) => value > 0));
  const topCerts = countCertificates(usablePool).slice(0, 4).map((item) => item.name);
  const missing = topCerts.filter((cert) => !hasCertificate(student.certificates || [], cert));
  const grade = Number(student.gradeAverage) || 0;
  let priority = missing.length * 8;
  if (grade && avgGrade && grade > avgGrade) priority += Math.min(30, (grade - avgGrade) * 12);
  if (!desired) priority += 6;

  const parts = [];
  if (desired) parts.push(`희망 ${desired}`);
  else parts.push('희망 회사 미입력');
  if (grade && avgGrade) parts.push(grade > avgGrade ? `내신 ${Math.max(0, grade - avgGrade).toFixed(2)}등급 보완 필요` : '내신은 유리한 편');
  if (missing.length) parts.push(`보완 자격증: ${missing.slice(0, 3).join(', ')}`);
  else parts.push('주요 자격증 겹침');
  return { priority, text: parts.join(' · ') };
}

function buildCompanyStats(rows) {
  const grouped = {};
  rows.forEach((row) => {
    const key = String(row.employmentCompany || '').trim();
    if (!key) return;
    grouped[key] = grouped[key] || [];
    grouped[key].push(row);
  });
  return Object.keys(grouped).map((company) => {
    const companyRows = grouped[company];
    return {
      company,
      count: companyRows.length,
      avgGrade: average(companyRows.map((row) => Number(row.gradeAverage)).filter((value) => value > 0)),
      topCerts: countCertificates(companyRows).slice(0, 3).map((item) => item.name)
    };
  }).sort((a, b) => b.count - a.count || String(a.company).localeCompare(String(b.company), 'ko'));
}

function detectDataIssues() {
  const issues = [];
  const companyNames = records.map((row) => row.employmentCompany).filter(Boolean);
  const certNames = records.flatMap((row) => row.certificates || []).filter(Boolean);
  findNearDuplicates(companyNames, '회사명').forEach((issue) => issues.push(issue));
  findNearDuplicates(certNames, '자격증명').forEach((issue) => issues.push(issue));

  records.forEach((row) => {
    if (row.gradeAverage && (Number(row.gradeAverage) < 1 || Number(row.gradeAverage) > 9)) {
      issues.push({ title: '내신 값 확인', detail: `${row.name || '이름 없음'} 학생의 내신 ${row.gradeAverage} 값이 일반 범위를 벗어난 것 같습니다.` });
    }
    if (row.recordType === 'graduate' && !row.employmentCompany) {
      issues.push({ title: '졸업생 취업처 누락', detail: `${row.name || '이름 없음'} 데이터는 졸업생으로 되어 있지만 취업 회사가 비어 있습니다.` });
    }
    if (row.recordType === 'current' && row.employmentCompany) {
      issues.push({ title: '현학생 취업처 확인', detail: `${row.name || '이름 없음'} 데이터는 현학생인데 취업 회사가 입력되어 있습니다. 구분을 확인해 주세요.` });
    }
  });
  return issues;
}

function findNearDuplicates(values, label) {
  const normalized = {};
  values.forEach((value) => {
    const key = normalize(value);
    if (!key) return;
    normalized[key] = normalized[key] || new Set();
    normalized[key].add(String(value).trim());
  });
  return Object.values(normalized)
    .filter((set) => set.size > 1)
    .map((set) => ({
      title: `${label} 표기 통일`,
      detail: Array.from(set).join(' / ') + ' 처럼 같은 값이 다르게 입력된 것 같습니다.'
    }));
}

function analyzeStudent(student) {
  const graduates = getGraduateRows();
  const publicMatches = matchPublicCompanyRules(student);
  if (!graduates.length && !publicMatches.length) return '<div class="settings-note">분석할 졸업생 취업 데이터와 공식 공고 근거 데이터가 아직 없습니다.</div>';

  const desired = [student.desiredCompany, student.desiredRole].filter(Boolean).join(' ');
  const targetRows = desired
    ? graduates.filter((row) => recordMatchesCompany(row, desired))
    : [];
  const pool = targetRows.length ? targetRows : graduates;
  const avgGrade = average(pool.map((row) => Number(row.gradeAverage)).filter((value) => value > 0));
  const certStats = countCertificates(pool);
  const missingCerts = certStats.slice(0, 6).map((item) => item.name).filter((cert) => !hasCertificate(student.certificates, cert));
  const companies = graduates
    .map((row) => ({ row, score: similarityScore(row, student, desired) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const grade = Number(student.gradeAverage) || 0;
  const gradeAdvice = grade && avgGrade
    ? (grade > avgGrade
      ? `희망 조건 합격자 평균은 ${avgGrade.toFixed(2)}등급입니다. 현재 ${grade.toFixed(2)}등급이면 약 ${(grade - avgGrade).toFixed(2)}등급 정도 올리는 것을 목표로 잡을 수 있습니다.`
      : `희망 조건 합격자 평균(${avgGrade.toFixed(2)}등급)보다 현재 내신이 유리합니다.`)
    : '내신 데이터가 부족해서 내신 목표는 계산하지 못했습니다.';

  return `
    <div class="menu-group-card" style="padding:16px 18px">
      <div class="grades-analysis-card-title">${escapeHtml(student.name || '현재 학생')} 분석 결과</div>
      <div style="display:grid;gap:6px;margin-bottom:10px">
        <div><b>현재 내신</b>: ${escapeHtml(student.gradeAverage || '-')} / <b>자격증</b>: ${escapeHtml((student.certificates || []).join(', ') || '-')}</div>
        <div><b>희망</b>: ${escapeHtml(desired || '희망 회사 미입력')}</div>
      </div>
      <div class="settings-note">${escapeHtml(gradeAdvice)}</div>
      <div style="margin-top:10px"><b>우선 준비하면 좋은 자격증</b>: ${missingCerts.length ? escapeHtml(missingCerts.join(', ')) : '주요 합격자 자격증과 현재 보유 자격증이 많이 겹칩니다.'}</div>
      ${renderPublicCompanyMatches(publicMatches)}
      ${graduates.length ? `
        <div style="margin-top:12px"><b>졸업생 데이터 기준 가능성이 있는 회사</b></div>
        <div style="display:grid;gap:8px;margin-top:8px">
          ${companies.map(({ row, score }) => renderGraduateMatch(row, score)).join('')}
        </div>` : '<div class="settings-note" style="margin-top:12px">졸업생 취업 데이터가 없어 과거 합격자 유사도는 계산하지 않았습니다.</div>'}
    </div>`;
}

function normalizePublicCompanyRule(rule) {
  return Object.assign({}, rule || {}, {
    institution: String(rule?.institution || ''),
    notice_title: String(rule?.notice_title || ''),
    job_category: String(rule?.job_category || ''),
    qualification_type: String(rule?.qualification_type || ''),
    certificate_name: String(rule?.certificate_name || ''),
    certificate_level: String(rule?.certificate_level || ''),
    bonus_stage: String(rule?.bonus_stage || ''),
    bonus_score: String(rule?.bonus_score || ''),
    status: String(rule?.status || '확인불가'),
    notes: String(rule?.notes || ''),
    source_url: String(rule?.source_url || ''),
    source_quote: String(rule?.source_quote || '')
  });
}

function isRestrictedPublicRule(rule) {
  const text = normalize([
    rule.recruitment_round,
    rule.employment_track,
    rule.job_category,
    rule.eligibility,
    rule.conditions,
    rule.notes
  ].join(' '));
  return /장애인|보훈|국가유공|취업지원대상자|사회형평|저소득|북한이탈|다문화|자립준비/.test(text);
}

function isFinancePublicRule(rule) {
  const text = normalize([
    rule.institution,
    rule.notice_title,
    rule.job_category,
    rule.certificate_name,
    rule.conditions,
    rule.notes
  ].join(' '));
  return /예금보험|신용보증|자산관리|주택금융|수출입은행|산업은행|기업은행|한국은행|은행|금융|보험|회계|전산회계|기업회계|전산세무|세무|재경관리/.test(text);
}

function matchPublicCompanyRules(student) {
  const certs = student.certificates || [];
  const desired = normalize([student.desiredCompany, student.desiredRole].filter(Boolean).join(' '));
  return publicCompanyRules
    .filter((rule) => !isRestrictedPublicRule(rule))
    .map((rule) => {
      const statusWeight = rule.status === '검증됨' ? 40 : (rule.status === '부분확인' ? 10 : -20);
      const typeWeight = /가산점|서류 점수|응시자격/.test(rule.qualification_type) ? 18 : 0;
      const certScore = getRuleCertificateScore(rule, certs);
      const desiredScore = desired && normalize([rule.institution, rule.job_category, rule.certificate_name, rule.notes].join(' ')).includes(desired) ? 20 : 0;
      const usablePenalty = rule.status === '검증됨' ? 0 : -25;
      const score = statusWeight + typeWeight + certScore + desiredScore + usablePenalty;
      return { rule, score, certScore, desiredScore };
    })
    .filter((item) => item.score > 20 || item.certScore > 0 || item.desiredScore > 0)
    .sort((a, b) => b.score - a.score || String(a.rule.institution).localeCompare(String(b.rule.institution), 'ko'))
    .slice(0, 8);
}

function getRuleCertificateScore(rule, certs) {
  const ruleCertText = normalize(rule.certificate_name + ' ' + rule.certificate_level + ' ' + rule.conditions);
  if (!ruleCertText || ruleCertText === '해당없음') return 0;
  let score = 0;
  certs.forEach((cert) => {
    const own = normalize(cert);
    if (!own) return;
    if (ruleCertText.includes(own) || own.includes(ruleCertText)) score = Math.max(score, 35);
    if (/전기/.test(own) && /전기/.test(ruleCertText)) score = Math.max(score, 25);
    if (/산업안전/.test(own) && /산업안전/.test(ruleCertText)) score = Math.max(score, 25);
    if (/정보처리|컴퓨터활용|사무자동화/.test(own) && /정보처리|컴퓨터활용|사무자동화/.test(ruleCertText)) score = Math.max(score, 22);
    if (/한국사/.test(own) && /한국사/.test(ruleCertText)) score = Math.max(score, 20);
    if (/전산회계|전산세무|재경관리|회계/.test(own) && /전산회계|전산세무|재경관리|회계/.test(ruleCertText)) score = Math.max(score, 22);
  });
  return score;
}

function renderPublicCompanyMatches(matches) {
  if (!publicCompanyRules.length) {
    return '<div class="settings-note" style="margin-top:12px">공식 공고 근거 데이터 파일을 읽지 못했습니다.</div>';
  }
  if (!matches.length) {
    return `
      <div class="grades-public-box">
        <div class="grades-public-title">공식 공고 근거 추천</div>
        <div class="settings-note">현재 보유 자격증과 직접 매칭되는 검증 공고를 찾지 못했습니다. 예: 전기기능사, 전기산업기사, 한국사능력검정시험, 컴퓨터활용능력처럼 공고 표기와 비슷하게 입력하면 매칭률이 올라갑니다.</div>
      </div>`;
  }
  return `
    <div class="grades-public-box">
      <div class="grades-public-title">공식 공고 근거 추천</div>
      <div class="settings-note" style="margin-bottom:10px">학생 정보는 외부로 보내지 않고, 앱에 포함된 공식 공고 데이터와 로컬에서만 비교합니다.</div>
      <div style="display:grid;gap:8px">
        ${matches.map((item) => renderPublicCompanyRuleCard(item)).join('')}
      </div>
    </div>`;
}

function renderPublicCompanyRuleCard(item) {
  const rule = item.rule;
  const safeToScore = rule.status === '검증됨';
  const statusClass = rule.status === '검증됨' ? 'verified' : (rule.status === '부분확인' ? 'partial' : 'expired');
  return `
    <div class="grades-public-card ${safeToScore ? '' : 'muted'}">
      <div class="grades-result-header">
        <b>${escapeHtml(rule.institution)}</b>
        <span class="grades-rule-status ${statusClass}">${escapeHtml(rule.status)}</span>
      </div>
      <div class="grades-result-meta">${escapeHtml(rule.job_category || '-')} · ${escapeHtml(rule.qualification_type || '-')} · ${escapeHtml(rule.bonus_stage || '-')}</div>
      <div class="grades-result-detail">
        <b>자격/점수</b>: ${escapeHtml(rule.certificate_name || '-')} ${rule.bonus_score ? `· ${escapeHtml(rule.bonus_score)}` : ''}
      </div>
      <div class="grades-source-quote">근거: ${escapeHtml(rule.source_quote || '-')}</div>
      <div class="grades-public-actions">
        <span>${safeToScore ? `추천점수 ${Math.round(item.score)}` : '점수화 제외'}</span>
        ${rule.source_url ? `<button class="btn btn-secondary btn-sm public-source-btn" data-url="${escapeHtml(rule.source_url)}">공식 출처</button>` : ''}
      </div>
    </div>`;
}

function bindPublicSourceButtons(root) {
  root.querySelectorAll('.public-source-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const url = button.dataset.url || '';
      if (url && window.api?.openUrl) window.api.openUrl(url);
      else if (url) window.open(url, '_blank');
    });
  });
}

function analyzeCompany(query) {
  const q = normalize(query);
  if (!q) return '<div class="settings-note">회사명이나 직무를 입력해 주세요.</div>';
  const matches = getGraduateRows().filter((row) => recordMatchesCompany(row, query));
  if (!matches.length) return '<div class="settings-note">해당 회사/직무로 취업한 졸업생 데이터가 없습니다.</div>';

  const avgGrade = average(matches.map((row) => Number(row.gradeAverage)).filter((value) => value > 0));
  const certStats = countCertificates(matches).slice(0, 8);
  const companyNames = unique(matches.map((row) => row.employmentCompany).filter(Boolean)).slice(0, 8);

  return `
    <div class="menu-group-card" style="padding:16px 18px">
      <div class="grades-analysis-card-title">"${escapeHtml(query)}" 합격 졸업생 분석</div>
      <div style="display:grid;gap:6px;margin-bottom:10px">
        <div><b>검색된 졸업생</b>: ${matches.length}명</div>
        <div><b>관련 회사</b>: ${escapeHtml(companyNames.join(', ') || '-')}</div>
        <div><b>합격자 평균 내신</b>: ${avgGrade ? avgGrade.toFixed(2) + '등급' : '-'}</div>
        <div><b>많이 보유한 자격증</b>: ${certStats.length ? escapeHtml(certStats.map((item) => `${item.name}(${item.count})`).join(', ')) : '-'}</div>
      </div>
      <div style="display:grid;gap:8px;margin-top:8px">
        ${matches
          .sort((a, b) => (Number(a.gradeAverage) || 99) - (Number(b.gradeAverage) || 99))
          .slice(0, 20)
          .map((row) => renderGraduateDetail(row))
          .join('')}
      </div>
    </div>`;
}

function renderGraduateMatch(row, score) {
  return `
    <div class="grades-result-card">
      <div class="grades-result-header">
        <b>${escapeHtml(row.employmentCompany || '-')}</b>
        <span class="grades-score-badge">유사도 ${Math.round(score)}점</span>
      </div>
      <div class="grades-result-meta">${escapeHtml(row.employmentRole || '')} · ${escapeHtml(row.graduationYear || '')}년 졸업</div>
      <div class="grades-result-detail">내신 ${escapeHtml(row.gradeAverage || '-')} · 자격증 ${escapeHtml((row.certificates || []).join(', ') || '-')} · ${escapeHtml(row.name || '졸업생')}</div>
    </div>`;
}

function renderGraduateDetail(row) {
  return `
    <div class="grades-result-card">
      <div class="grades-result-header">
        <b>${escapeHtml(row.name || '졸업생')}</b>
        <span class="grades-year-badge">${escapeHtml(row.graduationYear || '')}년</span>
      </div>
      <div class="grades-result-meta">${escapeHtml(row.employmentCompany || '-')} · ${escapeHtml(row.employmentRole || '')}</div>
      <div class="grades-result-detail">내신 ${escapeHtml(row.gradeAverage || '-')} · 자격증 ${escapeHtml((row.certificates || []).join(', ') || '-')} · 출결 ${escapeHtml(row.attendance || '-')}</div>
    </div>`;
}

function renderTable() {
  const wrap = document.getElementById('career-table-wrap');
  if (!wrap) return;
  const q = normalize(searchText);
  const gradeMax = Number(gradeMaxFilter) || 0;
  const filtered = records.filter((row) => {
    if (typeFilter !== 'all' && row.recordType !== typeFilter) return false;
    if (gradeMax && (!(Number(row.gradeAverage) > 0) || Number(row.gradeAverage) > gradeMax)) return false;
    if (!q) return true;
    return normalize([
      row.recordTypeLabel, row.graduationYear, row.name, row.schoolNumber, row.gradeLevel, row.classGroup, row.className, row.gradeAverage,
      row.certificates.join(','), row.desiredCompany, row.desiredRole,
      row.employmentCompany, row.employmentRole, row.region, row.note
    ].join(' ')).includes(q);
  });

  if (!filtered.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:36px"><div class="icon">?</div><p>표시할 데이터가 없습니다.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="position:sticky;top:0;z-index:1">
          <th style="padding:8px;width:32px"></th>
          ${['구분','졸업년도','이름','학번','학년반','내신','자격증','희망','취업처','직무','지역','관리'].map((h) => `<th style="text-align:left">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${filtered.map((row) => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:8px;text-align:center"><input type="checkbox" class="career-row-check" data-id="${escapeHtml(row.id)}"></td>
            <td style="padding:8px;white-space:nowrap"><span class="grades-type-badge ${row.recordType === 'current' ? 'current' : 'graduate'}">${escapeHtml(row.recordTypeLabel)}</span></td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.graduationYear)}</td>
            <td style="padding:8px;font-weight:700;white-space:nowrap">${escapeHtml(row.name)}</td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.schoolNumber)}</td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.className)}</td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.gradeAverage)}</td>
            <td style="padding:8px;min-width:180px">${escapeHtml(row.certificates.join(', '))}</td>
            <td style="padding:8px;min-width:140px">${escapeHtml([row.desiredCompany, row.desiredRole].filter(Boolean).join(' / '))}</td>
            <td style="padding:8px;font-weight:700;min-width:140px">${escapeHtml(row.employmentCompany)}</td>
            <td style="padding:8px;min-width:100px">${escapeHtml(row.employmentRole)}</td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.region)}</td>
            <td style="padding:8px;white-space:nowrap">
              <button class="btn btn-secondary btn-sm career-edit-btn" data-id="${escapeHtml(row.id)}">수정</button>
              <button class="btn btn-danger btn-sm career-del-btn" data-id="${escapeHtml(row.id)}">삭제</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('.career-edit-btn').forEach((button) => {
    button.addEventListener('click', () => openRecordModal(records.find((row) => row.id === button.dataset.id)));
  });
  wrap.querySelectorAll('.career-del-btn').forEach((button) => {
    button.addEventListener('click', () => deleteRecord(button.dataset.id));
  });
  wrap.querySelectorAll('.career-row-check').forEach((cb) => {
    cb.addEventListener('change', updateSelectionUI);
  });
}

function updateSelectionUI() {
  const checks = document.querySelectorAll('.career-row-check');
  const checkedCount = Array.from(checks).filter((c) => c.checked).length;
  const deleteBtn = document.getElementById('career-delete-selected-btn');
  const countSpan = document.getElementById('career-selected-count');
  const selectAllBtn = document.getElementById('career-select-all-btn');
  if (deleteBtn) deleteBtn.style.display = checkedCount > 0 ? '' : 'none';
  if (countSpan) countSpan.textContent = checkedCount;
  if (selectAllBtn) selectAllBtn.textContent = checkedCount === checks.length && checks.length > 0 ? '전체해제' : '전체선택';
}

function openRecordModal(record) {
  const isEdit = !!record;
  const type = record?.recordType || 'current';
  showModal(`
    <div class="modal-header">
      <span class="modal-title">${isEdit ? '학생 데이터 수정' : '학생 데이터 추가'}</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body" style="display:grid;gap:12px">
      <div class="form-row row-2">
        <div>
          <label>구분</label>
          <select class="input" id="career-type">
            <option value="current" ${type === 'current' ? 'selected' : ''}>현학생</option>
            <option value="graduate" ${type === 'graduate' ? 'selected' : ''}>졸업생</option>
          </select>
        </div>
        <div><label>졸업년도</label><input class="input" id="career-year" type="number" value="${escapeHtml(record?.graduationYear || new Date().getFullYear())}"></div>
      </div>
      <div class="form-row row-2">
        <div><label>이름</label><input class="input" id="career-name" value="${escapeHtml(record?.name || '')}"></div>
        <div><label>학번</label><input class="input" id="career-number" value="${escapeHtml(record?.schoolNumber || '')}"></div>
      </div>
      <div class="form-row row-2">
        <div><label>학년반</label><input class="input" id="career-class" value="${escapeHtml(record?.className || '')}" placeholder="예: 3-1"></div>
        <div><label>평균 내신</label><input class="input" id="career-grade" type="number" step="0.01" value="${escapeHtml(record?.gradeAverage || '')}"></div>
      </div>
      <div class="form-row row-2">
        <div><label>출결요약</label><input class="input" id="career-attendance" value="${escapeHtml(record?.attendance || '')}"></div>
        <div><label>지역</label><input class="input" id="career-region" value="${escapeHtml(record?.region || '')}"></div>
      </div>
      <div class="form-row"><label>자격증</label><input class="input" id="career-certs" value="${escapeHtml((record?.certificates || []).join(', '))}" placeholder="쉼표로 구분"></div>
      <div class="form-row row-2">
        <div><label>희망 회사</label><input class="input" id="career-desired-company" value="${escapeHtml(record?.desiredCompany || '')}"></div>
        <div><label>희망 직무</label><input class="input" id="career-desired-role" value="${escapeHtml(record?.desiredRole || '')}"></div>
      </div>
      <div class="form-row row-2">
        <div><label>취업 회사</label><input class="input" id="career-company" value="${escapeHtml(record?.employmentCompany || '')}" placeholder="졸업생일 때 입력"></div>
        <div><label>취업 직무</label><input class="input" id="career-role" value="${escapeHtml(record?.employmentRole || '')}" placeholder="졸업생일 때 입력"></div>
      </div>
      <div class="form-row"><label>비고</label><input class="input" id="career-note" value="${escapeHtml(record?.note || '')}"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="career-save-btn">저장</button>
    </div>`);

  setTimeout(() => {
    document.getElementById('career-name')?.focus();
    document.getElementById('career-save-btn')?.addEventListener('click', async () => {
      const next = collectModalRecord(record?.id);
      if (!next.name) return toast('이름을 입력해 주세요.', 'error');
      await window.appCareerSaveRecord(next);
      closeModal();
      await loadRecords();
      renderStudentSearch(document.getElementById('student-search-input')?.value || '');
      renderTable();
      toast('저장했습니다.', 'success');
    });
  }, 0);
}

function collectModalRecord(id) {
  return normalizeRecord({
    id,
    recordType: document.getElementById('career-type')?.value || 'current',
    graduationYear: Number(document.getElementById('career-year')?.value || new Date().getFullYear()),
    name: document.getElementById('career-name')?.value.trim() || '',
    schoolNumber: document.getElementById('career-number')?.value.trim() || '',
    className: document.getElementById('career-class')?.value.trim() || '',
    gradeAverage: parseGradeValue(document.getElementById('career-grade')?.value || ''),
    attendance: document.getElementById('career-attendance')?.value.trim() || '',
    certificates: splitList(document.getElementById('career-certs')?.value || ''),
    desiredCompany: document.getElementById('career-desired-company')?.value.trim() || '',
    desiredRole: document.getElementById('career-desired-role')?.value.trim() || '',
    employmentCompany: document.getElementById('career-company')?.value.trim() || '',
    employmentRole: document.getElementById('career-role')?.value.trim() || '',
    region: document.getElementById('career-region')?.value.trim() || '',
    note: document.getElementById('career-note')?.value.trim() || ''
  });
}

async function deleteRecord(id) {
  if (!confirm('이 학생 데이터를 삭제할까요?')) return;
  try {
    await window.appCareerDeleteRecord(id);
    await loadRecords();
    renderStudentSearch(document.getElementById('student-search-input')?.value || '');
    renderTable();
    toast('삭제했습니다.', 'success');
  } catch (error) {
    toast(error?.message || '삭제에 실패했습니다.', 'error');
  }
}

async function deleteSelectedRecords() {
  const checks = Array.from(document.querySelectorAll('.career-row-check')).filter((c) => c.checked);
  if (!checks.length) return;
  const ids = checks.map((c) => c.dataset.id);
  if (!confirm(`선택한 ${ids.length}명의 데이터를 삭제할까요?`)) return;
  try {
    for (const id of ids) {
      await window.appCareerDeleteRecord(id);
    }
    await loadRecords();
    renderStudentSearch(document.getElementById('student-search-input')?.value || '');
    renderTable();
    updateSelectionUI();
    toast(`${ids.length}건을 삭제했습니다.`, 'success');
  } catch (error) {
    toast(error?.message || '삭제에 실패했습니다.', 'error');
  }
}

function handleGradesShortcutKeys(event) {
  if (!unlocked) return;
  if (!event.altKey) return;
  const tag = String(event.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const key = String(event.key || '').toLowerCase();
  if (key === 'r') {
    event.preventDefault();
    document.getElementById('student-search-input')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('student-search-input')?.focus(), 250);
  } else if (key === 'a') {
    event.preventDefault();
    openRecordModal();
  } else if (key === 'l') {
    event.preventDefault();
    document.getElementById('career-table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('career-search')?.focus(), 250);
  }
}

function similarityScore(row, student, target) {
  let score = 25;
  const rowGrade = Number(row.gradeAverage);
  const grade = Number(student.gradeAverage);
  if (grade && rowGrade) score += Math.max(0, 30 - Math.abs(rowGrade - grade) * 12);
  const rowCerts = row.certificates || [];
  const ownCerts = student.certificates || [];
  const overlap = rowCerts.filter((cert) => hasCertificate(ownCerts, cert)).length;
  score += overlap * 12;
  if (target && recordMatchesCompany(row, target)) score += 25;
  if (!target && row.employmentCompany) score += 5;
  return score;
}

function countCertificates(rows) {
  const map = {};
  rows.forEach((row) => (row.certificates || []).forEach((cert) => {
    const key = cert.trim();
    if (key) map[key] = (map[key] || 0) + 1;
  }));
  return Object.keys(map).map((name) => ({ name, count: map[name] })).sort((a, b) => b.count - a.count);
}

function normalizeRecord(row) {
  const next = Object.assign({}, row || {});
  const type = normalize(next.recordType || next.type || next.kind);
  const inferredGraduate = !!String(next.employmentCompany || '').trim();
  next.recordType = type.includes('graduate') || type.includes('졸업') || type === 'g'
    ? 'graduate'
    : (type.includes('current') || type.includes('현학') || type === 'c' ? 'current' : (inferredGraduate ? 'graduate' : 'current'));
  next.recordTypeLabel = next.recordType === 'graduate' ? '졸업생' : '현학생';
  next.graduationYear = Number(next.graduationYear) || new Date().getFullYear();
  const parsedClass = splitClassName(next.className);
  next.gradeLevel = String(next.gradeLevel || parsedClass.grade || '').trim();
  next.classGroup = String(next.classGroup || parsedClass.group || '').trim();
  next.className = String(next.className || joinClassName(next.gradeLevel, next.classGroup)).trim();
  next.gradeAverage = parseGradeValue(next.gradeAverage);
  next.certificates = Array.isArray(next.certificates) ? next.certificates.map(String).map((item) => item.trim()).filter(Boolean) : splitList(next.certificates || '');
  return next;
}

function joinClassName(gradeLevel, classGroup) {
  const grade = String(gradeLevel || '').trim();
  const group = String(classGroup || '').trim();
  if (grade && group) return `${grade}-${group}`;
  return grade || group || '';
}

function splitClassName(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d+)\s*(?:학년|-|\/|\s)?\s*(\d+)\s*(?:반)?$/);
  return {
    grade: match ? match[1] : '',
    group: match ? match[2] : ''
  };
}

function parseGradeValue(value) {
  const normalized = String(value || '').replace(/등급/g, '').replace(/,/g, '.').trim();
  const match = normalized.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) || 0 : 0;
}

function getCurrentStudents() {
  return records.filter((row) => row.recordType === 'current');
}

function getGraduateRows() {
  return records.filter((row) => row.recordType === 'graduate' || row.employmentCompany);
}

function recordMatchesCompany(row, query) {
  const q = normalize(query);
  return normalize([row.employmentCompany, row.employmentRole, row.desiredCompany, row.desiredRole, row.region, row.note].join(' ')).includes(q);
}

function hasCertificate(certs, cert) {
  return (certs || []).some((own) => normalize(own) === normalize(cert));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function unique(values) {
  return Array.from(new Set(values));
}

function downloadTemplate() {
  downloadCSV('취업데이터_양식.csv', [
    TEMPLATE_HEADERS,
    ['현학생', '2026', '홍길동', '3', '1', '30101', '3.2', '결석0 지각1', '전기기능사, 승강기기능사', 'A회사', '전기설비', '', '', '청주', '현재 지원 준비 중'],
    ['졸업생', '2025', '김졸업', '3', '1', '30102', '3.4', '결석0', '전기기능사, 생산자동화기능사', 'A회사', '전기설비', 'A회사', '전기설비', '청주', '최종 합격']
  ]);
}

function exportRecords() {
  const rows = records.map(recordToCSVRow);
  downloadCSV('취업데이터_' + new Date().toISOString().slice(0, 10) + '.csv', [TEMPLATE_HEADERS, ...rows]);
}

async function importCSV(file) {
  if (!file) return;
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return toast('CSV 데이터가 비어 있습니다.', 'error');
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell || '').trim()));
  if (!dataRows.length) return toast('가져올 데이터가 없습니다.', 'error');
  const importInput = document.getElementById('career-import-input');
  if (importInput) importInput.value = '';
  const headerMap = makeHeaderMap(rows[0]);
  const shouldDelete = confirm(`기존 학생 데이터를 삭제하고 CSV로 교체할까요?\n\n확인 → 기존 데이터 삭제 후 ${dataRows.length}건 업로드\n취소 → 기존 데이터 유지하고 ${dataRows.length}건 병합`);
  if (shouldDelete) {
    await (window.api?.clearCareerRecords?.bind(window.api) || window.appCareerClearAllRecords)();
  }
  for (const row of dataRows) {
    await window.appCareerSaveRecord(csvRowToRecord(row, headerMap));
  }
  await loadRecords();
  renderStudentSearch(document.getElementById('student-search-input')?.value || '');
  renderTable();
  toast(`${dataRows.length}건을 로컬에 저장했습니다.`, 'success');
}

function recordToCSVRow(row) {
  const parsedClass = splitClassName(row.className);
  const gradeLevel = row.gradeLevel || parsedClass.grade || '';
  const classGroup = row.classGroup || parsedClass.group || '';
  return [
    row.recordTypeLabel || '', row.graduationYear || '', row.name || '', gradeLevel, classGroup, row.schoolNumber || '',
    row.gradeAverage || '', row.attendance || '', row.certificates.join(', '),
    row.desiredCompany || '', row.desiredRole || '', row.employmentCompany || '',
    row.employmentRole || '', row.region || '', row.note || ''
  ];
}

function makeHeaderMap(headerRow) {
  const map = {};
  (headerRow || []).forEach((header, index) => {
    const key = normalize(header);
    if (key) map[key] = index;
  });
  return map;
}

function valueByHeader(row, map, names, fallbackIndex) {
  for (const name of names) {
    const index = map[normalize(name)];
    if (index !== undefined) return row[index];
  }
  return fallbackIndex === undefined ? '' : row[fallbackIndex];
}

function csvRowToRecord(row, headerMap = null) {
  if (headerMap) {
    const gradeLevel = String(valueByHeader(row, headerMap, ['학년'], '') || '').trim();
    const classGroup = String(valueByHeader(row, headerMap, ['반'], '') || '').trim();
    const combinedClass = String(valueByHeader(row, headerMap, ['학년반', '학급', '반명'], '') || '').trim();
    return normalizeRecord({
      recordType: valueByHeader(row, headerMap, ['구분', '유형'], ''),
      graduationYear: Number(valueByHeader(row, headerMap, ['졸업년도', '졸업연도', '년도'], '')) || new Date().getFullYear(),
      name: String(valueByHeader(row, headerMap, ['이름', '성명'], '') || '').trim(),
      gradeLevel,
      classGroup,
      schoolNumber: String(valueByHeader(row, headerMap, ['학번', '번호'], '') || '').trim(),
      className: combinedClass || joinClassName(gradeLevel, classGroup),
      gradeAverage: parseGradeValue(valueByHeader(row, headerMap, ['평균내신', '내신', '평균 내신'], '')),
      attendance: String(valueByHeader(row, headerMap, ['출결요약', '출결'], '') || '').trim(),
      certificates: splitList(valueByHeader(row, headerMap, ['자격증', '보유자격증'], '') || ''),
      desiredCompany: String(valueByHeader(row, headerMap, ['희망회사', '희망 회사'], '') || '').trim(),
      desiredRole: String(valueByHeader(row, headerMap, ['희망직무', '희망 직무'], '') || '').trim(),
      employmentCompany: String(valueByHeader(row, headerMap, ['취업회사', '취업 회사', '취업처'], '') || '').trim(),
      employmentRole: String(valueByHeader(row, headerMap, ['취업직무', '취업 직무'], '') || '').trim(),
      region: String(valueByHeader(row, headerMap, ['지역'], '') || '').trim(),
      note: String(valueByHeader(row, headerMap, ['비고', '메모'], '') || '').trim()
    });
  }
  const hasTypeColumn = ['현학생', '졸업생', 'current', 'graduate', 'c', 'g'].includes(normalize(row[0]));
  const offset = hasTypeColumn ? 1 : 0;
  return normalizeRecord({
    recordType: hasTypeColumn ? row[0] : '',
    graduationYear: Number(row[offset + 0]) || new Date().getFullYear(),
    name: String(row[offset + 1] || '').trim(),
    schoolNumber: String(row[offset + 2] || '').trim(),
    className: String(row[offset + 3] || '').trim(),
    gradeAverage: Number(row[offset + 4]) || 0,
    attendance: String(row[offset + 5] || '').trim(),
    certificates: splitList(row[offset + 6] || ''),
    desiredCompany: String(row[offset + 7] || '').trim(),
    desiredRole: String(row[offset + 8] || '').trim(),
    employmentCompany: String(row[offset + 9] || '').trim(),
    employmentRole: String(row[offset + 10] || '').trim(),
    region: String(row[offset + 11] || '').trim(),
    note: String(row[offset + 12] || '').trim()
  });
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted && ch === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function splitList(value) {
  return String(value || '').split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.registerPage('grades', { render, init });
})();
