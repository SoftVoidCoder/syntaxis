// agentTools.js
// Logic for Gemini Function Calling (Agent Tools)
import { google } from 'googleapis';

// Cache for TU documents to avoid spamming Google Drive API
let tuDocumentsCache = null;
let tuCacheTime = 0;

async function getTuDocuments() {
    // Cache for 10 minutes
    if (tuDocumentsCache && (Date.now() - tuCacheTime < 600000)) {
        return tuDocumentsCache;
    }

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
    const credentials = JSON.parse(saJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    const tuFolderId = '1vAR4I506OwvpcG2ZWUW_692B1Tyz1Hkf';
    let combinedText = '';

    try {
        const driveResponse = await drive.files.list({
            q: `'${tuFolderId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType)',
        });
        
        const files = driveResponse.data.files || [];
        for (const file of files) {
            if (file.mimeType.includes('document')) {
                const exportResponse = await drive.files.export({
                    fileId: file.id,
                    mimeType: 'text/plain'
                });
                combinedText += `\n--- ДОКУМЕНТ ТУ: ${file.name} ---\n${exportResponse.data}\n`;
            }
        }
        
        tuDocumentsCache = combinedText;
        tuCacheTime = Date.now();
        return combinedText;
    } catch (err) {
        console.error('[AgentTools] Failed to fetch TU documents:', err);
        throw new Error('Не удалось прочитать документы ТУ из Google Drive.');
    }
}

// Cache for Materials spreadsheet
let materialsCache = null;
let materialsCacheTime = 0;

async function getMaterialsFromSheet() {
    if (materialsCache && (Date.now() - materialsCacheTime < 600000)) {
        return materialsCache;
    }

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
    const credentials = JSON.parse(saJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const spreadsheetId = '12Ocp67sruFFiML6xzJ7tBB3XX2vnI2BU67Z42XFhMwc';
    let combinedData = 'БАЗА ИСПОЛЬЗУЕМЫХ МАТЕРИАЛОВ:\n';

    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetNames = spreadsheet.data.sheets.map(s => s.properties.title);

        for (const sheetName of sheetNames) {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `'${sheetName}'!A1:Z50`
            });
            const rows = response.data.values || [];
            if (rows.length > 0) {
                combinedData += `\n--- КАТЕГОРИЯ: ${sheetName} ---\n`;
                rows.forEach(row => {
                    combinedData += row.join(' | ') + '\n';
                });
            }
        }
        
        materialsCache = combinedData;
        materialsCacheTime = Date.now();
        return combinedData;
    } catch (err) {
        console.error('[AgentTools] Failed to fetch materials:', err);
        throw new Error('Не удалось прочитать таблицу материалов из Google Drive.');
    }
}

// Cache for standard consumption table
let standardConsumptionCache = null;
let standardConsumptionCacheTime = 0;

async function getStandardConsumption() {
    if (standardConsumptionCache && (Date.now() - standardConsumptionCacheTime < 600000)) {
        return standardConsumptionCache;
    }

    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!saJson) throw new Error('FIREBASE_SERVICE_ACCOUNT env var missing');
    const credentials = JSON.parse(saJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Direct Sheet ID for "Расход ткани и наполнителя для стандартных изделий"
    const spreadsheetId = '1LBEWHt-odB6gKGc525wsoSmG6ItNNZuqgpxLdIfonrU';
    
    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetName = spreadsheet.data.sheets[0].properties.title;
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!A1:N5000`
        });
        
        const rows = response.data.values || [];
        if (rows.length <= 1) return [];
        
        // Helper: parse Russian-locale numbers (comma as decimal separator)
        function parseNum(val) {
            if (!val) return 0;
            return parseFloat(String(val).replace(',', '.')) || 0;
        }
        
        // Parse rows (skip header row 0)
        // Columns: [1]=Название, [2]=Тип, [3]=толщина, [4]=Ду, [5]=Полное название,
        //          [8]=Сокращения, [11]=Расход внешний, [12]=Расход внутренний, [13]=Расход наполнитель
        const result = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || !row[2]) continue; // skip empty rows
            
            const type = (row[2] || '').trim();
            const dn = parseInt(row[4]) || 0;
            const thickness = parseInt(row[3]) || 0;
            const fullName = (row[5] || '').trim();
            const abbr = (row[8] || '').trim();
            const outerM2 = parseNum(row[11]);
            const innerM2 = parseNum(row[12]);
            const insulM2 = parseNum(row[13]);
            const rawName = (row[1] || '').trim();
            
            // Extract pressure from name (e.g. "Задвижка Ру16 Ду15" -> 16)
            const pressureMatch = rawName.match(/Ру(\d+)/i);
            const pressure = pressureMatch ? parseInt(pressureMatch[1]) : 16;
            
            result.push({ type, dn, thickness, pressure, fullName, abbr, outerM2, innerM2, insulM2, rawName });
        }
        
        standardConsumptionCache = result;
        standardConsumptionCacheTime = Date.now();
        console.log(`[getStandardConsumption] Loaded ${result.length} standard items from sheet ${spreadsheetId}`);
        return result;
    } catch (err) {
        console.error('[getStandardConsumption] Failed:', err.message);
        return [];
    }
}



