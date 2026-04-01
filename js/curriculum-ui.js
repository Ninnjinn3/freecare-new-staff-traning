/* ============================================
   curriculum-ui.js — カリキュラム（動画課題）UI制御
   ============================================ */

const ELEARNING_URL = 'https://biz.n.study.jp/home/course/default.aspx?k=c7QmD9oepqZNApMyEwcr8r3UhRImyS32cW359nYyq3s%3d';

// 動画課題画面で現在選択されているSTEP
let curriculumActiveStep = 1;

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
 */
function onCurriculumCheck(el, staffId, key) {
    var progress = getCurriculumProgress(staffId);
    progress[key] = el.checked;
    saveCurriculumProgress(staffId, progress);

    // カードのスタイル更新
    var card = el.closest('.cv-card');
    if (card) {
        var allCbs = card.querySelectorAll('input[type="checkbox"]');
        var allDone = Array.from(allCbs).every(function(c) { return c.checked; });
        card.style.background = allDone ? '#f0fff4' : '#fff';
        card.style.borderColor = allDone ? '#4caf50' : '#eee';
    }
}

/**
 * 動画課題画面でSTEPを切り替える
 */
function switchCurriculumStep(step) {
    curriculumActiveStep = step;
    loadVideoTasks();
}

/**
 * STEP画面 (記録入力画面) のサマリ表示
 */
function renderCurriculum(step) {
    var container = document.getElementById('step' + step + '-curriculum');
    if (!container) return;
    var user = Auth.getUser();
    if (!user) return;

    var tasks = VIDEO_TASKS[step] || [];
    if (!tasks.length) { container.innerHTML = ''; return; }

    var progress = getCurriculumProgress(user.staff_id);
    var total = 0, done = 0;
    tasks.forEach(function(t) {
        (t.sub || []).forEach(function(s) {
            total++;
            if (progress[t.id + '__' + s]) done++;
        });
    });
    var pct = total ? Math.round(done / total * 100) : 0;

    var html = '<div style="margin-bottom:15px; padding:12px; background:#f0effc; border:1px solid #6c5ce7; border-radius:12px; display:flex; align-items:center; gap:12px; cursor:pointer;" onclick="switchCurriculumStep(' + step + '); navigateTo(\'screen-video\');">';
    html += '<div style="font-size:1.5rem;">🎬</div>';
    html += '<div style="flex:1;">';
    html += '<div style="font-size:0.85rem; font-weight:800; color:#4834d4; margin-bottom:4px;">STEP' + step + ' 学習カリキュラム進捗</div>';
    html += '<div style="background:#e0e0e0; height:6px; border-radius:10px; overflow:hidden;"><div style="background:#6c5ce7; height:100%; width:' + pct + '%;"></div></div>';
    html += '<div style="font-size:0.75rem; color:#666; margin-top:4px;">達成度: ' + done + ' / ' + total + ' (' + pct + '%) <span style="color:#6c5ce7; font-weight:bold;">→ 課題ページで確認</span></div>';
    html += '</div>';
    html += '<div style="color:#6c5ce7; font-weight:800;">＞</div>';
    html += '</div>';

    container.innerHTML = html;
}

/**
 * 動画課題一覧画面 (screen-video) の描画
 */
