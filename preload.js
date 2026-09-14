const { contextBridge, ipcRenderer } = require('electron');

// ── 할일 → Google Calendar / Tasks 동기화 헬퍼 ──────────────────────────
// contextBridge로 노출된 window.api는 불변이라 렌더러(index.html)에서
// api.addTodo를 래핑할 수 없다. 그래서 동기화를 preload 단계에서 수행한다.
async function googleGetAccessToken() {
  try {
    const rt = await ipcRenderer.invoke('get-setting', 'gcal_refresh_token', '');
    if (!rt) return null;
    const res = await ipcRenderer.invoke('gcal-refresh-token', rt);
    return res && res.access_token ? res.access_token : null;
  } catch (_) {
    return null;
  }
}

function normalizeCalendarDate(text) {
  const raw = String(text || '').replace(/\D/g, '');
  if (!/^\d{8}$/.test(raw)) return '';
  return raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6, 8);
}

function calendarNextDay(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function buildTodoCalendarEvent(payload) {
  const start = normalizeCalendarDate(payload && payload.deadline);
  if (!start) return null;
  return {
    summary: '[할일] ' + String((payload && payload.title) || '쌤포트 할일'),
    description: [
      '쌤포트 할일에서 자동 추가됨',
      payload && payload.priority ? '중요도: ' + payload.priority : '',
      payload && payload.category ? '카테고리: ' + payload.category : ''
    ].filter(Boolean).join('\n'),
    start: { date: start },
    end: { date: calendarNextDay(start) || start },
    colorId: payload && payload.priority === '높음' ? '11' : payload && payload.priority === '낮음' ? '2' : '5',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 480 }] }
  };
}

function buildGoogleTaskPayload(id, payload) {
  return {
    id: id,
    title: (payload && payload.title) || '',
    deadline: (payload && payload.deadline) || '',
    priority: (payload && payload.priority) || '보통',
    category: (payload && payload.category) || '기타',
    source_text: (payload && payload.source_text) || '',
    is_done: payload && payload.is_done ? 1 : 0
  };
}

async function syncTodoAfterAdd(id, payload) {
  if (!id) return;
  const token = await googleGetAccessToken();
  if (!token) return;
  const event = buildTodoCalendarEvent(payload);
  if (event) {
    try {
      const created = await ipcRenderer.invoke('gcal-add-event', token, event);
      if (created && created.id) await ipcRenderer.invoke('set-todo-gcal-id', id, created.id);
      else if (created && created.error) console.warn('todo gcal add failed', created.error);
    } catch (e) { console.warn('todo gcal add failed', e); }
  }
  try {
    const created = await ipcRenderer.invoke('gtasks-add-task', token, buildGoogleTaskPayload(id, payload));
    if (created && created.id) await ipcRenderer.invoke('set-todo-google-task-id', id, created.id);
    else if (created && created.error) console.warn('todo gtask add failed', created.error);
  } catch (e) { console.warn('todo gtask add failed', e); }
}

async function syncTodoAfterUpdate(id, payload) {
  if (!id) return;
  const token = await googleGetAccessToken();
  if (!token) return;
  try {
    const eventId = await ipcRenderer.invoke('get-todo-gcal-id', id);
    const event = buildTodoCalendarEvent(payload);
    if (!event && eventId) {
      await ipcRenderer.invoke('gcal-delete-event', token, eventId);
      await ipcRenderer.invoke('set-todo-gcal-id', id, '');
    } else if (event && eventId) {
      await ipcRenderer.invoke('gcal-update-event', token, eventId, event);
    } else if (event && !eventId) {
      const created = await ipcRenderer.invoke('gcal-add-event', token, event);
      if (created && created.id) await ipcRenderer.invoke('set-todo-gcal-id', id, created.id);
    }
  } catch (e) { console.warn('todo gcal update failed', e); }
  try {
    const taskId = await ipcRenderer.invoke('get-todo-google-task-id', id);
    if (taskId) {
      await ipcRenderer.invoke('gtasks-update-task', token, taskId, buildGoogleTaskPayload(id, payload));
    } else {
      const created = await ipcRenderer.invoke('gtasks-add-task', token, buildGoogleTaskPayload(id, payload));
      if (created && created.id) await ipcRenderer.invoke('set-todo-google-task-id', id, created.id);
    }
  } catch (e) { console.warn('todo gtask update failed', e); }
}

