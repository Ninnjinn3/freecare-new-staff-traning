/* ============================================
   api/admin.js — 管理者ダッシュボード用API
   スタッフ進捗一覧・アラート取得
   ============================================ */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { facility_id, year_month } = req.body;

    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qpviuumvxnbwxutlccfx.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';

    try {
        // 1) 該当拠点のスタッフ一覧（研修対象のみ）
        const staffList = await sbSelect(SUPABASE_URL, SUPABASE_KEY,
            'staff_master', `facility_id=eq.${facility_id}&role=eq.staff&is_active=eq.true&order=name`);

        if (!staffList.length) {
            return res.status(200).json({ staffProgress: [], alerts: [], summary: defaultSummary() });
        }

        // 2) 全スタッフのSTEP1-3記録を一括取得
        const staffIds = staffList.map(s => s.staff_id);
        const ym = year_month || getCurrentYearMonth();

        const [step1All, step2All, step3All, evalAll] = await Promise.all([
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step1', `year_month=eq.${ym}&order=date.desc`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'step2_hypotheses', `year_month=eq.${ym}&order=date.desc`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step3', `year_month=eq.${ym}&order=date.desc`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'monthly_evaluations', `year_month=eq.${ym}`)
        ]);

        // 3) スタッフごとの進捗データ構築
        const staffProgress = staffList.map(staff => {
            const sid = staff.staff_id;
            const s1 = step1All.filter(r => r.staff_id === sid);
            const s2 = step2All.filter(r => r.staff_id === sid);
            const s3 = step3All.filter(r => r.staff_id === sid);
            const ev = evalAll.find(e => e.staff_id === sid);

            const totalRecords = s1.length + s2.length + s3.length;
            const passCount = [...s1, ...s2, ...s3].filter(r => r.ai_judgement === '○').length;
            const failCount = [...s1, ...s2, ...s3].filter(r => r.ai_judgement === '×').length;
            const lastRecord = [...s1, ...s2, ...s3].sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            )[0];

            return {
                staff_id: sid,
                name: staff.name,
                current_step: staff.current_step || 1,
                totalRecords,
                passCount,
                failCount,
                passRate: totalRecords > 0 ? Math.round((passCount / totalRecords) * 100) : 0,
                monthlyScore: ev?.score || ev?.total_score || null,
                passed: ev?.passed || ev?.is_passed || false,
                lastRecordDate: lastRecord?.date || lastRecord?.created_at || null,
                hrPoints: ev?.hr_points || 0
            };
        });

        // 4) アラート生成
        const alerts = generateAlerts(staffProgress, ym);

        // 5) サマリ
        const summary = {
            totalStaff: staffProgress.length,
            activeStaff: staffProgress.filter(s => s.totalRecords > 0).length,
            avgScore: Math.round(staffProgress.filter(s => s.monthlyScore).reduce((s, p) => s + p.monthlyScore, 0) /
                Math.max(staffProgress.filter(s => s.monthlyScore).length, 1)),
            avgPassRate: Math.round(staffProgress.reduce((s, p) => s + p.passRate, 0) / Math.max(staffProgress.length, 1)),
            stepDistribution: {
                step1: staffProgress.filter(s => s.current_step === 1).length,
                step2: staffProgress.filter(s => s.current_step === 2).length,
                step3: staffProgress.filter(s => s.current_step === 3).length,
                step4: staffProgress.filter(s => s.current_step === 4).length,
            }
        };

        return res.status(200).json({ staffProgress, alerts, summary });

    } catch (error) {
        console.error('Admin API error:', error);
        return res.status(500).json({ error: 'ダッシュボード取得に失敗しました', detail: error.message });
    }
}

// ===== Supabase REST helper =====
async function sbSelect(url, key, table, query) {
    const resp = await fetch(`${url}/rest/v1/${table}?${query}`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (!resp.ok) return [];
    return await resp.json();
}

// ===== アラート生成 =====
function generateAlerts(staffProgress, yearMonth) {
    const alerts = [];

    staffProgress.forEach(s => {
        // 記録未提出
        if (s.totalRecords === 0) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                staff: s.name,
                message: `${yearMonth}の記録がまだありません`
            });
        }
        // 記録不足（日勤6日未満）
        else if (s.totalRecords < 6) {
            alerts.push({
                type: 'info',
                icon: '📝',
                staff: s.name,
                message: `記録${s.totalRecords}件／最低6件（残${6 - s.totalRecords}件）`
            });
        }
        // 不合格率が高い
        if (s.totalRecords >= 3 && s.passRate < 50) {
            alerts.push({
                type: 'danger',
                icon: '🔴',
                staff: s.name,
                message: `合格率${s.passRate}%（要フォロー）`
            });
        }
    });

    // 優先度順ソート
    const priority = { danger: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => priority[a.type] - priority[b.type]);

    return alerts;
}

function getCurrentYearMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function defaultSummary() {
    return { totalStaff: 0, activeStaff: 0, avgScore: 0, avgPassRate: 0, stepDistribution: { step1: 0, step2: 0, step3: 0, step4: 0 } };
}
