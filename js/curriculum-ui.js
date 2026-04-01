/* ============================================
   curriculum-ui.js — カリキュラム（動画課題）UI制御
   ============================================ */

// Eラーニングのトップページ
const ELEARNING_BASE_URL = 'https://biz.n-admin.study.jp/Home';

/**
 * 特定STEPのカリキュラム（チェックリスト）を、指定のコンテナに描画する
 * @param {number} step - 表示するSTEP番号
 */
function renderCurriculum(step) {
    const container = document.getElementById(`step${step}-curriculum`);
    if (!container) return;

    const user = Auth.getUser();
    if (!user) return;

    const tasks = VIDEO_TASKS[step] || [];
    if (tasks.length === 0) {
        container.innerHTML = '';
        return;
    }

    // LocalStorageから進捗を取得
    const progressKey = `fc_curriculum_${user.staff_id}`;
    let savedProgress = {};
    try {
        savedProgress = JSON.parse(localStorage.getItem(progressKey) || '{}');
    } catch (e) {
        savedProgress = {};
    }

    let html = `
        <div class="curriculum-section">
            <div class="curriculum-title">🎬 学習カリキュラム（STEP${step}）</div>
            <div class="curriculum-list">
    `;

    tasks.forEach(task => {
        const subs = task.sub || [];
        const totalSubs = subs.length;
        const doneSubs = subs.filter(s => savedProgress[`${task.id}_${s}`]).length;
        const allDone = totalSubs > 0 && doneSubs === totalSubs;

        html += `
            <div class="curriculum-card ${allDone ? 'is-complete' : ''}">
                <div class="curriculum-card-header">
                    <span>${allDone ? '✅' : '📋'} ${task.title}</span>
                    <span class="curriculum-card-progress">${doneSubs}/${totalSubs}</span>
                </div>
                <div class="curriculum-sub-tasks">
        `;

        subs.forEach(subType => {
            const isDone = !!savedProgress[`${task.id}_${subType}`];
            let icon = '📺';
            if (subType === 'テスト') icon = '✍️';
            else if (subType === '報告書') icon = '📝';
            else if (subType === 'アンケート') icon = '📊';
            else if (subType === '発表') icon = '🎤';

            if (subType === '動画') {
                // 動画ボタン：クリックでEラーニングを別タブで開き、チェック状態を切り替える
                html += `
                    <button
                        class="sub-task-btn ${isDone ? 'is-done' : ''}"
                        onclick="openElearningAndMark('${task.id}', '${subType}', ${step})"
                        title="クリックすると動画ページへ移動します">
                        ${isDone ? '✅' : icon} ${subType}${isDone ? '' : ' → 視聴する'}
                    </button>
                `;
            } else {
                // テスト・報告書・アンケートなど：クリックで完了/未完了を切り替え
                html += `
                    <button
                        class="sub-task-btn ${isDone ? 'is-done' : ''}"
                        onclick="toggleCurriculumTask('${task.id}', '${subType}', ${step})"
                        title="${isDone ? 'クリックで未完了に戻す' : 'クリックで完了にする'}">
                        ${isDone ? '✅' : icon} ${subType}${isDone ? ' 完了' : ''}
                    </button>
                `;
            }
        });

        html += `
                </div>
            </div>
        `;
    });

    html += `</div></div>`;
    container.innerHTML = html;
}

/**
 * 動画ボタンクリック時：Eラーニングを別タブで開き、視聴済みに更新する
 */
