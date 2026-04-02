/* ============================================
   admin.js — 管理者ダッシュボード
   スタッフ進捗一覧・アラート・スタッフ管理
   ============================================ */

window.Admin = {
    data: null,

    // ===== ナビゲーション =====
    switchPage(pageId) {
        const pages = ['dashboard', 'staff', 'progress', 'alerts', 'ai', 'targets', 'curriculum', 'system-content', 'facility'];
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
            dashboard: 'ダッシュボード',
            staff: 'スタッフ管理',
            targets: '介護対象者管理',
            curriculum: 'STEP管理（カリキュラム）',
            'system-content': 'システム管理',
            facility: '部門管理'
        };
        const titleEl = document.getElementById('admin-header-title');
        if (titleEl) titleEl.textContent = titleMap[pageId] || '管理者画面';

        // ページに応じたデータロード
        if (pageId === 'dashboard') this.load();
        if (pageId === 'staff') this.loadStaffList();
        if (pageId === 'targets') this.renderAdminTargetListDirect();
        if (pageId === 'curriculum') this.loadCurriculumSteps();
        if (pageId === 'system-content') this.switchSystemTab('manual');
        if (pageId === 'facility') this.loadFacilities();
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
        const staff = this.data.staffProgress || [];
        
        // 1. スタッフ
        setText('widget-staff-count', (s.totalStaff || 0) + '名');
        const dist = s.stepDistribution || {};
        setText('detail-staff-count', `アクティブ: ${s.activeStaff}名 / STEP1: ${dist.step1||0} ・ STEP2: ${dist.step2||0} ・ STEP3: ${dist.step3||0}`);

        // 2. ログイン率
        const loginRate = s.activeStaff && s.totalStaff ? Math.round((s.activeStaff/s.totalStaff)*100) : (s.loginRate || 0);
        setText('widget-login-rate', loginRate + '%');
        setText('detail-login-rate', `今月の活動スタッフ: ${s.activeStaff}名 / 未活動: ${s.totalStaff - s.activeStaff}名`);

        // 3. 平均スコア
        setText('widget-avg-score', s.avgScore > 0 ? s.avgScore + '点' : '--');
        const evaluated = staff.filter(p => p.monthlyScore !== null).length;
        setText('detail-avg-score', `評価済み: ${evaluated}名 / 全体: ${s.totalStaff}名`);

        // 4. 合格率
        setText('widget-pass-rate', (s.avgPassRate || 0) + '%');
        setText('detail-pass-rate', `仮説的中率: ${s.hitRate}% / 振り返り実施率: ${s.reflectionRate}%`);

        // 5. 記録件数
        const totalRecs = (s.totalRecords || s.hitRate || 0);
        const avgRecs = s.activeStaff > 0 ? (totalRecs / s.activeStaff).toFixed(1) : 0;
        setText('widget-total-records', totalRecs + '件');
        setText('detail-total-records', `アクティブ1人あたり平均: ${avgRecs}件`);

        // 6. 完了率
        setText('widget-completion-rate', (s.completionRate || 0) + '%');
        const doneCount = staff.filter(p => p.taskStatus === 'done').length;
        setText('detail-completion-rate', `月次ノルマ(6回)達成: ${doneCount}名 / 全体: ${s.totalStaff}名`);
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
            const dept = Admin.getDeptName(s.staff_id);

            return `
            <div class="staff-manage-card ${isInactive ? 'staff-inactive' : ''}">
                <div class="staff-card-header">
                    <span class="staff-name">${isInactive ? '🔴 ' : '🟢 '}${s.name}</span>
                    <span class="step-badge step-${s.current_step || 0}">${roleLabel}</span>
                </div>
                <div class="staff-manage-info">
                    <span>ID: ${s.staff_id}</span>
                    <span style="margin-left:8px; color:var(--primary); font-weight:bold;">[${dept}]</span>
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
                    facility_id: staffId, // 施設IDをログインID（staff_id）にする
                    facility_name: ''
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

    // ===== 介護対象者管理 (直接) =====
    async renderAdminTargetListDirect() {
        const container = document.getElementById('admin-target-list-content');
        if (!container) return;
        container.innerHTML = '<p class="empty-state">読み込み中...</p>';

        try {
            const { data, error } = await window.fcSupabase
                .from('care_targets')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data.length === 0) {
                container.innerHTML = '<p class="empty-state">登録されている対象者がいません</p>';
                return;
            }

            container.innerHTML = data.map(t => `
                <div class="target-manage-card" style="background:var(--surface); padding:15px; border-radius:12px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="font-weight:bold;">${t.name}</div>
                        <div style="font-size:0.8rem; color:#666;">${t.care_level || '介護度未設定'}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-text-sm" onclick="Admin.editTargetName('${t.id}', '${t.name}')">編集</button>
                        <button class="btn-text-sm" style="color:red;" onclick="Admin.deleteTargetDirect('${t.id}')">削除</button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<p class="empty-state">読み込みに失敗しました</p>';
        }
    },

    async addNewTargetDirect() {
        const name = document.getElementById('admin-new-target-name-direct')?.value?.trim();
        if (!name) return;

        const user = Auth.getUser();
        try {
            const { error } = await window.fcSupabase.from('care_targets').insert({
                name: name,
                facility_id: user?.facility_id || 'F001',
                target_code: 'T' + Date.now().toString().slice(-4)
            });
            if (error) throw error;
            showToast(`${name}さんを追加しました ✅`);
            document.getElementById('admin-new-target-name-direct').value = '';
            this.renderAdminTargetListDirect();
        } catch (e) {
            showToast('追加に失敗しました');
        }
    },

    async editTargetName(id, currentName) {
        const newName = prompt('新しい名前を入力してください:', currentName);
        if (!newName || newName === currentName) return;

        try {
            const { error } = await window.fcSupabase.from('care_targets').update({ name: newName }).eq('id', id);
            if (error) throw error;
            showToast('名前を更新しました ✅');
            this.renderAdminTargetListDirect();
        } catch (e) {
            showToast('更新に失敗しました');
        }
    },

    async deleteTargetDirect(id) {
        if (!confirm('この対象者を削除しますか？')) return;
        try {
            const { error } = await window.fcSupabase.from('care_targets').update({ is_active: false }).eq('id', id);
            if (error) throw error;
            showToast('対象者を削除しました');
            this.renderAdminTargetListDirect();
        } catch (e) {
            showToast('削除に失敗しました');
        }
    },

    // ===== STEP管理 (カリキュラム) =====
    _curriculumStep: 1,

    async loadCurriculumSteps() {
        const container = document.getElementById('admin-curriculum-list');
        if (!container) return;

        // タブ UI
        const tabHtml = `
            <div style="display:flex;gap:8px;margin-bottom:20px;border-bottom:2px solid #eee;padding-bottom:10px;flex-wrap:wrap;">
                ${[1,2,3,4].map(n => `<button id="ctab-${n}" onclick="Admin._curriculumStep=${n};Admin.loadCurriculumSteps();" style="padding:8px 18px;border-radius:8px 8px 0 0;border:none;font-weight:bold;font-size:0.9rem;cursor:pointer;background:${this._curriculumStep===n?'var(--primary)':'#eee'};color:${this._curriculumStep===n?'white':'#555'};transition:0.2s;">STEP ${n}</button>`).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <div style="font-weight:bold;color:var(--primary);font-size:1rem;">📋 STEP ${this._curriculumStep} のカリキュラム一覧</div>
                <div style="display:flex;gap:10px;">
                    <button onclick="Admin.editStepLabels(${this._curriculumStep})" style="background:#f0effc;color:#4c5bb7;border:1px solid #4c5bb7;padding:8px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:0.85rem;">📝 質問項目を編集</button>
                    <button onclick="Admin.addCurriculumTask()" style="background:var(--primary);color:white;border:none;padding:8px 16px;border-radius:8px;font-weight:bold;cursor:pointer;font-size:0.85rem;">＋ 課題を追加</button>
                </div>
            </div>`;

        const tasks = this._getCurriculumTasks(this._curriculumStep);

        const taskHtml = tasks.length === 0
            ? '<p style="text-align:center;color:#999;padding:30px;">課題がありません。「＋ 課題を追加」から追加してください。</p>'
            : tasks.map((t, i) => `
                <div style="background:#fff;border:1px solid #e8eaf6;border-radius:10px;padding:15px 18px;margin-bottom:10px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                        <div style="flex:1;">
                            <div style="font-weight:bold;color:#333;font-size:0.95rem;">${i+1}. ${t.title}</div>
                            ${t.content ? `<div style="font-size:0.8rem;color:#666;margin-top:4px;">${t.content.replace(/\n/g,'<br>')}</div>` : ''}
                            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
                                ${(t.sub||[]).map(s => `<span style="font-size:0.75rem;background:#f0effc;color:#4c5bb7;padding:2px 8px;border-radius:10px;">${s}</span>`).join('')}
                            </div>
                        </div>
                        <div style="display:flex;gap:6px;flex-shrink:0;">
                            <button onclick="Admin.editCurriculumTask(${this._curriculumStep},'${t.id}')" style="background:#4c5bb7;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:0.8rem;cursor:pointer;">✏️ 編集</button>
                            <button onclick="Admin.deleteCurriculumTask(${this._curriculumStep},'${t.id}')" style="background:#e53935;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:0.8rem;cursor:pointer;">🗑️</button>
                        </div>
                    </div>
                </div>`).join('');

        container.innerHTML = tabHtml + taskHtml;
    },

    // localStorage に保存されたカスタムタスクを返す（なければ data.js の VIDEO_TASKS を使う）
    _getCurriculumTasks(step) {
        const saved = localStorage.getItem(`admin_curriculum_step${step}`);
        if (saved) return JSON.parse(saved);
        return (window.VIDEO_TASKS && window.VIDEO_TASKS[step]) ? window.VIDEO_TASKS[step] : [];
    },

    _saveCurriculumTasks(step, tasks) {
        localStorage.setItem(`admin_curriculum_step${step}`, JSON.stringify(tasks));
    },

    addCurriculumTask() {
        const title = prompt('課題タイトルを入力してください:');
        if (!title) return;
        const explanation = prompt('内容説明を入力してください（任意）:');
        const subInput = prompt('実施項目をカンマ区切りで入力（例: 動画,テスト,報告書）:', '動画,テスト,報告書');
        const sub = (subInput || '動画,テスト,報告書').split(',').map(s => s.trim()).filter(Boolean);
        const tasks = this._getCurriculumTasks(this._curriculumStep);
        const newId = `custom_${Date.now()}`;
        tasks.push({ id: newId, title: title.trim(), content: explanation || '', sub });
        this._saveCurriculumTasks(this._curriculumStep, tasks);
        showToast('課題を追加しました ✅');
        this.loadCurriculumSteps();
    },

    editCurriculumTask(step, taskId) {
        const tasks = this._getCurriculumTasks(step);
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const newTitle = prompt('課題タイトルを変更:', task.title);
        if (!newTitle) return;
        const newExplanation = prompt('内容説明を変更:', task.content || '');
        const newSub = prompt('実施項目をカンマ区切りで:', (task.sub||[]).join(','));
        task.title = newTitle.trim();
        task.content = newExplanation || '';
        task.sub = (newSub || '').split(',').map(s => s.trim()).filter(Boolean);
        this._saveCurriculumTasks(step, tasks);
        showToast('課題を更新しました ✅');
        this.loadCurriculumSteps();
    },

    deleteCurriculumTask(step, taskId) {
        if (!confirm('この課題を削除しますか？')) return;
        const tasks = this._getCurriculumTasks(step).filter(t => t.id !== taskId);
        this._saveCurriculumTasks(step, tasks);
        showToast('課題を削除しました');
        this.loadCurriculumSteps();
    },

    editStepLabels(step) {
        if (step === 4) {
            showToast('STEP4の質問項目は現時点で固定です。');
            return;
        }

        const labelsObj = JSON.parse(localStorage.getItem(`admin_step_labels_${step}`) || '{}');

        if (step === 1) {
            const current = labelsObj['step1-notice'] || '利用者様の変化や気付いたこと';
            const val = prompt('STEP1 質問1:', current);
            if (val) labelsObj['step1-notice'] = val;
        } else if (step === 2) {
            const q1 = prompt('STEP2 質問1:', labelsObj['step2-change'] || '気付いた変化を1つ記載');
            const q2 = prompt('STEP2 質問2:', labelsObj['step2-priority-reason'] || 'この優先順位で並べた理由');
            const q3 = prompt('STEP2 質問3:', labelsObj['step2-expected-change'] || '優先順位1番の支援を行うことで、変化すると考えられること');
            if (q1) labelsObj['step2-change'] = q1;
            if (q2) labelsObj['step2-priority-reason'] = q2;
            if (q3) labelsObj['step2-expected-change'] = q3;
        } else if (step === 3) {
            const q1 = prompt('STEP3 質問1:', labelsObj['step3-notice'] || '① 気付き');
            const q2 = prompt('STEP3 質問2:', labelsObj['step3-support'] || '② 支援内容');
            const q3 = prompt('STEP3 質問3:', labelsObj['step3-reason'] || '③ その支援を行った理由');
            const q4 = prompt('STEP3 質問4:', labelsObj['step3-prediction'] || '④ 支援後の変化の予測');
            const q5 = prompt('STEP3 質問5:', labelsObj['step3-reaction'] || '⑤ 支援後の反応');
            const q6 = prompt('STEP3 質問6 (上記選択理由):', labelsObj['step3-decision-reason'] || '⑥ 上記を選択した理由');
            if (q1) labelsObj['step3-notice'] = q1;
            if (q2) labelsObj['step3-support'] = q2;
            if (q3) labelsObj['step3-reason'] = q3;
            if (q4) labelsObj['step3-prediction'] = q4;
            if (q5) labelsObj['step3-reaction'] = q5;
            if (q6) labelsObj['step3-decision-reason'] = q6;
        }

        localStorage.setItem(`admin_step_labels_${step}`, JSON.stringify(labelsObj));
        showToast(`STEP${step}の質問項目を更新しました ✅`);
        
        // 即時反映のためにグローバルなラベル更新関数を呼ぶ
        if (window.applyDynamicStepLabels) window.applyDynamicStepLabels();
    },


    // 旧互換
    editCurriculumStep(id, currentName) {
        this._curriculumStep = id;
        this.loadCurriculumSteps();
    },

    // ===== システム部門コンテンツ =====
    switchSystemTab(tab) {
        document.querySelectorAll('.sys-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`sys-tab-${tab}`)?.classList.add('active');
        
        document.getElementById('sys-content-manual').style.display = (tab === 'manual' ? 'block' : 'none');
        document.getElementById('sys-content-ai').style.display = (tab === 'ai' ? 'block' : 'none');
        
        if (tab === 'ai') this.loadKnowledgeList();
    },

    viewManual(page) {
        const modal = document.getElementById('admin-manual-modal');
        const titleEl = document.getElementById('manual-modal-title');
        const bodyEl = document.getElementById('manual-modal-body');
        if (!modal || !titleEl || !bodyEl) return;

        const manualContent = {
            step1: {
                title: '日次記録（STEP1）マニュアル',
                content: `
                    <h3>STEP1の目的</h3>
                    <p>日々の業務の中で利用者様の小さな変化（いつもと違う状態）に気付き、それを客観的事実として記録する力を養います。</p>
                    <h3>記録のポイント</h3>
                    <ul>
                        <li><strong>5W1Hの意識:</strong> いつ、どこで、誰が、何を、どのように。</li>
                        <li><strong>客観的事実の記載:</strong> 「〜と思った」という主観ではなく、「〜と言った」「〜という表情をしていた」という事実を書く。</li>
                        <li><strong>普段との比較:</strong> 「いつもは〜だが、今日は〜だった」という書き方をすると、変化が明確になります。</li>
                    </ul>
                    <h3>AI判定の基準</h3>
                    <p>文字数、具体的な時間・場所の記載、変化・比較の有無、本人の反応などが含まれているかをAIがチェックします。</p>
                `
            },
            step2: {
                title: '仮説思考（STEP2）マニュアル',
                content: `
                    <h3>STEP2の目的</h3>
                    <p>気付いた変化に対して「なぜそうなったのか？」という根拠ある仮説を立てる思考プロセスを学びます。</p>
                    <h3>仮説の立て方</h3>
                    <ul>
                        <li><strong>「なぜ？」を繰り返す:</strong> 表面的な原因だけでなく、身体的、精神的、環境的な側面から多角的に分析します。</li>
                        <li><strong>根拠（エビデンス）:</strong> フェイスシートの情報や過去の記録、疾患特性などを踏まえた仮説を立てます。</li>
                        <li><strong>優先順位:</strong> 複数の可能性がある中で、最も可能性が高いもの、または緊急性が高いものを特定します。</li>
                    </ul>
                `
            },
            step3: {
                title: '振り返り（STEP3）マニュアル',
                content: `
                    <h3>STEP3の目的</h3>
                    <p>実施した支援（アプローチ）の結果を客観的に振り返り、仮説の妥当性を検証します。</p>
                    <h3>振り返りの視点</h3>
                    <ul>
                        <li><strong>目標の達成度:</strong> 期待していた変化は起きたか？</li>
                        <li><strong>新たな気付き:</strong> 実施してみて初めて分かったことは何か？</li>
                        <li><strong>次へのアクション:</strong> 支援を継続するか、変更するか、終了するかを判断します。</li>
                    </ul>
                `
            },
            targets: {
                title: '介護対象者管理マニュアル',
                content: `
                    <h3>対象者管理の役割</h3>
                    <p>システムを利用する上でベースとなる利用者様の情報を管理します。</p>
                    <h3>主な機能</h3>
                    <ul>
                        <li><strong>新規追加:</strong> 新しく研修の対象となる利用者様を登録します。</li>
                        <li><strong>編集:</strong> 名前や介護度などの情報を更新します。</li>
                        <li><strong>削除（非表示）:</strong> 退所などの理由で対象から外れた場合に使用します。</li>
                    </ul>
                `
            },
            ai: {
                title: 'AIサポーター活用マニュアル',
                content: `
                    <h3>フリーケアくんとは</h3>
                    <p>研修スタッフの良き相談相手として、24時間いつでも質問に答えてくれるAIサポーターです。</p>
                    <h3>活用のコツ</h3>
                    <ul>
                        <li><strong>具体的に聞く:</strong> 「STEP2の書き方がわからない」よりも「〜という事例でどう仮説を立てればいい？」と聞くとより良い回答が得られます。</li>
                        <li><strong>ナレッジの更新:</strong> 管理者が「AI学習設定」から新しいマニュアルやルールを追加することで、AIはより賢くなります。</li>
                    </ul>
                `
            }
        };

        const data = manualContent[page];
        if (data) {
            titleEl.textContent = data.title;
            bodyEl.innerHTML = data.content;
            modal.style.display = 'flex';
        }
    },

    closeManual() {
        const modal = document.getElementById('admin-manual-modal');
        if (modal) modal.style.display = 'none';
    },

    // ===== 施設・部門管理 =====
    _facilityView: 'facility', // 'facility' or 'staff'

    async loadFacilities() {
        const container = document.getElementById('admin-facility-list-container');
        if (!container) return;
        this._facilityView = 'facility';
        this._renderFacilityTabs(container);
    },

    async loadDepartments() {
        const container = document.getElementById('admin-facility-list-container');
        if (!container) return;
        this._facilityView = 'staff';
        this._renderFacilityTabs(container);
    },

    async _renderFacilityTabs(container) {
        container.innerHTML = '<p style="text-align:center;color:#aaa">読み込み中...</p>';
        await this._renderStaffEditList(container, '');
    },


    async _renderFacilityList(container, tabHtml) {
        try {
            const { data, error } = await window.fcSupabase.from('facilities').select('*').order('id');
            if (error) throw error;
            const rows = data.map(f => `
                <div style="background:#fff;border:1px solid #e8eaf6;border-radius:10px;padding:15px 18px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-weight:bold;">[${f.id}] ${f.name}</div>
                        <div style="font-size:0.8rem;color:#666;">${f.region || ''}</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button onclick="Admin.editFacility('${f.id}','${f.name}','${f.region||''}')" style="background:#4c5bb7;color:white;border:none;padding:5px 12px;border-radius:6px;font-size:0.82rem;cursor:pointer;">✏️ 編集</button>
                    </div>
                </div>`).join('');
            const addBtn = `<div style="margin-top:16px;">
                <button onclick="Admin.addFacility()" style="background:var(--primary);color:white;border:none;padding:10px 20px;border-radius:8px;font-weight:bold;cursor:pointer;width:100%;">＋ 施設を追加</button>
            </div>`;
            container.innerHTML = tabHtml + rows + addBtn;
        } catch(e) {
            container.innerHTML = tabHtml + '<p style="color:red;text-align:center;">取得失敗</p>';
        }
    },

    async _renderStaffEditList(container, tabHtml) {
        try {
            const user = Auth.getUser();
            const facilityId = user?.role === 'exec' ? '' : (user?.facility_id || 'F001');
            const resp = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list', facility_id: facilityId, include_inactive: false })
            });
            const d = await resp.json();
            const staffList = (d.staff || []).filter(s => {
                const sidStr = String(s.staff_id);
                // 1000系（本部）は除外
                return !sidStr.startsWith('1') && !sidStr.startsWith('F');
            });
            
            // 部門ごとにグループ化
            const grouped = {};
            staffList.forEach(s => {
                const dept = Admin.getDeptName(s.staff_id);
                if (!grouped[dept]) grouped[dept] = [];
                grouped[dept].push(s);
            });

            // HTML生成
            let rows = '';
            const depts = ['グループホーム', '訪問看護（精神）', '三国', '就労B', 'デイサービス', '生活介護', '小児', 'その他'];
            depts.forEach(dept => {
                if (grouped[dept] && grouped[dept].length > 0) {
                    rows += `<div style="margin-top:20px;margin-bottom:10px;font-size:1.1rem;font-weight:bold;color:#4c5bb7;border-bottom:2px solid #e8eaf6;padding-bottom:5px;">🏢 ${dept}</div>`;
                    grouped[dept].forEach(s => {
                        rows += `
                        <div style="background:#fff;border:1px solid #e8eaf6;border-radius:10px;padding:12px 15px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
                            <div>
                                <div style="font-weight:bold;">${s.name} <span style="font-size:0.78rem;color:#888;">(${s.staff_id})</span></div>
                                <div style="font-size:0.8rem;color:#666;margin-top:3px;">STEP ${s.current_step||1} / 役割: ${s.role}</div>
                            </div>
                            <button onclick="Admin.editStaff('${s.staff_id}','${s.name}',${s.current_step||1},'${s.role}','${s.facility_id||''}')" style="background:#4c5bb7;color:white;border:none;padding:6px 12px;border-radius:6px;font-size:0.82rem;cursor:pointer;">✏️ 編集</button>
                        </div>`;
                    });
                }
            });
            
            if (rows === '') {
                rows = '<p style="text-align:center;color:#666;">表示対象のスタッフがいません。</p>';
            }

            container.innerHTML = tabHtml + rows;
        } catch(e) {
            container.innerHTML = tabHtml + '<p style="color:red;text-align:center;">取得失敗</p>';
        }
    },


    async editFacility(id, currentName, currentRegion) {
        const newName = prompt('施設名を入力してください:', currentName);
        if (!newName) return;
        const newRegion = prompt('地域/拠点を入力（任意）:', currentRegion);
        try {
            const { error } = await window.fcSupabase.from('facilities').update({ name: newName, region: newRegion || currentRegion }).eq('id', id);
            if (error) throw error;
            showToast('施設情報を更新しました ✅');
            this.loadFacilities();
        } catch(e) {
            showToast('更新に失敗しました');
        }
    },

    editFacilityName(id, currentName) { this.editFacility(id, currentName, ''); }, // 後方互換

    async addFacility() {
        const id = prompt('施設IDを入力（例: F003）:');
        if (!id) return;
        const name = prompt('施設名を入力:');
        if (!name) return;
        const region = prompt('地域/拠点（任意）:', '大阪') || '大阪';
        try {
            const { error } = await window.fcSupabase.from('facilities').insert({ id: id.trim(), name: name.trim(), region });
            if (error) throw error;
            showToast(`${name}を追加しました ✅`);
            this.loadFacilities();
        } catch(e) {
            showToast('追加に失敗しました: ' + e.message);
        }
    },

    async editStaff(staffId, name, currentStep, currentRole, currentFacility) {
        const currentDept = this.getDeptName(staffId);
        const newStep = prompt(`${name}さんの現在のSTEP (1〜4):`, currentStep);
        if (newStep === null) return;
        const newRole = prompt('役割 (staff / admin / exec):', currentRole);
        if (newRole === null) return;
        // 施設IDはログインID固定にするルールのため、自動的にセット
        const newFacility = staffId; 
        try {
            const resp = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    staff_id: staffId,
                    current_step: parseInt(newStep) || 1,
                    role: newRole.trim(),
                    facility_id: newFacility.trim()
                })
            });
            const data = await resp.json();
            if (resp.ok && data.success) {
                showToast(`${name}の情報を更新しました ✅`);
                this._renderFacilityTabs(document.getElementById('admin-facility-list-container'));
            } else {
                showToast(data.error || '更新に失敗しました');
            }
        } catch(e) {
            showToast('更新に失敗しました: ' + e.message);
        }
    },

    getDeptName(staffId) {
        if (!staffId) return '不明';
        const s = String(staffId);
        if (s.startsWith('2')) return 'グループホーム';
        if (s.startsWith('3')) return '訪問看護（精神）';
        if (s.startsWith('4')) return '三国';
        if (s.startsWith('5')) return '就労B';
        if (s.startsWith('6')) return 'デイサービス';
        if (s.startsWith('7')) return '生活介護';
        if (s.startsWith('8')) return '小児';
        return 'その他';
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
