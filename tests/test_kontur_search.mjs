import fetch from 'node-fetch';
import process from 'process';

const API_KEY = process.env.KONTUR_API_KEY;

async function testSearch() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const payload = {
        dateTimeFrom: thirtyDaysAgo.toISOString(),
        dateTimeTo: thirtyDaysAhead.toISOString(),
        filter: {
            freeTradeWords: "Термочехлы"
        }
    };

    console.log("Payload:", JSON.stringify(payload, null, 2));

    const res = await fetch('https://api-zakupki.kontur.ru/external/v1/search', {
        method: 'POST',
        headers: { 'X-Kontur-Apikey': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    console.log("Status:", res.status);
    if (!res.ok) console.log(await res.text());
    else {
        const data = await res.json();
        console.log("Count:", data.TotalCount);
        if (data.Items && data.Items.length > 0) {
            console.log("Sample Item[0] Name:", data.Items[0].OrderName);
        }
    }
}
testSearch();
