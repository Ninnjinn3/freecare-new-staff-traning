/* ============================================
   storage.js — LocalStorage データベース
   Phase 3 で GAS/Spreadsheet に差替え予定
   ============================================ */

const DB = {
    // --- Core CRUD ---
    save(table, record) {
        const records = this.getAll(table);
        record.record_id = record.record_id || this._generateId();
        record.created_at = record.created_at || new Date().toISOString();
        record.updated_at = new Date().toISOString();
        records.push(record);
        localStorage.setItem(`fc_${table}`, JSON.stringify(records));
        return record;
    },

    getAll(table, filters = {}) {
        const raw = localStorage.getItem(`fc_${table}`);
        let records = raw ? JSON.parse(raw) : [];

        // Apply filters
        Object.keys(filters).forEach(key => {
            records = records.filter(r => r[key] === filters[key]);
        });

        return records;
    },

    getById(table, id) {
        const records = this.getAll(table);
        return records.find(r => r.record_id === id) || null;
    },

    update(table, id, data) {
        const records = this.getAll(table);
        const idx = records.findIndex(r => r.record_id === id);
        if (idx === -1) return null;

        records[idx] = { ...records[idx], ...data, updated_at: new Date().toISOString() };
        localStorage.setItem(`fc_${table}`, JSON.stringify(records));
        return records[idx];
    },

    delete(table, id) {
        let records = this.getAll(table);
        records = records.filter(r => r.record_id !== id);
        localStorage.setItem(`fc_${table}`, JSON.stringify(records));
    },

    // --- Query helpers ---
    getByMonth(table, staffId, yearMonth) {
        return this.getAll(table).filter(r => {
            // yearMonth is "2026-04", r.date is "2026-04-02"
            return r.staff_id === staffId && r.date && r.date.startsWith(yearMonth);
        });
    },

    countByMonth(table, staffId, yearMonth) {
        return this.getByMonth(table, staffId, yearMonth).length;
    },

    // --- 月次サイクル算出 ---
    getCurrentCycle(refDate = new Date(), forceDate = null) {
        // 使用する基準日を決定（forceDateがあれば優先）
        const d = forceDate ? new Date(forceDate) : new Date(refDate);
        
        let cycleYear = d.getFullYear();
        let cycleMonth = d.getMonth(); // 0-indexed
        
        // 11日〜翌月10日を1つのサイクルとするルール
        // 例: 3/11 〜 4/10 は「3月分」
        if (d.getDate() <= MONTHLY_CYCLE.inputEnd) {
            // 1日〜10日の場合は、前月のサイクルに属する
            const prev = new Date(d);
            prev.setMonth(d.getMonth() - 1);
            cycleYear = prev.getFullYear();
            cycleMonth = prev.getMonth();
        }
        
        const targetYearMonth = `${cycleYear}-${String(cycleMonth + 1).padStart(2, '0')}`;
        
        // 3. 算出された targetYearMonth に対する「提出期限」を計算
        let deadlineYear = cycleYear;
        let deadlineMonth = cycleMonth + 1;
        if (deadlineMonth > 11) {
            deadlineMonth = 0;
            deadlineYear++;
        }
        // 期限は M+1月の10日
        const deadlineDate = new Date(deadlineYear, deadlineMonth, MONTHLY_CYCLE.inputEnd);
        
        // 4. refDate（今日）から見て、期限が過ぎているか判定
        const today = new Date(refDate);
        today.setHours(0,0,0,0);
        const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
        const isPastDeadline = daysLeft < 0;
        
        // フェーズ判定
        let phase = 'input';
        const currentDay = refDate.getDate();
        if (isPastDeadline) {
            if (currentDay >= MONTHLY_CYCLE.evalStart && currentDay <= MONTHLY_CYCLE.evalEnd) {
                phase = 'evaluation';
            } else {
                phase = 'feedback';
            }
        }

        return {
            yearMonth: targetYearMonth,
            cycleYear,
            cycleMonth: cycleMonth + 1,
            phase,
            deadlineDate,
            daysLeft: Math.max(0, daysLeft),
            deadlineStr: `${deadlineMonth + 1}月${MONTHLY_CYCLE.inputEnd}日`,
            isPastDeadline
        };
    },

    // 指定した年月(YYYY-MM)の編集期間が終了しているかチェック
    // 翌月10日を過ぎていれば「終了(false)」
    isCycleActive(yearMonthStr) {
        if (!yearMonthStr) return false;
        
        // 今日の日付から見た「本来アクティブであるべきサイクル」を取得
        const currentActiveCycle = this.getCurrentCycle(new Date());
        
        // 指定された月が「現在進行中のサイクル」でないなら、それは過去分なので active ではない(false)
        if (yearMonthStr !== currentActiveCycle.yearMonth) {
            return false;
        }

        const [y, m] = yearMonthStr.split('-').map(Number);
        const deadline = new Date(y, m, 10, 23, 59, 59);
        return new Date() <= deadline;
    },

    getCycleOptions(count = 6) {
        const options = [];
        const activeCycle = this.getCurrentCycle(new Date());
        let year = activeCycle.cycleYear;
        let month = activeCycle.cycleMonth; // 1-12
        for (let i = 0; i < count; i++) {
            const val = `${year}-${String(month).padStart(2, '0')}`;
            const label = `${year}年${String(month).padStart(2, '0')}月分`;
            options.push({ value: val, label: label });
            month--;
            if (month < 1) {
                month = 12;
                year--;
            }
        }
        return options;
    },

    // --- 初期データ投入 ---
    initDemoData() {
        // スタッフマスタ
        if (this.getAll('staff_master').length === 0) {
            DEMO_STAFF.forEach(s => this.save('staff_master', { ...s }));
        }

        // 対象者
        if (this.getAll('assignments').length === 0) {
            DEMO_TARGETS.forEach(t => this.save('assignments', { ...t, staff_id: 'FC001', is_active: true }));
        }

        // 動画課題ステータス（初期は全て未完了）
        if (this.getAll('video_tasks').length === 0) {
            Object.values(VIDEO_TASKS).flat().forEach(v => {
                if (v.sub && v.sub.length > 0) {
                  v.sub.forEach(subType => {
                    this.save('video_tasks', {
                        video_id: v.id,
                        sub_type: subType,
                        title: v.title,
                        step: v.step,
                        staff_id: 'FC001',
                        watched: false,
                        test_score: null,
                        report_submitted: false,
                        is_passed: false
                    });
                  });
                } else {
                  this.save('video_tasks', {
                      video_id: v.id,
                      title: v.title,
                      step: v.step,
                      staff_id: 'FC001',
                      watched: false,
                      test_score: null,
                      report_submitted: false,
                      is_passed: false
                  });
                }
            });
        }
    },

    // --- Utility ---
    _generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    },

    clearAll() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('fc_'));
        keys.forEach(k => localStorage.removeItem(k));
    }
};
