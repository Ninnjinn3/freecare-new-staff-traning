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
        // 1. ホーム画面などのデフォルトの「アクティブサイクル」を算出
        // 毎月10日までは、前月分をアクティブとする
        const activeDate = new Date(refDate);
        if (activeDate.getDate() <= 10) {
            activeDate.setMonth(activeDate.getMonth() - 1);
        }
        
        let cycleYear = activeDate.getFullYear();
        let cycleMonth = activeDate.getMonth(); // 0-indexed
        let targetYearMonth = `${cycleYear}-${String(cycleMonth + 1).padStart(2, '0')}`;
        
        // 2. forceDate(入力日付) が指定された場合、それがどの月に属するかを再判定
        // 基本ルール: M月のサイクルは「M月1日 〜 M+1月10日」
        if (forceDate) {
            const inputDate = new Date(forceDate);
            const inputYear = inputDate.getFullYear();
            const inputMonth = inputDate.getMonth();
            const inputDay = inputDate.getDate();
            
            if (inputDay <= 10) {
                // 入力日が1日〜10日の場合（例：4月5日）
                // この日付は「3月サイクル(期限4/10)」でも「4月サイクル(期限5/10)」でもあり得る重複期間。
                // 現在のアクティブサイクルが「3月」なら3月に寄せ、それ以外なら「4月」に寄せる。
                const prevMonthDate = new Date(inputYear, inputMonth - 1, 1);
                const prevCycleStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
                const currCycleStr = `${inputYear}-${String(inputMonth + 1).padStart(2, '0')}`;
                
                if (targetYearMonth === prevCycleStr) {
                    // そのまま (e.g. 2026-03 のまま)
                } else {
                    cycleYear = inputYear;
                    cycleMonth = inputMonth;
                    targetYearMonth = currCycleStr;
                }
            } else {
                // 入力日が11日以降の場合は、確実にその月がサイクルとなる
                cycleYear = inputYear;
                cycleMonth = inputMonth;
                targetYearMonth = `${cycleYear}-${String(cycleMonth + 1).padStart(2, '0')}`;
            }
        }
        
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
