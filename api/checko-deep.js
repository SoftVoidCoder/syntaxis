// Checko.ru API proxy — Deep company analysis (finances, contracts, history)
// Uses /v2/company with expanded datasets
// Env: CHECKO_API_KEY

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const apiKey = process.env.CHECKO_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'CHECKO_API_KEY not configured' });
    }

    const { inn } = req.body;
    if (!inn) {
        return res.status(400).json({ error: 'INN is required for deep analysis' });
    }

    const cleanInn = String(inn).replace(/\D/g, '');
    console.log(`[Checko-Deep] Full analysis for INN: ${cleanInn}`);

    try {
        // Fetch company with ALL available datasets
        // Available datasets: Бух (finance), Госзакупки (public procurement), ОКВЭД (activities)
        const url = `https://api.checko.ru/v2/company?key=${apiKey}&inn=${cleanInn}`;
        const companyRes = await fetch(url);

        if (!companyRes.ok) {
            const errText = await companyRes.text();
            console.error(`[Checko-Deep] Company API Error ${companyRes.status}: ${errText}`);
            return res.status(200).json({ found: false, inn: cleanInn, error: `API error: ${companyRes.status}` });
        }

        const companyData = await companyRes.json();
        if (!companyData || !companyData.data) {
            return res.status(200).json({ found: false, inn: cleanInn, message: 'Организация не найдена' });
        }

        const result = {
            company: companyData.data,
            finances: null,
            contracts: null,
        };

        // Fetch financial reports (/v2/finances)
        try {
            const buhUrl = `https://api.checko.ru/v2/finances?key=${apiKey}&inn=${cleanInn}`;
            const buhRes = await fetch(buhUrl);
            if (buhRes.ok) {
                const buhData = await buhRes.json();
                if (buhData?.data) result.finances = buhData.data;
            }
        } catch (e) {
            console.warn(`[Checko-Deep] Buh fetch failed:`, e.message);
        }

        // Fetch government contracts (/v2/contracts)
        try {
            const contracts = [];
            const laws = ['44', '223', '94'];
            const roles = ['supplier', 'customer'];
            const ogrnParam = result.company?.ОГРН ? `ogrn=${result.company.ОГРН}` : `inn=${cleanInn}`;

            // Create an array of fetch promises for all combinations
            const promises = [];
            for (const role of roles) {
                for (const law of laws) {
                    const url = `https://api.checko.ru/v2/contracts?key=${apiKey}&${ogrnParam}&law=${law}&role=${role}`;
                    promises.push(
                        fetch(url).then(async (res) => {
                            if (res.ok) {
                                const data = await res.json();
                                if (data?.data?.Записи && Array.isArray(data.data.Записи)) {
                                    return {
                                        role,
                                        law,
                                        total: data.data.ЗапВсего || data.data.Записи.length,
                                        items: data.data.Записи.slice(0, 10) // Limit to 10 most recent per category to save AI context
                                    };
                                }
                            }
                            return null;
                        }).catch(() => null)
                    );
                }
            }

            const results = await Promise.all(promises);
            for (const r of results) {
                if (r && r.items.length > 0) {
                    contracts.push({
                        Тип: r.role === 'supplier' ? 'Исполнитель/Поставщик' : 'Заказчик',
                        ФЗ: `${r.law}-ФЗ`,
                        ВсегоКонтрактов: r.total,
                        Примеры: r.items
                    });
                }
            }

            if (contracts.length > 0) {
                result.contracts = contracts;
            }
        } catch (e) {
            console.warn(`[Checko-Deep] Contracts fetch block failed:`, e.message);
        }

        // Generate checko.ru profile link
        const cyrillicToLatin = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
            'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
            'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
            'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
            'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        const name = result.company?.НаимСокр || result.company?.НаимПолн || '';
        const ogrn = result.company?.ОГРН || cleanInn;
        let slug = name.toLowerCase()
            .replace(/["«»']/g, '')
            .replace(/[^а-яa-z0-9\s-]/g, ' ')
            .trim()
            .replace(/\s+/g, '-')
            .split('').map(char => cyrillicToLatin[char] || char).join('');

        const checkoLink = slug ? `https://checko.ru/company/${slug}-${ogrn}` : `https://checko.ru/company/${ogrn}`;

        console.log(`[Checko-Deep] Analysis complete for INN ${cleanInn}: Link=${checkoLink}`);

        return res.status(200).json({
            found: true,
            inn: cleanInn,
            checkoLink,
            data: result
        });

    } catch (error) {
        console.error(`[Checko-Deep] Request failed:`, error);
        return res.status(200).json({
            found: false,
            inn: cleanInn,
            error: `Request failed: ${error.message}`
        });
    }
}
