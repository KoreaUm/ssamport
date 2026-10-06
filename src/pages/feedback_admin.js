(function () {
let feedbackList = [];
let statusFilter = 'open';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  try {
    const date = value && value.toDate ? value.toDate() : null;
    if (!date) return '';
    return date.toLocaleString('ko-KR');
  } catch (_) {
    return '';
  }
}

async function render(container) {
  const authState = window.appAuthGetState ? window.appAuthGetState() : null;
  if (!authState?.isAdmin) {
    container.innerHTML = `
      <div class="page-wrap" style="max-width:920px;margin:0 auto">
        <div class="page-header">
          <h1 class="page-header-title">피드백 관리</h1>
        </div>
        <section class="card settings-card">
          <div class="settings-note">관리자만 접근할 수 있습니다.</div>
        </section>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-wrap" style="max-width:920px;margin:0 auto">
      <div class="page-header flex items-center justify-between gap-3 flex-wrap">
        <h1 class="page-header-title">피드백 관리</h1>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-secondary btn-sm" id="feedback-admin-refresh">새로고침</button>
          <button class="btn btn-primary btn-sm" id="feedback-admin-back">설정으로 돌아가기</button>
        </div>
      </div>

      <section class="card settings-card">
        <div class="settings-head">
          <div>
            <div class="settings-title">사용자 오류 제보 / 의견</div>
            <div class="settings-note">앱 안의 피드백 버튼으로 사용자가 보낸 제보 목록입니다.</div>
          </div>
        </div>
        <div class="flex gap-2 mb-3 flex-wrap">
          <button class="btn btn-sm feedback-filter-btn ${statusFilter === 'open' ? 'btn-primary' : 'btn-secondary'}" data-filter="open">처리 전</button>
          <button class="btn btn-sm feedback-filter-btn ${statusFilter === 'resolved' ? 'btn-primary' : 'btn-secondary'}" data-filter="resolved">처리 완료</button>
          <button class="btn btn-sm feedback-filter-btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-filter="all">전체</button>
        </div>
        <div id="feedback-admin-list"></div>
      </section>
    </div>
  `;
}

function renderList() {
  const root = document.getElementById('feedback-admin-list');
  if (!root) return;

  const filtered = feedbackList.filter((item) => statusFilter === 'all' || item.status === statusFilter);
  if (!filtered.length) {
    root.innerHTML = '<div class="settings-note">표시할 항목이 없습니다.</div>';
    return;
  }

  root.innerHTML = filtered.map((item) => `
    <div class="card" style="margin-bottom:10px;padding:14px" data-feedback-id="${escapeHtml(item.id)}">
      <div class="flex justify-between gap-3 flex-wrap" style="align-items:flex-start">
        <div>
          <div style="font-weight:600">${item.type === 'bug' ? '🐞 오류 제보' : '💡 의견/제안'}</div>
          <div class="settings-note">${escapeHtml(item.displayName || item.email)} (${escapeHtml(item.email)}) · ${escapeHtml(formatDate(item.createdAt))}</div>
          <div class="settings-note">앱 ${escapeHtml(item.appVersion)} · ${escapeHtml(item.platform)}</div>
        </div>
        <button class="btn btn-sm ${item.status === 'resolved' ? 'btn-secondary' : 'btn-primary'} feedback-status-btn" data-id="${escapeHtml(item.id)}" data-next="${item.status === 'resolved' ? 'open' : 'resolved'}">
          ${item.status === 'resolved' ? '처리 완료 취소' : '처리 완료로 표시'}
        </button>
      </div>
      <div style="margin-top:10px;white-space:pre-wrap">${escapeHtml(item.message)}</div>
    </div>
  `).join('');

  root.querySelectorAll('.feedback-status-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await window.appFeedbackSetStatus(button.dataset.id, button.dataset.next);
        toast('처리 상태를 변경했습니다.', 'success');
        await loadFeedback();
      } catch (error) {
        toast(error?.message || '처리 상태 변경에 실패했습니다.', 'error');
        button.disabled = false;
      }
    });
  });
}

async function loadFeedback() {
  try {
    feedbackList = await window.appFeedbackList();
  } catch (error) {
    toast(error?.message || '피드백을 불러오지 못했습니다.', 'error');
    feedbackList = [];
  }
  renderList();
}

async function init() {
  const authState = window.appAuthGetState ? window.appAuthGetState() : null;
  if (!authState?.isAdmin) return;

  document.getElementById('feedback-admin-back')?.addEventListener('click', () => {
    if (window.navigateTo) window.navigateTo('settings');
  });

  document.getElementById('feedback-admin-refresh')?.addEventListener('click', async () => {
    await loadFeedback();
  });

  document.querySelectorAll('.feedback-filter-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      statusFilter = button.dataset.filter || 'open';
      await render(document.getElementById('page-content'));
      await init();
    });
  });

  await loadFeedback();
}

window.registerPage('feedback_admin', { render, init });
})();
