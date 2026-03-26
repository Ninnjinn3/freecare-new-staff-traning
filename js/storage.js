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
            return r.staff_id === staffId && r.date && r.date.startsWith(yearMonth);
        });
    },

    countByMonth(table, staffId, yearMonth) {
        return this.getByMonth(table, staffId, yearMonth).length;
    },

    // --- 月次サイクル算出 ---
    getCurrentCycle(refDate = new Date(), forceDate = null) {
        let dateToUse = refDate;
        
        // forceDateが指定された場合（ユーザーがカレンダーで日付を選んだ場合）
        // その日付自身の月をサイクルとする
        if (forceDate) {
            dateToUse = new Date(forceDate);
        } else if (refDate.getDate() <= 10) {
            // ホーム画面等のデフォルト動作:
            // 10日までは「前月分の提出期限（今月10日）」が来ていないため、前月をアクティブサイクルとする
            dateToUse = new Date(refDate);
            dateToUse.setMonth(dateToUse.getMonth() - 1);
        }
        
        const year = dateToUse.getFullYear();
        const month = dateToUse.getMonth(); // 0-indexed

        const cycleYear = year;
        const cycleMonth = month;
        const yearMonth = `${cycleYear}-${String(cycleMonth + 1).padStart(2, '0')}`;
        
        // 提出期限は「翌月の10日」
        let deadlineYear = cycleYear;
        let deadlineMonth = cycleMonth + 1;
        if (deadlineMonth > 11) {
            deadlineMonth = 0;
            deadlineYear++;
        }
        const deadlineDate = new Date(deadlineYear, deadlineMonth, MONTHLY_CYCLE.inputEnd);
        
        // refDate（今日）からの残日数を計算（forceDateからではない点に注意）
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
            yearMonth,
            cycleYear,
            cycleMonth: cycleMonth + 1,
            phase,
            deadlineDate,
            daysLeft: Math.max(0, daysLeft),
            deadlineStr: `${deadlineMonth + 1}月${MONTHLY_CYCLE.inputEnd}日`,
            isPastDeadline
        };
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
                this.save('video_tasks', {
                    ...v,
                    staff_id: 'FC001',
                    watched: false,
                    test_score: null,
                    report_submitted: false,
                    is_passed: false
                });
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
