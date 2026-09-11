/**
 * Sales task and lead management services.
 */
import { SalesTask, Lead } from "../types";
import { callDbProxy } from "./dbProxy";

const TASKS_COLLECTION = "sales_tasks";

export const createTask = async (userId: string, leads: Lead[]) => {
  const newId = crypto.randomUUID();
  const newTask: SalesTask = { id: newId, userId, createdAt: Date.now(), leads, status: 'IN_PROGRESS' };
  await callDbProxy('set', { collectionName: TASKS_COLLECTION, docId: newId, data: newTask });
};

export const getUserTasks = async (userId: string): Promise<SalesTask[]> => {
  try {
    const allTasks = await callDbProxy('list', { collectionName: TASKS_COLLECTION });
    return (allTasks as SalesTask[]).filter(t => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) { console.error("Failed to fetch user tasks:", err); return []; }
};

export const getAllSalesTasks = async (): Promise<SalesTask[]> => {
  try {
    const allTasks = await callDbProxy('list', { collectionName: TASKS_COLLECTION });
    return (allTasks as SalesTask[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) { console.error("Failed to fetch all sales tasks:", err); return []; }
};

export const deleteSalesTask = async (taskId: string): Promise<void> => {
  await callDbProxy('delete', { collectionName: TASKS_COLLECTION, docId: taskId });
};

export const completeTask = async (taskId: string, summary: string) => {
  await callDbProxy('set', { collectionName: TASKS_COLLECTION, docId: taskId, data: { status: 'COMPLETED', summary } });
};

export const updateTaskLeads = async (taskId: string, leads: Lead[]) => {
  await callDbProxy('set', { collectionName: TASKS_COLLECTION, docId: taskId, data: { leads } });
};

// --- Lead Dedup ---
export const getKnownLeadNames = async (): Promise<{ names: string[] }> => {
  try { return await callDbProxy('list_known_leads'); }
  catch (err) { console.error("Failed to fetch known lead names:", err); return { names: [] }; }
};

export const reserveLeadNames = async (names: string[]): Promise<void> => {
  if (names.length === 0) return;
  try { await callDbProxy('reserve_leads', { names }); }
  catch (err) { console.warn("Failed to reserve leads (non-critical):", err); }
};

export const updateLeadInn = async (companyName: string, newInn: string) => {
  try { await callDbProxy('update_lead_inn', { companyName, newInn }); console.log(`[LeadINN] Updated: "${companyName}" → INN ${newInn}`); }
  catch (err) { console.warn(`[LeadINN] Failed to update:`, err); }
};

// --- Personal Ignore List ---
export const getPersonalIgnoreList = async (userId: string): Promise<string[]> => {
  try { const result = await callDbProxy('list_personal_ignores', { userId }); return result.names || []; }
  catch (err) { console.error("Failed to fetch personal ignore list:", err); return []; }
};

export const addToPersonalIgnore = async (userId: string, companyName: string): Promise<void> => {
  try { await callDbProxy('add_personal_ignore', { userId, companyName }); }
  catch (err) { console.error("Failed to add to personal ignore:", err); }
};
