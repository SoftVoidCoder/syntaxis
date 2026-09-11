/**
 * Pure utility functions for Bitrix API interactions.
 * Extracted from useToolExecution to enable reuse and testing.
 */

/** Serialize nested objects into Bitrix-compatible PHP-style query params. */
export function serializeBitrixParams(obj: any, prefix?: string): string {
   const str: string[] = [];
   for (const p in obj) {
      if (obj.hasOwnProperty(p)) {
         const k = prefix ? `${prefix}[${p}]` : p;
         const v = obj[p];
         if (v !== null && typeof v === 'object') {
            str.push(serializeBitrixParams(v, k));
         } else {
            str.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
         }
      }
   }
   return str.join('&');
}

/** Normalize multi-value CRM fields (PHONE, EMAIL, IM, WEB) into Bitrix array format. */
export function normalizeMultiValueFields(fields: Record<string, any>): Record<string, any> {
   const MULTI_FIELDS = ['PHONE', 'EMAIL', 'IM', 'WEB'];
   const result = { ...fields };
   MULTI_FIELDS.forEach(field => {
      if (result[field]) {
         let val = result[field];
         if (typeof val === 'string' && val.includes(','))
            val = val.split(',').map((s: string) => s.trim());
         if (!Array.isArray(val)) val = [val];
         val = val.map((v: any) =>
            typeof v === 'string' || typeof v === 'number'
               ? { VALUE: String(v), VALUE_TYPE: 'WORK' }
               : v
         );
         result[field] = val;
      }
   });
   return result;
}

/** Recursively enrich Bitrix data objects with user names for ASSIGNED_BY_ID fields. */
export function enrichWithUserNames(obj: any, userMap: Record<string, string>): any {
   if (Array.isArray(obj)) return obj.map(item => enrichWithUserNames(item, userMap));
   if (typeof obj === 'object' && obj !== null) {
      if (obj.ASSIGNED_BY_ID && userMap[obj.ASSIGNED_BY_ID])
         obj.ASSIGNED_BY_NAME = userMap[obj.ASSIGNED_BY_ID];
      for (const k in obj) obj[k] = enrichWithUserNames(obj[k], userMap);
   }
   return obj;
}

/** Convert array of objects to CSV string with BOM (for Excel compatibility). */
export function convertToCSV(items: any[]): { content: string; mimeType: string; extension: string } {
   if (!items || items.length === 0) throw new Error('Empty array');
   const headers = Object.keys(items[0]);
   const csvRows = [
      headers.join(';'),
      ...items.map(item =>
         headers.map(h => {
            let val = item[h];
            if (typeof val === 'object') val = JSON.stringify(val);
            if (typeof val === 'string') val = `"${val.replace(/"/g, '""')}"`;
            return val;
         }).join(';')
      ),
   ];
   return {
      content: '\uFEFF' + csvRows.join('\n'),
      mimeType: 'text/csv;charset=utf-8',
      extension: 'csv',
   };
}

/** Build Bitrix API URL from base URL and method name. */
export function buildBitrixUrl(baseUrl: string, method: string): string {
   return baseUrl.endsWith('/') ? `${baseUrl}${method}.json` : `${baseUrl}/${method}.json`;
}

/** Fetch all pages from a Bitrix list method. */
export async function fetchAllPages(
   url: string,
   params: any,
   onProgress?: (count: number) => void
): Promise<{ result: any[]; total: number }> {
   let allItems: any[] = [];
   let start = 0;
   let totalFetched = 0;
   while (true) {
      params.start = start;
      const res = await fetch(`${url}?${serializeBitrixParams(params)}`);
      const pageData = await res.json();
      if (!res.ok || pageData.error) {
         throw new Error(pageData.error_description || pageData.error || `Bitrix HTTP ${res.status}`);
      }
      if (!pageData.result || !Array.isArray(pageData.result)) {
         if (pageData.result) allItems.push(pageData.result);
         break;
      }
      allItems = [...allItems, ...pageData.result];
      totalFetched += pageData.result.length;
      if (!pageData.next || totalFetched >= 50000) break;
      start = pageData.next;
      onProgress?.(totalFetched);
   }
   return { result: allItems, total: totalFetched };
}
