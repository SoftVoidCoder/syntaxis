// Checko.ru API proxy — looks up company data by INN or name from EGRUL
// Env: CHECKO_API_KEY

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.CHECKO_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'CHECKO_API_KEY not configured' });
    }

    const { inn, query } = req.body;
    if (!inn && !query) {
        return res.status(400).json({ error: 'INN or query is required' });
    }

    try {
        let url;

        if (inn) {
            // INN lookup — exact match
            const cleanInn = String(inn).replace(/\D/g, '');
            if (cleanInn.length !== 10 && cleanInn.length !== 12) {
                return res.status(200).json({
                    found: false,
                    inn: cleanInn,
                    error: `Invalid INN length: ${cleanInn.length}. Expected 10 or 12.`
                });
            }
            console.log(`[Checko] Looking up INN: ${cleanInn}`);
            url = `https://api.checko.ru/v2/company?key=${apiKey}&inn=${cleanInn}`;
        } else {
            // Name search — strip legal form prefixes for better results
            let cleanQuery = String(query).trim();
            // Remove quotes
            cleanQuery = cleanQuery.replace(/[«»"""'']/g, '').trim();
            // Strip common legal form prefixes (case-insensitive)
            cleanQuery = cleanQuery.replace(/^(ПАО|ООО|АО|ЗАО|ОАО|НАО|ИП|ФГУП|МУП|ГУП|НКО|АНО)\s+/i, '').trim();
            console.log(`[Checko] Searching by name: "${cleanQuery}" (original: "${query}")`);
            // CRITICAL: by=name and obj=org are REQUIRED parameters for /v2/search
            url = `https://api.checko.ru/v2/search?key=${apiKey}&by=name&obj=org&active=true&query=${encodeURIComponent(cleanQuery)}`;
        }

        const response = await fetch(url);

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Checko] API Error ${response.status}: ${errText}`);
            return res.status(200).json({
                found: false,
                inn: inn || null,
                query: query || null,
                error: `Checko API error: ${response.status}`
            });
        }

        const data = await response.json();

        // For INN lookup: data.data is the company object
        if (inn) {
            if (!data || !data.data) {
                console.log(`[Checko] No company found for INN ${inn}`);
                return res.status(200).json({
                    found: false,
                    inn: inn,
                    message: 'Организация с таким ИНН не найдена в ЕГРЮЛ'
                });
            }
            console.log(`[Checko] Found company for INN ${inn}`);
            return res.status(200).json({
                found: true,
                inn: inn,
                data: data.data
            });
        }

        // For name search: response has { data: { СтрВсего, СтрТекущ, Записи: [...] } }
        if (query) {
            const searchData = data?.data;
            const records = searchData?.Записи || (Array.isArray(searchData) ? searchData : null);
            if (!records || (Array.isArray(records) && records.length === 0)) {
                console.log(`[Checko] No results for query "${query}"`);
                return res.status(200).json({
                    found: false,
                    query: query,
                    message: `Организация по запросу "${query}" не найдена`
                });
            }
            // Return top results (max 5)
            const items = Array.isArray(records) ? records.slice(0, 5) : [records];
            console.log(`[Checko] Found ${items.length} result(s) for "${query}"`);
            return res.status(200).json({
                found: true,
                query: query,
                count: items.length,
                data: items
            });
        }

    } catch (error) {
        console.error(`[Checko] Request failed:`, error);
        return res.status(200).json({
            found: false,
            inn: inn || null,
            query: query || null,
            error: `Request failed: ${error.message}`
        });
    }
}
