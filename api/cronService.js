import cron from 'node-cron';
import fetch from 'node-fetch';
import { getFirestore } from 'firebase-admin/firestore';

// --- CONFIGURATION ---
// Cron Schedule: 20:00 daily (Server Time - likely UTC in Railway, so this might need adjustment to MSK)
// MSK is UTC+3. So 20:00 MSK is 17:00 UTC.
const CRON_SCHEDULE = '0 17 * * *'; // 17:00 UTC = 20:00 MSK

const startCronService = () => {
    console.log(`[CRON] Service Initialized. Schedule: ${CRON_SCHEDULE} (UTC) for 20:00 MSK reporting.`);

    cron.schedule(CRON_SCHEDULE, async () => {
        console.log(`[CRON] Starting Daily Activity Report Job: ${new Date().toISOString()}`);

        try {
            await generateDailyReports();
            console.log(`[CRON] Daily Report Job Completed: ${new Date().toISOString()}`);
        } catch (error) {
            console.error(`[CRON] Job Failed:`, error);
        }
    });
};

const generateDailyReports = async () => {
    const db = getFirestore();

    // 1. Get Settings (Bitrix Webhook)
    const settingsDoc = await db.collection('settings').doc('global').get();
    if (!settingsDoc.exists) {
        console.warn("[CRON] No global settings found. Skipping report.");
        return;
    }
    const { bitrixWebhook } = settingsDoc.data();

    if (!bitrixWebhook) {
        const errorMsg = "Глобальный Webhook Bitrix24 не настроен! Зайдите в Настройки ИИ и укажите Webhook.";
        console.error(`[CRON] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    // 2. Get All Users (Map ID -> User Data)
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 3. Define Time Range (Today 00:00 MSK - Today 23:59 MSK)
    // Actually we run at 20:00 MSK, effectively capturing "today so far".
    // Better to use absolute dates based on server time, adjusted to MSK.
    const now = new Date();
    // Offset to MSK (UTC+3)
    const mskOffset = 3 * 60 * 60 * 1000;
    const mskNow = new Date(now.getTime() + mskOffset);

    const startOfDay = new Date(mskNow);
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Bitrix format: YYYY-MM-DD
    const dateStr = startOfDay.toISOString().split('T')[0];

    console.log(`[CRON] Fetching Bitrix Data for Date: ${dateStr}`);

    // 4. Fetch Bitrix Data (Activities & Deals)
    // Extract domain from webhook for linking
    // Webhook format usually: https://SUBDOMAIN.bitrix24.ru/rest/...
    const domainMatch = bitrixWebhook.match(/^(https:\/\/[^/]+)/);
    const bitrixDomain = domainMatch ? domainMatch[1] : '';

    const bitrixActivities = await fetchBitrixData(bitrixWebhook, 'crm.activity.list', {
        filter: {
            '>=CREATED': `${dateStr}T00:00:00+03:00`,
            '<=CREATED': `${dateStr}T23:59:59+03:00`
        },
        select: ['ID', 'SUBJECT', 'COMPLETED', 'AUTHOR_ID', 'OWNER_ID', 'OWNER_TYPE_ID', 'TYPE_ID', 'DIRECTION', 'CREATED', 'DESCRIPTION', 'START_TIME', 'END_TIME']
    });

    const bitrixDeals = await fetchBitrixData(bitrixWebhook, 'crm.deal.list', {
        filter: {
            '>=DATE_CREATE': `${dateStr}T00:00:00+03:00`,
            '<=DATE_CREATE': `${dateStr}T23:59:59+03:00`
        },
        select: ['ID', 'TITLE', 'OPPORTUNITY', 'ASSIGNED_BY_ID', 'STAGE_ID', 'CURRENCY_ID']
    });

    // 5. Aggregate by Bitrix User ID
    const statsByBitrixId = {};

    // Helper to init
    const getStats = (id) => {
        if (!statsByBitrixId[id]) {
            statsByBitrixId[id] = {
                calls: [],     // Changed to array
                emails: [],    // Changed to array
                tasks: [],     // New: Tasks (swapped from meetings)
                deals: [],     // New: Detailed deals
                telephony: [], // NEW: Raw telephony stats
                // Keep aggregations for easy sorting/display in main row
                summary: {
                    callsCount: 0,
                    emailsCount: 0,
                    tasksCount: 0,
                    dealsCount: 0,
                    dealsAmount: 0,
                    telephonyCount: 0 // New
                },
                bitrixId: id
            };
        }
        return statsByBitrixId[id];
    };

    // Helper: Map Owner Type ID to readable name and URL part
    const getEntityInfo = (typeId, id) => {
        const types = {
            '1': { name: 'Лид', path: '/crm/lead/details/' },
            '2': { name: 'Сделка', path: '/crm/deal/details/' },
            '3': { name: 'Контакт', path: '/crm/contact/details/' },
            '4': { name: 'Компания', path: '/crm/company/details/' }
        };
        const t = types[typeId];
        if (!t) return { name: 'Без привязки', url: null };
        return {
            name: `${t.name} #${id}`,
            url: bitrixDomain ? `${bitrixDomain}${t.path}${id}/` : null
        };
    };

    // Process Activities
    // TYPE_ID: 1=Meeting, 2=Call, 3=Task, 4=Email
    // DIRECTION: 1=In, 2=Out
    if (bitrixActivities) {
        bitrixActivities.forEach(act => {
            const userId = act.AUTHOR_ID;
            const s = getStats(userId);

            // Format time from CREATED "2023-10-27T10:00:00+03:00" -> "10:00"
            const timeStr = act.CREATED ? new Date(act.CREATED).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) : '--:--';

            // Calculate Duration
            let durationSeconds = 0;
            if (act.START_TIME && act.END_TIME) {
                const start = new Date(act.START_TIME).getTime();
                const end = new Date(act.END_TIME).getTime();
                if (end > start) {
                    durationSeconds = Math.round((end - start) / 1000);
                }
            }

            const entity = getEntityInfo(act.OWNER_TYPE_ID, act.OWNER_ID);

            // Truncate description to avoid Firestore payload limits
            const rawDesc = act.DESCRIPTION || '';
            const truncatedDesc = rawDesc.length > 200 ? rawDesc.substring(0, 200) + '...' : rawDesc;

            const item = {
                id: act.ID,
                time: timeStr,
                subject: act.SUBJECT,
                direction: act.DIRECTION, // 1=In, 2=Out
                entityName: entity.name,
                entityUrl: entity.url,
                description: truncatedDesc,
                duration: durationSeconds // New field
            };

            if (act.TYPE_ID == '2') { // Call
                s.calls.push(item);
                s.summary.callsCount++;
            }
            if (act.TYPE_ID == '4') { // Email
                s.emails.push(item);
                s.summary.emailsCount++;
            }
            if (act.TYPE_ID == '3') { // Task (Was Meeting id=1)
                s.tasks.push(item);
                s.summary.tasksCount++;
            }
        });
    }

    // Process Deals
    if (bitrixDeals) {
        bitrixDeals.forEach(deal => {
            const userId = deal.ASSIGNED_BY_ID;
            const s = getStats(userId);

            const amount = parseFloat(deal.OPPORTUNITY || 0);

            s.deals.push({
                id: deal.ID,
                title: deal.TITLE,
                amount: amount,
                currency: deal.CURRENCY_ID,
                url: bitrixDomain ? `${bitrixDomain}/crm/deal/details/${deal.ID}/` : null
            });

            s.summary.dealsCount++;
            s.summary.dealsAmount += amount;
        });
    }

    // --- TELEPHONY STATS (New) ---
    // Fetch generic telephony stats to catch "cold" calls not linked to CRM
    // voximplant.statistic.get
    const telephonyCalls = await fetchBitrixData(bitrixWebhook, 'voximplant.statistic.get', {
        filter: {
            '>=CALL_START_DATE': `${dateStr}T00:00:00+03:00`,
            '<=CALL_START_DATE': `${dateStr}T23:59:59+03:00`
        },
        select: ['ID', 'PORTAL_USER_ID', 'PHONE_NUMBER', 'INCOMING', 'CALL_DURATION', 'CALL_START_DATE', 'STATUS_CODE', 'RECORD_FILE_ID']
    });

    if (telephonyCalls) {
        telephonyCalls.forEach(call => {
            const userId = call.PORTAL_USER_ID;
            if (!userId) return; // Skip if no user linked

            // Filter out internal calls (short numbers, e.g. extensions < 5 digits)
            const phone = String(call.PHONE_NUMBER || '');
            if (phone.length < 5) return;

            const s = getStats(userId); // Will init if not exists

            // 1=Incoming, 2=Outgoing (Bitrix logic might differ, usually INCOMING is '1', '2', etc. or boolean string)
            // Documentation says INCOMING: "1" - Yes, "2" - No (Outgoing)
            const direction = call.INCOMING == '1' ? 1 : 2;

            // Format Time
            const timeStr = call.CALL_START_DATE ? new Date(call.CALL_START_DATE).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }) : '--:--';

            s.telephony.push({
                id: String(call.ID || ''),
                time: timeStr,
                phone: String(call.PHONE_NUMBER || ''), // Ensure string
                direction: direction,
                duration: parseInt(call.CALL_DURATION || 0),
                status: String(call.STATUS_CODE || ''), // Ensure string
                successful: parseInt(call.CALL_DURATION || 0) > 0 && String(call.STATUS_CODE) == '200'
            });

            s.summary.telephonyCount++;
        });
    }

    // 6. Match with Firebase Users and Save (Only those with Bitrix ID)
    // Split into chunked batches to avoid Firestore 10MB payload limit
    const BATCH_CHUNK_SIZE = 5; // Users per batch commit
    const reportDate = dateStr; // YYYY-MM-DD
    let reportsGenerated = 0;
    let currentBatch = db.batch();
    let batchCount = 0;

    for (const user of users) {
        if (!user.bitrixUserId) continue; // Skip users without Bitrix ID

        const bId = String(user.bitrixUserId);
        const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || `User ${bId}`;

        // Default structure if no activity found in Bitrix fetch
        const stats = statsByBitrixId[bId] || {
            calls: [], emails: [], tasks: [], deals: [], telephony: [],
            summary: { callsCount: 0, emailsCount: 0, tasksCount: 0, dealsCount: 0, dealsAmount: 0, telephonyCount: 0 }
        };

        // Strip any undefined values to prevent Firestore crashes
        const cleanStats = JSON.parse(JSON.stringify(stats));

        const docRef = db.collection('analytics_daily').doc(`${reportDate}_${bId}`);
        currentBatch.set(docRef, {
            date: reportDate,
            bitrixId: bId,
            appUserId: user.id, // Link to App User
            name: name,
            ...cleanStats,
            updatedAt: Date.now()
        });
        reportsGenerated++;
        batchCount++;

        // Commit chunk to stay under Firestore 10MB limit
        if (batchCount >= BATCH_CHUNK_SIZE) {
            await currentBatch.commit();
            console.log(`[CRON] Committed batch chunk (${batchCount} users)`);
            currentBatch = db.batch();
            batchCount = 0;
        }
    }

    // Commit remaining
    if (batchCount > 0) {
        await currentBatch.commit();
        console.log(`[CRON] Committed final batch chunk (${batchCount} users)`);
    }

    if (reportsGenerated > 0) {
        console.log(`[CRON] Saved detailed stats for ${reportsGenerated} App Users (matched by Bitrix ID).`);
    } else {
        console.log(`[CRON] No users with Linked Bitrix ID found.`);
    }
};

