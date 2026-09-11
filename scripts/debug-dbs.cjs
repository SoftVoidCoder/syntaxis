const admin = require('firebase-admin');
const fetch = require('node-fetch');

async function debugDatabases() {
    console.log("🔍 Debugging Databases via Management API...");

    // 1. Get Access Token
    const serviceAccount = require('./old-key.json');
    const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const token = await app.options.credential.getAccessToken();
    const projectId = serviceAccount.project_id;

    console.log(`Project ID from Key: ${projectId}`);
    console.log(`Service Email: ${serviceAccount.client_email}`);

    // 2. Call Management API
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases`;

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token.access_token}`
            }
        });

        if (!res.ok) {
            const txt = await res.text();
            console.log(`❌ API Error: ${res.status} ${txt}`);
            return;
        }

        const data = await res.json();
        console.log("\n✅ FOUND DATABASES:");
        if (data.databases) {
            data.databases.forEach(db => {
                console.log(` - ID: ${db.name.split('/').pop()}`);
                console.log(`   Name: ${db.name}`);
                console.log(`   Type: ${db.type}`);
                console.log(`   State: ${db.state}`);
                console.log("---");
            });
        } else {
            console.log("No databases found in list.");
        }

    } catch (e) {
        console.error("Fetch Logic Error:", e);
    }
}

debugDatabases();
