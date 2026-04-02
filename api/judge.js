/* ============================================
   api/judge.js — Vercel サーバーレス関数
   Gemini API でAI採点を実行（6観点100点満点）
   ============================================ */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

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
        // 施設固有の知識を取得
        const { data: knowledge } = await supabase
            .from('ai_knowledge')
            .select('title, content');
        const customRules = (knowledge || []).map(k => `【${k.title}】: ${k.content}`).join('\n');

        const geminiResponse = await callGemini(GEMINI_API_KEY, prompt, customRules);
        const result = parseGeminiResponse(geminiResponse);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Gemini API error:', error);
        return res.status(500).json({ error: 'AI判定に失敗しました', detail: error.message });
    }
}

// ===== Gemini API 呼び出し =====
async function callGemini(apiKey, prompt, customRules = '') {
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const fullPrompt = `
以下の指示に従って、介護記録の採点を行ってください。

【施設固有の特別ルール・知識】:
${customRules || '特になし'}

----------------------------
${prompt}
`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024
            }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini API Error details:', errText);
        let errorMsg = `Gemini API エラー: ${response.status}`;
        try {
            const errJson = JSON.parse(errText);
            if (errJson.error && errJson.error.message) {
                errorMsg += ` - ${errJson.error.message}`;
            }
        } catch (e) {}
        
        if (response.status === 429) {
            let detailSuffix = "";
            try {
                const errJson = JSON.parse(errText);
                if (errJson.error && errJson.error.message) {
                    detailSuffix = ` (${errJson.error.message})`;
                }
            } catch(e) {}
            throw new Error("ただいまAIへのアクセスが集中しており、利用制限がかかっています。" + detailSuffix + " 約1分おいてから再度お試しください。");
        }
        throw new Error(errorMsg);
    }

    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
}

// ===== レスポンスパース =====
function parseGeminiResponse(text) {
    if (!text) throw new Error('AI回答が空です');
    try {
        let cleanText = text.trim();
        // markdown装飾除去
        cleanText = cleanText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '');
        const start = cleanText.indexOf('{');
        const end = cleanText.lastIndexOf('}');
        if (start !== -1 && end !== -1) cleanText = cleanText.substring(start, end + 1);
        // 末尾カンマ除去
        cleanText = cleanText.replace(/,\s*([}\]])/g, '$1');
        // 制御文字除去（9=Tab, 10=LF以外の0-31を除去。特に入り込みやすい13=CRを確実に消す）
        cleanText = cleanText.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
        const result = JSON.parse(cleanText);
        if (!result.applied_knowledge) result.applied_knowledge = '';
        return result;
    } catch (e) {
        console.error('JSON Parse Error in judge.js:', e, 'Raw text:', text);
        return {
            judgement: '\u00d7',
            score: 0,
            short_comment: 'AI評価の解析に失敗しました。',
            good_points: [],
            missing_points: ['エラー: AI解析失敗', '生データ一部: ' + text.substring(0, 50) + '...'],
            improvement_example: '申し訳ありません。AIの回答形式が正しくなかったため、再度送信をお試しください。内容をより具体的に（いつ・どこで・誰が等）含めると成功しやすくなります。',
            applied_knowledge: 'JSON解析エラーが発生しました'
        };
    }
}

// ==========================================
// 共通の6観点 採点基準ルーブリック
// （評価シートに基づく）
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

const IMPORTANT_RULES = `
## ⚠️ 重要な評価ルール

‼️‼️ 絶対ルール: missing_pointsが1つでもあるならjudgementは必ず「×」にすること。例外なし。

1. **記述の長さは一切評価に含めない**: 文字数は採点基準に入れてはいけない。
   - 1行でも具体的な状況（時間・場所・反応）が含まれていれば高得点をつけてよい。
   - 逆に長文でも中身が曖昧・抽象的なら低得点にする。
   - 短い＝悪い、長い＝良いという判断は絶対にしないこと。
2. **具体性のチェック項目**: 以下の要素が含まれているかで判断する。全て必須ではないが多いほど高評価。
   - いつ（時間帯・タイミング: 朝食後、入浴中、夜間など）
   - どこで（場所: 食堂、居室、フロア、トイレなど）
   - 誰が（対象者の名前や「本人」の記載）
   - どんな状況（何をしていた時、何が起きたか）
   - 本人の反応（表情・言葉・行動の変化）
3. **improvement_example は添削（赤ペン先生）方式で書く**: 
   - 新人が書いた文章をそのままコピーし、足りない部分を【】で挿入する。
   - 例: 元の文「Aさんがお腹が痛いと言っていた」
   - → 添削後「【昼食後、食堂で】Aさんが【お腹をさすりながら】お腹が痛いと言っていた【。表情はやや苦しそうで、いつもは完食するが今日は半分残していた】」
   - 元の文を一切変えずに、追加すべき情報を【】で差し込むこと。
   - 元の文とは全然違う新しい文章を書くのは絶対NG。
`;

