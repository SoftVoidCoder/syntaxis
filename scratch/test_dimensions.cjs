// Remaining positions 60-76 + final summary
const { GoogleGenAI } = require('@google/genai');
const XLSX = require('xlsx');
require('dotenv').config();

const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || 'korda-syntax',
    location: 'global',
    googleAuthOptions: { credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] },
});

const wb = XLSX.readFile('C:\\Users\\s 30\\Desktop\\Korda\\Кор АИ\\Корда чтение\\Этра 76175_ 76174_ 76178_ 76186_ 76188_ 76187_ 76193_ 76179_ 76177_ 76176_ 76194_ 76190_ 76183_ 76192_ 76180_ 76181_ 76191_ 76182_ 76189_ 76184_ 76185 (1).xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const positions = rows
    .filter(r => r['№ п/п'] && r['Наименование номенклатуры'] && r['№ п/п'] >= 60)
    .map(r => ({ id: r['№ п/п'], article: String(r['Артикул'] || ''), name: r['Наименование номенклатуры'], qty: r['Количество'] || 1 }));

console.log(`Позиции 60-76: ${positions.length} шт\n`);

function regexParse(text) {
    const c = text.replace(/\*\*/g, '').replace(/\$/g, '').replace(/\\/g, '');
    const p = (pats) => { for (const pat of pats) { const m = c.match(pat); if (m) return parseFloat(m[1].replace(',','.')); } return null; };
    return {
        L: p([/(?:строительн[а-яё]*\s+)?длин[а-яё]*[^\d]{0,50}?(\d{2,4})\s*мм/i, /\bL\b[^\d]{0,20}?(\d{2,4})\s*мм/i, /\bL\s*[=:]\s*(\d{2,4})/i]),
        H: p([/(?:строительн[а-яё]*\s+)?высот[а-яё]*[^\d]{0,50}?(\d{2,4})\s*мм/i, /габаритн[а-яё]*\s+высот[а-яё]*[^\d]{0,50}?(\d{2,4})/i, /\bH\b[^\d]{0,20}?(\d{2,4})\s*мм/i, /\bH\s*[=:]\s*(\d{2,4})/i]),
        W: p([/(?:масс|вес)[а-яё]*[^\d]{0,20}?(\d{1,4})/i]),
    };
}

function buildQuery(pos) { return pos.name.replace('Изоляция съемная_', '').replace(/\([^)]*\)/g, '').trim(); }

async function searchOne(query) {
    try {
        const res = await ai.models.generateContent({
            model: 'gemini-3.5-flash', contents: [{ role: 'user', parts: [{ text: `Габаритные размеры ${query}: строительная длина L (мм), строительная высота H (мм), масса (кг). Укажи числа.` }] }],
            config: { tools: [{ googleSearch: {} }], temperature: 0.0, maxOutputTokens: 4096 }
        });
        const text = (res.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
        const sources = res.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.title).filter(Boolean) || [];
        return { text, sources };
    } catch (e) { return { text: '', error: e.message }; }
}

async function knowledgeFallback(query) {
    try {
        const res = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite', contents: [{ role: 'user', parts: [{ text: `Типовые размеры ${query}: L = ? мм, H = ? мм, масса = ? кг. Укажи числа.` }] }],
            config: { temperature: 0.3, maxOutputTokens: 512 }
        });
        return (res.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    } catch (e) { return ''; }
}

async function processPosition(pos) {
    const query = buildQuery(pos);
    const s = await searchOne(query);
    let r = regexParse(s.text);
    let method = 'search';
    if (!r.L || !r.H) {
        const kText = await knowledgeFallback(query);
        if (kText.length > 10) { const r2 = regexParse(kText); r.L = r.L||r2.L; r.H = r.H||r2.H; r.W = r.W||r2.W; if(r2.L||r2.H) method='search+knowledge'; }
        if (!r.L && !r.H) method = 'failed';
    }
    return { ...pos, L: r.L, H: r.H, W: r.W, method, sources: s.sources||[] };
}

async function runParallel(items, fn, c=3) { const res=[]; let i=0; async function w(){while(i<items.length){const j=i++;res[j]=await fn(items[j]);}} await Promise.all(Array(c).fill().map(()=>w())); return res; }

async function main() {
    const results = await runParallel(positions, processPosition, 3);
    
    for (const r of results) {
        const s = r.method==='search'?'✅':r.method==='search+knowledge'?'🧠':'❌';
        console.log(`${s} ${String(r.id).padStart(2)} | ${r.article.padEnd(24)} | ${String(r.L||'?').padStart(5)} | ${String(r.H||'?').padStart(5)} | ${String(r.W||'?').padStart(4)} | ${r.method.padEnd(8)} | ${r.sources.slice(0,2).join(', ')||'-'}`);
    }
    
    const exact=results.filter(r=>r.method==='search').length;
    const mixed=results.filter(r=>r.method==='search+knowledge').length;
    const failed=results.filter(r=>r.method==='failed').length;
    
    // Combined with first 59: 45 search + 12 knowledge + 1 failed
    console.log(`\nПозиции 60-76: ${exact}✅ + ${mixed}🧠 + ${failed}❌`);
    console.log(`\nОБЩИЙ ИТОГ (1-76):`);
    console.log(`  ✅ Search:    ${45+exact}/76`);
    console.log(`  🧠 Knowledge: ${12+mixed}/76`);
    console.log(`  ❌ Failed:    ${1+failed}/76`);
    console.log(`  Успех:        ${Math.round((45+exact+12+mixed)/76*100)}%`);
}

main().catch(console.error);
