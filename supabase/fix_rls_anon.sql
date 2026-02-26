-- 既存ポリシーを削除してから再作成（貼り付けてRunするだけ）

DROP POLICY IF EXISTS "anon_all" ON facilities;
DROP POLICY IF EXISTS "anon_all" ON staff_master;
DROP POLICY IF EXISTS "anon_all" ON care_targets;
DROP POLICY IF EXISTS "anon_all" ON assignments;
DROP POLICY IF EXISTS "anon_all" ON monthly_cycles;
DROP POLICY IF EXISTS "anon_all" ON daily_step1;
DROP POLICY IF EXISTS "anon_all" ON step2_hypotheses;
DROP POLICY IF EXISTS "anon_all" ON daily_step3;
DROP POLICY IF EXISTS "anon_all" ON monthly_evaluations;
DROP POLICY IF EXISTS "anon_all" ON video_tasks;
DROP POLICY IF EXISTS "anon_all" ON audit_log;

CREATE POLICY "anon_all" ON facilities          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON staff_master        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON care_targets        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON assignments         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON monthly_cycles      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON daily_step1         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON step2_hypotheses    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON daily_step3         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON monthly_evaluations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON video_tasks         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_all" ON audit_log           FOR ALL TO anon USING (true) WITH CHECK (true);

SELECT 'RLSポリシー更新完了！' AS status;
