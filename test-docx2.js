import HTMLtoDOCX from 'html-to-docx';
import { marked } from 'marked';
import fs from 'fs';

async function run() {
    const text = `
# Коммерческое предложение

## Таблица
| Колонка 1 | Колонка 2 |
|---|---|
| Значение 1 | Значение 2 |

Используемые материалы:
* PTFE 1650
* МБП-25
    `;
    
    // 1. Remove common emojis
    let cleanText = text.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '');
    
    // 2. Convert spaced headers (Left        Right) into borderless HTML tables for perfect DOCX alignment
    let lines = cleanText.split('\n');
    let insideHeader = false;
    let processedLines = [];
    let tableRows = [];

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let match = line.match(/^(\S.*?) {4,}(.+)$/); 
        if (match) {
            insideHeader = true;
            tableRows.push(`<tr><td style="border:none; text-align:left; width:50%; padding:0;">${match[1].trim()}</td><td style="border:none; text-align:right; width:50%; padding:0;">${match[2].trim()}</td></tr>`);
        } else {
            if (insideHeader) {
                processedLines.push(`\n<table style="width:100%; border:none; margin-bottom: 1em;">${tableRows.join('')}</table>\n`);
                tableRows = [];
                insideHeader = false;
            }
            processedLines.push(line);
        }
    }
    if (insideHeader) {
        processedLines.push(`\n<table style="width:100%; border:none; margin-bottom: 1em;">${tableRows.join('')}</table>\n`);
    }
    cleanText = processedLines.join('\n');

    let htmlRaw = marked.parse(cleanText);
    
    // Extremely safe wrapper, no HTML document, just a div.
    // Also using px since html-to-docx parses px best according to some docs.
    const htmlContext = `<div style="font-family: 'Times New Roman', serif; font-size: 16px;">${htmlRaw}</div>`;

    const fileBuffer = await HTMLtoDOCX(htmlContext, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
        margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
    });

    let buf;
    if (fileBuffer && typeof fileBuffer.arrayBuffer === 'function') {
        const arrayBuf = await fileBuffer.arrayBuffer();
        buf = Buffer.from(arrayBuf);
    } else {
        buf = Buffer.from(fileBuffer);
    }

    fs.writeFileSync('test_output_safe.docx', buf);
    console.log("Done");
}

run();
