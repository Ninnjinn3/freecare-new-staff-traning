/* ============================================
   api/monthly.js — 月次評価算出サーバーレス関数
   STEP1-3の記録から6観点×100点を自動算出
   ============================================ */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { staff_id, year_month, current_step } = req.body;
    if (!staff_id || !year_month) {
        return res.status(400).json({ error: 'staff_id and year_month required' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qpviuumvxnbwxutlccfx.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';

    try {
        // 1) その月のSTEP1-3全記録を取得
        const [step1Records, step2Records, step3Records] = await Promise.all([
            supabaseSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step1', `staff_id=eq.${staff_id}&year_month=eq.${year_month}`),
            supabaseSelect(SUPABASE_URL, SUPABASE_KEY, 'step2_hypotheses', `staff_id=eq.${staff_id}&year_month=eq.${year_month}`),
            supabaseSelect(SUPABASE_URL, SUPABASE_KEY, 'daily_step3', `staff_id=eq.${staff_id}&year_month=eq.${year_month}`)
        ]);

        const totalRecords = step1Records.length + step2Records.length + step3Records.length;

        // 2) 記録がない場合
        if (totalRecords === 0) {
            return res.status(200).json({
                score: 0,
                breakdown: defaultBreakdown(0),
                totalRecords: 0,
                passCount: 0,
                failCount: 0,
                passed: false,
                level: { grade: '-', name: '新人', hrPoints: 0 },
                hrPoints: 0,
                actions: ['まだ記録がありません。STEP1の気付きから記録を始めましょう！']
            });
        }

        // 3) 6観点スコアを集計（AI評価）
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        let breakdown = [];
        let isAIEvaluated = false;

        if (GEMINI_API_KEY) {
            try {
                breakdown = await evaluateMonthlyWithAI(step1Records, step2Records, step3Records, GEMINI_API_KEY);
                if (breakdown && breakdown.length === 6) {
                    isAIEvaluated = true;
                }
            } catch (e) {
                console.error('AI evaluation failed, falling back to basic calculation:', e);
            }
        }

        if (!isAIEvaluated || !breakdown || breakdown.length === 0) {
            breakdown = calculateBreakdown(step1Records, step2Records, step3Records);
        }

        const score = breakdown.reduce((sum, b) => sum + (b.score || 0), 0);

        // 4) ○/×カウント
        const allJudgements = [
            ...step1Records.map(r => r.ai_judgement),
            ...step2Records.map(r => r.ai_judgement),
            ...step3Records.map(r => r.ai_judgement)
        ];
        const passCount = allJudgements.filter(j => j === '○').length;
        const failCount = allJudgements.filter(j => j === '×').length;

        // 5) レベル判定
        const level = getLevel(score);

        // 6) 過去の評価取得 & 合否判定
        const step = current_step || 1;
        const previousEvals = await supabaseSelect(
            SUPABASE_URL, SUPABASE_KEY, 'monthly_evaluations',
            `staff_id=eq.${staff_id}&year_month=lt.${year_month}&order=year_month.desc&limit=12`
        );
        const passed = checkPass(score, previousEvals.length + 1, previousEvals.map(e => e.score));

        // 7) 人事評価ポイント算出
        const hrPoints = calculateHRPoints(step, score, previousEvals);

        // 8) 改善アクション生成 (AI側で既に生成されていても、全体サマリーとして使用)
        const actions = generateActions(breakdown);

        // 9) monthly_evaluations に保存（upsert）
        await supabaseUpsert(SUPABASE_URL, SUPABASE_KEY, 'monthly_evaluations', {
            staff_id,
            year_month,
            step: step,
            score,
            breakdown_json: breakdown,
            pass_count: passCount,
            fail_count: failCount,
            total_records: totalRecords,
            passed,
            hr_points: hrPoints
        });

        return res.status(200).json({
            score, breakdown, totalRecords, passCount, failCount,
            passed, level, hrPoints, actions
        });

    } catch (error) {
        console.error('Monthly evaluation error:', error);
        return res.status(500).json({ error: '月次評価の算出に失敗しました', detail: error.message });
    }
}

// ===== Supabase REST API helpers =====
async function supabaseSelect(url, key, table, query) {
    const resp = await fetch(`${url}/rest/v1/${table}?${query}`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    if (!resp.ok) return [];
    return await resp.json();
}

async function supabaseUpsert(url, key, table, record) {
    await fetch(`${url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(record)
    });
}

// ===== 6観点スコア算出 =====
function calculateBreakdown(step1, step2, step3) {
    const allRecords = [...step1, ...step2, ...step3];

    // ai_good_points / ai_missing からスコア推定
    // ○の記録は高スコア、×は低スコアとして按分
    const passRate = allRecords.filter(r => r.ai_judgement === '○').length / Math.max(allRecords.length, 1);

    // STEP別の重み: STEP1は観点1重視、STEP2は観点2-3重視、STEP3は観点5-6重視
    const step1Rate = step1.length > 0 ? step1.filter(r => r.ai_judgement === '○').length / step1.length : 0;
    const step2Rate = step2.length > 0 ? step2.filter(r => r.ai_judgement === '○').length / step2.length : 0;
    const step3Rate = step3.length > 0 ? step3.filter(r => r.ai_judgement === '○').length / step3.length : 0;

    return [
        { name: '気づいた変化の明確さ', key: 'change_clarity', score: calcScore(15, step1Rate || passRate), max: 15 },
        { name: '要因の多層的分析', key: 'multi_factor', score: calcScore(20, step2Rate || passRate), max: 20 },
        { name: '要因の関連性と優先順位', key: 'priority', score: calcScore(15, step2Rate || passRate), max: 15 },
        { name: '検証計画の論理性', key: 'verification', score: calcScore(15, avg(step2Rate, step3Rate) || passRate), max: 15 },
        { name: '支援計画の実効性', key: 'support_plan', score: calcScore(20, step3Rate || passRate), max: 20 },
        { name: '振り返り・修正力', key: 'reflection', score: calcScore(15, step3Rate || passRate), max: 15 }
    ];
}

// ===== AI 月次評価算出 =====
async function evaluateMonthlyWithAI(step1, step2, step3, apiKey) {
    const s1Text = step1.map(r => `・気付き: ${r.notice_text}`).slice(0, 15).join('\n'); // 長すぎる場合は制限
    const s2Text = step2.map(r => `・仮説: ${r.hypothesis}\n・理由: ${r.reason}\n・支援案: ${r.support_plan}`).slice(0, 10).join('\n');
    const s3Text = step3.map(r => `・実施支援: ${r.support_done}\n・結果: ${r.result}\n・判定: ${r.judgement}`).slice(0, 5).join('\n');

    const prompt = `あなたは新人介護スタッフの「月次評価」を行うAIメンターです。
以下のスタッフが1ヶ月間に記録した提出物（STEP1〜3）を元に、月次評価シートの6つの観点について厳密に採点とフィードバックを行ってください。

【今月の記録（抜粋）】
■ STEP1（気付き）
${s1Text || '記録なし'}

■ STEP2（仮説思考）
${s2Text || '記録なし'}

■ STEP3（振り返り）
${s3Text || '記録なし'}

【評価基準と配点】
1. 気づいた変化の明確さ (15点満点)
15点:「いつ、どこで、誰が、どうなった」＋普段との違いが明確。10点:変化はあるが普段との違い等一要素が欠落。5点:漠然とした変化のみ。
2. 要因の多層的分析 (20点満点)
20点:身体・心理・環境等、複数の視点から深く要因を分析。12点:要因は挙げているが視点が単一。5点:浅く思い込みが見られる。
3. 要因の関連性と優先順位 (15点満点)
15点:複数要因の関連性を整理し、根拠に基づき的確に優先順位を設定。10点:優先順位はあるが根拠が弱い。5点:理由が不明確。
4. 検証計画の論理性 (15点満点)
15点:仮説に基づき、期待される変化が具体的・計測可能。10点:計画はあるが変化が抽象的。5点:とりあえず行動するだけの計画。
5. 支援計画の実効性 (20点満点)
20点:チームで共有・実行可能な具体的で現実的な支援内容。13点:支援は記載されているが意思確認や連携が不十分。7点:一方的な支援計画。
6. 振り返り・修正力 (15点満点)
15点:結果を評価し、次の仮説や改善に繋げる力がある。10点:振り返りはあるが、次の改善に具体性が不足。5点:形式的で改善に繋がっていない。

【出力形式】
JSON配列形式で出力してください。\`\`\`json などのマークダウン装飾は含めず、生のJSON文字列のみを出力すること。フォーマットは以下の通りです。
[
  {
    "name": "気づいた変化の明確さ",
    "key": "change_clarity",
    "max": 15,
    "score": 10,
    "judgement": "適切な気付きができています",
    "userContent": "（ここには、この観点に関連してスタッフが実際に書いた内容を抜き出し、わかりやすく1〜2文で要約してください。プレースホルダーではなく推測した要約を記入すること）",
    "goodPoints": ["良い点1", "良い点2"],
    "badPoints": ["不十分な点"],
    "improvement": "次満点を取るための具体的な助言",
    "criteriaRef": [
      { "pts": 15, "desc": "「いつ、どこで、誰が、どうなった」＋普段との違いが明確に記載されている", "check": false },
      { "pts": 10, "desc": "変化は書かれているが「普段との違い」など一要素が欠けている", "check": true },
      { "pts": 5, "desc": "漠然とした変化のみ。（例：様子がおかしい）", "check": false }
    ]
  },
  ...（全6項目、順番通りに出力してください）
]`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        })
    });

    if (!response.ok) throw new Error('API Error ' + response.statusText);
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No text returned from AI');

    let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed = JSON.parse(cleanText);
    return parsed;
}

