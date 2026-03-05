-- ============================================
-- staff_master に離職管理カラム追加
-- SQL Editorで実行してください
-- ============================================

ALTER TABLE staff_master ADD COLUMN IF NOT EXISTS left_date DATE;
ALTER TABLE staff_master ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE staff_master ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'demo1234';

SELECT 'スタッフ管理カラム追加完了！' AS status;