const tools = {

    /**
     * Extracts ALL positions from raw spec with equipment metadata (no TU name generation).
     */
    extract_positions: async (params, ai, modelName = 'gemini-3.5-flash') => {
        try {
            const spec = params.raw_specification || params.equipmentType;
            
            // 1. Fetch TU rules from Google Drive (for context on equipment types)
            const tuText = await getTuDocuments();

            // 2. Ask AI to extract positions with structured metadata
            const prompt = `
Ты - строгий Ассистент по извлечению позиций оборудования. Твоя задача - извлечь ВСЕ позиции из спецификации и определить их параметры.

КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО: Ты ДОЛЖЕН обработать ВСЕ без исключения строки спецификации. Если в спецификации 49 позиций, в твоем JSON должно быть ровно 49 объектов. Запрещено использовать сокращения, объединять позиции или писать "и так далее". Обработай каждую строку до самого конца!

СТРОГОЕ ПРАВИЛО: Ты должен вернуть ответ ИСКЛЮЧИТЕЛЬНО в формате валидного JSON-массива. Никакого дополнительного текста до или после JSON.
Не группируй позиции, создай объект для КАЖДОЙ строки спецификации отдельно.

Для каждой позиции определи:
- raw_name: оригинальное наименование оборудования из спецификации
- qty: количество (число)
- equipment_type: тип оборудования на русском языке в нижнем регистре (например: "задвижка", "фильтр", "кран шаровый", "компенсатор", "клапан обратный", "вентиль", "расходомер", "фланцевое соединение", "затвор дисковый")
- equipment_model: марка/модель оборудования (например: "Rushwork 315", "АЗТ-87", "30с41нж"). Если модель не указана — пустая строка.
- dn: номинальный диаметр (число, только цифры, без "Ду"). Обычно: 15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 350, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200. Если не указан — null.
- thickness: толщина изоляции в мм (число). Обычно: 30, 40, 50, 60, 70, 80, 90, 100, 110, 120. Если не указана — null (система подставит 50 по умолчанию).
- pressure: давление Ру/PN (число). Обычно: 16, 25, 40, 63, 100, 160. Если не указано — null (система подставит 16 по умолчанию).
- temperature: температура эксплуатации (число). Если не указана — 200 по умолчанию.

ВАЖНО ПО ОПРЕДЕЛЕНИЮ ЗНАЧЕНИЙ:
В спецификациях клиентов значения ДУ, толщины и давления могут находиться в РАЗНЫХ столбцах одной строки.
Обычно бывает 2-3 числовых значения. Правила определения:
- ДУ (диаметр): обычно обозначается "Ду", "DN", "Д.У." или просто числом. Диапазон: 15-1200.
- Толщина: обозначается "толщ.", "t", "δ", "изол." или просто числом. Диапазон: 30-120.
- Давление: обозначается "Ру", "PN", "давл." или просто числом. Типичные значения: 16, 25, 40, 63, 100, 160.
- Если видишь два числа без явных обозначений: бо́льшее — скорее ДУ, меньшее — скорее толщина.

НЕ генерируй tu_name — это будет сделано на следующем шаге.

Формат каждого объекта в массиве:
{
  "id": 1,
  "raw_name": "Изоляция съемная_АЗТ_87 Ду 200",
  "qty": 2,
  "equipment_type": "задвижка",
  "equipment_model": "АЗТ-87",
  "dn": 200,
  "thickness": 50,
  "pressure": 16,
  "temperature": 200
}

Спецификация/Данные от пользователя:
${spec || 'Не указано'}

Документация ТУ (для справки по типам оборудования):
${tuText}
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { 
                    maxOutputTokens: 16384, 
                    temperature: 0.1,
                    responseMimeType: "application/json" 
                }
            });

            let nomenclature = '';
            const candidateContent = response.candidates?.[0]?.content;
            if (candidateContent && candidateContent.parts) {
                nomenclature = candidateContent.parts.filter(p => p.text).map(p => p.text).join('').trim();
            } else if (typeof response.text === 'function') {
                try { nomenclature = response.text().trim(); } catch(e) {}
            } else if (response.text) {
                nomenclature = response.text.trim();
            }

            // Strip markdown backticks
            nomenclature = nomenclature.replace(/```json/gi, '').replace(/```/g, '').trim();

            // Robust JSON extraction
            let parsedData = [];
            try {
                parsedData = JSON.parse(nomenclature);
            } catch (e) {
                console.warn('[AgentTools] Could not parse extract_positions as strict JSON. Trying to fix truncation.');
                try {
                    let fixedJson = nomenclature;
                    const lastBraceIndex = fixedJson.lastIndexOf('}');
                    if (lastBraceIndex !== -1) {
                        fixedJson = fixedJson.substring(0, lastBraceIndex + 1) + ']';
                        parsedData = JSON.parse(fixedJson);
                    } else {
                        throw new Error('No braces found to fix');
                    }
                } catch (e2) {
                    console.warn('[AgentTools] Fix failed. Using regex fallback.');
                    const matches = nomenclature.match(/\{[^{}]+\}/g) || [];
                    parsedData = matches.map(m => {
                        try { return JSON.parse(m); } catch (err) { return null; }
                    }).filter(Boolean);
                }
            }

            console.log(`[AgentTools] extract_positions RAW response length: ${nomenclature.length} chars`);
            console.log(`[AgentTools] extract_positions PARSED: ${parsedData.length} items`);
            if (parsedData.length > 0) {
                console.log(`[AgentTools] extract_positions SAMPLE[0]:`, JSON.stringify(parsedData[0]));
                console.log(`[AgentTools] extract_positions SAMPLE[last]:`, JSON.stringify(parsedData[parsedData.length - 1]));
            }

            return {
                result: `Извлечены позиции оборудования: ${parsedData.length || 'несколько'} позиций.`,
                data: parsedData,
                rawText: nomenclature
            };
        } catch (err) {
            console.error('[AgentTools] extract_positions error:', err);
            return { error: err.message };
        }
    },

    /**
     * lookup_standard — DETERMINISTIC lookup in standard consumption table.
     * Matches positions by type abbreviation + DN + thickness.
     * Returns tu_name, consumption data for standard items.
     * Non-standard items are flagged for fallback processing.
     */
    lookup_standard: async (params) => {
        try {
            const masterJson = params.masterJson || [];
            const standardTable = await getStandardConsumption();
            
            console.log(`[lookup_standard] Table: ${standardTable.length} items, masterJson: ${masterJson.length} items`);
            if (masterJson.length > 0) {
                const sample = masterJson[0];
                console.log(`[lookup_standard] Sample item[0]: type="${sample.equipment_type}", dn=${sample.dn}(${typeof sample.dn}), thickness=${sample.thickness}(${typeof sample.thickness}), pressure=${sample.pressure}(${typeof sample.pressure})`);
            }
            if (standardTable.length > 0) {
                const s = standardTable[0];
                console.log(`[lookup_standard] Sample table[0]: type="${s.type}", dn=${s.dn}(${typeof s.dn}), thick=${s.thickness}, outer=${s.outerM2}`);
            }
            
            if (standardTable.length === 0) {
                console.warn('[lookup_standard] Standard table empty, all items will use fallback');
                return {
                    result: 'Таблица стандартных расходов не загружена. Все позиции пойдут через fallback.',
                    data: masterJson.map(item => ({ id: item.id, is_standard: false, source: 'fallback' }))
                };
            }
            
            // Map equipment_type (Russian full name) to abbreviation
            const TYPE_MAP = {
                'задвижка': 'З',
                'задвижка клиновая': 'З',
                'задвижка с обрезиненным клином': 'З',
                'задвижка с обр. клином': 'З',
                'затвор дисковый': 'ЗД',
                'затвор': 'ЗД',
                'задвижка универсальная': 'ЗУ',
                'клапан балансировочный': 'КБ',
                'кожух защитный': 'КЗХ',
                'кожух защитный химстойкий': 'КЗХ',
                'кожух защитный текстильный термостойкий': 'КЗТТ',
                'конденсатоотводчик': 'КО',
                'клапан предохранительный': 'КП',
                'компенсатор': 'КС',
                'клапан трехходовой': 'КТ',
                'кран шаровый': 'КШ',
                'кран шаровой': 'КШ',
                'клапан обратный межфланцевый': 'ОКМ',
                'клапан обратный поворотный': 'ОКП',
                'клапан обратный': 'ОКП',
                'регулятор давления': 'РД',
                'клапан регулирующий': 'РД',
                'расходомер': 'РС',
                'фильтр': 'Ф',
                'фланцевое соединение': 'ФС',
                'фланец': 'ФС',
                'вентиль': 'З',
                'вентиль запорный': 'З',
            };
            
            // Helper: find type abbreviation from equipment_type string
            function resolveType(equipmentType) {
                if (!equipmentType) return null;
                const lower = equipmentType.toLowerCase().trim();
                // Exact match first
                if (TYPE_MAP[lower]) return TYPE_MAP[lower];
                // Partial match
                for (const [key, abbr] of Object.entries(TYPE_MAP)) {
                    if (lower.includes(key) || key.includes(lower)) return abbr;
                }
                return null;
            }
            
            let standardCount = 0;
            let fallbackCount = 0;
            
            const data = masterJson.map(item => {
                const typeAbbr = resolveType(item.equipment_type);
                const dn = parseInt(item.dn) || 0;
                const thickness = parseInt(item.thickness) || 50; // default thickness 50mm
                const pressure = parseInt(item.pressure) || 16;   // default pressure Ру16
                
                if (!typeAbbr || !dn) {
                    fallbackCount++;
                    return { id: item.id, is_standard: false, source: 'fallback', reason: !typeAbbr ? 'unknown_type' : 'no_dn' };
                }
                
                // If pressure > 16, look for next DN up where the table entry has matching pressure
                let lookupDn = dn;
                if (pressure > 16) {
                    // Find entries for this type with matching pressure and DN >= requested
                    const highPressure = standardTable.filter(s => 
                        s.type === typeAbbr && s.pressure === pressure && s.dn >= dn && s.thickness === thickness
                    );
                    if (highPressure.length > 0) {
                        highPressure.sort((a, b) => a.dn - b.dn);
                        lookupDn = highPressure[0].dn;
                        console.log(`[lookup_standard] ID ${item.id}: pressure Ру${pressure} > 16, using DN ${lookupDn} (was ${dn})`);
                    } else {
                        // No high-pressure match — try next DN up as fallback
                        const nextDn = standardTable.filter(s => s.type === typeAbbr && s.dn > dn && s.thickness === thickness);
                        if (nextDn.length > 0) {
                            nextDn.sort((a, b) => a.dn - b.dn);
                            lookupDn = nextDn[0].dn;
                            console.log(`[lookup_standard] ID ${item.id}: pressure Ру${pressure}, no exact match, using next DN ${lookupDn}`);
                        }
                    }
                }
                
                // Find exact match in standard table
                let match = standardTable.find(s => s.type === typeAbbr && s.dn === lookupDn && s.thickness === thickness);
                
                // If no exact thickness match, try closest available thickness
                if (!match) {
                    const sameTypeDn = standardTable.filter(s => s.type === typeAbbr && s.dn === lookupDn);
                    if (sameTypeDn.length > 0) {
                        // Find closest thickness
                        sameTypeDn.sort((a, b) => Math.abs(a.thickness - thickness) - Math.abs(b.thickness - thickness));
                        match = sameTypeDn[0];
                        console.log(`[lookup_standard] ID ${item.id}: exact thickness ${thickness} not found, using closest ${match.thickness}`);
                    }
                }
                
                // If still no match, try next DN up
                if (!match) {
                    const sameType = standardTable.filter(s => s.type === typeAbbr && s.thickness === thickness && s.dn > dn);
                    if (sameType.length > 0) {
                        sameType.sort((a, b) => a.dn - b.dn);
                        match = sameType[0];
                        console.log(`[lookup_standard] ID ${item.id}: DN ${dn} not found for ${typeAbbr}, using next DN ${match.dn}`);
                    }
                }
                
                if (match) {
                    standardCount++;
                    return {
                        id: item.id,
                        is_standard: true,
                        source: 'standard_table',
                        tu_name: match.fullName || `Термочехол КОРДА ЧСТЭ-200 ТА-${typeAbbr}-${dn}-${thickness}`,
                        type_abbr: typeAbbr,
                        consumption: {
                            outer_m2: match.outerM2,
                            inner_m2: match.innerM2,
                            insul_m2: match.insulM2,
                        },
                        matched_dn: match.dn,
                        matched_thickness: match.thickness,
                        // Stubs for Firestore compatibility (prevent undefined fields)
                        geometry: {
                            area: match.outerM2,
                            area_with_allowance: match.outerM2,
                            L_mm: 0,
                            H_mm: 0,
                            shape: 'standard_lookup',
                        },
                        dimensions: {
                            L_mm: 0,
                            H_mm: 0,
                            source: 'standard_table',
                            equipment_type: item.equipment_type || '',
                            h_coefficient: 1.0,
                        },
                    };
                } else {
                    fallbackCount++;
                    return { id: item.id, is_standard: false, source: 'fallback', reason: 'not_in_table', type_abbr: typeAbbr };
                }
            });
            
            return {
                result: `Лукап завершён: ${standardCount} стандартных, ${fallbackCount} нестандартных (fallback).`,
                data
            };
        } catch (err) {
            console.error('[lookup_standard] Error:', err);
            return { error: err.message };
        }
    },

    /**
     * Selects appropriate materials based on the equipment type and temperature.
     * Expects to read the JSON array from extract_positions in the conversation history,
     * but we pass raw_specification as fallback.
     */
    select_materials: async (params, ai, modelName = 'gemini-3.5-flash') => {
        try {
            const spec = params.raw_specification || params.equipmentType;
            
            // 1. Fetch materials from Google Sheets
            const materialsData = await getMaterialsFromSheet();

            // 2. Ask fast model to select materials
            const prompt = `Ты - инженер-технолог по подбору материалов для промышленных термочехлов KORDA.
Твоя задача — подобрать подходящие материалы (Ткань, Наполнитель, Фурнитура/Нитки) на основе доступной базы материалов и спецификации.

КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО: Ты ДОЛЖЕН подобрать материалы для ВСЕХ без исключения строк спецификации. Запрещено использовать сокращения или пропускать позиции. Обработай каждую позицию из данных от пользователя!

СТРОГОЕ ПРАВИЛО: Ты должен вернуть ответ ИСКЛЮЧИТЕЛЬНО в формате валидного JSON-массива. 
Ориентируйся на позиции оборудования, которые были извлечены на предыдущем шаге (extract_positions). 
Для каждой позиции добавь блок материалов и их цен.

ВАЖНО ПО ТОЛЩИНЕ УТЕПЛИТЕЛЯ:
В таблице утеплителей есть колонка "Толщина, мм". Ты ДОЛЖЕН извлечь из неё значение insulation_thickness (число, мм).
- Если в колонке указан диапазон (например "6-50"), используй МАКСИМАЛЬНОЕ значение (50).
- Если указано одно число (например "13"), используй его.
- Если толщина не указана, используй 50 по умолчанию.

Формат каждого объекта в массиве:
{
  "id": "порядковый номер (число)",
  "materials": {
    "outer": "Марка материала (например, СИ1)",
    "outer_price": цена за м2 (число),
    "inner": "Марка (например, Т13)",
    "inner_price": цена за м2 (число),
    "insulation": "Марка (например, МП-80)",
    "insulation_price": цена за м2 (число),
    "insulation_thickness": толщина утеплителя в мм (число),
    "thread_price": цена за метр ниток (число)
  }
}
Убедись, что цены извлечены правильно из базы материалов (как числа).

Спецификация/Данные от пользователя:
${spec || 'Не указано'}

БАЗА МАТЕРИАЛОВ (выбирай ТОЛЬКО из этих позиций):
${materialsData}
`;

            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: { 
                    maxOutputTokens: 16384, 
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            let resultText = '';
            const candidateContent = response.candidates?.[0]?.content;
            if (candidateContent && candidateContent.parts) {
                resultText = candidateContent.parts.filter(p => p.text).map(p => p.text).join('').trim();
            } else if (typeof response.text === 'function') {
                try { resultText = response.text().trim(); } catch(e) {}
            } else if (response.text) {
                resultText = response.text.trim();
            }

            resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();

            let parsedData = [];
            try {
                parsedData = JSON.parse(resultText);
            } catch (e) {
                console.warn('[AgentTools] Could not parse select_materials as strict JSON. Trying to fix truncation.');
                try {
                    let fixedJson = resultText;
                    const lastBraceIndex = fixedJson.lastIndexOf('}');
                    if (lastBraceIndex !== -1) {
                        fixedJson = fixedJson.substring(0, lastBraceIndex + 1) + ']';
                        parsedData = JSON.parse(fixedJson);
                    } else {
                        throw new Error('No braces found to fix');
                    }
                } catch (e2) {
                    console.warn('[AgentTools] Fix failed. Using regex fallback.');
                    const matches = resultText.match(/\{[^{}]+\}/g) || [];
                    parsedData = matches.map(m => {
                        try { return JSON.parse(m); } catch (err) { return null; }
                    }).filter(Boolean);
                }
            }

            console.log(`[AgentTools] select_materials RAW response length: ${resultText.length} chars`);
            console.log(`[AgentTools] select_materials PARSED: ${parsedData.length} items`);
            if (parsedData.length > 0) {
                console.log(`[AgentTools] select_materials SAMPLE[0]:`, JSON.stringify(parsedData[0]));
            }

            return {
                result: `Подобранные материалы для ${parsedData.length || 'нескольких'} позиций.`,
                data: parsedData,
                rawText: resultText
            };
        } catch (err) {
            console.error('[AgentTools] select_materials error:', err);
            return { error: err.message };
        }
    },
    /**
     * resolve_parameters — AI-агент, извлекающий параметры ценообразования из правил Firestore.
     * Запускается между select_materials и calculate_geometry.
     */
    resolve_parameters: async (params, ai, modelName = 'gemini-3.5-flash') => {
        try {
            const masterJson = params.masterJson || [];
            const conveyorRules = params.conveyorRules || [];
            const ruleCategories = params.ruleCategories || [];

            // Построить путь категорий для каждого правила
            const categoryMap = {};
            for (const cat of ruleCategories) {
                categoryMap[cat.id] = cat;
            }
            function getCategoryPath(catId) {
                const parts = [];
                let current = catId;
                while (current && categoryMap[current]) {
                    parts.unshift(categoryMap[current].name || current);
                    current = categoryMap[current].parentId || null;
                }
                return parts.join('/');
            }

            // Обогатить правила путями категорий
            const enrichedRules = conveyorRules.map(r => ({
                ...r,
                categoryPath: r.categoryId ? getCategoryPath(r.categoryId) : 'Без категории'
            }));

            // Фильтровать правила, релевантные ценообразованию
            const pricingKeywords = ['Работы', 'Материалы', 'Коммерческое', 'НДС', 'Коммерция', 'наценка', 'припуск', 'эскиз', 'нитки', 'швея', 'набивка'];
            const relevantRules = enrichedRules.filter(r => {
                const path = (r.categoryPath || '').toLowerCase();
                const name = (r.name || '').toLowerCase();
                const desc = (r.description || '').toLowerCase();
                return pricingKeywords.some(kw => path.includes(kw.toLowerCase()) || name.includes(kw.toLowerCase()) || desc.includes(kw.toLowerCase()));
            });

            const rulesText = relevantRules.length > 0
                ? relevantRules.map(r => `[${r.categoryPath}] ${r.name}: ${r.description || ''} ${r.formula || ''} ${r.value !== undefined ? '= ' + r.value : ''}`).join('\n')
                : 'Правила не найдены. Используй значения по умолчанию.';

            // Краткое описание позиций для контекста
            const itemsSummary = masterJson.map(item => {
                return `ID ${item.id}: ${item.tu_name || item.raw_name || 'Без имени'} (кол-во: ${item.qty || 1})`;
            }).join('\n');

            const prompt = `Ты — параметрический движок для расчёта термочехлов KORDA.
Твоя задача — на основе ПРАВИЛ КОНВЕЙЕРА определить параметры ценообразования для каждой позиции.

ПРАВИЛА КОНВЕЙЕРА:
${rulesText}

ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ (используй, если в правилах не указано иное):
- work_rate_sewing: 1000 ₽/м² (швея, от площади наружного слоя)
- work_rate_stuffing: 1000 ₽/м² (набивка, от площади утеплителя)
- sketch_cost: 350 ₽ за уникальную позицию
- thread_price_per_meter: 12.5 ₽/м (или из materials.thread_price позиции)
- allowance_factor: 1.3 (коэффициент припуска)
- markup_materials: 0.40 (наценка на материалы 40%)
- markup_work_base: 1.00 (наценка на работу при площади ≤2м² = 100%)
- markup_work_2m: 1.50 (наценка на работу при 2-4м² = 150%)
- markup_work_4m: 2.00 (наценка на работу при >4м² = 200%)
- vat_rate: 0.22 (НДС 22%)
- is_kzh: false (для КЗХ/защитных чехлов — true, тогда нет утеплителя и набивки)

ВАЖНО:
- Если название позиции содержит "КЗХ" или "защитный чехол" — is_kzh = true
- Для КЗХ: work_rate_stuffing = 0 (нет набивки)
- thread_price_per_meter берётся из правил, или fallback 12.5

ПОЗИЦИИ:
${itemsSummary}

Верни JSON-массив объектов:
[
  {
    "id": <число>,
    "pricing": {
      "work_rate_sewing": <число>,
      "work_rate_stuffing": <число>,
      "sketch_cost": <число>,
      "thread_price_per_meter": <число>,
      "allowance_factor": <число>,
      "markup_materials": <число>,
      "markup_work_base": <число>,
      "markup_work_2m": <число>,
      "markup_work_4m": <число>,
      "vat_rate": <число>,
      "is_kzh": <boolean>
    }
  }
]
`;

            const response = await ai.models.generateContent({
                model: 'gemini-3.5-flash',
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    maxOutputTokens: 8192,
                    temperature: 0.1,
                    responseMimeType: "application/json"
                }
            });

            let resultText = '';
            const candidateContent = response.candidates?.[0]?.content;
            if (candidateContent && candidateContent.parts) {
                resultText = candidateContent.parts.filter(p => p.text).map(p => p.text).join('').trim();
            } else if (typeof response.text === 'function') {
                try { resultText = response.text().trim(); } catch(e) {}
            } else if (response.text) {
                resultText = response.text.trim();
            }

            resultText = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();

            let parsedData = [];
            try {
                parsedData = JSON.parse(resultText);
            } catch (e) {
                console.warn('[AgentTools] resolve_parameters: не удалось распарсить JSON, пробуем исправить.');
                try {
                    let fixedJson = resultText;
                    const lastBraceIndex = fixedJson.lastIndexOf('}');
                    if (lastBraceIndex !== -1) {
                        fixedJson = fixedJson.substring(0, lastBraceIndex + 1) + ']';
                        parsedData = JSON.parse(fixedJson);
                    }
                } catch (e2) {
                    console.warn('[AgentTools] resolve_parameters: фоллбэк — используем значения по умолчанию для всех позиций.');
                    parsedData = masterJson.map(item => {
                        const nameToSearch = ((item.tu_name || '') + ' ' + (item.raw_name || '')).toLowerCase();
                        const isKzh = nameToSearch.includes('кзх') || nameToSearch.includes('защитный чехол');
                        return {
                            id: item.id,
                            pricing: {
                                work_rate_sewing: 1000,
                                work_rate_stuffing: isKzh ? 0 : 1000,
                                sketch_cost: 350,
                                thread_price_per_meter: item.materials?.thread_price || 12.5,
                                allowance_factor: 1.3,
                                markup_materials: 0.40,
                                markup_work_base: 1.00,
                                markup_work_2m: 1.50,
                                markup_work_4m: 2.00,
                                vat_rate: 0.22,
                                is_kzh: isKzh
                            }
                        };
                    });
                }
            }

            console.log(`[AgentTools] resolve_parameters RAW response length: ${resultText.length} chars`);
            console.log(`[AgentTools] resolve_parameters PARSED: ${parsedData.length} items`);
            if (parsedData.length > 0) {
                console.log(`[AgentTools] resolve_parameters SAMPLE[0]:`, JSON.stringify(parsedData[0]));
            }

            return {
                result: `Параметры ценообразования определены для ${parsedData.length} позиций на основе правил конвейера.`,
                data: parsedData,
                rawText: resultText
            };
        } catch (err) {
            console.error('[AgentTools] resolve_parameters error:', err);
            // Критический фоллбэк: вернуть значения по умолчанию, чтобы конвейер не остановился
            const masterJson = params.masterJson || [];
            const fallbackData = masterJson.map(item => {
                const nameToSearch = ((item.tu_name || '') + ' ' + (item.raw_name || '')).toLowerCase();
                const isKzh = nameToSearch.includes('кзх') || nameToSearch.includes('защитный чехол');
                return {
                    id: item.id,
                    pricing: {
                        work_rate_sewing: 1000,
                        work_rate_stuffing: isKzh ? 0 : 1000,
                        sketch_cost: 350,
                        thread_price_per_meter: item.materials?.thread_price || 12.5,
                        allowance_factor: 1.3,
                        markup_materials: 0.40,
                        markup_work_base: 1.00,
                        markup_work_2m: 1.50,
                        markup_work_4m: 2.00,
                        vat_rate: 0.22,
                        is_kzh: isKzh
                    }
                };
            });
            return {
                result: `Параметры ценообразования (фоллбэк) для ${fallbackData.length} позиций.`,
                data: fallbackData,
                error: err.message
            };
        }
    },

    /**
     * resolve_dimensions — ищет реальные габариты (L, H, вес) через Google Search Grounding.
     * Fallback: знания модели. Кэширует в Firestore (equipment_dimensions).
     * Определяет h_coefficient и shape по типу арматуры из coverage_coefficients.
     */
    resolve_dimensions: async (params, ai, modelName = 'gemini-3.5-flash') => {
        try {
            const masterJson = params.masterJson || [];

            // Skip for standard items
            const nonStandard = masterJson.filter(item => !item.is_standard);
            if (nonStandard.length === 0) {
                return { result: 'Все позиции стандартные — пропуск.', data: [] };
            }

            let db = null;
            try {
                const { getFirestore } = await import('firebase-admin/firestore');
                db = getFirestore();
            } catch (e) { console.warn('[resolve_dimensions] Cannot init Firestore:', e.message); }
            
            // Load coverage coefficients from Firestore (passed from proxy or fetched)
            let coverageCoeffs = params.coverageCoefficients || [];
            if (coverageCoeffs.length === 0 && db) {
                try {
                    const snap = await db.collection('coverage_coefficients').get();
                    coverageCoeffs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                } catch (e) { console.warn('[resolve_dimensions] Cannot load coverage_coefficients:', e.message); }
            }

            // Default coefficients if Firestore is empty
            if (coverageCoeffs.length === 0) {
                coverageCoeffs = [
                    { id: 'задвижка_клиновая', name: 'Задвижка клиновая', h_coefficient: 0.60, shape: 'cylinder', keywords: ['задвижка', '30с41нж', 'клиновая'] },
                    { id: 'задвижка_обрезин', name: 'Задвижка с обр. клином', h_coefficient: 0.60, shape: 'cylinder', keywords: ['rushwork 101', 'обрезинен'] },
                    { id: 'вентиль', name: 'Вентиль запорный', h_coefficient: 0.65, shape: 'cylinder', keywords: ['вентиль', 'rushwork 315'] },
                    { id: 'кран_шаровый', name: 'Кран шаровый', h_coefficient: 0.90, shape: 'cylinder', keywords: ['кран шаровый', 'кшцф', 'кшцфр'] },
                    { id: 'клапан_обратный', name: 'Клапан обратный', h_coefficient: 0.95, shape: 'cylinder', keywords: ['клапан обратный', 'коф'] },
                    { id: 'клапан_регулир', name: 'Клапан регулирующий', h_coefficient: 0.50, shape: 'cylinder', keywords: ['клапан регулир', '2крф', 'этра'] },
                    { id: 'компенсатор', name: 'Компенсатор', h_coefficient: 1.00, shape: 'cylinder', keywords: ['компенсатор', 'ксоф'] },
                    { id: 'фильтр', name: 'Фильтр', h_coefficient: 0.85, shape: 'cylinder', keywords: ['фильтр'] },
                    { id: 'расходомер', name: 'Расходомер', h_coefficient: 0.95, shape: 'cylinder', keywords: ['расходомер', 'питерфлоу'] },
                    { id: 'сепаратор', name: 'Сепаратор', h_coefficient: 0.90, shape: 'cylinder', keywords: ['сепаратор', 'flamcovent'] },
                ];
            }

            // Build reference table of coverage types for AI prompt
            const coeffRefTable = coverageCoeffs.map(c => `- ${c.name} (${(c.h_coefficient * 100).toFixed(0)}%, ${c.shape})`).join('\n');

            // Helper: find coefficient by name (AI picks the name)
            function findCoeffByName(typeName) {
                if (!typeName) return null;
                const lower = typeName.toLowerCase();
                // Exact match first
                for (const c of coverageCoeffs) {
                    if (c.name.toLowerCase() === lower) return c;
                }
                // Partial match (AI might abbreviate)
                for (const c of coverageCoeffs) {
                    if (lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower)) return c;
                }
                return null;
            }

            // Helper: parse dimensions from text
            function regexParse(text) {
                const clean = (text || '').replace(/\*\*/g, '').replace(/\$/g, '').replace(/\\/g, '');
                const p = (pats) => { for (const pat of pats) { const m = clean.match(pat); if (m) return parseFloat(m[1].replace(',', '.')); } return null; };
                return {
                    L: p([/(?:строительн[а-яё]*\s+)?длин[а-яё]*[^\d]{0,50}?(\d{2,4})\s*мм/i, /\bL\b[^\d]{0,20}?(\d{2,4})\s*мм/i, /\bL\s*[=:]\s*(\d{2,4})/i]),
                    H: p([/(?:строительн[а-яё]*\s+)?высот[а-яё]*[^\d]{0,50}?(\d{2,4})\s*мм/i, /габаритн[а-яё]*\s+высот[а-яё]*[^\d]{0,50}?(\d{2,4})/i, /\bH\b[^\d]{0,20}?(\d{2,4})\s*мм/i, /\bH\s*[=:]\s*(\d{2,4})/i]),
                };
            }

            // Parse equipment type from AI response
            function parseEquipmentType(text) {
                const m = (text || '').match(/ТИП[:\s]*([^\n,;]+)/i) || (text || '').match(/тип\s+арматуры[:\s]*([^\n,;]+)/i);
                return m ? m[1].trim() : null;
            }

            // Build search query from item name
            function buildQuery(item) {
                const name = (item.raw_name || item.tu_name || '').replace('Изоляция съемная_', '').replace(/\([^)]*\)/g, '').trim();
                return name;
            }

            // Cache key from query
            function cacheKey(query) {
                return query.toLowerCase().replace(/[^а-яёa-z0-9]+/g, '_').substring(0, 80);
            }

            // Process items with concurrency
            const CONCURRENCY = 5;
            const results = [];
            let idx = 0;

            async function worker() {
                while (idx < masterJson.length) {
                    const i = idx++;
                    const item = masterJson[i];
                    const query = buildQuery(item);
                    const key = cacheKey(query);

                    let dims = { L: null, H: null, method: 'none', confidence: 0, sources: [], equipmentType: null };
                    let searchContributed = false;

                    // Step 1: Check Firestore cache
                    if (db) {
                        try {
                            const cached = await db.collection('equipment_dimensions').doc(key).get();
                            if (cached.exists) {
                                const d = cached.data();
                                dims = { L: d.L_mm, H: d.H_mm, method: 'cache', confidence: d.confidence || 95, sources: d.sources || [], equipmentType: d.equipment_type || null };
                            }
                        } catch (e) { /* cache miss */ }
                    }

                    // Step 2: Google Search + AI type classification (combined)
                    if (!dims.L || !dims.H) {
                        try {
                            const prompt = `Найди габаритные размеры: ${query}

Ответь СТРОГО в формате:
L = [число] мм (строительная длина)
H = [число] мм (строительная высота)
ТИП: [название из списка ниже]

Список типов арматуры (выбери ОДИН наиболее подходящий):
${coeffRefTable}

Если ни один тип не подходит, напиши: ТИП: Другое`;

                            const res = await ai.models.generateContent({
                                model: 'gemini-3.5-flash',
                                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                                config: { tools: [{ googleSearch: {} }], temperature: 0.0, maxOutputTokens: 4096 }
                            });
                            const text = (res.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
                            const sources = res.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.title).filter(Boolean) || [];
                            const parsed = regexParse(text);
                            if (parsed.L) { dims.L = parsed.L; searchContributed = true; }
                            if (parsed.H) { dims.H = parsed.H; searchContributed = true; }
                            if (parsed.L && parsed.H) { dims.method = 'search'; dims.confidence = 2; }
                            dims.sources = sources;
                            dims.equipmentType = parseEquipmentType(text);
                        } catch (e) { console.warn(`[resolve_dimensions] Search failed for #${item.id}:`, e.message); }
                    }

                    // Step 3: Model knowledge fallback
                    if (!dims.L || !dims.H) {
                        try {
                            const prompt2 = `Типовые размеры ${query}: L = ? мм, H = ? мм.
Также определи ТИП арматуры из списка: ${coverageCoeffs.map(c => c.name).join(', ')}
Ответь: L = [число] мм, H = [число] мм, ТИП: [название]`;

                            const res = await ai.models.generateContent({
                                model: 'gemini-3.1-flash-lite',
                                contents: [{ role: 'user', parts: [{ text: prompt2 }] }],
                                config: { temperature: 0.3, maxOutputTokens: 512 }
                            });
                            const text = (res.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
                            const parsed = regexParse(text);
                            if (!dims.L && parsed.L) dims.L = parsed.L;
                            if (!dims.H && parsed.H) dims.H = parsed.H;
                            if (!dims.equipmentType) dims.equipmentType = parseEquipmentType(text);
                            if (dims.L && dims.H) {
                                dims.method = searchContributed ? 'search+knowledge' : 'knowledge';
                                dims.confidence = searchContributed ? 5 : 10;
                            }
                        } catch (e) { console.warn(`[resolve_dimensions] Knowledge failed for #${item.id}:`, e.message); }
                    }

                    // Step 4: DN fallback (грубая формула как последний вариант)
                    if (!dims.L || !dims.H) {
                        const nameStr = (item.raw_name || '') + ' ' + (item.tu_name || '');
                        const duMatch = nameStr.match(/Ду\s*(\d+)/i) || nameStr.match(/-(\d+)-/);
                        if (duMatch) {
                            const dn = parseInt(duMatch[1], 10);
                            if (!dims.L) dims.L = Math.round(dn * 3.5); // эмпирика L ≈ 3.5×DN
                            if (!dims.H) dims.H = Math.round(dn * 2.5); // эмпирика H ≈ 2.5×DN
                            dims.method = 'dn_fallback';
                            dims.confidence = 30;
                        }
                    }

                    // Resolve coefficient: AI-determined type → lookup in coverageCoeffs
                    const coeff = findCoeffByName(dims.equipmentType) || { h_coefficient: 0.75, shape: 'cylinder', name: dims.equipmentType || 'Не определён' };

                    // Save to Firestore cache (including equipment_type and raw_name)
                    if (db && dims.L && dims.H && dims.method !== 'cache') {
                        try {
                            await db.collection('equipment_dimensions').doc(key).set({
                                query, raw_name: item.raw_name || item.tu_name || query,
                                L_mm: dims.L, H_mm: dims.H,
                                sources: dims.sources, method: dims.method, confidence: dims.confidence,
                                equipment_type: coeff.name,
                                foundAt: new Date().toISOString().split('T')[0]
                            });
                        } catch (e) { /* cache write fail is non-critical */ }
                    }

                    results[i] = {
                        id: item.id,
                        dimensions: {
                            L_mm: dims.L, H_mm: dims.H,
                            h_coefficient: coeff.h_coefficient,
                            shape: coeff.shape || 'cylinder',
                            equipment_type: coeff.name,
                            method: dims.method, confidence: dims.confidence
                        }
                    };
                }
            }

            await Promise.all(Array(CONCURRENCY).fill().map(() => worker()));

            const found = results.filter(r => r.dimensions?.L_mm && r.dimensions?.H_mm).length;
            console.log(`[resolve_dimensions] ${found}/${results.length} positions resolved`);

            return {
                status: 'success',
                data: results,
                result: `Найдены габариты для ${found}/${results.length} позиций (Search + Knowledge + DN fallback).`
            };
        } catch (err) {
            console.error('[AgentTools] resolve_dimensions error:', err);
            return { error: err.message };
        }
    },

    calculate_geometry: (params) => {
        try {
            const masterJson = params.masterJson || [];

            // Skip for standard items
            const nonStandard = masterJson.filter(item => !item.is_standard);
            if (nonStandard.length === 0) {
                return { result: 'Все позиции стандартные — пропуск.', data: [] };
            }

            const data = masterJson.map(item => {
                let area = 0.5; // Default fallback

                const dims = item.dimensions || {};
                const L_mm = dims.L_mm || 0;
                const H_mm = dims.H_mm || 0;
                const hCoeff = dims.h_coefficient || 0.75;
                const shape = dims.shape || 'cylinder';

                if (L_mm > 0 && H_mm > 0) {
                    const H_eff = H_mm * hCoeff; // Высота за вычетом маховика/штурвала
                    const L_m = L_mm / 1000;
                    const H_m = H_eff / 1000;

                    if (shape === 'cylinder') {
                        // Площадь изоляции цилиндра: π × D × L (развёртка боковой)
                        // D = H_eff (внешний диаметр корпуса ≈ высота/диаметр)
                        // + 2 торцевых круга (π × r²)
                        const D = H_m;
                        area = Math.PI * D * L_m + 2 * Math.PI * (D / 2) * (D / 2);
                    } else {
                        // Куб/параллелепипед: 2(LH + LW + HW), W ≈ H для арматуры
                        const W_m = H_m; // Ширина ≈ высота для типовой арматуры
                        area = 2 * (L_m * H_m + L_m * W_m + H_m * W_m);
                    }
                } else {
                    // Legacy fallback: Ду × 0.008
                    const nameToSearch = (item.raw_name || '') + ' ' + (item.tu_name || '');
                    const duMatch = nameToSearch.match(/Ду\s*(\d+)/i) || nameToSearch.match(/-(\d+)-/);
                    if (duMatch && duMatch[1]) {
                        area = parseInt(duMatch[1], 10) * 0.008;
                    }
                }

                // Используем allowance_factor из pricing (resolve_parameters) или 1.3 по умолчанию
                const allowance_factor = item.pricing?.allowance_factor || 1.3;
                const area_with_allowance = +(area * allowance_factor).toFixed(3);

                return {
                    id: item.id,
                    geometry: {
                        area: +area.toFixed(4),
                        allowance_factor: allowance_factor,
                        area_with_allowance: area_with_allowance,
                        formula: (L_mm > 0 && H_mm > 0) ? shape : 'dn_fallback',
                        L_mm: L_mm || undefined,
                        H_mm: H_mm || undefined,
                        h_coefficient: hCoeff
                    }
                };
            });

            return {
                status: 'success',
                action: 'ready_for_pricing',
                data: data,
                result: `Рассчитана геометрия (площадь и припуски) для ${data.length} позиций.`
            };
        } catch (err) {
            console.error('[AgentTools] calculate_geometry error:', err);
            return { error: err.message };
        }
    },

    /**
     * build_tu_name — PURE DETERMINISTIC function (no AI).
     * Builds the product name (tu_name) from collected data:
     * equipment_type, dn, temperature, insulation_thickness, coverage_coefficients.
     */
    build_tu_name: async (params) => {
        try {
            const masterJson = params.masterJson || [];

            // Skip for standard items
            const nonStandard = masterJson.filter(item => !item.is_standard);
            if (nonStandard.length === 0) {
                return { result: 'Все позиции стандартные — пропуск.', data: [] };
            }

            let coverageCoeffs = params.coverageCoefficients || [];

            // Load coverage_coefficients from Firestore if not passed
            if (coverageCoeffs.length === 0) {
                let db = null;
                try {
                    const { getFirestore } = await import('firebase-admin/firestore');
                    db = getFirestore();
                } catch (e) { console.warn('[build_tu_name] Cannot init Firestore:', e.message); }

                if (db) {
                    try {
                        const snap = await db.collection('coverage_coefficients').get();
                        coverageCoeffs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    } catch (e) { console.warn('[build_tu_name] Cannot load coverage_coefficients:', e.message); }
                }
            }

            // Built-in defaults for abbreviation/series (Firestore overrides these)
            const defaultAbbreviations = {
                'вентиль запорный': { abbreviation: 'В', series: 'ТА' },
                'задвижка клиновая': { abbreviation: 'З', series: 'ТА' },
                'задвижка': { abbreviation: 'З', series: 'ТА' },
                'задвижка с обр. клином': { abbreviation: 'З', series: 'ТА' },
                'фильтр': { abbreviation: 'Ф', series: 'ТА' },
                'кран шаровый': { abbreviation: 'КШ', series: 'ТА' },
                'затвор дисковый': { abbreviation: 'ЗД', series: 'ТА' },
                'клапан обратный': { abbreviation: 'ОКП', series: 'ТА' },
                'клапан обратный поворотный': { abbreviation: 'ОКП', series: 'ТА' },
                'клапан обратный межфланцевый': { abbreviation: 'ОКМ', series: 'ТА' },
                'фланцевое соединение': { abbreviation: 'ФС', series: 'ТА' },
                'расходомер': { abbreviation: 'РС', series: 'ТА' },
                'клапан балансировочный': { abbreviation: 'КБ', series: 'ТА' },
                'конденсатоотводчик': { abbreviation: 'КО', series: 'ТА' },
                'клапан трехходовой': { abbreviation: 'КТ', series: 'ТА' },
                'компенсатор': { abbreviation: 'КС', series: 'ТА' },
                'клапан предохранительный': { abbreviation: 'КП', series: 'ТА' },
                'клапан регулирующий': { abbreviation: 'РД', series: 'ТА' },
                'регулятор давления': { abbreviation: 'РД', series: 'ТА' },
                'манометр': { abbreviation: '', series: 'КИП' },
                'термометр': { abbreviation: '', series: 'КИП' },
                'уровнемер': { abbreviation: '', series: 'КИП' },
                'теплообменник': { abbreviation: '', series: 'ТО' },
                'насос': { abbreviation: '', series: 'СК' },
                'ёмкость': { abbreviation: '', series: 'СК' },
                'сепаратор': { abbreviation: '', series: 'ТА' },
            };

            const data = masterJson.map(item => {
                // Find equipment type in coverage_coefficients for abbreviation and series
                const eqType = (item.equipment_type || '').toLowerCase();
                let matched = coverageCoeffs.find(c => (c.name || '').toLowerCase().includes(eqType));
                if (!matched && eqType) {
                    matched = coverageCoeffs.find(c => eqType.includes((c.name || '').toLowerCase().split(' ')[0]));
                }

                // Use Firestore abbreviation/series if set, otherwise fall back to built-in defaults
                const defaults = defaultAbbreviations[eqType] || {};
                const abbreviation = matched?.abbreviation || defaults.abbreviation || '';
                const series = matched?.series || defaults.series || 'ТА';
                const dn = item.dn || item.geometry?.dn;
                const thickness = item.materials?.insulation_thickness || 50;
                const temp = item.temperature || 200;
                const area = item.geometry?.area;
                const isKzh = item.pricing?.is_kzh || item.is_kzh || false;

                let tu_name;

                if (isKzh) {
                    tu_name = `Кожух защитный химстойкий КЗХ-С-${dn || ''} для ${item.equipment_type || 'оборудования'}`;
                } else if (series === 'ТО' || series === 'СК') {
                    tu_name = `Термочехол КОРДА ЧСТЭ-${temp} ${series}-${thickness}`;
                    if (area) tu_name += ` (S=${area})`;
                    if (item.equipment_model) tu_name += ` ${item.equipment_model}`;
                } else if (series === 'КИП') {
                    tu_name = `Термочехол КОРДА ЧСТЭ-${temp} КИП-${thickness}`;
                    if (item.equipment_model) tu_name += ` ${item.equipment_model}`;
                } else {
                    // ТА or У — standard valve/fitting naming
                    tu_name = `Термочехол КОРДА ЧСТЭ-${temp} ${series} ${abbreviation}-${dn || '0'}-${thickness}`;
                }

                return { id: item.id, tu_name };
            });

            return {
                result: `Сформированы наименования по ТУ для ${data.length} позиций.`,
                data
            };
        } catch (err) {
            console.error('[AgentTools] build_tu_name error:', err);
            return { error: err.message };
        }
    },
    
    calculate_cost: (params) => {
        try {
            const masterJson = params.masterJson || [];
            
            const totalPositions = masterJson.length || 1;
            
            const data = masterJson.map(item => {
                const qty = parseInt(item.qty || 1, 10);
                const pricing = item.pricing || {};
                
                // --- Determine areas: standard consumption vs geometry fallback ---
                let area_outer, area_inner, area_insul, area_sewing, area_stuffing;
                let area, area_with_allowance;
                
                if (item.is_standard === true && item.consumption) {
                    // Standard items: use pre-computed consumption from lookup_standard
                    area_outer = item.consumption.outer_m2;
                    area_inner = item.consumption.inner_m2;
                    area_insul = item.consumption.insul_m2;
                    area_sewing = item.consumption.outer_m2;
                    area_stuffing = item.consumption.insul_m2;
                    // For thread/markup calculations, use outer as the reference area
                    area = item.consumption.outer_m2;
                    area_with_allowance = item.consumption.outer_m2; // already includes allowance in standard table
                } else {
                    // Non-standard: use geometry-based area (existing logic)
                    area = item.geometry?.area || 0.5;
                    area_with_allowance = item.geometry?.area_with_allowance || 0.65;
                    area_outer = area_with_allowance;
                    area_inner = area_with_allowance;
                    area_insul = area_with_allowance;
                    area_sewing = area;
                    area_stuffing = area;
                }
                
                // --- Ставки работ из resolve_parameters ---
                const work_rate_sewing = pricing.work_rate_sewing || 1000;
                const work_rate_stuffing = pricing.is_kzh ? 0 : (pricing.work_rate_stuffing || 1000);
                const sketch_cost = pricing.sketch_cost || 350;
                const thread_price = pricing.thread_price_per_meter || item.materials?.thread_price || 12.5;
                
                // --- Материалы ---
                const outer_price = item.materials?.outer_price || 500;
                const inner_price = item.materials?.inner_price || 500;
                // Для КЗХ нет утеплителя
                const insulation_price = pricing.is_kzh ? 0 : (item.materials?.insulation_price || 500);
                
                const materials_total = +(
                    area_outer * outer_price +
                    area_inner * inner_price +
                    area_insul * insulation_price
                ).toFixed(2);
                
                // --- Работа: пошив от площади наружного слоя, набивка от площади утеплителя ---
                const sewing_total = +(area_sewing * work_rate_sewing).toFixed(2);
                const stuffing_total = +(area_stuffing * work_rate_stuffing).toFixed(2);
                const work_total = +(sewing_total + stuffing_total).toFixed(2);
                
                // --- Нитки: 6м на 1м² базовой площади ---
                const thread_length = +(area * 6).toFixed(1);
                const thread_total = +(thread_length * thread_price).toFixed(2);
                
                // --- Эскиз: разовая стоимость, размазанная по всем позициям ---
                const sketch_per_position = +(sketch_cost / totalPositions).toFixed(2);
                
                // --- Себестоимость 1 шт (включая долю эскиза) ---
                const cost_1_pcs = +(materials_total + work_total + thread_total + sketch_per_position).toFixed(2);
                
                // --- Наценки (раздельные для материалов и работы) ---
                const markup_materials = pricing.markup_materials || 0.40;
                // Наценка на работу зависит от площади
                let markup_work = pricing.markup_work_base || 1.00;
                if (area > 4) markup_work = pricing.markup_work_4m || 2.00;
                else if (area > 2) markup_work = pricing.markup_work_2m || 1.50;
                
                const price_materials = +(materials_total * (1 + markup_materials)).toFixed(2);
                const price_work = +(work_total * (1 + markup_work)).toFixed(2);
                const price_thread = thread_total; // без наценки на нитки
                const price_1_pcs = +(price_materials + price_work + price_thread).toFixed(2);
                
                // --- Итого по строке (отпускная цена) ---
                const row_total_no_vat = +(price_1_pcs * qty + sketch_per_position).toFixed(2);
                const vat_rate = pricing.vat_rate || 0.22;
                const row_total_with_vat = +(row_total_no_vat * (1 + vat_rate)).toFixed(2);
                
                return {
                    id: item.id,
                    cost: {
                        // Себестоимость
                        materials_total,
                        sewing_total,
                        stuffing_total,
                        work_total,
                        thread_length,
                        thread_price,
                        thread_total,
                        cost_1_pcs,
                        sketch_cost: sketch_per_position,
                        // Отпускная цена
                        markup_materials,
                        markup_work,
                        price_materials,
                        price_work,
                        price_thread,
                        price_1_pcs,
                        row_total_no_vat,
                        vat_rate,
                        row_total_with_vat
                    }
                };
            });

            return {
                status: 'success',
                action: 'ready_for_commercial',
                data: data,
                result: `Рассчитана себестоимость и отпускная цена для ${data.length} позиций (правила из resolve_parameters).`
            };
        } catch (err) {
            console.error('[AgentTools] calculate_cost error:', err);
            return { error: err.message };
        }
    },
    
    calculate_commercial: (params) => {
        const masterJson = params.masterJson || [];
        
        // Рассчитываем РЕАЛЬНЫЕ итоги из фактических полей себестоимости
        const totalItems = masterJson.length;
        const totalArea = masterJson.reduce((acc, i) => acc + ((i.geometry?.area || 0) * (i.qty || 1)), 0);
        const totalMaterials = masterJson.reduce((acc, i) => acc + ((i.cost?.materials_total || 0) * (i.qty || 1)), 0);
        const totalSewing = masterJson.reduce((acc, i) => acc + ((i.cost?.sewing_total || 0) * (i.qty || 1)), 0);
        const totalStuffing = masterJson.reduce((acc, i) => acc + ((i.cost?.stuffing_total || 0) * (i.qty || 1)), 0);
        const totalWork = masterJson.reduce((acc, i) => acc + ((i.cost?.work_total || 0) * (i.qty || 1)), 0);
        const totalThread = masterJson.reduce((acc, i) => acc + ((i.cost?.thread_total || 0) * (i.qty || 1)), 0);
        const totalSketch = masterJson.reduce((acc, i) => acc + (i.cost?.sketch_cost || 0), 0);
        const totalCostNoVat = totalMaterials + totalWork + totalThread + totalSketch;
        
        // Итоги по отпускной цене
        const totalPriceMaterials = masterJson.reduce((acc, i) => acc + ((i.cost?.price_materials || 0) * (i.qty || 1)), 0);
        const totalPriceWork = masterJson.reduce((acc, i) => acc + ((i.cost?.price_work || 0) * (i.qty || 1)), 0);
        const totalRowNoVat = masterJson.reduce((acc, i) => acc + (i.cost?.row_total_no_vat || 0), 0);
        const totalRowWithVat = masterJson.reduce((acc, i) => acc + (i.cost?.row_total_with_vat || 0), 0);
        
        let exampleFormulas = "";
        if (masterJson.length > 0) {
            const f = masterJson[0];
            const area = f.geometry?.area || 0;
            const areaAllowance = f.geometry?.area_with_allowance || 0;
            const factor = f.geometry?.allowance_factor || 1.3;
            const c = f.cost || {};
            const p = f.pricing || {};
            exampleFormulas = `
ПРИМЕР РАСЧЁТА (позиция №1 — "${f.tu_name || f.raw_name}"):
• Материалы: ${f.materials?.outer} (${f.materials?.outer_price} ₽/м²) + ${f.materials?.inner} (${f.materials?.inner_price} ₽/м²)${p.is_kzh ? '' : ` + ${f.materials?.insulation} (${f.materials?.insulation_price} ₽/м²)`}
• Базовая площадь: ${area} м²
• Коэф. припуска: ${factor} → расчётная площадь: ${area} × ${factor} = ${areaAllowance} м²
• Стоимость материалов = ${areaAllowance} м² × (сумма цен/м²) = ${c.materials_total} ₽
• Пошив (швея) = ${area} м² × ${p.work_rate_sewing || 1000} ₽/м² = ${c.sewing_total} ₽
• Набивка = ${area} м² × ${p.work_rate_stuffing || 1000} ₽/м² = ${c.stuffing_total} ₽ ${p.is_kzh ? '(КЗХ — нет набивки)' : ''}
• Нитки = ${area} м² × 6 м/м² = ${c.thread_length} м × ${c.thread_price} ₽/м = ${c.thread_total} ₽
• Себестоимость 1 шт = ${c.materials_total} + ${c.work_total} + ${c.thread_total} = ${c.cost_1_pcs} ₽
• Наценка мат.: ${((c.markup_materials || 0.4) * 100).toFixed(0)}% → цена мат. = ${c.price_materials} ₽
• Наценка работы: ${((c.markup_work || 1.0) * 100).toFixed(0)}% → цена работы = ${c.price_work} ₽
• Отпускная цена 1 шт = ${c.price_1_pcs} ₽
• Эскиз: ${c.sketch_cost} ₽ (единоразово за позицию)
• Итого без НДС: ${c.row_total_no_vat} ₽
• НДС ${((c.vat_rate || 0.22) * 100).toFixed(0)}%: итого с НДС = ${c.row_total_with_vat} ₽`;
        }
        
        return {
            status: 'success',
            action: 'ready_for_commercial',
            result: `Синтезатор, данные готовы.

СВОДКА ПО ПРОЕКТУ:
- Количество позиций: ${totalItems}
- Общая площадь (с учетом тиражей): ${totalArea.toFixed(2)} м²
- Итого себестоимость материалов: ${totalMaterials.toFixed(2)} ₽
- Итого пошив (швея): ${totalSewing.toFixed(2)} ₽
- Итого набивка: ${totalStuffing.toFixed(2)} ₽
- Итого работа: ${totalWork.toFixed(2)} ₽
- Итого нитки: ${totalThread.toFixed(2)} ₽
- Итого эскизы: ${totalSketch.toFixed(2)} ₽
- ОБЩАЯ СЕБЕСТОИМОСТЬ (БЕЗ НДС): ${totalCostNoVat.toFixed(2)} ₽
- ИТОГО ОТПУСКНАЯ БЕЗ НДС: ${totalRowNoVat.toFixed(2)} ₽
- ИТОГО С НДС: ${totalRowWithVat.toFixed(2)} ₽

${exampleFormulas}

Твоя задача — сгенерировать два разных текста в одном ответе, разделив их ровно одной строкой '---SPLIT---'.
ТЕКСТ 1 (До разделителя): Внутренний отчет для сметчика. 
  - Укажи точную сводку из данных выше (кол-во позиций, площадь, итоги по статьям расходов, общую себестоимость и отпускную цену). Цифры бери ТОЛЬКО из сводки, не придумывай.
  - Опиши формулы расчёта на примере первой позиции (данные выше). Покажи каждый шаг с числами.
  - НЕ ПЕРЕЧИСЛЯЙ все позиции — только пример первой и общие итоги.

ТЕКСТ 2 (После разделителя): Чистовое сопроводительное письмо для клиента (коммерческое предложение, 2-3 абзаца). В нем не упоминай себестоимость материалов или работы.
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО выводить списком сами позиции! Все позиции прикреплены отдельными таблицами автоматически.`
        };
    }
};

/**
 * Main execution router for tools.
 */
export const executeAgentTool = async (functionName, args, ai, modelName) => {
    if (!tools[functionName]) {
        return { error: `Function ${functionName} is not implemented on the server.` };
    }
    
    console.log(`[Agent Tool Executing] ${functionName} with args:`, args);
    const result = await tools[functionName](args, ai, modelName); // Ensure await for async tools
    console.log(`[Agent Tool Result] ${functionName} =>`, result);
    
    return result;
};

