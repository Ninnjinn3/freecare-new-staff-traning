/* ============================================
   app.js — メインアプリケーション制御
   SPA画面遷移・初期化・ホーム画面ロジック
   ============================================ */

// ===== 画面遷移 =====
async function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);
    }

    // 画面ごとの初期化
    switch (screenId) {
        case 'screen-home':
            initHome();
            break;
        case 'screen-step1':
            await Step1.init();
            await initStepAutocomplete('step1');
            break;
        case 'screen-step2':
            await Step2.init();
            await initStepAutocomplete('step2');
            break;
        case 'screen-step3':
            await Step3.init();
            await initStepAutocomplete('step3');
            break;
        case 'screen-monthly':
            Monthly.render();
            break;
        case 'screen-history':
            loadHistory();
            break;
        case 'screen-video':
            loadVideoTasks();
            break;
        case 'screen-admin':
            await initAdmin();
            break;
        case 'screen-exec':
            await Exec.load();
            break;
        case 'screen-settings':
            initSettings();
            break;
        case 'screen-assessment-list':
            renderAssessmentList();
            break;
        case 'screen-step4':
            Step4.init();
            await initStepAutocomplete('step4');
            break;
    }
}

// ===== ロール選択 =====
function selectRole(role) {
    Auth.selectRole(role);

    // ログイン画面のバッジ更新
    const badge = document.getElementById('login-role-badge');
    const labels = { staff: '新人研修利用者', admin: '管理者', exec: '運営本部' };
    badge.textContent = labels[role] || role;

    // デモ用ログイン情報をロールに合わせて表示
    const demoIds = { staff: 'FC001', admin: 'FC002', exec: 'FC003' };
    const hint = document.getElementById('demo-hint');
    if (hint) hint.innerHTML = `デモ用: ID <code>${demoIds[role]}</code> / PW <code>demo1234</code>`;

    navigateTo('screen-login');
}

// ===== ログイン =====
async function handleLogin(event) {
    event.preventDefault();

    const staffId = document.getElementById('login-id').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    // ログインボタン無効化
    const btn = event.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'ログイン中...'; }

    // Supabase認証を試みる
    let result;
    try {
        result = await API.login(staffId, password);
    } catch (e) {
        // Supabase接続失敗時はローカル認証にフォールバック
        console.warn('Supabase接続失敗、ローカル認証を使用:', e);
        result = Auth.login(staffId, password);
    }

    if (btn) { btn.disabled = false; btn.textContent = 'ログイン'; }

    if (result.success) {
        errorEl.hidden = true;

        // ロール別にリダイレクト
        switch (result.user.role) {
            case 'staff': navigateTo('screen-home'); break;
            case 'admin': navigateTo('screen-admin'); break;
            case 'exec': navigateTo('screen-exec'); break;
        }
    } else {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
    }
}

// ===== ログアウト =====
function handleLogout() {
    Auth.logout();
    document.getElementById('login-form').reset();
    navigateTo('screen-role-select');
}

// ===== 選択中の対象者 =====
let selectedTarget = null;

function getSelectedTarget() {
    return selectedTarget;
}

// ===== ホーム画面初期化 =====
function initHome() {
    const user = Auth.getUser();
    if (!user) {
        navigateTo('screen-role-select');
        return;
    }

    // ユーザー名
    document.getElementById('home-user-name').textContent = user.name + 'さん';

    // 現在STEP
    const currentStep = user.current_step || 1;
    document.getElementById('home-step-badge').textContent = `STEP${currentStep}`;

    // 対象者ドロップダウン初期化
    initTargetDropdown();

    // 期限アラート
    updateDeadlineAlert();

    // 進捗
    updateProgress(user, currentStep);

    // STEPボタンの状態更新
    updateStepButtons(currentStep);
}

// ===== 対象者ドロップダウン =====
async function initTargetDropdown() {
    const select = document.getElementById('home-target-select');
    if (!select) return;

    try {
        const targets = await getTargetList(true); // Supabaseから最新を取得
        // オプションを再描画
        select.innerHTML = '<option value="">── 介護対象者を選択してください ──</option>';
        targets.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id || t.db_id;
            opt.textContent = t.name + (t.care_level ? `（${t.care_level}）` : '');
            opt.dataset.name = t.name;
            opt.dataset.level = t.care_level || '';
            select.appendChild(opt);
        });

        // 既に選択済みなら復元
        if (selectedTarget) {
            select.value = selectedTarget.id || selectedTarget.db_id || '';
        }

        if (targets.length === 0) {
            select.innerHTML = '<option value="">※ まずは対象者を新規追加してください</option>';
        }
    } catch (e) {
        console.error('対象者ドロップダウン読み込みエラー:', e);
    }
}

