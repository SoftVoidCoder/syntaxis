const fs = require('fs');
const path = 'api/proxy.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add totalTokensUsed initialization
const targetStr1 = `                        let fullTextContent = "";
                        let currentContents = [...genContents];`;
const replacement1 = `                        let fullTextContent = "";
                        let currentContents = [...genContents];
                        let totalTokensUsed = 0;`;

// 2. Add tokens from router
const targetStr2 = `                                    config: dispatcherConfig
                                    }, { timeout: 60000 }))
                                );
                                const latency = ((Date.now() - startTime) / 1000).toFixed(1);`;
const replacement2 = `                                    config: dispatcherConfig
                                    }, { timeout: 60000 }))
                                );
                                if (response.usageMetadata?.totalTokenCount) {
                                    totalTokensUsed += response.usageMetadata.totalTokenCount;
                                }
                                const latency = ((Date.now() - startTime) / 1000).toFixed(1);`;

// 3. Add tokens from synthesizer
const targetStr3 = `                                    config: synthesizerConfig
                                }, { timeout: 600000 }))
                            );
                            const synthLatency = ((Date.now() - synthStartTime) / 1000).toFixed(1);`;
const replacement3 = `                                    config: synthesizerConfig
                                }, { timeout: 600000 }))
                            );
                            if (response.usageMetadata?.totalTokenCount) {
                                totalTokensUsed += response.usageMetadata.totalTokenCount;
                            }
                            const synthLatency = ((Date.now() - synthStartTime) / 1000).toFixed(1);`;

// 4. Save to DB
const targetStr4 = `                            result: { text: fullTextContent, groundingMetadata },
                            completedAt: Date.now()`;
const replacement4 = `                            result: { text: fullTextContent, groundingMetadata, tokensUsed: totalTokensUsed },
                            completedAt: Date.now()`;

let success = true;
if (content.includes(targetStr1)) content = content.replace(targetStr1, replacement1); else success = false;
if (content.includes(targetStr2)) content = content.replace(targetStr2, replacement2); else { console.log("Failed 2"); success = false; }
if (content.includes(targetStr3)) content = content.replace(targetStr3, replacement3); else { console.log("Failed 3"); success = false; }
if (content.includes(targetStr4)) content = content.replace(targetStr4, replacement4); else { console.log("Failed 4"); success = false; }

if (success) {
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched proxy for tokens successfully!");
} else {
    console.error("Failed to patch proxy for tokens!");
}
