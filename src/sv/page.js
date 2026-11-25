// 학교폭력 공문·서식 화면
// 서식 화면은 가이드북 한글 원본에서 만든 모델을 그대로 그린 것이고, 고친 글자만 원본 XML에 되돌려 저장한다.
(function () {
  'use strict';
  const C = window.SvCore;
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const px = u => Math.round(u / 75 * 10) / 10; // HWPUNIT(1/7200") → 96dpi
  const parse = (v, d) => { try { return JSON.parse(v) || d; } catch { return d; } };
  const NONE = 'none';

  let root, docs = [], byId = {}, profile = {}, cases = [], caseId = NONE, states = {}, view = { kind: 'home' }, model = null, result = null, focus = null, saveTimer = null, seq = 0, searchIdx = null, navOpen = {};

  // ── 저장소 (로그인한 계정의 PC 안 DB에만 저장) ─────────────────────
  async function load() {
    profile = parse(await api.getSetting('sv_profile', ''), {});
    cases = parse(await api.getSetting('sv_cases', ''), []);
    if (!profile.members) {
      const old = String((await api.getSetting('sv_committee_members', '')) || '');
      profile.members = old.split('\n').map(s => s.trim()).filter(Boolean).map(s => { const i = s.lastIndexOf(' '); return i > 0 ? { role: s.slice(0, i), name: s.slice(i + 1) } : { role: '', name: s }; });
    }
    const name = await window.schoolProfile.name(); if (name) profile.school = name;
    const last = await api.getSetting('sv_last_case', ''); caseId = cases.some(c => c.id === last) ? last : (cases[0] ? cases[0].id : NONE);
    await loadStates();
    docs = await api.svList(); byId = Object.fromEntries(docs.map(d => [d.id, d]));
  }
  async function loadStates() { states = parse(await api.getSetting('sv_docs_' + caseId, ''), {}); }
  const cur = () => cases.find(c => c.id === caseId) || {};
  function persist(what) {
    clearTimeout(saveTimer); persist.q = persist.q || {}; persist.q[what] = caseId;
    saveTimer = setTimeout(flush, 350);
  }
  async function flush() {
    clearTimeout(saveTimer); const q = persist.q || {}; persist.q = {};
    if (q.profile) await api.setSetting('sv_profile', JSON.stringify(profile));
    if (q.cases) await api.setSetting('sv_cases', JSON.stringify(cases));
    if (q.docs) await api.setSetting('sv_docs_' + q.docs, JSON.stringify(states));
  }
  // 문서 상태: 대상 학생이 있는 서식은 학생별로 따로 기억한다.
  const base = id => (states[id] = states[id] || { f: {} });
  function stateOf(id, target) {
    const b = base(id); const t = target !== undefined ? target : b.target; const key = C.TARGET[id] && t ? `${id}@${t}` : id + '@';
    const own = (states[key] = states[key] || {});
    return { key, own, st: { id, clean: b.raw !== true, f: b.f || {}, target: t, date: b.date || '', ops: own.ops || [], attach: b.attach, title: b.title, to: b.to } };
  }
  async function build(id, target) {
    const s = stateOf(id, target);
    const p = { ...profile, school: profile.school || '' };
    for (const op of C.neededOps(id, p, cur(), s.st)) await applyOp(id, s, op);
    const m = await api.svModel(id, s.own.ops || []);
    const r = C.compose(m, p, cur(), s.st);
    r.merged = C.mergeEdits(r.edits, s.own.manual); r.model = m; r.s = s;
    return r;
  }
  async function applyOp(id, s, op) {
    const ops = s.own.ops || [];
    const map = await api.svRowOp(id, ops, op);
    s.own.manual = C.shiftManual(s.own.manual, map); s.own.ops = ops.concat(op); s.st.ops = s.own.ops; persist('docs');
  }

  // ── 바깥 틀 ───────────────────────────────────────────────────
  async function mount(el) {
    root = el; root.innerHTML = '<div class="sv2-loading">가이드북 서식을 불러오는 중…</div>';
    if (!C || !api.svList) { root.innerHTML = '<div class="sv2-loading">학교폭력 서식 모듈을 불러오지 못했습니다. 앱을 다시 시작해 주세요.</div>'; return; }
    await load();
    root.innerHTML = '<div class="sv2"><aside class="sv2-nav"></aside><main class="sv2-main"></main><aside class="sv2-side"></aside></div>';
    root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
    root.addEventListener('focusin', onFocus); root.addEventListener('paste', onPaste);
    drawNav(); await open(view.kind === 'doc' ? view : { kind: 'home' });
  }
  const $ = s => root.querySelector(s);
  function drawNav() {
    const item = (id, ic) => { const d = byId[id]; if (!d) return ''; const no = d.kind === 'doc' ? `공문${d.no}` : d.kind === 'form' ? (d.no === '체크리스트' ? '점검' : `서식${d.no}`) : '설명'; return `<button class="sv2-item ${d.kind} ${view.id === id ? 'on' : ''}" data-open="${id}" title="${esc(d.title)}"><b>${no}</b><span>${esc(d.title)}</span>${ic || ''}</button>`; };
    const grp = (key, title, html) => `<details class="sv2-group" data-g="${key}" ${navOpen[key] !== false ? 'open' : ''}><summary>${esc(title)}</summary>${html}</details>`;
    $('.sv2-nav').innerHTML = `
      <div class="sv2-case">
        <select data-case>${cases.map(c => `<option value="${c.id}" ${c.id === caseId ? 'selected' : ''}>${esc(caseTitle(c))}</option>`).join('')}<option value="${NONE}" ${caseId === NONE ? 'selected' : ''}>사안 없이 서식만 쓰기</option></select>
        <button class="btn btn-secondary btn-sm" data-act="new-case">+ 새 사안</button>
      </div>
      <button class="sv2-item main ${view.kind === 'home' ? 'on' : ''}" data-view="home"><span>🗂 사안 정보 · 관련 학생</span></button>
      <button class="sv2-item main ${view.kind === 'profile' ? 'on' : ''}" data-view="profile"><span>🏫 학교·담당자·전담기구</span></button>
      <button class="sv2-item main ${view.kind === 'search' ? 'on' : ''}" data-view="search"><span>🔎 가이드북 전체 검색</span></button>
      ${grp('common', '처음에 볼 것', item('G-submit') + item('F체크리스트') + item('G-flow') + item('G-qna'))}
      ${C.STAGES.map(s => grp(s.key, s.title, s.docs.map(i => item(i)).join('') + s.forms.map(i => item(i)).join('') + s.guides.map(i => item(i)).join(''))).join('')}
      ${grp('etc', '책자 정보', item('G-cover') + item('G-toc0') + item('G-colophon'))}`;
    $('.sv2-nav').querySelectorAll('details').forEach(d => d.addEventListener('toggle', () => { navOpen[d.dataset.g] = d.open; }));
  }
  function caseTitle(c) { const x = C.makeCtx(profile, c, { id: '' }); return (x.no || '번호 미정') + (c.types && c.types.length ? ` · ${c.types.join('·')}` : '') + (c.receivedDate ? ` (${C.ymd(c.receivedDate)} 접수)` : ''); }
  async function open(v) {
    const my = ++seq; view = v; focus = null;
    root.querySelectorAll('.sv2-item').forEach(b => b.classList.toggle('on', b.dataset.open ? b.dataset.open === v.id : b.dataset.view === v.kind));
    $('.sv2-main').scrollTop = 0;
    if (v.kind === 'home') return drawHome();
    if (v.kind === 'profile') return drawProfile();
    if (v.kind === 'search') return drawSearch();
    $('.sv2-main').innerHTML = '<div class="sv2-loading">불러오는 중…</div>';
    try { await drawDoc(my); } catch (err) { $('.sv2-main').innerHTML = `<div class="sv2-loading">문서를 여는 중 문제가 생겼습니다.<br>${esc(err.message)}</div>`; }
  }

  // ── 입력칸 ────────────────────────────────────────────────────
  function field(scope, f, value) {
    const a = `data-scope="${scope}" data-key="${f.key}"`; const lab = `<span>${esc(f.label)}</span>`;
    if (f.type === 'area') return `<label class="sv2-f wide">${lab}<textarea ${a} rows="${f.rows || 4}" placeholder="${esc(f.ph || '')}">${esc(value)}</textarea></label>`;
    if (/^select:/.test(f.type)) return `<label class="sv2-f">${lab}<select ${a}><option value="">선택</option>${f.type.slice(7).split('|').map(o => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    if (f.type === 'check') return `<label class="sv2-f chk"><input type="checkbox" ${a} ${value ? 'checked' : ''}>${lab}</label>`;
    return `<label class="sv2-f ${f.wide ? 'wide' : ''}">${lab}<input type="${f.type || 'text'}" ${a} value="${esc(value)}" placeholder="${esc(f.ph || '')}"></label>`;
  }
  const FF = (key, label, type, ph, wide) => ({ key, label, type: type || 'text', ph, wide });
  const TYPES = ['신체폭력', '언어폭력', '금품갈취', '강요', '따돌림', '성폭력', '사이버폭력', '기타'];

  function drawHome() {
    const c = cur(); const main = $('.sv2-main'), side = $('.sv2-side');
    if (caseId === NONE) {
      main.innerHTML = `<div class="sv2-empty"><h3>사안을 하나 만들면 모든 공문·서식에 함께 채워집니다</h3><p>사안번호, 관련 학생, 접수 내용을 한 번만 입력하면 공문 ${docs.filter(d => d.kind === 'doc').length}종과 서식 ${docs.filter(d => d.kind === 'form').length}종에 자동으로 들어갑니다. 왼쪽에서 서식을 골라 빈 서식으로 써도 됩니다.</p><button class="btn btn-primary" data-act="new-case">+ 새 사안 만들기</button></div>`;
      side.innerHTML = privacyNote(); return;
    }
    const g = (title, html, note) => `<section class="card sv2-card"><h3>${title}${note ? ` <small>${note}</small>` : ''}</h3><div class="sv2-fields">${html}</div></section>`;
    const f = l => l.map(x => field('case', x, c[x.key] || '')).join('');
    main.innerHTML = `
      ${g('사안 기본', f([FF('short', '학교 약칭(사안번호용)', 'text', C.shortSchool(profile.school) || '예: 행복중'), FF('year', '연도', 'text', '2026'), FF('seq', '일련번호', 'text', '1'), FF('kind', '사안 구분', 'select:학교폭력|아동학대|둘 다'), FF('receivedDate', '접수일', 'date'), FF('receivedTime', '접수 시각', 'time'), FF('reporter', '신고자(성명, 신분)', 'text', '익명 희망 시 "익명"'), FF('receiver', '접수자·인지자(성명, 신분)'), FF('route', '접수·인지 경로', 'text', '담임교사 인지 / 피해학생 신고 등')]) + `<div class="sv2-f wide"><span>사안번호</span><b data-caseno>${esc(C.makeCtx(profile, c, { id: '' }).noHo || '학교 약칭·연도·일련번호를 입력하세요')}</b></div>`)}
      ${g('사실확인 내용', `<div class="sv2-f wide"><span>유형(중복 선택)</span><div class="sv2-chips">${TYPES.map(t => `<label><input type="checkbox" data-type="${t}" ${(c.types || []).includes(t) ? 'checked' : ''}>${t}</label>`).join('')}</div></div>` + f([FF('incidentDate', '발생일', 'date'), FF('when', '발생 일시(문장)', 'text', '2026. 3. 10.(화) 점심시간(13시경)'), FF('place', '장소', 'text', '2학년 3반 교실', true), { key: 'summary', label: '사안 내용(육하원칙)', type: 'area', rows: 5, ph: '홍길동(6학년2반4번) 학생이 3월 10일(화) 점심시간에 …' }, { key: 'agreed', label: '동의서·결과보고서용 사안 조사 내용(비우면 위 내용)', type: 'area', rows: 3, ph: '같은 사안은 모든 관련 학생·관련 학교가 동일한 문구를 써야 합니다.' }, FF('etc', '기타 사항(경찰신고, 고소·소송 등)', 'text', '', true), FF('offenderStaff', '가해자가 교원(아동학대 → 교원인사과 포함)', 'check')]))}
      <section class="card sv2-card"><h3>관련 학생 <small>쌍방이면 “쌍방”을 고르세요. 피해·가해 양쪽 칸에 들어갑니다.</small></h3><div class="sv2-students">${(c.students || []).map(studentCard).join('')}</div><button class="btn btn-secondary btn-sm" data-act="add-student">+ 학생 추가</button></section>
      ${g('즉시분리 · 긴급조치 · 조사', f([FF('sep', '즉시분리', 'select:시행|미시행'), FF('sepDays', '분리 기간(일, 최대 7)', 'text', '5'), FF('sepReason', '미시행 사유', 'select:반대|교육활동|긴급|타교|체험|경미'), FF('twoDate', '가해관련 2호 조치 시행일', 'date'), FF('investigate', '조사 방법', 'select:전담조사관|학교 자체'), FF('otherSchool', '관련 학교명(타교 관련 시)'), FF('otherNotice', '관련 학교 통보(일시·방법·받은 사람)'), FF('availV', '조사 가능시간 — 피해 관련'), FF('availO', '조사 가능시간 — 가해 관련'), FF('opinionV', '관계회복 의견 — 피해 관련', 'text', '상대방이 사과할 경우 참여 의사 있음'), FF('opinionO', '관계회복 의견 — 가해 관련', 'text', '대화로 풀고 싶은 의사가 있음')]), '반대=피해학생 반대의사, 교육활동=교육활동 중 아님, 긴급=긴급조치로 이미 분리, 타교=타학교 재학, 체험=교외체험학습, 경미=자체해결 4요건 모두 해당')}
      ${g('전담기구 · 심의위원회', f([FF('session', '전담기구 회차', 'text', '1'), FF('meetDate', '전담기구 날짜', 'date'), FF('meetTime', '시각', 'time'), FF('meetPlace', '장소', 'text', '본교 1층 회의실'), FF('committeeDate', '심의위원회 개최일', 'date'), FF('actionDate', '교육장 조치(결정)일', 'date')]))}
      ${g('문서번호', Object.keys(C.REF_LABELS).map(k => refField(k)).join(''), '결재가 끝난 공문의 번호를 적어 두면 다음 공문의 “관련”에 자동으로 들어갑니다. 번호만 적으면 학교명이 앞에 붙습니다.')}
      <div class="sv2-btns"><button class="btn btn-secondary" data-act="dup-case">이 사안 복사</button><button class="btn btn-danger" data-act="del-case">이 사안 삭제</button></div>`;
    drawDeadline();
  }
  function refField(k) { const r = (cur().refs || {})[k] || {}; return `<div class="sv2-f ref"><span>${esc(C.REF_LABELS[k])}</span><div><input data-ref="${k}" data-part="no" value="${esc(r.no || '')}" placeholder="번호 (예: 1234)"><input type="date" data-ref="${k}" data-part="date" value="${esc(r.date || '')}"></div></div>`; }
  function studentCard(s, i) {
    const f = (k, l, t, ph) => `<label class="sv2-f">${`<span>${l}</span>`}${/^select:/.test(t || '') ? `<select data-st="${i}" data-key="${k}"><option value=""></option>${t.slice(7).split('|').map(o => `<option ${o === s[k] ? 'selected' : ''}>${o}</option>`).join('')}</select>` : `<input type="${t || 'text'}" data-st="${i}" data-key="${k}" value="${esc(s[k] || '')}" placeholder="${esc(ph || '')}">`}</label>`;
    const ck = (k, l) => `<label><input type="checkbox" data-st="${i}" data-key="${k}" ${s[k] ? 'checked' : ''}>${l}</label>`;
    return `<div class="sv2-student ${/피해/.test(s.role) ? 'v' : /가해/.test(s.role) ? 'o' : ''}"><div class="sv2-st-head"><b>${esc(s.role || '구분 선택')}</b> <span>${esc(s.name || '')}</span><button data-act="del-student" data-i="${i}" title="삭제">×</button></div>
      <div class="sv2-fields">${f('role', '구분', 'select:피해관련|가해관련|쌍방|목격')}${f('name', '성명')}${f('school', '학교(우리 학교면 비움)')}${f('grade', '학년')}${f('cls', '반')}${f('num', '번호')}${f('gender', '성별', 'select:남|여')}${f('birth', '생년월일', 'date')}${f('phone', '학생 연락처')}${f('guardian', '보호자 성명')}${f('gRel', '관계', 'text', '부/모')}${f('gPhone', '보호자 연락처')}<label class="sv2-f wide"><span>주소(우편물 수령지)</span><input data-st="${i}" data-key="addr" value="${esc(s.addr || '')}"></label>${f('notified', '보호자 통보', 'text', '3. 27. 13:30 (유선)')}${f('relInfo', '관계회복 안내', 'select:○|X')}${f('agree', '자체해결 동의', 'select:○|×')}${f('reconcile', '숙려제도 동의', 'select:○|×')}${f('otherNo', '타교 사안번호')}</div>
      <div class="sv2-chips">${ck('athlete', '학생선수')}${ck('disabled', '장애학생')}${ck('special', '특수교육대상자')}${ck('multi', '다문화학생')}${ck('nk', '탈북학생')}</div>
      <details><summary>긴급조치 · 심의위원회 조치</summary><div class="sv2-fields"><label class="sv2-f wide"><span>긴급조치(한 줄에 하나)</span><textarea data-st="${i}" data-key="emergency" rows="2" placeholder="${/가해/.test(s.role) ? '6호 출석정지 4일(2026. 3. 16. ~ 3. 19.)' : '1호 심리상담 및 조언'}">${esc(s.emergency || '')}</textarea></label>${f('emDate', '긴급조치 일자', 'date')}<label class="sv2-f wide"><span>심의위원회 조치(한 줄에 하나)</span><textarea data-st="${i}" data-key="measures" rows="2" placeholder="제3호 학교에서의 봉사 3시간">${esc(s.measures || '')}</textarea></label>${f('due', '1·2·3호 이행기한', 'date')}</div></details></div>`;
  }
  const privacyNote = () => `<section class="sv2-box"><h4>개인정보</h4><p>입력한 사안·학생 정보는 이 PC의 로그인 계정 안에만 저장되며 서버나 AI로 보내지 않습니다. 업무가 끝난 사안은 삭제해 주세요.</p></section>`;
  function drawDeadline() {
    const d = C.deadlines(cur());
    $('.sv2-side').innerHTML = `<section class="sv2-box"><h4>처리 기한</h4>${d ? `<dl><dt>사안접수 보고(48시간, 주말 포함)</dt><dd>${d.report48}까지</dd><dt>즉시분리 최대(초일 산입 7일)</dt><dd>${C.ymdw(d.sep7)}까지</dd><dt>전담기구~보고·요청(14일)</dt><dd>${C.ymdw(d.d14)}까지</dd><dt>연기 시(21일, 내부결재 필수)</dt><dd>${C.ymdw(d.d21)}까지</dd><dt>관계회복 숙려제도(28일)</dt><dd>${C.ymdw(d.d28)}까지</dd></dl><small>접수 당일은 빼고 셌으며(분리는 당일 포함), 말일이 토·일이면 다음 월요일로 넘겼습니다. 말일이 공휴일이면 그다음 날로 직접 확인해 주세요. 교육활동이 끝난 뒤 인지했다면 분리는 다음 교육활동일부터 셉니다.</small>` : '<p>접수일을 입력하면 자동으로 계산됩니다.</p>'}</section>${privacyNote()}`;
  }
  function drawProfile() {
    const p = profile; const f = l => l.map(x => field('profile', x, p[x.key] || '')).join('');
    $('.sv2-main').innerHTML = `<section class="card sv2-card"><h3>학교·담당자 <small>모든 사안에 공통으로 쓰입니다.</small></h3><div class="sv2-fields"><div class="sv2-f"><span>학교명(전체 설정과 연동)</span><b>${esc(p.school || '설정에서 학교를 선택해 주세요')}</b></div>${f([FF('short', '학교 약칭', 'text', C.shortSchool(p.school)), FF('eduOffice', '교육지원청', 'select:청주교육지원청|충주교육지원청|제천교육지원청|보은교육지원청|옥천교육지원청|영동교육지원청|진천교육지원청|괴산증평교육지원청|음성교육지원청|단양교육지원청'), FF('principal', '교장 성명'), FF('principalPhone', '교장 휴대전화'), FF('vice', '교감 성명'), FF('vicePhone', '교감 휴대전화'), FF('teacher', '책임교사(담당자) 성명'), FF('teacherPhone', '책임교사 휴대전화'), FF('officePhone', '교무실 전화')])}</div></section>
      <section class="card sv2-card"><h3>전담기구 위원 <small>심의 공문·등록부·명부·심의결과 보고서에 들어갑니다. 학부모 위원은 1/3 이상</small></h3><div class="sv2-members">${(p.members || []).map((m, i) => `<div class="sv2-member"><input data-mb="${i}" data-key="role" list="sv2-roles" value="${esc(m.role || '')}" placeholder="자격"><input data-mb="${i}" data-key="name" value="${esc(m.name || '')}" placeholder="성명"><input data-mb="${i}" data-key="org" value="${esc(m.org || '')}" placeholder="소속(비우면 우리 학교)"><input data-mb="${i}" data-key="phone" value="${esc(m.phone || '')}" placeholder="연락처"><button data-act="del-member" data-i="${i}">×</button></div>`).join('')}</div><datalist id="sv2-roles">${['교감', '책임교사', '보건교사', '상담교사', '교원 위원', '학부모 위원', '학교전담경찰관'].map(r => `<option value="${r}">`).join('')}</datalist><button class="btn btn-secondary btn-sm" data-act="add-member">+ 위원 추가</button></section>`;
    $('.sv2-side').innerHTML = `<section class="sv2-box"><h4>안내</h4><p>재적 위원 과반수 출석으로 열고 출석 위원 과반수 찬성으로 의결합니다. 학부모 위원은 학교운영위원회 추천을 받아 위촉합니다.</p></section>${privacyNote()}`;
  }
  async function drawSearch(q) {
    $('.sv2-main').innerHTML = `<section class="card sv2-card"><h3>가이드북 전체 검색 <small>공문·서식·설명·Q&A 본문까지 찾습니다.</small></h3><input class="sv2-search" data-search placeholder="예: 즉시분리 7일, 출석인정, 조건부 기재유보" value="${esc(q || '')}"><div class="sv2-hits"></div></section>`;
    $('.sv2-side').innerHTML = ''; if (!searchIdx) searchIdx = await api.svSearchText(); $('[data-search]').focus();
  }
  function runSearch(q) {
    const words = q.trim().split(/\s+/).filter(Boolean); const box = $('.sv2-hits'); if (!words.length) { box.innerHTML = ''; return; }
    const hits = searchIdx.filter(d => words.every(w => d.text.includes(w) || d.title.includes(w))).slice(0, 40);
    box.innerHTML = hits.map(d => { const i = Math.max(0, d.text.indexOf(words[0]) - 40); let t = esc(d.text.slice(i, i + 170)); words.forEach(w => { t = t.split(esc(w)).join(`<mark>${esc(w)}</mark>`); }); const k = byId[d.id]; return `<button class="sv2-hit" data-open="${d.id}" data-find="${esc(words[0])}"><b>${k.kind === 'doc' ? '공문' + k.no : k.kind === 'form' ? '서식' + k.no : '설명'} · ${esc(d.title)}</b><span>…${t}…</span></button>`; }).join('') || '<p>찾는 내용이 없습니다.</p>';
  }

  // ── 문서 화면 ──────────────────────────────────────────────────
  async function drawDoc(my) {
    const id = view.id, d = byId[id]; const main = $('.sv2-main');
    if (d.kind === 'guide') {
      model = await api.svModel(id, []); if (my !== seq) return; result = null;
      main.innerHTML = `<div class="sv2-head"><h2>${esc(d.title)}</h2></div><div class="sv2-paper guide">${renderBlocks(model.blocks, { ro: true })}</div>`;
      $('.sv2-side').innerHTML = `<section class="sv2-box"><h4>출처</h4><p>충청북도교육청 인성시민과 「2026. 학교폭력 사안처리 세부설명 A to Z」</p></section>`;
      if (view.find) { const hit = [...main.querySelectorAll('.svp')].find(p => p.textContent.includes(view.find)); if (hit) { hit.scrollIntoView({ block: 'center' }); hit.classList.add('found'); } }
      return;
    }
    const keep = main.scrollTop; const r = await build(id); if (my !== seq) return;
    model = r.model; result = r; const b = base(id), isDoc = d.kind === 'doc';
    const no = isDoc ? `공문${d.no}` : d.no === '체크리스트' ? '점검표' : `서식${d.no}`;
    main.innerHTML = `
      <div class="sv2-head"><div><span class="sv2-no ${d.kind}">${no}</span><h2>${esc(d.title)}</h2></div>
        <div class="sv2-btns">${isDoc ? '<button class="btn btn-primary" data-act="copy-title">제목 복사</button><button class="btn btn-primary" data-act="copy-body">본문 복사</button><button class="btn btn-secondary" data-act="save">본문 한글파일</button><button class="btn btn-secondary" data-act="save-all">본문+붙임 모두 저장</button>' : '<button class="btn btn-primary" data-act="save">한글파일 저장</button>'}</div></div>
      <div class="sv2-tools"><label><input type="checkbox" data-raw ${b.raw ? '' : 'checked'}> 제출용(책자 머리띠·작성 안내 빼기)</label><button data-act="row-add" title="커서가 있는 행 아래에 같은 모양의 행을 넣습니다">＋ 행</button><button data-act="row-del">－ 행</button><button data-act="reset">직접 고친 내용 되돌리기</button><span class="sv2-todo"></span></div>
      ${isDoc ? `<div class="sv2-doc-head"><label>수신<input data-dochead="to" value="${esc(r.doc.to)}"></label><label>제목<input data-dochead="title" value="${esc(r.doc.title)}"></label></div>` : ''}
      <div class="sv2-paper ${isDoc ? 'doc' : 'form'}">${renderBlocks(model.blocks, { r })}</div>
      ${isDoc && r.doc.attach && r.doc.attach.length ? attachBox(r) : ''}`;
    main.scrollTop = keep; drawSide(); countTodo();
  }
  function attachBox(r) {
    return `<section class="card sv2-card"><h3>붙임 <small>체크한 것만 번호가 다시 매겨져 본문에 들어갑니다.</small></h3>${r.doc.attach.map((a, i) => { const forms = a.forms || C.attachForms(a.text, view.id); return `<div class="sv2-attach"><input type="checkbox" data-att="${i}" data-key="on" ${a.on ? 'checked' : ''}><input data-att="${i}" data-key="text" value="${esc(a.text)}">${a.note ? `<em>${esc(a.note)}</em>` : ''}${forms.map(f => `<button data-open="${f}">서식${byId[f] ? byId[f].no : ''} 열기</button>`).join('')}<button data-act="del-att" data-i="${i}">×</button></div>`; }).join('')}<button class="btn btn-secondary btn-sm" data-act="add-att">+ 붙임 추가</button></section>`;
  }
  function drawSide() {
    const id = view.id, r = result, b = base(id), x = r.x; let h = '';
    const tf = C.DOC_FIELDS[id] || [];
    const pool = C.TARGET[id] === 'v' ? x.v : C.TARGET[id] === 'o' ? x.o : C.TARGET[id] ? x.students : [];
    let f = '';
    if (pool.length) f += `<label class="sv2-f wide"><span>대상 학생</span><select data-target>${pool.map(s => `<option ${x.target && x.target.name === s.name ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>`;
    f += tf.map(t => field('doc', t, (b.f || {})[t.key] || '')).join('');
    if (C.HAS_DATE.has(id)) f += `<label class="sv2-f"><span>작성일(비우면 빈칸)</span><input type="date" data-docdate value="${esc(b.date || '')}"></label>`;
    if (r.doc) f += (r.doc.refs || []).map(refField).join('');
    if (f) h += `<section class="sv2-box"><h4>이 문서에 넣을 값</h4><div class="sv2-fields one">${f}</div></section>`;
    if (caseId === NONE) h += '<section class="sv2-box warn"><p>사안을 선택하지 않아 빈 서식 그대로 보입니다.</p></section>';
    if (r.fixes && r.fixes.length) h += `<section class="sv2-box warn"><h4>원문과 다른 점</h4>${r.fixes.map(t => `<p>${esc(t)}</p>`).join('')}</section>`;
    const hints = (r.hints || []).filter(Boolean);
    if (hints.length) h += `<section class="sv2-box"><h4>가이드북 작성 안내</h4>${hints.map(t => t.img ? `<img src="${model.images[t.img] || ''}" alt="">` : `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('')}${r.doc && r.doc.approval ? `<p>결재선(예시): ${esc(r.doc.approval)}</p>` : ''}</section>`;
    const gs = C.GUIDE_OF[id] || []; const st = C.stageOf(id);
    h += `<section class="sv2-box"><h4>관련 설명</h4>${gs.map(g => `<button class="sv2-link" data-open="${g}">${esc(byId[g] ? byId[g].title : g)}</button>`).join('')}<button class="sv2-link" data-open="G-qna">Q&A 전체</button>${st ? '' : ''}</section>`;
    $('.sv2-side').innerHTML = h;
  }

  // ── 원본 모양 그리기 ─────────────────────────────────────────────
  const ALIGN = { CENTER: 'center', RIGHT: 'right', LEFT: 'left', JUSTIFY: 'left', DISTRIBUTE: 'justify', DISTRIBUTE_SPACE: 'justify' };
  const fontMap = f => /명조|바탕|궁서/.test(f) ? "'함초롬바탕','HCR Batang','Batang','AppleMyungjo',serif" : "'맑은 고딕','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
  function csStyle(cs, changed) { const s = model.styles.cs[cs]; if (!s) return ''; return `font-size:${s.h}pt;font-family:${fontMap(s.f)};${s.b ? 'font-weight:700;' : ''}${changed ? '' : (s.i ? 'font-style:italic;' : '') + (s.c ? `color:${s.c};` : '') + (s.u ? 'text-decoration:underline;' : '') + (s.bg ? `background:${s.bg};` : '')}${s.s ? 'text-decoration:line-through;' : ''}${s.sp ? `letter-spacing:${s.sp / 100}em;` : ''}`; }
  function psStyle(ps) { const s = model.styles.ps[ps] || {}; const hang = s.ti < 0 ? -s.ti : 0; return `text-align:${ALIGN[s.al] || 'left'};line-height:${s.ls ? Math.max(1.15, s.ls / 100 * 0.92) : 1.4};${s.ml || hang ? `padding-left:${px((s.ml || 0) + hang)}px;` : ''}${s.mr ? `padding-right:${px(s.mr)}px;` : ''}${s.ti ? `text-indent:${px(s.ti)}px;` : ''}${s.mt ? `margin-top:${px(s.mt)}px;` : ''}${s.mb ? `margin-bottom:${px(s.mb)}px;` : ''}`; }
  const shown = t => String(t).replace(/󰏚/g, '□').replace(/󰊱/g, '①').replace(/󰊲/g, '②').replace(/󰊳/g, '③').replace(/󰊴/g, '④').replace(/󰊵/g, '⑤').replace(/󰀻/g, '▼').replace(/[-]/g, '▪').replace(/[\u{F0000}-\u{10FFFF}]/gu, '▪');
  const textHtml = (t, ro) => { const h = esc(shown(t)); return ro ? h : h.replace(/[□■]/g, m => `<b class="svbox">${m}</b>`); };
  function renderBlocks(blocks, o) { return blocks.map(b => renderP(b, o)).join(''); }
  function renderP(b, o) {
    const r = o.r; const ed = r && r.merged[b.pid];
    if (r && r.drop.includes(b.pid)) return '';
    if (ed && ed.del) return '';
    const manual = r && r.s.own.manual && r.s.own.manual[b.pid];
    const objs = b.items.some(i => i.k !== 't' && !(i.k === 'tbl' && r && r.dropTbl.includes(i.tid)));
    const tx = b.items.filter(i => i.k === 't'); let lastFull = 0; tx.forEach((i, k) => { if (ed && ed.atoms && k in ed.atoms ? ed.atoms[k] : i.s) lastFull = k; }); let n = 0;
    const inner = b.items.map(i => {
      if (i.k === 't') {
        const k = n++; let t = i.s, ch = false; if (ed && ed.atoms && k in ed.atoms) { t = ed.atoms[k]; ch = true; }
        if (ed && ed.extra && ed.extra.length && k === lastFull) t += '\n' + ed.extra.join('\n');
        const st = model.styles.cs[i.cs] || {}; const ex = !ch && !o.ro && (st.c || st.i) && t.trim() ? ' svex' : '';
        return `<span data-a="${k}" class="${ch ? 'svch' : ''}${ex}" style="${csStyle(i.cs, ch)}"${objs && !o.ro ? ' contenteditable="plaintext-only"' : ''}>${textHtml(t, o.ro)}</span>`;
      }
      if (i.k === 'tbl') return r && r.dropTbl.includes(i.tid) ? '' : renderT(i, o);
      if (i.k === 'img') return `<img class="svimg" style="width:${px(i.w)}px;max-width:100%" src="${model.images[i.src] || ''}" alt="">`;
      if (i.k === 'draw') return `<span class="svdraw">${renderBlocks(i.blocks, { ...o, ro: true })}</span>`;
      if (i.k === 'fixed') return `<span>${esc(i.s)}</span>`;
      return '';
    }).join('');
    const blank = !objs && !b.items.map(i => i.s || '').join('').trim() && !(ed && ed.atoms);
    return `<div class="svp${manual ? ' svmanual' : ''}${blank ? ' blank' : ''}" data-pid="${b.pid}" style="${psStyle(b.ps)}"${!objs && !o.ro && b.pid >= 0 ? ' contenteditable="plaintext-only"' : ''}>${b.hd ? `<span class="svhd" contenteditable="false">${esc(shown(b.hd))}</span>` : ''}${inner}</div>`;
  }
  function colWidths(t) {
    const cells = t.rows.flat(); const cols = Math.max(...cells.map(c => c.c + c.cs)); const xs = [0]; let go = true, guard = 0;
    while (go && guard++ < 60) { go = false; cells.forEach(c => { const a = xs[c.c], z = xs[c.c + c.cs]; if (a !== undefined && z === undefined) { xs[c.c + c.cs] = a + c.w; go = true; } else if (a === undefined && z !== undefined) { xs[c.c] = z - c.w; go = true; } }); }
    for (let i = 1; i <= cols; i++) if (xs[i] === undefined) { let j = i; while (j <= cols && xs[j] === undefined) j++; const end = xs[j] === undefined ? xs[i - 1] + 2000 * (j - i + 1) : xs[j]; xs[i] = xs[i - 1] + (end - xs[i - 1]) / (j - i + 1); }
    return Array.from({ length: cols }, (_, i) => Math.max(0, xs[i + 1] - xs[i]));
  }
  const line = s => !s ? 'none' : `${Math.max(1, Math.round(s[1] / 0.2))}px ${/DOUBLE|SLIM|THICK/.test(s[0]) ? 'double' : /DASH/.test(s[0]) ? 'dashed' : /DOT/.test(s[0]) ? 'dotted' : 'solid'} ${s[2] || '#000'}`;
  function bfStyle(id) { const b = model.styles.bf[id]; if (!b) return ''; return `border-left:${line(b.l)};border-right:${line(b.r)};border-top:${line(b.t)};border-bottom:${line(b.b)};${b.f ? `background:${b.f};` : ''}`; }
  function renderT(t, o) {
    const ws = colWidths(t);
    return `<table class="svt" data-tid="${t.tid}" style="width:${px(ws.reduce((a, b) => a + b, 0))}px"><colgroup>${ws.map(w => `<col style="width:${px(w)}px">`).join('')}</colgroup>${t.rows.map((row, ri) => `<tr data-r="${ri}">${row.map(c => `<td ${c.rs > 1 ? `rowspan="${c.rs}"` : ''} ${c.cs > 1 ? `colspan="${c.cs}"` : ''} style="${bfStyle(c.bf)}vertical-align:${c.va === 'CENTER' ? 'middle' : c.va === 'BOTTOM' ? 'bottom' : 'top'};height:${c.rs === 1 ? px(c.h) : 0}px;padding:1px ${Math.max(3, px(c.mr))}px 1px ${Math.max(3, px(c.ml))}px">${renderBlocks(c.blocks, o)}</td>`).join('')}</tr>`).join('')}</table>`;
  }
  function countTodo() {
    const paper = $('.sv2-paper'); if (!paper) return; let n = 0;
    paper.querySelectorAll('.svp').forEach(p => { const own = [...p.children].filter(c => c.dataset && c.dataset.a !== undefined).map(c => c.textContent).join(''); const bad = C.isTodo(own); p.classList.toggle('todo', bad); if (bad) n++; });
    const heads = [...root.querySelectorAll('[data-dochead]')]; heads.forEach(i => { const bad = C.isTodo(i.value); i.classList.toggle('todo', bad); if (bad) n++; });
    const el = $('.sv2-todo'); if (el) { el.textContent = n ? `아직 채우지 않은 자리 ${n}곳(노란색)` : '채우지 않은 자리 없음'; el.className = 'sv2-todo ' + (n ? 'bad' : 'ok'); }
  }

  // ── 편집 ─────────────────────────────────────────────────────
  function readPara(p) {
    const b = findBlock(Number(p.dataset.pid)); if (!b) return;
    const count = b.items.filter(i => i.k === 't').length; const parts = Array.from({ length: count }, () => ''); let last = 0;
    [...p.childNodes].forEach(n => {
      if (n.nodeType === 1 && n.classList.contains('svhd')) return;
      if (n.nodeType === 1 && (n.tagName === 'TABLE' || n.classList.contains('svdraw') || n.classList.contains('svimg'))) return;
      const grab = x => { if (x.nodeType === 3) return x.data; if (x.tagName === 'BR') return '\n'; return (x.tagName === 'DIV' || x.tagName === 'P' ? '\n' : '') + [...x.childNodes].map(y => y.tagName === 'BR' && x.childNodes.length === 1 && x.tagName === 'DIV' ? '' : grab(y)).join(''); };
      const t = grab(n);
      if (n.nodeType === 1 && n.dataset.a !== undefined) last = Number(n.dataset.a);
      parts[last] += t;
    });
    let joined = parts.join(''); if (/\n$/.test(joined)) { for (let i = parts.length - 1; i >= 0; i--) if (parts[i]) { parts[i] = parts[i].replace(/\n$/, ''); break; } joined = parts.join(''); }
    const atoms = {}; let extra = [], cut = false, rest = '';
    parts.forEach((t, i) => { if (cut) { rest += t; atoms[i] = ''; return; } const k = t.indexOf('\n'); if (k >= 0) { cut = true; atoms[i] = t.slice(0, k); rest = t.slice(k + 1); } else atoms[i] = t; });
    if (cut) extra = rest.split('\n');
    // 화면 표시용으로 바꿔 보여 준 특수 기호(□ 등)는 원본 글자가 그대로면 되돌린다.
    b.items.filter(i => i.k === 't').forEach((i, k) => { if (shown(i.s) === atoms[k]) atoms[k] = i.s; });
    const own = result.s.own; own.manual = own.manual || {}; own.manual[b.pid] = extra.length ? { atoms, extra } : { atoms };
    result.merged[b.pid] = own.manual[b.pid]; p.classList.add('svmanual'); persist('docs'); countTodo();
  }
  let blockIdx = null, blockModel = null;
  function findBlock(pid) { if (blockModel !== model) { blockIdx = {}; blockModel = model; (function dig(bs) { bs.forEach(b => { blockIdx[b.pid] = b; b.items.forEach(i => { if (i.k === 'tbl') i.rows.forEach(r => r.forEach(c => dig(c.blocks))); if (i.k === 'draw') dig(i.blocks); }); }); })(model.blocks); } return blockIdx[pid]; }
  let redrawTimer = null;
  function redraw() { clearTimeout(redrawTimer); redrawTimer = setTimeout(async () => { if (view.kind !== 'doc') return; const my = ++seq; const a = document.activeElement; const sel = a && a.dataset && (a.dataset.scope ? `[data-scope="${a.dataset.scope}"][data-key="${a.dataset.key}"]` : a.dataset.ref ? `[data-ref="${a.dataset.ref}"][data-part="${a.dataset.part}"]` : a.dataset.att ? `[data-att="${a.dataset.att}"][data-key="${a.dataset.key}"]` : a.dataset.dochead ? `[data-dochead="${a.dataset.dochead}"]` : ''); const pos = a && a.selectionStart; await drawDoc(my); if (sel) { const el = $(sel); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch { /* 날짜칸 등은 커서 위치가 없다 */ } } } }, 450); }
  function onFocus(e) { const td = e.target.closest && e.target.closest('.sv2-paper td'); if (td) { const tr = td.parentNode; focus = { tid: Number(tr.closest('table').dataset.tid), row: Number(tr.dataset.r) }; } }
  function onPaste(e) { const p = e.target.closest && e.target.closest('.sv2-paper [contenteditable]'); if (!p) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\r/g, '')); }
  function setCase(k, v) { const c = cur(); if (!c.id) return; c[k] = v; persist('cases'); if (['short', 'year', 'seq', 'receivedDate', 'types'].includes(k)) { const o = $('[data-case] option:checked'); if (o) o.textContent = caseTitle(c); const n = $('[data-caseno]'); if (n) n.textContent = C.makeCtx(profile, c, { id: '' }).noHo || '학교 약칭·연도·일련번호를 입력하세요'; } if (view.kind === 'home' && /^received/.test(k)) drawDeadline(); }
  function onInput(e) {
    const t = e.target, d = t.dataset;
    if (t.closest('.sv2-paper')) { const p = t.closest('.svp'); if (p) readPara(p.dataset.pid !== undefined ? p : t); return; }
    if (d.search !== undefined) return runSearch(t.value);
    if (d.scope === 'case') return setCase(d.key, t.type === 'checkbox' ? t.checked : t.value);
    if (d.scope === 'profile') { profile[d.key] = t.value; return persist('profile'); }
    if (d.scope === 'doc') { base(view.id).f = { ...(base(view.id).f || {}), [d.key]: t.value }; persist('docs'); return redraw(); }
    if (d.ref) { const c = cur(); if (!c.id) return; c.refs = c.refs || {}; c.refs[d.ref] = { ...(c.refs[d.ref] || {}), [d.part]: t.value }; persist('cases'); if (view.kind === 'doc') redraw(); return; }
    if (d.st !== undefined) { const s = cur().students[d.st]; s[d.key] = t.type === 'checkbox' ? t.checked : t.value; const card = t.closest('.sv2-student'); card.querySelector('.sv2-st-head span').textContent = s.name || ''; card.querySelector('.sv2-st-head b').textContent = s.role || '구분 선택'; card.className = 'sv2-student ' + (/피해/.test(s.role) ? 'v' : /가해/.test(s.role) ? 'o' : ''); return persist('cases'); }
    if (d.mb !== undefined) { profile.members[d.mb][d.key] = t.value; return persist('profile'); }
    if (d.dochead) { base(view.id)[d.dochead] = t.value; result.doc[d.dochead] = t.value; persist('docs'); return countTodo(); }
    if (d.att !== undefined && d.key === 'text') { saveAttach(a => { a[d.att].text = t.value; }); return redraw(); }
  }
  function saveAttach(fn) { const b = base(view.id); const list = result.doc.attach.map(a => { const old = (b.attach || []).find(o => o.i === a.i && a.i >= 0) || {}; return a.i >= 0 ? { i: a.i, text: a.text !== a.auto ? a.text : '', on: old.on } : { i: -1, text: a.text, on: a.on, forms: a.forms || [] }; }); fn(list); b.attach = list; persist('docs'); }
  async function onChange(e) {
    const t = e.target, d = t.dataset;
    if (d.case !== undefined) { await flush(); caseId = t.value; api.setSetting('sv_last_case', caseId); await loadStates(); drawNav(); return open(view.kind === 'profile' || view.kind === 'search' ? { kind: 'home' } : view); }
    if (d.type) { const c = cur(); const set = new Set(c.types || []); t.checked ? set.add(d.type) : set.delete(d.type); return setCase('types', TYPES.filter(x => set.has(x))); }
    if (d.raw !== undefined) { base(view.id).raw = !t.checked; persist('docs'); return redraw(); }
    if (d.target !== undefined) { base(view.id).target = t.value; persist('docs'); return redraw(); }
    if (d.docdate !== undefined) { base(view.id).date = t.value; persist('docs'); return redraw(); }
    if (d.att !== undefined && d.key === 'on') { saveAttach(a => { a[d.att].on = t.checked; }); return redraw(); }
  }
  async function onClick(e) {
    onFocus(e);
    const box = e.target.closest('.svbox');
    if (box && box.closest('.sv2-paper') && box.closest('[contenteditable]')) { box.textContent = box.textContent === '□' ? '■' : '□'; return readPara(box.closest('.svp')); }
    const o = e.target.closest('[data-open]'); if (o) { await flush(); return open({ kind: 'doc', id: o.dataset.open, find: o.dataset.find }); }
    const v = e.target.closest('[data-view]'); if (v) { await flush(); return open({ kind: v.dataset.view }); }
    const a = e.target.closest('[data-act]'); if (!a) return; const i = Number(a.dataset.i);
    const A = {
      async 'new-case'() { await flush(); const y = String(new Date().getMonth() < 2 ? new Date().getFullYear() - 1 : new Date().getFullYear()); const n = Math.max(0, ...cases.filter(c => c.year === y).map(c => Number(c.seq) || 0)) + 1; const c = { id: 'c' + Date.now(), year: y, seq: String(n), kind: '학교폭력', short: profile.short || C.shortSchool(profile.school), students: [{ role: '피해관련' }, { role: '가해관련' }], refs: {} }; cases.unshift(c); caseId = c.id; states = {}; persist('cases'); api.setSetting('sv_last_case', caseId); drawNav(); open({ kind: 'home' }); },
      async 'dup-case'() { const c = JSON.parse(JSON.stringify(cur())); c.id = 'c' + Date.now(); c.seq = String(Number(c.seq || 0) + 1); c.refs = {}; cases.unshift(c); await flush(); caseId = c.id; states = {}; persist('cases'); drawNav(); drawHome(); },
      async 'del-case'() { if (!confirm(`“${caseTitle(cur())}” 사안과 이 사안에서 작성한 공문·서식 내용을 모두 삭제합니다. 되돌릴 수 없습니다. 계속할까요?`)) return; const id = caseId; clearTimeout(saveTimer); persist.q = {}; cases = cases.filter(c => c.id !== id); await api.setSetting('sv_docs_' + id, ''); await api.setSetting('sv_cases', JSON.stringify(cases)); caseId = cases[0] ? cases[0].id : NONE; await loadStates(); drawNav(); open({ kind: 'home' }); },
      'add-student'() { (cur().students = cur().students || []).push({ role: '' }); persist('cases'); drawHome(); },
      'del-student'() { if (!confirm('이 학생을 목록에서 뺄까요?')) return; cur().students.splice(i, 1); persist('cases'); drawHome(); },
      'add-member'() { (profile.members = profile.members || []).push({ role: '', name: '' }); persist('profile'); drawProfile(); },
      'del-member'() { profile.members.splice(i, 1); persist('profile'); drawProfile(); },
      'add-att'() { saveAttach(l => l.push({ i: -1, text: '새 붙임 1부.', on: true, forms: [] })); redraw(); },
      'del-att'() { saveAttach(l => l.splice(i, 1)); redraw(); },
      async 'row-add'() { await rowTool(false); }, async 'row-del'() { await rowTool(true); },
      reset() { if (!confirm('이 문서에서 직접 고친 내용과 추가·삭제한 행을 모두 되돌릴까요?')) return; const own = result.s.own; delete own.manual; delete own.ops; const b = base(view.id); delete b.attach; delete b.title; delete b.to; persist('docs'); redraw(); },
      async 'copy-title'() { await api.writeRichClipboard(result.doc.title, ''); toast('제목을 복사했습니다.'); },
      async 'copy-body'() { const c = bodyClip(result); await api.writeRichClipboard(c.text, c.html); warnTodo('본문을 복사했습니다. 에듀파인 기안기 본문에 붙여넣으세요.'); },
      async save() { await flush(); const r = await api.svSave(job(result, view.id)); done(r); },
      async 'save-all'() { await flush(); const jobs = await allJobs(); const x = result.x; const r = await api.svSaveMany(jobs, `공문${byId[view.id].no} ${x.noHo || ''} ${byId[view.id].title}`.replace(/\s+/g, ' ')); done(r); }
    }[a.dataset.act];
    if (A) await A();
  }
  async function rowTool(del) {
    if (!focus) return toast('표 안의 행을 먼저 클릭해 주세요.');
    const s = result.s; const before = (s.own.ops || []).length; await applyOp(view.id, s, { tid: focus.tid, row: focus.row, del }); void before; redraw();
  }
  const toast = m => (window.showToast ? window.showToast(m) : mini(m));
  function mini(m) { let t = document.getElementById('sv2-toast'); if (!t) { t = document.createElement('div'); t.id = 'sv2-toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('on'); clearTimeout(mini.t); mini.t = setTimeout(() => t.classList.remove('on'), 2600); }
  const todoCount = () => root.querySelectorAll('.sv2-paper .svp.todo').length + root.querySelectorAll('[data-dochead].todo').length;
  function warnTodo(m) { const n = todoCount(); toast(n ? `${m} (아직 채우지 않은 자리 ${n}곳이 있습니다)` : m); }
  function done(r) { if (!r || r.canceled) return; if (!r.ok) return toast('저장하지 못했습니다: ' + r.error); warnTodo(r.names ? `${r.names.length}개 파일을 저장했습니다.` : '한글 파일을 저장했습니다.'); }
  function fileName(r, id) { const d = byId[id], x = r.x; const who = C.TARGET[id] && x.target && (C.TARGET[id] === 'v' ? x.v : C.TARGET[id] === 'o' ? x.o : x.students).length > 1 ? ` ${x.target.name}` : ''; return d.kind === 'doc' ? `[공문${d.no}] 본문 ${d.title}${x.noHo ? `(${x.noHo})` : ''}` : `[서식${d.no}] ${d.title.replace(/\(.*?\)/g, '').trim()}${who}${x.noHo ? `(${x.noHo})` : ''}`; }
  function job(r, id) { const s = r.s.st; return { id, edits: r.merged, drop: r.drop, dropTbl: r.dropTbl, ops: s.ops, bodyCs: r.doc ? r.doc.bodyCs : null, title: r.doc ? r.doc.title : byId[id].title, fileName: fileName(r, id) }; }
  async function allJobs() {
    const jobs = [job(result, view.id)]; const w = (base(view.id).f || {}).way || ''; const x = result.x;
    for (const a of (result.doc.attach || []).filter(t => t.on)) {
      let forms = a.forms || C.attachForms(a.text, view.id); if (forms.length > 1) forms = view.id === 'D1' ? [/피해학생/.test(a.text) ? 'F2' : 'F1'] : [/종결/.test(w) ? forms[1] : forms[0]];
      for (const f of forms) {
        const pool = C.TARGET[f] === 'v' ? x.v : C.TARGET[f] === 'o' ? x.o : C.TARGET[f] ? x.students : [null];
        for (const s of (pool.length ? pool : [null])) { if (f === 'F22' && w && !base('F22').f.way) base('F22').f.way = w; const r = await build(f, s ? s.name : undefined); const j = job(r, f); if (!jobs.some(k => k.fileName === j.fileName)) jobs.push(j); }
      }
    }
    return jobs;
  }

  // ── 기안기 붙여넣기용 ─────────────────────────────────────────────
  function paraText(b, r) { const ed = r.merged[b.pid]; if (ed && ed.del) return null; let n = 0; let t = b.items.filter(i => i.k === 't').map(i => { const k = n++; return ed && ed.atoms && k in ed.atoms ? ed.atoms[k] : i.s; }).join(''); if (ed && ed.extra) t += '\n' + ed.extra.join('\n'); return (b.hd || '') + shown(t); }
  function bodyClip(r) {
    const nb = s => esc(s).replace(/^ +/, m => '&nbsp;'.repeat(m.length)).replace(/ {2}/g, ' &nbsp;'); const html = [], text = [];
    r.doc.body.forEach(b => {
      if (r.drop.includes(b.pid)) return;
      const tb = b.items.filter(i => i.k === 'tbl' && !r.dropTbl.includes(i.tid));
      tb.forEach(t => { html.push(tableHtml(t, r)); text.push(t.rows.map(row => row.map(c => cellLines(c, r).join(' ')).join('\t')).join('\n')); });
      const t = paraText(b, r); if (t === null || (tb.length && !t.trim())) return;
      t.split('\n').forEach(l => { const s = l.replace(/\s+$/, ''); text.push(s); html.push(`<p style="margin:0;line-height:160%;font-size:12pt">${s ? nb(s) : '&nbsp;'}</p>`); });
    });
    return { text: text.join('\n').replace(/^\n+/, ''), html: html.join('') };
  }
  function cellLines(c, r) { return c.blocks.map(b => paraText(b, r)).filter(t => t !== null).flatMap(t => t.split('\n')).map(t => t.replace(/\s+$/, '')); }
  function tableHtml(t, r) {
    const ws = colWidths(t), total = ws.reduce((a, b) => a + b, 0);
    return `<table border="1" cellspacing="0" cellpadding="3" style="border-collapse:collapse;width:100%;border:1px solid #000">${t.rows.map(row => `<tr>${row.map(c => { const w = ws.slice(c.c, c.c + c.cs).reduce((a, b) => a + b, 0); const bf = model.styles.bf[c.bf] || {}; const ps = model.styles.ps[(c.blocks[0] || {}).ps] || {}; return `<td${c.rs > 1 ? ` rowspan="${c.rs}"` : ''}${c.cs > 1 ? ` colspan="${c.cs}"` : ''} style="width:${(w / total * 100).toFixed(1)}%;border:1px solid #000;padding:3px 5px;vertical-align:middle;text-align:${ALIGN[ps.al] || 'left'};font-size:10.5pt;${bf.f ? `background:${bf.f};` : ''}">${cellLines(c, r).map(l => esc(l) || '&nbsp;').join('<br>')}</td>`; }).join('')}</tr>`).join('')}</table>`;
  }

  window.SchoolViolence = { mount, flush, _bodyClip: () => bodyClip(result) };
})();
