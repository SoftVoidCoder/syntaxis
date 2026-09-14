import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ConveyorRequest, ConveyorStatus, UserRole, Attachment, Message, ChatMode, RejectionCategory, ConveyorFile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ChatMessageBubble } from '../ChatMessageBubble';
import { Send, Lock, ArrowLeft, CheckCircle, XCircle, FlaskConical, Paperclip, X, Square, FolderOpen, AlertTriangle, CircleCheck, RotateCcw, Sparkles, Play, Info } from 'lucide-react';
import { generateGeminiResponse } from '../../services/geminiService';
import { uploadFileToGemini } from '../../services/geminiService';
import { getSystemSettings, getKnowledgeBaseFromFirebase } from '../../services/firebaseService';
import { updateConveyorRequest } from '../../services/fireConveyor';
import { ConveyorDocuments } from './ConveyorDocuments';
import { ReturnRequestModal, REJECTION_CATEGORY_LABELS } from './ReturnRequestModal';
import { AgentControlPanel } from './AgentControlPanel';
import { formatTokenCost } from '../../utils/costUtils';

const getCalculationPhrases = (req: ConveyorRequest) => {
    const fileText = req.attachments && req.attachments.length > 0 
        ? `Сбор данных из файлов (${req.attachments.map(a => a.name).join(', ')})...` 
        : "Анализ вводных данных заявки...";

    return [
        `Анализ технического задания "${req.title}"...`,
        fileText,
        "Чтение параметров оборудования и температурных режимов...",
        "Подбор оптимальных материалов изоляции КОРДА...",
        "Расчет расхода ткани, нитей и фурнитуры...",
        "Вычисление коэффициентов припусков...",
        "Анализ стоимости комплектующих...",
        "Формирование технической спецификации...",
        "Калькуляция итоговой себестоимости партии...",
        "Проверка маржинальности...",
        `Подготовка детального отчета...`,
        "Финальная проверка расчетных данных..."
    ];
};

const getCommercialPhrases = (req: ConveyorRequest) => [
    `Анализ расчетов, которые подготовил ${req.managerName}...`,
    "Извлечение реквизитов и данных заказчика...",
    `Формирование преамбулы коммерческого предложения по заявке "${req.title}"...`,
    "Описание преимуществ термочехлов КОРДА...",
    "Структурирование финансовых условий...",
    "Расчет сроков производства и поставки...",
    "Интеграция гарантийных обязательств...",
    "Применение корпоративного стиля КОРДА...",
    "Компоновка финального документа...",
    "Финальная вычитка коммерческого предложения..."
];

const isDeepResearchMessage = (msg: Message) => {
    return msg.role === 'model' && msg.text.includes('[ОДОБРЕННЫЙ ПЛАН ИССЛЕДОВАНИЯ]');
};

const mapConveyorFilesToAttachments = (files?: ConveyorFile[]): Attachment[] => {
    const attachments: Attachment[] = [];
    (files || []).forEach(f => {
        if (f.extractedText) {
            attachments.push({ name: f.name, mimeType: 'application/x-korda-text', data: f.extractedText });
            return;
        }

        attachments.push({
            name: `${f.name}.txt`,
            mimeType: 'application/x-korda-text',
            data: [
                `Файл "${f.name}" приложен к заявке.`,
                `Тип: ${f.mimeType || 'unknown'}. Размер: ${Math.round((f.size || 0) / 1024)} KB.`,
                'Содержимое этого файла не было извлечено в текст при загрузке.',
                'Не утверждай, что файл полностью прочитан; используй только доступные метаданные и попроси пользователя загрузить читаемую версию только если этих данных недостаточно для задачи.'
            ].join('\n')
        });
    });
    return attachments;
};

interface ConveyorChatProps {
    request: ConveyorRequest;
    onClose: () => void;
    onUpdateStatus: (id: string, newStatus: ConveyorStatus, extra?: Partial<ConveyorRequest>) => void;
    onReturn: (requestId: string, category: RejectionCategory, comment: string) => void;
    onReturnToNew: (requestId: string) => void;
    onRequestUpdate?: (id: string, updates: Partial<ConveyorRequest>) => void;
}

