(function () {
let userList = [];
let searchKeyword = '';
let statusFilter = 'all';
let selectedUids = new Set();

async function render(container) {
  const authState = window.appAuthGetState ? window.appAuthGetState() : null;
  if (!authState?.isAdmin) {
    container.innerHTML = `
      <div class="page-wrap" style="max-width:920px;margin:0 auto">
        <div class="page-header">
          <h1 class="page-header-title">회원 관리</h1>
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
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <h1 class="page-header-title">회원 관리</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="user-management-refresh">새로고침</button>
          <button class="btn btn-primary btn-sm" id="user-management-back">설정으로 돌아가기</button>
        </div>
      </div>

      <section class="card settings-card" style="margin-bottom:16px">
        <div class="settings-head">
          <div>
            <div class="settings-title">공지사항 배포</div>
            <div class="settings-note">사용자가 프로그램을 켰을 때 보여줄 공지사항을 배포합니다. 업데이트 내용, 사용 방법 변경 등을 적어 주세요.</div>
          </div>
        </div>
        <div class="form-row">
          <label>제목</label>
          <input class="input" id="notice-title" placeholder="예: 업데이트 안내">
        </div>
        <div class="form-row">
          <label>버전</label>
          <input class="input" id="notice-version" placeholder="예: 2.0.16">
        </div>
        <div class="form-row">
          <label>내용</label>
          <textarea class="input" id="notice-body" style="min-height:130px;resize:vertical" placeholder="- 변경된 내용&#10;- 사용자가 알아야 할 내용"></textarea>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="notice-publish-btn">공지사항 배포</button>
          <button class="btn btn-secondary btn-sm" id="notice-load-btn">현재 공지 불러오기</button>
          <span id="notice-status" class="settings-note"></span>
        </div>
      </section>

      <section class="card settings-card" style="margin-bottom:16px">
        <div class="settings-head">
          <div>
            <div class="settings-title">성적관리 비밀번호</div>
            <div class="settings-note">성적관리 권한이 있는 교사도 이 비밀번호를 입력해야 페이지에 들어갈 수 있습니다. 기본값: cndwntkdrh1234</div>
          </div>
        </div>
        <div class="form-row">
          <label>새 비밀번호</label>
          <input class="input" id="grades-password-new" type="text" placeholder="새 비밀번호 입력" style="max-width:260px">
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="grades-password-save-btn">비밀번호 변경</button>
          <span id="grades-password-admin-status" class="settings-note"></span>
        </div>
      </section>

      <section class="card settings-card">
        <div class="settings-head">
          <div>
            <div class="settings-title">사용자 검색 및 관리</div>
            <div class="settings-note">문제가 있는 사용자만 중지하거나 삭제하면 됩니다. 삭제된 계정은 이 앱에서 다시 로그인할 수 없습니다.</div>
          </div>
        </div>

        <div class="form-row">
          <label>검색</label>
          <input class="input" id="user-management-search" placeholder="이름 또는 이메일 검색" value="${escapeHtml(searchKeyword)}">
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px">
          <button class="btn btn-sm user-filter-btn${statusFilter === 'all' ? ' btn-primary' : ' btn-secondary'}" data-filter="all">전체</button>
          <button class="btn btn-sm user-filter-btn${statusFilter === 'active' ? ' btn-primary' : ' btn-secondary'}" data-filter="active">사용 중</button>
          <button class="btn btn-sm user-filter-btn${statusFilter === 'blocked' ? ' btn-primary' : ' btn-secondary'}" data-filter="blocked">사용 중지</button>
          <button class="btn btn-sm user-filter-btn${statusFilter === 'deleted' ? ' btn-primary' : ' btn-secondary'}" data-filter="deleted">삭제됨</button>
        </div>

        <div id="user-management-summary" class="settings-note" style="margin-bottom:12px"></div>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text)">
            <input type="checkbox" id="user-select-all">
            전체 선택
          </label>
          <button class="btn btn-danger btn-sm" id="user-bulk-delete-btn" disabled>선택 삭제 (<span id="user-bulk-delete-count">0</span>)</button>
        </div>
        <div id="user-management-list" style="display:flex;flex-direction:column;gap:10px;max-height:560px;overflow:auto;padding-right:4px"></div>
      </section>
    </div>
  `;
}

async function init() {
  const authState = window.appAuthGetState ? window.appAuthGetState() : null;
  if (!authState?.isAdmin) return;

  document.getElementById('user-management-back')?.addEventListener('click', () => {
    if (window.navigateTo) window.navigateTo('settings');
  });

  document.getElementById('user-management-refresh')?.addEventListener('click', async () => {
    await loadUsers(true);
  });

  document.getElementById('notice-load-btn')?.addEventListener('click', async () => {
    await loadNotice(true);
  });

  document.getElementById('notice-publish-btn')?.addEventListener('click', async () => {
    await publishNotice();
  });

  document.getElementById('grades-password-save-btn')?.addEventListener('click', async () => {
    await saveGradesPassword();
  });

  document.getElementById('user-management-search')?.addEventListener('input', (event) => {
    searchKeyword = event.target.value || '';
    renderUserList();
  });

  document.querySelectorAll('.user-filter-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      statusFilter = button.dataset.filter || 'all';
      await render(document.getElementById('page-content'));
      await init();
    });
  });

  document.getElementById('user-select-all')?.addEventListener('change', (event) => {
    const checked = event.target.checked;
    const boxes = document.querySelectorAll('.user-select-checkbox');
    boxes.forEach((box) => {
      box.checked = checked;
      if (checked) selectedUids.add(box.dataset.uid);
      else selectedUids.delete(box.dataset.uid);
    });
    updateBulkDeleteButton();
  });

  document.getElementById('user-bulk-delete-btn')?.addEventListener('click', async () => {
    await bulkDeleteSelected();
  });

  await loadUsers(false);
  await loadNotice(false);
}

