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

        // 提出期限チェックのセットアップ
        this.setupDateValidation();

        // 仮説カードを3つ初期表示
        hypothesisCount = 0;
        document.getElementById('step2-hypotheses-container').innerHTML = '';
        
        // 編集モードチェック
        if (window.editingRecord && window.editingRecord.step === 2) {
            this.enterEditMode(window.editingRecord);
            window.editingRecord = null; // 処理したらクリア
        } else {
            for (let i = 0; i < MIN_HYPOTHESES; i++) {
                addHypothesisCard();
            }
        }

        // カリキュラム描画
        if (typeof renderCurriculum === 'function') {
            renderCurriculum(2);
        }
    },

    setupDateValidation() {
        const dateInput = document.getElementById('step2-date');
        const submitBtn = document.getElementById('step2-submit-btn');
        const checkDeadline = () => {
            if (!dateInput.value) return;
            const cycle = DB.getCurrentCycle(new Date(), dateInput.value);
            const monthEl = document.getElementById('step2-month');
            if (monthEl) monthEl.textContent = `${cycle.yearMonth} サイクル`;

            if (cycle.isPastDeadline) {
                if(submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '提出期限を過ぎています';
                    submitBtn.style.opacity = '0.5';
                }
            } else {
                if(submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = '送信して判定を受ける';
                    submitBtn.style.opacity = '1';
                }
            }
        };
        dateInput.addEventListener('change', checkDeadline);
        checkDeadline(); // 初期実行
    },

    populateTargets() {
        // オートコンプリートを使用（app.jsのinitStepAutocomplete経由）
    },

    // AI判定（Phase 1: ルールの削除 - プロンプトに集約）
    judge(changeText, hypotheses) {
        return { judgement: '○', short_comment: '送信中...' };
    },

    // 編集モード起動
    enterEditMode(record) {
        document.getElementById('step2-date').value = record.date;
        document.getElementById('step2-change').value = record.change_noticed;
        document.getElementById('step2-priority-reason').value = record.priority_reason;
        document.getElementById('step2-expected-change').value = record.expected_change;

        // 既存のカードをクリア
        hypothesisCount = 0;
        document.getElementById('step2-hypotheses-container').innerHTML = '';

        // カードを追加して値をセット
        if (record.hypotheses_json && Array.isArray(record.hypotheses_json)) {
            record.hypotheses_json.forEach((h, i) => {
                addHypothesisCard();
                const num = i + 1;
                const card = document.getElementById(`hypothesis-${num}`);
                if (card) {
                    const hypothesis = card.querySelector(`[name="h${num}_hypo"]`);
                    const why1 = card.querySelector(`[name="h${num}_why1"]`);
                    const why2 = card.querySelector(`[name="h${num}_why2"]`);
                    const why3 = card.querySelector(`[name="h${num}_why3"]`);
                    const support = card.querySelector(`[name="h${num}_support"]`);
                    const priority = card.querySelector(`[name="h${num}_priority"]`);
                    
                    if (hypothesis) hypothesis.value = h.hypo || '';
                    if (why1) why1.value = h.why1 || '';
                    if (why2) why2.value = h.why2 || '';
                    if (why3) why3.value = h.why3 || '';
                    if (support) support.value = h.support || '';
                    if (priority) priority.value = h.priority || '';
                }
            });
        }
        
        // 対象者セット
        if (typeof setStepSelectedTarget === 'function') {
            setStepSelectedTarget('step2', { id: record.target_id, name: record.target_name });
        }

        const submitBtn = document.getElementById('step2-submit-btn');
        if (submitBtn) submitBtn.textContent = '修正して再提出する';
        
        showToast('編集モード：内容を修正してください');
    },

    // 優先順位の重複制御（最新を優先して既存を繰り下げる）
    handlePriorityChange(id, newValue) {
        if (!newValue) return;
        const newPriority = parseInt(newValue);
        const cards = document.querySelectorAll('.hypothesis-card');
        
        cards.forEach(card => {
            const otherId = card.id.split('-')[1];
            if (otherId == id) return;
            
            const otherSelect = card.querySelector(`[name="h${otherId}_priority"]`);
            if (parseInt(otherSelect.value) === newPriority) {
                this.shiftPriorityDown(otherId, newPriority + 1);
            }
        });
    },

    shiftPriorityDown(id, nextValue) {
        const select = document.querySelector(`[name="h${id}_priority"]`);
        if (!select) return;

        // 連鎖的に被りがないかチェック
        const cards = document.querySelectorAll('.hypothesis-card');
        cards.forEach(card => {
            const otherId = card.id.split('-')[1];
            if (otherId == id) return;
            const otherSelect = card.querySelector(`[name="h${otherId}_priority"]`);
            if (parseInt(otherSelect.value) === nextValue) {
                this.shiftPriorityDown(otherId, nextValue + 1);
            }
        });

        if (nextValue > 5) {
            select.value = "";
        } else {
            select.value = nextValue.toString();
        }
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
        <span class="why-label" style="background:#6c5ce7; color:white;">仮説</span>
        <input type="text" name="h${num}_hypo" placeholder="仮説を記載" required>
      </div>
      <div class="why-step">
        <span class="why-label">なぜ？①</span>
        <input type="text" name="h${num}_why1" placeholder="なぜそう考えたか（背景）">
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
      <select name="h${num}_priority" onchange="Step2.handlePriorityChange(${num}, this.value)">
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

    const target = getStepSelectedTarget('step2');
    if (!target) {
        showToast('対象者を選択してください');
        return;
    }

    const editingId = window.editingRecord?.step === 2 ? window.editingRecord.id : null;

    const btn = document.getElementById('step2-submit-btn');
    if (btn) { 
        btn.disabled = true; 
        btn.textContent = '送信中...'; 
    }

    const cycle = DB.getCurrentCycle(new Date(), date);
    if (cycle.isPastDeadline && !editingId) {
        showToast('提出期限を過ぎているため保存できません。');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '送信して判定を受ける';
        }
        return;
    }

    const hypotheses = [];
    const cards = document.querySelectorAll('.hypothesis-card');
    cards.forEach((card) => {
        const id = card.id.split('-')[1];
        hypotheses.push({
            hypo: card.querySelector(`[name="h${id}_hypo"]`)?.value || '',
            why1: card.querySelector(`[name="h${id}_why1"]`)?.value || '',
            why2: card.querySelector(`[name="h${id}_why2"]`)?.value || '',
            why3: card.querySelector(`[name="h${id}_why3"]`)?.value || '',
            support: card.querySelector(`[name="h${id}_support"]`)?.value || '',
            priority: parseInt(card.querySelector(`[name="h${id}_priority"]`)?.value) || 0
        });
    });

    const judgeData = {
        target_name: target.name,
        change_noticed: change,
        hypotheses: hypotheses,
        priority_reason: priorityReason,
        expected_change: expectedChange
    };
    let aiResult;
    try {
        aiResult = await API.judgeStep2(judgeData);
    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = editingId ? '修正して再提出する' : '送信して判定を受ける'; }
        showToast('エラー: ' + e.message);
        return;
    }

    const payload = {
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
        ai_comment: aiResult.short_comment,
        ai_good_points: aiResult.good_points,
        ai_missing: aiResult.missing_points,
        ai_improve: aiResult.improvement_example
    };

    let isSuccess = false;
    if (editingId) {
        const updated = await API.updateStep2(editingId, payload);
        isSuccess = !!updated;
        window.editingRecord = null;
    } else {
        isSuccess = await API.saveStep2(payload);
    }

    if (btn) { btn.disabled = false; btn.textContent = '送信して判定を受ける'; }

    if (isSuccess) {
        showToast(editingId ? '記録を更新しました ✅' : '記録の提出が完了しました ✅');
        if (!editingId) {
            document.getElementById('step2-form').reset();
            document.getElementById('step2-date').value = new Date().toISOString().split('T')[0];
        }
        navigateTo('screen-home');
    } else {
        showToast('保存に失敗しました。');
    }
}
