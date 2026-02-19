/* ============================================
   api.js — バックエンド通信レイヤー
   Phase 1: ローカル処理（storage.js経由）
   Phase 3: Firebase/Supabase に差替え
   ============================================ */

const API = {
    // ===== 認証 =====
    async login(staffId, password) {
        // Phase 3: await supabase.auth.signInWithPassword(...)
        return Auth.login(staffId, password);
    },

    async logout() {
        return Auth.logout();
    },

    // ===== STEP1 =====
    async saveStep1(record) {
        // Phase 3: await supabase.from('daily_step1').insert(record)
        return DB.save('daily_step1', record);
    },

    async getStep1Records(staffId, yearMonth) {
        return DB.getByMonth('daily_step1', staffId, yearMonth);
    },

    // ===== STEP2 =====
    async saveStep2(record) {
        return DB.save('step2_hypotheses', record);
    },

    async getStep2Records(staffId, yearMonth) {
        return DB.getByMonth('step2_hypotheses', staffId, yearMonth);
    },

    // ===== STEP3 =====
    async saveStep3(record) {
        return DB.save('daily_step3', record);
    },

    async getStep3Records(staffId, yearMonth) {
        return DB.getByMonth('daily_step3', staffId, yearMonth);
    },

    // ===== STEP4 =====
    async saveStep4(record) {
        return DB.save('step4_reports', record);
    },

    async getStep4Reports(staffId) {
        return DB.getAll('step4_reports', { staff_id: staffId });
    },

    // ===== 動画課題 =====
    async getVideoTasks(staffId) {
        return DB.getAll('video_tasks', { staff_id: staffId });
    },

    async updateVideoTask(taskId, data) {
        return DB.update('video_tasks', taskId, data);
    },

    // ===== 月次評価 =====
    async getMonthlyResults(staffId) {
        return DB.getAll('monthly_results', { staff_id: staffId });
    },

    async saveMonthlyResult(record) {
        return DB.save('monthly_results', record);
    },

    // ===== 対象者 =====
    async getAssignments(staffId) {
        return DB.getAll('assignments', { staff_id: staffId, is_active: true });
    },

    // ===== AI判定（Phase 3: Gemini API） =====
    async judgeStep1(noticeText) {
        // Phase 3: サーバーサイドからGemini API呼び出し
        return Step1.judge(noticeText);
    },

    async judgeStep2(changeText, hypotheses) {
        return Step2.judge(changeText, hypotheses);
    },

    async judgeStep3(data) {
        return Step3.judge(data);
    },

    async judgeStep4(caseData) {
        return Step4.judge(caseData);
    }
};
