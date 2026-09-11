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
    
    // 1. Remove common emojis that clutter the commercial offer
    let cleanText = text.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '');
    cleanText = cleanText.replace(/ {4,}/g, match => '&nbsp;'.repeat(match.length));

    let htmlRaw = marked.parse(cleanText);
    htmlRaw = htmlRaw.replace(/<table/gi, '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11pt;" border="1"');
    htmlRaw = htmlRaw.replace(/<th/gi, '<th style="border: 1px solid #000000; padding: 8px; background-color: #e2e8f0; text-align: left; font-weight: bold;"');
    htmlRaw = htmlRaw.replace(/<td/gi, '<td style="border: 1px solid #000000; padding: 8px; text-align: left; vertical-align: top;"');

    const htmlContext = `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; color: #000000; }
                    h1 { font-size: 16pt; text-align: center; font-weight: bold; font-family: Arial, sans-serif; }
                    h2 { font-size: 14pt; margin-top: 1.5em; font-weight: bold; font-family: Arial, sans-serif; }
                    h3 { font-size: 13pt; margin-top: 1.2em; font-weight: bold; font-family: Arial, sans-serif; }
                    p { margin-bottom: 1em; }
                    ul, ol { margin-bottom: 1em; margin-left: 20px; }
                    li { margin-bottom: 0.5em; }
                </style>
            </head>
            <body>
                ${htmlRaw}
            </body>
        </html>
    `;

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

    fs.writeFileSync('test_output.docx', buf);
    console.log("Done");
}

run();
