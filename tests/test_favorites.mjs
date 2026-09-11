import fetch from 'node-fetch';

async function testFavorites() {
    const userId = 'admin_master';
    const tenderId = '1234567890';
    console.log("1. Saving to favorites");
    let res = await fetch('http://localhost:3000/api/db', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'set',
            collectionName: `users/${userId}/saved_tenders`,
            docId: tenderId,
            payload: {
                data: { savedAt: Date.now(), status: "IN_WORK" }
            }
        })
    });
    console.log(await res.json());

    console.log("2. Listing favorites");
    res = await fetch('http://localhost:3000/api/db', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'list',
            collectionName: `users/${userId}/saved_tenders`,
        })
    });
    const list = await res.json();
    console.log(list);

    // Now trigger local-search
    console.log("3. Triggering search in local API");
    res = await fetch('http://localhost:3000/api/tenders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            endpoint: '/local-search',
            savedTenders: list.map(t => t.id)
        })
    });
    console.log(await res.json());
}

testFavorites();
