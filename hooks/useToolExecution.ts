import { useState, useRef, useEffect } from 'react';
import { Message, ChatMode } from '../types';
import { generateGeminiResponse, uploadFileToGemini } from '../services/geminiService';
import { updateLeadInn } from '../services/firebaseService';
import {
   serializeBitrixParams, normalizeMultiValueFields, enrichWithUserNames,
   convertToCSV, buildBitrixUrl, fetchAllPages
} from '../utils/bitrixUtils';

interface UseToolExecutionParams {
   chatMode: ChatMode;
   chatTitle: string;
   knowledgeBase: any[];
   prompts: any;
   isFastModel: boolean;
   bitrixUrl: string;
   user: any;
   onUpdateMessages: (msgs: Message[]) => void;
}

/**
 * Custom hook that encapsulates all tool execution logic:
 * - CHECKO_CALL (company lookup by INN/name via EGRUL)
 * - CHECKO_DEEP_CALL (full company dossier: finances, contracts)
 * - BITRIX_CALL (CRM operations with pagination, enrichment, large dataset upload)
 */
export function useToolExecution({
   chatMode, chatTitle, knowledgeBase, prompts, isFastModel, bitrixUrl, user, onUpdateMessages,
}: UseToolExecutionParams) {
   const [bitrixStatus, setBitrixStatus] = useState<string | null>(null);
   const [bitrixUsers, setBitrixUsers] = useState<Record<string, string>>({});
   const bitrixUsersRef = useRef<Record<string, string>>({});

   useEffect(() => { bitrixUsersRef.current = bitrixUsers; }, [bitrixUsers]);

   // Fetch Bitrix users on mount
   useEffect(() => {
      if (!bitrixUrl) return;
      const fetchUsers = async () => {
         try {
            const url = buildBitrixUrl(bitrixUrl, 'user.get');
            const data = await fetchAllPages(url, {});
            if (Array.isArray(data.result)) {
               const userMap: Record<string, string> = {};
               data.result.forEach((u: any) => {
                  const name = `${u.NAME || ''} ${u.LAST_NAME || ''}`.trim();
                  if (u.ID && name) userMap[u.ID] = name;
               });
               setBitrixUsers(userMap);
            }
         } catch (e) { console.warn('Failed to fetch Bitrix users', e); }
      };
      const t = setTimeout(fetchUsers, 500);
      return () => clearTimeout(t);
   }, [bitrixUrl]);

   const makeMsg = (text: string): Message => ({ id: crypto.randomUUID(), role: 'system' as any, text, timestamp: Date.now() });
   const makeModelMsg = (text: string): Message => ({ id: crypto.randomUUID(), role: 'model', text, timestamp: Date.now() });

   const callGemini = async (history: Message[], signal?: AbortSignal): Promise<string> => {
      const response = await generateGeminiResponse({
         history, currentPrompt: '', attachments: [], mode: chatMode,
         knowledgeBase, userName: user?.firstName || 'Сотрудник',
         prompts, useFastModel: isFastModel, bitrixUrl, signal,
      });
      return typeof response === 'string' ? response : (response as any).text;
   };

   // === CHECKO HANDLER ===
   const handleChecko = async (matches: RegExpMatchArray[], history: Message[], signal?: AbortSignal) => {
      setBitrixStatus('🔍 Проверяю в ЕГРЮЛ (Checko)...');
      const results: string[] = [];

      for (const match of matches) {
         if (signal?.aborted) throw new Error('Generation Aborted by User');
         const query = match[1].trim();
         const isInn = /^\d{10,12}$/.test(query);

         try {
            const res = await fetch('/api/checko', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isInn ? { inn: query } : { query }) });
            const data = await res.json();

            if (data.found) {
               results.push(`✅ **ЕГРЮЛ (Checko)** — ${isInn ? 'ИНН' : 'Поиск'} "${query}":\n\`\`\`json\n${JSON.stringify(data.data, null, 2)}\n\`\`\`\n\n💡 **SYSTEM:** Используй ЭТИ данные как единственный источник истины для идентификации компании.`);
               const verifiedInn = isInn ? query : (Array.isArray(data.data) ? data.data[0]?.ИНН : data.data?.ИНН);
               if (verifiedInn && chatMode === ChatMode.SALES) updateLeadInn(chatTitle, verifiedInn).catch(() => {});
            } else {
               results.push(`⚠️ **ЕГРЮЛ (Checko)** — "${query}": Организация НЕ НАЙДЕНА. ${data.message || data.error || ''}\n\n💡 **SYSTEM:** ${isInn ? 'ИНН не найден. Попробуй <<<CHECKO_CALL: [Название]>>>.' : 'По названию ничего не найдено.'}`);
            }
         } catch (e: any) { results.push(`❌ **Checko Error** ("${query}"): ${e.message}`); }
      }

      const sysMsg = makeMsg(`[SYSTEM_TOOL_OUTPUT]\n${results.join('\n\n')}\n\nПроанализируй данные ЕГРЮЛ.`);
      const msgs = [...history, sysMsg];

      try {
         setBitrixStatus('🧠 Анализирую данные ЕГРЮЛ...');
         const response = await callGemini(msgs, signal);
         const modelMsg = makeModelMsg(response);
         onUpdateMessages([...msgs, modelMsg]);
         await handleToolExecution(response, [...msgs, modelMsg], signal);
      } catch (e) { console.error(e); }
      finally { setBitrixStatus(null); }
   };

   // === CHECKO_DEEP HANDLER ===
   const handleCheckoDeep = async (rawMatch: string, history: Message[], signal?: AbortSignal) => {
      const inn = rawMatch.replace(/\D/g, '');
      setBitrixStatus('📊 Загружаю полное досье из ЕГРЮЛ...');

      try {
         const res = await fetch('/api/checko-deep', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inn }) });
         const data = await res.json();

         let text: string;
         if (data.found) {
            text = `[SYSTEM_TOOL_OUTPUT]\n✅ **ПОЛНОЕ ДОСЬЕ** (ИНН: ${inn}):\n\n🔗 **Checko:** ${data.checkoLink}\n\n📋 **Основные данные:**\n\`\`\`json\n${JSON.stringify(data.data.company, null, 2)}\n\`\`\`\n\n` +
               (data.data.finances ? `💰 **Финансы:**\n\`\`\`json\n${JSON.stringify(data.data.finances, null, 2)}\n\`\`\`\n\n` : '💰 **Финансы:** Недоступны\n\n') +
               (data.data.contracts ? `📜 **Госзакупки:**\n\`\`\`json\n${JSON.stringify(data.data.contracts, null, 2)}\n\`\`\`\n\n` : '📜 **Госзакупки:** Недоступны\n\n') +
               `\n💡 **SYSTEM:** Построй ДОСЬЕ. Ссылка на Checko: ${data.checkoLink}. Используй Google Search для контактов.`;
         } else {
            text = `[SYSTEM_TOOL_OUTPUT]\n⚠️ Досье по ИНН ${inn} недоступно: ${data.message || data.error || ''}\n\n💡 **SYSTEM:** Проведи анализ через Google Search.`;
         }

         const msgs = [...history, makeMsg(text)];
         setBitrixStatus('🧠 Формирую досье...');
         const response = await callGemini(msgs, signal);
         const modelMsg = makeModelMsg(response);
         onUpdateMessages([...msgs, modelMsg]);
         await handleToolExecution(response, [...msgs, modelMsg], signal);
      } catch (e) { console.error(e); }
      finally { setBitrixStatus(null); }
   };

   // === INN FIELD MIRRORING ===
   // CRM has THREE INN fields. When AI uses any one, auto-sync to ALL of them.
   const INN_FIELDS = [
      'UF_CRM_58C8DA8104E96',  // old standard INN field (label: "ИНН")
      'UF_CRM_699D753545FB6',  // copy field (label: "ИНН (копия)")
      'UF_CRM_4_IF_INN',       // FIX4.ORG plugin field (label: "[INN.FIX4.ORG] ИНН") — the VISIBLE mandatory field
   ];

   const expandInnSearch = (method: string, params: any): any[] => {
      if (method !== 'crm.company.list' || !params?.filter) return [params];
      const filter = params.filter;
      // Find which INN field was specified
      const specifiedField = INN_FIELDS.find(f => filter[f]);
      if (!specifiedField) return [params];
      const innValue = filter[specifiedField];
      // Create a search variant for each OTHER INN field
      const variants = [params];
      for (const field of INN_FIELDS) {
         if (field === specifiedField) continue;
         const mirrorFilter = { ...filter };
         delete mirrorFilter[specifiedField];
         mirrorFilter[field] = innValue;
         variants.push({ ...params, filter: mirrorFilter });
      }
      return variants;
   };

   // Deduplicate Bitrix results by ID
   const deduplicateResults = (items: any[]): any[] => {
      const seen = new Set<string>();
      return items.filter(item => {
         const id = item?.ID || item?.id;
         if (!id || seen.has(String(id))) return false;
         seen.add(String(id));
         return true;
      });
   };

   // === BITRIX_CALL HANDLER ===
   const handleBitrix = async (matches: RegExpMatchArray[], history: Message[], signal?: AbortSignal) => {
      setBitrixStatus(`🚀 Подключаюсь к CRM... (${matches.length} операций)`);
      const results: string[] = [];

      for (const match of matches) {
         if (signal?.aborted) throw new Error('Generation Aborted by User');
         const method = match[1];
         let params: any = {};
         try { params = match[2] ? JSON.parse(match[2]) : {}; } catch { }

         if (params.fields) params.fields = normalizeMultiValueFields(params.fields);

         // Auto-mirror INN on company creation: sync ALL INN fields from whichever one is set
         if ((method === 'crm.company.add' || method === 'crm.company.update') && params.fields) {
            const innValue = INN_FIELDS.map(f => params.fields[f]).find(v => v);
            if (innValue) {
               for (const field of INN_FIELDS) {
                  params.fields[field] = innValue;
               }
            }
         }

         // Auto-expand INN searches to cover all fields
         const paramVariants = expandInnSearch(method, params);
         const isInnMirrored = paramVariants.length > 1;

         try {
            const url = buildBitrixUrl(bitrixUrl, method);
            let data: any;

            if (isInnMirrored) {
               // Execute both INN queries and merge results
               setBitrixStatus('🔍 Ищу по обоим полям ИНН...');
               const allResults: any[] = [];
               for (const variant of paramVariants) {
                  try {
                     const res = await fetch(`${url}?${serializeBitrixParams(variant)}`);
                     const vData = await res.json();
                     if (Array.isArray(vData.result)) allResults.push(...vData.result);
                     else if (vData.result) allResults.push(vData.result);
                  } catch { /* skip failed variant */ }
               }
               const unique = deduplicateResults(allResults);
               data = { result: unique, total: unique.length };
            } else if (params.GET_ALL) {
               delete params.GET_ALL;
               data = await fetchAllPages(url, params, count => setBitrixStatus(`📦 Скачиваю... (${count})`));
            } else {
               const res = await fetch(`${url}?${serializeBitrixParams(params)}`);
               data = await res.json();
            }

            // Enrich with user names
            const currentUsers = bitrixUsersRef.current;
            if (Object.keys(currentUsers).length > 0) data = enrichWithUserNames(data, currentUsers);

            // Large dataset → upload as file
            if (Array.isArray(data.result) && data.result.length > 100) {
               setBitrixStatus(`📤 Загружаю массив (${data.result.length} строк)...`);
               try {
                  let fileContent: string, mimeType: string, extension: string;
                  try {
                     const csv = convertToCSV(data.result);
                     fileContent = csv.content; mimeType = csv.mimeType; extension = csv.extension;
                  } catch {
                     fileContent = JSON.stringify(data, null, 2); mimeType = 'application/json'; extension = 'json';
                  }

                  const cleanMime = mimeType.split(';')[0];
                  const file = new File([new Blob([fileContent], { type: mimeType })], `bitrix_${method}_${Date.now()}.${extension}`, { type: cleanMime });
                  const uploadResult = await uploadFileToGemini(file);

                  const sysMsg: Message = {
                     id: crypto.randomUUID(), role: 'system', text: `[SYSTEM_TOOL_OUTPUT]\nData for ${method} uploaded as '${uploadResult.name}' (${data.result.length} items). Analyze the attached file.`,
                     timestamp: Date.now(),
                     attachments: [{ name: uploadResult.name, mimeType: cleanMime, data: '', fileUri: uploadResult.uri }],
                  };

                  setBitrixStatus('🧠 Анализирую данные (File API)...');
                  const response = await callGemini([...history, sysMsg], signal);
                  onUpdateMessages([...history, sysMsg, makeModelMsg(response)]);
                  setBitrixStatus(null);
                  return;
               } catch (uploadErr) {
                  console.error('Upload failed:', uploadErr);
                  results.push(`❌ **Upload Failed:** ${uploadErr}`);
               }
            }

            // Standard inline
            const label = isInnMirrored ? `${method} (ИНН: оба поля)` : method;
            const resultStr = JSON.stringify(data, null, 2);
            const truncated = resultStr.length > 20000 ? resultStr.slice(0, 20000) + '\n...[TRUNCATED]' : resultStr;
            results.push(`✅ **${label}** (${data.total || (Array.isArray(data.result) ? data.result.length : 1)} items):\n\`\`\`json\n${truncated}\n\`\`\``);
         } catch (e: any) { results.push(`❌ **${method} Failed:** ${e.message}`); }
      }

      const msgs = [...history, makeMsg(`[SYSTEM_TOOL_OUTPUT]\n${results.join('\n\n')}\n\nПроанализируй эти данные и ответь пользователю.`)];
      try {
         setBitrixStatus('🧠 Анализирую данные...');
         const response = await callGemini(msgs, signal);
         onUpdateMessages([...msgs, makeModelMsg(response)]);
      } catch (e) { console.error(e); }
      finally { setBitrixStatus(null); }
   };

   // --- MAIN DISPATCHER ---
   const handleToolExecution = async (responseText: string, currentHistory: Message[], signal?: AbortSignal) => {
      const checkoMatches = [...responseText.matchAll(/<<<CHECKO_CALL:\s*(.+?)\s*>>>/g)];
      if (checkoMatches.length > 0) return handleChecko(checkoMatches, currentHistory, signal);

      const deepMatches = [...responseText.matchAll(/<<<CHECKO_DEEP_CALL:\s*(.+?)\s*>>>/g)];
      if (deepMatches.length > 0) return handleCheckoDeep(deepMatches[0][1], currentHistory, signal);

      const bitrixMatches = [...responseText.matchAll(/<<<BITRIX_CALL:\s*([a-zA-Z0-9_.]+)\s*\|?\s*([\s\S]*?)>>>/g)];
      if (bitrixMatches.length > 0 && bitrixUrl) return handleBitrix(bitrixMatches, currentHistory, signal);
   };

   return { handleToolExecution, bitrixStatus, bitrixUsers };
}
