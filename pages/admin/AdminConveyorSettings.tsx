import React, { useState, useEffect } from 'react';
import { ConveyorRule, ConveyorRuleCategory, AgentTool } from '../../types';
import { Button } from '../../components/Button';
import { Plus, Trash2, Edit2, BookOpen, AlertTriangle, FolderOpen, FolderTree, CornerDownRight, ListFilter, Bot, Power, CheckCircle, Save } from 'lucide-react';
import { 
    getConveyorRuleCategories, saveConveyorRuleCategory, deleteConveyorRuleCategory,
    getConveyorRules, saveConveyorRule, deleteConveyorRule,
    getAgentTools, saveAgentTool, deleteAgentTool
} from '../../services/firebaseService';
import { getModePrompts, saveModePrompts } from '../../services/storage';
import { DEFAULT_CONVEYOR_PROMPT } from '../../constants';
import { RotateCcw } from 'lucide-react';

// Actual embedded prompts from agentTools.js — displayed read-only in admin panel
const AGENT_EMBEDDED_PROMPTS: Record<string, string> = {
    generate_tu_name: `Ты - строгий Ассистент по ТУ. Твоя задача - извлечь все позиции оборудования из предоставленной спецификации и сформировать ПРАВИЛЬНОЕ номенклатурное наименование изделия на основе правил ТУ.

КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО: Ты ДОЛЖЕН обработать ВСЕ без исключения строки спецификации. Если в спецификации 49 позиций, в твоем JSON должно быть ровно 49 объектов.

СТРОГОЕ ПРАВИЛО: Ответ ИСКЛЮЧИТЕЛЬНО в формате валидного JSON-массива.

Формат: { "id": число, "raw_name": "оригинал", "qty": число, "tu_name": "Термочехол КОРДА ЧСТЭ-200 ТА ..." }

Используются: документация ТУ из Google Drive + спецификация пользователя.
Модель: gemini-3.1-pro-preview | maxOutputTokens: 16384 | Батчинг: по 20 позиций`,

    select_materials: `Ты - инженер-технолог по подбору материалов для промышленных термочехлов KORDA.
Задача — подобрать подходящие материалы (Ткань, Наполнитель, Фурнитура/Нитки) на основе базы материалов и спецификации.

КРИТИЧЕСКИ ВАЖНОЕ ПРАВИЛО: Подобрать материалы для ВСЕХ строк спецификации.

Формат: { "id": число, "materials": { "outer": "марка", "outer_price": число, "inner": "марка", "inner_price": число, "insulation": "марка", "insulation_price": число, "thread_price": число } }

Используются: база материалов из Google Sheets + данные от generate_tu_name.
Модель: gemini-3.1-pro-preview | maxOutputTokens: 16384 | Батчинг: по 20 позиций`,

    resolve_parameters: `🆕 ИИ-агент (Gemini Pro). Читает ПРАВИЛА из Firebase.

Задача: Для каждой позиции в masterJson определить параметры расчёта на основе правил конвейера. Правила загружаются сервером из Firestore.

Формат выхода:
{
  "id": число,
  "pricing": {
    "work_rate_sewing": 1000,      ← из правила «Расход на пошив» (₽/м²)
    "work_rate_stuffing": 1000,    ← из правила «Набивка» (₽/м²), 0 для КЗХ
    "sketch_cost": 350,            ← из правила «Стоимость эскиза» (₽)
    "thread_price_per_meter": 12.5,← из прайса или правила «Нити»
    "allowance_factor": 1.3,       ← из правила «Набивка»/«Покрывной слой»
    "markup_materials": 0.40,      ← из правила «Материалы» (40%)
    "markup_work_base": 1.00,      ← из правила «Работы» (100% при ≤2м²)
    "markup_work_2m": 1.50,        ← 150% при 2-4м²
    "markup_work_4m": 2.00,        ← 200% при >4м²
    "vat_rate": 0.22,              ← из правила «НДС 22%»
    "is_kzh": false                ← true если КЗХ (1 слой, без набивки)
  }
}

Модель: gemini-3.1-pro-preview | responseMimeType: application/json | Батчинг: по 20`,

    resolve_dimensions: `🆕 ИИ-агент (Gemini 3.5 Flash + Google Search Grounding).

Задача: для каждой позиции найти реальные габаритные размеры оборудования:
• Строительная длина L (мм), Строительная высота H (мм), Масса (кг)

Источники (приоритет):
1. Кэш Firestore (equipment_dimensions) — мгновенно
2. Google Search Grounding — поиск по сайтам (~20с)
3. Знания модели (flash-lite) — типовые по ГОСТ (~5с)
4. DN fallback — грубая эмпирика

Модель: gemini-3.5-flash | Параллельность: 3 потока`,

    calculate_geometry: `Детерминированный агент (без ИИ). Использует размеры из resolve_dimensions.

Формула (цилиндр): π × D × L + 2 × π × r²
  D = H_mm × h_coefficient (корпус без маховика)
Формула (куб): 2(LH + LW + HW), W ≈ H

• h_coefficient — из coverage_coefficients (вкладка «Коэффициенты»)
• area_with_allowance = area × allowance_factor

Fallback: area = DN × 0.008 м²`,

    calculate_cost: `Детерминированный агент (без ИИ). Все ставки берутся из item.pricing (resolve_parameters).

Формулы:
• materials_total = area_with_allowance × (outer + inner + insulation)
  ↳ Для КЗХ: insulation_price = 0
• sewing_total = area × pricing.work_rate_sewing (из правила «Швея»)
• stuffing_total = area × pricing.work_rate_stuffing (из правила «Набивщик», 0 для КЗХ)
• thread_total = area × 6 × pricing.thread_price_per_meter
• cost_1_pcs = materials + sewing + stuffing + thread
• sketch_cost = pricing.sketch_cost (из правила «Стоимость эскиза»)

Наценка (раздельная):
• Отпускная материалы = materials × (1 + markup_materials) [40%]
• Отпускная работы = work × (1 + markup_work) [100%/150%/200% по площади]
• row_total_with_vat = (price_1_pcs × qty + sketch) × (1 + vat_rate)`,

    calculate_commercial: `Детерминированный агент (без ИИ). Агрегирует итоги из masterJson.

Вычисляет:
- Общая площадь, кол-во позиций
- Сводка по статьям: материалы, пошив, набивка, нитки, эскизы
- ОБЩАЯ СЕБЕСТОИМОСТЬ и ОТПУСКНАЯ ЦЕНА

Формирует инструкцию для Синтезатора:
ТЕКСТ 1: Внутренний отчёт (формулы + пример на первой позиции)
---SPLIT---
ТЕКСТ 2: Сопроводительное письмо клиенту`
};

