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
- **最重要：100点満点の書き換え例を生成せよ**。ユーザーの文章が短くても、その文脈（対象者や状況）を維持したまま、不足している要素（具体的な日時、数値、表情、比較対象など）を勝手に補完・肉付けして、「こう書けば100点だった」という具体的な手本を1〜2文で提示すること。
- **【厳守】元の文章を生かした添削**: ユーザーの入力文章を無視して全く新しい文章を作ることは禁止です。必ず「今回ユーザーが入力した文章」をベースとして使用し、そこに不足している情報（具体的な日時、数値、表情、比較対象など）を**加筆・添削する形**で「こう書くと100点になる」という手本を作成してください。
- 短文への対応: 文量の少なさを理由に否定してはならない。1行でも「○」の可能性を探る。不足のため「×」とする場合は、その短い文章にプロが情報（事実・状況・表情等）を肉付けしたらどうなるか？という添削例を提示すること。
- 定型文の禁止: 「次回は気をつけましょう」「具体的に書きましょう」などの抽象的なアドバイスは禁止。
- 専門的な助言: 介護職としての専門的視点からのアドバイスを必ず含めること。
`;

const JSON_OUT = `出力形式(JSON形式厳守):
{
  "judgement": "○ または ×",
  "score": 0〜100（数値）,
  "short_comment": "ユーザーの記録に対する具体的かつ心に響く総評（3〜4文）",
  "good_points": ["良かった点（具体的）"],
  "missing_points": ["不足していた点（具体的に何を足すべきか）"],
  "improvement_example": "ユーザーの原文を添削・加筆した、具体的で専門的な『100点満点の書き換え例』"
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
