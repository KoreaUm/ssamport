const { app, BrowserWindow, ipcMain, shell, screen, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync, execSync } = require('child_process');
const os = require('os');
const http = require('http');
const https = require('https');
const net = require('net');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const neisApi = require('./src/neis-api.js');

const AppDatabase = require('./src/database.js');
const SQLiteDatabase = require('better-sqlite3');
const APP_MANUAL = require('./src/app_manual.js');

let db;
let mainWindow;
let tray = null;
let isQuitting = false;
let widgetWindows = { todo: null, timetable: null, memo: null };
let isClosingAfterCloudSync = false;
let activeDbUserId = '';
const gotSingleInstanceLock = app.requestSingleInstanceLock();
const AI_MODEL_DOWNLOADS = {
  local_lite: {
    label: 'Local AI Lite',
    settingKey: 'ai_local_lite_model_path',
    recommendedFile: 'qwen2.5-3b-instruct-q4.gguf',
    downloadUrl: '',
    filesUrl: ''
  },
  local_basic: {
    label: 'Gemma 4 E2B Basic',
    settingKey: 'ai_local_basic_model_path',
    recommendedFile: 'gemma-4-E2B-it-Q4_K_M.gguf',
    downloadUrl: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf?download=true',
    filesUrl: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/tree/main'
  },
  local_pro: {
    label: 'Gemma 4 E4B Pro',
    settingKey: 'ai_local_pro_model_path',
    recommendedFile: 'gemma-4-E4B-it-Q4_K_M.gguf',
    downloadUrl: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf?download=true',
    filesUrl: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/tree/main'
  }
};
const AI_RUNTIME_DOWNLOAD_URL = 'https://github.com/ggml-org/llama.cpp/releases/latest';
const OLLAMA_INSTALLER_URL = 'https://ollama.com/download/OllamaSetup.exe';
const OLLAMA_DOWNLOAD_URL = process.platform === 'darwin'
  ? 'https://ollama.com/download/mac'
  : process.platform === 'win32'
    ? 'https://ollama.com/download/windows'
    : 'https://ollama.com/download';
const OLLAMA_MODELS = {
  local_lite: 'qwen2.5:3b',
  local_basic: 'gemma4:e2b',
  local_pro: 'gemma4:e4b'
};
// Desktop 앱 OAuth (PKCE + 루프백 리디렉트).
// 2025년 정책 변경 이후 데스크톱 클라이언트도 토큰 교환 시 client_secret을 요구함.
// client_secret은 빌드 시 CI가 oauth-config.js에 주입한다(저장소에는 빈 값으로 커밋).
const GOOGLE_CALENDAR_CLIENT_ID = '780135122795-ldmauftdqlfksb4tfgrmro09b1mguh4f.apps.googleusercontent.com';
let GOOGLE_CALENDAR_CLIENT_SECRET = '';
try {
  GOOGLE_CALENDAR_CLIENT_SECRET = String(require('./oauth-config').GOOGLE_CALENDAR_CLIENT_SECRET || '');
} catch (_) {
  GOOGLE_CALENDAR_CLIENT_SECRET = '';
}
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks'
];
let updateState = {
  status: 'idle',
  version: app.getVersion(),
  message: '',
  progress: 0,
  info: null,
};

function getAiModelDir() {
  const dir = path.join(app.getPath('userData'), 'ai-models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAiRuntimeDir() {
  const dir = path.join(app.getPath('userData'), 'ai-runtime');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkcePair() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function getGoogleCalendarOAuthConfig(fallbackClientId = '', fallbackClientSecret = '') {
  const clientId =
    String(GOOGLE_CALENDAR_CLIENT_ID || '').trim() ||
    String(fallbackClientId || '').trim() ||
    String(db?.getSetting?.('gcal_client_id', '') || '').trim();
  // client_secret은 앱에 내장된 상수만 사용. DB에 남은 잘못된 값이 토큰 교환을 막을 수 있어 제외.
  const clientSecret = String(GOOGLE_CALENDAR_CLIENT_SECRET || '').trim();
  return { clientId, clientSecret };
}

function buildManualPdfHtml() {
  const today = new Date().toLocaleDateString('ko-KR');
  const sectionHtml = APP_MANUAL.sections.map((section) => `
    <section class="manual-section">
      <h2>${escapeHtml(section.title)}</h2>
      <p class="desc">${escapeHtml(section.description)}</p>
      <h3>주요 기능</h3>
      <ul>${(section.features || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      ${(section.tips || []).length ? `<h3>사용 팁</h3><ul>${section.tips.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
    </section>
  `).join('');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${escapeHtml(APP_MANUAL.title)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: #1f2933; line-height: 1.58; font-size: 12px; }
  h1 { font-size: 28px; margin: 0 0 8px; color: #111827; }
  h2 { font-size: 18px; margin: 24px 0 6px; color: #0f4c81; page-break-after: avoid; }
  h3 { font-size: 12px; margin: 12px 0 4px; color: #374151; }
  ul { margin: 4px 0 0 18px; padding: 0; }
  li { margin: 3px 0; }
  .cover { border-bottom: 2px solid #0f4c81; padding-bottom: 14px; margin-bottom: 16px; }
  .meta { color: #697586; font-size: 11px; }
  .summary { background: #f4f7fb; border: 1px solid #d8e2ef; padding: 12px 14px; border-radius: 8px; margin: 14px 0 18px; }
  .manual-section { page-break-inside: avoid; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; }
  .desc { margin: 0 0 8px; font-weight: 600; color: #253243; }
</style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(APP_MANUAL.title)}</h1>
    <div class="meta">버전 ${escapeHtml(APP_MANUAL.version)} · 생성일 ${escapeHtml(today)}</div>
  </div>
  <div class="summary">${APP_MANUAL.summary.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</div>
  ${sectionHtml}
</body>
</html>`;
}

function findAiRuntimePath() {
  const runtimeDir = getAiRuntimeDir();
  const candidates = [
    path.join(runtimeDir, 'llama-server.exe'),
    path.join(runtimeDir, 'llama-cli.exe'),
    path.join(runtimeDir, 'llama.exe')
  ];
  return candidates.find((candidate) => {
    try { return fs.existsSync(candidate) && fs.statSync(candidate).isFile(); } catch { return false; }
  }) || '';
}

function testAiRuntimePath(runtimePath) {
  if (!runtimePath) return { ok: false, message: '실행 엔진 파일이 없습니다.' };
  try {
    const result = spawnSync(runtimePath, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true
    });
    if (result.error) return { ok: false, message: result.error.message };
    if (result.status === 0) return { ok: true, message: '실행 엔진 실행 테스트를 통과했습니다.' };
    const detail = String(result.stderr || result.stdout || '').trim();
    return { ok: false, message: detail || `실행 엔진 테스트가 종료 코드 ${result.status}로 끝났습니다.` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function findOllamaPath() {
  const candidates = process.platform === 'win32'
    ? [
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
        path.join(process.env.ProgramFiles || '', 'Ollama', 'ollama.exe'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'Ollama', 'ollama.exe')
      ]
    : process.platform === 'darwin'
      ? [
          '/usr/local/bin/ollama',
          '/opt/homebrew/bin/ollama',
          '/Applications/Ollama.app/Contents/Resources/ollama',
          path.join(os.homedir(), 'Applications', 'Ollama.app', 'Contents/Resources', 'ollama')
        ]
      : [
          '/usr/local/bin/ollama',
          '/usr/bin/ollama',
          '/bin/ollama'
        ];
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch {}
  }
  try {
    const found = execSync(process.platform === 'win32' ? 'where.exe ollama' : 'which ollama', {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    }).split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (found) return found;
  } catch {}
  return '';
}

function getOllamaModelForEngine(engine) {
  return OLLAMA_MODELS[engine] || OLLAMA_MODELS.local_lite;
}

function isStudentSensitivePage(page) {
  return /학생|상담|성적|출석|관찰|수업|상담 일지|성적관리|학생 명단|AI 분석/i.test(String(page || ''));
}

function anonymizeSensitiveText(text) {
  let value = String(text || '');
  value = value.replace(/01[016789]-?\d{3,4}-?\d{4}/g, '[전화번호]');
  value = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일]');
  value = value.replace(/\b\d{6}-\d{7}\b/g, '[주민번호]');
  value = value.replace(/\b\d{1,2}\s*학년\s*\d{1,2}\s*반\s*\d{1,2}\s*번\b/g, '[학년반번호]');
  value = value.replace(/\b\d{1,2}\s*반\s*\d{1,2}\s*번\b/g, '[반번호]');
  value = value.replace(/\b\d{4,6}\b/g, '[번호]');
  value = value.replace(/([가-힣]{2,4})(?=\s*(학생|군|양|님|:|은|는|이|가|을|를|의))/g, '[학생]');
  return value;
}

// 학생 식별정보를 클라우드로 보내기 전에 가짜 토큰으로 바꾸기 위한 매핑 생성.
// 매핑(누가 학생A인지)은 이 프로세스 메모리에만 존재하고 외부로 나가지 않는다.
function pseudonymLabel(index) {
  let n = index;
  let suffix = '';
  do {
    suffix = String.fromCharCode(65 + (n % 26)) + suffix;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `학생${suffix}`;
}

function buildStudentPseudonymMap() {
  let students = [];
  try { students = db.getStudents() || []; } catch { students = []; }
  const forward = []; // {from(실제 식별정보), to(가명)} — 길이 긴 것부터 치환
  const reverse = []; // {from(가명), to(실제 이름)} — 응답 복원용
  students.forEach((stu, i) => {
    const pseudo = pseudonymLabel(i);
    const name = String(stu && stu.name || '').trim();
    if (name.length >= 2) {
      forward.push({ from: name, to: pseudo });
      reverse.push({ from: pseudo, to: name });
    }
    const phone = String(stu && stu.phone || '').trim();
    if (phone.length >= 7) forward.push({ from: phone, to: `${pseudo}-연락처` });
    const parentPhone = String(stu && stu.parent_phone || '').trim();
    if (parentPhone.length >= 7) forward.push({ from: parentPhone, to: `${pseudo}-보호자연락처` });
    const address = String(stu && stu.address || '').trim();
    if (address.length >= 4) forward.push({ from: address, to: `${pseudo}-주소` });
    const birth = String(stu && stu.birth_date || '').trim();
    if (birth.length >= 6) forward.push({ from: birth, to: `${pseudo}-생년월일` });
  });
  // 부분 겹침("김민"이 "김민준"보다 먼저 치환되는 일) 방지를 위해 긴 것부터
  forward.sort((a, b) => b.from.length - a.from.length);
  return { forward, reverse };
}

// 클라우드 전송 전: 실제 식별정보 → 가명 토큰. 매핑에 없는 잔여 PII는 정규식 안전망으로 추가 제거.
function pseudonymizeForCloud(text, map) {
  let value = String(text || '');
  if (map && Array.isArray(map.forward)) {
    map.forward.forEach(({ from, to }) => {
      if (!from) return;
      value = value.split(from).join(to);
    });
  }
  return anonymizeSensitiveText(value);
}

// 응답 복원: 가명 토큰 → 실제 이름. "학생AA"가 "학생A"보다 먼저 복원되도록 긴 것부터.
function depseudonymizeFromCloud(text, map) {
  let value = String(text || '');
  if (map && Array.isArray(map.reverse)) {
    const ordered = [...map.reverse].sort((a, b) => b.from.length - a.from.length);
    ordered.forEach(({ from, to }) => {
      if (!from || !to) return;
      value = value.split(from).join(to);
    });
  }
  return value;
}

function normalizeAssistantAddressing(answer) {
  let value = String(answer || '')
    .replace(/안녕하세요,\s*학생[.!?。]*/g, '안녕하세요, 선생님.')
    .replace(/안녕하세요\s*학생[.!?。]*/g, '안녕하세요, 선생님.')
    .replace(/학생,\s*오늘/g, '선생님, 오늘')
    .replace(/무엇을 도와드릴까요,\s*학생/g, '무엇을 도와드릴까요, 선생님')
    .trim();
  value = value.replace(/^(안녕하세요[.!?。]?\s*)/g, '선생님, 안녕하세요. ');
  if (!/^선생님[,\s]/.test(value)) value = `선생님, ${value}`;
  return value;
}

function pickContextValue(context, label) {
  const escaped = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(context || '').match(new RegExp(`^${escaped}:\\s*(.*)$`, 'm'));
  return match ? match[1].trim() : '';
}


function containsCjkChinese(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

function requestOllamaJson(pathname, body = null, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: pathname,
      method: body ? 'POST' : 'GET',
      timeout: timeoutMs,
      headers: body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      } : {}
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, data: raw ? JSON.parse(raw) : {} });
        } catch (err) {
          resolve({ ok: false, statusCode: res.statusCode, error: err.message, raw });
        }
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('Ollama 응답 시간이 초과되었습니다.'));
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function getOllamaStatus(engine = 'local_lite') {
  const ollamaPath = findOllamaPath();
  const model = getOllamaModelForEngine(engine);
  if (!ollamaPath) {
    return {
      installed: false,
      running: false,
      modelInstalled: false,
      ready: false,
      model,
      message: 'Ollama가 설치되어 있지 않습니다. 로컬 AI 자동 설치를 눌러 주세요.'
    };
  }
  const tags = await requestOllamaJson('/api/tags', null, 5000);
  const running = !!tags.ok;
  const models = Array.isArray(tags.data?.models) ? tags.data.models : [];
  const modelInstalled = models.some((item) => item.name === model || item.model === model || String(item.name || item.model || '').startsWith(`${model}:`));
  return {
    installed: true,
    running,
    modelInstalled,
    ready: running && modelInstalled,
    path: ollamaPath,
    model,
    message: !running
      ? 'Ollama는 설치되어 있지만 아직 실행 중이 아닙니다. 자동 설치/확인을 누르면 실행을 시도합니다.'
      : modelInstalled
        ? `${model} 모델이 준비되어 있습니다. 로컬 AI는 외부 전송 없이 이 PC에서 실행됩니다.`
        : `${model} 모델이 아직 없습니다. 자동 설치/확인을 누르면 모델을 다운로드합니다.`
  };
}

function getOllamaEnv() {
  // 회사 프록시 등 SSL 인증서 검사 우회 (Windows 기업 환경 대응)
  return Object.assign({}, process.env, {
    OLLAMA_SKIP_TLS_VERIFY: '1',
    NODE_TLS_REJECT_UNAUTHORIZED: '0',
    GIT_SSL_NO_VERIFY: 'true',
  });
}

function startOllamaServer(ollamaPath) {
  if (!ollamaPath) return;
  try {
    const child = spawn(ollamaPath, ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: getOllamaEnv(),
    });
    child.unref();
  } catch {}
}

function downloadFile(url, destination, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const handle = (currentUrl) => {
      httpsGet(currentUrl, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          handle(new URL(res.headers.location, currentUrl).toString());
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(new Error(`다운로드 실패: HTTP ${res.statusCode}`));
          return;
        }
        const total = Number(res.headers['content-length'] || 0);
        let received = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          if (total && onProgress) onProgress({ received, total, percent: Math.min(99, Math.round((received / total) * 100)) });
        });
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', reject);
    };
    handle(url);
  });
}

