(function () {
  "use strict";

  let allRows = [];
  let studentsCache = [];

  const ROLES = ["담임교사", "교과교사", "상담교사"];
  const ROLE_DOMAINS = {
    "담임교사": ["생활", "교우관계", "출결", "가정/보호자", "진로", "학급 적응", "기타"],
    "교과교사": ["수업 참여", "학습 습관", "평가/성취", "과제/수행", "수업 태도", "교과 진로", "기타"],
    "상담교사": ["정서/심리", "위기 개입", "학교 적응", "관계 갈등", "보호자 연계", "기관 연계", "사례관리", "기타"]
  };
  const TYPES = ["개인", "학부모", "진로", "생활", "학습", "위기", "집단", "전화", "기타"];
  const MOODS = ["안정", "불안", "분노", "위축", "무기력", "갈등", "기타"];
  const RISKS = ["낮음", "중간", "높음"];
  const STATUSES = ["진행", "완료", "관찰"];
  const RISK_FLAGS = ["자해/자살 언급", "폭력/따돌림", "가정 위기", "장기 결석", "정서 급변", "학습 포기", "보호자 연락 필요"];

  const TEMPLATES = {
    "담임-생활": {
      role: "담임교사",
      domain: "생활",
      type: "생활",
      topic: "생활 태도 및 교우관계 상담",
      summary: "생활 태도와 교우관계 상황을 확인하고 개선 방향을 함께 정리함.",
      content: "최근 학교생활에서 어려웠던 상황, 친구 관계, 수업 태도, 규칙 준수 여부를 학생의 말로 확인함.",
      result: "학생이 현재 상황을 인식하고 개선이 필요한 행동을 구체적으로 확인함.",
      follow_up: "일주일간 변화 상황을 관찰하고 필요 시 보호자와 공유 예정."
    },
    "담임-보호자": {
      role: "담임교사",
      domain: "가정/보호자",
      type: "학부모",
      topic: "보호자 연계 상담",
      summary: "학생의 학교생활 상황을 보호자와 공유하고 가정 연계 지도 방안을 협의함.",
      content: "학생의 출결, 생활 태도, 교우관계, 가정에서의 변화에 대해 보호자와 의견을 나눔.",
      result: "학교와 가정에서 함께 지원할 방향을 정리함.",
      follow_up: "필요 시 추가 상담 일정을 조율하고 학생 변화 상황을 공유 예정."
    },
    "교과-학습": {
      role: "교과교사",
      domain: "학습 습관",
      type: "학습",
      topic: "학습 습관 및 과제 수행 상담",
      summary: "학습 습관과 과제 수행의 어려움을 확인하고 실천 가능한 개선 계획을 세움.",
      content: "최근 학습량, 수업 집중도, 과제 제출 상황, 어려운 과목과 원인을 함께 점검함.",
      result: "학생이 우선 개선할 학습 행동을 정하고 단기 목표를 설정함.",
      follow_up: "다음 상담 전까지 과제 제출 및 수업 참여 변화를 확인 예정."
    },
    "교과-수업참여": {
      role: "교과교사",
      domain: "수업 참여",
      type: "학습",
      topic: "수업 참여 및 수업 태도 상담",
      summary: "수업 참여 태도와 교과 학습에서의 어려움을 확인하고 개선 행동을 정함.",
      content: "수업 중 집중도, 질문/발표 참여, 준비물, 과제 수행, 교과 내용 이해 정도를 확인함.",
      result: "학생이 수업 시간에 실천할 구체적인 행동을 정함.",
      follow_up: "다음 수업에서 참여도와 과제 수행 변화를 관찰 예정."
    },
    "담임-진로": {
      role: "담임교사",
      domain: "진로",
      type: "진로",
      topic: "진로 희망 및 준비 상황 상담",
      summary: "희망 진로와 현재 준비 상황을 확인하고 다음 단계의 실천 과제를 정함.",
      content: "학생의 관심 분야, 희망 직무, 자격증 준비, 성적 및 학교생활기록부 관리 상황을 확인함.",
      result: "학생에게 필요한 준비 요소를 정리하고 우선순위를 함께 설정함.",
      follow_up: "관련 자격증, 성적 관리, 체험 활동 참여 여부를 추가 확인 예정."
    },
    "상담-정서": {
      role: "상담교사",
      domain: "정서/심리",
      type: "개인",
      topic: "정서 상태 및 학교 적응 상담",
      summary: "학생의 정서 상태와 학교 적응 수준을 확인하고 지지 자원을 함께 탐색함.",
      content: "학생이 느끼는 감정, 스트레스 요인, 관계 경험, 학교생활에서의 어려움을 안전하게 표현하도록 도움.",
      result: "학생이 현재 감정과 필요한 도움을 인식하고 사용할 수 있는 지지 자원을 확인함.",
      follow_up: "정서 변화와 지지 자원 활용 여부를 지속 확인 예정.",
      status: "관찰"
    },
    "상담-위기": {
      role: "상담교사",
      domain: "위기 개입",
      type: "위기",
      topic: "위기 신호 확인 및 보호 조치 상담",
      summary: "학생의 안전과 정서 상태를 우선 확인하고 즉시 필요한 보호 조치를 검토함.",
      content: "학생의 현재 안전 여부, 정서 상태, 위험 발언 또는 행동, 주변 지원 가능성을 신중히 확인함.",
      result: "학생 안전 확보를 최우선으로 하며 필요한 경우 관리자, 전문상담교사, 보호자와 연계함.",
      follow_up: "당일 추가 확인 및 관련 담당자와 연계 여부를 기록하고 지속 관찰 예정.",
      risk_level: "높음",
      status: "관찰"
    }
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function todayStr() {
    if (typeof today === "function") return today();
    return new Date().toISOString().slice(0, 10);
  }

  function daysUntil(dateValue) {
    if (!dateValue) return null;
    const target = new Date(dateValue + "T00:00:00");
    const now = new Date(todayStr() + "T00:00:00");
    return Math.round((target - now) / 86400000);
  }

  function riskClass(level) {
    if (level === "높음") return "high";
    if (level === "중간") return "mid";
    return "low";
  }

  function studentLabel(row) {
    if (!row || !row.name) return "전체/미지정";
    return `${row.number || ""}번 ${row.name}`.trim();
  }

  function getFilters() {
    return {
      search: document.getElementById("co-search")?.value.trim() || "",
      status: document.getElementById("co-status-filter")?.value || "",
      risk_level: document.getElementById("co-risk-filter")?.value || "",
      teacher_role: document.getElementById("co-role-filter")?.value || "",
      domain: document.getElementById("co-domain-filter")?.value || "",
      student_id: parseInt(document.getElementById("co-student-filter")?.value || "", 10) || null
    };
  }

  function roleClass(role) {
    if (role === "교과교사") return "subject";
    if (role === "상담교사") return "counselor";
    return "homeroom";
  }

  function renderDomainOptions(role, selected) {
    const domains = role && ROLE_DOMAINS[role]
      ? ROLE_DOMAINS[role]
      : Array.from(new Set(Object.values(ROLE_DOMAINS).flat()));
    return domains.map(v => `<option value="${esc(v)}" ${selected === v ? "selected" : ""}>${esc(v)}</option>`).join("");
  }

  async function render(container) {
    container.innerHTML = `
      <div class="counsel-shell">
        <section class="counsel-hero">
          <div>
            <div class="counsel-eyebrow">Student Care Console</div>
            <h1>학생 상담 관리</h1>
            <p>상담 기록을 남기는 데서 끝나지 않고, 학생별 이력·위험 신호·후속 조치까지 이어지도록 설계했습니다.</p>
          </div>
          <div class="counsel-actions">
            <button class="btn btn-secondary" id="co-export">CSV 내보내기</button>
            <button class="btn btn-primary" id="co-add">+ 상담 기록</button>
          </div>
        </section>

        <section class="counsel-metrics">
          <div class="counsel-metric"><span>전체 상담</span><b id="co-m-total">0</b></div>
          <div class="counsel-metric danger"><span>높은 위험도</span><b id="co-m-risk">0</b></div>
          <div class="counsel-metric warn"><span>후속 예정/지연</span><b id="co-m-follow">0</b></div>
          <div class="counsel-metric good"><span>이번 달 상담</span><b id="co-m-month">0</b></div>
        </section>

        <section class="card counsel-filter-card">
          <input class="input" id="co-search" placeholder="학생 이름, 상담 주제, 내용, 후속 조치 검색">
          <select class="input" id="co-student-filter"><option value="">전체 학생</option></select>
          <select class="input" id="co-role-filter"><option value="">전체 역할</option>${ROLES.map(v => `<option>${esc(v)}</option>`).join("")}</select>
          <select class="input" id="co-domain-filter"><option value="">전체 분야</option></select>
          <select class="input" id="co-status-filter"><option value="">전체 상태</option>${STATUSES.map(v => `<option>${esc(v)}</option>`).join("")}</select>
          <select class="input" id="co-risk-filter"><option value="">전체 위험도</option>${RISKS.map(v => `<option>${esc(v)}</option>`).join("")}</select>
          <button class="btn btn-secondary" id="co-reset">초기화</button>
        </section>

        <section class="counsel-layout">
          <div class="counsel-list" id="co-list"></div>
          <aside class="card counsel-side">
            <h3>상담 품질 체크</h3>
            <div class="counsel-guide">
              <b>담임교사 관점</b>
              <span>생활, 출결, 교우관계, 보호자 연계, 학급 적응을 중심으로 학생의 전체 맥락을 봅니다.</span>
            </div>
            <div class="counsel-guide">
              <b>교과교사 관점</b>
              <span>수업 참여, 학습 습관, 과제·평가, 교과 이해도처럼 수업 안에서 보이는 변화를 기록합니다.</span>
            </div>
            <div class="counsel-guide">
              <b>상담교사 관점</b>
              <span>정서·심리, 위기 신호, 전문기관/보호자 연계, 지속 사례관리를 중심으로 봅니다.</span>
            </div>
            <div class="counsel-guide">
              <b>기록 원칙</b>
              <span>판단보다 사실, 낙인보다 관찰, 감정보다 학생의 실제 발화를 중심으로 적습니다.</span>
            </div>
            <div class="counsel-guide">
              <b>위기 신호</b>
              <span>자해·자살, 폭력, 가정 위기, 장기 결석, 급격한 정서 변화는 반드시 후속 조치를 남깁니다.</span>
            </div>
            <div class="counsel-guide">
              <b>후속 관리</b>
              <span>상담 후 “누가, 언제, 무엇을 확인할지”를 다음 조치에 구체적으로 남기면 관리가 쉬워집니다.</span>
            </div>
          </aside>
        </section>
      </div>
    `;
  }

  async function init() {
    studentsCache = await api.getStudents();
    const studentFilter = document.getElementById("co-student-filter");
    if (studentFilter) {
      studentFilter.innerHTML = '<option value="">전체 학생</option>' + studentsCache
        .map(s => `<option value="${s.id}">${esc(s.number)}번 ${esc(s.name)}</option>`)
        .join("");
    }

    document.getElementById("co-add").onclick = () => openEditorSimple(null);
    document.getElementById("co-export").onclick = exportCsv;
    const domainFilter = document.getElementById("co-domain-filter");
    if (domainFilter) domainFilter.innerHTML = '<option value="">전체 분야</option>' + renderDomainOptions("", "");
    document.getElementById("co-role-filter").onchange = () => {
      const role = document.getElementById("co-role-filter").value;
      document.getElementById("co-domain-filter").innerHTML = '<option value="">전체 분야</option>' + renderDomainOptions(role, "");
      refresh();
    };
    document.getElementById("co-reset").onclick = () => {
      ["co-search", "co-student-filter", "co-role-filter", "co-domain-filter", "co-status-filter", "co-risk-filter"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      document.getElementById("co-domain-filter").innerHTML = '<option value="">전체 분야</option>' + renderDomainOptions("", "");
      refresh();
    };
    ["co-search", "co-student-filter", "co-domain-filter", "co-status-filter", "co-risk-filter"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(id === "co-search" ? "input" : "change", refresh);
    });

    await refresh();
  }

  async function refresh() {
    const filters = getFilters();
    allRows = await api.getCounseling(filters);
    renderMetrics(allRows);
    renderList(allRows);
  }

  function buildAiCounselingContext(question) {
    const q = String(question || "").trim();
    const student = studentsCache.find(s => q.includes(String(s.name || "")));
    let rows = allRows || [];
    if (student) rows = rows.filter(r => Number(r.student_id) === Number(student.id) || String(r.name || "") === String(student.name || ""));
    if (!rows.length && student) rows = allRows.filter(r => String(r.name || "").includes(String(student.name || "")));
    rows = rows.slice(0, 5);
    return [
      "상담 페이지 저장 기록입니다. 아래 기록에 없는 내용은 추측하지 마세요.",
      student ? `질문 대상 학생: ${student.number || ""}번 ${student.name}` : "질문 대상 학생: 질문에서 특정 학생을 찾지 못함",
      rows.length ? rows.map((r, idx) => [
        `[상담기록 ${idx + 1}]`,
        `날짜: ${r.date || ""}`,
        `학생: ${studentLabel(r)}`,
        `역할/분야: ${(r.teacher_role || "")} / ${(r.domain || "")}`,
        `유형/상태/위험도: ${(r.type || "")} / ${(r.status || "")} / ${(r.risk_level || "")}`,
        `주제: ${r.topic || ""}`,
        `요약: ${r.summary || ""}`,
        `상담 내용: ${r.content || ""}`,
        `결과: ${r.result || ""}`,
        `기존 후속 조치: ${r.follow_up || ""}`,
        `다음 조치: ${r.next_action || ""}`,
        `후속 예정일: ${r.next_date || ""}`,
        `위험 신호: ${r.risk_flags || ""}`
      ].join("\n")).join("\n\n") : "해당 학생의 상담 기록을 찾지 못했습니다.",
      "",
      "답변 규칙:",
      "- 반드시 위 상담 기록에 근거해서만 답하세요.",
      "- 후속조치는 담임교사가 실제로 할 수 있는 행동으로 3~5개만 제안하세요.",
      "- 없는 정보를 만들지 말고, 확인이 필요한 항목은 '확인 필요'라고 쓰세요.",
      "- 학생에게 낙인 찍는 표현, 진단 표현, 과장된 표현은 금지합니다.",
      "- 답변은 한국어로만 작성하세요."
    ].join("\n");
  }

  window.appGetAiPageContext = function (question) {
    return buildAiCounselingContext(question);
  };

  function findCounselingRowsForQuestion(question) {
    const q = String(question || "").trim();
    const student = studentsCache.find(s => q.includes(String(s.name || "")));
    let rows = allRows || [];
    if (student) {
      rows = rows.filter(r => Number(r.student_id) === Number(student.id) || String(r.name || "") === String(student.name || ""));
      if (!rows.length) rows = (allRows || []).filter(r => String(r.name || "").includes(String(student.name || "")));
    }
    return { student, rows };
  }

  window.appGetAiDirectAnswer = null;

  function renderMetrics(rows) {
    const monthPrefix = todayStr().slice(0, 7);
    const high = rows.filter(r => r.risk_level === "높음").length;
    const follow = rows.filter(r => r.status !== "완료" && r.next_date && daysUntil(r.next_date) <= 7).length;
    const month = rows.filter(r => String(r.date || "").startsWith(monthPrefix)).length;
    document.getElementById("co-m-total").textContent = rows.length;
    document.getElementById("co-m-risk").textContent = high;
    document.getElementById("co-m-follow").textContent = follow;
    document.getElementById("co-m-month").textContent = month;
  }

  function renderList(rows) {
    const list = document.getElementById("co-list");
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = `<div class="card counsel-empty">조건에 맞는 상담 기록이 없습니다.</div>`;
      return;
    }
    list.innerHTML = rows.map(row => {
      const due = daysUntil(row.next_date);
      const dueText = row.next_date
        ? due < 0 ? `${Math.abs(due)}일 지연` : due === 0 ? "오늘 후속" : `${due}일 후 후속`
        : "후속일 없음";
      const flags = String(row.risk_flags || "").split(",").filter(Boolean);
      return `
        <article class="card counsel-card ${riskClass(row.risk_level)}">
          <div class="counsel-card-top">
            <div>
              <div class="counsel-date">${esc(row.date)} · ${esc(row.type || "개인")}</div>
              <h3>${esc(studentLabel(row))}</h3>
              <p>${esc(row.topic || row.summary || "상담 주제 미입력")}</p>
            </div>
            <div class="counsel-badges">
              <span class="counsel-role ${roleClass(row.teacher_role)}">${esc(row.teacher_role || "담임교사")}</span>
              ${row.domain ? `<span class="counsel-domain">${esc(row.domain)}</span>` : ""}
              <span class="counsel-risk ${riskClass(row.risk_level)}">${esc(row.risk_level || "낮음")}</span>
              <span class="counsel-status">${esc(row.status || "진행")}</span>
            </div>
          </div>
          <div class="counsel-card-body">
            <div><b>요약</b><span>${esc(row.summary || row.content || "-")}</span></div>
            <div><b>후속</b><span>${esc(row.next_action || row.follow_up || "-")} · ${esc(dueText)}</span></div>
          </div>
          ${flags.length ? `<div class="counsel-flags">${flags.map(f => `<span>${esc(f)}</span>`).join("")}</div>` : ""}
          <div class="counsel-card-actions">
            <button class="btn btn-secondary btn-xs" onclick="window.__coView(${row.id})">자세히</button>
            <button class="btn btn-primary btn-xs" onclick="window.__coEdit(${row.id})">수정</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function selectOptions(values, selected) {
    return values.map(v => `<option value="${esc(v)}" ${selected === v ? "selected" : ""}>${esc(v)}</option>`).join("");
  }

  function checkedFlags(value) {
    const selected = new Set(String(value || "").split(",").filter(Boolean));
    return RISK_FLAGS.map(flag => `
      <label class="counsel-check"><input type="checkbox" value="${esc(flag)}" ${selected.has(flag) ? "checked" : ""}> ${esc(flag)}</label>
    `).join("");
  }

  async function openEditor(row) {
    const isEdit = !!row;
    const r = row || { date: todayStr(), type: "개인", risk_level: "낮음", status: "진행" };
    showModal(`
      <div class="modal-header">
        <span class="modal-title">${isEdit ? "상담 기록 수정" : "상담 기록 추가"}</span>
        <button class="modal-close" data-close>✕</button>
      </div>
      <div class="modal-body counsel-modal">
        <div class="counsel-template-row">
          <select class="input" id="co-template"><option value="">역할별 상담 템플릿 불러오기</option>${Object.keys(TEMPLATES).map(k => `<option>${esc(k)}</option>`).join("")}</select>
          <button class="btn btn-secondary" id="co-apply-template">적용</button>
        </div>
        <div class="form-row row-3">
          <div><label>날짜</label><input class="input" type="date" id="co-d" value="${esc(r.date || todayStr())}"></div>
          <div><label>교사 역할</label><select class="input" id="co-role">${selectOptions(ROLES, r.teacher_role || "담임교사")}</select></div>
          <div><label>상담 분야</label><select class="input" id="co-domain">${renderDomainOptions(r.teacher_role || "담임교사", r.domain || "")}</select></div>
        </div>
        <div class="form-row row-3">
          <div><label>유형</label><select class="input" id="co-t">${selectOptions(TYPES, r.type || "개인")}</select></div>
          <div><label>상태</label><select class="input" id="co-status">${selectOptions(STATUSES, r.status || "진행")}</select></div>
          <div><label>학생</label><select class="input" id="co-s">
            <option value="">전체/미지정</option>
            ${studentsCache.map(s => `<option value="${s.id}" ${r.student_id === s.id ? "selected" : ""}>${esc(s.number)}번 ${esc(s.name)}</option>`).join("")}
          </select></div>
        </div>
        <div class="form-row row-2">
          <div><label>정서 상태</label><select class="input" id="co-mood"><option value="">선택 안 함</option>${selectOptions(MOODS, r.mood || "")}</select></div>
          <div><label>위험도</label><select class="input" id="co-risk">${selectOptions(RISKS, r.risk_level || "낮음")}</select></div>
        </div>
        <div class="form-row"><label>상담 주제</label><input class="input" id="co-topic" value="${esc(r.topic || "")}" placeholder="예: 교우관계 갈등, 학습 습관, 진로 고민"></div>
        <div class="form-row"><label>상담 요약</label><textarea class="input" id="co-summary" style="height:70px" placeholder="핵심 상황을 한두 문장으로 정리">${esc(r.summary || "")}</textarea></div>
        <div class="form-row"><label>상담 내용</label><textarea class="input" id="co-c" style="height:120px" placeholder="학생 발화, 관찰 사실, 상담 과정 중심으로 기록">${esc(r.content || "")}</textarea></div>
        <div class="form-row row-2">
          <div><label>결과</label><textarea class="input" id="co-r" style="height:80px">${esc(r.result || "")}</textarea></div>
          <div><label>후속 조치</label><textarea class="input" id="co-f" style="height:80px">${esc(r.follow_up || "")}</textarea></div>
        </div>
        <div class="form-row row-2">
          <div><label>다음 조치</label><input class="input" id="co-next-action" value="${esc(r.next_action || "")}" placeholder="예: 5월 8일 생활 변화 확인"></div>
          <div><label>후속 예정일</label><input class="input" type="date" id="co-next-date" value="${esc(r.next_date || "")}"></div>
        </div>
        <div class="form-row"><label>민감 메모</label><input class="input" id="co-private" value="${esc(r.confidential_note || "")}" placeholder="공유 전 재확인할 민감사항"></div>
        <div class="form-row">
          <label>위험 신호 체크</label>
          <div class="counsel-check-grid" id="co-risk-flags">${checkedFlags(r.risk_flags)}</div>
        </div>
        <div class="counsel-safety-note">위험도가 높거나 자해·폭력·가정 위기 신호가 있으면 앱 기록만으로 끝내지 말고 학교 절차에 따라 즉시 관리자/전문상담교사/보호자 연계를 검토하세요.</div>
      </div>
      <div class="modal-footer">
        ${isEdit ? `<button class="btn btn-danger" id="co-del">삭제</button>` : ""}
        <button class="btn btn-secondary" data-close>취소</button>
        <button class="btn btn-primary" id="co-sv">${isEdit ? "저장" : "추가"}</button>
      </div>
    `);

    document.getElementById("co-role").onchange = () => {
      const role = document.getElementById("co-role").value;
      document.getElementById("co-domain").innerHTML = renderDomainOptions(role, "");
    };
    document.getElementById("co-apply-template").onclick = () => applyTemplate();
    document.getElementById("co-sv").onclick = async () => saveRecord(r);
    if (isEdit) {
      document.getElementById("co-del").onclick = async () => {
        if (!confirm("이 상담 기록을 삭제할까요?")) return;
        await api.deleteCounseling(r.id);
        closeModal();
        await refresh();
      };
    }
  }

  async function openEditorSimple(row) {
    const isEdit = !!row;
    const r = row || { date: todayStr(), type: "개인", teacher_role: "담임교사", risk_level: "낮음", status: "진행" };
    showModal(`
      <div class="modal-header">
        <span class="modal-title">${isEdit ? "상담 기록 수정" : "상담 기록 추가"}</span>
        <button class="modal-close" data-close>×</button>
      </div>
      <div class="modal-body counsel-modal counsel-modal-simple">
        <div class="counsel-template-row">
          <select class="input" id="co-template"><option value="">상담 예시 불러오기</option>${Object.keys(TEMPLATES).map(k => `<option>${esc(k)}</option>`).join("")}</select>
          <button class="btn btn-secondary" id="co-apply-template">적용</button>
        </div>
        <div class="counsel-quick-note">빠른 기록은 학생, 역할/분야, 주제, 핵심 내용, 다음 조치만 입력하면 됩니다. 위험 신호나 세부 내용은 필요할 때만 펼쳐 입력하세요.</div>
        <div class="form-row row-2">
          <div><label>날짜</label><input class="input" type="date" id="co-d" value="${esc(r.date || todayStr())}"></div>
          <div><label>학생</label><select class="input" id="co-s">
            <option value="">전체/미지정</option>
            ${studentsCache.map(s => `<option value="${s.id}" ${r.student_id === s.id ? "selected" : ""}>${esc(s.number)}번 ${esc(s.name)}</option>`).join("")}
          </select></div>
        </div>
        <div class="form-row row-2">
          <div><label>교사 역할</label><select class="input" id="co-role">${selectOptions(ROLES, r.teacher_role || "담임교사")}</select></div>
          <div><label>상담 분야</label><select class="input" id="co-domain">${renderDomainOptions(r.teacher_role || "담임교사", r.domain || "")}</select></div>
        </div>
        <div class="form-row"><label>상담 주제</label><input class="input" id="co-topic" value="${esc(r.topic || "")}" placeholder="예: 교우관계 갈등, 학습 습관, 진로 고민"></div>
        <div class="form-row"><label>핵심 내용</label><textarea class="input" id="co-summary" style="height:96px" placeholder="학생 발화, 관찰 사실, 핵심 상황을 짧게 기록">${esc(r.summary || r.content || "")}</textarea></div>
        <div class="form-row row-2">
          <div><label>다음 조치</label><input class="input" id="co-next-action" value="${esc(r.next_action || "")}" placeholder="예: 관련 학생 개별 상담 후 재확인"></div>
          <div><label>후속 예정일</label><input class="input" type="date" id="co-next-date" value="${esc(r.next_date || "")}"></div>
        </div>
        <details class="counsel-advanced">
          <summary>상세 기록 / 위험 신호 입력</summary>
          <div class="form-row row-3">
            <div><label>유형</label><select class="input" id="co-t">${selectOptions(TYPES, r.type || "개인")}</select></div>
            <div><label>상태</label><select class="input" id="co-status">${selectOptions(STATUSES, r.status || "진행")}</select></div>
            <div><label>정서 상태</label><select class="input" id="co-mood"><option value="">선택 안 함</option>${selectOptions(MOODS, r.mood || "")}</select></div>
          </div>
          <div class="form-row row-2">
            <div><label>위험도</label><select class="input" id="co-risk">${selectOptions(RISKS, r.risk_level || "낮음")}</select></div>
            <div><label>민감 메모</label><input class="input" id="co-private" value="${esc(r.confidential_note || "")}" placeholder="공유 전 확인할 민감 사항"></div>
          </div>
          <div class="form-row"><label>상담 내용 상세</label><textarea class="input" id="co-c" style="height:110px" placeholder="학생 발화, 관찰 사실, 상담 과정 중심으로 기록">${esc(r.content || "")}</textarea></div>
          <div class="form-row row-2">
            <div><label>결과</label><textarea class="input" id="co-r" style="height:80px">${esc(r.result || "")}</textarea></div>
            <div><label>후속 조치 메모</label><textarea class="input" id="co-f" style="height:80px">${esc(r.follow_up || "")}</textarea></div>
          </div>
          <div class="form-row">
            <label>위험 신호 체크</label>
            <div class="counsel-check-grid" id="co-risk-flags">${checkedFlags(r.risk_flags)}</div>
          </div>
          <div class="counsel-safety-note">위험도가 높거나 자해·폭력·가정 위기 신호가 있으면 앱 기록만으로 끝내지 말고 학교 절차에 따라 즉시 관리자/전문상담교사/보호자 연계를 검토하세요.</div>
        </details>
      </div>
      <div class="modal-footer">
        ${isEdit ? `<button class="btn btn-danger" id="co-del">삭제</button>` : ""}
        <button class="btn btn-secondary" data-close>취소</button>
        <button class="btn btn-primary" id="co-sv">${isEdit ? "저장" : "추가"}</button>
      </div>
    `);

    document.getElementById("co-role").onchange = () => {
      const role = document.getElementById("co-role").value;
      document.getElementById("co-domain").innerHTML = renderDomainOptions(role, "");
    };
    document.getElementById("co-apply-template").onclick = () => applyTemplate();
    document.getElementById("co-sv").onclick = async () => saveRecord(r);
    if (isEdit) {
      document.getElementById("co-del").onclick = async () => {
        if (!confirm("이 상담 기록을 삭제할까요?")) return;
        await api.deleteCounseling(r.id);
        closeModal();
        await refresh();
      };
    }
  }

  function applyTemplate() {
    const key = document.getElementById("co-template").value;
    const t = TEMPLATES[key];
    if (!t) return;
    document.getElementById("co-role").value = t.role || "담임교사";
    document.getElementById("co-domain").innerHTML = renderDomainOptions(t.role || "담임교사", t.domain || "");
    document.getElementById("co-t").value = t.type || "개인";
    if (!document.getElementById("co-topic").value) document.getElementById("co-topic").value = t.topic || "";
    if (!document.getElementById("co-summary").value) document.getElementById("co-summary").value = t.summary || "";
    if (!document.getElementById("co-c").value) document.getElementById("co-c").value = t.content || "";
    if (!document.getElementById("co-r").value) document.getElementById("co-r").value = t.result || "";
    if (!document.getElementById("co-f").value) document.getElementById("co-f").value = t.follow_up || "";
    if (t.risk_level) document.getElementById("co-risk").value = t.risk_level;
    if (t.status) document.getElementById("co-status").value = t.status;
  }

  async function saveRecord(row) {
    const flags = Array.from(document.querySelectorAll("#co-risk-flags input:checked")).map(el => el.value);
    const data = {
      date: document.getElementById("co-d").value || todayStr(),
      type: document.getElementById("co-t").value,
      teacher_role: document.getElementById("co-role").value,
      domain: document.getElementById("co-domain").value,
      status: document.getElementById("co-status").value,
      student_id: parseInt(document.getElementById("co-s").value, 10) || null,
      mood: document.getElementById("co-mood").value,
      topic: document.getElementById("co-topic").value.trim(),
      summary: document.getElementById("co-summary").value.trim(),
      content: document.getElementById("co-c").value.trim(),
      result: document.getElementById("co-r").value.trim(),
      follow_up: document.getElementById("co-f").value.trim(),
      next_action: document.getElementById("co-next-action").value.trim(),
      next_date: document.getElementById("co-next-date").value,
      risk_level: document.getElementById("co-risk").value,
      risk_flags: flags.join(","),
      confidential_note: document.getElementById("co-private").value.trim()
    };
    if (!data.topic && !data.summary && !data.content) {
      toast("상담 주제나 내용을 입력해 주세요.", "warning");
      return;
    }
    if (row && row.id) await api.updateCounseling(row.id, data);
    else await api.addCounseling(data);
    toast("상담 기록이 저장되었습니다.", "success");
    closeModal();
    await refresh();
  }

  async function viewRecord(id) {
    const row = allRows.find(r => r.id === id) || (await api.getCounseling({})).find(r => r.id === id);
    if (!row) return;
    const flags = String(row.risk_flags || "").split(",").filter(Boolean);
    showModal(`
      <div class="modal-header"><span class="modal-title">상담 상세</span><button class="modal-close" data-close>✕</button></div>
      <div class="modal-body counsel-detail">
        <div class="counsel-detail-head">
          <div><b>${esc(studentLabel(row))}</b><span>${esc(row.date)} · ${esc(row.teacher_role || "담임교사")} · ${esc(row.domain || "분야 미지정")} · ${esc(row.type || "개인")} · ${esc(row.status || "진행")}</span></div>
          <span class="counsel-risk ${riskClass(row.risk_level)}">${esc(row.risk_level || "낮음")}</span>
        </div>
        ${detailBlock("상담 주제", row.topic)}
        ${detailBlock("요약", row.summary)}
        ${detailBlock("상담 내용", row.content)}
        ${detailBlock("결과", row.result)}
        ${detailBlock("후속 조치", row.follow_up)}
        ${detailBlock("다음 조치", [row.next_action, row.next_date].filter(Boolean).join(" · "))}
        ${flags.length ? `<div class="counsel-flags detail">${flags.map(f => `<span>${esc(f)}</span>`).join("")}</div>` : ""}
        ${row.confidential_note ? detailBlock("민감 메모", row.confidential_note) : ""}
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" data-close>닫기</button><button class="btn btn-primary" id="co-detail-edit">수정</button></div>
    `);
    document.getElementById("co-detail-edit").onclick = () => {
      closeModal();
      openEditorSimple(row);
    };
  }

  function detailBlock(label, value) {
    return `<div class="counsel-detail-block"><b>${esc(label)}</b><p>${esc(value || "-")}</p></div>`;
  }

  function exportCsv() {
    const header = ["날짜", "학생", "교사역할", "상담분야", "유형", "주제", "요약", "위험도", "위험신호", "상태", "후속예정일", "다음조치"];
    const lines = [header].concat(allRows.map(r => [
      r.date || "",
      studentLabel(r),
      r.teacher_role || "",
      r.domain || "",
      r.type || "",
      r.topic || "",
      r.summary || "",
      r.risk_level || "",
      r.risk_flags || "",
      r.status || "",
      r.next_date || "",
      r.next_action || ""
    ]));
    const csv = lines.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `상담기록_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  window.__coEdit = async (id) => {
    const row = allRows.find(r => r.id === id) || (await api.getCounseling({})).find(r => r.id === id);
    if (row) openEditorSimple(row);
  };
  window.__coView = viewRecord;

  window.registerPage("counseling", { render, init, refresh });
})();
