/* ============================================
   step1.js — STEP1 気付き入力 + AI◯☓判定
   ============================================ */

const Step1 = {
    // 画面初期化
    init() {
        const dateInput = document.getElementById('step1-date');
        dateInput.value = new Date().toISOString().split('T')[0];

        // 対象者セレクトボックス
        this.populateTargets();

        // 提出期限チェックのセットアップ
        this.setupDateValidation();

        // 編集モードチェック
        if (window.editingRecord && window.editingRecord.step === 1) {
            this.enterEditMode(window.editingRecord);
            window.editingRecord = null; // 処理したらクリア
        }

        // カリキュラム描画
        if (typeof renderCurriculum === 'function') {
            renderCurriculum(1);
        }
    },

    setupDateValidation() {
        const dateInput = document.getElementById('step1-date');
        const submitBtn = document.getElementById('step1-submit-btn');
        
        const checkDeadline = () => {
            if (!dateInput.value) return;
            const cycle = DB.getCurrentCycle(new Date(), dateInput.value);
            const monthEl = document.getElementById('step1-month');
            if (monthEl) monthEl.textContent = `${cycle.yearMonth} サイクル`;

            if (cycle.isPastDeadline) {
                submitBtn.disabled = true;
                submitBtn.textContent = '提出期限を過ぎています';
                submitBtn.style.opacity = '0.5';
            } else {
                submitBtn.disabled = false;
                submitBtn.textContent = '送信して判定を受ける';
                submitBtn.style.opacity = '1';
            }
        };

        dateInput.addEventListener('change', checkDeadline);
        checkDeadline(); // 初期実行
    },

    populateTargets() {
        // Step1はオートコンプリートを使用（app.jsのgetTargetList経由）
        // セレクトボックスは使用しない
    },


    // AI判定（Phase 1: ルールの削除 - プロンプトに集約）
    judge(noticeText) {
        return { judgement: '○', short_comment: '送信中...' };
    },

    // 編集モード起動
    enterEditMode(record) {
        document.getElementById('step1-date').value = record.date;
        document.getElementById('step1-notice').value = record.notice_text;
        document.getElementById('step1-char-count').textContent = record.notice_text.length;
        
        // 対象者セット
        if (typeof setStepSelectedTarget === 'function') {
            setStepSelectedTarget('step1', { id: record.target_id, name: record.target_name });
        }
        
        const submitBtn = document.getElementById('step1-submit-btn');
        if (submitBtn) submitBtn.textContent = '修正して再提出する';
        
        showToast('編集モード：内容を修正してください');
    }
};

// フォーム送信
async function submitStep1(event) {
    event.preventDefault();

    const user = Auth.getUser();
    if (!user) return;

    const date = document.getElementById('step1-date').value;
    const notice = document.getElementById('step1-notice').value;

    const target = getStepSelectedTarget('step1');
    if (!target) {
        showToast('対象者を選択してください');
        return;
    }

    const editingId = window.editingRecord?.step === 1 ? window.editingRecord.id : null;

    const btn = document.getElementById('step1-submit-btn');
    btn.disabled = true;
    btn.textContent = '送信中...';

    // Gemini AI判定
    const judgeData = {
        target_name: target.name,
        date: date,
        notice_text: notice
    };

    let aiResult;
    try {
        aiResult = await API.judgeStep1(judgeData);
    } catch (e) {
        btn.disabled = false;
        btn.textContent = editingId ? '修正して再提出する' : '送信して判定を受ける';
        showToast('エラー: ' + e.message);
        return; 
    }

    const cycle = DB.getCurrentCycle(new Date(), date);
    if (cycle.isPastDeadline && !editingId) {
        showToast('提出期限を過ぎているため保存できません。');
        btn.disabled = false;
        btn.textContent = '送信して判定を受ける';
        return;
    }

    const payload = {
        staff_id: user.staff_id,
        target_id: target.id || null,
        target_name: target.name,
        year_month: cycle.yearMonth,
        date: date,
        notice_text: notice,
        char_count: notice.length,
        ai_judgement: aiResult.judgement,
        ai_comment: aiResult.short_comment,
        ai_good_points: aiResult.good_points,
        ai_missing: aiResult.missing_points,
        ai_improve: aiResult.improvement_example
    };

    let isSuccess = false;
    if (editingId) {
        const updated = await API.updateStep1(editingId, payload);
        isSuccess = !!updated;
        window.editingRecord = null;
    } else {
        isSuccess = await API.saveStep1(payload);
    }

    btn.disabled = false;
    btn.textContent = '送信して判定を受ける';

    if (isSuccess) {
        showToast(editingId ? '記録を更新しました ✅' : '記録の提出が完了しました ✅');
        
        // リザルト画面をスキップしてホームへ
        if (!editingId) {
            document.getElementById('step1-form').reset();
            document.getElementById('step1-char-count').textContent = '0';
        }
        navigateTo('screen-home');
    } else {
        showToast('保存に失敗しました。');
    }
}

