import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { ChatSession, ChatMode, Message, UserRole, ConveyorRequest, ConveyorStatus } from '../types';
import * as storage from '../services/storage';
import { getSystemSettings, getUserChatsFromFirebase, saveChatToFirebase, deleteChatFromFirebase, getCorporateChats, getConveyorRequests } from '../services/firebaseService';
import { useAuth } from './AuthContext';
import { DEFAULT_WELCOME_MESSAGES } from '../constants';

export type AppView = 'chat' | 'studio' | 'testing' | 'report' | 'tasks' | 'tenders' | 'conveyor' | 'org-tasks' | 'sandbox';

interface NavigationContextType {
   // View
   currentView: AppView;
   setCurrentView: (view: AppView) => void;
   navigateChat: () => void;
   navigateStudio: () => void;
   navigateTesting: () => void;
   navigateTasks: () => void;
   navigateTenders: () => void;
   navigateConveyor: () => void;
   navigateOrgTasks: () => void;
   navigateSandbox: () => void;
   openAdmin: () => void;

   // Admin
   isAdminOpen: boolean;
   setIsAdminOpen: (v: boolean) => void;
   adminInitialTab: string;
   setAdminInitialTab: (tab: string) => void;

   // Sidebar
   isSidebarOpen: boolean;
   toggleSidebar: () => void;

   // Chats
   chats: ChatSession[];
   currentChatId: string | undefined;
   selectChat: (id: string) => void;
   createChat: (mode: ChatMode, title: string, initialMessage?: string, skipNavigation?: boolean) => void;
   deleteChat: (id: string) => void;
   pinChat: (id: string) => void;
   renameChat: (id: string, title: string) => void;
   updateMessages: (chatId: string, messages: Message[]) => void;

   // Pending input (from TasksPage)
   pendingInput: string;
   clearPendingInput: () => void;

   // Report
   reportUserId: string | null;
   setReportUserId: (id: string | null) => void;

   // Corporate chat
   corporateUnreadCount: number;
   isCorporateChatOpen: boolean;
   setIsCorporateChatOpen: (v: boolean) => void;

   // Psychologist
   isPsychologistOpen: boolean;
   setIsPsychologistOpen: (v: boolean) => void;