function onTargetSelectChange(selectEl) {
    const selectedId = selectEl.value;
    if (!selectedId) {
        selectedTarget = null;
        return;
    }
    const opt = selectEl.options[selectEl.selectedIndex];
    selectedTarget = {
        id: selectedId,
        db_id: selectedId,
        name: opt.dataset.name || opt.textContent,
        care_level: opt.dataset.level || ''
    };
    showToast(`${selectedTarget.name}さんを選択しました ✅`);
}

function clearSelectedTarget() {
    selectedTarget = null;
    const sel = document.getElementById('home-target-select');
    if (sel) sel.value = '';
    showToast('対象者の選択を解除しました');
}

// ===== STEP画面用 対象者オートコンプリート =====
const stepSelectedTargets = {}; // { step1: null, step2: null, step3: null }

async function initStepAutocomplete(stepName) {
    const input = document.getElementById(`${stepName}-target-input`);
    const dropdown = document.getElementById(`${stepName}-target-dropdown`);
    const selectedContainer = document.getElementById(`${stepName}-selected-target`);
    if (!input || !dropdown) return;

    const targets = await getTargetList(true); // 最新を取得

    // 既に選択済みなら表示（ホーム画面で選んだものを引走）
    if (selectedTarget) {
        stepSelectedTargets[stepName] = selectedTarget;
        renderSelectedTarget(selectedContainer, selectedTarget);
        input.value = '';
    }

    input.addEventListener('input', function () {
        const query = this.value.trim();
        if (!query) { dropdown.classList.remove('active'); return; }
        const matches = targets.filter(t =>
            t.name.includes(query) || t.name.replace(/\s/g, '').includes(query.replace(/\s/g, ''))
        );
        dropdown.innerHTML = matches.length === 0
            ? '<div class="autocomplete-option" style="color: var(--text-muted)">該当なし</div>'
            : matches.map(t => `<div class="autocomplete-option" data-id="${t.id}" data-name="${t.name}">
                ${t.name} <span style="color: var(--text-muted); font-size: 0.85em; margin-left: 8px">${t.care_level || ''}</span>
              </div>`).join('');
        dropdown.classList.add('active');
    });

    dropdown.addEventListener('click', function (e) {
        const option = e.target.closest('.autocomplete-option');
        if (!option || !option.dataset.id) return;
        const picked = targets.find(t => t.id === option.dataset.id);
        stepSelectedTargets[stepName] = picked;
        input.value = '';
        dropdown.classList.remove('active');
        renderSelectedTarget(selectedContainer, picked);
        showToast(`${picked.name}さんを選択しました ✅`);
    });

    input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('active'), 200));
    input.addEventListener('focus', function () {
        if (!this.value.trim()) {
            dropdown.innerHTML = targets.map(t =>
                `<div class="autocomplete-option" data-id="${t.id}" data-name="${t.name}">
                    ${t.name} <span style="color: var(--text-muted); font-size: 0.85em; margin-left: 8px">${t.care_level || ''}</span>
                </div>`
            ).join('');
            dropdown.classList.add('active');
        }
    });
}

function getStepSelectedTarget(stepName) {
    return stepSelectedTargets[stepName] || selectedTarget || null;
}

// ===== 対象者リスト取得（Supabase連携） =====
let cachedTargets = null;

async function getTargetList(forceFetch = false) {
    if (cachedTargets && !forceFetch) return cachedTargets;

    const user = Auth.getUser();
    if (!user) return [...DEMO_TARGETS];

    try {
        const data = await API.getTargets(user.facility_id);
        // DBから取得したデータをアプリケーション用の形式（IDをTxxxにする等）に変換
        cachedTargets = data.map(t => ({
            id: t.target_code || t.id,
            db_id: t.id, // UUIDを保持
            name: t.name,
            care_level: t.care_level || '介護度未設定',
            step: 1 // デフォルト
        }));

        // デモデータがあればマージ（必要に応じて）
        if (cachedTargets.length === 0) cachedTargets = [...DEMO_TARGETS];

        return cachedTargets;
    } catch (e) {
        console.warn('Targets fetch failed:', e);
        return [...DEMO_TARGETS];
    }
}

