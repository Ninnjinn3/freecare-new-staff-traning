/* ============================================
   monthly.js — 月次評価・合否判定
   ============================================ */

const Monthly = {
    // 月次スコア算出（デモ用）
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
        // 2回目以降: 2回連続100点
        if (previousScores.length >= 1) {
            const lastScore = previousScores[previousScores.length - 1];
            return lastScore === 100 && score === 100;
        }
        return false;
    },

    // 月次評価画面描画
    render() {
        const report = this.calculateDemoScore();

        // スコアリング
        document.getElementById('monthly-score').textContent = report.score;

        const ring = document.getElementById('score-ring');
        ring.className = 'score-ring';
        if (report.score >= 80) ring.classList.add('score-high');
        else if (report.score >= 60) ring.classList.add('score-mid');
        else if (report.score >= 40) ring.classList.add('score-low');
        else ring.classList.add('score-danger');

        // レベル
        document.getElementById('monthly-grade').textContent = report.level.grade;
        document.getElementById('monthly-level-name').textContent = report.level.name;

        // 内訳
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
        actionsList.innerHTML = report.actions.map(a => `<li>${a}</li>`).join('');
    }
};
