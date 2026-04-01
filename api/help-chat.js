import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'メッセージが必要です' });

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(200).json({
            reply: 'AIサポートは現在準備中です。以下のヘルプガイドを参考にしてください。\n\n' +
                '**STEP1**: 利用者の変化を「いつ・どこで・誰が・どうなった」で記録\n' +
                '**STEP2**: 変化の原因を「なぜ？」で3段階掘り下げ\n' +
                '**STEP3**: 支援の結果を振り返り、次に活かす\n\n' +
                'その他のご質問は管理者にお問い合わせください。'
        });
    }

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    // 施設固有の知識を取得
    let customKnowledge = "";
    try {
        const { data: knowledge } = await supabase.from('ai_knowledge').select('title, content');
        if (knowledge && knowledge.length > 0) {
            customKnowledge = knowledge.map(k => `【${k.title}】: ${k.content}`).join('\n');
        }
    } catch (e) {
        console.error('ai_knowledge load error:', e);
    }

    const systemPrompt = `あなたは「フリーケアプログラム」という介護施設スタッフ向け新人研修アプリの専属サポートAI「フリーケアくん」です。
以下の【基本ルール】と、管理者から提供された【追加ナレッジ】を把握した上で、回答してください。

【追加ナレッジ（施設固有ルール）】
${customKnowledge || '追加知識はありません。'}

==========================
【基本ルール：フリーケアプログラムルールブック】
==========================
【フリーケアプログラムの流れ】
・入職→3ヶ月(試用期間): プログラム開始準備
・4ヶ月目以降: STEP１から開始し毎月採点

【各ステップ】
STEP1：アセスメント、気付き
STEP2：仮説思考
STEP3：振り返り
STEP4：症例報告

【各月スケジュール】
実施日：26日〜翌月10日 / 評価日：11日〜17日 / フィードバック：18日〜25日

【採点について】
各ステップの採点は1回目80点合格、以降は2回連続100点で合格

【AIの採点基準（6つの観点）】
1. 気づいた変化の明確さ (15点)
2. 要因の多層的分析 (20点)
3. 要因の関連性と優先順位 (15点)
4. 検証計画の論理性 (15点)
5. 支援計画の実効性 (20点)
6. 振り返り・修正力 (15点)

【スタッフレベル評価基準】
〜100点：上級 / 〜70点：中級 / 〜60点：初級 / 30点以下：新人

回答は簡潔に、箇条書きや絵文字を交えて、やさしく丁寧な日本語で行ってください。
`;

    const contents = [];
    if (history && history.length > 0) {
        history.forEach(h => {
            contents.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] });
        });
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 512
                }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 429) {
                return res.status(200).json({ reply: 'ただいまAIへのアクセスが集中しており、お返事できない状態です。約1分おいてから再度お話ししましょう🙇‍♂️' });
            }
            throw new Error(`Gemini API エラー: ${response.status}`);
        }

        const json = await response.json();
        const reply = json.candidates?.[0]?.content?.parts?.[0]?.text || '申し訳ありません、回答を生成できませんでした。';

        return res.status(200).json({ reply });

    } catch (error) {
        console.error('Help chat error:', error);
        return res.status(200).json({
            reply: '一時的にAIに接続できませんでした（エラー: ' + error.message + '）'
        });
    }
}
