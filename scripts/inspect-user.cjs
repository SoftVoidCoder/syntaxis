const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' }); // Load env if available

async function main() {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
        console.error('FIREBASE_SERVICE_ACCOUNT missing');
        process.exit(1);
    }

    try {
        initializeApp({
            credential: cert(JSON.parse(serviceAccount))
        });
        const db = getFirestore();

        console.log("Fetching users...");
        const snapshot = await db.collection('users').get();

        if (snapshot.empty) {
            console.log('No users found.');
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`\nUser: ${data.username} (${doc.id})`);
            console.log(`- Webhook URL present? ${data.bitrixWebhookUrl ? 'YES' : 'NO'}`);
            if (data.bitrixWebhookUrl) {
                console.log(`- Value: ${data.bitrixWebhookUrl}`);
            }
            // Check for typo variants just in case
            if (data.bitrixWebhook) console.log(`- WARN: Found 'bitrixWebhook' (wrong field name) on user!`);
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
