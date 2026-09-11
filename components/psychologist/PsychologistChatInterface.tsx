import React, { useState, useRef, useEffect } from 'react';
import { PsychologistChatSession, PsychologistMessage } from '../../types';
import { Send, Square, Brain, X, ShieldAlert, Activity } from 'lucide-react';
import { Button } from '../Button';
import { savePsychologistChat } from '../../services/psychologistStorage';
import { useAuth } from '../../context/AuthContext';
import { ChatMessageBubble } from '../ChatMessageBubble';
import { callProxy } from '../../services/geminiCore';
import { MODEL_NAME, FAST_MODEL_NAME } from '../../constants';
import { logAnalyticsEvent } from '../../services/fireCore';
import { ChatMode } from '../../types';

interface PsychologistChatInterfaceProps {
    chat: PsychologistChatSession;
    pin: string;
    onUpdateChat: (chat: PsychologistChatSession) => void;
    onClose: () => void;
}

const PSYCH_SCHOOLS: Record<string, string> = {
    'machine': 'Ты — строгий аналитический разум. Опирайся только на логику, факты и причинно-следственные связи. Игнорируй эмоции, ищи корень проблемы в системах и паттернах.',
    'strategist': 'Ты — холодный стратег. Анализируй ситуацию как шахматную партию: оценивай варианты, просчитывай последствия на 3 шага вперёд, ищи оптимальный ход. Мысли категориями выгоды, риска и долгосрочного результата.',
    'diagnostician': 'Ты — диагност. Систематически проверяй и исключай гипотезы одну за другой, как врач. Строй дерево решений. Задавай точечные вопросы, чтобы сузить область проблемы.',
    'detective': 'Ты — детектив. Ищи противоречия, несоответствия и скрытую информацию в словах клиента. Перекрёстно проверяй факты. Будь дотошным и холодным.',
    'devils_advocate': 'Ты — адвокат дьявола. Расшатывай каждое убеждение клиента, стресс-тестируй его мышление. Ищи слабые места в аргументации. Будь провокативным, но конструктивным.',
    'philosopher': 'Ты — Сократ. Используй только вопросы. Никогда не утверждай и не давай ответов. Веди клиента к осознанию через цепочку точных, логических вопросов.',
    'kpt': 'Ты — КПТ-терапевт. Твоя цель — помочь найти когнитивные искажения и нелогичные убеждения. Возвращай человека к фактам и его реакциям на них.',
    'gestalt': 'Ты — гештальт-терапевт. Фокусируйся на чувствах "здесь и сейчас", потребностях и телесных ощущениях. Помогай брать ответственность за свои эмоции.',
    'psychoanalysis': 'Ты — психоаналитик (Фрейд/Юнг). Обращай внимание на скрытые мотивы, подтекст и вытесненные чувства. Отвечай немногословно, направляя взгляд вглубь бессознательного.',
    'humanistic': 'Ты — гуманистический психолог. Проявляй безусловное принятие и тихую эмпатию. Отражай (зеркаль) чувства клиента, давая ему безопасное пространство раскрыться.',
    'existential': 'Ты — экзистенциальный терапевт. Исследуй темы смысла, свободы, одиночества и конечности. Помогай клиенту осознать свой выбор и ответственность за него.',
    'narrative': 'Ты — нарративный терапевт. Помогай клиенту увидеть себя автором своей истории. Ищи альтернативные сюжеты, ресурсные эпизоды и возможности пересочинить сценарий.',
    'systemic': 'Ты — системный терапевт. Смотри на проблему через призму отношений и системы вокруг клиента. Ищи паттерны взаимодействия, роли и скрытые правила системы.',
    'rebt': 'Ты — РЭПТ-терапевт (Альберт Эллис). Жёстко вскрывай иррациональные требования ("должен", "обязан", "это ужасно"). Возвращай клиента к гибкому, рациональному мышлению.',
    'positive': 'Ты — представитель позитивной психологии. Фокусируйся на сильных сторонах, ресурсах и потенциале клиента. Ищи то, что уже работает, и помогай масштабировать успехи.',
    'sfbt': 'Ты — решение-фокусированный терапевт. Не копайся в прошлом. Спрашивай: "Что ты хочешь вместо проблемы?" и "Когда проблема уже была чуть меньше — что ты делал по-другому?"',
};