function loadVideoTasks() {
    var user = Auth.getUser();
    if (!user) return;
    var listEl = document.getElementById('video-tasks-list');
    if (!listEl) return;

    var staffId = user.staff_id;
    var progress = getCurriculumProgress(staffId);
    
    if (!window._curriculumInitialized) {
        curriculumActiveStep = user.current_step || 1;
        window._curriculumInitialized = true;
    }

    var html = '<div class="curriculum-tabs" style="display:flex; overflow-x:auto; gap:8px; margin-bottom:20px; padding-bottom:5px;">';
    [1, 2, 3, 4].forEach(function(s) {
        var isActive = curriculumActiveStep === s;
        html += '<button onclick="switchCurriculumStep(' + s + ')" style="flex:1; min-width:80px; padding:10px; border-radius:10px; border:2px solid ' + (isActive ? '#6c5ce7' : '#ddd') + '; background:' + (isActive ? '#6c5ce7' : '#fff') + '; color:' + (isActive ? '#fff' : '#666') + '; font-weight:bold; cursor:pointer; font-size:0.9rem; transition:0.2s;">STEP ' + s + '</button>';
    });
    html += '</div>';

    var tasks = VIDEO_TASKS[curriculumActiveStep] || [];
    var total = 0, done = 0;
    tasks.forEach(function(t) { (t.sub || []).forEach(function(s) { total++; if (progress[t.id + '__' + s]) done++; }); });
    var pct = total ? Math.round(done / total * 100) : 0;

    html += '<div style="background:#eef0ff; padding:15px; border-radius:12px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; border:1px solid #4c5bb7;">';
    html += '<span style="font-weight:800; color:#4c5bb7;">STEP ' + curriculumActiveStep + ' の課題一覧</span>';
    html += '<span style="font-size:0.85rem; font-weight:bold; color:#4c5bb7;">' + done + ' / ' + total + ' (' + pct + '%)</span>';
    html += '</div>';

    html += '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:12px;">';
    
    tasks.forEach(function(task) {
        var subs = task.sub || [];
        var taskAllDone = subs.every(function(s){ return progress[task.id + '__' + s]; });
        var taskUrls = task.urls || {};

        html += '<div class="cv-card" style="background:' + (taskAllDone ? '#f0fff4' : '#fff') + '; border:1px solid ' + (taskAllDone ? '#4caf50' : '#eee') + '; border-radius:10px; padding:12px; box-shadow:0 2px 4px rgba(0,0,0,0.03);">';
        html += '<div style="font-size:0.8rem; font-weight:700; color:#333; margin-bottom:10px;">' + (taskAllDone ? '✅' : '📋') + ' ' + task.title + '</div>';
        html += '<div style="display:flex; flex-direction:column; gap:10px;">';
        
        subs.forEach(function(subType) {
            var key = task.id + '__' + subType;
            var isDone = !!progress[key];
            var specificUrl = taskUrls[subType];
            var icon = subType === '動画' ? '📺' : subType === 'テスト' ? '✍️' : subType === '報告書' ? '📝' : '📊';
            var btnText = subType === '動画' ? '視聴' : (subType + 'を開く');

            html += '<div style="display:flex; align-items:center; gap:8px;">';
            
            // 個別URLがある、または「動画」の場合はボタンを表示
            if (specificUrl || subType === '動画') {
                var url = specificUrl || ELEARNING_URL;
                html += '<a href="' + url + '" target="_blank" rel="noopener" style="padding:4px 10px; background:#4c5bb7; color:white; border-radius:15px; font-size:0.75rem; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:4px;" onclick="var p=this.parentElement.querySelector(\'input\'); if(p){setTimeout(function(){p.checked=true; onCurriculumCheck(p, \'' + staffId + '\', \'' + key + '\');}, 3000);}">' + icon + ' ' + btnText + '</a>';
            }

            html += '<label style="display:flex; align-items:center; gap:3px; font-size:0.75rem; color:#666; cursor:pointer; ' + (specificUrl ? '' : 'padding:4px 8px; border:1px solid '+ (isDone?'#4caf50':'#ccc') +'; border-radius:15px; background:'+ (isDone?'#e8f5e9':'#fff') +';') + '">';
            html += '<input type="checkbox" ' + (isDone ? 'checked' : '') + ' onchange="onCurriculumCheck(this, \'' + staffId + '\', \'' + key + '\')" style="width:18px; height:18px; cursor:pointer;">';
            html += (specificUrl ? '完了' : (icon + ' ' + subType + ' 完了'));
            html += '</label>';
            html += '</div>';
        });
        html += '</div></div>';
    });
    
    html += '</div>';
    listEl.innerHTML = html;
}