async function saveTargetList(targets) {
    // この関数は個別追加・削除に置き換わるため、基本的にはローカルキャッシュのみ更新
    cachedTargets = targets;
}

// ===== 期限アラート更新 =====
function updateDeadlineAlert() {
    const cycle = DB.getCurrentCycle();
    const deadlineEl = document.getElementById('home-deadline');
    const alertCard = document.getElementById('deadline-alert');

    if (cycle.phase === 'input') {
        deadlineEl.textContent = `${cycle.deadlineStr} あと${cycle.daysLeft}日`;
        alertCard.classList.toggle('alert-urgent', cycle.daysLeft <= 3);
    } else if (cycle.phase === 'evaluation') {
        deadlineEl.textContent = '評価期間中';
        alertCard.classList.remove('alert-urgent');
    } else {
        deadlineEl.textContent = 'フィードバック期間';
        alertCard.classList.remove('alert-urgent');
    }
}

// ===== 進捗バー更新 =====
async function updateProgress(user, currentStep) {
    const cycle = DB.getCurrentCycle();
    let records = [];
    try {
        if (currentStep === 1) records = await API.getStep1Records(user.staff_id, cycle.yearMonth);
        else if (currentStep === 2) records = await API.getStep2Records(user.staff_id, cycle.yearMonth);
        else if (currentStep === 3) records = await API.getStep3Records(user.staff_id, cycle.yearMonth);
    } catch (e) {
        // Supabase接続失敗時はローカルデータを使用
        records = DB.getByMonth(currentStep === 1 ? 'daily_step1' : currentStep === 2 ? 'step2_hypotheses' : 'daily_step3', user.staff_id, cycle.yearMonth);
    }
    const workType = user.work_type || 'day';
    const minDays = MIN_DAYS[workType] || 6;
    const writtenDays = records.length;
    const circleDays = records.filter(r => r.ai_judgement === '○').length;
    const pct = Math.min(100, Math.round((writtenDays / minDays) * 100));

    document.getElementById('home-progress-text').textContent = `${writtenDays}/${minDays}日`;
    document.getElementById('home-progress-fill').style.width = pct + '%';
    document.getElementById('home-written-days').textContent = writtenDays;
    document.getElementById('home-circle-days').textContent = circleDays;
}

// ===== STEPボタン状態 =====
function updateStepButtons(currentStep) {
    for (let i = 1; i <= 4; i++) {
        const btn = document.getElementById(`step-btn-${i}`);
        if (!btn) continue;

        // クラスリセット
        btn.className = 'step-btn';

        if (i < currentStep) {
            btn.classList.add('step-btn-completed');
        } else if (i === currentStep) {
            btn.classList.add('step-btn-active');
        } else {
            btn.classList.add('step-btn-locked');
        }

        // ロックアイコン/ステータス更新
        const lockEl = btn.querySelector('.step-lock');
        const statusEl = btn.querySelector('.step-status');

        if (i < currentStep) {
            if (lockEl) lockEl.style.display = 'none';
            if (statusEl) statusEl.textContent = '合格';
        } else if (i === currentStep) {
            if (lockEl) lockEl.style.display = 'none';
            if (statusEl) statusEl.textContent = '進行中';
        } else {
            if (lockEl) lockEl.style.display = '';
        }
    }
}

// ===== STEP遷移（ロックチェック付き） =====
function navigateStep(stepNum) {
    const user = Auth.getUser();
    if (!user) return;

    const currentStep = user.current_step || 1;

    // ⚠️ 一時的にロック解除中（確認後に戻す）
    // if (stepNum > currentStep) {
    //     showToast('前のSTEPをクリアしてください 🔒');
    //     return;
    // }

    const screens = { 1: 'screen-step1', 2: 'screen-step2', 3: 'screen-step3', 4: 'screen-step4' };
    if (screens[stepNum]) {
        navigateTo(screens[stepNum]);
    }
}

