const fs = require('fs');

const path = 'api/proxy.js';
let content = fs.readFileSync(path, 'utf8');

const asyncBlockStart = content.indexOf('// 2. Background execution (Fire & Forget)');
const updateDbSuccessStart = content.indexOf('// Update DB with Success');

if (asyncBlockStart !== -1 && updateDbSuccessStart !== -1) {
    const newAsyncBlock = `// 2. Background execution (Fire & Forget)
            // DELAYED START: Wait 1s to ensure response flushes and no race conditions with process exit
            setTimeout(() => {
                (async () => {
                    try {
                        console.log(\`[Proxy-Worker] Job \${jobId} starting model call...\`);
                        
                        let fullTextContent = "";
                        let currentContents = [...genContents];
                        
                        let telemetryLogs = [];
                        const logTelemetry = async (msg) => {
                            console.log(\`[Telemetry] \${msg}\`);
                            telemetryLogs.push(msg);
                            await db.collection(JOBS_COLLECTION).doc(jobId).set({ telemetryLogs }, { merge: true });
                        };

                        await db.collection(JOBS_COLLECTION).doc(jobId).set({ currentPhase: 'dispatcher', telemetryLogs }, { merge: true });

                        const hasTools = genConfig.tools && genConfig.tools.length > 0;

                        if (hasTools) {
                            await logTelemetry(\`[ROUTER] Анализ запроса...\`);
                            let dispatcherLoop = 0;
                            const MAX_DISPATCHER_LOOPS = 5;
                            
                            let dispatcherConfig = { ...genConfig };
                            // Fast router doesn't need to generate long text
                            dispatcherConfig.maxOutputTokens = 512;
                            dispatcherConfig.temperature = 0.1;

                            while (dispatcherLoop < MAX_DISPATCHER_LOOPS) {
                                const startTime = Date.now();
                                const response = await runWithAiLimit(() =>
                                    withRetry(() => ai.models.generateContent({
                                        model: 'gemini-2.5-flash',
                                        contents: currentContents,
                                        config: dispatcherConfig
                                    }, { timeout: 60000 }))
                                );
                                const latency = ((Date.now() - startTime) / 1000).toFixed(1);

                                const candidate = response.candidates?.[0];
                                const functionCallPart = candidate?.content?.parts?.find(p => p.functionCall);

                                if (functionCallPart) {
                                    const toolName = functionCallPart.functionCall.name;
                                    const toolArgs = functionCallPart.functionCall.args;
                                    
                                    await logTelemetry(\`[WORKER] Обращение к агенту: \${toolName}...\`);
                                    await db.collection(JOBS_COLLECTION).doc(jobId).set({ currentPhase: \`worker_\${toolName}\` }, { merge: true });
                                    
                                    const workerStartTime = Date.now();
                                    const toolResult = await executeAgentTool(toolName, toolArgs, ai);
                                    const workerLatency = ((Date.now() - workerStartTime) / 1000).toFixed(1);

                                    await logTelemetry(\`[WORKER] Агент \${toolName} завершил работу (\${workerLatency}s)\`);

                                    currentContents.push({ role: 'model', parts: candidate.content.parts });
                                    currentContents.push({
                                        role: 'user', 
                                        parts: [{ functionResponse: { name: toolName, response: toolResult } }]
                                    });

                                    dispatcherLoop++;
                                } else {
                                    await logTelemetry(\`[ROUTER] Анализ завершен (\${latency}s)\`);
                                    break;
                                }
                            }
                        }

                        // SYNTHESIZER PHASE
                        await logTelemetry(\`[SYNTHESIZER] Генерация итогового ответа (Pro-модель)...\`);
                        await db.collection(JOBS_COLLECTION).doc(jobId).set({ currentPhase: 'synthesizer' }, { merge: true });

                        let synthesizerConfig = { ...genConfig };
                        delete synthesizerConfig.tools; // Ensure Pro model doesn't try to call tools again
                        delete synthesizerConfig.toolConfig;

                        let isMaxTokens = false;
                        let loops = 0;
                        const MAX_CONT_LOOPS = 2; 
                        
                        do {
                            const synthStartTime = Date.now();
                            const response = await runWithAiLimit(() =>
                                withRetry(() => ai.models.generateContent({
                                    model, // The original requested model (e.g. gemini-3.1-pro-preview)
                                    contents: currentContents,
                                    config: synthesizerConfig
                                }, { timeout: 600000 }))
                            );
                            const synthLatency = ((Date.now() - synthStartTime) / 1000).toFixed(1);

                            let textContent = "";
                            try {
                                textContent = typeof response.text === 'function' ? response.text() : response.text;
                            } catch (e) {
                                console.warn("[Proxy-Worker] Synthesizer text() failed:", e.message);
                            }
                            
                            fullTextContent += textContent;
                            const candidate = response.candidates?.[0];
                            const finishReason = candidate?.finishReason;
                            
                            isMaxTokens = (finishReason === 'MAX_TOKENS');
                            if (isMaxTokens && loops < MAX_CONT_LOOPS) {
                                await logTelemetry(\`[SYNTHESIZER] Продолжение генерации (Chunk \${loops+2})...\`);
                                currentContents.push({ role: 'model', parts: [{ text: textContent }] });
                                currentContents.push({ role: 'user', parts: [{ text: 'Твой предыдущий ответ автоматически оборвался из-за лимита токенов. Продолжи строго с того места (или оборванного слова), где ты остановился.' }] });
                                loops++;
                            } else {
                                await logTelemetry(\`[SYNTHESIZER] Ответ готов (\${synthLatency}s)\`);
                                isMaxTokens = false;
                            }
                        } while (isMaxTokens);

                        `;
    const newContent = content.substring(0, asyncBlockStart) + newAsyncBlock + content.substring(updateDbSuccessStart);
    fs.writeFileSync(path, newContent, 'utf8');
    console.log('Patched proxy.js successfully');
} else {
    console.error('Failed to find block boundaries');
}
