import HTMLtoDOCX from 'html-to-docx';
import { marked } from 'marked';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({error: 'Method not allowed'});
    }

    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({error: 'No text provided'});

        // 1. Remove common emojis that clutter the commercial offer
        let cleanText = text.replace(/[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '');
        
        // 2. Convert spaced headers (Left        Right) into borderless HTML tables for perfect DOCX alignment
        let lines = cleanText.split('\n');
        let insideHeaderBlock = true; // We only parse the very top of the document
        let insideHeaderTable = false;
        let processedLines = [];
        let tableRows = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Stop parsing headers once we hit an empty line or the main title
            if (line.trim() === '' || line.startsWith('#')) {
                insideHeaderBlock = false;
            }

            let match = null;
            if (insideHeaderBlock) {
                // Match left and right parts separated by at least 3 spaces/tabs.
                match = line.match(/^\s*(.+?)[\s\u00A0]{3,}(.+)$/); 
            }

            if (match) {
                insideHeaderTable = true;
                tableRows.push(`<tr><td style="border:none; text-align:left; padding:0;">${match[1].trim()}</td><td style="border:none; text-align:right; padding:0;">${match[2].trim()}</td></tr>`);
            } else {
                if (insideHeaderTable) {
                    processedLines.push(`\n<table style="width:100%; border:none; margin-bottom: 1em;">${tableRows.join('')}</table>\n`);
                    tableRows = [];
                    insideHeaderTable = false;
                }
                processedLines.push(line);
            }
        }
        if (insideHeaderTable) {
            processedLines.push(`\n<table style="width:100%; border:none; margin-bottom: 1em;">${tableRows.join('')}</table>\n`);
        }
        cleanText = processedLines.join('\n');

        // Convert the Markdown text to HTML using marked
        let htmlRaw = marked.parse(cleanText);
        
        // Add thin borders and padding strictly to markdown-generated data tables (not header tables)
        htmlRaw = htmlRaw.replace(/<table>/gi, '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11pt;">');
        htmlRaw = htmlRaw.replace(/<th>/gi, '<th style="border: 1px solid #000000; padding: 8px 10px; background-color: #f2f2f2; text-align: left; font-weight: bold;">');
        htmlRaw = htmlRaw.replace(/<td>/gi, '<td style="border: 1px solid #000000; padding: 8px 10px; text-align: left; vertical-align: top;">');
        
        // Use an ultra-minimal wrapper to avoid HTML parser bugs in html-to-docx
        const htmlContext = `<div style="font-family: 'Times New Roman', serif; font-size: 12pt;">${htmlRaw}</div>`;

        // Generate DOCX buffer with MINIMAL options. Advanced options like table.row.cantSplit 
        // can corrupt Word document if it overflows a page.
        const fileBuffer = await HTMLtoDOCX(htmlContext, null, {
            footer: true,
            pageNumber: true
        });

        // Send as a file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename="commercial_offer_korda.docx"');
        
        if (fileBuffer && typeof fileBuffer.arrayBuffer === 'function') {
            const arrayBuf = await fileBuffer.arrayBuffer();
            res.send(Buffer.from(arrayBuf));
        } else {
            res.send(Buffer.from(fileBuffer));
        }

    } catch (err) {
        console.error("[export-docx] Error generating DOCX:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
}
