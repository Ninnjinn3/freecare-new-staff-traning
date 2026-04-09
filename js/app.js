/* ============================================
   app.js — メインアプリケーション制御
   SPA画面遷移・初期化・ホーム画面ロジック
   ============================================ */

// ===== 通知ヘルパー =====
const NotificationHelper = {
    send: function(title, body, icon = 'https://freecare.co.jp/wp-content/themes/freecare/images/logo.png') {
        const isEnabled = localStorage.getItem('fc_notifications_enabled') === 'true';
        if (!isEnabled || !("Notification" in window)) return;

        if (Notification.permission === "granted") {
            try {
                new Notification(title, { body, icon });
            } catch (e) {
                // iOS PWA support or other issues
                console.warn("Notification error:", e);
                showToast(`🔔 ${body}`);
            }
        }
    }
};

// ===== 画面遷移 =====
async function navigateTo(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
        window.scrollTo(0, 0);

        // 運営本部(exec) または 管理者(admin) の場合、モード切り替えスイッチを表示
        const user = Auth.getUser();
        const switcher = document.getElementById('exec-mode-switcher');
        if (switcher) {
            const isExec = user && (user.role === 'exec' || user.staff_id === 'FC003');
            const isAdmin = user && (user.role === 'admin' || Auth.DUAL_ACCESS_ADMINS.includes(user.staff_id));
            
            if ((isExec || isAdmin) && screenId !== 'screen-role-select' && screenId !== 'screen-login') {
                switcher.style.display = 'flex';
                // 本部ボタンの表示制御（運営本部のみ表示）
                const execBtn = switcher.querySelector('button[title="運営本部画面"]');
                if (execBtn) execBtn.style.display = isExec ? 'inline-block' : 'none';
                
                // 管理者ボタンの表示制御（管理者・運営本部が利用可能）
                const adminBtn = switcher.querySelector('button[title="管理者画面"]');
                if (adminBtn) adminBtn.style.display = (isExec || isAdmin) ? 'inline-block' : 'none';
            } else {
                switcher.style.display = 'none';
            }
        }
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
        case 'screen-edit-list':
            RecordEdit.init();
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
        case 'screen-dictionary':
            Dictionary.init();
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

        // パワーユーザー（運営本部・管理者）の場合、選択したロールのボタンに応じた画面へ直接遷移
         const isExec = result.user.role === 'exec' || result.user.staff_id.startsWith('1') || result.user.staff_id === 'FC003';
        const isAdmin = result.user.role === 'admin' || Auth.DUAL_ACCESS_ADMINS.includes(result.user.staff_id);
        const selected = Auth.getSelectedRole();
        
        if (isExec) {
            // 本部は3つのどこへでも遷移可能
            if (selected === 'staff') navigateTo('screen-home');
            else if (selected === 'admin') navigateTo('screen-admin');
            else navigateTo('screen-exec');
        } else if (isAdmin) {
            // 管理者は「新人」か「管理」のいずれか
            if (selected === 'staff') navigateTo('screen-home');
            else navigateTo('screen-admin');
        } else {
            // 一般スタッフはスタッフ画面へ
            navigateTo('screen-home');
        }
    } else {
        errorEl.textContent = result.error;
        errorEl.hidden = false;
    }
}

// ===== パスワード表示切り替え =====
function togglePasswordVisibility() {
    const pwdInput = document.getElementById('login-password');
    const toggleBtn = document.getElementById('password-toggle');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>`;
    } else {
        pwdInput.type = 'password';
        toggleBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>`;
    }
}

// ===== ログアウト =====
function handleLogout() {
    Auth.logout();
    document.getElementById('login-form').reset();
    const switcher = document.getElementById('exec-mode-switcher');
    if (switcher) switcher.style.display = 'none';
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
    document.getElementById('home-step-badge').textContent = `第${currentStep}段階`;

    // 対象者ドロップダウン初期化
    initTargetDropdown();

    // 期限アラート
    updateDeadlineAlert();

    // 進捗
    updateProgress(user, currentStep);

    // STEPボタンの状態更新
    updateStepButtons(currentStep);

    // 提出忘れ・期限リマインダー (通知ONの場合のみ)
    if (localStorage.getItem('fc_notifications_enabled') === 'true') {
        Reminder.check(user);
    }
}

