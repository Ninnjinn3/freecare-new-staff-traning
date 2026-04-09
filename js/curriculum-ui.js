/* ============================================
   curriculum-ui.js — カリキュラム（動画課題）UI制御
   In-App E-Learning: Google Drive Video + Test + Report
   ============================================ */

// 動画課題画面で現在選択されているSTEP
let curriculumActiveStep = 1;

// 現在開いているレッスンの情報
let _currentLesson = null;
let _currentTestAnswers = {};

// ============================================
// ローカル進捗管理（Supabaseへの移行準備）
// ============================================
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

// ============================================
// STEPサマリ（ホーム画面のミニ進捗表示）
// ============================================
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
    html += '<div style="font-size:0.85rem; font-weight:800; color:#4834d4; margin-bottom:4px;">第' + step + '段階 カリキュラム進捗</div>';
    html += '<div style="background:#e0e0e0; height:6px; border-radius:10px; overflow:hidden;"><div style="background:#6c5ce7; height:100%; width:' + pct + '%;"></div></div>';
    html += '<div style="font-size:0.75rem; color:#666; margin-top:4px;">達成度: ' + done + ' / ' + total + ' (' + pct + '%) <span style="color:#6c5ce7; font-weight:bold;">→ 課題ページで確認</span></div>';
    html += '</div>';
    html += '<div style="color:#6c5ce7; font-weight:800;">＞</div>';
    html += '</div>';

    container.innerHTML = html;
}

function switchCurriculumStep(step) {
    curriculumActiveStep = step;
    loadVideoTasks();
}

// ============================================
// 動画課題一覧画面（screen-video）
// ============================================
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

    // タブUI
    var html = '<div class="curriculum-tabs" style="display:flex; overflow-x:auto; gap:8px; margin-bottom:20px; padding-bottom:5px;">';
    [1, 2, 3, 4].forEach(function(s) {
        var isActive = curriculumActiveStep === s;
        html += '<button onclick="switchCurriculumStep(' + s + ')" style="flex:1; min-width:80px; padding:10px; border-radius:10px; border:2px solid ' + (isActive ? '#6c5ce7' : '#ddd') + '; background:' + (isActive ? '#6c5ce7' : '#fff') + '; color:' + (isActive ? '#fff' : '#666') + '; font-weight:bold; cursor:pointer; font-size:0.9rem; transition:0.2s;">第' + s + '段階</button>';
    });
    html += '</div>';

    var tasks = VIDEO_TASKS[curriculumActiveStep] || [];
    var total = 0, done = 0;
    tasks.forEach(function(t) { (t.sub || []).forEach(function(s) { total++; if (progress[t.id + '__' + s]) done++; }); });
    var pct = total ? Math.round(done / total * 100) : 0;

    // 進捗バー
    html += '<div style="background:#eef0ff; padding:15px; border-radius:12px; margin-bottom:20px; border:1px solid #4c5bb7;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
    html += '<span style="font-weight:800; color:#4c5bb7;">第' + curriculumActiveStep + '段階 の課題一覧</span>';
    html += '<span style="font-size:0.85rem; font-weight:bold; color:#4c5bb7;">' + done + ' / ' + total + ' (' + pct + '%)</span>';
    html += '</div>';
    html += '<div style="background:#c8cce8; height:8px; border-radius:10px; overflow:hidden;"><div style="background:#4c5bb7; height:100%; width:' + pct + '%; transition:width 0.5s;"></div></div>';
    html += '</div>';

    // グリッド
    html += '<div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:12px;">';

    tasks.forEach(function(task) {
        var subs = task.sub || [];
        var taskAllDone = subs.every(function(s){ return progress[task.id + '__' + s]; });
        var doneCount = subs.filter(function(s){ return progress[task.id + '__' + s]; }).length;
        var hasDriveId = !!(task.drive_id);

        html += '<div class="cv-card" style="background:' + (taskAllDone ? '#f0fff4' : '#fff') + '; border:1px solid ' + (taskAllDone ? '#4caf50' : '#e8eaf6') + '; border-radius:12px; padding:14px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">';
        html += '<div style="font-size:0.82rem; font-weight:700; color:#333; margin-bottom:12px; line-height:1.4;">' + (taskAllDone ? '✅' : '🎬') + ' ' + task.title + '</div>';

        // 進捗ミニバー
        var taskPct = subs.length ? Math.round(doneCount / subs.length * 100) : 0;
        html += '<div style="margin-bottom:12px;">';
        html += '<div style="background:#eee; height:5px; border-radius:5px; overflow:hidden;"><div style="background:' + (taskAllDone ? '#4caf50' : '#6c5ce7') + '; height:100%; width:' + taskPct + '%; transition:0.4s;"></div></div>';
        html += '</div>';

        // 各サブタスク
        html += '<div style="display:flex; flex-direction:column; gap:8px;">';
        subs.forEach(function(subType) {
            var key = task.id + '__' + subType;
            var isDone = !!progress[key];
            var icon = subType === '動画' ? '📺' : subType === 'テスト' ? '✍️' : subType === '報告書' ? '📝' : subType === 'アンケート' ? '📊' : '🎤';

            html += '<div style="display:flex; align-items:center; gap:8px;">';
            html += '<div style="font-size:0.82rem; font-weight:700; color:#555; width:60px;">' + icon + ' ' + subType + '</div>';

            if (hasDriveId || isDone) {
                // クリックで起動できるボタン
                html += '<button onclick="openLessonModal(\'' + task.id + '\', \'' + subType + '\')" ';
                html += 'style="flex:1; padding:6px 10px; border-radius:8px; border:1px solid ' + (isDone ? '#4caf50' : '#6c5ce7') + '; background:' + (isDone ? '#e8f5e9' : '#f0effc') + '; color:' + (isDone ? '#2e7d32' : '#4834d4') + '; font-size:0.8rem; font-weight:700; cursor:pointer; text-align:left; transition:0.2s;">';
                html += isDone ? '✅ 完了済み — もう一度見る' : '▶ 開始する';
                html += '</button>';
            } else {
                // まだ動画IDがない場合は従来チェックボックス
                html += '<label style="flex:1; display:flex; align-items:center; gap:4px; font-size:0.78rem; color:' + (isDone ? '#2e7d32' : '#666') + '; cursor:pointer; padding:5px 10px; border:1px solid ' + (isDone ? '#4caf50' : '#ccc') + '; border-radius:8px; background:' + (isDone ? '#e8f5e9' : '#fff') + ';">';
                html += '<input type="checkbox" ' + (isDone ? 'checked' : '') + ' onchange="onCurriculumCheck(this, \'' + staffId + '\', \'' + key + '\')" style="width:16px; height:16px; cursor:pointer;">';
                html += isDone ? '完了' : '完了にする';
                html += '</label>';
            }
            html += '</div>';
        });
        html += '</div></div>';
    });

    html += '</div>';
    listEl.innerHTML = html;
}

