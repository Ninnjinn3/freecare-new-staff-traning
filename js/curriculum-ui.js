/* ============================================
   curriculum-ui.js — カリキュラム（動画課題）UI制御
   ============================================ */

const ELEARNING_URL = 'https://biz.n.study.jp/home/course/default.aspx?k=c7QmD9oepqZNApMyEwcr8r3UhRImyS32cW359nYyq3s%3d';

function getCurriculumProgress(staffId) {
    try {
        return JSON.parse(localStorage.getItem('fc_cv_' + staffId) || '{}');
    } catch(e) {
        return {};
    }
}

function saveCurriculumProgress(staffId, progress) {
    localStorage.setItem('fc_cv_' + staffId, JSON.stringify(progress));
}

/**
 * チェックボックスの変更イベント
 * @param {HTMLElement} el - チェックボックス要素
 * @param {string} staffId - 職員ID
 * @param {string} key - 課題キー (videoId__subType)
 */
function onCurriculumCheck(el, staffId, key) {
    var progress = getCurriculumProgress(staffId);
    progress[key] = el.checked;
    saveCurriculumProgress(staffId, progress);

    // カードのスタイル更新 (完了時に色を変える)
    var card = el.closest('.cv-card');
    if (card) {
        var allCbs = card.querySelectorAll('input[type="checkbox"]');
        var allDone = Array.from(allCbs).every(function(c) { return c.checked; });
        card.style.background = allDone ? '#f0fff4' : '#fff';
        card.style.borderColor = allDone ? '#4caf50' : '#eee';
    }

    // 他の画面のサマリを更新する必要があれば再描画
    // (ここでは同一画面内の更新に留める)
}

/**
 * STEP画面 (記録入力画面) の描画
 * ユーザー要望により、詳細リストではなく「現在の進捗サマリ」と「リンク」のみを表示する
 */
function renderCurriculum(step) {
    var container = document.getElementById('step' + step + '-curriculum');
    if (!container) return;

    var user = Auth.getUser();
    if (!user) return;

    var tasks = VIDEO_TASKS[step] || [];
    if (!tasks.length) { container.innerHTML = ''; return; }

    var progress = getCurriculumProgress(user.staff_id);
    var totalSubTasks = 0;
    var doneSubTasks = 0;

    tasks.forEach(function(t) {
        (t.sub || []).forEach(function(s) {
            totalSubTasks++;
            if (progress[t.id + '__' + s]) doneSubTasks++;
        });
    });

    var pct = totalSubTasks ? Math.round(doneSubTasks / totalSubTasks * 100) : 0;

    var html = '<div style="margin-bottom:15px; padding:12px; background:#f0effc; border:1px solid #6c5ce7; border-radius:12px; display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="navigateTo(\'screen-video\')">';
    html += '<div style="font-size:1.5rem;">🎬</div>';
    html += '<div style="flex:1;">';
    html += '<div style="font-size:0.85rem; font-weight:800; color:#4834d4; margin-bottom:4px;">STEP' + step + ' 学習カリキュラム進捗</div>';
    html += '<div style="background:#e0e0e0; height:6px; border-radius:10px; overflow:hidden;"><div style="background:#6c5ce7; height:100%; width:' + pct + '%;"></div></div>';
    html += '<div style="font-size:0.75rem; color:#666; margin-top:4px;">現在の達成度: ' + doneSubTasks + ' / ' + totalSubTasks + ' (' + pct + '%) <span style="color:#6c5ce7; font-weight:bold;">→ 動画課題ページで確認</span></div>';
    html += '</div>';
    html += '<div style="color:#6c5ce7; font-weight:800;">＞</div>';
    html += '</div>';

    container.innerHTML = html;
}

/**
 * 動画課題一覧画面 (screen-video) の描画
 * 50以上の課題を、横並び（グリッド）で分かりやすく表示する
 */
