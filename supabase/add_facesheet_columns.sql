-- ============================================================
-- care_targets テーブルにフェイスシート・アセスメントカラムを追加
-- Supabase SQL Editor で実行してください
-- ============================================================

ALTER TABLE care_targets
  ADD COLUMN IF NOT EXISTS age             TEXT,
  ADD COLUMN IF NOT EXISTS gender          TEXT,
  ADD COLUMN IF NOT EXISTS disease         TEXT,
  ADD COLUMN IF NOT EXISTS disease_history TEXT,
  ADD COLUMN IF NOT EXISTS infection       TEXT,
  ADD COLUMN IF NOT EXISTS medication      TEXT,
  ADD COLUMN IF NOT EXISTS medication_mgmt TEXT,
  ADD COLUMN IF NOT EXISTS family          TEXT,
  ADD COLUMN IF NOT EXISTS family_relation TEXT,
  ADD COLUMN IF NOT EXISTS service_reason  TEXT,
  ADD COLUMN IF NOT EXISTS schedule        TEXT,
  ADD COLUMN IF NOT EXISTS services        TEXT,
  ADD COLUMN IF NOT EXISTS allergy         TEXT,
  ADD COLUMN IF NOT EXISTS fixation        TEXT,
  ADD COLUMN IF NOT EXISTS weakness        TEXT,
  ADD COLUMN IF NOT EXISTS caution         TEXT,
  ADD COLUMN IF NOT EXISTS personality     TEXT,
  ADD COLUMN IF NOT EXISTS money           TEXT,
  ADD COLUMN IF NOT EXISTS trusted         TEXT,
  ADD COLUMN IF NOT EXISTS safe_place      TEXT,
  ADD COLUMN IF NOT EXISTS emergency       TEXT,
  ADD COLUMN IF NOT EXISTS hobby           TEXT,
  ADD COLUMN IF NOT EXISTS preference      TEXT,
  -- アセスメント
  ADD COLUMN IF NOT EXISTS assess_date     TEXT,
  ADD COLUMN IF NOT EXISTS adl             TEXT,
  ADD COLUMN IF NOT EXISTS visit_method    TEXT,
  ADD COLUMN IF NOT EXISTS goal            TEXT,
  ADD COLUMN IF NOT EXISTS behavior        TEXT,
  ADD COLUMN IF NOT EXISTS social          TEXT,
  ADD COLUMN IF NOT EXISTS motivation      TEXT,
  ADD COLUMN IF NOT EXISTS warning_sign    TEXT;

-- ============================================================
-- サンプルデータ（既存のcare_targetsがない場合は INSERT、ある場合はUPDATE）
-- ※ facility_id は実際の値に合わせてください（例: 'F001'）
-- ============================================================

-- サンプル1: 田中 義雄さん
INSERT INTO care_targets (
  target_code, name, care_level, facility_id,
  age, gender, disease, disease_history, infection,
  medication, medication_mgmt, family, family_relation,
  service_reason, schedule, services, allergy,
  fixation, weakness, caution, personality, money,
  trusted, safe_place, emergency, hobby, preference,
  assess_date, adl, visit_method, goal, behavior,
  social, motivation, warning_sign
) VALUES (
  'T001', '田中 義雄', '要介護2', 'F001',
  '82', '男', '脳梗塞後遺症', '3年前に発症、右半身軽度麻痺が残存',
  '特になし',
  'バイアスピリン100mg、降圧剤', '家族管理',
  '妻（同居）、長男（別居・東京）', '妻とは良好、長男は月1回面会',
  '在宅での介護継続支援、リハビリ維持のため',
  '7時起床、午前中デイサービス（週3回）、午後は自宅で安静',
  'デイサービス（週3回）、訪問リハビリ（週1回）', '特になし',
  '食事の順番が決まっている', '大きな音・急な環境の変化',
  '「もう治らない」「無理だ」などの否定的な言葉',
  '温厚・内向的、慣れると冗談も言う', '妻が全額管理',
  '妻、リハビリ担当の理学療法士', '居間のソファ、デイサービスのホール',
  '妻に連絡、かかりつけ医受診',
  '将棋、時代劇鑑賞', '晩酌（ビール350ml/日）',
  '2026-03-01',
  '歩行は杖使用で自立、ADL一部介助', '妻の付き添いで受診',
  '週3回のデイサービスを継続し、右手の動作改善を目指す',
  '午前中は活動的、午後は疲れやすく休憩が必要',
  '顔なじみのスタッフには積極的に話しかける、新しい人には慣れるまで時間が必要',
  '普通（現状維持を希望）', '口数が减ると気分の落ち込みのサイン'
);

