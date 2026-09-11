// checko-test-endpoints.mjs
import fetch from 'node-fetch';

const apiKey = 'LvgYmQYEspLTKRxx';
const inn = '8401005730';

async function testEndpoints() {
    console.log(`Testing INN: ${inn} with Standard Tariff endpoints`);

    const endpoints = [
        `https://api.checko.ru/v2/finances?key=${apiKey}&inn=${inn}`,
        `https://api.checko.ru/v2/contracts?key=${apiKey}&inn=${inn}&law=44&role=supplier`,
        `https://api.checko.ru/v2/contracts?key=${apiKey}&inn=${inn}&law=223&role=supplier`,
    ];

    for (const url of endpoints) {
        console.log(`\n--- Fetching: ${new URL(url).pathname}${new URL(url).search.replace(apiKey, 'HIDDEN')} ---`);
        try {
            const res = await fetch(url);
            const data = await res.json();
            console.log(`Status: ${res.status}`);
            if (res.status === 200 && data.data) {
                if (Array.isArray(data.data)) {
                    console.log(`SUCCESS! Found ${data.data.length} contracts.`);
                    if (data.data.length > 0) {
                        console.log(`First item preview:`, JSON.stringify(data.data[0]).substring(0, 300));
                    }
                } else {
                    console.log(`SUCCESS! Data keys:`, Object.keys(data.data));
                    console.log(`Preview:`, JSON.stringify(data.data).substring(0, 300));
                }
            } else {
                console.log(`Error/Message:`, data.message || data.error || 'No data');
            }
        } catch (e) {
            console.error(`Fetch failed: ${e.message}`);
        }
    }
}

testEndpoints();
