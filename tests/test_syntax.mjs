import fetch from 'node-fetch';

async function test() {
    const url = 'https://syntax.su/api/checko-deep';
    console.log(`POST ${url}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inn: '8401005730' })
    });

    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Response text preview: ${text.substring(0, 100)}...`);
}
test();