// ===== 記録履歴 =====
function loadHistory() {
    const user = Auth.getUser();
    if (!user) return;

    const filter = document.getElementById('history-step-filter').value;
    const listEl = document.getElementById('history-list');

    let records = [];

    if (filter === 'all' || filter === 'step1') {
        const step1 = DB.getAll('daily_step1', { staff_id: user.staff_id });
        records = records.concat(step1.map(r => ({
            ...r,
            stepLabel: 'STEP1',
            text: r.notice_text
        })));
    }

    if (filter === 'all' || filter === 'step2') {
        const step2 = DB.getAll('step2_hypotheses', { staff_id: user.staff_id });
        records = records.concat(step2.map(r => ({
            ...r,
            stepLabel: 'STEP2',
            text: r.change_noticed
        })));
    }

    if (filter === 'all' || filter === 'step3') {
        const step3 = DB.getAll('daily_step3', { staff_id: user.staff_id });
        records = records.concat(step3.map(r => {
            const data = JSON.parse(r.reflection_json || '{}');
            return {
                ...r,
                stepLabel: 'STEP3',
                text: data.notice || ''
            };
        }));
    }

    // 日付降順
    records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (records.length === 0) {
        listEl.innerHTML = '<p class="empty-state">記録がありません</p>';
        return;
    }

    listEl.innerHTML = records.map(r => `
    <div class="history-item">
      <div class="history-item-header">
        <span class="history-date">${r.date || '--'} [${r.stepLabel}]</span>
        <span class="history-judgement ${r.ai_judgement === '○' ? 'is-circle' : 'is-cross'}">${r.ai_judgement || '-'}</span>
      </div>
      <div class="history-target">${r.target_name || ''}</div>
      <div class="history-text">${r.text || ''}</div>
    </div>
  `).join('');
}

// ===== 動画課題 =====
function loadVideoTasks() {
    const user = Auth.getUser();
    if (!user) return;

    const listEl = document.getElementById('video-tasks-list');
    const tasks = DB.getAll('video_tasks', { staff_id: user.staff_id });

    // STEPごとにグループ化
    const grouped = {};
    tasks.forEach(t => {
        const step = t.step || 1;
        if (!grouped[step]) grouped[step] = [];
        grouped[step].push(t);
    });

    listEl.innerHTML = Object.entries(grouped).map(([step, videos]) => {
        const allPassed = videos.every(v => v.is_passed);
        return `
      <div class="video-task-card">
        <div class="video-task-header">
          <span class="video-task-step">STEP${step} 動画課題</span>
          <span class="video-task-status ${allPassed ? 'is-complete' : 'is-incomplete'}">
            ${allPassed ? '✅ 合格' : '⏳ 未完了'}
          </span>
        </div>
        <div class="video-checklist">
          ${videos.map(v => `
            <div class="video-check-item ${v.is_passed ? 'is-done' : ''}">
              ${v.is_passed ? '✅' : '⬜'} ${v.title}
              ${v.test_score !== null ? `（テスト: ${v.test_score}点）` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
    }).join('');
}

// ===== 管理者画面 =====
async function initAdmin() {
    await Admin.load();
    await renderAdminTargetList();
}

function showAdminTab(tab) {
    // タブ切替
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`admin-tab-${tab}`).classList.add('active');

    // セクション切替
    document.getElementById('admin-targets-section').hidden = (tab !== 'targets');
    document.getElementById('admin-staff-section').hidden = (tab !== 'staff');
    document.getElementById('admin-progress-section').hidden = (tab !== 'progress');
    document.getElementById('admin-alerts-section').hidden = (tab !== 'alerts');

    if (tab === 'staff') {
        Admin.loadStaffList();
    }
}

async function renderAdminTargetList() {
    const list = document.getElementById('admin-target-list');
    if (!list) return;

    const targets = await getTargetList();

    if (targets.length === 0) {
        list.innerHTML = '<p class="empty-state">対象者が登録されていません</p>';
        return;
    }

    list.innerHTML = targets.map(t => `
        <div class="target-list-item">
            <div>
                <div class="target-list-name">👤 ${t.name}</div>
                <div class="target-list-meta">${t.care_level || '介護度未設定'} ・ ID: ${t.id}</div>
            </div>
            <div class="target-list-actions">
                <button class="btn-delete" onclick="deleteTarget('${t.db_id || t.id}')">削除</button>
            </div>
        </div>
    `).join('');
}

