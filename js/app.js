/* ============================================
   app.js — メインアプリケーション制御
   SPA画面遷移・初期化・ホーム画面ロジック
   ============================================ */

// ===== 画面遷移 =====
function navigateTo(screenId) {
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
            Step1.init();
            break;
        case 'screen-step2':
            Step2.init();
            break;
        case 'screen-step3':
            Step3.init();
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
    }
}

// ===== ロール選択 =====
function selectRole(role) {
    Auth.selectRole(role);

    // ログイン画面のバッジ更新
    const badge = document.getElementById('login-role-badge');
    const labels = { staff: '新人研修利用者', admin: '管理者', exec: '運営本部' };
    badge.textContent = labels[role] || role;

    navigateTo('screen-login');
}

// ===== ログイン =====
function handleLogin(event) {
    event.preventDefault();

    const staffId = document.getElementById('login-id').value.trim();
    const password = document.getElementById('login-password').value;

    const result = Auth.login(staffId, password);

    if (result.success) {
        const errorEl = document.getElementById('login-error');
        errorEl.hidden = true;

        // ロール別にリダイレクト
        switch (result.user.role) {
            case 'staff':
                navigateTo('screen-home');
                break;
            case 'admin':
                navigateTo('screen-admin');
                break;
            case 'exec':
                navigateTo('screen-exec');
                break;
        }
    } else {
        const errorEl = document.getElementById('login-error');
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

    // 対象者
    const targets = DB.getAll('assignments', { staff_id: user.staff_id, is_active: true });
    const mainTarget = targets.find(t => t.type === 'main');
    const subTarget = targets.find(t => t.type === 'sub');
    document.getElementById('home-target-name').textContent = mainTarget ? mainTarget.name + 'さん' : '未設定';
    document.getElementById('home-target-sub').textContent = subTarget ? subTarget.name + 'さん' : '未設定';

    // 期限アラート
    updateDeadlineAlert();

    // 進捗
    updateProgress(user, currentStep);

    // STEPボタンの状態更新
    updateStepButtons(currentStep);
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
function updateProgress(user, currentStep) {
    const cycle = DB.getCurrentCycle();
    let table = 'daily_step1';
    if (currentStep === 2) table = 'step2_hypotheses';
    if (currentStep === 3) table = 'daily_step3';

    const records = DB.getByMonth(table, user.staff_id, cycle.yearMonth);
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

    if (stepNum > currentStep) {
        showToast('前のSTEPをクリアしてください 🔒');
        return;
    }

    const screens = { 1: 'screen-step1', 2: 'screen-step2', 3: 'screen-step3' };
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
