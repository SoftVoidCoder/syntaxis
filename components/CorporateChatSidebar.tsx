import React, { useState, useEffect, useRef } from 'react';
import { X, Send, User as UserIcon, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { User, CorporateChat, CorporateMessage } from '../types';
import {
    getAllUsersFromFirebase,
    getCorporateChats,
    getCorporateMessages,
    sendCorporateMessage,
    markCorporateChatAsRead,
    createCorporateChat
} from '../services/firebaseService';

interface CorporateChatSidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CorporateChatSidebar: React.FC<CorporateChatSidebarProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'chats' | 'users'>('chats');
    const [users, setUsers] = useState<User[]>([]);
    const [chats, setChats] = useState<CorporateChat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<CorporateMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Poll for chats to update unread counts
    useEffect(() => {
        if (!user || !isOpen) return;

        const loadChatsAndUsers = async () => {
            try {
                const [loadedChats, loadedUsers] = await Promise.all([
                    getCorporateChats(user.id),
                    getAllUsersFromFirebase()
                ]);
                setChats(loadedChats);

                // Exclude current user and system boots
                setUsers(loadedUsers.filter(u => u.id !== user.id && !u.isBlocked));
            } catch (err) {
                console.error("Failed to load users/chats:", err);
            }
        };

        loadChatsAndUsers();

        const chatInterval = setInterval(async () => {
            const loadedChats = await getCorporateChats(user.id);
            setChats(loadedChats);
        }, 10000);

        return () => clearInterval(chatInterval);
    }, [user, isOpen]);

    // Poll for messages in active chat
    useEffect(() => {
        if (!user || !isOpen || !activeChatId) return;

        const loadMessages = async () => {
            const loadedMessages = await getCorporateMessages(activeChatId);
            setMessages(loadedMessages);
            markCorporateChatAsRead(activeChatId, user.id);
        };

        setIsLoading(true);
        loadMessages().finally(() => setIsLoading(false));

        const msgInterval = setInterval(loadMessages, 3000); // More frequent polling for active chat

        return () => clearInterval(msgInterval);
    }, [user, isOpen, activeChatId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleStartChat = async (targetUserId: string) => {
        if (!user) return;
        setIsLoading(true);
        try {
            const chatId = await createCorporateChat([user.id, targetUserId]);
            const updatedChats = await getCorporateChats(user.id);
            setChats(updatedChats);
            setActiveChatId(chatId);
        } catch (e) {
            console.error("Failed to start chat", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !user || !activeChatId) return;

        const chat = chats.find(c => c.id === activeChatId);
        if (!chat) return;

        const textToSend = inputText.trim();
        setInputText('');

        // Optimistic UI update
        const tempMsg: CorporateMessage = {
            id: 'temp-' + Date.now(),
            chatId: activeChatId,
            senderId: user.id,
            text: textToSend,
            timestamp: Date.now(),
            isRead: true
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            await sendCorporateMessage(activeChatId, user.id, textToSend, chat.participants);
        } catch (err) {
            console.error("Попытка отправки провалена:", err);
            // Rollback optimistic
            setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
        }
    };

    const getUserName = (userId: string) => {
        if (userId === user?.id) return "Вы";
        const u = users.find(u => u.id === userId);
        return u ? `${u.firstName} ${u.lastName}` : 'Неизвестный';
    };

    const getChatPartnerId = (chat: CorporateChat) => {
        return chat.participants.find(p => p !== user?.id) || chat.participants[0];
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 left-0 w-80 sm:w-96 bg-white shadow-2xl z-50 flex flex-col border-r border-slate-200 transform transition-transform duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <MessageCircle size={20} className="text-korda-500" />
                    Внутренний чат
                </h2>
                <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
                    <X size={20} />
                </button>
            </div>

            {!activeChatId ? (
                <div className="flex flex-col flex-1 overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-100">
                        <button
                            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'chats' ? 'text-korda-600 border-b-2 border-korda-500' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('chats')}
                        >
                            Диалоги
                        </button>
                        <button
                            className={`flex-1 py-3 text-sm font-medium ${activeTab === 'users' ? 'text-korda-600 border-b-2 border-korda-500' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setActiveTab('users')}
                        >
                            Сотрудники
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        {activeTab === 'chats' ? (
                            <div className="space-y-1">
                                {chats.length === 0 ? (
                                    <p className="text-center text-slate-400 text-sm mt-8">Нет активных диалогов</p>
                                ) : (
                                    chats.map(chat => {
                                        const unread = user && chat.unreadCount ? chat.unreadCount[user.id] || 0 : 0;
                                        const partnerId = getChatPartnerId(chat);
                                        return (
                                            <button
                                                key={chat.id}
                                                onClick={() => setActiveChatId(chat.id)}
                                                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 border border-transparent hover:border-slate-100"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 uppercase font-bold text-sm">
                                                    {getUserName(partnerId).substring(0, 2)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-800 truncate">{getUserName(partnerId)}</p>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {chat.lastMessage?.text || "Нет сообщений"}
                                                    </p>
                                                </div>
                                                {unread > 0 && (
                                                    <div className="w-5 h-5 rounded-full bg-korda-500 text-white text-[10px] flex items-center justify-center font-bold">
                                                        {unread}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {users.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleStartChat(u.id)}
                                        className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-3 border border-transparent hover:border-slate-100"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 uppercase font-bold text-sm">
                                            {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-800 truncate">{u.firstName} {u.lastName}</p>
                                            <p className="text-xs text-slate-400 truncate">{u.role}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Chat View */
                <div className="flex flex-col flex-1 overflow-hidden bg-slate-50/50">
                    <div className="p-3 border-b border-slate-100 bg-white flex items-center gap-3">
                        <button onClick={() => setActiveChatId(null)} className="text-slate-400 hover:text-korda-500 text-sm font-medium">
                            ← Назад
                        </button>
                        <div className="text-sm font-bold text-slate-800 truncate">
                            {getUserName(getChatPartnerId(chats.find(c => c.id === activeChatId)!))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {isLoading && messages.length === 0 ? (
                            <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-korda-500 border-t-transparent rounded-full animate-spin" /></div>
                        ) : (
                            messages.map(msg => {
                                const isMe = msg.senderId === user?.id;
                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isMe ? 'bg-korda-500 text-white rounded-tr-sm' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-sm'
                                            }`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[10px] text-slate-400 mt-1 px-1">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 bg-white border-t border-slate-100">
                        <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                            <input
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="Введите сообщение..."
                                className="flex-1 bg-slate-100 border-transparent rounded-full px-4 py-2 text-sm focus:bg-white focus:border-korda-500 focus:ring-2 focus:ring-korda-100 outline-none transition-all"
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim()}
                                className="w-9 h-9 flex items-center justify-center rounded-full bg-korda-500 text-white disabled:opacity-50 disabled:bg-slate-300 transition-colors shrink-0"
                            >
                                <Send size={16} className="-ml-0.5 mt-0.5" />
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
