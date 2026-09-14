
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, Message, ChatMode, Attachment, QuickPrompt } from '../types';
import { generateGeminiResponse, uploadFileToGemini } from '../services/geminiService';
import { trackChatRequest } from '../services/storage';
import { getSystemSettings, getKnowledgeBaseFromFirebase, logAnalyticsEvent, getPersonalPrompts, savePersonalPrompt, deletePersonalPrompt } from '../services/firebaseService';
import { Button } from '../components/Button';
import { Send, Paperclip, Edit2, X, RefreshCw, Search, BrainCircuit, Calculator, Zap, Menu, BarChart3, Square, Info, Maximize2, BookOpen, Upload, User as UserIcon, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SalesModeBlocker } from '../components/SalesModeBlocker';
import { ChatMessageBubble } from '../components/ChatMessageBubble';
import { useToolExecution } from '../hooks/useToolExecution';
import { prepareFileForChatAttachment } from '../utils/fileConverter';
import {
  DEFAULT_SALES_PROMPT, DEFAULT_TRAINING_PROMPT, DEFAULT_CALCULATION_PROMPT,
  DEFAULT_ANALYTICS_PROMPT, DEFAULT_DEEP_RESEARCH_PROMPT, DEFAULT_FREE_PROMPT,
  DEFAULT_KNOWLEDGE_PROMPT
} from '../constants';

const DEFAULT_MODE_PROMPTS = {
  sales: DEFAULT_SALES_PROMPT,
  training: DEFAULT_TRAINING_PROMPT,
  calculation: DEFAULT_CALCULATION_PROMPT,
  analytics: DEFAULT_ANALYTICS_PROMPT,
  deep_research: DEFAULT_DEEP_RESEARCH_PROMPT,
  free: DEFAULT_FREE_PROMPT,
  knowledge: DEFAULT_KNOWLEDGE_PROMPT,
};

