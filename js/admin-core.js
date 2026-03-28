/* ============================================
   admin.js — 管理者ダッシュボード
   スタッフ進捗一覧・アラート・スタッフ管理
   ============================================ */

window.Admin = {
    data: null,

    // ===== ナビゲーション =====
    switchPage(pageId) {
        const pages = ['dashboard', 'staff', 'progress', 'alerts', 'ai', 'targets', 'system-content'];
        pages.forEach(p => {
            const el = document.getElementById(`admin-page-${p}`);
            if (el) el.style.display = (p === pageId) ? 'block' : 'none';
        });

        // ナビゲーションのハイライト
        document.querySelectorAll('.admin-nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNav = document.getElementById(`nav-${pageId}`);
        if (activeNav) activeNav.classList.add('active');

        // 全てのサブメニューを閉じる
        this.closeAllSubMenus();

        const titleMap = {
            dashboard: '管理者ダッシュボード',
            staff: 'ユーザ管理',
            progress: '受講状況',
            alerts: 'アラート一覧',
            ai: 'AI学習設定',
            targets: 'STEP（対象者）管理',
            'system-content': 'システム部門コンテンツ'
        };
        const titleEl = document.getElementById('admin-header-title');
        if (titleEl) titleEl.textContent = titleMap[pageId] || '管理者画面';

        // ページに応じたデータロード
        if (pageId === 'dashboard') this.load();
        if (pageId === 'staff') this.loadStaffList();
        if (pageId === 'progress') this.renderProgressList();
        if (pageId === 'alerts') this.renderAlerts();
        if (pageId === 'ai') this.loadKnowledgeList();
        if (pageId === 'targets') window.renderAdminTargetList && window.renderAdminTargetList();
    },

    // ===== サブメニュー制御 =====
    toggleSubMenu(menuId) {
        const el = document.getElementById(`admin-submenu-${menuId}`);
        if (!el) {
            // ホーム以外は一旦ダミーでトースト表示
            if (menuId === 'dashboard') {
                this.switchPage('dashboard');
            } else {
                showToast(`「${menuId}」メニューは準備中です`);
            }
            return;
        }

        const isVisible = el.style.display === 'block';
        this.closeAllSubMenus();
        
        if (!isVisible) {
            el.style.display = 'block';
            // クリックイベントの伝播を防ぐための処理が必要な場合はここに追加
        }
    },

    closeAllSubMenus() {
        document.querySelectorAll('.admin-submenu-overlay').forEach(overlay => {
            overlay.style.display = 'none';
        });
    },

    // ===== ダッシュボード読み込み =====
    async load() {
        const user = Auth.getUser();
        if (!user) return;

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
                this.renderDashboard();
                this.renderSummary(); // 互換性のために残す
                return;
            }
        } catch (e) {
            console.warn('管理者API失敗:', e);
        }
    },

    // 新しいダッシュボードウィジェット描画
    renderDashboard() {
        if (!this.data) return;
        const s = this.data.summary || {};
        
        setText('widget-staff-count', s.totalStaff || 0);
        setText('widget-login-rate', s.loginRate || s.activeStaff ? Math.round((s.activeStaff/s.totalStaff)*100) : 0);
        setText('widget-completion-rate', `${s.completionRate || 0}%`);
        
        this.renderCharts();
    },

    renderCharts() {
        // 完成ドーナツ
        const ctxCompletion = document.getElementById('completionChart')?.getContext('2d');
        if (ctxCompletion && !this.completionChart) {
            const rate = this.data.summary?.completionRate || 0;
            this.completionChart = new Chart(ctxCompletion, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [rate, 100 - rate],
                        backgroundColor: ['#4f46e5', '#f3f4f6'],
                        borderWidth: 0
                    }]
                },
                options: { cutout: '80%', plugins: { legend: { display: false } } }
            });
        }

        // 時系列グラフ
        const ctxTime = document.getElementById('timeSeriesChart')?.getContext('2d');
        if (ctxTime && !this.timeSeriesChart) {
            this.timeSeriesChart = new Chart(ctxTime, {
                type: 'line',
                data: {
                    labels: ['月', '火', '水', '木', '金', '土', '日'],
                    datasets: [{
                        label: '受講数',
                        data: [12, 19, 15, 22, 28, 10, 8],
                        borderColor: '#4f46e5',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: 'rgba(79, 70, 229, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }
    },

    // 互換性のあるサマリカード描画
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
        const list = document.getElementById('staff-progress-list-container');
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
        const list = document.getElementById('admin-alert-list-container');
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
    async loadStaffList() {
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
                this.renderStaffManageList(data.staff || []);
                return;
            }
        } catch (e) {
            console.warn('スタッフ一覧取得失敗:', e);
        }

        if (list) list.innerHTML = '<p class="empty-state">取得に失敗しました</p>';
    },

    renderStaffManageList(staffList) {
        const list = document.getElementById('staff-manage-list-container');
        if (!list) return;

        if (staffList.length === 0) {
            list.innerHTML = '<p class="empty-state">スタッフがいません</p>';
            return;
        }

        const roleLabels = { staff: '研修', admin: '管理者', exec: '本部' };

        list.innerHTML = staffList.map(s => {
            const isInactive = !s.is_active;
            const roleLabel = roleLabels[s.role] || s.role;

            return `
            <div class="staff-manage-card ${isInactive ? 'staff-inactive' : ''}">
                <div class="staff-card-header">
                    <span class="staff-name">${isInactive ? '🔴 ' : '🟢 '}${s.name}</span>
                    <span class="step-badge step-${s.current_step || 0}">${roleLabel}</span>
                </div>
                <div class="staff-manage-info">
                    <span>ID: ${s.staff_id}</span>
                    ${s.left_date ? `<span class="left-date">退職: ${s.left_date}</span>` : ''}
                </div>
                ${!isInactive ? `
                <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
                    <button style="background:var(--primary); color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.8rem; cursor:pointer;" onclick="Admin.viewStaffProgress('${s.staff_id}')">
                        進捗を見る
                    </button>
                    <button class="btn-danger-sm" onclick="Admin.confirmDelete('${s.staff_id}', '${s.name}')">
                        退職処理
                    </button>
                </div>` : ''}
            </div>`;
        }).join('');
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
        const workType = document.getElementById('new-staff-worktype')?.value || 'day';
        const role = document.getElementById('new-staff-role')?.value || 'staff';

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
                Admin.loadStaffList();
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

    knowledgeItems: [],
    currentFilter: 'all',

    // ナレッジ一覧取得
    async loadKnowledgeList() {
        const list = document.getElementById('ai-knowledge-list');
        if (!list) return;

        try {
            const resp = await fetch('/api/ai-knowledge');
            if (resp.ok) {
                this.knowledgeItems = await resp.json();
                this.renderKnowledgeList(this.knowledgeItems);
            }
        } catch (e) {
            console.error('ナレッジ取得失敗:', e);
        }

        // 初回のみ初期化（リスナー等）
        if (!this.aiStudyInitialized) {
            this.initAIStudy();
            this.aiStudyInitialized = true;
        }
    },

    // AI学習UIの初期化（ドラッグ＆ドロップ、検索）
    initAIStudy() {
        const dropZone = document.getElementById('ai-drop-zone');
        const fileInput = document.getElementById('ai-study-file');

        if (dropZone && fileInput) {
            // クリックでファイル選択
            dropZone.onclick = () => fileInput.click();

            // ドラッグ＆ドロップイベント
            dropZone.ondragover = (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            };
            dropZone.ondragleave = () => dropZone.classList.remove('dragover');
            dropZone.ondrop = (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            };

            // ファイル入力の変更
            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileSelect(e.target.files[0]);
                }
            };
        }
    },

    // ファイル選択時の処理
    handleFileSelect(file) {
        const info = document.getElementById('selected-file-info');
        const nameEl = document.getElementById('selected-file-name');
        const titleInput = document.getElementById('ai-study-title');
        const contentArea = document.querySelector('.drop-zone-content');

        if (info && nameEl) {
            nameEl.textContent = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            info.hidden = false;
            if (contentArea) contentArea.style.opacity = '0.3';
            
            // タイトルが空ならファイル名をセット
            if (titleInput && !titleInput.value) {
                titleInput.value = file.name.split('.')[0];
            }
        }
    },

    // 選択ファイルのクリア
    clearSelectedFile() {
        const fileInput = document.getElementById('ai-study-file');
        const info = document.getElementById('selected-file-info');
        const contentArea = document.querySelector('.drop-zone-content');
        if (fileInput) fileInput.value = '';
        if (info) info.hidden = true;
        if (contentArea) contentArea.style.opacity = '1';
    },

    // フィルタリング設定
    setKnowledgeFilter(filter, el) {
        this.currentFilter = filter;
        document.querySelectorAll('#knowledge-filters .chip').forEach(c => c.classList.remove('active'));
        if (el) el.classList.add('active');
        this.filterKnowledge();
    },

    // 検索・フィルター実行
    filterKnowledge() {
        const query = document.getElementById('knowledge-search')?.value?.toLowerCase() || '';
        
        const filtered = this.knowledgeItems.filter(item => {
            const matchesFilter = this.currentFilter === 'all' || item.type === this.currentFilter;
            const matchesSearch = !query || 
                (item.title || '').toLowerCase().includes(query) || 
                (item.content || '').toLowerCase().includes(query);
            return matchesFilter && matchesSearch;
        });

        this.renderKnowledgeList(filtered);
    },

    renderKnowledgeList(items) {
        const list = document.getElementById('ai-knowledge-list');
        const countEl = document.getElementById('knowledge-count');
        if (!list) return;

        if (countEl) countEl.textContent = `${items.length}件`;

        if (items.length === 0) {
            list.innerHTML = '<p class="empty-state">該当する知識はありません</p>';
            return;
        }

        list.innerHTML = items.map(item => `
            <div class="knowledge-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
                    <div style="font-weight: bold; font-size: 1rem; color: var(--text-primary); line-height: 1.3;">
                        ${item.type === 'file' ? '📄' : (item.type === 'url' ? '🔗' : '💬')} ${item.title}
                    </div>
                </div>
                ${item.url ? `
                    <div style="margin-bottom: 0.8rem;">
                        <a href="${item.url}" target="_blank" style="font-size: 0.8rem; color: var(--primary); text-decoration: none; display: flex; align-items: center; gap: 4px;">
                            <span>🔗</span> <span style="text-decoration: underline; word-break: break-all;">${item.url}</span>
                        </a>
                    </div>` : ''}
                <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; max-height: 120px; overflow-y: auto; background: #fcfcfc; padding: 0.5rem; border-radius: 6px; border: 1px solid #f0f0f0;">
                    ${(item.content || '').replace(/\n/g, '<br>')}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; border-top: 1px solid #f5f5f5; pt: 0.8rem;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">${new Date(item.created_at).toLocaleDateString()}</span>
                    <button onclick="Admin.deleteKnowledge('${item.id}')" class="btn-text-sm">削除する</button>
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
        const urlInput = document.getElementById('ai-study-url');
        const titleInput = document.getElementById('ai-study-title');
        let title = titleInput?.value?.trim();
        const btn = document.getElementById('btn-ai-learn');

        if (!text && (!fileInput || !fileInput.files[0]) && (!urlInput || !urlInput.value.trim())) {
            showToast('メッセージを入力するか、ファイル/URLを指定してください');
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'AIが学習中... 🧠'; }

        try {
            let payload = {
                type: 'text',
                title: title || 'カスタム指示',
                content: text
            };

            // URLがある場合
            if (urlInput && urlInput.value.trim()) {
                payload.type = 'url';
                payload.url = urlInput.value.trim();
                payload.title = title || 'Google Drive / 外部URL';
                payload.content = text; // メッセージもあれば添える
            }

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
                if (urlInput) urlInput.value = '';
                if (titleInput) titleInput.value = '';
                this.clearSelectedFile();
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

// タブ切替 (旧互換用)
window.showAdminTab = function(tab) {
    Admin.switchPage(tab);
}

window.setText = function(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// グローバルなクリックイベントでサブメニューを閉じる
document.addEventListener('click', (e) => {
    const isClickInsideMenu = e.target.closest('.admin-sidebar-item') || e.target.closest('.admin-submenu-overlay');
    if (!isClickInsideMenu) {
        if (window.Admin && typeof window.Admin.closeAllSubMenus === 'function') {
            window.Admin.closeAllSubMenus();
        }
    }
});

// グローバルなクリックイベントでサブメニューを閉じる
document.addEventListener('click', (e) => {
    const isClickInsideMenu = e.target.closest('.admin-sidebar-item') || e.target.closest('.admin-submenu-overlay');
    if (!isClickInsideMenu) {
        if (window.Admin && typeof window.Admin.closeAllSubMenus === 'function') {
            window.Admin.closeAllSubMenus();
        }
    }
});
