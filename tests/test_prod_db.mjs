import fetch from 'node-fetch';

async function run() {
    console.log("Fetching local-search from production...");
    try {
        const res = await fetch('https://kordanexus-production.up.railway.app/api/tenders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: '/local-search',
                query: 'Термочехлы'
            })
        });
        const data = await res.json();
        console.log("Local search results:", data.items ? data.items.length : data);

        if (data.items && data.items.length > 0) {
            console.log("First item:", data.items[0].name, data.items[0].price);
        } else {
            // Fetch without query to see if ANY items exist
            console.log("Fetching without query to see total items...");
            const resAll = await fetch('https://kordanexus-production.up.railway.app/api/tenders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: '/local-search'
                })
            });
            const dataAll = await resAll.json();
            console.log("Unfiltered local search results count:", dataAll.items ? dataAll.items.length : dataAll);
        }
    } catch (e) {
        console.error(e);
    }
}
run();
