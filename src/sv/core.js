// 학교폭력 공문·서식 자동 채움 규칙 (화면·테스트 공용, 외부 의존성 없음)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SvCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── 날짜 ─────────────────────────────────────────────────────
  const DOW = '일월화수목금토';
  const toDate = v => { const m = String(v || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const ymd = v => { const d = toDate(v); return d ? `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` : ''; };
  const ymdw = v => { const d = toDate(v); return d ? `${ymd(v)}(${DOW[d.getDay()]})` : ''; };
  const ko = v => { const d = toDate(v); return d ? `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일` : ''; };
  const kow = v => { const d = toDate(v); return d ? `${ko(v)} (${DOW[d.getDay()]}요일)` : ''; };
  const addDays = (v, n) => { const d = toDate(v); if (!d) return ''; d.setDate(d.getDate() + n); return iso(d); };
  // 기간을 일로 정한 때: 초일 불산입, 말일이 토·일이면 다음 평일(민법 제157조·제161조). 공휴일은 화면에서 확인하도록 안내한다.
  const dueDate = (v, n) => { let x = addDays(v, n); const d = toDate(x); if (!d) return ''; if (d.getDay() === 6) x = addDays(x, 2); if (d.getDay() === 0) x = addDays(x, 1); return x; };
  const period = (a, b) => { if (!a) return ''; if (!b || a === b) return ymdw(a); const x = toDate(a), y = toDate(b); return x.getFullYear() === y.getFullYear() ? `${ymdw(a)} ~ ${y.getMonth() + 1}. ${y.getDate()}.(${DOW[y.getDay()]})` : `${ymdw(a)} ~ ${ymdw(b)}`; };

  function deadlines(c) {
    const r = c && c.receivedDate; if (!r) return null;
    const t = c.receivedTime || '00:00';
    const d48 = toDate(r); const [h, m] = t.split(':').map(Number); d48.setHours(h + 48, m);
    return {
      report48: `${ymdw(iso(d48))} ${String(d48.getHours()).padStart(2, '0')}:${String(d48.getMinutes()).padStart(2, '0')}`,
      sep7: addDays(r, 6), d14: dueDate(r, 14), d21: dueDate(r, 21), d28: dueDate(r, 28)
    };
  }

  // ── 문서 목록 정보 ─────────────────────────────────────────────
  const STAGES = [
    { key: 'zero', title: '교육지원청 지원 요청', docs: ['D1'], forms: ['F1', 'F2'], guides: ['G-zero'] },
    { key: 's1', title: 'Ⅰ. 초기대응 및 접수', docs: ['D4', 'D2', 'D3'], forms: ['F3', 'F4', 'F5', 'F5-1', 'F5-2', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'], guides: ['G-toc1', 'G-1-1', 'G-1-3', 'G-1-4', 'G-1-5', 'G-1-6', 'G-1-7', 'G-criteria'] },
    { key: 's2', title: 'Ⅱ. 사안조사', docs: ['D5', 'D6', 'D7', 'D8'], forms: ['F12', 'F13'], guides: ['G-toc2', 'G-2-1', 'G-2-5', 'G-2-5b', 'G-2-6'] },
    { key: 's3', title: 'Ⅲ. 전담기구 심의', docs: ['D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15'], forms: ['F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20', 'F21', 'F22', 'F23', 'F24', 'F25', 'F26'], guides: ['G-toc3', 'G-3-1', 'G-3-3'] },
    { key: 's4', title: 'Ⅳ. 조치결과 이행', docs: ['D16', 'D17', 'D18', 'D19', 'D20', 'D21', 'D22', 'D23', 'D24', 'D25', 'D26'], forms: ['F27', 'F28', 'F29', 'F30', 'F31', 'F32', 'F33', 'F34', 'F35', 'F36'], guides: ['G-toc4', 'G-4-1', 'G-4-3', 'G-4-4', 'G-4-5'] },
    { key: 's5', title: 'Ⅴ. 후속조치(생기부 삭제 등)', docs: ['D27', 'D28', 'D29', 'D30', 'D31'], forms: ['F37', 'F38', 'F38-1', 'F39', 'F40', 'F41', 'F42', 'F43'], guides: ['G-toc5', 'G-5-1'] },
    { key: 's6', title: '관계회복 숙려제도', docs: ['D32'], forms: ['F44', 'F45'], guides: ['G-5-2'] }
  ];
  const COMMON = { forms: ['F체크리스트'], guides: ['G-submit', 'G-flow', 'G-toc0', 'G-qna', 'G-cover', 'G-colophon'] };
  const stageOf = id => STAGES.find(s => s.docs.includes(id) || s.forms.includes(id) || s.guides.includes(id)) || null;

  // 문서별 관련 설명(장별 안내) — 화면 오른쪽 '가이드북 설명'에 연결
  const GUIDE_OF = {};
  [['G-zero', 'D1 F1 F2'], ['G-1-1', 'F3'], ['G-1-3', 'F4 F5 F5-1 F5-2'], ['G-1-4', 'F6'], ['G-1-5', 'D2 D3 F7 F8 F9'], ['G-1-7', 'D4 F10 F11'], ['G-submit', 'D4 F10 F11 D13 D14'],
    ['G-1-6', 'D4 F5-1 F5-2'], ['G-2-1', 'F12 F13'], ['G-2-5', 'F12'], ['G-2-5b', 'F12'], ['G-2-6', 'D5 D6 D7 D8'], ['G-3-1', 'D9 D10 D11 D12 D13 F14 F15 F16 F17 F18 F19 F20 F21 F22'],
    ['G-3-3', 'D14 D15 F23 F24 F25 F26'], ['G-4-1', 'F27 F28'], ['G-4-3', 'D16 D17 D18 D19 D21 D22 D23 D24 F29 F30 F31 F32 F35 F36'], ['G-4-4', 'D20 F33 F34'], ['G-4-5', 'D25 D26'], ['G-5-1', 'D27 D28 D29 D30 D31 F37 F38 F38-1 F39 F40'],
    ['G-4-5', 'F43'], ['G-4-3', 'F41 F42'], ['G-5-2', 'D32 F44 F45'], ['G-criteria', 'F12']]
    .forEach(([g, ids]) => ids.split(' ').forEach(id => (GUIDE_OF[id] = GUIDE_OF[id] || []).push(g)));

  // 공문의 붙임 → 서식 연결 (글자로 찾는다)
  const ATTACH_FORMS = [
    [/컨설팅 요청서/, ['F1', 'F2']], [/긴급조치 보고서/, ['F8']], [/긴급조치 통보서/, ['F9']], [/학교폭력 사안접수 보고서/, ['F10']], [/아동학대 사안접수 보고서/, ['F11']],
    [/학생 작성 확인서/, ['F4']], [/보호자 확인서/, ['F5']], [/등록부/, ['F17']], [/사안 ?조사 보고서/, ['F12']], [/분리 의사 확인서/, ['F6']],
    [/전담기구 심의 ?결과 보고서/, ['F18', 'F19']], [/(자체해결(\(종결\))?|종결) ?동의서/, ['F20', 'F21']], [/자체해결(\(종결\))? ?결과 보고서|종결 결과 보고서/, ['F22']], [/의견 청취 요청 의사 확인서/, ['F24']], [/전문가 서면 의견서/, ['F25']],
    [/개최 요구 취소 요청서/, ['F26']], [/개최 요청서/, ['F23']], [/조치이행 결과 ?보고서/, ['F29']], [/봉사 지도 계획서/, ['F31']], [/활동 결과 확인서/, ['F32']], [/개인정보 제공/, ['F33']], [/특별교육 의뢰 신청서/, ['F34']],
    [/교육계획서/, ['F35']], [/담임교사 의견서/, ['F37']], [/자기 의견서/, ['F38']], [/숙려제도 참여 동의서/, ['F45']], [/협의록/, ['F40']]
  ];
  const attachForms = (text, id) => {
    if (id === 'D28' && /심의 결과 보고서/.test(text)) return ['F39'];
    const hit = ATTACH_FORMS.find(([re]) => re.test(text)); return hit ? hit[1] : [];
  };

  const REF_LABELS = {
    intake: '사안접수 보고 공문', emergency: '긴급조치 시행 공문', meetOpen: '전담기구 심의 개최 공문', meetResult: '전담기구 심의 결과 공문', self: '자체해결 결과 공문',
    cmteReq: '심의위원회 개최 요청 공문', outcome: '심의위원회 조치결과 통보 공문(교육지원청)', service: '교내봉사 계획 공문', delOpen: '전담기구(생기부 삭제) 개최 공문', delResult: '전담기구(생기부 삭제) 결과 공문', gradeOpen: '학업성적관리위원회 개최 공문', gradeResult: '학업성적관리위원회 결과 공문', consult: '컨설팅 관련 공문(인성시민과)', partner: '공동 학폭 관련 공문'
  };

  // 문서마다 왼쪽에 보여 줄 입력칸. case: 사안 공통 / ref: 문서번호 / doc: 이 문서에만 쓰는 값
  const F = (key, label, type, ph) => ({ key, label, type: type || 'text', ph: ph || '' });
  const DOC_FIELDS = {
    D1: [F('support', '지원 내용', 'select:사안처리|피해학생|관계회복|상담 및 치유|학업중단 예방')],
    D3: [F('from', '출석정지 시작', 'date'), F('to', '출석정지 끝', 'date'), F('days', '일수(수업일 기준)', 'text', '10'), F('why', '구분', 'select:긴급조치 취소 및 출석 인정|긴급조치 출석 인정')],
    D5: [F('partner', '상대 학교명', 'text', '△△초등학교'), F('who', '상대 학교 학생(학년)', 'text', '박○○(4학년)'), F('whoName', '상대 학생 이름'), F('due', '회신 기한', 'date'), F('ask', '사실확인 요청사항', 'area')],
    D6: [F('partner', '요청한 학교명', 'text', '○○초등학교'), F('who', '우리 학교 해당 학생(학년)', 'text', '박○○(4학년)'), F('ask', '사실확인 요청사항', 'area'), F('reply', '사실확인 회신내용', 'area')],
    D7: [F('partner', '받는 학교', 'text', '가해초등학교장')], D8: [F('partner', '받는 학교', 'text', '가해초등학교장')],
    D9: [F('reason', '연기 사유', 'select:추가 피해사실 확인에 따른 사안조사 기일 연장|학교 시험(정기고사 등)에 따른 사안조사 기일 연장|관련 학생 다수로 인한 사안조사 기일 연장|관련 학생 입원에 따른 사안조사 기일 연장'), F('plan', '개최 예정일', 'date')],
    D12: [F('way', '처리 구분', 'select:자체해결|종결')], D13: [F('way', '처리 구분', 'select:자체해결|종결')], F22: [F('way', '처리 구분', 'select:자체해결|종결|학교폭력 아님 종결')],
    D16: [], D17: [F('from', '봉사 시작', 'date'), F('to', '봉사 끝', 'date'), F('hours', '봉사 시간', 'text', '3')], D18: [F('from', '봉사 시작', 'date'), F('to', '봉사 끝', 'date'), F('hours', '봉사 시간', 'text', '3')],
    D19: [F('org', '의뢰 기관', 'text', '사회봉사 의뢰기관'), F('total', '총 시간', 'text', '10'), F('plan1', '일정 1', 'text', '2026. 9. 24.(목) ~ 9. 25.(금) 13:00 ~ 16:00 (3시간 × 2일 = 6시간)'), F('plan2', '일정 2', 'text'), F('place', '장소')],
    D20: [F('org', '의뢰 기관', 'text', '의뢰기관(Wee센터)')],
    D21: [F('from', '출석정지 시작', 'date'), F('to', '출석정지 끝', 'date'), F('days', '일수(주말 제외)', 'text', '10'), F('place', '장소', 'text', '본교 상담실')],
    D22: [F('before', '기존반', 'text', '1학년 3반'), F('after', '교체반', 'text', '1학년 12반'), F('date', '교체일', 'date')],
    D23: [F('org', '수신', 'text', '지역교육지원청 해당교육과 / 도교육청 중등교육과'), F('result', '심의위원회 결과', 'area')], D24: [F('date', '퇴학 시행일', 'date')],
    D25: [F('result', '조치 결과', 'area', '제17조 제1항제3호 교내봉사 ○시간(2026. 0. 0.까지)'), F('until', '변경 이행기한', 'date'), F('reason', '변경 사유', 'text', '병원 입원')],
    D26: [F('org', '수신(상급학교·전입학교)')],
    D27: [F('round', '회차', 'text', '1'), F('date', '일시(날짜)', 'date'), F('time', '시각', 'time'), F('place', '장소', 'text', '본교 1층 회의실')], D28: [F('round', '회차', 'text', '1')],
    D29: [F('round', '회차', 'text', '1'), F('date', '일시(날짜)', 'date'), F('time', '시각', 'time'), F('place', '장소', 'text', '교장실')], D30: [F('round', '회차', 'text', '1'), F('date', '일시(날짜)', 'date'), F('time', '시각', 'time'), F('place', '장소', 'text', '교장실')],
    D31: [F('grad', '졸업 예정 연월', 'text', '2027년 2월')],
    D32: [F('plan', '전담기구 개최 예정일', 'date')],
    F13: [F('inspector', '담당 조사관')], F15: [F('member', '위촉 위원'), F('from', '위촉 시작', 'date'), F('to', '위촉 끝', 'date'), F('date', '위촉일', 'date')], F16: [F('from', '위촉 시작', 'date'), F('to', '위촉 끝', 'date')],
    F12: [F('inspector', '조사관 성명·연락처'), F('date', '사안조사 일자', 'date'), F('step', '조사 구분', 'select:1차 조사|보완조사')], F4: [F('step', '작성 구분', 'select:최초(학교)|최초(전담조사관)|추가(학교)|추가(전담조사관)')],
    F31: [F('from', '봉사 시작', 'date'), F('to', '봉사 끝', 'date'), F('hours', '봉사 시간', 'text', '3')], F32: [], F35: [F('from', '시작', 'date'), F('to', '끝', 'date'), F('days', '일수', 'text', '10'), F('place', '장소', 'text', '본교 상담실')],
    F29: [F('date', '심의위원회 개최일', 'date')], F42: [F('measure', '피해학생 보호조치', 'area'), F('date', '조치결정일', 'date')],
    F27: [F('entry', '입학 학년도', 'text', '2026')], F28: [F('entry', '입학 학년도', 'text', '2026')], F39: [F('date', '일시(날짜)', 'date'), F('time', '시각', 'time'), F('place', '장소')]
  };
  // 대상 학생 한 명을 골라 쓰는 문서 (v: 피해관련, o: 가해관련, a: 전체)
  const TARGET = { F4: 'a', F5: 'a', F6: 'v', F7: 'o', F9: 'o', F11: 'v', F2: 'v', F20: 'v', F21: 'v', F23: 'v', F24: 'v', F25: 'v', F26: 'v', D17: 'o', D18: 'o', F30: 'o', F31: 'o', F32: 'o', F34: 'o', F35: 'o', D21: 'o', D22: 'o', D23: 'o', D24: 'o', D25: 'o', F37: 'o', F38: 'o', 'F38-1': 'v', F41: 'v', F42: 'v', F43: 'v', F45: 'a', F29: 'o', D20: 'o', D29: 'o', D31: 'o', F40: 'o' };
  // 작성일을 찍을 수 있는 서식 (비우면 원본처럼 빈칸으로 남는다)
  const HAS_DATE = new Set(['F4', 'F5', 'F5-1', 'F6', 'F7', 'F8', 'F9', 'F14', 'F15', 'F20', 'F21', 'F22', 'F23', 'F24', 'F25', 'F26', 'F29', 'F30', 'F33', 'F34', 'F36', 'F37', 'F38', 'F38-1', 'F41', 'F43', 'F45']);

  // 가이드북 원문에서 바로잡은 부분 (화면에 근거와 함께 보여 준다)
  const FIXES = {
    D2: ['붙임의 <서식 ④>, <서식 ④-1>은 예전 번호라 뺐습니다. 2026 책자에서는 서식8(보고서)·서식9(통보서)입니다.'],
    D3: ['원문은 “제17조 제1항 제5호 출석정지”이지만, 출석정지는 제17조제1항제6호이므로 제6호로 바로잡았습니다.'],
    D10: ['원문 “학무보 위원”을 “학부모 위원”으로 바로잡았습니다.'],
    D26: ['근거가 원문 그대로 “시행령 제20조”(전학 조항)입니다. 상급학교 진학에 따른 협조라면 근거를 확인해 주세요.'],
    F13: ['원문 “페기일”을 “폐기일”로 바로잡았습니다.'],
    F10: ['2호 조치 시행일 예시가 2025년으로 되어 있어, 입력한 시행일로 바꿉니다.'],
    F34: ['의뢰사유 아래 칸에 원문이 “※ 피해학생이 작”에서 끊겨 있습니다. 제출용에서는 이 줄을 비웁니다.'],
    F41: ['원문 안내는 “<서식41>을 첨부하여 송부”이지만, 보내는 서식은 서식42(정보 카드)입니다.'],
    D29: ['원문 안내는 “초·중·고 1, 2학년”이지만 책자 본문(2026학년도)은 1·2·3학년입니다.']
  };

  // ── 모델 편집기 ───────────────────────────────────────────────
  const norm = s => String(s || '').replace(/[\s\u2003\u00a0]+/g, '');
  class Ed {
    constructor(model) {
      this.model = model; this.paras = {}; this.tables = {}; this.parent = {}; this.top = new Set(model.blocks.map(b => b.pid));
      const dig = (bs, owner) => bs.forEach(b => {
        if (b.pid >= 0) { const atoms = b.items.filter(i => i.k === 't'); this.paras[b.pid] = { b, orig: atoms.map(a => a.s), now: atoms.map(a => a.s), extra: [], del: false }; this.parent[b.pid] = owner; }
        b.items.forEach(i => { if (i.k === 'tbl') { this.tables[i.tid] = i; i.owner = b.pid; i.rows.forEach(r => r.forEach(c => dig(c.blocks, c))); } if (i.k === 'draw') dig(i.blocks, null); });
      });
      dig(model.blocks, null);
      this.drop = new Set(); this.dropTbl = new Set(); this.hints = [];
    }
    text(pid) { const p = this.paras[pid]; return p.del ? '' : [p.now.join('')].concat(p.extra).join('\n'); }
    set(pid, text) {
      const p = this.paras[pid]; if (!p) return; const lines = String(text).split('\n');
      const main = p.orig.reduce((m, t, i) => t.trim().length > (p.orig[m] || '').trim().length ? i : m, 0); // 글자가 가장 많은 조각의 모양을 쓴다
      p.now = p.now.map((_, i) => i === main ? lines[0] : ''); p.extra = lines.slice(1); p.del = false;
    }
    cellText(c) { return c.blocks.map(b => this.text(b.pid)).join('\n'); }
    setCell(c, text) {
      if (!c || text === undefined || text === null || text === '') return;
      this.put(c, text);
    }
    put(c, text) { // 빈 값도 그대로 쓴다
      if (!c) return; let first = null;
      c.blocks.forEach(b => { if (b.items.some(i => i.k !== 't')) return; if (first === null) { first = b.pid; this.set(b.pid, text); if (text) this.paras[b.pid].force = true; } else this.paras[b.pid].del = true; });
    }
    cell(tid, r, c) { const t = this.tables[tid]; if (!t) return null; for (const row of t.rows) for (const x of row) if (x.r === r && x.c === c) return x; return null; }
    cells(tid) { const t = this.tables[tid]; return t ? t.rows.flat() : []; }
    find(label, nth, tid) {
      const want = norm(label); let n = nth || 1;
      const ids = tid === undefined ? Object.keys(this.tables) : [tid];
      for (const id of ids) for (const c of this.cells(id)) {
        const t = norm(c.blocks.map(b => this.paras[b.pid] ? this.paras[b.pid].orig.join('') : '').join(''));
        if (t === want && --n === 0) return { tid: Number(id), c };
      }
      return null;
    }
    right(label, value, nth, tid) { const f = this.find(label, nth, tid); if (f) this.setCell(this.cell(f.tid, f.c.r, f.c.c + f.c.cs), value); return !!f; }
    below(label, value, nth, tid) { const f = this.find(label, nth, tid); if (f) this.setCell(this.cell(f.tid, f.c.r + f.c.rs, f.c.c), value); return !!f; }
    // 문단 안에서 글자 조각을 넘나들며 바꾼다. 바뀌지 않은 조각의 모양은 유지된다.
    replace(pid, re, fn) {
      const p = this.paras[pid]; if (!p || p.del) return false;
      const full = p.now.join(''); const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
      const hits = [...full.matchAll(g)].filter(m => m[0]); if (!hits.length) return false;
      let done = false;
      for (const m of hits.reverse()) {
        const v = typeof fn === 'function' ? fn(...m) : fn;
        if (v === undefined || v === null || v === m[0]) continue;
        let pos = 0, put = false; const s = m.index, e = s + m[0].length;
        p.now = p.now.map(t => { const a = pos, b = pos + t.length; pos = b; if (b <= s || a >= e) return t; const x = t.slice(0, Math.max(0, s - a)), y = t.slice(Math.max(0, Math.min(t.length, e - a))); const out = x + (put ? '' : v) + y; put = true; return out; });
        done = true;
      }
      return done;
    }
    all(re, fn) { Object.keys(this.paras).forEach(pid => this.replace(pid, re, fn)); }
    inCell(c, re, fn) { if (c) c.blocks.forEach(b => this.replace(b.pid, re, fn)); }
    check(label, scope) { // "□ 라벨" 또는 "라벨□"
      const l = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
      const run = pid => { this.replace(pid, new RegExp('(?:□|󰏚)\\s*' + l), m => m.replace(/□|󰏚/, '■')) || this.replace(pid, new RegExp(l + '\\s*(?:□|󰏚)'), m => m.replace(/□|󰏚/, '■')); };
      if (scope) scope.blocks.forEach(b => run(b.pid)); else Object.keys(this.paras).forEach(run);
    }
    edits() {
      const out = {};
      Object.entries(this.paras).forEach(([pid, p]) => {
        if (p.del) { out[pid] = { del: true }; return; }
        const atoms = {}; let n = 0; p.now.forEach((t, i) => { if (t !== p.orig[i] || (p.force && t)) { atoms[i] = t; n++; } });
        if (n || p.extra.length) { out[pid] = { atoms }; if (p.extra.length) out[pid].extra = p.extra; }
      });
      return out;
    }
  }

  // ── 값 만들기 ─────────────────────────────────────────────────
  function shortSchool(name) {
    const n = String(name || '').trim();
    return n.replace(/초등학교$/, '초').replace(/중학교$/, '중').replace(/고등학교$/, '고').replace(/학교$/, '');
  }
  function makeCtx(profile, cs, st) {
    const p = profile || {}, c = cs || {}, s = st || {};
    const school = p.school || '';
    const short = c.short || p.short || shortSchool(school);
    const no = short && c.year && c.seq ? `${short}-${c.year}-${c.seq}` : '';
    const students = (c.students || []).filter(x => x && (x.name || x.school));
    const own = x => ({ ...x, school: x.school || school });
    const v = students.filter(x => /피해/.test(x.role)).map(own), o = students.filter(x => /가해/.test(x.role) || /쌍방/.test(x.role)).map(own);
    const both = students.filter(x => /쌍방/.test(x.role)).map(own);
    const vv = v.concat(both);
    const f = s.f || {};
    const pool = { v: vv, o, a: students.map(own) };
    const t = pool[TARGET[s.id] || 'a'] || [];
    const target = t.find(x => x.name === s.target) || (t.length === 1 ? t[0] : (TARGET[s.id] ? t[0] : null));
    const ref = k => { const r = (c.refs || {})[k]; if (!r || !r.no) return ''; const num = /[가-힣]/.test(r.no) ? r.no : `${k === 'outcome' ? (p.refOutcome || '학교지원센터') : k === 'consult' ? '인성시민과' : school || '○○학교'}-${r.no}`; return num + (r.date ? `(${ymd(r.date)})` : ''); };
    return { p, c, s, f, school, short, no, noHo: no ? no + '호' : '', v: vv, o, students: students.map(own), target: target || null, ref, date: s.date || '' };
  }
  const gcn = (s, sep) => [s.grade, s.cls].filter(Boolean).join(sep || '-');
  const full = s => [s.grade && s.grade + '학년', s.cls && s.cls + '반', s.num && s.num + '번'].filter(Boolean).join(' ');
  const full2 = s => [s.grade && s.grade + '학년', s.cls && s.cls + '반'].filter(Boolean).join(' ');
  const slash = s => [s.grade, s.cls, s.num].filter(Boolean).join(' / ');
  const hak = s => s.hak || (s.grade && s.cls && s.num ? `${s.grade}${String(s.cls).padStart(2, '0')}${String(s.num).padStart(2, '0')}` : '');
  const members = p => (p.members || []).filter(m => m.name);
  const memberText = p => members(p).map(m => `${m.role || ''} ${m.name}`.trim()).join(', ');
  const TYPE_ALIAS = { 신체폭력: ['신체폭력', '폭행'], 언어폭력: ['언어폭력'], 금품갈취: ['금품갈취'], 강요: ['강요'], 따돌림: ['따돌림'], 성폭력: ['성폭력'], 사이버폭력: ['사이버폭력'], 기타: ['기타'] };
  const checkTypes = (e, x, cell) => (x.c.types || []).forEach(t => (TYPE_ALIAS[t] || [t]).forEach(a => e.check(a, cell)));

  function office(x) { const e = x.p.eduOffice || ''; if (!e) return ''; return e + ' ' + (/^청주/.test(e) ? '학생지원과' : '학교지원센터'); }

  // ── 모든 문서 공통 치환 ──────────────────────────────────────────
  const RE_CASE = /[○◯△0O]{2,4}(초|중|고)-(?:20○○|2026)-(?:01|1|[○0]{1,2})(호?)/;
  function common(e, x) {
    if (x.no) {
      e.all(RE_CASE, (m, _l, ho) => x.no + (ho || ''));
      e.all(/\(사안 번호 ?기입\)/, `(${x.noHo})`);
      e.all(/\(사안 번호\)/, `(${x.noHo})`);
      e.all(/사안번호 2000-00호/, `사안번호 ${x.c.year}-${x.c.seq}호`);
    }
    if (x.school) {
      e.all(/[○◯0O]{2,4}\s?학교장(?! ?자체)/, x.school + '장');
      e.all(/^\s*[◯○] ?[◯○] ?[◯○] ?[◯○] ?학교\s*$/, x.school);
      e.all(/OO 학교의/, x.school + '의');
    }
    if (x.date) e.all(/^\s*(?:작성일\s*)?20(?:26|○○|\d\d)?\s*년\s*(?:○○|00)?\s*월\s*(?:○○|00)?\s*일/, m => m.replace(/20(?:26|○○|\d\d)?\s*년\s*(?:○○|00)?\s*월\s*(?:○○|00)?\s*일/, ko(x.date)));
    if (x.date) e.all(/^\s*(?:2026\.○○\.○○\.|20○○\.○○\.○○\.)\s*$/, ymd(x.date));
    if (x.date && HAS_DATE.has(x.s.id)) e.all(/^\s{0,60}년\s+월\s+일\s*$/, ko(x.date));
  }
  const addRow = (ops, tid, row) => ops.push({ tid, row });
  // 학생 수에 맞춰 필요한 행 수를 계산 (화면이 먼저 호출해 모델을 다시 받는다)
  const ROWS = {
    D7: x => [{ tid: 2, first: 1, have: 2, need: x.v.length }], D8: x => [{ tid: 2, first: 1, have: 2, need: x.students.length }],
    D14: x => [{ tid: 2, first: 1, have: 3, need: x.v.length + x.o.length }], D32: x => [{ tid: 1, first: 1, have: 2, need: x.v.length + x.o.length }], D19: x => [{ tid: 2, first: 1, have: 2, need: x.o.length }],
    F1: x => [{ tid: 1, first: 7, have: 3, need: x.students.length }], F10: x => [{ tid: 1, first: 13, have: 2, need: x.students.length }], F12: x => [{ tid: 1, first: 5, have: 2, need: x.students.length }],
    F8: x => { const n = y => y.reduce((a, s) => a + Math.max(1, emLines(s).length), 0); return [{ tid: 1, first: 10, have: 5, need: n(x.o) }, { tid: 1, first: 6, have: 4, need: n(x.v) }]; }
  };
  function neededOps(id, profile, cs, st) {
    const x = makeCtx(profile, cs, st); const out = []; const had = (st.ops || []).filter(o => o.auto);
    ((ROWS[id] || (() => []))(x)).forEach(r => {
      const already = had.filter(o => o.tid === r.tid && o.group === r.first).length;
      for (let i = r.have + already; i < r.need; i++) out.push({ tid: r.tid, row: r.first + r.have - 1, auto: true, group: r.first });
    });
    return out;
  }
  const emLines = s => String(s.emergency || '').split('\n').map(t => t.trim()).filter(Boolean);

  // ── 서식별 규칙 ───────────────────────────────────────────────
  const staff = (e, x) => {
    const p = x.p;
    e.right('학 교 명', x.school); e.right('학교명', x.school);
    e.right('성명', x.s.id === 'F10' ? p.vice : p.principal, 1); e.right('성명', p.teacher, 2);
    e.right('휴대전화', x.s.id === 'F10' ? p.vicePhone : p.principalPhone, 1); e.right('휴대전화', p.teacherPhone, 2);
  };
  const meetTexts = (e, x, d, t, place) => {
    if (d) e.all(/(1\. 일\s+시 :)\s+년\s+월\s+일\(\s*요일\)\s+시\s+분/, (m, a) => `${a}  ${ko(d)}(${DOW[toDate(d).getDay()]}요일)  ${t ? +t.split(':')[0] + '시 ' + t.split(':')[1] + '분' : '   시   분'}`);
    if (place) e.all(/(2\. 장\s+소 :)\s*$/, (m, a) => `${a}  ${place}`);
    const ms = members(x.p); if (!ms.length) return;
    const pids = Object.keys(e.paras).filter(pid => /^\s*(○ ○ ○\s*)+$/.test(e.text(pid)));
    if (!pids.length) return;
    const names = ms.map(m => `${m.role || ''} ${m.name}`.trim()); const half = Math.ceil(names.length / 2);
    const rows = names.length > 4 ? [names.slice(0, half), names.slice(half)] : [names];
    pids.forEach((pid, i) => e.set(pid, rows[i] ? '     ' + rows[i].join('     ') : ''));
  };
  const nameAfter = (e, re, name) => { if (name) e.all(re, (m, a) => `${a} ${name}  `); };
  const RULES = {
    'F체크리스트'(e, x) { e.setCell(e.cell(0, 0, 1), (x.c.types || []).join(', ')); if (x.c.incidentDate) e.setCell(e.cell(0, 0, 3), ymdw(x.c.incidentDate)); if (x.no) e.setCell(e.cell(0, 0, 5), `${x.c.year}-${x.c.seq}호`); },
    F1(e, x) {
      staff(e, x); e.right('사 안 명', x.no && `${x.noHo} ${(x.c.types || []).join('·')} 사안`); e.right('사안발생일시', x.c.when); e.right('접수(인지) 일시', rec(x)); e.right('사안개요', x.c.summary);
      x.students.forEach((s, i) => { const r = 7 + i; e.setCell(e.cell(1, r, 1), s.name); e.setCell(e.cell(1, r, 2), hak(s)); e.setCell(e.cell(1, r, 5), s.role); e.setCell(e.cell(1, r, 11), s.gPhone); });
      e.setCell(e.cell(1, 10, 1), x.f.progress); e.setCell(e.cell(1, 11, 1), x.c.etc);
      e.set(pidOf(e, /지원 요청서\(예시\)/), e.text(pidOf(e, /지원 요청서\(예시\)/)).replace('(예시)', ''));
    },
    F2(e, x) { staff(e, x); if (x.target) e.right('피해학생상황및정보', `${x.target.school} ${full(x.target)} ${x.target.name}${x.c.summary ? '\n' + x.c.summary : ''}`); const p = pidOf(e, /지원』 요청서\(예시\)/); if (p) e.set(p, e.text(p).replace('(예시)', '')); },
    F3(e, x) { if (x.school) e.all(/\(\s+\)학교/, `( ${x.school.replace(/학교$/, '')} )학교`); if (x.s.clean) for (let r = 2; r <= 4; r++) for (let c = 1; c <= 8; c++) e.put(e.cell(1, r, c), ''); },
    F4(e, x) {
      const t = x.target; const head = e.cell(2, 0, 0); const step = x.f.step;
      if (step) { const [a, b] = step.match(/(최초|추가)\((.+)\)/).slice(1); e.check(`(${b}) ${a} 학생 작성`, head); }
      if (!t) return; e.right('학년/반/번호', full(t)); e.right('이름', t.name, 1); e.right('연락처', t.phone, 1); e.right('학생과의관계', t.gRel); e.right('이름', t.guardian, 2); e.right('연락처', t.gPhone, 2);
      if (t.athlete) e.check('학생선수', e.cell(2, 2, 10));
    },
    F5(e, x) { const t = x.target; if (!t) return; e.right('학년/반/번호', full(t)); e.right('학생 성명', t.name); e.right('학생과의관계', t.gRel); e.right('보호자 성명', t.guardian); e.right('보호자 연락처', t.gPhone); if (t.athlete) e.check('학생선수', e.cell(2, 2, 10)); if (t.addr) e.all(/\(우편번호\)\s*/, `(우편번호) ${t.addr}`); },
    F6(e, x) { nameAfter(e, /(피해관련 학생:)\s+/, x.target && x.target.name); },
    F7(e, x) { nameAfter(e, /(가해관련 학생:)\s+/, x.target && x.target.name); },
    F8(e, x) {
      e.right('사안 개요', x.c.summary);
      const put = (list, r0, rows) => {
        const lines = list.flatMap(s => { const l = emLines(s); return (l.length ? l : ['']).map((m, i) => ({ s, m, i })); });
        const any = lines.some(l => l.m);
        for (let k = 0; k < Math.max(rows, lines.length); k++) {
          const l = lines[k], r = r0 + k;
          const cells = [2, 4, 5, 7].map(c => e.cell(1, r, c));
          if (l && l.i === 0) { e.put(cells[0], hak(l.s)); e.put(cells[1], l.s.name || ''); e.put(cells[2], l.s.gender || ''); e.put(cells[3], l.s.emDate ? ymd(l.s.emDate) : ''); } else if (list.length) cells.forEach(c => e.put(c, ''));
          if (any) e.put(e.cell(1, r, 9), l ? l.m : '');
        }
      };
      const vr = rowsBetween(e, 1, '피해관련학생'), or = rowsBetween(e, 1, '가해관련학생');
      if (vr) put(x.v, vr.from, vr.n); if (or) put(x.o, or.from, or.n);
      const st = x.o.concat(x.v); const first = e.find('학생명', 1, 1);
      if (first && st.length) for (let i = 0; i < 3; i++) e.put(e.cell(1, first.c.r + i, 3), st[i] ? st[i].name : '');
    },
    F9(e, x) {
      const t = x.target; if (t) e.inCell(e.cell(1, 1, 1), /학번 :\s+성명 :\s*/, `학번 : ${hak(t)}          성명 : ${t.name}`);
      const v = x.v[0]; if (v) e.inCell(e.cell(1, 3, 3), /학번 :\s+성명 :\s*/, `학번 : ${x.v.map(hak).filter(Boolean).join(', ')}          성명 : ${x.v.map(s => s.name).join(', ')}`);
      if (x.c.incidentDate) e.setCell(e.cell(1, 2, 3), ko(x.c.incidentDate)); checkTypes(e, x, e.cell(1, 4, 3));
      if (t && t.emDate) e.right('긴급조치일자', ko(t.emDate));
      emLines(t || {}).forEach(l => { const m = l.match(/^(\d)호/); if (m && m[1] !== '2') e.check(`제${m[1]}호`, e.cell(1, 7, 1)); });
    },
    F10(e, x) {
      const c = x.c; staff(e, x); e.right('접수일시', rec(x)); e.setCell(e.cell(1, 4, 1), c.reporter); e.setCell(e.cell(1, 4, 11), c.route); e.setCell(e.cell(1, 5, 1), c.receiver || (x.p.teacher && `${x.p.teacher}(학교폭력담당교사)`));
      const inv = e.cell(1, 6, 1); if (c.investigate === '전담조사관') e.check('조사관 배정 요청', inv); if (c.investigate === '학교 자체') e.check('학교 자체 조사', inv);
      if (c.twoDate) e.all(/시행\(2025\.00\.00\.\)/, `시행(${ymd(c.twoDate)})`);
      sep(e, x, 1, 10, 1);
      e.right('관련학생', c.who || x.students.map(s => `${s.school === x.school ? '' : s.school + ' '}${s.name}(${full(s)})`).join(', '), 1, 3); e.right('일시', c.when, 1, 3); e.right('장소', c.place, 1, 3); e.right('내용', c.summary, 1, 3); checkTypes(e, x, e.cell(3, 4, 1));
      if (/아동학대/.test(c.kind || '')) e.check('아동학대', e.cell(3, 4, 1));
      for (let i = 0; i < Math.max(2, x.students.length); i++) {
        const s = x.students[i], r = 13 + i; if (!x.students.length) break;
        const put = (col, v) => e.put(e.cell(1, r, col), v || '');
        put(1, s && shortSchool(s.school)); put(2, s && hak(s)); put(3, s && s.name); put(6, s && s.gender); put(7, s && s.notified); put(9, s && s.relInfo);
        if (!s) { continue; }
        const last = e.cell(1, r, 12); if (last && !/□/.test(e.cellText(last))) e.put(last, '가해관련□ 피해관련□ 학생선수□ 장애학생□ 특수교육대상자□ 다문화학생□ 탈북학생□');
        if (/가해|쌍방/.test(s.role)) e.check('가해관련', last); if (/피해|쌍방/.test(s.role)) e.check('피해관련', last);
        [['athlete', '학생선수'], ['disabled', '장애학생'], ['special', '특수교육대상자'], ['multi', '다문화학생'], ['nk', '탈북학생']].forEach(([k, l]) => { if (s[k]) e.check(l, last); });
      }
      // 행을 더하거나 빼도 어긋나지 않도록 칸 이름으로 찾아 넣는다.
      e.right('기타 사항', c.etc, 1, 1); e.right('관련학교명', c.otherSchool, 1, 1); e.right('통보여부', c.otherNotice, 1, 1); e.right('피해 관련', c.availV, 1, 1); e.right('가해 관련', c.availO, 1, 1); e.right('피해 관련', c.opinionV, 2, 1); e.right('가해 관련', c.opinionO, 2, 1);
      const blank = (l, n) => { const f = e.find(l, n, 1); if (f) e.put(e.cell(1, f.c.r, f.c.c + f.c.cs), ''); };
      if (x.s.clean && !c.otherSchool) blank('관련학교명', 1); if (x.s.clean && c.investigate === '학교 자체') { blank('피해 관련', 1); blank('가해 관련', 1); }
    },
    F11(e, x) {
      const t = x.target, p = x.p; if (x.school) e.setCell(e.cell(1, 0, 3), '  ' + x.school);
      const app = (r, c, v) => { if (v) e.inCell(e.cell(3, r, c), /(성명:|H·P:)\s*/, (m, a) => `${a} ${v}`); };
      app(0, 4, p.teacher); app(1, 4, p.teacherPhone); app(0, 8, p.vice); app(1, 8, p.vicePhone); app(0, 12, p.principal); app(1, 12, p.principalPhone);
      if (t) e.setCell(e.cell(3, 3, 2), ` ( ${t.grade || ' '} )학년  ( ${t.cls || ' '} )반  ( ${t.num || ' '} )번   성명 : ( ${t.name || ''} )   성별: ( ${t.gender || '  '} )`);
      e.setCell(e.cell(3, 4, 2), x.c.when); if (x.c.receivedDate) e.setCell(e.cell(3, 5, 2), ymd(x.c.receivedDate)); e.setCell(e.cell(3, 7, 2), x.c.summary);
    },
    F12(e, x) {
      const c = x.c; if (x.no) e.all(/\(\s+\)학교\s+2026-\(\s+\)호/, `( ${x.school.replace(/학교$/, '')} )학교   ${c.year}-( ${c.seq} )호`);
      if (x.f.step) e.check(x.f.step === '1차 조사' ? '1차 조사' : '보완조사');
      if (c.receivedDate) e.setCell(e.cell(1, 0, 1), ko(c.receivedDate)); if (x.f.date) e.setCell(e.cell(1, 1, 1), ko(x.f.date)); e.setCell(e.cell(1, 0, 9), [x.p.teacher, x.p.teacherPhone].filter(Boolean).join('  ')); e.setCell(e.cell(1, 1, 9), x.f.inspector);
      if ((c.types || []).length) e.setCell(e.cell(1, 3, 1), ' • ' + c.types.join(', '));
      x.students.forEach((s, i) => { const r = 5 + i, put = (k, v) => e.setCell(e.cell(1, r, k), v); put(1, s.school); put(2, `${full2(s)} / ${s.num || ''}`); put(4, s.name); put(8, s.gender); put(9, s.school !== x.school ? s.otherNo : ''); if (s.athlete && /가해|쌍방/.test(s.role)) put(10, 'V'); put(12, s.role); });
      e.right('사안 개요(주요 내용)', c.summary, 1, 1);
      const sr = e.find('분리 시행 여부', 1, 1); if (sr) { const r = sr.c.r; sep(e, x, 1, r + 1, 6); if (c.sep === '시행') { e.put(e.cell(1, r + 2, 1), `*분리기간: ${c.sepDays || ' '}일`); e.put(e.cell(1, r + 2, 3), ''); } else if (c.sep === '미시행') { e.put(e.cell(1, r + 2, 1), ''); e.put(e.cell(1, r + 2, 3), '√'); } }
      const em = list => list.filter(s => emLines(s).length).map(s => `${s.name}: ${emLines(s).join(', ')}${s.emDate ? ` (${ymd(s.emDate)})` : ''}`).join('\n');
      e.right('피해학생', em(x.v), 1, 1); e.right('가해학생', [c.twoDate && `제17조제4항에 따른 2호(접촉 등 금지) 시행(${ymd(c.twoDate)})`, em(x.o)].filter(Boolean).join('\n'), 1, 1);
    },
    F13(e, x) { if (x.p.teacher) e.all(/책임교사: 김○○/, `책임교사: ${x.p.teacher}`); if (x.f.inspector) e.all(/담당 조사관: 박○○/, `담당 조사관: ${x.f.inspector}`); e.all(/페기일/, '폐기일'); if (x.s.clean) for (let r = 2; r <= 4; r++) for (let c = 1; c <= 9; c++) e.put(e.cell(1, r, c), ''); },
    F15(e, x) { if (x.f.member) e.setCell(e.cell(1, 2, 2), x.f.member.split('').join(' ')); if (x.f.from && x.f.to) e.all(/20○○년 ○월 ○일 ~ 20○○년 ○월 ○일/, `${ko(x.f.from)} ~ ${ko(x.f.to)}`); if (x.f.date) e.all(/2026년\s+○○월\s+○○일/, ko(x.f.date)); if (x.p.principal) e.all(/(학교장) 000/, (m, a) => `${a} ${x.p.principal}`); },
    F16(e, x) { const ms = members(x.p); if (!ms.length) return; for (let i = 0; i < 10; i++) { const m = ms[i], r = i + 1, put = (c, v) => e.put(e.cell(1, r, c), v || ''); put(1, m && m.name); put(2, m && (m.org || (/학부모|경찰/.test(m.role) ? '' : x.school))); put(3, m && m.phone); put(4, m && x.f.from && x.f.to ? `${ymd(x.f.from)} ~ ${ymd(x.f.to)}` : ''); put(5, m && m.role); } },
    F17(e, x) {
      if (x.c.session) e.all(/제○○회/, `제${x.c.session}회`); const d = x.c.meetDate; if (d) e.all(/2026년○○월○○일\(\s*요일\)/, `${ko(d)}(${DOW[toDate(d).getDay()]}요일)`); if (x.c.year) e.all(/2026학년도/, `${x.c.year}학년도`);
      const ms = members(x.p); ms.slice(0, 10).forEach((m, i) => e.setCell(e.cell(1, i + 1, 1), `${m.role || ''} ${m.name}`.trim())); if (ms.length) e.setCell(e.cell(1, 11, 2), `${ms.length}명`);
    },
    F18(e, x) { meetTexts(e, x, x.c.meetDate, x.c.meetTime, x.c.meetPlace); if ((x.c.types || []).length) e.all(/호 \(\s+\)에 대한/, `호 (${x.c.types.join('·')})에 대한`); summaryBullets(e, x); if (x.s.clean) e.all(/ \(<예시>, 선택 기재\)/, ''); },
    F19(e, x) { RULES.F18(e, x); },
    F20(e, x) { const t = x.target; const list = [t].concat(x.o.filter(s => !t || s.name !== t.name)).filter(Boolean); list.slice(0, 3).forEach((s, i) => { const r = 2 + i * 2; e.setCell(e.cell(1, r, 1), s.school); e.setCell(e.cell(1, r, 2), full2(s)); e.setCell(e.cell(1, r, 3), s.name); }); e.setCell(e.cell(1, 7, 1), x.c.agreed || x.c.summary); sign(e, x); },
    F21(e, x) { const t = x.target; if (t) { e.setCell(e.cell(1, 2, 1), t.school); e.setCell(e.cell(1, 2, 2), full2(t)); e.setCell(e.cell(1, 2, 3), t.name); } e.setCell(e.cell(1, 3, 1), x.c.agreed || x.c.summary); sign(e, x); },
    F22(e, x) {
      const list = [x.v[0], x.o[0]]; [x.v, x.o].forEach((l, i) => { if (!l.length) return; const r = 1 + i * 2; e.setCell(e.cell(2, r, 2), [...new Set(l.map(s => s.school))].join('\n')); e.setCell(e.cell(2, r, 3), l.map(s => slash(s)).join('\n')); e.setCell(e.cell(2, r, 4), l.map(s => s.name).join('\n')); }); void list;
      e.setCell(e.cell(2, 4, 2), x.c.agreed || x.c.summary);
      const w = x.f.way || ''; const mark = c => e.inCell(c, /\(\s+\)/, '( ○ )');
      if (w === '자체해결') { mark(e.cell(2, 9, 1)); e.all(/학교장 \(자체해결\/종결\) 결과/, '학교장 자체해결 결과'); } else if (w === '종결') { mark(e.cell(2, 10, 1)); e.all(/학교장 \(자체해결\/종결\) 결과/, '학교장 종결 결과'); } else if (/아님/.test(w)) { mark(e.cell(2, 5, 1)); e.all(/학교장 \(자체해결\/종결\) 결과/, '학교장 종결 결과'); }
      if (x.s.clean) { if (w === '자체해결') e.put(e.cell(2, 10, 2), ''); if (w === '종결') e.put(e.cell(2, 9, 2), ''); if (/아님/.test(w)) { e.put(e.cell(2, 9, 2), ''); e.put(e.cell(2, 10, 2), ''); } e.all(/\s*\[보고용, 공동학폭용\]/, ''); }
    },
    F23(e, x) { const t = x.target; if (!t) return; e.right('소속학교', t.school); e.right('학년 / 반 / 번호', slash(t)); e.right('학생성명', t.name); e.right('학생 연락처', t.phone); e.right('보호자 성명', t.guardian); e.right('보호자 연락처', t.gPhone); e.right('주소', t.addr); e.all(/000학생 보호자/, `${t.name}학생 보호자 ${t.guardian || ''}`); },
    F24(e, x) { const t = x.target; if (!t) return; e.below('소속학교', t.school); e.below('학년/반', full2(t)); e.below('학생성명', t.name); e.below('보호자성명', t.guardian); },
    F25(e, x) { const t = x.target; if (!t) return; e.setCell(e.cell(1, 3, 2), `${t.name}  (${t.gender === '남' ? '■' : '□'}남 ${t.gender === '여' ? '■' : '□'}여)`); e.setCell(e.cell(1, 3, 4), t.guardian); e.setCell(e.cell(1, 4, 2), `${t.school} ( ${gcn(t)} )`); e.setCell(e.cell(1, 4, 4), t.gPhone); if (x.s.clean) e.put(e.cell(1, 0, 0), ''); },
    F26(e, x) { const t = x.target; if (!t) return; e.below('소속학교', t.school); e.below('학년반', full2(t)); e.below('학생성명', t.name); e.below('보호자성명', t.guardian); e.setCell(e.cell(1, 2, 2), t.addr); },
    F27(e, x) { ledger(e, x, 8, 11, s => [x.no && `${x.c.year}-${x.c.seq}`, s.grade, s.cls, s.num, s.name, x.c.actionDate ? ymd(x.c.actionDate) : '', '', s.measures || '']); },
    F28(e, x) { ledger(e, x, 8, 9, s => /[123]호/.test(s.measures || '') ? [x.no && `${x.c.year}-${x.c.seq}`, s.grade, s.cls, s.num, s.name, (x.c.actionDate ? ymd(x.c.actionDate) : '') + (s.due ? `\n(${ymd(s.due)}까지)` : ''), (s.measures || '').split('\n').filter(m => /[123]호/.test(m)).join('\n'), '', s.athlete ? '■학생선수' : ''] : null); },
    F29(e, x) {
      const row = (r, l) => { if (!l.length) return; e.setCell(e.cell(1, r, 1), [...new Set(l.map(s => s.school))].join('\n')); e.setCell(e.cell(1, r, 3), l.map(slash).join('\n')); e.setCell(e.cell(1, r, 4), l.map(s => s.name).join('\n')); };
      row(3, x.v); row(4, x.target ? [x.target] : x.o); e.setCell(e.cell(1, 5, 1), x.c.summary); if (x.f.date || x.c.committeeDate) e.setCell(e.cell(1, 6, 1), ymd(x.f.date || x.c.committeeDate));
      if (x.p.teacher) e.all(/\(담당자: 000, TEL 043-000-0000\)/, `(담당자: ${x.p.teacher}, TEL ${x.p.officePhone || x.p.teacherPhone || ''})`);
    },
    F30(e, x) { const t = x.target; if (t) { e.all(/○학년 ○반 ○번(\s+)성명 : ○○○/, (m, sp) => `${full(t)}${sp}성명 : ${t.name}`); nameAfter(e, /(학생:)\s+/, t.name); } },
    F31(e, x) { const t = x.target; if (t) e.setCell(e.cell(1, 1, 1), `${t.name}(${hak(t)})`); if (x.f.hours) { e.all(/학교에서의 봉사 3시간/, `학교에서의 봉사 ${x.f.hours}시간`); } if (x.f.from) e.all(/20○○\.06\.29\.\(월\) ~ 07\.01\.\(수\)/, period(x.f.from, x.f.to)); },
    F32(e, x) { const t = x.target; if (t) e.all(/\(학번 :\s+이름 :\s+\)/, `(학번 : ${hak(t)}   이름 : ${t.name})`); },
    F34(e, x) {
      const t = x.target; if (t) { e.setCell(e.cell(1, 0, 2), `${t.name}   ${t.gender === '남' ? '■' : '□'}남  ${t.gender === '여' ? '■' : '□'}여`); e.setCell(e.cell(1, 0, 4), t.phone); e.setCell(e.cell(1, 1, 2), `${t.school}(${full2(t)})`); e.setCell(e.cell(1, 4, 2), t.guardian); e.setCell(e.cell(1, 4, 4), t.gPhone); e.setCell(e.cell(1, 5, 2), t.gRel); (t.measures || '').split('\n').forEach(m => { const n = m.match(/([2-8])호/); if (n) e.check(`(${n[1]}호)`, e.cell(1, 10, 1)); }); }
      e.setCell(e.cell(1, 2, 2), x.p.teacher); if (x.p.teacher) e.setCell(e.cell(1, 2, 4), `사무실: ${x.p.officePhone || ''}\n휴대폰: ${x.p.teacherPhone || ''}`); if (x.s.clean) e.put(e.cell(1, 11, 1), '');
    },
    F35(e, x) {
      const t = x.target; if (t) e.all(/대상: ○○○ \(0학년 0반 0번\)/, `대상: ${t.name} (${full(t)})`);
      if (x.f.from) { e.all(/20○○\. 12\. 01\.\(월\) ~ 12\. 12\.\(금\) \[10일간\]/, `${period(x.f.from, x.f.to)} [${x.f.days || weekdays(x.f.from, x.f.to).length}일간]`); const ds = weekdays(x.f.from, x.f.to); [2, 3].forEach((tid, w) => { for (let i = 0; i < 5; i++) { const d = ds[w * 5 + i]; e.put(e.cell(tid, 0, i + 1), d ? `${d.getMonth() + 1}. ${d.getDate()}.(${DOW[d.getDay()]})` : ''); } }); }
      if (x.f.place) e.all(/장소: 본교 상담실/, `장소: ${x.f.place}`);
    },
    F36(e, x) { if (x.s.clean) { const p = pidOf(e, /가정통신문\(예시\)/); if (p) e.set(p, e.text(p).replace('(예시)', '')); } },
    F37(e, x) { const t = x.target; if (x.school) e.all(/00초등학교/, x.school); if (x.p.teacher && x.f.writer) e.all(/김00/, x.f.writer); if (t) { e.right('학생명', t.name); e.right('학년반', full2(t)); e.right('학교폭력조치사항', t.measures); } },
    F38(e, x) { const t = x.target; if (t) { e.right('학생 성명', t.name); e.right('학년반', full2(t)); e.right('학교폭력조치사항', t.measures); } },
    'F38-1'(e, x) { const t = x.target; if (t) { e.right('학생 성명', t.name); e.right('학년반', full2(t)); } const o = x.o[0]; if (t && o) e.all(/피해학생 \s+은 가해학생\s+의/, `피해학생 ${t.name} 은(는) 가해학생 ${o.name} 의`); },
    F39(e, x) { meetTexts(e, x, x.f.date, x.f.time, x.f.place); const o = x.o[0]; if (o) delRow(e, x, 2, o); },
    F40(e, x) { const t = x.target; if (t) { e.all(/홍길동\(60125\)/, `${t.name}(${hak(t)})`); e.all(/^홍길동\s*$/, t.name); e.all(/^\(60125\)\s*$/, `(${hak(t)})`); } },
    F41(e, x) { const t = x.target; if (t) { nameAfter(e, /(피해학생:)\s+/, t.name); nameAfter(e, /(피해학생 보호자:)\s+/, t.guardian); } },
    F42(e, x) { const t = x.target; if (!t) return; e.setCell(e.cell(1, 0, 2), t.school); e.setCell(e.cell(1, 1, 1), t.grade); e.setCell(e.cell(1, 1, 3), t.cls); e.setCell(e.cell(1, 1, 5), t.num); e.setCell(e.cell(1, 1, 7), t.name); e.setCell(e.cell(1, 2, 2), x.f.measure || t.measures); if (x.p.eduOffice) e.setCell(e.cell(1, 3, 2), `${x.p.eduOffice} 교육장 (${x.f.date ? ymd(x.f.date) : x.c.actionDate ? ymd(x.c.actionDate) : '       '})`); },
    F43(e, x) { const put = (r, s) => { if (!s) return; e.setCell(e.cell(1, r, 1), s.school); e.setCell(e.cell(1, r, 2), full2(s)); e.setCell(e.cell(1, r, 3), s.name); e.setCell(e.cell(1, r, 4), s.guardian); }; put(1, x.target); put(2, x.o[0]); },
    F45(e, x) { const t = x.target; if (!t) return; e.right('성명', t.name, 1); e.right('성별', t.gender); e.right('생년월일', t.birth ? ymd(t.birth) : ''); e.right('학교명', t.school); e.right('학년/반', full2(t)); e.right('연락처', t.phone, 1); e.right('성명', t.guardian, 2); e.right('관계', t.gRel); e.right('연락처', t.gPhone, 2); },

    // ── 공문 표 ─────────────────────────────────────────────
    D5(e, x) { const f = x.f; e.right('학교명', f.partner); e.right('해당자(학년)', f.who); e.right('사건개요', x.c.summary); e.right('사실확인 요청사항', f.ask); writer(e, x); },
    D6(e, x) { const f = x.f; e.right('학교명', x.school); e.right('해당자(학년)', f.who); e.right('사건개요', x.c.summary); e.right('사실확인 요청사항', f.ask); e.right('사실확인 회신내용', f.reply); writer(e, x); },
    D7(e, x) { x.v.forEach((s, i) => { const r = i + 1; e.put(e.cell(2, r, 0), String(r)); e.put(e.cell(2, r, 1), s.school); e.put(e.cell(2, r, 2), s.name || ''); e.put(e.cell(2, r, 3), hak(s)); e.put(e.cell(2, r, 4), '학교장 자체해결\n객관적 요건 충족'); e.put(e.cell(2, r, 5), s.agree || '○'); }); if (x.v.length === 1) [0, 1, 2, 3, 4, 5].forEach(c => e.put(e.cell(2, 2, c), '')); },
    D8(e, x) { const l = x.students; l.forEach((s, i) => { const r = i + 1; e.put(e.cell(2, r, 0), String(r)); e.put(e.cell(2, r, 1), s.school); e.put(e.cell(2, r, 2), s.name || ''); e.put(e.cell(2, r, 3), hak(s)); e.put(e.cell(2, r, 4), '심의위원회 개최 요청'); e.put(e.cell(2, r, 5), s.role); }); if (l.length === 1) [0, 1, 2, 3, 4, 5].forEach(c => e.put(e.cell(2, 2, c), '')); },
    D14(e, x) { const l = x.v.map(s => [s, '피해관련 학생']).concat(x.o.map(s => [s, '가해관련 학생'])); if (!l.length) return; for (let i = 0; i < Math.max(3, l.length); i++) { const [s, role] = l[i] || []; const r = i + 1, put = (c, v) => e.put(e.cell(2, r, c), v || ''); put(0, role); put(1, s && s.school); put(2, s && gcn(s)); put(3, s && s.name); put(4, s && s.birth ? ymd(s.birth) : ''); put(5, s && (s.school !== x.school && s.otherNo ? s.otherNo : x.no)); put(6, s && role[0] === '가' && s.athlete ? '○' : ''); } },
    D19(e, x) { if (!x.o.length) return; for (let i = 0; i < Math.max(2, x.o.length); i++) { const s = x.o[i], r = i + 1, put = (c, v) => e.put(e.cell(2, r, c), v || ''); put(0, s && `${s.name} (${gcn(s)})`); put(1, s && s.phone); put(2, s && s.guardian && `${s.guardian}${s.gRel ? `(${s.gRel})` : ''}`); put(3, s && s.gPhone); put(4, s && s.addr); } },
    D22(e, x) { const t = x.target, f = x.f; if (t) e.setCell(e.cell(2, 1, 0), `${t.name}(${hak(t)})`); e.setCell(e.cell(2, 1, 1), f.before); e.setCell(e.cell(2, 1, 2), f.after); if (f.date) e.setCell(e.cell(2, 1, 3), ymd(f.date)); },
    D23(e, x) { const t = x.target; if (t) { e.setCell(e.cell(2, 1, 0), t.school); e.setCell(e.cell(2, 1, 1), gcn(t)); e.setCell(e.cell(2, 1, 2), t.name); e.setCell(e.cell(2, 1, 3), t.gender); if (t.birth) e.setCell(e.cell(2, 1, 4), ymd(t.birth)); e.setCell(e.cell(2, 1, 5), [t.guardian, t.gPhone].filter(Boolean).join('\n')); } e.setCell(e.cell(2, 1, 6), x.f.result); if (x.s.clean) e.put(e.cell(2, 0, 6), '학교폭력대책심의위원회 결과'); },
    D24(e, x) { const t = x.target; if (t) { e.setCell(e.cell(2, 1, 0), t.name); e.setCell(e.cell(2, 1, 1), hak(t)); } if (x.f.date) e.setCell(e.cell(2, 1, 2), ymd(x.f.date)); },
    D25(e, x) { const t = x.target, f = x.f; if (t) { e.setCell(e.cell(2, 1, 0), t.school); e.setCell(e.cell(2, 1, 1), gcn(t)); e.setCell(e.cell(2, 1, 2), t.name); } e.setCell(e.cell(2, 1, 3), f.result); if (f.until) e.setCell(e.cell(2, 1, 4), `변경기간: ${ymd(f.until)}까지${f.reason ? `\n(${f.reason})` : ''}`); if (x.s.clean) e.put(e.cell(2, 0, 3), '조치 결과'); },
    D27(e, x) { const o = x.o[0]; if (o) delRow(e, x, 2, o); },
    D28(e, x) { const o = x.o[0]; if (o) delRow(e, x, 2, o); },
    D29(e, x) { const t = x.target; if (x.s.clean) { e.all(/^<예시>\s*$/, ''); e.all(/예시\)\s*/, ''); } if (t) { if (x.no) e.setCell(e.cell(2, 2, 1), `${x.c.year}-${x.c.seq}`); e.setCell(e.cell(2, 2, 2), `${t.name}\n(${hak(t)})`); } },
    D31(e, x) { const t = x.target; if (t) e.setCell(e.cell(2, 2, 0), `${t.name}\n(${hak(t)})`); if (x.s.clean) e.all(/예시\)\s*/, ''); },
    D32(e, x) { const l = x.v.map(s => [s, '피해관련']).concat(x.o.map(s => [s, '가해관련'])); l.forEach(([s, role], i) => { const r = i + 1, put = (c, v) => e.put(e.cell(1, r, c), v || ''); put(0, role); put(1, shortSchool(s.school)); put(2, gcn(s)); put(3, s.name); put(4, s.school !== x.school && s.otherNo ? s.otherNo : x.no); put(5, s.reconcile || '○'); }); }
  };
  function rec(x) { return x.c.receivedDate ? `${ymdw(x.c.receivedDate)}${x.c.receivedTime ? ' ' + x.c.receivedTime : ''}` : ''; }
  function pidOf(e, re) { return Object.keys(e.paras).find(pid => re.test(e.text(pid))); }
  function sign(e, x) { const t = x.target; if (!t) return; nameAfter(e, /(관련학생:)\s+/, t.name); nameAfter(e, /(관련학생 보호자:)\s+/, t.guardian); }
  function writer(e, x) { if (x.p.teacher) e.right('책임교사(작성자)', `소속: ${x.school} 교사 ${x.p.teacher}(☏${x.p.teacherPhone || x.p.officePhone || ''})`); }
  function rowsBetween(e, tid, label) { const f = e.find(label, 1, tid); return f ? { from: f.c.r, n: f.c.rs } : null; }
  function weekdays(a, b) { const out = []; let d = toDate(a); const end = toDate(b || a); while (d && end && d <= end && out.length < 60) { if (d.getDay() % 6) out.push(new Date(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); } return out; }
  function sep(e, x, tid, row, col) {
    const c = x.c; const cell = e.cell(tid, row, col === 1 ? 7 : col); const left = e.cell(tid, row, 1);
    if (c.sep === '시행' && col === 1) e.inCell(left, /분리기간: \(\s*\)일/, `분리기간: ( ${c.sepDays || ' '} )일`);
    if (c.sep === '미시행' && c.sepReason && cell) { const key = { 반대: /(피해학생 반대의사 표명 )\[\s*\]/, 교육활동: /(교육활동 중이 아님 )\[\s*\]/, 긴급: /(이미 분리됨 )\[\s*\]/, 타교: /(타학교에 재학 중임 등 )\[\s*\]/, 체험: /(등교하지 않은 경우 )\[\s*\]/, 경미: /(모두 해당 )\[\s*\]/ }[c.sepReason]; if (key) e.inCell(cell, key, (m, a) => `${a}[ ○ ]`); }
  }
  function ledger(e, x, rows, cols, fn) { if (x.f.entry) e.all(/\(20○○ 학년도 입학생\)/, `(${x.f.entry} 학년도 입학생)`); if (!x.s.clean) return; const list = x.o.map(fn).filter(Boolean); for (let i = 0; i < rows - 1; i++) for (let c = 0; c < cols; c++) { const v = list[i] ? list[i][c] : ''; const cell = e.cell(1, 2 + i, c); if (cell) e.put(cell, v || ''); } }
  function delRow(e, x, tid, o) { const put = (c, v) => { if (v) e.put(e.cell(tid, 2, c), v); }; put(0, x.no && `${x.c.year}-${x.c.seq}`); put(1, o.grade); put(2, o.cls); put(3, o.num); put(4, o.name); if (x.c.actionDate) put(5, ymd(x.c.actionDate)); }
  function summaryBullets(e, x) { if (!x.c.summary) return; const pids = Object.keys(e.paras).filter(pid => /^\s*•\s*$/.test(e.text(pid))); if (pids[0]) e.set(pids[0], '   • ' + x.c.summary.replace(/\n/g, ' ')); }

  // ── 공문 본문 줄 규칙 ───────────────────────────────────────────
  const HINT_REF = [
    [/사안 ?접수 ?보고 기안 ?번호|사안 보고 기안 번호/, 'intake'], [/긴급조치 시행 번호/, 'emergency'], [/심의 개최 기안 ?번호/, 'meetOpen'],
    [/전담기구 심의 결과 보고 기안 번호|전담기구 개최 결과보고 기안/, 'meetResult'], [/심의위원회 조치 ?결과 통보 공문/, 'outcome'], [/개최요청 공문 번호/, 'cmteReq'], [/교내봉사 계획 기안/, 'service'],
    [/전담기구 개최 기안번호/, 'delOpen'], [/생활기록부 삭제\) 심의 결과 내부결재/, 'delResult'], [/학업성적관리위원회 심의 결과 내부결재/, 'gradeResult'], [/학업성적관리위원회 개최 내부결재/, 'gradeOpen']
  ];
  const LINE = {
    D1: (t, x) => t.replace(/○○○○\(예: 사안처리, 피해학생 지원 등\)/, x.f.support ? `${x.f.support}` : '○○○○').replace(/인성시민과-000\(2026\. 00\. 00\.\)/, m => x.ref('consult') || m).replace(/학교폭력사안처리 컨설팅을/, x.f.support && x.f.support !== '사안처리' ? '학교폭력제로센터 지원을' : '학교폭력사안처리 컨설팅을'),
    D2: (t, x) => { const l = a => a.map(s => `${s.name}(${gcn(s)})`).join(', '); if (/가해관련 학생:/.test(t) && x.o.length) return t.replace(/:.*$/, ': ' + l(x.o)); if (/피해관련 학생:/.test(t) && x.v.length) return t.replace(/:.*$/, ': ' + l(x.v)); return t.replace(/ ?<서식 ④(-1)?>/g, ''); },
    D3: (t, x) => { if (/대 +상:/.test(t) && x.o.length) return t.replace(/:.*$/, ': ' + (x.o.some(s => /6호/.test(s.emergency || '')) ? x.o.filter(s => /6호/.test(s.emergency || '')) : x.o).map(s => `${s.name}(${full(s)})`).join(', ')); t = t.replace('제17조 제1항 제5호 출석정지', '제17조 제1항 제6호 출석정지'); if (x.f.from) t = t.replace(/2026\. 5\. 11\.\(월\) ~ 5\. 22\.\(금\) 10일간/, `${period(x.f.from, x.f.to)} ${x.f.days || weekdays(x.f.from, x.f.to).length}일간`); return t; },
    D4: (t, x) => { const k = x.c.kind || '학교폭력'; const word = k === '둘 다' ? '학교폭력 및 아동학대' : k; return t.replace('학교폭력(아동학대)', word); },
    D5: (t, x) => t.replace(/○○초등학교-○○○\(20○○\.○○\.○○\.\)/, m => x.ref('partner') || x.ref('intake') || m).replace(/△△초등학교/g, m => x.f.partner || m).replace(/박@@/g, m => x.f.whoName || m).replace(/20○○\.○○\.○○\./, m => x.f.due ? ymdw(x.f.due) : m),
    D6: (t, x) => t.replace(/△△초등학교-○○○○\(20○○\.○○\.○○\.\)/, m => x.ref('partner') || m).replace(/○○초등학교/g, m => x.f.partner || m),
    D8: (t, x) => t.replace('○○교육지원청', m => x.p.eduOffice || m),
    D9: (t, x) => { const d = deadlines(x.c); t = t.replace('연기사유(예시)', '연기사유'); if (/연기사유/.test(t) && x.f.reason) return t.replace(/:.*$/, ': ' + x.f.reason); if (/접수일:/.test(t) && x.c.receivedDate) return t.replace(/:.*$/, ': ' + kow(x.c.receivedDate)); if (/예정일:/.test(t) && x.f.plan) return t.replace(/:.*$/, ': ' + kow(x.f.plan)); if (/마감일:/.test(t)) return (d ? t.replace(/:.*?\[/, `: ${kow(d.d21)} [`) : t).replace(/기준\s+21일\s*\]/, '기준 21일]'); return t; },
    D10: (t, x) => { t = t.replace('학무보', '학부모'); if (x.c.session) t = t.replace(/제1회/, `제${x.c.session}회`); if (/일시:/.test(t) && x.c.meetDate) return t.replace(/:.*$/, `: ${ymdw(x.c.meetDate)} ${x.c.meetTime || ''}`.trimEnd()); if (/장소:/.test(t) && x.c.meetPlace) return t.replace(/:.*$/, ': ' + x.c.meetPlace); if (/대상:/.test(t) && memberText(x.p)) return t.replace(/\(.*\)/, `(${memberText(x.p)})`); return t; },
    D11: (t, x) => x.c.session ? t.replace(/제1회/, `제${x.c.session}회`) : t,
    D12: (t, x) => way(t, x), D13: (t, x) => way(t, x),
    D17: (t, x) => serve(t, x), D18: (t, x) => serve(t, x),
    D19: (t, x) => { const f = x.f; if (/총 10시간/.test(t) && f.total) t = t.replace('10시간', f.total + '시간'); if (/^\s*1\)/.test(t) && f.plan1) return t.replace(/1\).*/, '1) ' + f.plan1); if (/^\s*2\)/.test(t) && f.plan1) return f.plan2 ? t.replace(/2\).*/, '2) ' + f.plan2) : null; if (/장소:/.test(t) && f.place) return t.replace(/:.*$/, ': ' + f.place); return t; },
    D21: (t, x) => { const f = x.f; if (/조치기간:/.test(t) && f.from) return t.replace(/:.*$/, `: ${period(f.from, f.to)}(출석정지 ${f.days || weekdays(f.from, f.to).length}일)`); if (/대상 학생:/.test(t) && x.target) return t.replace(/:.*$/, `: ${x.target.name}(${full(x.target)})`); if (/장소:/.test(t)) return t.replace(/:.*$/, `: ${f.place || '본교 상담실(학생주소(가정에서 출석정지 하는 경우))'}`); return t; },
    D22: (t, x) => x.c.year ? t.replace('20○○학년도', `${x.c.year}학년도`) : t,
    D26: (t, x) => /교육장 조치일/.test(t) && x.c.actionDate ? t.replace(/:.*$/, ': ' + ymd(x.c.actionDate)) : t,
    D27: (t, x) => meet(t, x, true), D28: (t, x) => meet(t, x), D29: (t, x) => meet(t, x), D30: (t, x) => meet(t, x),
    D31: (t, x) => { if (x.f.grad) t = t.replace('2027년 2월', x.f.grad); return x.target ? t.replace('홍길동', x.target.name) : t; },
    D32: (t, x) => { const d = deadlines(x.c); if (/예정일:/.test(t) && x.f.plan) return t.replace(/:.*$/, ': ' + ko(x.f.plan)); if (/마감일:/.test(t) && d) return t.replace(/:.*?\[/, `: ${ko(d.d28)} [`).replace('기준  28일', '기준 28일'); return t; }
  };
  function way(t, x) { const w = x.f.way; if (w === '자체해결') t = t.replace(/자체해결\(종결\)/g, '자체해결'); if (w === '종결') t = t.replace(/자체해결\(종결\)/g, '종결').replace(/학교장 자체해결 결과/g, '학교장 종결 결과').replace('학교장 자체해결 결과 보고서', '학교장 종결 결과 보고서'); return t; }
  function serve(t, x) { if (/대상 학생:/.test(t) && x.target) return t.replace(/:.*$/, `: ${x.target.name}(${hak(x.target)})`); if (/기간:/.test(t) && x.f.from) return t.replace(/:.*$/, `: ${period(x.f.from, x.f.to)}(학교에서의 봉사 ${x.f.hours || '○'}시간)`); return t; }
  function meet(t, x, part) { const f = x.f; if (f.round) t = t.replace(/제[○0]회/g, `제${f.round}회`); if (/일시:/.test(t) && f.date) return t.replace(/:.*$/, `: ${ymdw(f.date)} ${f.time || ''}`.trimEnd()); if (/장소:/.test(t) && f.place) return t.replace(/:.*$/, ': ' + f.place); if (part && /참석:/.test(t) && memberText(x.p)) return t.replace(/:.*$/, ': ' + memberText(x.p)); if (x.target) t = t.replace('홍길동', x.target.name); return t; }

  // 항목 기호에 따른 들여쓰기(행정업무운영 편람: 하위 항목은 2타씩)
  function indent(t) {
    const s = t.replace(/^[\s\u00a0\u2003]+/, '').replace(/[\s]+$/, '');
    if (/^[가-하]\. /.test(s) || /^[가-하]\.\S/.test(s)) return '  ' + s;
    if (/^끝\.$/.test(s)) return '  ' + s;
    if (/^\d+\) ?/.test(s)) return '    ' + s;
    if (/^[가-하]\) /.test(s)) return '      ' + s;
    return s;
  }

  // 공문을 수신·제목·본문·안내로 나눈다.
  function splitDoc(e, id) {
    const blocks = e.model.blocks; const out = { sender: '', to: '', title: '', body: [], hints: [], approval: '', headTid: null };
    const txt = b => e.text(b.pid).trim();
    let i = 0, headDone = false, ended = false; const inline = new Set();
    for (; i < blocks.length; i++) {
      const b = blocks[i]; const tbls = b.items.filter(x => x.k === 'tbl'); const t = txt(b);
      if (!headDone) {
        const head = tbls.find(x => x.rows.some(r => r.some(c => norm(cellOrig(e, c)) === '수신')));
        if (head) {
          out.headTid = head.tid; out.headPid = b.pid;
          const val = l => { const f = e.find(l, 1, head.tid); return f ? e.cellText(e.cell(head.tid, f.c.r, f.c.c + f.c.cs)).trim() : ''; };
          out.to = val('수신'); out.title = val('제목').replace(/\s*\n\s*/g, ' ').trim();
          const s = head.rows.flat().find(c => /학교$/.test(norm(cellOrig(e, c)))); out.sender = s ? e.cellText(s).trim() : '';
          headDone = true; if (t) { out.body.push(b); inline.add(b.pid); } continue;
        }
        if (/^수신\s/.test(t)) { out.to = t.replace(/^수신\s*/, ''); continue; }
        if (/^제목\s/.test(t)) { out.title = t.replace(/^제목\s*/, ''); headDone = true; continue; }
        if (/학교$/.test(norm(t)) && /^[◯○]/.test(t)) { out.sender = t; continue; }
        if (/^※/.test(t)) out.hints.push(t);
        continue;
      }
      const foot = tbls.find(x => /★/.test(x.rows.flat().map(c => cellOrig(e, c)).join('')));
      if (foot) { out.approval = '★교사 – 교사 – 교감 – 교장 (협조자)'; ended = true; continue; }
      if (ended || tbls.some(x => /^(☞|조언|유의사항|※결재라인|※학교자체)/.test(norm(allText(e, x))))) { const h = t || tbls.map(x => allText(e, x)).join('\n'); if (h.trim()) out.hints.push(h.trim()); if (b.items.some(x => x.k === 'img')) out.hints.push({ img: b.items.find(x => x.k === 'img').src }); continue; }
      out.body.push(b);
      if (/끝\.\s*(<서식 ④-1>)?\s*$/.test(t)) ended = true;
    }
    while (out.body.length && !txt(out.body[0]) && !out.body[0].items.some(x => x.k !== 't')) out.body.shift();
    out.inline = inline; void id;
    return out;
  }
  const cellOrig = (e, c) => c.blocks.map(b => e.paras[b.pid] ? e.paras[b.pid].orig.join('') : '').join('');
  const allText = (e, t) => t.rows.map(r => r.map(c => c.blocks.map(b => b.items.map(i => i.k === 't' ? i.s : i.k === 'tbl' ? allText(e, i) : i.k === 'draw' ? i.blocks.map(z => z.items.map(y => y.s || '').join('')).join('') : '').join('')).join('\n')).join(' ').trim()).filter(Boolean).join('\n').trim();

  function composeDoc(e, x) {
    const id = x.s.id; const d = splitDoc(e, id); const hints = []; const refs = [];
    const title0 = d.title; let title = d.title, to = d.to;
    const sub = t => { // 공통 치환(공문 문장용)
      if (x.no) t = t.replace(/[○◯△0O]{2,4}(초|중|고)-(?:20○○|2026)-(?:01|1|[○0]{1,2})(호?)/g, (m, _a, ho) => x.no + (ho || '')).replace(/\(사안 번호 ?기입\)/g, `(${x.noHo})`).replace(/^20○○-○○호/, `${x.c.year}-${x.c.seq}호`);
      if (x.c.year) t = t.replace(/^(\d+\. )?20○○\. 학교폭력/, (m, a) => `${a || ''}${x.c.year}. 학교폭력`);
      return t;
    };
    const rule = LINE[id] || (t => t);
    title = rule(sub(title).replace(/◯◯초-/g, m => m), x) || title;
    if (id === 'D3' && x.f.why) title = '가해학생 ' + x.f.why; else if (id === 'D3' && x.s.clean) title = '가해학생 긴급조치 취소 및 출석 인정';
    if (id === 'D4') { const k = x.c.kind || '학교폭력'; title = `${k === '둘 다' ? '학교폭력 및 아동학대' : k} 사안접수 보고${k === '아동학대' ? '' : x.noHo ? `(${x.noHo})` : title0.match(/\([^()]*\)$/) ? title0.match(/\([^()]*\)$/)[0] : ''}`; }
    if (id === 'D14' || id === 'D15') { if (x.p.eduOffice) title = title.replace('○○교육지원청', x.p.eduOffice); }
    if (id === 'D1' && x.f.support) title = x.f.support === '피해학생' ? '학교폭력 피해학생 지원 요청' : `학교폭력${x.f.support === '사안처리' ? '사안처리' : ' ' + x.f.support} 지원 요청`;
    const of = office(x);
    if (of) {
      if (id === 'D4') to = `수신자 참조(충청북도교육청 인성시민과${x.c.offenderStaff ? ', 교원인사과' : ''}, ${of}${x.students.some(s => s.special || s.disabled) ? ', ' + x.p.eduOffice + ' 특수교육지원센터' : ''})`;
      else if (/청주_청주교육지원청/.test(to)) to = /수신자 참조/.test(to) ? `수신자 참조(${of})` : of;
    }
    if (['D5', 'D6', 'D7', 'D8'].includes(id)) to = x.f.partner ? (id === 'D5' || id === 'D6' ? x.f.partner + (/장$/.test(x.f.partner) ? '' : '장') : x.f.partner) : to;
    if (['D19', 'D20', 'D23', 'D26'].includes(id) && x.f.org) to = x.f.org;

    if (!x.s.clean) { d.title = title; d.to = to; return finish(); }

    // ① 본문 줄 다듬기
    let attachFrom = null; const lines = [];
    const drop = pid => e.drop.add(pid);
    d.body.forEach(b => {
      if (b.items.some(i => i.k === 'tbl') && !d.inline.has(b.pid)) return;
      const raw = (b.hd || '') + e.text(b.pid); if (!raw.trim()) return;
      const isAttach = /^\s*붙임/.test(raw); if (isAttach && attachFrom === null) attachFrom = b.pid;
      const segs = []; raw.split('\n').forEach(s => { if (segs.length && !/^\s*([가-하]\.|\d+[.)]|붙임|※|\[)/.test(s)) segs[segs.length - 1] = segs[segs.length - 1].replace(/\s+$/, '') + ' ' + s.trim(); else segs.push(s); });
      const kept = [];
      segs.forEach(seg0 => {
        let seg = seg0;
        // ※ 안내는 본문에서 빼고 작성 안내로 옮긴다.
        const full0 = seg;
        const h = seg.match(/\s*※.*$/);
        if (h) { const note = h[0].trim(); hints.push(/\(/.test(note) ? note : note.replace(/\)$/, '')); seg = seg.slice(0, h.index); if (/\(\s*$/.test(seg)) seg = seg.replace(/\s*\(\s*$/, '').replace(/$/, ''); const r = HINT_REF.find(([re]) => re.test(note)); if (r) { refs.push(r[1]); seg = putRef(seg, x.ref(r[1])); } else if (/시행 번호\(또는 심의위원회/.test(note)) { refs.push('self', 'outcome'); seg = putRef(seg, x.ref('self') || x.ref('outcome')); } }
        if (id === 'D30' && /^\s*$/.test(seg)) return;
        if (id === 'D14' && /교육부 교수학습평가과/.test(seg)) { hints.push(seg.trim().replace(/\)$/, '')); return; }
        if (!seg.trim()) return;
        void full0;
        if (id === 'D4') { const k = x.c.kind || '학교폭력'; if (/\[아동학대 사안의 경우\]/.test(seg)) { if (k === '학교폭력') { hints.push(seg.trim()); return; } const law = '아동학대처벌법 제10조 제1항, 동법 제10조 제2항'; if (k === '아동학대' && kept.length === 0 && lines.length) { lines[lines.length - 1].out = [`1. 관련: ${law}`]; } else if (lines.length) { lines[lines.length - 1].out = [`1. 관련: 학교폭력예방 및 대책에 관한 법률 제19조 제3항, ${law}`]; } return; } if (k === '아동학대') seg = seg.replace(/^(2\. )[^ ]*?호? ?학교폭력\(아동학대\)/, '$1아동학대').replace(/^(2\. )◯◯초-20○○-1호 /, '$1'); }
        let t = rule(sub(seg), x); if (t === null) return;
        if (id === 'D30' && /^1\. 관련:/.test(t)) { refs.push('gradeOpen'); t = putRef(t, x.ref('gradeOpen')); }
        if (id === 'D1' && /^1\. 관련:/.test(t)) refs.push('consult');
        if (id === 'D5' && /^1\. 관련:/.test(t)) refs.push('partner'); if (id === 'D6' && /^1\. 관련:/.test(t)) refs.push('partner');
        kept.push(isAttach || attachFrom !== null ? t.replace(/\s+$/, '') : indent(t));
      });
      lines.push({ pid: b.pid, out: kept, hd: b.hd });
    });
    // ② 붙임 정리(체크한 것만, 번호 다시 매기기)
    const attach = [];
    lines.filter(l => attachFrom !== null && l.pid >= attachFrom).forEach(l => l.out.forEach(t => { let s = t.replace(/^\s*붙임\s*/, '').replace(/^\s*\d+\.\s*/, '').replace(/\s*끝\.\s*$/, '').trim(); if (!s) return; attach.push(s); }));
    let items = attach.map(s => {
      let on = true, note = '';
      if (id === 'D4') { const k = x.c.kind || '학교폭력'; s = s.replace(/^\[아동학대 사안인 경우\]‘?/, ''); if (/^아동학대/.test(s) && k === '학교폭력') on = false; if (/^학교폭력 사안접수/.test(s) && k === '아동학대') on = false; if (/\(권장\)/.test(s)) { s = s.replace('(권장)', ''); note = '권장'; } }
      if (id === 'D14') { if (/긴급조치/.test(s)) { on = x.students.some(y => emLines(y).length); note = '긴급조치를 한 경우(17조4항 2호 제외)'; } if (/학생선수/.test(s)) { on = x.o.some(y => y.athlete); note = '학생선수인 경우'; if (!/1부/.test(s)) s += ' 1부.'; } if (/의견 청취/.test(s)) { on = false; note = '보호자 요청이 있는 경우'; } if (/서면 의견서/.test(s)) { on = false; note = '아동심리 전문가가 불참할 경우'; } if (/개최 요청서/.test(s)) { on = false; note = '자체해결 후 보호자 요청이 있는 경우만'; } if (/기타 심의/.test(s)) { on = false; note = '해당 시'; } }
      if (id === 'D1') { if (x.f.support && x.f.support !== '사안처리') s = '학교폭력제로센터 피해학생 지원 요청서 1부.'; }
      s = s.replace(/\(사안 번호 ?기입\)/, x.noHo ? `(${x.noHo})` : '');
      return { text: s, on, note };
    });
    const saved = x.s.attach;
    // 사용자가 고친 것만 기억한다(i: 원래 붙임 순번, text/on: 고친 값). 나머지는 사안 정보가 바뀌면 함께 바뀐다.
    items.forEach((it, i) => { it.i = i; it.auto = it.text; });
    if (Array.isArray(saved)) items = saved.map(v => v.i >= 0 && items[v.i] ? { ...items[v.i], text: v.text || items[v.i].text, on: typeof v.on === 'boolean' ? v.on : items[v.i].on, forms: v.forms } : v.i >= 0 ? null : { i: -1, text: v.text || '', on: v.on !== false, note: '', forms: v.forms || [] }).filter(Boolean);
    const on = items.filter(i => i.on); const attachLines = on.length === 0 ? [] : on.length === 1 ? [`붙임  ${tail(on[0].text)}  끝.`] : on.map((a, i) => `${i ? '      ' : '붙임  '}${i + 1}. ${tail(a.text)}${i === on.length - 1 ? '  끝.' : ''}`);
    // 빈 줄은 '붙임' 바로 앞 한 줄만 남긴다.
    d.body.forEach(b => { if (!b.items.some(i => i.k !== 't') && !e.text(b.pid).trim() && !b.hd) drop(b.pid); });
    if (attachLines.length) attachLines[0] = '\n' + attachLines[0];
    let first = true;
    lines.forEach(l => {
      if (attachFrom !== null && l.pid >= attachFrom) {
        if (first && attachLines.length) { e.set(l.pid, attachLines.join('\n')); first = false; } else drop(l.pid);
        return;
      }
      if (!l.out.length) { drop(l.pid); return; }
      let text = l.out.join('\n'); if (l.hd && text.startsWith(l.hd)) text = text.slice(l.hd.length);
      if (text !== e.text(l.pid)) e.set(l.pid, text);
    });
    if (!attachLines.length && attachFrom !== null) { const lastText = lines.filter(l => l.pid < attachFrom && l.out.length).pop(); if (lastText) e.set(lastText.pid, e.text(lastText.pid).replace(/\s*$/, '') + '  끝.'); }
    d.attach = items; d.title = title; d.to = to; d.body = d.body.filter(b => !e.drop.has(b.pid));
    return finish();

    function finish() {
      if (x.s.clean) { // 본문 줄은 모두 같은 글자 모양으로 통일한다(원본은 줄마다 글꼴·자간이 조금씩 다르다).
        d.body.forEach(b => { if (e.paras[b.pid] && e.text(b.pid).trim()) e.paras[b.pid].force = true; });
        const b0 = d.body.find(b => e.text(b.pid).trim()); const it = b0 && b0.items.filter(i => i.k === 't').sort((m, n) => n.s.trim().length - m.s.trim().length)[0];
        d.bodyCs = it ? it.cs : null;
      }
      d.hints = hints.concat(d.hints); d.refs = [...new Set(refs)];
      if (x.s.clean) { const keep = new Set(d.body.map(b => b.pid)); e.model.blocks.forEach(b => { if (!keep.has(b.pid)) e.drop.add(b.pid); }); if (d.headTid !== null && keep.has(d.headPid)) e.dropTbl.add(d.headTid); }
      return d;
    }
  }
  const tail = s0 => { const s = s0.replace(/\)(\d부)/, ') $1'); return /\d부\s*$/.test(s) ? s.trim() + '.' : /[.]\s*$/.test(s) ? s.trim() : s.trim() + ' 1부.'; };
  function putRef(seg, v) {
    if (!v) return seg.replace(/\s+$/, '');
    const m = seg.match(/^(\s*(?:(?:\d+|[가-하])\.\s*)?(?:관련:\s*)?)(.*)$/s);
    return m ? m[1] + v : seg;
  }

  // ── 서식: 제출용에서 빼는 것 ──────────────────────────────────────
  function cleanForm(e, id) {
    const KEEP = { F24: /\[참고\] 피해학생은/ };
    e.model.blocks.forEach((b, n) => {
      const tbls = b.items.filter(i => i.k === 'tbl'); const t = e.text(b.pid).trim();
      const label = tbls[0] && /^<(공문|서식)/.test(norm(allText(e, tbls[0]))) && n === 0;
      if (label) { e.drop.add(b.pid); return; }
      if (tbls.length) {
        const s = norm(allText(e, tbls[0]));
        const guide = /^\[참고\]|^유의사항|^※공동학폭사안의경우|^※본양식은현재학교|^※학교자체관계회복/.test(s) || (id === 'F23' && /^\[참고\]본요청서는/.test(s));
        if (guide && !(KEEP[id] && KEEP[id].test(allText(e, tbls[0])))) { e.drop.add(b.pid); e.hints.push(allText(e, tbls[0])); }
        return;
      }
      if (/^※ ?예시 양식이므로|^※ 개인정보 동의 및 활용서는|^※ 해당학교에서 작성 후/.test(t) || (id === 'F36' && /^※ 위 교육일정 예시는/.test(t)) || (id === 'F45' && t === '.')) { e.drop.add(b.pid); e.hints.push(t); }
    });
  }

  // ── 최종 조립 ─────────────────────────────────────────────────
  // st: { id, clean, f, target, date, ops, attach, title, to }
  function compose(model, profile, cs, st) {
    const e = new Ed(model); const x = makeCtx(profile, cs, st); let doc = null;
    if (model.kind === 'guide') return { edits: {}, drop: [], dropTbl: [], hints: [], doc: null, x };
    if (model.kind === 'form') { common(e, x); if (st.clean) cleanForm(e, st.id); }
    else { // 공문 표 안의 공통 치환
      Object.values(e.tables).forEach(t => t.rows.flat().forEach(c => c.blocks.forEach(b => { if (x.no && e.paras[b.pid]) e.replace(b.pid, RE_CASE, (m, _l, ho) => x.no + (ho || '')); })));
    }
    if (RULES[st.id]) RULES[st.id](e, x);
    if (model.kind === 'doc') { doc = composeDoc(e, x); if (st.title) doc.title = st.title; if (st.to) doc.to = st.to; }
    if (st.clean && ['F3', 'F13', 'F27', 'F28'].includes(st.id)) e.hints.push('책자의 작성 예시(가상의 이름·날짜)는 제출용에서 비웠습니다. 예시를 보려면 위의 “제출용” 체크를 끄세요.');
    if (st.clean && st.id === 'F10') e.hints.push('* 신고 접수 시 타학교 관련성이 확인되지 않은 경우에는 공란으로 처리\n※ 학교자체 조사인 경우 전담조사관 면담조사 가능시간은 빈칸\n※ 신고자가 익명을 희망할 경우 익명 처리');
    return { edits: e.edits(), drop: [...e.drop], dropTbl: [...e.dropTbl], hints: e.hints.concat(doc ? doc.hints : []), doc, x, fixes: FIXES[st.id] || [] };
  }

  // 아직 채우지 않은 자리 표시 찾기
  const RE_TODO = /○○|◯◯|△△|@@|20○○|0000학교|(?<![:\d.\-])0{2,5}(?![:\d])|\.00\.|\(예시\)|예시\)|예\)|예>|홍길동|박00|한00|◯ ◯|신고자가 익명을 희망|육하원칙|학생 상담 중 인지|조사인 경우 빈칸|구체적으로 기록|간략히 기재|구체적 사유를 기술|통보 일시, 방법|[“]O[”]|충족함\. \/|\(제3자의 오인신고, |운영 \/ 미운영|2000\. ?00/;
  const isTodo = t => RE_TODO.test(String(t || ''));

  function mergeEdits(auto, manual) { return Object.assign({}, auto, manual || {}); }

  // 행을 추가/삭제했을 때 손으로 고친 내용의 문단 번호를 함께 옮긴다.
  function shiftManual(manual, map) { const out = {}; Object.entries(manual || {}).forEach(([pid, v]) => { if (map[pid] !== undefined) out[map[pid]] = v; }); return out; }

  return { STAGES, COMMON, GUIDE_OF, DOC_FIELDS, TARGET, HAS_DATE, FIXES, REF_LABELS, stageOf, attachForms, compose, neededOps, mergeEdits, shiftManual, deadlines, isTodo, shortSchool, makeCtx, Ed, splitDoc, ymd, ymdw, ko, addRow, dueDate, addDays, hak };
});
