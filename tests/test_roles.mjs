import fetch from 'node-fetch';

const apiKey = 'LvgYmQYEspLTKRxx';
async function run() {
    const url = `https://api.checko.ru/v2/company?key=${apiKey}&inn=5103011895`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2).substring(0, 1000));
}
run();
