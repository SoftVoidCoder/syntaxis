

// import { GoogleGenAI } from "@google/genai"; // Moved to dynamic import
import crypto from 'crypto';
import { executeAgentTool } from './agentTools.js';
// import { getFirestore } from 'firebase-admin/firestore'; // Moved to dynamic import
import { initFirebase } from './db.js';

// --- Vertex AI Auth Helper ---
// Parse service account from env (same one used by Firebase Admin)
let _googleAuth = null;
async function getGoogleAuth() {
    if (_googleAuth) return _googleAuth;
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
    const credentials = JSON.parse(saJson);
    // google-auth-library is a transitive dep of firebase-admin, always available
    const { GoogleAuth } = await import('google-auth-library');
    _googleAuth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    return _googleAuth;
}

// Firestore Collection Name
const JOBS_COLLECTION = 'async_jobs';

// --- CONCURRENCY LIMITER ---
// Google Gemini API errors with 500 when too many concurrent requests hit the same key.
// Limit to 3 concurrent generateContent calls; queue the rest.
const MAX_CONCURRENT_AI = 3;
let activeAiCalls = 0;
const aiQueue = [];
let chatKeyCursor = 0;

function getChatApiKeys() {
    const pool = (process.env.GEMINI_CHAT_API_KEYS || '')
        .split(',')
        .map(key => key.trim())
        .filter(Boolean);
    if (pool.length > 0) return pool;
    return process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
}

function getMediaApiKeys() {
    // Media requests may use the same key pool as chat. Keep the dedicated
    // image key as a fallback for installations that still provide one.
    return [...new Set([
        ...getChatApiKeys(),
        process.env.GEMINI_IMAGE_API_KEY,
        process.env.GEMINI_API_KEY,
    ].map(key => key?.trim()).filter(Boolean))];
}

function canRotateMediaKey(error) {
    return error?.status === 401 || error?.status === 403 || error?.status === 429 || error?.status === 503 ||
        /API key|RESOURCE_EXHAUSTED|quota|UNAVAILABLE|high demand/i.test(error?.message || '');
}

function runWithAiLimit(fn) {
    return new Promise((resolve, reject) => {
        const execute = async () => {
            activeAiCalls++;
            try {
                resolve(await fn());
            } catch (err) {
                reject(err);
            } finally {
                activeAiCalls--;
                if (aiQueue.length > 0) {
                    const next = aiQueue.shift();
                    next();
                }
            }
        };
        if (activeAiCalls < MAX_CONCURRENT_AI) {
            execute();
        } else {
            console.log(`[Queue] Request queued (active: ${activeAiCalls}, waiting: ${aiQueue.length + 1})`);
            aiQueue.push(execute);
        }
    });
}

