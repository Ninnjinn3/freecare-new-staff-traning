
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { staff_id, staff_name, category, message } = req.body;
    const LINE_NOTIFY_TOKEN = process.env.LINE_NOTIFY_TOKEN;

    if (!LINE_NOTIFY_TOKEN) {
        console.error('LINE_NOTIFY_TOKEN is not configured');
        return res.status(500).json({ error: '通知設定が完了していません' });
    }

    try {
        const lineMessage = `\n【問い合わせ】\nカテゴリ: ${category}\nスタッフ: ${staff_name} (${staff_id})\n内容: ${message}`;
        
        const response = await fetch('https://notify-api.line.me/api/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Bearer ${LINE_NOTIFY_TOKEN}`
            },
            body: new URLSearchParams({
                message: lineMessage
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`LINE Notify API Error: ${response.status} ${err}`);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Contact API Error:', error);
        return res.status(500).json({ error: '送信に失敗しました', detail: error.message });
    }
}
