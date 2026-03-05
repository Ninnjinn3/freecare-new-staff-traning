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
        // 全データ取得
        const [facilities, allStaff, step1All, step2All, step3All, evalAll] = await Promise.all([
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'facilities', 'order=name'),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'staff_master', 'role=eq.staff&is_active=eq.true'),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step1', `year_month=eq.${ym}`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'step2_hypotheses', `year_month=eq.${ym}`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step3', `year_month=eq.${ym}`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'monthly_evaluations', `year_month=eq.${ym}`)
        ]);

        // 拠点別集計
        const facilityStats = facilities.filter(f => f.id !== 'HQ').map(facility => {
            const staff = allStaff.filter(s => s.facility_id === facility.id);
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
                id: facility.id,
                name: facility.name,
                staffCount: staff.length,
                activeStaff: new Set(allRecords.map(r => r.staff_id)).size,
                totalRecords,
                passRate: totalRecords > 0 ? Math.round((passCount / totalRecords) * 100) : 0,
                avgScore,
                stepDistribution: {
                    step1: staff.filter(s => s.current_step === 1).length,
                    step2: staff.filter(s => s.current_step === 2).length,
                    step3: staff.filter(s => s.current_step === 3).length,
                    step4: staff.filter(s => s.current_step === 4).length
                }
            };
        });

        // 全社サマリ
        const totalStaff = allStaff.length;
        const allRecords = [...step1All, ...step2All, ...step3All];
        const totalPassCount = allRecords.filter(r => r.ai_judgement === '○').length;
        const allScores = evalAll.map(e => e.score || e.total_score).filter(s => s != null);

        const globalSummary = {
            totalStaff,
            activeStaff: new Set(allRecords.map(r => r.staff_id)).size,
            totalRecords: allRecords.length,
            passRate: allRecords.length > 0 ? Math.round((totalPassCount / allRecords.length) * 100) : 0,
            avgScore: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
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
