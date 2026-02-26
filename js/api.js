/* ============================================
   api.js — Supabase バックエンド通信レイヤー
   Phase 2: Supabase (PostgreSQL) に接続
   ============================================ */

const API = {

    // ===== 認証 =====

    async login(staffId, password) {
        const email = `${staffId}@freecare.local`;

        // Supabase Auth でサインイン
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
            return { success: false, error: 'IDまたはパスワードが正しくありません' };
        }

        // staff_masterからスタッフ情報を取得
        const { data: staff, error: staffError } = await supabase
            .from('staff_master')
            .select('*')
            .eq('staff_id', staffId)
            .single();

        if (staffError || !staff) {
            // staff_masterに見つからない場合はAuthメタデータから組み立て
            const meta = authData.user?.user_metadata || {};
            const fallbackUser = {
                staff_id: staffId,
                name: meta.name || staffId,
                role: meta.role || 'staff',
                facility_id: 'F001',
                facility_name: 'グループホーム',
                current_step: 1,
                work_type: 'day'
            };
            Auth.currentUser = fallbackUser;
            sessionStorage.setItem('fc_current_user', JSON.stringify(fallbackUser));
            return { success: true, user: fallbackUser };
        }

        // 正常パス
        Auth.currentUser = staff;
        sessionStorage.setItem('fc_current_user', JSON.stringify(staff));
        return { success: true, user: staff };
    },

    async logout() {
        await supabase.auth.signOut();
        return Auth.logout();
    },

    // ===== 対象者（利用者） =====

    async getTargets(facilityId) {
        const { data, error } = await supabase
            .from('care_targets')
            .select('*')
            .eq('facility_id', facilityId)
            .eq('is_active', true)
            .order('name');
        if (error) { console.error('getTargets:', error); return []; }
        return data;
    },

    async addTarget(target) {
        const { data, error } = await supabase
            .from('care_targets')
            .insert(target)
            .select()
            .single();
        if (error) { console.error('addTarget:', error); return null; }
        return data;
    },

    async deleteTarget(id) {
        const { error } = await supabase
            .from('care_targets')
            .update({ is_active: false })
            .eq('id', id);
        return !error;
    },

    // ===== STEP1 =====

    async saveStep1(record) {
        // target_idがUUID形式でない場合はnullにする（ローカルIDはT001等）
        const cleaned = { ...record };
        if (cleaned.target_id && !/^[0-9a-f-]{36}$/i.test(cleaned.target_id)) {
            cleaned.target_id = null;
        }
        const { data, error } = await supabase
            .from('daily_step1')
            .insert(cleaned)
            .select()
            .single();
        if (error) { console.error('saveStep1:', error); throw error; }
        return data;
    },

    async getStep1Records(staffId, yearMonth) {
        const { data, error } = await supabase
            .from('daily_step1')
            .select('*')
            .eq('staff_id', staffId)
            .eq('year_month', yearMonth)
            .order('date', { ascending: false });
        if (error) { console.error('getStep1Records:', error); return []; }
        return data;
    },

    // ===== STEP2 =====

    async saveStep2(record) {
        const cleaned = { ...record };
        if (cleaned.target_id && !/^[0-9a-f-]{36}$/i.test(cleaned.target_id)) cleaned.target_id = null;
        const { data, error } = await supabase
            .from('step2_hypotheses')
            .insert(cleaned)
            .select()
            .single();
        if (error) { console.error('saveStep2:', error); throw error; }
        return data;
    },

    async getStep2Records(staffId, yearMonth) {
        const { data, error } = await supabase
            .from('step2_hypotheses')
            .select('*')
            .eq('staff_id', staffId)
            .eq('year_month', yearMonth)
            .order('date', { ascending: false });
        if (error) { console.error('getStep2Records:', error); return []; }
        return data;
    },

    // ===== STEP3 =====

    async saveStep3(record) {
        const cleaned = { ...record };
        if (cleaned.target_id && !/^[0-9a-f-]{36}$/i.test(cleaned.target_id)) cleaned.target_id = null;
        const { data, error } = await supabase
            .from('daily_step3')
            .insert(cleaned)
            .select()
            .single();
        if (error) { console.error('saveStep3:', error); throw error; }
        return data;
    },

    async getStep3Records(staffId, yearMonth) {
        const { data, error } = await supabase
            .from('daily_step3')
            .select('*')
            .eq('staff_id', staffId)
            .eq('year_month', yearMonth)
            .order('date', { ascending: false });
        if (error) { console.error('getStep3Records:', error); return []; }
        return data;
    },

    // ===== 月次評価 =====

    async getMonthlyEvaluation(staffId, yearMonth) {
        const { data, error } = await supabase
            .from('monthly_evaluations')
            .select('*')
            .eq('staff_id', staffId)
            .eq('year_month', yearMonth)
            .single();
        if (error) return null;
        return data;
    },

    async saveMonthlyEvaluation(record) {
        const { data, error } = await supabase
            .from('monthly_evaluations')
            .upsert(record, { onConflict: 'staff_id,year_month' })
            .select()
            .single();
        if (error) { console.error('saveMonthlyEvaluation:', error); return null; }
        return data;
    },

    // ===== 動画課題 =====

    async getVideoTasks(staffId) {
        const { data, error } = await supabase
            .from('video_tasks')
            .select('*')
            .eq('staff_id', staffId)
            .order('step');
        if (error) { console.error('getVideoTasks:', error); return []; }
        return data;
    },

    async updateVideoTask(staffId, taskId, updates) {
        const { error } = await supabase
            .from('video_tasks')
            .upsert({ staff_id: staffId, task_id: taskId, ...updates }, { onConflict: 'staff_id,task_id' });
        return !error;
    },

    // ===== 管理者：スタッフ一覧 =====

    async getStaffList(facilityId) {
        const { data, error } = await supabase
            .from('staff_master')
            .select('*')
            .eq('facility_id', facilityId)
            .eq('is_active', true)
            .eq('role', 'staff')
            .order('name');
        if (error) { console.error('getStaffList:', error); return []; }
        return data;
    },

    // ===== AI判定（Vercel経由でGemini API） =====

    async judgeStep1(data) {
        try {
            const resp = await fetch('/api/judge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step: 'step1', data })
            });
            if (resp.ok) return await resp.json();
        } catch (e) { console.warn('AI API失敗、ローカル判定を使用:', e); }
        // フォールバック：ローカルルールベース判定
        return Step1.judge(data.notice_text);
    },

    async judgeStep2(data) {
        try {
            const resp = await fetch('/api/judge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step: 'step2', data })
            });
            if (resp.ok) return await resp.json();
        } catch (e) { console.warn('AI API失敗、ローカル判定を使用:', e); }
        return Step2.judge(data.change_noticed, data.hypotheses || []);
    },

    async judgeStep3(data) {
        try {
            const resp = await fetch('/api/judge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ step: 'step3', data })
            });
            if (resp.ok) return await resp.json();
        } catch (e) { console.warn('AI API失敗、ローカル判定を使用:', e); }
        return Step3.judge(data.reflection || data);
    }
};
