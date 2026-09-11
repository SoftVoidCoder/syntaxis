/**
 * Hook: lead search logic, chip system, cooldown timer, dedup, task generation.
 */
import { useState, useEffect } from 'react';
import { Lead, SalesTask, KnowledgeCategory, ChatMode, ChatSession } from '../types';
import { generateLeads, analyzeTaskOutcome, generateChipSuggestions } from '../services/geminiService';
import { createTask, getUserTasks, completeTask, updateTaskLeads, getKnowledgeBaseFromFirebase, getKnownLeadNames, reserveLeadNames, getPersonalIgnoreList, addToPersonalIgnore, getSystemSettings } from '../services/firebaseService';
import { normalizeCompanyName } from '../utils/normalizeCompanyName';

const WISHES_STORAGE_KEY = 'korda_client_search_wishes';
const CHIP_HISTORY_KEY = 'korda_chip_history';

interface UseLeadSearchProps {
  userId?: string;
  providedTasks?: SalesTask[];
  chats: ChatSession[];
}

export const useLeadSearch = ({ userId, providedTasks, chats }: UseLeadSearchProps) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completingStatus, setCompletingStatus] = useState('');
  const [searchProgress, setSearchProgress] = useState<{ attempt: number, max: number, found: number } | null>(null);
  const [creatingChatForLead, setCreatingChatForLead] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number>(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [strategyDoc, setStrategyDoc] = useState<string | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const [managerWishes, setManagerWishes] = useState(() => {
    try { return localStorage.getItem(WISHES_STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [retryCount, setRetryCount] = useState(3);

  // Chip System
  const [baseChips, setBaseChips] = useState<string[]>([]);
  const [chipPrompt, setChipPrompt] = useState('');
  const [chipHistory, setChipHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHIP_HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [aiChips, setAiChips] = useState<string[]>([]);
  const [isGeneratingChips, setIsGeneratingChips] = useState(false);

  // Cooldown Timer
  useEffect(() => {
    if (!cooldownUntil) return;
    const updateTimer = () => {
      const left = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (left <= 0) { setCooldownLeft(0); setCooldownUntil(0); }
      else setCooldownLeft(left);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  // Load Tasks
  const loadTasks = async () => {
    if (providedTasks) { setTasks(providedTasks); return; }
    if (!userId) return;
    setIsLoading(true);
    try { setTasks(await getUserTasks(userId)); }
    catch (err) { console.error("Failed to load tasks", err); }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    loadTasks();
    const fetchData = async () => {
      const [kb, settings] = await Promise.all([getKnowledgeBaseFromFirebase(), getSystemSettings()]);
      const stratFile = kb.find(f => f.category === KnowledgeCategory.STRATEGY);
      if (stratFile) setStrategyDoc(stratFile.content);
      if (settings?.searchChips) setBaseChips(settings.searchChips);
      if (settings?.searchChipPrompt) setChipPrompt(settings.searchChipPrompt);
    };
    fetchData();
  }, [userId, providedTasks]);

  // Chip Helpers
  const saveChipToHistory = (text: string) => {
    if (!text.trim()) return;
    const updated = [text.trim(), ...chipHistory.filter(c => c !== text.trim())].slice(0, 5);
    setChipHistory(updated);
    try { localStorage.setItem(CHIP_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  };

  const handleChipClick = (chipText: string) => {
    setManagerWishes(chipText);
    try { localStorage.setItem(WISHES_STORAGE_KEY, chipText); } catch {}
  };

  const handleWishesChange = (value: string) => {
    setManagerWishes(value);
    try { localStorage.setItem(WISHES_STORAGE_KEY, value); } catch {}
    setAiChips([]);
  };

  const handleGenerateAiChips = async () => {
    if (!managerWishes.trim()) return;
    if (!chipPrompt) {
      alert('Промпт для AI-подсказок не настроен. Попросите админа заполнить его в Настройках ИИ.');
      return;
    }
    setIsGeneratingChips(true);
    setAiChips([]);
    try {
      const suggestions = await generateChipSuggestions(managerWishes, chipPrompt);
      if (suggestions.length === 0) alert('AI не вернул подсказок. Попробуйте изменить текст и повторить.');
      setAiChips(suggestions);
    } catch (err: any) {
      console.error('Chip generation failed:', err);
      alert('Ошибка генерации подсказок: ' + (err.message || 'Неизвестная ошибка'));
      setAiChips([]);
    } finally { setIsGeneratingChips(false); }
  };

  // Generate Task (Core business logic: dedup + retry loop)
  const handleGenerateTask = async () => {
    if (!userId || !strategyDoc) {
      if (!strategyDoc) alert("Не найден документ стратегии (Категория STRATEGY). Пожалуйста, загрузите его в Базу Знаний.");
      return;
    }

    setIsGenerating(true);
    try {
      try { localStorage.setItem(WISHES_STORAGE_KEY, managerWishes); } catch {}
      saveChipToHistory(managerWishes);

      const { names: globalNames } = await getKnownLeadNames();
      const globalNamesSet = new Set<string>(globalNames);
      const personalIgnoreNames = await getPersonalIgnoreList(userId);
      const personalIgnoreSet = new Set<string>(personalIgnoreNames);

      const uniqueLeadsFound: Lead[] = [];
      const sessionExcludeNames: string[] = [];
      const sessionExcludeCompanyNames: string[] = [...globalNames, ...personalIgnoreNames];
      let attempts = 0;

      while (uniqueLeadsFound.length < 5 && attempts < retryCount) {
        attempts++;
        setSearchProgress({ attempt: attempts, max: retryCount, found: uniqueLeadsFound.length });

        const remaining = 5 - uniqueLeadsFound.length;
        const requestCount = attempts === 1 ? 15 : Math.min(15, remaining * 3);

        const rawLeads = await generateLeads(strategyDoc, managerWishes, sessionExcludeNames, sessionExcludeCompanyNames, requestCount);

        let newlyFound = 0;
        for (const lead of rawLeads) {
          if (uniqueLeadsFound.length >= 5) break;
          const normName = normalizeCompanyName(lead.companyName);
          const isGlobalDup = normName && globalNamesSet.has(normName);
          const isPersonalIgnored = normName && personalIgnoreSet.has(normName);
          const isSessionDup = uniqueLeadsFound.some(ul => normalizeCompanyName(ul.companyName) === normName);

          if (!isGlobalDup && !isPersonalIgnored && !isSessionDup) {
            uniqueLeadsFound.push(lead);
            newlyFound++;
          } else {
            sessionExcludeNames.push(lead.companyName);
            sessionExcludeCompanyNames.push(lead.companyName);
          }
        }

        setSearchProgress({ attempt: attempts, max: retryCount, found: uniqueLeadsFound.length });
        if (uniqueLeadsFound.length >= 5) break;
        if (newlyFound === 0 && attempts >= 2) break;

        const newNames = uniqueLeadsFound.map(l => l.companyName).filter(Boolean);
        if (newNames.length > 0) await reserveLeadNames(newNames);
        if (attempts < retryCount) await new Promise(r => setTimeout(r, 1000));
      }

      if (uniqueLeadsFound.length === 0) {
        alert(`Не удалось найти новых уникальных лидов по вашему запросу.\n\nВозможные причины:\n1. Рынок исчерпан (все компании уже в работе).\n2. Слишком узкий запрос (попробуйте смягчить критерии).`);
        return;
      }

      await createTask(userId, uniqueLeadsFound);
      await loadTasks();
    } catch (err: any) {
      alert(err.message || "Ошибка генерации задачи");
    } finally {
      setIsGenerating(false);
      setSearchProgress(null);
    }
  };

  // Ignore Lead
  const handleIgnoreLead = async (taskId: string, leadIndex: number) => {
    if (!userId) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const lead = task.leads[leadIndex];
    const updatedLeads = [...task.leads];
    updatedLeads[leadIndex] = { ...updatedLeads[leadIndex], status: 'IGNORED' };

    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, leads: updatedLeads } : t));

    try {
      await Promise.all([updateTaskLeads(taskId, updatedLeads), addToPersonalIgnore(userId, lead.companyName)]);
    } catch (err) {
      console.error('Failed to ignore lead:', err);
      alert('Ошибка сохранения');
    }
  };

  // Complete Task
  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !userId) return;

    const unleadedCompanies = task.leads.filter(lead =>
      lead.status !== 'FAIL' && lead.status !== 'IGNORED' &&
      !chats.some(c => c.title.trim().toLowerCase() === lead.companyName.trim().toLowerCase())
    );

    if (unleadedCompanies.length > 0) {
      const names = unleadedCompanies.map(l => `• ${l.companyName}`).join('\n');
      alert(`Нельзя завершить задачу — не все компании обработаны.\n\nНе начаты диалоги (или не отмечены как фейл):\n${names}\n\nНажмите «Начать работу» или «Фейл» для каждой компании.`);
      return;
    }

    if (!confirm("Завершить задачу? Будет сформирован отчет по всем диалогам.")) return;

    setCompletingTaskId(taskId);
    setCompletingStatus('🔍 Ищу связанные диалоги...');
    setIsLoading(true);
    try {
      const activeLeads = task.leads.filter(l => l.status !== 'FAIL' && l.status !== 'IGNORED');
      if (activeLeads.length !== task.leads.length) await updateTaskLeads(taskId, activeLeads);

      const relatedChats = chats.filter(c =>
        activeLeads.some(l => l.companyName.trim().toLowerCase() === c.title.trim().toLowerCase())
      );

      let summary = "";
      if (relatedChats.length > 0) {
        setCompletingStatus(`📊 Анализирую ${relatedChats.length} диалог(ов)... Это может занять минуту.`);
        summary = await analyzeTaskOutcome(relatedChats);
      } else {
        summary = "⚠️ Диалоги по компаниям из этой задачи не найдены.";
      }

      setCompletingStatus('💾 Сохраняю отчёт...');
      await completeTask(taskId, summary);
      await loadTasks();
      setActiveTab('history');
    } catch (err) {
      console.error(err);
      alert("Ошибка при завершении задачи");
    } finally {
      setIsLoading(false);
      setCompletingTaskId(null);
      setCompletingStatus('');
    }
  };

  const activeTasks = tasks.filter(t => t.status === 'IN_PROGRESS');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');

  return {
    // State
    activeTab, setActiveTab, tasks, isLoading, isGenerating, completingTaskId, completingStatus,
    searchProgress, creatingChatForLead, setCreatingChatForLead, cooldownLeft, cooldownUntil,
    setCooldownUntil, strategyDoc, deletingTaskId, setDeletingTaskId,
    managerWishes, retryCount, setRetryCount,
    baseChips, chipPrompt, chipHistory, aiChips, isGeneratingChips,
    activeTasks, completedTasks,
    // Handlers
    handleWishesChange, handleChipClick, handleGenerateAiChips,
    handleGenerateTask, handleIgnoreLead, handleCompleteTask,
  };
};
