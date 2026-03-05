/* ============================================
   api/help-chat.js — ヘルプチャットボット
   Gemini APIでアプリの使い方を回答
   ============================================ */

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
        // API key未設定時はローカル回答
        return res.status(200).json({
            reply: 'AIサポートは現在準備中です。以下のヘルプガイドを参考にしてください。\n\n' +
                '**STEP1**: 利用者の変化を「いつ・どこで・誰が・どうなった」で記録\n' +
                '**STEP2**: 変化の原因を「なぜ？」で3段階掘り下げ\n' +
                '**STEP3**: 支援の結果を振り返り、次に活かす\n\n' +
                'その他のご質問は管理者にお問い合わせください。'
        });
    }

    const systemPrompt = `あなたは「フリーケアプログラム」という介護施設スタッフ向け新人研修アプリのサポートAIです。
ユーザーからの質問に対して、日本語でやさしく丁寧に答えてください。

## アプリの機能:
- **STEP1 気付き**: 利用者の日々の変化を記録する。「いつ・どこで・誰が・どうなった」を具体的に書く。
- **STEP2 仮説思考**: 変化の原因を「なぜ？」を3段階で掘り下げて分析する。優先順位をつけて支援計画を立てる。
- **STEP3 振り返り**: 行った支援の結果を評価し、次の改善につなげる。
- **STEP4 症例報告**: 総まとめの症例レポートを作成する。
- **月次評価**: 毎月の記録からスコアが算出される。80点以上で1回合格→100点を2回で次のSTEPへ進む。
- **AI採点**: 記録を送信するとAIが6つの観点で採点し、フィードバックと改善例をくれる。
- **動画課題**: eラーニング動画を視聴して完了ボタンを押す。

## 合格基準:
- 不足点が一つでもあれば×（不合格）
- 具体性が重要（いつ・どこで・誰が・どう変化したか）
- 文字数は関係ない。短くても具体的ならOK。

## 回答ルール:
- 簡潔に、箇条書きで答える
- 分からないことは「管理者に確認してください」と案内する
- アプリに関係ない質問には「申し訳ありませんが、アプリの使い方に関する質問のみお答えできます」と回答する`;

    const contents = [];

    // 会話履歴を追加
    if (history && history.length > 0) {
        history.forEach(h => {
            contents.push({ role: h.role, parts: [{ text: h.text }] });
        });
    }

    // 現在のメッセージ
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
            throw new Error(`Gemini API ${response.status}: ${errText}`);
        }

        const json = await response.json();
        const reply = json.candidates?.[0]?.content?.parts?.[0]?.text || '申し訳ありません、回答を生成できませんでした。';

        return res.status(200).json({ reply });

    } catch (error) {
        console.error('Help chat error:', error);
        return res.status(500).json({ error: 'チャットエラーが発生しました', detail: error.message });
    }
}