function openElearningAndMark(videoId, subType, step) {
    // Eラーニングページを別タブで開く
    window.open(ELEARNING_BASE_URL, '_blank');
    // 視聴済みに更新（まだ未完了の場合のみ）
    const user = Auth.getUser();
    if (!user) return;
    const progressKey = `fc_curriculum_${user.staff_id}`;
    let progress = {};
    try { progress = JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch(e) {}
    const key = `${videoId}_${subType}`;
    if (!progress[key]) {
        progress[key] = true;
        localStorage.setItem(progressKey, JSON.stringify(progress));
        showToast('動画を「視聴済み」にしました ✅\n視聴後は「テスト」「報告書」も忘れずチェックしてください！');
        renderCurriculum(step);
        // 動画課題サマリ画面も更新
        if (document.getElementById('screen-video')?.classList.contains('active')) {
            loadVideoTasks();
        }
    }
}

/**
 * テスト・報告書・アンケートの完了状態を切り替える
 */
function toggleCurriculumTask(videoId, subType, step) {
    const user = Auth.getUser();
    if (!user) return;
    const progressKey = `fc_curriculum_${user.staff_id}`;
    let progress = {};
    try { progress = JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch(e) {}

    const key = `${videoId}_${subType}`;
    const newState = !progress[key];
    progress[key] = newState;
    localStorage.setItem(progressKey, JSON.stringify(progress));

    showToast(newState ? `「${subType}」を完了にしました ✅` : `「${subType}」を未完了に戻しました`);
    renderCurriculum(step);
    if (document.getElementById('screen-video')?.classList.contains('active')) {
        loadVideoTasks();
    }
}

/**
 * 動画課題サマリ画面（screen-video）を描画する
 */
function loadVideoTasks() {
    const user = Auth.getUser();
    if (!user) return;
    const listEl = document.getElementById('video-tasks-list');
    if (!listEl) return;

    const progressKey = `fc_curriculum_${user.staff_id}`;
    let progress = {};
    try { progress = JSON.parse(localStorage.getItem(progressKey) || '{}'); } catch(e) {}

    let html = '';

    [1, 2, 3, 4].forEach(step => {
        const tasks = VIDEO_TASKS[step] || [];
        if (tasks.length === 0) return;

        let totalItems = 0;
        let doneItems = 0;
        tasks.forEach(t => {
            (t.sub || []).forEach(s => {
                totalItems++;
                if (progress[`${t.id}_${s}`]) doneItems++;
            });
        });
        const allDone = totalItems > 0 && doneItems === totalItems;
        const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

        html += `
            <div class="video-task-card" style="margin-bottom: 20px; border-radius: 12px; overflow: hidden; border: 1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                <div class="video-task-header" style="background: var(--primary); color: white; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-weight: 800;">STEP${step} 学習カリキュラム</span>
                    <span style="font-size: 0.85rem;">${allDone ? '✅ 全完了' : `⏳ ${doneItems}/${totalItems}（${pct}%）`}</span>
                </div>
                <div style="background: ${allDone ? '#f0fff4' : '#f8f9fa'}; padding: 12px 16px;">
                    <div style="background: #e0e0e0; border-radius: 10px; height: 6px; margin-bottom: 12px;">
                        <div style="background: var(--success, #4caf50); height: 6px; border-radius: 10px; width: ${pct}%; transition: width 0.4s;"></div>
                    </div>
                    ${tasks.map(t => {
                        const subs = t.sub || [];
                        const taskDone = subs.every(s => progress[`${t.id}_${s}`]);
                        return `
                            <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed #eee;">
                                <span style="font-size: 1.1rem; margin-top: 2px;">${taskDone ? '✅' : '⬜'}</span>
                                <div style="flex: 1;">
                                    <div style="font-size: 0.88rem; font-weight: 600; color: #444; margin-bottom: 5px;">${t.title}</div>
                                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                        ${subs.map(s => {
                                            const done = !!progress[`${t.id}_${s}`];
                                            return `<span style="font-size: 0.73rem; padding: 2px 8px; border-radius: 20px; border: 1px solid ${done ? 'var(--success, #4caf50)' : '#ccc'}; background: ${done ? '#e8f5e9' : '#fff'}; color: ${done ? '#2e7d32' : '#999'};">${done ? '✅' : '⬜'} ${s}</span>`;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    listEl.innerHTML = html;
}