const JSON_FORMAT = `
## 採点手順（必ず守ること）
1. まず、入力文に「いつ・どこで・誰が・どう変化した」が全て含まれているか確認し、足りない情報を \`missing_points\` の配列に洗い出す。
2. もし \`missing_points\` が1つでも存在する場合、あなたの \`judgement\` は【絶対に ×】にしなければなりません。「惜しい」「よく書けている」と思っても、不足点があるなら × です。
3. 不足点がゼロの場合のみ、\`judgement\` を【○】にします。
4. \`judgement\` が【×】の場合は、必ず \`improvement_example\`（添削例）を作成してください。
   ・入力文をそのままコピーし、足りない情報を【】で差し込む。
   ・例: 入力「Aさんがお腹が痛いと言っていた」
     → 添削例「【昼食後、食堂で】Aさんが【お腹をさすりながら】お腹が痛いと言っていた」
5. \`judgement\` が【○】の場合は、\`improvement_example\` を空文字 "" にします。

## 【重要】回答形式（絶対に厳守）:
- 出力は必ず有効なJSONであること
- 文字列内に改行を入れる場合は必ず 「\\n」 とエスケープすること
- 途中で勝手なフォーマット崩れや余計な記号を入れないこと

回答フォーマット:
{
  "judgement": "○ または ×",
  "score": 合計スコア（0〜100の整数）,
  "breakdown": {
    "change_clarity": 10,
    "multi_factor": 7,
    "priority": 5,
    "verification": 5,
    "support_plan": 5,
    "reflection": 5
  },
  "short_comment": "総評（1〜2文）",
  "good_points": ["良い点1", "良い点2"],
  "missing_points": ["不足点1", "不足点2"],
  "improvement_example": "【添削方式】入力文をコピーし足りない部分を【】で補った文",
  "applied_knowledge": "今回の判定に活用した施設固有ルールや知識があれば簡潔に記載（なければ空文字）"
}
`;