function httpsGet(url, callback) {
  if (!url.startsWith('https:')) return http.get(url, callback);
  return https.get(url, callback);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const onData = options.onData;
    const spawnOptions = Object.assign({}, options);
    delete spawnOptions.onData;
    delete spawnOptions.timeout;
    const child = spawn(command, args, {
      windowsHide: true,
      ...spawnOptions
    });
    let output = '';
    const handleData = (data) => {
      const text = data.toString();
      output += text;
      if (onData) onData(text);
    };
    child.stdout?.on('data', handleData);
    child.stderr?.on('data', handleData);
    child.on('error', (err) => resolve({ ok: false, error: err.message, output }));
    child.on('close', (code) => resolve({ ok: code === 0, code, output }));
  });
}

async function waitForOllamaReady(ollamaPath, timeoutMs = 45000) {
  startOllamaServer(ollamaPath);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tags = await requestOllamaJson('/api/tags', null, 3000);
    if (tags.ok) return true;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

async function getAiEngineStatus(engine) {
  const selectedEngine = engine || db.getSetting('ai_engine', 'local_lite');
  const modelDir = getAiModelDir();
  const runtimeDir = getAiRuntimeDir();
  if (selectedEngine === 'cloud' || selectedEngine === 'claude' || selectedEngine === 'gemini') {
    const provider = selectedEngine === 'cloud' ? db.getSetting('ai_provider', 'claude') : selectedEngine;
    const label = provider === 'gemini' ? 'Gemini 외부 AI' : 'Claude 외부 AI';
    const hasKey = !!db.getSetting('ai_api_key', '');
    return {
      engine: selectedEngine,
      provider,
      ready: hasKey,
      label,
      message: hasKey ? `${label} API 키가 설정되어 있습니다. 입력 내용은 외부 AI 서버로 전송될 수 있습니다.` : `${label}를 쓰려면 API 키가 필요합니다.`,
      modelDir,
      runtimeDir
    };
  }
  const meta = AI_MODEL_DOWNLOADS[selectedEngine];
  if (!meta) return { engine: selectedEngine, ready: false, label: selectedEngine, message: '알 수 없는 AI 엔진입니다.', modelDir, runtimeDir };
  const ollamaStatus = await getOllamaStatus(selectedEngine);
  return {
    engine: selectedEngine,
    ready: ollamaStatus.ready,
    label: `${meta.label} · Ollama`,
    model: ollamaStatus.model,
    ollamaPath: ollamaStatus.path || '',
    ollamaInstalled: ollamaStatus.installed,
    ollamaRunning: ollamaStatus.running,
    ollamaModelInstalled: ollamaStatus.modelInstalled,
    modelDir,
    runtimeDir,
    message: ollamaStatus.message
  };
}

function setUpdateState(next) {
  updateState = Object.assign({}, updateState, next || {});
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', updateState);
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) {
    setUpdateState({
      status: 'dev',
      message: '개발 실행에서는 자동 업데이트를 확인하지 않습니다.',
      progress: 0,
    });
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      message: '업데이트를 확인하는 중입니다.',
      progress: 0,
    });
  });

  autoUpdater.on('update-available', (info) => {
    setUpdateState({
      status: 'available',
      message: `새 버전 ${info?.version || ''} 이(가) 있습니다.`,
      progress: 0,
      info,
    });
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      status: 'idle',
      message: '현재 최신 버전입니다.',
      progress: 0,
      info: null,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setUpdateState({
      status: 'downloading',
      message: `업데이트 다운로드 중... ${Math.round(progress?.percent || 0)}%`,
      progress: progress?.percent || 0,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setUpdateState({
      status: 'downloaded',
      message: `새 버전 ${info?.version || ''} 다운로드가 완료되었습니다. 재시작 후 설치할 수 있습니다.`,
      progress: 100,
      info,
    });
  });

  autoUpdater.on('error', (error) => {
    setUpdateState({
      status: 'error',
      message: error?.message || '업데이트 확인 중 문제가 발생했습니다.',
      progress: 0,
    });
  });
}

function openDatabaseForUser(userId = '', options = {}) {
  const nextUserId = String(userId || '');
  if (db && activeDbUserId === nextUserId) return db;

  const nextPath = AppDatabase.getPathForUser(nextUserId);
  const legacyPath = AppDatabase.getDefaultPath();
  const migrationMarkerPath = path.join(path.dirname(nextPath), '.legacy_migrated');
  if (options.migrateLegacy === true && nextUserId && !fs.existsSync(nextPath) && fs.existsSync(legacyPath) && !fs.existsSync(migrationMarkerPath)) {
    fs.mkdirSync(path.dirname(nextPath), { recursive: true });
    fs.copyFileSync(legacyPath, nextPath);
    removeSqliteSidecars(nextPath);
    fs.writeFileSync(migrationMarkerPath, `${nextUserId}\n${new Date().toISOString()}`, 'utf8');
  }

  if (db) {
    try { db.close(); } catch (_) {}
  }
  db = new AppDatabase({ userId: nextUserId });
  activeDbUserId = nextUserId;
  return db;
}

function clearLocalGradeDataEverywhere() {
  const dbPaths = new Set([AppDatabase.getDefaultPath()]);
  const userDbDir = AppDatabase.getUserDatabaseDir();
  if (fs.existsSync(userDbDir)) {
    for (const fileName of fs.readdirSync(userDbDir)) {
      if (/\.db$/i.test(fileName)) dbPaths.add(path.join(userDbDir, fileName));
    }
  }

  const activePath = db?.getPath?.() || '';
  const results = [];
  if (db) results.push(db.clearLocalGradeData());

  for (const dbPath of dbPaths) {
    if (activePath && path.resolve(dbPath) === path.resolve(activePath)) continue;
    try {
      results.push(AppDatabase.clearGradeDataAtPath(dbPath));
    } catch (error) {
      results.push({ path: dbPath, error: error?.message || String(error) });
    }
  }

  return {
    success: true,
    results,
    total: results.reduce((sum, item) => sum + (Number(item?.total) || 0), 0)
  };
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return tray;

  try {
    const iconPath = fs.existsSync(path.join(__dirname, 'assets/icon.ico'))
      ? path.join(__dirname, 'assets/icon.ico')
      : path.join(__dirname, 'assets/app-icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip('쌤포트');
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: '열기',
        click: () => showMainWindow(),
      },
      {
        label: '완전 종료',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]));
    tray.on('click', () => showMainWindow());
    tray.on('double-click', () => showMainWindow());
  } catch (error) {
    console.error('tray creation failed', error);
    tray = null;
  }
  return tray;
}

function hideWindowToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (!tray) {
    mainWindow.minimize();
    mainWindow.setSkipTaskbar(false);
    return;
  }

  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
}

function createWindow() {
  const { nativeImage } = require('electron');
  const icoPath = path.join(__dirname, 'assets/icon.ico');
  const pngPath = path.join(__dirname, 'assets/app-icon.png');
  const winIcon = fs.existsSync(icoPath)
    ? nativeImage.createFromPath(icoPath)
    : fs.existsSync(pngPath)
      ? nativeImage.createFromPath(pngPath)
      : null;

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 800,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    ...(winIcon && !winIcon.isEmpty() ? { icon: winIcon } : {}),
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  mainWindow.on('close', async (event) => {
    if (isQuitting || !mainWindow || mainWindow.isDestroyed()) return;
    if (isClosingAfterCloudSync) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    isClosingAfterCloudSync = true;
    let syncResult = { ok: true };

    try {
      syncResult = await Promise.race([
        mainWindow.webContents.executeJavaScript(
          'window.appSyncBeforeClose ? window.appSyncBeforeClose() : Promise.resolve({ ok: true, skipped: true })',
          true
        ),
        new Promise((resolve) => setTimeout(() => resolve({
          ok: false,
          reason: 'timeout',
          message: '클라우드 저장 시간이 오래 걸리고 있습니다.',
        }), 5000)),
      ]);
    } catch (error) {
      console.error('cloud sync before close failed', error);
      syncResult = {
        ok: false,
        reason: 'sync-failed',
        message: error?.message || '클라우드 저장에 실패했습니다.',
      };
    }

    if (!syncResult || syncResult.ok === false) {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['로컬에 저장하고 종료', '종료 취소'],
        defaultId: 0,
        cancelId: 1,
        title: '클라우드 저장 실패',
        message: '인터넷에 연결되어 있지 않거나 클라우드 저장이 완료되지 않았습니다.',
        detail: '변경사항은 이 컴퓨터의 로컬 저장소에는 저장되어 있습니다.\n\n다른 컴퓨터와 동기화하려면 나중에 인터넷이 연결된 상태에서 앱을 다시 실행해 주세요.',
      });

      if (result.response === 1) {
        isClosingAfterCloudSync = false;
        return;
      }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      hideWindowToTray();
    }
    isClosingAfterCloudSync = false;
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (winIcon && !winIcon.isEmpty()) mainWindow.setIcon(winIcon);
    if (app.isPackaged) {
      setTimeout(() => {
        autoUpdater.checkForUpdates().catch((error) => {
          setUpdateState({
            status: 'error',
            message: error?.message || '업데이트 확인에 실패했습니다.',
          });
        });
      }, 1500);
    }
  });

}

const WIDGET_DEFAULT_BOUNDS = {
  todo: { width: 280, height: 340, xOffset: 300, y: 60 },
  timetable: { width: 280, height: 340, xOffset: 600, y: 60 },
  memo: { width: 280, height: 340, xOffset: 900, y: 60 },
};

function createWidgetWindow(type) {
  if (!WIDGET_DEFAULT_BOUNDS[type]) return;
  const existing = widgetWindows[type];
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }

  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  const def = WIDGET_DEFAULT_BOUNDS[type];
  const defaultBounds = { width: def.width, height: def.height, x: screenWidth - def.xOffset, y: def.y };
  let bounds = defaultBounds;
  try {
    const saved = JSON.parse(db.getSetting(`widget_window_bounds_${type}`, '') || 'null');
    if (saved && typeof saved === 'object') bounds = { ...defaultBounds, ...saved };
  } catch (_) {}

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 220,
    minHeight: 200,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });
  widgetWindows[type] = win;

  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'src/widget.html'), { query: { type } });

  win.once('ready-to-show', () => win.show());

  const saveBounds = () => {
    if (win && !win.isDestroyed()) {
      db.setSetting(`widget_window_bounds_${type}`, JSON.stringify(win.getBounds()));
    }
  };
  win.on('move', saveBounds);
  win.on('resize', saveBounds);

  win.on('closed', () => {
    widgetWindows[type] = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('widget-window-closed', type);
    }
  });
}

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.setAppUserModelId('com.teacher.app');

  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    openDatabaseForUser('');
    setupAutoUpdater();
    createTray();
    createWindow();
    app.on('activate', () => {
      showMainWindow();
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform === 'darwin' && !isQuitting) return;
  if (isQuitting) app.quit();
});

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-restore', () => { if (mainWindow) { mainWindow.restore(); mainWindow.focus(); } });
ipcMain.on('window-maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());
ipcMain.on('window-always-on-top', (e, flag) => mainWindow.setAlwaysOnTop(flag));
ipcMain.on('window-set-opacity', (e, val) => mainWindow.setOpacity(Math.max(0.1, Math.min(1, Number(val)))));
ipcMain.handle('window-get-opacity', () => mainWindow.getOpacity());
ipcMain.handle('get-update-status', () => updateState);
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    setUpdateState({
      status: 'dev',
      message: '개발 실행에서는 자동 업데이트를 확인하지 않습니다.',
      progress: 0,
    });
    return updateState;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    setUpdateState({
      status: 'error',
      message: error?.message || '업데이트 확인에 실패했습니다.',
      progress: 0,
    });
  }
  return updateState;
});
ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) return updateState;
  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    setUpdateState({
      status: 'error',
      message: error?.message || '업데이트 다운로드에 실패했습니다.',
      progress: 0,
    });
  }
  return updateState;
});
ipcMain.handle('quit-and-install-update', () => {
  if (!app.isPackaged) return false;
  setImmediate(() => {
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  });
  return true;
});
ipcMain.handle('get-app-meta', () => {
  try {
    const asarPath = path.join(process.resourcesPath, 'app.asar');
    let patchedAt = '';
    if (fs.existsSync(asarPath)) {
      patchedAt = fs.statSync(asarPath).mtime.toISOString();
    }
    return {
      version: app.getVersion(),
      patchedAt,
      packaged: app.isPackaged,
    };
  } catch (err) {
    return {
      version: app.getVersion(),
      patchedAt: '',
      packaged: app.isPackaged,
      error: err.message,
    };
  }
});

