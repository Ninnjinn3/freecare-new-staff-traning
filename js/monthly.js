/* ============================================
   monthly.js — 月次評価・合否判定
   Supabase の実データから自動算出
   ============================================ */

const Monthly = {
    // 月次スコア算出（API経由で実データから算出）
    async calculate() {
        const user = Auth.getUser();
        if (!user) return null;

        const cycle = DB.getCurrentCycle();

        try {
            const resp = await fetch('/api/monthly', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_id: user.staff_id,
                    year_month: cycle.yearMonth,
                    current_step: user.current_step || 1
                })
            });

            if (resp.ok) {
                return await resp.json();
            }
        } catch (e) {
            console.warn('月次評価API失敗、デモデータ使用:', e);
        }

        // フォールバック: デモデータ
        return this.calculateDemoScore();
    },

    // デモ用フォールバック
    calculateDemoScore() {
        return {
            score: 72,
            breakdown: [
                { name: '気づいた変化の明確さ', score: 12, max: 15 },
                { name: '要因の多層的分析', score: 14, max: 20 },
                { name: '要因の関連性と優先順位', score: 10, max: 15 },
                { name: '検証計画の論理性', score: 11, max: 15 },
                { name: '支援計画の実効性', score: 14, max: 20 },
                { name: '振り返り・修正力', score: 11, max: 15 }
            ],
            level: this.getLevel(72),
            passed: false,
            hrPoints: 4,
            totalRecords: 0,
            passCount: 0,
            failCount: 0,
            actions: [
                '仮説の「なぜ？」を3段階まで掘り下げる練習をしましょう',
                '優先順位の根拠に「緊急性」と「可逆性」の観点を加えましょう',
                '支援計画に本人の意思確認プロセスを組み込みましょう'
            ]
        };
    },

    getLevel(score) {
        const t = LEVEL_THRESHOLDS.find(l => score >= l.min && score <= l.max);
        return t || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    },

    checkPass(score, attemptNumber, previousScores) {
        if (attemptNumber === 1) {
            return score >= PASS_RULES.firstAttemptScore;
        }
        if (previousScores.length >= 1) {
            const lastScore = previousScores[previousScores.length - 1];
            return lastScore === 100 && score === 100;
        }
        return false;
    },

    // 月次評価画面描画
    async render() {
        // ローディング表示
        const scoreEl = document.getElementById('monthly-score');
        if (scoreEl) scoreEl.textContent = '...';

        // API経由で実データを取得
        const report = await this.calculate();
        if (!report) return;

        // スコアリング
        scoreEl.textContent = report.score;

        const ring = document.getElementById('score-ring');
        ring.className = 'score-ring';
        if (report.score >= 80) ring.classList.add('score-high');
        else if (report.score >= 60) ring.classList.add('score-mid');
        else if (report.score >= 40) ring.classList.add('score-low');
        else ring.classList.add('score-danger');

        // レベル
        const level = report.level || this.getLevel(report.score);
        document.getElementById('monthly-grade').textContent = level.grade;
        document.getElementById('monthly-level-name').textContent = level.name;

        // 合否バッジ
        const passEl = document.getElementById('monthly-pass-status');
        if (passEl) {
            if (report.totalRecords === 0) {
                passEl.textContent = '記録なし';
                passEl.className = 'pass-badge pending';
            } else if (report.passed) {
                passEl.textContent = '合格 ✅';
                passEl.className = 'pass-badge passed';
            } else {
                passEl.textContent = '不合格';
                passEl.className = 'pass-badge failed';
            }
        }

        // 人事評価ポイント
        const hrEl = document.getElementById('monthly-hr-points');
        if (hrEl) hrEl.textContent = `${report.hrPoints || 0}点`;

        // 記録件数
        const recordsEl = document.getElementById('monthly-record-count');
        if (recordsEl) recordsEl.textContent = `${report.totalRecords || 0}件（○${report.passCount || 0} / ×${report.failCount || 0}）`;

        // 6観点内訳
        const breakdown = document.getElementById('score-breakdown');
        breakdown.innerHTML = report.breakdown.map(item => `
      <div class="breakdown-item">
        <span class="breakdown-name">${item.name}</span>
        <div class="breakdown-bar">
          <div class="breakdown-bar-fill" style="width: ${(item.score / item.max) * 100}%"></div>
        </div>
        <span class="breakdown-score">${item.score}/${item.max}</span>
      </div>
    `).join('');

        // 改善アクション
        const actionsList = document.getElementById('monthly-actions');
        actionsList.innerHTML = (report.actions || []).map(a => `<li>${a}</li>`).join('');

        // 毎日の記録一覧を描画
        const recordsList = document.getElementById('monthly-records-list');
        if (recordsList) {
            recordsList.innerHTML = '<p style="text-align:center;color:var(--text-muted)">読み込み中...</p>';
            try {
                const user = Auth.getUser();
                const cycle = DB.getCurrentCycle();
                const records = await API.getStep1Records(user.staff_id, cycle.yearMonth);

                if (records && records.length > 0) {
                    recordsList.innerHTML = records.map(r => `
                        <div class="card" style="margin-bottom: var(--space-sm); padding: var(--space-sm); border-left: 4px solid ${r.ai_judgement === '○' ? 'var(--success)' : 'var(--danger)'}">
                            <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                                <strong style="font-size:1.1rem">${r.date} <span style="font-weight:normal; font-size:0.9rem; color:var(--text-muted)">- ${r.target_name}さん</span></strong>
                                <span class="stat-circle" style="font-weight:bold; color: ${r.ai_judgement === '○' ? 'var(--success)' : 'var(--danger)'}">${r.ai_judgement}</span>
                            </div>
                            <div style="font-size: 0.95rem; color: var(--text); margin-bottom: 8px; line-height: 1.5;">
                                ${r.notice_text}
                            </div>
                            ${r.ai_judgement === '×' && r.improvement_example ? `
                            <div style="font-size: 0.85rem; color: #b71c1c; background: #ffebee; padding: 8px; border-radius: 4px; margin-top: 8px;">
                                <strong>💡 AIからの改善アドバイス:</strong><br>
                                ${r.improvement_example}
                            </div>
                            ` : ''}
                        </div>
                    `).join('');
                } else {
                    recordsList.innerHTML = '<p class="empty-state">今月の記録はありません</p>';
                }
            } catch (e) {
                console.error('記録一覧取得エラー:', e);
                recordsList.innerHTML = '<p class="empty-state">記録の取得に失敗しました</p>';
            }
        }
    }
};
