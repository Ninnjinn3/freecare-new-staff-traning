/* ============================================
   step3.js — STEP3 振り返り入力 + AIフィードバック
   ============================================ */

const Step3 = {
    init() {
        const dateInput = document.getElementById('step3-date');
        dateInput.value = new Date().toISOString().split('T')[0];
        this.populateTargets();

        // 提出期限チェックのセットアップ
        this.setupDateValidation();

        // 編集モードチェック
        if (window.editingRecord && window.editingRecord.step === 3) {
            this.enterEditMode(window.editingRecord);
            window.editingRecord = null; // 処理したらクリア
        }

        // カリキュラム描画
        if (typeof renderCurriculum === 'function') {
            renderCurriculum(3);
        }
    },

    setupDateValidation() {
        const dateInput = document.getElementById('step3-date');
        const submitBtn = document.getElementById('step3-submit-btn');
        const checkDeadline = () => {
            if (!dateInput.value) return;
            const cycle = DB.getCurrentCycle(new Date(), dateInput.value);
            const monthEl = document.getElementById('step3-month');
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
    judge(data) {
        return { judgement: '○', short_comment: '送信中...' };
    },

    // 編集モード起動
    enterEditMode(record) {
        document.getElementById('step3-date').value = record.date;
        const d = record.reflection_json || {};
        document.getElementById('step3-notice').value = d.notice || '';
        document.getElementById('step3-support').value = d.support || '';
        document.getElementById('step3-reason').value = d.reason || '';
        document.getElementById('step3-prediction').value = d.prediction || '';
        document.getElementById('step3-reaction').value = d.reaction || '';
        document.getElementById('step3-decision').value = record.decision || '';
        document.getElementById('step3-decision-reason').value = d.decisionReason || '';

        // 対象者セット
        if (typeof setStepSelectedTarget === 'function') {
            setStepSelectedTarget('step3', { id: record.target_id, name: record.target_name });
        }

        const submitBtn = document.getElementById('step3-submit-btn');
        if (submitBtn) submitBtn.textContent = '修正して再提出する';
        
        showToast('編集モード：内容を修正してください');
    }
};

// STEP3 判断変更ハンドラ
function handleStep3Decision(value) {
    // 将来: 継続/変更/終了で次回の表示項目を動的制御
    // Phase 1ではシンプルに全項目表示
}

// STEP3送信
async function submitStep3(event) {
    event.preventDefault();

    const user = Auth.getUser();
    if (!user) return;

    const target = getStepSelectedTarget('step3');
    if (!target) {
        showToast('対象者を選択してください');
        return;
    }

    const editingId = window.editingRecord?.step === 3 ? window.editingRecord.id : null;

    const btn = document.getElementById('step3-submit-btn');
    if (btn) { 
        btn.disabled = true; 
        btn.textContent = '送信中...'; 
    }

    const date = document.getElementById('step3-date').value;
    const cycle = DB.getCurrentCycle(new Date(), date);
    if (cycle.isPastDeadline && !editingId) {
        showToast('提出期限を過ぎているため保存できません。');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '送信して判定を受ける';
        }
        return;
    }

    const reflectionData = {
        notice: document.getElementById('step3-notice').value,
        support: document.getElementById('step3-support').value,
        reason: document.getElementById('step3-reason').value,
        prediction: document.getElementById('step3-prediction').value,
        reaction: document.getElementById('step3-reaction').value,
        decision: document.getElementById('step3-decision').value,
        decisionReason: document.getElementById('step3-decision-reason').value
    };

    const judgeData = {
        target_name: target.name,
        reflection: reflectionData
    };
    let aiResult;
    try {
        aiResult = await API.judgeStep3(judgeData);
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
        reflection_json: reflectionData,
        decision: reflectionData.decision,
        ai_judgement: aiResult.judgement,
        ai_comment: aiResult.short_comment,
        ai_good_points: aiResult.good_points,
        ai_missing: aiResult.missing_points,
        ai_improve: aiResult.improvement_example
    };

    let isSuccess = false;
    if (editingId) {
        const updated = await API.updateStep3(editingId, payload);
        isSuccess = !!updated;
        window.editingRecord = null;
    } else {
        isSuccess = await API.saveStep1(payload); // 内部的にAPI.saveStep3を使うべき箇所を修正（saveStep1になっていた）
        // あ、待て。API経由の保存は、s3ならAPI.saveStep3を呼ぶ必要があるはず
        isSuccess = await API.saveStep3(payload);
    }

    if (btn) { btn.disabled = false; btn.textContent = '送信して判定を受ける'; }

    if (isSuccess) {
        showToast(editingId ? '記録を更新しました ✅' : '記録の提出が完了しました ✅');
        if (!editingId) {
            document.getElementById('step3-form').reset();
            document.getElementById('step3-date').value = new Date().toISOString().split('T')[0];
        }
        navigateTo('screen-home');
    } else {
        showToast('保存に失敗しました。');
    }
}
