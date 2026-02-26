/* ============================================
   step3.js — STEP3 振り返り入力 + AIフィードバック
   ============================================ */

const Step3 = {
    init() {
        const dateInput = document.getElementById('step3-date');
        dateInput.value = new Date().toISOString().split('T')[0];
        this.populateTargets();
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

    const btn = document.getElementById('step3-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '判定中...'; }

    const reflectionData = {
        notice: document.getElementById('step3-notice').value,
        support: document.getElementById('step3-support').value,
        reason: document.getElementById('step3-reason').value,
        prediction: document.getElementById('step3-prediction').value,
        reaction: document.getElementById('step3-reaction').value,
        decision: document.getElementById('step3-decision').value,
        decisionReason: document.getElementById('step3-decision-reason').value
    };

    // AI判定
    const aiResult = Step3.judge(reflectionData);

    // Supabaseに保存
    const cycle = DB.getCurrentCycle();
    await API.saveStep3({
        staff_id: user.staff_id,
        target_id: target.id || null,
        target_name: target.name,
        year_month: cycle.yearMonth,
        date: document.getElementById('step3-date').value,
        reflection_json: reflectionData,
        decision: reflectionData.decision,
        ai_judgement: aiResult.judgement,
        ai_comment: aiResult.short_comment
    });

    // 結果画面
    showResult(aiResult);

    // フォームリセット
    document.getElementById('step3-form').reset();
    document.getElementById('step3-date').value = new Date().toISOString().split('T')[0];
    if (btn) { btn.disabled = false; btn.textContent = '送信して判定を受ける'; }
}
