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

const RUBRIC = `
1.変化の明確さ(15): 具体性(いつ/どこ/誰/反応)。比較ありで高点。文章の短さは問いませんが、具体性は維持してください。
2.多層分析(20): 3つ以上仮説。なぜを3回深掘り。
3.優先順位(15): 根拠ある順位。
4.検証計画(15): 具体的な指標・期限。
5.実効性(20): 本人意思反映。
6.修正力(15): 結果を評価し改善へ。
`;

const RULES = `
- 文章の長さは評価に直接影響しません。短くても本質的な変化や考察が的確に書かれていれば「○」とし、高得点を与えてください。逆に、長くても抽象的な表現ばかりの場合は低評価とします。
- 不足(missing_points)ありなら判定は必ず「×」。
- 添削例(improvement_example)は【添削方式】で記述。
`;

const JSON_OUT = `出力形式(JSON): {"judgement":"○/×", "score":100, "breakdown":{}, "short_comment":"", "good_points":[], "missing_points":[], "improvement_example":""}`;

function buildStep1Prompt(data) {
    return `STEP1: 気付き。具現性を重視。\n${RUBRIC}\n${RULES}\n内容:「${data.notice_text}」\n${JSON_OUT}`;
}
function buildStep2Prompt(data) {
    const hText = (data.hypotheses || []).map(h => `なぜ:${h.why1}->${h.why2}->${h.why3} 支援:${h.support}`).join('\n');
    return `STEP2: 仮説思考。論理性を重視。\n${RUBRIC}\n${RULES}\n変化:「${data.change_noticed}」\n仮説:\n${hText}\n${JSON_OUT}`;
}
function buildStep3Prompt(data) {
    const r = data.reflection || {};
    return `STEP3: 振り返り。修正力を重視。\n${RUBRIC}\n${RULES}\n支援:${r.support} 反応:${r.reaction} 判断:${r.decision}\n${JSON_OUT}`;
}
