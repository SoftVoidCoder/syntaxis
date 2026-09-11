// Dynamic Import Helper for Firebase
let firebaseApp;
let firestore;
let cachedSystemSettings = null;
let settingsFallbackUntil = 0;

const getLocalAdmin = () => {
    const username = process.env.LOCAL_ADMIN_USERNAME;
    const password = process.env.LOCAL_ADMIN_PASSWORD;
    if (!username || !password) return null;
    return {
        id: process.env.LOCAL_ADMIN_ID || 'local-owner-admin',
        username,
        password,
        email: process.env.LOCAL_ADMIN_EMAIL || '',
        firstName: process.env.LOCAL_ADMIN_FIRST_NAME || 'Администратор',
        lastName: process.env.LOCAL_ADMIN_LAST_NAME || '',
        role: 'ADMIN',
        isBlocked: false,
        isIpRestricted: false,
        bitrixUserId: process.env.LOCAL_ADMIN_BITRIX_ID || '',
        permissions: {
            canGenerateImages: true, canGenerateVideos: true, canSearchClients: true,
            canAccessTenders: true, canAccessSales: true, canAccessAnalytics: true,
            canAccessCalculation: true, canAccessConveyor: true, canAccessKnowledge: true,
            canAccessDeepResearch: true, canAccessPsychologist: true, canAccessSandbox: true,
            sandboxApps: ['consilium']
        }
    };
};

const getFallbackSettings = () => ({
    prompts: {}, welcomeMessages: {}, quickPrompts: [],
    bitrixWebhook: process.env.BITRIX_WEBHOOK || '',
    tenderContext: '', baseNegativeKeywords: '', searchChips: [], searchChipPrompt: ''
});

