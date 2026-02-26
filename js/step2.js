/* ============================================
   step2.js — STEP2 仮説思考入力 + AI◯☓判定
   ============================================ */

let hypothesisCount = 0;
const MAX_HYPOTHESES = 5;
const MIN_HYPOTHESES = 3;

const Step2 = {
    init() {
        const dateInput = document.getElementById('step2-date');
        dateInput.value = new Date().toISOString().split('T')[0];
        this.populateTargets();

        // 仮説カードを3つ初期表示
        hypothesisCount = 0;
        document.getElementById('step2-hypotheses-container').innerHTML = '';
        for (let i = 0; i < MIN_HYPOTHESES; i++) {
            addHypothesisCard();
        }
    },

    populateTargets() {
        // オートコンプリートを使用（app.jsのinitStepAutocomplete経由）
    },

    // AI判定（Phase 1: ルールベース）
    judge(changeText, hypotheses) {
        const result = {
            judgement: '○',
            short_comment: '',
            good_points: [],
            missing_points: [],
            improvement_example: ''
        };

        let score = 0;

        // 1. 気付いた変化の具体性
        if (changeText.length >= 30) {
            score += 20;
            result.good_points.push('変化が具体的に記載されています');
        } else {
            result.missing_points.push('気付いた変化をより具体的に記載しましょう');
        }

        // 2. 仮説の数
        if (hypotheses.length >= 3) {
            score += 20;
            result.good_points.push(`${hypotheses.length}つの仮説を立てています`);
        } else {
            result.missing_points.push('仮説は最低3つ必要です');
        }

        // 3. なぜの掘り下げ
        const deepHypotheses = hypotheses.filter(h => h.why2 && h.why2.trim().length > 0);
        if (deepHypotheses.length >= 2) {
            score += 20;
            result.good_points.push('「なぜ？」を深く掘り下げています');
        } else {
            result.missing_points.push('各仮説の「なぜ？」を2段階以上掘り下げましょう');
        }

        // 4. 支援計画の記載
        const withSupport = hypotheses.filter(h => h.support && h.support.trim().length > 10);
        if (withSupport.length >= 2) {
            score += 20;
            result.good_points.push('支援計画が具体的に記載されています');
        } else {
            result.missing_points.push('各仮説に対する支援計画を具体的に記載しましょう');
        }

        // 5. 優先順位の設定
        const hasPriority = hypotheses.some(h => h.priority && h.priority > 0);
        if (hasPriority) {
            score += 20;
            result.good_points.push('優先順位が設定されています');
        } else {
            result.missing_points.push('仮説に優先順位をつけましょう');
        }

        // 判定
        if (score >= 60) {
            result.judgement = '○';
            result.short_comment = '仮説思考が十分に展開されています！';
        } else {
            result.judgement = '×';
            result.short_comment = '仮説の深さや支援計画に改善の余地があります。';
            result.improvement_example = '例: 変化→「なぜ？（1段目）」→「なぜ？（2段目）」→「なぜ？（3段目＝根本原因）」→「根本原因に対する具体的支援」と掘り下げましょう';
        }

        return result;
    }
};

// 仮説カード追加
function addHypothesisCard() {
    if (hypothesisCount >= MAX_HYPOTHESES) return;

    hypothesisCount++;
    const num = hypothesisCount;

    const card = document.createElement('div');
    card.className = 'hypothesis-card';
    card.id = `hypothesis-${num}`;
    card.innerHTML = `
    <div class="hypothesis-card-header">
      <span class="hypothesis-number">仮説 ${num}</span>
      ${num > MIN_HYPOTHESES ? `<button type="button" class="remove-hypothesis-btn" onclick="removeHypothesisCard(${num})">✕</button>` : ''}
    </div>
    <div class="why-chain">
      <div class="why-step">
        <span class="why-label">なぜ？①</span>
        <input type="text" name="h${num}_why1" placeholder="仮説を記載" required>
      </div>
      <div class="why-step">
        <span class="why-label">なぜ？②</span>
        <input type="text" name="h${num}_why2" placeholder="さらに深く掘り下げる">
      </div>
      <div class="why-step">
        <span class="why-label">なぜ？③</span>
        <input type="text" name="h${num}_why3" placeholder="根本原因を探る">
      </div>
    </div>
    <div class="hypothesis-support">
      <label>原因に対する支援</label>
      <textarea name="h${num}_support" rows="2" placeholder="この原因に対して行う支援を記載"></textarea>
    </div>
    <div class="hypothesis-priority">
      <label>優先順位</label>
      <select name="h${num}_priority">
        <option value="">選択</option>
        ${[1, 2, 3, 4, 5].map(i => `<option value="${i}">${i}番</option>`).join('')}
      </select>
    </div>
  `;

    document.getElementById('step2-hypotheses-container').appendChild(card);

    // 最大数に達したらボタン非表示
    if (hypothesisCount >= MAX_HYPOTHESES) {
        document.getElementById('add-hypothesis-btn').style.display = 'none';
    }
}

// 仮説カード削除
function removeHypothesisCard(num) {
    const card = document.getElementById(`hypothesis-${num}`);
    if (card) card.remove();
    hypothesisCount--;
    document.getElementById('add-hypothesis-btn').style.display = '';
}

// STEP2送信
async function submitStep2(event) {
    event.preventDefault();

    const user = Auth.getUser();
    if (!user) return;

    const date = document.getElementById('step2-date').value;
    const change = document.getElementById('step2-change').value;
    const priorityReason = document.getElementById('step2-priority-reason').value;
    const expectedChange = document.getElementById('step2-expected-change').value;

    // 対象者はオートコンプリートで選択されたものを使用
    const target = getStepSelectedTarget('step2');
    if (!target) {
        showToast('対象者を選択してください');
        return;
    }

    const btn = document.getElementById('step2-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '判定中...'; }

    // 廃説データ収集
    const hypotheses = [];
    const cards = document.querySelectorAll('.hypothesis-card');
    cards.forEach((card) => {
        const id = card.id.split('-')[1];
        hypotheses.push({
            why1: card.querySelector(`[name="h${id}_why1"]`)?.value || '',
            why2: card.querySelector(`[name="h${id}_why2"]`)?.value || '',
            why3: card.querySelector(`[name="h${id}_why3"]`)?.value || '',
            support: card.querySelector(`[name="h${id}_support"]`)?.value || '',
            priority: parseInt(card.querySelector(`[name="h${id}_priority"]`)?.value) || 0
        });
    });

    // AI判定
    const aiResult = Step2.judge(change, hypotheses);

    // 結果画面を即座に表示
    showResult(aiResult);

    // Supabaseにバックグラウンド保存
    const cycle = DB.getCurrentCycle();
    API.saveStep2({
        staff_id: user.staff_id,
        target_id: target.id || null,
        target_name: target.name,
        year_month: cycle.yearMonth,
        date: date,
        change_noticed: change,
        hypotheses_json: hypotheses,
        priority_reason: priorityReason,
        expected_change: expectedChange,
        ai_judgement: aiResult.judgement,
        ai_comment: aiResult.short_comment
    }).then(() => showToast('記録を保存しました ✅'))
        .catch(e => { console.error(e); showToast('保存に失敗しました'); });

    // フォームリセット
    document.getElementById('step2-form').reset();
    document.getElementById('step2-date').value = new Date().toISOString().split('T')[0];
    if (btn) { btn.disabled = false; btn.textContent = '送信して判定を受ける'; }
}
