import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_QUERIES = 6;
const clean = (value = '') => String(value).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

const parseMoney = (value) => {
    const text = clean(value).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const amount = Number.parseFloat(text);
    return Number.isFinite(amount) ? amount : 0;
};

const parseRussianDate = (value) => {
    const text = clean(value);
    if (!text) return null;
    const direct = new Date(text);
    if (!Number.isNaN(direct.getTime())) return direct.toISOString();
    const numeric = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (numeric) {
        const [, day, month, year, hour = '0', minute = '0'] = numeric;
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)).toISOString();
    }
    const months = { января: 0, февраля: 1, марта: 2, апреля: 3, мая: 4, июня: 5, июля: 6, августа: 7, сентября: 8, октября: 9, ноября: 10, декабря: 11 };
    const named = text.toLowerCase().match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/i);
    if (named && months[named[2]] !== undefined) {
        return new Date(Number(named[3]), months[named[2]], Number(named[1]), Number(named[4] || 0), Number(named[5] || 0)).toISOString();
    }
    return null;
};

async function fetchText(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, { headers: { Accept: 'text/html,application/json', 'User-Agent': USER_AGENT }, signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
    } finally { clearTimeout(timeout); }
}

function queryList(input = {}) {
    const raw = [input.query, ...(Array.isArray(input.keywords) ? input.keywords : [])].map(clean).filter(Boolean);
    const unique = [...new Map(raw.map(item => [item.toLowerCase(), item])).values()];
    return (unique.length ? unique : ['теплоизоляция', 'изоляционные материалы', 'тканевые компенсаторы', 'противопожарная защита']).slice(0, MAX_QUERIES);
}

function makeTender(source, sourceId, fields) {
    const purchaseNumber = clean(fields.purchaseNumber || sourceId);
    return {
        id: `${source}:${sourceId}`, source, sourceLabel: fields.sourceLabel, purchaseNumber,
        name: clean(fields.name) || 'Без наименования',
        customer: fields.customer ? { fullName: clean(fields.customer.fullName), inn: clean(fields.customer.inn) } : null,
        price: Number(fields.price) || 0, status: clean(fields.status) || 'Подача заявок',
        applicationEndDate: fields.applicationEndDate || null, publishedAt: fields.publishedAt || null,
        law: clean(fields.law), region: clean(fields.region), link: fields.link, epUri: fields.link,
        description: clean(fields.description || fields.name), deliveryPlace: clean(fields.deliveryPlace || fields.region),
    };
}

async function searchRoseltorg(query) {
    const url = new URL('https://www.roseltorg.ru/procedures/search');
    url.searchParams.set('query_field', query);
    const $ = cheerio.load(await fetchText(url));
    return $('.search-results__item').map((_, node) => {
        const card = $(node);
        const sourceId = clean(card.attr('data-feature-favorite-lots-procedure-number')) || clean(card.find('.search-results__lot a').first().text()).split(' ')[0];
        const href = card.find('.search-results__subject a').attr('href') || card.find('.search-results__lot a').attr('href');
        const organizer = card.find('.search-results__customer a').first();
        const tooltip = card.find('.search-results__customer p').attr('title') || '';
        return makeTender('roseltorg', sourceId, {
            sourceLabel: 'Росэлторг', purchaseNumber: sourceId, name: card.find('.search-results__subject a').first().text(),
            customer: { fullName: organizer.text(), inn: (tooltip.match(/ИНН\s*(\d{10,12})/i) || [])[1] || '' },
            price: parseMoney(card.find('.search-results__sum p.desktop').first().text()), status: card.find('.search-results__status').first().text(),
            applicationEndDate: parseRussianDate(card.find('.search-results__time').first().text()), law: card.find('.search-results__section p').first().text(),
            region: card.find('.search-results__region p').first().text(), link: href ? new URL(href, 'https://www.roseltorg.ru').href : url.href,
        });
    }).get().filter(item => item.purchaseNumber);
}

