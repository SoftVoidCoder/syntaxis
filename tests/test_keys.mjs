import fetch from 'node-fetch';
import process from 'process';

const API_KEY = process.env.KONTUR_API_KEY;

async function testKey(keyName, value) {
    const dFrom = new Date(); dFrom.setDate(dFrom.getDate() - 30);
    const dTo = new Date(); dTo.setDate(dTo.getDate() + 30);

    const payload = {
        dateTimeFrom: dFrom.toISOString(),
        dateTimeTo: dTo.toISOString(),
        filter: {
            [keyName]: value,
            stages: ["ApplicationSubmission"]
        }
    };

    // Test also with root level key
    const payloadRoot = { ...payload, [keyName]: value };
    delete payloadRoot.filter[keyName];

    for (let isRoot of [false, true]) {
        try {
            const p = isRoot ? payloadRoot : payload;
            const res = await fetch('https://api-zakupki.kontur.ru/external/v1/search', {
                method: 'POST',
                headers: { 'X-Kontur-Apikey': API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify(p)
            });
            if (res.ok) {
                const data = await res.json();
                if (data.TotalCount < 500000) {
                    console.log(`SUCCESS! keyName=${keyName} (root=${isRoot}) matched ${data.TotalCount} items. First: ${data.Items[0]?.OrderName}`);
                    return true;
                }
            }
        } catch (e) { }
    }
    return false;
}

async function run() {
    const candidates = [
        "searchString", "SearchString", "query", "Query", "text", "Text",
        "keyword", "Keyword", "keywords", "Keywords", "search", "Search",
        "freeTradeWords", "FreeTradeWords", "phrase", "Phrase", "terms", "Terms"
    ];
    for (let c of candidates) {
        console.log(`Testing ${c}...`);
        if (await testKey(c, "Термочехлы")) return;
        if (await testKey(c, ["Термочехлы"])) return;
    }
    console.log("No valid key found.");
}
run();