async function syncTodoStatus(id, isDone) {
  if (!id) return;
  const token = await googleGetAccessToken();
  if (!token) return;
  try {
    const taskId = await ipcRenderer.invoke('get-todo-google-task-id', id);
    if (taskId) await ipcRenderer.invoke('gtasks-set-status', token, taskId, !!isDone);
  } catch (e) { console.warn('todo gtask status failed', e); }
}

async function syncTodoDelete(gcalId, gtaskId) {
  if (!gcalId && !gtaskId) return;
  const token = await googleGetAccessToken();
  if (!token) return;
  if (gcalId) {
    try { await ipcRenderer.invoke('gcal-delete-event', token, gcalId); }
    catch (e) { console.warn('todo gcal delete failed', e); }
  }
  if (gtaskId) {
    try { await ipcRenderer.invoke('gtasks-delete-task', token, gtaskId); }
    catch (e) { console.warn('todo gtask delete failed', e); }
  }
}

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => ipcRenderer.send('window-minimize'),
  restore: () => ipcRenderer.send('window-restore'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  alwaysOnTop: (flag) => ipcRenderer.send('window-always-on-top', flag),
  setOpacity: (val) => ipcRenderer.send('window-set-opacity', val),
  getOpacity: () => ipcRenderer.invoke('window-get-opacity'),
  widgetMode: (type, flag) => ipcRenderer.send('window-widget-mode', type, flag),
  getActiveWidgets: () => ipcRenderer.invoke('get-active-widgets'),
  closeWidgetWindow: () => ipcRenderer.send('widget-window-close'),
  onWidgetWindowClosed: (callback) => {
    const handler = (event, type) => callback(type);
    ipcRenderer.on('widget-window-closed', handler);
    return () => ipcRenderer.removeListener('widget-window-closed', handler);
  },
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('quit-and-install-update'),
  onUpdateStatus: (callback) => {
    const handler = (event, payload) => callback(payload);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  },

  // Settings
  getSetting: (key, def) => ipcRenderer.invoke('get-setting', key, def),
  setSetting: (key, val) => ipcRenderer.invoke('set-setting', key, val),
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  switchUserDatabase: (uid, options) => ipcRenderer.invoke('switch-user-database', uid, options),
  getAppMeta: () => ipcRenderer.invoke('get-app-meta'),
  getPublicCompanyRules: () => ipcRenderer.invoke('get-public-company-rules'),
  exportAppManualPdf: () => ipcRenderer.invoke('export-app-manual-pdf'),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  importBackup: () => ipcRenderer.invoke('import-backup'),
  getAiEngineStatus: (engine) => ipcRenderer.invoke('get-ai-engine-status', engine),
  onOllamaInstallProgress: (callback) => {
    const handler = (event, payload) => callback(payload);
    ipcRenderer.on('ollama-install-progress', handler);
    return () => ipcRenderer.removeListener('ollama-install-progress', handler);
  },
  selectAiModelFile: (engine) => ipcRenderer.invoke('select-ai-model-file', engine),
  openAiModelFolder: () => ipcRenderer.invoke('open-ai-model-folder'),
  openAiRuntimeFolder: () => ipcRenderer.invoke('open-ai-runtime-folder'),
  openAiModelDownload: (engine) => ipcRenderer.invoke('open-ai-model-download', engine),
  openAiRuntimeDownload: () => ipcRenderer.invoke('open-ai-runtime-download'),
  installOllamaAi: (engine) => ipcRenderer.invoke('install-ollama-ai', engine),
  applyAiEngine: (engine) => ipcRenderer.invoke('apply-ai-engine', engine),

  // Students
  getStudents: () => ipcRenderer.invoke('get-students'),
  addStudent: (d) => ipcRenderer.invoke('add-student', d),
  updateStudent: (id, d) => ipcRenderer.invoke('update-student', id, d),
  deleteStudent: (id) => ipcRenderer.invoke('delete-student', id),
  importStudentsCSV: (rows) => ipcRenderer.invoke('import-students-csv', rows),
  getCareerRecords: () => ipcRenderer.invoke('get-career-records'),
  saveCareerRecord: (record) => ipcRenderer.invoke('save-career-record', record),
  deleteCareerRecord: (id) => ipcRenderer.invoke('delete-career-record', id),
  clearCareerRecords: () => ipcRenderer.invoke('clear-career-records'),
  getGradeColumnsLocal: () => ipcRenderer.invoke('get-grade-columns-local'),
  saveGradeColumnsLocal: (columns) => ipcRenderer.invoke('save-grade-columns-local', columns),
  getGradeScoresLocal: () => ipcRenderer.invoke('get-grade-scores-local'),
  setGradeScoreLocal: (payload) => ipcRenderer.invoke('set-grade-score-local', payload),
  clearLocalGradeData: () => ipcRenderer.invoke('clear-local-grade-data'),

  // Attendance
  getAttendance: (date) => ipcRenderer.invoke('get-attendance', date),
  getAttendanceRange: (s, e) => ipcRenderer.invoke('get-attendance-range', s, e),
  setAttendance: (d) => ipcRenderer.invoke('set-attendance', d),
  getAttendanceStats: (y, m) => ipcRenderer.invoke('get-attendance-stats', y, m),

  // Counseling
  getCounseling: (f) => ipcRenderer.invoke('get-counseling', f),
  addCounseling: (d) => ipcRenderer.invoke('add-counseling', d),
  updateCounseling: (id, d) => ipcRenderer.invoke('update-counseling', id, d),
  deleteCounseling: (id) => ipcRenderer.invoke('delete-counseling', id),

  // Observations
  getObservations: (f) => ipcRenderer.invoke('get-observations', f),
  addObservation: (d) => ipcRenderer.invoke('add-observation', d),
  updateObservation: (id, d) => ipcRenderer.invoke('update-observation', id, d),
  deleteObservation: (id) => ipcRenderer.invoke('delete-observation', id),

  // Lessons
  getLessons: (f) => ipcRenderer.invoke('get-lessons', f),
  addLesson: (d) => ipcRenderer.invoke('add-lesson', d),
  updateLesson: (id, d) => ipcRenderer.invoke('update-lesson', id, d),
  deleteLesson: (id) => ipcRenderer.invoke('delete-lesson', id),

  // Assessments
  getAssessments: () => ipcRenderer.invoke('get-assessments'),
  addAssessment: (d) => ipcRenderer.invoke('add-assessment', d),
  updateAssessment: (id, d) => ipcRenderer.invoke('update-assessment', id, d),
  deleteAssessment: (id) => ipcRenderer.invoke('delete-assessment', id),
  getAssessmentScores: (id) => ipcRenderer.invoke('get-assessment-scores', id),
  setAssessmentScore: (d) => ipcRenderer.invoke('set-assessment-score', d),

  // Submissions
  getSubmissions: (f) => ipcRenderer.invoke('get-submissions', f),
  addSubmission: (d) => ipcRenderer.invoke('add-submission', d),
  updateSubmission: (id, d) => ipcRenderer.invoke('update-submission', id, d),
  deleteSubmission: (id) => ipcRenderer.invoke('delete-submission', id),
  getSubmissionStatus: (id) => ipcRenderer.invoke('get-submission-status', id),
  setSubmissionStatus: (d) => ipcRenderer.invoke('set-submission-status', d),

  // Todos
  getTodos: (done) => ipcRenderer.invoke('get-todos', done),
  // addTodo/updateTodo/toggleTodo/deleteTodo는 로컬 저장 후 Google 동기화를 트리거한다.
  // *Raw 변형은 동기화 없이 IPC만 호출 — index.html의 Google Tasks 양방향 동기화가
  // 원격→로컬 반영 시 다시 원격으로 푸시되는 루프를 막기 위해 사용한다.
  addTodo: async (d) => {
    const id = await ipcRenderer.invoke('add-todo', d);
    syncTodoAfterAdd(id, d);
    return id;
  },
  updateTodo: async (id, d) => {
    const result = await ipcRenderer.invoke('update-todo', id, d);
    syncTodoAfterUpdate(id, d);
    return result;
  },
  toggleTodo: async (id) => {
    const result = await ipcRenderer.invoke('toggle-todo', id);
    try {
      const todos = await ipcRenderer.invoke('get-todos', true);
      const todo = (todos || []).find((t) => Number(t.id) === Number(id));
      if (todo) syncTodoStatus(id, !!todo.is_done);
    } catch (_) {}
    return result;
  },
  deleteTodo: async (id) => {
    let gcalId = '';
    let gtaskId = '';
    try { gcalId = await ipcRenderer.invoke('get-todo-gcal-id', id); } catch (_) {}
    try { gtaskId = await ipcRenderer.invoke('get-todo-google-task-id', id); } catch (_) {}
    const result = await ipcRenderer.invoke('delete-todo', id);
    syncTodoDelete(gcalId, gtaskId);
    return result;
  },
  addTodoRaw: (d) => ipcRenderer.invoke('add-todo', d),
  updateTodoRaw: (id, d) => ipcRenderer.invoke('update-todo', id, d),
  toggleTodoRaw: (id) => ipcRenderer.invoke('toggle-todo', id),
  deleteTodoRaw: (id) => ipcRenderer.invoke('delete-todo', id),
  replaceTodos: (items) => ipcRenderer.invoke('replace-todos', items),
  setTodoGcalId: (id, gcalId) => ipcRenderer.invoke('set-todo-gcal-id', id, gcalId),
  getTodoGcalId: (id) => ipcRenderer.invoke('get-todo-gcal-id', id),
  setTodoGoogleTaskId: (id, taskId) => ipcRenderer.invoke('set-todo-google-task-id', id, taskId),
  getTodoGoogleTaskId: (id) => ipcRenderer.invoke('get-todo-google-task-id', id),

  // Google Calendar
  gcalOAuthStart: () => ipcRenderer.invoke('gcal-oauth-start'),
  gcalRefreshToken: (refreshToken) => ipcRenderer.invoke('gcal-refresh-token', refreshToken),
  gcalAddEvent: (token, event) => ipcRenderer.invoke('gcal-add-event', token, event),
  gcalUpdateEvent: (token, eventId, event) => ipcRenderer.invoke('gcal-update-event', token, eventId, event),
  gcalDeleteEvent: (token, eventId) => ipcRenderer.invoke('gcal-delete-event', token, eventId),
  googleTasksListTasks: (token) => ipcRenderer.invoke('gtasks-list-tasks', token),
  googleTasksAddTask: (token, task) => ipcRenderer.invoke('gtasks-add-task', token, task),
  googleTasksUpdateTask: (token, taskId, task) => ipcRenderer.invoke('gtasks-update-task', token, taskId, task),
  googleTasksSetStatus: (token, taskId, isDone) => ipcRenderer.invoke('gtasks-set-status', token, taskId, isDone),
  googleTasksDeleteTask: (token, taskId) => ipcRenderer.invoke('gtasks-delete-task', token, taskId),

  // D-Day
  getDdays: () => ipcRenderer.invoke('get-ddays'),
  addDday: (d) => ipcRenderer.invoke('add-dday', d),
  deleteDday: (id) => ipcRenderer.invoke('delete-dday', id),

  // Timetable
  getTimetable: () => ipcRenderer.invoke('get-timetable'),
  setTimetableCell: (d) => ipcRenderer.invoke('set-timetable-cell', d),
  clearTimetable: () => ipcRenderer.invoke('clear-timetable'),
  replaceTimetable: (items) => ipcRenderer.invoke('replace-timetable', items),

  // Daily memo
  getDailyMemo: (date) => ipcRenderer.invoke('get-daily-memo', date),
  setDailyMemo: (date, c) => ipcRenderer.invoke('set-daily-memo', date, c),
  getDailyMemos: (y, m) => ipcRenderer.invoke('get-daily-memos', y, m),

  // External open
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  openPath: (path) => ipcRenderer.invoke('open-path', path),

  // NEIS
  neisGetMeal: (edu, sch, date) => ipcRenderer.invoke('neis-get-meal', edu, sch, date),
  neisGetCalendar: (edu, sch, ym) => ipcRenderer.invoke('neis-get-calendar', edu, sch, ym),
  neisGetWeather: (region) => ipcRenderer.invoke('neis-get-weather', region),

  // AI
  aiExtractTodos: (key, model, provider, text) =>
    ipcRenderer.invoke('ai-extract-todos', key, model, provider, text),
  aiGenerateOfficialDoc: (key, model, provider, inputJson) =>
    ipcRenderer.invoke('ai-generate-official-doc', key, model, provider, inputJson),
  aiExtractTimetable: (key, model, provider, text) =>
    ipcRenderer.invoke('ai-extract-timetable', key, model, provider, text),
  aiExtractTimetableImage: (key, model, provider, image) =>
    ipcRenderer.invoke('ai-extract-timetable-image', key, model, provider, image),
  aiExtractEstimateImage: (key, model, provider, image) =>
    ipcRenderer.invoke('ai-extract-estimate-image', key, model, provider, image),
  aiExtractEstimateText: (key, model, provider, text) =>
    ipcRenderer.invoke('ai-extract-estimate-text', key, model, provider, text),
  aiAssistantChat: (payload) =>
    ipcRenderer.invoke('ai-assistant-chat', payload),
  aiLocalChat: (payload) =>
    ipcRenderer.invoke('ai-local-chat', payload),
  ocrImage: (imageBase64, lang) =>
    ipcRenderer.invoke('ocr-image', imageBase64, lang),
  parseExcelEstimate: (bufferData) =>
    ipcRenderer.invoke('parse-excel-estimate', bufferData),
  importClassTimetableExcel: (payload) =>
    ipcRenderer.invoke('import-class-timetable-excel', payload),
  applyAppPatch: () => ipcRenderer.invoke('apply-app-patch'),

  // 에듀파인 CDP 매크로
  macroCdpCheck: () => ipcRenderer.invoke('macro-cdp-check'),
  macroLaunchDebugBrowser: () => ipcRenderer.invoke('macro-launch-debug-browser'),
  macroCreateShortcut: () => ipcRenderer.invoke('macro-create-shortcut'),
  macroStop: () => ipcRenderer.invoke('macro-stop'),
  macroFillEdufineCdp: (cfg) => ipcRenderer.invoke('macro-fill-edufine-cdp', cfg),
  macroDiagnose: (wsUrl) => ipcRenderer.invoke('macro-diagnose', wsUrl),

  // 한글(HWP) 자동 서식
  hwpBuildHwpx: (opts) => ipcRenderer.invoke('hwp-build-hwpx', opts),
  showOpenDialog: (opts) => ipcRenderer.invoke('show-open-dialog', opts),
  hwpGenerateMarkdown: (opts) => ipcRenderer.invoke('hwp-generate-markdown', opts),
  hwpBuildPrompt: (opts) => ipcRenderer.invoke('hwp-build-prompt', opts),
});
