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
        // 1) 該当拠点のスタッフ一覧
        let staffQuery = `is_active=eq.true&order=created_at.desc`;
        if (facility_id) staffQuery += `&facility_id=eq.${facility_id}`;

        const staffList = await sbSelect(SUPABASE_URL, SUPABASE_KEY, 'staff_master', staffQuery);

        if (!staffList.length) {
            return res.status(200).json({ staffProgress: [], alerts: [], summary: defaultSummary() });
        }

        // 2) 全スタッフのSTEP1-3記録を一括取得 + 全期間の月次評価
        const staffIds = staffList.map(s => s.staff_id);
        const ym = year_month || getCurrentYearMonth();

        const [step1All, step2All, step3All, evalCurrent, evalHistory] = await Promise.all([
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step1', `year_month=eq.${ym}&order=date.desc`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'step2_hypotheses', `year_month=eq.${ym}&order=date.desc`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step3', `year_month=eq.${ym}&order=date.desc`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'monthly_evaluations', `year_month=eq.${ym}`),
            sbSelect(SUPABASE_URL, SUPABASE_KEY, 'monthly_evaluations', `order=year_month.asc`)
        ]);

        // 3) スタッフごとの進捗データ構築
        const staffProgress = staffList.map(staff => {
            const sid = staff.staff_id;
            const s1 = step1All.filter(r => r.staff_id === sid);
            const s2 = step2All.filter(r => r.staff_id === sid);
            const s3 = step3All.filter(r => r.staff_id === sid);
            const ev = evalCurrent.find(e => e.staff_id === sid);

            const totalRecords = s1.length + s2.length + s3.length;
            const passCount = [...s1, ...s2, ...s3].filter(r => r.ai_judgement === '○').length;
            const failCount = [...s1, ...s2, ...s3].filter(r => r.ai_judgement === '×').length;
            const lastRecord = [...s1, ...s2, ...s3].sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            )[0];

            // STEP内サブレベル計算
            const subLevel = calcSubLevel(evalHistory.filter(e => e.staff_id === sid), staff.current_step);

            // 今月の課題完了ステータス
            const minRecords = staff.work_type === 'night' ? 4 : 6;
            const taskStatus = totalRecords >= minRecords ? 'done' : `${totalRecords}/${minRecords}`;

            return {
                staff_id: sid,
                name: staff.name,
                current_step: staff.current_step || 1,
                subLevel,
                taskStatus,
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
        const activeStaffList = staffProgress.filter(s => s.totalRecords > 0);
        const activeStaffSize = activeStaffList.length;

        // 仮説的中率（施設全体のSTEP3のうち、判断が「変更」以外の割合）
        const facilityStep3 = step3All.filter(r => staffIds.includes(r.staff_id));
        const facilityHits = facilityStep3.filter(r => r.decision === '継続' || r.decision === '終了').length;
        const hitRate = facilityStep3.length > 0 ? Math.round((facilityHits / facilityStep3.length) * 100) : 0;

        // 振り返り実施率（アクティブスタッフのうち、STEP3を実施した人の割合）
        const staffWithStep3 = new Set(facilityStep3.map(r => r.staff_id)).size;
        const reflectionRate = activeStaffSize > 0 ? Math.round((staffWithStep3 / activeStaffSize) * 100) : 0;

        const summary = {
            totalStaff: staffProgress.length,
            activeStaff: activeStaffSize,
            avgScore: Math.round(activeStaffList.filter(s => s.monthlyScore).reduce((s, p) => s + p.monthlyScore, 0) /
                Math.max(activeStaffList.filter(s => s.monthlyScore).length, 1)),
            avgPassRate: Math.round(staffProgress.reduce((s, p) => s + p.passRate, 0) / Math.max(staffProgress.length, 1)),
            hitRate,
            reflectionRate,
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

// ===== STEP内サブレベル計算 =====
// 進捗: 80点挑戦中 → 80点合格済(100点1回目) → 100点1回合格(2回目挑戦) → STEP合格！
function calcSubLevel(evalHistory, currentStep) {
    if (!evalHistory.length) {
        return { level: 0, label: '80点挑戦中', icon: '🔵', progress: 0 };
    }

    // 現在のSTEPに関連する評価のみ（stepカラムがあれば使用）
    const scores = evalHistory
        .map(e => e.score || e.total_score || 0)
        .filter(s => s > 0);

    if (scores.length === 0) {
        return { level: 0, label: '80点挑戦中', icon: '🔵', progress: 0 };
    }

    // 80点以上が1回でもあるか
    const has80 = scores.some(s => s >= 80);
    if (!has80) {
        const bestScore = Math.max(...scores);
        return { level: 0, label: `80点挑戦中（最高${bestScore}点）`, icon: '🔵', progress: 15 };
    }

    // 80点合格後、100点が何回あるか
    const perfect100Count = scores.filter(s => s === 100).length;

    // 連続100点をチェック
    let consecutive100 = 0;
    for (let i = scores.length - 1; i >= 0; i--) {
        if (scores[i] === 100) consecutive100++;
        else consecutive100 = 0;
    }

    if (consecutive100 >= 2) {
        return { level: 3, label: 'STEP合格！🎉', icon: '🏆', progress: 100 };
    } else if (perfect100Count >= 1) {
        return { level: 2, label: '100点1回合格（2回目挑戦中）', icon: '🟡', progress: 70 };
    } else {
        return { level: 1, label: '80点合格済（100点挑戦中）', icon: '🟢', progress: 40 };
    }
}

function defaultSummary() {
    return { totalStaff: 0, activeStaff: 0, avgScore: 0, avgPassRate: 0, stepDistribution: { step1: 0, step2: 0, step3: 0, step4: 0 } };
}