async function addNewTarget() {
    const nameInput = document.getElementById('admin-new-target-name');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('名前を入力してください');
        return;
    }

    const targets = await getTargetList();

    // 重複チェック
    if (targets.some(t => t.name === name)) {
        showToast('同じ名前の対象者がすでに存在します');
        return;
    }

    // 新規ID生成 (Txxx)
    const maxId = targets.reduce((max, t) => {
        if (!t.id || !t.id.startsWith('T')) return max;
        const num = parseInt(t.id.replace('T', ''));
        return num > max ? num : max;
    }, 0);
    const newTargetCode = `T${String(maxId + 1).padStart(3, '0')}`;

    const user = Auth.getUser();
    const newTarget = {
        target_code: newTargetCode,
        name: name,
        care_level: '介護度未設定',
        facility_id: user?.facility_id || 'F001'
    };

    try {
        const added = await API.addTarget(newTarget);
        if (added) {
            // キャッシュを更新（先頭に追加して即時反映感を出す）
            const formatted = {
                id: added.target_code,
                db_id: added.id,
                name: added.name,
                care_level: added.care_level,
                step: 1
            };
            targets.unshift(formatted);
            saveTargetList(targets);

            nameInput.value = '';
            renderAdminTargetList();
            showToast(`${name}さんを追加しました ✅`);
        }
    } catch (e) {
        showToast('追加に失敗しました');
        console.error(e);
    }
}

async function deleteTarget(id) {
    const targets = await getTargetList();
    const target = targets.find(t => t.db_id === id || t.id === id);
    if (!target) return;

    if (!confirm(`${target.name}さんを削除してよろしいですか？`)) return;

    try {
        const success = await API.deleteTarget(target.db_id || id);
        if (success) {
            const updated = targets.filter(t => t.db_id !== id && t.id !== id);
            saveTargetList(updated);
            renderAdminTargetList();
            showToast(`${target.name}さんを削除しました`);
        }
    } catch (e) {
        showToast('削除に失敗しました');
    }
}

// ===== トースト通知 =====
function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== アプリ初期化 =====
document.addEventListener('DOMContentLoaded', () => {
    // デモデータ投入
    DB.initDemoData();

    // セッション復元
    if (Auth.restore()) {
        const user = Auth.getUser();
        switch (user.role) {
            case 'staff': navigateTo('screen-home'); break;
            case 'admin': navigateTo('screen-admin'); break;
            case 'exec': navigateTo('screen-exec'); break;
        }
    }
});

// ===== 設定画面 =====
function showDeleteConfirm() {
    document.getElementById('delete-confirm-banner').classList.add('show');
}
function hideDeleteConfirm() {
    document.getElementById('delete-confirm-banner').classList.remove('show');
}

async function executeDeleteAccount() {
    const user = Auth.getUser();
    if (!user) return;

    try {
        const resp = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete',
                staff_id: user.staff_id,
                deleted_by: user.staff_id
            })
        });
        const data = await resp.json();
        if (resp.ok && data.success) {
            showToast('アカウントが削除されました。お疲れ様でした。');
            setTimeout(() => {
                handleLogout();
            }, 2000);
        } else {
            showToast(data.error || '削除に失敗しました');
        }
    } catch (e) {
        showToast('削除に失敗しました: ' + e.message);
    }
}

// 設定画面にユーザー情報をセット
function initSettings() {
    const user = Auth.getUser();
    if (!user) return;
    const nameEl = document.getElementById('settings-user-name');
    const idEl = document.getElementById('settings-user-id');
    if (nameEl) nameEl.textContent = user.name || '--';
    if (idEl) idEl.textContent = `ID: ${user.staff_id || '--'}`;
}

// ===== ヘルプ画面 =====
function toggleHelp(header) {
    const body = header.nextElementSibling;
    const toggle = header.querySelector('.help-toggle');
    body.hidden = !body.hidden;
    toggle.textContent = body.hidden ? '▼' : '▲';
}

// ===== AIチャットボット =====
const chatHistory = [];

