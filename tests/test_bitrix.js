import dotenv from 'dotenv';
dotenv.config();
import { initFirebase } from './api/db.js';
import { getFirestore } from 'firebase-admin/firestore';
import fetch from 'node-fetch';

async function testBitrixConnection() {
    await initFirebase();
    const db = getFirestore();

    console.log("--- Fetching Current Settings ---");
    const settings = await db.collection('settings').doc('global').get();
    const webhook = settings.data()?.bitrixWebhook;

    if (!webhook) {
        console.error("No Bitrix Webhook configured in DB.");
        process.exit(1);
    }

    console.log("Found Webhook:", webhook.replace(/\/[^\/]+\/[^\/]+\/?$/, '/***/***')); // mask the secret

    const endpoints = [
        'crm.activity.list',
        'crm.deal.list',
        'voximplant.statistic.get'
    ];

    for (const ep of endpoints) {
        const url = webhook.endsWith('/') ? `${webhook}${ep}.json` : `${webhook}/${ep}.json`;
        console.log(`\nTesting endpoint: ${ep}`);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: 0 }) // Just a basic query to see if we get 'result' or 'error'
            });
            const data = await res.json();
            if (data.error) {
                console.error(`❌ Error on ${ep}:`, data.error, data.error_description);
            } else if (data.result !== undefined) {
                console.log(`✅ Success on ${ep}. Data length: ${Array.isArray(data.result) ? data.result.length : typeof data.result}`);
            } else {
                console.log(`❓ Unknown response on ${ep}:`, Object.keys(data));
            }
        } catch (e) {
            console.error(`💥 Request failed for ${ep}:`, e.message);
        }
    }

    // Check users collection to see what 'bitrixUserId' looks like
    const users = await db.collection('users').get();
    const usersWithId = users.docs.map(d => ({ name: d.data().firstName, bitrixId: d.data().bitrixUserId })).filter(u => u.bitrixId);
    console.log(`\nUsers with bitrixUserId in DB: ${usersWithId.length}`);
    console.log(usersWithId.slice(0, 5));

    process.exit(0);
}

testBitrixConnection().catch(console.error);
