/**
 * 送信済み課題修正画面の制御
 */
const RecordEdit = {
    currentStep: null,

    init: function() {
        // コンテナの初期化
        const container = document.getElementById('edit-list-container');
        if (container) {
            container.innerHTML = '<div style="text-align: center; color: #999; margin-top: 40px;">カテゴリーを選択してください</div>';
        }
        this.currentStep = null;
    },

    /**
     * 指定されたSTEPの記録をロードして表示
     */
    async loadStep(step) {
        this.currentStep = step;
        const container = document.getElementById('edit-list-container');
        if (!container) return;

        container.innerHTML = '<div style="text-align: center; padding: 40px;">読み込み中...</div>';

        const user = Auth.getUser();
        if (!user) return;

        try {
            // STEPに応じたテーブル名の決定
            const tableMap = {
                1: 'daily_step1',
                2: 'step2_hypotheses',
                3: 'daily_step3',
                4: 'step4_records'
            };
            const tableName = tableMap[step];
            if (!tableName) throw new Error('Invalid step');

            const { data, error } = await window.fcSupabase
                .from(tableName)
                .select('*')
                .eq('staff_id', user.staff_id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: #999; margin-top: 40px;">提出済みの課題はありません</div>';
                return;
            }

            this.renderList(data, container, step);
        } catch (e) {
            console.error('Load records failed:', e);
            container.innerHTML = '<div style="text-align: center; color: #f44336; margin-top: 40px;">読み込みに失敗しました</div>';
        }
    },

    /**
     * リストの描画
     */
    renderList: function(records, container, step) {
        let html = '<div class="edit-accordion-list" style="margin-top: 10px;">';

        records.forEach(r => {
            const date = r.date || r.created_at || '';
            const dateStr = date.split('T')[0].replace(/-/g, '/');
            
            // 表示用テキストの抽出（テーブルごとに異なる）
            let summary = '';
            if (step === 1) summary = r.notice_text;
            else if (step === 2) summary = r.change_noticed || r.hypothesis;
            else if (step === 3) {
                const d = r.reflection_json || {};
                summary = d.notice || r.support_done;
            }
            else if (step === 4) summary = r.noticed_change;

            const targetName = r.target_name || r.name || r.target_id || '対象者不明';
            const displaySummary = summary ? summary.substring(0, 30) + (summary.length > 30 ? '...' : '') : '(内容なし)';
            
            html += `
                <div class="edit-item-card" style="background: white; border-radius: 12px; margin-bottom: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #eee;">
                    <div class="edit-item-header" onclick="RecordEdit.toggleAccordion('${r.id}')" style="padding: 15px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;">
                        <div style="flex: 1;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 0.8rem; color: #888;">${dateStr}</span>
                                <span style="font-size: 0.8rem; background: #f0f0f0; padding: 2px 8px; border-radius: 4px; color: #666;">${targetName}</span>
                            </div>
                            <div style="font-size: 0.95rem; color: #333; margin-top: 6px; font-weight: 500;">${displaySummary}</div>
                        </div>
                        <span id="arrow-${r.id}" style="transition: transform 0.3s; color: #ccc;">▼</span>
                    </div>
                    <div id="body-${r.id}" style="display: none; padding: 0 15px 15px; border-top: 1px solid #f9f9f9;">
                        <div style="font-size: 0.9rem; color: #555; background: #fdfdfd; padding: 12px; border-radius: 8px; margin-top: 10px; white-space: pre-wrap; line-height: 1.5;">${summary || ''}</div>
                        <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                            <button onclick="RecordEdit.goToEdit(${step}, '${r.id}')" style="background: var(--primary); color: white; border: none; padding: 8px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; font-size: 0.9rem;">
                                この課題を修正する
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    toggleAccordion: function(id) {
        const body = document.getElementById(`body-${id}`);
        const arrow = document.getElementById(`arrow-${id}`);
        if (!body) return;

        if (body.style.display === 'none') {
            body.style.display = 'block';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        } else {
            body.style.display = 'none';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    },

    /**
     * 編集画面へ遷移
     */
    async goToEdit(step, id) {
        let tableName = '';
        if (step === 1) tableName = 'daily_step1';
        else if (step === 2) tableName = 'step2_hypotheses';
        else if (step === 3) tableName = 'daily_step3';
        else if (step === 4) tableName = 'step4_records';

        showToast('データを読み込んでいます...');
        
        try {
            const { data, error } = await window.fcSupabase
                .from(tableName)
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            // 編集対象をグローバルにセット
            window.editingRecord = { ...data, step: step };
            
            // 画面遷移
            navigateTo(`screen-step${step}`);
            
            showToast('編集モード：内容を修正してください');
        } catch (e) {
            console.error('Fetch record for edit failed:', e);
            showToast('データの読み込みに失敗しました');
        }
    }
};
