import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    const apiKey = process.env.GEMINI_API_KEY;

    try {
        if (req.method === 'GET') {
            // 知識一覧の取得
            const { data, error } = await supabase
                .from('ai_knowledge')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === 'POST') {
            const { action, type, title, content, url, fileBase64, mimeType, id } = req.body;

            if (action === 'delete') {
                const { error } = await supabase.from('ai_knowledge').delete().eq('id', id);
                if (error) throw error;
                return res.status(200).json({ success: true });
            }

            let finalContent = content;

            // ファイルアップロードの場合 (Geminiで中身を解析)
            if (type === 'file' && fileBase64) {
                finalContent = await extractTextWithGemini(apiKey, fileBase64, mimeType);
            }

            // URLの場合、コンテンツの先頭にURLを付与（AIが参照できるように）
            if (type === 'url' && url) {
                finalContent = `[参照先URL: ${url}]\n\n${content || ''}`;
            }

            const { data, error } = await supabase.from('ai_knowledge').insert({
                type,
                title,
                content: finalContent,
                metadata: { mimeType, fileName: title, url: url }
            }).select();

            if (error) throw error;
            return res.status(200).json({ success: true, data: data[0] });
        }

    } catch (e) {
        console.error('AI Knowledge API Error:', e);
        return res.status(500).json({ error: e.message });
    }
}

async function extractTextWithGemini(apiKey, base64, mimeType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const prompt = `
以下のファイルを解析し、内容を網羅的にテキストとして抽出してください。
特に、介護記録の採点基準、ルール、マナー、施設固有の決まり事など、
後の評価AIが知識として利用できる情報を重点的に抽出してください。
出力は、構造化されたプレーンテキスト（マークダウン形式など）でお願いします。
`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64
                        }
                    }
                ]
            }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini Parse Error: ${response.status} - ${err}`);
    }

    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini could not extract text from file');
    return text;
}
