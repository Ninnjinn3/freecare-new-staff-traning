-- ============================================
-- monthly_evaluations テーブルに新カラム追加
-- SQL Editorで実行してください
-- ============================================

-- 新しいカラムを追加（既存でなければ）
ALTER TABLE monthly_evaluations ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE monthly_evaluations ADD COLUMN IF NOT EXISTS step INTEGER;
ALTER TABLE monthly_evaluations ADD COLUMN IF NOT EXISTS passed BOOLEAN DEFAULT FALSE;
ALTER TABLE monthly_evaluations ADD COLUMN IF NOT EXISTS pass_count INTEGER DEFAULT 0;
ALTER TABLE monthly_evaluations ADD COLUMN IF NOT EXISTS fail_count INTEGER DEFAULT 0;
ALTER TABLE monthly_evaluations ADD COLUMN IF NOT EXISTS total_records INTEGER DEFAULT 0;
ALTER TABLE monthly_evaluations ADD COLUMN IF NOT EXISTS hr_points INTEGER DEFAULT 0;

SELECT '月次評価テーブル更新完了！' AS status;
