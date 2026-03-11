/* ============================================
   step4.js — STEP4 症例報告（6セクション）
   ============================================ */

const Step4 = {
    init() {
        this.checkPrerequisites();
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

    // 発表回数取得
    getPresentationCount(staffId) {
        const reports = DB.getAll('step4_reports', { staff_id: staffId });
        return reports.filter(r => r.presentation_date).length;
    }
};

// STEP4送信
function submitStep4(event) {
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

    // 必須チェック（最低限）
    if (!caseData.noticed_change || !caseData.result || !caseData.reflection) {
        showToast('Ⅲ気付いた変化・Ⅴ結果・Ⅵ考察は必須です📝');
        return;
    }

    const presentationNumber = Step4.getPresentationCount(user.staff_id) + 1;

    DB.save('step4_reports', {
        staff_id: user.staff_id,
        case_json: JSON.stringify(caseData),
        presentation_date: caseData.presentationDate,
        presentation_number: presentationNumber,
    });

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