export const ConveyorChat: React.FC<ConveyorChatProps> = ({ request, onClose, onUpdateStatus, onReturn, onReturnToNew, onRequestUpdate }) => {
    const { user } = useAuth();
    const isConstructor = user?.role === UserRole.CONSTRUCTOR;

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [showDocuments, setShowDocuments] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [prompts, setPrompts] = useState<any>(null);
    const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
    const [currentRequest, setCurrentRequest] = useState(request);
    const [loadingTextIndex, setLoadingTextIndex] = useState(0);
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [completedTools, setCompletedTools] = useState<string[]>([]);
    const [telemetryLogs, setTelemetryLogs] = useState<string[]>([]);
    const [currentPhase, setCurrentPhase] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Load settings + init messages
    useEffect(() => {
        const load = async () => {
            const [settings, kb] = await Promise.all([getSystemSettings(), getKnowledgeBaseFromFirebase()]);
            if (settings) setPrompts(settings.prompts);
            if (kb) setKnowledgeBase(kb);
        };
        load();

        if (request.chatHistory && request.chatHistory.length > 0) {
            setMessages(request.chatHistory);
        } else {
            // Build initial context from bitrix + description
            const initMessages: Message[] = [];
            const contextParts: string[] = [];

            if (request.bitrixContext) contextParts.push(request.bitrixContext);
            if (request.clientDescription) contextParts.push(`\n--- ОПИСАНИЕ МЕНЕДЖЕРА ---\n${request.clientDescription}`);

            // Add file list for context
            if (request.files && request.files.length > 0) {
                contextParts.push(`\n--- ЗАГРУЖЕННЫЕ ДОКУМЕНТЫ (${request.files.length}) ---`);
                request.files.forEach((f, i) => {
                    contextParts.push(`[${i + 1}] ${f.name} (${f.mimeType}, ${Math.round(f.size / 1024)}KB)`);
                });
            }

            if (contextParts.length > 0) {
                initMessages.push({
                    id: 'ctx-' + request.id,
                    role: 'user',
                    text: `Контекст заявки:\n\n${contextParts.join('\n')}\n\nПроанализируй контекст. Что мы знаем о клиенте и его запросе?`,
                    timestamp: request.createdAt,
                    // Include file URIs for Gemini
                    attachments: mapConveyorFilesToAttachments(request.files)
                });
            }
            setMessages(initMessages);
            if (initMessages.length > 0) {
                updateConveyorRequest(request.id, { chatHistory: initMessages }).catch(console.error);
                onRequestUpdate?.(request.id, { chatHistory: initMessages });
            }
        }
    }, [request.id]);

    const saveChat = async (newMessages: Message[]) => {
        setMessages(newMessages);
        try {
            await updateConveyorRequest(request.id, { chatHistory: newMessages });
            onRequestUpdate?.(request.id, { chatHistory: newMessages });
        } catch (err) {
            console.error('Failed to save chat to DB:', err);
        }
    };

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
        }
    }, [input]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isProcessing) {
            setLoadingTextIndex(0);
            interval = setInterval(() => {
                const phrases = isConstructor ? getCommercialPhrases(currentRequest) : getCalculationPhrases(currentRequest);
                setLoadingTextIndex(prev => (prev + 1) % phrases.length);
            }, 3500);
        }
        return () => clearInterval(interval);
    }, [isProcessing, isConstructor, currentRequest]);

    const handleSend = async () => {
        if (!input.trim() || isProcessing) return;

        const conveyorFiles: Attachment[] = mapConveyorFilesToAttachments(currentRequest.files);

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            text: input,
            timestamp: Date.now(),
            attachments: conveyorFiles.length > 0 ? conveyorFiles : undefined
        };

        const updatedMsgs = [...messages, userMsg];
        await saveChat(updatedMsgs);
        setInput('');
        await processResponse(updatedMsgs);
    };

    const handleActionSend = async (actionText: string) => {
        if (isProcessing) return;

        // Include document attachments for AI analysis
        const fileAttachments: Attachment[] = mapConveyorFilesToAttachments(currentRequest.files);

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            text: actionText,
            timestamp: Date.now(),
            attachments: fileAttachments.length > 0 ? fileAttachments : undefined
        };

        const updatedMsgs = [...messages, userMsg];
        await saveChat(updatedMsgs);
        await processResponse(updatedMsgs);
    };

    const processResponse = async (currentHistory: Message[]) => {
        if (!prompts) return;
        setIsProcessing(true);
        setActiveTools([]);
        setCompletedTools([]);
        setTelemetryLogs([]);
        setCurrentPhase('');
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const lastMsg = currentHistory[currentHistory.length - 1];
            
            const userNameFull = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Менеджер';
            const constructorNameFull = currentRequest.constructorName || 'Сметчик не назначен';
            const managerNameFull = currentRequest.managerName || userNameFull;

            const responseResult = await generateGeminiResponse({
                history: currentHistory,
                currentPrompt: lastMsg.text,
                attachments: lastMsg.attachments || [],
                mode: ChatMode.CONVEYOR,
                knowledgeBase,
                userName: userNameFull,
                prompts,
                useFastModel: false,
                signal: controller.signal,
                conveyorPhase: 'calculation',
                conveyorContext: {
                    managerName: managerNameFull,
                    constructorName: constructorNameFull,
                    requestTitle: currentRequest.title
                },
                onProgress: (status: any) => {
                    setActiveTools(status.activeTools);
                    setCompletedTools(status.completedTools);
                    if (status.telemetryLogs) setTelemetryLogs(status.telemetryLogs);
                    if (status.currentPhase) setCurrentPhase(status.currentPhase);
                }
            });

            // Handle type transition safely
            const responseData: any = typeof responseResult === 'string' ? { text: responseResult } : responseResult;

            const modelMsg: Message = {
                id: crypto.randomUUID(),
                role: 'model',
                text: responseData.text,
                timestamp: Date.now(),
                telemetryLogs: responseData.telemetryLogs,
                tokensUsed: responseData.tokensUsed,
                searchQueries: responseData.searchQueries,
                masterJson: responseData.masterJson
            };
            
            // Update total tokens in the request
            const newTotalTokens = (currentRequest.totalTokensUsed || 0) + (responseData.tokensUsed || 0);
            
            await saveChat([...currentHistory, modelMsg]);
            
            // Also notify parent about the token update
            if (responseData.tokensUsed && onRequestUpdate) {
                onRequestUpdate(currentRequest.id, { totalTokensUsed: newTotalTokens });
                setCurrentRequest(prev => ({ ...prev, totalTokensUsed: newTotalTokens }));
            }
        } catch (err: any) {
            if (err.message === 'Generation Aborted by User') {
                await saveChat([...currentHistory, {
                    id: crypto.randomUUID(), role: 'system' as const,
                    text: '⛔ Генерация остановлена.', timestamp: Date.now()
                }]);
                return;
            }
            await saveChat([...currentHistory, {
                id: crypto.randomUUID(), role: 'model' as const,
                text: `Ошибка: ${err.message}`, timestamp: Date.now()
            }]);
        } finally {
            setIsProcessing(false);
            abortControllerRef.current = null;
        }
    };

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsProcessing(false);
        }
    };

    const handleDocumentUpdate = (updates: Partial<ConveyorRequest>) => {
        setCurrentRequest(prev => ({ ...prev, ...updates }));
        onRequestUpdate?.(request.id, updates);
    };

    const fileCount = currentRequest.files?.length || 0;

    return (
        <>
            <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
                {/* Header */}
                <div className="bg-white px-4 py-2.5 flex justify-between items-center shrink-0 border-b border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="min-w-0">
                            <h2 className="font-bold text-sm truncate text-slate-800">{currentRequest.title}</h2>
                            <span className={`text-xs font-medium ${
                                currentRequest.status === ConveyorStatus.NEW ? 'text-slate-400' :
                                currentRequest.status === ConveyorStatus.PENDING_VERIFICATION ? 'text-blue-500' :
                                currentRequest.status === ConveyorStatus.VERIFIED ? 'text-emerald-500' : 'text-rose-500'
                            }`}>
                                {currentRequest.status === ConveyorStatus.NEW ? 'Черновик' :
                                 currentRequest.status === ConveyorStatus.PENDING_VERIFICATION ? 'Верификация' :
                                 currentRequest.status === ConveyorStatus.VERIFIED ? 'КП Готово' :
                                 currentRequest.status === ConveyorStatus.COMPLETED ? 'Завершено' : 'Черновик'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {currentRequest.totalTokensUsed ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 text-indigo-500 rounded-lg border border-indigo-100 text-xs font-mono font-medium" title={`Всего токенов за заявку: ${currentRequest.totalTokensUsed.toLocaleString()}`}>
                                <Sparkles size={14} /> {formatTokenCost(currentRequest.totalTokensUsed)}
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Chat — full width */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar w-full">
                        <div className="max-w-5xl mx-auto w-full px-6 py-4 space-y-3">
                        {/* Stage Hint */}
                        {(() => {
                            let hintText = "";
                            if (currentRequest.status === ConveyorStatus.NEW || currentRequest.status === ConveyorStatus.REJECTED) {
                                hintText = "Производится работа над базовым расчетом.";
                            } else if (currentRequest.status === ConveyorStatus.PENDING_VERIFICATION) {
                                hintText = "Заявка на верификации. Конструктор проверяет расчёт.";
                            }
                            
                            if (!hintText) return null;
                            return (
                                <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3 mb-4 flex items-start gap-3">
                                    <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                                        <span className="font-bold mr-1">Подсказка:</span>
                                        {hintText}
                                    </p>
                                </div>
                            );
                        })()}

                        {/* Revision banner — show last return reason */}
                        {currentRequest.revisions && currentRequest.revisions.length > 0 && (currentRequest.status === ConveyorStatus.NEW || currentRequest.status === ConveyorStatus.REJECTED) && (() => {
                            const last = currentRequest.revisions[currentRequest.revisions.length - 1];
                            return (
                                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 items-start mb-2 animate-in fade-in slide-in-from-top-2">
                                    <AlertTriangle size={20} className="text-rose-500 shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-rose-700">Возврат #{last.round}</span>
                                            <span className="text-xs text-rose-400">от {last.returnedByName}</span>
                                            <span className="text-xs text-rose-400">• {new Date(last.timestamp).toLocaleDateString('ru-RU')} {new Date(last.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="text-xs font-semibold text-rose-500 mt-1">
                                            {REJECTION_CATEGORY_LABELS[last.category]}
                                        </div>
                                        <p className="text-sm text-rose-700 mt-1.5">«{last.comment}»</p>
                                        {currentRequest.revisions.length > 1 && (
                                            <p className="text-xs text-rose-400 mt-2">Всего возвратов: {currentRequest.revisions.length}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                        {messages.length === 0 && !isProcessing && (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center text-slate-400 max-w-md">
                                    <FlaskConical size={40} className="mx-auto mb-3 text-slate-300" />
                                    <p className="font-semibold text-slate-500 mb-1">Чат заявки</p>
                                    <p className="text-sm">
                                        Откройте <strong>📂 Документы</strong>, загрузите файлы клиента и начните диалог с ИИ.
                                    </p>
                                </div>
                            </div>
                        )}

                        {messages.map(msg => (
                            <div key={msg.id} className="chat-msg">
                                <ChatMessageBubble msg={msg} chatMode={ChatMode.CONVEYOR} requestTitle={currentRequest.title} orderNumber={(currentRequest as any).orderNumber} />
                            </div>
                        ))}

                        {isProcessing && (
                            <div className="flex flex-col gap-4">
                                <AgentControlPanel 
                                    activeTools={activeTools} 
                                    completedTools={completedTools} 
                                    isGenerating={isProcessing} 
                                    telemetryLogs={telemetryLogs}
                                    currentPhase={currentPhase}
                                />
                                <div className="flex items-center gap-2 text-sm text-slate-400 pl-2">
                                    <button onClick={handleStop} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-500 transition-colors ml-auto" title="Остановить">
                                        <Square size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Input */}
                    <div className="border-t border-slate-200 bg-white shrink-0 w-full">
                        <div className="max-w-5xl mx-auto w-full">
                        {/* Action Toolbar */}
                        <div className="px-6 pt-3 pb-1 flex flex-wrap gap-2 items-center">
                            {/* Documents button */}
                            <button onClick={() => setShowDocuments(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors relative">
                                <FolderOpen size={14} /> Документы
                                {fileCount > 0 && (
                                    <span className="bg-emerald-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{fileCount}</span>
                                )}
                            </button>

                            {/* Send to verification button */}
                            {(currentRequest.status === ConveyorStatus.NEW || currentRequest.status === ConveyorStatus.REJECTED) && (
                                <button onClick={() => onUpdateStatus(request.id, ConveyorStatus.PENDING_VERIFICATION)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                                    <Send size={14} /> На верификацию
                                </button>
                            )}

                            {/* Verification buttons — constructor verifies or returns */}
                            {currentRequest.status === ConveyorStatus.PENDING_VERIFICATION && (
                                <>
                                    <button onClick={() => setShowReturnModal(true)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors">
                                        <XCircle size={14} /> Возврат
                                    </button>
                                    <button onClick={() => onUpdateStatus(request.id, ConveyorStatus.VERIFIED)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                                        <CheckCircle size={14} /> Верифицировать
                                    </button>
                                </>
                            )}

                            {/* Complete button */}
                            {currentRequest.status === ConveyorStatus.VERIFIED && (
                                <>
                                    <button onClick={() => onReturnToNew(request.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors">
                                        <RotateCcw size={14} /> В черновик
                                    </button>
                                    <button onClick={() => onUpdateStatus(request.id, ConveyorStatus.COMPLETED)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-500 text-white rounded-lg hover:bg-violet-400 transition-colors">
                                        <CircleCheck size={14} /> Завершить
                                    </button>
                                </>
                            )}

                            {/* Return from Completed */}
                            {currentRequest.status === ConveyorStatus.COMPLETED && (
                                <button onClick={() => onReturnToNew(request.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors">
                                    <RotateCcw size={14} /> В черновик
                                </button>
                            )}
                        </div>

                        <div className="px-6 py-3">
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 min-w-0">
                                        <textarea
                                            ref={textareaRef}
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                            placeholder={isConstructor ? "Проверьте расчет и напишите «создай коммерческое»..." : "Задайте вопрос или уточните запрос..."}
                                            rows={1}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-slate-400 text-sm resize-none"
                                            style={{ minHeight: '42px', maxHeight: '150px' }}
                                        />
                                    </div>
                                    {isProcessing ? (
                                        <button onClick={handleStop} className="bg-red-500 hover:bg-red-400 text-white rounded-xl p-2.5 shrink-0 self-end transition-colors" title="Остановить">
                                            <Square size={18} />
                                        </button>
                                    ) : (
                                        <button onClick={handleSend} disabled={!input.trim()}
                                            className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl p-2.5 shrink-0 self-end transition-colors">
                                            <Send size={18} />
                                        </button>
                                    )}
                                </div>
                        </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Documents Modal */}
            {showDocuments && (
                <ConveyorDocuments
                    request={currentRequest}
                    onClose={() => setShowDocuments(false)}
                    onRequestUpdate={handleDocumentUpdate}
                />
            )}

            {/* Return Modal */}
            {showReturnModal && (
                <ReturnRequestModal
                    onClose={() => setShowReturnModal(false)}
                    onReturn={(category, comment) => {
                        setShowReturnModal(false);
                        onReturn(request.id, category, comment);
                    }}
                />
            )}
        </>
    );
};