function loadVideoTasks() {
    var user = Auth.getUser();
    if (!user) return;
    var listEl = document.getElementById('video-tasks-list');
    if (!listEl) return;

    var staffId = user.staff_id;
    var progress = getCurriculumProgress(staffId);
    var html = '';

    [1, 2, 3, 4].forEach(function(step) {
        var tasks = VIDEO_TASKS[step] || [];
        if (!tasks.length) return;

        // STEPごとのサマリ
        var total = 0, done = 0;
        tasks.forEach(function(t) {
            (t.sub || []).forEach(function(s) {
                total++;
                if (progress[t.id + '__' + s]) done++;
            });
        });
        var pct = total ? Math.round(done / total * 100) : 0;

        html += '<div style="margin-bottom:30px;">';
        html += '<div style="background:#4c5bb7; color:white; padding:12px 16px; border-radius:12px 12px 0 0; display:flex; justify-content:space-between; align-items:center;">';
        html += '<span style="font-weight:800;">STEP' + step + ' カリキュラム</span>';
        html += '<span style="font-size:0.85rem; font-weight:bold;">' + done + ' / ' + total + ' (' + pct + '%)</span>';
        html += '</div>';
        
        // グリッドレイアウト
        html += '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap:12px; padding:15px; background:#f8f9ff; border:1px solid #4c5bb7; border-top:none; border-radius:0 0 12px 12px;">';
        
        tasks.forEach(function(task) {
            var subs = task.sub || [];
            var taskAllDone = subs.every(function(s){ return progress[task.id + '__' + s]; });

            html += '<div class="cv-card" style="background:' + (taskAllDone ? '#f0fff4' : '#fff') + '; border:1px solid ' + (taskAllDone ? '#4caf50' : '#eee') + '; border-radius:10px; padding:12px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">';
            html += '<div style="font-size:0.82rem; font-weight:700; color:#333; margin-bottom:10px; display:flex; gap:6px;"><span>' + (taskAllDone ? '✅' : '📋') + '</span> ' + task.title + '</div>';
            
            html += '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">';
            subs.forEach(function(subType) {
                var key = task.id + '__' + subType;
                var isDone = !!progress[key];

                if (subType === '動画') {
                    html += '<div style="display:flex; align-items:center; gap:6px;">';
                    html += '<a href="' + ELEARNING_URL + '" target="_blank" rel="noopener" style="padding:4px 10px; background:#4c5bb7; color:white; border-radius:15px; font-size:0.75rem; font-weight:700; text-decoration:none;" onclick="var p=this.parentElement.querySelector(\'input\'); if(p){setTimeout(function(){p.checked=true; onCurriculumCheck(p, \'' + staffId + '\', \'' + key + '\');}, 3000);}">📺 視聴</a>';
                    html += '<label style="display:flex; align-items:center; gap:3px; font-size:0.75rem; color:#666; cursor:pointer;">';
                    html += '<input type="checkbox" ' + (isDone ? 'checked' : '') + ' onchange="onCurriculumCheck(this, \'' + staffId + '\', \'' + key + '\')" style="width:18px; height:18px; cursor:pointer;"> 視聴';
                    html += '</label>';
                    html += '</div>';
                } else {
                    var icon = subType === 'テスト' ? '✍️' : subType === '報告書' ? '📝' : '📊';
                    html += '<label style="display:flex; align-items:center; gap:4px; font-size:0.75rem; cursor:pointer; padding:4px 8px; border:1px solid ' + (isDone ? '#4caf50' : '#ccc') + '; border-radius:15px; background:' + (isDone ? '#e8f5e9' : '#fff') + '">';
                    html += '<input type="checkbox" ' + (isDone ? 'checked' : '') + ' onchange="onCurriculumCheck(this, \'' + staffId + '\', \'' + key + '\')" style="width:16px; height:16px; cursor:pointer;">';
                    html += icon + ' ' + subType;
                    html += '</label>';
                }
            });
            html += '</div></div>';
        });
        
        html += '</div></div>';
    });

    listEl.innerHTML = html;
}