async function sendHelpChat() {
    const input = document.getElementById('help-chat-input');
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';
    const container = document.getElementById('help-chat-messages');

    // ユーザーメッセージ表示
    container.innerHTML += `
        <div class="chat-msg chat-user">
            <div class="chat-bubble">${escapeHtml(msg)}</div>
            <span class="chat-avatar">👤</span>
        </div>`;

    // ローディング
    const loadId = 'chat-loading-' + Date.now();
    container.innerHTML += `
        <div class="chat-msg chat-bot" id="${loadId}">
            <span class="chat-avatar">🤖</span>
            <div class="chat-bubble">考え中...</div>
        </div>`;
    container.scrollTop = container.scrollHeight;

    const historyToSend = chatHistory.slice(-10);
    chatHistory.push({ role: 'user', text: msg });

    try {
        const resp = await fetch('/api/help-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, history: historyToSend })
        });
        const data = await resp.json();
        const reply = data.reply || 'エラーが発生しました';

        chatHistory.push({ role: 'model', text: reply });

        const loadEl = document.getElementById(loadId);
        if (loadEl) {
            loadEl.querySelector('.chat-bubble').innerHTML = formatChatReply(reply);
        }
    } catch (e) {
        const loadEl = document.getElementById(loadId);
        if (loadEl) {
            loadEl.querySelector('.chat-bubble').textContent = '通信エラーが発生しました。もう一度お試しください。';
        }
    }
    container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatChatReply(text) {
    return text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/- (.*?)(?=<br>|$)/g, '• $1');
}

// ===== 介護対象者 2モード切替 =====
function switchTargetMode(mode) {
    const selectMode = document.getElementById('target-select-mode');
    const addMode = document.getElementById('target-add-mode');
    const selectBtn = document.getElementById('mode-select-btn');
    const addBtn = document.getElementById('mode-add-btn');
    if (!selectMode || !addMode) return;

    if (mode === 'select') {
        selectMode.hidden = false;
        addMode.hidden = true;
        selectBtn.classList.add('active');
        addBtn.classList.remove('active');
    } else {
        selectMode.hidden = true;
        addMode.hidden = false;
        addBtn.classList.add('active');
        selectBtn.classList.remove('active');
    }
}

// ===== アセスメント・フェイスシート 新規保存 =====
async function saveAssessment(event) {
    event.preventDefault();
    const name = document.getElementById('assess-name')?.value?.trim();
    if (!name) { showToast('氏名は必須です'); return; }
    const g = id => document.getElementById(id)?.value?.trim() || '';

    const assessData = {
        name,
        age: g('assess-age'),
        gender: g('assess-gender'),
        disease: g('assess-disease'),
        disease_history: g('assess-disease-history'),
        infection: g('assess-infection'),
        medication: g('assess-medication'),
        medication_mgmt: g('assess-medication-mgmt'),
        family: g('assess-family'),
        family_relation: g('assess-family-relation'),
        service_reason: g('assess-service-reason'),
        schedule: g('assess-schedule'),
        services: g('assess-services'),
        allergy: g('assess-allergy'),
        fixation: g('assess-fixation'),
        weakness: g('assess-weakness'),
        caution: g('assess-caution'),
        personality: g('assess-personality'),
        money: g('assess-money'),
        trusted: g('assess-trusted'),
        safe_place: g('assess-safe-place'),
        emergency: g('assess-emergency'),
        hobby: g('assess-hobby'),
        preference: g('assess-preference'),
        // アセスメント
        assess_date: g('assess-date'),
        adl: g('assess-adl'),
        visit_method: g('assess-visit-method'),
        goal: g('assess-goal'),
        behavior: g('assess-behavior'),
        social: g('assess-social'),
        motivation: g('assess-motivation'),
        warning_sign: g('assess-warning-sign'),
    };

    try {
        await API.addTarget(assessData);
        cachedTargets = null;
        showToast(`${name} さんを登録しました ✅`);
        document.getElementById('assessment-new-form')?.reset();
        navigateTo('screen-home');
        switchTargetMode('select');
    } catch (e) {
        showToast('保存エラー: ' + (e?.message || JSON.stringify(e)));
    }
}