async function searchGpb(query) {
    const url = new URL('https://etpgpb.ru/api/v2/procedures/');
    url.searchParams.set('page', '1'); url.searchParams.set('per', '20'); url.searchParams.set('search', query);
    url.searchParams.append('procedure[stage][0]', 'accepting'); url.searchParams.set('sort', 'by_relevance');
    const payload = JSON.parse(await fetchText(url));
    return (payload.data || []).map(row => {
        const a = row.attributes || {};
        return makeTender('gpb', a.registry_number || row.id, {
            sourceLabel: 'ЭТП ГПБ', purchaseNumber: a.registry_number || row.id, name: a.title,
            customer: { fullName: a.company_name || '', inn: a.company_inn || '' }, price: parseMoney(a.amount),
            status: a.stage === 'accepting' ? 'Подача заявок' : a.stage, applicationEndDate: a.end_registration, publishedAt: a.date_published,
            law: a.kind === 'fz44' ? '44-ФЗ' : a.kind === 'fz223' ? '223-ФЗ' : 'Коммерческая', region: (a.lot_regions || []).join(', '),
            link: a.platform_url || (a.rebranding_truncated_path ? new URL(a.rebranding_truncated_path, 'https://etpgpb.ru').href : url.href),
        });
    });
}

async function searchTektorg(query) {
    const url = new URL('https://www.tektorg.ru/procedures'); url.searchParams.set('name', query);
    const $ = cheerio.load(await fetchText(url)); const nextData = $('#__NEXT_DATA__').text(); if (!nextData) return [];
    const rows = JSON.parse(nextData)?.props?.pageProps?.initialReduxState?.listingProcedures?.data || [];
    return rows.map(row => makeTender('tektorg', row.registryNumber || row.id, {
        sourceLabel: 'ТЭК-Торг', purchaseNumber: row.registryNumber || row.id, name: row.title,
        customer: { fullName: row.organizerName || '', inn: row.inn || '' }, price: parseMoney(row.sumPrice), status: row.statusName,
        applicationEndDate: row.dates?.dateEndRegistration, publishedAt: row.dates?.datePublished, law: row.sectionAlias,
        region: (row.geoPoints || []).map(point => point.name || point.region).filter(Boolean).join(', '),
        link: row.etpLink ? new URL(row.etpLink, 'https://www.tektorg.ru').href : url.href,
        description: [row.title, ...(row.okpd2 || []).map(item => item.name)].filter(Boolean).join('. '),
    }));
}

async function searchB2B(query) {
    const url = new URL('https://www.b2b-center.ru/market/'); url.searchParams.set('f_keyword', query); url.searchParams.set('searching', '1');
    const $ = cheerio.load(await fetchText(url));
    return $('table tr').map((_, node) => {
        const row = $(node); const link = row.find('a.search-results-title').first(); if (!link.length) return null;
        const href = link.attr('href') || ''; const sourceId = (href.match(/tender-(\d+)/) || clean(link.text()).match(/№\s*(\d+)/) || [])[1]; if (!sourceId) return null;
        const cells = row.find('td'); const name = clean(link.find('.search-results-title-desc').text()) || clean(link.text()).replace(/^.*?№\s*\d+/, '');
        return makeTender('b2b', sourceId, { sourceLabel: 'B2B-Center', purchaseNumber: sourceId, name,
            customer: { fullName: cells.eq(1).text(), inn: '' }, status: 'Подача заявок', publishedAt: parseRussianDate(cells.eq(2).text()),
            applicationEndDate: parseRussianDate(cells.eq(3).text()), law: 'Коммерческая', link: new URL(href, 'https://www.b2b-center.ru').href });
    }).get().filter(Boolean);
}

const SOURCES = [
    { id: 'roseltorg', label: 'Росэлторг', search: searchRoseltorg }, { id: 'gpb', label: 'ЭТП ГПБ', search: searchGpb },
    { id: 'tektorg', label: 'ТЭК-Торг', search: searchTektorg }, { id: 'b2b', label: 'B2B-Center', search: searchB2B },
];

function deduplicate(items) {
    const result = new Map();
    for (const item of items) {
        const key = item.purchaseNumber && /^\d{10,}$/.test(item.purchaseNumber) ? `number:${item.purchaseNumber}` : `source:${item.id}`;
        const current = result.get(key); if (!current || (!current.customer?.inn && item.customer?.inn)) result.set(key, item);
    }
    return [...result.values()];
}

export async function searchFreeTenderSources(input = {}) {
    const queries = queryList(input);
    const sourceRuns = await Promise.all(SOURCES.map(async source => {
        const results = await Promise.allSettled(queries.map(query => source.search(query)));
        const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
        const errors = results.filter(result => result.status === 'rejected').map(result => result.reason?.message || String(result.reason));
        return { id: source.id, label: source.label, ok: items.length > 0 || errors.length === 0, count: items.length, error: errors.length === results.length ? errors[0] : null, items };
    }));
    return { items: deduplicate(sourceRuns.flatMap(source => source.items)), sources: sourceRuns.map(({ items: _items, ...status }) => status), queries, updatedAt: new Date().toISOString() };
}
