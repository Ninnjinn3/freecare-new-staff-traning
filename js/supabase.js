/* ============================================
   supabase.js — Supabase クライアント設定
   ============================================ */

const SUPABASE_URL = 'https://qpviuumvxnbwxutlccfx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';

// Supabase クライアント初期化（CDN経由で読み込む）
// window.supabase はライブラリ本体のため、インスタンスは別名で保持する
window.fcSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var supabase = window.fcSupabase; // 後方互換性のため残す
