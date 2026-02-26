-- CHECK制約を削除（×と☓の文字コード不一致問題を解消）
-- SQL Editorに貼ってRunするだけでOK

ALTER TABLE daily_step1         DROP CONSTRAINT IF EXISTS daily_step1_ai_judgement_check;
ALTER TABLE step2_hypotheses    DROP CONSTRAINT IF EXISTS step2_hypotheses_ai_judgement_check;
ALTER TABLE daily_step3         DROP CONSTRAINT IF EXISTS daily_step3_ai_judgement_check;
ALTER TABLE monthly_evaluations DROP CONSTRAINT IF EXISTS monthly_evaluations_ai_judgement_check;

SELECT 'CHECK制約削除完了！' AS status;