ipcMain.handle('get-public-company-rules', () => {
  try {
    const filePath = path.join(__dirname, 'public_company_highschool_certificate_bonus.json');
    const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('export-app-manual-pdf', async () => {
  let pdfWindow = null;
  try {
    const defaultPath = path.join(app.getPath('documents'), '교사_업무_관리_기능_설명서.pdf');
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: '기능 설명서 PDF 저장',
      defaultPath,
      filters: [{ name: 'PDF 문서', extensions: ['pdf'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    pdfWindow = new BrowserWindow({
      show: false,
      width: 900,
      height: 1200,
      webPreferences: {
        sandbox: true,
        contextIsolation: true
      }
    });
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildManualPdfHtml())}`);
    const pdf = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    });
    fs.writeFileSync(saveResult.filePath, pdf);
    shell.showItemInFolder(saveResult.filePath);
    return { success: true, path: saveResult.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    if (pdfWindow && !pdfWindow.isDestroyed()) pdfWindow.close();
  }
});

ipcMain.on('window-widget-mode', (e, type, active) => {
  const win = widgetWindows[type];
  if (active) {
    createWidgetWindow(type);
  } else if (win && !win.isDestroyed()) {
    win.close();
  }
});

ipcMain.handle('get-active-widgets', () => {
  return Object.keys(widgetWindows).filter((type) => widgetWindows[type] && !widgetWindows[type].isDestroyed());
});

ipcMain.on('widget-window-close', (e) => {
  const senderWin = BrowserWindow.fromWebContents(e.sender);
  const type = Object.keys(widgetWindows).find((t) => widgetWindows[t] === senderWin);
  if (type && senderWin && !senderWin.isDestroyed()) senderWin.close();
});

ipcMain.handle('switch-user-database', (e, uid, options = {}) => {
  const safeUid = String(uid || '').trim();
  openDatabaseForUser(safeUid, options || {});
  return {
    success: true,
    userId: activeDbUserId,
    dbPath: db.getPath(),
  };
});

ipcMain.handle('get-setting', (e, key, def) => db.getSetting(key, def));
ipcMain.handle('set-setting', (e, key, val) => db.setSetting(key, val));
ipcMain.handle('get-all-settings', () => db.getAllSettings());
ipcMain.handle('get-ai-engine-status', async (e, engine) => {
  try {
    return await getAiEngineStatus(engine);
  } catch (err) {
    return { ready: false, error: err.message };
  }
});
ipcMain.handle('select-ai-model-file', async (e, engine) => {
  try {
    const meta = AI_MODEL_DOWNLOADS[engine];
    if (!meta) return { error: '로컬 AI 엔진을 먼저 선택해 주세요.' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: `${meta.label} 모델 파일 선택`,
      properties: ['openFile'],
      filters: [
        { name: 'GGUF Model', extensions: ['gguf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths?.[0]) return { cancelled: true };
    db.setSetting(meta.settingKey, result.filePaths[0]);
    return await getAiEngineStatus(engine);
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('open-ai-model-folder', () => {
  try {
    return shell.openPath(getAiModelDir());
  } catch (err) {
    return err.message;
  }
});
ipcMain.handle('open-ai-runtime-folder', () => {
  try {
    return shell.openPath(getAiRuntimeDir());
  } catch (err) {
    return err.message;
  }
});
ipcMain.handle('open-ai-model-download', (e, engine) => {
  const meta = AI_MODEL_DOWNLOADS[engine] || AI_MODEL_DOWNLOADS.local_basic;
  return shell.openExternal(meta.downloadUrl);
});
ipcMain.handle('open-ai-runtime-download', () => shell.openExternal(AI_RUNTIME_DOWNLOAD_URL));
ipcMain.handle('install-ollama-ai', async (e, engine = 'local_lite') => {
  const sendProgress = (payload) => {
    try {
      e.sender.send('ollama-install-progress', Object.assign({
        step: '',
        message: '',
        percent: null,
        detail: ''
      }, payload || {}));
    } catch {}
  };
  try {
    const targetEngine = AI_MODEL_DOWNLOADS[engine] ? engine : 'local_lite';
    const model = getOllamaModelForEngine(targetEngine);
    sendProgress({ step: 'check', percent: 5, message: 'Ollama 설치 여부를 확인하는 중입니다.' });
    let ollamaPath = findOllamaPath();

    if (!ollamaPath) {
      if (process.platform === 'win32') {
        // 직접 다운로드 시도, SSL 오류 등 실패 시 브라우저 fallback
        let openedInstaller = false;
        try {
          const installerPath = path.join(app.getPath('temp'), 'OllamaSetup.exe');
          sendProgress({ step: 'download-installer', percent: 10, message: 'Ollama 설치 파일을 다운로드하는 중입니다.' });
          await downloadFile(OLLAMA_INSTALLER_URL, installerPath, (progress) => {
            sendProgress({
              step: 'download-installer',
              percent: Math.max(10, Math.min(35, Math.round(10 + (progress.percent * 0.25)))),
              message: `Ollama 설치 파일 다운로드 중... ${progress.percent}%`
            });
          });
          sendProgress({ step: 'run-installer', percent: 40, message: 'Ollama 설치 파일을 실행했습니다. 설치 창을 완료해 주세요.' });
          shell.openPath(installerPath);
          openedInstaller = true;
        } catch (dlErr) {
          // 다운로드 실패(SSL 등) → 브라우저로 대신 열기
          sendProgress({ step: 'open-download', percent: 15, message: 'Ollama 다운로드 페이지를 브라우저에서 열었습니다. 설치를 완료해 주세요.' });
          shell.openExternal(OLLAMA_DOWNLOAD_URL);
        }
      } else {
        sendProgress({ step: 'open-download', percent: 15, message: 'Ollama 다운로드 페이지를 열었습니다. 설치를 완료해 주세요.' });
        shell.openExternal(OLLAMA_DOWNLOAD_URL);
      }
      return {
        success: false,
        needsUserAction: true,
        message: 'Ollama 설치를 완료한 뒤 다시 "로컬 AI 자동 설치/확인"을 눌러 주세요.'
      };
    }

    sendProgress({ step: 'start', percent: 20, message: 'Ollama를 실행하고 응답을 기다리는 중입니다.' });
    const serverReady = await waitForOllamaReady(ollamaPath);
    if (!serverReady) {
      return {
        success: false,
        message: process.platform === 'win32'
          ? 'Ollama를 실행하지 못했습니다. Windows 트레이에서 Ollama가 실행 중인지 확인한 뒤 다시 시도해 주세요.'
          : 'Ollama를 실행하지 못했습니다. Ollama 앱 또는 `ollama serve`가 실행 중인지 확인한 뒤 다시 시도해 주세요.'
      };
    }

    sendProgress({ step: 'model-check', percent: 35, message: `${model} 모델 설치 여부를 확인하는 중입니다.` });
    const before = await getOllamaStatus(targetEngine);
    if (!before.modelInstalled) {
      sendProgress({ step: 'model-download', percent: 40, message: `${model} 모델을 다운로드하는 중입니다. 처음에는 오래 걸릴 수 있습니다.` });
      let lastProgressAt = 0;
      const pulled = await runCommand(ollamaPath, ['pull', model], {
        timeout: 60 * 60 * 1000,
        env: getOllamaEnv(),
        onData: (text) => {
          const compact = text.replace(/\u001b\[[0-9;]*m/g, '').replace(/\r/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean).slice(-1)[0] || '';
          const match = compact.match(/(\d{1,3})%/);
          const now = Date.now();
          if (now - lastProgressAt < 700 && !match) return;
          lastProgressAt = now;
          const pullPercent = match ? Math.min(100, Number(match[1])) : null;
          sendProgress({
            step: 'model-download',
            percent: pullPercent == null ? 45 : Math.round(40 + (pullPercent * 0.45)),
            message: pullPercent == null ? `${model} 모델 다운로드 중...` : `${model} 모델 다운로드 중... ${pullPercent}%`,
            detail: compact
          });
        }
      });
      if (!pulled.ok) {
        return {
          success: false,
          message: `모델 다운로드에 실패했습니다. 인터넷 연결을 확인해 주세요.\n${pulled.error || pulled.output || ''}`
        };
      }
    }

    sendProgress({ step: 'test', percent: 90, message: '로컬 AI가 실제로 답변하는지 테스트하는 중입니다.' });
    const test = await requestOllamaJson('/api/generate', {
      model,
      prompt: '한국어로 짧게 "로컬 AI 준비 완료"라고 답하세요.',
      stream: false
    }, 60000);
    if (!test.ok) {
      return {
        success: false,
        message: `모델은 준비됐지만 테스트 호출에 실패했습니다. ${test.error || test.raw || ''}`
      };
    }

    db.setSetting('ai_engine', targetEngine);
    db.setSetting('ai_ollama_model', model);
    sendProgress({ step: 'done', percent: 100, message: '로컬 AI 준비가 완료되었습니다.' });
    return {
      success: true,
      message: `${model} 로컬 AI 준비가 완료되었습니다. 입력 내용은 외부 서버로 전송되지 않습니다.`,
      status: await getOllamaStatus(targetEngine)
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('apply-ai-engine', async (e, engine) => {
  try {
    if (engine) db.setSetting('ai_engine', engine);
    const status = await getAiEngineStatus(engine);
    if (!status.ready) return Object.assign({}, status, { applied: false });
    if (status.runtimePath) {
      const runtimeCheck = testAiRuntimePath(status.runtimePath);
      if (!runtimeCheck.ok) {
        return Object.assign({}, status, {
          ready: false,
          applied: false,
          message: `실행 엔진 파일은 찾았지만 실행 테스트에 실패했습니다. ${runtimeCheck.message}`
        });
      }
    }
    return Object.assign({}, status, { applied: true, message: `${status.label} 엔진을 사용할 준비가 되었습니다.` });
  } catch (err) {
    return { ready: false, applied: false, error: err.message };
  }
});
ipcMain.handle('export-backup', async () => {
  try {
    const defaultName = `teacher_app_backup_${formatFileTimestamp(new Date())}.db`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '백업 파일 저장',
      defaultPath: path.join(app.getPath('documents'), defaultName),
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
    });
    if (result.canceled || !result.filePath) {
      return { cancelled: true };
    }

    await db.backupTo(result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { error: err.message };
  }
});
ipcMain.handle('import-backup', async () => {
  let rollbackPath = '';
  let dbPath = '';
  try {
    const openResult = await dialog.showOpenDialog(mainWindow, {
      title: '복원할 백업 파일 선택',
      properties: ['openFile'],
      filters: [{ name: 'Database Backup', extensions: ['db'] }],
    });
    if (openResult.canceled || !openResult.filePaths.length) {
      return { cancelled: true };
    }

    const backupPath = openResult.filePaths[0];
    const confirm = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['복원', '취소'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: '백업 복원 확인',
      message: '현재 데이터를 선택한 백업 파일로 덮어씁니다.',
      detail: '복원 후 앱 화면이 자동으로 새로고침됩니다.',
    });
    if (confirm.response !== 0) {
      return { cancelled: true };
    }

    validateBackupFile(backupPath);
    dbPath = db.getPath();
    rollbackPath = path.join(app.getPath('temp'), `teacher_app_restore_${formatFileTimestamp(new Date())}.db`);
    await db.backupTo(rollbackPath);
    db.close();
    removeSqliteSidecars(dbPath);
    fs.copyFileSync(backupPath, dbPath);
    openDatabaseForUser(activeDbUserId);
    if (fs.existsSync(rollbackPath)) fs.rmSync(rollbackPath, { force: true });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
    return { success: true, filePath: backupPath };
  } catch (err) {
    try {
      if (rollbackPath && dbPath && fs.existsSync(rollbackPath)) {
        removeSqliteSidecars(dbPath);
        fs.copyFileSync(rollbackPath, dbPath);
        removeSqliteSidecars(dbPath);
      }
      openDatabaseForUser(activeDbUserId);
    } catch (_) {}
    if (rollbackPath && fs.existsSync(rollbackPath)) {
      try { fs.rmSync(rollbackPath, { force: true }); } catch (_) {}
    }
    return { error: err.message };
  }
});

ipcMain.handle('get-students', () => db.getStudents());
ipcMain.handle('add-student', (e, data) => db.addStudent(data));
ipcMain.handle('update-student', (e, id, data) => db.updateStudent(id, data));
ipcMain.handle('delete-student', (e, id) => db.deleteStudent(id));
ipcMain.handle('import-students-csv', (e, rows) => db.importStudentsCSV(rows));

ipcMain.handle('get-career-records', () => db.getCareerRecords());
ipcMain.handle('save-career-record', (e, record) => db.saveCareerRecord(record));
ipcMain.handle('delete-career-record', (e, id) => db.deleteCareerRecord(id));
ipcMain.handle('clear-career-records', () => db.clearCareerRecords());
ipcMain.handle('get-grade-columns-local', () => db.getGradeColumns());
ipcMain.handle('save-grade-columns-local', (e, columns) => db.saveGradeColumns(columns));
ipcMain.handle('get-grade-scores-local', () => db.getGradeScores());
ipcMain.handle('set-grade-score-local', (e, payload) => db.setGradeScore(payload));
ipcMain.handle('clear-local-grade-data', () => clearLocalGradeDataEverywhere());

ipcMain.handle('get-attendance', (e, date) => db.getAttendance(date));
ipcMain.handle('get-attendance-range', (e, start, end) => db.getAttendanceRange(start, end));
ipcMain.handle('set-attendance', (e, data) => db.setAttendance(data));
ipcMain.handle('get-attendance-stats', (e, year, month) => db.getAttendanceStats(year, month));

ipcMain.handle('get-counseling', (e, filter) => db.getCounseling(filter));
ipcMain.handle('add-counseling', (e, data) => db.addCounseling(data));
ipcMain.handle('update-counseling', (e, id, data) => db.updateCounseling(id, data));
ipcMain.handle('delete-counseling', (e, id) => db.deleteCounseling(id));

ipcMain.handle('get-observations', (e, filter) => db.getObservations(filter));
ipcMain.handle('add-observation', (e, data) => db.addObservation(data));
ipcMain.handle('update-observation', (e, id, data) => db.updateObservation(id, data));
ipcMain.handle('delete-observation', (e, id) => db.deleteObservation(id));

ipcMain.handle('get-lessons', (e, filter) => db.getLessons(filter));
ipcMain.handle('add-lesson', (e, data) => db.addLesson(data));
ipcMain.handle('update-lesson', (e, id, data) => db.updateLesson(id, data));
ipcMain.handle('delete-lesson', (e, id) => db.deleteLesson(id));

ipcMain.handle('get-assessments', () => db.getAssessments());
ipcMain.handle('add-assessment', (e, data) => db.addAssessment(data));
ipcMain.handle('update-assessment', (e, id, data) => db.updateAssessment(id, data));
ipcMain.handle('delete-assessment', (e, id) => db.deleteAssessment(id));
ipcMain.handle('get-assessment-scores', (e, assessId) => db.getAssessmentScores(assessId));
ipcMain.handle('set-assessment-score', (e, data) => db.setAssessmentScore(data));

ipcMain.handle('get-submissions', (e, filter) => db.getSubmissions(filter));
ipcMain.handle('add-submission', (e, data) => db.addSubmission(data));
ipcMain.handle('update-submission', (e, id, data) => db.updateSubmission(id, data));
ipcMain.handle('delete-submission', (e, id) => db.deleteSubmission(id));
ipcMain.handle('get-submission-status', (e, submId) => db.getSubmissionStatus(submId));
ipcMain.handle('set-submission-status', (e, data) => db.setSubmissionStatus(data));

ipcMain.handle('get-todos', (e, includeDone) => db.getTodos(includeDone));
ipcMain.handle('add-todo', (e, data) => db.addTodo(data));
ipcMain.handle('update-todo', (e, id, data) => db.updateTodo(id, data));
ipcMain.handle('toggle-todo', (e, id) => db.toggleTodo(id));
ipcMain.handle('delete-todo', (e, id) => db.deleteTodo(id));
ipcMain.handle('replace-todos', (e, items) => db.replaceTodos(items));
ipcMain.handle('set-todo-gcal-id', (e, id, gcalId) => db.setTodoGcalId(id, gcalId));
ipcMain.handle('get-todo-gcal-id', (e, id) => db.getTodoGcalId(id));
ipcMain.handle('set-todo-google-task-id', (e, id, googleTaskId) => db.setTodoGoogleTaskId(id, googleTaskId));
ipcMain.handle('get-todo-google-task-id', (e, id) => db.getTodoGoogleTaskId(id));

// ── Google Calendar OAuth ─────────────────────────────────
ipcMain.handle('gcal-oauth-start', async (e, legacyClientId = '', legacyClientSecret = '') => {
  const { clientId, clientSecret } = getGoogleCalendarOAuthConfig(legacyClientId, legacyClientSecret);
  if (!clientId) {
    return { error: 'Google 연동 설정이 아직 앱에 포함되지 않았습니다. 개발자에게 문의해 주세요.' };
  }
  return new Promise((resolve) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}`;
      const pkce = createPkcePair();
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(GOOGLE_OAUTH_SCOPES.join(' '))}&` +
        `code_challenge=${encodeURIComponent(pkce.challenge)}&` +
        `code_challenge_method=S256&` +
        `access_type=offline&prompt=consent`;
      shell.openExternal(authUrl);
      const timer = setTimeout(() => { server.close(); resolve({ error: '시간 초과' }); }, 120000);
      server.on('request', async (req, res) => {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        const code = url.searchParams.get('code');
        const oauthError = url.searchParams.get('error');
        const oauthErrorDescription = url.searchParams.get('error_description');

        // favicon.ico 등 OAuth 콜백이 아닌 요청은 무시하고 계속 대기
        if (!code && !oauthError) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>${code ? '✅ 연동 완료!' : '⚠️ 연동이 완료되지 않았습니다.'}</h2><p>이 창을 닫고 쌤포트로 돌아가세요.</p></body></html>`);
        clearTimeout(timer); server.close();
        if (!code) {
          const detail = oauthErrorDescription || oauthError || 'Google 로그인 또는 권한 동의가 완료되지 않았습니다.';
          return resolve({ error: `Google 연동 실패: ${detail}` });
        }
        const tokenPayload = {
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: pkce.verifier
        };
        // Desktop 앱 PKCE: client_secret은 환경변수로 명시된 경우에만 포함
        if (clientSecret) tokenPayload.client_secret = clientSecret;
        const body = new URLSearchParams(tokenPayload).toString();
        const tokenRes = await new Promise((r2) => {
          const req2 = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, (res2) => {
            let d = ''; res2.on('data', c => d += c); res2.on('end', () => { try { r2(JSON.parse(d)); } catch { r2({}); } });
          }); req2.on('error', () => r2({})); req2.write(body); req2.end();
        });
        if (tokenRes.refresh_token) resolve({ refresh_token: tokenRes.refresh_token });
        else resolve({ error: tokenRes.error_description || '토큰 교환 실패' });
      });
    });
  });
});

