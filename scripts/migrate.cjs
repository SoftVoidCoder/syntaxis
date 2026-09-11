const admin = require('firebase-admin');
const fs = require('fs');

// --- CONFIGURATION ---
// 1. Download "Service Account Key" from OLD Project -> Rename to "old-key.json"
// 2. Download "Service Account Key" from NEW Project -> Rename to "new-key.json"
// 3. Place them in this folder.

const SOURCE_DB_ID = 'korda-db'; // Now correctly accessing named DB
const DEST_DB_ID = '(default)';

async function migrate() {
    console.log("🚀 Starting Migration...");
    console.log(`Source DB: ${SOURCE_DB_ID}, Dest DB: ${DEST_DB_ID}`);

    if (!fs.existsSync('./old-key.json') || !fs.existsSync('./new-key.json')) {
        console.error("❌ ERROR: Missing key files.");
        process.exit(1);
    }

    const { getFirestore } = require('firebase-admin/firestore');

    try {
        // Initialize Source (OLD)
        // Note: We don't pass databaseId here anymore
        const sourceApp = admin.initializeApp({
            credential: admin.credential.cert(require('./old-key.json'))
        }, 'source');

        // Initialize Dest (NEW)
        const destApp = admin.initializeApp({
            credential: admin.credential.cert(require('./new-key.json'))
        }, 'dest');

        // Access Named Database for Source
        const srcDb = getFirestore(sourceApp, SOURCE_DB_ID);

        // Access Default Database for Dest
        const destDb = getFirestore(destApp, DEST_DB_ID === '(default)' ? undefined : DEST_DB_ID);

        // Collections to copy
        const collections = [
            'users',
            'knowledge',
            'chats',
            'analytics_monthly',
            'quizzes',
            'quiz_sessions',
            'settings'
        ];

        for (const colName of collections) {
            console.log(`\n📦 Migrating Collection: ${colName}...`);
            let snapshot;
            try {
                const srcCol = srcDb.collection(colName);
                snapshot = await srcCol.get();
            } catch (readErr) {
                console.error(`❌ FAILED to read collection '${colName}' from Source DB.`);
                console.error(`Error details: ${readErr.message}`);
                continue;
            }

            if (snapshot.empty) {
                console.log(`   (Skipping empty collection)`);
                continue;
            }

            let count = 0;
            const batchSize = 100;
            let batch = destDb.batch();
            let batchCount = 0;

            for (const doc of snapshot.docs) {
                const data = doc.data();
                const docRef = destDb.collection(colName).doc(doc.id);
                batch.set(docRef, data);
                batchCount++;
                count++;

                // Commit batch if full
                if (batchCount >= batchSize) {
                    await batch.commit();
                    console.log(`   ...Wrote ${count} documents`);
                    batch = destDb.batch();
                    batchCount = 0;
                }

                // --- RECURSIVE SUBCOLLECTIONS (Deep Copy) ---
                // Specifically for 'users' -> 'chats'
                if (colName === 'users') {
                    const subChats = await doc.ref.collection('chats').get();
                    if (!subChats.empty) {
                        process.stdout.write(`   > Migrating ${subChats.size} chats for user ${doc.id}...`);
                        const subBatch = destDb.batch();
                        subChats.docs.forEach(chatDoc => {
                            subBatch.set(destDb.collection('users').doc(doc.id).collection('chats').doc(chatDoc.id), chatDoc.data());
                        });
                        await subBatch.commit();
                        process.stdout.write(" Done.\n");
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }
            console.log(`✅ Collection ${colName} finished. Total: ${count}`);
        }

        console.log("\n🎉 Migration Complete!");
    } catch (err) {
        console.error("❌ MIGRATION FAILED (Fatal):", err);
    }
}

migrate().catch(console.error);
