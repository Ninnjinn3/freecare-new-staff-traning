/* ============================================
   step4.js — STEP4 症例報告
   ============================================ */

const Step4 = {
    init() {
        this.checkPrerequisites();
    },

    // 実施条件チェック（全動画＋テスト＋総合テスト合格）
    checkPrerequisites() {
        const user = Auth.getUser();
        if (!user) return false;

        const videos = DB.getAll('video_tasks', { staff_id: user.staff_id });
        const allPassed = videos.every(v => v.is_passed);

        const prerequisiteEl = document.getElementById('step4-prerequisite');
        const formEl = document.getElementById('step4-form');

        if (!allPassed) {
            if (prerequisiteEl) prerequisiteEl.hidden = false;
            if (formEl) formEl.hidden = true;
            return false;
        }

        if (prerequisiteEl) prerequisiteEl.hidden = true;
        if (formEl) formEl.hidden = false;
        return true;
    },

    // AI判定（Phase 1: ルールベース）
    judge(caseData) {
        const result = {
            judgement: '○',
            score: 0,
            short_comment: '',
            good_points: [],
            missing_points: [],
            improvement_example: ''
        };

        let score = 0;

        // 一貫性チェック
        if (caseData.summary && caseData.summary.length >= 100) {
            score += 40;
            result.good_points.push('症例の記載が十分な分量です');
        } else {
            result.missing_points.push('症例報告をより詳細に記載しましょう');
        }

        // STEP1〜3の統合
        if (caseData.hasStep1 && caseData.hasStep2 && caseData.hasStep3) {
            score += 30;
            result.good_points.push('STEP1〜3が一貫して記載されています');
        } else {
            result.missing_points.push('全てのSTEPの内容を統合して記載しましょう');
        }

        // 他事業からの情報収集
        if (caseData.otherServices && caseData.otherServices.length >= 20) {
            score += 30;
            result.good_points.push('他事業からの情報収集が行えています');
        } else {
            result.missing_points.push('他事業からの情報収集も記載しましょう');
        }

        result.score = score;
        result.judgement = score >= 60 ? '○' : '×';
        result.short_comment = score >= 60
            ? '症例報告が適切にまとめられています'
            : '記載に不足があります。各STEPの内容を統合し、一貫性を確認しましょう';

        return result;
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

    const caseData = {
        summary: document.getElementById('step4-summary')?.value || '',
        hasStep1: true,
        hasStep2: true,
        hasStep3: true,
        otherServices: document.getElementById('step4-other-services')?.value || '',
        presentationDate: document.getElementById('step4-presentation-date')?.value || ''
    };

    const aiResult = Step4.judge(caseData);
    const presentationNumber = Step4.getPresentationCount(user.staff_id) + 1;

    DB.save('step4_reports', {
        staff_id: user.staff_id,
        case_json: JSON.stringify(caseData),
        presentation_date: caseData.presentationDate,
        presentation_number: presentationNumber,
        ai_score_json: JSON.stringify(aiResult)
    });

    showResult(aiResult);
}
