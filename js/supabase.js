/* ============================================
   supabase.js — Supabase クライアント設定
   ============================================ */

const SUPABASE_URL = 'https://qpviuumvxnbwxutlccfx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_vCIiY9zPof_k2CfWC4SLqA_uUNcQ6jo';

// Supabase クライアント初期化（CDN経由で読み込む）
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