async function loadNotice(showToast) {
  const status = document.getElementById('notice-status');
  try {
    const notice = window.appNoticeGet ? await window.appNoticeGet() : null;
    document.getElementById('notice-title').value = notice?.title || '';
    document.getElementById('notice-version').value = notice?.version || '';
    document.getElementById('notice-body').value = notice?.body || '';
    if (status) status.textContent = notice ? '현재 배포된 공지를 불러왔습니다.' : '아직 배포된 공지가 없습니다.';
    if (showToast) toast('공지사항을 불러왔습니다.', 'success');
  } catch (error) {
    if (status) status.textContent = '공지사항을 불러오지 못했습니다.';
    if (showToast) toast(error?.message || '공지사항을 불러오지 못했습니다.', 'error');
  }
}

async function publishNotice() {
  const status = document.getElementById('notice-status');
  const title = document.getElementById('notice-title')?.value.trim() || '';
  const version = document.getElementById('notice-version')?.value.trim() || '';
  const body = document.getElementById('notice-body')?.value.trim() || '';
  if (!body) {
    toast('공지 내용을 입력해 주세요.', 'error');
    return;
  }
  if (!confirm('이 공지사항을 모든 사용자에게 배포할까요?')) return;
  try {
    if (status) status.textContent = '배포 중...';
    await window.appNoticePublish({ title, version, body });
    if (status) status.textContent = '공지사항을 배포했습니다.';
    toast('공지사항을 배포했습니다.', 'success');
  } catch (error) {
    if (status) status.textContent = '배포 실패';
    toast(error?.message || '공지사항 배포에 실패했습니다.', 'error');
  }
}

async function saveGradesPassword() {
  const input = document.getElementById('grades-password-new');
  const status = document.getElementById('grades-password-admin-status');
  const password = input?.value.trim() || '';
  if (password.length < 4) {
    toast('성적관리 비밀번호는 4자 이상으로 입력해 주세요.', 'error');
    return;
  }
  if (!confirm('성적관리 비밀번호를 변경할까요?')) return;
  try {
    if (status) status.textContent = '변경 중...';
    await window.appGradesSetPassword(password);
    if (input) input.value = '';
    if (status) status.textContent = '비밀번호를 변경했습니다.';
    toast('성적관리 비밀번호를 변경했습니다.', 'success');
  } catch (error) {
    if (status) status.textContent = '변경 실패';
    toast(error?.message || '성적관리 비밀번호 변경에 실패했습니다.', 'error');
  }
}

async function loadUsers(showToast) {
  const list = document.getElementById('user-management-list');
  if (list) {
    list.innerHTML = '<div class="settings-note">사용자 목록을 불러오는 중...</div>';
  }

  userList = await window.appAuthListUsers();
  renderUserList();
  if (showToast) toast('사용자 목록을 새로고침했습니다.', 'success');
}

