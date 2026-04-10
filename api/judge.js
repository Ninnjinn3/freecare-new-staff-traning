/* ============================================
   api/judge.js — Vercel サーバーレス関数
   Gemini API (1.5 Flash) でAI採点を実行
   ============================================ */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

    const { step, data } = req.body;
    let prompt = '';
    switch (step) {
        case 'step1': prompt = buildStep1Prompt(data); break;
        case 'step2': prompt = buildStep2Prompt(data); break;
        case 'step3': prompt = buildStep3Prompt(data); break;
        default: return res.status(400).json({ error: 'Invalid step' });
    }

    try {
        const { data: knowledge } = await supabase.from('ai_knowledge').select('title, content');
        const customRules = (knowledge || []).map(k => `【${k.title}】: ${k.content}`).join('\n');
        const geminiResponse = await callGemini(GEMINI_API_KEY, prompt, customRules);
        const result = parseGeminiResponse(geminiResponse);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Gemini API error:', error);
        return res.status(500).json({ error: 'AI判定に失敗しました', detail: error.message });
    }
}

async function callGemini(apiKey, prompt, customRules = '') {
    const model = 'gemini-2.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const fullPrompt = `以下の指示に従い介護記録を採点してください。\n\n【施設ルール】:\n${customRules || '特になし'}\n\n${prompt}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s timeout

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.3 }
        })
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
    }

    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text;
}

function parseGeminiResponse(text) {
    try {
        // Remove markdown formatting if present
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
            cleanText = cleanText.substring(7);
        } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.substring(3);
        }
        if (cleanText.endsWith('```')) {
            cleanText = cleanText.substring(0, cleanText.length - 3);
        }
        return JSON.parse(cleanText.trim());
    } catch (e) {
        return { judgement: '×', score: 0, short_comment: '解析失敗', improvement_example: '再度お試しください' };
    }
}

// 採点基準の定義（具体性と専門性を最優先）
const RUBRIC = `
1.気づき(STEP1): 客観的な事実（誰が、いつ、どのような変化か）が具体的か。
2.因果関係(STEP2): 仮説からなぜなぜ分析（3段階）を経て、納得感のある真因に辿り着いているか。
3.判断力(STEP3): 支援後の反応を客観的に捉え、継続・変更・終了の判断根拠が明確か。
`;

const RULES = `
- **合否判定基準（重要）**: 
    - 「○ (合格)」: 誰が、いつ、何をしたか（変化したか）の事実が客観的に書かれていれば「○」とする。多少の描写不足があっても、介護記録として成立していれば合格とする。
    - 「× (不合格)」: 主観のみ（例: 「機嫌が悪い」のみ）、何が起きたか不明、またはあまりに短すぎて事実が読み取れない場合のみ「×」とする。
    - **「不足点(missing_points)」の扱い**: 
    - 介護記録として**実質的に十分な内容**であれば、無理に不足点を探す必要はありません（その場合は空の配列 [] を返してください）。
    - 重箱の隅をつつくような「もっとこう書けばより良い」レベルの提案は、不足点（❌）ではなく総評や改善例で触れるにとどめてください。
    - 本当に「誰が・いつ・何をしたか」が抜けている、あるいはプロとして記録に残すべき重要な視点が欠けている場合のみ、不足点として挙げてください。
- **最重要：100点満点の書き換え例を生成せよ**。ユーザーの文章が短くても、その文脈（対象者や状況）を維持したまま、不足している要素（具体的な日時、数値、表情、比較対象など）を勝手に補完・肉付けして、「こう書けば100点だった」という具体的な手本を提示すること。
- **元の文章を生かした添削**: 必ずユーザーの入力文章をベースとして使用し、そこに情報を加筆・添削する形で「100点の手本」を作成してください。
- 文量の少なさを理由に否定してはならない。1行でも具体的な事実があれば「○」とする。
- 定型文の禁止: 「次回は気をつけて」などの抽象的な言葉は不要。
- 専門職としての視点から1つアドバイスを含めること。
`;

const JSON_OUT = `出力形式(JSON形式厳守):
{
  "judgement": "○ または ×",
  "score": 0〜100（数値）,
  "short_comment": "ユーザーへの承認と、さらなる向上への期待を込めた総評（3〜4文）",
  "good_points": ["良かった点（事実に基づき具体的に褒める）"],
  "missing_points": ["本当に不足している重要な情報がある場合のみ記述（なければ空の配列 [] ）"],
  "improvement_example": "ユーザーの原文に色を付け、情景が浮かぶように肉付けした『100点満点の書き換え例』"
}`;

function buildStep1Prompt(data) {
    return `
【STEP1: 気付きの判定】
対象者: ${data.target_name}
日付: ${data.date}
入力内容: 「${data.notice_text}」

【指示】:
この記録を介護のプロの視点で採点してください。
- 文量が短くても「具体性」があれば高く評価。
- 不足している場合は、ユーザーの原文「${data.notice_text}」をベースにして、足りない状況（時間、表情など）を肉付け・添削した100点の手本を提示してください。
- 例文の流用は絶対に行わず、今回の原文に加筆してください。

${RUBRIC}
${RULES}
${JSON_OUT}
`;
}

function buildStep2Prompt(data) {
    const hText = (data.hypotheses || []).map((h, i) => 
        `【仮説${i+1}】:${h.hypo}
         └ なぜ1:${h.why1}
         └ なぜ2:${h.why2}
         └ なぜ3:${h.why3}
         └ 支援案:${h.support}`
    ).join('\n');

    return `
【STEP2: 仮説思考の判定】
気付きの対象: ${data.change_noticed}
思考プロセス:
${hText}
優先順位の理由: 「${data.priority_reason}」
期待される変化: 「${data.expected_change}」

【指示】:
なぜなぜ分析の論理性と深掘りの鋭さを採点してください。
- 表面的な原因（「忘れたから」等）で止まらず、本人の背景や環境まで踏み込んでいるか。
- 改善例では、この思考プロセスをより論理的かつ専門的にまとめた「100点の記録」を提示してください。

${RUBRIC}
${RULES}
${JSON_OUT}
`;
}

function buildStep3Prompt(data) {
    const r = data.reflection || {};
    return `
【STEP3: 振り返りの判定】
実施した支援: ${r.support}
対象者の反応: ${r.reaction}
今後の判断: ${r.decision}

【指示】:
観察の客観性と、次のアクションへの繋がりを採点してください。
- 「継続・変更・終了」の判断が論理的か。
- 改善例では、反応をより具体的に（「喜んでいた」ではなく表情や発言など）描写し、専門的根拠に基づいた判断を下す「100点の振り返り記録」を作成してください。

${RUBRIC}
${RULES}
${JSON_OUT}
`;
}
