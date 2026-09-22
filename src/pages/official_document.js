(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || "";
  }

  async function render(container) {
    var rules = window.OfficialDocumentRules;
    var options = (rules ? rules.DOCUMENT_TYPES : ["협조요청", "통보", "회신", "보고", "알림", "기타"])
      .map(function (type) { return '<option value="' + escapeHtml(type) + '">' + escapeHtml(type) + '</option>'; })
      .join("");

    container.innerHTML = [
      '<div id="official-doc-page" class="official-doc-page">',
      '  <section class="official-doc-hero">',
      '    <div>',
      '      <div class="official-doc-eyebrow">행정 공문 작성 보조</div>',
      '      <h2>두문·본문·결문 흐름에 맞춘 공문 초안 생성</h2>',
      '      <p>외부 API 없이 PDF 작성법 기준을 로컬에서 적용합니다. 빈 항목은 임의로 채우지 않고 바로 알려줍니다.</p>',
      '    </div>',
      '    <div class="official-doc-rule-card">',
      '      <b>자동 적용</b>',
      '      <span>제목·내용 기반 문장 기획, 붙임, 끝., 날짜·금액 표기, 표현 점검</span>',
      '    </div>',
      '  </section>',
      '',
      '  <div class="official-doc-tabs">',
      '    <button class="official-doc-tab active" data-tab="draft">공문 생성</button>',
      '    <button class="official-doc-tab" data-tab="review">검토 모드</button>',
      '    <button class="official-doc-tab" data-tab="sv">🚨 학교폭력 공문</button>',
      '    <button class="official-doc-tab" data-tab="poom">📝 품의서 작성</button>',
      '  </div>',
      '',
      '  <section id="official-draft-panel" class="official-doc-panel active">',
      '    <div class="official-doc-grid">',
      '      <div class="card official-doc-form">',
      '        <div class="official-doc-form-head">',
      '          <h3>입력 항목</h3>',
      '          <span>내용만 넣어도 제목과 본문 문장을 함께 기획합니다.</span>',
      '        </div>',
      '        <label>문서 유형<select id="od-document-type">' + options + '</select></label>',
      '        <label>제목 <small>선택, 비워두면 자동 생성</small><input id="od-title" placeholder="예: 2026학년도 1학기 생활위원회 결과 보고"></label>',
      '        <div class="official-doc-related-row">',
      '          <label>관련 공문 <small>선택</small><textarea id="od-basis" rows="3" placeholder="예: ○○교육청 진로교육과-1234"></textarea></label>',
      '          <label>시행날짜 <small>선택</small><input id="od-basis-date" type="date"></label>',
      '        </div>',
      '        <label>본문 핵심 내용<textarea id="od-body" rows="6" placeholder="짧게 써도 됩니다. 예: 2026학년도 1학기 생활위원회 결과 보고"></textarea></label>',
      '        <label>붙임 파일 목록 <small>선택, 파일을 가져오면 제목이 자동 입력됩니다</small>',
      '          <div class="official-doc-attach-upload">',
      '            <button type="button" id="od-attach-pick-btn" class="btn btn-secondary btn-sm">📎 파일 가져오기</button>',
      '            <input type="file" id="od-attachments-input" multiple accept="image/*,.pdf,.xlsx,.xls,.csv,.doc,.docx,.hwp,.hwpx" style="display:none">',
      '          </div>',
      '          <textarea id="od-attachments" rows="3" placeholder="예: 운영 계획서&#10;예: 참가 신청서"></textarea>',
      '        </label>',
      '        <div id="od-missing" class="official-doc-alert" style="display:none"></div>',
      '        <div class="official-doc-btn-row">',
      '          <button id="od-generate-btn" class="btn btn-secondary official-doc-main-btn">규칙 기반 생성</button>',
      '          <button id="od-ai-generate-btn" class="btn btn-primary official-doc-main-btn">✨ AI로 생성</button>',
      '        </div>',
      '      </div>',
      '      <div class="card official-doc-output-card">',
      '        <div class="official-doc-output-head">',
      '          <h3>제목</h3>',
      '          <button id="od-copy-title-btn" class="btn btn-secondary btn-sm">제목 복사</button>',
      '        </div>',
      '        <pre id="od-title-output" class="official-doc-output" style="min-height:auto">왼쪽 항목을 입력한 뒤 [공문 초안 생성]을 누르세요.</pre>',
      '        <div class="official-doc-output-head" style="margin-top:12px">',
      '          <h3>본문</h3>',
      '          <button id="od-copy-body-btn" class="btn btn-secondary btn-sm">본문 복사</button>',
      '        </div>',
      '        <pre id="od-body-output" class="official-doc-output"></pre>',
      '      </div>',
      '    </div>',
      '  </section>',
      '',
      '  <section id="official-review-panel" class="official-doc-panel">',
      '    <div class="official-doc-grid">',
      '      <div class="card official-doc-form">',
      '        <h3>작성한 공문 검토</h3>',
      '        <label>공문 내용<textarea id="od-review-input" rows="16" placeholder="이미 작성한 공문을 여기에 붙여넣으세요."></textarea></label>',
      '        <button id="od-review-btn" class="btn btn-primary official-doc-main-btn">형식·표현 검토</button>',
      '      </div>',
      '      <div class="card official-doc-output-card">',
      '        <div class="official-doc-output-head">',
      '          <h3>검토 결과</h3>',
      '          <button id="od-copy-review-btn" class="btn btn-secondary btn-sm">수정안 복사</button>',
      '        </div>',
      '        <div id="od-review-findings" class="official-doc-findings">검토할 공문을 입력해 주세요.</div>',
      '        <pre id="od-review-output" class="official-doc-output official-doc-review-output"></pre>',
      '      </div>',
      '    </div>',
      '  </section>',
      '',
      '  <section id="official-sv-panel" class="official-doc-panel">',
      '    <div class="official-doc-grid">',
      '      <div class="card official-doc-form">',
      '        <div class="official-doc-form-head">',
      '          <h3>학교폭력 공문 자동완성</h3>',
      '          <span>공문 번호를 선택하면 해당 양식이 자동으로 채워집니다.</span>',
      '        </div>',
      '        <details class="sv-settings-box">',
      '          <summary>학교 기본 정보 설정 (한 번만 입력하면 계속 재사용됩니다)</summary>',
      '          <label>학교명',
      '            <input id="sv-school-name-input" placeholder="예: 한국고등학교">',
      '          </label>',
      '          <label>전담기구 위원 명단',
      '            <div class="sv-committee-add-row">',
      '              <select id="sv-committee-role-select">',
      '                <option value="교장">교장</option>',
      '                <option value="교감">교감</option>',
      '                <option value="책임교사">책임교사</option>',
      '                <option value="보건교사">보건교사</option>',
      '                <option value="전문상담교사">전문상담교사</option>',
      '                <option value="학부모위원">학부모위원</option>',
      '                <option value="학교전담경찰관">학교전담경찰관</option>',
      '                <option value="__custom">직접 입력</option>',
      '              </select>',
      '              <input id="sv-committee-role-custom" placeholder="역할 직접 입력" hidden>',
      '              <input id="sv-committee-name-input" placeholder="이름">',
      '              <button type="button" id="sv-committee-add-btn" class="btn btn-secondary btn-sm">+ 추가</button>',
      '            </div>',
      '            <div id="sv-committee-list" class="sv-committee-list"></div>',
      '          </label>',
      '        </details>',
      '        <label>공문 선택',
      '          <select id="sv-doc-select">',
      '            <option value="">-- 공문을 선택하세요 --</option>',
      '          </select>',
      '        </label>',
      '        <div id="sv-doc-desc" class="official-doc-sv-desc"></div>',
      '        <div id="sv-doc-fields"></div>',
      '        <div class="official-doc-btn-row" style="margin-top:12px">',
      '          <button id="sv-generate-btn" class="btn btn-primary official-doc-main-btn">공문 생성</button>',
      '          <button id="sv-clear-btn" class="btn btn-secondary official-doc-main-btn">초기화</button>',
      '        </div>',
      '      </div>',
      '      <div class="card official-doc-output-card">',
      '        <div class="official-doc-output-head">',
      '          <h3>제목</h3>',
      '          <button id="sv-copy-title-btn" class="btn btn-secondary btn-sm">제목 복사</button>',
      '        </div>',
      '        <pre id="sv-doc-title-output" class="official-doc-output" style="min-height:auto">왼쪽에서 공문을 선택하고 항목을 입력한 뒤 [공문 생성]을 누르세요.</pre>',
      '        <div class="official-doc-output-head" style="margin-top:12px">',
      '          <h3>본문</h3>',
      '          <button id="sv-copy-body-btn" class="btn btn-secondary btn-sm">본문 복사</button>',
      '        </div>',
      '        <div id="sv-doc-body-output" class="official-doc-output"></div>',
      '      </div>',
      '    </div>',
      '  </section>',
      '',
      '  <section id="official-poom-panel" class="official-doc-panel">',
      '    <div class="official-doc-grid">',
      '      <div class="card official-doc-form">',
      '        <div class="official-doc-form-head">',
      '          <h3>품의서 작성</h3>',
      '          <span>항목을 입력하면 제목·개요·품목내역을 에듀파인에 붙여넣을 형식으로 작성합니다.</span>',
      '        </div>',
      '        <label>품의 유형<select id="poom-type"><option value="물품">물품 구입</option><option value="지출">지출</option><option value="수당">수당 지급</option><option value="업무추진비">업무추진비</option></select></label>',
      '        <div style="display:grid;grid-template-columns:100px 1fr;gap:8px">',
      '          <label>회계연도<input id="poom-year" type="number" value="2026" min="2020" max="2040"></label>',
      '          <label>제목<input id="poom-title"></label>',
      '        </div>',
      '        <div class="toggle-row" style="padding:8px 0;margin-bottom:4px">',
      '          <span class="toggle-label" style="font-size:12px;font-weight:500">학교교육과정운영계획</span>',
      '          <label class="toggle-switch"><input type="checkbox" id="poom-plan-edu"><span class="toggle-track"></span></label>',
      '        </div>',
      '        <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">',
      '          <label>관련 계획명 <small>선택</small><input id="poom-plan"></label>',
      '          <label>계획 날짜 <small>선택</small><input id="poom-plan-date" type="date"></label>',
      '        </div>',
      '        <div>',
      '          <div style="font-size:12px;font-weight:600;color:var(--fg-2);margin-bottom:5px">개요 항목 <small style="font-weight:400;color:var(--fg-3)">체크로 포함/제외 · 드래그로 순서 변경</small></div>',
      '          <div id="poom-gaeyo-list"></div>',
      '        </div>',
      '        <div style="margin-top:4px">',
      '          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">',
      '            <div style="font-size:12px;font-weight:600;color:var(--fg-2)">품목 내역</div>',
      '            <button id="poom-add-row" class="btn btn-secondary btn-sm" type="button">+ 직접 추가</button>',
      '          </div>',
      '          <div id="poom-upload-area" style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer;margin-bottom:8px;transition:border-color 0.15s">',
      '            <input id="poom-file-input" type="file" accept="image/*,.pdf,.xlsx,.xls,.csv" style="display:none">',
      '            <div style="font-size:13px;color:var(--fg-2);margin-bottom:4px">📎 견적서 파일을 여기에 드래그하거나 클릭하세요</div>',
      '            <div style="font-size:11px;color:var(--fg-3)">이미지(JPG·PNG), PDF, 엑셀(xlsx·xls), CSV 지원</div>',
      '            <div id="poom-upload-status" style="margin-top:8px;font-size:12px;color:var(--accent);display:none"></div>',
      '          </div>',
      '          <div style="display:grid;grid-template-columns:2fr 1fr 52px 1fr 90px 30px;gap:4px;margin-bottom:4px;padding:0 2px;font-size:11px;color:var(--fg-3)">',
      '            <span>품목명</span><span>규격</span><span>수량</span><span>단가(원)</span><span>금액</span><span></span>',
      '          </div>',
      '          <div id="poom-rows"></div>',
      '          <div style="text-align:right;margin-top:6px;font-size:13px;color:var(--fg-2)">합계: <strong id="poom-total-display" style="color:var(--accent)">0</strong>원</div>',
      '        </div>',
      '        <div style="margin-top:8px">',
      '          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">',
      '            <div style="font-size:12px;font-weight:600;color:var(--fg-2)">붙임 <small style="font-weight:400;color:var(--fg-3)">칸마다 하나씩</small></div>',
      '            <button id="poom-attach-add" class="btn btn-secondary btn-sm" type="button">+ 붙임 추가</button>',
      '          </div>',
      '          <div id="poom-attach-rows"></div>',
      '        </div>',
      '        <div class="official-doc-btn-row" style="margin-top:12px">',
      '          <button id="poom-gen-btn" class="btn btn-primary official-doc-main-btn" type="button">개요 생성</button>',
      '          <button id="poom-clear-btn" class="btn btn-secondary official-doc-main-btn" type="button">초기화</button>',
      '        </div>',
      '        <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px">',
      '          <div style="font-size:12px;font-weight:600;color:var(--fg-2);margin-bottom:4px">🤖 에듀파인 자동입력</div>',
      '          <div id="macro-cdp-status" style="font-size:11px;color:var(--fg-3);margin-bottom:8px;min-height:16px">에듀파인 연결 상태를 확인하세요.</div>',
      '          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px">',
      '            <button id="macro-shortcut-btn" class="btn btn-secondary btn-sm" type="button">🔗 바로가기 만들기</button>',
      '            <button id="macro-launch-btn"   class="btn btn-secondary btn-sm" type="button">🌐 바로가기로 열기</button>',
      '            <button id="macro-check-btn"    class="btn btn-secondary btn-sm" type="button">🔍 연결 확인</button>',
      '            <button id="macro-diag-btn"     class="btn btn-secondary btn-sm" type="button">🔬 페이지 진단</button>',
      '          </div>',
      '          <div style="display:flex;gap:6px;flex-wrap:wrap">',
      '            <button id="macro-start-btn"  class="btn btn-primary btn-sm"   type="button" disabled>▶ 자동입력 시작</button>',
      '            <button id="macro-stop-btn"   class="btn btn-secondary btn-sm" type="button" style="display:none">⏹ 중지</button>',
      '          </div>',
      '        </div>',
      '      </div>',
      '      <div class="card official-doc-output-card" style="display:flex;flex-direction:column;gap:10px">',
      '        <div>',
      '          <div class="official-doc-output-head"><h3>제목</h3><button id="poom-copy-title" class="btn btn-secondary btn-sm" type="button">복사</button></div>',
      '          <pre id="poom-out-title" class="official-doc-output" style="min-height:42px;white-space:pre-wrap"></pre>',
      '        </div>',
      '        <div>',
      '          <div class="official-doc-output-head"><h3>개요</h3><button id="poom-copy-gaeyo" class="btn btn-secondary btn-sm" type="button">복사</button></div>',
      '          <pre id="poom-out-gaeyo" class="official-doc-output" style="min-height:80px;white-space:pre-wrap"></pre>',
      '        </div>',
      '        <div id="poom-out-items-wrap">',
      '          <div class="official-doc-output-head"><h3>품목내역</h3><button id="poom-copy-items" class="btn btn-secondary btn-sm" type="button">복사</button></div>',
      '          <pre id="poom-out-items" class="official-doc-output" style="min-height:60px;white-space:pre;font-size:12px"></pre>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </section>',
      '',
      '</div>'
    ].join("");
  }

  function collectDraftInput() {
    return {
      documentType: getValue("od-document-type"),
      title: getValue("od-title"),
      basis: getValue("od-basis"),
      basisDate: getValue("od-basis-date"),
      body: getValue("od-body"),
      attachments: getValue("od-attachments")
    };
  }

  function showMissing(missing) {
    var box = document.getElementById("od-missing");
    if (!box) return;
    if (!missing.length) {
      box.style.display = "none";
      box.textContent = "";
      return;
    }
    box.style.display = "block";
    box.textContent = "아직 필요한 항목: " + missing.join(", ");
  }

  // 리치 텍스트(HTML)로 붙여넣을 때 브라우저/워드프로세서가 연속 공백을 한 칸으로
  // 접어버리는 문제를 막기 위해, 각 줄의 선행 공백과 연속 공백을 &nbsp;로 치환한다.
  function preserveSpacesForHtml(escapedText) {
    return escapedText
      .split("\n")
      .map(function (line) {
        var lead = line.match(/^ +/);
        var leadLen = lead ? lead[0].length : 0;
        var rest = leadLen ? line.slice(leadLen) : line;
        rest = rest.replace(/ {2,}/g, function (match) {
          return "&nbsp;".repeat(match.length - 1) + " ";
        });
        return "&nbsp;".repeat(leadLen) + rest;
      })
      .join("<br>");
  }

  function writeRichClipboard(text, htmlInner) {
    if (!text) return;
    var inner = htmlInner != null ? htmlInner : preserveSpacesForHtml(escapeHtml(text));
    var html = '<div style="font-family:\'돋움\',Dotum,sans-serif;font-size:12pt;">' + inner + "</div>";
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        var item = new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" })
        });
        navigator.clipboard.write([item]).catch(function () {
          if (navigator.clipboard.writeText) navigator.clipboard.writeText(text);
        });
        return;
      } catch (e) {
        // fall through to plain-text copy
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  }

  function copyTextFrom(id) {
    var text = document.getElementById(id) ? document.getElementById(id).textContent : "";
    writeRichClipboard(text);
  }

  // sv 공문 서식은 앞(수신 기관 등)·뒤(협조자/시행/전화번호 등) 정형 문구를 뺀
  // "제목" 줄부터 "끝." 줄까지의 본문만 붙여넣기에 필요하다.
  function extractSvDocBody(text) {
    var lines = text.split("\n");
    var startIdx = -1;
    var endIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (startIdx === -1 && /^제목\s/.test(lines[i])) startIdx = i;
      if (lines[i].indexOf("끝.") !== -1) endIdx = i;
    }
    if (startIdx === -1) return text;
    if (endIdx === -1 || endIdx < startIdx) endIdx = lines.length - 1;
    return lines.slice(startIdx, endIdx + 1).join("\n");
  }

  // 항목(1., 2. ...) 사이의 빈 줄은 제거하고, "붙임" 앞의 빈 줄만 유지한다.
  function compactSvLines(lines) {
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim() === "") {
        var j = i + 1;
        while (j < lines.length && lines[j].trim() === "") j++;
        var nextLine = j < lines.length ? lines[j] : "";
        if (/^붙임/.test(nextLine.trim()) && out.length && out[out.length - 1].trim() !== "") {
          out.push("");
        }
        i = j - 1;
        continue;
      }
      out.push(line);
    }
    return out;
  }

  // 본문을 "제목" 줄과 그 아래 나머지(1. 관련~끝.)로 분리한다.
  function splitSvDoc(text) {
    var body = extractSvDocBody(text);
    var lines = compactSvLines(body.split("\n"));
    var titleLine = lines[0] || "";
    var title = titleLine.replace(/^제목\s*/, "");
    var rest = lines.slice(1).join("\n").replace(/^\n+/, "");
    return { title: title, rest: rest };
  }

  // PDF 서식의 표를 그대로 옮기기 위한 표 데이터 형식:
  //  - { rows: [[라벨, 값], ...] } : 라벨·값 2단 표 (첫 칸은 라벨처럼 음영 표시)
  //  - { headers: [...], rows: [[셀, 셀, ...], ...] } : 순번·학교명 등 여러 열을 가진 실제 표(헤더 행 포함)
  function buildSvTableHtml(table) {
    var hasHeaders = table.headers && table.headers.length;
    var headHtml = hasHeaders
      ? "<tr>" + table.headers.map(function (h) {
          return '<th class="sv-table-th">' + escapeHtml(h).replace(/\n/g, "<br>") + "</th>";
        }).join("") + "</tr>"
      : "";
    var bodyHtml = table.rows.map(function (row) {
      return "<tr>" + row.map(function (cell, i) {
        var cls = hasHeaders ? "sv-table-cell" : (i === 0 ? "sv-table-label" : "sv-table-value");
        return '<td class="' + cls + '">' + escapeHtml(cell == null ? "" : String(cell)).replace(/\n/g, "<br>") + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<table class="sv-fact-table">' + headHtml + bodyHtml + "</table>";
  }

  function buildSvTablePlain(table) {
    var lines = [];
    if (table.headers && table.headers.length) lines.push(table.headers.join("\t"));
    table.rows.forEach(function (row) {
      lines.push(row.map(function (cell) { return (cell == null ? "" : String(cell)).replace(/\n/g, " "); }).join("\t"));
    });
    return lines.join("\n");
  }

  // "{{TABLE}}" 표시가 있으면 실제 표(html)/탭 구분 표(plain)로 바꿔 렌더링·복사용 결과를 만든다.
  function renderSvBody(rawBody, table) {
    if (!table) {
      return { html: preserveSpacesForHtml(escapeHtml(rawBody)), plain: rawBody };
    }
    var parts = rawBody.split("{{TABLE}}");
    var before = parts[0] || "";
    var after = parts[1] || "";
    return {
      html: preserveSpacesForHtml(escapeHtml(before)) + buildSvTableHtml(table) + preserveSpacesForHtml(escapeHtml(after)),
      plain: before + buildSvTablePlain(table) + after
    };
  }

  function switchTab(tab) {
    document.querySelectorAll(".official-doc-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    var draft = document.getElementById("official-draft-panel");
    var review = document.getElementById("official-review-panel");
    var sv = document.getElementById("official-sv-panel");
    var poom = document.getElementById("official-poom-panel");
    if (draft) draft.classList.toggle("active", tab === "draft");
    if (review) review.classList.toggle("active", tab === "review");
    if (sv) sv.classList.toggle("active", tab === "sv");
    if (poom) poom.classList.toggle("active", tab === "poom");
  }

  function renderReviewFindings(findings) {
    var wrap = document.getElementById("od-review-findings");
    if (!wrap) return;
    if (!findings.length) {
      wrap.innerHTML = '<div class="official-doc-good">큰 형식 오류를 찾지 못했습니다. 그래도 최종 결재 전 기관 내부 기준은 한 번 더 확인해 주세요.</div>';
      return;
    }
    wrap.innerHTML = findings.map(function (item) {
      var examples = item.examples && item.examples.length ? " 발견 예: " + item.examples.join(", ") : "";
      return '<div class="official-doc-finding"><b>' + escapeHtml(item.type) + '</b><span>' + escapeHtml(item.message + examples) + '</span></div>';
    }).join("");
  }

  // 상태/오류 메시지는 제목 칸에, 본문 칸은 비워서 표시한다.
  function setDraftStatus(msg) {
    setText("od-title-output", msg);
    setText("od-body-output", "");
  }

  // "제목" 줄부터 "끝."까지만 뽑아 제목/본문으로 나누고, 항목 사이 불필요한 빈 줄을 정리해 표시한다.
  function setDraftResult(text) {
    var parts = splitSvDoc(text);
    setText("od-title-output", parts.title);
    setText("od-body-output", parts.rest);
  }

  function init() {
    var rules = window.OfficialDocumentRules;
    if (!rules) {
      setDraftStatus("공문 작성 규칙 모듈을 불러오지 못했습니다.");
      return;
    }

    document.querySelectorAll(".official-doc-tab").forEach(function (btn) {
      btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
    });

    var odAttachPickBtn = document.getElementById("od-attach-pick-btn");
    var odAttachInput = document.getElementById("od-attachments-input");
    if (odAttachPickBtn && odAttachInput) {
      odAttachPickBtn.addEventListener("click", function () { odAttachInput.click(); });
      odAttachInput.addEventListener("change", function () {
        var textarea = document.getElementById("od-attachments");
        if (!textarea) return;
        var existingLines = textarea.value.split("\n").map(function (v) { return v.trim(); }).filter(Boolean);
        Array.prototype.forEach.call(odAttachInput.files, function (file) {
          var base = String(file.name || "").replace(/\.[^.\/\\]+$/, "").trim();
          if (base && existingLines.indexOf(base) === -1) {
            existingLines.push(base);
          }
        });
        textarea.value = existingLines.join("\n");
        odAttachInput.value = "";
      });
    }

    var generateBtn = document.getElementById("od-generate-btn");
    if (generateBtn) {
      generateBtn.addEventListener("click", function () {
        var input = collectDraftInput();
        var missing = rules.validateDraftInput(input);
        showMissing(missing);
        if (missing.length) {
          setDraftStatus("필수 항목을 먼저 채워 주세요. 공문 내용은 임의로 만들지 않습니다.");
          return;
        }
        setDraftResult(rules.buildDraft(input));
      });
    }

    var reviewBtn = document.getElementById("od-review-btn");
    if (reviewBtn) {
      reviewBtn.addEventListener("click", function () {
        var result = rules.reviewDocument(getValue("od-review-input"));
        renderReviewFindings(result.findings || []);
        setText("od-review-output", result.suggestion || "");
      });
    }

    var aiBtn = document.getElementById("od-ai-generate-btn");
    if (aiBtn) {
      aiBtn.addEventListener("click", async function () {
        var input = collectDraftInput();
        var missing = rules.validateDraftInput(input);
        showMissing(missing);
        if (missing.length) {
          setDraftStatus("필수 항목을 먼저 채워 주세요. 공문 내용은 임의로 만들지 않습니다.");
          return;
        }
        var apiKey = await api.getSetting("ai_api_key", "");
        if (!apiKey) {
          setDraftStatus("설정에서 AI API 키를 입력하세요.");
          return;
        }
        var model = await api.getSetting("ai_model", "claude-sonnet-5");
        var provider = await api.getSetting("ai_provider", "claude");
        aiBtn.disabled = true;
        aiBtn.textContent = "AI 생성 중…";
        setDraftStatus("AI가 공문서 작성법 기준에 따라 공문을 작성 중입니다…");
        var inputSummary = [
          "문서 유형: " + input.documentType,
          "수신자: " + (input.recipients || "없음"),
          input.via ? "경유: " + input.via : "",
          input.senderOrg ? "발신 기관: " + input.senderOrg : "",
          input.senderTitle ? "발신명의: " + input.senderTitle : "",
          "제목: " + input.title,
          input.basis ? "관련 근거:\n" + input.basis : "",
          "본문 핵심 내용:\n" + input.body,
          input.attachments ? "붙임 파일:\n" + input.attachments : "",
          "시행일자: " + input.effectiveDate,
          input.senderDept ? "담당 부서: " + input.senderDept : "",
          input.senderName ? "담당자: " + input.senderName : ""
        ].filter(Boolean).join("\n");
        var result = await api.aiGenerateOfficialDoc(apiKey, model, provider, inputSummary);
        aiBtn.disabled = false;
        aiBtn.textContent = "✨ AI로 생성";
        if (result.error) {
          setDraftStatus("AI 오류: " + result.error);
        } else if (result.result) {
          setDraftResult(result.result);
        } else {
          setDraftStatus("결과 없음");
        }
      });
    }

    var copyTitleBtn = document.getElementById("od-copy-title-btn");
    if (copyTitleBtn) copyTitleBtn.addEventListener("click", function () { copyTextFrom("od-title-output"); });
    var copyBodyBtn = document.getElementById("od-copy-body-btn");
    if (copyBodyBtn) copyBodyBtn.addEventListener("click", function () { copyTextFrom("od-body-output"); });
    var copyReviewBtn = document.getElementById("od-copy-review-btn");
    if (copyReviewBtn) copyReviewBtn.addEventListener("click", function () { copyTextFrom("od-review-output"); });

    // SV document tab
    var SV_GROUPS = [
      { label: "교육지원청 지원 요청", ids: [1] },
      { label: "Ⅰ. 초기대응 및 접수", ids: [2, 3, 4] },
      { label: "Ⅱ. 사안조사", ids: [5, 6, 7, 8] },
      { label: "Ⅲ. 전담기구 심의", ids: [9, 10, 11, 12, 13] },
      { label: "Ⅳ. 심의위원회 개최", ids: [14, 15] },
      { label: "Ⅳ. 조치결과 이행", ids: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
      { label: "Ⅴ. 후속조치 (생활기록부 삭제)", ids: [27, 28, 29, 30, 31] },
      { label: "관계회복 숙려제도", ids: [32] }
    ];
    var svTemplates = window.SVDocumentTemplates || [];
    var svSelect = document.getElementById("sv-doc-select");

    var SV_SCHOOL_NAME_KEY = "sv_school_name";
    var SV_COMMITTEE_KEY = "sv_committee_members";
    var SV_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
    var refDocComposers = [];

    function getSchoolName() {
      try { return (localStorage.getItem(SV_SCHOOL_NAME_KEY) || "").trim(); } catch (e) { return ""; }
    }

    function getCommitteeList() {
      try {
        return (localStorage.getItem(SV_COMMITTEE_KEY) || "")
          .split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      } catch (e) { return []; }
    }

    var schoolNameInput = document.getElementById("sv-school-name-input");
    if (schoolNameInput) {
      schoolNameInput.value = getSchoolName();
      schoolNameInput.addEventListener("input", function () {
        try { localStorage.setItem(SV_SCHOOL_NAME_KEY, schoolNameInput.value); } catch (e) {}
        if (window.api && typeof window.api.setSetting === "function") {
          window.api.setSetting("school_name", schoolNameInput.value.trim());
        }
        refDocComposers.forEach(function (fn) { fn(); });
      });
    }

    // 설정(설정 > NEIS 설정)에 저장된 전역 학교 이름. 이 페이지에 아직 학교명이
    // 입력되지 않았을 때만 자동으로 채워 넣는다 (사용자가 이 페이지에서 따로
    // 입력한 값이 있으면 그 값을 우선한다).
    if (!getSchoolName() && window.api && typeof window.api.getSetting === "function") {
      window.api.getSetting("school_name", "").then(function (globalSchoolName) {
        if (globalSchoolName && !getSchoolName()) {
          try { localStorage.setItem(SV_SCHOOL_NAME_KEY, globalSchoolName); } catch (e) {}
          if (schoolNameInput) schoolNameInput.value = globalSchoolName;
          refDocComposers.forEach(function (fn) { fn(); });
        }
      });
    }

    function saveCommitteeList(list) {
      try { localStorage.setItem(SV_COMMITTEE_KEY, list.join("\n")); } catch (e) {}
    }

    function renderCommitteeList() {
      var listEl = document.getElementById("sv-committee-list");
      if (!listEl) return;
      var list = getCommitteeList();
      if (!list.length) {
        listEl.innerHTML = '<small>등록된 위원이 없습니다. 역할과 이름을 입력하고 [+ 추가]를 눌러 등록하세요.</small>';
        return;
      }
      listEl.innerHTML = list.map(function (name, i) {
        return '<span class="sv-committee-chip">' + escapeHtml(name) +
          '<button type="button" class="sv-committee-remove-btn" data-idx="' + i + '" title="삭제">×</button></span>';
      }).join("");
      listEl.querySelectorAll(".sv-committee-remove-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.getAttribute("data-idx"), 10);
          var current = getCommitteeList();
          current.splice(idx, 1);
          saveCommitteeList(current);
          renderCommitteeList();
          if (document.getElementById("sv-members-checks")) wireMembersField();
        });
      });
    }

    var committeeRoleSelect = document.getElementById("sv-committee-role-select");
    var committeeRoleCustom = document.getElementById("sv-committee-role-custom");
    var committeeNameInput = document.getElementById("sv-committee-name-input");
    var committeeAddBtn = document.getElementById("sv-committee-add-btn");
    if (committeeRoleSelect) {
      committeeRoleSelect.addEventListener("change", function () {
        committeeRoleCustom.hidden = committeeRoleSelect.value !== "__custom";
        if (!committeeRoleCustom.hidden) committeeRoleCustom.focus();
      });
    }
    if (committeeAddBtn) {
      committeeAddBtn.addEventListener("click", function () {
        var role = committeeRoleSelect.value === "__custom" ? committeeRoleCustom.value.trim() : committeeRoleSelect.value;
        var name = committeeNameInput.value.trim();
        if (!role || !name) return;
        var current = getCommitteeList();
        current.push(role + " " + name);
        saveCommitteeList(current);
        committeeNameInput.value = "";
        committeeNameInput.focus();
        renderCommitteeList();
        if (document.getElementById("sv-members-checks")) wireMembersField();
      });
    }
    if (committeeNameInput) {
      committeeNameInput.addEventListener("keydown", function (e) {
        // 한글 입력(IME) 조합 중 Enter는 무시 — 그렇지 않으면 조합 확정 Enter와
        // 실제 Enter가 연속으로 들어와 같은 이름이 두 번(마지막 글자만) 추가된다.
        if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        committeeAddBtn.click();
      });
    }
    renderCommitteeList();

    // "0000학교-0000(2026.00.00.)"처럼 자기 학교명이 들어가는 기안번호/공문번호 필드인지 판별.
    // "학교지원센터-..." 등 상대 기관 문서번호는 학교명을 자동으로 넣지 않는다.
    function isOwnSchoolDocField(fld) {
      if (!fld.ph || fld.id === "caseNo" || fld.big) return false;
      if (fld.ph.indexOf("\n") !== -1) return false;
      if (fld.ph.indexOf("학교지원센터") !== -1) return false;
      return /학교/.test(fld.ph) && fld.ph.indexOf("-") !== -1 && fld.ph.indexOf("(") !== -1;
    }

    function wireRefDocField(fld) {
      var schoolSpan = document.getElementById("sv-f-" + fld.id + "-school");
      var docNoInput = document.getElementById("sv-f-" + fld.id + "-docno");
      var dateInput = document.getElementById("sv-f-" + fld.id + "-date");
      var hidden = document.getElementById("sv-f-" + fld.id);
      if (!schoolSpan || !docNoInput || !dateInput || !hidden) return;
      var suffixMatch = fld.ph.match(/\)([^)]*)$/);
      var suffix = suffixMatch ? suffixMatch[1] : "";
      function compose() {
        var school = getSchoolName() || "○○○○학교";
        schoolSpan.textContent = school + "-";
        var docNo = docNoInput.value.trim();
        var dateStr = "";
        if (dateInput.value) {
          var d = new Date(dateInput.value + "T00:00:00");
          dateStr = d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate() + ".";
        }
        hidden.value = school + "-" + docNo + (dateStr ? "(" + dateStr + ")" : "") + suffix;
      }
      docNoInput.addEventListener("input", compose);
      dateInput.addEventListener("change", compose);
      refDocComposers.push(compose);
      compose();
    }

    function wireSessionNoField() {
      var select = document.getElementById("sv-f-sessionNo-select");
      var custom = document.getElementById("sv-f-sessionNo-custom");
      var hidden = document.getElementById("sv-f-sessionNo");
      if (!select || !custom || !hidden) return;
      function compose() {
        if (select.value === "__custom") {
          custom.hidden = false;
          hidden.value = custom.value;
        } else {
          custom.hidden = true;
          hidden.value = select.value;
        }
      }
      select.addEventListener("change", compose);
      custom.addEventListener("input", compose);
      compose();
    }

    function wireDatetimeField(fld) {
      var dateInput = document.getElementById("sv-f-datetime-date");
      var timeInput = document.getElementById("sv-f-datetime-time");
      var hidden = document.getElementById("sv-f-datetime");
      if (!dateInput || !timeInput || !hidden) return;
      var trailing = /~\s*$/.test(fld.ph || "") ? " ~" : "";
      function compose() {
        var datePart = "";
        if (dateInput.value) {
          var d = new Date(dateInput.value + "T00:00:00");
          datePart = d.getFullYear() + "." + (d.getMonth() + 1) + "." + d.getDate() + ".(" + SV_WEEKDAYS[d.getDay()] + ")";
        }
        var timePart = timeInput.value || "";
        hidden.value = (datePart ? datePart + " " : "") + timePart + trailing;
      }
      dateInput.addEventListener("change", compose);
      timeInput.addEventListener("input", compose);
      compose();
    }

    function wireMembersField() {
      var checksEl = document.getElementById("sv-members-checks");
      var extraInput = document.getElementById("sv-f-members-extra");
      var hidden = document.getElementById("sv-f-members");
      if (!checksEl || !extraInput || !hidden) return;
      var list = getCommitteeList();
      if (!list.length) {
        checksEl.innerHTML = '<small>위 "학교 기본 정보 설정"에서 전담기구 위원 명단을 먼저 등록해 두면 체크박스로 고를 수 있습니다.</small>';
      } else {
        checksEl.innerHTML = list.map(function (name, i) {
          return '<label class="sv-member-check"><input type="checkbox" checked data-name="' + escapeHtml(name) + '" id="sv-member-chk-' + i + '"> ' + escapeHtml(name) + '</label>';
        }).join("");
      }
      function compose() {
        var checked = Array.prototype.slice.call(checksEl.querySelectorAll('input[type="checkbox"]:checked'))
          .map(function (el) { return el.getAttribute("data-name"); });
        var extra = extraInput.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        hidden.value = checked.concat(extra).join(", ");
      }
      checksEl.querySelectorAll('input[type="checkbox"]').forEach(function (el) { el.addEventListener("change", compose); });
      extraInput.addEventListener("input", compose);
      compose();
    }

    if (svSelect && svTemplates.length) {
      SV_GROUPS.forEach(function (grp) {
        var optgroup = document.createElement("optgroup");
        optgroup.label = grp.label;
        grp.ids.forEach(function (id) {
          var tpl = svTemplates.find(function (t) { return t.id === id; });
          if (!tpl) return;
          var opt = document.createElement("option");
          opt.value = tpl.id;
          opt.textContent = tpl.title;
          optgroup.appendChild(opt);
        });
        svSelect.appendChild(optgroup);
      });

      var SV_CASE_NO_KEY = "sv_last_case_no";

      function incrementCaseNo(str) {
        var m = str.match(/(\d+)(\D*)$/);
        if (!m) return str;
        var next = String(parseInt(m[1], 10) + 1);
        return str.slice(0, str.length - m[0].length) + next + m[2];
      }

      svSelect.addEventListener("change", function () {
        var id = parseInt(svSelect.value, 10);
        var tpl = svTemplates.find(function (t) { return t.id === id; });
        var descEl = document.getElementById("sv-doc-desc");
        var fieldsEl = document.getElementById("sv-doc-fields");
        if (!tpl || !descEl || !fieldsEl) return;
        descEl.textContent = "[" + tpl.category + "] " + tpl.desc;
        refDocComposers.length = 0;
        fieldsEl.innerHTML = tpl.fields.map(function (fld) {
          var isTextarea = (fld.ph && fld.ph.indexOf("\n") !== -1) || fld.big;
          var req = fld.req ? '<span class="sv-req">*</span>' : '<small>선택</small>';
          if (fld.id === "caseNo") {
            return '<label>' + escapeHtml(fld.label) + ' ' + req +
              '<span class="sv-caseno-row"><input id="sv-f-caseNo" placeholder="' + escapeHtml(fld.ph || "") + '">' +
              '<button type="button" id="sv-caseno-inc-btn" class="btn btn-secondary btn-sm" title="다음 사안번호로 +1">다음 사안 +1</button></span></label>';
          }
          if (fld.id === "sessionNo") {
            var opts = ["제1회", "제2회", "제3회", "제4회", "제5회", "제6회", "제7회", "제8회", "제9회", "제10회"]
              .map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join("");
            return '<label>' + escapeHtml(fld.label) + ' ' + req +
              '<span class="sv-sessionno-row">' +
                '<select id="sv-f-sessionNo-select">' + opts + '<option value="__custom">직접 입력</option></select>' +
                '<input id="sv-f-sessionNo-custom" placeholder="예: 제11회" hidden>' +
              '</span>' +
              '<input type="hidden" id="sv-f-sessionNo"></label>';
          }
          if (fld.id === "datetime") {
            return '<label>' + escapeHtml(fld.label) + ' ' + req +
              '<span class="sv-datetime-row">' +
                '<input type="date" id="sv-f-datetime-date">' +
                '<input type="time" id="sv-f-datetime-time">' +
              '</span>' +
              '<input type="hidden" id="sv-f-datetime"></label>';
          }
          if (fld.id === "members") {
            return '<label>' + escapeHtml(fld.label) + ' ' + req +
              '<div id="sv-members-checks" class="sv-members-checks"></div>' +
              '<input id="sv-f-members-extra" placeholder="명단에 없는 위원 추가(쉼표로 구분)">' +
              '<input type="hidden" id="sv-f-members"></label>';
          }
          if (isOwnSchoolDocField(fld)) {
            return '<label>' + escapeHtml(fld.label) + ' ' + req +
              '<span class="sv-refdoc-row">' +
                '<span class="sv-refdoc-school" id="sv-f-' + fld.id + '-school"></span>' +
                '<input id="sv-f-' + fld.id + '-docno" class="sv-refdoc-docno" placeholder="문서번호(예: 123)">' +
                '<input type="date" id="sv-f-' + fld.id + '-date" class="sv-refdoc-date">' +
              '</span>' +
              '<input type="hidden" id="sv-f-' + fld.id + '"></label>';
          }
          if (isTextarea) {
            return '<label>' + escapeHtml(fld.label) + ' ' + req +
              '<textarea id="sv-f-' + fld.id + '" rows="3" placeholder="' + escapeHtml(fld.ph || "") + '"></textarea></label>';
          }
          return '<label>' + escapeHtml(fld.label) + ' ' + req +
            '<input id="sv-f-' + fld.id + '" placeholder="' + escapeHtml(fld.ph || "") + '"></label>';
        }).join("");

        var caseNoInput = document.getElementById("sv-f-caseNo");
        if (caseNoInput) {
          var lastCaseNo = "";
          try { lastCaseNo = localStorage.getItem(SV_CASE_NO_KEY) || ""; } catch (e) {}
          if (lastCaseNo) caseNoInput.value = lastCaseNo;
          caseNoInput.addEventListener("input", function () {
            try { localStorage.setItem(SV_CASE_NO_KEY, caseNoInput.value); } catch (e) {}
          });
          var incBtn = document.getElementById("sv-caseno-inc-btn");
          if (incBtn) {
            incBtn.addEventListener("click", function () {
              caseNoInput.value = incrementCaseNo(caseNoInput.value || "");
              try { localStorage.setItem(SV_CASE_NO_KEY, caseNoInput.value); } catch (e) {}
            });
          }
        }

        if (document.getElementById("sv-f-sessionNo-select")) wireSessionNoField();
        if (document.getElementById("sv-f-datetime-date")) {
          var datetimeFld = tpl.fields.find(function (f) { return f.id === "datetime"; });
          if (datetimeFld) wireDatetimeField(datetimeFld);
        }
        if (document.getElementById("sv-members-checks")) wireMembersField();
        tpl.fields.forEach(function (fld) {
          if (isOwnSchoolDocField(fld)) wireRefDocField(fld);
        });
      });
    }

    var currentSvBodyPlain = "";
    var currentSvBodyHtml = "";

    var svGenerateBtn = document.getElementById("sv-generate-btn");
    if (svGenerateBtn) {
      svGenerateBtn.addEventListener("click", function () {
        var id = parseInt(svSelect ? svSelect.value : "0", 10);
        var tpl = svTemplates.find(function (t) { return t.id === id; });
        var titleEl = document.getElementById("sv-doc-title-output");
        var bodyEl = document.getElementById("sv-doc-body-output");
        if (!tpl || !titleEl || !bodyEl) return;
        var vals = {};
        tpl.fields.forEach(function (fld) {
          var el = document.getElementById("sv-f-" + fld.id);
          vals[fld.id] = el ? el.value : "";
        });
        if (vals.caseNo) {
          try { localStorage.setItem("sv_last_case_no", vals.caseNo); } catch (e) {}
        }
        var parts = splitSvDoc(tpl.generate(vals));
        var table = tpl.table ? tpl.table(vals) : null;
        var rendered = renderSvBody(parts.rest, table);
        titleEl.textContent = parts.title;
        bodyEl.innerHTML = rendered.html;
        currentSvBodyPlain = rendered.plain;
        currentSvBodyHtml = rendered.html;
      });
    }

    var svClearBtn = document.getElementById("sv-clear-btn");
    if (svClearBtn) {
      svClearBtn.addEventListener("click", function () {
        var fieldsEl = document.getElementById("sv-doc-fields");
        if (fieldsEl) fieldsEl.querySelectorAll("input, textarea").forEach(function (el) { el.value = ""; });
        var titleEl = document.getElementById("sv-doc-title-output");
        var bodyEl = document.getElementById("sv-doc-body-output");
        if (titleEl) titleEl.textContent = "왼쪽에서 공문을 선택하고 항목을 입력한 뒤 [공문 생성]을 누르세요.";
        if (bodyEl) bodyEl.textContent = "";
        currentSvBodyPlain = "";
        currentSvBodyHtml = "";
      });
    }

    var svCopyTitleBtn = document.getElementById("sv-copy-title-btn");
    if (svCopyTitleBtn) svCopyTitleBtn.addEventListener("click", function () { copyTextFrom("sv-doc-title-output"); });
    var svCopyBodyBtn = document.getElementById("sv-copy-body-btn");
    if (svCopyBodyBtn) svCopyBodyBtn.addEventListener("click", function () {
      writeRichClipboard(currentSvBodyPlain, currentSvBodyHtml);
    });

    // ── 품의서 작성 ──────────────────────────────────────────
    function numberToKorean(num) {
      num = Math.floor(num);
      if (!num || num <= 0) return "영";
      var ones = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
      var pos  = ["", "십", "백", "천"];
      function fmt(n) {
        var s = "";
        for (var i = 3; i >= 0; i--) {
          var d = Math.floor(n / Math.pow(10, i)) % 10;
          if (d > 0) s += (d === 1 && i > 0 ? "" : ones[d]) + pos[i];
        }
        return s;
      }
      var eok  = Math.floor(num / 100000000);
      var man  = Math.floor((num % 100000000) / 10000);
      var rest = num % 10000;
      var r = "";
      if (eok  > 0) r += fmt(eok)  + "억";
      if (man  > 0) r += fmt(man)  + "만";
      if (rest > 0) r += fmt(rest);
      return r;
    }

    function fmtDate(dateStr) {
      if (!dateStr) return "";
      var p = dateStr.split("-");
      return p.length === 3 ? p[0] + "." + p[1] + "." + p[2] + "." : dateStr;
    }

    function numComma(n) { return Number(n).toLocaleString(); }

    function getPoomItems() {
      var rows = document.querySelectorAll(".poom-item-row");
      var items = [];
      rows.forEach(function (row) {
        var name  = row.querySelector(".pi-name").value.trim();
        var spec  = row.querySelector(".pi-spec").value.trim();
        var qty   = parseInt(row.querySelector(".pi-qty").value) || 0;
        var price = parseInt(row.querySelector(".pi-price").value) || 0;
        if (name) items.push({ name: name, spec: spec, qty: qty, price: price, amount: qty * price });
      });
      return items;
    }

    function updatePoomTotal() {
      var total = getPoomItems().reduce(function (s, i) { return s + i.amount; }, 0);
      var disp = document.getElementById("poom-total-display");
      if (disp) disp.textContent = numComma(total);
      updateGaeyoAutoFields();
      return total;
    }

    function addPoomRow(data) {
      var container = document.getElementById("poom-rows");
      if (!container) return;
      var row = document.createElement("div");
      row.className = "poom-item-row";
      row.style.cssText = "display:grid;grid-template-columns:2fr 1fr 52px 1fr 90px 30px;gap:4px;margin-bottom:4px;align-items:center";
      row.innerHTML = [
        '<input class="input pi-name"  style="height:32px;font-size:12px">',
        '<input class="input pi-spec"  style="height:32px;font-size:12px">',
        '<input class="input pi-qty"   type="number" min="0" style="height:32px;font-size:12px">',
        '<input class="input pi-price" type="number" min="0" style="height:32px;font-size:12px">',
        '<input class="input pi-amt"   readonly style="height:32px;font-size:12px;background:var(--bg-2);color:var(--fg-2)">',
        '<button class="btn btn-secondary pi-del" type="button" style="height:30px;width:30px;padding:0;font-size:16px;line-height:1">×</button>'
      ].join("");

      var qtyEl   = row.querySelector(".pi-qty");
      var priceEl = row.querySelector(".pi-price");
      var amtEl   = row.querySelector(".pi-amt");

      if (data) {
        row.querySelector(".pi-name").value  = data.name  || "";
        row.querySelector(".pi-spec").value  = data.spec  || "";
        qtyEl.value   = data.qty   || "";
        priceEl.value = data.price || "";
        var a = (data.qty || 0) * (data.price || 0);
        amtEl.value = a > 0 ? numComma(a) : "";
      }

      function calcRow() {
        var a = (parseInt(qtyEl.value) || 0) * (parseInt(priceEl.value) || 0);
        amtEl.value = a > 0 ? numComma(a) : "";
        updatePoomTotal();
      }
      qtyEl.addEventListener("input", calcRow);
      priceEl.addEventListener("input", calcRow);
      row.querySelector(".pi-del").addEventListener("click", function () { row.remove(); updatePoomTotal(); });
      container.appendChild(row);
    }

    // 개요 항목 정의 (type별)
    var GAEYO_DEFS = {
      "물품":     [{ id:"목적", label:"목적", type:"text" }, { id:"내용", label:"내용", type:"text" }, { id:"품목", label:"물품", type:"auto-items" }, { id:"금액", label:"금액", type:"auto-amount" }],
      "지출":     [{ id:"목적", label:"목적", type:"text" }, { id:"내용", label:"내용", type:"text" }, { id:"금액", label:"금액", type:"auto-amount" }],
      "수당":     [{ id:"목적", label:"목적", type:"text" }, { id:"내용", label:"내용", type:"text" }, { id:"금액", label:"금액", type:"auto-amount" }],
      "업무추진비": [{ id:"목적", label:"목적", type:"text" }, { id:"내용", label:"내용", type:"text" }, { id:"금액", label:"금액", type:"auto-amount" }]
    };

    function buildGaeyoList(type) {
      var container = document.getElementById("poom-gaeyo-list");
      if (!container) return;
      container.innerHTML = "";
      var defs = GAEYO_DEFS[type] || GAEYO_DEFS["물품"];
      defs.forEach(function (def) { appendGaeyoRow(container, def.id, def.label, def.type, true); });
      setupGaeyoDrag(container);
      // 기타 추가 버튼
      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-secondary btn-sm";
      addBtn.textContent = "+ 기타 항목 추가";
      addBtn.style.cssText = "margin-top:4px;font-size:11px";
      addBtn.onclick = function () {
        appendGaeyoRow(container, "기타_" + Date.now(), "", "custom", true);
        container.insertBefore(addBtn, null); // keep at end
        setupGaeyoDrag(container);
      };
      container.appendChild(addBtn);
      updateGaeyoAutoFields();
    }

    function appendGaeyoRow(container, id, label, type, checked) {
      var row = document.createElement("div");
      row.className = "poom-gaeyo-row";
      row.draggable = true;
      row.dataset.itemId = id;
      row.dataset.itemType = type;
      row.style.cssText = "display:flex;align-items:center;gap:6px;padding:5px 8px;border:1px solid var(--border);border-radius:6px;margin-bottom:3px;background:var(--bg-1);user-select:none";

      var handle = document.createElement("span");
      handle.textContent = "⠿";
      handle.style.cssText = "cursor:grab;color:var(--fg-3);font-size:15px;flex-shrink:0";

      var chk = document.createElement("input");
      chk.type = "checkbox";
      chk.className = "poom-gaeyo-check";
      chk.checked = checked;
      chk.style.cssText = "width:15px;height:15px;cursor:pointer;flex-shrink:0";

      var labelEl;
      if (type === "custom") {
        labelEl = document.createElement("input");
        labelEl.className = "input poom-gaeyo-label-input";
        labelEl.placeholder = "항목 이름";
        labelEl.value = label;
        labelEl.style.cssText = "width:70px;height:26px;font-size:12px;font-weight:600;flex-shrink:0";
      } else {
        labelEl = document.createElement("span");
        labelEl.textContent = label;
        labelEl.style.cssText = "font-size:12px;font-weight:600;min-width:52px;color:var(--fg-2);flex-shrink:0";
      }

      var inputEl;
      if (type === "auto-items") {
        inputEl = document.createElement("span");
        inputEl.className = "poom-gaeyo-auto-items";
        inputEl.style.cssText = "flex:1;font-size:12px;color:var(--fg-3)";
        inputEl.textContent = "품목 목록에서 자동 생성";
      } else if (type === "auto-amount") {
        inputEl = document.createElement("span");
        inputEl.className = "poom-gaeyo-auto-amount";
        inputEl.style.cssText = "flex:1;font-size:12px;color:var(--fg-3)";
        inputEl.textContent = "품목 합계에서 자동 계산";
      } else {
        inputEl = document.createElement("input");
        inputEl.className = "input poom-gaeyo-input";
        inputEl.style.cssText = "flex:1;height:26px;font-size:12px";
      }

      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "×";
      delBtn.style.cssText = "background:none;border:none;cursor:pointer;color:var(--fg-3);font-size:16px;padding:0 2px;flex-shrink:0";
      delBtn.onclick = function () { row.remove(); };

      row.appendChild(handle);
      row.appendChild(chk);
      row.appendChild(labelEl);
      row.appendChild(inputEl);
      row.appendChild(delBtn);

      // addBtn이 있으면 그 앞에 삽입
      var addBtn = container.querySelector("button.btn");
      if (addBtn) container.insertBefore(row, addBtn);
      else container.appendChild(row);
    }

    function setupGaeyoDrag(container) {
      var dragSrc = null;
      container.querySelectorAll(".poom-gaeyo-row").forEach(function (row) {
        row.ondragstart = function (e) {
          dragSrc = row;
          e.dataTransfer.effectAllowed = "move";
          setTimeout(function () { row.style.opacity = "0.4"; }, 0);
        };
        row.ondragend = function () {
          row.style.opacity = "";
          container.querySelectorAll(".poom-gaeyo-row").forEach(function (r) { r.style.borderColor = "var(--border)"; });
        };
        row.ondragover = function (e) {
          e.preventDefault();
          row.style.borderColor = "var(--accent)";
        };
        row.ondragleave = function () { row.style.borderColor = "var(--border)"; };
        row.ondrop = function (e) {
          e.preventDefault();
          row.style.borderColor = "var(--border)";
          if (dragSrc && dragSrc !== row) container.insertBefore(dragSrc, row);
        };
      });
    }

    function updateGaeyoAutoFields() {
      var items = getPoomItems();
      var total = items.reduce(function (s, i) { return s + i.amount; }, 0);

      document.querySelectorAll(".poom-gaeyo-auto-items").forEach(function (el) {
        if (items.length > 0) {
          var str = items[0].name + (items.length > 1 ? " 외 " + (items.length - 1) + "종" : "");
          el.textContent = str;
          el.style.color = "var(--fg-1)";
        } else {
          el.textContent = "품목 목록에서 자동 생성";
          el.style.color = "var(--fg-3)";
        }
      });

      document.querySelectorAll(".poom-gaeyo-auto-amount").forEach(function (el) {
        if (total > 0) {
          el.textContent = "금" + numComma(total) + "원(금" + numberToKorean(total) + "원정)";
          el.style.color = "var(--fg-1)";
          el.style.fontWeight = "600";
        } else {
          el.textContent = "품목 합계에서 자동 계산";
          el.style.color = "var(--fg-3)";
          el.style.fontWeight = "400";
        }
      });
    }

    function generatePoom() {
      var type     = getValue("poom-type");
      var year     = getValue("poom-year") || "2026";
      var title    = getValue("poom-title").trim();
      var plan     = getValue("poom-plan").trim();
      var planDate = getValue("poom-plan-date");
      var attachLines = getAttachLines();
      var items    = getPoomItems();
      var total    = items.reduce(function (s, i) { return s + i.amount; }, 0);
      var totalKr  = total > 0 ? numberToKorean(total) : "";

      var gaeyoLines = [];
      if (plan) gaeyoLines.push("1. 관련: " + plan + (planDate ? "(" + fmtDate(planDate) + ")" : ""));

      var numPrefix = plan ? "2. " : "1. ";
      // 제목 끝에 붙은 행위 관련 단어 제거 (지출, 구입, 구매 등)
      var cleanTitle = (title || (year + "학년도")).replace(/[\s]*(지출|구입|구매|구매비|지급|집행|예산|비용|경비)\s*$/, "").trim();
      var verbSentence = {
        "물품":     cleanTitle + " 관련 물품을 다음과 같이 구입하고자 합니다.",
        "지출":     cleanTitle + " 관련 경비를 다음과 같이 지출하고자 합니다.",
        "수당":     cleanTitle + " 관련 수당을 다음과 같이 지급하고자 합니다.",
        "업무추진비": cleanTitle + " 관련 업무추진비를 다음과 같이 집행하고자 합니다."
      }[type] || cleanTitle + " 관련하여 다음과 같이 집행하고자 합니다.";
      gaeyoLines.push(numPrefix + verbSentence);

      var alpha = ["가", "나", "다", "라", "마", "바", "사", "아", "자", "차"];
      var aIdx = 0;
      document.querySelectorAll("#poom-gaeyo-list .poom-gaeyo-row").forEach(function (row) {
        var chk = row.querySelector(".poom-gaeyo-check");
        if (!chk || !chk.checked) return;
        var itype = row.dataset.itemType;
        var a = alpha[aIdx++] || "차";

        var labelEl = row.querySelector(".poom-gaeyo-label-input");
        var lbl = labelEl ? labelEl.value.trim() : (row.querySelector("span:nth-child(3)") ? row.querySelector("span:nth-child(3)").textContent.trim() : "");

        if (itype === "auto-items") {
          if (items.length > 0) {
            var str = items[0].name + (items.length > 1 ? " 외 " + (items.length - 1) + "종" : "");
            gaeyoLines.push("   " + a + ". " + lbl + ": " + str);
          }
        } else if (itype === "auto-amount") {
          if (total > 0) gaeyoLines.push("   " + a + ". " + lbl + ": 금" + numComma(total) + "원(금" + totalKr + "원정)" + (attachLines.length ? "." : ".  끝."));
        } else {
          var inp = row.querySelector(".poom-gaeyo-input");
          var val = inp ? inp.value.trim() : "";
          if (val) gaeyoLines.push("   " + a + ". " + lbl + ": " + val);
        }
      });

      var colW = [16, 8, 4, 10, 10];
      function pad(s, w) { s = String(s); return s.length >= w ? s : s + " ".repeat(w - s.length); }
      var itemsLines = [];
      if (items.length > 0) {
        itemsLines.push(pad("품목명", colW[0]) + pad("규격", colW[1]) + pad("수량", colW[2]) + pad("단가", colW[3]) + "금액");
        itemsLines.push("─".repeat(48));
        items.forEach(function (item, idx) {
          itemsLines.push(pad((idx + 1) + ". " + item.name, colW[0]) + pad(item.spec || "-", colW[1]) + pad(String(item.qty), colW[2]) + pad(numComma(item.price), colW[3]) + numComma(item.amount));
        });
        itemsLines.push("─".repeat(48));
        itemsLines.push(pad("합계", colW[0] + colW[1] + colW[2] + colW[3]) + numComma(total) + "원");
      }

      // 붙임 섹션
      if (attachLines.length) {
        gaeyoLines.push("");
        if (attachLines.length === 1) {
          gaeyoLines.push("붙임  " + attachLines[0] + ".  끝.");
        } else {
          attachLines.forEach(function (line, idx) {
            var suffix = idx === attachLines.length - 1 ? ".  끝." : ".";
            gaeyoLines.push((idx === 0 ? "붙임  " : "      ") + (idx + 1) + ". " + line + suffix);
          });
        }
      }

      var titleEl = document.getElementById("poom-out-title");
      var gaeyoEl = document.getElementById("poom-out-gaeyo");
      var itemsEl = document.getElementById("poom-out-items");
      if (titleEl) titleEl.textContent = title || "제목을 입력하세요";
      if (gaeyoEl) gaeyoEl.textContent = gaeyoLines.join("\n") || "내용을 입력하세요";
      if (itemsEl) itemsEl.textContent = itemsLines.length ? itemsLines.join("\n") : "품목을 추가하세요";
    }

    // 업로드한 파일명(확장자 제외)을 붙임 칸에 자동으로 추가한다.
    function addFileToAttachments(filename) {
      var base = String(filename || "").replace(/\.[^.\/\\]+$/, "").trim();
      if (!base) return;
      var existing = getAttachLines().some(function (v) { return v.replace(/\s*\d+\s*(부|장|권|건|매|개|세트|박스)\s*$/, "").trim() === base; });
      if (existing) return;
      var emptyInput = document.querySelector("#poom-attach-rows .poom-attach-input");
      if (emptyInput && !emptyInput.value.trim() && document.querySelectorAll("#poom-attach-rows .poom-attach-input").length === 1) {
        emptyInput.value = base + " 1부";
      } else {
        addAttachRow(base + " 1부");
      }
    }

    // 파일 업로드 처리
    async function handleEstimateFile(file) {
      var statusEl = document.getElementById("poom-upload-status");
      function setStatus(msg) { if (statusEl) { statusEl.textContent = msg; statusEl.style.display = msg ? "" : "none"; } }

      var ext = file.name.split(".").pop().toLowerCase();
      var isImage = file.type.startsWith("image/");
      var isPdf   = ext === "pdf" || file.type === "application/pdf";
      var isExcel = ["xlsx", "xls"].indexOf(ext) !== -1;
      var isCsv   = ext === "csv";

      if (!isImage && !isPdf && !isExcel && !isCsv) { setStatus("지원하지 않는 파일 형식입니다."); return; }

      addFileToAttachments(file.name);

      setStatus("파일 읽는 중…");

      if (isImage || isPdf) {
        // AI vision/document으로 추출
        var apiKey = await api.getSetting("ai_api_key", "");
        if (!apiKey) { setStatus("설정에서 AI API 키를 입력하세요."); return; }
        var model    = await api.getSetting("ai_model", "claude-sonnet-5");
        var provider = await api.getSetting("ai_provider", "claude");
        setStatus("AI가 견적서를 분석 중입니다…");
        var reader = new FileReader();
        reader.onload = async function (e) {
          var b64 = e.target.result.split(",")[1];
          var mimeType = isPdf ? "application/pdf" : file.type;
          var result = await api.aiExtractEstimateImage(apiKey, model, provider, { data: b64, mimeType: mimeType });
          if (result.error) { setStatus("오류: " + result.error); return; }
          try {
            var raw = result.result || "";
            raw = raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
            var items = JSON.parse(raw);
            fillPoomRows(items);
            setStatus("✓ " + items.length + "개 품목 자동 입력 완료");
          } catch (err) { setStatus("AI 응답 파싱 실패. 직접 입력해주세요."); }
        };
        reader.readAsDataURL(file);

      } else if (isExcel) {
        var reader2 = new FileReader();
        reader2.onload = async function (e) {
          var buf = Array.from(new Uint8Array(e.target.result));
          var result = await api.parseExcelEstimate(buf);
          if (result.error) { setStatus("엑셀 파싱 오류: " + result.error); return; }
          await resolveRowsToItems(result.rows, setStatus);
        };
        reader2.readAsArrayBuffer(file);

      } else if (isCsv) {
        var reader3 = new FileReader();
        reader3.onload = async function (e) {
          var lines = e.target.result.split(/\r?\n/).map(function (l) { return l.split(","); });
          await resolveRowsToItems(lines, setStatus);
        };
        reader3.readAsText(file, "utf-8");
      }
    }

    // 표 형태 행 데이터 → 품목 목록. 규칙 기반 파싱이 실패하면 AI로 재시도한다.
    async function resolveRowsToItems(rows, setStatus) {
      var items = inferItemsFromRows(rows);
      if (items.length) { fillPoomRows(items); setStatus("✓ " + items.length + "개 품목 자동 입력 완료"); return; }

      var apiKey = await api.getSetting("ai_api_key", "");
      if (!apiKey) { setStatus("품목 데이터를 찾지 못했습니다. 헤더(품목명·수량·단가)가 있는지 확인해주세요."); return; }
      var model    = await api.getSetting("ai_model", "claude-sonnet-5");
      var provider = await api.getSetting("ai_provider", "claude");
      setStatus("AI가 견적서를 분석 중입니다…");
      var text = rows.map(function (r) { return r.join("\t"); }).join("\n");
      var result = await api.aiExtractEstimateText(apiKey, model, provider, text);
      if (result.error) { setStatus("오류: " + result.error); return; }
      try {
        var raw = (result.result || "").replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
        var aiItems = JSON.parse(raw);
        if (!aiItems.length) { setStatus("품목 데이터를 찾지 못했습니다."); return; }
        fillPoomRows(aiItems);
        setStatus("✓ " + aiItems.length + "개 품목 자동 입력 완료 (AI)");
      } catch (err) { setStatus("AI 응답 파싱 실패. 직접 입력해주세요."); }
    }

    function inferItemsFromRows(rows) {
      // 헤더 행 탐색: 품목명/품명/내용/규격/수량/단가 등 키워드 포함 행
      var nameKeywords  = ["품목", "품명", "내용", "name", "item"];
      var specKeywords  = ["규격", "사양", "spec"];
      var qtyKeywords   = ["수량", "qty", "quantity", "ea"];
      var priceKeywords = ["단가", "price", "단위가격", "금액"];

      function matchCol(header, keywords) {
        var h = String(header).toLowerCase().replace(/\s/g, "");
        return keywords.some(function (k) { return h.indexOf(k) !== -1; });
      }

      var headerIdx = -1, nameCol = -1, specCol = -1, qtyCol = -1, priceCol = -1;
      for (var r = 0; r < Math.min(rows.length, 10); r++) {
        var row = rows[r];
        var found = false;
        for (var c = 0; c < row.length; c++) {
          if (matchCol(row[c], nameKeywords)) { nameCol = c; found = true; }
          if (matchCol(row[c], specKeywords)) specCol = c;
          if (matchCol(row[c], qtyKeywords))  qtyCol  = c;
          if (matchCol(row[c], priceKeywords)) priceCol = c;
        }
        if (found) { headerIdx = r; break; }
      }
      if (headerIdx === -1 || nameCol === -1) return [];

      var items = [];
      for (var i = headerIdx + 1; i < rows.length; i++) {
        var row2 = rows[i];
        var name = nameCol >= 0 ? String(row2[nameCol] || "").trim() : "";
        if (!name) continue;
        var spec  = specCol  >= 0 ? String(row2[specCol]  || "").trim() : "";
        var qty   = qtyCol   >= 0 ? parseFloat(String(row2[qtyCol]  || "").replace(/,/g, "")) || 0 : 0;
        var price = priceCol >= 0 ? parseFloat(String(row2[priceCol] || "").replace(/,/g, "")) || 0 : 0;
        items.push({ name: name, spec: spec, qty: qty, price: price });
      }
      return items;
    }

    function fillPoomRows(items) {
      var container = document.getElementById("poom-rows");
      if (!container) return;
      container.innerHTML = "";
      items.forEach(function (item) { addPoomRow(item); });
      updatePoomTotal();
      updateGaeyoAutoFields();
    }

    // 초기 행 2개
    addPoomRow(); addPoomRow();

    // 파일 업로드 이벤트
    var uploadArea = document.getElementById("poom-upload-area");
    var fileInput  = document.getElementById("poom-file-input");
    if (uploadArea && fileInput) {
      uploadArea.addEventListener("click", function () { fileInput.click(); });
      uploadArea.addEventListener("dragover", function (e) { e.preventDefault(); uploadArea.style.borderColor = "var(--accent)"; });
      uploadArea.addEventListener("dragleave", function () { uploadArea.style.borderColor = "var(--border)"; });
      uploadArea.addEventListener("drop", function (e) {
        e.preventDefault();
        uploadArea.style.borderColor = "var(--border)";
        var file = e.dataTransfer.files[0];
        if (file) handleEstimateFile(file);
      });
      fileInput.addEventListener("change", function () {
        if (fileInput.files[0]) handleEstimateFile(fileInput.files[0]);
        fileInput.value = "";
      });
    }

    // 학교교육과정운영계획 체크박스 → 자동 입력
    var planEduCheck = document.getElementById("poom-plan-edu");
    if (planEduCheck) {
      planEduCheck.addEventListener("change", function () {
        var planEl = document.getElementById("poom-plan");
        var dateEl = document.getElementById("poom-plan-date");
        var year   = parseInt(getValue("poom-year")) || new Date().getFullYear();
        if (planEduCheck.checked) {
          if (planEl) { planEl.value = year + "학년도 학교교육과정운영계획"; planEl.disabled = true; }
          if (dateEl) { dateEl.value = year + "-03-02"; dateEl.disabled = true; }
        } else {
          if (planEl) { planEl.value = ""; planEl.disabled = false; }
          if (dateEl) { dateEl.value = ""; dateEl.disabled = false; }
        }
      });
    }

    // 초기 개요 리스트 구성
    buildGaeyoList(getValue("poom-type") || "물품");

    var poomTypeEl = document.getElementById("poom-type");
    if (poomTypeEl) {
      poomTypeEl.addEventListener("change", function () { buildGaeyoList(poomTypeEl.value); });
    }

    // 붙임 칸: 값 끝에 수량 표시(부/장/권/건/매/개 등)가 없으면 자동으로 "1부"를 붙여준다.
    function addAttachRow(value) {
      var container = document.getElementById("poom-attach-rows");
      if (!container) return;
      var row = document.createElement("div");
      row.className = "poom-attach-row";
      row.style.cssText = "display:flex;gap:4px;margin-bottom:4px;align-items:center";
      row.innerHTML = [
        '<input class="input poom-attach-input" style="height:32px;font-size:12px;flex:1" placeholder="예: 견적서">',
        '<button class="btn btn-secondary poom-attach-del" type="button" style="height:30px;width:30px;padding:0;font-size:16px;line-height:1">×</button>'
      ].join("");
      var inputEl = row.querySelector(".poom-attach-input");
      if (value) inputEl.value = value;
      inputEl.addEventListener("blur", function () {
        var v = inputEl.value.trim();
        if (v && !/\d+\s*(부|장|권|건|매|개|세트|박스)\s*$/.test(v)) inputEl.value = v + " 1부";
      });
      row.querySelector(".poom-attach-del").addEventListener("click", function () { row.remove(); });
      container.appendChild(row);
    }

    function getAttachLines() {
      var lines = [];
      document.querySelectorAll("#poom-attach-rows .poom-attach-input").forEach(function (inp) {
        var v = inp.value.trim();
        if (v) lines.push(v);
      });
      return lines;
    }

    var poomAttachAddBtn = document.getElementById("poom-attach-add");
    if (poomAttachAddBtn) poomAttachAddBtn.addEventListener("click", function () { addAttachRow(); });
    addAttachRow();

    var poomAddBtn = document.getElementById("poom-add-row");
    if (poomAddBtn) poomAddBtn.addEventListener("click", function () { addPoomRow(); });

    var poomGenBtn = document.getElementById("poom-gen-btn");
    if (poomGenBtn) poomGenBtn.addEventListener("click", generatePoom);

    var poomClearBtn = document.getElementById("poom-clear-btn");
    if (poomClearBtn) {
      poomClearBtn.addEventListener("click", function () {
        ["poom-year","poom-title","poom-plan","poom-plan-date","poom-purpose"]
          .forEach(function (id) { var el = document.getElementById(id); if (el) { el.value = id === "poom-year" ? "2026" : ""; el.disabled = false; } });
        var attachContainer = document.getElementById("poom-attach-rows");
        if (attachContainer) { attachContainer.innerHTML = ""; addAttachRow(); }
        var chk = document.getElementById("poom-plan-edu");
        if (chk) chk.checked = false;
        var rows = document.getElementById("poom-rows");
        if (rows) rows.innerHTML = "";
        addPoomRow(); addPoomRow();
        buildGaeyoList(getValue("poom-type") || "물품");
        updatePoomTotal();
        var tEl = document.getElementById("poom-out-title");
        var gEl = document.getElementById("poom-out-gaeyo");
        var iEl = document.getElementById("poom-out-items");
        if (tEl) tEl.textContent = "";
        if (gEl) gEl.textContent = "";
        if (iEl) iEl.textContent = "";
        var stEl = document.getElementById("poom-upload-status");
        if (stEl) { stEl.textContent = ""; stEl.style.display = "none"; }
      });
    }

    function copyEl(id) {
      var el = document.getElementById(id);
      var text = el ? el.textContent : "";
      if (text && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    }
    var pcTitle = document.getElementById("poom-copy-title");
    var pcGaeyo = document.getElementById("poom-copy-gaeyo");
    var pcItems = document.getElementById("poom-copy-items");
    if (pcTitle) pcTitle.addEventListener("click", function () { copyEl("poom-out-title"); });
    if (pcGaeyo) pcGaeyo.addEventListener("click", function () { copyEl("poom-out-gaeyo"); });
    if (pcItems) pcItems.addEventListener("click", function () { copyEl("poom-out-items"); });

    // ── 에듀파인 CDP 자동입력 ─────────────────────────────────────
    var macroRunning = false;
    var macroEduTab  = null;

    function setMacroStatus(msg, color) {
      var el = document.getElementById("macro-cdp-status");
      if (el) { el.innerHTML = msg; el.style.color = color || "var(--fg-3)"; }
    }

    var macroStartBtn = document.getElementById("macro-start-btn");
    var macroStopBtn  = document.getElementById("macro-stop-btn");

    async function checkCdp() {
      setMacroStatus("연결 확인 중...", "var(--fg-2)");
      var res = await api.macroCdpCheck();
      if (!res.connected) {
        setMacroStatus(
          "❌ 디버그 브라우저 없음 — <b>[브라우저 열기]</b>를 눌러 에듀파인 전용 창을 여세요.",
          "#ef4444"
        );
        macroEduTab = null;
        if (macroStartBtn) macroStartBtn.disabled = true;
      } else if (!res.eduTab) {
        setMacroStatus(
          "⚠️ 브라우저 연결됨 (탭 " + res.tabCount + "개) — 에듀파인 품의서 페이지를 열어두세요.",
          "#f59e0b"
        );
        macroEduTab = null;
        if (macroStartBtn) macroStartBtn.disabled = true;
      } else {
        macroEduTab = res.eduTab;
        var title = (res.eduTab.title || res.eduTab.url || "").slice(0, 45);
        setMacroStatus("✅ 에듀파인 감지: " + title, "#22c55e");
        if (macroStartBtn) macroStartBtn.disabled = false;
      }
    }

    var checkBtn = document.getElementById("macro-check-btn");
    if (checkBtn) checkBtn.addEventListener("click", checkCdp);

    var diagBtn = document.getElementById("macro-diag-btn");
    if (diagBtn) diagBtn.addEventListener("click", async function () {
      if (!macroEduTab) { await checkCdp(); if (!macroEduTab) return; }
      setMacroStatus("페이지 구조 분석 중...", "var(--fg-2)");
      var res = await api.macroDiagnose(macroEduTab.webSocketDebuggerUrl);
      if (res.error) { setMacroStatus("❌ " + res.error, "#ef4444"); return; }

      // 재귀적으로 요약 정보 추출
      function summarizeDiag(d, depth) {
        var indent = depth ? "  ".repeat(depth) + "└ " : "";
        var lines = [];
        var inputCount  = (d.inputs  || []).length;
        var cedCount    = (d.ceds    || []).length;
        var btnTexts    = (d.btns    || []).map(function(b){ return b.txt; }).filter(Boolean).slice(0, 8).join(", ");
        var framesCount = (d.frames  || []).length;
        lines.push(indent + "input:" + inputCount + " contenteditable:" + cedCount + " 버튼:[" + (btnTexts||"없음") + "] iframe:" + framesCount + "개");
        (d.frames || []).forEach(function(f) {
          lines.push(indent + "  📦 iframe[" + (f.id||f.name||f.i) + "] src=" + (f.src||"").slice(0,50));
          if (f.sub) lines = lines.concat(summarizeDiag(f.sub, depth + 1));
        });
        return lines;
      }

      var lines = summarizeDiag(res, 0);
      setMacroStatus("🔬 " + lines.join(" | "), "var(--fg-2)");
      // 클립보드에도 복사 (개발자용)
      try { navigator.clipboard.writeText("에듀파인 진단:\n" + lines.join("\n")); } catch(_) {}
      console.log("에듀파인 진단:", JSON.stringify(res, null, 2));
    });

    var shortcutBtn = document.getElementById("macro-shortcut-btn");
    if (shortcutBtn) shortcutBtn.addEventListener("click", async function () {
      setMacroStatus("바로가기 생성 중...", "var(--fg-2)");
      var res = await api.macroCreateShortcut();
      if (res.error) {
        setMacroStatus("❌ " + res.error, "#ef4444");
      } else {
        setMacroStatus(
          "✅ 바로가기 생성 완료! 데스크탑의 <b>에듀파인(품의서매크로)</b> 로 여세요. 로그인하면 다음부터 자동 유지됩니다.",
          "#22c55e"
        );
      }
    });

    var launchBtn = document.getElementById("macro-launch-btn");
    if (launchBtn) launchBtn.addEventListener("click", async function () {
      setMacroStatus("브라우저 실행 중...", "var(--fg-2)");
      var res = await api.macroLaunchDebugBrowser();
      if (res.error) {
        setMacroStatus("❌ " + res.error + " — 먼저 [바로가기 만들기]를 누르세요.", "#ef4444");
      } else {
        setMacroStatus(
          (res.browser || "브라우저") + " 실행됨 — 에듀파인 로그인 후 품의서 내역 페이지를 열고 [연결 확인]을 누르세요.",
          "#22c55e"
        );
      }
    });

    if (macroStopBtn) macroStopBtn.addEventListener("click", async function () {
      await api.macroStop();
      setMacroStatus("⏹ 중지 요청 전송됨 — 현재 행 완료 후 멈춥니다.", "#f59e0b");
    });

    if (macroStartBtn) macroStartBtn.addEventListener("click", async function () {
      if (macroRunning) return;
      if (!macroEduTab) { await checkCdp(); if (!macroEduTab) return; }
      var items = getPoomItems();
      if (!items.length) { setMacroStatus("❌ 품목 내역을 먼저 입력하세요.", "#ef4444"); return; }

      macroRunning = true;
      macroStartBtn.disabled = true;
      macroStopBtn.style.display = "";
      setMacroStatus("🚀 " + items.length + "개 품목 자동입력 중… (백그라운드 실행)", "var(--accent)");

      // 앱 최소화 → 에듀파인 창이 보이게
      setTimeout(function () { api.minimize(); }, 300);

      var result = await api.macroFillEdufineCdp({
        wsUrl: macroEduTab.webSocketDebuggerUrl,
        items: items,
      });

      // 완료 후 앱 복원
      api.restore();

      macroRunning = false;
      macroStartBtn.disabled = false;
      macroStopBtn.style.display = "none";

      if (result.done) {
        setMacroStatus("✅ 완료! " + result.count + "개 품목 입력 완료", "#22c55e");
      } else if (result.stopped) {
        setMacroStatus("⏹ 중지됨 (" + result.count + "개 완료)", "#f59e0b");
      } else {
        setMacroStatus("❌ 오류: " + (result.error || "알 수 없는 오류"), "#ef4444");
      }
    });
  }

  window.registerPage("official_document", { render: render, init: init });
})();