// --- HELPER: AUTOMATIC PAGINATION ---
const fetchBitrixData = async (webhookUrl, method, params = {}) => {
    let allItems = [];
    let start = 0;
    const SAFETY_LIMIT = 5000;
    const url = webhookUrl.endsWith('/') ? `${webhookUrl}${method}.json` : `${webhookUrl}/${method}.json`;

    while (true) {
        const query = { ...params, start };
        // Serialize
        // Simple serialization since filter is object
        const bodyPayload = { ...params, start };

        try {
            // Using POST to avoid URL length limits and structure issues
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            const data = await res.json();

            // Detect Sabotage or Missing Scopes (e.g. error: "insufficient_scope")
            if (data.error) {
                const errorMsg = `Bitrix API Error (${method}): ${data.error_description || data.error}`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }

            if (!data.result || !Array.isArray(data.result)) {
                if (data.result) return [data.result];
                break;
            }

            allItems = [...allItems, ...data.result];

            if (!data.next || allItems.length >= SAFETY_LIMIT) break;
            start = data.next;

            await new Promise(r => setTimeout(r, 200));

        } catch (e) {
            console.error(`Fetch Error (${method}):`, e);
            throw e; // Throw the error so the report generator fails visibly
        }
    }
    return allItems;
};

export { startCronService, generateDailyReports };
