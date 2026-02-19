/* ============================================
   auth.js — 認証・セッション管理
   ============================================ */

const Auth = {
    currentUser: null,
    selectedRole: null,

    // ロール選択
    selectRole(role) {
        this.selectedRole = role;
        sessionStorage.setItem('fc_selected_role', role);
    },

    getSelectedRole() {
        return this.selectedRole || sessionStorage.getItem('fc_selected_role') || 'staff';
    },

    // ログイン
    login(staffId, password) {
        const staff = DB.getAll('staff_master').find(s =>
            s.staff_id === staffId && s.password === password
        );

        if (!staff) {
            return { success: false, error: 'IDまたはパスワードが正しくありません' };
        }

        // ロールチェック
        const selectedRole = this.getSelectedRole();
        if (selectedRole !== staff.role) {
            return { success: false, error: `この職員IDは「${this._roleLabel(staff.role)}」のアカウントです` };
        }

        this.currentUser = staff;
        sessionStorage.setItem('fc_current_user', JSON.stringify(staff));
        return { success: true, user: staff };
    },

    // ログアウト
    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('fc_current_user');
        sessionStorage.removeItem('fc_selected_role');
    },

    // セッション復元
    restore() {
        const raw = sessionStorage.getItem('fc_current_user');
        if (raw) {
            this.currentUser = JSON.parse(raw);
            return true;
        }
        return false;
    },

    // 現在のユーザー取得
    getUser() {
        return this.currentUser;
    },

    isLoggedIn() {
        return !!this.currentUser;
    },

    // ロールラベル変換
    _roleLabel(role) {
        const labels = { staff: '新人研修利用者', admin: '管理者', exec: '運営本部' };
        return labels[role] || role;
    }
};
