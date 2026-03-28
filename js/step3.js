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

    // AI判定（Phase 1: ルールベース）
    judge(data) {
        const result = {
            judgement: '○',
            short_comment: '',
            good_points: [],
            missing_points: [],
            improvement_example: ''
        };

        let score = 0;

        // 1. 気付きの具体性
        if (data.notice && data.notice.length >= 20) {
            score += 15;
            result.good_points.push('気付きが具体的に記載されています');
        } else {
            result.missing_points.push('気付きをより具体的に記載しましょう');
        }

        // 2. 支援内容の具体性
        if (data.support && data.support.length >= 20) {
            score += 20;
            result.good_points.push('支援内容が具体的です');
        } else {
            result.missing_points.push('支援内容を詳しく記載しましょう');
        }

        // 3. 理由の論理性
        if (data.reason && data.reason.length >= 15) {
            score += 15;
            result.good_points.push('支援の理由が明確です');
        } else {
            result.missing_points.push('なぜその支援を行ったのか、理由を明確にしましょう');
        }

        // 4. 予測の記載
        if (data.prediction && data.prediction.length >= 15) {
            score += 15;
            result.good_points.push('変化の予測が記載されています');
        } else {
            result.missing_points.push('支援後にどのような変化を予測するか記載しましょう');
        }

        // 5. 反応の記録
        if (data.reaction && data.reaction.length >= 15) {
            score += 20;
            result.good_points.push('本人の反応が記録されています');
        } else {
            result.missing_points.push('支援後の本人の反応を具体的に記録しましょう');
        }

        // 6. 判断と理由
        if (data.decision && data.decisionReason && data.decisionReason.length >= 10) {
            score += 15;
            result.good_points.push('継続/変更/終了の判断と理由が明確です');
        } else {
            result.missing_points.push('判断の理由を具体的に記載しましょう');
        }

        if (score >= 60) {
            result.judgement = '○';
            result.short_comment = '振り返りが適切にできています。支援の質が向上していきますね！';
        } else {
            result.judgement = '×';
            result.short_comment = '振り返りに不足している要素があります。各項目をより詳細に記載しましょう。';
            result.improvement_example = '具体的なエピソード→行った支援→その理由→予測→実際の反応→次のアクション、という流れで振り返りましょう';
        }

        return result;
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
        if (submitBtn) submitBtn.textContent = '修正して再判定を受ける';
        
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

    // 編集中のレコードID取得
    const editingId = window.editingRecord?.step === 3 ? window.editingRecord.id : null;

    const btn = document.getElementById('step3-submit-btn');
    if (btn) { 
        btn.disabled = true; 
        btn.textContent = editingId ? '更新中...' : 'AI判定中...'; 
    }

    // 期限チェック
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

    // Gemini AI判定
    const judgeData = {
        target_name: target.name,
        reflection: reflectionData
    };
    let aiResult;
    try {
        aiResult = await API.judgeStep3(judgeData);
    } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = '送信して判定を受ける'; }
        showToast('エラー: ' + e.message);
        return;
    }

    // 結果画面を表示
    showResult(aiResult);
    if (btn) { btn.disabled = false; btn.textContent = '送信して判定を受ける'; }

    // 保存用データ準備
    const payload = {
        staff_id: user.staff_id,
        target_id: target.id || null,
        target_name: target.name,
        year_month: cycle.yearMonth,
        date: date,
        reflection_json: reflectionData,
        decision: reflectionData.decision,
        ai_judgement: aiResult.judgement,
        ai_comment: aiResult.short_comment
    };

    let savePromise;
    if (editingId) {
        savePromise = API.updateStep3(editingId, payload).then(() => {
            showToast('記録を更新しました ✅');
            window.editingRecord = null; // 編集完了
        });
    } else {
        savePromise = API.saveStep3(payload).then(() => showToast('記録を保存しました ✅'));
    }

    savePromise.catch(e => { console.error(e); showToast('保存に失敗しました'); });

    // フォームリセットは合格時のみ
    if (aiResult.judgement === '○') {
        document.getElementById('step3-form').reset();
        document.getElementById('step3-date').value = new Date().toISOString().split('T')[0];
    }
}
