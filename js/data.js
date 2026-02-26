/* ============================================
   data.js — 定数・評価基準・設定データ
   ============================================ */

// 月次サイクル日数
const MONTHLY_CYCLE = {
  inputStart: 26,   // 入力開始（前月26日）
  inputEnd: 10,     // 入力終了（当月10日）
  evalStart: 11,    // 評価開始
  evalEnd: 17,      // 評価終了
  fbStart: 18,      // フィードバック開始
  fbEnd: 25         // フィードバック終了
};

// STEP定義
const STEPS = {
  1: { name: '気付き', fullName: 'STEP1 アセスメント・気付き', careLevel: '区分6 / 介護5' },
  2: { name: '仮説思考', fullName: 'STEP2 仮説思考', careLevel: '区分5 / 介護4' },
  3: { name: '振り返り', fullName: 'STEP3 振り返り', careLevel: '区分4 / 介護3' },
  4: { name: '症例報告', fullName: 'STEP4 症例報告', careLevel: '他事業利用者' }
};

// 勤務形態別 最低記載日数
const MIN_DAYS = {
  day: 6, // 日勤
  night: 2, // 夜勤専従・週2回夜勤
  nightOnce: 3  // 週1回夜勤
};

// 動画課題（各STEPに3本ずつ）
const VIDEO_TASKS = {
  1: [
    { id: 'STEP1_1', title: '動画課題①', step: 1 },
    { id: 'STEP1_2', title: '動画課題②', step: 1 },
    { id: 'STEP1_3', title: '動画課題③', step: 1 }
  ],
  2: [
    { id: 'STEP2_1', title: '動画課題①', step: 2 },
    { id: 'STEP2_2', title: '動画課題②', step: 2 },
    { id: 'STEP2_3', title: '動画課題③', step: 2 }
  ],
  3: [
    { id: 'STEP3_1', title: '動画課題①', step: 3 },
    { id: 'STEP3_2', title: '動画課題②', step: 3 },
    { id: 'STEP3_3', title: '動画課題③', step: 3 }
  ],
  4: [
    { id: 'STEP4', title: '総合テスト', step: 4 }
  ]
};

// 採点6観点（100点満点）
const SCORING_CRITERIA = [
  {
    id: 1,
    name: '気づいた変化の明確さ',
    maxScore: 15,
    levels: [
      { score: 15, label: '高', desc: '変化が具体的で、日時・状況・本人の言動が的確に記録されている。比較構造あり。' },
      { score: 10, label: '中', desc: '変化は記載されているが、場面や状況の記述が曖昧。' },
      { score: 5, label: '低', desc: '変化が抽象的で具体性に欠ける。' }
    ]
  },
  {
    id: 2,
    name: '要因の多層的分析',
    maxScore: 20,
    levels: [
      { score: 20, label: '高', desc: '身体・心理・環境・社会的要因から3つ以上の仮説を立て、「なぜ？」を3段階以上掘り下げている。' },
      { score: 13, label: '中', desc: '仮説は2つ以上あるが、掘り下げが1〜2段階にとどまっている。' },
      { score: 7, label: '低', desc: '仮説が1つのみ、または表面的な原因のみ。' }
    ]
  },
  {
    id: 3,
    name: '要因の関連性と優先順位',
    maxScore: 15,
    levels: [
      { score: 15, label: '高', desc: '根拠に基づいた優先順位。「もっとも急性かつ可逆的な要因」を選定。' },
      { score: 10, label: '中', desc: '優先はつけているが、根拠が弱い、またはやや主観的。' },
      { score: 5, label: '低', desc: '優先順位なし、または説明が不明確。' }
    ]
  },
  {
    id: 4,
    name: '検証計画の論理性',
    maxScore: 15,
    levels: [
      { score: 15, label: '高', desc: '優先仮説に対して具体的な観察・評価指標・再評価タイミングまで設計。' },
      { score: 10, label: '中', desc: '観察計画はあるが、評価指標や期間が不明確。' },
      { score: 5, label: '低', desc: '検証計画が具体性に欠ける。' }
    ]
  },
  {
    id: 5,
    name: '支援計画の実効性',
    maxScore: 20,
    levels: [
      { score: 20, label: '高', desc: '本人の意思・ニーズを反映した具体的支援。多職種連携を含む。' },
      { score: 13, label: '中', desc: '支援は記載されているが、本人の意思確認や連携が不十分。' },
      { score: 7, label: '低', desc: '一方的な支援計画。本人視点が欠落。' }
    ]
  },
  {
    id: 6,
    name: '振り返り・修正力',
    maxScore: 15,
    levels: [
      { score: 15, label: '高', desc: '結果を評価し、次の仮説や改善に繋げる力がある。本人の変化を確認後に判断修正。' },
      { score: 10, label: '中', desc: '振り返りはあるが、次の改善に具体性が不足。' },
      { score: 5, label: '低', desc: '振り返りが形式的で改善に繋がっていない。' }
    ]
  }
];

