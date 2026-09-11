/**
 * Tender Firebase services: favorites, scores, daily stats, comments.
 */
import { User, TenderFavorite, SharedTenderScore, TenderWorkflowStatus, TenderDailyStats, TenderComment } from "../types";
import { callDbProxy } from "./dbProxy";

const TENDER_FAVORITES_COLLECTION = 'tender_favorites';
const TENDER_SCORES_COLLECTION = 'tender_scores';
const TENDER_DAILY_STATS_COLLECTION = 'tender_daily_stats';
const TENDER_COMMENTS_COLLECTION = 'tender_comments';

// --- Favorites ---
export const getSharedFavorites = async (): Promise<TenderFavorite[]> => {
  try { return await callDbProxy('list', { collectionName: TENDER_FAVORITES_COLLECTION }) as TenderFavorite[]; }
  catch (err) { console.error("Failed to fetch shared favorites:", err); return []; }
};

export const addSharedFavorite = async (tenderId: string, user: User): Promise<void> => {
  await callDbProxy('set', { collectionName: TENDER_FAVORITES_COLLECTION, docId: tenderId, data: { tenderId, addedBy: user.id, addedByName: `${user.firstName} ${user.lastName}`, addedAt: Date.now(), workflowStatus: 'REVIEW' } as TenderFavorite });
};

export const removeSharedFavorite = async (tenderId: string): Promise<void> => {
  await callDbProxy('delete', { collectionName: TENDER_FAVORITES_COLLECTION, docId: tenderId });
};

export const markFavoriteForRemoval = async (tenderId: string, userId: string): Promise<void> => {
  await callDbProxy('set', { collectionName: TENDER_FAVORITES_COLLECTION, docId: tenderId, data: { markedForRemoval: true, markedForRemovalBy: userId, markedForRemovalAt: Date.now() } });
};

export const unmarkFavoriteForRemoval = async (tenderId: string): Promise<void> => {
  await callDbProxy('set', { collectionName: TENDER_FAVORITES_COLLECTION, docId: tenderId, data: { markedForRemoval: false, markedForRemovalBy: null, markedForRemovalAt: null } });
};

export const assignTenderResponsible = async (tenderId: string, assigneeId: string, assigneeName: string, assignerId: string): Promise<void> => {
  await callDbProxy('set', { collectionName: TENDER_FAVORITES_COLLECTION, docId: tenderId, data: { assignedTo: assigneeId, assignedToName: assigneeName, assignedBy: assignerId } });
};

export const updateTenderWorkflowStatus = async (tenderId: string, status: TenderWorkflowStatus, userId: string): Promise<void> => {
  await callDbProxy('set', { collectionName: TENDER_FAVORITES_COLLECTION, docId: tenderId, data: { workflowStatus: status, statusChangedAt: Date.now(), statusChangedBy: userId } });
};

export const updateTenderContractor = async (tenderId: string, contractor: string): Promise<void> => {
  await callDbProxy('set', { collectionName: TENDER_FAVORITES_COLLECTION, docId: tenderId, data: { contractor } });
};

// --- Shared AI Tender Scores ---
export const getSharedTenderScores = async (): Promise<SharedTenderScore[]> => {
  try { return await callDbProxy('list', { collectionName: TENDER_SCORES_COLLECTION }) as SharedTenderScore[]; }
  catch (err) { console.error("Failed to fetch shared tender scores:", err); return []; }
};

export const saveSharedTenderScores = async (scores: SharedTenderScore[]): Promise<void> => {
  for (const score of scores) {
    await callDbProxy('set', { collectionName: TENDER_SCORES_COLLECTION, docId: score.tenderId, data: score });
  }
};

// --- Daily Stats ---
export const logTenderDailyStats = async (stats: Partial<TenderDailyStats>): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  try {
    let existing: TenderDailyStats | null = null;
    try { existing = await callDbProxy('get', { collectionName: TENDER_DAILY_STATS_COLLECTION, docId: today }) as TenderDailyStats | null; } catch { }

    const merged: TenderDailyStats = {
      date: today,
      apiQuotaUsed: (existing?.apiQuotaUsed || 0) + (stats.apiQuotaUsed || 0),
      apiQuotaLimit: stats.apiQuotaLimit ?? existing?.apiQuotaLimit ?? 0,
      tendersFound: (existing?.tendersFound || 0) + (stats.tendersFound || 0),
      tendersAdded: (existing?.tendersAdded || 0) + (stats.tendersAdded || 0),
      aiScoringsRun: (existing?.aiScoringsRun || 0) + (stats.aiScoringsRun || 0),
      tokensUsed: (existing?.tokensUsed || 0) + (stats.tokensUsed || 0),
    };

    if (stats.userAdded) {
      const existingAdded = existing?.userAdded || {};
      Object.entries(stats.userAdded).forEach(([uid, data]) => { existingAdded[uid] = { name: data.name, count: (existingAdded[uid]?.count || 0) + data.count }; });
      (merged as any).userAdded = existingAdded;
    } else if (existing?.userAdded) { (merged as any).userAdded = existing.userAdded; }

    if (stats.userAiScorings) {
      const existingAi = existing?.userAiScorings || {};
      Object.entries(stats.userAiScorings).forEach(([uid, data]) => { existingAi[uid] = { name: data.name, count: (existingAi[uid]?.count || 0) + data.count }; });
      (merged as any).userAiScorings = existingAi;
    } else if (existing?.userAiScorings) { (merged as any).userAiScorings = existing.userAiScorings; }

    await callDbProxy('set', { collectionName: TENDER_DAILY_STATS_COLLECTION, docId: today, data: merged });
  } catch (err) { console.warn("Failed to log tender daily stats:", err); }
};

export const getTenderDailyStats = async (): Promise<TenderDailyStats[]> => {
  try {
    const stats = await callDbProxy('list', { collectionName: TENDER_DAILY_STATS_COLLECTION });
    return (stats as TenderDailyStats[]).sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) { console.error("Failed to fetch tender daily stats:", err); return []; }
};

// --- Comments ---
export const getTenderComments = async (tenderId: string): Promise<TenderComment[]> => {
  try {
    const comments = await callDbProxy('list', { collectionName: `${TENDER_COMMENTS_COLLECTION}/${tenderId}/messages` });
    return (comments as TenderComment[]).sort((a, b) => a.createdAt - b.createdAt);
  } catch (err) { console.error('Failed to fetch tender comments:', err); return []; }
};

export const addTenderComment = async (tenderId: string, user: User, text: string): Promise<TenderComment> => {
  const comment: TenderComment = { id: `${Date.now()}_${user.id}`, tenderId, userId: user.id, userName: `${user.firstName} ${user.lastName}`, text, createdAt: Date.now() };
  await callDbProxy('set', { collectionName: `${TENDER_COMMENTS_COLLECTION}/${tenderId}/messages`, docId: comment.id, data: comment });
  return comment;
};