const PSYCH_RULES: Record<string, string> = {
    'machine': `ПРАВИЛА:
1. Будь краток: 2-4 предложения. Без воды.
2. Опирайся только на факты и логику. Игнорируй эмоциональные оценки.
3. Можешь делать прямые выводы и утверждения, если они логически обоснованы.
4. В конце — один точный вопрос ИЛИ логическое заключение.`,
    'strategist': `ПРАВИЛА:
1. Можешь давать развёрнутый анализ: до 5-7 предложений.
2. Раскладывай варианты: что будет если А, что если Б. Оценивай риски и выгоды.
3. Можешь давать прямые рекомендации и стратегические советы.
4. В конце — ключевой вопрос для принятия решения ИЛИ чёткая рекомендация.`,
    'diagnostician': `ПРАВИЛА:
1. Будь краток: 2-4 предложения. Двигайся системно.
2. Задавай точечные, диагностические вопросы — один за раз.
3. Исключай гипотезы вслух: «Это не X, потому что... Проверим Y.»
4. Когда уверен — дай чёткий вердикт.`,
    'detective': `ПРАВИЛА:
1. Будь краток и дотошен: 2-4 предложения.
2. Предъявляй противоречия прямо: «Ты сказал X, но раньше говорил Y.»
3. Не принимай ответы на веру — перепроверяй.
4. В конце — один прицельный вопрос, вскрывающий несоответствие.`,
    'devils_advocate': `ПРАВИЛА:
1. Будь провокативен: 2-4 предложения.
2. Оспаривай КАЖДОЕ утверждение клиента. Делай это через утверждения, не вопросы.
3. «А если ты ошибаешься?», «Ты уверен, что это не самообман?»
4. НЕ соглашайся. Твоя задача — расшатать, а не поддержать.`,
    'philosopher': `ПРАВИЛА:
1. Используй ТОЛЬКО вопросы. Ни одного утверждения, совета или вывода.
2. Максимум 1-2 вопроса за реплику.
3. Каждый вопрос должен быть глубже предыдущего.
4. Веди к осознанию через цепочку логических вопросов.`,
    'kpt': `ПРАВИЛА:
1. Краткость: 2-5 предложений.
2. Называй когнитивные искажения прямо: «Это чёрно-белое мышление.»
3. Можешь давать мини-задания: «Попробуй записать 3 факта за и против этой мысли.»
4. В конце — вопрос, возвращающий к фактам, ИЛИ конкретное задание.`,
    'gestalt': `ПРАВИЛА:
1. Будь краток: 1-3 предложения. Фокус на ощущениях.
2. Возвращай в «здесь и сейчас»: «Что ты чувствуешь прямо сейчас?»
3. Можешь предлагать эксперименты: «Попробуй сказать это вслух от первого лица.»
4. Один вопрос о чувствах или телесных ощущениях.`,
    'psychoanalysis': `ПРАВИЛА:
1. Будь немногословен: 1-2 предложения. Загадочность — твой инструмент.
2. Обращай внимание на оговорки, повторы, то что НЕ сказано.
3. Не объясняй — намекай. «Интересно, что вы выбрали именно это слово...»
4. Один вопрос ИЛИ многозначительная пауза-утверждение.`,
    'humanistic': `ПРАВИЛА:
1. Будь мягок: 1-3 предложения. Тепло и принятие.
2. Отражай чувства: «Похоже, тебе сейчас тяжело от этого.»
3. НИКАКИХ советов и оценок. Только безусловное принятие.
4. Один мягкий вопрос ИЛИ тёплое отражение.`,
    'existential': `ПРАВИЛА:
1. Будь краток: 1-3 предложения. Глубина важнее объёма.
2. Исследуй: смысл, свобода, одиночество, конечность, ответственность.
3. Не давай ответов — помогай формулировать свои вопросы к жизни.
4. Один экзистенциальный вопрос.`,
    'narrative': `ПРАВИЛА:
1. Краткость: 2-4 предложения.
2. Переформулируй историю клиента: «А что если посмотреть на это как на...»
3. Ищи ресурсные эпизоды: «Был ли момент, когда ты справился?»
4. Приглашай пересочинить: вопрос ИЛИ предложение альтернативного сюжета.`,
    'systemic': `ПРАВИЛА:
1. Краткость: 2-4 предложения.
2. Спрашивай о других участниках: «А что скажет на это твой коллега/партнёр?»
3. Ищи паттерны взаимодействия и скрытые правила системы.
4. Один вопрос о системе отношений.`,
    'rebt': `ПРАВИЛА:
1. Будь прямолинеен и жёсток: 2-4 предложения.
2. Оспаривай иррациональные требования ПРЯМО: «Почему он ДОЛЖЕН? Кто это решил?»
3. Можешь делать утверждения: «Это не ужасно — это просто неудобно.»
4. В конце — провокационный вопрос ИЛИ рациональная альтернатива.`,
    'positive': `ПРАВИЛА:
1. Краткость: 2-4 предложения. Тон — тёплый, но не слащавый.
2. Ищи сильные стороны: «Заметь, ты уже сделал X — это говорит о Y.»
3. Можешь предлагать упражнения на ресурсы и благодарность.
4. Вопрос о ресурсах ИЛИ предложение упражнения.`,
    'sfbt': `ПРАВИЛА:
1. Краткость: 2-4 предложения. Никакого копания в прошлом.
2. Используй «чудесный вопрос»: «Если завтра проблема исчезла — что изменится первым?»
3. Ищи исключения: «Когда проблема была чуть меньше?»
4. Шкалирование: «От 1 до 10, где ты сейчас? Что нужно для +1?»`,
};