// --- Company Name Normalization (mirrors utils/normalizeCompanyName.ts) ---
function normalizeCompanyName(name) {
    if (!name) return '';
    return name
        .trim()
        .toLowerCase()
        .replace(/[«»\u201c\u201d\u2018\u2019"']/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// --- Known Leads Dedup Cache ---
let knownLeadsCache = null;
let knownLeadsCacheTime = 0;
const KNOWN_LEADS_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// --- Pending Names (Race Condition Prevention) ---
const pendingNames = new Map(); // normalized name → timestamp
const PENDING_TTL = 60 * 60 * 1000; // 1 hour auto-expiry

export async function initFirebase() {
    if (firestore) return firebaseApp; // Already fully initialized

    const { getApps, initializeApp, cert } = await import('firebase-admin/app');

    if (getApps().length === 0) {
        const SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!SERVICE_ACCOUNT_JSON) {
            console.error("Missing FIREBASE_SERVICE_ACCOUNT env var");
            return;
        }
        try {
            firebaseApp = initializeApp({
                credential: cert(JSON.parse(SERVICE_ACCOUNT_JSON)),
                storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'korda-syntax.firebasestorage.app'
            });
            console.log("Firebase Admin Initialized");
        } catch (err) {
            console.error("Firebase Admin Init Error:", err);
            return;
        }
    } else {
        firebaseApp = getApps()[0];
    }

    // Cache Firestore reference once
    const { getFirestore } = await import('firebase-admin/firestore');
    firestore = getFirestore();
    console.log("Firestore connection cached");

    return firebaseApp;
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        return res.status(200).json({ status: "OK", message: "DB Proxy Online (Secure Mode)" });
    }

    if (!firestore) {
        await initFirebase();
    }
    if (!firestore) {
        return res.status(500).json({ error: "Database Connection Failed" });
    }

    const db = firestore;
    const { action, collectionName, docId } = req.body || {};
    const payload = req.body?.payload || req.body || {};

    try {
        // --- ACTIONS ---

        // 1. LOGIN
        if (action === 'login') {
            const { username, password } = payload;

            // Keeps the explicitly configured local owner account usable when
            // Firestore is temporarily throttled or unavailable.
            const localAdmin = getLocalAdmin();
            if (localAdmin && username === localAdmin.username && password === localAdmin.password) {
                const safeUser = { ...localAdmin };
                delete safeUser.password;
                return res.status(200).json(safeUser);
            }

            const snapshot = await db.collection('users')
                .where('username', '==', username)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return res.status(401).json({ error: "User not found" });
            }

            const doc = snapshot.docs[0];
            const userData = { id: doc.id, ...doc.data() };

            if (userData.isBlocked) {
                return res.status(403).json({ error: "Ваш аккаунт заблокирован администратором." });
            }

            if (userData.password !== password) {
                // Anti-Brute-Force: Artificial Delay
                await new Promise(r => setTimeout(r, 2000));
                return res.status(401).json({ error: "Wrong password" });
            }

            delete userData.password;
            return res.status(200).json(userData);
        }

        // 1.5 BOOTSTRAP
        if (action === 'bootstrap') {
            const adminRef = db.collection('users').doc('admin_master');
            await adminRef.set({
                username: "admin",
                password: "admin",
                role: "ADMIN",
                firstName: "Super",
                lastName: "Admin",
                permissions: {
                    canGenerateImages: true,
                    canGenerateVideos: true
                }
            }, { merge: true });

            return res.status(200).json({ message: "Admin 'admin' created/updated" });
        }

        // 2. LIST
        if (action === 'list') {
            const snapshot = await db.collection(collectionName).get();
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return res.status(200).json(list);
        }

        // 2.5 LIST KNOWN LEADS (Lightweight dedup by company name)
        if (action === 'list_known_leads') {
            const now = Date.now();

            // Collect base names (from cache or fresh query)
            let baseNames;
            if (knownLeadsCache && (now - knownLeadsCacheTime) < KNOWN_LEADS_CACHE_TTL) {
                baseNames = new Set(knownLeadsCache.names);
            } else {
                const snapshot = await db.collection('sales_tasks').get();
                baseNames = new Set();
                snapshot.docs.forEach(doc => {
                    const leads = doc.data().leads || [];
                    leads.forEach(l => {
                        if (l.companyName) {
                            baseNames.add(normalizeCompanyName(l.companyName));
                        }
                    });
                });
                // Update cache
                knownLeadsCache = { names: [...baseNames] };
                knownLeadsCacheTime = now;
            }

            // Merge non-expired pending names
            let pendingCount = 0;
            for (const [name, ts] of pendingNames) {
                if (now - ts < PENDING_TTL) {
                    baseNames.add(name);
                    pendingCount++;
                } else {
                    pendingNames.delete(name);
                }
            }

            console.log(`[DB] Known leads: ${baseNames.size} names (${pendingCount} pending)`);
            return res.status(200).json({ names: [...baseNames] });
        }

        // 2.6 RESERVE LEADS (Race condition prevention — by name)
        if (action === 'reserve_leads') {
            const { names: newNames = [] } = payload;
            const now = Date.now();
            newNames.forEach(n => pendingNames.set(normalizeCompanyName(n), now));
            // Invalidate cache so next list_known_leads rebuilds fresh + pending
            knownLeadsCache = null;
            knownLeadsCacheTime = 0;
            console.log(`[DB] Reserved ${newNames.length} names (total pending: ${pendingNames.size})`);
            return res.status(200).json({ reserved: newNames.length });
        }

        // 2.65 PERSONAL IGNORE LIST — Add
        if (action === 'add_personal_ignore') {
            const { userId, companyName } = payload;
            if (!userId || !companyName) {
                return res.status(400).json({ error: 'userId and companyName required' });
            }
            const normalized = normalizeCompanyName(companyName);
            const docId = normalized.replace(/[/\\]/g, '_').substring(0, 100); // Safe Firestore doc ID
            await db.collection('users').doc(userId).collection('ignored_companies').doc(docId).set({
                originalName: companyName.trim(),
                normalizedName: normalized,
                addedAt: Date.now()
            });
            console.log(`[DB] Personal ignore: user=${userId}, company="${companyName}"`);
            return res.status(200).json({ success: true, normalized });
        }

        // 2.66 PERSONAL IGNORE LIST — List
        if (action === 'list_personal_ignores') {
            const { userId } = payload;
            if (!userId) {
                return res.status(400).json({ error: 'userId required' });
            }
            const snapshot = await db.collection('users').doc(userId).collection('ignored_companies').get();
            const names = snapshot.docs.map(doc => doc.data().normalizedName || '');
            return res.status(200).json({ names });
        }

        // 2.7 UPDATE LEAD INN (Correct INN after Checko verification)
        if (action === 'update_lead_inn') {
            const { companyName, newInn } = payload;
            if (!companyName || !newInn) {
                return res.status(400).json({ error: 'companyName and newInn required' });
            }
            const normalizedName = companyName.trim().toLowerCase();
            const snapshot = await db.collection('sales_tasks').where('status', '==', 'IN_PROGRESS').get();
            let updated = false;
            for (const doc of snapshot.docs) {
                const task = doc.data();
                const leads = task.leads || [];
                const leadIdx = leads.findIndex(l => l.companyName?.trim().toLowerCase() === normalizedName);
                if (leadIdx !== -1 && leads[leadIdx].inn !== newInn.trim()) {
                    const oldInn = leads[leadIdx].inn;
                    leads[leadIdx].inn = newInn.trim();
                    await db.collection('sales_tasks').doc(doc.id).update({ leads });
                    console.log(`[DB] Updated lead INN: "${companyName}" ${oldInn} → ${newInn} (task ${doc.id})`);
                    updated = true;
                    // Invalidate cache
                    knownLeadsCache = null;
                    knownLeadsCacheTime = 0;
                    break; // Only update first match
                }
            }
            return res.status(200).json({ updated, companyName, newInn });
        }

        // 3. GET
        if (action === 'get') {
            const doc = await db.collection(collectionName).doc(docId).get();
            if (!doc.exists) return res.status(200).json(null);
            return res.status(200).json({ id: doc.id, ...doc.data() });
        }

        // 4. SET (Create/Update)
        if (action === 'set') {
            const { data } = payload;
            await db.collection(collectionName).doc(docId).set(data, { merge: true });

            // Invalidate known leads cache when sales_tasks change
            if (collectionName === 'sales_tasks') {
                knownLeadsCache = null;
                knownLeadsCacheTime = 0;
            }

            // Return updated data
            const doc = await db.collection(collectionName).doc(docId).get();
            return res.status(200).json({ id: doc.id, ...doc.data() });
        }

        // 4.5 DELETE
        if (action === 'delete') {
            await db.collection(collectionName).doc(docId).delete();
            return res.status(200).json({ success: true, id: docId });
        }

        // 5. GET SETTINGS
        if (action === 'get_settings') {
            if (Date.now() < settingsFallbackUntil) {
                return res.status(200).json(cachedSystemSettings || getFallbackSettings());
            }
            let doc;
            try {
                doc = await db.collection('settings').doc('global').get();
            } catch (error) {
                console.warn(`[DB] Firebase settings unavailable, using local integration fallback: ${error.message}`);
                settingsFallbackUntil = Date.now() + 5 * 60 * 1000;
                return res.status(200).json(cachedSystemSettings || getFallbackSettings());
            }

            if (!doc.exists) {
                return res.status(200).json({
                    prompts: {
                        sales: `Вы — ведущий менеджер по продажам компании "Корда" (Санкт-Петербург)...`,
                        training: `Вы — Технический Директор компании "Корда"...`,
                        calculation: `Вы — Старший Сметчик компании "Корда"...`,
                        deep_research: `Вы — Стратегический Маркетолог компании "Корда"...`
                    },
                    welcomeMessages: {
                        SALES: "👋 Привет, коллега! Готов продавать изоляцию?...",
                        TRAINING: "🎓 Добро пожаловать в Академию Корда...",
                        CALCULATION: "📐 Инженерный калькулятор готов...",
                        DEEP_RESEARCH: "🕵️ Режим Глубокого Анализа Рынков...",
                        FREE: "Привет! Я Korda AI. Готов помочь..."
                    },
                    quickPrompts: []
                });
            }
            const data = doc.data();
            cachedSystemSettings = {
                ...getFallbackSettings(),
                ...data,
                bitrixWebhook: data.bitrixWebhook || process.env.BITRIX_WEBHOOK || ''
            };
            return res.status(200).json(cachedSystemSettings);
        }

        // 6. SAVE SETTINGS
        if (action === 'save_settings') {
            const { settings } = payload;
            await db.collection('settings').doc('global').set(settings, { merge: true });
            return res.status(200).json({ success: true });
        }

        // 6.5 DESKTOP NOTIFICATIONS (get_unread_notifications)
        if (action === 'get_unread_notifications') {
            // For desktop app, we can use the authToken as the userId for simplicity
            const userId = req.body.authToken || payload.userId;
            if (!userId) return res.status(400).json({ error: "Missing userId/authToken" });

            const snapshot = await db.collection('corporate_chats')
                .where('participants', 'array-contains', userId)
                .get();

            const unreadChats = [];
            for (const doc of snapshot.docs) {
                const chat = doc.data();
                const count = chat.unreadCount ? (chat.unreadCount[userId] || 0) : 0;
                if (count > 0 && chat.lastMessage) {

                    // Fetch sender details
                    let senderName = "Новое сообщение";
                    if (chat.lastMessage.senderId) {
                        const userDoc = await db.collection('users').doc(chat.lastMessage.senderId).get();
                        if (userDoc.exists) {
                            const ud = userDoc.data();
                            senderName = `${ud.firstName || ''} ${ud.lastName || ''}`.trim();
                        }
                    }

                    unreadChats.push({
                        chatId: doc.id,
                        senderId: chat.lastMessage.senderId,
                        senderName: senderName,
                        text: chat.lastMessage.text,
                        timestamp: chat.lastMessage.timestamp,
                        unreadCount: count
                    });
                }
            }

            return res.status(200).json({ unreadChats });
        }

        // 7. TRACK ANALYTICS
        if (action === 'track_analytics') {
            const { userId, type, mode, userInfo } = payload;
            const now = new Date();
            const monthKey = now.toISOString().slice(0, 7); // YYYY-MM
            const docRef = db.collection('analytics_monthly').doc(`${userId}_${monthKey}`);

            await db.runTransaction(async (t) => {
                const doc = await t.get(docRef);
                let currentData = {
                    userId,
                    month: monthKey,
                    firstName: userInfo?.firstName || '',
                    lastName: userInfo?.lastName || '',
                    chatRequests: {},
                    imagesGenerated: 0,
                    videosGenerated: 0,
                    lastActive: Date.now()
                };

                if (doc.exists) {
                    const data = doc.data();
                    currentData = { ...currentData, ...data };
                    if (!currentData.chatRequests) currentData.chatRequests = {};
                }

                if (type === 'chat' && mode) {
                    currentData.chatRequests[mode] = (currentData.chatRequests[mode] || 0) + 1;
                } else if (type === 'image') {
                    currentData.imagesGenerated = (currentData.imagesGenerated || 0) + 1;
                } else if (type === 'video') {
                    currentData.videosGenerated = (currentData.videosGenerated || 0) + 1;
                }
                currentData.lastActive = Date.now();

                if (userInfo) {
                    currentData.firstName = userInfo.firstName || currentData.firstName;
                    currentData.lastName = userInfo.lastName || currentData.lastName;
                }
                t.set(docRef, currentData, { merge: true });
            });

            return res.status(200).json({ success: true, docId: docRef.id });
        }

        // 8. DESKTOP INLINE REPLY (send_corporate_message)
        if (action === 'send_corporate_message') {
            const { chatId, text, authToken } = payload;
            if (!chatId || !text || !authToken) {
                return res.status(400).json({ error: "Missing chatId, text, or authToken" });
            }

            const { FieldValue } = await import('firebase-admin/firestore');

            // Generate a message document
            const timestamp = Date.now();
            const messageData = {
                senderId: authToken, // using authToken as userId for now
                text: text,
                timestamp: timestamp,
                isRead: false
            };

            const chatRef = db.collection('corporate_chats').doc(chatId);

            await db.runTransaction(async (t) => {
                const chatDoc = await t.get(chatRef);
                if (!chatDoc.exists) throw new Error("Chat not found");

                const chatData = chatDoc.data();
                const unreadCount = chatData.unreadCount || {};

                // Increment unread count for everyone except sender
                (chatData.participants || []).forEach(p => {
                    if (p !== authToken) {
                        unreadCount[p] = (unreadCount[p] || 0) + 1;
                    }
                });
                // Clear sender's unread count since they are actively replying
                unreadCount[authToken] = 0;

                // Update chat metadata
                t.update(chatRef, {
                    lastMessage: {
                        senderId: authToken,
                        text: text,
                        timestamp: timestamp
                    },
                    unreadCount: unreadCount,
                    updatedAt: timestamp
                });

                // Add to subcollection
                const msgRef = chatRef.collection('messages').doc();
                t.set(msgRef, messageData);
            });

            return res.status(200).json({ success: true });
        }

        // 9. SERVER ACTIVITY MONITORING (log_server_activity)
        if (action === 'log_server_activity') {
            const { token, logs } = payload;
            if (token !== "KORDA_SERVER_SYNC_SECRET_2026") {
                return res.status(403).json({ error: "Invalid token" });
            }
            if (!logs || !Array.isArray(logs) || logs.length === 0) {
                return res.status(200).json({ success: true, count: 0 });
            }

            // Firestore batch limit is 500. Split into chunks to be safe.
            for (let i = 0; i < logs.length; i += 400) {
                const chunk = logs.slice(i, i + 400);
                const batch = db.batch();
                chunk.forEach(log => {
                    const docRef = db.collection('server_activity_logs').doc();
                    batch.set(docRef, { ...log, serverReceivedAt: Date.now() });
                });
                await batch.commit();
            }

            // Auto-cleanup older than 30 days
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
            try {
                const oldLogsSnapshot = await db.collection('server_activity_logs')
                    .where('serverReceivedAt', '<', thirtyDaysAgo)
                    .limit(400)
                    .get();
                    
                if (!oldLogsSnapshot.empty) {
                    const deleteBatch = db.batch();
                    oldLogsSnapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
                    await deleteBatch.commit();
                    console.log(`[DB] Cleaned up ${oldLogsSnapshot.size} old server logs.`);
                }
            } catch (e) {
                console.log("Cleanup error (might need index):", e.message);
            }

            return res.status(200).json({ success: true, count: logs.length });
        }

        return res.status(400).json({ error: "Unknown action" });

    } catch (error) {
        console.error("DB Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
}
