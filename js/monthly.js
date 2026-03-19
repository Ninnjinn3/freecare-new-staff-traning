/* ============================================
   monthly.js — 月次評価・合否判定
   Supabase の実データから自動算出
   ============================================ */

const Monthly = {
    // 月次スコア算出（API経由で実データから算出）
    async calculate() {
        const user = Auth.getUser();
        if (!user) return null;

        const cycle = DB.getCurrentCycle();

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
    async render() {
        // ローディング開始（既存のコンテンツがある場合は非表示にしない）
        const breakdownEl = document.getElementById('score-breakdown');
        const hasExistingContent = breakdownEl && breakdownEl.innerHTML.trim() !== '';

        if (!hasExistingContent) {
            const scoreEl = document.getElementById('monthly-score');
            if (scoreEl) scoreEl.textContent = '...';
            // 初回読み込み時のみ古いUI要素を隠す
            this.toggleLegacyUI(false);
        } else {
            // すでに内容がある場合は、右上に小さなインジケータを出す等の工夫（今回はシンプルに既存維持）
            const btn = document.querySelector('button[onclick="repairPastRecords()"]');
            if (btn) btn.textContent = '🛠️ 更新中...';
        }

        // API経由で実データを取得
        const report = await this.calculate();
        
        // インジケータを戻す
        const repairBtn = document.querySelector('button[onclick="repairPastRecords()"]');
        if (repairBtn) repairBtn.textContent = '🛠️ 記録を修復';

        if (!report) return;

        // レガシーUI（古いDuolingo風パーツ）を隠す
        this.toggleLegacyUI(false);

        // 評価シートUIの生成
        let html = `
        <div class="eval-sheet">
            <div class="eval-title">サービスの質向上委員会<br>スコアリング評価シート</div>
            
            <table class="eval-table">
                <thead>
                    <tr>
                        <th>項目</th>
                        <th>配点</th>
                        <th>得点</th>
                        <th>判定</th>
                    </tr>
                </thead>
                <tbody>
        `;

        report.breakdown.forEach(item => {
            html += `
                    <tr>
                        <td style="font-size: 0.8rem;">${item.name}</td>
                        <td style="text-align:center;">${item.max}点</td>
                        <td style="text-align:center; font-weight:bold; color: ${item.score === item.max ? 'var(--success)' : 'var(--danger)'}">${item.score}点</td>
                        <td style="font-size: 0.8rem;">${item.judgement || '-'}</td>
                    </tr>
            `;
        });

        html += `
                    <tr class="total-row">
                        <td>合計</td>
                        <td style="text-align:center;">100点</td>
                        <td style="text-align:center;">${report.score}点</td>
                        <td style="font-size: 0.85rem;">${report.level ? report.level.name : ''}</td>
                    </tr>
                </tbody>
            </table>
        `;

        // 詳細セクションの生成
        report.breakdown.forEach(item => {
            html += `
            <div class="eval-section">
                <div class="eval-section-header">
                    ${item.name}（${item.max}点満点） → <span class="score-label">${item.score}点</span>
                </div>
                
                <div class="eval-box-title">【採点基準との照合】</div>
                <table class="eval-table eval-criteria-table" style="margin-bottom:15px;">
                    <thead>
                        <tr>
                            <th width="45">点数</th>
                            <th>基準</th>
                            <th width="45">判定</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            if (item.criteriaRef) {
                item.criteriaRef.forEach(c => {
                    html += `
                        <tr>
                            <td class="center">${c.pts || '-'}点</td>
                            <td style="font-size:0.8rem">${c.desc || ''}</td>
                            <td class="center">${c.check ? '✅' : 'ー'}</td>
                        </tr>
                    `;
                });
            }

            html += `
                    </tbody>
                </table>
                <div style="font-size:0.8rem; color:#666; margin-bottom:15px;">※上記は評価基準の一部抜粋です。完全な基準はヘルプやマニュアルをご参照ください。</div>
                <div class="eval-box-title">【スタッフの記載内容】</div>
                <div class="eval-content-text">${item.userContent ? item.userContent.replace(/\n/g, '<br>') : '（記載なし）'}</div>
            `;

            if (item.goodPoints && item.goodPoints.length > 0) {
                html += `<div class="eval-good-points"><div class="eval-box-title">【良い点】</div>`;
                item.goodPoints.forEach(p => {
                    html += `<div class="eval-point-item"><span class="eval-point-icon">✅</span><span>${p}</span></div>`;
                });
                html += `</div>`;
            }

            if (item.badPoints && item.badPoints.length > 0) {
                html += `<div class="eval-bad-points"><div class="eval-box-title">【不足している点】</div>`;
                item.badPoints.forEach(p => {
                    html += `<div class="eval-point-item"><span class="eval-point-icon">❌</span><span>${p}</span></div>`;
                });
                html += `</div>`;
            }

            if (item.improvement) {
                html += `
                <div class="eval-improve-box">
                    <div class="eval-improve-title">【改善点・アドバイス】</div>
                    <div style="font-size:0.85rem">${item.improvement.replace(/\n/g, '<br>')}</div>
                </div>
                `;
            }

            html += `</div>`;
        });

        html += `</div>`; // end eval-sheet

        const bRoot = document.getElementById('score-breakdown');
         if (bRoot) {
             bRoot.innerHTML = html;
         }

        // 毎日の記録一覧を描画
        const recordsList = document.getElementById('monthly-records-list');
        if (recordsList) {
            recordsList.innerHTML = '<p style="text-align:center;color:var(--text-muted)">読み込み中...</p>';
            try {
                const user = Auth.getUser();
                const cycle = DB.getCurrentCycle();
                const records = await API.getStep1Records(user.staff_id, cycle.yearMonth);

                if (records && records.length > 0) {
                    recordsList.innerHTML = records.map((r, idx) => {
                        const isPass = r.ai_judgement === '○';
                        const bc = isPass ? 'var(--success)' : 'var(--danger)';
                        let adv = '';
                        
                        // 良い点の処理（JSONB/配列対応）
                        let goodPointsText = '';
                        if (r.ai_good_points) {
                            const gps = Array.isArray(r.ai_good_points) ? r.ai_good_points : [r.ai_good_points];
                            goodPointsText = gps.filter(p => p).join('、');
                        }
                        if (goodPointsText) {
                            adv += '<div style="margin-top:10px;padding:8px;background:rgba(76,175,80,0.1);border-radius:6px;font-size:0.85rem;"><strong style="color:var(--success)">✅ 良い点：</strong><br>' + goodPointsText + '</div>';
                        }
                        
                        // 改善アドバイスの処理（ai_improve カラムを使用）
                        const improveText = r.ai_improve || r.improvement_example || '';
                        if (improveText) {
                            adv += '<div style="margin-top:8px;padding:8px;background:' + (isPass ? 'rgba(33,150,243,0.08)' : '#ffebee') + ';border-radius:6px;font-size:0.85rem;"><strong style="color:' + (isPass ? 'var(--primary)' : '#b71c1c') + '">💡 ' + (isPass ? 'さらに良くするには：' : '改善アドバイス：') + '</strong><br>' + improveText + '</div>';
                        }
                        
                        if (!adv) {
                            adv = '<p style="font-size:0.85rem;color:var(--text-muted);margin-top:8px;">AIのフィードバックはありません</p>';
                        }
                        return '<div class="card" style="margin-bottom:var(--space-sm);padding:0;border-left:4px solid ' + bc + ';overflow:hidden;">' +
                            '<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-sm);cursor:pointer;" onclick="var d=this.nextElementSibling;d.hidden=!d.hidden;this.querySelector(\'.rtg\').textContent=d.hidden?\'▼\':\'▲\';">' +
                            '<div><strong style="font-size:1rem">' + r.date + '</strong><span style="font-weight:normal;font-size:0.9rem;color:var(--text-muted)"> - ' + r.target_name + 'さん</span></div>' +
                            '<div style="display:flex;align-items:center;gap:12px;"><span style="font-weight:bold;color:' + bc + ';font-size:1.1rem">' + (r.ai_judgement||'－') + '</span><span class="rtg" style="font-size:0.8rem;color:var(--text-muted)">▼</span></div>' +
                            '</div>' +
                            '<div hidden style="padding:0 var(--space-sm) var(--space-sm);border-top:1px solid var(--border);">' +
                            '<p style="font-size:0.95rem;color:var(--text);line-height:1.6;margin-top:10px;white-space:pre-wrap;">' + r.notice_text + '</p>' +
                            adv +
                            '</div></div>';
                    }).join('');
                } else {
                    recordsList.innerHTML = '<p class="empty-state">今月の記録はありません</p>';
                }
            } catch (e) {
                console.error('記録一覧取得エラー:', e);
                recordsList.innerHTML = '<p class="empty-state">記録の取得に失敗しました</p>';
            }
        }
    },
 
    // レガシーUI（Duolingo風パーツ）の表示切り替え
    toggleLegacyUI(show) {
        const elements = [
            '.score-ring-container',
            '#monthly-level',
            '.monthly-stats',
            '#monthly-actions'
        ];
        elements.forEach(selector => {
            const el = selector.startsWith('#') ? document.getElementById(selector.slice(1)) : document.querySelector(selector);
            if (el) {
                if (selector === '#monthly-actions') {
                    if (el.parentElement) el.parentElement.style.display = show ? 'block' : 'none';
                } else {
                    el.style.display = show ? 'flex' : 'none';
                }
            }
        });
    }
};

// 履歴の修復（AIの解析失敗等で空欄になっているものを再判定）
async function repairPastRecords() {
    const user = Auth.getUser();
    const cycle = DB.getCurrentCycle();
    if (!user) return;

    if (!confirm('AIの解析に失敗した過去の記録を再抽出しますか？\n（数分かかる場合があります）')) return;

    // ボタンの状態を変更
    const btn = document.querySelector('button[onclick="repairPastRecords()"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '🛠️ 修復中...';
    }

    try {
        const resp = await fetch('/api/fix-daily', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staff_id: user.staff_id,
                year_month: cycle.yearMonth
            })
        });

        if (resp.ok) {
            const result = await resp.json();
            alert(`修復完了: ${result.count}件の記録を再評価しました。`);
            // 画画を再描画
            if (typeof Monthly !== 'undefined' && Monthly.render) {
                Monthly.render();
            }
        } else {
            throw new Error('修復に失敗しました');
        }
    } catch (e) {
        alert('エラー: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🛠️ 記録を修復';
        }
    }
}

