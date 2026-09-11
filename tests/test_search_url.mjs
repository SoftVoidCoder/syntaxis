import fetch from 'node-fetch';
const apiKey = 'LvgYmQYEspLTKRxx';

async function testUrl() {
    const url = `https://api.checko.ru/v2/search?key=${apiKey}&query=7736216869`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Search results:");
    if (data.data && data.data.length > 0) {
        console.log(JSON.stringify(data.data[0].meta, null, 2));
        console.log("Keys on search match:", Object.keys(data.data[0]));
    }
}
testUrl();