// ◯☓結果画面表示
function showResult(result) {
    // AIのハルシネーション対策: 不足点があるのに○判定なら強制的に×にする
    if (result.missing_points && result.missing_points.length > 0) {
        result.judgement = '×';
    }

    const circle = document.getElementById('result-circle');
    const isCorrect = result.judgement === '○';

    circle.textContent = result.judgement;
    circle.className = 'result-circle ' + (isCorrect ? 'is-correct' : 'is-incorrect');

    document.getElementById('result-comment').textContent = result.short_comment;

    // Good points
    const goodSection = document.getElementById('result-good');
    const goodList = document.getElementById('result-good-list');
    goodList.innerHTML = '';
    if (result.good_points.length > 0) {
        goodSection.hidden = false;
        result.good_points.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            goodList.appendChild(li);
        });
    } else {
        goodSection.hidden = true;
    }

    // Missing points
    const missingSection = document.getElementById('result-missing');
    const missingList = document.getElementById('result-missing-list');
    missingList.innerHTML = '';
    missingSection.hidden = false;
    if (result.missing_points && result.missing_points.length > 0) {
        result.missing_points.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            missingList.appendChild(li);
        });
    } else if (!isCorrect) {
        const li = document.createElement('li');
        li.textContent = '現状の文章では具体的な状況が読み取れませんでした。';
        missingList.appendChild(li);
    } else {
        missingSection.hidden = true; // ○の場合は隠す
    }

    // Improvement example
    const improveSection = document.getElementById('result-improve');
    const improveText = document.getElementById('result-improve-text');
    if (!isCorrect) {
        improveSection.hidden = false;
        improveText.innerHTML = result.improvement_example ? result.improvement_example.replace(/\n/g, '<br>') : '（情報が十分でないため改善例を作成できませんでした。「いつ」「どこで」「誰が」「何を」もう少し足して再提出してみましょう）';
    } else {
        improveSection.hidden = true; // ○の場合は隠す
    }

    // Applied Knowledge
    const knowledgeSection = document.getElementById('result-knowledge');
    const knowledgeText = document.getElementById('result-knowledge-text');
    if (knowledgeSection && knowledgeText) {
        if (result.applied_knowledge && result.applied_knowledge.trim() !== "") {
            knowledgeSection.hidden = false;
            knowledgeText.textContent = result.applied_knowledge;
        } else {
            knowledgeSection.hidden = true;
        }
    }

    // Breakdown Visualization
    const breakdownSection = document.getElementById('result-breakdown');
    const breakdownList = document.getElementById('result-breakdown-list');
    if (breakdownSection && breakdownList && result.breakdown) {
        breakdownSection.hidden = false;
        const labels = {
            change_clarity: { name: '気づいた変化の明確さ', max: 15 },
            multi_factor: { name: '要因の多層的分析', max: 20 },
            priority: { name: '要因の関連性と優先順位', max: 15 },
            verification: { name: '検証計画の論理性', max: 15 },
            support_plan: { name: '支援計画の実効性', max: 20 },
            reflection: { name: '振り返り・修正力', max: 15 }
        };

        breakdownList.innerHTML = Object.entries(labels).map(([key, info]) => {
            const score = result.breakdown[key] || 0;
            const pct = (score / info.max) * 100;
            return `
                <div class="breakdown-item">
                    <div class="breakdown-header">
                        <span class="breakdown-label">${info.name}</span>
                        <span class="breakdown-score">${score} / ${info.max}</span>
                    </div>
                    <div class="breakdown-bar-bg">
                        <div class="breakdown-bar-fill" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    } else if (breakdownSection) {
        breakdownSection.hidden = true;
    }

    navigateTo('screen-result');
}
