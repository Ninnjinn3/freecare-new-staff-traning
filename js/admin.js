/* ============================================
   admin.js — 管理者ダッシュボード
   スタッフ進捗一覧・アラート・スタッフ管理
   ============================================ */

window.Admin = {
    data: null,

    // ===== ダッシュボード読み込み =====
    async load() {
        const user = Auth.getUser();
        if (!user) return;

        // 運営本部ユーザーが閲覧している場合のボタン出し分け
        const logoutBtn = document.getElementById('admin-logout-btn');
        const backBtn = document.getElementById('admin-back-exec-btn');
        if (user.role === 'exec') {
            if (logoutBtn) logoutBtn.style.display = 'none';
            if (backBtn) backBtn.style.display = 'block';
        } else {
            if (logoutBtn) logoutBtn.style.display = 'block';
            if (backBtn) backBtn.style.display = 'none';
        }

        const facilityId = user.role === 'exec' ? '' : (user.facility_id || 'F001');
        const cycle = DB.getCurrentCycle();

        try {
            const resp = await fetch('/api/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    facility_id: facilityId,
                    year_month: cycle.yearMonth
                })
            });

            if (resp.ok) {
                this.data = await resp.json();
                this.renderSummary();
                this.renderProgressList();
                this.renderAlerts();
                return;
            }
        } catch (e) {
            console.warn('管理者API失敗:', e);
        }
        this.renderEmpty();
    },

    // サマリカード描画
    renderSummary() {
        if (!this.data?.summary) return;
        const s = this.data.summary;
        setText('summary-total', `${s.totalStaff}名`);
        setText('summary-active', `${s.activeStaff}名`);
        setText('summary-avg-score', s.avgScore > 0 ? `${s.avgScore}点` : '--');
        setText('summary-avg-pass', `${s.avgPassRate}%`);
        setText('summary-hit-rate', `${s.hitRate || 0}%`);
        setText('summary-reflection-rate', `${s.reflectionRate || 0}%`);
    },

    // スタッフ進捗一覧描画
    renderProgressList() {
        const list = document.getElementById('staff-progress-list');
        if (!list || !this.data?.staffProgress) return;

        if (this.data.staffProgress.length === 0) {
            list.innerHTML = '<p class="empty-state">研修対象スタッフがいません</p>';
            return;
        }

        list.innerHTML = this.data.staffProgress.map(staff => {
            const stepClass = `step-badge step-${staff.current_step}`;
            const scoreClass = staff.monthlyScore >= 80 ? 'score-high' :
                staff.monthlyScore >= 60 ? 'score-mid' : 'score-low';
            const passIcon = staff.passed ? '✅' : (staff.totalRecords > 0 ? '❌' : '—');
            const sub = staff.subLevel || { label: '--', icon: '🔵', progress: 0 };
            const taskDone = staff.taskStatus === 'done';

            return `
            <div class="staff-card" id="progress-card-${staff.staff_id}">
                <div class="staff-card-header">
                    <span class="staff-name">${staff.name}</span>
                    <span class="${stepClass}">STEP${staff.current_step}</span>
                </div>
                <div class="sub-level-row">
                    <span class="sub-level-icon">${sub.icon}</span>
                    <div class="sub-level-bar-bg">
                        <div class="sub-level-bar-fill" style="width:${sub.progress}%"></div>
                    </div>
                    <span class="sub-level-label">${sub.label}</span>
                </div>
                <div class="staff-card-stats">
                    <div class="staff-stat">
                        <span class="staff-stat-label">記録</span>
                        <span class="staff-stat-value">${staff.totalRecords}件</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">合格率</span>
                        <span class="staff-stat-value">${staff.passRate}%</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">スコア</span>
                        <span class="staff-stat-value ${scoreClass}">${staff.monthlyScore ?? '--'}</span>
                    </div>
                    <div class="staff-stat">
                        <span class="staff-stat-label">今月</span>
                        <span class="staff-stat-value ${taskDone ? 'score-high' : ''}">${taskDone ? '完了✅' : staff.taskStatus || '--'}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    // アラート一覧描画
    renderAlerts() {
        const list = document.getElementById('admin-alert-list');
        if (!list || !this.data?.alerts) return;

        if (this.data.alerts.length === 0) {
            list.innerHTML = '<p class="empty-state">アラートはありません 🎉</p>';
            return;
        }

        const alertTab = document.getElementById('admin-tab-alerts');
        if (alertTab && this.data.alerts.length > 0) {
            alertTab.textContent = `🔔 (${this.data.alerts.length})`;
        }

        list.innerHTML = this.data.alerts.map(alert => `
            <div class="alert-item alert-${alert.type}">
                <span class="alert-icon">${alert.icon}</span>
                <div class="alert-content">
                    <span class="alert-staff">${alert.staff}</span>
                    <span class="alert-message">${alert.message}</span>
                </div>
            </div>
        `).join('');
    },

    renderEmpty() {
        setText('summary-total', '0名');
        setText('summary-active', '0名');
        setText('summary-avg-score', '--');
        setText('summary-avg-pass', '--');
        const list = document.getElementById('staff-progress-list');
        if (list) list.innerHTML = '<p class="empty-state">データの取得に失敗しました</p>';
    },

    // ===== スタッフ管理 =====

    // スタッフ一覧取得
    async loadStaffList(mode = 'all') {
        const user = Auth.getUser();
        const facilityId = user?.role === 'exec' ? '' : (user?.facility_id || 'F001');
        const showInactive = document.getElementById('show-inactive-staff')?.checked || false;

        const list = document.getElementById('staff-manage-list-container');
        if (list) list.innerHTML = '<p class="empty-state">読み込み中...</p>';

        try {
            const resp = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'list',
                    facility_id: facilityId,
                    include_inactive: showInactive
                })
            });

            if (resp.ok) {
                const data = await resp.json();
                this.renderStaffManageList(data.staff || [], mode);
                return;
            }
        } catch (e) {
            console.warn('スタッフ一覧取得失敗:', e);
        }

        if (list) list.innerHTML = '<p class="empty-state">取得に失敗しました</p>';
    },

    renderStaffManageList(staffList, mode = 'all') {
        const list = document.getElementById('staff-manage-list-container');
        if (!list) return;

        if (staffList.length === 0) {
            list.innerHTML = '<p class="empty-state">スタッフがいません</p>';
            return;
        }

        const roleLabels = { staff: '研修', admin: '管理者', exec: '本部' };

        if (mode === 'login') {
            // ログイン率・活動状況モード
            list.style.display = 'block';
            list.innerHTML = `
                <div style="background: white; border-radius: 12px; overflow: hidden; border: 1px solid #eee;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead style="background: #f8fafc; border-bottom: 1px solid #eee;">
                            <tr>
                                <th style="padding: 12px; text-align: left;">氏名</th>
                                <th style="padding: 12px; text-align: center;">役割</th>
                                <th style="padding: 12px; text-align: center;">記録件数</th>
                                <th style="padding: 12px; text-align: center;">最終活動日</th>
                                <th style="padding: 12px; text-align: center;">ステータス</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${staffList.map(s => {
                                const lastActive = s.last_record_date || '未活動';
                                const isActive = s.total_records > 0;
                                return `
                                <tr style="border-bottom: 1px solid #f1f5f9;">
                                    <td style="padding: 12px;"><strong>${s.name}</strong><br><span style="font-size: 0.75rem; color: #666;">ID: ${s.staff_id}</span></td>
                                    <td style="padding: 12px; text-align: center;"><span class="step-badge step-${s.current_step || 0}">${roleLabels[s.role] || s.role}</span></td>
                                    <td style="padding: 12px; text-align: center;">${s.total_records || 0}件</td>
                                    <td style="padding: 12px; text-align: center;">${lastActive}</td>
                                    <td style="padding: 12px; text-align: center;">
                                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${isActive ? '#10b981' : '#cbd5e1'}; margin-right: 5px;"></span>
                                        ${isActive ? '活動中' : '待機中'}
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>`;
        } else {
            // 通常のスタッフ管理モード
            list.style.display = 'grid';
            list.innerHTML = staffList.map(s => {
                const isInactive = !s.is_active;
                const roleLabel = roleLabels[s.role] || s.role;

                return `
                <div class="staff-manage-card ${isInactive ? 'staff-inactive' : ''}" style="background: #fff; border-radius: 12px; padding: 16px; border: 1px solid #eee; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div class="staff-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <div class="staff-name" style="font-weight: bold; font-size: 1.1rem; margin-bottom: 4px;">${isInactive ? '🔴 ' : '🟢 '}${s.name}</div>
                            <div style="font-size: 0.8rem; color: #666;">ID: ${s.staff_id}</div>
                        </div>
                        <span class="step-badge step-${s.current_step || 0}">${roleLabel}</span>
                    </div>
                    <div class="staff-manage-info" style="font-size: 0.85rem; color: #444; display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
                        <span>🏢 ${s.work_type === 'day' ? '日勤' : s.work_type === 'night' ? '夜勤' : '宿直'}</span>
                        ${s.current_step ? `<span>📚 STEP${s.current_step}</span>` : ''}
                        <span>📅 登録: ${s.created_at ? new Date(s.created_at).toLocaleDateString() : '不明'}</span>
                        ${s.left_date ? `<span class="left-date" style="color: #e53e3e;">🚫 退職: ${s.left_date}</span>` : ''}
                    </div>
                    ${!isInactive ? `
                    <div style="display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid #f8fafc; padding-top: 12px;">
                        <button style="background: #f1f5f9; color: #475569; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer; font-weight: 500;" onclick="Admin.viewStaffProgress('${s.staff_id}')">
                            進捗詳細
                        </button>
                        <button class="btn-danger-sm" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fee2e2; padding: 6px 12px; border-radius: 6px; font-size: 0.8rem; cursor: pointer;" onclick="Admin.confirmDelete('${s.staff_id}', '${s.name}')">
                            退職処理
                        </button>
                    </div>` : ''}
                </div>`;
            }).join('');
        }
    },

    // スタッフの進捗を見る
    viewStaffProgress(staffId) {
        showAdminTab('progress');
        setTimeout(() => {
            const card = document.getElementById(`progress-card-${staffId}`);
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.style.transition = 'background-color 0.5s ease';
                card.style.backgroundColor = '#e0f2fe'; // light blue highlight
                setTimeout(() => {
                    card.style.backgroundColor = '';
                }, 2000);
            } else {
                showToast('まだ進捗データがありません');
            }
        }, 100);
    },

    // スタッフ新規作成
    async createStaff() {
        const name = document.getElementById('new-staff-name')?.value?.trim();
        const staffId = document.getElementById('new-staff-id')?.value?.trim();
        const pw = document.getElementById('new-staff-pw')?.value?.trim();
        const workType = document.getElementById('new-staff-worktype')?.value;
        const role = document.getElementById('new-staff-role')?.value;

        if (!name || !staffId || !pw) {
            showToast('氏名・職員ID・パスワードを入力してください');
            return;
        }

        const user = Auth.getUser();
        const btn = document.getElementById('btn-create-staff');
        if (btn) { btn.disabled = true; btn.textContent = '登録中...'; }

        try {
            const resp = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    staff_id: staffId,
                    name,
                    initial_password: pw,
                    role,
                    work_type: workType,
                    facility_id: user?.facility_id || 'F001',
                    facility_name: user?.facility_name || ''
                })
            });

            const data = await resp.json();
            if (resp.ok && data.success) {
                showToast(`${name}（${staffId}）を登録しました ✅`);
                // フォームクリア
                document.getElementById('new-staff-name').value = '';
                document.getElementById('new-staff-id').value = '';
                document.getElementById('new-staff-pw').value = '';
                this.loadStaffList();
            } else {
                showToast(data.error || '登録に失敗しました');
            }
        } catch (e) {
            showToast('登録に失敗しました: ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '＋ スタッフ登録'; }
        }
    },

    // 削除確認
    confirmDelete(staffId, name) {
        if (confirm(`「${name}（${staffId}）」を退職処理しますか？\n\nこの操作は離職扱いとなり、離職率に反映されます。`)) {
            this.deleteStaff(staffId);
        }
    },

    // スタッフ削除（離職扱い）
    async deleteStaff(staffId) {
        const user = Auth.getUser();

        try {
            const resp = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    staff_id: staffId,
                    deleted_by: user?.staff_id || 'admin'
                })
            });

            const data = await resp.json();
            if (resp.ok && data.success) {
                showToast(`${staffId} を退職処理しました`);
                this.loadStaffList();
            } else {
                showToast(data.error || '削除に失敗しました');
            }
        } catch (e) {
            showToast('削除に失敗しました: ' + e.message);
        }
    },

    // ===== AI学習・ナレッジ管理 =====

    // ナレッジ一覧取得
    async loadKnowledgeList() {
        const list = document.getElementById('ai-knowledge-list');
        if (!list) return;

        try {
            const resp = await fetch('/api/ai-knowledge');
            if (resp.ok) {
                const data = await resp.json();
                this.renderKnowledgeList(data);
            }
        } catch (e) {
            console.error('ナレッジ取得失敗:', e);
        }
    },

    renderKnowledgeList(items) {
        const list = document.getElementById('ai-knowledge-list');
        if (!list) return;

        if (items.length === 0) {
            list.innerHTML = '<p class="empty-state">学習済みの知識はありません</p>';
            return;
        }

        list.innerHTML = items.map(item => `
            <div class="card" style="padding: 1rem; border-left: 4px solid var(--primary); background: #fdfdfd;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div style="font-weight: bold; font-size: 0.95rem;">
                        ${item.type === 'file' ? '📄' : '💬'} ${item.title}
                    </div>
                    <button onclick="Admin.deleteKnowledge('${item.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 0.8rem;">削除</button>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-main); line-height: 1.5; max-height: 100px; overflow-y: auto;">
                    ${item.content.replace(/\n/g, '<br>')}
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem; text-align: right;">
                    習得日: ${new Date(item.created_at).toLocaleDateString()}
                </div>
            </div>
        `).join('');
    },

    // 知識の削除
    async deleteKnowledge(id) {
        if (!confirm('この知識をAIの記憶から削除しますか？')) return;

        try {
            const resp = await fetch('/api/ai-knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id })
            });
            if (resp.ok) {
                showToast('知識を削除しました');
                this.loadKnowledgeList();
            }
        } catch (e) {
            showToast('削除に失敗しました');
        }
    },

    // AIに学習させる
    async learnAI() {
        const text = document.getElementById('ai-study-text')?.value?.trim();
        const fileInput = document.getElementById('ai-study-file');
        const titleInput = document.getElementById('ai-study-title');
        let title = titleInput?.value?.trim();
        const btn = document.getElementById('btn-ai-learn');

        if (!text && (!fileInput || !fileInput.files[0])) {
            showToast('メッセージを入力するか、ファイルを選択してください');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'AIが学習中... 🧠'; }

        try {
            let payload = {
                type: 'text',
                title: title || 'カスタム指示',
                content: text
            };

            // ファイルがある場合
            if (fileInput && fileInput.files[0]) {
                const file = fileInput.files[0];
                const base64 = await this.toBase64(file);
                payload.type = 'file';
                payload.title = title || file.name;
                payload.fileBase64 = base64.split(',')[1];
                payload.mimeType = file.type || 'application/pdf';
                payload.content = text; // メッセージもあれば添える
            }

            const resp = await fetch('/api/ai-knowledge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (resp.ok) {
                showToast('AIが新しい知識を習得しました！ ✨');
                // クリア
                if (document.getElementById('ai-study-text')) document.getElementById('ai-study-text').value = '';
                if (fileInput) fileInput.value = '';
                if (titleInput) titleInput.value = '';
                this.loadKnowledgeList();
            } else {
                const err = await resp.json();
                showToast('学習に失敗しました: ' + (err.error || 'Unknown error'));
            }
        } catch (e) {
            console.error(e);
            showToast('エラーが発生しました: ' + e.message);
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'AIに学習させる 🤖'; }
        }
    },

    toBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
};

// タブ切替
window.showAdminTab = function(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.hidden = true);

    document.getElementById(`admin-tab-${tab}`).classList.add('active');
    const section = document.getElementById(`admin-${tab}-section`);
    if (section) {
        section.hidden = false;
        section.style.display = 'block';
    }

    // 初回データ取得
    if ((tab === 'progress' || tab === 'alerts') && !Admin.data) {
        Admin.load();
    }
    if (tab === 'staff') {
        Admin.loadStaffList();
    }
    if (tab === 'ai-study') {
        Admin.loadKnowledgeList();
    }
}

window.setText = function(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
