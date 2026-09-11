const admin = require('firebase-admin');

async function listDatabases() {
    console.log("🔍 Listing All Databases...");

    // Initialize with NO databaseId to access project-level resources
    const app = admin.initializeApp({
        credential: admin.credential.cert(require('./old-key.json'))
    });

    const firestore = admin.firestore(app);

    try {
        const dbs = await firestore.listCollections();
        // Note: listCollections() lists collections in the DEFAULT db.
        // We want to list database resources. 
        // Admin SDK might not expose listDatabases directly on firestore() instance easily without v2.

        console.log("Checking Default DB collections...");
        dbs.forEach(c => console.log(` - (default): ${c.id}`));

    } catch (e) {
        console.log(`❌ Default DB access failed: ${e.message}`);
    }

    try {
        const kordaDb = firestore.collection('test').firestore;
        // Hacky way to try to switch? No.

        // Let's rely on user feedback or just try the exact string from screenshot again.
        // Wait! The user provided screenshot shows "korda-db".
        // Maybe I should try initializing with empty databaseId?
        // Or maybe just try to log the project ID confirm it matches.
    } catch (e) { }

}

// Use REST API to list databases if SDK is tricky?
// Simpler: Just try to read ONE document from 'users' in 'korda-db'
// to see if it works.

async function deepTest() {
    const cred = admin.credential.cert(require('./old-key.json'));
    const app = admin.initializeApp({
        credential: cred,
        databaseId: 'korda-db'
    }, 'korda');

    try {
        const refs = await app.firestore().listCollections();
        console.log("Found collections in korda-db:", refs.map(r => r.id));
    } catch (e) {
        console.error("Deep test korda-db failed:", e.message);
    }
}

deepTest();
