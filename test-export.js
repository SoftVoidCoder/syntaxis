import { marked } from 'marked';
import HTMLtoDOCX from 'html-to-docx';

async function test() {
    try {
        let text = "ООО КОМПАНИЯ   Адрес 1";
        let cleanText = text.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '');
        
        let lines = cleanText.split('\n');
        let insideHeader = false;
        let processedLines = [];
        let tableRows = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let match = line.match(/^\s*(.+?)[\s\u00A0]{3,}(.+)$/); 
            if (match) {
                insideHeader = true;
                tableRows.push(`<tr><td style="border:none; text-align:left; padding:0;">${match[1].trim()}</td><td style="border:none; text-align:right; padding:0;">${match[2].trim()}</td></tr>`);
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
        htmlRaw = htmlRaw.replace(/<table>/gi, '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11pt;">');
        htmlRaw = htmlRaw.replace(/<th>/gi, '<th style="border: 1px solid #000000; padding: 8px 10px; background-color: #f2f2f2; text-align: left; font-weight: bold;">');
        htmlRaw = htmlRaw.replace(/<td>/gi, '<td style="border: 1px solid #000000; padding: 8px 10px; text-align: left; vertical-align: top;">');
        
        const htmlContext = `<div style="font-family: 'Times New Roman', serif; font-size: 12pt;">${htmlRaw}</div>`;

        const fileBuffer = await HTMLtoDOCX(htmlContext, null, {
            footer: true,
            pageNumber: true
        });
        console.log("SUCCESS!");
    } catch (e) {
        console.error("ERROR: ", e);
    }
}
test();