-- サンプル2: 佐藤 幸子さん
INSERT INTO care_targets (
  target_code, name, care_level, facility_id,
  age, gender, disease, disease_history, infection,
  medication, medication_mgmt, family, family_relation,
  service_reason, schedule, services, allergy,
  fixation, weakness, caution, personality, money,
  trusted, safe_place, emergency, hobby, preference,
  assess_date, adl, visit_method, goal, behavior,
  social, motivation, warning_sign
) VALUES (
  'T002', '佐藤 幸子', '要介護1', 'F001',
  '76', '女', 'アルツハイマー型認知症 軽度', '2年前に診断',
  'B型肝炎キャリア',
  'アリセプト5mg、睡眠剤', '職員管理（自己管理困難）',
  '夫（同居）、娘（近隣在住）', '夫と仲良く、娘が週2回来訪',
  '認知症進行の抑制と安心できる生活環境の確保のため',
  '8時起床、デイサービス週4回参加、夕方は手芸や音楽療法',
  'デイサービス（週4回）、訪問介護（週3回）、訪問看護（月2回）',
  '卵アレルギー',
  '自分の席・頼む飲み物の種類が決まっている',
  '知らない人への警戒心が強く、騒がしい環境が苦手',
  '「子供扱いしないで」「わかってる」など否定されると混乱する',
  '明るく社交的（慣れた人に対して）', '娘が管理',
  '娘、デイサービスの担当スタッフ', 'デイサービスの作業コーナー、自宅の居間',
  '夫・娘に連絡し、かかりつけ医・訪問看護に報告',
  '折り紙、歌唱（昭和の歌謡曲）', '喫煙なし、コーヒー好き',
  '2026-03-01',
  '歩行自立、IADL（買い物・調理）は要支援', '娘の付き添いで月1回受診',
  'デイサービスへの安定した参加と、自宅での安心した日常の維持',
  '午前中は活動的で意欲的、夕方以降は混乱しやすい傾向',
  '馴染みのスタッフとは会話がはずむが、慣れない人には無口になりやすい',
  'やや消極的（外出・新しいことへの意欲は低い）',
  '同じことを繰り返して聞く頻度が増えると不調のサイン'
);

-- サンプル3: 山本 健一さん
INSERT INTO care_targets (
  target_code, name, care_level, facility_id,
  age, gender, disease, disease_history, infection,
  medication, medication_mgmt, family, family_relation,
  service_reason, schedule, services, allergy,
  fixation, weakness, caution, personality, money,
  trusted, safe_place, emergency, hobby, preference,
  assess_date, adl, visit_method, goal, behavior,
  social, motivation, warning_sign
) VALUES (
  'T003', '山本 健一', '要支援2', 'F001',
  '68', '男', 'パーキンソン病 Hoehn-Yahr III度', '10年前に発症',
  '特になし',
  'レボドパ製剤（L-dopa）、ドパミンアゴニスト',
  '自己管理（服薬カレンダー使用）',
  '妻（同居）、子供なし',
  '妻とは仲良く支え合っている',
  '症状の進行予防と在宅生活の継続、転倒リスクの軽減',
  '7時30分起床、午前中に家事の一部（読書・ストレッチ）、週2回デイサービス',
  'デイサービス（週2回）、訪問リハビリ（週1回）',
  '特になし',
  '毎日決まった時間に薬を飲むことを重視している',
  '人混み・疲労による症状悪化',
  '「だらしない」「遅い」などの言葉（自己肯定感が下がる）',
  '几帳面・責任感が強い、プライドが高い', '自己管理（妻が補助）',
  '妻、主治医（神経内科）', '自宅の書斎、リハビリ室',
  '妻に連絡し、神経内科受診もしくは119番',
  '読書（歴史小説）、パソコン（ワードで日記）', '喫煙過去あり（現在禁煙）',
  '2026-03-01',
  '歩行はゆっくりだが自立（すくみ足あり）、ADLほぼ自立', '自力通院（電車）',
  '転倒なく在宅生活を継続し、趣味の読書・日記を維持する',
  '午前中は動きが良い（薬が効いている時間）、午後は動作緩慢になりやすい',
  '言語は流暢で知的な会話が好き、積極的に意見を言う',
  '高い（体操・リハビリへの参加意欲あり）',
  '声の小ささや動作の緩慢さが増すとオフ時間のサイン'
);
