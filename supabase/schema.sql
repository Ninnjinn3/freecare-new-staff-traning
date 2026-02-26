-- ============================================
-- フリーケア新人研修アプリ — Supabase スキーマ
-- ============================================
-- 実行方法: Supabase SQL Editor に貼り付けて「Run」

-- ===== 1. 拠点マスタ =====
CREATE TABLE IF NOT EXISTS facilities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  region      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 2. スタッフマスタ =====
CREATE TABLE IF NOT EXISTS staff_master (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id              TEXT UNIQUE NOT NULL,       -- 職員ID (FC001 など)
  name                  TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('staff','admin','exec')),
  facility_id           TEXT REFERENCES facilities(id),
  facility_name         TEXT,
  hire_date             DATE,
  work_type             TEXT DEFAULT 'day' CHECK (work_type IN ('day','night','nightOnce')),
  current_step          INTEGER DEFAULT 1,
  program_start_month   TEXT,                       -- 'YYYY-MM'
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 3. 対象者（利用者）マスタ =====
CREATE TABLE IF NOT EXISTS care_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_code   TEXT UNIQUE NOT NULL,               -- T001 など
  name          TEXT NOT NULL,
  care_level    TEXT,
  facility_id   TEXT REFERENCES facilities(id),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 4. アサインメント（担当割り当て） =====
CREATE TABLE IF NOT EXISTS assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    TEXT NOT NULL REFERENCES staff_master(staff_id),
  target_id   UUID NOT NULL REFERENCES care_targets(id),
  step        INTEGER NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 5. 月次サイクル管理 =====
CREATE TABLE IF NOT EXISTS monthly_cycles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month      TEXT NOT NULL,          -- 'YYYY-MM'
  facility_id     TEXT REFERENCES facilities(id),
  input_start     DATE NOT NULL,
  input_end       DATE NOT NULL,
  eval_start      DATE NOT NULL,
  eval_end        DATE NOT NULL,
  fb_start        DATE NOT NULL,
  fb_end          DATE NOT NULL,
  is_current      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 6. STEP1 日次記録（気付き） =====
CREATE TABLE IF NOT EXISTS daily_step1 (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        TEXT NOT NULL REFERENCES staff_master(staff_id),
  target_id       UUID REFERENCES care_targets(id),
  target_name     TEXT,
  year_month      TEXT NOT NULL,
  date            DATE NOT NULL,
  notice_text     TEXT NOT NULL,
  char_count      INTEGER,
  ai_judgement    TEXT CHECK (ai_judgement IN ('○','☓')),
  ai_comment      TEXT,
  ai_good_points  JSONB,
  ai_missing      JSONB,
  ai_improve      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 7. STEP2 仮説思考記録 =====
CREATE TABLE IF NOT EXISTS step2_hypotheses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id            TEXT NOT NULL REFERENCES staff_master(staff_id),
  target_id           UUID REFERENCES care_targets(id),
  target_name         TEXT,
  year_month          TEXT NOT NULL,
  date                DATE NOT NULL,
  change_noticed      TEXT NOT NULL,
  hypotheses_json     JSONB,             -- 仮説カード配列
  priority_reason     TEXT,
  expected_change     TEXT,
  ai_judgement        TEXT CHECK (ai_judgement IN ('○','☓')),
  ai_comment          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 8. STEP3 振り返り記録 =====
CREATE TABLE IF NOT EXISTS daily_step3 (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id         TEXT NOT NULL REFERENCES staff_master(staff_id),
  target_id        UUID REFERENCES care_targets(id),
  target_name      TEXT,
  year_month       TEXT NOT NULL,
  date             DATE NOT NULL,
  reflection_json  JSONB,               -- 6項目の振り返り
  decision         TEXT CHECK (decision IN ('継続','変更','終了')),
  ai_judgement     TEXT CHECK (ai_judgement IN ('○','☓')),
  ai_comment       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 9. 月次評価 =====
CREATE TABLE IF NOT EXISTS monthly_evaluations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id          TEXT NOT NULL REFERENCES staff_master(staff_id),
  year_month        TEXT NOT NULL,
  total_score       INTEGER,
  breakdown_json    JSONB,              -- 6観点の内訳
  level             INTEGER,
  grade             TEXT,
  is_passed         BOOLEAN DEFAULT FALSE,
  admin_score       INTEGER,           -- 管理者による加点
  feedback_json     JSONB,             -- 改善アクション
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, year_month)
);

-- ===== 10. 動画課題 =====
CREATE TABLE IF NOT EXISTS video_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      TEXT NOT NULL REFERENCES staff_master(staff_id),
  task_id       TEXT NOT NULL,         -- 'STEP1_1' など
  title         TEXT,
  step          INTEGER,
  is_watched    BOOLEAN DEFAULT FALSE,
  test_score    INTEGER,
  is_passed     BOOLEAN DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, task_id)
);

-- ===== 11. 監査ログ =====
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    TEXT,
  action      TEXT NOT NULL,
  table_name  TEXT,
  record_id   UUID,
  detail      JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Row Level Security (RLS) 設定
-- ============================================

-- 全テーブルでRLSを有効化
ALTER TABLE facilities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_master        ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_targets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_cycles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_step1         ENABLE ROW LEVEL SECURITY;
ALTER TABLE step2_hypotheses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_step3         ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;

-- 現時点は認証済みユーザーに全操作を許可（Phase 3でポリシーを強化）
CREATE POLICY "authenticated_all" ON facilities          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON staff_master        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON care_targets        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON assignments         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON monthly_cycles      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON daily_step1         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON step2_hypotheses    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON daily_step3         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON monthly_evaluations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON video_tasks         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON audit_log           FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- 初期デモデータ投入
-- ============================================

-- 拠点
INSERT INTO facilities (id, name, region) VALUES
  ('F001', 'グループホーム 南', '大阪'),
  ('F002', 'グループホーム 北', '大阪'),
  ('HQ',   '本社',             '大阪')
ON CONFLICT (id) DO NOTHING;

-- スタッフ（パスワードはSupabase Authで管理するため、ここではダミー）
INSERT INTO staff_master (staff_id, name, role, facility_id, facility_name, hire_date, work_type, current_step, program_start_month) VALUES
  ('FC001', '山田花子', 'staff', 'F001', 'グループホーム 南', '2025-10-01', 'day', 1, '2026-01'),
  ('FC002', '鈴木太郎', 'admin', 'F001', 'グループホーム 南', '2020-04-01', 'day', NULL, NULL),
  ('FC003', '佐藤部長', 'exec',  'HQ',   '本社',             '2015-04-01', 'day', NULL, NULL)
ON CONFLICT (staff_id) DO NOTHING;

-- 対象者（利用者）
INSERT INTO care_targets (target_code, name, care_level, facility_id) VALUES
  ('T001', '佐藤 隆',  '介護5', 'F001'),
  ('T002', '田中 美子','介護5', 'F001'),
  ('T003', '鈴木 一郎','介護4', 'F001'),
  ('T004', '高橋 和子','介護3', 'F001'),
  ('T005', '伊藤 正男','介護4', 'F001'),
  ('T006', '渡辺 幸子','介護3', 'F001')
ON CONFLICT (target_code) DO NOTHING;

-- 完了メッセージ
SELECT 'フリーケア研修アプリDBセットアップ完了！' AS status;
