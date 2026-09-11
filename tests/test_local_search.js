import fetch from 'node-fetch';

async function test() {
    const res = await fetch('http://localhost:3000/api/tenders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            endpoint: '/local-search',
            savedTenders: ["123", "01234567890", "test"]
        })
    });
    const data = await res.json();
    console.log("Response:", data);
}

test();
