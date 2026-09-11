const fs = require('fs');
const path = 'api/proxy.js';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `result: { text: fullTextContent },`;
const replacement = `result: { text: fullTextContent, groundingMetadata },`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log("Patched proxy success!");
} else {
    console.error("Not found in proxy.js!");
}
