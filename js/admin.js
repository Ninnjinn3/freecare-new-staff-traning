/* ============================================
   admin.js — 管理者ダッシュボード
   スタッフ進捗一覧・アラート管理
   ============================================ */

const Admin = {
    data: null,

    // ダッシュボード読み込み
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
                this.renderStaffList();
                this.renderAlerts();
                return;
            }
        } catch (e) {
            console.warn('管理者API失敗:', e);
        }

        // フォールバック
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
    },

    // スタッフ進捗一覧描画
    renderStaffList() {
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

            return `
            <div class="staff-card">
                <div class="staff-card-header">
                    <span class="staff-name">${staff.name}</span>
                    <span class="${stepClass}">STEP${staff.current_step}</span>
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
                        <span class="staff-stat-label">合否</span>
                        <span class="staff-stat-value">${passIcon}</span>
                    </div>
                </div>
                ${staff.lastRecordDate ? `<div class="staff-last-record">最終記録: ${staff.lastRecordDate}</div>` : ''}
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

        // アラートタブにバッジ表示
        const alertTab = document.getElementById('admin-tab-alerts');
        if (alertTab && this.data.alerts.length > 0) {
            alertTab.textContent = `🔔 アラート (${this.data.alerts.length})`;
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
    }
};

// タブ切替（alertsタブ対応）
function showAdminTab(tab) {
    // 全タブ非アクティブ
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.hidden = true);

    // 選択タブをアクティブにする
    document.getElementById(`admin-tab-${tab}`).classList.add('active');
    document.getElementById(`admin-${tab}-section`).hidden = false;

    // 進捗タブまたはアラートタブを初回クリック時にデータ取得
    if ((tab === 'progress' || tab === 'alerts') && !Admin.data) {
        Admin.load();
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
