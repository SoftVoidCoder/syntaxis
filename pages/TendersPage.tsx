import React, { useState, useEffect } from 'react';
import { Search, Loader2, SlidersHorizontal, ArrowLeft, Sparkles, Download, BarChart3 } from 'lucide-react';
import { Button } from '../components/Button';
import { TendersTable } from '../components/tenders/TendersTable';
import { TenderDetailsModal } from '../components/tenders/TenderDetailsModal';
import { TenderAnalytics } from '../components/tenders/TenderAnalytics';
import { TenderKeywords } from '../components/tenders/TenderKeywords';
import { TenderFilters } from '../components/tenders/TenderFilters';
import { ChatSession, ChatMode, TenderFavorite, SharedTenderScore, TenderWorkflowStatus, TenderDailyStats, TenderComment, UserRole, User } from '../types';
import { useAuth } from '../context/AuthContext';
import {
    getSharedFavorites, addSharedFavorite, removeSharedFavorite, markFavoriteForRemoval, unmarkFavoriteForRemoval,
    getSharedTenderScores, saveSharedTenderScores,
    assignTenderResponsible, updateTenderWorkflowStatus, updateTenderContractor,
    getTenderDailyStats, logTenderDailyStats,
    getTenderComments, addTenderComment,
    getSystemSettings, getAllUsersFromFirebase
} from '../services/firebaseService';
import { scoreTendersWithAI, TenderScore } from '../services/geminiService';

interface TendersPageProps {
    chats: ChatSession[];
    onBack?: () => void;
    onNavigateChat?: () => void;
    onSelectChat?: (id: string) => void;
    onCreateChat?: (mode: ChatMode, title: string, initialMessage?: string, skipNavigation?: boolean) => void;
}

const WORKFLOW_STATUS_LABELS: Record<TenderWorkflowStatus, { label: string, color: string }> = {
    [TenderWorkflowStatus.REVIEW]: { label: 'Рассмотрение', color: 'bg-blue-100 text-blue-700' },
    [TenderWorkflowStatus.CONTRACTOR]: { label: 'Подрядчик', color: 'bg-cyan-100 text-cyan-700' },
    [TenderWorkflowStatus.PREPARATION]: { label: 'Подготовка', color: 'bg-amber-100 text-amber-700' },
    [TenderWorkflowStatus.SUBMISSION]: { label: 'Подача', color: 'bg-purple-100 text-purple-700' },
    [TenderWorkflowStatus.SUBMITTED]: { label: 'Подана', color: 'bg-indigo-100 text-indigo-700' },
    [TenderWorkflowStatus.WON]: { label: 'Выиграно', color: 'bg-green-100 text-green-700' },
    [TenderWorkflowStatus.LOST]: { label: 'Проиграно', color: 'bg-red-100 text-red-700' },
    [TenderWorkflowStatus.OVERDUE]: { label: 'Просрочено', color: 'bg-orange-100 text-orange-700' },
    [TenderWorkflowStatus.DECLINED]: { label: 'Отклонено', color: 'bg-slate-100 text-slate-600' },
};

const HARDCODED_KEYWORDS = ['Термочехлы', 'быстросъемная изоляция', 'противопожарная защита', 'тканевые компенсаторы'];

