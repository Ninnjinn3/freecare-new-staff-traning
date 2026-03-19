-- AI学習・ナレッジ管理テーブル
CREATE TABLE IF NOT EXISTS ai_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'text', 'file', 'link'
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- 抽出されたテキスト本文
    metadata JSONB DEFAULT '{}'::jsonb, -- ファイル名、URL、サイズ等
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS設定 (管理者のみ)
ALTER TABLE ai_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on ai_knowledge"
ON ai_knowledge
FOR ALL
USING (EXISTS (
    SELECT 1 FROM staff
    WHERE staff.staff_id = auth.uid()::text -- 簡易的なチェック（実際にはrole=adminを推奨）
    AND staff.role IN ('admin', 'exec')
));

-- 初期データ（デフォルトの採点基準など）
INSERT INTO ai_knowledge (type, title, content)
VALUES (
    'text', 
    '基本採点ポリシー', 
    '具体性を最重視してください。文字数ではなく、いつ・どこで・誰が・どう変化したかが明確に含まれているかを評価してください。'
) ON CONFLICT DO NOTHING;
