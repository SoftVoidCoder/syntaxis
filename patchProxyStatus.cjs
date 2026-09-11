const fs = require('fs');

const path = 'api/proxy.js';
let content = fs.readFileSync(path, 'utf8');

const targetStr1 = `result = { done: false, status: 'processing', activeTools: job.activeTools || [], completedTools: job.completedTools || [] };`;
const targetStr2 = `result = { done: true, status: 'completed', activeTools: job.activeTools || [], completedTools: job.completedTools || [], ...job.result };`;

const replacement1 = `result = { done: false, status: 'processing', activeTools: job.activeTools || [], completedTools: job.completedTools || [], telemetryLogs: job.telemetryLogs || [], currentPhase: job.currentPhase || '' };`;
const replacement2 = `result = { done: true, status: 'completed', activeTools: job.activeTools || [], completedTools: job.completedTools || [], telemetryLogs: job.telemetryLogs || [], currentPhase: job.currentPhase || '', ...job.result };`;

let patched = false;
if (content.includes(targetStr1)) {
    content = content.replace(targetStr1, replacement1);
    patched = true;
}
if (content.includes(targetStr2)) {
    content = content.replace(targetStr2, replacement2);
    patched = true;
}

if (patched) {
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched proxy status successfully!");
} else {
    console.error("Could not find target strings in proxy.js!");
}
