-- ============================================
-- RLS ポリシー修正 — anon ロールにもアクセスを許可
-- Supabase SQL Editor で実行してください
-- ============================================

-- anon ロール（未認証）にも全テーブルへのアクセスを許可
-- ※ 開発中の設定。本番前にポリシーを厳格化すること

CREATE POLICY IF NOT EXISTS "anon_all" ON facilities          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON staff_master        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON care_targets        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON assignments         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON monthly_cycles      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON daily_step1         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON step2_hypotheses    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON daily_step3         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON monthly_evaluations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON video_tasks         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_all" ON audit_log           FOR ALL TO anon USING (true) WITH CHECK (true);

SELECT 'RLSポリシー更新完了！' AS status;
