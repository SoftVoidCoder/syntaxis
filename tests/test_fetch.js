import dotenv from 'dotenv';
dotenv.config();
import { initFirebase } from './api/db.js';
import { getFirestore } from 'firebase-admin/firestore';
import { generateDailyReports } from './api/cronService.js';

async function testForceReport() {
    await initFirebase();
    const db = getFirestore();

    console.log("--- Fetching Current Settings ---");
    const settings = await db.collection('settings').doc('global').get();
    console.log(settings.data()?.bitrixWebhook ? "Webhook present" : "No webhook!");

    console.log("--- Forcing Report Generation ---");
    try {
        await generateDailyReports();
        console.log("Completed generateDailyReports");
    } catch (e) {
        console.error("Error in generateDailyReports:", e);
    }

    console.log("--- Checking Analytics Daily Collection ---");
    const reports = await db.collection('analytics_daily').limit(5).get();
    console.log(`Found ${reports.size} reports.`);
    reports.forEach(doc => {
        console.log("Report Date:", doc.data().date, "BitrixId:", doc.data().bitrixId, "Name:", doc.data().name);
        console.log("Calls:", doc.data().summary?.callsCount, "Deals:", doc.data().summary?.dealsCount);
    });

    process.exit(0);
}

testForceReport();
