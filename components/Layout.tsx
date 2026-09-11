import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '../context/NavigationContext';
import { ChatMode, UserRole } from '../types';
import { LogOut, Plus, MessageSquare, Trash2, Pin, Shield, Menu, X, Palette, GraduationCap, Briefcase, ClipboardList, Search, BrainCircuit, Calculator, BarChart3, Settings, BookOpen, MessageCircle, Layers, CheckSquare, Factory, FlaskConical } from 'lucide-react';
import { Button } from './Button';
import { UserProfileModal } from './UserProfileModal';
import { PsychologistOverlay } from './psychologist/PsychologistOverlay';
import { getAllUsersFromFirebase, getDailyReportsFromFirebase } from '../services/firebaseService';
import { ShirtIcon, TieIcon, SuitIcon } from './dashboard/StatusIcons';

interface LayoutProps {
  children: React.ReactNode;
  hideMobileHeader?: boolean;
}

const KordaLogo = () => (
  <img src="/logo.png" alt="Korda Syntax" className="w-12 h-12 object-contain" />
);

export const Layout: React.FC<LayoutProps> = ({ children, hideMobileHeader = false }) => {
  const { user, logout } = useAuth();
  const nav = useNavigation();
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const { chats, currentChatId, currentView, isSidebarOpen, toggleSidebar, isPsychologistOpen, setIsPsychologistOpen, isCorporateChatOpen, setIsCorporateChatOpen, corporateUnreadCount, conveyorNotificationCount } = nav;

  const [userStatus, setUserStatus] = useState<'SHIRT'|'TIE'|'SUIT' | null>(null);

  React.useEffect(() => {
    if (!user || user.role !== UserRole.MANAGER) return;
    
    const loadData = async () => {
      try {
        const [fbUsers, fbReports] = await Promise.all([
          getAllUsersFromFirebase(),
          getDailyReportsFromFirebase()
        ]);
        
        const getKPI = (u: any, reports: any[]) => {
          const uFirst = (u.firstName || "").toLowerCase();
          const uLast = (u.lastName || "").toLowerCase();
          const targetBitrixId = u.bitrixUserId ? String(u.bitrixUserId) : null;
          const userReports = reports.filter((r: any) => {
             const reportBitrixId = r.bitrixId || r.userId;
             if (targetBitrixId && reportBitrixId) return String(reportBitrixId) === targetBitrixId;
             const reportName = (r.name || "").toLowerCase();
             return reportName.includes(uLast) || (uFirst && reportName.includes(uFirst));
          });
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          const current7Days = userReports.filter((r: any) => {
             const d = new Date(r.date);
             const diff = (today.getTime() - d.getTime()) / (1000 * 3600 * 24);
             return diff >= 0 && diff <= 7;
          });
          const currentKPI = current7Days.reduce((sum: number, r: any) => {
             const outTel = Array.isArray(r.telephony) ? r.telephony.filter((t: any) => String(t.direction) === '2' && (Number(t.duration) || 0) >= 30).length : 0;
             const outEm = Array.isArray(r.emails) ? r.emails.filter((e: any) => String(e.direction) === '2').length : 0;
             return sum + outTel + outEm;
          }, 0);
          return parseFloat((currentKPI / 56).toFixed(1));
        };
        
        const managers = fbUsers.filter((u: any) => u.role === UserRole.MANAGER && !u.isBlocked);
        const sorted = managers.map((u: any) => ({
          user: u,
          kdch: getKPI(u, fbReports)
        })).sort((a: any, b: any) => b.kdch - a.kdch);
        
        const myIndex = sorted.findIndex((r: any) => r.user.id === user.id);
        if (myIndex >= 0) {
          if (myIndex < 3) setUserStatus('SUIT');
          else if (myIndex < 8) setUserStatus('TIE');
          else setUserStatus('SHIRT');
        }
      } catch (e) {
        console.error("Failed to load user status", e);
      }
    };
    loadData();
  }, [user]);

  const sortedChats = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    const filtered = query
      ? chats.filter(c => {
          const matchTitle = c.title.toLowerCase().includes(query);
          const matchContent = c.messages.some(m => m.text.toLowerCase().includes(query));
          return matchTitle || matchContent;
        })
      : chats;
    return [...filtered].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [chats, historySearch]);

  const getChatIcon = (mode: ChatMode) => {
    switch (mode) {
      case ChatMode.FREE: return <MessageSquare size={14} className="text-white" />;
      case ChatMode.SALES: return <Briefcase size={14} className="text-white" />;
      case ChatMode.TRAINING: return <GraduationCap size={14} className="text-white" />;
      case ChatMode.DEEP_RESEARCH: return <Search size={14} className="text-white" />;
      case ChatMode.CALCULATION: return <Calculator size={14} className="text-white" />;
      case ChatMode.ANALYTICS: return <BarChart3 size={14} className="text-white" />;
      case ChatMode.KNOWLEDGE: return <BookOpen size={14} className="text-white" />;
      default: return <MessageSquare size={14} className="text-white" />;
    }
  };

  const canAccessStudio = user?.permissions?.canGenerateImages || user?.permissions?.canGenerateVideos;
  const canSearchClients = user?.permissions?.canSearchClients;
  const canAccessTenders = user?.permissions?.canAccessTenders;
  const canAccessSales = user?.permissions?.canAccessSales;
  const canAccessAnalytics = user?.permissions?.canAccessAnalytics;
  const canAccessCalculation = user?.permissions?.canAccessCalculation;
  const canAccessKnowledge = user?.permissions?.canAccessKnowledge;
  const canAccessDeepResearch = user?.permissions?.canAccessDeepResearch;
  const canAccessConveyor = user?.permissions?.canAccessConveyor;
  const canAccessSandbox = user?.permissions?.canAccessSandbox;

  return (
    <div className="fixed inset-0 flex bg-slate-50 overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden" onClick={toggleSidebar} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out shadow-xl md:shadow-none
        md:relative md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={nav.navigateChat} title="Сравнительная аналитика">
                <KordaLogo />
                <h1 className="text-lg font-black text-slate-800 tracking-tight group-hover:text-korda-600 transition-colors">Korda Syntax</h1>
              </div>
              <button onClick={toggleSidebar} className="md:hidden text-slate-500 hover:text-slate-800">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-white hover:shadow-sm transition-all group" onClick={() => setIsProfileModalOpen(true)} title="Настройки профиля">
               {user?.role === UserRole.MANAGER && userStatus ? (
                 <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-105
                   ${userStatus === 'SUIT' ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-500' :
                     userStatus === 'TIE' ? 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200 text-indigo-500' :
                     'bg-white border-slate-200 text-slate-400'}`}>
                   {userStatus === 'SUIT' ? <SuitIcon className="w-6 h-6" /> :
                    userStatus === 'TIE' ? <TieIcon className="w-6 h-6" /> :
                    <ShirtIcon className="w-6 h-6" />}
                 </div>
               ) : (
                 <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 flex items-center justify-center text-sm font-black border border-slate-200 shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                   {user?.username.substring(0, 2).toUpperCase()}
                 </div>
               )}
               <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-slate-800 truncate leading-tight group-hover:text-korda-600 transition-colors">{user?.firstName} {user?.lastName}</span>
                  <span className={`inline-block mt-0.5 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider self-start ${
                    user?.role === UserRole.DIRECTOR ? 'bg-rose-100 text-rose-600' :
                    user?.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-600' :
                    user?.role === UserRole.SUPERVISOR ? 'bg-teal-100 text-teal-600' :
                    user?.role === UserRole.MANAGER ? 'bg-blue-100 text-blue-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {user?.role === UserRole.DIRECTOR ? 'ВЛАДЕЛЕЦ' : user?.role === UserRole.ADMIN ? 'ADMIN' : user?.role === UserRole.SUPERVISOR ? 'УПРАВЛЕНЕЦ' : user?.role === UserRole.MANAGER ? 'MANAGER' : 'СОТРУДНИК'}
                  </span>
               </div>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <Button className="w-full flex items-center justify-center gap-2 shadow-sm shadow-korda-500/20" onClick={() => setIsNewChatModalOpen(true)}>
              <Plus size={18} /> Новый диалог
            </Button>
          </div>

          {/* App Navigation Links */}
          <div className="px-3 mb-2 space-y-1">
            {(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR || user?.role === UserRole.DIRECTOR) && (
              <button 
                onClick={() => { nav.openAdmin(); if (isSidebarOpen) toggleSidebar(); }} 
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-slate-700 hover:bg-slate-200 hover:text-slate-900 mb-1`}
              >
                <Shield size={18} className="text-slate-500" /><span className="font-bold">Админ-панель</span>
              </button>
            )}

            {canAccessSandbox && (
              <button
                onClick={() => { nav.navigateSandbox(); if (isSidebarOpen) toggleSidebar(); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === 'sandbox' ? 'bg-teal-900 text-teal-100 font-bold shadow-inner' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-900'}`}
              >
                <FlaskConical size={18} className={currentView === 'sandbox' ? 'text-teal-400' : ''} /><span className="font-medium tracking-wide">Лаба</span>
              </button>
            )}

            <button
              onClick={() => { nav.navigateTesting(); if (isSidebarOpen) toggleSidebar(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === 'testing' ? 'bg-teal-900 text-teal-100 font-bold shadow-inner' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-900'}`}
            >
              <ClipboardList size={18} className={currentView === 'testing' ? 'text-teal-400' : ''} /><span className="font-medium tracking-wide">Тестирование</span>
            </button>

            {canAccessStudio && (
              <button onClick={() => { nav.navigateStudio(); if (isSidebarOpen) toggleSidebar(); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === 'studio' ? 'bg-teal-900 text-teal-100 font-bold shadow-inner' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-900'}`}>
                <Palette size={18} className={currentView === 'studio' ? 'text-teal-400' : ''} /><span className="font-medium tracking-wide">Design Studio</span>
              </button>
            )}

            {canAccessConveyor && (
              <button onClick={() => { nav.navigateConveyor(); if (isSidebarOpen) toggleSidebar(); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === 'conveyor' ? 'bg-teal-900 text-teal-100 font-bold shadow-inner' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-900'}`}>
                <Factory size={18} className={currentView === 'conveyor' ? 'text-teal-400' : ''} />
                <span className="font-medium tracking-wide">Конвейер</span>
                {conveyorNotificationCount > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {conveyorNotificationCount > 9 ? '9+' : conveyorNotificationCount}
                  </span>
                )}
              </button>
            )}

            {canSearchClients && (
              <button onClick={() => { nav.navigateTasks(); if (isSidebarOpen) toggleSidebar(); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === 'tasks' ? 'bg-teal-900 text-teal-100 font-bold shadow-inner' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-900'}`}>
                <Briefcase size={18} className={currentView === 'tasks' ? 'text-teal-400' : ''} /><span className="font-medium tracking-wide">Поиск клиентов</span>
              </button>
            )}

            {/* Добавляем доску задач без дополнительных ограничений, так как это внутренний инструмент управления задачами 
            <button onClick={() => { nav.navigateOrgTasks(); if (isSidebarOpen) toggleSidebar(); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === 'org-tasks' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
              <CheckSquare size={18} /><span className="font-medium">Мои задачи</span>
            </button>
            */}

            {canAccessTenders && (
              <button onClick={() => { nav.navigateTenders(); if (isSidebarOpen) toggleSidebar(); }} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${currentView === 'tenders' ? 'bg-teal-900 text-teal-100 font-bold shadow-inner' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-900'}`}>
                <ClipboardList size={18} className={currentView === 'tenders' ? 'text-teal-400' : ''} /><span className="font-medium tracking-wide">Тендеры</span>
              </button>
            )}

            <button 
              onClick={() => { setIsPsychologistOpen(true); if (isSidebarOpen) toggleSidebar(); }} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isPsychologistOpen ? 'bg-teal-900 text-teal-100 font-bold shadow-inner' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-900'}`}
            >
              <BrainCircuit size={18} className={isPsychologistOpen ? 'text-teal-400' : ''} /><span className="font-medium tracking-wide">Нейроментор</span>
            </button>

            {/* 
            <button 
              onClick={() => { setIsCorporateChatOpen(true); if (isSidebarOpen) toggleSidebar(); }} 
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isCorporateChatOpen ? 'bg-korda-50 text-korda-700 font-bold' : 'text-slate-600 hover:bg-slate-100 hover:text-korda-900'}`}
            >
              <MessageCircle size={18} className={isCorporateChatOpen ? 'text-korda-600' : ''} />
              <span className="font-medium">Внутренний чат</span>
              {corporateUnreadCount > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {corporateUnreadCount > 9 ? '9+' : corporateUnreadCount}
                </span>
              )}
            </button>
            */}

          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1 mt-2 border-t border-slate-100 pt-2">
            <h3 className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">История</h3>
            <div className="px-2 pb-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Поиск по чатам..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 border border-transparent rounded-lg focus:bg-white focus:border-korda-400 focus:ring-1 focus:ring-korda-200 outline-none transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
            {sortedChats.length === 0 && (
              <div className="text-center text-slate-400 mt-4 text-sm px-4">
                {historySearch.trim() ? 'Ничего не найдено' : 'Нет активных диалогов'}
              </div>
            )}
            {sortedChats.map(chat => (
              <div
                key={chat.id}
                className={`group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors
                  ${currentChatId === chat.id && currentView === 'chat' ? 'bg-slate-100 text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                onClick={() => { nav.selectChat(chat.id); if (isSidebarOpen) toggleSidebar(); }}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold shadow-sm
                  ${chat.mode === ChatMode.SALES ? 'bg-korda-500 text-white' :
                    chat.mode === ChatMode.TRAINING ? 'bg-purple-500 text-white' :
                      chat.mode === ChatMode.DEEP_RESEARCH ? 'bg-indigo-500 text-white' :
                        chat.mode === ChatMode.CALCULATION ? 'bg-orange-500 text-white' :
                          chat.mode === ChatMode.ANALYTICS ? 'bg-teal-500 text-white' :
                            chat.mode === ChatMode.KNOWLEDGE ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}`}
                >
                  {getChatIcon(chat.mode)}
                </div>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{chat.title}</p></div>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); nav.pinChat(chat.id); }} className={`p-1 hover:text-korda-600 ${chat.isPinned ? 'text-korda-500 opacity-100' : 'text-slate-400'}`} title="Закрепить"><Pin size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); nav.deleteChat(chat.id); }} className="p-1 text-slate-400 hover:text-red-500" title="Удалить"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* User Footer */}
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <Button variant="ghost" className="w-full text-xs py-2 text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={logout}>
              <LogOut size={14} className="mr-2" /> Выйти из аккаунта
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-50">
        {!hideMobileHeader && (
          <div className="md:hidden shrink-0 flex items-center p-4 border-b border-slate-200 bg-white shadow-sm z-20">
            <button onClick={toggleSidebar} className="mr-4 text-slate-600"><Menu size={24} /></button>
            <div className="cursor-pointer" onClick={nav.navigateChat}>
               <KordaLogo />
            </div>
            <span className="font-bold ml-2 text-slate-800 truncate" onClick={() => setIsProfileModalOpen(true)}>{user?.firstName} {user?.lastName}</span>
          </div>
        )}
        <main className="flex-1 flex flex-col relative overflow-y-auto">{children}</main>
      </div>

      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />

      {isPsychologistOpen && <PsychologistOverlay />}

      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-5xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-slate-800 text-center">Выберите режим работы</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <button onClick={() => { nav.createChat(ChatMode.FREE, "Чат"); setIsNewChatModalOpen(false); }} className="flex flex-col items-center p-6 rounded-xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group bg-white shadow-sm hover:shadow-md">
                <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><MessageSquare size={28} /></div>
                <span className="font-bold text-slate-800 mb-2">Свободный</span>
                <span className="text-xs text-center text-slate-500">Базовый ассистент без контекста</span>
              </button>

              {canAccessSales && (
                <button onClick={() => { nav.createChat(ChatMode.SALES, "Продажи"); setIsNewChatModalOpen(false); }} className="flex flex-col items-center p-6 rounded-xl border-2 border-slate-100 hover:border-korda-500 hover:bg-korda-50 transition-all group bg-white shadow-sm hover:shadow-md">
                  <div className="w-14 h-14 rounded-full bg-korda-100 text-korda-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Briefcase size={28} /></div>
                  <span className="font-bold text-slate-800 mb-2">Продажи</span>
                  <span className="text-xs text-center text-slate-500">Поиск, письма, анализ с базой Korda</span>
                </button>
              )}

              <button onClick={() => { nav.createChat(ChatMode.TRAINING, "Обучение"); setIsNewChatModalOpen(false); }} className="flex flex-col items-center p-6 rounded-xl border-2 border-slate-100 hover:border-purple-500 hover:bg-purple-50 transition-all group bg-white shadow-sm hover:shadow-md">
                <div className="w-14 h-14 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><GraduationCap size={28} /></div>
                <span className="font-bold text-slate-800 mb-2">Обучение</span>
                <span className="text-xs text-center text-slate-500">Изучение рынка и продуктов компании</span>
              </button>

              {canAccessDeepResearch && (
              <button onClick={() => { nav.createChat(ChatMode.DEEP_RESEARCH, "Исследование"); setIsNewChatModalOpen(false); }} className="flex flex-col items-center p-6 rounded-xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group bg-white shadow-sm hover:shadow-md">
                <div className="w-14 h-14 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><BrainCircuit size={28} /></div>
                <span className="font-bold text-slate-800 mb-2">Глубокий Анализ</span>
                <span className="text-xs text-center text-slate-500">План → Поиск → Отчет с источниками</span>
              </button>
              )}

              {canAccessCalculation && (
                <button onClick={() => { nav.createChat(ChatMode.CALCULATION, "Расчет"); setIsNewChatModalOpen(false); }} className="flex flex-col items-center p-6 rounded-xl border-2 border-slate-100 hover:border-orange-500 hover:bg-orange-50 transition-all group bg-white shadow-sm hover:shadow-md">
                  <div className="w-14 h-14 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Calculator size={28} /></div>
                  <span className="font-bold text-slate-800 mb-2">Расчет</span>
                  <span className="text-xs text-center text-slate-500">Сметы, прайсы, теплоизоляция</span>
                </button>
              )}

              {canAccessAnalytics && (
                <button onClick={() => { nav.createChat(ChatMode.ANALYTICS, "Аналитика"); setIsNewChatModalOpen(false); }} className="flex flex-col items-center p-6 rounded-xl border-2 border-slate-100 hover:border-teal-500 hover:bg-teal-50 transition-all group bg-white shadow-sm hover:shadow-md">
                  <div className="w-14 h-14 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><BarChart3 size={28} /></div>
                  <span className="font-bold text-slate-800 mb-2">Аналитика</span>
                  <span className="text-xs text-center text-slate-500">Отчеты Bitrix, KPI, Финансы</span>
                </button>
              )}

              {canAccessKnowledge && (
                <button onClick={() => { nav.createChat(ChatMode.KNOWLEDGE, "База Знаний"); setIsNewChatModalOpen(false); }} className="flex flex-col items-center p-6 rounded-xl border-2 border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-all group bg-white shadow-sm hover:shadow-md">
                  <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><BookOpen size={28} /></div>
                  <span className="font-bold text-slate-800 mb-2">База Знаний</span>
                  <span className="text-xs text-center text-slate-500">Поиск по документам R&D (RAG)</span>
                </button>
              )}
            </div>
            <Button variant="ghost" className="w-full text-slate-500 hover:text-slate-800" onClick={() => setIsNewChatModalOpen(false)}>Отмена</Button>
          </div>
        </div>
      )}
    </div>
  );
};