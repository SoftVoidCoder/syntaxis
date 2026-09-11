import fetch from 'node-fetch';
const apiKey = 'LvgYmQYEspLTKRxx';

async function testUrl() {
    const url = `https://api.checko.ru/v2/company?key=${apiKey}&inn=7736216869`;
    const res = await fetch(url);
    const data = await res.json();
    console.log("Keys:", Object.keys(data.data));
    console.log("OGRN:", data.data.ОГРН);
}
testUrl();
