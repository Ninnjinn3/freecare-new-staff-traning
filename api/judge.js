/* ============================================
   api/judge.js — Vercel サーバーレス関数
   Gemini API でAI採点を実行（6観点100点満点）
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
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch (e) {
        return {
            judgement: '○',
            score: 60,
            short_comment: text.substring(0, 200),
            good_points: [],
            missing_points: [],
            improvement_example: ''
        };
    }
}

// ==========================================
// 共通の6観点 採点基準ルーブリック
// （佐藤さんの評価シートに基づく）
// ==========================================
const SCORING_RUBRIC = `
## 採点6観点（合計100点満点）

### 観点1: 気づいた変化の明確さ（15点）
- 高(15点): 変化が具体的で、日時・状況・本人の言動が的確に記録されている。比較構造あり。
- 中(10点): 変化は記載されているが、場面や状況の記述が曖昧。
- 低(5点): 変化が抽象的で具体性に欠ける。

### 観点2: 要因の多層的分析（20点）
- 高(20点): 身体・心理・環境・社会的要因から3つ以上の仮説を立て、「なぜ？」を3段階以上掘り下げている。
- 中(13点): 仮説は2つ以上あるが、掘り下げが1〜2段階にとどまっている。
- 低(7点): 仮説が1つのみ、または表面的な原因のみ。

### 観点3: 要因の関連性と優先順位（15点）
- 高(15点): 根拠に基づいた優先順位。「もっとも急性かつ可逆的な要因」を選定。
- 中(10点): 優先はつけているが、根拠が弱い、またはやや主観的。
- 低(5点): 優先順位なし、または説明が不明確。

### 観点4: 検証計画の論理性（15点）
- 高(15点): 優先仮説に対して具体的な観察・評価指標・再評価タイミングまで設計。
- 中(10点): 観察計画はあるが、評価指標や期間が不明確。
- 低(5点): 検証計画が具体性に欠ける。

### 観点5: 支援計画の実効性（20点）
- 高(20点): 本人の意思・ニーズを反映した具体的支援。多職種連携を含む。
- 中(13点): 支援は記載されているが、本人の意思確認や連携が不十分。
- 低(7点): 一方的な支援計画。本人視点が欠落。

### 観点6: 振り返り・修正力（15点）
- 高(15点): 結果を評価し、次の仮説や改善に繋げる力がある。本人の変化を確認後に判断修正。
- 中(10点): 振り返りはあるが、次の改善に具体性が不足。
- 低(5点): 振り返りが形式的で改善に繋がっていない。
`;

const JSON_FORMAT = `
## 回答形式（必ずこのJSON形式で回答してください）:
{
  "judgement": "○ または ×",
  "score": 合計スコア（0〜100の整数）,
  "breakdown": {
    "change_clarity": 観点1のスコア,
    "multi_factor": 観点2のスコア,
    "priority": 観点3のスコア,
    "verification": 観点4のスコア,
    "support_plan": 観点5のスコア,
    "reflection": 観点6のスコア
  },
  "short_comment": "総評コメント（1〜2文、新人を励ます内容を含む）",
  "good_points": ["良い点1", "良い点2"],
  "missing_points": ["不足点1", "不足点2"],
  "improvement_example": "改善例文（不合格の場合のみ。合格なら空文字）"
}`;

// ===== STEP1 プロンプト =====
function buildStep1Prompt(data) {
    return `あなたは介護施設「フリーケア」の新人研修プログラムの採点AIです。
新人職員が利用者様について記録した「気付き（アセスメント）」を採点してください。

## STEPの説明
STEP1は「気付き」の段階です。新人が利用者の日々の変化に気づく力を育てます。
対象は区分6／介護5の利用者です。

${SCORING_RUBRIC}

## 判定ルール
- 60点以上: ○（合格）
- 60点未満: ×（不合格）

## STEP1での重点評価
STEP1は「気付き」の段階のため、以下を重視してください：
- 観点1（気づいた変化の明確さ）: 日時・場所・場面・本人の反応が具体的か → 最重要
- 観点2（要因の多層的分析）: 気付きの段階なので最小限でOK。仮説の芽があればプラス
- 観点5（支援計画の実効性）: 気付きの段階なので記載なくてもOK（5点をデフォルト付与）
- 観点6（振り返り・修正力）: 気付きの段階なので記載なくてもOK（5点をデフォルト付与）

## 対象者: ${data.target_name || '不明'}
## 記録日: ${data.date || '不明'}

## 新人が書いた気付き:
「${data.notice_text}」

${JSON_FORMAT}`;
}

// ===== STEP2 プロンプト =====
function buildStep2Prompt(data) {
    const hypothesesText = (data.hypotheses || []).map((h, i) =>
        `仮説${i + 1}: なぜ①「${h.why1}」→ なぜ②「${h.why2 || '未記入'}」→ なぜ③「${h.why3 || '未記入'}」→ 支援「${h.support || '未記入'}」（優先: ${h.priority || '未設定'}）`
    ).join('\n');

    return `あなたは介護施設「フリーケア」の新人研修プログラムの採点AIです。
新人職員が利用者様の変化に対して立てた「仮説思考」を採点してください。

## STEPの説明
STEP2は「仮説思考」の段階です。変化に気づいた後、その原因を多角的に分析し、
優先順位をつけて支援計画を立てる力を育てます。対象は区分5／介護4の利用者です。

${SCORING_RUBRIC}

## 判定ルール
- 60点以上: ○（合格）
- 60点未満: ×（不合格）

## STEP2での重点評価
STEP2は「仮説思考」の段階のため、以下を全て重視してください：
- 観点1（変化の明確さ）: 変化が具体的に記載されているか
- 観点2（要因の多層的分析）: 3つ以上の仮説、「なぜ？」を3段階掘り下げているか → 最重要
- 観点3（優先順位）: 根拠に基づいた優先順位がついているか
- 観点4（検証計画）: 仮説を検証する計画があるか
- 観点5（支援計画）: 支援計画が具体的で本人視点があるか

## 対象者: ${data.target_name || '不明'}
## 気付いた変化:
「${data.change_noticed}」

## 仮説:
${hypothesesText}

## 優先順位の理由: ${data.priority_reason || '未記入'}
## 期待する変化: ${data.expected_change || '未記入'}

${JSON_FORMAT}`;
}

// ===== STEP3 プロンプト =====
function buildStep3Prompt(data) {
    const ref = data.reflection || {};
    return `あなたは介護施設「フリーケア」の新人研修プログラムの採点AIです。
新人職員が行った支援の「振り返り」を採点してください。

## STEPの説明
STEP3は「振り返り」の段階です。実際に行った支援の結果を評価し、
次の支援を改善する力を育てます。対象は区分4／介護3の利用者です。

${SCORING_RUBRIC}

## 判定ルール
- 60点以上: ○（合格）
- 60点未満: ×（不合格）

## STEP3での重点評価
STEP3は「振り返り」の段階のため、6観点すべてを重視してください：
- 観点1（変化の明確さ）: 支援前後の変化が明確か
- 観点2（要因の多層的分析）: 結果から新たな分析ができているか
- 観点5（支援計画）: 行った支援が具体的で本人視点があるか
- 観点6（振り返り・修正力）: 結果を評価し次の改善に繋げているか → 最重要

## 対象者: ${data.target_name || '不明'}
## 振り返り内容:
- 気付き: ${ref.notice || '未記入'}
- 行った支援: ${ref.support || '未記入'}
- 支援の理由: ${ref.reason || '未記入'}
- 変化の予測: ${ref.prediction || '未記入'}
- 本人の反応: ${ref.reaction || '未記入'}
- 判断（継続/変更/終了）: ${ref.decision || '未記入'}
- 判断の理由: ${ref.decisionReason || '未記入'}

${JSON_FORMAT}`;
}
