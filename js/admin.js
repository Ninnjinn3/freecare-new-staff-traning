/* ============================================
   admin.js — 管理者ダッシュボード
   スタッフ進捗一覧・アラート・スタッフ管理
   ============================================ */

const Admin = {
    data: null,

    // ===== ダッシュボード読み込み =====
    async load() {
        const user = Auth.getUser();
        if (!user) return;

        const facilityId = user.facility_id || 'F001';
        const cycle = DB.getCurrentCycle();

        try {
            const resp = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    facility_id: facilityId,
                    year_month: cycle.yearMonth
                })
            });

            if (resp.ok) {
                this.data = await resp.json();
                this.renderSummary();
                this.renderProgressList();
                this.renderAlerts();
                return;
            }
        } catch (e) {
            console.warn('管理者API失敗:', e);
        }
        this.renderEmpty();
    },

    // サマリカード描画
    renderSummary() {
        if (!this.data?.summary) return;
        const s = this.data.summary;
        setText('summary-total', `${s.totalStaff}名`);
        setText('summary-active', `${s.activeStaff}名`);
        setText('summary-avg-score', s.avgScore > 0 ? `${s.avgScore}点` : '--');
        setText('summary-avg-pass', `${s.avgPassRate}%`);
        setText('summary-hit-rate', `${s.hitRate || 0}%`);
        setText('summary-reflection-rate', `${s.reflectionRate || 0}%`);
    },

    // スタッフ進捗一覧描画
    renderProgressList() {
        const list = document.getElementById('staff-progress-list');
        if (!list || !this.data?.staffProgress) return;

        if (this.data.staffProgress.length === 0) {
            list.innerHTML = '<p class="empty-state">研修対象スタッフがいません</p>';
            return;
        }

        list.innerHTML = this.data.staffProgress.map(staff => {
            const stepClass = `step-badge step-${staff.current_step}`;
            const scoreClass = staff.monthlyScore >= 80 ? 'score-high' :
                staff.monthlyScore >= 60 ? 'score-mid' : 'score-low';
            const passIcon = staff.passed ? '✅' : (staff.totalRecords > 0 ? '❌' : '—');
            const sub = staff.subLevel || { label: '--', icon: '🔵', progress: 0 };
            const taskDone = staff.taskStatus === 'done';

            return `
            <div class="staff-card">
                <div class="staff-card-header">
                    <span class="staff-name">${staff.name}</span>
                    <span class="${stepClass}">STEP${staff.current_step}</span>
                </div>
                <div class="sub-level-row">
                    <span class="sub-level-icon">${sub.icon}</span>
                    <div class="sub-level-bar-bg">
                        <div class="sub-level-bar-fill" style="width:${sub.progress}%"></div>
                    </div>
                    <span class="sub-level-label">${sub.label}</span>
                </div>
                <div class="staff-card-stats">
                    <div class="staff-stat">
                        <span class="staff-stat-label">記録</span>
                        <span class="staff-stat-value">${staff.totalRecords}件</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">合格率</span>
                        <span class="staff-stat-value">${staff.passRate}%</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">スコア</span>
                        <span class="staff-stat-value ${scoreClass}">${staff.monthlyScore ?? '--'}</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">今月</span>
                        <span class="staff-stat-value ${taskDone ? 'score-high' : ''}">${taskDone ? '完了✅' : staff.taskStatus || '--'}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    // アラート一覧描画
    renderAlerts() {
        const list = document.getElementById('admin-alert-list');
        if (!list || !this.data?.alerts) return;

        if (this.data.alerts.length === 0) {
            list.innerHTML = '<p class="empty-state">アラートはありません 🎉</p>';
            return;
        }

        const alertTab = document.getElementById('admin-tab-alerts');
        if (alertTab && this.data.alerts.length > 0) {
            alertTab.textContent = `🔔 (${this.data.alerts.length})`;
        }

        list.innerHTML = this.data.alerts.map(alert => `
            <div class="alert-item alert-${alert.type}">
                <span class="alert-icon">${alert.icon}</span>
                <div class="alert-content">
                    <span class="alert-staff">${alert.staff}</span>
                    <span class="alert-message">${alert.message}</span>
                </div>
            </div>
        `).join('');
    },

    renderEmpty() {
        setText('summary-total', '0名');
        setText('summary-active', '0名');
        setText('summary-avg-score', '--');
        setText('summary-avg-pass', '--');
        const list = document.getElementById('staff-progress-list');
        if (list) list.innerHTML = '<p class="empty-state">データの取得に失敗しました</p>';
    },

    // ===== スタッフ管理 =====

    // スタッフ一覧取得
    async loadStaffList() {
        const user = Auth.getUser();
        const facilityId = user?.facility_id || 'F001';
        const showInactive = document.getElementById('show-inactive-staff')?.checked || false;

        const list = document.getElementById('staff-manage-list');
        if (list) list.innerHTML = '<p class="empty-state">読み込み中...</p>';

        try {
            const resp = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'list',
                    facility_id: facilityId,
                    include_inactive: showInactive
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                this.renderStaffManageList(data.staff || []);
                return;
            }
        } catch (e) {
            console.warn('スタッフ一覧取得失敗:', e);
        }

        if (list) list.innerHTML = '<p class="empty-state">取得に失敗しました</p>';
    },

    renderStaffManageList(staffList) {
        const list = document.getElementById('staff-manage-list');
        if (!list) return;

        if (staffList.length === 0) {
            list.innerHTML = '<p class="empty-state">スタッフがいません</p>';
            return;
        }

        const roleLabels = { staff: '研修', admin: '管理者', exec: '本部' };

        list.innerHTML = staffList.map(s => {
            const isInactive = !s.is_active;
            const roleLabel = roleLabels[s.role] || s.role;

            return `
            <div class="staff-manage-card ${isInactive ? 'staff-inactive' : ''}">
                <div class="staff-card-header">
                    <span class="staff-name">${isInactive ? '🔴 ' : '🟢 '}${s.name}</span>
                    <span class="step-badge step-${s.current_step || 0}">${roleLabel}</span>
                </div>
                <div class="staff-manage-info">
                    <span>ID: ${s.staff_id}</span>
                    <span>${s.work_type === 'day' ? '日勤' : s.work_type === 'night' ? '夜勤' : '宿直'}</span>
                    ${s.current_step ? `<span>STEP${s.current_step}</span>` : ''}
                    ${s.left_date ? `<span class="left-date">退職: ${s.left_date}</span>` : ''}
                </div>
                ${!isInactive ? `
                <button class="btn-danger-sm" onclick="Admin.confirmDelete('${s.staff_id}', '${s.name}')">
                    退職処理
                </button>` : ''}
            </div>`;
        }).join('');
    },

    // スタッフ新規作成
    async createStaff() {
        const name = document.getElementById('new-staff-name')?.value?.trim();
        const staffId = document.getElementById('new-staff-id')?.value?.trim();
        const pw = document.getElementById('new-staff-pw')?.value?.trim();
        const workType = document.getElementById('new-staff-worktype')?.value;
        const role = document.getElementById('new-staff-role')?.value;

        if (!name || !staffId || !pw) {
            showToast('氏名・職員ID・パスワードを入力してください');
            return;
        }

        const user = Auth.getUser();
        const btn = document.getElementById('btn-create-staff');
        if (btn) { btn.disabled = true; btn.textContent = '登録中...'; }

        try {
            const resp = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    staff_id: staffId,
                    name,
                    initial_password: pw,
                    role,
                    work_type: workType,
                    facility_id: user?.facility_id || 'F001',
                    facility_name: user?.facility_name || ''
                })
            });

            const data = await resp.json();
            if (resp.ok && data.success) {
                showToast(`${name}（${staffId}）を登録しました ✅`);
                // フォームクリア
                document.getElementById('new-staff-name').value = '';
                document.getElementById('new-staff-id').value = '';
                document.getElementById('new-staff-pw').value = '';
                this.loadStaffList();
            } else {
                showToast(data.error || '登録に失敗しました');
            }
        } catch (e) {
            showToast('登録に失敗しました: ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '＋ スタッフ登録'; }
        }
    },

    // 削除確認
    confirmDelete(staffId, name) {
        if (confirm(`「${name}（${staffId}）」を退職処理しますか？\n\nこの操作は離職扱いとなり、離職率に反映されます。`)) {
            this.deleteStaff(staffId);
        }
    },

    // スタッフ削除（離職扱い）
    async deleteStaff(staffId) {
        const user = Auth.getUser();

        try {
            const resp = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    staff_id: staffId,
                    deleted_by: user?.staff_id || 'admin'
                })
            });

            const data = await resp.json();
            if (resp.ok && data.success) {
                showToast(`${staffId} を退職処理しました`);
                this.loadStaffList();
            } else {
                showToast(data.error || '削除に失敗しました');
            }
        } catch (e) {
            showToast('削除に失敗しました: ' + e.message);
        }
    }
};

// タブ切替
function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.hidden = true);

    document.getElementById(`admin-tab-${tab}`).classList.add('active');
    document.getElementById(`admin-${tab}-section`).hidden = false;

    // 初回データ取得
    if ((tab === 'progress' || tab === 'alerts') && !Admin.data) {
        Admin.load();
    }
    if (tab === 'staff') {
        Admin.loadStaffList();
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
