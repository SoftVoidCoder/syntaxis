import React from 'react';
import { Button } from '../components/Button';
import { ChatMode, ChatSession, SalesTask } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLeadSearch } from '../hooks/useLeadSearch';
import { TaskLeadCard } from '../components/tasks/TaskLeadCard';
import { TaskHistoryCard } from '../components/tasks/TaskHistoryCard';
import { ArrowLeft, Loader2, CheckCircle, RefreshCw, Search, Sparkles, Clock } from 'lucide-react';

interface TasksPageProps {
    chats: ChatSession[];
    onBack?: () => void;
    onNavigateChat?: () => void;
    onSelectChat?: (id: string) => void;
    onCreateChat?: (mode: ChatMode, title: string, initialMessage?: string, skipNavigation?: boolean) => void;
    targetUserId?: string;
    readOnly?: boolean;
    tasks?: SalesTask[];
    onDeleteTask?: (taskId: string) => Promise<void>;
}

export const TasksPage: React.FC<TasksPageProps> = ({
    chats, onBack, onNavigateChat, onSelectChat, onCreateChat,
    targetUserId, readOnly = false, tasks: providedTasks, onDeleteTask
}) => {
    const { user } = useAuth();
    const effectiveUserId = targetUserId || user?.id;

    const s = useLeadSearch({ userId: effectiveUserId, providedTasks, chats });

    return (
        <div className="p-6 max-w-6xl mx-auto text-slate-800">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-korda-600 to-indigo-600">
                        {readOnly ? "Просмотр задач менеджера" : "Поиск клиентов (AI Agent)"}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {readOnly ? `ID: ${targetUserId}` : "Автоматическая генерация лидов на основе стратегии компании"}
                    </p>
                </div>
                {onBack && (
                    <Button variant="secondary" onClick={onBack} size="sm" className="gap-2">
                        <ArrowLeft size={16} /> Назад
                    </Button>
                )}
            </div>

            {/* Tabs + Generate Button */}
            <div className="flex flex-col gap-4 mb-6 border-b border-slate-200 pb-4">
                <div className="flex gap-4 items-center">
                    <button onClick={() => s.setActiveTab('active')}
                        className={`pb-2 px-1 font-medium transition-colors ${s.activeTab === 'active' ? 'text-korda-600 border-b-2 border-korda-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        Активные ({s.activeTasks.length})
                    </button>
                    <button onClick={() => s.setActiveTab('history')}
                        className={`pb-2 px-1 font-medium transition-colors ${s.activeTab === 'history' ? 'text-korda-600 border-b-2 border-korda-600' : 'text-slate-500 hover:text-slate-700'}`}>
                        История ({s.completedTasks.length})
                    </button>
                    <div className="flex-1" />

                    {!readOnly && (
                        <div className="relative group/btn">
                            <Button onClick={s.handleGenerateTask}
                                disabled={s.isGenerating || !s.strategyDoc || s.activeTasks.length > 0 || !s.managerWishes.trim()}
                                className={`gap-2 ${(s.activeTasks.length > 0 || !s.managerWishes.trim()) ? 'opacity-50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                                {s.isGenerating ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                                {s.isGenerating ? "Поиск лидов..." : "Получить новую задачу"}
                            </Button>
                            {s.isGenerating && s.searchProgress && (
                                <div className="mt-2 rounded-lg overflow-hidden border border-indigo-200">
                                    <div className="px-3 py-1.5 bg-indigo-50 text-xs text-indigo-700 flex justify-between">
                                        <span>Прогон {s.searchProgress.attempt}/{s.searchProgress.max}</span>
                                        <span className="font-medium">Найдено {s.searchProgress.found}/5</span>
                                    </div>
                                    <div className="h-1.5 bg-indigo-100">
                                        <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${(s.searchProgress.found / 5) * 100}%` }} />
                                    </div>
                                </div>
                            )}
                            {!s.managerWishes.trim() && (
                                <div className="absolute right-0 top-full mt-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover/btn:opacity-100 transition-opacity z-50 pointer-events-none">
                                    Опишите, каких клиентов нужно найти.
                                </div>
                            )}
                            {s.activeTasks.length > 0 && (
                                <div className="absolute right-0 top-full mt-2 w-64 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 group-hover/btn:opacity-100 transition-opacity z-50 pointer-events-none">
                                    Завершите текущую активную задачу перед созданием новой.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Wishes Area with Chips */}
                {!readOnly && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                        {s.chipHistory.length > 0 && (
                            <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Clock size={12} className="text-slate-400" />
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Последние запросы</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {s.chipHistory.map((chip, i) => (
                                        <button key={`h-${i}`} onClick={() => s.handleChipClick(chip)}
                                            className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:border-korda-400 hover:bg-korda-50 hover:text-korda-700 transition-all text-slate-600 truncate max-w-[250px]"
                                            title={chip}>{chip}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {s.baseChips.length > 0 && (
                            <div>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase mb-2 block">Быстрый выбор</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {s.baseChips.map((chip, i) => (
                                        <button key={`b-${i}`} onClick={() => s.handleChipClick(chip)}
                                            className="text-xs px-3 py-1.5 bg-white border border-indigo-200 rounded-full hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition-all text-indigo-600 font-medium">
                                            {chip}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">
                                Опишите, каких клиентов нужно найти <span className="text-red-400">*</span>
                            </label>
                            <textarea value={s.managerWishes} onChange={(e) => s.handleWishesChange(e.target.value)}
                                placeholder="Например: Строительные компании в Москве, занимающиеся утеплением фасадов..."
                                className="w-full p-3 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-korda-500 outline-none resize-none h-20" />
                        </div>

                        <div className="flex items-start gap-3">
                            <button onClick={s.handleGenerateAiChips}
                                disabled={!s.managerWishes.trim() || s.isGeneratingChips || !s.chipPrompt}
                                className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                                    s.isGeneratingChips ? 'bg-purple-50 border-purple-300 text-purple-600 cursor-wait'
                                    : !s.managerWishes.trim() || !s.chipPrompt ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100 hover:border-purple-400'
                                }`}>
                                {s.isGeneratingChips ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                {s.isGeneratingChips ? 'Генерирую...' : 'Подсказать варианты'}
                            </button>
                            {s.aiChips.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {s.aiChips.map((chip, i) => (
                                        <button key={`ai-${i}`} onClick={() => s.handleChipClick(chip)}
                                            className="text-xs px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full hover:border-purple-400 hover:bg-purple-100 hover:text-purple-800 transition-all text-purple-700 animate-in fade-in slide-in-from-left-2"
                                            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
                                            ✨ {chip}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-slate-200 pt-3">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Глубина поиска (попыток ИИ): {s.retryCount}</label>
                                <span className="text-xs text-slate-400">Чем больше, тем дольше поиск</span>
                            </div>
                            <input type="range" min="1" max="5" step="1" value={s.retryCount} onChange={(e) => s.setRetryCount(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-korda-600" />
                            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                <span>1 (Быстро)</span><span>5 (Максимум)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {s.activeTab === 'active' && (
                    <div className="grid grid-cols-1 gap-6">
                        {s.activeTasks.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                                <p className="text-slate-500 mb-4">{readOnly ? "У менеджера нет активных задач" : "У вас нет активных задач"}</p>
                                {!readOnly && <Button onClick={s.handleGenerateTask} disabled={s.isGenerating || s.activeTasks.length > 0}>Получить задачу</Button>}
                            </div>
                        ) : (
                            s.activeTasks.map(task => (
                                <div key={task.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                        <span className="text-xs font-mono text-slate-500">ID: {task.id.slice(0, 8)} • {new Date(task.createdAt).toLocaleString()}</span>
                                        {!readOnly && (
                                            <Button size="sm" onClick={() => s.handleCompleteTask(task.id)}
                                                disabled={s.completingTaskId === task.id}
                                                className={`gap-2 ${s.completingTaskId === task.id ? 'bg-amber-500 hover:bg-amber-500 cursor-wait' : 'bg-korda-500 hover:bg-korda-600'} text-white`}>
                                                {s.completingTaskId === task.id ? <><Loader2 size={16} className="animate-spin" /> Формирую отчёт...</> : <><CheckCircle size={16} /> Завершить задачу</>}
                                            </Button>
                                        )}
                                    </div>
                                    {s.completingTaskId === task.id && (
                                        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-700 flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" /> {s.completingStatus}
                                        </div>
                                    )}
                                    <div className="divide-y divide-slate-100">
                                        {task.leads.map((lead, idx) => (
                                            <TaskLeadCard
                                                key={idx}
                                                lead={lead}
                                                leadIndex={idx}
                                                taskId={task.id}
                                                existingChat={chats.find(c => c.title === lead.companyName)}
                                                readOnly={readOnly}
                                                creatingChatForLead={s.creatingChatForLead}
                                                cooldownLeft={s.cooldownLeft}
                                                onSelectChat={onSelectChat}
                                                onNavigateChat={onNavigateChat}
                                                onCreateChat={onCreateChat}
                                                onIgnore={s.handleIgnoreLead}
                                                onChatCreating={s.setCreatingChatForLead}
                                                onCooldownStart={() => s.setCooldownUntil(Date.now() + 120_000)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {s.activeTab === 'history' && (
                    <div className="space-y-4">
                        {s.completedTasks.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">История пуста</div>
                        ) : (
                            s.completedTasks.map(task => (
                                <TaskHistoryCard key={task.id} task={task} onDeleteTask={onDeleteTask} />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
