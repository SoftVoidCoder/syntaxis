const apiKey = process.env.CHECKO_API_KEY;
let url = 'https://api.checko.ru/v2/search?key=' + apiKey + '&empty=1&okved=20.1&region=63';
console.log('Testing URL:', url.replace(apiKey, 'HIDDEN'));
fetch(url).then(r => r.json().then(d => console.log('Status:', r.status, 'Response:', JSON.stringify(d, null, 2)))).catch(console.error);
