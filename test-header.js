import fs from 'fs';

let text = `ООО «ЕТС КОРДА»                                        Адрес: 198095, Российская Федерация,
г. Санкт-Петербург, ул. Розенштейна, д. 21, офис 508   email: office@korda.spb.ru
Тел./факс: (812) 363-43-33, 8-800-500-05-19            ИНН/КПП: 7839038304/783901001

# КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ`;

let lines = text.split('\n');
let insideHeader = false;
let processedLines = [];
let tableRows = [];

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let match = line.match(/^(\S.*?) {2,}(.+)$/); // Trying 2+ spaces
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

console.log(processedLines.join('\n'));
