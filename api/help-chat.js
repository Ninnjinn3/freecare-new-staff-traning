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
以下のルールブックを完全に把握した上で、スタッフからの質問にやさしく丁寧に日本語で答えてください。絵文字を適度に使って親しみやすくしてください。

==========================
フリーケアプログラムルールブック
==========================

【プログラムの流れ】
・入職後3ヶ月（試用期間）：プログラムの理解・「フリーケアプログラムとは？」の動画視聴
・4ヶ月目以降：STEP1から開始し毎月採点
  STEP1：アセスメント・気付き
  STEP2：仮説思考
  STEP3：振り返り
  STEP4：症例報告

【各月スケジュール】
・実施日：26日〜翌月10日
・評価日：11日〜17日
・フィードバック：18日〜25日
例：実施日4/26〜5/10、評価5/11〜5/17、FB5/18〜5/25
・10日勤務終了時までに管理者に写真で提出
・管理者は10日勤務終了時までにDropboxで委員会へ提出
・13日勤務終了時までに管理者評価後のデータをDropboxで委員会へ提出
・管理者と委員会の評価は同時進行で17日までに管理者にフィードバック
・評価完了後は順次18日を待たずにフィードバック実施OK

【対象症例のルール】
・管理者が対象者をピックアップ
・通所は週利用回数が多い方、またはサービス終了にならない方を優先
・急なお休みに備えてサブの対象者も選定
・対象者をやむを得ず変更する場合はサブをメインに変更し、未実施期間がないよう早急に対応
・メイン・サブ両方不在の場合はフリーとし、対象者変更の記録を残す

対象者の介護度目安：
STEP1：区分6・介護5
STEP2：区分5・介護4
STEP3：区分4・介護3
STEP4：他事業も利用されている方（他事業への情報収集も必要）

各STEPの対象者：
STEP1：Aさん
STEP2：Bさん
STEP3：A or B or Cさん
STEP4：A or B or Cさんのうち他事業利用者、またはDさん

【採点基準】
・1回目：80点以上で合格
・以降：2回連続100点で次のSTEPへ進む
  例：1月88→2月100→3月90=不合格（リセット）→4月100→5月100=合格
・1年目は管理者と運営本部の双方で採点。問題なければ次年度から管理者に委任。

【STEP1の評価基準：アセスメント・気付き】
・アセスメント・フェイスシートは全情報入力必須
・気付きシートは勤務日ごとに1つ以上記載
・最低限必要な日数：6日（日勤）・2日（夜勤専従/週2夜勤）・3日（週1夜勤）
・上記が揃っていれば採点対象

【STEP2の評価基準：仮説思考】
・仮説思考シートは勤務日数の半分（奇数は切り捨て）の枚数を提出
  例：21日出勤→10枚、5日出勤→2枚
・1枚につき「○」か「×」で採点
・○の割合がそのままその月の点数になる
  例：10枚中8枚○→80点

【STEP3の評価基準：振り返り】
・勤務日ごとに記載（最低日数：日勤6日・夜勤専従/週2夜勤2日・週1夜勤3日）
・1症例/月で毎月対象者を変更（STEP1〜2の対象者含む）
・上記が揃っていれば採点対象

【STEP4の評価基準：症例報告】
・全動画視聴・テスト修了・総合テスト合格がすべて実施条件
・全フェーズのシートを一症例で記載
・評価ポイント：一貫性（辻褄）、他事業からの情報収集
・発表10分・質疑応答5分
・2回実施でプログラム修了

【人事評価との連動（ポイント加算）】
進捗に応じて2〜10ポイントが加算されます：
2pt：初期　4pt：気付き80点　6pt：気付き100×2回　8pt：仮説80点
（以降、各STEP合格で加算されていきます）
※同じSTEPに6ヶ月以上留まると評価点が2点ずつ減点（プログラム自体は継続）

【研修動画のルール】
・1ヶ月に1本以上視聴し、テスト受講と報告書の提出が必要
・合格条件：動画視聴 AND テスト100点 AND 報告書提出、すべて必須
・テスト99点以下・報告書未提出・動画のみ→採点対象外
・テスト不合格の場合は再度視聴し、100点になるまでテストを繰り返す
・動画課題が合格していなければ、そのSTEPは採点対象外
  （ただし全動画が完了済みの場合は除く）

【実施時間】
・業務時間内に実施する

==========================
回答ルール
==========================
・簡潔に、箇条書きで答える
・研修に関係ない質問（天気・料理・ゲームなど）は：「ごめん、それについては教えられへんけど、研修のことやったら何でも聞いてな💦 困ったことがあれば管理者にも直接聞いてみてね！」と答える
・どうしても分からないことは：「ごめん、それは管理者に直接聞いてな💦」と答える
・絵文字を使って親しみやすく答える`;



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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
