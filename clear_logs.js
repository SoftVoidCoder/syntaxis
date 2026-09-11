import { initFirebase } from './api/db.js';
import admin from 'firebase-admin';

async function clearLogs() {
    try {
        await initFirebase();
        const db = admin.firestore();
        const logsRef = db.collection('server_activity_logs');
        
        console.log("Fetching logs to delete...");
        const snapshot = await logsRef.get();
        if (snapshot.empty) {
            console.log("No logs found in 'server_activity_logs'.");
            process.exit(0);
        }
        
        console.log(`Found ${snapshot.size} logs. Deleting in batches...`);
        let batch = db.batch();
        let count = 0;
        
        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
            count++;
            
            if (count % 400 === 0) {
                await batch.commit();
                console.log(`Deleted ${count} logs...`);
                batch = db.batch();
            }
        }
        
        if (count % 400 !== 0) {
            await batch.commit();
        }
        
        console.log(`Successfully deleted ${count} logs from 'server_logs'.`);
        process.exit(0);
    } catch (e) {
        console.error("Error clearing logs:", e);
        process.exit(1);
    }
}

clearLogs();