export const TendersPage: React.FC<TendersPageProps> = ({ onBack, onCreateChat }) => {
    const { user } = useAuth();

    // Core state
    const [searchQuery, setSearchQuery] = useState('');
    const [tenders, setTenders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTender, setSelectedTender] = useState<any | null>(null);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [apiLimits, setApiLimits] = useState<{ remaining: string | null, limit: string | null } | null>(null);
    const [sourceStatuses, setSourceStatuses] = useState<Array<{ id: string; label: string; ok: boolean; count: number; error?: string | null }>>([]);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
    const [aiScores, setAiScores] = useState<Record<string, SharedTenderScore>>({});
    const [isScoring, setIsScoring] = useState(false);
    const [aiModel, setAiModel] = useState<'gemini-3.5-flash'>('gemini-3.5-flash');
    const [activeTab, setActiveTab] = useState<'local' | 'api'>('api');
    const [sharedFavorites, setSharedFavorites] = useState<TenderFavorite[]>([]);
    const [dailyStats, setDailyStats] = useState<TenderDailyStats[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [showAnalytics, setShowAnalytics] = useState(false);
    const [selectedLeaderboardUser, setSelectedLeaderboardUser] = useState<string | null>(null);

    // Comments state
    const [modalComments, setModalComments] = useState<TenderComment[]>([]);
    const [isLoadingComments, setIsLoadingComments] = useState(false);

    // Search filters
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilter, setStatusFilter] = useState({ ApplicationSubmission: true, CommissionWork: true, Completed: false });
    const [priceFrom, setPriceFrom] = useState('');
    const [priceTo, setPriceTo] = useState('');
    const [fzFilter, setFzFilter] = useState({ fz44: true, fz223: true, commercial: true });
    const [regionCode, setRegionCode] = useState('');
    const [strictSearch, setStrictSearch] = useState(false);
    const [applicationDeadlineFrom, setApplicationDeadlineFrom] = useState('');
    const [applicationDeadlineTo, setApplicationDeadlineTo] = useState('');
    const [smp, setSmp] = useState(false);
    const [advance, setAdvance] = useState({ advance44: false, advance223: false, nonAdvance: false });
    const [electronicPlaces, setElectronicPlaces] = useState<number[]>([]);

    // Result filters
    const [filterAssignedTo, setFilterAssignedTo] = useState('');
    const [filterMinScore, setFilterMinScore] = useState(0);
    const [filterWorkflowStatus, setFilterWorkflowStatus] = useState('');

    // Keyword state
    const [activeKeywords, setActiveKeywords] = useState<string[]>([...HARDCODED_KEYWORDS]);
    const [aiKeywordsEnabled, setAiKeywordsEnabled] = useState(true);
    const [aiTyposEnabled, setAiTyposEnabled] = useState(false);
    const [aiWordCount, setAiWordCount] = useState(300);
    const [aiKeywords, setAiKeywords] = useState<string[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showKeywords, setShowKeywords] = useState(true);
    const [tenderContext, setTenderContext] = useState('');
    const [baseNegativeKeywords, setBaseNegativeKeywords] = useState('');
    const [useBaseNegativeKeywords, setUseBaseNegativeKeywords] = useState(true);
    const [customNegativeKeywords, setCustomNegativeKeywords] = useState('');

    // Permissions
    const canManageTenders = user && [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.SUPERVISOR].includes(user.role);
    const canPermanentlyRemove = user && [UserRole.ADMIN, UserRole.DIRECTOR].includes(user.role);
    const savedTenderIds = sharedFavorites.map(f => f.tenderId);

    // Auto-set the assignee filter to the current user on load
    const [hasAutoSetFilter, setHasAutoSetFilter] = useState(false);
    useEffect(() => {
        if (user?.id && activeTab === 'local' && !hasAutoSetFilter) {
            setFilterAssignedTo(user.id);
            setHasAutoSetFilter(true);
        }
    }, [user, activeTab, hasAutoSetFilter]);

    // Load shared data
    useEffect(() => {
        getSharedFavorites().then(setSharedFavorites).catch(console.error);
        getSharedTenderScores().then(scores => {
            const map: Record<string, SharedTenderScore> = {};
            scores.forEach(s => { map[s.tenderId] = s; });
            setAiScores(map);
        }).catch(console.error);
        getSystemSettings().then(settings => {
            if (settings?.tenderContext) setTenderContext(settings.tenderContext);
            if (settings?.baseNegativeKeywords) setBaseNegativeKeywords(settings.baseNegativeKeywords);
        }).catch(console.error);
        getTenderDailyStats().then(setDailyStats).catch(console.error);
        getAllUsersFromFirebase().then(users => {
            setAllUsers(users.filter(u => u.permissions?.canAccessTenders));
        }).catch(console.error);
    }, [activeTab]);

    // --- HANDLERS ---

    const toggleKeyword = (word: string) => {
        setActiveKeywords(prev => prev.includes(word) ? prev.filter(w => w !== word) : [...prev, word]);
    };

    const handlePlaceToggle = (placeId: number) => {
        setElectronicPlaces(prev => prev.includes(placeId) ? prev.filter(p => p !== placeId) : [...prev, placeId]);
    };

    const generateAiKeywords = async () => {
        setIsAiLoading(true);
        try {
            const context = [...activeKeywords, searchQuery].filter(Boolean).join(', ');
            const alreadyHave = [...HARDCODED_KEYWORDS, ...aiKeywords].join(', ');
            const companyInfo = tenderContext || 'инжиниринговая компания по производству теплоизоляции, антикоррозийной защиты, герметиков и изоляционных материалов для трубопроводов и строительства (Санкт-Петербург)';
            const prompt = `Ты — эксперт по тендерам и госзакупкам.\nКонтекст компании: ${companyInfo}\nМы ищем тендеры на госзакупках по нашему профилю. Помоги подобрать ключевые слова.\n\nСгенерируй ровно ${aiWordCount} НОВЫХ ключевых слов/фраз для поиска тендеров, связанных с: ${context || 'теплоизоляция, изоляционные материалы, трубопроводы'}.\n\nУЖЕ ЕСТЬ (НЕ ПОВТОРЯЙ): ${alreadyHave}\n\nВключи:\n- Синонимы, вариации написания, смежные термины, сокращения, материалы, типы работ\n${aiTyposEnabled ? '- В КАЖДОМ слове сделай по одной незаметной опечатке (замена буквы, пропуск, перестановка) — это нужно чтобы найти тендеры которые намеренно скрыты опечатками в названиях' : '- Генерируй только чистые правильные слова, БЕЗ опечаток'}\n\nВерни ТОЛЬКО JSON массив строк, без пояснений. Пример: ["слово1", "слово2"]`;

            const res = await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generateContent',
                    payload: {
                        model: 'gemini-3.5-flash',
                        contents: [{ role: 'user', parts: [{ text: prompt }] }],
                        config: { temperature: 0.8 }
                    }
                })
            });
            const data = await res.json();
            const text = data.text || '';
            const match = text.match(/\[[\s\S]*?\]/);
            if (match) {
                const parsed = JSON.parse(match[0]) as string[];
                const allExisting = new Set([...HARDCODED_KEYWORDS, ...activeKeywords, ...aiKeywords, searchQuery.toLowerCase()].map(w => w.toLowerCase()));
                const newWords = parsed.filter(w => !allExisting.has(w.toLowerCase()));
                setAiKeywords(prev => [...prev, ...newWords]);
                setShowKeywords(false);
            }
        } catch (err) {
            console.error('AI keyword generation failed:', err);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            const endpoint = activeTab === 'local' ? '/local-search' : '/search';
            let excludedArray: string[] = [];
            if (useBaseNegativeKeywords && baseNegativeKeywords) {
                excludedArray = excludedArray.concat(baseNegativeKeywords.split(/[,;]+/).map(w => w.trim()).filter(Boolean));
            }
            if (customNegativeKeywords) {
                excludedArray = excludedArray.concat(customNegativeKeywords.split(/[,;]+/).map(w => w.trim()).filter(Boolean));
            }
            const res = await fetch('/api/tenders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint, query: searchQuery,
                    keywords: activeTab === 'api' ? [...activeKeywords, ...aiKeywords].filter(Boolean) : undefined,
                    excludedText: excludedArray.length > 0 ? excludedArray : undefined,
                    statusFilters: statusFilter,
                    priceFilters: { from: priceFrom ? parseInt(priceFrom, 10) : undefined, to: priceTo ? parseInt(priceTo, 10) : undefined },
                    fzFilters: fzFilter, regionCode: regionCode || undefined, strictSearch,
                    applicationDeadlineFrom: applicationDeadlineFrom || undefined,
                    applicationDeadlineTo: applicationDeadlineTo || undefined,
                    advance: (advance.advance44 || advance.advance223 || advance.nonAdvance) ? advance : undefined,
                    smp: smp ? true : undefined,
                    electronicPlaces: electronicPlaces.length > 0 ? electronicPlaces : undefined,
                    savedTenders: activeTab === 'local' ? savedTenderIds : undefined,
                    userId: user?.id,
                    userName: user ? `${user.firstName} ${user.lastName}` : undefined,
                })
            });
            const data = await res.json();
            if (data.items) {
                setTenders(data.items);
                if (data.limits) setApiLimits(data.limits);
                if (data.sources) setSourceStatuses(data.sources);
                if (data.updatedAt) setLastUpdatedAt(data.updatedAt);
                getTenderDailyStats().then(setDailyStats).catch(console.error);
            } else if (data.error) {
                console.error("API Error:", data.error, data.details);
                alert(`Ошибка API: ${data.details || data.error}`);
            }
        } catch (err) { console.error(err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        handleSearch();
        if (activeTab !== 'api') return;
        const timer = window.setInterval(() => handleSearch(), 15 * 60 * 1000);
        return () => window.clearInterval(timer);
    }, [activeTab]);

    const handleScoreTenders = async () => {
        if (!tenders || tenders.length === 0) return;
        setIsScoring(true);
        try {
            const contextToUse = tenderContext || 'инжиниринговая компания по производству теплоизоляции, антикоррозийной защиты, герметиков и изоляционных материалов для трубопроводов и строительства (Санкт-Петербург)';
            const tendersToScore = tenders.map(t => ({ id: t.id, name: t.name || t.description || '', customer: t.customer?.fullName || '' }));
            const results = await scoreTendersWithAI(tendersToScore, contextToUse, aiModel);
            const sharedScores: SharedTenderScore[] = results.map(r => ({ tenderId: r.id, score: r.score, reason: r.reason, scoredAt: Date.now(), scoredByModel: aiModel }));
            await saveSharedTenderScores(sharedScores);
            const userName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
            await logTenderDailyStats({ aiScoringsRun: 1, userAiScorings: user ? { [user.id]: { name: userName, count: 1 } } : undefined });
            setAiScores(prev => { const n = { ...prev }; sharedScores.forEach(r => { n[r.tenderId] = r; }); return n; });
        } catch (error) { console.error("Scoring error:", error); alert("Не удалось оценить тендеры."); }
        finally { setIsScoring(false); }
    };

    const handleRowClick = async (tender: any) => {
        setSelectedTender(null);
        setModalComments([]);
        setIsModalOpen(true);
        setIsDetailsLoading(true);
        setIsLoadingComments(true);
        getTenderComments(tender.id).then(c => { setModalComments(c); setIsLoadingComments(false); }).catch(e => { console.error(e); setIsLoadingComments(false); });
        try {
            const res = await fetch('/api/tenders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: `/purchases/${tender.id}` }) });
            const details = await res.json();
            setSelectedTender({
                ...tender,
                description: details.Title || details.PurchaseObjectInfo || details.Description || details.name || tender.description,
                deliveryPlace: details.DeliveryPlace || (details.Customers && details.Customers[0] ? details.Customers[0].Region : undefined) || tender.deliveryPlace,
                rawDetails: details
            });
        } catch (e) { console.error(e); setSelectedTender(tender); }
        finally { setIsDetailsLoading(false); }
    };

    const handleToggleSave = async (id: string, isSaved: boolean) => {
        if (!user) return;
        const userName = `${user.firstName} ${user.lastName}`;
        try {
            if (isSaved) {
                await addSharedFavorite(id, user);
                setSharedFavorites(prev => [...prev, { tenderId: id, addedBy: user.id, addedByName: userName, addedAt: Date.now(), workflowStatus: TenderWorkflowStatus.REVIEW }]);
                await logTenderDailyStats({ tendersAdded: 1, userAdded: { [user.id]: { name: userName, count: 1 } } });
            } else {
                const favInfo = sharedFavorites.find(f => f.tenderId === id);
                if (favInfo?.markedForRemoval && canPermanentlyRemove) {
                    const choice = confirm('Тендер отмечен на удаление.\n\nОК = Удалить окончательно\nОтмена = Восстановить (снять пометку)');
                    if (choice) { await removeSharedFavorite(id); setSharedFavorites(prev => prev.filter(f => f.tenderId !== id)); }
                    else { await unmarkFavoriteForRemoval(id); setSharedFavorites(prev => prev.map(f => f.tenderId === id ? { ...f, markedForRemoval: false, markedForRemovalBy: undefined, markedForRemovalAt: undefined } : f)); }
                    return;
                }
                if (canPermanentlyRemove) { await removeSharedFavorite(id); setSharedFavorites(prev => prev.filter(f => f.tenderId !== id)); }
                else if (canManageTenders) { await markFavoriteForRemoval(id, user.id); setSharedFavorites(prev => prev.map(f => f.tenderId === id ? { ...f, markedForRemoval: true, markedForRemovalBy: user.id, markedForRemovalAt: Date.now() } : f)); }
                else { alert('Только руководство может убрать тендер из работы.'); return; }
            }
        } catch (e) { console.error("Failed to toggle save state", e); }
    };

    const handleAssignResponsible = async (tenderId: string, assigneeId: string) => {
        if (!user || !canManageTenders) return;
        const assignee = allUsers.find(u => u.id === assigneeId);
        if (!assignee) return;
        try {
            await assignTenderResponsible(tenderId, assigneeId, `${assignee.firstName} ${assignee.lastName}`, user.id);
            setSharedFavorites(prev => prev.map(f => f.tenderId === tenderId ? { ...f, assignedTo: assigneeId, assignedToName: `${assignee.firstName} ${assignee.lastName}`, assignedBy: user.id } : f));
        } catch (e) { console.error("Failed to assign responsible:", e); }
    };

    const handleUpdateStatus = async (tenderId: string, status: TenderWorkflowStatus) => {
        if (!user) return;
        try {
            await updateTenderWorkflowStatus(tenderId, status, user.id);
            setSharedFavorites(prev => prev.map(f => f.tenderId === tenderId ? { ...f, workflowStatus: status, statusChangedAt: Date.now(), statusChangedBy: user.id } : f));
        } catch (e) { console.error("Failed to update status:", e); }
    };

    const handleUpdateContractor = async (tenderId: string, contractor: string) => {
        try {
            await updateTenderContractor(tenderId, contractor);
            setSharedFavorites(prev => prev.map(f => f.tenderId === tenderId ? { ...f, contractor } : f));
        } catch (e) { console.error("Failed to update contractor:", e); }
    };

    const handleAddComment = async (tenderId: string, text: string) => {
        if (!user || !text.trim()) return;
        try { const comment = await addTenderComment(tenderId, user, text.trim()); setModalComments(prev => [...prev, comment]); }
        catch (e) { console.error("Failed to add comment:", e); }
    };

    const getFavoriteInfo = (tenderId: string): TenderFavorite | undefined => sharedFavorites.find(f => f.tenderId === tenderId);

    // Client-side filtering
    const filteredTenders = React.useMemo(() => {
        let result = tenders;
        if (activeTab === 'local') {
            if (filterAssignedTo) {
                const favIds = sharedFavorites.filter(f => f.assignedTo === filterAssignedTo || f.addedBy === filterAssignedTo).map(f => f.tenderId);
                result = result.filter(t => favIds.includes(t.id));
            }
            if (filterWorkflowStatus) {
                const favIds = sharedFavorites.filter(f => f.workflowStatus === filterWorkflowStatus).map(f => f.tenderId);
                result = result.filter(t => favIds.includes(t.id));
            }
        }
        if (filterMinScore > 0) result = result.filter(t => (aiScores[t.id]?.score || 0) >= filterMinScore);
        return result;
    }, [tenders, filterAssignedTo, filterMinScore, filterWorkflowStatus, sharedFavorites, aiScores, activeTab]);

    const handleExportTenders = () => {
        if (!tenders || tenders.length === 0) return;
        const exportData = tenders.map(t => {
            const score = aiScores[t.id];
            const favInfo = getFavoriteInfo(t.id);
            return { id: t.id, purchaseNumber: t.purchaseNumber, name: t.name, customer: t.customer?.fullName || '', customerInn: t.customer?.inn || '', price: t.price, status: t.status, applicationEndDate: t.applicationEndDate, aiScore: score ? { score: score.score, reason: score.reason, model: score.scoredByModel } : null, inWork: !!favInfo, addedBy: favInfo?.addedByName || null, assignedTo: favInfo?.assignedToName || null, workflowStatus: favInfo?.workflowStatus || null };
        });
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tenders_export_${new Date().toISOString().split('T')[0]}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto text-slate-800 flex flex-col">
            <div className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-korda-600 to-indigo-600 flex items-center gap-2">Анализ тендеров</h1>
                    <p className="text-slate-500 text-sm mt-1">{activeTab === 'local' ? 'Избранные закупки' : 'Автоматический поиск по бесплатным площадкам'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setShowAnalytics(!showAnalytics)} size="sm" className="gap-2 shrink-0"><BarChart3 size={16} /> Аналитика</Button>
                    {onBack && <Button variant="secondary" onClick={onBack} size="sm" className="gap-2 shrink-0"><ArrowLeft size={16} /> Назад</Button>}
                </div>
            </div>

            {/* Analytics Panel */}
            {showAnalytics && (
                <TenderAnalytics
                    favoritesCount={sharedFavorites.length}
                    aiScoresCount={Object.keys(aiScores).length}
                    dailyStats={dailyStats}
                    selectedLeaderboardUser={selectedLeaderboardUser}
                    onSelectLeaderboardUser={setSelectedLeaderboardUser}
                />
            )}

            <div className="flex flex-col gap-4 mb-6 shrink-0">
                <div className="flex gap-2 p-1 bg-slate-100/80 backdrop-blur rounded-lg w-fit border border-slate-200/50">
                    <button onClick={() => { if (activeTab !== 'local') { setTenders([]); setApiLimits(null); setActiveTab('local'); setFilterAssignedTo(user?.id || ''); } }} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'local' ? 'bg-white shadow-sm text-korda-700 font-semibold' : 'text-slate-500 hover:text-slate-800'}`}>Избранные тендеры</button>
                    <button onClick={() => { if (activeTab !== 'api') { setTenders([]); setApiLimits(null); setActiveTab('api'); setFilterAssignedTo(''); } }} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'api' ? 'bg-white shadow-sm text-korda-700 font-semibold' : 'text-slate-500 hover:text-slate-800'}`}>
                        Новые тендеры {activeTab === 'api' && <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 py-0.5 px-1.5 rounded-full">АВТО</span>}
                    </button>
                </div>

                {activeTab === 'api' && sourceStatuses.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {sourceStatuses.map(source => (
                            <span key={source.id} title={source.error || undefined} className={`px-2.5 py-1 rounded-full border font-medium ${source.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                                {source.label}: {source.ok ? source.count : 'ошибка'}
                            </span>
                        ))}
                        {lastUpdatedAt && <span className="text-slate-400">Обновлено {new Date(lastUpdatedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                )}

                {/* Keyword Chips */}
                {activeTab === 'api' && (
                    <TenderKeywords
                        showKeywords={showKeywords}
                        onToggleKeywords={() => setShowKeywords(!showKeywords)}
                        hardcodedKeywords={HARDCODED_KEYWORDS}
                        activeKeywords={activeKeywords}
                        onToggleKeyword={toggleKeyword}
                        aiKeywords={aiKeywords}
                        onRemoveAiKeyword={w => setAiKeywords(prev => prev.filter(k => k !== w))}
                        onClearAiKeywords={() => setAiKeywords([])}
                        aiKeywordsEnabled={aiKeywordsEnabled}
                        onSetAiKeywordsEnabled={setAiKeywordsEnabled}
                        aiTyposEnabled={aiTyposEnabled}
                        onSetAiTyposEnabled={setAiTyposEnabled}
                        aiWordCount={aiWordCount}
                        onSetAiWordCount={setAiWordCount}
                        isAiLoading={isAiLoading}
                        onGenerateAiKeywords={generateAiKeywords}
                        strictSearch={strictSearch}
                        onSetStrictSearch={setStrictSearch}
                        useBaseNegativeKeywords={useBaseNegativeKeywords}
                        onSetUseBaseNegativeKeywords={setUseBaseNegativeKeywords}
                    />
                )}

                {/* Negative Keywords */}
                {activeTab === 'api' && (
                    <div className="flex flex-col sm:flex-row gap-4 w-full mt-3 items-start sm:items-center bg-white p-3 rounded-xl border border-slate-200/60 shadow-sm">
                        <div className="flex-1 w-full relative">
                            <input type="text" placeholder="Минус-слова (через запятую)..." className="w-full pl-3 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500 outline-none text-rose-900 placeholder-rose-300 bg-rose-50/30" value={customNegativeKeywords} onChange={e => setCustomNegativeKeywords(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                        </div>
                    </div>
                )}

                {/* Filters Panel */}
                {showFilters && (
                    <TenderFilters
                        statusFilter={statusFilter} onSetStatusFilter={setStatusFilter}
                        fzFilter={fzFilter} onSetFzFilter={setFzFilter}
                        priceFrom={priceFrom} onSetPriceFrom={setPriceFrom}
                        priceTo={priceTo} onSetPriceTo={setPriceTo}
                        regionCode={regionCode} onSetRegionCode={setRegionCode}
                        applicationDeadlineFrom={applicationDeadlineFrom} onSetApplicationDeadlineFrom={setApplicationDeadlineFrom}
                        applicationDeadlineTo={applicationDeadlineTo} onSetApplicationDeadlineTo={setApplicationDeadlineTo}
                        advance={advance} onSetAdvance={setAdvance}
                        smp={smp} onSetSmp={setSmp}
                        electronicPlaces={electronicPlaces} onTogglePlace={handlePlaceToggle}
                        filterAssignedTo={filterAssignedTo} onSetFilterAssignedTo={setFilterAssignedTo}
                        filterMinScore={filterMinScore} onSetFilterMinScore={setFilterMinScore}
                        filterWorkflowStatus={filterWorkflowStatus} onSetFilterWorkflowStatus={setFilterWorkflowStatus}
                        allUsers={allUsers} statusLabels={WORKFLOW_STATUS_LABELS}
                    />
                )}

                {/* AI Tools and Search Bar (Moved to bottom) */}
                <div className="flex flex-col gap-4 mt-2">
                    <div className="flex justify-end items-center w-full">
                        <div className="flex items-center gap-3">
                            {tenders.length > 0 && (
                                <>
                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                                        <Button variant="secondary" size="sm" className="gap-2 bg-gradient-to-r hover:from-korda-100 hover:to-indigo-50 text-korda-700 border-0 rounded-none border-r border-slate-200" onClick={handleScoreTenders} isLoading={isScoring}>
                                            <Sparkles size={16} /> Оценить ИИ ({tenders.length})
                                        </Button>
                                        <select value={aiModel} onChange={(e) => setAiModel(e.target.value as any)} className="bg-transparent text-xs font-medium text-slate-600 px-2 py-2 outline-none cursor-pointer hover:bg-slate-50 transition-colors" title="Выберите модель ИИ для оценки">
                                            <option value="gemini-3.5-flash">Gemini Flash ⚡</option>
                                        </select>
                                    </div>
                                    <Button variant="secondary" size="sm" className="gap-2 shrink-0" onClick={handleExportTenders} title="Скачать результаты поиска с ИИ-оценками в JSON"><Download size={16} /> JSON</Button>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="relative flex-1">
                            <input type="text" placeholder="Поиск по названию или точному ИНН заказчика (10-12 цифр)..." className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-korda-500 focus:border-korda-500 shadow-sm outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                            <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                        </div>
                        <Button variant="secondary" className="px-4" onClick={() => setShowFilters(!showFilters)}>
                            <SlidersHorizontal size={20} className={showFilters ? "text-korda-600" : "text-slate-600"} />
                        </Button>
                        <Button onClick={handleSearch} disabled={isLoading} className="bg-korda-600 text-white px-6 shadow-md hover:bg-korda-700">
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Найти"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <TendersTable
                    tenders={filteredTenders}
                    isLoading={isLoading}
                    onRowClick={handleRowClick}
                    savedTenders={savedTenderIds}
                    onToggleSave={handleToggleSave}
                    aiScores={aiScores}
                    sharedFavorites={sharedFavorites}
                    statusLabels={WORKFLOW_STATUS_LABELS}
                    canRemoveFavorite={!!canManageTenders}
                    canPermanentlyRemove={!!canPermanentlyRemove}
                />
            </div>

            <TenderDetailsModal
                isOpen={isModalOpen}
                tender={selectedTender}
                isLoading={isDetailsLoading}
                onClose={() => setIsModalOpen(false)}
                favoriteInfo={selectedTender ? getFavoriteInfo(selectedTender?.id) : undefined}
                canManage={!!canManageTenders}
                currentUser={user}
                allUsers={allUsers}
                statusLabels={WORKFLOW_STATUS_LABELS}
                onAssignResponsible={handleAssignResponsible}
                onUpdateStatus={handleUpdateStatus}
                onUpdateContractor={handleUpdateContractor}
                comments={modalComments}
                isLoadingComments={isLoadingComments}
                onAddComment={handleAddComment}
            />
        </div>
    );
};
