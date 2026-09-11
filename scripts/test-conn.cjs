const admin = require('firebase-admin');

async function testConnection() {
    console.log("🔍 Testing Connectivity to OLD Project (korda-nexus)...");

    const keyPath = './old-key.json';
    const cred = admin.credential.cert(require(keyPath));

    // Test 1: Default Database
    try {
        console.log("\n--- Attempt 1: (default) database ---");
        const app1 = admin.initializeApp({ credential: cred, databaseId: '(default)' }, 'app1');
        const dbs1 = await app1.firestore().listCollections();
        console.log("✅ Success! Collections found:", dbs1.map(c => c.id).join(', '));
    } catch (e) {
        console.log("❌ Failed:", e.message);
    }

    // Test 2: Named Database 'korda-db'
    try {
        console.log("\n--- Attempt 2: 'korda-db' database ---");
        const app2 = admin.initializeApp({ credential: cred, databaseId: 'korda-db' }, 'app2');
        const dbs2 = await app2.firestore().listCollections();
        console.log("✅ Success! Collections found:", dbs2.map(c => c.id).join(', '));
    } catch (e) {
        console.log("❌ Failed:", e.message);
    }
}

testConnection();
