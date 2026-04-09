/* ============================================
   step4.js — STEP4 症例報告（6セクション）
   ============================================ */

const Step4 = {
    init() {
        this.checkPrerequisites();

        // 編集モードチェック
        if (window.editingRecord && window.editingRecord.step === 4) {
            this.enterEditMode(window.editingRecord);
            window.editingRecord = null; // 処理したらクリア
        }
    },

    // 実施条件チェック（全動画＋テスト合格）
    checkPrerequisites() {
        // ⚠️ 一時的に条件チェックをスキップ（確認用）
        const prerequisiteEl = document.getElementById('step4-prerequisite');
        const formEl = document.getElementById('step4-form');
        if (prerequisiteEl) prerequisiteEl.hidden = true;
        if (formEl) formEl.hidden = false;
        return true;
    },

    // 編集モード起動
    enterEditMode(record) {
        let d = {};
        try {
            d = typeof record.case_json === 'string' ? JSON.parse(record.case_json) : (record.case_json || {});
        } catch(e) { console.error('Parse case_json failed:', e); }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };
        
        setVal('step4-other-services', d.other_services);
        setVal('step4-life-background', d.life_background);
        setVal('step4-physical-status', d.physical_status);
        setVal('step4-service-reason', d.service_reason);
        setVal('step4-goal', d.goal);
        setVal('step4-noticed-change', record.noticed_change || d.noticed_change);
        setVal('step4-cause-support', d.cause_support);
        setVal('step4-evidence', d.evidence);
        setVal('step4-expected-change', d.expected_change);
        setVal('step4-intervention', d.intervention);
        setVal('step4-collaboration', d.collaboration);
        setVal('step4-result', record.result || d.result);
        setVal('step4-reflection', record.reflection || d.reflection);

        // 対象者セット
        if (typeof setStepSelectedTarget === 'function') {
            setStepSelectedTarget('step4', { id: record.target_id, name: record.target_name });
        }

        const submitBtn = document.getElementById('step4-submit-btn');
        if (submitBtn) submitBtn.textContent = '修正して再投稿する';
        
        showToast('修正モード：内容を変更してください');
    },

    // 発表回数取得
    getPresentationCount(staffId) {
        const reports = DB.getAll('step4_reports', { staff_id: staffId });
        return reports.filter(r => r.presentation_date).length;
    }
};

// STEP4送信
async function submitStep4(event) {
    event.preventDefault();

    const user = Auth.getUser();
    if (!user) return;

    const getValue = id => document.getElementById(id)?.value?.trim() || '';

    const caseData = {
        // Ⅰ. 基本情報
        other_services: getValue('step4-other-services'),
        // Ⅱ. 支援前の状況
        life_background: getValue('step4-life-background'),
        physical_status: getValue('step4-physical-status'),
        service_reason: getValue('step4-service-reason'),
        goal: getValue('step4-goal'),
        // Ⅲ. 介入の仮説と目的
        noticed_change: getValue('step4-noticed-change'),
        cause_support: getValue('step4-cause-support'),
        evidence: getValue('step4-evidence'),
        expected_change: getValue('step4-expected-change'),
        // Ⅳ. 実施内容
        intervention: getValue('step4-intervention'),
        collaboration: getValue('step4-collaboration'),
        // Ⅴ. 結果・変化
        result: getValue('step4-result'),
        // Ⅵ. 考察
        reflection: getValue('step4-reflection')
    };

    // 編集中のレコードID取得
    const editingId = (window.editingRecord && window.editingRecord.step === 4) ? window.editingRecord.id : null;

    const btn = document.getElementById('step4-submit-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = editingId ? '更新中...' : '保存中...';
    }

    const target = getStepSelectedTarget('step4');
    if (!target) {
        showToast('対象者を選択してください');
        if (btn) { btn.disabled = false; btn.textContent = editingId ? '修正して再投稿する' : '📋 症例報告書を保存する'; }
        return;
    }

    // 必須チェック（最低限）
    if (!caseData.noticed_change) { showToast('Ⅲ．気付いた変化を入力してください'); document.getElementById('step4-noticed-change').focus(); if (btn) { btn.disabled = false; btn.textContent = editingId ? '修正して再投稿する' : '📋 症例報告書を保存する'; } return; }
    if (!caseData.result) { showToast('Ⅴ．結果・変化を入力してください'); document.getElementById('step4-result').focus(); if (btn) { btn.disabled = false; btn.textContent = editingId ? '修正して再投稿する' : '📋 症例報告書を保存する'; } return; }
    if (!caseData.reflection) { showToast('Ⅵ．考察を入力してください'); document.getElementById('step4-reflection').focus(); if (btn) { btn.disabled = false; btn.textContent = editingId ? '修正して再投稿する' : '📋 症例報告書を保存する'; } return; }

    const presentationNumber = Step4.getPresentationCount(user.staff_id) + 1;

    try {
        if (editingId) {
            await API.updateStep4(editingId, {
                target_id: getStepSelectedTarget('step4')?.id || null,
                target_name: getStepSelectedTarget('step4')?.name || '',
                noticed_change: caseData.noticed_change,
                result: caseData.result,
                reflection: caseData.reflection,
                case_json: JSON.stringify(caseData)
            });
            showToast('症例報告を更新しました ✅');
            window.editingRecord = null;
        } else {
            await API.saveStep4({
                staff_id: user.staff_id,
                target_id: getStepSelectedTarget('step4')?.id || null,
                target_name: getStepSelectedTarget('step4')?.name || '',
                noticed_change: caseData.noticed_change,
                result: caseData.result,
                reflection: caseData.reflection,
                case_json: JSON.stringify(caseData),
                presentation_number: presentationNumber
            });
            showToast('症例報告を保存しました ✅');
        }
    } catch (e) {
        console.error('Save STEP4 failed:', e);
        showToast('保存に失敗しました');
        if (btn) { btn.disabled = false; btn.textContent = editingId ? '修正して再投稿する' : '📋 症例報告書を保存する'; }
        return;
    }

    if (btn) { btn.disabled = false; btn.textContent = '📋 症例報告書を保存する'; }

    // 保存成功メッセージ
    const resultArea = document.getElementById('step4-result-area');
    if (resultArea) {
        resultArea.hidden = false;
        resultArea.innerHTML = `
            <div class="result-card result-pass" style="margin-top: var(--space-lg);">
                <div class="result-judgment">📋</div>
                <div class="result-comment">
                    <p><strong>症例報告書を保存しました！</strong></p>
                    <p>第${presentationNumber}回目の発表記録として記録されました。</p>
                    ${presentationNumber >= 2
                ? '<p style="color: var(--success); font-weight:700;">🎉 2回の発表が完了しました！プログラム修了です！</p>'
                : '<p>あと1回の発表でフリーケアプログラム修了です！</p>'
            }
                </div>
            </div>`;
        resultArea.scrollIntoView({ behavior: 'smooth' });
    }
    showToast(`症例報告書（第${presentationNumber}回）を保存しました ✅`);
}