const PSYCH_ANALYSIS_PROMPTS: Record<string, string> = {
    'machine': 'Проведи сухой логический анализ. Выяви паттерны, причинно-следственные связи и системные ошибки мышления клиента.',
    'strategist': 'Проанализируй диалог как стратег. Оцени принятые и непринятые решения, упущенные возможности, риски и оптимальную стратегию дальнейших действий.',
    'diagnostician': 'Проанализируй диалог как диагност. Составь список гипотез о корневой проблеме, укажи какие подтвердились, какие исключены, какие требуют проверки.',
    'detective': 'Проанализируй диалог как детектив. Выяви противоречия, недосказанности, несоответствия между словами и фактами. Что клиент скрывает или не замечает?',
    'devils_advocate': 'Проанализируй диалог как адвокат дьявола. Найди слабые места в рассуждениях клиента, непроверенные допущения и слепые зоны мышления.',
    'philosopher': 'Проанализируй диалог как Сократ. Оцени качество рефлексии клиента, глубину осознания и какие ключевые вопросы остались незаданными.',
    'kpt': 'Проанализируй диалог через призму КПТ. Выяви когнитивные искажения, автоматические мысли и дисфункциональные убеждения.',
    'gestalt': 'Проанализируй диалог как гештальт-терапевт. Обрати внимание на незавершённые гештальты, избегание чувств и потребности, которые клиент не осознаёт.',
    'psychoanalysis': 'Проанализируй диалог как психоаналитик. Обрати внимание на защитные механизмы, вытесненные чувства, перенос и скрытые мотивы.',
    'humanistic': 'Проанализируй диалог как гуманистический психолог. Оцени уровень самопринятия, конгруэнтности и блоки на пути к самоактуализации.',
    'existential': 'Проанализируй диалог как экзистенциальный терапевт. Исследуй темы свободы, ответственности, смысла и тревоги перед неопределённостью.',
    'narrative': 'Проанализируй диалог как нарративный терапевт. Выяви доминирующую историю клиента, ограничивающие нарративы и точки входа для альтернативного сюжета.',
    'systemic': 'Проанализируй диалог как системный терапевт. Определи ключевых участников системы, их роли, правила и паттерны взаимодействия.',
    'rebt': 'Проанализируй диалог через призму РЭПТ. Выяви иррациональные требования ("должен/обязан"), катастрофизацию и низкую фрустрационную толерантность.',
    'positive': 'Проанализируй диалог через призму позитивной психологии. Выяви сильные стороны клиента, ресурсы и моменты, когда он уже справлялся.',
    'sfbt': 'Проанализируй диалог как решение-фокусированный терапевт. Найди исключения из проблемы, желаемый результат клиента и шаги к "чудесному дню".',
};

