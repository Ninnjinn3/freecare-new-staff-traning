/* ============================================
   step1.js — STEP1 気付き入力 + AI◯☓判定
   ============================================ */

const Step1 = {
    // 画面初期化
    init() {
        const dateInput = document.getElementById('step1-date');
        dateInput.value = new Date().toISOString().split('T')[0];

        // 対象者セレクトボックス
        this.populateTargets();

        // 文字数カウント
        const textarea = document.getElementById('step1-notice');
        textarea.addEventListener('input', () => {
            document.getElementById('step1-char-count').textContent = textarea.value.length;
        });

        // 月表示
        const cycle = DB.getCurrentCycle();
        document.getElementById('step1-month').textContent = `${cycle.yearMonth} サイクル`;

        // 今月サマリ更新
        this.updateSummary();
    },

    populateTargets() {
        // Step1はオートコンプリートを使用（app.jsのgetTargetList経由）
        // セレクトボックスは使用しない
    },

    // 今月のサマリ更新
    async updateSummary() {
        const user = Auth.getUser();
        if (!user) return;

        const cycle = DB.getCurrentCycle();
        const records = await API.getStep1Records(user.staff_id, cycle.yearMonth);

        const totalCount = records.length;
        const circleCount = records.filter(r => r.ai_judgement === '○').length;
        const crossCount = records.filter(r => r.ai_judgement === '☓').length;

        document.getElementById('step1-total-count').textContent = totalCount;
        document.getElementById('step1-circle-count').textContent = circleCount;
        document.getElementById('step1-cross-count').textContent = crossCount;
    },

    // AI判定（Phase 1: ルールベース）
    judge(noticeText) {
        const text = noticeText.trim();
        const result = {
            judgement: '○',
            short_comment: '',
            good_points: [],
            missing_points: [],
            improvement_example: ''
        };

        let score = 0;

        // チェック1: 文字数（30文字以上あるか）
        if (text.length >= 30) {
            score += 20;
            result.good_points.push('十分な記述量があります');
        } else {
            result.missing_points.push('記述が短すぎます。具体的な状況を詳しく記載しましょう');
        }

        // チェック2: 日時・時間の記載
        const timePattern = /(\d{1,2}[時じ:]|\d{1,2}月\d{1,2}日|朝|昼|夕方|夜|午前|午後)/;
        if (timePattern.test(text)) {
            score += 20;
            result.good_points.push('日時・時間帯が具体的に記録されています');
        } else {
            result.missing_points.push('いつ（時間帯）の出来事かを記載しましょう');
        }

        // チェック3: 場所・場面の記載
        const placePattern = /(フロア|居室|食堂|トイレ|浴室|玄関|廊下|リビング|ベッド|車椅子|テーブル|デイ|訪問)/;
        if (placePattern.test(text)) {
            score += 20;
            result.good_points.push('場所・場面が記録されています');
        } else {
            result.missing_points.push('どこで起きたことかを記載しましょう');
        }

        // チェック4: 変化・比較の記載
        const changePattern = /(いつも|普段|以前|変化|今日は|最近|初めて|違う|なかった|なくなった|増えた|減った|できていた)/;
        if (changePattern.test(text)) {
            score += 20;
            result.good_points.push('変化・比較が記録されています');
        } else {
            result.missing_points.push('「普段は〜だが、今日は〜」のように変化を比較して記載しましょう');
        }

        // チェック5: 本人の反応・言動
        const reactionPattern = /(言った|話した|訴えた|表情|笑顔|涙|怒|不安|嫌|痛い|うなずいた|拒否|声|目|視線|手|動)/;
        if (reactionPattern.test(text)) {
            score += 20;
            result.good_points.push('本人の反応・言動が記録されています');
        } else {
            result.missing_points.push('本人の表情・言動・反応を具体的に記載しましょう');
        }

        // 判定
        if (score >= 60) {
            result.judgement = '○';
            result.short_comment = result.good_points.length >= 3
                ? '具体的で観察力のある記録です！'
                : '基本的な要素は押さえられています。さらに詳細を加えるとより良い記録になります。';
        } else {
            result.judgement = '×';
            result.short_comment = '記録に不足している要素があります。改善点を確認しましょう。';
            result.improvement_example = '例: 「朝9時、フロアであいさつを呼びかけたが、Aさんは視線を合わせず返答もなかった。普段は笑顔で返している。眉間にしわが寄り、やや険しい表情だった。」';
        }

        return result;
    }
};

