// Test Checko API - search endpoints
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.CHECKO_API_KEY;
if (!apiKey) { console.error('No CHECKO_API_KEY'); process.exit(1); }

const tests = [
    // 1. INN lookup (should work)
    { label: 'INN 7705351687 (ФосАгро)', url: `https://api.checko.ru/v2/company?key=${apiKey}&inn=7705351687` },
    // 2. Search by name
    { label: 'Search: ФосАгро', url: `https://api.checko.ru/v2/search?key=${apiKey}&query=${encodeURIComponent('ФосАгро')}` },
    // 3. Try suggest endpoint 
    { label: 'Suggest: ФосАгро', url: `https://api.checko.ru/v2/suggest?key=${apiKey}&query=${encodeURIComponent('ФосАгро')}` },
    // 4. Try company endpoint with name
    { label: 'Company by name: ФосАгро', url: `https://api.checko.ru/v2/company?key=${apiKey}&query=${encodeURIComponent('ФосАгро')}` },
];

for (const test of tests) {
    console.log(`\n=== ${test.label} ===`);
    console.log('URL:', test.url.replace(apiKey, 'KEY'));
    try {
        const res = await fetch(test.url);
        const data = await res.json();
        console.log('Status:', res.status);
        console.log('Response keys:', Object.keys(data));
        if (data.data) {
            if (Array.isArray(data.data)) {
                console.log(`Results: ${data.data.length} items`);
                data.data.slice(0, 3).forEach((item, i) => console.log(`  [${i}]`, JSON.stringify(item).substring(0, 200)));
            } else {
                console.log('Data:', JSON.stringify(data.data).substring(0, 300));
            }
        } else {
            console.log('Full response:', JSON.stringify(data).substring(0, 500));
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}