// Type for the Category Tree
type CategoryNode = ConveyorRuleCategory & { children: CategoryNode[] };

function buildCategoryTree(categories: ConveyorRuleCategory[], parentId: string | null = null): CategoryNode[] {
    return categories
        .filter(c => c.parentId === parentId)
        .map(c => ({
            ...c,
            children: buildCategoryTree(categories, c.id)
        }));
}

export const AdminConveyorSettings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'categories' | 'rules' | 'prompts' | 'agents'>('categories');
    
    // Prompts state
    const [prompts, setPrompts] = useState({
        conveyor: ''
    });
    
    // Categories State
    const [categories, setCategories] = useState<ConveyorRuleCategory[]>([]);
    const [editCategoryModal, setCategoryModal] = useState<ConveyorRuleCategory | null>(null);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    
    // Rules State
    const [rules, setRules] = useState<ConveyorRule[]>([]);
    const [editRuleModal, setEditRuleModal] = useState<ConveyorRule | null>(null);
    const [isCreatingRule, setIsCreatingRule] = useState(false);
    
    // Rule Filtering
    const [selectedFilterCategoryId, setSelectedFilterCategoryId] = useState<string | null>(null);

    // Agent Tools State
    const [agentTools, setAgentTools] = useState<AgentTool[]>([]);
    const [editToolModal, setEditToolModal] = useState<AgentTool | null>(null);

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setIsLoading(true);
        if (activeTab === 'categories' || activeTab === 'rules') {
            const [catData, rulesData] = await Promise.all([
                getConveyorRuleCategories(),
                getConveyorRules()
            ]);
            setCategories(catData);
            setRules(rulesData.sort((a, b) => b.priority - a.priority));
        } else if (activeTab === 'prompts') {
            const data = getModePrompts();
            setPrompts({
                conveyor: data.conveyor || DEFAULT_CONVEYOR_PROMPT
            });
        } else if (activeTab === 'agents') {
            const toolsData = await getAgentTools();
            // Create default tool if empty for demonstration
            if (toolsData.length === 0) {
                const defaultTool: AgentTool = {
                    id: crypto.randomUUID(),
                    name: 'calculate_geometry',
                    description: 'Используйте этот инструмент, когда нужно рассчитать точную площадь термочехла. Передайте диаметр и длину.',
                    isActive: true,
                    createdAt: Date.now()
                };
                await saveAgentTool(defaultTool);
                setAgentTools([defaultTool]);
            } else {
                setAgentTools(toolsData);
            }
        }
        setIsLoading(false);
    };

    const handleSavePrompts = () => {
        const fullPrompts = getModePrompts();
        saveModePrompts({
            ...fullPrompts,
            conveyor: prompts.conveyor
        });
        alert('Базовый промпт сохранён!');
    };

    const handleRestoreBasePrompts = () => {
        if (!confirm('Вы уверены, что хотите вернуть базовые настройки KORDA? Текущие изменения будут удалены.')) return;
        setPrompts({
            conveyor: DEFAULT_CONVEYOR_PROMPT
        });
        const fullPrompts = getModePrompts();
        saveModePrompts({
            ...fullPrompts,
            conveyor: DEFAULT_CONVEYOR_PROMPT
        });
    };

    // --- CATEGORY HANDLERS ---
    const handleDeleteCategory = async (id: string, name: string) => {
        // Проверяем, есть ли вложенные категории
        const hasChildren = categories.some(c => c.parentId === id);
        if (hasChildren) {
            alert(`Сначала удалите или переместите все подразделы внутри "${name}".`);
            return;
        }

        // Проверяем, есть ли правила в этой категории
        const rulesData = await getConveyorRules();
        const hasRules = rulesData.some(r => r.categoryId === id);
        if (hasRules) {
            alert(`В этой категории есть привязанные правила. Сначала удалите их или перенесите в другой раздел.`);
            return;
        }

        if (!window.confirm(`Вы точно хотите удалить раздел "${name}"?`)) return;
        await deleteConveyorRuleCategory(id);
        setCategories(prev => prev.filter(c => c.id !== id));
    };

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editCategoryModal) return;

        // Предотвращение циклических ссылок
        if (editCategoryModal.parentId === editCategoryModal.id && editCategoryModal.id) {
            alert("Категория не может быть родительской для самой себя.");
            return;
        }

        const categoryToSave = {
            ...editCategoryModal,
            id: editCategoryModal.id || crypto.randomUUID(),
        };

        await saveConveyorRuleCategory(categoryToSave);
        
        if (isCreatingCategory) {
            setCategories(prev => [...prev, categoryToSave]);
        } else {
            setCategories(prev => prev.map(c => c.id === categoryToSave.id ? categoryToSave : c));
        }

        setCategoryModal(null);
        setIsCreatingCategory(false);
    };

    // --- RULES HANDLERS ---
    const handleDeleteRule = async (id: string, name: string) => {
        if (!window.confirm(`Вы точно хотите удалить правило "${name}"?`)) return;
        await deleteConveyorRule(id);
        setRules(prev => prev.filter(r => r.id !== id));
    };

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editRuleModal) return;

        const ruleToSave = {
            ...editRuleModal,
            id: editRuleModal.id || crypto.randomUUID(),
            priority: Number(editRuleModal.priority)
        };

        // Remove categoryId if it's explicitly set to an empty string to keep data clean
        if (ruleToSave.categoryId === '') {
            delete ruleToSave.categoryId;
        }

        await saveConveyorRule(ruleToSave);
        
        if (isCreatingRule) {
            setRules(prev => [...prev, ruleToSave].sort((a, b) => b.priority - a.priority));
        } else {
            setRules(prev => prev.map(r => r.id === ruleToSave.id ? ruleToSave : r).sort((a, b) => b.priority - a.priority));
        }

        setEditRuleModal(null);
        setIsCreatingRule(false);
    };

    // UI Helpers
    const categoryTree = buildCategoryTree(categories);

    const getCategoryName = (id?: string) => {
        if (!id) return 'Без раздела';
        const cat = categories.find(c => c.id === id);
        return cat ? cat.name : 'Неизвестный раздел';
    };

    const getCategoryPath = (categoryId?: string): string => {
        if (!categoryId) return 'Общее (Без раздела)';
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return 'Неизвестный раздел';
        if (!cat.parentId) return cat.name;
        return `${getCategoryPath(cat.parentId)} / ${cat.name}`;
    };



    // Recursive component to render Category Tree Options for <select>
    const renderCategorySelectOptions = (nodes: CategoryNode[], depth = 0, excludeId?: string): React.ReactNode[] => {
        let options: React.ReactNode[] = [];
        for (const node of nodes) {
            if (node.id === excludeId) continue;
            options.push(
                <option key={node.id} value={node.id}>
                    {'\u00A0'.repeat(depth * 4)} {depth > 0 ? '└ ' : ''}{node.name}
                </option>
            );
            if (node.children.length > 0) {
                options = options.concat(renderCategorySelectOptions(node.children, depth + 1, excludeId));
            }
        }
        return options;
    };

    // Recursive component to render Category Tree list
    const CategoryListNode: React.FC<{ node: CategoryNode, depth?: number }> = ({ node, depth = 0 }) => (
        <div className="flex flex-col w-full border-l border-slate-200" style={{ paddingLeft: depth === 0 ? 0 : '16px', marginLeft: depth === 0 ? 0 : '8px' }}>
            <div className="flex items-center justify-between py-2.5 px-4 bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-xl transition-all group my-1">
                <div className="flex items-center gap-3">
                    {depth > 0 ? <CornerDownRight className="text-slate-300" size={16} /> : <FolderOpen className="text-indigo-400" size={18} />}
                    <span className="font-semibold text-slate-800">{node.name}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => {
                            setCategoryModal({ id: '', name: '', parentId: node.id });
                            setIsCreatingCategory(true);
                        }}
                        className="text-xs font-semibold px-2 py-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800 rounded-md transition-colors mr-2"
                    >
                        + Подраздел
                    </button>
                    <button onClick={() => { setCategoryModal(node); setIsCreatingCategory(false); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                    <button onClick={() => handleDeleteCategory(node.id, node.name)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                </div>
            </div>
            {node.children.length > 0 && (
                <div className="flex flex-col w-full pl-2">
                    {node.children.map(child => <CategoryListNode key={child.id} node={child} depth={depth + 1} />)}
                </div>
            )}
        </div>
    );

    // Recursive component to render Sidebar filter list
    const SidebarCategoryNode: React.FC<{ node: CategoryNode, depth?: number }> = ({ node, depth = 0 }) => {
        const rulesInCat = rules.filter(r => r.categoryId === node.id).length;
        const isSelected = selectedFilterCategoryId === node.id;
        return (
            <div className="flex flex-col gap-0.5">
                <button
                    onClick={() => setSelectedFilterCategoryId(node.id)}
                    className={`flex items-center gap-2 py-1.5 pr-2 text-sm font-medium rounded-lg transition-colors text-left ${
                        isSelected
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                    style={{ paddingLeft: `${12 + depth * 16}px` }}
                >
                    {depth > 0 ? <CornerDownRight size={12} className={isSelected ? 'text-sky-400' : 'text-slate-300'} /> : <FolderOpen size={14} className={isSelected ? 'text-sky-500' : 'text-slate-400'} />}
                    <span className="truncate flex-1">{node.name}</span>

                    {rulesInCat > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-sky-200 text-sky-800' : 'bg-slate-200 text-slate-500'}`}>{rulesInCat}</span>}
                </button>
                {node.children.length > 0 && (
                    <div className="flex flex-col mt-0.5">
                        {node.children.map(child => <SidebarCategoryNode key={child.id} node={child} depth={depth + 1} />)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            {/* Tabs Header */}
            <div className="flex border-b border-slate-200 bg-slate-50 overflow-x-auto shrink-0">
                <button
                    onClick={() => setActiveTab('categories')}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'categories' ? 'border-sky-500 text-sky-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <FolderTree size={18} /> Разделы
                </button>
                <button
                    onClick={() => setActiveTab('rules')}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'rules' ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <BookOpen size={18} /> Правила Конвейера
                </button>
                <button
                    onClick={() => setActiveTab('prompts')}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'prompts' ? 'border-amber-500 text-amber-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <AlertTriangle size={18} /> Базовые промпты
                </button>
                <button
                    onClick={() => setActiveTab('agents')}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-colors ${
                        activeTab === 'agents' ? 'border-emerald-500 text-emerald-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Bot size={18} /> Зал Агентов
                </button>

            </div>

            {activeTab !== 'prompts' && (
                <div className="p-6 border-b border-slate-100 flex justify-between items-start sm:items-center flex-col sm:flex-row gap-4 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            {activeTab === 'categories' ? (
                                <><FolderTree className="text-sky-500" size={24} /> Структура разделов</>
                            ) : (
                                <><BookOpen className="text-indigo-500" size={24} /> Правила логики ИИ</>
                            )}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {activeTab === 'categories' 
                                ? 'Создавайте папки и подпапки (категории) для удобной группировки правил Конвейера.'
                                : activeTab === 'agents' 
                                ? 'Управление инструментами (Function Calling), доступными ИИ для выполнения точных расчетов и сбора данных.'
                                : 'Текстовые правила и инструкции для ИИ. Правила с приоритетом 10 ИИ выполняет строже всего.'}
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {activeTab !== 'agents' && (
                            <Button onClick={() => {
                                if (activeTab === 'categories') {
                                    setIsCreatingCategory(true);
                                    setCategoryModal({ id: '', name: '', parentId: null });
                                } else {
                                    setIsCreatingRule(true);
                                    setEditRuleModal({ id: '', name: '', content: '', priority: 5, categoryId: selectedFilterCategoryId || undefined });
                                }
                            }}>
                                <Plus size={16} className="mr-2" /> 
                                {activeTab === 'categories' ? 'Главный раздел' : 'Новое правило'}
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-hidden min-h-[400px]">
                {isLoading ? (
                    <div className="text-center py-10 text-slate-400">Загрузка данных...</div>
                ) : activeTab === 'categories' ? (
                    // CATEGORIES TREE TAB
                    <div className="p-6 overflow-y-auto h-full space-y-2 custom-scrollbar">
                        {categories.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                У вас пока нет разделов. Нажмите "Главный раздел", чтобы начать структурировать правила.
                            </div>
                        ) : (
                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                {categoryTree.map(node => (
                                    <CategoryListNode key={node.id} node={node} />
                                ))}
                            </div>
                        )}
                    </div>
                ) : activeTab === 'prompts' ? (
                    // PROMPTS TAB
                    <div className="p-6 h-full overflow-y-auto custom-scrollbar flex justify-center">
                        <div className="w-full max-w-4xl space-y-6">
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3 text-amber-900 text-sm">
                                <AlertTriangle size={20} className="shrink-0 text-amber-500 mt-0.5" />
                                <div>
                                    <p className="font-bold mb-1">Базовые инструкции Конвейера</p>
                                    <p>Эти промпты определяют поведение ИИ на разных этапах. Они загружаются в систему <b>до</b> всех пользовательских правил из разделов.</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="font-bold text-slate-800 mb-2">Промпт конвейера (НейроРасчёт)</h3>
                                    <textarea 
                                        rows={14}
                                        value={prompts.conveyor}
                                        onChange={e => setPrompts(p => ({ ...p, conveyor: e.target.value }))}
                                        className="w-full bg-white border border-slate-300 rounded-xl p-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none custom-scrollbar resize-y"
                                    />
                                </div>
                                
                                <div className="flex gap-4 justify-between pt-6 border-t border-slate-100">
                                    <button onClick={handleRestoreBasePrompts} className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-rose-500 transition-colors">
                                        <RotateCcw size={16} /> Вернуть к начальным алгоритмам "KORDA"
                                    </button>
                                    <Button onClick={handleSavePrompts} className="bg-amber-500 hover:bg-amber-600 border-none text-white px-8 py-2.5">
                                        Сохранить изменения
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'agents' ? (
                    // AGENTS TAB
                    <div className="p-6 overflow-y-auto h-full bg-slate-50/50 custom-scrollbar">
                        {/* Pipeline Architecture Info */}
                        <div className="max-w-6xl mx-auto mb-8 bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
                            <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-200 flex items-center gap-2">
                                <CheckCircle size={16} className="text-emerald-500" />
                                <h3 className="font-bold text-emerald-800 text-sm">Параметры расчёта берутся из правил</h3>
                                <span className="ml-auto text-[10px] font-mono text-emerald-500 bg-emerald-100 px-2 py-0.5 rounded">v0.9.75 — гибридная архитектура</span>
                            </div>
                            <div className="p-4 text-sm text-slate-600 space-y-2">
                                <p>
                                    Агент <code className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-xs">resolve_parameters</code> читает <strong>Правила Конвейера</strong> из Firebase 
                                    и извлекает ставки для каждой позиции (эскиз, пошив, набивка, наценки, НДС).
                                </p>
                                <p>
                                    Детерминированные агенты (<code className="text-xs font-mono text-slate-500">calculate_geometry</code>, <code className="text-xs font-mono text-slate-500">calculate_cost</code>, <code className="text-xs font-mono text-slate-500">calculate_commercial</code>) 
                                    используют эти ставки вместо хардкода. Чтобы изменить ставку — отредактируйте правило во вкладке <strong>«Правила Конвейера»</strong>.
                                </p>
                            </div>
                        </div>

                        {/* Agent Cards */}
                        <div className="grid grid-cols-1 gap-6 max-w-6xl mx-auto">
                            {agentTools.map(tool => {
                                const embeddedPrompt = AGENT_EMBEDDED_PROMPTS[tool.name] || null;
                                return (
                                <div key={tool.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:border-emerald-200 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${tool.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <Bot size={24} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg">
                                                    {tool.name === 'generate_tu_name' ? 'Агент: Наименование ТУ' : 
                                                     tool.name === 'resolve_dimensions' ? '📐 Агент: Габариты (Search)' :
                                                     tool.name === 'calculate_geometry' ? 'Агент: Геометрия' : 
                                                     tool.name === 'select_materials' ? 'Агент: Подбор материалов' : 
                                                     tool.name === 'resolve_parameters' ? 'Агент: Параметры из правил' :
                                                     tool.name === 'calculate_cost' ? 'Агент: Себестоимость' :
                                                     tool.name === 'calculate_commercial' ? 'Агент: Коммерческое предложение' :
                                                     tool.name}
                                                </h3>
                                                <span className="text-[10px] font-mono text-slate-400">{tool.name}</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={async () => {
                                                const updated = { ...tool, isActive: !tool.isActive };
                                                await saveAgentTool(updated);
                                                setAgentTools(prev => prev.map(t => t.id === tool.id ? updated : t));
                                            }}
                                            className={`p-2 rounded-full transition-colors flex items-center gap-2 text-sm font-bold ${tool.isActive ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            <Power size={16} />
                                            {tool.isActive ? 'Активен' : 'Отключен'}
                                        </button>
                                    </div>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-3">
                                        <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Инструкция для ИИ (Описание)</h4>
                                        <p className="text-sm text-slate-700 leading-relaxed">{tool.description}</p>
                                    </div>
                                    {embeddedPrompt && (
                                        <details className="bg-indigo-50/50 rounded-xl border border-indigo-100 overflow-hidden">
                                            <summary className="px-4 py-3 text-xs font-bold text-indigo-600 uppercase tracking-wider cursor-pointer hover:bg-indigo-50 transition-colors select-none">
                                                📜 Встроенный системный промпт (код)
                                            </summary>
                                            <pre className="px-4 py-3 text-[11px] text-slate-600 font-mono whitespace-pre-wrap leading-relaxed bg-white/50 border-t border-indigo-100 max-h-[400px] overflow-y-auto custom-scrollbar">
                                                {embeddedPrompt}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                                );
                            })}
                            {agentTools.length === 0 && (
                                <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                                    Нет доступных инструментов.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // RULES INTERFACE (SIDEBAR + GRID)
                    <div className="flex h-full">
                        {/* Rules Filter Sidebar */}
                        <div className="w-64 shrink-0 border-r border-slate-100 bg-slate-50/50 p-4 overflow-y-auto flex flex-col gap-2">
                            <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase mb-2 flex items-center gap-1">
                                <ListFilter size={12} /> Фильтр
                            </h3>
                            
                            <button
                                onClick={() => setSelectedFilterCategoryId(null)}
                                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left ${
                                    selectedFilterCategoryId === null
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                <BookOpen size={16} className={selectedFilterCategoryId === null ? 'text-indigo-500' : 'text-slate-400'} />
                                Все правила
                                <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${selectedFilterCategoryId === null ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-500'}`}>
                                    {rules.length}
                                </span>
                            </button>
                            
                            <hr className="border-slate-200 my-2" />
                            
                            <div className="flex flex-col gap-1 pr-2 custom-scrollbar overflow-y-auto">
                                {categoryTree.map(node => <SidebarCategoryNode key={node.id} node={node} />)}
                            </div>
                        </div>
                        
                        {/* Rules Grid */}
                        <div className="flex-1 p-6 overflow-y-auto bg-white custom-scrollbar">
                            {rules.filter(r => selectedFilterCategoryId === null || r.categoryId === selectedFilterCategoryId).length === 0 ? (
                                <div className="text-center py-20 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                    {selectedFilterCategoryId ? 'В этом разделе пока нет правил.' : 'Нет добавленных правил.'}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {rules
                                        .filter(r => selectedFilterCategoryId === null || r.categoryId === selectedFilterCategoryId)
                                        .map(r => (
                                        <div key={r.id} className="bg-indigo-50/30 p-5 rounded-2xl border border-indigo-100 hover:border-indigo-300 transition-colors group flex flex-col sm:flex-row gap-5 hover:shadow-sm">
                                            <div className="shrink-0 flex sm:flex-col items-center sm:items-start gap-2 sm:gap-1 w-24">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Приоритет</span>
                                                <div className={`text-3xl font-black ${
                                                    r.priority >= 9 ? 'text-rose-500' :
                                                    r.priority >= 6 ? 'text-indigo-500' : 'text-slate-400'
                                                }`}>
                                                    {r.priority}<span className="text-sm text-slate-300">/10</span>
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{r.name}</h3>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md inline-flex max-w-full">
                                                                <FolderOpen size={12} className="shrink-0" />
                                                                <span className="truncate">{getCategoryPath(r.categoryId)}</span>
                                                            </div>

                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-4 bg-white/50 backdrop-blur rounded-lg p-1">
                                                        <button onClick={() => { setEditRuleModal(r); setIsCreatingRule(false); }} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-md shadow-sm transition-all"><Edit2 size={16} /></button>
                                                        <button onClick={() => handleDeleteRule(r.id, r.name)} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-white rounded-md shadow-sm transition-all"><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-slate-600 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-100">{r.content}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* CATEGORY MODAL */}
            {editCategoryModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
                            {isCreatingCategory ? <><FolderOpen className="text-sky-500" /> Новый раздел</> : "Редактирование"}
                        </h3>
                        <form onSubmit={handleSaveCategory} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Название раздела</label>
                                <input type="text" required placeholder="Например: Швейные расчеты" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium" value={editCategoryModal.name} onChange={e => setCategoryModal({ ...editCategoryModal, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Родительский раздел (куда вложить)</label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-sky-500 transition-all text-slate-700 font-medium cursor-pointer" 
                                    value={editCategoryModal.parentId || ''} 
                                    onChange={e => setCategoryModal({ ...editCategoryModal, parentId: e.target.value || null })}
                                >
                                    <option value="" className="font-bold">-- Корневой раздел (Без родителя) --</option>
                                    {renderCategorySelectOptions(categoryTree, 0, editCategoryModal.id)}
                                </select>
                            </div>

                            
                            <div className="flex gap-3 justify-end pt-2">
                                <Button type="button" variant="ghost" onClick={() => setCategoryModal(null)}>Отмена</Button>
                                <Button type="submit" className="bg-sky-600 hover:bg-sky-700 border-none">Сохранить</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* RULE MODAL */}
            {editRuleModal && (
                <div className="fixed inset-0 bg-slate-900/40 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-5">{isCreatingRule ? "Новое правило" : "Редактирование правила"}</h3>
                        <form onSubmit={handleSaveRule} className="space-y-5">
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-3 items-start text-indigo-900 text-sm">
                                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-indigo-500" />
                                <p>Чем <b>выше приоритет (10)</b>, тем отчетливее ИИ понимает, что это закон. Правила с высоким приоритетом вставляются в самый конец контекста.</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Краткое название</label>
                                    <input type="text" required placeholder="Например: Обязательный припуск +5%" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" value={editRuleModal.name} onChange={e => setEditRuleModal({ ...editRuleModal, name: e.target.value })} />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Раздел (Где хранится правило)</label>
                                    <select 
                                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700 font-medium cursor-pointer" 
                                        value={editRuleModal.categoryId || ''} 
                                        onChange={e => setEditRuleModal({ ...editRuleModal, categoryId: e.target.value || undefined })}
                                    >
                                        <option value="">-- Без раздела (Общие) --</option>
                                        {renderCategorySelectOptions(categoryTree)}
                                    </select>
                                </div>
                                
                                <div className="col-span-2">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-sm font-bold text-slate-700">Приоритет: <span className="text-indigo-600 text-lg ml-1">{editRuleModal.priority}</span> <span className="text-slate-400 font-normal">из 10</span></label>
                                    </div>
                                    <input type="range" min="1" max="10" step="1" className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-full appearance-none" value={editRuleModal.priority} onChange={e => setEditRuleModal({ ...editRuleModal, priority: parseInt(e.target.value) })} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1.5">Текст правила (системный промпт)</label>
                                <textarea rows={6} required placeholder="Всегда прибавляй 5% к итоговому результату длины, независимо от других условий..." className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none custom-scrollbar text-sm" value={editRuleModal.content} onChange={e => setEditRuleModal({ ...editRuleModal, content: e.target.value })} />
                            </div>
                            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                                <Button type="button" variant="ghost" onClick={() => setEditRuleModal(null)}>Отмена</Button>
                                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white border-transparent py-2.5 px-6">Сохранить</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
