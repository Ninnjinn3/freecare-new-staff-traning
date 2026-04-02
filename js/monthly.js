/* ============================================
   monthly.js — 月次評価・合否判定
   Supabase の実データから自動算出
   ============================================ */

const Monthly = {
    // 月次スコア算出（API経由で実データから算出）
    async calculate(targetMonthStr = null) {
        const user = Auth.getUser();
        if (!user) return null;

        const cycle = targetMonthStr ? { yearMonth: targetMonthStr } : DB.getCurrentCycle();

        try {
            const resp = await fetch('/api/monthly', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_id: user.staff_id,
                    year_month: cycle.yearMonth,
                    current_step: user.current_step || 1
                })
            });

            if (resp.ok) {
                return await resp.json();
            }
        } catch (e) {
            console.warn('月次評価API失敗、デモデータ使用:', e);
        }

        // フォールバック: デモデータ
        return this.calculateDemoScore();
    },

    // デモ用フォールバック
    calculateDemoScore() {
        return {
            score: 85,
            level: { grade: 'B', name: '上級（レベル3）…リーダー候補', color: 'var(--primary)' },
            passed: true,
            breakdown: [
                {
                    id: 1, name: '① 気づいた変化の明確さ', score: 10, max: 15,
                    judgement: '日時・状況の詳細と本人意思の確認が不足',
                    criteriaRef: [
                        { pts: 15, desc: '変化が具体的で、日時・状況が記録されている。本人の意思やニーズも明確に把握できている。', check: false },
                        { pts: 10, desc: '変化は記録されているが、状況の詳細が不足。本人の意思やニーズの把握が不足。', check: true },
                        { pts: 5, desc: '変化が抽象的で記録も曖昧。本人の意思やニーズが把握できていない。', check: false }
                    ],
                    userContent: "「普段はスタッフからの声かけをきっかけに会話されることが多いが、本日は自ら会話を持ちかける場面が見られた。また、普段は自発的に活動へ参加されるが、本日は開始時に促しが必要であった。」",
                    goodPoints: [
                        "「普段は〇〇だが本日は〇〇」という比較構造で変化を明確に捉えている",
                        "2つの変化（会話の増加・行動の消極化）を同時に観察できている"
                    ],
                    badPoints: [
                        "日時の記載がない（「本日」とあるだけで、何時頃・どの活動中かが不明）",
                        "状況の詳細がない（誰に対して話しかけたのか、どの活動で促しが必要だったのか）",
                        "本人の意思やニーズが未確認（本人がどう感じていたかの記載がない）"
                    ],
                    improvement: "「1月18日10時の集団体操開始時、上野様は普段であればスタッフの声かけ前に席を立たれるが、本日は体操開始の案内をしても座ったまま動かれなかった。一方、9時の来所直後には隣席の高木様に自ら『今日は寒いね』と話しかける場面が2回あり、普段の声かけ中心の会話パターンとは異なっていた。ご本人に体調を尋ねたところ、『体は大丈夫だけど、何をするのがよくわからなくて…』と不安そうに話されていた。」"
                },
                {
                    id: 2, name: '② 要因の多層的分析', score: 20, max: 20,
                    judgement: '全仮説で5段階以上の掘り下げ。満点',
                    criteriaRef: [
                        { pts: 20, desc: '「なぜ？」を3回以上掘り下げ、表面的でない根本要因を考えている', check: true },
                        { pts: 15, desc: '「なぜ？」を2回掘り下げて考察', check: false },
                        { pts: 10, desc: '「なぜ？」を1回だけ考えている', check: false },
                        { pts: 5, desc: '表層的な要因しか考えられていない', check: false }
                    ],
                    userContent: "仮説1: 意欲低下 → 何をすればよいか迷う → 見通しが持てない → 不安が強まる → 安心感を求める → 会話が増える\n仮説2: 睡眠不足 → 集中力低下 → 判断が遅れる → 行動のきっかけがつかめない → 職員に頼る → 会話が増える",
                    goodPoints: [
                        "5つの仮説すべてで5段階以上の掘り下げを行っており、表面的な「体調不良」レベルで止まらず、行動の根本メカニズムまで到達している。文句なしの満点。"
                    ],
                    badPoints: [],
                    improvement: ""
                },
                {
                    id: 3, name: '③ 要因の関連性と優先順位', score: 15, max: 15,
                    judgement: '対象者特性を根拠にした論理的な順位づけ。満点',
                    criteriaRef: [
                        { pts: 15, desc: '3つ以上の要因を論理的につなげ、優先順位の根拠を説明', check: true },
                        { pts: 10, desc: '2つの要因を関連づけ、優先順位はあるが根拠がやや曖昧', check: false },
                        { pts: 5, desc: '要因のリストはあるが、関連性が不明確で優先順位の根拠がない', check: false }
                    ],
                    userContent: "「上野様は普段、自発的に行動されることが多く、職員の声かけがなくても活動に参加されている。そのため、今回見られた会話の増加や行動への迷いは、一時的な意欲低下や不安感が最も大きく影響していると考えた。体調不良や疲労、睡眠状況などの身体的要因は二次的な可能性とし、環境変化についても影響は考えられるが一過性のものと判断した。心理的要因については長期的な視点での観察が必要なため、優先順位を低く設定した。」",
                    goodPoints: [
                        "5つの要因に明確な順位（1〜5位）を設定し、それぞれ異なる論拠（対象者の普段の特性・身体要因の二次性・環境要因の一過性・心理要因の長期性）で順位づけしている。"
                    ],
                    badPoints: [],
                    improvement: ""
                },
                {
                    id: 4, name: '④ 検証計画の論理性', score: 10, max: 15,
                    judgement: '判断基準・期間・リスク管理の明示が不足',
                    criteriaRef: [
                        { pts: 15, desc: '明確な検証方法と判断基準をリスク管理のもと設定', check: false },
                        { pts: 10, desc: '検証方法はあるが、判断基準やリスクが曖昧', check: true },
                        { pts: 5, desc: '検証方法やリスクが不十分、または記載なし', check: false }
                    ],
                    userContent: "仮説1: 「表情・発語量・動作遅延を記録」とデータ収集方法を記載\n仮説2: 「変化が続く場合は看護師・家族へ共有」とエスカレーション基準がある",
                    goodPoints: [
                        "仮説2で「表情・発語量・動作遅延を記録」とデータ収集方法を記載",
                        "仮説2で「変化が続く場合は看護師・家族へ共有」とエスカレーション基準がある"
                    ],
                    badPoints: [
                        "仮説1（最優先）に判断基準がない：何日間観察するのか、何をもって「改善した/しない」と判断するのかが不明",
                        "リスク管理が不十分：支援がうまくいかなかった場合の対応の記載がない",
                        "定量的な基準がない：「活動への迷いが減る」の判断を何で測るのかが不明"
                    ],
                    improvement: "「活動前に内容・時間・流れを説明する支援を1週間実施し、以下を日々記録する。①活動開始時に自発的に動けたか、②活動中の離席・質問回数。1週間後に促し回数が3回以下に減少し、自発行動が増えていれば仮説1を支持と判断する。変化がなければ別の検証に移行する。」"
                },
                {
                    id: 5, name: '⑤ 支援計画の実効性', score: 20, max: 20,
                    judgement: '5要因すべてに具体的・実行可能な支援策。満点',
                    criteriaRef: [
                        { pts: 20, desc: '2つ以上の支援策を具体的に記述し、どちらを優先するか根拠を示している', check: true },
                        { pts: 15, desc: '1つの支援策を明確に記述', check: false },
                        { pts: 10, desc: '抽象的な支援策', check: false },
                        { pts: 5, desc: '実行性が低い、または支援策なし', check: false }
                    ],
                    userContent: "1. 意欲低下・不安 → 活動前に内容・時間・流れを説明し見通しを明確化。\n2. 睡眠不足・体調不良 → 来所時の睡眠・体調確認。表情・発語量・動作速度を記録。\n3. 環境変化への敏感い → 職員や席替え時は事前に伝え見通しを持てるよう配慮。\n4. 体力低下・疲労 → 活動量を調整しこまめな休憩。\n5. 心理的不安・孤独感 → 会話を否定せず共感的に受け止める。",
                    goodPoints: [
                        "5つの要因それぞれに対して個別の具体的かつ実行可能な支援策を立案。優先順位と根拠も明確。文句なしの満点。"
                    ],
                    badPoints: [],
                    improvement: ""
                },
                {
                    id: 6, name: '⑥ 振り返り・修正力', score: 10, max: 15,
                    judgement: '本人意思の直接確認と新たな仮説立案が不足',
                    criteriaRef: [
                        { pts: 15, desc: '支援の結果を詳細に分析し、本人意思確認のもと新たな仮説や改善策を立てている', check: false },
                        { pts: 10, desc: '支援の結果を記録しているが、本人意思の確認も曖昧で次の仮説にうまくつなげられていない', check: true },
                        { pts: 5, desc: '変化を記録しているだけで、本人意思の確認もなく次の行動につながっていない', check: false },
                        { pts: 0, desc: '諦めている（支援終了の判断をしている）', check: false }
                    ],
                    userContent: "1/18: 「それならできそう」と発言。活動にスムーズに参加。 → 継続\n1/24: 自ら席を立ち準備。会話量も適度で活動に集中 → 継続\n1/26: 「今日はこれですね」と理解を示す発言。 → 継続\n1/28: 説明＋職員と一緒に1回目の動作を実施。「一緒にやると分かりやすい」と発言 → 継続\n1/31: 声かけなしでも活動参加。会話量も落ち着き、表情も穏やか → 終了",
                    goodPoints: [
                        "5回にわたり継続的に経過を記録している",
                        "本人の言葉を3回記録（「それならできそう」「今日はこれですね」「一緒にやると分かりやすい」）",
                        "途中で支援方法を変更（言葉の説明→実演追加）し、最終的に改善を確認して支援終了"
                    ],
                    badPoints: [
                        "本人への意思確認が「反応の観察」にとどまっている：「この支援をどう感じていますか？」「他に不安なことはありますか？」といった直接的な意思確認ではない",
                        "新たな仮説が立てられていない：1/28に支援変更しているが、「なぜ言葉の説明だけでは不十分だったのか」の新たな仮説がない",
                        "支援終了時の分析が薄い：「何が最も効果的だったか」「今後再発した場合にどうするか」の分析がない"
                    ],
                    improvement: "「1/28: 説明を聞いても表情に不安が残っており、ご本人に確認したところ、『聞いただけどよくわからない』と話された。そこで職員と一緒に1回目の動作を実施したところ、『一緒にやると分かりやすい』と笑顔が見られた。支援内容変更。理由：見通しの欠如である可能性。今後は実演を標準手順に組み込み、他の活動時間でも同様の支援を試行する。」"
                }
            ],
            hrPoints: 10,
            totalRecords: 15,
            passCount: 12,
            failCount: 3,
            actions: []
        };
    },

    getLevel(score) {
        const t = LEVEL_THRESHOLDS.find(l => score >= l.min && score <= l.max);
        return t || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
    },

    checkPass(score, attemptNumber, previousScores) {
        if (attemptNumber === 1) {
            return score >= PASS_RULES.firstAttemptScore;
        }
        if (previousScores.length >= 1) {
            const lastScore = previousScores[previousScores.length - 1];
            return lastScore === 100 && score === 100;
        }
        return false;
    },

    // 月次評価画面描画
    async render(targetMonthStr = null) {
        // 月選択ドロップダウンの初期化
        const selectEl = document.getElementById('monthly-month-select');
        const activeCycleStr = DB.getCurrentCycle().yearMonth;
        const currentTarget = targetMonthStr || activeCycleStr;

        if (selectEl && selectEl.options.length === 0) {
            const options = DB.getCycleOptions(6);
            selectEl.innerHTML = options.map(opt => `<option value="${opt.value}" ${opt.value === currentTarget ? 'selected' : ''}>${opt.label}</option>`).join('');
        }
        if (selectEl) selectEl.value = currentTarget;

        const container = document.getElementById('monthly-report');
        if (!container) return;

        // ローディング表示
        container.style.opacity = '0.5';
        container.style.pointerEvents = 'none';

        try {
            const user = Auth.getUser();

            // レガシーUIを隠す（確実に最初に実行）
            this.toggleLegacyUI(false);
            
            // 自動再評価の判定
            const autoForce = localStorage.getItem(`needs_reeval_${currentTarget}`) === 'true';
            const force = (window.forceReevaluating === true) || autoForce;
            if (window.forceReevaluating === true) window.forceReevaluating = false;

            // キャッシュ（現在の評価）を取得
            const data = await API.getMonthlyEvaluation(user.staff_id, currentTarget);
            
            let reportData = data ? data.breakdown_json : null;
            let score = data ? data.score : 0;
            let passed = data ? data.passed : false;

            // 描画実行（まずは現在のデータを出す）
            this.renderEvaluation(reportData, score, passed, currentTarget);
            await this.renderDailyRecords(currentTarget);

            // 再評価（自動または手動）が必要な場合
            const needsReeval = !reportData || (Array.isArray(reportData) && reportData.some(b => 
                !b.comment || 
                b.comment.includes('AIのフィードバックはありません') || 
                b.comment.includes('AI要約の生成に失敗しました')
            ));

            if (needsReeval || force) {
                // UI上のインジケータ表示
                const statusEl = document.getElementById('monthly-pass-status');
                if (statusEl) {
                    statusEl.innerHTML += ' <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted)">(AI評価を最新化中...)</span>';
                }
                
                console.log('Fetching new monthly evaluation (Background)...');
                if (autoForce) localStorage.removeItem(`needs_reeval_${currentTarget}`);

                // バックグラウンドで計算実行
                const newData = await Monthly.calculate(currentTarget);
                if (newData) {
                    // 最新データで再描画
                    this.renderEvaluation(newData.breakdown, newData.score, newData.passed, currentTarget);
                    showToast('最新の記録に基づき、AI評価を更新しました ✨');
                }
            }

        } catch (e) {
            console.error('Monthly Render Error:', e);
            showToast('データの取得に失敗しました');
        } finally {
            container.style.opacity = '1';
            container.style.pointerEvents = 'auto';
        }
    },

    // 6項目の評価描画
    renderEvaluation(breakdown, totalScore, passed, yearMonth) {
        const isEditable = DB.isCycleActive(yearMonth);
        const bRoot = document.getElementById('score-breakdown');

        if (isEditable) {
            if (bRoot) {
                bRoot.innerHTML = `
                    <div class="card" style="text-align: center; padding: 40px var(--space-lg); margin-top: 20px; border: 2px dashed var(--primary);">
                        <div style="font-size: 3rem; margin-bottom: 20px;">⏳</div>
                        <h3 style="margin-bottom: 15px; color: var(--primary);">ただいま記録修正・提出期間中です</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 25px; line-height: 1.6;">
                            ${yearMonth.split('-')[1]}月分の取り組みは、**翌月10日**まで修正・提出が可能です。<br>
                            月次評価（合否判定）は、提出期間が終了した後に公開されます。<br>
                            日々のフィードバック（○/×）を確認しながら、より良い記録を目指しましょう！
                        </p>
                        <div style="font-size: 0.9rem; background: #f0f7ff; padding: 15px; border-radius: 8px; color: #0056b3; display: inline-block;">
                            📅 公開予定：${yearMonth.split('-')[1]}月11日 0:00〜
                        </div>
                    </div>
                `;
            }
            // スコア表示も「期間中」とする
            const scoreEl = document.getElementById('monthly-score');
            const statusEl = document.getElementById('monthly-pass-status');
            if (scoreEl) scoreEl.textContent = '--';
            if (statusEl) {
                statusEl.textContent = '集計待ち';
                statusEl.style.color = 'var(--primary)';
            }
            return;
        }

        if (!breakdown || !Array.isArray(breakdown) || breakdown.length === 0) {
            if (bRoot) {
                bRoot.innerHTML = `
                    <div class="card" style="text-align: center; padding: 40px var(--space-lg); margin-top: 20px; border: 2px dashed var(--border);">
                        <div style="font-size: 3rem; margin-bottom: 20px;">📝</div>
                        <h3 style="margin-bottom: 15px; color: var(--text);">今月分の月次評価はまだ作成されていません</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 25px; line-height: 1.6;">
                            日々の記録が溜まったら、右上の「**再評価**」ボタンを押してください。<br>
                            AIが今月全体の活動を分析し、詳細な評価レポートを生成します。
                        </p>
                        <button class="btn btn-primary" onclick="Monthly.forceReevaluate()">AI評価を開始する</button>
                    </div>
                `;
            }
            // スコア表示もリセット
            const scoreEl = document.getElementById('monthly-score');
            const statusEl = document.getElementById('monthly-pass-status');
            if (scoreEl) scoreEl.textContent = '--';
            if (statusEl) {
                statusEl.textContent = '--';
                statusEl.style.color = 'var(--text-muted)';
            }
            return;
        }

        const scoreEl = document.getElementById('monthly-score');
        const ring = document.getElementById('score-ring');
        const statusEl = document.getElementById('monthly-pass-status');

        if (scoreEl) scoreEl.textContent = totalScore;
        if (ring) {
            ring.style.borderColor = passed ? 'var(--success)' : 'var(--danger)';
            ring.style.boxShadow = passed ? '0 0 20px rgba(76, 175, 80, 0.2)' : '0 0 20px rgba(244, 67, 54, 0.2)';
        }
        if (statusEl) {
            statusEl.textContent = passed ? '合格' : '不合格';
            statusEl.style.color = passed ? 'var(--success)' : 'var(--danger)';
        }

        const bRoot = document.getElementById('score-breakdown');
        if (!bRoot) return;

        let html = '<div class="evaluation-sheet">';
        
        // サマリーテーブルを追加（以前の形式を継承）
        html += `
            <div class="eval-title">サービスの質向上委員会<br>スコアリング評価シート</div>
            <table class="eval-table">
                <thead>
                    <tr><th>項目</th><th>配点</th><th>得点</th><th>判定</th></tr>
                </thead>
                <tbody>
        `;
        breakdown.forEach(item => {
            html += `
                <tr>
                    <td>${item.name}</td>
                    <td class="center">${item.max}点</td>
                    <td class="center" style="font-weight:bold; color: ${item.score === item.max ? 'var(--success)' : 'var(--danger)'}">${item.score}点</td>
                    <td>${item.judgement || '-'}</td>
                </tr>
            `;
        });
        html += `
                <tr class="total-row">
                    <td>合計</td>
                    <td class="center">100点</td>
                    <td class="center">${totalScore}点</td>
                    <td>${passed ? '合格' : '不合格'}</td>
                </tr>
            </tbody></table>
        `;

        // 各項目の詳細カード
        breakdown.forEach((item, index) => {
            const scorePercent = (item.score / item.max) * 100;
            const barColor = scorePercent >= 80 ? 'var(--success)' : (scorePercent >= 50 ? 'var(--warning)' : 'var(--danger)');

            html += `
                <div class="eval-item-card card" style="margin-top: 25px; border-top: 4px solid ${barColor};">
                    <div class="eval-item-header">
                        <h4 class="eval-item-title">${item.name} (${item.max}点満点) → <span style="color:${barColor}; font-weight:bold;">${item.score}点</span></h4>
                    </div>
                    
                    <div class="criteria-list" style="margin-top: 15px;">
                        <p style="font-size: 0.9rem; font-weight: bold; color: var(--text-secondary); margin-bottom: 8px;">【採点基準との照合】</p>
                        <table class="criteria-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                            <thead>
                                <tr style="background: var(--surface); text-align: left; border-bottom: 2px solid var(--border);">
                                    <th style="padding: 8px; width: 60px; text-align: center;">点数</th>
                                    <th style="padding: 8px;">基準</th>
                                    <th style="padding: 8px; width: 50px; text-align: center;">判定</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(item.criteriaRef || []).map(c => `
                                    <tr style="border-bottom: 1px solid var(--border); ${c.check ? 'background: rgba(88, 204, 2, 0.1);' : ''}">
                                        <td style="padding: 8px; text-align: center; font-weight: bold; color: var(--text-secondary);">${c.pts}</td>
                                        <td style="padding: 8px; color: var(--text);">${c.desc}</td>
                                        <td style="padding: 8px; text-align: center; font-size: 1.2rem;">${c.check ? '✅' : 'ー'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="eval-content-section" style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--border);">
                        <div style="font-weight: bold; color: var(--text-secondary); margin-bottom: 8px; font-size: 0.95rem;">【AIによるコメント（該当する記録の要約）】</div>
                        <div style="background: #fdfdfd; border-left: 3px solid #b2bec3; padding: 12px; font-size: 0.9rem; color: #2d3436; margin-bottom: 20px;">${(item.userContent || '（記載なし）').replace(/\n/g, '<br>')}</div>
                        
                        ${(item.goodPoints && item.goodPoints.length > 0) ? `
                        <div style="margin-bottom: 20px;">
                            <div style="font-weight: bold; color: #27ae60; margin-bottom: 8px; font-size: 0.95rem;">【良い点】</div>
                            <ul style="list-style: none; padding: 0; margin: 0; color: #2d3436; font-size: 0.9rem; line-height: 1.6;">
                                ${item.goodPoints.map(p => `<li style="display: flex; gap: 8px; margin-bottom: 6px;"><span style="color: #27ae60;">✅</span><span>${p}</span></li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${(item.badPoints && item.badPoints.length > 0) ? `
                        <div style="margin-bottom: 20px;">
                            <div style="font-weight: bold; color: #e74c3c; margin-bottom: 8px; font-size: 0.95rem;">【不足している点】</div>
                            <ul style="list-style: none; padding: 0; margin: 0; color: #2d3436; font-size: 0.9rem; line-height: 1.6;">
                                ${item.badPoints.map(p => `<li style="display: flex; gap: 8px; margin-bottom: 6px;"><span style="color: #e74c3c;">❌</span><span>${p}</span></li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${item.improvement ? `
                        <div style="margin-bottom: 10px;">
                            <div style="font-weight: bold; color: #16a085; margin-bottom: 8px; font-size: 0.95rem;">【${item.max}点を取るための改善例】</div>
                            <div style="background: rgba(22, 160, 133, 0.05); padding: 15px; border-radius: 8px; border-left: 4px solid #16a085; font-size: 0.9rem; color: #2d3436; line-height: 1.6;">
                                ${item.improvement.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                        ` : ''}

                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dotted var(--border);">
                            <div style="font-weight: bold; color: var(--text-secondary); margin-bottom: 6px; font-size: 0.9rem;">【AIからの総評】</div>
                            <div style="font-size: 0.9rem; color: #636e72;">${item.comment ? item.comment.replace(/\n/g, '<br>') : (item.judgement || 'ー')}</div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        bRoot.innerHTML = html;
    },

    // 毎日の記録一覧を描画
    async renderDailyRecords(currentTarget) {
        const recordsList = document.getElementById('monthly-records-list');
        if (!recordsList) return;

        recordsList.innerHTML = '<p style="text-align:center;color:var(--text-muted)">読み込み中...</p>';
        try {
            const user = Auth.getUser();
            const [s1, s2, s3] = await Promise.all([
                API.getStep1Records(user.staff_id, currentTarget),
                API.getStep2Records(user.staff_id, currentTarget),
                API.getStep3Records(user.staff_id, currentTarget)
            ]);

            const allRecords = [
                ...s1.map(r => ({ ...r, step: 1 })),
                ...s2.map(r => ({ ...r, step: 2 })),
                ...s3.map(r => ({ ...r, step: 3 }))
            ].sort((a, b) => new Date(b.date) - new Date(a.date));

            if (allRecords.length > 0) {
                recordsList.innerHTML = allRecords.map((r, idx) => {
                    const isPass = r.ai_judgement === '○';
                    const bc = isPass ? 'var(--success)' : 'var(--danger)';
                    
                    // 提出期限内かチェック（翌月10日まで）
                    const recordCycle = DB.getCurrentCycle(new Date(), r.date);
                    const canEdit = !recordCycle.isPastDeadline;

                    let editBtn = '';
                    if (canEdit) {
                        editBtn = `<button class="btn-link" onclick="Monthly.editRecord(${r.step}, '${r.id}')" style="font-size:0.8rem; color:var(--primary); padding:4px 8px; border:1px solid var(--primary); border-radius:4px; cursor:pointer;">編集する</button>`;
                    }

                    let content = '';
                    if (r.step === 1) content = r.notice_text;
                    else if (r.step === 2) content = `【仮説】${r.hypothesis}<br>【理由】${r.reason}`;
                    else content = `【支援】${r.support_done}<br>【結果】${r.result}`;

                    let feedbackHtml = '';
                    if (r.ai_advice || r.ai_comment) {
                        feedbackHtml = `
                            <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 0.9rem;">
                                <div style="font-weight: bold; color: ${bc}; margin-bottom: 4px;">【AI評価: ${r.ai_judgement || 'ー'}】</div>
                                <div style="color: var(--text-secondary); line-height: 1.5;">${(r.ai_advice || r.ai_comment || 'アドバイスはありません').replace(/\n/g, '<br>')}</div>
                            </div>
                        `;
                    }

                    return `<div class="card" style="margin-bottom:var(--space-sm);padding:0;border-left:4px solid ${bc};overflow:hidden;">
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm);cursor:pointer;" onclick="var d=this.nextElementSibling;d.hidden=!d.hidden;this.querySelector('.rtg').textContent=d.hidden?'▼':'▲';">
                            <div>
                                <strong style="font-size:1rem">${r.date}</strong>
                                <span style="font-weight:normal;font-size:0.9rem;color:var(--text-muted)"> - STEP${r.step} (${r.target_name || '対象者なし'})</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:12px;">
                                ${editBtn}
                                <span style="font-weight:bold;color:${bc};font-size:1.1rem">${r.ai_judgement||'－'}</span>
                                <span class="rtg" style="font-size:0.8rem;color:var(--text-muted)">▼</span>
                            </div>
                        </div>
                        <div hidden style="padding:0 var(--space-sm) var(--space-sm);border-top:1px solid var(--border);">
                            <p style="font-size:0.95rem;color:var(--text);line-height:1.6;margin-top:10px;white-space:pre-wrap;">${content}</p>
                            ${feedbackHtml}
                        </div>
                    </div>`;
                }).join('');
            } else {
                recordsList.innerHTML = '<p class="empty-state">この月の記録はありません</p>';
            }
        } catch (e) {
            console.error('記録一覧取得エラー:', e);
            recordsList.innerHTML = '<p class="empty-state">記録の取得に失敗しました</p>';
        }
    },

    // 編集モードへの移行
    async editRecord(step, id) {
        showToast('読み込み中...');
        try {
            const user = Auth.getUser();
            let record = null;
            if (step === 1) {
                const records = await API.getStep1Records(user.staff_id);
                record = records.find(r => r.id === id);
            } else if (step === 2) {
                const records = await API.getStep2Records(user.staff_id);
                record = records.find(r => r.id === id);
            } else if (step === 3) {
                const records = await API.getStep3Records(user.staff_id);
                record = records.find(r => r.id === id);
            }

            if (!record) throw new Error('Record not found');

            // 編集用グローバル変数にセット
            window.editingRecord = { step, id, data: record };
            
            // 画面遷移
            navigateTo(`screen-step${step}`);
            
            // 各STEPの編集モード初期化を呼ぶ（画面遷移後に少し待つ）
            setTimeout(() => {
                if (step === 1) Step1.enterEditMode(record);
                else if (step === 2) Step2.enterEditMode(record);
                else if (step === 3) Step3.enterEditMode(record);
            }, 100);

        } catch (e) {
            console.error('Edit Record Error:', e);
            showToast('記録の読み込みに失敗しました');
        }
    },

    // 再評価をリクエスト
    async forceReevaluate() {
        if (!confirm('最新の記録に基づき、AIによる月次評価（総評の生成含む）をやり直しますか？\n※1分ほど時間がかかる場合があります。')) return;
        
        window.forceReevaluating = true;
        const monthSelect = document.getElementById('monthly-month-select');
        this.render(monthSelect ? monthSelect.value : null);
        showToast('再評価を開始しました 🪄');
    },

    // レガシーUIの表示切り替え
    toggleLegacyUI(show) {
        const elements = ['.score-ring-container', '#monthly-level', '.monthly-stats', '#monthly-actions'];
        elements.forEach(selector => {
            const el = selector.startsWith('#') ? document.getElementById(selector.slice(1)) : document.querySelector(selector);
            if (el) el.style.display = show ? 'flex' : 'none';
        });
    }
};

// 履歴の修復
async function repairPastRecords() {
    const user = Auth.getUser();
    if (!user) return;
    if (!confirm('AIの解析に失敗した過去の記録を再評価しますか？')) return;

    const btn = document.querySelector('button[onclick="repairPastRecords()"]');
    if (btn) { btn.disabled = true; btn.textContent = '🛠️ 修復中...'; }

    try {
        const cycle = DB.getCurrentCycle();
        const resp = await fetch('/api/fix-daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_id: user.staff_id, year_month: cycle.yearMonth })
        });

        if (resp.ok) {
            const result = await resp.json();
            alert(`修復完了: ${result.count}件を再評価しました。`);
            Monthly.render();
        } else throw new Error('修復失敗');
    } catch (e) { alert(e.message); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '🛠️ 記録を修復'; } }
}