function calcScore(max, rate) {
    // rate 0-1 を 低/中/高 のスコアにマッピング
    if (rate >= 0.8) return max;                              // 高
    if (rate >= 0.5) return Math.round(max * 0.67);           // 中
    if (rate > 0) return Math.round(max * 0.33);              // 低
    return 0;
}

function avg(...values) {
    const nonZero = values.filter(v => v > 0);
    return nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0;
}

function defaultBreakdown(totalScore) {
    const ratio = totalScore / 100;
    return [
        { name: '気づいた変化の明確さ', key: 'change_clarity', score: Math.round(15 * ratio), max: 15 },
        { name: '要因の多層的分析', key: 'multi_factor', score: Math.round(20 * ratio), max: 20 },
        { name: '要因の関連性と優先順位', key: 'priority', score: Math.round(15 * ratio), max: 15 },
        { name: '検証計画の論理性', key: 'verification', score: Math.round(15 * ratio), max: 15 },
        { name: '支援計画の実効性', key: 'support_plan', score: Math.round(20 * ratio), max: 20 },
        { name: '振り返り・修正力', key: 'reflection', score: Math.round(15 * ratio), max: 15 }
    ];
}

// ===== レベル判定 =====
function getLevel(score) {
    const thresholds = [
        { min: 71, max: 100, level: 3, grade: '上級', name: '上級（レベル3）', hrPoints: 10 },
        { min: 61, max: 70, level: 2, grade: '中級', name: '中級（レベル2）', hrPoints: 6 },
        { min: 31, max: 60, level: 1, grade: '初級', name: '初級（レベル1）', hrPoints: 4 },
        { min: 0, max: 30, level: 0, grade: '新人', name: '新人', hrPoints: 2 }
    ];
    return thresholds.find(t => score >= t.min && score <= t.max) || thresholds[thresholds.length - 1];
}

