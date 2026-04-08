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

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
    }

    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text;
}

function parseGeminiResponse(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        return { judgement: '×', score: 0, short_comment: '解析失敗', improvement_example: '再度お試しください' };
    }
}

// 採点基準の定義
const RUBRIC = `
1.変化の明確さ: 具体性(いつ/どこ/誰/反応)。文字数の多寡は問わず、事象が具体的に捉えられているか。
2.多層分析（STEP2）: 「仮説」から始まり、「なぜ」を3段階で深掘りし、根本原因（真因）に迫っているか。
3.優先順位: 根拠ある順位付け。
4.検証・振り返り（STEP3）: 支援後の反応を客観的に捉え、次のアクションへ繋げているか。
`;

const RULES = `
- **文字数による減点は一切禁止**。1行でも、専門的な気づきや具体的な個別性があれば「○」とし、高得点を与えること。
- 短くても質の高い（具体性のある）記録を「理想」として提示すること。
- 不足点(missing_points)がある場合のみ判定を「×」とする。
- 添削例(improvement_example)は、ユーザーの短文を活かしたまま、より専門的に洗練させた例を提示すること。
`;

const JSON_OUT = `出力形式(JSON): {"judgement":"○/×", "score":15, "short_comment":"総評", "good_points":[], "missing_points":[], "improvement_example":"修正例"}`;

function buildStep1Prompt(data) {
    return `STEP1: 気付き。観察の具体性を重視。\n${RUBRIC}\n${RULES}\n内容:「${data.notice_text}」\n${JSON_OUT}`;
}

function buildStep2Prompt(data) {
    const hText = (data.hypotheses || []).map(h => `仮説:${h.hypo} -> なぜ1:${h.why1} -> なぜ2:${h.why2} -> なぜ3:${h.why3} (支援:${h.support})`).join('\n');
    return `STEP2: 仮説思考。仮説から根本原因への論理的深掘りを重視。\n${RUBRIC}\n${RULES}\n気付き:「${data.change_noticed}」\n思考プロセス:\n${hText}\n優先理由:「${data.priority_reason}」\n期待される変化:「${data.expected_change}」\n${JSON_OUT}`;
}

function buildStep3Prompt(data) {
    const r = data.reflection || {};
    return `STEP3: 振り返り。客観的評価と修正力を重視。\n${RUBRIC}\n${RULES}\n支援:${r.support} 反応:${r.reaction} 判断:${r.decision}\n${JSON_OUT}`;
}
