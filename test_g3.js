const fs = require('fs');
const env = fs.readFileSync('c:/cursor/株式会社フリーケア/.env', 'utf8');
const key = env.match(/GEMINI_API_KEY=(.+)/)[1].trim();
const prompt = '出力形式:\n{\n  "judgement": "×",\n  "score": (0-100),\n  "short_comment": "まとめ",\n  "good_points": ["良い点1"],\n  "missing_points": ["不足点1"]\n}';

fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + key, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
        contents:[{parts:[{text:prompt}]}],
        generationConfig:{temperature:0.3, responseMimeType:'application/json'}
    })
})
.then(r=>r.json())
.then(j => {
    const t = j.candidates[0].content.parts[0].text;
    console.log('RAW:\\n' + t);
    try {
        let c = t.trim();
        c = c.replace(/^```(json)?\s*/i, '').replace(/\s*```$/i, '');
        const s = c.indexOf('{');
        const e = c.lastIndexOf('}');
        if(s!==-1&&e!==-1) c = c.substring(s, e+1);
        c = c.replace(/,\s*([}\]])/g, '$1');
        c = c.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
        JSON.parse(c);
        console.log('SUCCESS');
    } catch(err) {
        console.error('FAIL:', err);
    }
});
