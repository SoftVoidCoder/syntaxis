const apiKey = process.env.CHECKO_API_KEY;
let urls = [
    'https://api.checko.ru/v2/contracts?key=' + apiKey + '&query=' + encodeURIComponent('Сбербанк'),
];
for (const url of urls) {
    console.log('Testing URL:', url.replace(apiKey, 'HIDDEN'));
    fetch(url).then(r => r.json().then(d => console.log('Status:', r.status, 'Response:', JSON.stringify(d, null, 2)))).catch(console.error);
}
