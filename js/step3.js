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
    },

    // 以前の記録をロードして表示する
    async loadPreviousReflection(targetId) {
        const historyArea = document.getElementById('step3-prev-history');
        const contentArea = document.getElementById('step3-prev-content');
        if (!historyArea || !contentArea) return;

        // 非表示にして初期化
        historyArea.style.display = 'none';
        contentArea.innerHTML = '読み込み中...';

        try {
            const user = Auth.getUser();
            if (!user) return;

            // 過去のSTEP3記録を取得
            const records = await API.getStep3Records(user.staff_id);
            // 同じ対象者の最新の記録を探す（現在の編集中のものは除く）
            const prev = records
                .filter(r => (r.target_id === targetId || r.target_name === targetId))
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            if (prev) {
                const d = prev.reflection_json || {};
                const dateStr = prev.date;
                
                contentArea.innerHTML = `
                    <div style="margin-bottom: 8px; font-weight: bold; border-bottom: 1px dashed #ffe8cc; padding-bottom: 4px;">
                        📅 前回提出日: ${dateStr}
                    </div>
                    <div style="display: grid; gap: 8px;">
                        <div><strong>● 気付き:</strong><br>${d.notice || '-'}</div>
                        <div><strong>● 支援内容:</strong><br>${d.support || '-'}</div>
                        <div><strong>● 判断:</strong> ${prev.decision === 'continue' ? '継続' : prev.decision === 'change' ? '変更' : '終了'}</div>
                    </div>
                    <div style="margin-top: 12px; display: flex; gap: 10px;">
                        <button type="button" class="btn-outline btn-sm" onclick="Step3.applyPrevious('${prev.id}')" style="font-size: 0.8rem; padding: 4px 10px;">
                            前回の内容をコピーする
                        </button>
                    </div>
                `;
                historyArea.style.display = 'block';
                // 前回のデータをキャッシュしておく
                this._lastFetchedPrevRecord = prev;
            }
        } catch (e) {
            console.error('Failed to load previous reflection:', e);
            contentArea.innerHTML = '過去の記録の取得に失敗しました';
        }
    },

    // 前回の内容をフォームに反映する
    applyPrevious(recordId) {
        const record = this._lastFetchedPrevRecord;
        if (!record) return;

        if (confirm('前回の「気付き」と「支援内容」をフォームにコピーしますか？\n（現在の入力内容は上書きされます）')) {
            const d = record.reflection_json || {};
            document.getElementById('step3-notice').value = d.notice || '';
            document.getElementById('step3-support').value = d.support || '';
            // 理由〜反応も必要ならコピー（今回は「内容継続」を想定し主要項目のみ）
            document.getElementById('step3-reason').value = d.reason || '';
            document.getElementById('step3-prediction').value = d.prediction || '';
            document.getElementById('step3-reaction').value = d.reaction || '';
            
            showToast('前回の内容をコピーしました ✅');
        }
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

    const notice = document.getElementById('step3-notice').value.trim();
    const support = document.getElementById('step3-support').value.trim();
    const reason = document.getElementById('step3-reason').value.trim();
    const prediction = document.getElementById('step3-prediction').value.trim();
    const reaction = document.getElementById('step3-reaction').value.trim();
    const decision = document.getElementById('step3-decision').value;
    const decisionReason = document.getElementById('step3-decision-reason').value.trim();

    // 必須チェック
    if (!date) { showToast('日付を入力してください'); return; }
    if (!notice) { showToast('①気付きを入力してください'); document.getElementById('step3-notice').focus(); return; }
    if (!support) { showToast('②支援内容を入力してください'); document.getElementById('step3-support').focus(); return; }
    if (!reason) { showToast('③理由を入力してください'); document.getElementById('step3-reason').focus(); return; }
    if (!prediction) { showToast('④予測を入力してください'); document.getElementById('step3-prediction').focus(); return; }
    if (!reaction) { showToast('⑤反応を入力してください'); document.getElementById('step3-reaction').focus(); return; }
    if (!decision) { showToast('⑥判断を選択してください'); document.getElementById('step3-decision').focus(); return; }
    if (!decisionReason) { showToast('⑥判断の理由を入力してください'); document.getElementById('step3-decision-reason').focus(); return; }

    const reflectionData = {
        notice, support, reason, prediction, reaction, decision, decisionReason
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
        // スキーマの制限により、AIの詳細結果は reflection_json 内に含める
        reflection_json: {
            ...reflectionData,
            ai_details: {
                good_points: aiResult.good_points,
                missing: aiResult.missing_points,
                improve: aiResult.improvement_example
            }
        },
        decision: reflectionData.decision,
        ai_judgement: aiResult.judgement,
        ai_comment: aiResult.short_comment
    };

    let isSuccess = false;
    try {
        if (editingId) {
            const updated = await API.updateStep3(editingId, payload);
            isSuccess = !!updated;
            window.editingRecord = null;
        } else {
            isSuccess = await API.saveStep3(payload);
        }
    } catch (e) {
        console.error('Save STEP3 failed:', e);
        showToast('保存に失敗しました: ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = editingId ? '修正して再提出する' : '送信して判定を受ける'; }
        return;
    }

    if (btn) { btn.disabled = false; btn.textContent = '送信して判定を受ける'; }

    if (isSuccess) {
        showToast(editingId ? '記録を更新しました ✅' : '記録の提出が完了しました ✅');
        if (!editingId) {
            document.getElementById('step3-form').reset();
            document.getElementById('step3-date').value = new Date().toISOString().split('T')[0];
            // 判定結果画面を表示
            showResult({
                ...aiResult,
                step: 3
            });
        } else {
            navigateTo('screen-home');
        }
    } else {
        showToast('保存に失敗しました。');
    }
}
