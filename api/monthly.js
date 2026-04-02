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

        // 3) 6観点スコアを集計（AI評価など）
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        let breakdown = [];
        let isAIEvaluated = false;

        let aiError = null;
        if (GEMINI_API_KEY) {
            try {
                breakdown = await evaluateMonthlyWithAI(step1Records, step2Records, step3Records, GEMINI_API_KEY);
                if (breakdown && (breakdown.length === 6 || breakdown.length >= 6)) {
                    isAIEvaluated = true;
                }
            } catch (e) {
                console.error('AI evaluation failed, falling back to basic calculation:', e);
                aiError = e.message;
            }
        }

        if (!isAIEvaluated || !breakdown || breakdown.length < 6) {
            breakdown = calculateBreakdown(step1Records, step2Records, step3Records, aiError || (GEMINI_API_KEY ? "AI回答が不完全です" : false));
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

        // 6) 過去の評価取得 & 合格判定
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
function calculateBreakdown(step1, step2, step3, isError = false) {
    const allRecords = [...step1, ...step2, ...step3];
    const passRate = allRecords.filter(r => r.ai_judgement === '○').length / Math.max(allRecords.length, 1);
    const step1Rate = step1.length > 0 ? step1.filter(r => r.ai_judgement === '○').length / step1.length : 0;
    const step2Rate = step2.length > 0 ? step2.filter(r => r.ai_judgement === '○').length / step2.length : 0;
    const step3Rate = step3.length > 0 ? step3.filter(r => r.ai_judgement === '○').length / step3.length : 0;

    const errorNote = isError ? "【注意】AI項目の生成に失敗しました。基本的なスコアのみ表示しています。" : "（AI評価が有効になっていません）";

    return [
        { name: '気づいた変化の明確さ', key: 'change_clarity', score: calcScore(15, step1Rate || passRate), max: 15, userContent: errorNote, comment: errorNote },
        { name: '要因の多層的分析', key: 'multi_factor', score: calcScore(20, step2Rate || passRate), max: 20, userContent: errorNote, comment: errorNote },
        { name: '要因の関連性と優先順位', key: 'priority', score: calcScore(15, step2Rate || passRate), max: 15, userContent: errorNote, comment: errorNote },
        { name: '検証計画の論理性', key: 'verification', score: calcScore(15, avg(step2Rate, step3Rate) || passRate), max: 15, userContent: errorNote, comment: errorNote },
        { name: '支援計画の実効性', key: 'support_plan', score: calcScore(20, step3Rate || passRate), max: 20, userContent: errorNote, comment: errorNote },
        { name: '振り返り・修正力', key: 'reflection', score: calcScore(15, step3Rate || passRate), max: 15, userContent: errorNote, comment: errorNote }
    ];
}

// ===== AI 月次評価算出 =====
async function evaluateMonthlyWithAI(step1, step2, step3, apiKey) {
    // 各STEPの記録テキストをより詳しく抽出
    const s1Items = step1.slice(0, 15).map((r, i) => `[気付き${i+1}] ${r.notice_text || ''}`);
    const s2Items = step2.slice(0, 10).map((r, i) => `[仮説${i+1}] 仮説: ${r.hypothesis || ''} / 理由: ${r.reason || ''} / 支援案: ${r.support_plan || ''}`);
    const s3Items = step3.slice(0, 5).map((r, i) => `[振り返り${i+1}] 実施内容: ${r.support_done || ''} / 結果: ${r.result || ''} / 判定: ${r.judgement || ''}`);

    const s1Text = s1Items.join('\n') || '記録なし';
    const s2Text = s2Items.join('\n') || '記録なし';
    const s3Text = s3Items.join('\n') || '記録なし';

    const prompt = `あなたは新人介護スタッフの「月次評価」を行うAIメンターです。
以下のスタッフが1ヶ月間に提出した課題（STEP1〜3）を元に、月次評価シートの6つの観点について厳格に採点とフィードバックを行ってください。

【今月の記録（抜粋）】
■ STEP1（気付き）:
${s1Text}

■ STEP2（仮説思考）:
${s2Text}

■ STEP3（振り返り）:
${s3Text}

【評価基準と配点】
1. 気づいた変化の明確さ(15点満点) → STEP1の内容で評価
15点:「いつ、どこで、誰が、どうなった」＋普段との違いが明確。10点:変化はあるが普段との違い等一要素が欠落。5点:漠然とした変化のみ。
2. 要因の多層的分析(20点満点) → STEP2の仮説・理由で評価
20点:身体・心理・環境等、複数の視点から深く要因を分析。12点:要因は挙げているが視点が単一。5点:浅い思い込みが見られる。
3. 要因の関連性と優先順位(15点満点) → STEP2の理由・優先度で評価
15点:複数要因の関連性を整理し、根拠に基づき的確に優先順位を設定。10点:優先順位はあるが根拠が弱い。5点:理由が不明確。
4. 検証計画の論理性 (15点満点) → STEP2の支援案で評価
15点:仮説に基づき、期待される変化が具体的・計測可能。10点:計画はあるが変化が抽象的。5点:とりあえず行動するだけの計画。
5. 支援計画の実効性 (20点満点) → STEP3の実施内容で評価
20点:チームで共有・実行可能な具体的で現実的な支援内容。13点:支援は記載されているが意思確認や連携が不十分。7点:一方的な支援計画。
6. 振り返り・修正力(15点満点) → STEP3の結果・判定で評価
15点:結果を評価し、次の仮説や改善に繋げる力がある。10点:振り返りはあるが、次の改善に具体性が不足。5点:形式的で改善に繋がっていない。

【出力に関する重要ルール】
- "userContent" フィールドには、その観点の評価根拠となったスタッフの記録テキストから、最も良く（もしくは課題として）当てはまる具体的な記録内容を、1〜2文で必ず引用・要約してください。
  - 例（STEP1の場合）: 「『なんか調子悪そう』という気付きが1件ありました。」や「『田中様がフロアであいさつを呼びかけたが視線を合わせず返答もなかった』という観察が記録されていました。」
  - 絶対に空文字または(記載なし)を入力しないでください。記録がない場合でも「この月のSTEP○に記録が見当たりませんでした。」と記載すること。
- "comment" フィールドには、対象スタッフの記録を的確に評価する「具体的な総評」を3〜4文の長めの文章で記述してください。対象者の強み、改善点、伸びしろなどを含め、説得力を持たせてください。
- 採点基準のcheckは、スタッフの実際のレベルに最も近い基準1つだけをtrueにしてください。
- JSON形式で、以下のキーを持つオブジェクトとして出力してください。
{
  "breakdown": [
    {
      "name": "気づいた変化の明確さ",
      "key": "change_clarity",
      "max": 15,
      "score": 10,
      "judgement": "適切な気付きができています",
      "comment": "（ここに該当観点のスタッフのパフォーマンス、強みや課題について、3〜4文程度の詳細な総評を記述してください）",
      "userContent": "（スタッフの実際の記録を引用・要約した文章を必ず記入すること）",
      "goodPoints": ["良い点1", "良い点2"],
      "badPoints": ["不十分な点"],
      "improvement": "次満点を取るための具体的な助言",
      "criteriaRef": [
        { "pts": 15, "desc": "「いつ、どこで、誰が、どうなった」＋普段との違いが明確に記録されている", "check": false },
        { "pts": 10, "desc": "変化は書かれているが「普段との違い」など一要素が欠けている", "check": true },
        { "pts": 5, "desc": "漠然とした変化のみ（例：様子がおかしい）", "check": false }
      ]
    },
    ],
  "applied_knowledge": "今回の判定全体で活用した施設固有ルールや知識があれば簡潔に記載（なければ空文字）"
}
マークダウン装飾は含めず、純粋なJSON文字列のみを出力すること。`;


    console.log(`Evaluating Monthly AI for Staff:${step1[0]?.staff_id || ' unknown'}. Records: S1:${step1.length}, S2:${step2.length}, S3:${step3.length}`);
    
    // 施設固有の知識を取得
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qpviuumvxnbwxutlccfx.supabase.co';
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';
    const knowledge = await supabaseSelect(SUPABASE_URL, SUPABASE_KEY, 'ai_knowledge', 'select=title,content');
    const customRules = (knowledge || []).map(k => `【${k.title}】: ${k.content}`).join('\n');

    // 月次要約は以前はproを使用していましたが、アクセス制限とコストを考慮し高速な gemini-1.5-flash を使用します
    const modelName = 'gemini-1.5-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;



    
    // プロンプトに知識を注入
    const fullPrompt = `
以下の指示と施設固有のルールに従って、スタッフの1ヶ月の活動を要約し、多角的な視点から評価（採点）を行ってください。

【施設固有の特別ルール・知識】:
${customRules || '特になし'}

----------------------------
${prompt}
`;

    const requestBody = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { 
            temperature: 0.2
        },
        safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini API Error details:', errText);
        let errorMsg = `API Error ${response.status}`;
        try {
            const errJson = JSON.parse(errText);
            errorMsg = errJson.error?.message || errorMsg;
        } catch(e) {}
        throw new Error(errorMsg);
    }
    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        // 安全フィルター等で空で返ってきた場合のチェック
        const finishReason = json.candidates?.[0]?.finishReason;
        console.error('Empty response from Gemini. Reason:', finishReason, 'Full JSON:', JSON.stringify(json));
        throw new Error(`AI回答が空です（理由: ${finishReason || '不明'}）`);
    }

    try {
        let cleanText = text.trim();
        cleanText = cleanText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '');
        const jsonStart = cleanText.indexOf('{');
        const jsonEnd = cleanText.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
        cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');
        // 制御文字除去（特に13=CRを除去）
        cleanText = cleanText.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
        let parsedData = JSON.parse(cleanText);
        // オブジェクトの中に breakdown 配列があるか確認
        let breakdown = parsedData.breakdown || (Array.isArray(parsedData) ? parsedData : null);
        
        if (!breakdown || !Array.isArray(breakdown)) {
            console.error('Invalid breakdown structure:', parsedData);
            throw new Error('Invalid breakdown structure returned from AI');
        }

        console.log('AI Evaluation Success. Items count:', breakdown.length);
        return breakdown;
    } catch (e) {
        console.error('JSON Parse Error. Raw text:', text);
        throw e;
    }
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

// ===== 合格判定 =====
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

    // 現在のステップとスコアも previousEvals に含めて判定を容易にする
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
    if (hasScore(4, 0)) points = Math.max(points, 10); // 事例報告のSTEP4到達で最大評価

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
            actions.push(`「${item.name}」が不足しています（${item.score}/${item.max}点）。重点的に取り組みましょう！`);
        } else if (rate < 0.75) {
            actions.push(`「${item.name}」をさらに伸ばしましょう（${item.score}/${item.max}点）！`);
        }
    });
    if (actions.length === 0) {
        actions.push('すべての観点で良好な成績です。この調子で続けましょう！');
    }
    return actions.slice(0, 3);
}