function onCurriculumCheck(el, staffId, key) {
    var progress = getCurriculumProgress(staffId);
    progress[key] = el.checked;
    saveCurriculumProgress(staffId, progress);

    var card = el.closest('.cv-card');
    if (card) {
        var allCbs = card.querySelectorAll('input[type="checkbox"]');
        var allDone = Array.from(allCbs).every(function(c) { return c.checked; });
        card.style.background = allDone ? '#f0fff4' : '#fff';
        card.style.borderColor = allDone ? '#4caf50' : '#e8eaf6';
    }
}

// ============================================
// レッスンモーダル制御
// ============================================
function openLessonModal(taskId, subType) {
    var task = null;
    for (var step in VIDEO_TASKS) {
        var found = VIDEO_TASKS[step].find(function(t) { return t.id === taskId; });
        if (found) { task = found; break; }
    }
    if (!task) return;

    _currentLesson = { task: task, subType: subType };
    _currentTestAnswers = {};

    document.getElementById('lesson-modal-title').textContent = task.title;
    document.getElementById('lesson-modal-step').textContent = '第' + task.step + '段階 — ' + subType;

    // 動画URLをセット（Google Drive preview URL）
    var driveId = task.drive_id;
    if (driveId) {
        document.getElementById('lesson-video-iframe').src = 'https://drive.google.com/file/d/' + driveId + '/preview';
    } else {
        document.getElementById('lesson-video-iframe').src = '';
    }

    // 開くタブを決める
    var openTab = subType === 'テスト' ? 'test' : subType === '報告書' ? 'report' : 'video';
    switchLessonTab(openTab);

    // テスト内容を構築
    if (task.questions && task.questions.length > 0) {
        renderTestQuestions(task.questions);
    } else {
        document.getElementById('lesson-test-content').innerHTML = '<div style="text-align:center; padding:30px; color:#aaa;">このレッスンのテスト問題はまだ登録されていません。</div>';
    }

    // 報告書リセット
    var form = document.getElementById('lesson-report-form');
    var doneMsgEl = document.getElementById('lesson-report-done');
    if (form) form.style.display = 'block';
    if (doneMsgEl) doneMsgEl.style.display = 'none';
    var reportQ1 = document.getElementById('report-q1');
    var reportQ2 = document.getElementById('report-q2');
    var reportQ3 = document.getElementById('report-q3');
    if (reportQ1) reportQ1.value = '';
    if (reportQ2) reportQ2.value = '';
    if (reportQ3) reportQ3.value = '';

    document.getElementById('lesson-modal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeLessonModal() {
    document.getElementById('lesson-modal').style.display = 'none';
    document.getElementById('lesson-video-iframe').src = ''; // stop video
    document.body.style.overflow = '';
    _currentLesson = null;
}

function switchLessonTab(tabName) {
    ['video', 'test', 'report'].forEach(function(t) {
        var contentEl = document.getElementById('lesson-tab-' + t);
        var btnEl = document.getElementById('tab-btn-' + t);
        var isActive = t === tabName;
        if (contentEl) contentEl.style.display = isActive ? 'block' : 'none';
        if (btnEl) {
            btnEl.style.color = isActive ? '#4c5bb7' : '#aaa';
            btnEl.style.borderBottom = isActive ? '3px solid #4c5bb7' : '3px solid transparent';
        }
    });
}

// ============================================
// 動画 — 視聴完了
// ============================================
function markVideoWatched() {
    if (!_currentLesson) return;
    var task = _currentLesson.task;
    var user = Auth.getUser();
    var progress = getCurriculumProgress(user.staff_id);
    progress[task.id + '__動画'] = true;
    saveCurriculumProgress(user.staff_id, progress);

    var btn = document.getElementById('btn-video-done');
    if (btn) {
        btn.textContent = '✅ 視聴済み！';
        btn.style.background = '#4caf50';
        btn.style.cursor = 'default';
        btn.onclick = null;
    }
    if (typeof showToast === 'function') showToast('動画の視聴を記録しました 🎬');
    // テストタブへ誘導
    setTimeout(function() { switchLessonTab('test'); }, 800);
}

// ============================================
// テスト — 描画・採点
// ============================================
function renderTestQuestions(questions) {
    var container = document.getElementById('lesson-test-content');
    var resultEl = document.getElementById('lesson-test-result');
    if (!container) return;
    if (resultEl) resultEl.style.display = 'none';

    var html = '';
    questions.forEach(function(q, idx) {
        html += '<div style="margin-bottom:24px; padding:16px; background:#f8f9ff; border-radius:12px; border:1px solid #e8eaf6;">';
        html += '<div style="font-weight:800; color:#333; margin-bottom:12px; font-size:0.92rem;">Q' + (idx + 1) + '. ' + q.question + '</div>';
        html += '<div style="display:flex; flex-direction:column; gap:8px;">';
        ['A', 'B', 'C', 'D'].forEach(function(letter, ci) {
            var choiceText = q.choices[ci] || '';
            if (!choiceText) return;
            html += '<button onclick="selectTestAnswer(' + idx + ', \'' + letter + '\', this)" ';
            html += 'id="test-q' + idx + '-' + letter + '" ';
            html += 'style="padding:10px 14px; border:2px solid #ddd; border-radius:8px; background:#fff; text-align:left; cursor:pointer; font-size:0.88rem; color:#333; transition:0.15s; font-weight:500;">';
            html += '<strong style="color:#6c5ce7; margin-right:6px;">' + letter + '.</strong>' + choiceText;
            html += '</button>';
        });
        html += '</div></div>';
    });

    html += '<div style="text-align:right; margin-top:16px;">';
    html += '<button onclick="submitTest()" style="background:linear-gradient(135deg,#4c5bb7,#6c5ce7); color:#fff; border:none; padding:12px 28px; border-radius:10px; font-weight:800; cursor:pointer; font-size:0.95rem;">採点する →</button>';
    html += '</div>';

    container.innerHTML = html;
}

function selectTestAnswer(qIdx, letter, btn) {
    // 同じ問題の他の選択肢をリセット
    ['A','B','C','D'].forEach(function(l) {
        var el = document.getElementById('test-q' + qIdx + '-' + l);
        if (el) {
            el.style.borderColor = '#ddd';
            el.style.background = '#fff';
            el.style.color = '#333';
        }
    });
    // 選択をハイライト
    btn.style.borderColor = '#6c5ce7';
    btn.style.background = '#f0effc';
    btn.style.color = '#4834d4';
    _currentTestAnswers[qIdx] = letter;
}

function submitTest() {
    if (!_currentLesson || !_currentLesson.task.questions) return;
    var questions = _currentLesson.task.questions;
    var answered = Object.keys(_currentTestAnswers).length;
    if (answered < questions.length) {
        if (typeof showToast === 'function') showToast('全問回答してから採点してください');
        return;
    }

    var correct = 0;
    questions.forEach(function(q, idx) {
        var userAns = _currentTestAnswers[idx];
        if (userAns === q.answer) {
            correct++;
            // 正解を緑に
            var el = document.getElementById('test-q' + idx + '-' + userAns);
            if (el) { el.style.borderColor = '#4caf50'; el.style.background = '#e8f5e9'; el.style.color = '#2e7d32'; }
        } else {
            // 不正解を赤に、正解を緑表示
            var wrongEl = document.getElementById('test-q' + idx + '-' + userAns);
            if (wrongEl) { wrongEl.style.borderColor = '#e53935'; wrongEl.style.background = '#ffebee'; wrongEl.style.color = '#c62828'; }
            var correctEl = document.getElementById('test-q' + idx + '-' + q.answer);
            if (correctEl) { correctEl.style.borderColor = '#4caf50'; correctEl.style.background = '#e8f5e9'; correctEl.style.color = '#2e7d32'; }
        }
    });

    var score = Math.round(correct / questions.length * 100);
    var resultEl = document.getElementById('lesson-test-result');
    var scoreTextEl = document.getElementById('lesson-test-score-text');
    if (resultEl) resultEl.style.display = 'block';
    if (scoreTextEl) scoreTextEl.textContent = correct + ' / ' + questions.length + '問正解 (' + score + '点)';
    if (scoreTextEl) scoreTextEl.style.color = score >= 80 ? '#2e7d32' : '#e53935';

    // 進捗保存
    var user = Auth.getUser();
    var progress = getCurriculumProgress(user.staff_id);
    progress[_currentLesson.task.id + '__テスト'] = score >= 80;
    saveCurriculumProgress(user.staff_id, progress);

    if (score >= 80 && typeof showToast === 'function') showToast('テスト合格！報告書を書いてみましょう 📝');
}

function retryTest() {
    if (!_currentLesson || !_currentLesson.task.questions) return;
    _currentTestAnswers = {};
    renderTestQuestions(_currentLesson.task.questions);
}

// ============================================
// 報告書 — 提出
// ============================================
function submitLessonReport(event) {
    event.preventDefault();
    if (!_currentLesson) return;

    var q1 = document.getElementById('report-q1').value.trim();
    var q2 = document.getElementById('report-q2').value.trim();
    var q3 = document.getElementById('report-q3').value.trim();

    if (!q1 || !q2 || !q3) {
        if (typeof showToast === 'function') showToast('3問すべて入力してください');
        return;
    }

    var btn = document.getElementById('btn-report-submit');
    if (btn) { btn.disabled = true; btn.textContent = '提出中...'; }

    // Supabase に保存 (テーブルがあれば)
    var saveData = {
        staff_id: Auth.getUser()?.staff_id,
        video_id: _currentLesson.task.id,
        report_content: { q1: q1, q2: q2, q3: q3 },
        updated_at: new Date().toISOString()
    };

    var savePromise;
    if (window.fcSupabase) {
        savePromise = window.fcSupabase
            .from('care_video_progress')
            .upsert(saveData, { onConflict: 'staff_id,video_id' })
            .then(function(result) {
                if (result.error) console.warn('Report save warn:', result.error.message);
            });
    } else {
        savePromise = Promise.resolve();
    }

    savePromise.finally(function() {
        // ローカル進捗にも保存
        var user = Auth.getUser();
        var progress = getCurriculumProgress(user.staff_id);
        progress[_currentLesson.task.id + '__報告書'] = true;
        saveCurriculumProgress(user.staff_id, progress);

        document.getElementById('lesson-report-form').style.display = 'none';
        document.getElementById('lesson-report-done').style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = '📤 提出する'; }
        if (typeof showToast === 'function') showToast('報告書を提出しました！ 🎉');

        // カード更新
        setTimeout(function() { loadVideoTasks(); }, 500);
    });
}