   // Conveyor Global State
   conveyorRequests: ConveyorRequest[];
   setConveyorRequests: React.Dispatch<React.SetStateAction<ConveyorRequest[]>>;
   conveyorNotificationCount: number;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const useNavigation = (): NavigationContextType => {
   const ctx = useContext(NavigationContext);
   if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
   return ctx;
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const { user } = useAuth();

   // View state
   const [currentView, setCurrentView] = useState<AppView>('chat');
   const [isAdminOpen, setIsAdminOpen] = useState(false);
   const [adminInitialTab, setAdminInitialTab] = useState('project_changelog');
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [reportUserId, setReportUserId] = useState<string | null>(null);

   // Chat state
   const [chats, setChats] = useState<ChatSession[]>([]);
   const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
   const [pendingInput, setPendingInput] = useState('');

   // Corporate chat
   const [isCorporateChatOpen, setIsCorporateChatOpen] = useState(false);
   const [corporateUnreadCount, setCorporateUnreadCount] = useState(0);

   // Psychologist
   const [isPsychologistOpen, setIsPsychologistOpen] = useState(false);

   // Conveyor Global State
   const [conveyorRequests, setConveyorRequests] = useState<ConveyorRequest[]>([]);
   const [conveyorNotificationCount, setConveyorNotificationCount] = useState(0);

   // IP access (internal)
   const [ipAccessDenied, setIpAccessDenied] = useState(false);

   // Debounced save: prevents race conditions when updateMessages is called rapidly
   const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
   const pendingSavesRef = useRef<Record<string, ChatSession>>({});

   // --- Navigation shortcuts ---
   const navigateChat = useCallback(() => setCurrentView('chat'), []);
   const navigateStudio = useCallback(() => setCurrentView('studio'), []);
   const navigateTesting = useCallback(() => setCurrentView('testing'), []);
   const navigateTasks = useCallback(() => setCurrentView('tasks'), []);
   const navigateTenders = useCallback(() => setCurrentView('tenders'), []);
   const navigateConveyor = useCallback(() => setCurrentView('conveyor'), []);
   const navigateOrgTasks = useCallback(() => setCurrentView('org-tasks'), []);
   const navigateSandbox = useCallback(() => setCurrentView('sandbox'), []);
   const openAdmin = useCallback(() => setIsAdminOpen(true), []);
   const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

   // --- Chat handlers ---
   const selectChat = useCallback((id: string) => {
      setCurrentChatId(id);
      setCurrentView('chat');
   }, []);

   const createChat = useCallback(async (mode: ChatMode, titlePrefix: string, initialMessage?: string, skipNavigation?: boolean) => {
      if (!user) return;

      let welcomeText = DEFAULT_WELCOME_MESSAGES[mode] || "";
      try {
         const settings = await getSystemSettings();
         if (settings?.welcomeMessages?.[mode]) welcomeText = settings.welcomeMessages[mode];
      } catch (e) {
         const local = storage.getWelcomeMessages();
         welcomeText = local[mode] || "";
      }

      const initialMessages: Message[] = [];
      if (welcomeText) {
         initialMessages.push({ id: crypto.randomUUID(), role: 'model', text: welcomeText, timestamp: Date.now() });
      }
      if (initialMessage && !skipNavigation) {
         initialMessages.push({ id: crypto.randomUUID(), role: 'user', text: initialMessage, timestamp: Date.now() + 100 });
      }

      const newChat: ChatSession = {
         id: crypto.randomUUID(),
         title: initialMessage ? titlePrefix : `${titlePrefix} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
         mode, createdAt: Date.now(), isPinned: false, messages: initialMessages
      };

      setChats(prev => [newChat, ...prev]);
      storage.saveUserChats(user.id, [newChat, ...storage.getChats(user.id).filter(chat => chat.id !== newChat.id)]);
      setCurrentChatId(newChat.id);
      setCurrentView('chat');
      if (skipNavigation && initialMessage) setPendingInput(initialMessage);
      saveChatToFirebase(user.id, newChat).catch(err => console.warn('[Chat Save] Cloud unavailable; kept locally.', err));
   }, [user]);

   const deleteChat = useCallback(async (id: string) => {
      setChats(prev => prev.filter(c => c.id !== id));
      if (user) storage.saveUserChats(user.id, storage.getChats(user.id).filter(c => c.id !== id));
      setCurrentChatId(prev => prev === id ? undefined : prev);
      if (user) deleteChatFromFirebase(user.id, id).catch(err => console.warn('[Chat Delete] Cloud unavailable; removed locally.', err));
   }, [user]);

   const pinChat = useCallback(async (id: string) => {
      let targetChat: ChatSession | undefined;
      setChats(prev => prev.map(c => {
         if (c.id === id) { targetChat = { ...c, isPinned: !c.isPinned }; return targetChat!; }
         return c;
      }));
      if (user && targetChat) {
         storage.saveUserChats(user.id, chatsRef.current.map(c => c.id === id ? targetChat! : c));
         saveChatToFirebase(user.id, targetChat).catch(err => console.warn('[Chat Pin] Cloud unavailable; kept locally.', err));
      }
   }, [user]);

   const renameChat = useCallback(async (id: string, newTitle: string) => {
      let targetChat: ChatSession | undefined;
      setChats(prev => prev.map(c => {
         if (c.id === id) { targetChat = { ...c, title: newTitle }; return targetChat!; }
         return c;
      }));
      if (user && targetChat) {
         storage.saveUserChats(user.id, chatsRef.current.map(c => c.id === id ? targetChat! : c));
         saveChatToFirebase(user.id, targetChat).catch(err => console.warn('[Chat Rename] Cloud unavailable; kept locally.', err));
      }
   }, [user]);
   const chatsRef = useRef<ChatSession[]>([]);
   React.useEffect(() => {
      chatsRef.current = chats;
   }, [chats]);

   const updateMessages = useCallback((chatId: string, messages: Message[]) => {
      setChats(prev => {
         const chatIndex = prev.findIndex(c => c.id === chatId);
         if (chatIndex === -1) return prev;

         const updatedChat = { ...prev[chatIndex], messages };
         const nextChats = [...prev];
         nextChats[chatIndex] = updatedChat;
         if (user) storage.saveUserChats(user.id, nextChats);

         // We use the functional updater to guarantee we have the absolute latest chat state,
         // even if it was just created milliseconds ago and hasn't committed to the DOM/refs yet.
         if (user) {
            pendingSavesRef.current[chatId] = updatedChat;

            if (saveTimersRef.current[chatId]) {
               clearTimeout(saveTimersRef.current[chatId]);
            }
            saveTimersRef.current[chatId] = setTimeout(async () => {
               const toSave = pendingSavesRef.current[chatId];
               if (toSave) {
                  try {
                     await saveChatToFirebase(user.id, toSave);
                  } catch (err) {
                     console.error('[Chat Save] Failed:', err);
                  }
                  delete pendingSavesRef.current[chatId];
               }
               delete saveTimersRef.current[chatId];
            }, 500);
         }

         return nextChats;
      });
   }, [user]);

   const clearPendingInput = useCallback(() => setPendingInput(''), []);

   // --- Load data on user change ---
   React.useEffect(() => {
      if (!user) {
         setChats([]); setCurrentChatId(undefined); setIpAccessDenied(false);
         return;
      }

      const loadChats = async () => {
         try {
            const cloudChats = await getUserChatsFromFirebase(user.id);
            if (cloudChats.length > 0) {
               setChats(cloudChats);
            } else {
               const localChats = storage.getChats(user.id);
               if (localChats.length > 0) {
                  console.log("Migrating local chats to cloud...");
                  await Promise.all(localChats.map(chat => saveChatToFirebase(user.id, chat)));
                  setChats(localChats);
               } else {
                  setChats([]);
               }
            }
         } catch (e) {
            console.error("Failed to load chats from cloud:", e);
            setChats(storage.getChats(user.id));
         }
      };

      const checkCorporateUnread = async () => {
         try {
            const corpChats = await getCorporateChats(user.id);
            const totalUnread = corpChats.reduce((sum, chat) => sum + (chat.unreadCount ? chat.unreadCount[user.id] || 0 : 0), 0);
            setCorporateUnreadCount(totalUnread);
         } catch (e) { console.warn("Failed to fetch unread counts", e); }
      };

      const checkConveyorUpdates = async () => {
         try {
            const reqs = await getConveyorRequests();
            setConveyorRequests(reqs);
            
            let count = 0;
            if (user.role === UserRole.CONSTRUCTOR) {
               count = reqs.filter(r => r.status === ConveyorStatus.PENDING_VERIFICATION).length;
            } else {
               count = reqs.filter(r => r.managerId === user.id && (r.status === ConveyorStatus.REJECTED || r.status === ConveyorStatus.VERIFIED)).length;
            }
            setConveyorNotificationCount(count);
         } catch (e) { console.warn("Failed to fetch conveyor updates", e); }
      };

      const checkIpAccess = async () => {
         if (!user.isIpRestricted) { setIpAccessDenied(false); return; }
         try {
            const [ipRes, settings] = await Promise.all([fetch('https://api.ipify.org?format=json'), getSystemSettings()]);
            if (!ipRes.ok) throw new Error("Failed to resolve IP");
            const { ip: currentIp } = await ipRes.json();
            const allowed: string[] = settings?.allowedIps || [];
            const trimmedAllowed = allowed.map((ip: string) => ip.trim());
            if (trimmedAllowed.length > 0 && !trimmedAllowed.includes(currentIp.trim())) {
               setIpAccessDenied(true);
            } else { setIpAccessDenied(false); }
         } catch (err) { console.error("IP Check Failed:", err); setIpAccessDenied(false); }
      };

      Promise.all([loadChats(), checkIpAccess(), checkCorporateUnread(), checkConveyorUpdates()]);
      const badgeInterval = setInterval(() => {
          checkCorporateUnread();
          checkConveyorUpdates();
      }, 10000);
      return () => clearInterval(badgeInterval);
   }, [user]);

   const value: NavigationContextType = {
      currentView, setCurrentView,
      navigateChat, navigateStudio, navigateTesting, navigateTasks, navigateTenders, navigateConveyor, navigateOrgTasks, navigateSandbox,
      openAdmin, isAdminOpen, setIsAdminOpen, adminInitialTab, setAdminInitialTab,
      isSidebarOpen, toggleSidebar,
      chats, currentChatId, selectChat, createChat, deleteChat, pinChat, renameChat, updateMessages,
      pendingInput, clearPendingInput,
      reportUserId, setReportUserId,
      corporateUnreadCount, isCorporateChatOpen, setIsCorporateChatOpen,
      isPsychologistOpen, setIsPsychologistOpen,
      conveyorRequests, setConveyorRequests, conveyorNotificationCount
   };

   return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};