// ===== 対象者一覧を描画 =====
async function renderAssessmentList() {
    const container = document.getElementById('assessment-list-container');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">読み込み中...</p>';

    try {
        const user = Auth.getUser();
        const facilityId = user?.facility_id || 'F001';
        const targets = await API.getTargets(facilityId);

        if (!targets || targets.length === 0) {
            container.innerHTML = '<p class="empty-state">登録済みの対象者がいません<br><small>ホーム画面の「＋ 新規追加」から登録できます</small></p>';
            return;
        }

        container.innerHTML = targets.map(t => {
            const id = t.id || t.db_id;
            return `
            <div style="margin-bottom:var(--space-md); border-radius:var(--radius); border:1px solid var(--border); overflow:hidden;">
                <!-- ヘッダー -->
                <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; background:var(--surface); cursor:pointer;"
                     onclick="toggleAssessDetail('detail-${id}', this)">
                    <div>
                        <div style="font-weight:700; font-size:1.05rem;">👤 ${escapeHtml(t.name || '')}</div>
                        <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:2px;">
                            ${escapeHtml(t.care_level || '介護度未設定')}
                            ${t.age ? '・' + t.age + '歳' : ''}
                            ${t.gender ? '・' + t.gender : ''}
                            ${t.disease ? '・' + escapeHtml(t.disease) : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="btn-edit-sm" onclick="event.stopPropagation(); openEditAssessment('${id}')">✏️ 編集</button>
                        <span style="color:var(--text-secondary); font-size:1.1rem; transition:transform 0.2s;" class="detail-toggle-icon">▼</span>
                    </div>
                </div>
                <!-- 詳細（折りたたみ） -->
                <div id="detail-${id}" hidden style="background:var(--bg); border-top:1px solid var(--border); padding:12px 16px;">
                    ${renderAssessDetail(t)}
                </div>
            </div>`;
        }).join('');
    } catch (e) {
        container.innerHTML = '<p class="empty-state">読み込みエラー: ' + escapeHtml(e?.message || '') + '</p>';
        console.error(e);
    }
}

function toggleAssessDetail(detailId, header) {
    const el = document.getElementById(detailId);
    if (!el) return;
    const icon = header.querySelector('.detail-toggle-icon');
    if (el.hidden) {
        el.hidden = false;
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        el.hidden = true;
        if (icon) icon.style.transform = '';
    }
}

function renderAssessDetail(t) {
    const row = (label, val) => val
        ? `<div style="display:flex; gap:8px; margin-bottom:6px; font-size:0.88rem;">
              <span style="min-width:160px; color:var(--text-secondary); flex-shrink:0;">${label}</span>
              <span style="color:var(--text); white-space:pre-wrap;">${escapeHtml(val)}</span>
           </div>`
        : '';

    let html = '';
    html += `<div style="font-weight:700; margin-bottom:8px; color:var(--primary);">📋 フェイスシート</div>`;
    html += row('病名', t.disease);
    html += row('病歴・経歴', t.disease_history);
    html += row('感染症', t.infection);
    html += row('服薬', t.medication);
    html += row('服薬管理方法', t.medication_mgmt);
    html += row('家族構成', t.family);
    html += row('家族との関係性', t.family_relation);
    html += row('サービス利用開始の理由', t.service_reason);
    html += row('生活スケジュール', t.schedule);
    html += row('利用中のサービス・支援者', t.services);
    html += row('アレルギー', t.allergy);
    html += row('こだわり', t.fixation);
    html += row('苦手', t.weakness);
    html += row('注意点（禁句ワード）', t.caution);
    html += row('性格', t.personality);
    html += row('金銭管理', t.money);
    html += row('信頼している人', t.trusted);
    html += row('安心できる場所', t.safe_place);
    html += row('急変時対応意向', t.emergency);
    html += row('趣味・熱中できるもの', t.hobby);
    html += row('嗜好品', t.preference);

    if (t.adl || t.goal || t.behavior) {
        html += `<div style="font-weight:700; margin:12px 0 8px; color:var(--secondary);">📊 アセスメント ${t.assess_date ? '（' + t.assess_date + '時点）' : ''}</div>`;
        html += row('ADL・IADL', t.adl);
        html += row('受診方法', t.visit_method);
        html += row('目標', t.goal);
        html += row('行動パターン', t.behavior);
        html += row('他者との関わり', t.social);
        html += row('社会参加意欲', t.motivation);
        html += row('注意サイン', t.warning_sign);
    }

    if (!html.includes('<span style="color:var(--text)')) {
        html += '<p style="color:var(--text-secondary); font-size:0.85rem;">詳細情報未登録（編集から追加できます）</p>';
    }
    return html;
}

