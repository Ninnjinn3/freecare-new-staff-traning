/* ============================================
   exec.js — 運営本部ダッシュボード
   全拠点KPI・STEP分布・拠点別比較
   ============================================ */

const Exec = {
    data: null,

    async load() {
        const cycle = DB.getCurrentCycle();

        try {
            const resp = await fetch('/api/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year_month: cycle.yearMonth })
            });

            if (resp.ok) {
                this.data = await resp.json();
                this.renderSummary();
                this.renderStepDist();
                this.renderFacilities();
                return;
            }
        } catch (e) {
            console.warn('運営本部API失敗:', e);
        }

        // フォールバック
        const el = document.getElementById('exec-facility-list');
        if (el) el.innerHTML = '<p class="empty-state">データの取得に失敗しました</p>';
    },

    renderSummary() {
        if (!this.data?.globalSummary) return;
        const g = this.data.globalSummary;
        setText('exec-total-staff', `${g.totalStaff}名`);
        setText('exec-active-staff', `${g.activeStaff}名`);
        setText('exec-pass-rate', `${g.passRate}%`);
        setText('exec-avg-score', g.avgScore > 0 ? `${g.avgScore}点` : '--');
        // 組織KPI
        setText('exec-attrition', `${g.attritionRate ?? 0}%`);
        setText('exec-retention', `${g.retentionRate ?? 0}%`);
        setText('exec-completion', `${g.completionRate ?? 0}%`);
    },

    renderStepDist() {
        const container = document.getElementById('exec-step-dist');
        if (!container || !this.data?.globalSummary) return;
        const dist = this.data.globalSummary.stepDistribution;
        const total = Math.max(dist.step1 + dist.step2 + dist.step3 + dist.step4, 1);

        const colors = ['var(--primary)', '#f59e0b', '#8b5cf6', 'var(--success)'];
        const labels = ['STEP1 気付き', 'STEP2 仮説', 'STEP3 振り返り', 'STEP4 症例'];
        const values = [dist.step1, dist.step2, dist.step3, dist.step4];

        container.innerHTML = `
            <div class="dist-bars">
                ${values.map((v, i) => `
                    <div class="dist-row">
                        <span class="dist-label">${labels[i]}</span>
                        <div class="dist-bar-bg">
                            <div class="dist-bar-fill" style="width:${(v / total) * 100}%;background:${colors[i]}"></div>
                        </div>
                        <span class="dist-count">${v}名</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    renderFacilities() {
        const list = document.getElementById('exec-facility-list');
        if (!list || !this.data?.facilityStats) return;

        if (this.data.facilityStats.length === 0) {
            list.innerHTML = '<p class="empty-state">拠点データがありません</p>';
            return;
        }

        list.innerHTML = this.data.facilityStats.map(f => {
            const rateClass = f.passRate >= 80 ? 'score-high' : f.passRate >= 60 ? 'score-mid' : 'score-low';
            return `
            <div class="staff-card">
                <div class="staff-card-header">
                    <span class="staff-name">🏢 ${f.name}</span>
                    <span class="staff-stat-value">${f.staffCount}名</span>
                </div>
                <div class="staff-card-stats">
                    <div class="staff-stat">
                        <span class="staff-stat-label">記録あり</span>
                        <span class="staff-stat-value">${f.activeStaff}名</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">記録数</span>
                        <span class="staff-stat-value">${f.totalRecords}件</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">合格率</span>
                        <span class="staff-stat-value ${rateClass}">${f.passRate}%</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">平均点</span>
                        <span class="staff-stat-value">${f.avgScore || '--'}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
};
