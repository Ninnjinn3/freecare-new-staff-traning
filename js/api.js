/* ============================================
   api.js — Supabase バックエンド通信レイヤー
   Phase 2: Supabase (PostgreSQL) に接続
   ============================================ */

const API = {
    // Supabaseインスタンスの取得（エラー対策）
    getSupabase() {
        const client = window.fcSupabase || window.supabaseInstance || window.supabase;
        if (!client || typeof client.from !== 'function') {
            throw new Error('Supabase client is not initialized. Please refresh the page.');
        }
        return client;
    },


    // ===== 認証 =====

    async login(staffId, password) {
        const email = `${staffId}@freecare.local`;

        // 1) Supabase Auth でサインインを試行
        const { data: authData, error: authError } = await this.getSupabase().auth.signInWithPassword({ email, password });
        
        if (!authError) {
            // Auth成功：staff_masterから詳細情報を取得
            const { data: staff, error: staffError } = await this.getSupabase()
                .from('staff_master')
                .select('*')
                .eq('staff_id', staffId)
                .single();

            if (staff) {
                Auth.currentUser = staff;
                sessionStorage.setItem('fc_current_user', JSON.stringify(staff));
                return { success: true, user: staff };
            }
        }

        // 2) Auth失敗または不完全な場合：staff_masterを直接チェック（フォールバック）
        // Supabase Authのレートリミットや未確認メール対策として実装
        const { data: staffFromDb, error: dbError } = await this.getSupabase()
            .from('staff_master')
            .select('*')
            .eq('staff_id', staffId)
            .eq('password', password)
            .maybeSingle();

        if (staffFromDb) {
            Auth.currentUser = staffFromDb;
            sessionStorage.setItem('fc_current_user', JSON.stringify(staffFromDb));
            return { success: true, user: staffFromDb };
        }

        return { success: false, error: 'IDまたはパスワードが正しくありません' };
    },

    async logout() {
        await this.getSupabase().auth.signOut();
        return Auth.logout();
    },

    // ===== 対象者（利用者） =====

    async getTargets(facilityId) {
        const { data, error } = await this.getSupabase()
            .from('care_targets')
            .select('*')
            .eq('facility_id', facilityId)
            .eq('is_active', true)
            .order('name');
        if (error) { console.error('getTargets:', error); return []; }
        return data;
    },

    async addTarget(target) {
        const { data, error } = await this.getSupabase()
            .from('care_targets')
            .insert(target)
            .select()
            .single();
        if (error) { console.error('addTarget:', error); return null; }
        return data;
    },

    async deleteTarget(id) {
        const { error } = await this.getSupabase()
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
        const { data, error } = await this.getSupabase()
            .from('daily_step1')
            .insert(cleaned)
            .select()
            .single();
        if (error) { console.error('saveStep1:', error); throw error; }
        return data;
    },

    async getStep1Records(staffId, yearMonth) {
        let query = this.getSupabase().from('daily_step1').select('*').eq('staff_id', staffId).order('date', { ascending: false });
        if (yearMonth) {
            query = query.eq('year_month', yearMonth);
        }
        const { data, error } = await query;
        if (error) { console.error('getStep1Records:', error); return []; }
        return data;
    },

    // ===== STEP2 =====

    async saveStep2(record) {
        const cleaned = { ...record };
        if (cleaned.target_id && !/^[0-9a-f-]{36}$/i.test(cleaned.target_id)) cleaned.target_id = null;
        const { data, error } = await this.getSupabase()
            .from('step2_hypotheses')
            .insert(cleaned)
            .select()
            .single();
        if (error) { console.error('saveStep2:', error); throw error; }
        return data;
    },

    async getStep2Records(staffId, yearMonth) {
        let query = this.getSupabase().from('step2_hypotheses').select('*').eq('staff_id', staffId).order('date', { ascending: false });
        if (yearMonth) {
            query = query.eq('year_month', yearMonth);
        }
        const { data, error } = await query;
        if (error) { console.error('getStep2Records:', error); return []; }
        return data;
    },

    // ===== STEP3 =====

    async saveStep3(record) {
        const cleaned = { ...record };
        if (cleaned.target_id && !/^[0-9a-f-]{36}$/i.test(cleaned.target_id)) cleaned.target_id = null;
        const { data, error } = await this.getSupabase()
            .from('daily_step3')
            .insert(cleaned)
            .select()
            .single();
        if (error) { console.error('saveStep3:', error); throw error; }
        return data;
    },

    async getStep3Records(staffId, yearMonth) {
        let query = this.getSupabase().from('daily_step3').select('*').eq('staff_id', staffId).order('date', { ascending: false });
        if (yearMonth) {
            query = query.eq('year_month', yearMonth);
        }
        const { data, error } = await query;
        if (error) { console.error('getStep3Records:', error); return []; }
        return data;
    },

    // ===== 月次評価 =====

    async getMonthlyEvaluation(staffId, yearMonth) {
        const { data, error } = await this.getSupabase()
            .from('monthly_evaluations')
            .select('*')
            .eq('staff_id', staffId)
            .eq('year_month', yearMonth)
            .single();
        if (error) return null;
        return data;
    },

    async saveMonthlyEvaluation(record) {
        const { data, error } = await this.getSupabase()
            .from('monthly_evaluations')
            .upsert(record, { onConflict: 'staff_id,year_month' })
            .select()
            .single();
        if (error) { console.error('saveMonthlyEvaluation:', error); return null; }
        return data;
    },

    // ===== 動画課題 =====

    async getVideoTasks(staffId) {
        const { data, error } = await this.getSupabase()
            .from('video_tasks')
            .select('*')
            .eq('staff_id', staffId)
            .order('step');
        if (error) { console.error('getVideoTasks:', error); return []; }
        return data;
    },

    async updateVideoTask(staffId, taskId, updates) {
        const { error } = await this.getSupabase()
            .from('video_tasks')
            .upsert({ staff_id: staffId, task_id: taskId, ...updates }, { onConflict: 'staff_id,task_id' });
        return !error;
    },

    // ===== 管理者：スタッフ一覧 =====

    async getStaffList(facilityId) {
        const { data, error } = await this.getSupabase()
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
        const resp = await fetch('/api/judge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step: 'step1', data })
        });
        const json = await resp.json();
        if (!resp.ok) {
            throw new Error((json.detail || json.error || 'AI通信エラー') + (resp.status === 429 ? '\n※現在AIサーバーが混雑しています。1分ほど待ってから再度お試しください。' : ''));
        }
        return json;
    },

    async judgeStep2(data) {
        const resp = await fetch('/api/judge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step: 'step2', data })
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error((json.detail || json.error || 'AI通信エラー') + (resp.status === 429 ? '\n※現在混雑しています。' : ''));
        return json;
    },

    async judgeStep3(data) {
        const resp = await fetch('/api/judge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step: 'step3', data })
        });
        const json = await resp.json();
        if (!resp.ok) throw new Error((json.detail || json.error || 'AI通信エラー') + (resp.status === 429 ? '\n※現在混雑しています。' : ''));
        return json;
    }
};
