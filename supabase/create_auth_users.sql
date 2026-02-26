-- ============================================
-- Supabase Auth ユーザー作成 SQL
-- Supabase SQL Editor で実行してください
-- ============================================
-- 注意: auth.usersへの直接INSERTはSupabaseダッシュボードの
-- Authentication > Users から行うか、以下のSQLを使用します

-- デモユーザーを作成（実行後にパスワード変更推奨）
SELECT supabase_auth.create_user(
  email := 'FC001@freecare.local',
  password := 'demo1234',
  email_confirm := true,
  user_metadata := '{"staff_id": "FC001", "name": "山田花子", "role": "staff"}'
);

SELECT supabase_auth.create_user(
  email := 'FC002@freecare.local',
  password := 'demo1234',
  email_confirm := true,
  user_metadata := '{"staff_id": "FC002", "name": "鈴木太郎", "role": "admin"}'
);

SELECT supabase_auth.create_user(
  email := 'FC003@freecare.local',
  password := 'demo1234',
  email_confirm := true,
  user_metadata := '{"staff_id": "FC003", "name": "佐藤部長", "role": "exec"}'
);
