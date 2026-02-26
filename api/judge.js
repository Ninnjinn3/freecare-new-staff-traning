/* ============================================
   api/judge.js — Vercel サーバーレス関数
   Gemini API でAI採点を実行
   ============================================ */

export default async function handler(req, res) {
    // CORS 設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST only' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const { step, data } = req.body;

    let prompt = '';

    // ===== STEP別プロンプト =====
    switch (step) {
        case 'step1':
            prompt = buildStep1Prompt(data);
            break;
        case 'step2':
            prompt = buildStep2Prompt(data);
            break;
        case 'step3':
            prompt = buildStep3Prompt(data);
            break;
        default:
            return res.status(400).json({ error: 'Invalid step' });
    }

    try {
        const geminiResponse = await callGemini(GEMINI_API_KEY, prompt);
        const result = parseGeminiResponse(geminiResponse);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Gemini API error:', error);
        return res.status(500).json({ error: 'AI判定に失敗しました', detail: error.message });
    }
}

// ===== Gemini API 呼び出し =====
async function callGemini(apiKey, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
                responseMimeType: 'application/json'
            }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errText}`);
    }

    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
}

// ===== レスポンスパース =====
function parseGeminiResponse(text) {
    try {
        // JSON部分を抽出
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        // パース失敗時はデフォルト
        return {
            judgement: '○',
            short_comment: text.substring(0, 200),
            good_points: [],
            missing_points: [],
            improvement_example: ''
        };
    }
}

// ===== STEP1 プロンプト =====
function buildStep1Prompt(data) {
    return `あなたは介護施設の新人研修プログラムの採点AIです。
新人職員が利用者様について記録した「気付き」を採点してください。

## 採点基準（各20点、合計100点）
1. **記述量**: 30文字以上の具体的な記述があるか
2. **時間の記載**: いつ（時間帯・場面）の出来事か記載されているか
3. **場所の記載**: どこで（居室・食堂・フロア等）起きたことか記載されているか
4. **変化の比較**: 「普段は〜だが、今日は〜」のような変化や比較が記載されているか
5. **本人の反応**: 本人の表情・言動・反応が具体的に記載されているか

## 判定ルール
- 60点以上: ○（合格）
- 60点未満: ×（不合格）

## 対象者: ${data.target_name || '不明'}
## 記録日: ${data.date || '不明'}

## 新人が書いた気付き:
「${data.notice_text}」

## 回答形式（必ずJSON）:
{
  "judgement": "○ or ×",
  "short_comment": "総評コメント（1〜2文）",
  "good_points": ["良い点1", "良い点2"],
  "missing_points": ["不足点1", "不足点2"],
  "improvement_example": "改善例文（不合格の場合のみ）"
}`;
}

// ===== STEP2 プロンプト =====
function buildStep2Prompt(data) {
    const hypothesesText = (data.hypotheses || []).map((h, i) =>
        `仮説${i + 1}: なぜ①「${h.why1}」→ なぜ②「${h.why2 || '未記入'}」→ なぜ③「${h.why3 || '未記入'}」→ 支援「${h.support || '未記入'}」`
    ).join('\n');

    return `あなたは介護施設の新人研修プログラムの採点AIです。
新人職員が利用者様の変化に対して立てた「仮説思考」を採点してください。

## 採点基準（各20点、合計100点）
1. **変化の具体性**: 気付いた変化が具体的に記載されているか
2. **仮説の数**: 3つ以上の仮説が立てられているか
3. **掘り下げ**: 「なぜ？」が2段階以上掘り下げられているか
4. **支援計画**: 各仮説に対する支援計画が具体的か
5. **優先順位**: 仮説に優先順位がつけられているか

## 判定ルール
- 60点以上: ○（合格）
- 60点未満: ×（不合格）

## 対象者: ${data.target_name || '不明'}
## 気付いた変化:
「${data.change_noticed}」

## 仮説:
${hypothesesText}

## 優先順位の理由: ${data.priority_reason || '未記入'}
## 期待する変化: ${data.expected_change || '未記入'}

## 回答形式（必ずJSON）:
{
  "judgement": "○ or ×",
  "short_comment": "総評コメント（1〜2文）",
  "good_points": ["良い点1", "良い点2"],
  "missing_points": ["不足点1", "不足点2"],
  "improvement_example": "改善例文（不合格の場合のみ）"
}`;
}

// ===== STEP3 プロンプト =====
function buildStep3Prompt(data) {
    const ref = data.reflection || {};
    return `あなたは介護施設の新人研修プログラムの採点AIです。
新人職員が行った支援の「振り返り」を採点してください。

## 採点基準（各約17点、合計100点）
1. **気付きの具体性**: 気付きが具体的に記載されているか
2. **支援内容**: 行った支援が具体的に記載されているか
3. **理由の論理性**: なぜその支援を行ったか理由が明確か
4. **変化の予測**: 支援後の変化予測が記載されているか
5. **反応の記録**: 本人の反応が具体的に記録されているか
6. **判断と理由**: 継続/変更/終了の判断と理由が明確か

## 判定ルール
- 60点以上: ○（合格）
- 60点未満: ×（不合格）

## 対象者: ${data.target_name || '不明'}
## 振り返り内容:
- 気付き: ${ref.notice || '未記入'}
- 支援内容: ${ref.support || '未記入'}
- 理由: ${ref.reason || '未記入'}
- 変化の予測: ${ref.prediction || '未記入'}
- 本人の反応: ${ref.reaction || '未記入'}
- 判断: ${ref.decision || '未記入'}
- 判断の理由: ${ref.decisionReason || '未記入'}

## 回答形式（必ずJSON）:
{
  "judgement": "○ or ×",
  "short_comment": "総評コメント（1〜2文）",
  "good_points": ["良い点1", "良い点2"],
  "missing_points": ["不足点1", "不足点2"],
  "improvement_example": "改善例文（不合格の場合のみ）"
}`;
}