export const PSYCH_SCHOOL_NAMES: Record<string, string> = {
    'machine': '🤖 Машинный разум',
    'strategist': '♟️ Стратег',
    'diagnostician': '🩺 Диагност',
    'detective': '🔍 Детектив',
    'devils_advocate': '👿 Адвокат дьявола',
    'philosopher': '🏛️ Сократ',
    'kpt': '🧩 КПТ',
    'gestalt': '🌀 Гештальт',
    'psychoanalysis': '🛋️ Психоанализ',
    'humanistic': '🤲 Гуманистическая',
    'existential': '🌌 Экзистенциальная',
    'narrative': '📖 Нарративная',
    'systemic': '🔗 Системная',
    'rebt': '⚡ РЭПТ',
    'positive': '☀️ Позитивная',
    'sfbt': '🎯 Решение-фокусированная',
};

export const PsychologistChatInterface: React.FC<PsychologistChatInterfaceProps> = ({ 
    chat, 
    pin, 
    onUpdateChat,
    onClose
}) => {
    const { user } = useAuth();
    const [inputText, setInputText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chat.messages, isProcessing]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsProcessing(false);
        }
    };

    const processResponse = async (currentHistory: PsychologistMessage[]) => {
        setIsProcessing(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const systemInstruction = PSYCH_SCHOOLS[chat.school] || PSYCH_SCHOOLS['machine'];
            const history = currentHistory.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            // Force fast model via our proxy
            const res = await callProxy('generateContent', {
                model: FAST_MODEL_NAME,
                contents: history,
                config: {
                    systemInstruction: `ТЫ НЕЙРОМЕНТОР KORDA. Твоя задача — консультировать сотрудника. 
Твой подход: ${systemInstruction}
${PSYCH_RULES[chat.school] || PSYCH_RULES['machine']}`,
                    temperature: 0.7,
                }
            }, controller.signal);

            const newModelMsg: PsychologistMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                text: res.text || "...",
                timestamp: Date.now()
            };

            const updatedChat = {
                ...chat,
                messages: [...currentHistory, newModelMsg]
            };
            
            if (user) {
                await savePsychologistChat(user.id, updatedChat, pin);
                await logAnalyticsEvent(user, 'chat', ChatMode.NEUROMENTOR);
            }
            onUpdateChat(updatedChat);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(error);
                const errorMsg: PsychologistMessage = {
                    id: crypto.randomUUID(),
                    role: 'model',
                    text: "Произошла ошибка при обращении к Нейроментору.",
                    timestamp: Date.now()
                };
                const updatedChat = { ...chat, messages: [...currentHistory, errorMsg] };
                if (user) await savePsychologistChat(user.id, updatedChat, pin);
                onUpdateChat(updatedChat);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                setIsProcessing(false);
                abortControllerRef.current = null;
            }
        }
    };

    const handleAnalysis = async () => {
        if (isProcessing || chat.messages.length === 0) return;

        setIsProcessing(true);
        const controller = new AbortController();
        abortControllerRef.current = controller;

        try {
            const history = chat.messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const startAnalysisMsg: PsychologistMessage = {
                id: crypto.randomUUID(),
                role: 'user',
                text: "[СИСТЕМНЫЙ ЗАПРОС]: Проанализируй весь этот диалог. Напиши сухой, объективный психоэмоциональный профиль. Что ты понял о состоянии клиента? Какова истинная проблема? Какую стратегию работы ты выберешь дальше? Формат: аналитический отчет.",
                timestamp: Date.now()
            };

            const contents = [...history, { role: 'user', parts: [{ text: startAnalysisMsg.text }] }];

            const analysisStyle = PSYCH_ANALYSIS_PROMPTS[chat.school] || PSYCH_ANALYSIS_PROMPTS['machine'];
            const res = await callProxy('generateContent', {
                model: MODEL_NAME,
                contents: contents,
                config: {
                    systemInstruction: `ТЫ ВЕТВЬ АНАЛИЗА НЕЙРОМЕНТОРА KORDA. ${analysisStyle} Отвечай только по делу, соблюдай структуру отчета, выделяя главное жирным.`,
                    temperature: 0.2, // Lower temp for logic
                }
            }, controller.signal);

            const newModelMsg: PsychologistMessage = {
                id: crypto.randomUUID(),
                role: 'model',
                text: `**🧠 АНАЛИЗ СЕССИИ:**\n\n${res.text || "..."}`,
                timestamp: Date.now()
            };

            const updatedChat = {
                ...chat,
                messages: [...chat.messages, newModelMsg]
            };
            
            if (user) {
                await savePsychologistChat(user.id, updatedChat, pin);
                await logAnalyticsEvent(user, 'chat', ChatMode.NEUROMENTOR);
            }
            onUpdateChat(updatedChat);

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(error);
                const errorMsg: PsychologistMessage = {
                    id: crypto.randomUUID(),
                    role: 'model',
                    text: "Произошла ошибка при формировании анализа.",
                    timestamp: Date.now()
                };
                const updatedChat = { ...chat, messages: [...chat.messages, errorMsg] };
                if (user) await savePsychologistChat(user.id, updatedChat, pin);
                onUpdateChat(updatedChat);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                setIsProcessing(false);
                abortControllerRef.current = null;
            }
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || isProcessing) return;

        const newUserMsg: PsychologistMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            text: inputText,
            timestamp: Date.now()
        };

        const currentHistory = [...chat.messages, newUserMsg];
        const updatedChat = { ...chat, messages: currentHistory };
        
        if (user) {
            await savePsychologistChat(user.id, updatedChat, pin);
        }
        
        onUpdateChat(updatedChat);
        setInputText('');
        
        processResponse(currentHistory);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 relative overflow-hidden rounded-xl border border-indigo-100 shadow-2xl">
            {/* Header */}
            <div className="h-16 border-b border-indigo-100 flex items-center justify-between px-4 bg-white/80 backdrop-blur-md z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                        <Brain size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg truncate max-w-[200px]">
                            {chat.title}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium">
                            <ShieldAlert size={12} />
                            <span>{PSYCH_SCHOOL_NAMES[chat.school] || chat.school}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">

                    <button 
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                        title="Закрыть диалог"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {chat.messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-60">
                        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
                            <Brain className="text-indigo-600" size={40} />
                        </div>
                        <p className="text-slate-700 font-bold text-lg mb-2">Кабинет Нейроментора</p>
                        <p className="text-sm text-slate-500 max-w-sm text-center">
                            Все данные шифруются и остаются только на вашем устройстве. Никаких серверов, полная анонимность.
                        </p>
                    </div>
                )}

                {chat.messages.map((msg) => (
                    // Reusing standard ChatMessageBubble but casting types
                    // We need to adapt PsychologistMessage to Message format expected by ChatMessageBubble
                    <ChatMessageBubble 
                        key={msg.id} 
                        msg={{ ...msg, role: msg.role as 'user' | 'model', attachments: undefined }} 
                        chatMode={'free' as any} 
                    />
                ))}

                {isProcessing && (
                    <div className="flex justify-start">
                        <div className="bg-white border border-indigo-100 text-indigo-500 rounded-2xl rounded-bl-none p-4 flex items-center gap-3 shadow-sm">
                            <div className="flex space-x-1 border border-indigo-200 p-2 rounded-full">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="text-xs font-semibold">
                                Нейроментор анализирует...
                            </span>
                            <button onClick={handleStop} className="ml-2 p-1.5 bg-rose-50 rounded-full text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition-colors" title="Остановить">
                                <Square size={12} className="fill-current" />
                            </button>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Simple Input Area */}
            <div className="p-4 bg-white border-t border-indigo-50 relative z-10">
                <div className="max-w-4xl mx-auto flex flex-col gap-3">
                    {chat.messages.length > 0 && (
                        <div className="flex justify-center">
                            <Button 
                                onClick={handleAnalysis}
                                disabled={isProcessing}
                                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white py-2.5 px-6 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 font-bold gap-2 rounded-xl flex items-center"
                                title="Сгенерировать объективный психоэмоциональный профиль по всему диалогу"
                            >
                                <Activity size={18} />
                                <span>Провести анализ сессии</span>
                            </Button>
                        </div>
                    )}
                    <div className="flex items-end gap-2 bg-slate-50 border border-indigo-100 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-sm relative">
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            placeholder="Напишите здесь то, что вас беспокоит..."
                            className="flex-1 bg-transparent border-none text-slate-800 placeholder-slate-400 outline-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 px-4 font-medium"
                            rows={1}
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={!inputText.trim() || isProcessing}
                            className={`p-3 rounded-xl transition-all shadow-sm ${!inputText.trim() ? 'opacity-50 bg-slate-200 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'}`}
                        >
                            <Send size={20} />
                        </Button>
                    </div>
                    <div className="text-center flex justify-center items-center gap-2 text-xs text-indigo-400 font-medium">
                        <ShieldAlert size={12} />
                        <span>Локальное шифрование включено</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
