(function () {
  "use strict";

  const state = {
    school: [],
    grade: [],
    level: [],
    subject: [],
    curriculum: [],
    output: [],
    period: [],
    intro: [],
    slidecnt: [],
    pedagogy: [],
    visualization: [],
    design: ["노션"],
    tone: [],
    youtubes: [],
    youtubeOptions: {},
    pdfMaterials: [],
    pdfUseMode: ["core_source"]
  };

  const SINGLE_SELECT = new Set([
    "school", "grade", "level", "subject", "curriculum", "output",
    "period", "intro", "slidecnt", "design", "tone", "pdfUseMode"
  ]);

  const outputConfig = {
    google_slide: {
      label: "구글 슬라이드 기획안",
      defaultCount: "15",
      needsPeriod: true,
      needsSlideCount: true,
      supportsVisualization: true,
      hint: "Gemini Canvas에 붙여넣기 좋은 슬라이드 장면별 기획안 프롬프트를 만듭니다."
    },
    lesson_plan: {
      label: "수업 지도안",
      defaultCount: "",
      needsPeriod: true,
      needsSlideCount: false,
      supportsVisualization: false,
      hint: "Word/HWP로 옮기기 쉬운 문서형 수업 지도안 프롬프트를 만듭니다."
    },
    worksheet: {
      label: "학생용 학습지",
      defaultCount: "",
      needsPeriod: false,
      needsSlideCount: false,
      supportsVisualization: false,
      hint: "학생에게 바로 배포할 수 있는 활동지형 프롬프트를 만듭니다."
    },
    summary: {
      label: "핵심 요약노트",
      defaultCount: "",
      needsPeriod: false,
      needsSlideCount: false,
      supportsVisualization: false,
      hint: "핵심 개념, 예시, 오개념 주의점을 정리하는 요약노트 프롬프트를 만듭니다."
    }
  };

  const subjectGroups = [
    ["공통 교과", [
      ["국어", "국어"], ["문학", "문학"], ["실용국어", "실용국어"], ["수학", "수학"], ["경영수학", "경영수학"],
      ["영어", "영어"], ["실용영어", "실용영어"], ["국사", "국사"], ["사회", "사회"], ["과학", "과학"], ["생명과학", "생명과학"]
    ]],
    ["예체능", [
      ["체육", "체육"], ["스포츠", "스포츠"], ["음악", "음악"], ["미술", "미술"]
    ]],
    ["교양 / 기타", [
      ["자율", "자율"], ["진로", "진로"], ["동아", "동아"], ["한문", "한문"]
    ]],
    ["상업 / 특성화 계열", [
      ["회계", "회계"], ["회계실무", "회계실무"], ["금융", "금융"], ["국제", "국제"], ["창구", "창구"],
      ["기업", "기업"], ["행정", "행정"], ["사무", "사무"], ["상업", "상업"], ["유통", "유통"],
      ["유통관리", "유통관리"], ["비즈니스", "비즈니스"], ["창업", "창업"]
    ]],
    ["IT / 컴퓨터 계열", [
      ["소프트웨어앱개발", "소프트웨어앱개발"], ["시스템프로그래밍", "시스템프로그래밍"], ["데이터베이스", "데이터베이스"],
      ["알고리즘", "알고리즘"], ["컴퓨터일반", "컴퓨터일반"], ["응용프로그래밍", "응용프로그래밍"], ["빅데이터", "빅데이터"]
    ]],
    ["관광 / 조리 / 서비스 계열", [
      ["바리스타", "바리스타"], ["객실서비스", "객실서비스"], ["식음료서비스", "식음료서비스"], ["관광서비스", "관광서비스"],
      ["여행", "여행"], ["제과", "제과"], ["제빵", "제빵"], ["한식", "한식"], ["양식", "양식"], ["중식", "중식"], ["떡제조", "떡제조"], ["식품", "식품"]
    ]]
  ];

  const designPrompts = {
    "배민": "Baemin style — mint green palette, rounded playful Korean typography, witty sticker-style cards, friendly hand-drawn illustrations throughout.",
    "토스": "Toss style — crisp white background, bold blue accent color, generous whitespace, clean card-based layout as precise as a fintech app.",
    "쿠팡": "Coupang style — strong red and navy, large hero banners, high-contrast highlight boxes, fast-scan promotional rhythm on every slide.",
    "당근": "Karrot style — warm orange accent, neighborhood community feel, soft rounded cards, conversational and approachable text flow.",
    "네이버": "Naver style — green accent, structured portal-like information hierarchy, clean service-UI aesthetic with clearly delineated content zones.",
    "넷플릭스": "Netflix style — pure black background, bold red accent, cinematic full-bleed hero images, poster-style card grids, high drama contrast.",
    "애플": "Apple style — expansive whitespace, restrained neutral palette, oversized hero typography, premium product-keynote layout with surgical precision.",
    "스포티파이": "Spotify style — dark UI with deep charcoal backgrounds, vibrant green accent, playlist/album card rhythm, youthful and energetic visual beats.",
    "노션": "Notion style — document-block layout, callout boxes, checklists, table structures; organized like a knowledge base with calm off-white tones.",
    "오픈AI": "OpenAI style — soft off-white and graphite tones, research-report cards, minimalist system diagrams, futuristic yet understated aesthetic.",
    "유튜브": "YouTube style — thumbnail-first visual hierarchy, video card grids, play-button motifs, creator-content rhythm with bold title overlays.",
    "클래식": "Classic style — chalkboard green, ivory and kraft-paper tones, notebook textures, timeless classroom material design with stable readability."
  };

  const tonePrompts = {
    "친근한": "학생에게 가까이 말하듯 쉽고 따뜻하게 설명합니다.",
    "전문적인": "정확한 용어와 체계적인 문장으로 신뢰감 있게 작성합니다.",
    "격려하는": "학생의 자신감을 높이는 피드백과 참여 유도 문장을 포함합니다.",
    "차분한": "불필요한 과장을 줄이고 안정적인 속도로 설명합니다.",
    "분석적인": "개념, 근거, 비교, 원인과 결과를 분명히 나눠 설명합니다.",
    "열정적인": "수업 몰입을 높이는 활기 있는 표현과 동기부여 문장을 사용합니다.",
    "권위있는": "공식 수업 자료에 어울리는 단정하고 확신 있는 어조를 사용합니다.",
    "유머러스한": "가벼운 유머를 섞되 수업의 명확성과 품격은 유지합니다.",
    "스토리텔링형": "상황과 흐름이 있는 이야기 구조로 개념을 설명합니다.",
    "코칭형": "교사가 옆에서 단계별로 안내하듯 행동 지시와 피드백을 제공합니다."
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function tag(group, key, label) {
    return `<button type="button" class="lm-tag" data-group="${esc(group)}" data-key="${esc(key)}">${esc(label)}</button>`;
  }

  function block(id, num, title, body, activeClass) {
    return [
      `<section class="lm-block ${activeClass || ""}" id="${id}">`,
      `<div class="lm-step"><span>${num}</span><b>${title}</b></div>`,
      body,
      `</section>`
    ].join("");
  }

  function subjectHtml() {
    return subjectGroups.map(([title, items]) => [
      `<div class="lm-subtitle">${esc(title)}</div>`,
      `<div class="lm-tags">${items.map(([key, label]) => tag("subject", key, label)).join("")}</div>`
    ].join("")).join("");
  }

  async function render(container) {
    container.innerHTML = [
      `<style>${styles()}</style>`,
      `<div class="lm-page">`,
      `  <section class="lm-hero">`,
      `    <div>`,
      `      <div class="lm-kicker">AI Studio</div>`,
      `      <h1>수업자료제작</h1>`,
      `      <p>주제와 조건을 고르면 Gemini Canvas에 바로 붙여넣을 수 있는 수업 콘텐츠 제작 프롬프트를 만들어줍니다.</p>`,
      `    </div>`,
      `    <div class="lm-guide-card">`,
      `      <b>사용법</b>`,
      `      <ol>`,
      `        <li>Gemini 접속</li>`,
      `        <li>로그인</li>`,
      `        <li>Canvas 선택</li>`,
      `        <li>복사한 프롬프트 붙여넣기</li>`,
      `      </ol>`,
      `      <div class="lm-hero-actions">`,
      `        <button type="button" class="btn btn-secondary btn-sm" id="lm-open-gemini">Gemini 열기</button>`,
      `        <button type="button" class="lm-reset-btn" id="lm-reset">초기화</button>`,
      `      </div>`,
      `    </div>`,
      `  </section>`,
      `  <div class="lm-tabs">`,
      `    <button type="button" class="lm-tab active" data-tab="builder">마스터 빌더</button>`,
      `    <button type="button" class="lm-tab" data-tab="guide">사용 설명서</button>`,
      `  </div>`,
      `  <div id="lm-builder" class="lm-workspace">`,
      `    <div class="lm-builder">`,
      block("lm-topic-block", "01", "수업 주제 입력", [
        `<p class="lm-help">구체적이고 자세한 주제를 입력할수록 결과 품질이 좋아집니다.</p>`,
        `<textarea class="lm-topic" id="lm-topic" placeholder="예) 금융상품의 이자 계산과 실생활 적용"></textarea>`,
        `<p class="lm-help">팁: 과목명, 단원명, 실제 수업에서 다룰 핵심 개념을 함께 적어주세요.</p>`
      ].join(""), "lm-topic-block"),
      block("lm-school-block", "02", "학교급 선택", `<div class="lm-tags">${tag("school", "고등학교", "고등학교")}${tag("school", "중학교", "중학교")}</div>`),
      block("lm-target-block", "03", "대상 학년 및 난이도", [
        `<div class="lm-subtitle">학년</div><div class="lm-tags">${["1학년", "2학년", "3학년"].map((v) => tag("grade", v, v)).join("")}</div>`,
        `<div class="lm-subtitle">수준</div><div class="lm-tags">${["기초보충", "보통", "심화"].map((v) => tag("level", v, v)).join("")}</div>`
      ].join("")),
      block("lm-subject-block", "04", "과목 선택", subjectHtml()),
      block("lm-curr-block", "05", "적용 교육과정", `<div class="lm-tags">${tag("curriculum", "2022 개정", "2022 개정")}${tag("curriculum", "2015 개정", "2015 개정")}</div>`),
      block("lm-output-block", "06", "최종 결과물 형태", [
        `<div class="lm-tags">`,
        tag("output", "google_slide", "구글 슬라이드 기획안"),
        tag("output", "lesson_plan", "수업 지도안"),
        tag("output", "worksheet", "학생용 학습지"),
        tag("output", "summary", "핵심 요약노트"),
        `</div>`,
        `<div class="lm-note" id="lm-output-note">결과물 형식을 선택하면 필요한 옵션만 자동으로 보여줍니다.</div>`
      ].join("")),
      block("lm-period-block", "07", "수업 차시 및 구성", [
        `<p class="lm-help">몇 차시 분량의 수업을 준비할지 선택하세요.</p>`,
        `<div class="lm-tags">${["1차시", "2차시", "3차시", "4차시"].map((v) => tag("period", v, v)).join("")}</div>`,
        `<div class="lm-subtitle">도입 방식 선택</div>`,
        `<div class="lm-tags">${["질문", "예시", "사례", "문제"].map((v) => tag("intro", v, v)).join("")}</div>`
      ].join("")),
      block("lm-slide-block", "08", "슬라이드 제작 분량", `<div class="lm-tags lm-counts">${Array.from({ length: 11 }, (_, i) => String(i + 10)).map((v) => tag("slidecnt", v, `${v}장`)).join("")}</div>`),
      block("lm-pedagogy-block", "09", "교수법 및 전략", [
        `<div class="lm-tags">`,
        ["강의식", "소크라테스식", "협동학습", "소그룹토의", "하브루타", "피어러닝", "PBL", "케이스스터디", "실습중심", "플립러닝", "게이미피케이션", "탐구학습", "역할극", "토론식", "발표식"].map((v) => tag("pedagogy", v, v)).join(""),
        `</div>`
      ].join("")),
      block("lm-visual-block", "10", "시각화 자료 강화", `<div class="lm-tags">${[
        ["infographic", "인포그래픽"], ["diagram", "다이어그램"], ["illustration", "일러스트/아이콘"], ["photo", "사진/실제 이미지"], ["animation", "애니메이션 효과"]
      ].map(([k, v]) => tag("visualization", k, v)).join("")}</div>`),
      block("lm-youtube-block", "11", "유튜브 연계 및 분석", [
        `<div class="lm-youtube-row"><input id="lm-youtube-input" class="input" placeholder="유튜브 주소 입력"><button type="button" class="btn btn-primary btn-sm" id="lm-youtube-add">추가</button></div>`,
        `<div id="lm-youtube-list" class="lm-youtube-list"></div>`
      ].join("")),
      block("lm-pdf-block", "12", "PDF 수업자료 연계", [
        `<p class="lm-help">선생님이 가진 수업자료 PDF를 Gemini Canvas에 함께 첨부할 때, 그 PDF를 어떻게 분석해야 하는지 프롬프트에 추가합니다. 쌤포트는 PDF 내용을 외부로 보내지 않고 파일명만 표시합니다.</p>`,
        `<div class="lm-pdf-picker"><input id="lm-pdf-input" type="file" accept="application/pdf,.pdf" multiple><span id="lm-pdf-empty">PDF를 선택하면 프롬프트에 첨부 지시문이 추가됩니다.</span></div>`,
        `<div class="lm-subtitle">PDF 활용 방식</div>`,
        `<div class="lm-tags">${[
          ["core_source", "PDF를 핵심 원자료로 분석"],
          ["extract_examples", "예시/문항 추출"],
          ["restructure", "수업 흐름으로 재구성"],
          ["make_assessment", "형성평가 문항 생성"]
        ].map(([k, v]) => tag("pdfUseMode", k, v)).join("")}</div>`,
        `<div id="lm-pdf-list" class="lm-pdf-list"></div>`
      ].join("")),
      block("lm-style-block", "13", "디자인 및 어조", [
        `<div class="lm-subtitle">디자인 스타일</div><div class="lm-tags">${Object.keys(designPrompts).map((v) => tag("design", v, v)).join("")}</div>`,
        `<div class="lm-subtitle">어조</div><div class="lm-tags">${Object.keys(tonePrompts).map((v) => tag("tone", v, v)).join("")}</div>`
      ].join("")),
      `    </div>`,
      `    <aside class="lm-preview">`,
      `      <div class="lm-preview-scroll">`,
      `        ${previewBox("User Topic", "lm-pv-topic")}`,
      `        ${previewBox("Main Logic", "lm-pv-logic")}`,
      `        ${previewBox("Class Structure", "lm-pv-structure")}`,
      `        ${previewBox("Material Config", "lm-pv-config")}`,
      `        ${previewBox("Visual / YouTube / PDF", "lm-pv-visual")}`,
      `      </div>`,
      `      <div class="lm-copy-panel">`,
      `        <button type="button" class="lm-copy-btn" id="lm-copy">프롬프트 생성 & 복사</button>`,
      `        <p>복사 후 Gemini 로그인 → Canvas 선택 → PDF 첨부(선택) → 프롬프트 붙여넣기 순서로 사용하세요.</p>`,
      `      </div>`,
      `    </aside>`,
      `  </div>`,
      `  <section id="lm-guide" class="lm-guide" style="display:none">`,
      `    <h2>사용 설명서</h2>`,
      `    <div class="lm-guide-steps">`,
      `      <div><b>1. Gemini 접속</b><span>브라우저에서 Gemini를 열고 Google 계정으로 로그인합니다.</span></div>`,
      `      <div><b>2. Canvas 선택</b><span>Gemini 화면에서 Canvas를 선택해 긴 결과물을 만들 준비를 합니다.</span></div>`,
      `      <div><b>3. PDF 첨부</b><span>PDF 수업자료가 있으면 Gemini Canvas에 PDF를 먼저 첨부합니다.</span></div>`,
      `      <div><b>4. 붙여넣기</b><span>쌤포트에서 복사한 프롬프트를 Gemini Canvas에 붙여넣고 생성합니다.</span></div>`,
      `    </div>`,
      `    <div class="lm-warning"><b>주의</b><br>학생 개인정보, 상담 내용, 성적 등 민감정보는 프롬프트나 PDF에 넣지 마세요. 수업자료 제작에는 단원명, 개념, 수업 활동 조건만 입력하는 것이 안전합니다.</div>`,
      `  </section>`,
      `</div>`
    ].join("");
  }

  function previewBox(label, id) {
    return `<div class="lm-preview-box"><div class="lm-preview-label">${label}</div><pre id="${id}"></pre></div>`;
  }

  function init() {
    const root = document.querySelector(".lm-page");
    if (!root) return;

    root.querySelectorAll(".lm-tag").forEach((button) => {
      button.addEventListener("click", () => toggleTag(button));
    });
    syncTagState();

    const topic = document.getElementById("lm-topic");
    if (topic) topic.addEventListener("input", updateUI);

    const addYoutube = document.getElementById("lm-youtube-add");
    if (addYoutube) addYoutube.addEventListener("click", addYoutubeUrl);

    const youtubeInput = document.getElementById("lm-youtube-input");
    if (youtubeInput) {
      youtubeInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addYoutubeUrl();
        }
      });
    }

    const pdfInput = document.getElementById("lm-pdf-input");
    if (pdfInput) pdfInput.addEventListener("change", handlePdfFiles);

    document.querySelectorAll(".lm-tab").forEach((button) => {
      button.addEventListener("click", () => switchLocalTab(button.dataset.tab));
    });

    const openGemini = document.getElementById("lm-open-gemini");
    if (openGemini) openGemini.addEventListener("click", () => window.open("https://gemini.google.com/", "_blank"));

    const copy = document.getElementById("lm-copy");
    if (copy) copy.addEventListener("click", generateAndCopy);

    const reset = document.getElementById("lm-reset");
    if (reset) reset.addEventListener("click", resetState);

    updateUI();
  }

  function syncTagState() {
    document.querySelectorAll(".lm-tag").forEach((button) => {
      const group = button.dataset.group;
      button.classList.toggle("on", Array.isArray(state[group]) && state[group].includes(button.dataset.key));
    });
  }

  function switchLocalTab(tab) {
    document.querySelectorAll(".lm-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    document.getElementById("lm-builder").style.display = tab === "builder" ? "grid" : "none";
    document.getElementById("lm-guide").style.display = tab === "guide" ? "block" : "none";
  }

  function toggleTag(button) {
    const group = button.dataset.group;
    const key = button.dataset.key;
    const current = state[group] || [];

    if (SINGLE_SELECT.has(group)) {
      const isOn = current.includes(key);
      document.querySelectorAll(`.lm-tag[data-group="${group}"]`).forEach((el) => el.classList.remove("on"));
      state[group] = isOn ? [] : [key];
      if (!isOn) button.classList.add("on");
      if (group === "output") normalizeOutputState();
    } else if (current.includes(key)) {
      state[group] = current.filter((value) => value !== key);
      button.classList.remove("on");
    } else {
      state[group] = current.concat([key]);
      button.classList.add("on");
    }
    updateUI();
  }

  function getOutputCfg() {
    return outputConfig[state.output[0]] || outputConfig.summary;
  }

  function normalizeOutputState() {
    const cfg = getOutputCfg();
    if (!cfg.needsSlideCount) state.slidecnt = [];
    if (!cfg.supportsVisualization) state.visualization = [];
    if (!cfg.needsPeriod) {
      state.period = [];
      state.intro = [];
    }
    ["slidecnt", "visualization", "period", "intro"].forEach((group) => {
      document.querySelectorAll(`.lm-tag[data-group="${group}"]`).forEach((el) => el.classList.toggle("on", state[group].includes(el.dataset.key)));
    });
  }

  function updateUI() {
    const cfg = getOutputCfg();
    const periodBlock = document.getElementById("lm-period-block");
    const slideBlock = document.getElementById("lm-slide-block");
    const visualBlock = document.getElementById("lm-visual-block");
    if (periodBlock) periodBlock.style.display = cfg.needsPeriod ? "" : "none";
    if (slideBlock) slideBlock.style.display = cfg.needsSlideCount ? "" : "none";
    if (visualBlock) visualBlock.style.display = cfg.supportsVisualization ? "" : "none";

    const note = document.getElementById("lm-output-note");
    if (note) note.textContent = cfg.hint;

    updatePreview();
    updateYoutubeList();
    updatePdfList();
    updateHighlights();
  }

  function updatePreview() {
    const topic = (document.getElementById("lm-topic") || {}).value || "";
    const cfg = getOutputCfg();
    const schoolMap = { "고등학교": "고등학생", "중학교": "중학생" };
    setPreview("lm-pv-topic", topic || "(주제 입력 대기 중)");
    setPreview("lm-pv-logic", `${schoolMap[state.school[0]] || "학생"} / ${state.subject[0] || "(과목 미선택)"} / ${state.curriculum[0] || "2022 개정"} / ${state.grade[0] || "(학년 미선택)"} / ${state.level[0] || "(수준 미선택)"}`);
    setPreview("lm-pv-structure", state.period[0] ? `${state.period[0]}\n도입방식: ${state.intro[0] || "주제에 맞게 자동 구성"}\n흐름: 도입 → 전개 → 정리` : (cfg.needsPeriod ? "(차시 선택 대기 중)" : `${cfg.label}\n문서형 결과물`));
    setPreview("lm-pv-config", `${cfg.label}${cfg.needsSlideCount ? `\n분량: ${state.slidecnt[0] || cfg.defaultCount}장` : ""}\n전략: ${state.pedagogy.join(", ") || "(미선택)"}`);

    const visual = [];
    if (state.visualization.length) visual.push(`시각화: ${state.visualization.join(", ")}`);
    if (state.youtubes.length) visual.push(`유튜브: ${state.youtubes.length}개`);
    if (state.pdfMaterials.length) visual.push(`PDF 자료: ${state.pdfMaterials.map((file) => file.name).join(", ")}`);
    if (state.design.length) visual.push(`디자인: ${state.design[0]}`);
    if (state.tone.length) visual.push(`어조: ${state.tone[0]}`);
    setPreview("lm-pv-visual", visual.join("\n") || "(미설정)");
  }

  function setPreview(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updateHighlights() {
    const map = {
      "lm-school-block": ["school"],
      "lm-target-block": ["grade", "level"],
      "lm-subject-block": ["subject"],
      "lm-curr-block": ["curriculum"],
      "lm-output-block": ["output"],
      "lm-period-block": ["period", "intro"],
      "lm-slide-block": ["slidecnt"],
      "lm-pedagogy-block": ["pedagogy"],
      "lm-visual-block": ["visualization"],
      "lm-pdf-block": ["pdfUseMode"],
      "lm-style-block": ["design", "tone"]
    };
    Object.keys(map).forEach((id) => {
      const block = document.getElementById(id);
      if (!block) return;
      block.classList.toggle("active", map[id].some((group) => state[group].length));
    });
    const yt = document.getElementById("lm-youtube-block");
    if (yt) yt.classList.toggle("active", state.youtubes.length > 0);
    const pdf = document.getElementById("lm-pdf-block");
    if (pdf) pdf.classList.toggle("active", state.pdfMaterials.length > 0);
  }

  function handlePdfFiles(event) {
    const files = Array.from(event.target.files || []).filter((file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf");
    state.pdfMaterials = files.map((file) => ({ name: file.name, size: file.size }));
    updateUI();
  }

  function updatePdfList() {
    const list = document.getElementById("lm-pdf-list");
    const empty = document.getElementById("lm-pdf-empty");
    if (!list) return;
    if (!state.pdfMaterials.length) {
      list.innerHTML = "";
      if (empty) empty.style.display = "";
      return;
    }
    if (empty) empty.style.display = "none";
    list.innerHTML = state.pdfMaterials.map((file, index) => `
      <div class="lm-pdf-item">
        <span>${index + 1}. ${esc(file.name)}</span>
        <button type="button" data-remove-pdf="${index}">삭제</button>
      </div>
    `).join("");
    list.querySelectorAll("button[data-remove-pdf]").forEach((button) => {
      button.addEventListener("click", () => {
        state.pdfMaterials.splice(Number(button.dataset.removePdf), 1);
        const input = document.getElementById("lm-pdf-input");
        if (input && !state.pdfMaterials.length) input.value = "";
        updateUI();
      });
    });
  }

  function addYoutubeUrl() {
    const input = document.getElementById("lm-youtube-input");
    const url = input ? input.value.trim() : "";
    if (!url) {
      toast("유튜브 링크를 입력해 주세요.", "warning");
      return;
    }
    if (!/youtube\.com|youtu\.be/.test(url)) {
      toast("youtube.com 또는 youtu.be 링크만 추가할 수 있습니다.", "warning");
      return;
    }
    state.youtubes.push(url);
    state.youtubeOptions[url] = "content_summary";
    input.value = "";
    updateUI();
  }

  function updateYoutubeList() {
    const list = document.getElementById("lm-youtube-list");
    if (!list) return;
    list.innerHTML = state.youtubes.map((url, index) => `
      <div class="lm-youtube-item">
        <div>
          <b>${index + 1}. ${esc(url.length > 60 ? url.slice(0, 60) + "..." : url)}</b>
          <select data-yt-index="${index}">
            <option value="content_summary"${state.youtubeOptions[url] === "content_summary" ? " selected" : ""}>내용 요약</option>
            <option value="url_attach"${state.youtubeOptions[url] === "url_attach" ? " selected" : ""}>영상 주소 첨부</option>
            <option value="visual_heavy"${state.youtubeOptions[url] === "visual_heavy" ? " selected" : ""}>시각화 강화</option>
            <option value="discussion"${state.youtubeOptions[url] === "discussion" ? " selected" : ""}>토론자료화</option>
          </select>
        </div>
        <button type="button" data-remove-yt="${index}">삭제</button>
      </div>
    `).join("");

    list.querySelectorAll("select[data-yt-index]").forEach((select) => {
      select.addEventListener("change", () => {
        const url = state.youtubes[Number(select.dataset.ytIndex)];
        state.youtubeOptions[url] = select.value;
        updatePreview();
      });
    });
    list.querySelectorAll("button[data-remove-yt]").forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.removeYt);
        const url = state.youtubes[index];
        delete state.youtubeOptions[url];
        state.youtubes.splice(index, 1);
        updateUI();
      });
    });
  }

  function buildOutputInstruction(outputKey, count) {
    if (outputKey === "google_slide") return `형식: 구글 슬라이드용 상세 기획안\n분량: 정확히 ${count}장의 슬라이드 구조`;
    if (outputKey === "lesson_plan") return "형식: Word/HWP로 옮기기 쉬운 수업 지도안\n분량: 표제, 학습목표, 성취기준, 교수학습 과정안, 평가 계획까지 포함";
    if (outputKey === "worksheet") return "형식: Word/HWP로 옮기기 쉬운 학생용 학습지\n분량: 활동 안내, 문제, 작성 공간, 정리 문항 포함";
    return "형식: Word/HWP로 옮기기 쉬운 핵심 요약노트\n분량: 핵심 개념, 예시, 암기 포인트 정리";
  }

  function generatePrompt() {
    const topic = (document.getElementById("lm-topic") || {}).value.trim();
    const outputKey = state.output[0];
    const cfg = getOutputCfg();
    const count = state.slidecnt[0] || cfg.defaultCount;
    const schoolMap = { "고등학교": "고등학생", "중학교": "중학생" };
    const introGuide = {
      "질문": "개방형 질문으로 학생들의 사고를 깨우는 도입",
      "예시": "생활 속 예시나 구체적 상황을 활용한 도입",
      "사례": "실제 사례나 뉴스 기반의 현실 연결형 도입",
      "문제": "해결해야 할 문제 상황을 제시하는 도입"
    };

    let prompt = `[INSTRUCTION: 교육 콘텐츠 생성]`;

    if (state.design.length) {
      prompt += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[DESIGN SYSTEM — MANDATORY, NON-NEGOTIABLE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Brand: ${state.design[0]}
${designPrompts[state.design[0]]}

This is NOT a suggestion — it is a strict rule.
Apply this brand's visual language consistently across EVERY slide, section, card, and background:
colors, typography, spacing ratios, card shapes, image direction, and accent colors.
Reverting to a generic white background or neutral default style is a violation of this instruction.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    prompt += `

주제:
${topic}

기본 정보:
대상: ${schoolMap[state.school[0]]} / ${state.grade[0] || "N/A"} / 난이도: ${state.level[0] || "N/A"}
과목: ${state.subject[0]}
${buildOutputInstruction(outputKey, count)}
교육과정: ${state.curriculum[0] || "2022 개정"}

콘텐츠 방향:
실제 수업 현장에서 바로 사용할 수 있는 완성본으로 작성하세요.
플레이스홀더나 [내용 입력], [이미지 삽입] 같은 빈 안내 문구는 절대 쓰지 마세요.

교수법 및 전략:
${state.pedagogy.join(", ") || "기본 강의식 + 학생 참여형 질문"}`;

    if (state.period[0]) {
      prompt += `

수업 구성 (${state.period[0]}):
도입: ${state.intro[0] ? `${introGuide[state.intro[0]]} + 학습목표 제시` : "주제에 맞는 자연스러운 도입과 학습목표 제시"}
전개: 개념 설명, 활동, 사례, 적용, 피드백이 단계적으로 이어지도록 구성
정리: 핵심 내용 정리, 형성평가 또는 회고, 다음 학습과의 연결`;
    }

    if (state.tone.length) {
      prompt += `

어조:
${state.tone[0]} - ${tonePrompts[state.tone[0]]}`;
    }

    if (state.visualization.length) {
      prompt += `

시각화 요소:
${state.visualization.map((value) => `- ${value}`).join("\n")}`;
    }

    if (state.youtubes.length) {
      const optionGuide = {
        content_summary: "영상의 핵심 내용을 분석하여 수업 자료에 통합",
        url_attach: "직접 시청용 링크 또는 QR 흐름으로 첨부",
        visual_heavy: "영상의 장면과 분위기를 시각 자료 설계에 반영",
        discussion: "토론 질문, 활동 지시, 사고 확장 과제로 전환"
      };
      prompt += `

참고 영상:
${state.youtubes.map((url, index) => `${index + 1}. ${url}\n   활용: ${optionGuide[state.youtubeOptions[url]] || "내용 요약"}`).join("\n")}`;
    }

    if (state.pdfMaterials.length) {
      const pdfGuide = {
        core_source: "첨부 PDF를 핵심 원자료로 삼아 주요 개념, 용어, 흐름, 예시를 먼저 추출한 뒤 결과물을 구성하세요.",
        extract_examples: "첨부 PDF에서 수업에 바로 쓸 수 있는 예시, 문제, 사례, 표, 그림 설명을 추출해 결과물에 반영하세요.",
        restructure: "첨부 PDF의 내용을 그대로 나열하지 말고 도입-전개-정리 수업 흐름에 맞게 재구성하세요.",
        make_assessment: "첨부 PDF 내용을 바탕으로 형성평가, 확인 문제, 서술형 질문, 정답 또는 예시 답안을 생성하세요."
      };
      prompt += `

첨부 PDF 수업자료 분석 지시:
Gemini Canvas에 아래 PDF를 함께 첨부할 예정입니다. 첨부된 PDF를 반드시 먼저 읽고 분석한 뒤 결과물을 만드세요.
첨부 예정 PDF:
${state.pdfMaterials.map((file, index) => `${index + 1}. ${file.name}`).join("\n")}

PDF 활용 방식:
${pdfGuide[state.pdfUseMode[0]] || pdfGuide.core_source}

PDF 분석 기준:
- PDF의 핵심 개념, 단원 흐름, 중요한 표/그림/예시를 요약하세요.
- PDF에 없는 내용은 임의로 교과서 원문처럼 꾸미지 말고, 필요한 경우 "추가 설명"으로 구분하세요.
- PDF 내용을 학생 수준에 맞게 재구성하되 원자료의 의미를 왜곡하지 마세요.
- 슬라이드/지도안/학습지에 PDF 기반 활동과 질문을 최소 2개 이상 포함하세요.`;
    }

    prompt += `

필수 조건:
- 각 단락 또는 장면마다 학습목표, 핵심개념, 구체적 사례가 드러나야 합니다.
- 학생 수준에 맞는 표현과 난이도를 유지하세요.
- 실제 교사가 바로 쓸 수 있는 현실적인 구성으로 작성하세요.
- 결과물이 ${cfg.label} 형식에 맞게 완성되어야 합니다.
- 학생 개인정보, 상담 내용, 성적 등 민감정보는 포함하지 마세요.

[Gemini: Canvas에서 생성]`;
    return prompt;
  }

  function resetState() {
    state.school = [];
    state.grade = [];
    state.level = [];
    state.subject = [];
    state.curriculum = [];
    state.output = [];
    state.period = [];
    state.intro = [];
    state.slidecnt = [];
    state.pedagogy = [];
    state.visualization = [];
    state.design = ["노션"];
    state.tone = [];
    state.youtubes = [];
    state.youtubeOptions = {};
    state.pdfMaterials = [];
    state.pdfUseMode = ["core_source"];
    const topic = document.getElementById("lm-topic");
    if (topic) topic.value = "";
    const pdfInput = document.getElementById("lm-pdf-input");
    if (pdfInput) pdfInput.value = "";
    syncTagState();
    updateUI();
    toast("초기화되었습니다.", "info");
  }

  function generateAndCopy() {
    const topic = (document.getElementById("lm-topic") || {}).value.trim();
    const cfg = getOutputCfg();
    if (!topic || !state.school.length || !state.subject.length || !state.output.length) {
      toast("필수 항목: 주제, 학교급, 과목, 결과물 형태를 선택해 주세요.", "warning", 3500);
      return;
    }
    if (cfg.needsPeriod && !state.period.length) {
      toast("이 결과물은 차시 선택이 필요합니다.", "warning", 3000);
      return;
    }
    const prompt = generatePrompt();
    navigator.clipboard.writeText(prompt).then(() => {
      toast("프롬프트를 복사했습니다. Gemini 로그인 → Canvas 선택 → PDF 첨부(선택) → 붙여넣기 순서로 사용하세요.", "success", 4500);
    }).catch(() => {
      const area = document.createElement("textarea");
      area.value = prompt;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      toast("프롬프트를 복사했습니다.", "success");
    });
  }

  function styles() {
    return `
      .lm-page{padding:24px;background:#f7f7f5;min-height:100%;color:#37352f}
      .lm-hero{display:flex;justify-content:space-between;gap:18px;align-items:stretch;margin-bottom:16px}
      .lm-kicker{font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:#787774;font-weight:900;margin-bottom:8px}
      .lm-hero h1{font-size:38px;letter-spacing:-.045em;margin:0 0 8px;color:#37352f}
      .lm-hero p{font-size:15px;color:#787774;line-height:1.7;max-width:760px}
      .lm-guide-card{min-width:270px;background:#fff;border:1px solid rgba(55,53,47,.12);border-radius:12px;padding:16px;box-shadow:0 1px 2px rgba(15,15,15,.04)}
      .lm-guide-card b{display:block;color:#37352f;margin-bottom:8px}
      .lm-guide-card ol{margin:0 0 12px 18px;color:#787774;line-height:1.7;font-size:13px}
      .lm-hero-actions{display:flex;flex-direction:column;gap:8px;align-items:stretch}
      .lm-reset-btn{border:1px solid rgba(200,50,50,.25);background:#fff5f5;color:#c0392b;border-radius:8px;padding:7px 14px;font-size:13px;font-weight:900;cursor:pointer;transition:.15s}
      .lm-reset-btn:hover{background:#fee2e2;border-color:#e03e3e}
      .lm-tabs{display:flex;gap:8px;margin-bottom:16px}
      .lm-tab{border:1px solid rgba(55,53,47,.12);background:#fff;color:#787774;border-radius:8px;padding:9px 15px;font-weight:900}
      .lm-tab.active{background:#37352f;color:#fff;border-color:#37352f;box-shadow:none}
      .lm-workspace{display:grid;grid-template-columns:minmax(0,1fr) 440px;gap:18px;align-items:start}
      .lm-builder{display:grid;gap:14px;min-width:0}
      .lm-block{background:#fff;border:1px solid rgba(55,53,47,.12);border-radius:12px;padding:18px;box-shadow:0 1px 2px rgba(15,15,15,.04)}
      .lm-block.active{border-left:5px solid #37352f;box-shadow:0 3px 10px rgba(15,15,15,.05)}
      .lm-topic-block{border-color:rgba(55,53,47,.18);background:#fff}
      .lm-step{display:flex;align-items:center;gap:9px;margin-bottom:12px}
      .lm-step span{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f1f1ef;color:#37352f;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:800}
      .lm-step b{font-size:16px;color:#37352f}
      .lm-help{font-size:13px;color:#787774;line-height:1.6;margin:8px 0}
      .lm-topic{width:100%;min-height:110px;border:1px solid rgba(55,53,47,.16);background:#fbfbfa;border-radius:8px;padding:14px;font-size:15px;outline:none;resize:vertical}
      .lm-topic:focus{border-color:#37352f;box-shadow:0 0 0 3px rgba(55,53,47,.08)}
      .lm-subtitle{font-size:12px;color:#787774;font-weight:900;text-transform:uppercase;letter-spacing:.07em;margin:14px 0 8px;padding-left:8px;border-left:3px solid #d9d9d6}
      .lm-tags{display:flex;flex-wrap:wrap;gap:7px}
      .lm-tag{border:1px solid rgba(55,53,47,.12);background:#fbfbfa;border-radius:8px;padding:9px 12px;color:#37352f;font-size:13px;font-weight:800;transition:.15s}
      .lm-tag:hover{background:#f1f1ef;border-color:rgba(55,53,47,.25)}
      .lm-tag.on{background:#37352f;color:#fff;border-color:#37352f}
      .lm-note{margin-top:12px;padding:11px 13px;border-radius:8px;background:#f1f1ef;border:1px solid rgba(55,53,47,.1);font-size:13px;color:#55534d;line-height:1.6}
      .lm-counts .lm-tag{min-width:58px;text-align:center}
      .lm-youtube-row{display:flex;gap:8px}
      .lm-youtube-row .input{flex:1}
      .lm-youtube-list{display:grid;gap:8px;margin-top:10px}
      .lm-youtube-item,.lm-pdf-item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:10px;border:1px solid rgba(55,53,47,.12);border-radius:8px;background:#fbfbfa}
      .lm-youtube-item b{display:block;word-break:break-all;font-size:12px;color:#37352f;margin-bottom:6px}
      .lm-youtube-item select{border:1px solid #d9e2ec;border-radius:8px;background:#fff;padding:5px;font-size:12px}
      .lm-youtube-item button,.lm-pdf-item button{border:none;background:transparent;color:#e03e3e;font-weight:900}
      .lm-pdf-picker{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px;border:1px dashed rgba(55,53,47,.2);border-radius:10px;background:#fbfbfa;color:#787774;font-size:13px}
      .lm-pdf-list{display:grid;gap:8px;margin-top:10px}
      .lm-preview{position:sticky;top:16px;background:#fff;border:1px solid rgba(55,53,47,.12);border-radius:12px;box-shadow:0 1px 2px rgba(15,15,15,.05);overflow:hidden}
      .lm-preview-scroll{max-height:calc(100vh - 270px);overflow:auto;padding:16px}
      .lm-preview-box{border:1px solid rgba(55,53,47,.12);border-radius:8px;background:#fbfbfa;margin-bottom:10px;overflow:hidden}
      .lm-preview-label{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#787774;font-weight:900;text-transform:uppercase;letter-spacing:.08em;padding:8px 11px;border-bottom:1px solid rgba(55,53,47,.1)}
      .lm-preview-box pre{margin:0;padding:12px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.55;color:#37352f;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .lm-copy-panel{padding:16px;border-top:1px solid rgba(55,53,47,.12);background:#fff}
      .lm-copy-btn{width:100%;border:none;border-radius:8px;background:#37352f;color:#fff;font-weight:900;font-size:16px;padding:15px;box-shadow:none}
      .lm-copy-panel p{text-align:center;font-size:12px;color:#787774;margin:10px 0 0;line-height:1.5}
      .lm-guide{background:#fff;border:1px solid rgba(55,53,47,.12);border-radius:12px;padding:24px;box-shadow:0 1px 2px rgba(15,15,15,.04)}
      .lm-guide h2{font-size:26px;color:#37352f;margin-bottom:16px}
      .lm-guide-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
      .lm-guide-steps div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px}
      .lm-guide-steps b{display:block;color:#0f172a;margin-bottom:8px}
      .lm-guide-steps span{font-size:13px;color:#64748b;line-height:1.6}
      .lm-warning{margin-top:18px;background:#fef2f2;border-left:5px solid #ef4444;border-radius:12px;padding:16px;color:#7f1d1d;line-height:1.7}
      @media(max-width:1180px){.lm-workspace{grid-template-columns:1fr}.lm-preview{position:relative;top:0}.lm-guide-steps{grid-template-columns:1fr 1fr}}
      @media(max-width:760px){.lm-page{padding:14px}.lm-hero{flex-direction:column}.lm-hero h1{font-size:30px}.lm-guide-steps{grid-template-columns:1fr}.lm-youtube-row{flex-direction:column}}
    `;
  }

  window.registerPage("lesson_materials", { render, init });
})();
