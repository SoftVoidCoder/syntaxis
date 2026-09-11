import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchFreeTenderSources } from './tenderSources.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cacheDir = path.join(root, '.local');
const cachePath = path.join(cacheDir, 'free-tenders-cache.json');

function readCache() {
    try {
        if (!existsSync(cachePath)) return { items: [], updatedAt: null, sources: [] };
        return JSON.parse(readFileSync(cachePath, 'utf8'));
    } catch {
        return { items: [], updatedAt: null, sources: [] };
    }
}

function writeCache(payload) {
    mkdirSync(cacheDir, { recursive: true });
    const existing = readCache();
    const merged = new Map([...(existing.items || []), ...(payload.items || [])].map(item => [item.id, item]));
    const value = { ...payload, items: [...merged.values()].slice(-3000) };
    writeFileSync(cachePath, JSON.stringify(value, null, 2));
    return value;
}

function filterItems(items, body) {
    let filtered = [...items];
    const query = String(body.query || '').trim().toLowerCase();
    if (query) {
        filtered = filtered.filter(item => [item.name, item.purchaseNumber, item.customer?.fullName, item.customer?.inn]
            .some(value => String(value || '').toLowerCase().includes(query)));
    }
    const excludes = [...(body.excludedText || []), ...String(body.excludeWords || '').split(',')]
        .map(value => String(value).trim().toLowerCase()).filter(Boolean);
    if (excludes.length) filtered = filtered.filter(item => !excludes.some(word => String(item.name || '').toLowerCase().includes(word)));
    if (body.priceFilters?.from !== undefined) filtered = filtered.filter(item => item.price >= Number(body.priceFilters.from));
    if (body.priceFilters?.to !== undefined) filtered = filtered.filter(item => item.price <= Number(body.priceFilters.to));
    if (body.applicationDeadlineFrom) filtered = filtered.filter(item => !item.applicationEndDate || new Date(item.applicationEndDate) >= new Date(body.applicationDeadlineFrom));
    if (body.applicationDeadlineTo) filtered = filtered.filter(item => !item.applicationEndDate || new Date(item.applicationEndDate) <= new Date(`${body.applicationDeadlineTo}T23:59:59`));
    if (body.statusFilters) {
        const statusAllowed = (item) => {
            const status = String(item.status || '').toLowerCase();
            if (body.statusFilters.ApplicationSubmission && /(подач|при[её]м|accept)/i.test(status)) return true;
            if (body.statusFilters.CommissionWork && /комисс/i.test(status)) return true;
            if (body.statusFilters.Completed && /(заверш|архив|completed)/i.test(status)) return true;
            return false;
        };
        filtered = filtered.filter(statusAllowed);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const recentCutoff = new Date(today); recentCutoff.setDate(recentCutoff.getDate() - 30);
        filtered = filtered.filter(item => {
            const status = String(item.status || '').toLowerCase();
            if (body.statusFilters.Completed && /(заверш|архив|completed)/i.test(status)) return true;
            if (/комисс/i.test(status)) {
                const activityDate = item.publishedAt || item.applicationEndDate;
                return !activityDate || new Date(activityDate) >= recentCutoff;
            }
            if (item.applicationEndDate) return new Date(item.applicationEndDate) >= today;
            return !item.publishedAt || new Date(item.publishedAt) >= recentCutoff;
        });
    }
    if (body.fzFilters && !body.fzFilters.commercial) filtered = filtered.filter(item => item.law !== 'Коммерческая');
    if (body.fzFilters && !body.fzFilters.fz44) filtered = filtered.filter(item => !String(item.law).includes('44'));
    if (body.fzFilters && !body.fzFilters.fz223) filtered = filtered.filter(item => !String(item.law).includes('223'));
    return filtered.sort((a, b) => {
        const aTime = a.applicationEndDate ? new Date(a.applicationEndDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bTime = b.applicationEndDate ? new Date(b.applicationEndDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
    });
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).end();
    }
    const body = req.body?.body || req.body || {};
    const endpoint = req.body?.endpoint || body.endpoint || '/search';
    try {
        if (endpoint === '/search') {
            const result = await searchFreeTenderSources(body);
            const cache = writeCache(result);
            const items = filterItems(result.items, body).slice(0, 250);
            const sources = result.sources.map(source => ({ ...source, count: items.filter(item => item.source === source.id).length }));
            return res.status(200).json({ items, totalCount: items.length, sources, updatedAt: result.updatedAt, cachedTotal: cache.items.length, limits: null });
        }
        if (endpoint === '/local-search') {
            const cache = readCache();
            let items = cache.items || [];
            if (Array.isArray(body.savedTenders)) {
                const saved = new Set(body.savedTenders.map(String));
                items = items.filter(item => saved.has(String(item.id)));
            }
            items = filterItems(items, body).slice(0, 250);
            return res.status(200).json({ items, totalCount: items.length, sources: cache.sources || [], updatedAt: cache.updatedAt, limits: null });
        }
        if (String(endpoint).startsWith('/purchases/')) {
            const id = decodeURIComponent(String(endpoint).slice('/purchases/'.length));
            const item = (readCache().items || []).find(tender => String(tender.id) === id || String(tender.purchaseNumber) === id);
            if (!item) return res.status(404).json({ error: 'Закупка не найдена в локальном кэше' });
            return res.status(200).json({ Title: item.name, Description: item.description || item.name, DeliveryPlace: item.deliveryPlace || item.region, Link: item.link, Source: item.sourceLabel, Customer: item.customer });
        }
        return res.status(400).json({ error: 'Неизвестная операция с тендерами' });
    } catch (error) {
        console.error('[Free Tenders API]', error);
        return res.status(502).json({ error: 'Не удалось обновить бесплатные источники', details: error.message });
    }
}
