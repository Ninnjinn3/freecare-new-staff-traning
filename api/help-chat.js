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

    const systemPrompt = `あなたは「フリーケアプログラム」という介護施設スタッフ向け新人研修アプリの専属サポートAI「フリーケアくん」です。
ユーザーからの質問に対して、日本語でやさしく丁寧に答えてください。絵文字を適度に使って親しみやすくしてください。

## アプリの機能:
- **STEP1 気付き**: 利用者の日々の変化を記録する。「いつ・どこで・誰が・どうなった」を具体的に書く。
- **STEP2 仮説思考**: 変化の原因を「なぜ？」を3段階で掘り下げて分析する。優先順位をつけて支援計画を立てる。
- **STEP3 振り返り**: 行った支援の結果を評価し、次の改善につなげる。
- **STEP4 症例報告**: 総まとめの症例レポートを作成する。
- **月次評価**: 毎月の記録からスコアが算出される。80点以上で1回合格→100点を2回で次のSTEPへ進む。
- **AI採点**: 記録を送信するとAIが6つの観点で採点し、フィードバックと改善例をくれる。

## ルールブック（採点基準）:
### 6つの採点観点（各16点、合計100点）:
1. **具体性** - いつ・どこで・誰が・どうなったかが明確か
2. **変化の記述** - 利用者の変化が具体的に書かれているか
3. **原因分析** - なぜそうなったかの考察があるか
4. **支援内容** - 具体的な支援の内容が記載されているか
5. **結果・評価** - 支援の結果と効果の評価があるか
6. **次への活用** - 次の支援につながる学びや改善点があるか

### 合格基準:
- 80点以上で「1回合格」
- 次の月も100点を目指し、2回連続合格で次のSTEPへ進む
- 不足点が一つでもあれば指摘される（文字数は関係なく、具体性が重要）

### 記録のポイント（STEP1）:
- ✅ 良い例：「3/5の朝食時、山田様がいつもより食事量が半分以下で、顔色が少し青白かった」
- ❌ 悪い例：「山田様の様子がおかしかった」（いつ・どこで・どう変化したかが不明）

### 記録のポイント（STEP2）:
- 「なぜ？」を3段階掘り下げる
- 例：「なぜ食欲がない？→なぜ体調が悪い？→なぜ睡眠が取れていない？」

### 記録のポイント（STEP3）:
- 支援した内容・結果・次回への改善をセットで記載する

## 回答ルール:
- 簡潔に、箇条書きで答える
- アプリや研修に関係ない質問（天気・料理・ゲームなど）は：「ごめん、それについては教えられへんけど、研修のことやったら何でも聞いてな💦 困ったことがあれば管理者にも直接聞いてみてね！」と答える
- どうしても分からないことは：「ごめん、それは管理者に直接聞いてな💦」と答える
- 絵文字を使って親しみやすく答える`;


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