function renderUserList() {
  const root = document.getElementById('user-management-list');
  const summary = document.getElementById('user-management-summary');
  const state = window.appAuthGetState ? window.appAuthGetState() : null;
  if (!root || !summary) return;

  const normalizedKeyword = String(searchKeyword || '').trim().toLowerCase();
  const filtered = userList.filter((user) => {
    if (statusFilter === 'active' && (!user.active || user.deleted)) return false;
    if (statusFilter === 'blocked' && (user.active || user.deleted)) return false;
    if (statusFilter === 'deleted' && !user.deleted) return false;

    if (!normalizedKeyword) return true;
    const haystack = `${user.displayName || ''} ${user.email || ''}`.toLowerCase();
    return haystack.indexOf(normalizedKeyword) >= 0;
  });

  const activeCount = userList.filter((user) => user.active && !user.deleted).length;
  const blockedCount = userList.filter((user) => !user.active && !user.deleted).length;
  const deletedCount = userList.filter((user) => user.deleted).length;
  summary.textContent = `전체 ${userList.length}명 중 사용 중 ${activeCount}명, 사용 중지 ${blockedCount}명, 삭제 ${deletedCount}명`;

  const selectableUids = new Set(
    filtered.filter((user) => user.uid !== state?.uid && !user.deleted).map((user) => user.uid)
  );
  selectedUids.forEach((uid) => {
    if (!selectableUids.has(uid)) selectedUids.delete(uid);
  });

  if (!filtered.length) {
    root.innerHTML = '<div class="settings-note">조건에 맞는 사용자가 없습니다.</div>';
    updateBulkDeleteButton();
    return;
  }

  root.innerHTML = filtered.map((user) => {
    const canSelect = user.uid !== state?.uid && !user.deleted;
    return `
    <div class="menu-group-card" style="padding:14px 16px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px;display:flex;gap:10px;align-items:flex-start">
          ${canSelect ? `<input type="checkbox" class="user-select-checkbox" data-uid="${escapeHtml(user.uid)}" style="margin-top:3px" ${selectedUids.has(user.uid) ? 'checked' : ''}>` : '<span style="width:13px;display:inline-block"></span>'}
          <div>
          <div style="font-size:14px;font-weight:700;color:var(--text)">${escapeHtml(user.displayName || user.email)}</div>
          <div class="settings-note" style="margin-top:4px">${escapeHtml(user.email)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
            <span class="chip ${user.role === 'admin' ? 'primary' : ''}">${user.role === 'admin' ? '관리자' : '사용자'}</span>
            <span class="chip ${user.deleted ? 'danger' : (user.active ? 'success' : 'danger')}">${user.deleted ? '삭제됨' : (user.active ? '사용 중' : '사용 중지')}</span>
            ${user.gradeAccess ? '<span class="chip primary">성적관리 권한</span>' : ''}
          </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          ${user.uid === state?.uid ? '<span class="settings-note">내 계정</span>' : ''}
          ${!user.deleted && user.gradeAccess ? `<button class="btn btn-secondary btn-sm user-grade-off-btn" data-uid="${escapeHtml(user.uid)}">성적권한 해제</button>` : ''}
          ${!user.deleted && !user.gradeAccess ? `<button class="btn btn-primary btn-sm user-grade-on-btn" data-uid="${escapeHtml(user.uid)}">성적권한 부여</button>` : ''}
          ${!user.deleted ? `<button class="btn btn-secondary btn-sm user-reset-pw-btn" data-uid="${escapeHtml(user.uid)}" data-email="${escapeHtml(user.email)}" data-name="${escapeHtml(user.displayName || user.email)}">비밀번호 초기화</button>` : ''}
          ${user.uid !== state?.uid && !user.deleted && user.active ? `<button class="btn btn-secondary btn-sm user-disable-btn" data-uid="${escapeHtml(user.uid)}">사용 중지</button>` : ''}
          ${user.uid !== state?.uid && !user.deleted && !user.active ? `<button class="btn btn-primary btn-sm user-enable-btn" data-uid="${escapeHtml(user.uid)}">다시 허용</button>` : ''}
          ${user.uid !== state?.uid && !user.deleted ? `<button class="btn btn-danger btn-sm user-delete-btn" data-uid="${escapeHtml(user.uid)}" data-name="${escapeHtml(user.displayName || user.email)}">계정 삭제</button>` : ''}
        </div>
      </div>
    </div>
  `;
  }).join('');

  root.querySelectorAll('.user-select-checkbox').forEach((box) => {
    box.addEventListener('change', () => {
      if (box.checked) selectedUids.add(box.dataset.uid);
      else selectedUids.delete(box.dataset.uid);
      const allBox = document.getElementById('user-select-all');
      if (allBox) allBox.checked = selectableUids.size > 0 && [...selectableUids].every((uid) => selectedUids.has(uid));
      updateBulkDeleteButton();
    });
  });
  updateBulkDeleteButton();

  root.querySelectorAll('.user-reset-pw-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetName = button.dataset.name || button.dataset.email;
      if (!confirm(`${targetName}의 비밀번호를 000000으로 초기화할까요?\n\n초기화 후 사용자에게 새 비밀번호(000000)를 알려주세요.`)) return;
      try {
        button.disabled = true;
        await window.appAuthAdminResetPassword(button.dataset.uid);
        toast(`${targetName}의 비밀번호가 000000으로 초기화되었습니다.`, 'success');
      } catch (error) {
        toast(error?.message || '비밀번호 초기화에 실패했습니다.', 'error');
      } finally {
        button.disabled = false;
      }
    });
  });

  root.querySelectorAll('.user-disable-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.appAuthUpdateUser(button.dataset.uid, { active: false });
      toast('사용자를 중지했습니다.', 'success');
      await loadUsers(false);
    });
  });

  root.querySelectorAll('.user-grade-on-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.appAuthUpdateUser(button.dataset.uid, { gradeAccess: true });
      toast('성적관리 권한을 부여했습니다.', 'success');
      await loadUsers(false);
    });
  });

  root.querySelectorAll('.user-grade-off-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.appAuthUpdateUser(button.dataset.uid, { gradeAccess: false });
      toast('성적관리 권한을 해제했습니다.', 'success');
      await loadUsers(false);
    });
  });

  root.querySelectorAll('.user-enable-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.appAuthUpdateUser(button.dataset.uid, { active: true });
      toast('다시 사용할 수 있게 했습니다.', 'success');
      await loadUsers(false);
    });
  });

  root.querySelectorAll('.user-delete-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetName = button.dataset.name || '이 사용자';
      const confirmed = window.confirm(`${targetName} 계정을 삭제할까요?\n\n삭제하면 이 앱에서 다시 로그인할 수 없고, 시간표/할 일 같은 연동 데이터도 함께 정리됩니다.`);
      if (!confirmed) return;
      await window.appAuthDeleteUser(button.dataset.uid);
      toast('계정이 삭제되었습니다.', 'success');
      await loadUsers(false);
    });
  });
}