// ===== STEP1 プロンプト =====
function buildStep1Prompt(data) {
    return `あなたは介護施設「フリーケア」の新人研修プログラムの採点AIです。
新人職員が利用者様について記録した「気付き（アセスメント）」を採点してください。

## STEPの説明
STEP1は「気付き」の段階です。新人が利用者の日々の変化に気づく力を育てます。
対象は区分6／介護5の利用者です。

${IMPORTANT_RULES}

${SCORING_RUBRIC}

## 判定ルール
- missing_pointsが1つでもある場合: 必ず ×（不合格）にする
- 不足点がゼロで、かつ60点以上: ○（合格）
- 具体的な情報が欠けているのに○にしてはいけない

## STEP1での重点評価
STEP1は「気付き」の段階のため、以下を重視してください：
- 観点1（気づいた変化の明確さ）: 日時・場所・場面・本人の反応が具体的か → 最重要
- 観点2（要因の多層的分析）: 気付きの段階なので最小限でOK。仮説の芽があればプラス
- 観点5（支援計画の実効性）: 気付きの段階なので記載なくてもOK（5点をデフォルト付与）
- 観点6（振り返り・修正力）: 気付きの段階なので記載なくてもOK（5点をデフォルト付与）

## Few-shot 例（採点の参考）

### 例1: 不合格（×）の入力:
入力: 「Aさんがお腹が痛いと言っていた」
→ 不足点: ["いつ（時間帯）の記載がありません", "どこで（食堂・居室など場所）の記載がありません", "本人の表情や行動の変化の記載がありません"]
→ 改善例（元の文を活かして足りない部分を追加）: 「【昼食後、食堂で】Aさんがお腹が痛いと言っていた。【お腹をさすりながら訴え、表情はやや苦しそうだった。いつもは完食するが今日は半分残していた】」
※元の「Aさんがお腹が痛いと言っていた」はそのまま残し、場所・時間帯・本人の反応だけを追加している

### 例2: 合格（○）の入力:
入力: 「14時頃、居室でBさんがベッドに横になったまま起き上がれない様子だった。声をかけると『足がだるい』と言い、表情がいつもより暗かった。朝の体操には参加していたが、午後から動きが鈍くなっていた」
→ 良い点: ["時間帯が明記されている", "場所（居室）が明記されている", "本人の言葉と表情の記載がある", "時間経過（朝→午後）の変化を捉えている"]

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

${IMPORTANT_RULES}

${SCORING_RUBRIC}

## 判定ルール
- missing_pointsが1つでもある場合: 必ず ×（不合格）にする
- 不足点がゼロで、かつ60点以上: ○（合格）
- 具体的な情報が欠けているのに○にしてはいけない

## STEP2での重点評価
STEP2は「仮説思考」の段階のため、以下を全て重視してください：
- 観点1（変化の明確さ）: 変化が具体的に記載されているか
- 観点2（要因の多層的分析）: 3つ以上の仮説、「なぜ？」を3段階掘り下げているか → 最重要
- 観点3（優先順位）: 根拠に基づいた優先順位がついているか
- 観点4（検証計画）: 仮説を検証する計画があるか
- 観点5（支援計画）: 支援計画が具体的で本人視点があるか

## Few-shot 例（採点の参考）

### 例1: 不合格（×）の入力
仮説: なぜ①「熱がある」→ なぜ②「風邪を引いたから」
優先順位の理由: 「まずは熱を下げることが大事だから」
→ 不足点: ["「なぜ風邪を引いたのか」環境要因や生活習慣の深掘りが不足しています", "支援計画（熱に対して何をするか）が具体的に記載されていません", "優先順位の理由が主観的です"]
→ 改善例（元の文を活かして足りない部分を追加）: 「なぜ①熱がある → なぜ②【昨日薄着で過ごしていたため】風邪を引いたから → なぜ③【本人が寒さを自覚しにくいから】 → 【支援: まず受診し、今後は居室の室温調整をスタッフで行う】」

### 例2: 合格（○）の入力
仮説: なぜ①「食事を残す」→ なぜ②「義歯が合わず痛むから」→ なぜ③「最近痩せて歯茎が合わなくなったから」→ 支援「歯科受診の手配と、一時的な食事形態の変更を提案する」
優先順位の理由: 「低栄養による短期間での体力低下を最優先で防ぐべきであり、歯科受診によりすぐに改善が見込める可逆的要因だから」
→ 良い点: ["「なぜ」を3段階深掘りできている", "優先順位の理由が可逆性とリスクに基づいて明確", "支援計画が具体的"]

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

${IMPORTANT_RULES}

${SCORING_RUBRIC}

## 判定ルール
- missing_pointsが1つでもある場合: 必ず ×（不合格）にする
- 不足点がゼロで、かつ60点以上: ○（合格）
- 具体的な情報が欠けているのに○にしてはいけない

## STEP3での重点評価
STEP3は「振り返り」の段階のため、6観点すべてを重視してください：
- 観点1（変化の明確さ）: 支援前後の変化が明確か
- 観点2（要因の多層的分析）: 結果から新たな分析ができているか
- 観点5（支援計画）: 行った支援が具体的で本人視点があるか
- 観点6（振り返り・修正力）: 結果を評価し次の改善に繋げているか → 最重要

## Few-shot 例（採点の参考）

### 例1: 不合格（×）の入力
行った支援: 「声かけをした」
本人の反応: 「とくになし」
判断: 「継続」
判断の理由: 「様子をみるため」
→ 不足点: ["行った支援が抽象的で、どう声をかけたのか不明確です", "反応から得られた具体的な変化が書かれていません", "漠然と「様子を見る」としており、次の判断の理由に論理性がありません"]
→ 改善例（元の文を活かして足りない部分を追加）: 「【食事への不安を取り除くため、目線を合わせてゆっくりと】声かけをした。本人の反応: 【最初は無言だったが、少し表情が和らいだ。】判断の理由: 【一定の安心感は得られたため、この関わりを】継続【しつつ、次は〇〇も試して様子を見る】」

### 例2: 合格（○）の入力
行った支援: 「居室の室温を2度上げ、就寝前に温かいお茶を提供した」
本人の反応: 「『体が温まった』と言ってスムーズに入眠され、夜間のトイレコールが3回から1回に減った」
判断: 「継続」
判断の理由: 「予測通り、冷えによる頻尿が改善され睡眠確保に繋がったため。今後は水分量に注意しつつ継続する」
→ 良い点: ["具体的な支援内容とその結果が明確", "事前の予測と実際の反応を比較して効果判定できている", "結果をもとに論理的に次の判断を下せている"]

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
