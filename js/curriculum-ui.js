/* ============================================
   curriculum-ui.js — カリキュラム（動画課題）UI制御
   ============================================ */

const ELEARNING_URL = 'https://biz.n-admin.study.jp/Home';

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

// チェックボックスの変更イベント
function onCurriculumCheck(staffId, key, step) {
    var progress = getCurriculumProgress(staffId);
    var cb = document.getElementById('cb_' + key);
    if (!cb) return;
    progress[key] = cb.checked;
    saveCurriculumProgress(staffId, progress);
    // カードの完了状態を更新
    var card = document.getElementById('cv_card_' + key.split('__')[0]);
    if (card) {
        var allCbs = card.querySelectorAll('input[type="checkbox"]');
        var allDone = Array.from(allCbs).every(function(c) { return c.checked; });
        card.style.background = allDone ? '#f0fff4' : '';
        card.style.borderColor = allDone ? '#4caf50' : '';
    }
    // サマリ画面も更新
    if (document.getElementById('screen-video') && 
        document.getElementById('screen-video').classList.contains('active')) {
        loadVideoTasks();
    }
}

function renderCurriculum(step) {
    var container = document.getElementById('step' + step + '-curriculum');
    if (!container) return;

    var user = Auth.getUser();
    if (!user) return;

    var tasks = VIDEO_TASKS[step] || [];
    if (!tasks.length) { container.innerHTML = ''; return; }

    var staffId = user.staff_id;
    var progress = getCurriculumProgress(staffId);

    var html = '<div style="margin-bottom:20px;">';
    html += '<div style="font-size:0.95rem;font-weight:800;color:#4c5bb7;margin-bottom:10px;padding:8px 12px;background:#eef0ff;border-radius:8px;">🎬 学習カリキュラム（STEP' + step + '）</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px;">';

    tasks.forEach(function(task) {
        var subs = task.sub || [];
        var doneCount = subs.filter(function(s) {
            return progress[task.id + '__' + s];
        }).length;
        var allDone = doneCount === subs.length && subs.length > 0;
        var cardId = 'cv_card_' + task.id;

        html += '<div id="' + cardId + '" style="border:1px solid ' + (allDone ? '#4caf50' : '#ddd') + ';border-radius:8px;padding:10px 12px;background:' + (allDone ? '#f0fff4' : '#fff') + ';">';
        html += '<div style="font-size:0.85rem;font-weight:700;margin-bottom:8px;color:#333;">' + (allDone ? '✅ ' : '📋 ') + task.title + '</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">';

        subs.forEach(function(subType) {
            var key = task.id + '__' + subType;
            var isDone = !!progress[key];
            var cbId = 'cb_' + key;

            if (subType === '動画') {
                html += '<div style="display:flex;align-items:center;gap:6px;">';
                html += '<a href="' + ELEARNING_URL + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;background:#4c5bb7;color:white;border-radius:20px;font-size:0.82rem;font-weight:700;text-decoration:none;" onclick="setTimeout(function(){document.getElementById(\'' + cbId + '\').checked=true;onCurriculumCheck(\'' + staffId + '\',\'' + key + '\',' + step + ');},3000);">📺 動画を視聴する</a>';
                html += '<label style="display:flex;align-items:center;gap:4px;font-size:0.8rem;color:#666;cursor:pointer;">';
                html += '<input type="checkbox" id="' + cbId + '" ' + (isDone ? 'checked' : '') + ' onchange="onCurriculumCheck(\'' + staffId + '\',\'' + key + '\',' + step + ')" style="width:16px;height:16px;cursor:pointer;"> 視聴完了';
                html += '</label>';
                html += '</div>';
            } else {
                var icon = subType === 'テスト' ? '✍️' : subType === '報告書' ? '📝' : subType === 'アンケート' ? '📊' : '🎤';
                html += '<label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;cursor:pointer;padding:5px 8px;border:1px solid ' + (isDone ? '#4caf50' : '#ddd') + ';border-radius:20px;background:' + (isDone ? '#e8f5e9' : '#f8f8f8') + '">';
                html += '<input type="checkbox" id="' + cbId + '" ' + (isDone ? 'checked' : '') + ' onchange="onCurriculumCheck(\'' + staffId + '\',\'' + key + '\',' + step + ')" style="width:14px;height:14px;cursor:pointer;">';
                html += icon + ' ' + subType + ' 完了';
                html += '</label>';
            }
        });

        html += '</div></div>';
    });

    html += '</div></div>';
    container.innerHTML = html;
}

function loadVideoTasks() {
    var user = Auth.getUser();
    if (!user) return;
    var listEl = document.getElementById('video-tasks-list');
    if (!listEl) return;

    var progress = getCurriculumProgress(user.staff_id);
    var html = '';

    [1, 2, 3, 4].forEach(function(step) {
        var tasks = VIDEO_TASKS[step] || [];
        if (!tasks.length) return;

        var total = 0, done = 0;
        tasks.forEach(function(t) {
            (t.sub || []).forEach(function(s) {
                total++;
                if (progress[t.id + '__' + s]) done++;
            });
        });
        var pct = total ? Math.round(done / total * 100) : 0;
        var allDone = done === total && total > 0;

        html += '<div style="margin-bottom:20px;border-radius:12px;overflow:hidden;border:1px solid ' + (allDone ? '#4caf50' : '#ddd') + ';">';
        html += '<div style="background:#4c5bb7;color:white;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">';
        html += '<span style="font-weight:800;">STEP' + step + ' 学習カリキュラム</span>';
        html += '<span style="font-size:0.85rem;">' + (allDone ? '✅ 全完了' : done + '/' + total + '（' + pct + '%）') + '</span>';
        html += '</div>';
        html += '<div style="padding:12px;background:' + (allDone ? '#f0fff4' : '#f8f9fa') + ';">';
        html += '<div style="background:#e0e0e0;border-radius:10px;height:6px;margin-bottom:10px;"><div style="background:#4caf50;height:6px;border-radius:10px;width:' + pct + '%;"></div></div>';
        tasks.forEach(function(t) {
            var subs = t.sub || [];
            var taskDone = subs.every(function(s){ return progress[t.id + '__' + s]; });
            html += '<div style="display:flex;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px dashed #eee;">';
            html += '<span>' + (taskDone ? '✅' : '⬜') + '</span>';
            html += '<div><div style="font-size:0.85rem;font-weight:600;color:#444;margin-bottom:4px;">' + t.title + '</div>';
            html += '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
            subs.forEach(function(s) {
                var isDone = !!progress[t.id + '__' + s];
                html += '<span style="font-size:0.72rem;padding:2px 8px;border-radius:20px;background:' + (isDone ? '#e8f5e9' : '#eee') + ';color:' + (isDone ? '#2e7d32' : '#999') + ';border:1px solid ' + (isDone ? '#4caf50' : '#ccc') + ';">' + (isDone ? '✅' : '⬜') + ' ' + s + '</span>';
            });
            html += '</div></div></div>';
        });
        html += '</div></div>';
    });

    listEl.innerHTML = html;
}
