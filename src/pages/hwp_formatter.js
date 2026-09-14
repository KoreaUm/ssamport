(function () {
'use strict';

var DOC_TYPES = [
  '계획서', '결과보고서', '가정통신문', '회의록'
];

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function render(container) {
  // 이전 마크다운 초안은 더 이상 자동 복원하지 않음 (사용자 요청)
  await api.setSetting('hwp_md_draft', '');
  var savedMd = '';
  var savedTopic = (await api.getSetting('hwp_topic', '')) || '';
  var savedType = (await api.getSetting('hwp_doctype', DOC_TYPES[0])) || DOC_TYPES[0];
  var savedSchool = (await api.getSetting('hwp_school', '')) || '';
  var savedLogo   = (await api.getSetting('hwp_logo_path', '')) || '';

  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">📄 한글 자동 서식</h1>
        <p class="page-header-desc">마크다운으로 작성 → 한글 공문서 표준 서식으로 자동 변환</p>
      </div>

      <!-- 워크플로우 -->
      <div style="background:linear-gradient(135deg,#e0e7ff,#f3e8ff);border-radius:12px;padding:16px;margin-bottom:18px;font-size:12px;color:#4338ca">
        <b>📋 3가지 방법:</b>
        ① 주제만 입력 → <b>로컬 AI</b>로 자동 생성  ·
        ② 주제 입력 → <b>프롬프트 복사</b> → ChatGPT/Claude 활용  ·
        ③ 마크다운을 <b>직접 작성/편집</b>
      </div>

      <!-- Step 1: 주제 + 양식 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px">
        <div style="font-weight:600;font-size:14px;margin-bottom:10px">1️⃣ 주제 입력 + 양식 선택</div>
        <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
          <input id="hwpf-school" class="input" type="text" placeholder="부서/기관명 — 표지·본문 헤더에 자동 삽입 (예: 충청북도교육청 중등교육과)" value="${escapeHtml(savedSchool)}" style="flex:1;font-size:13px;padding:6px 8px;box-sizing:border-box">
        </div>
        <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
          <button class="btn btn-secondary btn-sm" id="hwpf-logo-pick" style="white-space:nowrap;flex-shrink:0">🖼 학교 로고 선택</button>
          <span id="hwpf-logo-name" style="font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${savedLogo ? savedLogo.split(/[\\/]/).pop() : '선택된 로고 없음 (없으면 기관명만 표시)'}</span>
          <button class="btn btn-secondary btn-sm" id="hwpf-logo-clear" style="display:${savedLogo ? 'inline-block' : 'none'}">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:160px 1fr;gap:8px;margin-bottom:10px">
          <select id="hwpf-doctype" class="input" style="font-size:13px;padding:6px 8px">
            ${DOC_TYPES.map(t => `<option ${t === savedType ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
          </select>
          <input id="hwpf-topic" class="input" type="text" placeholder="예: 2026 학생 봉사활동 운영" value="${escapeHtml(savedTopic)}" style="font-size:13px;padding:6px 8px">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-secondary btn-sm" id="hwpf-sections-edit">⚙️ 섹션 구성</button>
          <span id="hwpf-sections-summary" style="font-size:11px;color:var(--text2)"></span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
          <button class="btn btn-primary btn-sm" id="hwpf-ai-gen">🤖 로컬 AI로 자동 생성</button>
          <button class="btn btn-secondary btn-sm" id="hwpf-copy-prompt">📋 프롬프트 복사</button>
          <div style="display:flex;gap:4px;padding-left:4px;border-left:1px solid var(--border);margin-left:4px">
            <button class="btn btn-secondary btn-sm hwpf-open-ai" data-url="https://chatgpt.com" title="ChatGPT 열기" style="padding:4px 10px">💬 ChatGPT</button>
            <button class="btn btn-secondary btn-sm hwpf-open-ai" data-url="https://claude.ai/new" title="Claude 열기" style="padding:4px 10px">🤖 Claude</button>
            <button class="btn btn-secondary btn-sm hwpf-open-ai" data-url="https://gemini.google.com/app" title="Gemini 열기" style="padding:4px 10px">✨ Gemini</button>
          </div>
          <span id="hwpf-ai-status" style="font-size:12px;color:var(--text2);align-self:center"></span>
        </div>
      </div>

      <!-- 섹션 구성 모달 -->
      <div id="hwpf-sections-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center">
        <div style="background:#fff;border-radius:12px;padding:20px;width:min(640px,92vw);max-height:88vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-weight:700;font-size:16px">⚙️ 섹션 구성</div>
            <button class="btn btn-secondary btn-sm" id="hwpf-sections-close" style="padding:4px 10px">✕</button>
          </div>
          <div style="font-size:12px;color:#666;margin-bottom:14px;line-height:1.5">
            대제목 섹션의 <b>포함 여부</b>, <b>순서</b>(드래그), <b>이름</b>, <b>작성 주체</b>(🤖 AI 생성 / ✍️ 직접 작성)를 정할 수 있습니다.
          </div>
          <div id="hwpf-sections-list" style="overflow-y:auto;flex:1;padding-right:4px"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <div style="display:flex;gap:6px">
              <button class="btn btn-secondary btn-sm" id="hwpf-sections-add">➕ 섹션 추가</button>
              <button class="btn btn-secondary btn-sm" id="hwpf-sections-add-attach" style="border-color:#18304b55;color:#18304b">📎 붙임 추가</button>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-secondary btn-sm" id="hwpf-sections-reset">↺ 기본값</button>
              <button class="btn btn-primary btn-sm" id="hwpf-sections-apply">적용</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: 마크다운 편집 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-weight:600;font-size:14px">2️⃣ 마크다운 작성/편집</div>
          <div style="font-size:11px;color:var(--text2)">
            <code>제목:</code> · <code>부제목:</code> · <code>부서:</code> · <code>대제목:</code> · <code>소제목:</code> · <code>◦ 항목</code> · <code>  - 세부항목</code> · <code>※ 주석</code> · <code>표:</code> · <code>붙임:</code>
          </div>
        </div>
        <textarea id="hwpf-md" style="width:100%;min-height:320px;padding:12px;font-family:'D2Coding',Consolas,monospace;font-size:13px;line-height:1.6;border:1px solid var(--border);border-radius:8px;resize:vertical;background:#fafafa">${escapeHtml(savedMd)}</textarea>
        <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:11px;color:var(--text2)">
          <span>위계: 제목→부제목→부서→대제목(로마자 박스)→소제목(□)→◦항목→  -세부항목→※주석→표: · 붙임(전폭 박스, 자동 번호)</span>
          <span><span id="hwpf-md-count">0</span>자</span>
        </div>
      </div>

      <!-- Step 3: 한글 변환 -->
      <div style="background:var(--card);border:2px solid var(--border);border-radius:12px;padding:20px;margin-bottom:14px;display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="font-weight:600;font-size:14px">3️⃣ 한글 파일로 저장 + 서식 적용</div>
        <div id="hwpf-status-text" style="font-size:12px;color:var(--text2);text-align:center">
          위 마크다운을 한글 공문서 표준 서식으로 변환합니다.
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" id="hwpf-build-hwpx" style="font-size:14px;padding:10px 28px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:0;color:#fff">
            🎨 hwpx 파일 만들기
          </button>
        </div>
        <div id="hwpf-spinner" style="display:none;font-size:13px;color:var(--accent)">⏳ 처리 중...</div>
      </div>

      <!-- 결과 -->
      <div id="hwpf-result" style="display:none;margin-bottom:14px"></div>

      <!-- 표준 안내 -->
      <details style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:12px;color:var(--text2);margin-bottom:10px">
        <summary style="cursor:pointer;font-weight:600;color:var(--text1)">📐 적용되는 서식 (충청북도교육청 현장지원단 운영 계획 스타일)</summary>
        <div style="margin-top:10px;line-height:1.9">
          • <b>대제목</b>: 남색(#18304B) 박스 + 흰색 로마자(Ⅰ,Ⅱ,Ⅲ…) + 파란 구분선 + 제목 텍스트<br>
          • <b>소제목</b>: □ 스타일, 굵은 본문<br>
          • <b>◦ 항목</b>: 수준1 불릿 (들여쓰기 적용)<br>
          • <b>  - 세부항목</b>: 수준2 대시 불릿<br>
          • <b>표</b>: 검정 테두리 + 첫 행 헤더 스타일<br>
          • <b>페이지</b>: A4 세로, 표준 여백
        </div>
      </details>

      <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:12px;font-size:12px;color:#1e40af">
        🎨 한글(HWP) 프로그램 없이도 동작합니다. Python은 앱에 내장되어 있어 별도 설치가 필요 없습니다.
      </div>
    </div>
  `;

  var ta       = container.querySelector('#hwpf-md');
  var topicEl  = container.querySelector('#hwpf-topic');
  var typeEl   = container.querySelector('#hwpf-doctype');
  var schoolEl = container.querySelector('#hwpf-school');
  var statusEl = container.querySelector('#hwpf-ai-status');
  var statusText = container.querySelector('#hwpf-status-text');
  var resultDiv  = container.querySelector('#hwpf-result');
  var spinner    = container.querySelector('#hwpf-spinner');
  var mdCount    = container.querySelector('#hwpf-md-count');
  var logoNameEl = container.querySelector('#hwpf-logo-name');
  var logoClearBtn = container.querySelector('#hwpf-logo-clear');
  var currentLogoPath = savedLogo;

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── 섹션 구성 상태 (세션 메모리, 영구 저장 X) ─────────────
  function makeSections(names) {
    return names.map(function (n) {
      var isAttachment = typeof n === 'object' && n.type === 'attachment';
      var name = typeof n === 'object' ? n.name : n;
      return { name: name, type: isAttachment ? 'attachment' : 'heading', mode: 'ai', included: true, body: '' };
    });
  }

  var DOC_TYPE_SECTIONS = {
    '계획서':    ['관련 근거', '추진 목적', '추진 방침', '세부 추진 계획', '기대 효과'],
    '결과보고서': ['관련 근거', '행사(사업) 개요', '추진 결과', '예산 집행 현황', '성과 및 시사점'],
    '가정통신문': ['인사말', '안내 사항', '협조 및 요청 사항', '문의처'],
    '회의록':    ['회의 개요', '보고 사항', '협의 사항', '결정 사항'],
  };

  function defaultSections(docType) {
    var names = DOC_TYPE_SECTIONS[docType] || DOC_TYPE_SECTIONS['계획서'];
    return makeSections(names);
  }

  var sections = defaultSections(savedType);
  var dragIdx = -1;

  function updateSectionsSummary() {
    var el = container.querySelector('#hwpf-sections-summary');
    if (!el) return;
    var included = sections.filter(function (s) { return s.included; });
    var aiCount = included.filter(function (s) { return s.mode === 'ai'; }).length;
    var manualCount = included.length - aiCount;
    el.textContent = '섹션 ' + included.length + '개 (🤖 ' + aiCount + ' · ✍️ ' + manualCount + ')';
  }

  function renderSectionsList() {
    var list = container.querySelector('#hwpf-sections-list');
    list.innerHTML = sections.map(function (s, i) {
      var aiActive = s.mode === 'ai';
      var isAttach = s.type === 'attachment';
      var manualBox = '';
      if (s.mode === 'manual' && s.included) {
        var placeholder = isAttach
          ? '붙임 자료 내용을 자유롭게 입력하세요.\n\n예시:\n설문지 양식 1부\n수업 계획서 1부'
          : '자유롭게 한 줄씩 적으세요. 자동으로 마크다운 규칙이 적용됩니다.\n\n예시 입력:\n학생 자발성 강조\n안전사고 예방\n  세부 지침 작성\n※ 비고 사항\n\n→ 자동 변환 결과:\n◦ 학생 자발성 강조\n◦ 안전사고 예방\n  - 세부 지침 작성\n※ 비고 사항';
        manualBox =
          '<div style="padding:6px 10px 10px 36px;background:' + (isAttach ? '#f0f4ff' : '#f0f9ff') + ';border-top:1px dashed ' + (isAttach ? '#18304b55' : '#93c5fd') + '">' +
            '<div style="font-size:11px;color:' + (isAttach ? '#18304b' : '#0369a1') + ';margin-bottom:4px">✍️ 직접 작성 — ' + (isAttach ? '붙임 자료 제목/설명을 입력하세요' : '한 줄씩 자유롭게 입력하면 자동으로 ◦ / 세부항목 형식이 적용됩니다 (커서 떠날 때 변환)') + '</div>' +
            '<textarea class="hwpf-sec-body" placeholder="' + escapeHtml(placeholder) + '" style="width:100%;min-height:60px;font-family:\'D2Coding\',Consolas,monospace;font-size:12px;line-height:1.5;padding:8px;border:1px solid ' + (isAttach ? '#18304b55' : '#93c5fd') + ';border-radius:6px;background:#fff;resize:vertical;box-sizing:border-box">' + escapeHtml(s.body || '') + '</textarea>' +
          '</div>';
      }
      // 타입 토글 (대제목 / 붙임)
      var typeToggle =
        '<div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;font-size:11px;margin-right:2px">' +
          '<button class="hwpf-sec-type" data-type="heading" style="border:0;padding:3px 7px;background:' + (!isAttach ? '#18304b' : '#fff') + ';color:' + (!isAttach ? '#fff' : '#666') + ';cursor:pointer;white-space:nowrap">대제목</button>' +
          '<button class="hwpf-sec-type" data-type="attachment" style="border:0;padding:3px 7px;background:' + (isAttach ? '#18304b' : '#fff') + ';color:' + (isAttach ? '#fff' : '#666') + ';cursor:pointer;white-space:nowrap">📎붙임</button>' +
        '</div>';
      return '<div class="hwpf-sec-wrap" data-idx="' + i + '" style="border:1px solid ' + (isAttach ? '#18304b44' : 'var(--border)') + ';border-radius:8px;margin-bottom:6px;background:' + (s.included ? '#fff' : '#f5f5f5') + ';overflow:hidden">' +
        '<div class="hwpf-sec-row" style="display:flex;align-items:center;gap:8px;padding:8px">' +
          '<span class="hwpf-sec-handle" draggable="true" title="드래그하여 순서 변경" style="cursor:grab;color:#999;font-size:14px;user-select:none;padding:4px 6px">⋮⋮</span>' +
          '<input type="checkbox" class="hwpf-sec-inc" ' + (s.included ? 'checked' : '') + ' style="cursor:pointer">' +
          '<input type="text" class="hwpf-sec-name input" value="' + escapeHtml(s.name) + '" style="flex:1;font-size:13px;padding:4px 6px">' +
          typeToggle +
          '<div style="display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;font-size:12px">' +
            '<button class="hwpf-sec-mode" data-mode="ai" style="border:0;padding:4px 8px;background:' + (aiActive ? '#7c3aed' : '#fff') + ';color:' + (aiActive ? '#fff' : '#666') + ';cursor:pointer">🤖 AI</button>' +
            '<button class="hwpf-sec-mode" data-mode="manual" style="border:0;padding:4px 8px;background:' + (!aiActive ? '#0ea5e9' : '#fff') + ';color:' + (!aiActive ? '#fff' : '#666') + ';cursor:pointer">✍️ 직접</button>' +
          '</div>' +
          '<button class="hwpf-sec-del" title="삭제" style="border:0;background:transparent;cursor:pointer;color:#dc2626;font-size:16px;padding:0 4px">🗑</button>' +
        '</div>' +
        manualBox +
      '</div>';
    }).join('');

    // 이벤트 바인딩
    list.querySelectorAll('.hwpf-sec-wrap').forEach(function (wrap) {
      var idx = parseInt(wrap.getAttribute('data-idx'), 10);
      wrap.querySelector('.hwpf-sec-inc').addEventListener('change', function (e) {
        sections[idx].included = e.target.checked;
        renderSectionsList();
      });
      wrap.querySelector('.hwpf-sec-name').addEventListener('input', function (e) {
        sections[idx].name = e.target.value;
      });
      wrap.querySelectorAll('.hwpf-sec-type').forEach(function (btn) {
        btn.addEventListener('click', function () {
          sections[idx].type = btn.getAttribute('data-type');
          renderSectionsList();
        });
      });
      wrap.querySelectorAll('.hwpf-sec-mode').forEach(function (btn) {
        btn.addEventListener('click', function () {
          sections[idx].mode = btn.getAttribute('data-mode');
          renderSectionsList();
        });
      });
      wrap.querySelector('.hwpf-sec-del').addEventListener('click', function () {
        sections.splice(idx, 1);
        renderSectionsList();
      });
      var bodyEl = wrap.querySelector('.hwpf-sec-body');
      if (bodyEl) {
        bodyEl.addEventListener('input', function (e) {
          sections[idx].body = e.target.value;
        });
        // 포커스 떠날 때 자동 정규화 (◦ / 들여쓰기 / 다른 불릿 등을 표준 형식으로)
        bodyEl.addEventListener('blur', function () {
          var normalized = normalizeManualBody(sections[idx].body);
          if (normalized !== sections[idx].body) {
            sections[idx].body = normalized;
            bodyEl.value = normalized;
          }
        });
      }
      // 드래그는 핸들에서만 시작 (textarea/input과 충돌 방지)
      var handle = wrap.querySelector('.hwpf-sec-handle');
      handle.addEventListener('dragstart', function (e) {
        dragIdx = idx;
        wrap.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });
      handle.addEventListener('dragend', function () {
        wrap.style.opacity = '';
        dragIdx = -1;
      });
      wrap.addEventListener('dragover', function (e) {
        if (dragIdx < 0) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        wrap.style.borderTop = idx < dragIdx ? '2px solid #7c3aed' : '';
        wrap.style.borderBottom = idx > dragIdx ? '2px solid #7c3aed' : '';
      });
      wrap.addEventListener('dragleave', function () {
        wrap.style.borderTop = '1px solid var(--border)';
        wrap.style.borderBottom = '1px solid var(--border)';
      });
      wrap.addEventListener('drop', function (e) {
        e.preventDefault();
        wrap.style.borderTop = '1px solid var(--border)';
        wrap.style.borderBottom = '1px solid var(--border)';
        if (dragIdx < 0 || dragIdx === idx) return;
        var moved = sections.splice(dragIdx, 1)[0];
        sections.splice(idx, 0, moved);
        dragIdx = -1;
        renderSectionsList();
      });
    });
  }

  // 직접 작성 본문을 마크다운 규칙에 맞게 자동 정규화.
  // 평문 → "◦ 항목", 들여쓴 평문/다른 불릿 → "  - 세부항목".
  // 이미 형식이 맞거나 태그 줄(제목/대제목/소제목/표/※)은 건드리지 않음.
  function normalizeManualBody(text) {
    if (!text) return text;
    var SKIP_PREFIXES = /^\s*(제목|부제목|부서|대제목|소제목|표)\s*[:：]/;
    return text.split('\n').map(function (line) {
      if (!line.trim()) return line;
      if (SKIP_PREFIXES.test(line)) return line;
      if (line.indexOf('|') !== -1) return line;     // 표 행
      if (/^\s*※/.test(line)) return line;            // 주석
      if (/^◦\s/.test(line)) return line;             // 이미 ◦
      if (/^\s{2,}-\s/.test(line)) return line;       // 이미 수준2
      // 다른 불릿 기호 (선택적 앞 공백) → 수준2 "  - "
      var m = line.match(/^\s*[*•·▪]\s+(.*)$/);
      if (m) return '  - ' + m[1];
      // 들여쓰기 2칸 이상 + 평문 → 수준2
      m = line.match(/^\s{2,}(\S.*)$/);
      if (m) return '  - ' + m[1];
      // 그 외 평문 → 수준1 "◦ "
      return '◦ ' + line.trim();
    }).join('\n');
  }

  // 직접 작성 섹션의 본문을 최종 마크다운의 해당 대제목 아래에 주입.
  // 사용자가 textarea에서 이미 채워넣은 섹션은 건드리지 않음 (textarea 우선).
  var SECTION_HEADER_RE = /^\s*(대제목|붙임)\s*[:：]\s*(.+?)\s*$/;

  function injectManualSectionBodies(md) {
    var manualWithBody = sections.filter(function (s) {
      return s.included && s.mode === 'manual' && s.body && s.body.trim() && s.name && s.name.trim();
    });
    if (!manualWithBody.length) return md;
    // key: "대제목:이름" or "붙임:이름"
    var byKey = {};
    manualWithBody.forEach(function (s) {
      var tag = s.type === 'attachment' ? '붙임' : '대제목';
      byKey[tag + ':' + s.name.trim()] = normalizeManualBody(s.body).trim();
    });

    var lines = md.split('\n');
    var out = [];
    var i = 0;
    while (i < lines.length) {
      out.push(lines[i]);
      var m = lines[i].match(SECTION_HEADER_RE);
      if (m) {
        var key = m[1] + ':' + m[2];
        if (byKey.hasOwnProperty(key)) {
          var j = i + 1;
          var hasContent = false;
          while (j < lines.length && !SECTION_HEADER_RE.test(lines[j])) {
            if (lines[j].trim()) hasContent = true;
            j++;
          }
          if (!hasContent) {
            byKey[key].split('\n').forEach(function (l) { out.push(l); });
            out.push('');
            i = j;
            continue;
          }
        }
      }
      i++;
    }
    return out.join('\n');
  }

  function openSectionsModal() {
    var modal = container.querySelector('#hwpf-sections-modal');
    modal.style.display = 'flex';
    renderSectionsList();
  }
  function closeSectionsModal() {
    container.querySelector('#hwpf-sections-modal').style.display = 'none';
  }

  function normalizeBullets(md) {
    // 표(`표:` 다음 빈 줄까지)는 건드리지 않음 — `|` 포함 행은 제외
    return md.split('\n').map(function (line) {
      if (line.indexOf('|') !== -1) return line;
      // 줄 첫머리 * / • / · / ▪ (선택적 들여쓰기 포함) → "  - "
      return line.replace(/^(\s*)[*•·▪]\s+/, '  - ');
    }).join('\n');
  }

  function normalizeSchoolName(md, school) {
    if (!school) return md;
    // 사용자가 짧게 입력했는데 GPT가 흔한 접미사를 덧붙여 확장한 경우 원상복구.
    // 단, 사용자가 이미 풀네임을 적었으면 이 regex는 매치되지 않음.
    // 긴 접미사부터 (정규식 alternation은 좌→우 우선). "충주상업고" → "충주상업고등학교" 같은 확장만 잡고,
    // "충주" → "충주청소년…" 같은 우연한 매칭은 피하기 위해 보수적으로.
    var suffixes = ['등학교', '교육지원청', '교육청'];
    // school 자체가 이미 그 접미사로 끝나면 패턴 적용 안 함 (예: "충주상업고등학교"는 굳이 건드릴 필요 없음)
    var safeSuffixes = suffixes.filter(function (s) { return school.slice(-s.length) !== s; });
    if (!safeSuffixes.length) return md;
    var pattern = new RegExp(escapeRegex(school) + '(' + safeSuffixes.join('|') + ')', 'g');
    return md.replace(pattern, school);
  }

  function buildMdWithSchool() {
    var school = schoolEl.value.trim();
    var md = ta.value.trim();
    md = normalizeBullets(md);
    md = injectManualSectionBodies(md);
    if (!school) return md;
    md = normalizeSchoolName(md, school);
    // 기존 부서: 줄이 있으면 학교명으로 교체
    if (/^\s*(기관|학교|기관명|학교명|소속|부서)\s*[:：]/m.test(md)) {
      return md.replace(/^(\s*(기관|학교|기관명|학교명|소속|부서)\s*[:：]).*/m, '$1 ' + school);
    }
    // 없으면 제목: 줄 바로 다음에 삽입
    var lines = md.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*제목\s*[:：]/.test(lines[i])) {
        lines.splice(i + 1, 0, '부서: ' + school);
        return lines.join('\n');
      }
    }
    return '부서: ' + school + '\n' + md;
  }

  function updateCount() { mdCount.textContent = ta.value.length.toLocaleString(); }
  updateCount();

  ta.addEventListener('input', function () {
    updateCount();
    api.setSetting('hwp_md_draft', ta.value);
  });
  topicEl.addEventListener('input', function () { api.setSetting('hwp_topic', topicEl.value); });
  typeEl.addEventListener('change', function () { api.setSetting('hwp_doctype', typeEl.value); });
  schoolEl.addEventListener('input', function () { api.setSetting('hwp_school', schoolEl.value); });

  // 로고 파일 선택
  container.querySelector('#hwpf-logo-pick').addEventListener('click', async function () {
    var res = await window.api.showOpenDialog({
      title: '학교 로고 이미지 선택',
      filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
      properties: ['openFile']
    });
    if (!res || res.canceled || !res.filePaths || !res.filePaths[0]) return;
    currentLogoPath = res.filePaths[0];
    var fname = currentLogoPath.split(/[\\/]/).pop();
    logoNameEl.textContent = fname;
    logoClearBtn.style.display = 'inline-block';
    api.setSetting('hwp_logo_path', currentLogoPath);
  });

  // 로고 초기화
  logoClearBtn.addEventListener('click', function () {
    currentLogoPath = '';
    logoNameEl.textContent = '선택된 로고 없음 (없으면 기관명만 표시)';
    logoClearBtn.style.display = 'none';
    api.setSetting('hwp_logo_path', '');
  });

  // AI 사이트 바로가기 (외부 브라우저로 열기)
  container.querySelectorAll('.hwpf-open-ai').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-url');
      if (url && window.api && window.api.openUrl) window.api.openUrl(url);
    });
  });

  // 섹션 구성 모달
  container.querySelector('#hwpf-sections-edit').addEventListener('click', openSectionsModal);
  container.querySelector('#hwpf-sections-close').addEventListener('click', closeSectionsModal);
  container.querySelector('#hwpf-sections-apply').addEventListener('click', function () {
    // 빈 이름 정리
    sections = sections.filter(function (s) { return s.name && s.name.trim(); });
    sections.forEach(function (s) {
      s.name = s.name.trim();
      // 직접 작성 본문은 마크다운 규칙에 맞게 자동 정규화
      if (s.mode === 'manual' && s.body) s.body = normalizeManualBody(s.body);
    });
    if (!sections.length) { sections = defaultSections(); }
    updateSectionsSummary();
    closeSectionsModal();
  });
  container.querySelector('#hwpf-sections-add').addEventListener('click', function () {
    sections.push({ name: '새 섹션', type: 'heading', mode: 'ai', included: true, body: '' });
    renderSectionsList();
  });
  container.querySelector('#hwpf-sections-add-attach').addEventListener('click', function () {
    sections.push({ name: '붙임 자료', type: 'attachment', mode: 'ai', included: true, body: '' });
    renderSectionsList();
  });
  container.querySelector('#hwpf-sections-reset').addEventListener('click', function () {
    if (confirm('섹션 구성을 현재 양식의 기본값으로 되돌릴까요?')) {
      sections = defaultSections(typeEl.value);
      renderSectionsList();
    }
  });

  // 양식 변경 시 섹션 자동 프리셋
  typeEl.addEventListener('change', function () {
    api.setSetting('hwp_doctype', typeEl.value);
    sections = defaultSections(typeEl.value);
    updateSectionsSummary();
    // 모달이 열려있으면 목록도 갱신
    var modal = container.querySelector('#hwpf-sections-modal');
    if (modal && modal.style.display !== 'none') renderSectionsList();
  });
  container.querySelector('#hwpf-sections-modal').addEventListener('click', function (e) {
    if (e.target.id === 'hwpf-sections-modal') closeSectionsModal();
  });
  updateSectionsSummary();

  // 프롬프트 복사
  container.querySelector('#hwpf-copy-prompt').addEventListener('click', async function () {
    var includedSections = sections.filter(function (s) { return s.included && s.name.trim(); });
    if (!includedSections.length) {
      statusEl.textContent = '⚠ 포함된 섹션이 없습니다. ⚙️ 섹션 구성에서 추가하세요.';
      statusEl.style.color = '#dc2626';
      return;
    }
    var r = await window.api.hwpBuildPrompt({
      topic: topicEl.value.trim(),
      docType: typeEl.value,
      school: schoolEl.value.trim(),
      sections: includedSections.map(function (s) { return { name: s.name, mode: s.mode, type: s.type || 'heading' }; })
    });
    if (r && r.ok) {
      try {
        await navigator.clipboard.writeText(r.prompt);
        statusEl.textContent = '✓ 복사됨! GPT/Claude에 붙여넣으세요';
        statusEl.style.color = '#059669';
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
      } catch (e) {
        statusEl.textContent = '복사 실패: ' + e.message;
        statusEl.style.color = '#dc2626';
      }
    }
  });

  // 로컬 AI 생성
  container.querySelector('#hwpf-ai-gen').addEventListener('click', async function () {
    var topic = topicEl.value.trim();
    if (!topic) {
      statusEl.textContent = '⚠ 주제를 먼저 입력하세요';
      statusEl.style.color = '#dc2626';
      return;
    }
    var btn = container.querySelector('#hwpf-ai-gen');
    btn.disabled = true;
    statusEl.textContent = '🤖 로컬 AI 생성 중... (수십 초 걸릴 수 있음)';
    statusEl.style.color = 'var(--accent)';

    try {
      var r = await window.api.hwpGenerateMarkdown({ topic: topic, docType: typeEl.value });
      if (r && r.ok && r.markdown) {
        ta.value = r.markdown;
        updateCount();
        api.setSetting('hwp_md_draft', r.markdown);
        statusEl.textContent = '✓ 생성 완료 (' + (r.model || '') + ')';
        statusEl.style.color = '#059669';
      } else {
        statusEl.textContent = '❌ ' + (r.error || '생성 실패');
        statusEl.style.color = '#dc2626';
      }
    } catch (e) {
      statusEl.textContent = '❌ ' + String(e);
      statusEl.style.color = '#dc2626';
    } finally {
      btn.disabled = false;
    }
  });

  function showResult(result) {
    resultDiv.style.display = 'block';
    if (result && result.ok) {
      statusText.textContent = '서식 적용 완료!';
      var detail = result.savedTo
        ? '저장: ' + escapeHtml(result.savedTo)
        : (result.blocks ? result.blocks + '개 단락/표 처리됨' : '');
      resultDiv.innerHTML = `
        <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;font-size:13px;color:#065f46">
          <b>✅ 완료!</b>${detail ? '<br><span style="font-size:11px">' + detail + '</span>' : ''}
        </div>`;
    } else if (result && result.canceled) {
      resultDiv.style.display = 'none';
    } else {
      var errMsg = (result && result.error) ? result.error : '알 수 없는 오류';
      statusText.textContent = '오류 발생';
      resultDiv.innerHTML = `
        <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:14px;font-size:13px;color:#991b1b">
          <b>❌ 오류</b><br>${escapeHtml(errMsg)}
        </div>`;
    }
  }

  // 깔끔 템플릿 hwpx 빌드 (한글 불필요)
  container.querySelector('#hwpf-build-hwpx').addEventListener('click', async function () {
    var md = buildMdWithSchool();
    if (!md) { alert('마크다운을 작성해주세요.'); return; }
    var btn = container.querySelector('#hwpf-build-hwpx');
    btn.disabled = true; spinner.style.display = 'block'; resultDiv.style.display = 'none';
    statusText.textContent = '템플릿으로 hwpx 생성 중...';
    try {
      var r = await window.api.hwpBuildHwpx({ markdownText: md, logoPath: currentLogoPath || '' });
      showResult(r);
      // 저장 성공 시 기본 프로그램(한글 등)으로 파일 자동 열기
      if (r && r.ok && r.savedTo && window.api && window.api.openPath) {
        try { await window.api.openPath(r.savedTo); } catch (_) {}
      }
    } catch (e) {
      showResult({ ok: false, error: String(e) });
    } finally {
      btn.disabled = false; spinner.style.display = 'none';
    }
  });

}

function init() {}

window.registerPage('hwp_formatter', { render: render, init: init });
})();