ipcMain.handle('gcal-refresh-token', async (e, arg1 = '', arg2 = '', arg3 = '') => {
  const legacyCall = !!arg3;
  const refreshToken = legacyCall ? arg3 : arg1;
  const { clientId, clientSecret } = getGoogleCalendarOAuthConfig(legacyCall ? arg1 : '', legacyCall ? arg2 : '');
  if (!clientId || !refreshToken) return { error: 'Google 캘린더 연동 정보가 없습니다.' };
  const tokenPayload = { client_id: clientId, refresh_token: refreshToken, grant_type: 'refresh_token' };
  if (clientSecret) tokenPayload.client_secret = clientSecret; // 환경변수 설정 시에만 포함
  const body = new URLSearchParams(tokenPayload).toString();
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ error: '파싱 오류' }); } });
    }); req.on('error', err => resolve({ error: err.message })); req.write(body); req.end();
  });
});

function googleCalendarRequest(accessToken, pathName, method = 'GET', payload = null) {
  const body = payload ? JSON.stringify(payload) : '';
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'www.googleapis.com',
      path: pathName,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (!data && res.statusCode >= 200 && res.statusCode < 300) return resolve({ ok: true, status: res.statusCode });
        try {
          const parsed = JSON.parse(data || '{}');
          if (res.statusCode >= 400 && !parsed.error) parsed.error = { message: `Google Calendar 오류 ${res.statusCode}` };
          resolve(parsed);
        } catch {
          resolve({ error: 'Google Calendar 응답을 읽지 못했습니다.', status: res.statusCode });
        }
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

ipcMain.handle('gcal-add-event', async (e, accessToken, event) => {
  return googleCalendarRequest(accessToken, '/calendar/v3/calendars/primary/events', 'POST', event);
});

ipcMain.handle('gcal-update-event', async (e, accessToken, eventId, event) => {
  if (!eventId) return { error: 'Google Calendar 이벤트 ID가 없습니다.' };
  return googleCalendarRequest(accessToken, `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, 'PATCH', event);
});

ipcMain.handle('gcal-delete-event', async (e, accessToken, eventId) => {
  if (!eventId) return { error: 'Google Calendar 이벤트 ID가 없습니다.' };
  return googleCalendarRequest(accessToken, `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, 'DELETE');
});

function googleTasksRequest(accessToken, pathName, method = 'GET', payload = null) {
  const body = payload ? JSON.stringify(payload) : '';
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'tasks.googleapis.com',
      path: pathName,
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {})
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (!data && res.statusCode >= 200 && res.statusCode < 300) return resolve({ ok: true, status: res.statusCode });
        try {
          const parsed = JSON.parse(data || '{}');
          if (res.statusCode >= 400 && !parsed.error) parsed.error = { message: `Google Tasks 오류 ${res.statusCode}` };
          resolve(parsed);
        } catch {
          resolve({ error: { message: 'Google Tasks 응답을 읽지 못했습니다.' }, status: res.statusCode });
        }
      });
    });
    req.on('error', (error) => resolve({ error: { message: error.message } }));
    if (body) req.write(body);
    req.end();
  });
}

function buildGoogleTaskPayload(task) {
  const payload = {
    title: String(task.title || '').trim() || '쌤포트 할일',
    notes: [
      task.priority ? `중요도: ${task.priority}` : '',
      task.category ? `카테고리: ${task.category}` : '',
      task.source_text ? `원문: ${task.source_text}` : ''
    ].filter(Boolean).join('\n'),
    status: task.is_done ? 'completed' : 'needsAction'
  };
  if (task.deadline) payload.due = `${task.deadline}T00:00:00.000Z`;
  if (task.is_done) payload.completed = new Date().toISOString();
  return payload;
}