// レベル判定
const LEVEL_THRESHOLDS = [
  { min: 90, max: 100, level: 3, grade: '1級', name: 'レベル3', label: 'リーダー候補', hrPoints: 10 },
  { min: 80, max: 89, level: 3, grade: '1級', name: 'レベル3', label: '仮説100点', hrPoints: 8 },
  { min: 60, max: 79, level: 2, grade: '2級', name: 'レベル2', label: '仮説80点', hrPoints: 6 },
  { min: 40, max: 59, level: 1, grade: '3級', name: 'レベル1', label: '気付き100点', hrPoints: 4 },
  { min: 0, max: 39, level: 0, grade: '-', name: '新人', label: '気付き100点', hrPoints: 2 }
];

// 合格条件
const PASS_RULES = {
  firstAttemptScore: 80,       // 初回は80点以上で合格
  subsequentPerfectStreak: 2,  // 2回目以降は連続100点回数
  subsequentPerfectScore: 100, // 100点
  stagnationMonths: 8,         // 8ヶ月同一STEP滞在でペナルティ
  stagnationPenalty: 2         // 人事評価2点減点（繰返し）
};

// 人事評価との連動ポイント
const HR_POINTS_MAP = [
  { step: 1, score: 100, hrPoints: 2, label: '気付100点' },
  { step: 1, score: 100, hrPoints: 4, label: '気付き100点' },
  { step: 2, score: 80, hrPoints: 6, label: '仮説80点' },
  { step: 2, score: 100, hrPoints: 8, label: '仮説100点' },
  { step: 2, score: 100, hrPoints: 8, label: '仮説100点' },
  { step: 4, score: null, hrPoints: 10, label: '症例報告②' }
];

// デモ用スタッフデータ
const DEMO_STAFF = [
  {
    staff_id: 'FC001',
    name: '山田花子',
    password: 'demo1234',
    role: 'staff',
    facility_id: 'F001',
    facility_name: 'グループホーム',
    hire_date: '2025-10-01',
    work_type: 'day',
    current_step: 1,
    program_start_month: '2026-01'
  },
  {
    staff_id: 'FC002',
    name: '鈴木太郎',
    password: 'demo1234',
    role: 'admin',
    facility_id: 'F001',
    facility_name: 'グループホーム',
    hire_date: '2020-04-01',
    work_type: 'day',
    current_step: null,
    program_start_month: null
  },
  {
    staff_id: 'FC003',
    name: '佐藤部長',
    password: 'demo1234',
    role: 'exec',
    facility_id: 'HQ',
    facility_name: '本社',
    hire_date: '2015-04-01',
    work_type: 'day',
    current_step: null,
    program_start_month: null
  }
];

// デモ用対象者（管理者画面から追加・削除可能）
const DEMO_TARGETS = [
  { id: 'T001', name: '佐藤 隆', care_level: '介護5', step: 1 },
  { id: 'T002', name: '田中 美子', care_level: '介護5', step: 1 },
  { id: 'T003', name: '鈴木 一郎', care_level: '介護4', step: 2 },
  { id: 'T004', name: '高橋 和子', care_level: '介護3', step: 1 },
  { id: 'T005', name: '伊藤 正男', care_level: '介護4', step: 1 },
  { id: 'T006', name: '渡辺 幸子', care_level: '介護3', step: 2 },
];