function updateBulkDeleteButton() {
  const button = document.getElementById('user-bulk-delete-btn');
  const countEl = document.getElementById('user-bulk-delete-count');
  if (countEl) countEl.textContent = String(selectedUids.size);
  if (button) button.disabled = selectedUids.size === 0;
}

async function bulkDeleteSelected() {
  const uids = [...selectedUids];
  if (!uids.length) return;
  const targets = userList.filter((user) => uids.includes(user.uid));
  const names = targets.map((user) => user.displayName || user.email).join(', ');
  const confirmed = window.confirm(`선택한 ${uids.length}개 계정을 삭제할까요?\n\n${names}\n\n삭제하면 이 앱에서 다시 로그인할 수 없고, 시간표/할 일 같은 연동 데이터도 함께 정리됩니다.`);
  if (!confirmed) return;

  const button = document.getElementById('user-bulk-delete-btn');
  if (button) button.disabled = true;

  let successCount = 0;
  for (const uid of uids) {
    try {
      await window.appAuthDeleteUser(uid);
      successCount += 1;
    } catch (error) {
      toast(error?.message || '일부 계정 삭제에 실패했습니다.', 'error');
    }
  }

  selectedUids.clear();
  toast(`${successCount}개 계정을 삭제했습니다.`, 'success');
  await loadUsers(false);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.registerPage('user_management', { render, init });
})();
