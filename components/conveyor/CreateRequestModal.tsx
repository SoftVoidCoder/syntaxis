import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Link, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../Button';
import { getSystemSettings } from '../../services/firebaseService';
import { parseDealIdFromUrl, fetchDealContext, BitrixDealContext } from '../../utils/bitrixDealFetcher';

interface CreateRequestModalProps {
    onClose: () => void;
    onCreate: (title: string, clientDescription: string, bitrixDealUrl?: string, bitrixDealId?: string, bitrixContext?: string, orderNumber?: string, orgName?: string) => void;
}

type DealStatus = 'idle' | 'loading' | 'success' | 'error';

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({ onClose, onCreate }) => {
    const [title, setTitle] = useState('');
    const [dealUrl, setDealUrl] = useState('');
    const [dealStatus, setDealStatus] = useState<DealStatus>('idle');
    const [dealContext, setDealContext] = useState<BitrixDealContext | null>(null);
    const [dealError, setDealError] = useState('');
    const [description, setDescription] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [orgName, setOrgName] = useState('');
    const dealFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-fetch deal when URL changes (debounced)
    useEffect(() => {
        if (dealFetchTimeoutRef.current) clearTimeout(dealFetchTimeoutRef.current);
        setDealContext(null);
        setDealError('');

        const dealId = parseDealIdFromUrl(dealUrl);
        if (!dealId) {
            setDealStatus('idle');
            return;
        }

        setDealStatus('loading');
        dealFetchTimeoutRef.current = setTimeout(async () => {
            try {
                const settings = await getSystemSettings();
                const systemWebhook = settings?.bitrixWebhook;
                if (!systemWebhook) {
                    setDealError('Системный вебхук Bitrix не настроен (Админ → Настройки ИИ)');
                    setDealStatus('error');
                    return;
                }

                const ctx = await fetchDealContext(systemWebhook, dealId);
                setDealContext(ctx);
                setTitle(ctx.title);
                setOrgName(ctx.companyName || '');
                setDealStatus('success');
            } catch (err: any) {
                setDealError(err.message || 'Ошибка загрузки сделки');
                setDealStatus('error');
            }
        }, 800);

        return () => { if (dealFetchTimeoutRef.current) clearTimeout(dealFetchTimeoutRef.current); };
    }, [dealUrl]);

    const handleSubmit = () => {
        const finalTitle = title.trim() || `Заявка от ${new Date().toLocaleDateString()}`;
        onCreate(
            finalTitle,
            description.trim(),
            dealUrl.trim() || undefined,
            dealContext?.dealId || parseDealIdFromUrl(dealUrl) || undefined,
            dealContext?.summary || undefined,
            orderNumber.trim() || undefined,
            orgName.trim() || undefined
        );
    };

    const hasDealUrl = dealUrl.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Plus size={20} className="text-emerald-500" /> Новая заявка
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[65vh]">

                    {/* Bitrix Deal Link */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <Link size={14} className="text-blue-500" /> Ссылка на сделку в Bitrix (необязательно)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={dealUrl}
                                onChange={e => setDealUrl(e.target.value)}
                                placeholder="https://gruppakorda.bitrix24.ru/crm/deal/details/12345/"
                                className={`w-full bg-slate-50 border rounded-xl px-4 py-3 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent placeholder-slate-400 text-sm ${
                                    dealStatus === 'success' ? 'border-emerald-300 focus:ring-emerald-400' :
                                    dealStatus === 'error' ? 'border-rose-300 focus:ring-rose-400' :
                                    'border-slate-200 focus:ring-emerald-400'
                                }`}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {dealStatus === 'loading' && <Loader2 size={18} className="text-blue-500 animate-spin" />}
                                {dealStatus === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
                                {dealStatus === 'error' && <AlertCircle size={18} className="text-rose-500" />}
                            </div>
                        </div>

                        {dealStatus === 'success' && dealContext && (
                            <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                                <p className="font-semibold text-emerald-700">✅ {dealContext.title}</p>
                                <p className="text-emerald-600 text-xs mt-1">
                                    {dealContext.companyName && `${dealContext.companyName} | `}
                                    {dealContext.emails.length} писем, {dealContext.calls.length} звонков
                                    {dealContext.companyInn ? ` | ИНН: ${dealContext.companyInn}` : ''}
                                </p>
                            </div>
                        )}
                        {dealStatus === 'error' && (
                            <p className="mt-1.5 text-xs text-rose-500">{dealError}</p>
                        )}
                        {hasDealUrl && !parseDealIdFromUrl(dealUrl) && dealStatus === 'idle' && (
                            <p className="mt-1.5 text-xs text-amber-500">⚠️ Не удаётся распознать ID сделки. Формат: /crm/deal/details/ID/</p>
                        )}
                    </div>

                    {/* Order Number */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Номер коммерческого предложения
                        </label>
                        <input
                            type="text"
                            value={orderNumber}
                            onChange={e => setOrderNumber(e.target.value)}
                            placeholder="Например: КП-2026-0142"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-slate-400 text-sm"
                        />
                    </div>

                    {/* Organization Name */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Название организации
                            {dealContext && orgName && <span className="text-emerald-500 font-normal ml-2">(из сделки)</span>}
                        </label>
                        <input
                            type="text"
                            value={orgName}
                            onChange={e => setOrgName(e.target.value)}
                            placeholder="Например: ООО Газпром Нефть"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-slate-400 text-sm"
                        />
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Название заявки
                            {dealContext && <span className="text-emerald-500 font-normal ml-2">(из сделки)</span>}
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={dealContext ? '' : "Например: Расчет термочехлов — 76 позиций"}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent placeholder-slate-400 text-sm"
                            readOnly={!!dealContext}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Отмена</Button>
                    <Button
                        onClick={handleSubmit}
                        className="bg-emerald-500 hover:bg-emerald-400 border-none shadow-md text-white font-bold px-6"
                        disabled={dealStatus === 'loading'}
                    >
                        Создать заявку
                    </Button>
                </div>
            </div>
        </div>
    );
};
