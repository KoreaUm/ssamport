const api = window.api;

const TEXT = {
  home: "\uD648",
  dashboard: "\uB300\uC2DC\uBCF4\uB4DC",
  classMgmt: "\uD559\uAE09 \uAD00\uB9AC",
  students: "\uD559\uC0DD \uBA85\uB2E8",
  attendance: "\uCD9C\uC11D \uAD00\uB9AC",
  dailyMemo: "\uD559\uAE09 \uBA54\uBAA8",
  timetable: "\uC2DC\uAC04\uD45C \uAD00\uB9AC",
  seating: "\uC790\uB9AC \uBC30\uCE58",
  records: "\uAE30\uB85D",
  counseling: "\uC0C1\uB2F4 \uC77C\uC9C0",
  observations: "\uAD00\uCC30 \uAE30\uB85D",
  lessons: "\uC218\uC5C5 \uC9C0\uB3C4",
  evaluation: "\uD3C9\uAC00",
  assessments: "\uC218\uD589\uD3C9\uAC00",
  submissions: "\uC81C\uCD9C\uBB3C \uAD00\uB9AC",
  statistics: "\uD1B5\uACC4\uC640 \uCD9C\uB825",
  aiAnalysis: "AI \uBD84\uC11D",
  tools: "\uB3C4\uAD6C",
  meal: "\uAE09\uC2DD \uBA54\uB274",
  schoolCalendar: "\uD559\uC0AC \uC77C\uC815",
  calculator: "\uACC4\uC0B0\uAE30",
  lessonMaterials: "\uC218\uC5C5\uC790\uB8CC\uC81C\uC791",
  settings: "\uC124\uC815",
  homeroom: "\uB2F4\uC784",
  classPattern: "\uD83C\uDFEB {year}\uD559\uB144 {num}\uBC18 \u00B7 {name}",
  widgetOn: "\uC704\uC82F \uBAA8\uB4DC \uC885\uB8CC",
  widgetOff: "\uC704\uC82F \uBAA8\uB4DC",
  widgetToast:
    "\uC704\uC82F \uBAA8\uB4DC\uC5D0\uC11C\uB294 \uB2E4\uB978 \uCC3D\uC744 \uD074\uB9AD\uD558\uBA74 \uBC30\uACBD\uC73C\uB85C \uC774\uB3D9\uD569\uB2C8\uB2E4.",
  editOn: "\uBC30\uC5F4 \uD3B8\uC9D1 \uC644\uB8CC",
  editOff: "\uBC30\uC5F4 \uD3B8\uC9D1",
  loading: "\uBD88\uB7EC\uC624\uB294 \uC911...",
  loadPageFailed: "\uD398\uC774\uC9C0\uB97C \uBD88\uB7EC\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4",
  sun: "\uC77C",
  mon: "\uC6D4",
  tue: "\uD654",
  wed: "\uC218",
  thu: "\uBAA9",
  fri: "\uAE08",
  sat: "\uD1A0",
};

const MENU_GROUPS = [
  { label: TEXT.home, items: [{ key: "dashboard", label: TEXT.dashboard }] },
  {
    label: TEXT.classMgmt,
    items: [
      { key: "students", label: TEXT.students },
      { key: "attendance", label: TEXT.attendance },
      { key: "daily_memo", label: TEXT.dailyMemo },
      { key: "timetable", label: TEXT.timetable },
      { key: "seating", label: TEXT.seating },
    ],
  },
  {
    label: TEXT.records,
    items: [
      { key: "counseling", label: TEXT.counseling },
      { key: "observations", label: TEXT.observations },
      { key: "lessons", label: TEXT.lessons },
    ],
  },
  {
    label: TEXT.evaluation,
    items: [
      { key: "assessments", label: TEXT.assessments },
      { key: "submissions", label: TEXT.submissions },
      { key: "statistics", label: TEXT.statistics },
      { key: "ai_analysis", label: TEXT.aiAnalysis },
    ],
  },
  {
    label: TEXT.tools,
    items: [
      { key: "meal", label: TEXT.meal },
      { key: "school_calendar", label: TEXT.schoolCalendar },
      { key: "calculator", label: TEXT.calculator },
      { key: "lesson_materials", label: TEXT.lessonMaterials },
      { key: "settings", label: TEXT.settings },
    ],
  },
];

const MENU_ITEMS = MENU_GROUPS.flatMap((group) => group.items);

let currentPage = "dashboard";
let widgetMode = false;

function updateDate() {
  const d = new Date();
  const days = [TEXT.sun, TEXT.mon, TEXT.tue, TEXT.wed, TEXT.thu, TEXT.fri, TEXT.sat];
  document.getElementById("header-date").textContent =
    `${d.getFullYear()}\uB144 ${d.getMonth() + 1}\uC6D4 ${d.getDate()}\uC77C (${days[d.getDay()]})`;
}

function buildTopTabs() {
  const nav = document.getElementById("page-tabs");
  nav.innerHTML = MENU_GROUPS.map((group) => `
    <section class="tab-group">
      <div class="tab-group-label">${group.label}</div>
      <div class="tab-group-items">
        ${group.items.map((item) => `
          <button class="tab-link${item.key === currentPage ? " active" : ""}" data-key="${item.key}">
            ${item.label}
          </button>
        `).join("")}
      </div>
    </section>
  `).join("");

  nav.querySelectorAll(".tab-link").forEach((button) => {
    button.addEventListener("click", () => navigateTo(button.dataset.key));
  });
}