// ===== 編集画面を開く =====
async function openEditAssessment(id) {
    const targets = await API.getTargets();
    const t = targets.find(x => (x.id || x.db_id) == id);
    if (!t) { showToast('対象者が見つかりません'); return; }
    const s = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };

    s('edit-assess-id', id);
    s('edit-assess-name', t.name);
    s('edit-assess-age', t.age);
    s('edit-assess-gender', t.gender);
    s('edit-assess-disease', t.disease);
    s('edit-assess-disease-history', t.disease_history);
    s('edit-assess-infection', t.infection);
    s('edit-assess-medication', t.medication);
    s('edit-assess-medication-mgmt', t.medication_mgmt);
    s('edit-assess-family', t.family);
    s('edit-assess-family-relation', t.family_relation);
    s('edit-assess-service-reason', t.service_reason);
    s('edit-assess-schedule', t.schedule);
    s('edit-assess-services', t.services);
    s('edit-assess-allergy', t.allergy);
    s('edit-assess-fixation', t.fixation);
    s('edit-assess-weakness', t.weakness);
    s('edit-assess-caution', t.caution);
    s('edit-assess-personality', t.personality);
    s('edit-assess-money', t.money);
    s('edit-assess-trusted', t.trusted);
    s('edit-assess-safe-place', t.safe_place);
    s('edit-assess-emergency', t.emergency);
    s('edit-assess-hobby', t.hobby);
    s('edit-assess-preference', t.preference);
    s('edit-assess-date', t.assess_date);
    s('edit-assess-adl', t.adl);
    s('edit-assess-visit-method', t.visit_method);
    s('edit-assess-goal', t.goal);
    s('edit-assess-behavior', t.behavior);
    s('edit-assess-social', t.social);
    s('edit-assess-motivation', t.motivation);
    s('edit-assess-warning-sign', t.warning_sign);

    navigateTo('screen-assessment-edit');
}

// ===== 対象者情報を更新 =====
async function updateAssessment(event) {
    event.preventDefault();
    const id = document.getElementById('edit-assess-id')?.value;
    const name = document.getElementById('edit-assess-name')?.value?.trim();
    if (!name) { showToast('氏名は必須です'); return; }
    const g = id => document.getElementById(id)?.value?.trim() || '';

    const updatedData = {
        name,
        age: g('edit-assess-age'),
        gender: g('edit-assess-gender'),
        disease: g('edit-assess-disease'),
        disease_history: g('edit-assess-disease-history'),
        infection: g('edit-assess-infection'),
        medication: g('edit-assess-medication'),
        medication_mgmt: g('edit-assess-medication-mgmt'),
        family: g('edit-assess-family'),
        family_relation: g('edit-assess-family-relation'),
        service_reason: g('edit-assess-service-reason'),
        schedule: g('edit-assess-schedule'),
        services: g('edit-assess-services'),
        allergy: g('edit-assess-allergy'),
        fixation: g('edit-assess-fixation'),
        weakness: g('edit-assess-weakness'),
        caution: g('edit-assess-caution'),
        personality: g('edit-assess-personality'),
        money: g('edit-assess-money'),
        trusted: g('edit-assess-trusted'),
        safe_place: g('edit-assess-safe-place'),
        emergency: g('edit-assess-emergency'),
        hobby: g('edit-assess-hobby'),
        preference: g('edit-assess-preference'),
        assess_date: g('edit-assess-date'),
        adl: g('edit-assess-adl'),
        visit_method: g('edit-assess-visit-method'),
        goal: g('edit-assess-goal'),
        behavior: g('edit-assess-behavior'),
        social: g('edit-assess-social'),
        motivation: g('edit-assess-motivation'),
        warning_sign: g('edit-assess-warning-sign'),
    };

    try {
        const { error } = await window.supabase.from('care_targets').update(updatedData).eq('id', id);
        if (error) throw error;
        cachedTargets = null;
        showToast(`${name} さんの情報を更新しました ✅`);
        navigateTo('screen-assessment-list');
    } catch (e) {
        showToast('更新エラー: ' + (e?.message || JSON.stringify(e)));
    }
}

