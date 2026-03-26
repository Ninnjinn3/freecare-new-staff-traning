/* ============================================
   api/exec.js — 運営本部ダッシュボード用API
   全拠点KPI・合格率・STEP分布
   ============================================ */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { year_month } = req.body;
    const ym = year_month || getCurrentYearMonth();

    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qpviuumvxnbwxutlccfx.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';

    try {
        // 全データ取得（離職率計算のためinactive含む）
        const [facilities, allStaff, allStaffWithInactive, step1All, step2All, step3All, evalAll] = await Promise.all([
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'facilities', 'order=name'),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'staff_master', 'role=eq.staff&is_active=eq.true'),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'staff_master', 'role=eq.staff'),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step1', `year_month=eq.${ym}`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'step2_hypotheses', `year_month=eq.${ym}`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step3', `year_month=eq.${ym}`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'monthly_evaluations', `year_month=eq.${ym}`)
        ]);

        // 拠点別集計 (ユーザー指定の7カテゴリー + その他)
        const categories = [
            { prefix: '2', name: 'グループホーム' },
            { prefix: '3', name: '訪問看護（精神）' },
            { prefix: '4', name: '三国' },
            { prefix: '5', name: '就労B' },
            { prefix: '6', name: 'デイサービス' },
            { prefix: '7', name: '生活介護' },
            { prefix: '8', name: '小児' }
        ];

        const facilityStats = categories.map(cat => {
            const staff = allStaff.filter(s => s.staff_id.startsWith(cat.prefix));
            const staffIds = staff.map(s => s.staff_id);

            const s1 = step1All.filter(r => staffIds.includes(r.staff_id));
            const s2 = step2All.filter(r => staffIds.includes(r.staff_id));
            const s3 = step3All.filter(r => staffIds.includes(r.staff_id));
            const evals = evalAll.filter(e => staffIds.includes(e.staff_id));

            const allRecords = [...s1, ...s2, ...s3];
            const passCount = allRecords.filter(r => r.ai_judgement === '○').length;
            const totalRecords = allRecords.length;

            const scores = evals.map(e => e.score || e.total_score).filter(s => s != null);
            const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

            return {
                id: cat.prefix,
                name: cat.name,
                staffCount: staff.length,
                activeStaff: new Set(allRecords.map(r => r.staff_id)).size,
                totalRecords,
                passRate: totalRecords > 0 ? Math.round((passCount / totalRecords) * 100) : 0,
                avgScore,
                stepDistribution: {
                    step1: staff.filter(s => s.current_step === 1).length,
                    step2: staff.filter(s => s.current_step === 2).length,
                    step3: staff.filter(s => s.current_step === 3).length,
                    step4: staff.filter(s => s.current_step >= 4).length
                }
            };
        });

        // 全社サマリ
        const totalStaff = allStaff.length;
        const allRecords = [...step1All, ...step2All, ...step3All];
        const totalPassCount = allRecords.filter(r => r.ai_judgement === '○').length;
        const allScores = evalAll.map(e => e.score || e.total_score).filter(s => s != null);

        // 離職率（全スタッフ中の非アクティブ割合）
        const inactiveStaff = allStaffWithInactive.filter(s => !s.is_active);
        const attritionRate = allStaffWithInactive.length > 0 ?
            Math.round((inactiveStaff.length / allStaffWithInactive.length) * 100) : 0;

        // 新人定着率（入社6ヶ月以上で在籍中の割合）
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const sixMonthStaff = allStaffWithInactive.filter(s =>
            s.hire_date && new Date(s.hire_date) <= sixMonthsAgo
        );
        const retainedStaff = sixMonthStaff.filter(s => s.is_active);
        const retentionRate = sixMonthStaff.length > 0 ?
            Math.round((retainedStaff.length / sixMonthStaff.length) * 100) : 0;

        // 教育完了率（STEP4到達者の割合）
        const completedStaff = allStaff.filter(s => s.current_step >= 4).length;
        const completionRate = totalStaff > 0 ? Math.round((completedStaff / totalStaff) * 100) : 0;

        // 仮説的中率（全社のSTEP3のうち、判断が「変更」以外の割合）
        const allStep3Decisions = step3All.filter(r => r.decision === '継続' || r.decision === '終了').length;
        const globalHitRate = step3All.length > 0 ? Math.round((allStep3Decisions / step3All.length) * 100) : 0;

        // 振り返り実施率（全アクティブスタッフのうち、STEP3を実施した人の割合）
        const globalStaffWithStep3 = new Set(step3All.map(r => r.staff_id)).size;
        const activeStaffSize = new Set(allRecords.map(r => r.staff_id)).size;
        const globalReflectionRate = activeStaffSize > 0 ? Math.round((globalStaffWithStep3 / activeStaffSize) * 100) : 0;

        // 事業所スコア偏差（各拠点の平均スコアの標準偏差計算）
        const validFacilityScores = facilityStats.map(f => f.avgScore).filter(s => s > 0);
        let scoreDeviation = 0;
        if (validFacilityScores.length > 0) {
            const mean = validFacilityScores.reduce((a, b) => a + b, 0) / validFacilityScores.length;
            const variance = validFacilityScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validFacilityScores.length;
            scoreDeviation = Math.round(Math.sqrt(variance));
        }

        const globalSummary = {
            totalStaff,
            activeStaff: activeStaffSize,
            totalRecords: allRecords.length,
            passRate: allRecords.length > 0 ? Math.round((totalPassCount / allRecords.length) * 100) : 0,
            avgScore: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
            attritionRate,
            retentionRate,
            completionRate,
            inactiveCount: inactiveStaff.length,
            hitRate: globalHitRate,
            reflectionRate: globalReflectionRate,
            scoreDeviation,
            stepDistribution: {
                step1: allStaff.filter(s => s.current_step === 1).length,
                step2: allStaff.filter(s => s.current_step === 2).length,
                step3: allStaff.filter(s => s.current_step === 3).length,
                step4: allStaff.filter(s => s.current_step === 4).length
            }
        };

        return res.status(200).json({ facilityStats, globalSummary, yearMonth: ym });

    } catch (error) {
        console.error('Exec API error:', error);
        return res.status(500).json({ error: 'KPIデータ取得に失敗', detail: error.message });
    }
}

async function sbSelect(url, key, table, query) {
    const resp = await fetch(`${url}/rest/v1/${table}?${query}`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (!resp.ok) return [];
    return await resp.json();
}

function getCurrentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
