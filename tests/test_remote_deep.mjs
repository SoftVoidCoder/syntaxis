const inn = '8401005730';
const url = 'https://kordanexus-production.up.railway.app/api/checko-deep';

console.log(`Testing remote endpoint: ${url}`);
fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inn })
})
    .then(res => res.json())
    .then(data => console.log(JSON.stringify(data, null, 2).substring(0, 1500) + '...'))
    .catch(err => console.error(err));
