const text = `Отлично, Илья. Запускаю глубокий анализ. Это может занять минуту.

<<<CHECKO_DEEP_CALL: 8401005730 >>>`;

const deepRegex = /<<<CHECKO_DEEP_CALL:\s*(\d{10,12})\s*>>>/g;
const deepMatches = [...text.matchAll(deepRegex)];

console.log("Deep matches:", deepMatches.length);
if (deepMatches.length > 0) {
    console.log("Match 0:", deepMatches[0][1]);
}

const checkoRegex = /<<<CHECKO_CALL:\s*(.+?)\s*>>>/g;
const checkoMatches = [...text.matchAll(checkoRegex)];
console.log("Checko matches:", checkoMatches.length);

const bitrixRegex = /<<<BITRIX_CALL:\s*([a-zA-Z0-9_.]+)\s*\|?\s*([\s\S]*?)>>>/g;
const bitrixMatches = [...text.matchAll(bitrixRegex)];
console.log("Bitrix matches:", bitrixMatches.length);
