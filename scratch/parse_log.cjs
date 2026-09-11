const fs = require('fs');

const path = 'C:\\Users\\s 30\\Desktop\\Анализ\\Проба 2.txt';

// Read as utf16le since Windows Event Viewer exports as UTF-16 LE
let data = fs.readFileSync(path, 'utf16le');

// Sometimes the first character is a BOM, so let's strip it if needed
if (data.charCodeAt(0) === 0xFEFF) {
    data = data.slice(1);
}

const events = data.split('Аудит успеха\t');
const summary = {};

events.forEach(event => {
    if (!event.includes('4663')) return;
    
    const accountMatch = event.match(/Имя учетной записи:\s+([^\r\n]+)/);
    const objectMatch = event.match(/Имя объекта:\s+([^\r\n]+)/);
    
    if (accountMatch && objectMatch) {
        let account = accountMatch[1].trim();
        let object = objectMatch[1].trim();
        
        // Filter out noise
        if (object.endsWith(':Zone.Identifier') || object.includes('~$') || !object.includes('.')) return;
        
        // Ignore system accounts
        if (account.toUpperCase() === 'SYSTEM' || account.toUpperCase().includes('NETWORK SERVICE') || account.toUpperCase().includes('LOCAL SERVICE')) return;
        if (account.endsWith('$')) return; // Ignore computer accounts

        // Extract filename from path
        const parts = object.split('\\');
        const filename = parts[parts.length - 1];
        
        if (!summary[account]) summary[account] = {};
        if (!summary[account][filename]) summary[account][filename] = 0;
        summary[account][filename]++;
    }
});

let md = '# Анализ лог-файла "Проба 2"\n\n';
md += 'Я проанализировал ваш журнал. Ниже представлена сводка: кто из пользователей какие файлы открывал (и сколько раз к ним обращалась система во время сеанса чтения).\n\n';

let hasData = false;
for (const account in summary) {
    hasData = true;
    md += `### Пользователь: **${account}**\n\n`;
    // Sort files by access count
    const files = Object.keys(summary[account]).sort((a, b) => summary[account][b] - summary[account][a]);
    
    md += '| Имя файла | Количество событий доступа |\n';
    md += '| --- | --- |\n';
    files.forEach(file => {
        md += `| ${file} | ${summary[account][file]} |\n`;
    });
    md += '\n';
}

if (!hasData) {
    md += 'В данном логе не найдено значимых событий доступа к документам от обычных пользователей.\n';
}

// Write the output to the workspace directory as an artifact alternative (since the system creates the artifact dir, we'll put it where it's safe)
fs.writeFileSync('C:\\Users\\s 30\\.gemini\\antigravity\\scratch\\Korda_nexus\\scratch\\log_analysis.md', md, 'utf8');
console.log('Analysis created successfully in scratch/log_analysis.md.');