// フォーム送信
async function submitStep1(event) {
    event.preventDefault();

    const user = Auth.getUser();
    if (!user) return;

    const date = document.getElementById('step1-date').value;
    const notice = document.getElementById('step1-notice').value;

    // 対象者はオートコンプリートで選択されたものを使用
    const target = getStepSelectedTarget('step1');
    if (!target) {
        showToast('対象者を選択してください');
        return;
    }

    // ボタン無効化（二重送信防止）
    const btn = document.getElementById('step1-submit-btn');
    btn.disabled = true;
    btn.textContent = 'AI判定中...';

    // Gemini AI判定（Vercel経由）
    const judgeData = {
        target_name: target.name,
        date: date,
        notice_text: notice
    };

    let aiResult;
    try {
        aiResult = await API.judgeStep1(judgeData);
    } catch (e) {
        btn.disabled = false;
        btn.textContent = '送信して判定を受ける';
        showToast('エラー: ' + e.message);
        return; // エラー時はここで中断
    }

    // Supabaseに保存
    const cycle = DB.getCurrentCycle();
    const isSaved = await API.saveStep1({
        staff_id: user.staff_id,
        target_id: target.id || null,
        target_name: target.name,
        year_month: cycle.yearMonth,
        date: date,
        notice_text: notice,
        char_count: notice.length,
        ai_judgement: aiResult.judgement,
        ai_comment: aiResult.short_comment,
        ai_good_points: aiResult.good_points,
        ai_missing: aiResult.missing_points,
        ai_improve: aiResult.improvement_example
    });

    btn.disabled = false;
    btn.textContent = '送信して判定を受ける';

    if (isSaved) {
        showToast('本日の記録を提出しました ✅');
        document.getElementById('step1-form').reset();
        document.getElementById('step1-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('step1-char-count').textContent = '0';
        Step1.updateSummary();
    } else {
        showToast('保存に失敗しました。もう一度お試しください。');
    }
}

// ◯☓結果画面表示
function showResult(result) {
    // AIのハルシネーション対策: 不足点があるのに○判定なら強制的に×にする
    if (result.missing_points && result.missing_points.length > 0) {
        result.judgement = '×';
    }

    const circle = document.getElementById('result-circle');
    const isCorrect = result.judgement === '○';

    circle.textContent = result.judgement;
    circle.className = 'result-circle ' + (isCorrect ? 'is-correct' : 'is-incorrect');

    document.getElementById('result-comment').textContent = result.short_comment;

    // Good points
    const goodSection = document.getElementById('result-good');
    const goodList = document.getElementById('result-good-list');
    goodList.innerHTML = '';
    if (result.good_points.length > 0) {
        goodSection.hidden = false;
        result.good_points.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            goodList.appendChild(li);
        });
    } else {
        goodSection.hidden = true;
    }

    // Missing points
    const missingSection = document.getElementById('result-missing');
    const missingList = document.getElementById('result-missing-list');
    missingList.innerHTML = '';
    if (result.missing_points.length > 0) {
        missingSection.hidden = false;
        result.missing_points.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p;
            missingList.appendChild(li);
        });
    } else {
        missingSection.hidden = true;
    }

    // Improvement example
    const improveSection = document.getElementById('result-improve');
    if (result.improvement_example) {
        improveSection.hidden = false;
        document.getElementById('result-improve-text').textContent = result.improvement_example;
    } else {
        improveSection.hidden = true;
    }

    // Applied Knowledge
    const knowledgeSection = document.getElementById('result-knowledge');
    const knowledgeText = document.getElementById('result-knowledge-text');
    if (result.applied_knowledge && result.applied_knowledge.trim() !== "") {
        if (knowledgeSection && knowledgeText) {
            knowledgeSection.hidden = false;
            knowledgeText.textContent = result.applied_knowledge;
        }
    } else {
        if (knowledgeSection) knowledgeSection.hidden = true;
    }

    // Breakdown Visualization
    const breakdownSection = document.getElementById('result-breakdown');
    const breakdownList = document.getElementById('result-breakdown-list');
    if (breakdownSection && breakdownList && result.breakdown) {
        breakdownSection.hidden = false;
        const labels = {
            change_clarity: { name: '気づいた変化の明確さ', max: 15 },
            multi_factor: { name: '要因の多層的分析', max: 20 },
            priority: { name: '要因の関連性と優先順位', max: 15 },
            verification: { name: '検証計画の論理性', max: 15 },
            support_plan: { name: '支援計画の実効性', max: 20 },
            reflection: { name: '振り返り・修正力', max: 15 }
        };

        breakdownList.innerHTML = Object.entries(labels).map(([key, info]) => {
            const score = result.breakdown[key] || 0;
            const pct = (score / info.max) * 100;
            return `
                <div class="breakdown-item">
                    <div class="breakdown-header">
                        <span class="breakdown-label">${info.name}</span>
                        <span class="breakdown-score">${score} / ${info.max}</span>
                    </div>
                    <div class="breakdown-bar-bg">
                        <div class="breakdown-bar-fill" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    } else if (breakdownSection) {
        breakdownSection.hidden = true;
    }

    navigateTo('screen-result');
}