// Retry wrapper for transient 500 and 429 errors
async function withRetry(fn, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const is500 = err?.status === 500 || err?.message?.includes('500') || err?.message?.includes('INTERNAL');
            const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
            if ((is500 || is429) && attempt < maxRetries) {
                const baseDelay = is429 ? 5000 : 2000; // 429: wait longer (5s, 10s, 20s)
                const delay = Math.pow(2, attempt) * baseDelay;
                console.log(`[Retry] ${is429 ? '429 quota' : '500'} error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
            } else {
                throw err;
            }
        }
    }
}

async function generateWithFallback(ai, model, contents, config, timeout = 600000) {
    // The current chat key pool has working quota on Flash Lite. Avoid waiting
    // on the exhausted standard Flash bucket before every chat response.
    if (model === 'gemini-3.5-flash') {
        model = 'gemini-3.5-flash-lite';
    }
    try {
        // Quota errors do not recover within a few seconds. Try the primary
        // model once and switch immediately to the independently metered Lite model.
        return await ai.models.generateContent({ model, contents, config }, { timeout });
    } catch (error) {
        const quotaOrCapacity = error?.status === 429 || error?.status === 503 ||
            /RESOURCE_EXHAUSTED|UNAVAILABLE|high demand/i.test(error?.message || '');
        const fallbackModel = 'gemini-3.5-flash-lite';
        if (!quotaOrCapacity || model === fallbackModel) throw error;
        console.warn(`[Proxy] ${model} unavailable (${error?.status || 'capacity'}); falling back to ${fallbackModel}`);
        try {
            return await withRetry(
                () => ai.models.generateContent({ model: fallbackModel, contents, config }, { timeout }),
                1
            );
        } catch (fallbackError) {
            const unsupportedTool = fallbackError?.status === 400 && config?.tools;
            if (!unsupportedTool) throw fallbackError;
            const liteConfig = { ...config };
            delete liteConfig.tools;
            delete liteConfig.toolConfig;
            return await ai.models.generateContent({ model: fallbackModel, contents, config: liteConfig }, { timeout });
        }
    }
}

async function generateWithKeyPool(aiClients, model, contents, config, timeout = 600000) {
    let lastError;
    for (let index = 0; index < aiClients.length; index++) {
        try {
            return await generateWithFallback(aiClients[index], model, contents, config, timeout);
        } catch (error) {
            lastError = error;
            const hasOnlyGoogleSearch = Array.isArray(config?.tools) && config.tools.length > 0 &&
                config.tools.every(tool => tool?.googleSearch);
            const quotaError = error?.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(error?.message || '');
            if (quotaError && hasOnlyGoogleSearch) {
                // Grounded web search has a separate, often zero, free quota.
                // Preserve ordinary chat by retrying the same prompt without grounding.
                const chatConfig = { ...config };
                delete chatConfig.tools;
                delete chatConfig.toolConfig;
                try {
                    console.warn('[Proxy] Google Search quota unavailable; retrying plain Flash Lite chat');
                    return await generateWithFallback(aiClients[index], model, contents, chatConfig, timeout);
                } catch (plainError) {
                    lastError = plainError;
                    error = plainError;
                }
            }
            const rotate = error?.status === 401 || error?.status === 403 || error?.status === 429 || error?.status === 503 ||
                /API key|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand/i.test(error?.message || '');
            if (!rotate || index === aiClients.length - 1) throw error;
            console.warn(`[Proxy] Chat key ${index + 1} unavailable (${error?.status || 'error'}); rotating key`);
        }
    }
    throw lastError;
}

async function generateVertexImage(model, contents, config) {
    const project = process.env.GOOGLE_CLOUD_PROJECT || 'korda-syntax';
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    const auth = await getGoogleAuth();
    const client = await auth.getClient();
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
    const response = await client.request({
        url,
        method: 'POST',
        data: { contents, generationConfig: config },
        timeout: 90000,
    });
    return response.data;
}

// --- KNOWLEDGE BASE CACHE MANAGER ---
// Caches KB content on Vertex AI to avoid re-sending on every request.
// Key = md5(kbText + model), Value = { cacheName, expiresAt }
const kbCacheMap = new Map();
const KB_CACHE_TTL_MINUTES = 60;
const KB_MIN_CHARS = 12000; // ~4096 tokens minimum for Gemini 3.x caching

// --- VIDEO RESULT CACHE ---
// Firestore has 1MB doc limit; video data is ~2MB+ base64.
// Store video data in memory, auto-expire after 15 min.
const videoResultCache = new Map(); // jobId -> { videoData, expiresAt }
const VIDEO_CACHE_TTL = 15 * 60 * 1000; // 15 min

async function getOrCreateKBCache(ai, model, kbText, tools) {
    const toolsStr = tools ? JSON.stringify(tools) : '';
    const hash = crypto.createHash('md5').update(kbText + '::' + model + '::' + toolsStr).digest('hex');
    const cached = kbCacheMap.get(hash);
    if (cached && cached.expiresAt > Date.now()) {
        console.log(`[Cache HIT] KB cache reused: ${cached.cacheName} (expires in ${Math.round((cached.expiresAt - Date.now()) / 60000)}m)`);
        return cached.cacheName;
    }

    // Create new cache
    console.log(`[Cache MISS] Creating new KB cache (hash=${hash.slice(0, 8)}, model=${model}, size=${kbText.length} chars, tools=${toolsStr ? 'yes' : 'no'})...`);
    try {
        const cacheConfig = {
            contents: [{ role: 'user', parts: [{ text: kbText }] }],
            systemInstruction: 'Это внутренняя база знаний компании KORDA. Используй эту информацию как приоритетный источник при ответах.',
            ttl: `${KB_CACHE_TTL_MINUTES * 60}s`,
        };
        if (tools && tools.length > 0) {
            cacheConfig.tools = tools;
        }

        const cacheResult = await ai.caches.create({
            model,
            config: cacheConfig,
        });
        const cacheName = cacheResult.name;
        const expiresAt = Date.now() + KB_CACHE_TTL_MINUTES * 60 * 1000;
        kbCacheMap.set(hash, { cacheName, expiresAt });
        console.log(`[Cache CREATED] ${cacheName} (TTL: ${KB_CACHE_TTL_MINUTES}m)`);
        return cacheName;
    } catch (err) {
        console.error('[Cache ERROR] Failed to create KB cache:', err.message);
        return null; // Fallback: no caching, will send inline
    }
}

export default async function handler(req, res) {
    // CORS Support
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- Gemini Initialization ---
    // Prefer the direct Gemini API key. Keep Vertex as a fallback for installations
    // that have no key but do have Google Cloud billing and IAM configured.
    const project = process.env.GOOGLE_CLOUD_PROJECT || 'korda-syntax';
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
    const chatApiKeys = getChatApiKeys();
    const startKeyIndex = chatApiKeys.length ? chatKeyCursor++ % chatApiKeys.length : 0;
    const orderedChatKeys = chatApiKeys.length
        ? [...chatApiKeys.slice(startKeyIndex), ...chatApiKeys.slice(0, startKeyIndex)]
        : [];
    const geminiApiKey = orderedChatKeys[0] || null;

    const { GoogleGenAI } = await import("@google/genai");
    const ai = geminiApiKey
        ? new GoogleGenAI({ apiKey: geminiApiKey })
        : new GoogleGenAI({
            vertexai: true,
            project,
            location,
            googleAuthOptions: {
                credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}'),
                scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            },
        });
    const aiClients = orderedChatKeys.length
        ? orderedChatKeys.map(apiKey => new GoogleGenAI({ apiKey }))
        : [ai];
    const { action, payload } = req.body;

    // Initialize Firebase Admin (each Vercel serverless function is isolated)
    await initFirebase();
    let db;
    try {
        const { getFirestore } = await import('firebase-admin/firestore');
        db = getFirestore();
    } catch (e) {
        console.error("Firestore not ready in proxy:", e);
        return res.status(503).json({ error: "Database not initialized" });
    }

    try {
        let result;

        if (action === 'generateContent') {
            // Sync (Legacy/Direct) — with concurrency limit + retry
            const { model, contents, config, knowledgeBaseText } = payload;
            console.log(`[Proxy] Sync generateContent (active: ${activeAiCalls}/${MAX_CONCURRENT_AI}, queued: ${aiQueue.length})`);

            // --- KB CACHING: cache knowledge base if provided and large enough ---
            let cachedContentName = null;
            if (knowledgeBaseText && knowledgeBaseText.length >= KB_MIN_CHARS) {
                cachedContentName = await getOrCreateKBCache(ai, model, knowledgeBaseText, config.tools);
            }

            const genConfig = { ...config };
            let genContents = Array.isArray(contents) ? contents : (contents ? [contents] : []);

            if (cachedContentName) {
                genConfig.cachedContent = cachedContentName;
                console.log(`[Proxy] Using cached KB: ${cachedContentName}`);

                // Vertex AI API: cannot set systemInstruction, tools, or toolConfig with cachedContent
                // Move systemInstruction into contents as first message preamble
                if (genConfig.systemInstruction) {
                    genContents = [
                        { role: 'user', parts: [{ text: `[СИСТЕМНАЯ ИНСТРУКЦИЯ]\n${genConfig.systemInstruction}\n[КОНЕЦ СИСТЕМНОЙ ИНСТРУКЦИИ]` }] },
                        { role: 'model', parts: [{ text: 'Понял, следую инструкции.' }] },
                        ...contents
                    ];
                    delete genConfig.systemInstruction;
                }
                delete genConfig.tools;
                delete genConfig.toolConfig;
            } else if (knowledgeBaseText) {
                // Fallback: inject KB into systemInstruction if caching failed or KB too small
                genConfig.systemInstruction = (genConfig.systemInstruction || '') +
                    '\n\n--- ВНУТРЕННЯЯ БАЗА ЗНАНИЙ KORDA (ПРИОРИТЕТ 1) ---\n' +
                    'Сначала ищите ответ ЗДЕСЬ. Если ответ найден в базе, используйте его. Если нет — переходите к внешнему поиску (если доступен).\n' +
                    knowledgeBaseText +
                    '\n--- КОНЕЦ БАЗЫ ЗНАНИЙ ---\n';
            }

            let fullTextContent = "";
            let isMaxTokens = false;
            let loops = 0;
            const MAX_SYNC_CONT_LOOPS = 4;
            let currentGenContents = [...genContents];
            
            let finalCandidates = null;
            let finalUsageMetadata = null;

            do {
                const response = await runWithAiLimit(() =>
                    generateWithKeyPool(aiClients, model, currentGenContents, genConfig)
                );

                let textContent = "";
                const functionCalls = typeof response.functionCalls === 'function' ? response.functionCalls() : response.functionCalls;

                if (functionCalls && functionCalls.length > 0) {
                    console.log("[Proxy] Native Function Calls detected:", functionCalls.length);
                }

                try {
                    textContent = typeof response.text === 'function' ? response.text() : (response.text || "");
                } catch (e) {
                    console.warn("[Proxy] response.text() failed, likely function call only:", e.message);
                    const candidate = response.candidates?.[0];
                    if (candidate?.content?.parts) {
                        textContent = candidate.content.parts.filter(p => p.text).map(p => p.text).join('');
                    }
                }
                
                fullTextContent += textContent;
                finalCandidates = response.candidates;
                finalUsageMetadata = response.usageMetadata || null;

                const candidate = response.candidates?.[0];
                const finishReason = candidate?.finishReason;
                isMaxTokens = (finishReason === 'MAX_TOKENS');
                
                // Don't loop if there are function calls, as it messes up the tool execution flow
                if (isMaxTokens && loops < MAX_SYNC_CONT_LOOPS && (!functionCalls || functionCalls.length === 0)) {
                    console.log(`[Proxy] Sync generateContent hit MAX_TOKENS, starting chunk ${loops + 2}...`);
                    currentGenContents.push({ role: 'model', parts: [{ text: textContent || ' ' }] });
                    currentGenContents.push({ role: 'user', parts: [{ text: 'Твой предыдущий ответ автоматически оборвался из-за лимита токенов. Продолжи строго с того места (или оборванного слова), где ты остановился.' }] });
                    loops++;
                } else {
                    isMaxTokens = false;
                }
            } while (isMaxTokens);

            // Reconstruct final text in candidate if present (some clients read from candidates directly)
            if (finalCandidates && finalCandidates[0] && finalCandidates[0].content && finalCandidates[0].content.parts) {
                const textPart = finalCandidates[0].content.parts.find(p => p.text !== undefined);
                if (textPart) {
                    textPart.text = fullTextContent;
                }
            }

            result = { text: fullTextContent, candidates: finalCandidates, usageMetadata: finalUsageMetadata };

        } else if (action === 'generateContentAsync') {
            // ASYNC PATTERN: Start -> Return ID -> Background Process works
            const { model, contents, config, knowledgeBaseText } = payload;
            const jobId = crypto.randomUUID();

            console.log(`[Proxy] Starting Async Job ${jobId} (LeadGen)...`);

            // --- KB CACHING: cache knowledge base if provided and large enough ---
            let cachedContentName = null;
            if (knowledgeBaseText && knowledgeBaseText.length >= KB_MIN_CHARS) {
                cachedContentName = await getOrCreateKBCache(ai, model, knowledgeBaseText, config.tools);
            }

            const genConfig = { ...config };
            let genContents = Array.isArray(contents) ? contents : (contents ? [contents] : []);

            if (cachedContentName) {
                genConfig.cachedContent = cachedContentName;
                console.log(`[Proxy-Async] Using cached KB: ${cachedContentName}`);

                if (genConfig.systemInstruction) {
                    genContents = [
                        { role: 'user', parts: [{ text: `[СИСТЕМНАЯ ИНСТРУКЦИЯ]\n${genConfig.systemInstruction}\n[КОНЕЦ СИСТЕМНОЙ ИНСТРУКЦИИ]` }] },
                        { role: 'model', parts: [{ text: 'Понял, следую инструкции.' }] },
                        ...contents
                    ];
                    delete genConfig.systemInstruction;
                }
                delete genConfig.tools;
                delete genConfig.toolConfig;
            } else if (knowledgeBaseText) {
                genConfig.systemInstruction = (genConfig.systemInstruction || '') +
                    '\n\n--- ВНУТРЕННЯЯ БАЗА ЗНАНИЙ KORDA (ПРИОРИТЕТ 1) ---\n' +
                    'Сначала ищите ответ ЗДЕСЬ. Если ответ найден в базе, используйте его.\n' +
                    knowledgeBaseText +
                    '\n--- КОНЕЦ БАЗЫ ЗНАНИЙ ---\n';
            }

            // 1. Create Initial Job Record in DB
            try {
                console.log(`[Proxy] Writing Job ${jobId} to Firestore...`);
                await db.collection(JOBS_COLLECTION).doc(jobId).set({
                    status: 'processing',
                    startTime: Date.now(),
                    type: 'lead_gen'
                });
                console.log(`[Proxy] Job ${jobId} saved to DB.`);
            } catch (dbErr) {
                console.error(`[Proxy] DB Write Failed for ${jobId}:`, dbErr);
                throw new Error("Failed to initialize job state");
            }

            // 2. Background execution (Fire & Forget)
            // DELAYED START: Wait 1s to ensure response flushes and no race conditions with process exit
            setTimeout(() => {
                (async () => {
                    try {
                        console.log(`[Proxy-Worker] Job ${jobId} starting model call...`);
                        
                        let fullTextContent = "";
                        let currentContents = [...genContents];
                        let totalTokensUsed = 0;
                        
                        let telemetryLogs = [];
                        const logTelemetry = async (msg) => {
                            console.log(`[Telemetry] ${msg}`);
                            telemetryLogs.push(msg);
                            await db.collection(JOBS_COLLECTION).doc(jobId).set({ telemetryLogs }, { merge: true });
                        };

                        await db.collection(JOBS_COLLECTION).doc(jobId).set({ currentPhase: 'dispatcher', telemetryLogs }, { merge: true });

                        const hasTools = genConfig.tools && genConfig.tools.length > 0;
                        let isConveyor = false;

                        if (hasTools) {
                            const activeTools = [];
                            for (const toolGroup of genConfig.tools || []) {
                                for (const f of toolGroup.functionDeclarations || []) {
                                    activeTools.push(f);
                                }
                            }
                            
                            const conveyorTools = ["extract_positions", "lookup_standard", "select_materials", "resolve_parameters", "calculate_cost", "calculate_commercial"];
                            isConveyor = activeTools.some(t => conveyorTools.includes(t.name));
                            
                            if (isConveyor) {
                                await logTelemetry(`[PIPELINE] Запуск строгого конвейера агентов...`);
                                const pipelineSequence = ["extract_positions", "lookup_standard", "select_materials", "resolve_parameters", "calculate_cost", "calculate_commercial"];
                                const originalUserText = currentContents.filter(c => c.role === 'user').pop()?.parts?.find(p => p.text)?.text || '';
                                let masterJson = [];

                                // Загрузка правил конвейера из Firestore для resolve_parameters
                                let conveyorRules = [];
                                let ruleCategories = [];
                                try {
                                    const rulesSnapshot = await db.collection('conveyor_rules').get();
                                    conveyorRules = rulesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                                    const ruleCategoriesSnapshot = await db.collection('conveyor_rule_categories').get();
                                    ruleCategories = ruleCategoriesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                                    await logTelemetry(`[PIPELINE] Загружено ${conveyorRules.length} правил и ${ruleCategories.length} категорий из Firestore`);
                                } catch (rulesErr) {
                                    console.error('[PIPELINE] Не удалось загрузить правила из Firestore:', rulesErr.message);
                                    await logTelemetry(`[PIPELINE] ⚠ Правила не загружены, будут использованы значения по умолчанию`);
                                }
                                
                                const alwaysRunAgents = ['extract_positions', 'lookup_standard', 'resolve_parameters', 'calculate_cost', 'calculate_commercial'];

                                for (const stepName of pipelineSequence) {

                                    const targetToolName = stepName;
                                    const toolDef = activeTools.find(t => t.name === targetToolName);
                                    const isAlwaysRun = alwaysRunAgents.includes(targetToolName);
                                    
                                    // Для resolve_parameters и детерминированных агентов toolDef может отсутствовать в activeTools — это нормально
                                    if (!toolDef && !isAlwaysRun) continue;
                                    
                                    await logTelemetry(`[PIPELINE] Сбор данных для агента '${targetToolName}'...`);
                                    
                                    let wantsToRun = false;
                                    let funcCall = null;
                                    const extractStartTime = Date.now();

                                    if (isAlwaysRun) {
                                        // Детерминированные и серверные агенты всегда запускаются — пропускаем Gemini Flash
                                        wantsToRun = true;
                                        await logTelemetry(`[PIPELINE] Агент '${targetToolName}' — прямой запуск (без Flash-extraction)`);
                                    } else {
                                        // AI-агенты (extract_positions, select_materials) — используем Gemini Flash для extraction
                                        const extractConfig = {
                                            maxOutputTokens: 256,
                                            temperature: 0.1,
                                            tools: [{ functionDeclarations: [toolDef] }],
                                            systemInstruction: `Твоя единственная задача - проверить, есть ли в последних сообщениях пользователя данные для вызова функции '${toolDef.name}'.
Если данные ЕСТЬ — ОБЯЗАТЕЛЬНО вызови функцию с этими данными.
Если данных НЕТ или они уже были обработаны — ответь текстом "SKIP".`
                                        };
                                        
                                        const extractRes = await runWithAiLimit(() => 
                                            withRetry(() => ai.models.generateContent({ model: 'gemini-3.5-flash', contents: currentContents, config: extractConfig }, { timeout: 30000 }))
                                        );
                                        
                                        const extractCandidate = extractRes.candidates?.[0];
                                        funcCall = extractCandidate?.content?.parts?.find(p => p.functionCall);
                                        
                                        // If model tried to call but failed (because of large text), or if it successfully called it
                                        wantsToRun = funcCall || extractCandidate?.finishReason === 'MALFORMED_FUNCTION_CALL' || (extractCandidate?.content?.parts?.[0]?.text && !extractCandidate.content.parts[0].text.includes('SKIP'));
                                    }
                                    
                                    if (wantsToRun) {
                                        const toolName = targetToolName;
                                        // Use the original user text for all agents instead of latest (which could be another agent's output)
                                        const userText = originalUserText;
                                        
                                        const toolArgs = funcCall ? funcCall.functionCall.args : { raw_specification: userText };
                                        
                                        // Ensure raw_specification is present if not already
                                        if (!toolArgs.raw_specification && userText) {
                                            toolArgs.raw_specification = userText;
                                        }
                                        // Pass the accumulated JSON to the tool!
                                        toolArgs.masterJson = masterJson;
                                        // Передаём правила конвейера для resolve_parameters
                                        toolArgs.conveyorRules = conveyorRules;
                                        toolArgs.ruleCategories = ruleCategories;

                                        // Rebuild funcCall safely
                                        funcCall = { functionCall: { name: toolName, args: toolArgs } };

                                        await logTelemetry(`[PIPELINE] Агент '${toolName}' начал работу с данными пользователя`);
                                        await db.collection(JOBS_COLLECTION).doc(jobId).set({ currentPhase: `worker_${toolName}` }, { merge: true });
                                        
                                        const workerStartTime = Date.now();
                                        // --- BATCHING LOGIC ---
                                        const BATCH_SIZE = 20;
                                        let batchResults = [];

                                        if (toolName === 'extract_positions' && userText.length > 3000) {
                                            // Split spec text into batches of ~20 items by detecting numbered lines
                                            const lines = userText.split('\n');
                                            const batches = [];
                                            let currentBatch = [];
                                            let itemCount = 0;

                                            for (const line of lines) {
                                                currentBatch.push(line);
                                                // Detect a new item line (starts with number followed by separator)
                                                if (/^\s*\d+[\s\t.,;)\-]/.test(line)) {
                                                    itemCount++;
                                                    if (itemCount >= BATCH_SIZE) {
                                                        batches.push(currentBatch.join('\n'));
                                                        currentBatch = [];
                                                        itemCount = 0;
                                                    }
                                                }
                                            }
                                            if (currentBatch.length > 0) batches.push(currentBatch.join('\n'));

                                            if (batches.length > 1) {
                                                await logTelemetry(`[PIPELINE] Батчинг '${toolName}': ${batches.length} батчей по ~${BATCH_SIZE} позиций`);
                                                let globalIdOffset = 0;
                                                for (let bi = 0; bi < batches.length; bi++) {
                                                    const batchArgs = { ...toolArgs, raw_specification: batches[bi], masterJson: [] };
                                                    await logTelemetry(`[PIPELINE] Батч ${bi + 1}/${batches.length} '${toolName}'...`);
                                                    const batchResult = await executeAgentTool(toolName, batchArgs, ai, model);
                                                    if (batchResult.data && Array.isArray(batchResult.data)) {
                                                        // Re-number IDs to be globally unique
                                                        batchResult.data.forEach((item, i) => {
                                                            item.id = globalIdOffset + (item.id || i + 1);
                                                        });
                                                        batchResults = batchResults.concat(batchResult.data);
                                                        globalIdOffset = batchResults.length;
                                                    }
                                                }
                                            }
                                        } else if (['select_materials', 'resolve_parameters'].includes(toolName) && masterJson.length > BATCH_SIZE) {
                                            // Split masterJson into batches
                                            await logTelemetry(`[PIPELINE] Батчинг '${toolName}': ${Math.ceil(masterJson.length / BATCH_SIZE)} батчей`);
                                            for (let bi = 0; bi < masterJson.length; bi += BATCH_SIZE) {
                                                const chunk = masterJson.slice(bi, bi + BATCH_SIZE);
                                                const batchArgs = { ...toolArgs, masterJson: chunk };
                                                await logTelemetry(`[PIPELINE] Батч ${Math.floor(bi / BATCH_SIZE) + 1}/${Math.ceil(masterJson.length / BATCH_SIZE)} '${toolName}'...`);
                                                const batchResult = await executeAgentTool(toolName, batchArgs, ai, model);
                                                if (batchResult.data && Array.isArray(batchResult.data)) {
                                                    batchResults = batchResults.concat(batchResult.data);
                                                }
                                            }
                                        }

                                        // If batching happened, use batchResults; otherwise do single call
                                        let toolResult;
                                        if (batchResults.length > 0) {
                                            toolResult = { result: `Обработано ${batchResults.length} позиций (батчами по ${BATCH_SIZE})`, data: batchResults };
                                        } else {
                                            toolResult = await executeAgentTool(toolName, toolArgs, ai, model);
                                        }
                                        const workerLatency = ((Date.now() - workerStartTime) / 1000).toFixed(1);
                                        
                                        // Merge data into masterJson
                                        if (toolResult.data && Array.isArray(toolResult.data)) {
                                            // GUARD: After extract_positions (when masterJson already exists),
                                            // only accept items whose IDs match existing masterJson entries.
                                            // This prevents AI hallucinating extra items during batching.
                                            let dataToMerge = toolResult.data;
                                            if (masterJson.length > 0) {
                                                const existingIds = new Set(masterJson.map(i => String(i.id)));
                                                const filtered = dataToMerge.filter(item => existingIds.has(String(item.id)));
                                                if (filtered.length < dataToMerge.length) {
                                                    console.log(`[PIPELINE] Фильтрация: отброшено ${dataToMerge.length - filtered.length} фантомных позиций от '${toolName}'`);
                                                }
                                                dataToMerge = filtered;
                                            }

                                            if (masterJson.length === 0) {
                                                masterJson = JSON.parse(JSON.stringify(dataToMerge));
                                            } else {
                                                dataToMerge.forEach(item => {
                                                    const existing = masterJson.find(i => String(i.id) === String(item.id));
                                                    if (existing) {
                                                        // Deep merge for nested objects like materials, geometry, cost
                                                        for (const [key, value] of Object.entries(item)) {
                                                            if (value && typeof value === 'object' && !Array.isArray(value) && existing[key] && typeof existing[key] === 'object') {
                                                                Object.assign(existing[key], value);
                                                            } else {
                                                                existing[key] = value;
                                                            }
                                                        }
                                                    }
                                                    // NOTE: Do NOT push unknown items — they are AI hallucinations
                                                });
                                            }
                                            // Diagnostic: log merge stats
                                            const withName = masterJson.filter(i => i.tu_name).length;
                                            const withEqType = masterJson.filter(i => i.equipment_type).length;
                                            const withMats = masterJson.filter(i => i.materials).length;
                                            const withGeom = masterJson.filter(i => i.geometry).length;
                                            const withCost = masterJson.filter(i => i.cost).length;
                                            await logTelemetry(`[PIPELINE] masterJson после '${toolName}': ${masterJson.length} позиций (tu_name: ${withName}, eq_type: ${withEqType}, materials: ${withMats}, geometry: ${withGeom}, cost: ${withCost})`);
                                        }


                                        let resultSnippet = JSON.stringify(toolResult);
                                        if (resultSnippet.length > 200) resultSnippet = resultSnippet.substring(0, 197) + '...';
                                        await logTelemetry(`[PIPELINE] Ответ '${toolName}': ${resultSnippet} (${workerLatency}s)`);
                                        
                                        // Push as plain text to avoid SDK strict validation errors on missing 'thought_signature' in synthetic function calls
                                        currentContents.push({ role: 'model', parts: [{ text: `[SYSTEM] Вызвана функция агента: ${toolName}` }] });
                                        currentContents.push({ role: 'user', parts: [{ text: `[SYSTEM] Результат работы агента ${toolName}:\n${JSON.stringify(toolResult)}` }] });
                                    } else {
                                        const extractLatency = ((Date.now() - extractStartTime) / 1000).toFixed(1);
                                        await logTelemetry(`[PIPELINE] Агент '${targetToolName}' пропущен (нет новых данных) (${extractLatency}s)`);
                                    }
                                }
                                
                                // Clean undefined values before Firestore save (Firestore rejects undefined)
                                function cleanUndefined(obj) {
                                    if (Array.isArray(obj)) return obj.map(cleanUndefined);
                                    if (obj && typeof obj === 'object') {
                                        const clean = {};
                                        for (const [k, v] of Object.entries(obj)) {
                                            if (v !== undefined) clean[k] = cleanUndefined(v);
                                        }
                                        return clean;
                                    }
                                    return obj;
                                }
                                // Save final masterJson to response
                                await db.collection(JOBS_COLLECTION).doc(jobId).set({ masterJson: cleanUndefined(masterJson) }, { merge: true });
                                await logTelemetry(`[PIPELINE] Макро-этап завершен. Передача данных Синтезатору...`);
                            } else {
                                // Fallback: Old Parallel Router for non-conveyor tasks
                                await logTelemetry(`[ROUTER] Анализ запроса...`);
                                let dispatcherLoop = 0;
                                const MAX_DISPATCHER_LOOPS = 5;
                                
                                let dispatcherConfig = { ...genConfig };
                                dispatcherConfig.maxOutputTokens = 512;
                                dispatcherConfig.temperature = 0.1;
                                
                                dispatcherConfig.systemInstruction = `ТЫ — МАРШРУТИЗАТОР (ROUTER) АГЕНТНОЙ СИСТЕМЫ. Твоя ЕДИНСТВЕННАЯ задача — анализировать запрос пользователя и ВЫЗЫВАТЬ ИНСТРУМЕНТЫ (function calls).
КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ отвечать пользователю текстом, давать советы или производить вычисления самостоятельно.
Если для ответа требуются данные из базы знаний — вызывай соответствующие инструменты.
Если никакие инструменты точно не применимы, ответь ровно одним словом: "SKIP".`;

                                while (dispatcherLoop < MAX_DISPATCHER_LOOPS) {
                                    const startTime = Date.now();
                                    const response = await runWithAiLimit(() =>
                                        withRetry(() => ai.models.generateContent({
                                            model: 'gemini-3.5-flash',
                                            contents: currentContents,
                                            config: dispatcherConfig
                                        }, { timeout: 60000 }))
                                    );
                                    if (response.usageMetadata?.totalTokenCount) {
                                        totalTokensUsed += response.usageMetadata.totalTokenCount;
                                    }
                                    const latency = ((Date.now() - startTime) / 1000).toFixed(1);

                                    const candidate = response.candidates?.[0];
                                    const functionCallParts = candidate?.content?.parts?.filter(p => p.functionCall) || [];

                                    if (functionCallParts.length > 0) {
                                        const functionResponses = [];

                                        for (const part of functionCallParts) {
                                            const toolName = part.functionCall.name;
                                            const toolArgs = part.functionCall.args;
                                            
                                            await logTelemetry(`[WORKER] Обращение к агенту '${toolName}' с аргументами: ${JSON.stringify(toolArgs)}`);
                                            await db.collection(JOBS_COLLECTION).doc(jobId).set({ currentPhase: `worker_${toolName}` }, { merge: true });
                                            
                                            const workerStartTime = Date.now();
                                            const toolResult = await executeAgentTool(toolName, toolArgs, ai);
                                            const workerLatency = ((Date.now() - workerStartTime) / 1000).toFixed(1);

                                            let resultSnippet = JSON.stringify(toolResult);
                                            if (resultSnippet.length > 200) resultSnippet = resultSnippet.substring(0, 197) + '...';
                                            await logTelemetry(`[WORKER] Ответ от '${toolName}': ${resultSnippet} (${workerLatency}s)`);

                                            functionResponses.push({
                                                functionResponse: { name: toolName, response: toolResult }
                                            });
                                        }

                                        const validModelParts = candidate.content.parts.filter(p => p.functionCall || (p.text && p.text.trim().length > 0));
                                        currentContents.push({ role: 'model', parts: validModelParts });
                                        currentContents.push({
                                            role: 'user', 
                                            parts: functionResponses
                                        });

                                        dispatcherLoop++;
                                    } else {
                                        await logTelemetry(`[ROUTER] Анализ завершен (${latency}s)`);
                                        break;
                                    }
                                }
                            }
                        }

                        // SYNTHESIZER PHASE
                        await logTelemetry(`[SYNTHESIZER] Генерация итогового ответа (Pro-модель)...`);
                        await db.collection(JOBS_COLLECTION).doc(jobId).set({ currentPhase: 'synthesizer' }, { merge: true });

                        let synthesizerConfig = { ...genConfig };
                        const hasFunctionTools = genConfig.tools && genConfig.tools.some(t => t.functionDeclarations);
                        if (hasFunctionTools) {
                            delete synthesizerConfig.tools; // Ensure Pro model doesn't try to call local tools again
                            delete synthesizerConfig.toolConfig;
                        }

                        let isMaxTokens = false;
                        let loops = 0;
                        const MAX_CONT_LOOPS = 25; 
                        let groundingMetadata = null;
                        
                        if (isConveyor) {
                            const isCommercialStage = (synthesizerConfig.systemInstruction || '').includes('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ');
                            let additionalInstruction = '\n\nВНИМАНИЕ: Ты работаешь в режиме КОНВЕЙЕРА. Агенты уже собрали для тебя Номенклатурные наименования (по ТУ) и подобрали Материалы.\nТвоя задача — объединить все эти данные в ЕДИНЫЙ итоговый ответ.\nОБЯЗАТЕЛЬНО выведи сгенерированные агентом официальные наименования ТУ для каждой позиции в самом начале или вместе с расчетом, не жди дополнительного вопроса от пользователя!';
                            
                            // Only force line-by-line strict rendering for the drafting (calculation) stage.
                            if (!isCommercialStage) {
                                additionalInstruction += '\n\nСТРОГОЕ ПРАВИЛО: КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ группировать, сжимать или сокращать позиции! Ты должен расписать расчет и ответ ДЛЯ КАЖДОЙ СТРОКИ спецификации ИНДИВИДУАЛЬНО, от первой до последней, даже если их 100 штук. Выводи данные построчно. Не волнуйся о длине ответа — система автоматически склеит твои сообщения при превышении лимита токенов.';
                            }
                            
                            synthesizerConfig.systemInstruction = (synthesizerConfig.systemInstruction || '') + additionalInstruction;
                        }
                        synthesizerConfig.maxOutputTokens = 8192;
                        // Add fallback for Vertex AI if SDK requires generationConfig
                        synthesizerConfig.generationConfig = { maxOutputTokens: 8192, temperature: synthesizerConfig.temperature || 0.3 };
                        
                        do {
                            const synthStartTime = Date.now();
                            const response = await runWithAiLimit(() =>
                                withRetry(() => ai.models.generateContent({
                                    model, // The original requested model (e.g. gemini-3.1-pro-preview)
                                    contents: currentContents,
                                    config: synthesizerConfig
                                }, { timeout: 600000 }))
                            );
                            if (response.usageMetadata?.totalTokenCount) {
                                totalTokensUsed += response.usageMetadata.totalTokenCount;
                            }
                            const synthLatency = ((Date.now() - synthStartTime) / 1000).toFixed(1);

                            let textContent = "";
                            try {
                                if (typeof response.text === 'function') {
                                    textContent = response.text();
                                } else if (response.text) {
                                    textContent = response.text;
                                } else if (response.candidates?.[0]?.content?.parts) {
                                    textContent = response.candidates[0].content.parts.filter(p => p.text).map(p => p.text).join('');
                                }
                            } catch (e) {
                                console.warn("[Proxy-Worker] Synthesizer text extraction failed:", e.message);
                            }
                            
                            fullTextContent += textContent;
                            const candidate = response.candidates?.[0];
                            const finishReason = candidate?.finishReason;
                            if (candidate?.groundingMetadata) {
                                groundingMetadata = candidate.groundingMetadata;
                            }
                            
                            isMaxTokens = (finishReason === 'MAX_TOKENS');
                            console.log(`[SYNTHESIZER] Chunk completed. FinishReason: ${finishReason}, TextLength: ${textContent.length}, isMaxTokens: ${isMaxTokens}, LastChars: ${textContent.substring(textContent.length - 30)}`);
                            if (isMaxTokens && loops < MAX_CONT_LOOPS) {
                                await logTelemetry(`[SYNTHESIZER] Продолжение генерации (Chunk ${loops+2})...`);
                                currentContents.push({ role: 'model', parts: [{ text: textContent || ' ' }] });
                                currentContents.push({ role: 'user', parts: [{ text: 'Твой предыдущий ответ автоматически оборвался из-за лимита токенов. Продолжи строго с того места (или оборванного слова), где ты остановился.' }] });
                                loops++;
                            } else {
                                await logTelemetry(`[SYNTHESIZER] Ответ готов (${synthLatency}s)`);
                                isMaxTokens = false;
                            }
                        } while (isMaxTokens);

                        // Update DB with Success
                        await db.collection(JOBS_COLLECTION).doc(jobId).set({
                            status: 'completed',
                            result: { text: fullTextContent, groundingMetadata, tokensUsed: totalTokensUsed },
                            completedAt: Date.now()
                        }, { merge: true });

                        console.log(`[Proxy-Worker] Async Job ${jobId} Completed & Saved.`);
                    } catch (err) {
                        console.error(`[Proxy-Worker] Async Job ${jobId} Failed:`, err);
                        // Update DB with Error
                        await db.collection(JOBS_COLLECTION).doc(jobId).set({
                            status: 'failed',
                            error: err.message,
                            failedAt: Date.now()
                        }, { merge: true });
                    }
                })();
            }, 2000); // 2 second delay to isolate crash

            result = { jobId, status: 'processing' };

        } else if (action === 'getContentStatus') {
            // POLLING ENDPOINT
            const { jobId } = payload;
            const docRef = db.collection(JOBS_COLLECTION).doc(jobId);
            const doc = await docRef.get();

            if (!doc.exists) {
                // If job not found in DB, it might be truly invalid
                throw new Error("Job not found (expired or invalid ID)");
            }

            const job = doc.data();
            console.log(`[Proxy] Checking Status for Job ${jobId}: ${job.status}`);

            if (job.status === 'processing') {
                result = { done: false, status: 'processing', activeTools: job.activeTools || [], completedTools: job.completedTools || [], telemetryLogs: job.telemetryLogs || [], currentPhase: job.currentPhase || '' };
            } else if (job.status === 'completed') {
                result = { done: true, status: 'completed', activeTools: job.activeTools || [], completedTools: job.completedTools || [], telemetryLogs: job.telemetryLogs || [], currentPhase: job.currentPhase || '', masterJson: job.masterJson || [], ...job.result };
                // Cleanup? Maybe later via Cron.
            } else if (job.status === 'failed') {
                throw new Error(`Async Job Failed: ${job.error}`);
            }

        } else if (action === 'generateImages') {
            const { model, contents, config } = payload;

            const mediaKeys = getMediaApiKeys();
            if (mediaKeys.length === 0 && !process.env.FIREBASE_SERVICE_ACCOUNT) {
                return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel environment variables." });
            }

            const { GoogleGenAI: GoogleGenAIImage } = await import("@google/genai");
            let response;
            let lastMediaError;
            try {
                response = await runWithAiLimit(() => generateVertexImage(model, contents, config));
                console.log(`[Proxy] Image generated via Vertex project ${process.env.GOOGLE_CLOUD_PROJECT || 'korda-syntax'}`);
            } catch (error) {
                lastMediaError = error;
                console.warn(`[Proxy] Vertex image unavailable (${error?.response?.status || error?.status || 'error'}); trying API keys`);
            }
            for (let index = 0; !response && index < mediaKeys.length; index++) {
                try {
                    const aiImage = new GoogleGenAIImage({ apiKey: mediaKeys[index] });
                    response = await runWithAiLimit(() => aiImage.models.generateContent({
                        model,
                        contents,
                        config
                    }, { timeout: 90000 }));
                    break;
                } catch (error) {
                    lastMediaError = error;
                    if (!canRotateMediaKey(error) || index === mediaKeys.length - 1) throw error;
                    console.warn(`[Proxy] Media key ${index + 1} unavailable (${error?.status || 'error'}); rotating key`);
                }
            }
            if (!response) throw lastMediaError || new Error('Image generation failed');
            // Extract inline data from candidates
            const parts = response.candidates?.[0]?.content?.parts || [];
            const inlineData = parts.find(p => p.inlineData);
            result = {
                image: inlineData ? `data:image/png;base64,${inlineData.inlineData.data}` : null
            };

        } else if (action === 'generateVideos') {
            const { model, prompt, image, config } = payload;

            const mediaKeys = getMediaApiKeys();
            if (mediaKeys.length === 0) {
                return res.status(500).json({ error: "GEMINI_API_KEY is missing in Vercel environment variables." });
            }

            let aiVideo;
            let operation;
            let lastMediaError;
            for (let index = 0; index < mediaKeys.length; index++) {
                try {
                    aiVideo = new GoogleGenAI({ apiKey: mediaKeys[index] });
                    operation = await aiVideo.models.generateVideos({ model, prompt, image, config });
                    break;
                } catch (error) {
                    lastMediaError = error;
                    if (!canRotateMediaKey(error) || index === mediaKeys.length - 1) throw error;
                    console.warn(`[Proxy] Video key ${index + 1} unavailable (${error?.status || 'error'}); rotating key`);
                }
            }
            if (!operation || !aiVideo) throw lastMediaError || new Error('Video generation failed');

            console.log(`[Video] Operation started: ${operation.name}`);

            // Create async job in Firestore
            const { getFirestore } = await import('firebase-admin/firestore');
            const db = getFirestore();
            const jobId = `video_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
            await db.collection(JOBS_COLLECTION).doc(jobId).set({
                status: 'processing',
                createdAt: new Date().toISOString(),
                operationName: operation.name,
            });

            // Server-side background polling using SDK
            (async () => {
                try {
                    const MAX_POLLS = 60; // 10 min max (10s intervals)
                    for (let i = 0; i < MAX_POLLS; i++) {
                        await new Promise(r => setTimeout(r, 10000)); // Wait 10s
                        operation = await aiVideo.operations.getVideosOperation({ operation });
                        console.log(`[Video] Poll ${i + 1}/${MAX_POLLS}, done: ${operation.done}`);

                        if (operation.done) break;
                    }

                    if (!operation.done) {
                        await db.collection(JOBS_COLLECTION).doc(jobId).update({
                            status: 'failed',
                            error: 'Video generation timed out (10 min)',
                        });
                        return;
                    }

                    // Extract video data from SDK response
                    const generatedVideos = operation.response?.generatedVideos;
                    if (!generatedVideos || generatedVideos.length === 0) {
                        await db.collection(JOBS_COLLECTION).doc(jobId).update({
                            status: 'failed',
                            error: 'No video generated in response',
                        });
                        return;
                    }

                    const generatedVideo = generatedVideos[0];
                    const video = generatedVideo.video;
                    let videoData = null;

                    const isMp4 = (buffer) =>
                        Buffer.isBuffer(buffer) &&
                        buffer.length > 12 &&
                        buffer.subarray(4, 8).toString('ascii') === 'ftyp';
                    const toVideoData = (buffer, label) => {
                        if (!isMp4(buffer)) {
                            console.warn(`[Video] ${label} did not return a valid MP4`);
                            return null;
                        }
                        console.log(`[Video] ${label} (${buffer.length} bytes)`);
                        return `data:video/mp4;base64,${buffer.toString('base64')}`;
                    };

                    // Prefer inline bytes. They are already the actual MP4
                    // payload when the API provides them.
                    const inlineBytes = video?.videoBytes || video?.data;
                    if (inlineBytes) {
                        videoData = toVideoData(Buffer.from(inlineBytes, 'base64'), 'Using inline MP4 data');
                    }

                    // Fallback to SDK download, but only accept a real MP4.
                    if (!videoData && (video?.uri || video?.videoBytes)) {
                        try {
                            const { tmpdir } = await import('os');
                            const { join } = await import('path');
                            const { readFile, unlink } = await import('fs/promises');
                            const downloadPath = join(tmpdir(), `korda-veo-${crypto.randomUUID()}.mp4`);
                            await aiVideo.files.download({ file: generatedVideo, downloadPath });
                            const buffer = await readFile(downloadPath);
                            await unlink(downloadPath).catch(() => {});
                            videoData = toVideoData(buffer, 'Downloaded via SDK');
                        } catch (downloadError) {
                            console.warn('[Video] SDK download failed:', downloadError?.message || downloadError);
                        }
                    }

                    // Gemini Developer API media URI fallback.
                    if (!videoData && video?.uri && aiVideo.files?.downloadMedia) {
                        try {
                            const bytes = await aiVideo.files.downloadMedia(video.uri);
                            if (bytes?.length > 0) {
                                videoData = toVideoData(Buffer.from(bytes), 'Downloaded via downloadMedia');
                            }
                        } catch (downloadMediaError) {
                            console.warn('[Video] downloadMedia failed:', downloadMediaError?.message || downloadMediaError);
                        }
                    }

                    // Last resort: log full video object for debugging
                    if (!videoData) {
                        console.log('[Video] Video object keys:', Object.keys(video || {}));
                        console.log('[Video] Full video object:', JSON.stringify(video, null, 2).slice(0, 500));
                    }

                    if (videoData) {
                        // Store in memory (too large for Firestore)
                        videoResultCache.set(jobId, { videoData, expiresAt: Date.now() + VIDEO_CACHE_TTL });
                        await db.collection(JOBS_COLLECTION).doc(jobId).update({ status: 'completed' });
                        console.log(`[Video] Job ${jobId} completed, stored in memory (${videoData.length} chars)`);
                        // Cleanup expired entries
                        for (const [k, v] of videoResultCache) {
                            if (v.expiresAt < Date.now()) videoResultCache.delete(k);
                        }
                    } else {
                        console.error('[Video] Full response (debug):', JSON.stringify(operation.response, null, 2));
                        await db.collection(JOBS_COLLECTION).doc(jobId).update({
                            status: 'failed',
                            error: 'Video generated but could not download',
                        });
                    }
                } catch (err) {
                    console.error(`[Video] Background polling error for ${jobId}:`, err);
                    await db.collection(JOBS_COLLECTION).doc(jobId).update({
                        status: 'failed',
                        error: err.message || 'Unknown polling error',
                    }).catch(() => {});
                }
            })();

            // Return job ID immediately (client polls via checkJobStatus)
            result = { operationName: jobId, done: false };

        } else if (action === 'getVideoStatus') {
            // Legacy: redirect to checkJobStatus for backward compat
            const { operationName } = payload;
            console.log(`[Video] Checking job status: ${operationName}`);

            const { getFirestore } = await import('firebase-admin/firestore');
            const db = getFirestore();
            const jobDoc = await db.collection(JOBS_COLLECTION).doc(operationName).get();

            if (!jobDoc.exists) {
                result = { done: false, status: 'processing' };
            } else {
                const job = jobDoc.data();
                if (job.status === 'completed') {
                    // Get video from memory cache
                    const cached = videoResultCache.get(operationName);
                    if (cached && cached.expiresAt > Date.now()) {
                        result = { done: true, videoData: cached.videoData };
                    } else {
                        throw new Error('Video data expired from server cache. Please regenerate.');
                    }
                } else if (job.status === 'failed') {
                    throw new Error(`Video Gen Failed: ${job.error}`);
                } else {
                    result = { done: false, status: 'processing' };
                }
            }
        } else if (action === 'uploadFile') {
            const { fileData, mimeType, displayName } = payload;

            // Vertex AI does NOT support ai.files.upload(). Use GCS bucket instead.
            // Upload file to Firebase Storage (GCS), then pass gs:// URI to Gemini.
            try {
                const { getStorage } = await import('firebase-admin/storage');
                const bucket = getStorage().bucket();
                const buffer = Buffer.from(fileData, 'base64');
                const ext = (mimeType.split('/')[1] || 'bin').replace('plain', 'txt');
                const gcsPath = `gemini-uploads/${crypto.randomUUID()}.${ext}`;
                const file = bucket.file(gcsPath);

                await file.save(buffer, {
                    metadata: {
                        contentType: mimeType,
                        metadata: { originalName: displayName }
                    }
                });

                const gsUri = `gs://${bucket.name}/${gcsPath}`;
                console.log(`[Proxy] File uploaded to GCS: ${gsUri} (${displayName}, ${buffer.length} bytes)`);

                result = {
                    fileUri: gsUri,
                    name: gcsPath,
                    mimeType: mimeType
                };
            } catch (err) {
                console.error("GCS Upload Failed:", err);
                throw new Error("Failed to upload file to GCS: " + err.message);
            }

        } else if (action === 'uploadConveyorFile') {
            // Upload a file to permanent conveyor storage: conveyor-files/{requestId}/{filename}
            const { requestId, fileData, mimeType, displayName } = payload;
            if (!requestId || !fileData) throw new Error('Missing requestId or fileData');

            try {
                const { getStorage } = await import('firebase-admin/storage');
                const bucket = getStorage().bucket();
                const buffer = Buffer.from(fileData, 'base64');
                // Sanitize filename: keep only safe chars
                const safeName = (displayName || 'file').replace(/[^a-zA-Z0-9а-яА-ЯёЁ._\-() ]/g, '_');
                const gcsPath = `conveyor-files/${requestId}/${safeName}`;
                const file = bucket.file(gcsPath);

                await file.save(buffer, {
                    metadata: {
                        contentType: mimeType,
                        metadata: { originalName: displayName }
                    }
                });

                const gsUri = `gs://${bucket.name}/${gcsPath}`;
                console.log(`[Proxy] Conveyor file uploaded: ${gsUri} (${displayName}, ${buffer.length} bytes)`);

                result = {
                    gsUri,
                    gcsPath,
                    name: displayName,
                    mimeType,
                    size: buffer.length
                };
            } catch (err) {
                console.error("Conveyor Upload Failed:", err);
                throw new Error("Failed to upload conveyor file: " + err.message);
            }

        } else if (action === 'deleteConveyorFile') {
            // Delete a file from conveyor storage
            const { gcsPath } = payload;
            if (!gcsPath || !gcsPath.startsWith('conveyor-files/')) throw new Error('Invalid gcsPath');

            try {
                const { getStorage } = await import('firebase-admin/storage');
                const bucket = getStorage().bucket();
                await bucket.file(gcsPath).delete();
                console.log(`[Proxy] Conveyor file deleted: ${gcsPath}`);
                result = { success: true };
            } catch (err) {
                console.error("Conveyor Delete Failed:", err);
                throw new Error("Failed to delete conveyor file: " + err.message);
            }

        } else if (action === 'listConveyorFiles') {
            // List all files for a request
            const { requestId } = payload;
            if (!requestId) throw new Error('Missing requestId');

            try {
                const { getStorage } = await import('firebase-admin/storage');
                const bucket = getStorage().bucket();
                const prefix = `conveyor-files/${requestId}/`;
                const [files] = await bucket.getFiles({ prefix });

                result = files.map(f => ({
                    name: f.name.replace(prefix, ''),
                    gcsPath: f.name,
                    gsUri: `gs://${bucket.name}/${f.name}`,
                    mimeType: f.metadata.contentType || 'application/octet-stream',
                    size: parseInt(f.metadata.size || '0', 10),
                    uploadedAt: new Date(f.metadata.timeCreated || 0).getTime()
                }));
            } catch (err) {
                console.error("Conveyor List Failed:", err);
                throw new Error("Failed to list conveyor files: " + err.message);
            }

        } else if (action === 'getConveyorFileUrl') {
            // Generate a signed URL for viewing/downloading a conveyor file
            const { gcsPath } = payload;
            if (!gcsPath || !gcsPath.startsWith('conveyor-files/')) throw new Error('Invalid gcsPath');

            try {
                const { getStorage } = await import('firebase-admin/storage');
                const bucket = getStorage().bucket();
                const file = bucket.file(gcsPath);
                
                const [signedUrl] = await file.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 60 * 60 * 1000, // 1 hour
                });
                
                console.log(`[Proxy] Signed URL generated for: ${gcsPath}`);
                result = { url: signedUrl };
            } catch (err) {
                console.error("Signed URL Failed:", err);
                throw new Error("Failed to get file URL: " + err.message);
            }

        } else {
            return res.status(400).json({ error: 'Unknown action' });
        }

        res.status(200).json(result);

    } catch (error) {
        console.error("Proxy Error:", error);
        const isQuotaError = error?.status === 429 || /RESOURCE_EXHAUSTED|quota exceeded/i.test(error?.message || '');
        if (isQuotaError && (action === 'generateImages' || action === 'generateVideos')) {
            const mediaName = action === 'generateImages' ? 'изображений' : 'видео';
            return res.status(429).json({
                error: `Google отклонил все подключённые ключи: квота генерации ${mediaName} для их проектов равна нулю. Подключите к проекту Google AI API биллинг и квоту для выбранной модели.`
            });
        }
        res.status(500).json({
            error: error.message || "Internal Server Error",
            details: error.toString()
        });
    }
}
