
// LINE Messaging API Handler (Updated with Group ID)

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // LINE Webhookハンドラー（ID調査用）
    if (req.body && req.body.events && req.body.events.length > 0) {
        const event = req.body.events[0];
        const source = event.source;
        const targetId = source.groupId || source.roomId || source.userId;
        console.log('--- LINE Webhook Received ---');
        console.log('Target ID:', targetId);
        console.log('Type:', source.type);
        console.log('---------------------------');
        return res.status(200).json({ targetId });
    }

    const { staff_id, staff_name, category, message } = req.body;
    const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const GROUP_ID = process.env.LINE_GROUP_ID;

    if (!CHANNEL_ACCESS_TOKEN || !GROUP_ID) {
        console.error('LINE configuration is missing');
        return res.status(500).json({ error: 'LINE通知の設定（トークンまたはグループID）が完了していません' });
    }

    try {
        const lineMessage = `【問い合わせ】\nカテゴリ: ${category}\nスタッフ: ${staff_name} (${staff_id})\n内容: ${message}`;
        
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                to: GROUP_ID,
                messages: [
                    {
                        type: 'text',
                        text: lineMessage
                    }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(`LINE Messaging API Error: ${response.status} ${JSON.stringify(err)}`);
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Contact API Error:', error);
        return res.status(500).json({ error: '送信に失敗しました', detail: error.message });
    }
}