function syncActiveTabs() {
  document.querySelectorAll(".tab-link").forEach((button) => {
    button.classList.toggle("active", button.dataset.key === currentPage);
  });
}

function setDashboardControls(isDashboard) {
  document.getElementById("edit-layout-btn").style.display = isDashboard ? "" : "none";
  document.getElementById("widget-mode-btn").style.display = isDashboard ? "" : "none";
}

async function navigateTo(key) {
  currentPage = key;
  syncActiveTabs();

  const item = MENU_ITEMS.find((entry) => entry.key === key);
  document.getElementById("page-title").textContent = item ? item.label : "";
  setDashboardControls(key === "dashboard");

  const content = document.getElementById("page-content");
  content.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text3)">${TEXT.loading}</div>`;

  try {
    const mod = await loadPage(key);
    content.innerHTML = "";
    await mod.render(content);
    if (mod.init) await mod.init();
  } catch (error) {
    content.innerHTML = `<div class="page-wrap"><div class="empty-state"><div class="icon">!</div><p>${error.message}</p></div></div>`;
    console.error(error);
  }
}

const pageCache = {};
async function loadPage(key) {
  if (pageCache[key]) return pageCache[key];
  return new Promise((resolve, reject) => {
    if (window.__pages && window.__pages[key]) {
      pageCache[key] = window.__pages[key];
      resolve(window.__pages[key]);
      return;
    }

    window.__pageResolvers = window.__pageResolvers || {};
    window.__pageResolvers[key] = (mod) => {
      pageCache[key] = mod;
      resolve(mod);
    };

    const script = document.createElement("script");
    script.src = `pages/${key}.js`;
    script.onerror = () => reject(new Error(`${TEXT.loadPageFailed}: ${key}`));
    document.head.appendChild(script);
  });
}

window.__pages = {};
window.registerPage = function registerPage(key, mod) {
  window.__pages[key] = mod;
  pageCache[key] = mod;
  if (window.__pageResolvers && window.__pageResolvers[key]) {
    window.__pageResolvers[key](mod);
    delete window.__pageResolvers[key];
  }
};

async function updateClassInfo() {
  const year = await api.getSetting("class_year", "-");
  const num = await api.getSetting("class_num", "-");
  const name = await api.getSetting("teacher_name", TEXT.homeroom);
  document.getElementById("class-info").textContent = TEXT.classPattern
    .replace("{year}", year)
    .replace("{num}", num)
    .replace("{name}", name);
}

document.getElementById("widget-mode-btn").addEventListener("click", function toggleWidgetMode() {
  widgetMode = !widgetMode;
  this.classList.toggle("active", widgetMode);
  this.textContent = widgetMode ? TEXT.widgetOn : TEXT.widgetOff;
  api.widgetMode(widgetMode);
  document.body.classList.toggle("widget-mode", widgetMode);
  if (widgetMode) {
    toast(TEXT.widgetToast, "default", 3500);
  }
});

document.getElementById("edit-layout-btn").addEventListener("click", function toggleEditMode() {
  const active = this.classList.toggle("active");
  this.textContent = active ? TEXT.editOn : TEXT.editOff;
  if (window.__pages.dashboard && window.__pages.dashboard.setEditMode) {
    window.__pages.dashboard.setEditMode(active);
  }
});

(function initOpacityPanel() {
  const btn = document.getElementById("opacity-btn");
  const panel = document.getElementById("opacity-panel");
  const slider = document.getElementById("opacity-slider");
  const label = document.getElementById("opacity-lbl");

  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
  });

  document.addEventListener("click", () => {
    panel.style.display = "none";
  });

  panel.addEventListener("click", (event) => event.stopPropagation());

  slider.addEventListener("input", () => {
    const opacity = slider.value / 100;
    label.textContent = `${slider.value}%`;
    api.setOpacity(opacity);
  });

  api.getOpacity().then((opacity) => {
    const pct = Math.round(opacity * 100);
    slider.value = pct;
    label.textContent = `${pct}%`;
  }).catch(() => {});
})();

const toastContainer = document.createElement("div");
toastContainer.id = "toast-container";
document.body.appendChild(toastContainer);

window.toast = function toast(msg, type = "default", duration = 2500) {
  const el = document.createElement("div");
  el.className = `toast${type !== "default" ? ` ${type}` : ""}`;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .3s";
    setTimeout(() => el.remove(), 300);
  }, duration);
};

window.showModal = function showModal(html, onClose) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeModal();
  });
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };

  window.__closeModal = close;
  overlay.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", close));
  return { close, el: overlay };
};

window.closeModal = function closeModal() {
  if (window.__closeModal) window.__closeModal();
};

window.today = function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

window.formatDate = function formatDate(str) {
  if (!str) return "";
  return str.replace(/-/g, ".");
};

window.diffDays = function diffDays(dateStr) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
};

async function init() {
  updateDate();
  setInterval(updateDate, 60000);
  buildTopTabs();
  await updateClassInfo();
  await navigateTo("dashboard");
}

init();