// ===== 対象者ドロップダウン =====
async function initTargetDropdown() {
    // 新しい検索可能セレクターの初期化に移行
    await initSearchableTargetSelect('home');
    await initSearchableTargetSelect('step1');
}

/**
 * 検索機能付き対象者選択UIの初期化
 * @param {string} prefix 'home', 'step1', 'step2' 等
 */
async function initSearchableTargetSelect(prefix) {
    const container = document.getElementById(`${prefix}-target-wrapper`);
    const input = document.getElementById(`${prefix}-target-input`);
    const arrow = document.getElementById(`${prefix}-target-arrow`);
    const dropdown = document.getElementById(`${prefix}-target-dropdown`);
    const selectedContainer = document.getElementById(`${prefix}-selected-target`);
    
    if (!input || !dropdown) return;

    const targets = await getTargetList(true);

    // 初期状態の描画（選択済みがあれば）
    if (prefix === 'home' || prefix === 'step1') {
        if (selectedTarget) renderSelectedTarget(selectedContainer, selectedTarget);
    } else {
        if (stepSelectedTargets[prefix]) renderSelectedTarget(selectedContainer, stepSelectedTargets[prefix]);
    }

    // 入力時の検索
    input.addEventListener('input', function() {
        const query = this.value.trim();
        renderDropdownOptions(query);
        dropdown.classList.add('active');
    });

    // 矢印クリックで全表示・非表示切り替え
    if (arrow) {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            const isActive = dropdown.classList.contains('active');
            if (isActive) {
                dropdown.classList.remove('active');
            } else {
                renderDropdownOptions(''); // 全表示
                dropdown.classList.add('active');
                input.focus();
            }
        });
    }

    // フォーカス時
    input.addEventListener('focus', () => {
        renderDropdownOptions(input.value.trim());
        dropdown.classList.add('active');
    });

    // ドロップダウン内のクリック
    dropdown.addEventListener('click', (e) => {
        const option = e.target.closest('.autocomplete-option');
        if (!option || !option.dataset.id) return;
        
        const picked = targets.find(t => t.id === option.dataset.id || t.db_id === option.dataset.id);
        if (!picked) return;

        selectTarget(prefix, picked);
        dropdown.classList.remove('active');
        input.value = '';
    });

    // 外側クリックで閉じる
    document.addEventListener('click', (e) => {
        if (!container || !container.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    function renderDropdownOptions(query) {
        const matches = targets.filter(t => 
            !query || t.name.includes(query) || t.name.replace(/\s/g, '').includes(query.replace(/\s/g, ''))
        );
        
        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-option empty">該当なし</div>';
        } else {
            dropdown.innerHTML = matches.map(t => `
                <div class="autocomplete-option" data-id="${t.id || t.db_id}">
                    ${t.name}
                </div>
            `).join('');
        }
    }
}

function selectTarget(prefix, picked) {
    if (prefix === 'home' || prefix === 'step1') {
        selectedTarget = picked;
        // 同期
        ['home', 'step1'].forEach(p => {
            const container = document.getElementById(`${p}-selected-target`);
            if (container) renderSelectedTarget(container, picked);
        });
    } else {
        stepSelectedTargets[prefix] = picked;
        const container = document.getElementById(`${prefix}-selected-target`);
        if (container) renderSelectedTarget(container, picked);
    }
    showToast(`${picked.name}さんを選択しました ✅`);
}

// onTargetSelectChange は新しい検索UIでは使用しません (initSearchableTargetSelect 内で制御)

/**
 * 対象者選択カードの描画
 */
function renderSelectedTarget(container, target) {
    if (!container) return;
    if (!target) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <div class="selected-target-card" style="display:flex; align-items:center; justify-content:space-between; background:var(--surface); padding:10px 14px; border-radius:var(--radius); border:1px solid var(--border); margin-top:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:1.2rem;">👤</span>
                <div>
                    <div style="font-weight:bold; font-size:0.95rem;">${target.name}</div>
                </div>
            </div>
            <button type="button" onclick="clearSelectedTarget()" style="background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:1.2rem; padding:4px;">✕</button>
        </div>
    `;
}

/**
 * 他の画面や編集モードから対象者を強制選択する
 */
function setStepSelectedTarget(stepName, target) {
    if (!target || !target.id) return;

    // グローバルな selectedTarget を更新
    const picked = {
        id: target.id,
        db_id: target.id,
        name: target.name || '',
        care_level: target.care_level || ''
    };

    selectTarget(stepName === 'home' || stepName === 'step1' ? 'home' : stepName, picked);
}

function clearSelectedTarget() {
    selectedTarget = null;
    ['home', 'step1', 'step2', 'step3', 'step4'].forEach(p => {
        const container = document.getElementById(`${p}-selected-target`);
        if (container) renderSelectedTarget(container, null);
        
        // オートコンプリートのキャッシュもクリア
        if (stepSelectedTargets[p]) stepSelectedTargets[p] = null;
    });
    showToast('対象者の選択を解除しました');
}

// ===== STEP画面用 対象者オートコンプリート =====
const stepSelectedTargets = {}; // { step2: null, step3: null }

async function initStepAutocomplete(stepName) {
    // 共通の initSearchableTargetSelect に移行
    await initSearchableTargetSelect(stepName);
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
    const titleEl = document.getElementById('deadline-alert-title');

    if (titleEl) {
        titleEl.textContent = `${cycle.cycleMonth}月分 提出期限`;
    }

    // 提出期間中かどうか（翌月10日まで）
    if (!cycle.isPastDeadline) {
        const spaces = '&nbsp;'.repeat(6);
        deadlineEl.innerHTML = `${cycle.deadlineStr}${spaces}<span style="margin-left: 12px; font-weight: bold; color: #d9534f;">あと${cycle.daysLeft}日</span>`;
        alertCard.classList.toggle('alert-urgent', cycle.daysLeft <= 3);
    } else {
        // 期限を過ぎている場合はフェーズに応じた表示（評価期間またはフィードバック期間）
        // 11日〜17日は評価期間、それ以降はフィードバック期間とする
        const currentDay = new Date().getDate();
        if (currentDay >= 11 && currentDay <= 17) {
            deadlineEl.textContent = '評価期間中（公開をお待ちください）';
        } else {
            deadlineEl.textContent = 'フィードバック公開中';
        }
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

    const textEl = document.getElementById('home-progress-text');
    if (textEl) textEl.textContent = `${writtenDays}/${minDays}日`;
    
    const fillEl = document.getElementById('home-progress-fill');
    if (fillEl) fillEl.style.width = pct + '%';
    
    const writtenEl = document.getElementById('home-written-days');
    if (writtenEl) writtenEl.textContent = writtenDays;
    
    const circleEl = document.getElementById('home-circle-days');
    if (circleEl) circleEl.textContent = circleDays;
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
async function loadHistory() {
    const user = Auth.getUser();
    if (!user) return;

    const filter = document.getElementById('history-step-filter').value;
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '<p class="empty-state">読み込み中...</p>';

    let records = [];

    const formatDateTime = (isoStr, dateOnly) => {
        if (!isoStr) return dateOnly || '--';
        const d = new Date(isoStr);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${day} ${h}:${min}`;
    };

    try {
        if (filter === 'all' || filter === 'step1') {
            const step1 = (await API.getStep1Records(user.staff_id, null)) || [];
            records = records.concat(step1.map(r => ({
                ...r,
                stepLabel: 'STEP1',
                displayDate: formatDateTime(r.created_at, r.date),
                text: r.notice_text
            })));
        }

        if (filter === 'all' || filter === 'step2') {
            const step2 = (await API.getStep2Records(user.staff_id, null)) || [];
            records = records.concat(step2.map(r => ({
                ...r,
                stepLabel: 'STEP2',
                displayDate: formatDateTime(r.created_at, r.date),
                text: r.change_noticed
            })));
        }

        if (filter === 'all' || filter === 'step3') {
            const step3 = (await API.getStep3Records(user.staff_id, null)) || [];
            records = records.concat(step3.map(r => {
                let notice = '';
                try {
                    const data = typeof r.reflection_json === 'string' ? JSON.parse(r.reflection_json) : r.reflection_json;
                    notice = data?.notice || '';
                } catch (e) { }
                return {
                    ...r,
                    stepLabel: 'STEP3',
                    displayDate: formatDateTime(r.created_at, r.date),
                    text: notice || r.support_done || '振り返り'
                };
            }));
        }

        // STEP4はユーザー要望により履歴から除外

        // 日時降順（作成日時を優先）
        records.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

        if (records.length === 0) {
            listEl.innerHTML = '<p class="empty-state">記録がありません</p>';
            return;
        }

        listEl.innerHTML = records.map(r => `
            <div class="history-item" style="margin-bottom: 12px; background: white; border-radius: 8px; border-left: 4px solid var(--primary); box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow: hidden;">
              <div class="history-item-header" onclick="var d=this.nextElementSibling; d.style.display = d.style.display === 'none' ? 'block' : 'none'; this.querySelector('.accordion-toggle').textContent = d.style.display === 'none' ? '▼' : '▲'; this.querySelector('.history-preview').style.display = d.style.display === 'none' ? 'block' : 'none';" style="display:block; padding: 12px; cursor: pointer;">
                <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 4px;">
                  <strong style="font-size:0.95rem; color:var(--text);">${r.displayDate} <span style="font-size:0.8rem; font-weight:normal; color:#666;">[${r.stepLabel}] - ${r.target_name || ''}さん</span></strong>
                  <span class="accordion-toggle" style="font-size: 0.75rem; color: #999;">▼</span>
                </div>
                <div class="history-preview" style="font-size: 0.8rem; color: #868e96; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 90%;">${(r.text || '').replace(/\n/g, ' ')}</div>
              </div>
              <div class="history-body" style="display: none; padding: 0 12px 12px 12px; border-top: 1px solid #f5f5f5; margin-top: -4px; padding-top: 8px;">
                <div class="history-text" style="font-size:0.9rem; line-height:1.6; color:#333; white-space: pre-wrap;">${r.text || ''}</div>
              </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('履歴の取得に失敗:', e);
        listEl.innerHTML = '<p class="empty-state">履歴の取得に失敗しました</p>';
    }
}

// 管理者画面の初期化プロパティなどは admin.js に集約

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
                <div class="target-list-meta">ID: ${t.id}</div>
            </div>
            <div class="target-list-actions" style="display: flex; gap: 8px;">
                <button class="btn-primary-sm" onclick="editTarget('${t.db_id || t.id}', '${t.name}')">編集</button>
                <button class="btn-delete" onclick="deleteTarget('${t.db_id || t.id}')">削除</button>
            </div>
        </div>
    `).join('');
}

async function editTarget(id, currentName) {
    const newName = prompt('新しい名称を入力してください', currentName);
    if (!newName || newName === currentName) return;

    try {
        const updated = await API.updateTarget(id, { name: newName });
        if (updated) {
            // キャッシュ更新
            const targets = await getTargetList();
            const target = targets.find(t => t.db_id === id || t.id === id);
            if (target) {
                target.name = updated.name;
                saveTargetList(targets);
            }
            renderAdminTargetList();
            showToast('名称を更新しました ✅');
        }
    } catch (e) {
        showToast('更新に失敗しました');
        console.error(e);
    }
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

    const user = Auth.getUser();
    const facility_id = user?.facility_id || 'F001';
    const target_code = 'T' + Date.now().toString().slice(-6);

    const assessData = {
        target_code,
        facility_id,
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
        const newTarget = await API.addTarget(assessData);
        if (!newTarget) throw new Error('保存に失敗しました（DBエラー）');

        cachedTargets = null;
        selectedTarget = newTarget; // 作成した対象者を自動選択状態にする
        showToast(`${name} さんを登録しました ✅`);
        document.getElementById('assessment-new-form')?.reset();
        navigateTo('screen-home');
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
                            ${t.age ? t.age + '歳' : ''}
                            ${t.gender ? (t.age ? ' ・ ' : '') + t.gender : ''}
                            ${t.disease ? (t.age || t.gender ? ' ・ ' : '') + escapeHtml(t.disease) : ''}
                        </div>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <button class="btn-edit-sm" onclick="event.stopPropagation(); openEditAssessment('${id}')">✏️ 編集</button>
                        <button class="btn-delete-sm" onclick="event.stopPropagation(); deleteAssessment('${id}', '${escapeHtml(t.name || '')}')">🗑️ 削除</button>
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
    const user = Auth.getUser();
    const facilityId = user?.facility_id || 'F001';
    const targets = await API.getTargets(facilityId);
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
        const { error } = await window.fcSupabase.from('care_targets').update(updatedData).eq('id', id);
        if (error) throw error;
        cachedTargets = null;
        showToast(`${name} さんの情報を更新しました ✅`);
        navigateTo('screen-assessment-list');
    } catch (e) {
        showToast('更新エラー: ' + (e?.message || JSON.stringify(e)));
    }
}

// ===== 介護対象者を削除（非活性化） =====
async function deleteAssessment(id, name) {
    if (!confirm(`${name} さんを削除してもよろしいですか？\n※これまでの記録は残りますが、選択一覧には表示されなくなります。`)) return;

    try {
        const success = await API.deleteTarget(id);
        if (success) {
            cachedTargets = null;
            showToast(`${name} さんを削除しました`);
            renderAssessmentList(); // リストを再描画
        } else {
            throw new Error('削除に失敗しました');
        }
    } catch (e) {
        showToast('削除エラー: ' + (e?.message || '通信に失敗しました'));
    }
}

// ===== 設定画面の制御 =====
const Settings = {
    init: function () {
        const user = Auth.getUser();
        if (!user) return;

        // UI表示の更新
        const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '--'; };
        s('settings-user-name', user.name + ' さん');
        s('settings-user-id', user.staff_id);
        
        // アバターの頭文字
        const avatarEl = document.getElementById('settings-avatar-text');
        if (avatarEl) avatarEl.textContent = user.name ? user.name.charAt(0) : '👤';

        // 施設名 (あれば表示)
        s('settings-user-facility', user.facility_name || 'フリーケア ケアセンター');

        const roles = { staff: '新人研修スタッフ', admin: '管理者', exec: '運営本部' };
        s('settings-user-role', roles[user.role] || user.role);

        // 管理者限定セクション
        const adminOnly = document.getElementById('settings-admin-only');
        if (adminOnly) {
            adminOnly.style.display = (user.role === 'admin') ? 'block' : 'none';
        }

        // テーマトグルの状態反映
        const isDark = document.body.classList.contains('dark-theme');
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) themeToggle.checked = isDark;

        // 通知トグルの状態反映
        const isNotifEnabled = localStorage.getItem('fc_notifications_enabled') === 'true';
        const notifToggle = document.getElementById('notification-toggle');
        if (notifToggle) notifToggle.checked = isNotifEnabled;

        // 文字サイズの反映
        this.loadFontSize();
    },

    loadFontSize: function() {
        const saved = localStorage.getItem('fc_font_size') || 'medium';
        this.applyFontSize(saved);
    },

    applyFontSize: function(size) {
        document.documentElement.setAttribute('data-font-size', size);
        localStorage.setItem('fc_font_size', size);
        
        // ラベルの更新
        const labelEl = document.getElementById('settings-font-size-label');
        if (labelEl) {
            const labels = { small: '小', medium: '中', large: '大', xlarge: '特大' };
            labelEl.textContent = labels[size] || '中';
        }
    },

    cycleFontSize: function(dir = 1) {
        const current = localStorage.getItem('fc_font_size') || 'medium';
        const sizes = ['small', 'medium', 'large', 'xlarge'];
        let idx = sizes.indexOf(current);
        let nextIdx = (idx + dir + sizes.length) % sizes.length;
        this.applyFontSize(sizes[nextIdx]);
        
        showToast(`文字サイズを「${document.getElementById('settings-font-size-label').textContent}」に変更しました`);
    },

    toggleNotifications: async function (enabled) {
        if (enabled) {
            if (!("Notification" in window)) {
                showToast("このブラウザは通知に対応していません 🚫");
                document.getElementById('notification-toggle').checked = false;
                return;
            }

            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                localStorage.setItem('fc_notifications_enabled', 'true');
                showToast("通知を有効にしました！🔔");
                
                // 初回ウェルカム通知
                NotificationHelper.send("🤖 AIサポーター（師匠）", "通知をONにしたな！これから毎日ビシビシ指導したるから、覚悟しときや！💪");
            } else {
                localStorage.setItem('fc_notifications_enabled', 'false');
                showToast("通知がブロックされています ⚠️");
                document.getElementById('notification-toggle').checked = false;
            }
        } else {
            localStorage.setItem('fc_notifications_enabled', 'false');
            showToast("通知を無効にしました");
        }
    },

    toggleTheme: function (isDark) {
        if (isDark) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('fc_theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('fc_theme', 'light');
        }
    },

    openPasswordModal: function () {
        document.getElementById('password-modal')?.classList.add('active');
    },

    closePasswordModal: function () {
        document.getElementById('password-modal')?.classList.remove('active');
        document.querySelector('.pw-form')?.reset();
    },

    changePassword: async function (event) {
        event.preventDefault();
        const current = document.getElementById('pw-current').value;
        const newPw = document.getElementById('pw-new').value;
        const confirm = document.getElementById('pw-confirm').value;

        if (newPw !== confirm) {
            showToast('新しいパスワードが一致しません');
            return;
        }

        const user = Auth.getUser();
        if (!user) return;

        try {
            // パスワード更新（staffsテーブルのpasswordカラムを更新）
            const { error } = await window.fcSupabase
                .from('staff_master')
                .update({ password: newPw })
                .eq('staff_id', user.staff_id)
                .eq('password', current); // 現在のパスワードが一致する場合のみ更新

            if (error) throw error;

            showToast('パスワードを更新しました ✅');
            this.closePasswordModal();
        } catch (e) {
            console.error('Password change failed:', e);
            showToast('更新に失敗しました。現在のパスワードが正しいか確認してください。');
        }
    }
};

