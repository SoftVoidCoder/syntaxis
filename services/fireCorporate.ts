/**
 * Corporate chat services.
 */
import { CorporateChat, CorporateMessage } from "../types";
import { callDbProxy } from "./dbProxy";

export const getCorporateChats = async (userId: string): Promise<CorporateChat[]> => {
  try {
    const chats = await callDbProxy('list', { collectionName: 'corporate_chats' });
    return (chats as CorporateChat[]).filter(c => c.participants.includes(userId)).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) { console.error("Failed to load corporate chats:", err); return []; }
};

export const getCorporateMessages = async (chatId: string): Promise<CorporateMessage[]> => {
  try {
    const messages = await callDbProxy('list', { collectionName: `corporate_chats/${chatId}/messages` });
    return (messages as CorporateMessage[]).sort((a, b) => a.timestamp - b.timestamp);
  } catch (err) { console.error("Failed to load corporate messages:", err); return []; }
};

export const sendCorporateMessage = async (chatId: string, senderId: string, text: string, participants: string[]) => {
  await callDbProxy('send_corporate_message', { chatId, text, authToken: senderId });
};

export const markCorporateChatAsRead = async (chatId: string, userId: string) => {
  try { await callDbProxy('mark_chat_read', { chatId, userId }); }
  catch (err) { console.error("Failed to mark chat as read", err); }
};

export const createCorporateChat = async (participants: string[]): Promise<string> => {
  try {
    const existing = await callDbProxy('list', { collectionName: 'corporate_chats' }) as CorporateChat[];
    const found = existing.find(c => c.participants.length === participants.length && participants.every(p => c.participants.includes(p)));
    if (found) return found.id;
  } catch (e) { }

  const chatId = crypto.randomUUID();
  const chat: CorporateChat = { id: chatId, participants, updatedAt: Date.now(), unreadCount: {} };
  await callDbProxy('set', { collectionName: 'corporate_chats', docId: chatId, data: chat });
  return chatId;
};
