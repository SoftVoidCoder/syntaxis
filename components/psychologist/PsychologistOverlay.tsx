import React, { useState, useEffect } from 'react';
import { PsychologistAuth } from './PsychologistAuth';
import { PsychologistChatInterface, PSYCH_SCHOOL_NAMES } from './PsychologistChatInterface';
import { PsychologistChatSession } from '../../types';
import { getPsychologistChats, savePsychologistChat, deletePsychologistChat } from '../../services/psychologistStorage';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../Button';
import { Plus, MessageSquare, Trash2, Brain, ChevronRight } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

export const PsychologistOverlay: React.FC = () => {
    const { user } = useAuth();
    const { setIsPsychologistOpen } = useNavigation();
    
    // Auth state map
    const [pin, setPin] = useState<string | null>(null);
    const isAuthenticated = !!pin;
    
    // Chats state
    const [chats, setChats] = useState<PsychologistChatSession[]>([]);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // New Chat Modal state
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newSchool, setNewSchool] = useState<string>('machine');

    useEffect(() => {
        if (isAuthenticated && user) {
            loadChats();
        }
    }, [isAuthenticated, user]);

    const loadChats = async () => {
        if (!user || !pin) return;
        setIsLoading(true);
        try {
             const loaded = await getPsychologistChats(user.id, pin);
             setChats(loaded);
             if (loaded.length > 0 && !currentChatId) {
                 setCurrentChatId(loaded[0].id);
             }
        } catch (e) {
            console.error("Error loading psych chats", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAuthenticated = (validPin: string) => {
        setPin(validPin);
    };

    const createNewChat = async () => {
        if (!user || !pin) return;
        const newChat: PsychologistChatSession = {
            id: crypto.randomUUID(),
            title: `Сессия ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}`,
            createdAt: Date.now(),
            school: newSchool,
            messages: []
        };
        
        await savePsychologistChat(user.id, newChat, pin);
        setChats([newChat, ...chats]);
        setCurrentChatId(newChat.id);
        setIsCreatingNew(false);
    };

    const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user || !pin) return;
        if (!confirm('Навсегда удалить этот диалог?')) return;
        
        await deletePsychologistChat(user.id, id, pin);
        setChats(prev => prev.filter(c => c.id !== id));
        if (currentChatId === id) {
            setCurrentChatId(null);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            setIsPsychologistOpen(false);
        }
    };

    const currentChat = chats.find(c => c.id === currentChatId);

    return (
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300 overflow-hidden"
            onClick={handleBackdropClick}
        >
            <div className="bg-white w-[95vw] h-[95vh] rounded-3xl shadow-2xl overflow-hidden flex animate-in zoom-in-95 duration-500 border border-slate-200">
                {!isAuthenticated ? (
                    <div className="flex-1 flex items-center justify-center bg-slate-50 relative overflow-y-auto">
                        <button 
                            onClick={() => setIsPsychologistOpen(false)}
                            className="absolute top-6 right-6 p-2 bg-white rounded-full shadow hover:bg-slate-100 text-slate-500 transition-colors"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                        <PsychologistAuth onAuthenticated={handleAuthenticated} />
                    </div>
                ) : (
                    // Authenticated View -> Split Screen (Sidebar + Chat)
                    <div className="flex flex-1 w-full h-full relative" onClick={e => e.stopPropagation()}>
                         {/* Sidebar */}
                         <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
                             <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-slate-50/90 backdrop-blur z-10">
                                 <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                     <Brain size={18} className="text-indigo-600" />
                                     Нейроментор
                                 </h2>
                                 <button 
                                     onClick={() => setIsPsychologistOpen(false)}
                                     className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                                 >
                                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                 </button>
                             </div>

                             <div className="p-4">
                                 <Button 
                                     onClick={() => setIsCreatingNew(true)} 
                                     className="w-full bg-indigo-600 hover:bg-indigo-700 font-semibold gap-2 py-2.5 rounded-xl shadow-md border-none"
                                 >
                                     <Plus size={18} /> Новый сеанс
                                 </Button>
                             </div>

                             {isCreatingNew && (
                                 <div className="p-4 bg-indigo-50 border-y border-indigo-100 animate-in slide-in-from-top-2">
                                     <label className="block text-xs font-bold text-indigo-800 mb-2 uppercase tracking-wider">Выберите школу</label>
                                     <select 
                                         value={newSchool}
                                         onChange={e => setNewSchool(e.target.value)}
                                         className="w-full bg-white border border-indigo-200 rounded-lg p-2.5 text-slate-800 mb-3 outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm shadow-sm"
                                     >
                                         <option value="machine">🤖 Машинный разум (Логика)</option>
                                         <option value="strategist">♟️ Стратег (Решения)</option>
                                         <option value="diagnostician">🩺 Диагност (Гипотезы)</option>
                                         <option value="detective">🔍 Детектив (Факты)</option>
                                         <option value="devils_advocate">👿 Адвокат дьявола (Вызов)</option>
                                         <option value="philosopher">🏛️ Сократ (Вопросы)</option>
                                         <option value="kpt">🧩 КПТ (Искажения)</option>
                                         <option value="gestalt">🌀 Гештальт (Ощущения)</option>
                                         <option value="psychoanalysis">🛋️ Психоанализ (Подсознание)</option>
                                         <option value="humanistic">🤲 Гуманистическая (Принятие)</option>
                                         <option value="existential">🌌 Экзистенциальная (Смысл)</option>
                                         <option value="narrative">📖 Нарративная (История)</option>
                                         <option value="systemic">🔗 Системная (Отношения)</option>
                                         <option value="rebt">⚡ РЭПТ (Рациональность)</option>
                                         <option value="positive">☀️ Позитивная (Ресурсы)</option>
                                         <option value="sfbt">🎯 Решение-фокусированная (Результат)</option>
                                     </select>
                                     <div className="flex gap-2">
                                         <Button variant="secondary" onClick={() => setIsCreatingNew(false)} className="flex-1 py-2 text-xs bg-white border-indigo-200 text-slate-600 hover:bg-slate-50">Отмена</Button>
                                         <Button onClick={createNewChat} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 border-none text-xs">Создать</Button>
                                     </div>
                                 </div>
                             )}

                             <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                 {chats.map(c => (
                                     <div 
                                         key={c.id} 
                                         onClick={() => setCurrentChatId(c.id)}
                                         className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${currentChatId === c.id ? 'bg-white shadow-sm ring-1 ring-slate-200/50' : 'hover:bg-slate-200/50 text-slate-600'}`}
                                     >
                                         <div className="flex items-center gap-3 overflow-hidden">
                                             <MessageSquare size={16} className={currentChatId === c.id ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500 transition-colors'} />
                                             <div className="flex flex-col truncate">
                                                 <span className={`text-sm font-medium truncate ${currentChatId === c.id ? 'text-slate-800' : ''}`}>{c.title}</span>
                                                 <span className="text-[10px] text-slate-500 font-medium mt-0.5">{PSYCH_SCHOOL_NAMES[c.school] || c.school}</span>
                                             </div>
                                         </div>
                                         <div className="flex items-center">
                                             <button 
                                                 onClick={(e) => handleDeleteChat(c.id, e)}
                                                 className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                             >
                                                 <Trash2 size={14} />
                                             </button>
                                         </div>
                                     </div>
                                 ))}
                                 
                                 {chats.length === 0 && !isCreatingNew && (
                                     <div className="text-center p-8 text-slate-400 text-sm">
                                         У вас пока нет активных диалогов. Создайте новый сеанс.
                                     </div>
                                 )}
                             </div>
                         </div>
                         
                         {/* Main Chat Area */}
                         <div className="flex-1 bg-white relative">
                             {currentChat ? (
                                 <PsychologistChatInterface 
                                     chat={currentChat} 
                                     pin={pin} 
                                     onUpdateChat={(updated) => {
                                         setChats(prev => prev.map(c => c.id === updated.id ? updated : c));
                                     }} 
                                     onClose={() => setIsPsychologistOpen(false)}
                                 />
                             ) : (
                                 <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                     <Brain size={48} className="text-slate-200 mb-4" />
                                     <p>Выберите диалог из списка слева</p>
                                     <p className="text-sm mt-1">или создайте новый сеанс</p>
                                 </div>
                             )}
                         </div>
                    </div>
                )}
            </div>
        </div>
    );
};