interface ChatInterfaceProps {
  chat: ChatSession;
  onUpdateMessages: (messages: Message[]) => void;
  onRenameChat: (title: string) => void;
  onToggleSidebar: () => void;
  pendingInput?: string;
  onClearPendingInput?: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ chat, onUpdateMessages, onRenameChat, onToggleSidebar, pendingInput, onClearPendingInput }) => {
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [researchStartTime, setResearchStartTime] = useState<number | null>(null);
  const [researchElapsed, setResearchElapsed] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number } | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(chat.title);
  const [isFastModel, setIsFastModel] = useState(false);

  // Settings State
  const [prompts, setPrompts] = useState<any>(DEFAULT_MODE_PROMPTS);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [bitrixUrl, setBitrixUrl] = useState('');
  const bitrixUrlRef = useRef('');

  // Quick Prompts State (Admin)
  const [showTemplates, setShowTemplates] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<QuickPrompt[]>([]);

  // Personal Prompts State (User)
  const [showPersonalPrompts, setShowPersonalPrompts] = useState(false);
  const [personalPrompts, setPersonalPrompts] = useState<QuickPrompt[]>([]);
  const [isAddingPersonalPrompt, setIsAddingPersonalPrompt] = useState(false);
  const [newPersonalTitle, setNewPersonalTitle] = useState('');
  const [newPersonalContent, setNewPersonalContent] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);
  const personalPromptsRef = useRef<HTMLDivElement>(null);
  const autoTriggeredRef = useRef<string | null>(null);

  // Research timer
  useEffect(() => {
    if (!researchStartTime) { setResearchElapsed(0); return; }
    const interval = setInterval(() => setResearchElapsed(Math.floor((Date.now() - researchStartTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [researchStartTime]);

  // Full Screen Editor
  const [isFullScreenInput, setIsFullScreenInput] = useState(false);

  // Drag & Drop
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // --- Tool Execution Hook ---
  const { handleToolExecution, bitrixStatus } = useToolExecution({
    chatMode: chat.mode,
    chatTitle: chat.title,
    knowledgeBase,
    prompts,
    isFastModel,
    bitrixUrl,
    user,
    onUpdateMessages,
  });

  // --- Load Settings on Chat Change ---
  useEffect(() => {
    scrollToBottom();
    setTitleInput(chat.title);
    setAttachments([]);
    setInputText('');
    setShowTemplates(false);

    // Pro modes: FREE, DEEP_RESEARCH, CALCULATION, KNOWLEDGE default to Pro (isFastModel=false)
    // All other modes default to Flash (isFastModel=true)
    const proModes: ChatMode[] = [ChatMode.FREE, ChatMode.DEEP_RESEARCH, ChatMode.CALCULATION, ChatMode.KNOWLEDGE];
    const defaultIsFast = !proModes.includes(chat.mode);
    setIsFastModel(defaultIsFast);

    if (pendingInput) {
      setInputText(pendingInput);
      onClearPendingInput?.();
    }

    const loadSettings = async () => {
      try {
        const [settings, kb] = await Promise.all([
          getSystemSettings(),
          getKnowledgeBaseFromFirebase()
        ]);

        if (settings) {
          // Firebase remains the source of truth. Built-in prompts cover a
          // temporary Firestore quota outage without leaving any mode blank.
          setPrompts({ ...DEFAULT_MODE_PROMPTS, ...(settings.prompts || {}) });
          const systemWebhook = (settings.bitrixWebhook || '').trim();
          const personalWebhook = (user?.bitrixWebhookUrl || '').trim();
          let effectiveWebhook = systemWebhook;

          // Older personal webhooks in the transferred database may have been revoked.
          // Prefer a working personal connection, otherwise keep the validated system one.
          if (personalWebhook) {
            try {
              const baseUrl = personalWebhook.endsWith('/') ? personalWebhook : `${personalWebhook}/`;
              const response = await fetch(`${baseUrl}user.current.json`, {
                method: 'POST',
                signal: AbortSignal.timeout(8000)
              });
              const result = await response.json();
              if (response.ok && !result.error) effectiveWebhook = personalWebhook;
            } catch (error) {
              console.warn('Personal Bitrix webhook is unavailable; using the system connection.', error);
            }
          }
          setBitrixUrl(effectiveWebhook);
          bitrixUrlRef.current = effectiveWebhook;

          if (settings.quickPrompts) {
            setAvailableTemplates(settings.quickPrompts.filter((p: QuickPrompt) => p.mode === chat.mode));
          }
        }
        if (kb) {
          setKnowledgeBase(kb);
        }
      } catch (err) {
        console.error("Failed to load chat settings", err);
      }
    };
    loadSettings();

    // Load personal prompts
    if (user) {
      getPersonalPrompts(user.id).then(prompts => {
        setPersonalPrompts(prompts);
      });
    }
  }, [chat.id, chat.mode, user]);

  // Click outside to close templates / personal prompts
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (templatesRef.current && !templatesRef.current.contains(event.target as Node)) {
        setShowTemplates(false);
      }
      if (personalPromptsRef.current && !personalPromptsRef.current.contains(event.target as Node)) {
        setShowPersonalPrompts(false);
        setIsAddingPersonalPrompt(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- AUTO-RESPONSE TRIGGER ---
  useEffect(() => {
    if (!user) return;
    if (autoTriggeredRef.current === chat.id) return;
    if (isProcessing) return;

    if ((chat.mode === ChatMode.SALES || chat.mode === ChatMode.ANALYTICS) && !bitrixUrl) return;
    if (!prompts) return;
    if (chat.mode === ChatMode.SALES && !prompts.sales) return;
    if (chat.mode === ChatMode.TRAINING && !prompts.training) return;
    if (chat.mode === ChatMode.CALCULATION && !prompts.calculation) return;
    if (chat.mode === ChatMode.ANALYTICS && !prompts.analytics) return;

    const lastMsg = chat.messages[chat.messages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      autoTriggeredRef.current = chat.id;
      console.log(`Auto-triggering response for chat ${chat.id} (Mode: ${chat.mode}, Webhook: ${!!bitrixUrl})`);
      setTimeout(() => processResponse(chat.messages), 500);
    }
  }, [chat.id, chat.messages.length, user, bitrixUrl, prompts]);

  // --- HELPERS ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToLatestMessage = () => {
    // Find the last message element and scroll to its START
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;
    const allMsgs = container.querySelectorAll('.chat-msg');
    if (allMsgs.length === 0) { scrollToBottom(); return; }
    const lastMsg = allMsgs[allMsgs.length - 1] as HTMLElement;
    lastMsg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // --- ABORT CONTROL ---
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  };

  // --- CORE RESPONSE LOGIC ---
  const processResponse = async (currentHistory: Message[]) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const userName = user ? user.firstName : "Сотрудник";
      const lastMsg = currentHistory[currentHistory.length - 1];
      const promptText = lastMsg.text;
      const atts = lastMsg.attachments || [];

      if (user) {
        trackChatRequest(user.id, chat.mode);
        logAnalyticsEvent(user, 'chat', chat.mode);
      }

      const responseResult = await generateGeminiResponse({
        history: currentHistory,
        currentPrompt: promptText,
        attachments: atts,
        mode: chat.mode,
        knowledgeBase: knowledgeBase,
        userName: userName,
        prompts: prompts,
        useFastModel: isFastModel,
        bitrixUrl: bitrixUrl,
        signal: controller.signal
      });

      const responseText = (responseResult as any).text || responseResult;

      const newModelMsg: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      const finalMessages = [...currentHistory, newModelMsg];
      onUpdateMessages(finalMessages);

      await handleToolExecution(responseText, finalMessages, controller.signal);

    } catch (error: any) {
      if (error.message === 'Generation Aborted by User') {
        const stopMsg: Message = {
          id: crypto.randomUUID(),
          role: 'system',
          text: "⛔ Генерация остановлена пользователем.",
          timestamp: Date.now()
        };
        onUpdateMessages([...currentHistory, stopMsg]);
        return;
      }
      console.error(error);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'model',
        text: "Произошла ошибка при обращении к ИИ. Попробуйте еще раз.",
        timestamp: Date.now()
      };
      onUpdateMessages([...currentHistory, errorMsg]);
    } finally {
      setResearchStartTime(null);
      if (abortControllerRef.current === controller) {
        setIsProcessing(false);
        abortControllerRef.current = null;
      }
      setTimeout(scrollToLatestMessage, 100);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && attachments.length === 0) || isProcessing) return;

    const newUserMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      text: inputText,
      timestamp: Date.now(),
      attachments: [...attachments]
    };

    const updatedMessages = [...chat.messages, newUserMsg];
    onUpdateMessages(updatedMessages);
    setInputText('');
    setAttachments([]);
    setTimeout(scrollToBottom, 50);
    if (chat.mode === ChatMode.DEEP_RESEARCH) {
        setResearchStartTime(Date.now());
    }
    processResponse(updatedMessages);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);

      const limit = (chat.mode === ChatMode.DEEP_RESEARCH || chat.mode === ChatMode.ANALYTICS) ? 500 : 50;

      if (attachments.length + e.target.files.length > limit) {
        alert(`Максимум ${limit} файлов.`);
        return;
      }
      setUploadProgress({ current: 0, total: files.length });

      const newAttachments: Attachment[] = [];
      let hasErrors = false;

      for (let i = 0; i < files.length; i++) {
        let file = files[i];

        try {
          setUploadProgress({ current: i + 1, total: files.length });

          file = await prepareFileForChatAttachment(file);

          const { uri, name, mimeType } = await uploadFileToGemini(file);
          newAttachments.push({ name, mimeType, data: '', fileUri: uri });
        } catch (err) {
          console.error(`Failed to process/upload ${file.name}`, err);
          hasErrors = true;
        }
      }

      setUploadProgress(null);
      setAttachments(prev => [...prev, ...newAttachments]);
      if (hasErrors) {
        alert("Некоторые файлы не удалось загрузить.");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- DRAG & DROP HANDLERS ---
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    const limit = (chat.mode === ChatMode.DEEP_RESEARCH || chat.mode === ChatMode.ANALYTICS) ? 500 : 50;
    if (attachments.length + files.length > limit) {
      alert(`Максимум ${limit} файлов.`);
      return;
    }
    setUploadProgress({ current: 0, total: fileArray.length });
    const newAttachments: Attachment[] = [];
    let hasErrors = false;

    for (let i = 0; i < fileArray.length; i++) {
      let file = fileArray[i];
      try {
        setUploadProgress({ current: i + 1, total: fileArray.length });
        file = await prepareFileForChatAttachment(file);
        const { uri, name, mimeType } = await uploadFileToGemini(file);
        newAttachments.push({ name, mimeType, data: '', fileUri: uri });
      } catch (err) {
        console.error(`Failed to process/upload ${file.name}`, err);
        hasErrors = true;
      }
    }

    setUploadProgress(null);
    setAttachments(prev => [...prev, ...newAttachments]);
    if (hasErrors) {
      alert("Некоторые файлы не удалось загрузить.");
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveTitle = () => {
    onRenameChat(titleInput);
    setIsEditingTitle(false);
  };

  const insertTemplate = (text: string) => {
    setInputText(text);
    setShowTemplates(false);
    setShowPersonalPrompts(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const getModeLabel = (mode: ChatMode) => {
    if (mode === ChatMode.SALES) return { text: 'ПРОДАЖИ', color: 'bg-korda-100 text-korda-800 border-korda-200' };
    if (mode === ChatMode.TRAINING) return { text: 'ОБУЧЕНИЕ', color: 'bg-purple-100 text-purple-800 border-purple-200' };
    if (mode === ChatMode.DEEP_RESEARCH) return { text: 'ГЛУБОКИЙ АНАЛИЗ', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    if (mode === ChatMode.CALCULATION) return { text: 'РАСЧЕТ', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    if (mode === ChatMode.ANALYTICS) return { text: 'АНАЛИТИКА', color: 'bg-teal-100 text-teal-800 border-teal-200' };
    if (mode === ChatMode.KNOWLEDGE) return { text: 'БАЗА ЗНАНИЙ', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { text: 'СВОБОДНЫЙ', color: 'bg-blue-100 text-blue-800 border-blue-200' };
  };

  const modeBadge = getModeLabel(chat.mode);

  // --- INPUT AUTO-RESIZE ---
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

  const handleFullScreenSubmit = () => {
    setIsFullScreenInput(false);
    handleSendMessage();
  };

  // Keep access-state rendering below every hook. Returning earlier changes
  // the hook count when Bitrix settings finish loading and crashes Pro modes.
  const isUserLoading = user === undefined;
  if (isUserLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <Zap className="animate-spin text-korda-500" size={32} />
          <p className="text-slate-500 font-medium text-sm">Подключение профиля...</p>
        </div>
      </div>
    );
  }

  if ((chat.mode === ChatMode.SALES || chat.mode === ChatMode.ANALYTICS) && !bitrixUrl) {
    return <SalesModeBlocker onToggleSidebar={onToggleSidebar} />;
  }

  return (
    <div
      className="flex flex-col h-full bg-slate-50 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* DRAG & DROP OVERLAY */}
      {isDragging && (
        <div className="absolute inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 bg-white/90 rounded-2xl px-10 py-8 shadow-2xl border-2 border-dashed border-korda-400">
            <Upload size={48} className="text-korda-500" />
            <p className="text-lg font-semibold text-slate-700">Перетащите файлы сюда</p>
            <p className="text-sm text-slate-400">PDF, Word, Excel, изображения, аудио, видео</p>
          </div>
        </div>
      )}

      {/* FULL SCREEN INPUT MODAL */}
      {isFullScreenInput && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Edit2 size={18} className="text-korda-500" />
                Расширенный редактор
              </h3>
              <button onClick={() => setIsFullScreenInput(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-4 bg-slate-50">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Введите ваш запрос здесь..."
                className="w-full h-full p-4 bg-white border border-slate-200 rounded-xl resize-none outline-none focus:ring-2 focus:ring-korda-500 text-slate-800 text-lg leading-relaxed shadow-inner font-mono"
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center">
              <span className="text-xs text-slate-400">Shift + Enter для переноса строки, Enter для отправки</span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsFullScreenInput(false)}>Отмена</Button>
                <Button onClick={handleFullScreenSubmit} className="flex items-center gap-2">
                  <Send size={16} /> Отправить
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <div className="h-16 border-b border-slate-200 flex items-center px-4 md:px-6 bg-white/80 backdrop-blur-md z-10 shadow-sm shrink-0">
        <button onClick={onToggleSidebar} className="md:hidden mr-3 text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
          <Menu size={24} />
        </button>

        <div className="flex-1 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                className="bg-slate-100 border border-slate-300 rounded px-2 py-1 text-slate-800 focus:ring-2 focus:ring-korda-500 outline-none font-bold"
                autoFocus
                onBlur={handleSaveTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h2 className="font-bold text-slate-800 text-lg truncate cursor-pointer" onClick={() => setIsEditingTitle(true)}>
                {chat.title}
              </h2>
              <button onClick={() => setIsEditingTitle(true)} className="text-slate-300 hover:text-korda-500 transition-colors">
                <Edit2 size={14} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs mt-0.5">
            <span className={`px-2 py-0.5 rounded-full border ${modeBadge.color} font-semibold flex items-center gap-1`}>
              {chat.mode === ChatMode.DEEP_RESEARCH && <BrainCircuit size={10} />}
              {chat.mode === ChatMode.CALCULATION && <Calculator size={10} />}
              {chat.mode === ChatMode.ANALYTICS && <BarChart3 size={10} />}
              {chat.mode === ChatMode.KNOWLEDGE && <BookOpen size={10} />}
              {chat.mode === ChatMode.FREE && <Zap size={10} className="fill-current" />}
              {modeBadge.text}
            </span>
            <span className="text-slate-400">{chat.messages.length} сообщений</span>
            {(chat.mode === ChatMode.SALES || chat.mode === ChatMode.ANALYTICS) && (
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${bitrixUrl ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-orange-50 text-orange-600 border border-orange-200'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${bitrixUrl ? 'bg-green-500' : 'bg-orange-400 animate-pulse'}`} />
                {bitrixUrl ? 'CRM ✓' : 'CRM...'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {chat.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-40">
            <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-4">
              {chat.mode === ChatMode.DEEP_RESEARCH ? <Search className="text-slate-500" size={32} /> :
                chat.mode === ChatMode.CALCULATION ? <Calculator className="text-slate-500" size={32} /> :
                  chat.mode === ChatMode.ANALYTICS ? <BarChart3 className="text-slate-500" size={32} /> :
                    chat.mode === ChatMode.KNOWLEDGE ? <BookOpen className="text-slate-500" size={32} /> :
                      <RefreshCw className="text-slate-500" size={32} />}
            </div>
            <p className="text-slate-500 font-medium">Начните общение с Korda Syntax</p>
            {chat.mode === ChatMode.DEEP_RESEARCH && <p className="text-xs text-slate-400 mt-2">Режим исследования: План → Поиск → Отчет</p>}
            {chat.mode === ChatMode.CALCULATION && <p className="text-xs text-slate-400 mt-2">Режим расчета: Точные сметы и прайсы</p>}
            {chat.mode === ChatMode.ANALYTICS && <p className="text-xs text-slate-400 mt-2">Режим аналитики: Данные из CRM Bitrix24</p>}
            {chat.mode === ChatMode.KNOWLEDGE && <p className="text-xs text-slate-400 mt-2">База Знаний: Поиск по проектной документации</p>}
          </div>
        )}

        {chat.messages.filter(msg => {
          // Hide system messages (unless they have attachments)
          if (msg.role === 'system' && !(msg.attachments && msg.attachments.length > 0)) return false;
          return true;
        }).map((msg) => (
          <div key={msg.id} className="chat-msg">
            <ChatMessageBubble
              msg={msg}
              chatMode={chat.mode}
            />
          </div>
        ))}

        {/* DEEP RESEARCH PROGRESS BANNER */}
        {isProcessing && researchStartTime && chat.mode === ChatMode.DEEP_RESEARCH && (
          <div className="flex justify-start">
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl rounded-bl-none p-5 shadow-sm max-w-[85%] md:max-w-[75%]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                  <Search size={16} className="text-white animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-bold text-indigo-800">Глубокое исследование</p>
                  <p className="text-xs text-indigo-500">Поиск и анализ источников...</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-2 bg-indigo-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 rounded-full animate-research-bar" />
                </div>
                <span className="text-xs font-mono text-indigo-600 shrink-0">
                  {Math.floor(researchElapsed / 60)}:{String(researchElapsed % 60).padStart(2, '0')}
                </span>
              </div>
              <p className="text-[10px] text-indigo-400 mt-2">Исследование может занять 2-7 минут</p>
              <button onClick={handleStop} className="mt-2 text-xs text-red-400 hover:text-red-600 transition-colors flex items-center gap-1">
                <Square size={10} className="fill-current" /> Остановить
              </button>
            </div>
          </div>
        )}

        {isProcessing && !researchStartTime && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-bl-none p-4 flex items-center gap-2 shadow-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-xs font-medium">
                {chat.mode === ChatMode.KNOWLEDGE ? "Ищу в базе документов..." : "Анализирую..."}
              </span>
              <button onClick={handleStop} className="ml-2 p-1 text-slate-400 hover:text-red-500 transition-colors" title="Остановить генерацию">
                <Square size={14} className="fill-current" />
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* DYNAMIC BITRIX STATUS BANNER */}
      {bitrixStatus && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-2 rounded-full shadow-lg flex items-center gap-3 animate-bounce-slight z-50">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-semibold">{bitrixStatus}</span>
        </div>
      )}

      {/* INPUT AREA */}
      <div className="p-4 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
              {attachments.map((att, i) => (
                <div key={i} className="relative group bg-slate-50 border border-slate-200 rounded-lg p-2 min-w-[100px] max-w-[150px]">
                  <button onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                    <X size={12} />
                  </button>
                  <div className="flex flex-col items-center">
                    <div className="h-10 w-10 flex items-center justify-center bg-slate-100 rounded mb-1 text-slate-400">
                      <Paperclip />
                    </div>
                    <span className="text-[10px] text-slate-500 truncate w-full text-center font-medium">{att.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* UPLOAD PROGRESS BANNER */}
          {uploadProgress && (
            <div className="mb-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm flex items-center gap-3 animate-pulse">
              <RefreshCw className="animate-spin" size={16} />
              <span>Загрузка файлов в Gemini Cloud: {uploadProgress.current} из {uploadProgress.total}...</span>
            </div>
          )}

          {/* Styled Input Container */}
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-korda-500 focus-within:border-transparent transition-all shadow-sm relative">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-korda-600 transition-colors rounded-full hover:bg-slate-200" title="Прикрепить файлы">
              <Paperclip size={20} />
            </button>
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

            {/* Admin Quick Templates */}
            <div className="relative" ref={templatesRef}>
              <button
                onClick={() => { setShowTemplates(!showTemplates); setShowPersonalPrompts(false); }}
                className={`p-2 transition-colors rounded-full hover:bg-slate-200 ${showTemplates ? 'text-yellow-500 bg-yellow-50' : 'text-slate-400 hover:text-yellow-500'}`}
                title="Шаблоны компании"
              >
                <Zap size={20} />
              </button>

              {showTemplates && (
                <div className="absolute bottom-12 left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                    Шаблоны ({modeBadge.text})
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    {availableTemplates.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">Нет шаблонов</div>
                    ) : (
                      availableTemplates.map(tpl => (
                        <button
                          key={tpl.id}
                          onClick={() => insertTemplate(tpl.content)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-korda-600 rounded-lg transition-colors truncate"
                          title={tpl.title}
                        >
                          {tpl.title}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Personal User Prompts */}
            <div className="relative" ref={personalPromptsRef}>
              <button
                onClick={() => { setShowPersonalPrompts(!showPersonalPrompts); setShowTemplates(false); }}
                className={`p-2 transition-colors rounded-full hover:bg-slate-200 ${showPersonalPrompts ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400 hover:text-emerald-500'}`}
                title="Мои промпты"
              >
                <UserIcon size={20} />
              </button>

              {showPersonalPrompts && (
                <div className="absolute bottom-12 left-0 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="p-3 bg-emerald-50 border-b border-emerald-100 text-xs font-bold text-emerald-700 uppercase flex justify-between items-center">
                    <span>Мои промпты ({modeBadge.text})</span>
                    <button
                      onClick={() => setIsAddingPersonalPrompt(!isAddingPersonalPrompt)}
                      className={`p-1 rounded-full transition-colors ${isAddingPersonalPrompt ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}
                      title={isAddingPersonalPrompt ? 'Отмена' : 'Добавить промпт'}
                    >
                      {isAddingPersonalPrompt ? <X size={14} /> : <Plus size={14} />}
                    </button>
                  </div>

                  {/* Add New Prompt Form */}
                  {isAddingPersonalPrompt && (
                    <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50">
                      <input
                        type="text"
                        value={newPersonalTitle}
                        onChange={(e) => setNewPersonalTitle(e.target.value)}
                        placeholder="Название промпта"
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-400"
                        autoFocus
                      />
                      <textarea
                        value={newPersonalContent}
                        onChange={(e) => setNewPersonalContent(e.target.value)}
                        placeholder="Текст промпта..."
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-emerald-400 resize-none"
                        rows={3}
                      />
                      <button
                        onClick={async () => {
                          if (!newPersonalTitle.trim() || !newPersonalContent.trim() || !user) return;
                          const newPrompt: QuickPrompt = {
                            id: crypto.randomUUID(),
                            title: newPersonalTitle.trim(),
                            content: newPersonalContent.trim(),
                            mode: chat.mode
                          };
                          await savePersonalPrompt(user.id, newPrompt);
                          setPersonalPrompts(prev => [...prev, newPrompt]);
                          setNewPersonalTitle('');
                          setNewPersonalContent('');
                          setIsAddingPersonalPrompt(false);
                        }}
                        disabled={!newPersonalTitle.trim() || !newPersonalContent.trim()}
                        className="w-full py-1.5 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Сохранить
                      </button>
                    </div>
                  )}

                  <div className="max-h-60 overflow-y-auto p-1">
                    {personalPrompts.filter(p => p.mode === chat.mode).length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">Нет сохранённых промптов</div>
                    ) : (
                      personalPrompts.filter(p => p.mode === chat.mode).map(tpl => (
                        <div key={tpl.id} className="flex items-center group">
                          <button
                            onClick={() => insertTemplate(tpl.content)}
                            className="flex-1 text-left px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors truncate"
                            title={tpl.content}
                          >
                            {tpl.title}
                          </button>
                          <button
                            onClick={async () => {
                              if (!user) return;
                              await deletePersonalPrompt(user.id, tpl.id);
                              setPersonalPrompts(prev => prev.filter(p => p.id !== tpl.id));
                            }}
                            className="p-1 mr-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            title="Удалить"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Сообщение..."
              className="flex-1 bg-transparent border-none text-slate-800 placeholder-slate-400 outline-none focus:ring-0 resize-none max-h-32 min-h-[40px] py-2 px-2"
              rows={1}
            />

            <button onClick={() => setIsFullScreenInput(true)} className="p-2 text-slate-400 hover:text-korda-600 transition-colors rounded-full hover:bg-slate-200" title="На весь экран">
              <Maximize2 size={16} />
            </button>

            <Button
              onClick={handleSendMessage}
              disabled={(!inputText.trim() && attachments.length === 0) || isProcessing}
              className={`p-2 rounded-xl transition-all shadow-sm ${(!inputText.trim() && attachments.length === 0) ? 'opacity-50 bg-slate-200 text-slate-400 shadow-none' : 'bg-korda-500 hover:bg-korda-600 text-white'}`}
              style={{ minWidth: '40px' }}
            >
              <Send size={18} />
            </Button>
          </div>
          <div className="text-center mt-2 flex justify-between px-2 items-center">
            <span className="text-[10px] text-slate-400">AI Korda</span>

            {chat.mode === ChatMode.FREE ? (
              <span
                className="px-2 py-0.5 rounded-full border flex items-center gap-1.5 text-[10px] font-semibold bg-purple-50 text-purple-600 border-purple-300"
              >
                <BrainCircuit size={10} />
                Gemini Flash
              </span>
            ) : (
              <button
                onClick={() => {
                  setIsFastModel(!isFastModel);
                }}
                className={`px-2 py-0.5 rounded-full border flex items-center gap-1.5 text-[10px] font-semibold transition-colors ${isFastModel
                  ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                  : 'bg-purple-50 text-purple-600 border-purple-300 hover:bg-purple-100'}`}
                title="Переключить модель"
              >
                {isFastModel ? <Zap size={10} className="fill-current" /> : <BrainCircuit size={10} />}
                Gemini Flash
              </button>
            )}

            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span>До {(chat.mode === ChatMode.DEEP_RESEARCH || chat.mode === ChatMode.ANALYTICS) ? 500 : 50} файлов на сообщение</span>
              <div className="group relative">
                <Info size={12} className="cursor-help hover:text-korda-500 transition-colors" />
                <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-pre-wrap">
                  Поддерживаются: PDF, TXT, MD, CSV, Изображения, Аудио, Видео (MP4).
                  {'\n'}
                  Word (DOCX), Excel (XLSX/XLS), PowerPoint (PPTX) — автоматически конвертируются.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