// ===== 合否判定 =====
function checkPass(score, attemptNumber, previousScores) {
    if (attemptNumber === 1) return score >= 80;
    if (previousScores.length >= 1) {
        return previousScores[previousScores.length - 1] === 100 && score === 100;
    }
    return false;
}

// ===== 人事評価ポイント =====
function calculateHRPoints(step, score, previousEvals) {
    let points = 2; // 初期

    // 現在のステップとスコアを previousEvals に含めて判定を容易にする
    const allEvals = [...previousEvals, { step, score }];

    // ステップごとの到達状況を確認
    const hasScore = (s, min) => allEvals.some(e => e.step === s && e.score >= min);
    const countScore = (s, min) => allEvals.filter(e => e.step === s && e.score >= min).length;

    // 定められたマイルストーンに到達していればポイント更新
    if (hasScore(1, 80)) points = Math.max(points, 4);
    if (countScore(1, 100) >= 1) points = Math.max(points, 6);
    if (hasScore(2, 80)) points = Math.max(points, 6);
    if (countScore(2, 100) >= 1) points = Math.max(points, 8);
    if (hasScore(3, 80)) points = Math.max(points, 8);
    if (countScore(3, 100) >= 1) points = Math.max(points, 10);
    if (hasScore(4, 0)) points = Math.max(points, 10); // 症例報告はSTEP4到達で最大評価

    // 6ヶ月滞在ペナルティ (現在のstepに何ヶ月いるか)
    const sameStepEvals = allEvals.filter(e => e.step === step).length;
    if (sameStepEvals >= 6) {
        // 6ヶ月ごとに2点減点
        const penaltyMultiplier = Math.floor(sameStepEvals / 6);
        points -= penaltyMultiplier * 2;
    }

    return Math.max(points, 0);
}

// ===== 改善アクション生成 =====
function generateActions(breakdown) {
    const actions = [];
    breakdown.forEach(item => {
        const rate = item.score / item.max;
        if (rate < 0.5) {
            actions.push(`「${item.name}」が不足しています（${item.score}/${item.max}点）。重点的に取り組みましょう。`);
        } else if (rate < 0.75) {
            actions.push(`「${item.name}」をさらに伸ばしましょう（${item.score}/${item.max}点）。`);
        }
    });
    if (actions.length === 0) {
        actions.push('すべての観点で良好な成績です。この調子で続けましょう！');
    }
    return actions.slice(0, 3);
}
