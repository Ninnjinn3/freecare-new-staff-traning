import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { staff_id, year_month } = req.body;
    if (!staff_id) return res.status(400).json({ error: 'staff_id is required' });

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const apiKey = process.env.GEMINI_API_KEY;

    try {
        // 1) 修正が必要な（ai_improve が空、または ai_comment が不完全な）レコードを取得
        // 全期間の記録を対象にする（year_month フィルターを解除）
        const { data: records, error } = await supabase
            .from('daily_step1')
            .select('*')
            .eq('staff_id', staff_id)
            .or('ai_improve.eq."",ai_improve.is.null,ai_comment.ilike.%AIのフィードバックはありません%,ai_comment.ilike.%{%') 
            .order('date', { ascending: false });

        if (error) throw error;
        if (!records || records.length === 0) {
            return res.status(200).json({ success: true, message: '修正が必要なレコードはありませんでした', count: 0 });
        }

        let fixedCount = 0;
        const results = [];

        for (const record of records) {
            try {
                // Gemini APIを呼び出して再評価
                const aiResult = await callGeminiJudge(apiKey, record, supabase);
                
                // DB更新
                const { error: updateError } = await supabase
                    .from('daily_step1')
                    .update({
                        ai_judgement: aiResult.judgement,
                        ai_comment: aiResult.short_comment,
                        ai_good_points: aiResult.good_points,
                        ai_missing: aiResult.missing_points,
                        ai_improve: aiResult.improvement_example
                    })
                    .eq('id', record.id);

                if (updateError) throw updateError;
                fixedCount++;
                results.push({ date: record.date, success: true });
            } catch (e) {
                console.error(`Failed to re-judge record ${record.id}:`, e);
                results.push({ date: record.date, success: false, error: e.message });
            }
        }

        return res.status(200).json({ success: true, count: fixedCount, results });

    } catch (e) {
        console.error('Re-judge API Error:', e);
        return res.status(500).json({ error: e.message });
    }
}

async function callGeminiJudge(apiKey, record, supabase) {
    // 施設固有の知識を取得
    const { data: knowledge } = await supabase
        .from('ai_knowledge')
        .select('title, content');
    const customRules = (knowledge || []).map(k => `【${k.title}】: ${k.content}`).join('\n');

    const prompt = `
以下の指示と施設固有のルールに従って、介護記録を評価し、JSON形式で返してください。

【施設固有の特別ルール・知識】:
${customRules || '特になし'}

----------------------------
【日付】: ${record.date}
【対象者】: ${record.target_name || '未指定'}
【気付き】: ${record.notice_text}

出力形式:
{
  "judgement": "○" または "☓",
  "score": (0-100),
  "short_comment": "200文字程度のまとめ",
  "good_points": ["良い点1", "良い点2"],
  "missing_points": ["不足点1"],
  "improvement_example": "改善アドバイス"
}
`;

    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        })
    });

    if (!resp.ok) throw new Error(`Gemini Error: ${resp.status}`);
    const json = await resp.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // パース処理
    let cleanText = text.trim();
    const start = cleanText.indexOf('{');
    const end = cleanText.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
        cleanText = cleanText.substring(start, end + 1);
    }
    return JSON.parse(cleanText);
}
