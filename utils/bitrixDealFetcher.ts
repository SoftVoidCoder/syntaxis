/**
 * Utility to fetch deal context from Bitrix CRM for the Conveyor module.
 * Uses the SYSTEM webhook (from admin settings), not the personal one.
 * Fetches: deal + company (with requisites) + contact + activities (emails, calls)
 */

import { buildBitrixUrl, serializeBitrixParams } from './bitrixUtils';

export interface BitrixDealContext {
    dealId: string;
    title: string;
    comments: string;
    companyId: string | null;
    contactId: string | null;
    assignedById: string;
    stageId: string;
    opportunity: string;
    // Company info
    companyName?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyInn?: string;
    companyKpp?: string;
    companyAddress?: string;
    // Contact info
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    contactPosition?: string;
    // Activities
    emails: BitrixEmail[];
    calls: BitrixCall[];
    summary: string; // Pre-formatted text for AI consumption
}

interface BitrixEmail {
    subject: string;
    description: string;
    created: string;
    direction: 'incoming' | 'outgoing';
}

interface BitrixCall {
    subject: string;
    description: string;
    created: string;
    direction: 'incoming' | 'outgoing';
    duration?: string;
}

/**
 * Extract deal ID from various Bitrix URL formats.
 */
export function parseDealIdFromUrl(input: string): string | null {
    if (!input) return null;
    if (/^\d+$/.test(input.trim())) return input.trim();
    const detailsMatch = input.match(/\/crm\/deal\/details\/(\d+)/);
    if (detailsMatch) return detailsMatch[1];
    if (input.match(/\/crm\/deal\/category\/\d+/)) return null;
    return null;
}

function stripHtml(html: string): string {
    if (!html) return '';
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/** Extract first phone/email from Bitrix multifield array */
function extractMultiField(data: any, type: string): string {
    if (!data || !Array.isArray(data)) return '';
    const item = data.find((d: any) => d.VALUE);
    return item?.VALUE || '';
}

/**
 * Fetch deal title from Bitrix CRM for the Conveyor module.
 * Uses the SYSTEM webhook (from admin settings), not the personal one.
 * Fetches only the deal name.
 */
export async function fetchDealContext(systemWebhook: string, dealId: string): Promise<BitrixDealContext> {
    if (!systemWebhook || !dealId) throw new Error('Missing webhook or deal ID');

    const callBitrix = async (method: string, params: Record<string, any> = {}) => {
        const url = buildBitrixUrl(systemWebhook, method);
        const query = serializeBitrixParams(params);
        const response = await fetch(query ? `${url}?${query}` : url);
        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error_description || data.error || `Bitrix HTTP ${response.status}`);
        }
        return data.result;
    };

    const deal = await callBitrix('crm.deal.get', { id: dealId });
    if (!deal) throw new Error(`Сделка #${dealId} не найдена`);

    const companyId = deal.COMPANY_ID && deal.COMPANY_ID !== '0' ? String(deal.COMPANY_ID) : null;
    const contactIdValue = deal.CONTACT_ID || (Array.isArray(deal.CONTACT_IDS) ? deal.CONTACT_IDS[0] : null);
    const contactId = contactIdValue && contactIdValue !== '0' ? String(contactIdValue) : null;

    const [company, contact, activities] = await Promise.all([
        companyId ? callBitrix('crm.company.get', { id: companyId }) : Promise.resolve(null),
        contactId ? callBitrix('crm.contact.get', { id: contactId }) : Promise.resolve(null),
        callBitrix('crm.activity.list', {
            order: { CREATED: 'DESC' },
            filter: { OWNER_TYPE_ID: 2, OWNER_ID: dealId },
            select: ['ID', 'SUBJECT', 'DESCRIPTION', 'CREATED', 'TYPE_ID', 'DIRECTION', 'START_TIME', 'END_TIME'],
            start: 0
        })
    ]);

    let requisite: any = null;
    if (companyId) {
        const requisites = await callBitrix('crm.requisite.list', {
            filter: { ENTITY_TYPE_ID: 4, ENTITY_ID: companyId },
            select: ['ID', 'RQ_INN', 'RQ_KPP', 'RQ_ADDR'],
            start: 0
        });
        requisite = Array.isArray(requisites) ? requisites[0] : null;
    }

    const activityList: any[] = Array.isArray(activities) ? activities : [];
    const emails: BitrixEmail[] = activityList
        .filter(activity => String(activity.TYPE_ID) === '4')
        .map(activity => ({
            subject: activity.SUBJECT || 'Письмо без темы',
            description: stripHtml(activity.DESCRIPTION || ''),
            created: activity.CREATED || '',
            direction: String(activity.DIRECTION) === '1' ? 'incoming' : 'outgoing'
        }));
    const calls: BitrixCall[] = activityList
        .filter(activity => String(activity.TYPE_ID) === '2')
        .map(activity => {
            const start = activity.START_TIME ? new Date(activity.START_TIME).getTime() : 0;
            const end = activity.END_TIME ? new Date(activity.END_TIME).getTime() : 0;
            return {
                subject: activity.SUBJECT || 'Звонок',
                description: stripHtml(activity.DESCRIPTION || ''),
                created: activity.CREATED || '',
                direction: String(activity.DIRECTION) === '1' ? 'incoming' : 'outgoing',
                duration: end > start ? String(Math.round((end - start) / 1000)) : undefined
            };
        });

    const companyInn = requisite?.RQ_INN || company?.UF_CRM_58C8DA8104E96 || company?.UF_CRM_699D753545FB6 || company?.UF_CRM_4_IF_INN || '';
    const companyKpp = requisite?.RQ_KPP || '';
    const companyAddress = company?.ADDRESS || company?.REG_ADDRESS || company?.LEGAL_ADDRESS || '';
    const contactName = contact ? [contact.NAME, contact.SECOND_NAME, contact.LAST_NAME].filter(Boolean).join(' ') : '';
    const summary = [
        `Сделка #${deal.ID}: ${deal.TITLE || ''}`,
        `Стадия: ${deal.STAGE_ID || ''}`,
        `Сумма: ${deal.OPPORTUNITY || '0'} ${deal.CURRENCY_ID || ''}`,
        deal.COMMENTS ? `Комментарий: ${stripHtml(deal.COMMENTS)}` : '',
        company ? `Компания: ${company.TITLE || ''}${companyInn ? `, ИНН ${companyInn}` : ''}${companyKpp ? `, КПП ${companyKpp}` : ''}` : '',
        contact ? `Контакт: ${contactName}${contact.POST ? `, ${contact.POST}` : ''}` : '',
        `Связанные письма: ${emails.length}; звонки: ${calls.length}`
    ].filter(Boolean).join('\n');

    return {
        dealId: deal.ID,
        title: deal.TITLE || `Сделка #${dealId}`,
        comments: stripHtml(deal.COMMENTS || ''),
        companyId,
        contactId,
        assignedById: deal.ASSIGNED_BY_ID,
        stageId: deal.STAGE_ID,
        opportunity: deal.OPPORTUNITY || '0',
        companyName: company?.TITLE || '',
        companyPhone: extractMultiField(company?.PHONE, 'PHONE'),
        companyEmail: extractMultiField(company?.EMAIL, 'EMAIL'),
        companyInn,
        companyKpp,
        companyAddress,
        contactName,
        contactPhone: extractMultiField(contact?.PHONE, 'PHONE'),
        contactEmail: extractMultiField(contact?.EMAIL, 'EMAIL'),
        contactPosition: contact?.POST || '',
        emails,
        calls,
        summary
    };
}