// 전체 목록 조회 (페이지네이션 처리, 완료·숨김 포함)
ipcMain.handle('gtasks-list-tasks', async (e, accessToken) => {
  if (!accessToken) return { error: 'Google 계정이 연결되지 않았습니다.' };
  let allTasks = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({
      showCompleted: 'true',
      showHidden: 'true',
      maxResults: '100',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const result = await googleTasksRequest(
      accessToken,
      `/tasks/v1/lists/%40default/tasks?${params}`,
      'GET'
    );
    if (result.error) return result;
    allTasks = allTasks.concat(Array.isArray(result.items) ? result.items : []);
    pageToken = result.nextPageToken || null;
  } while (pageToken);
  return { items: allTasks };
});

ipcMain.handle('gtasks-add-task', async (e, accessToken, task) => {
  return googleTasksRequest(accessToken, '/tasks/v1/lists/%40default/tasks', 'POST', buildGoogleTaskPayload(task || {}));
});

ipcMain.handle('gtasks-update-task', async (e, accessToken, taskId, task) => {
  if (!taskId) return { error: { message: 'Google Tasks ID가 없습니다.' } };
  return googleTasksRequest(accessToken, `/tasks/v1/lists/%40default/tasks/${encodeURIComponent(taskId)}`, 'PATCH', buildGoogleTaskPayload(task || {}));
});

ipcMain.handle('gtasks-set-status', async (e, accessToken, taskId, isDone) => {
  if (!taskId) return { error: { message: 'Google Tasks ID가 없습니다.' } };
  const payload = isDone
    ? { status: 'completed', completed: new Date().toISOString() }
    : { status: 'needsAction', completed: null };
  return googleTasksRequest(accessToken, `/tasks/v1/lists/%40default/tasks/${encodeURIComponent(taskId)}`, 'PATCH', payload);
});

ipcMain.handle('gtasks-delete-task', async (e, accessToken, taskId) => {
  if (!taskId) return { error: { message: 'Google Tasks ID가 없습니다.' } };
  return googleTasksRequest(accessToken, `/tasks/v1/lists/%40default/tasks/${encodeURIComponent(taskId)}`, 'DELETE');
});

ipcMain.handle('get-ddays', () => db.getDdays());
ipcMain.handle('add-dday', (e, data) => db.addDday(data));
ipcMain.handle('delete-dday', (e, id) => db.deleteDday(id));

ipcMain.handle('get-timetable', () => db.getTimetable());
ipcMain.handle('set-timetable-cell', (e, data) => db.setTimetableCell(data));
ipcMain.handle('clear-timetable', () => db.clearTimetable());
ipcMain.handle('replace-timetable', (e, items) => db.replaceTimetable(items));

ipcMain.handle('get-daily-memo', (e, date) => db.getDailyMemo(date));
ipcMain.handle('set-daily-memo', (e, date, content) => db.setDailyMemo(date, content));
ipcMain.handle('get-daily-memos', (e, year, month) => db.getDailyMemos(year, month));

ipcMain.handle('open-url', (e, url) => shell.openExternal(url));
ipcMain.handle('open-path', (e, targetPath) => shell.openPath(targetPath));

ipcMain.handle('apply-app-patch', async () => {
  try {
    if (!app.isPackaged) {
      return { error: '설치된 프로그램에서만 패치 적용을 사용할 수 있습니다.' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: '패치용 app.asar 선택',
      properties: ['openFile'],
      filters: [{ name: 'Patch Asar', extensions: ['asar'] }],
    });
    if (result.canceled || !result.filePaths.length) {
      return { cancelled: true };
    }

    const sourceAsar = result.filePaths[0];
    const targetAsar = path.join(process.resourcesPath, 'app.asar');
    const exePath = process.execPath;
    const cmdPath = path.join(app.getPath('userData'), 'apply_in_app_patch.cmd');
    const scriptPath = path.join(app.getPath('userData'), 'apply_in_app_patch.ps1');
    const logPath = path.join(app.getPath('userData'), 'apply_in_app_patch.log');
    const currentPid = process.pid;
    const cmdScript = `@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply_in_app_patch.ps1" "%~1" "%~2" "%~3" "%~4" "%~5"
`;
    const script = `
$ErrorActionPreference = 'Stop'
$source = $args[0]
$target = $args[1]
$exe = $args[2]
$log = $args[3]
$pidToWait = [int]$args[4]

function Write-Log($message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message"
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
}

Write-Log "patch script started"
for ($i = 0; $i -lt 120; $i++) {
  if (-not (Get-Process -Id $pidToWait -ErrorAction SilentlyContinue)) {
    break
  }
  Start-Sleep -Milliseconds 500
}

Write-Log "target process closed"
for ($i = 0; $i -lt 60; $i++) {
  try {
    Copy-Item -LiteralPath $source -Destination $target -Force
    Write-Log "app.asar copied"
    Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
    Write-Log "app restarted"
    exit 0
  } catch {
    Write-Log "retry $i failed: $($_.Exception.Message)"
    Start-Sleep -Milliseconds 500
  }
}

Write-Log "patch failed after retries"
exit 1
`;
    fs.writeFileSync(cmdPath, cmdScript, 'ascii');
    fs.writeFileSync(scriptPath, '\ufeff' + script.trimStart(), 'utf8');
    fs.writeFileSync(logPath, '', 'utf8');
    const child = spawn('cmd.exe', [
      '/c',
      cmdPath,
      sourceAsar,
      targetAsar,
      exePath,
      logPath,
      String(currentPid),
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    setTimeout(() => app.quit(), 300);
    return { success: true };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('neis-get-meal', async (e, eduCode, schoolCode, date) => {
  try { return await neisApi.getMeal(eduCode, schoolCode, date); } catch (err) { return { error: err.message }; }
});

ipcMain.handle('neis-get-calendar', async (e, eduCode, schoolCode, yearMonth) => {
  try { return await neisApi.getCalendar(eduCode, schoolCode, yearMonth); } catch (err) { return []; }
});

ipcMain.handle('neis-get-weather', async (e, region) => {
  try { return await neisApi.getWeather(region); } catch (err) { return { error: err.message }; }
});


ipcMain.handle('ai-extract-todos', async (e, apiKey, model, provider, text) => {
  try {
    if (provider === 'local_lite' || provider === 'local') {
      return await runLocalTodoExtraction(text);
    }
    // 할일 추출은 학생 단어가 포함돼도 허용 (단순 업무 텍스트 처리)
    const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
    const system = `교사의 카카오톡, 문자, 공문에서 할일만 추출하세요. 한 줄에 하나씩 '- [ ] 할일내용 (기한: YYYY-MM-DD)' 형식으로 출력하세요. 기한이 없으면 날짜를 생략하고 설명은 쓰지 마세요. 오늘 날짜는 ${today}입니다. "이번 주", "다음 주", "내일" 등 상대적 표현은 오늘 날짜 기준으로 계산하세요.`;
    if (provider === 'gemini') {
      return await runGemini(apiKey, model, text, {
        system,
        userPrompt: `다음 텍스트에서 할일을 추출해 주세요:\n\n${text}`,
      });
    }
    return await runClaude(apiKey, model, text, {
      system,
      userPrompt: `다음 텍스트에서 할일을 추출해 주세요:\n\n${text}`,
    });
  } catch (err) {
    return { error: err.message };
  }
});

async function runLocalTodoExtraction(text) {
  const input = String(text || '').trim();
  if (!input) return { error: '추출할 텍스트가 비어 있습니다.' };
  const engine = db.getSetting('ai_engine', 'local_lite');
  const model = getOllamaModelForEngine(engine);
  const status = await getOllamaStatus(engine);
  if (!status.ready) return { error: status.message || '로컬 AI가 아직 준비되지 않았습니다.' };

  const today = new Date().toISOString().slice(0, 10);
  const prompt = [
    '당신은 교사용 업무 문장에서 할일만 추출하는 로컬 AI입니다.',
    '입력 내용은 이 PC 안에서만 처리됩니다.',
    '반드시 한국어로 답하세요.',
    '출력은 설명 없이 한 줄에 하나씩만 작성하세요.',
    "형식: - [ ] 할일내용 (기한: YYYY-MM-DD)",
    '기한이 명확하지 않으면 (기한: ...) 부분을 쓰지 마세요.',
    '해야 할 행동이 아닌 단순 인사, 잡담, 배경 설명은 제외하세요.',
    '원문에 없는 학생 정보나 업무를 만들지 마세요.',
    `오늘 날짜: ${today}`,
    '',
    '추출할 원문:',
    input
  ].join('\n');

  const result = await requestOllamaJson('/api/generate', {
    model,
    stream: false,
    prompt,
    options: {
      temperature: 0.1,
      num_predict: 520
    }
  }, 90000);
  if (!result.ok) return { error: result.error || result.raw || 'Ollama 호출에 실패했습니다.' };
  const output = String(result.data?.response || '').trim();
  return { result: normalizeTodoExtractionOutput(output) };
}

function normalizeTodoExtractionOutput(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      let value = line
        .replace(/^```(?:[a-z]+)?/i, '')
        .replace(/```$/i, '')
        .replace(/^\d+[.)]\s*/, '')
        .replace(/^[-*•]\s*/, '')
        .replace(/^\[[ xX]?\]\s*/, '')
        .trim();
      if (!value) return '';
      if (!/\(기한:\s*\d{4}-\d{2}-\d{2}\)/.test(value)) {
        const date = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
        if (date) value = value.replace(/\d{4}-\d{2}-\d{2}/, '').trim() + ` (기한: ${date})`;
      }
      return value ? `- [ ] ${value}` : '';
    })
    .filter(Boolean)
    .join('\n');
}


ipcMain.handle('ai-extract-estimate-image', async (e, apiKey, model, provider, file) => {
  try {
    if (!file || !file.data) return { error: '파일 정보가 올바르지 않습니다.' };
    const system = '견적서에서 품목 정보를 추출하여 JSON 배열만 출력하세요. 각 요소는 {"name":"품목명","spec":"규격","qty":수량,"price":단가} 형식이며 숫자는 쉼표 없이 순수 숫자입니다. 코드블록이나 설명 없이 JSON 배열만 출력하세요.';
    const userPrompt = '이 견적서에서 품목 목록을 추출해서 JSON 배열로 출력하세요.';
    const isPdf = file.mimeType === 'application/pdf';
    const options = isPdf
      ? { system, userPrompt, document: { data: file.data } }
      : { system, userPrompt, image: file };
    if (provider === 'gemini') return await runGemini(apiKey, model, '', options);
    return await runClaude(apiKey, model, '', options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-extract-estimate-text', async (e, apiKey, model, provider, text) => {
  try {
    if (!text || !String(text).trim()) return { error: '추출할 내용이 비어 있습니다.' };
    const system = '엑셀/CSV에서 뽑아낸 표 형태의 텍스트(탭으로 구분된 행)에서 견적 품목 정보를 찾아 JSON 배열만 출력하세요. 헤더 행, 합계 행, 빈 행은 무시하세요. 각 요소는 {"name":"품목명","spec":"규격","qty":수량,"price":단가} 형식이며 숫자는 쉼표 없이 순수 숫자입니다. 규격이나 수량 정보가 없으면 빈 문자열이나 1로 채우세요. 코드블록이나 설명 없이 JSON 배열만 출력하세요.';
    const userPrompt = `다음 표에서 품목 목록을 추출해서 JSON 배열로 출력하세요:\n\n${text}`;
    if (provider === 'gemini') return await runGemini(apiKey, model, text, { system, userPrompt });
    return await runClaude(apiKey, model, text, { system, userPrompt });
  } catch (err) {
    return { error: err.message };
  }
});

// Tesseract.js 로컬 OCR (한국어 + 영어)
ipcMain.handle('ocr-image', async (e, imageBase64, lang) => {
  try {
    const { createWorker } = require('tesseract.js');
    const worker = await createWorker(lang || 'kor+eng', 1, {
      logger: () => {},
      // 한국어 학습 데이터 경로 (tesseract.js가 자동 캐시)
    });
    const buf = Buffer.from(imageBase64, 'base64');
    const { data: { text } } = await worker.recognize(buf);
    await worker.terminate();
    return { text: text.trim() };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('parse-excel-estimate', async (e, bufferData) => {
  try {
    const xlsx = require('xlsx');
    const buf = Buffer.from(bufferData);
    const wb = xlsx.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return { rows };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-generate-official-doc', async (e, apiKey, model, provider, inputJson) => {
  try {
    const system = `당신은 대한민국 공공언어 전문가로, 한국공공언어진흥원 공문서 작성법 기준에 따라 학교 공문을 작성합니다.

[핵심 규칙]
## 구조
- 두문: 수신 / (경유) / 제목
- 본문: 관련근거(있으면 1.로) → 핵심내용(항목별)
- 끝. 또는 붙임 뒤에 끝.

## 제목
- 내용 전체를 포괄하는 명사구
- 모호한 표현('우리 기관' 등) 금지

## 항목 기호 순서
- 첫째: 1., 2., 3. / 둘째: 가., 나., 다. / 셋째: 1), 2) / 넷째: 가), 나)
- 항목 문장은 '-다' 형 평서형 종결어미로 끝냄

## 날짜·시간·금액
- 날짜: 2026. 4. 28.(월) — 점 뒤 한 칸, 일 뒤 반드시 점
- 기간: 2026. 4. 28.~5. 2.
- 시간: 24시각제 쌍점 — 09:00, 13:30
- 금액: 금13,500원(금일만삼천오백원)

## 붙임
- 각 파일 개별 기재, 묶지 않음
- 붙임  1. 파일명 1부.
        2. 파일명 1부.  끝.
- 단일 파일: 붙임  파일명 1부.  끝.

## 끝.
- 본문이 끝나면 두 칸 띄우고 끝.
- 붙임이 있으면 붙임 표시문 끝에 두 칸 띄우고 끝.

## 표현 원칙
1. 사실성: 육하원칙, 중복표현('2월달→2월', '기간 동안→기간', '새로 신설→신설') 금지
2. 용이성: 외래어 한글화 후 괄호에 원어 — 연구 개발(R&D)
3. 명확성: 호응 맞추기, 명사 나열 형태 지양
4. 비고압성: '절대·필히·엄금' 지양, 명령형→안내형
5. 비표지성: '불우 이웃→어려운 이웃', 순서 없으면 가나다순
6. 수요자 중심: '민원 접수→민원 신청', '여권 교부→여권 수령'

## 출력 형식
- 제목 줄부터 끝. 까지만 출력 (수신·발신명의·기안자·시행번호 등 결문 서식 제외)
- 설명·마크다운 없이 공문 텍스트만 출력
- 빈 항목은 임의로 채우지 말고 [ ] 로 표시`;

    const userPrompt = `다음 정보를 바탕으로 학교 공문 본문(제목~끝.)을 작성해 주세요:\n\n${inputJson}`;
    const options = { system, userPrompt, maxTokens: 2048 };
    if (provider === 'gemini') return await runGemini(apiKey, model, '', options);
    return await runClaude(apiKey, model, '', options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-assistant-chat', async (e, payload = {}) => {
  try {
    const apiKey = String(payload.apiKey || '');
    const provider = String(payload.provider || 'claude');
    const model = String(payload.model || '');
    const page = String(payload.page || '현재 페이지');
    const sensitive = !!payload.sensitive || isStudentSensitivePage(page);
    // 민감 페이지면 차단 대신 가명화: 식별정보는 가짜 토큰으로 바꿔 전송하고, 응답을 받으면 로컬에서 복원한다.
    const pseudoMap = sensitive ? buildStudentPseudonymMap() : null;
    const rawQuestion = String(payload.question || '');
    const question = sensitive ? pseudonymizeForCloud(rawQuestion, pseudoMap) : rawQuestion;
    const context = sensitive ? pseudonymizeForCloud(payload.context || '', pseudoMap) : String(payload.context || '');
    if (!apiKey || !question) return { error: 'AI 설정 또는 질문이 비어 있습니다.' };
    if (/^(안녕|안녕하세요|하이|hello|hi)$/i.test(String(payload.question || '').trim())) {
      return { result: '선생님, 안녕하세요. 오늘 쌤포트에서 어떤 업무를 도와드릴까요?' };
    }
    const options = {
      system: [
        '당신은 쌤포트 앱 안의 AI 도우미입니다.',
        '모든 답변은 반드시 "선생님,"으로 시작하세요.',
        '사용자는 학생이 아니라 교사입니다. 사용자를 "학생"이라고 부르지 말고 "선생님"이라고 부르세요.',
        '사용자는 학생 상담/공문/시간표/할일/학사 업무를 빠르게 처리하려고 합니다.',
        sensitive ? '입력의 학생 식별정보는 "학생A", "학생B" 같은 가명으로 치환되어 있습니다. 답변에서도 이 가명을 그대로 사용하고, 실제 이름·번호·연락처를 추정하거나 만들어내지 마세요.' : '',
        '학생 상담과 개인정보는 매우 민감하므로 단정적 진단, 의료적 판단, 낙인 표현을 피하고 학교 절차와 교사의 최종 판단을 존중하세요.',
        '고정 안내문처럼 답하지 말고, 사용자의 질문과 현재 페이지 맥락을 반영해 구체적으로 답하세요.',
        '가능하면 바로 쓸 수 있는 문장, 확인할 항목, 다음 행동을 포함하세요.',
        '한국어로 실무적으로 답하세요. 내용이 복잡하면 3~5개의 구체 항목으로 정리하세요.'
      ].filter(Boolean).join('\n'),
      userPrompt: `현재 페이지: ${page}\n\n${context ? `앱에 저장된 관련 맥락:\n${context}\n\n` : ''}사용자 질문:\n${question}`,
      maxTokens: 1200
    };
    const result = provider === 'gemini'
      ? await runGemini(apiKey, model || 'gemini-2.5-flash', '', options)
      : await runClaude(apiKey, model || 'claude-haiku-4-5-20251001', '', options);
    if (result?.result) {
      result.result = normalizeAssistantAddressing(result.result);
      // 클라우드 응답의 가명을 로컬에서 실제 이름으로 복원해 사용자에게 표시
      if (pseudoMap) result.result = depseudonymizeFromCloud(result.result, pseudoMap);
    }
    return result;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-local-chat', async (e, payload = {}) => {
  try {
    const engine = String(payload.engine || db.getSetting('ai_engine', 'local_lite'));
    const model = getOllamaModelForEngine(engine);
    const question = String(payload.question || '').trim();
    const context = String(payload.context || '').trim();
    const page = String(payload.page || '현재 페이지');
    if (!question) return { error: '질문이 비어 있습니다.' };
    if (/^(안녕|안녕하세요|하이|hello|hi)$/i.test(question)) {
      return { result: '선생님, 안녕하세요. 오늘 쌤포트에서 어떤 업무를 도와드릴까요?' };
    }
    const status = await getOllamaStatus(engine);
    if (!status.ready) return { error: status.message || '로컬 AI가 아직 준비되지 않았습니다.' };
    const buildPrompt = (retryText = '') => [
        '당신은 쌤포트 앱 안의 로컬 AI 도우미입니다.',
        '모든 답변은 반드시 "선생님,"으로 시작하세요.',
        '사용자는 학생이 아니라 교사입니다. 사용자를 "학생"이라고 부르지 말고 "선생님"이라고 부르세요.',
        '반드시 한국어로만 답하세요. 중국어, 일본어, 영어 문장을 섞지 마세요.',
        '상담 대상 학생을 언급해야 할 때만 "학생" 또는 "해당 학생"이라고 쓰세요.',
        '학생 상담, 성적, 개인정보는 민감하므로 외부 전송 없이 로컬에서만 답합니다.',
        context ? '아래 앱 저장 기록을 최우선 근거로 사용하세요. 기록에 없는 사실은 만들지 마세요.' : '',
        '고정 안내문처럼 답하지 말고, 질문의 의도와 현재 페이지 맥락에 맞춰 구체적으로 답하세요.',
        '가능하면 바로 쓸 수 있는 문장, 확인할 항목, 다음 행동을 포함하세요.',
        '기본 답변은 700자 안팎으로 하되, 필요한 경우 3~5개의 구체 항목으로 정리하세요.',
        '의학적 진단, 낙인 표현, 단정적 판단을 피하고 교사가 활용할 수 있는 실무 문장으로 도와주세요.',
        `현재 페이지: ${page}`,
        '',
        context ? `앱에 저장된 관련 맥락:\n${context}\n` : '',
        retryText ? `이전 답변에 한국어가 아닌 문자가 섞였습니다. 아래 질문에 대해 다시 한국어로만 답하세요.\n${retryText}` : `사용자 질문: ${question}`
      ].join('\n');
    const runLocal = (prompt) => requestOllamaJson('/api/generate', {
      model,
      stream: false,
      prompt,
      options: {
        temperature: 0.35,
        num_predict: context ? 900 : 620
      }
    }, 120000);
    let result = await runLocal(buildPrompt());
    if (!result.ok) return { error: result.error || result.raw || 'Ollama 호출에 실패했습니다.' };
    let answer = result.data?.response || '';
    if (containsCjkChinese(answer)) {
      const retry = await runLocal(buildPrompt(`질문: ${question}\n\n금지: 중국어 한자 표현, 同学, 您, 请, 成绩报告 같은 중국어 표현`));
      if (retry.ok && retry.data?.response) answer = retry.data.response;
    }
    return { result: normalizeAssistantAddressing(answer) };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('import-class-timetable-excel', async (e, payload) => {
  try {
    const buffer = Buffer.from(String(payload?.data || ''), 'base64');
    const entries = await parseClassTimetableExcel(buffer);
    db.setSetting('class_timetable_json', JSON.stringify(entries));
    if (payload?.name) {
      db.setSetting('class_timetable_file_name', payload.name);
    }
    return { success: true, count: entries.length };
  } catch (err) {
    return { error: err.message };
  }
});

async function runClaude(apiKey, model, text, options = {}) {
  const content = [];
  if (options.userPrompt || text) {
    content.push({ type: 'text', text: options.userPrompt || text });
  }
  if (options.image?.data && options.image?.mimeType) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: options.image.mimeType,
        data: options.image.data,
      },
    });
  }
  if (options.document?.data) {
    content.push({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: options.document.data,
      },
    });
  }
  const body = JSON.stringify({
    model,
    max_tokens: options.maxTokens || 1024,
    system: options.system || '',
    messages: [{ role: 'user', content }],
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ result: json.content?.[0]?.text || '' });
        } catch (err) {
          resolve({ error: err.message });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.write(body);
    req.end();
  });
}

async function runGemini(apiKey, model, text, options = {}) {
  const parts = [];

  // 이미지가 있으면 먼저(Gemini는 이미지→텍스트 순서 권장)
  if (options.image?.data && options.image?.mimeType) {
    parts.push({ inline_data: { mime_type: options.image.mimeType, data: options.image.data } });
  }
  if (options.userPrompt || text) {
    parts.push({ text: options.userPrompt || text });
  }

  // 이미지 포함 시: 현재 사용 가능한 비전 모델로 자동 교체
  // gemini-2.5-pro 등 유료 전용 모델은 무료 비전 모델로 대체
  let useModel = model;
  if (options.image?.data) {
    const supportedVision = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash'];
    const isSupported = supportedVision.some((m) => useModel.startsWith(m));
    if (!isSupported) {
      useModel = 'gemini-2.0-flash'; // 현재 무료 비전 모델
    }
  }

  const bodyObj = {
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: 2048 },
  };
  // systemInstruction은 일부 모델만 지원 - 있을 때만 포함
  if (options.system) {
    bodyObj.systemInstruction = { parts: [{ text: options.system }] };
  }
  const body = JSON.stringify(bodyObj);
  // API 키는 URL 쿼리(로그/히스토리에 남을 수 있음) 대신 헤더로 전달
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent`;

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-goog-api-key': apiKey },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // API 오류 응답 처리
          if (json.error) {
            const msg = json.error.message || '';
            if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
              return resolve({ error: `Gemini 무료 한도 초과입니다. 설정에서 모델을 "gemini-2.0-flash"로 바꿔보세요.` });
            }
            return resolve({ error: `Gemini 오류: ${msg || JSON.stringify(json.error)}` });
          }
          // 안전 필터 차단
          const blockReason = json.promptFeedback?.blockReason;
          if (blockReason) {
            return resolve({ error: `Gemini 안전 필터 차단: ${blockReason}` });
          }
          const resultText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (!resultText && json.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
            return resolve({ error: 'Gemini 응답이 너무 깁니다. 더 간단한 이미지로 시도해 주세요.' });
          }
          resolve({ result: resultText });
        } catch (err) {
          resolve({ error: `응답 파싱 오류: ${err.message}` });
        }
      });
    });
    req.on('error', (err) => resolve({ error: `네트워크 오류: ${err.message}` }));
    req.write(body);
    req.end();
  });
}

async function parseClassTimetableExcel(buffer) {
  const { DOMParser } = require('@xmldom/xmldom');
  const files = await unzipWorkbook(buffer);
  const parser = new DOMParser();

  const workbookXml = asText(files['xl/workbook.xml']);
  if (!workbookXml) throw new Error('엑셀 파일을 읽지 못했습니다.');
  const workbookDoc = parser.parseFromString(workbookXml, 'text/xml');
  const relsDoc = parser.parseFromString(asText(files['xl/_rels/workbook.xml.rels']) || '<Relationships/>', 'text/xml');

  const firstSheet = workbookDoc.getElementsByTagName('sheet')[0];
  if (!firstSheet) throw new Error('시트를 찾지 못했습니다.');
  const relationId = firstSheet.getAttribute('r:id') || firstSheet.getAttribute('Id');
  const target = findSheetTarget(relsDoc, relationId);
  const sheetPath = normalizeSheetPath(target);
  const sheetXml = asText(files[sheetPath]);
  if (!sheetXml) throw new Error('시간표 시트를 찾지 못했습니다.');

  const sharedStrings = parseSharedStrings(parser, asText(files['xl/sharedStrings.xml']) || '');
  const sheetDoc = parser.parseFromString(sheetXml, 'text/xml');
  const matrix = parseWorksheet(sheetDoc, sharedStrings);
  const entries = matrixToClassTimetable(matrix);

  if (!entries.length) {
    throw new Error('학급 시간표 형식을 인식하지 못했습니다. NEIS 시간표 엑셀 파일인지 확인해 주세요.');
  }
  return entries;
}

function unzipWorkbook(buffer) {
  const yauzl = require('yauzl');
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zip) => {
      if (error) return reject(error);
      const files = {};
      zip.readEntry();
      zip.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return reject(streamError);
          const chunks = [];
          stream.on('data', (chunk) => chunks.push(chunk));
          stream.on('end', () => {
            files[entry.fileName] = Buffer.concat(chunks);
            zip.readEntry();
          });
        });
      });
      zip.on('end', () => resolve(files));
      zip.on('error', reject);
    });
  });
}

function asText(value) {
  return Buffer.isBuffer(value) ? value.toString('utf8') : '';
}

function formatFileTimestamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function removeSqliteSidecars(dbPath) {
  const walPath = `${dbPath}-wal`;
  const shmPath = `${dbPath}-shm`;
  if (fs.existsSync(walPath)) fs.rmSync(walPath, { force: true });
  if (fs.existsSync(shmPath)) fs.rmSync(shmPath, { force: true });
}

function validateBackupFile(filePath) {
  let tempDb;
  try {
    tempDb = new SQLiteDatabase(filePath, { readonly: true, fileMustExist: true });
    const integrity = tempDb.pragma('integrity_check', { simple: true });
    if (String(integrity).toLowerCase() !== 'ok') {
      throw new Error('선택한 파일이 올바른 백업 데이터가 아닙니다.');
    }
    const settingsTable = tempDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
      .get();
    if (!settingsTable) {
      throw new Error('교사앱 백업 파일이 아닙니다.');
    }
  } finally {
    if (tempDb) tempDb.close();
  }
}

function findSheetTarget(relsDoc, relationId) {
  const relationships = Array.from(relsDoc.getElementsByTagName('Relationship'));
  const relation = relationships.find((item) => item.getAttribute('Id') === relationId);
  return relation ? relation.getAttribute('Target') : 'worksheets/sheet1.xml';
}

function normalizeSheetPath(target) {
  if (!target) return 'xl/worksheets/sheet1.xml';
  return target.startsWith('xl/') ? target : `xl/${target.replace(/^\/+/, '')}`;
}

function parseSharedStrings(parser, xml) {
  if (!xml) return [];
  const doc = parser.parseFromString(xml, 'text/xml');
  return Array.from(doc.getElementsByTagName('si')).map((item) => normalizeCellText(item.textContent || ''));
}

function parseWorksheet(sheetDoc, sharedStrings) {
  const rows = new Map();
  Array.from(sheetDoc.getElementsByTagName('row')).forEach((rowNode) => {
    const rowIndex = Number(rowNode.getAttribute('r') || 0);
    const rowMap = new Map();
    Array.from(rowNode.getElementsByTagName('c')).forEach((cellNode) => {
      const ref = cellNode.getAttribute('r') || '';
      const colIndex = columnRefToIndex(ref.replace(/\d+/g, ''));
      if (!colIndex) return;
      const value = readCellValue(cellNode, sharedStrings);
      if (value) rowMap.set(colIndex, value);
    });
    if (rowMap.size) rows.set(rowIndex, rowMap);
  });
  return rows;
}

function readCellValue(cellNode, sharedStrings) {
  const type = cellNode.getAttribute('t') || '';
  const valueNode = cellNode.getElementsByTagName('v')[0];
  const inlineNode = cellNode.getElementsByTagName('is')[0];
  if (type === 'inlineStr' && inlineNode) {
    return normalizeCellText(inlineNode.textContent || '');
  }
  if (!valueNode) return '';
  const raw = valueNode.textContent || '';
  if (type === 's') {
    return normalizeCellText(sharedStrings[Number(raw)] || '');
  }
  return normalizeCellText(raw);
}

function normalizeCellText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function columnRefToIndex(ref) {
  if (!ref) return 0;
  let index = 0;
  for (let i = 0; i < ref.length; i += 1) {
    index = index * 26 + (ref.charCodeAt(i) - 64);
  }
  return index;
}

function matrixToClassTimetable(rows) {
  const weekdayMap = {
    '월': 0,
    '화': 1,
    '수': 2,
    '목': 3,
    '금': 4,
  };
  let headerRowIndex = 0;
  let dayColumns = [];

  for (const [rowIndex, rowMap] of rows.entries()) {
    const matches = [];
    for (const [colIndex, value] of rowMap.entries()) {
      const label = normalizeCellText(value);
      const weekday = Object.keys(weekdayMap).find((key) => label.startsWith(key) || label.includes(`${key}요일`));
      if (weekday !== undefined) {
        matches.push({ colIndex, day: weekdayMap[weekday] });
      }
    }
    if (matches.length > dayColumns.length) {
      headerRowIndex = rowIndex;
      dayColumns = matches.filter((match) => match.day <= 4).sort((a, b) => a.colIndex - b.colIndex);
    }
  }

  if (dayColumns.length < 3) {
    // 헤더 감지 실패 시 NEIS 기본 컬럼 레이아웃(열 B~F) 사용
    dayColumns = [2, 3, 4, 5, 6].map((colIndex, idx) => ({ colIndex, day: idx }));
  }

  const entries = [];
  let pendingPeriod = null;
  const sortedRows = Array.from(rows.entries())
    .filter(([rowIndex]) => rowIndex > headerRowIndex)
    .sort((a, b) => a[0] - b[0]);

  for (const [, rowMap] of sortedRows) {
    const firstCol = normalizeCellText(rowMap.get(1) || '');
    const periodMatch = firstCol.match(/^(\d{1,2})\s*교시/);
    const periodDigit = /^\d{1,2}$/.test(firstCol) ? Number(firstCol) : null;
    const detectedPeriod = periodMatch ? Number(periodMatch[1]) : periodDigit;

    if (detectedPeriod && detectedPeriod >= 1 && detectedPeriod <= 12) {
      pendingPeriod = detectedPeriod;
      continue;
    }

    if (!pendingPeriod) continue;
    const usePeriod = pendingPeriod;
    pendingPeriod = null;

    dayColumns.forEach(({ colIndex, day }) => {
      const rawCell = normalizeCellText(rowMap.get(colIndex) || '');
      const parsedCell = parseClassTimetableCell(rawCell);
      if (!parsedCell.subject || /^\d+학년/.test(parsedCell.subject)) return;
      entries.push({
        day_of_week: day,
        period: usePeriod,
        subject: parsedCell.subject,
        teacher: parsedCell.teacher,
        is_my_class: false,
      });
    });
  }

  const deduped = new Map();
  entries.forEach((entry) => deduped.set(`${entry.day_of_week}_${entry.period}`, entry));
  return Array.from(deduped.values()).sort((a, b) =>
    a.period !== b.period ? a.period - b.period : a.day_of_week - b.day_of_week
  );
}

function parseClassTimetableCell(value) {
  const cleaned = normalizeCellText(value).replace(/^\-+$/, '').replace(/^\s*없음\s*$/i, '');
  if (!cleaned) return { subject: '', teacher: '' };

  const match = cleaned.match(/^(.*?)(?:\(([^()]*)\))?\s*$/);
  return {
    subject: normalizeCellText(match?.[1] || cleaned),
    teacher: normalizeCellText(match?.[2] || ''),
  };
}

ipcMain.handle('ai-extract-timetable', async (e, apiKey, model, provider, text) => {
  try {
    const options = {
      system: 'Read a teacher timetable memo and return only a JSON array. Each item must be {"day_of_week":0-4,"period":1-7,"subject":"exact cell text","is_my_class":true|false}. Preserve the visible cell text exactly as written. Do not split room numbers or remove leading numbers such as "107음악". IMPORTANT: cells that start with symbols such as "*202기업" or "*201기업" are real classes, not notes or empty cells. Keep the leading "*" in subject exactly. Do not guess missing cells. Do not output markdown or explanations.',
      userPrompt: `Convert the following timetable note into JSON. If a class text begins with *, keep it exactly, for example "*202기업".\n\n${text}`,
    };
    if (provider === 'gemini') {
      return await runGemini(apiKey, model, text, options);
    }
    return await runClaude(apiKey, model, text, options);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('ai-extract-timetable-image', async (e, apiKey, model, provider, image) => {
  try {
    if (!image || !image.data || !image.mimeType) {
      return { error: '이미지 정보가 올바르지 않습니다.' };
    }
    const options = {
      system: 'Read the timetable image and return only a JSON array. Each item must be {"day_of_week":0-4,"period":1-7,"subject":"exact cell text","is_my_class":true|false}. Preserve each visible cell text exactly. Do not split room numbers or locations from the subject text. If a cell shows "107음악", keep subject as "107음악". IMPORTANT: a leading asterisk is part of the class text. Cells like "*202기업", "*202가정", or "*201기업" must be extracted as real classes and the "*" must remain in subject. Do not treat "*" as a bullet, footnote, or empty marker. Do not guess unclear cells. Do not output markdown or explanations.',
      userPrompt: 'Extract the visible weekly timetable from this image into JSON. Pay special attention to small leading symbols: keep subjects that begin with * exactly, such as "*202기업".',
      image,
    };
    if (provider === 'gemini') {
      return await runGemini(apiKey, model, '', options);
    }
    return await runClaude(apiKey, model, '', options);
  } catch (err) {
    return { error: err.message };
  }
});

// ── 에듀파인 CDP 매크로 ───────────────────────────────────────────────────────
// Chrome / Edge 모두 지원 (Chromium 기반 공통 DevTools Protocol)

let _macroStopWsUrl = null;

// HTTP GET → JSON
function cdpHttpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(2500, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// WebSocket 클라이언트 프레임 인코딩 (마스킹 포함)
function wsEncode(text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const len = payload.length;
  const hdr = len <= 125
    ? [0x81, 0x80 | len, mask[0], mask[1], mask[2], mask[3]]
    : [0x81, 0xFE, (len >> 8) & 0xFF, len & 0xFF, mask[0], mask[1], mask[2], mask[3]];
  const header = Buffer.from(hdr);
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
  return Buffer.concat([header, masked]);
}

// WebSocket 서버 프레임 디코딩 (비마스킹)
function wsDecode(buf) {
  if (buf.length < 2) return null;
  let len = buf[1] & 0x7F;
  let off = 2;
  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2); off = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2)); off = 10;
  }
  if (buf.length < off + len) return null;
  return { text: buf.slice(off, off + len).toString('utf8'), rest: buf.slice(off + len) };
}

// CDP Runtime.evaluate 실행
function cdpEval(wsUrl, expression, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const sock = net.createConnection(parseInt(u.port) || 9222, u.hostname);
    let buf = Buffer.alloc(0);
    let upgraded = false;
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('CDP 응답 시간 초과')); }, timeoutMs);

    sock.on('connect', () => {
      sock.write(
        `GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });

    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (!upgraded) {
        const idx = buf.indexOf('\r\n\r\n');
        if (idx < 0) return;
        upgraded = true;
        buf = buf.slice(idx + 4);
        sock.write(wsEncode(JSON.stringify({
          id: 1, method: 'Runtime.evaluate',
          params: { expression, awaitPromise: true, returnByValue: true },
        })));
      }
      let parsed;
      while ((parsed = wsDecode(buf)) !== null) {
        buf = parsed.rest;
        try {
          const msg = JSON.parse(parsed.text);
          if (msg.id === 1) { clearTimeout(timer); sock.destroy(); resolve(msg.result || msg); return; }
        } catch (_) {}
      }
    });

    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// Chrome/Edge 실행 경로 탐색
function findBrowserPath() {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft\\Edge\\Application\\msedge.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe'),
  ].filter(Boolean);
  return candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

// ── IPC 핸들러 ────────────────────────────────────────────────────────────────

// 에듀파인 탭 감지
ipcMain.handle('macro-cdp-check', async () => {
  try {
    const tabs = await cdpHttpGet('http://localhost:9222/json/list');
    const eduTab = Array.isArray(tabs) ? tabs.find((t) =>
      (t.url || '').includes('klef.cbe.go.kr') ||
      (t.url || '').includes('keris_ui') ||
      (t.url || '').includes('edufine') ||
      (t.title || '').includes('에듀파인') ||
      (t.title || '').includes('케리스') ||
      (t.title || '').includes('품의')
    ) : null;
    return { connected: true, tabCount: tabs.length, eduTab: eduTab || null };
  } catch {
    return { connected: false };
  }
});

// 브라우저를 디버그 모드로 실행 (전용 프로필 — 로그인 유지됨)
ipcMain.handle('macro-launch-debug-browser', () => {
  const browserPath = findBrowserPath();
  if (!browserPath) return { error: 'Chrome 또는 Edge를 찾을 수 없습니다.' };
  const profileDir = path.join(os.homedir(), 'EdufineMacroProfile');
  const child = spawn(browserPath, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--disable-background-mode',
    'https://klef.cbe.go.kr/keris_ui/main.do',
  ], { detached: true, stdio: 'ignore' });
  child.unref();
  const name = browserPath.includes('msedge') ? 'Edge' : 'Chrome';
  return { ok: true, browser: name };
});

// 데스크탑 바로가기 생성 (다음부터 로그인 상태 유지)
ipcMain.handle('macro-create-shortcut', () => {
  const browserPath = findBrowserPath();
  if (!browserPath) return { error: 'Chrome 또는 Edge를 찾을 수 없습니다.' };
  const profileDir = path.join(os.homedir(), 'EdufineMacroProfile');
  const browserName = browserPath.includes('msedge') ? 'Edge' : 'Chrome';
  const desktopPath = path.join(os.homedir(), 'Desktop');
  const shortcutPath = path.join(desktopPath, '에듀파인(품의서매크로).lnk');
  const psScript = `
$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$sc.TargetPath = '${browserPath.replace(/'/g, "''")}'
$sc.Arguments = '--remote-debugging-port=9222 --user-data-dir="${profileDir}" --no-first-run https://klef.cbe.go.kr/keris_ui/main.do'
$sc.Description = '에듀파인 품의서 매크로용 브라우저'
$sc.Save()
`;
  try {
    const tmpFile = path.join(os.tmpdir(), `shortcut_${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, '﻿' + psScript, 'utf8');
    execSync(`powershell -ExecutionPolicy Bypass -NonInteractive -File "${tmpFile}"`, { windowsHide: true });
    fs.unlinkSync(tmpFile);
    return { ok: true, browser: browserName, path: shortcutPath };
  } catch (err) {
    return { error: err.message };
  }
});

// 중지 신호 전달
ipcMain.handle('macro-stop', async () => {
  if (_macroStopWsUrl) {
    try { await cdpEval(_macroStopWsUrl, 'window.__macroStop=true;', 3000); } catch (_) {}
  }
  return { ok: true };
});

// CDP로 에듀파인 자동 입력
// 에듀파인 페이지 구조 진단
ipcMain.handle('macro-diagnose', async (e, wsUrl) => {
  const diagScript = `(function() {
    function collectDoc(doc, depth) {
      if (!doc || depth > 4) return {};
      try {
        const inputs = [...doc.querySelectorAll('input')].map(el => ({
          type: el.type, ro: el.readOnly, dis: el.disabled,
          cls: el.className.slice(0,30), vis: el.offsetParent !== null,
          w: Math.round(el.getBoundingClientRect().width)
        })).slice(0, 15);
        const ceds = [...doc.querySelectorAll('[contenteditable]')].map(el => ({
          tag: el.tagName, cls: el.className.slice(0,30),
          vis: el.offsetParent !== null,
          txt: (el.textContent||'').slice(0,20)
        })).slice(0, 10);
        const btns = [...doc.querySelectorAll('button,input[type=button],input[type=submit],a[href="#"],a[onclick],span[onclick],td[onclick],div[onclick]')]
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            tag: el.tagName,
            txt: (el.textContent||el.value||el.title||'').replace(/\\s+/g,' ').trim().slice(0,25),
            cls: el.className.slice(0,20)
          }))
          .filter(x => x.txt).slice(0, 20);
        const frames = [...doc.querySelectorAll('iframe')].map((f,i) => {
          let sub = {};
          try { if (f.contentDocument) sub = collectDoc(f.contentDocument, depth+1); } catch(_) {}
          return { i, src: (f.src||'').slice(0,60), id: f.id, name: f.name, sub };
        });
        return { inputs, ceds, btns, frames, url: (doc.location||{}).href || '' };
      } catch(e) { return { err: e.message }; }
    }
    return JSON.stringify(collectDoc(document, 0));
  })()`;
  try {
    const result = await cdpEval(wsUrl, diagScript, 15000);
    const val = result && (result.value ?? (result.result && result.result.value));
    return val ? JSON.parse(val) : { error: '진단 실패' };
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle('macro-fill-edufine-cdp', async (e, { wsUrl, items }) => {
  _macroStopWsUrl = wsUrl;

  const expression = `(async function() {
  window.__macroStop = false;
  const _items = ${JSON.stringify(items)};
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 재귀적으로 모든 doc 수집 (iframe 안의 iframe까지)
  function getAllDocs(root, _seen) {
    const seen = _seen || new Set();
    if (!root || seen.has(root)) return [];
    seen.add(root);
    const result = [root];
    try {
      [...root.querySelectorAll('iframe,frame')].forEach(f => {
        try { if (f.contentDocument) result.push(...getAllDocs(f.contentDocument, seen)); } catch(_) {}
      });
    } catch(_) {}
    return result;
  }

  // 표준 input 셀 수집
  function visibleInputs() {
    const results = [];
    getAllDocs(document).forEach(doc => {
      doc.querySelectorAll(
        'input[type="text"]:not([readonly]):not([disabled]),' +
        'input:not([type]):not([readonly]):not([disabled]),' +
        'input[type="number"]:not([readonly]):not([disabled])'
      ).forEach(el => {
        try { const r = el.getBoundingClientRect(); if (r.width > 5 && r.height > 5) results.push(el); } catch(_) {}
      });
    });
    return results;
  }

  // contenteditable 셀 수집 (KERIS 그리드 방식)
  function visibleEditables() {
    const results = [];
    getAllDocs(document).forEach(doc => {
      doc.querySelectorAll('[contenteditable="true"],[contenteditable=""]').forEach(el => {
        try {
          const tag = el.tagName;
          if (tag === 'BODY' || tag === 'HTML') return;
          const r = el.getBoundingClientRect();
          if (r.width > 5 && r.height > 5) results.push(el);
        } catch(_) {}
      });
    });
    return results;
  }

  // input 또는 contenteditable에 값 설정
  function setVal(el, val) {
    if (!el) return;
    const sVal = String(val);
    try { el.focus(); el.click(); } catch(_) {}
    if (el.getAttribute && el.getAttribute('contenteditable') !== null) {
      // contenteditable 셀
      try { el.textContent = ''; } catch(_) {}
      try {
        el.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, sVal);
      } catch(_) { el.textContent = sVal; }
      ['input','change','keyup','blur'].forEach(t => {
        try { el.dispatchEvent(new Event(t, { bubbles: true })); } catch(_) {}
      });
    } else {
      // 일반 input
      try {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
        if (s && s.set) s.set.call(el, sVal); else el.value = sVal;
      } catch { el.value = sVal; }
      ['input','change','keyup','blur'].forEach(t => {
        try { el.dispatchEvent(new Event(t, { bubbles: true })); } catch(_) {}
      });
    }
  }

  // 행추가 버튼 탐색 (전체 doc, 부분 텍스트 매칭)
  function findAddBtn() {
    for (const doc of getAllDocs(document)) {
      const all = [...doc.querySelectorAll('button,input[type=button],input[type=submit],a,span,td,div,li')];
      const match = all.find(el => {
        const t = (el.textContent || el.value || el.title || (el.getAttribute && el.getAttribute('aria-label')) || '').replace(/\\s/g,'');
        return t.includes('행추가') || t.includes('행 추가') || t === '추가' || t === '내역추가' || t.includes('내역추가');
      });
      if (match) return match;
    }
    return null;
  }

  // 버튼 클릭 (click + MouseEvent 병행)
  function clickBtn(btn) {
    try {
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true }));
      btn.dispatchEvent(new MouseEvent('click',     { bubbles: true, cancelable: true }));
      btn.click();
    } catch(_) {}
  }

  const addBtn = findAddBtn();
  if (!addBtn) {
    // 어떤 버튼/클릭 요소가 있는지 수집해 반환
    const found = [];
    getAllDocs(document).forEach(doc => {
      [...doc.querySelectorAll('button,input[type=button],a,span,td,div')]
        .filter(el => el.offsetParent !== null)
        .forEach(el => {
          const t = (el.textContent||el.value||'').replace(/\\s+/g,' ').trim().slice(0,20);
          if (t) found.push(t);
        });
    });
    return JSON.stringify({ error: '행추가 버튼 없음', buttons: [...new Set(found)].slice(0,15) });
  }

  for (let i = 0; i < _items.length; i++) {
    if (window.__macroStop) return JSON.stringify({ stopped: true, count: i });
    const item = _items[i];

    const beforeInputs  = new Set(visibleInputs());
    const beforeEditables = new Set(visibleEditables());

    clickBtn(addBtn);
    await sleep(1500);

    // 새로 생긴 input 탐색
    const afterInputs    = visibleInputs();
    const afterEditables = visibleEditables();
    const newInputs      = afterInputs.filter(el => !beforeInputs.has(el));
    const newEditables   = afterEditables.filter(el => !beforeEditables.has(el));

    let targets;
    if (newInputs.length >= 2) {
      targets = newInputs;
    } else if (newEditables.length >= 2) {
      targets = newEditables;
    } else if (afterInputs.length > 0) {
      // 행 추가 안 됐지만 기존 input 마지막 행 사용 (이미 비어 있는 경우)
      const empty = afterInputs.filter(el => !(el.value||'').trim());
      targets = empty.length >= 2 ? empty : afterInputs.slice(-6);
    } else if (afterEditables.length > 0) {
      const empty = afterEditables.filter(el => !(el.textContent||'').trim());
      targets = empty.length >= 2 ? empty : afterEditables.slice(-6);
    } else {
      return JSON.stringify({
        error: '행 ' + (i+1) + ': 입력 셀 없음',
        detail: 'input=' + afterInputs.length + ' editable=' + afterEditables.length
      });
    }

    if (item.name  != null && targets[0]) { setVal(targets[0], item.name);  await sleep(200); }
    if (item.spec  != null && targets[1]) { setVal(targets[1], item.spec);  await sleep(200); }
    if (item.qty   != null && targets[2]) { setVal(targets[2], item.qty);   await sleep(200); }
    // 단가는 4번째 또는 5번째 셀 (비고 칸이 있을 수 있음)
    const pi = targets.length >= 5 ? 4 : targets.length >= 4 ? 3 : targets.length - 1;
    if (item.price != null && pi >= 0 && targets[pi]) { setVal(targets[pi], item.price); await sleep(200); }

    await sleep(300);
  }
  return JSON.stringify({ done: true, count: _items.length });
})()`;

  try {
    const result = await cdpEval(wsUrl, expression, 180000);
    const val = result && (result.value ?? (result.result && result.result.value));
    if (!val) return { error: '응답 없음: ' + JSON.stringify(result) };
    try { return JSON.parse(val); } catch { return { error: val }; }
  } catch (err) {
    return { error: err.message };
  } finally {
    _macroStopWsUrl = null;
  }
});

// ── 한글(HWP) 템플릿 빌더: hwpx XML 직접 생성 (한글 설치 불필요) ─
ipcMain.handle('show-open-dialog', async (_evt, opts) => {
  return dialog.showOpenDialog(mainWindow, opts || {});
});

ipcMain.handle('hwp-build-hwpx', async (_evt, opts) => {
  const markdownText = (opts && typeof opts === 'object') ? opts.markdownText : opts;
  const logoPath = (opts && typeof opts === 'object' && opts.logoPath) ? opts.logoPath : '';
  if (!markdownText || !String(markdownText).trim()) {
    return { ok: false, error: '입력 텍스트가 비어있습니다.' };
  }
  const saveRes = await dialog.showSaveDialog(mainWindow, {
    title: 'hwpx 파일 저장 위치 (깔끔 템플릿)',
    defaultPath: '문서.hwpx',
    filters: [{ name: '한글 문서', extensions: ['hwpx'] }]
  });
  if (saveRes.canceled || !saveRes.filePath) {
    return { ok: false, error: '저장 취소되었습니다.', canceled: true };
  }

  const isDev = !app.isPackaged;
  const engineDir = isDev
    ? path.join(__dirname, 'hwp_engine')
    : path.join(process.resourcesPath, 'hwp_engine');
  const builderPath = path.join(engineDir, 'hwpx_builder.py');

  const tmpDir = os.tmpdir();
  const tmpTxt = path.join(tmpDir, `hwpx-md-${Date.now()}.txt`);
  fs.writeFileSync(tmpTxt, markdownText, 'utf8');

  // 번들된 Python (embeddable) 경로 — Windows 빌드에만 포함됨.
  // 시스템 Python보다 우선 사용하여 미설치 사용자도 동작 보장.
  const bundledPy = process.platform === 'win32'
    ? path.join(isDev ? __dirname : process.resourcesPath, 'python-embed', 'python.exe')
    : null;
  const pyCandidates = process.platform === 'win32'
    ? [bundledPy, 'python', 'py', 'python3'].filter(Boolean)
    : ['python3', 'python'];

  return await new Promise((resolve) => {
    function tryNext(idx) {
      if (idx >= pyCandidates.length) {
        try { fs.unlinkSync(tmpTxt); } catch (_) {}
        return resolve({ ok: false, error: 'Python 실행 파일을 찾을 수 없습니다. Python 3.8+ 설치가 필요합니다.' });
      }
      const pyArgs = [builderPath, tmpTxt, saveRes.filePath];
      if (logoPath) pyArgs.push(logoPath);
      const py = spawn(pyCandidates[idx], pyArgs, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      let out = '', err = '';
      py.stdout.on('data', d => { out += d.toString('utf8'); });
      py.stderr.on('data', d => { err += d.toString('utf8'); });
      py.on('error', () => tryNext(idx + 1));
      py.on('close', (code) => {
        try { fs.unlinkSync(tmpTxt); } catch (_) {}
        try {
          const parsed = JSON.parse(out.trim());
          resolve(parsed);
        } catch {
          resolve({ ok: false, error: err || out || `Python exit code ${code}` });
        }
      });
    }
    tryNext(0);
  });
});

// ── 한글(HWP) 자동 서식: 로컬 AI(Ollama)로 마크다운 생성 ──────────
ipcMain.handle('hwp-generate-markdown', async (_evt, { topic, docType }) => {
  if (!topic || !String(topic).trim()) {
    return { ok: false, error: '주제를 입력해주세요.' };
  }

  // 현재 설정된 AI 엔진 → 모델 결정
  const engine = db.getSetting('ai_engine', 'local_lite');
  const model = getOllamaModelForEngine(engine);
  if (!model) {
    return { ok: false, error: 'AI 엔진이 설정되어 있지 않습니다. (설정 → AI 엔진)' };
  }

  const prompt = buildHwpMarkdownPrompt(topic, docType);
  const result = await requestOllamaJson('/api/generate', {
    model,
    stream: false,
    prompt,
    options: { temperature: 0.3, num_predict: 2000 }
  }, 120000);

  if (!result.ok) {
    return { ok: false, error: result.error || result.raw || 'AI 호출 실패' };
  }

  let md = String(result.data?.response || '').trim();
  // 코드블럭 마커 제거
  md = md.replace(/^```(?:markdown|md)?\s*/i, '').replace(/```\s*$/i, '').trim();
  return { ok: true, markdown: md, model };
});

// ── 한글(HWP) 자동 서식: GPT/Claude용 프롬프트 생성 (복사용) ────
ipcMain.handle('hwp-build-prompt', async (_evt, { topic, docType, school, sections }) => {
  return { ok: true, prompt: buildHwpMarkdownPrompt(topic || '', docType || '', school || '', sections || null) };
});

function buildHwpMarkdownPrompt(topic, docType, school, sections) {
  const typeLabel = docType || '공문서';
  const schoolLine = school ? `부서: ${school}` : `부서: 부서명 팀명 (예: 중등교육과 중등교육팀)`;

  // sections 가 주어지면 그 순서대로, AI 섹션만 본문 작성. 직접 작성 섹션은 대제목 줄만 출력.
  // sections 가 null 이면 기본 가이드라인만 안내.
  let sectionInstr = '';
  if (Array.isArray(sections) && sections.length) {
    const lines = ['[섹션 구성 — 반드시 아래 순서·이름 그대로 출력]'];
    sections.forEach((s, i) => {
      const isAttach = s.type === 'attachment';
      const typeLabel = isAttach ? '[붙임]' : '[대제목]';
      const writeLabel = s.mode === 'manual' ? '✍️ 직접 작성 (본문 비워둘 것)' : '🤖 AI 작성';
      lines.push(`  ${i + 1}. ${typeLabel} ${s.name}  — ${writeLabel}`);
    });
    lines.push('');
    lines.push('규칙:');
    lines.push('- [대제목] 섹션: "대제목: <이름>" 형태로 출력');
    lines.push('- [붙임] 섹션: "붙임: <이름>" 형태로 출력 (번호는 자동 부여되므로 생략)');
    lines.push('- 🤖 AI 작성 [대제목]: 아래에 ◦ 항목 3~5개로 충실히 작성');
    lines.push('- 🤖 AI 작성 [붙임]: 아래에 ◦ 항목 또는 내용 2~4개로 작성');
    lines.push('- ✍️ 직접 작성 섹션: 해당 태그 줄 + 빈 줄 한 줄만 출력하고 본문은 작성하지 말 것 (사용자가 직접 채울 영역)');
    lines.push('- 위에 명시되지 않은 추가 섹션은 임의로 만들지 말 것');
    sectionInstr = lines.join('\n');
  } else {
    sectionInstr = [
      '[스타일]',
      '- 대제목은 3~6개가 적당 (관련 근거, 추진 목적, 추진 방침, 세부 추진 계획, 기대 효과 등)',
      '- 각 대제목 아래 3~5개 ◦ 항목'
    ].join('\n');
  }

  return [
    `당신은 한국 학교/교육청의 공문서 작성 전문가입니다.`,
    `아래 주제로 "${typeLabel}"를 교육청 현장지원단 운영 계획 스타일로 작성해주세요.`,
    ``,
    `주제: ${topic}`,
    school ? `기관명: ${school}` : '',
    ``,
    `[출력 규칙 - 반드시 지켜주세요]`,
    `- 아래 태그 형식으로만 작성 (다른 설명이나 코드블록 없이 본문만 출력)`,
    `- 제목: 문서 제목 (1줄)`,
    `- 부제목: 부제목 (선택, 1줄)`,
    school
      ? `- 부서: ${school}  ← 반드시 이 문자열을 글자 그대로 사용. "${school}"을 "${school}등학교"·"${school}교육청" 등으로 확장하거나 축약하지 말 것. 본문 안에서 기관을 지칭할 때도 동일한 표기 사용.`
      : `- 부서: 부서명 팀명 (반드시 이 기관명 그대로 사용)`,
    `- 대제목: 섹션 제목 — 로마자 자동 부여됨 (Ⅰ, Ⅱ, Ⅲ...) 생략해도 됨`,
    `- 소제목: □ 스타일 소제목 (굵게)`,
    `- ◦ 항목 — 수준1 불릿 (대제목 바로 아래 또는 독립 항목)`,
    `-   - 세부항목 — 수준2: 반드시 "공백 2칸 + 대시(-) + 공백" 으로 시작. 절대 "*"·"•"·"·"·"▪" 등 다른 기호를 쓰지 말 것. 들여쓰기 없는 줄은 수준2로 인식되지 않음.`,
    `- ※ 주석 내용`,
    `- 표:`,
    `  헤더1 | 헤더2 | 헤더3`,
    `  값1 | 값2 | 값3`,
    `  (표 끝은 빈 줄)`,
    ``,
    `[문체]`,
    `- 교육청 공문서 스타일: 간결, 격식, 명사형 종결("~함", "~필요", "~추진", "~지원")`,
    `- 각 대제목 아래 3~5개 ◦ 항목`,
    ``,
    sectionInstr,
    ``,
    `[예시]`,
    `제목: 2026. 중학교 자유학기제 현장지원단 운영 계획`,
    schoolLine,
    ``,
    `대제목: 관련 근거`,
    `◦ 2026. 주요업무계획 1-1-2 학생 주도성을 키우는 교육과정`,
    `◦ 충청북도교육과정 총론(충청북도교육청 고시 제2026-5호)`,
    ``,
    `대제목: 추진 목적`,
    `◦ 교육과정 편성·운영 활성화를 위한 교육청 차원의 지원 기반 마련`,
    `◦ 학교 현장의 요구에 기반한 맞춤형 지원으로 정책 추진 실효성 제고`,
    ``,
    `대제목: 세부 추진 계획`,
    `소제목: 현장지원단 조직 및 운영`,
    `◦ (기간) 2026. 4. ~ 2027. 2.`,
    `◦ (구성) 중학교 교육과정 운영에 역량있는 교원`,
    `◦ (주요 역할)`,
    `  - 단위학교 컨설팅 및 연수 지원`,
    `  - 현장 의견 수렴 및 도움 자료 개발`,
    `소제목: 주요 추진 일정`,
    `표:`,
    `월 | 주요 내용 | 비고`,
    `4월 | 지원단 구성 및 발대식 | 도교육청`,
    `8월 | 역량 강화 워크숍 | 지원단`,
    ``,
    `이제 같은 형식으로 작성하세요 (태그 형식 본문만, 설명 없이):`
  ].join('\n');
}
