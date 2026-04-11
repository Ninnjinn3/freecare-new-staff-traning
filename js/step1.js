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
        
        if (!editingId) {
            document.getElementById('step1-form').reset();
            document.getElementById('step1-char-count').textContent = '0';
            // 判定結果画面を表示
            showResult({
                ...aiResult,
                step: 1
            });
        } else {
            navigateTo('screen-home');
        }
    } else {
        showToast('保存に失敗しました。');
    }
}