// navigateTo から呼ばれるラッパー
function initSettings() {
    Settings.init();
}

// 削除確認の表示・非表示（既存のグローバル関数を調整）
function showDeleteConfirm() {
    const banner = document.getElementById('delete-confirm-banner');
    if (banner) banner.classList.add('show');
}
function hideDeleteConfirm() {
    const banner = document.getElementById('delete-confirm-banner');
    if (banner) banner.classList.remove('show');
}
async function executeDeleteAccount() {
    const user = Auth.getUser();
    if (!user) return;
    try {
        const { error } = await window.fcSupabase.from('staff_master').update({ is_active: false, left_at: new Date().toISOString() }).eq('staff_id', user.staff_id);
        if (error) throw error;
        showToast('アカウントを削除しました');
        handleLogout();
    } catch (e) {
        showToast('削除エラー: ' + e.message);
    }
}

// アプリ起動時のテーマ適用
(function () {
    const savedTheme = localStorage.getItem('fc_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
})();

// ===== 介護用語辞典ロジック =====
const Dictionary = {
    currentIndex: 'あ',
    
    init: function() {
        this.renderIndex();
        this.renderList();
    },

    renderIndex: function() {
        const indexEl = document.getElementById('dict-index');
        if (!indexEl) return;

        const chars = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', 'ABC'];
        indexEl.innerHTML = chars.map(c => `
            <button class="index-btn ${this.currentIndex === c ? 'active' : ''}" 
                    onclick="Dictionary.scrollToCategory('${c}')">${c}</button>
        `).join('');
    },

    renderList: function() {
        const listEl = document.getElementById('dict-list');
        if (!listEl) return;

        const data = DICTIONARY_DATA;
        if (!data || data.length === 0) {
            listEl.innerHTML = '<div class="empty-state">データが見つかりません</div>';
            return;
        }

        // カテゴリ分け
        const groups = this.groupData(data);
        
        let html = '';
        const chars = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', 'ABC'];
        
        chars.forEach(char => {
            if (groups[char] && groups[char].length > 0) {
                html += `<div class="dict-group-title" id="dict-group-${char}">${char}行</div>`;
                groups[char].forEach(item => {
                    html += this.createCardHTML(item);
                });
            }
        });

        listEl.innerHTML = html;
    },

    groupData: function(data) {
        const groups = {};
        data.forEach(item => {
            let char = this.getCategory(item.reading || item.term);
            if (!groups[char]) groups[char] = [];
            groups[char].push(item);
        });
        return groups;
    },

    getCategory: function(text) {
        if (!text) return 'ABC';
        const first = text.charAt(0);
        if (/[a-zA-Z]/.test(first)) return 'ABC';
        
        const rows = {
            'あ': 'あいうえお',
            'か': 'かきくけこがぎぐげご',
            'さ': 'さしすせそざじずぜぞ',
            'た': 'たちつてとだぢづでど',
            'な': 'なにぬねの',
            'は': 'はひふへほばびぶべぼぱぴぷぺぽ',
            'ま': 'まみむめも',
            'や': 'やゆよ',
            'ら': 'らりるれろ',
            'わ': 'わをん'
        };

        for (const [row, chars] of Object.entries(rows)) {
            if (chars.includes(first)) return row;
        }
        return 'ABC';
    },

    createCardHTML: function(item) {
        return `
            <div class="dict-card" id="card-${item.term}" data-term="${item.term}" data-reading="${item.reading || ''}">
                <div class="dict-term">
                    ${item.term}
                    ${item.reading ? `<span class="dict-reading">${item.reading}</span>` : ''}
                </div>
                <div class="dict-def">${item.definition}</div>
            </div>
        `;
    },

    filter: function() {
        const queryEl = document.getElementById('dict-search');
        const suggestEl = document.getElementById('dict-suggestions');
        if (!queryEl) return;
        
        const query = queryEl.value.toLowerCase().trim();
        const cards = document.querySelectorAll('.dict-card');
        const titles = document.querySelectorAll('.dict-group-title');
        const indexContainer = document.querySelector('.dict-index-container');

        if (!query) {
            cards.forEach(c => c.style.display = 'block');
            titles.forEach(t => t.style.display = 'block');
            if (indexContainer) indexContainer.style.display = 'block';
            if (suggestEl) suggestEl.style.display = 'none';
            return;
        }

        if (indexContainer) indexContainer.style.display = 'none';

        // 1. メインリストのフィルタリング
        let matchCount = 0;
        cards.forEach(card => {
            const term = (card.dataset.term || '').toLowerCase();
            const reading = (card.dataset.reading || '').toLowerCase();
            if (term.includes(query) || reading.includes(query)) {
                card.style.display = 'block';
                matchCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // 2. サジェストリストの構築
        if (suggestEl) {
            const matches = DICTIONARY_DATA.filter(item => 
                item.term.toLowerCase().includes(query) || 
                (item.reading && item.reading.includes(query))
            ).slice(0, 5);

            if (matches.length > 0) {
                let suggestHtml = matches.map(m => `
                    <div class="suggestion-item" onclick="Dictionary.selectSuggestion('${m.term}')">
                        <span class="term">${m.term}</span>
                        <span class="reading">${m.reading || ''}</span>
                    </div>
                `).join('');
                
                suggestEl.innerHTML = suggestHtml;
                suggestEl.style.display = 'block';
            } else {
                suggestEl.innerHTML = `
                    <div class="suggestion-ai-trigger" style="border-top:none; color: #666; font-size: 0.85rem; line-height: 1.5;">
                        🔍 辞典にない言葉です。<br>
                        そのまま<strong style="color:var(--primary);">「Enter」</strong>を押すとAIが詳しく解説します。
                    </div>
                `;
                suggestEl.style.display = 'block';
            }
        }

        // カテゴリタイトル表示制御
        titles.forEach(title => {
            let hasVisible = false;
            let current = title.nextElementSibling;
            while (current && !current.classList.contains('dict-group-title')) {
                if (current.classList.contains('dict-card') && current.style.display !== 'none') {
                    hasVisible = true;
                    break;
                }
                current = current.nextElementSibling;
            }
            title.style.display = hasVisible ? 'block' : 'none';
        });
    },

    handleSearchKey: function(e) {
        if (e.key === 'Enter') {
            const query = e.target.value.toLowerCase().trim();
            if (!query) return;

            // 完全一致があるか確認
            const match = DICTIONARY_DATA.find(item => 
                item.term.toLowerCase() === query || 
                (item.reading && item.reading === query)
            );

            if (match) {
                // 一致があればそこへスクロール
                this.selectSuggestion(match.term);
            } else {
                // なければAIに聞く
                this.askAI(query);
            }
        }
    },

    selectSuggestion: function(term) {
        const queryEl = document.getElementById('dict-search');
        const suggestEl = document.getElementById('dict-suggestions');
        if (queryEl) queryEl.value = term;
        if (suggestEl) suggestEl.style.display = 'none';
        
        this.filter();

        // 対象のカードへスクロール
        const card = document.getElementById(`card-${term}`);
        if (card) {
            const offset = 180;
            const elementPosition = card.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - offset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
    },

    scrollToCategory: function(char) {
        const target = document.getElementById(`dict-group-${char}`);
        if (target) {
            const offset = 180;
            const elementPosition = target.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            this.currentIndex = char;
            this.renderIndex();
        }
    },

    askAI: function(term) {
        navigateTo('screen-ai-helper');
        setTimeout(() => {
            const input = document.getElementById('help-chat-input');
            if (input) {
                input.value = `「${term}」について、新人スタッフにもわかりやすく具体例を交えて教えて。`;
                sendHelpChat();
            }
        }, 300);
    }
};

// ===== リマインダーロジック =====
const Reminder = {
    check: async function(user) {
        // セッション内で1回だけ判定し、かつホーム画面表示から少し遅らせて実行
        if (sessionStorage.getItem('fc_reminder_checked_ready')) return;
        
        setTimeout(async () => {
            try {
                const cycle = DB.getCurrentCycle();
                if (cycle.isPastDeadline) return;

                // 1. 今日の入力忘れチェック
                await this.checkDailyInput(user);

                // 2. 期限リマインダー（多段階）
                this.checkDeadlineThresholds(cycle);

                sessionStorage.setItem('fc_reminder_checked_ready', 'true');
            } catch (e) {
                console.warn("Reminder check error:", e);
            }
        }, 3000);
    },

    checkDailyInput: async function(user) {
        if (sessionStorage.getItem('fc_notified_today')) return;
        
        const today = new Date().toISOString().split('T')[0];
        try {
            const records = await API.getStep1Records(user.staff_id);
            const hasRecordToday = records.some(r => r.date === today);

            if (!hasRecordToday) {
                NotificationHelper.send("🤖 AIサポーター", "おい！今日の記録がまだやぞ！忘れる前にパパッと書いてまおな。応援しとるで！💪");
                sessionStorage.setItem('fc_notified_today', 'true');
            }
        } catch(e) {
            console.warn("Daily input check failed", e);
        }
    },

    checkDeadlineThresholds: function(cycle) {
        const now = new Date();
        const diffMs = cycle.deadlineDate - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        // 多段階の判定
        const stages = [
            { id: '12h', threshold: 12, label: 'あと12時間' },
            { id: '1d', threshold: 24, label: 'あと1日' },
            { id: '2d', threshold: 48, label: 'あと2日' },
            { id: '3d', threshold: 72, label: 'あと3日' },
            { id: '4d', threshold: 96, label: 'あと4日' },
            { id: '5d', threshold: 120, label: 'あと5日' }
        ];

        for (const stage of stages) {
            if (diffHours <= stage.threshold) {
                const key = `fc_reminder_${cycle.yearMonth}_${stage.id}`;
                if (!localStorage.getItem(key)) {
                    let msg = "";
                    if (stage.id === '12h') {
                        msg = "【最終警告】今月分の提出・修正期限まで残り12時間を切ったで！出し残しはないか？今すぐ確認や！🔥";
                    } else {
                        msg = `期限まで【${stage.label}】やで！記録の修正や提出は早めに済ませておこうな。頑張れ！✨`;
                    }
                    
                    NotificationHelper.send("⏰ 提出期限リマインダー", msg);
                    localStorage.setItem(key, 'true');
                    break; // 直近の1つだけを通知
                }
                break;
            }
        }
    }
};
// アプリ起動時の初期化
document.addEventListener('DOMContentLoaded', () => {
    Settings.loadFontSize();
});
