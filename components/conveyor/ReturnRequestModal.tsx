import React, { useState } from 'react';
import { RejectionCategory } from '../../types';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '../Button';

interface ReturnRequestModalProps {
    onClose: () => void;
    onReturn: (category: RejectionCategory, comment: string) => void;
}

const CATEGORY_LABELS: Record<RejectionCategory, string> = {
    [RejectionCategory.CALCULATION_ERROR]: '🧮 Ошибка в расчёте',
    [RejectionCategory.MISSING_DATA]: '📄 Недостаточно данных',
    [RejectionCategory.PRICE_ERROR]: '💰 Некорректные цены',
    [RejectionCategory.WRONG_MATERIAL]: '🔧 Нужен другой материал',
    [RejectionCategory.INCORRECT_DIMENSIONS]: '📐 Неверные размеры/площади',
    [RejectionCategory.OTHER]: '❓ Другое',
};

export const REJECTION_CATEGORY_LABELS = CATEGORY_LABELS;

export const ReturnRequestModal: React.FC<ReturnRequestModalProps> = ({ onClose, onReturn }) => {
    const [category, setCategory] = useState<RejectionCategory | ''>('');
    const [comment, setComment] = useState('');

    const isValid = category !== '' && comment.trim().length >= 10;

    const handleSubmit = () => {
        if (!isValid) return;
        onReturn(category as RejectionCategory, comment.trim());
    };

    return (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50">
                    <h3 className="font-bold text-lg text-rose-700 flex items-center gap-2">
                        <RotateCcw size={20} /> Возврат менеджеру
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-rose-100 rounded-full text-rose-400 hover:text-rose-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Category */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Причина возврата <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value as RejectionCategory)}
                            className={`w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent appearance-none cursor-pointer ${
                                category ? 'text-slate-800 border-slate-200' : 'text-slate-400 border-slate-200'
                            }`}
                        >
                            <option value="" disabled>Выберите причину...</option>
                            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Comment */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                            Комментарий <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Опишите, что нужно исправить (минимум 10 символов)..."
                            rows={4}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent placeholder-slate-400 text-sm resize-none"
                        />
                        <div className="flex justify-end mt-1">
                            <span className={`text-xs ${comment.trim().length >= 10 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {comment.trim().length} / 10 мин.
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Отмена</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!isValid}
                        className="bg-rose-500 hover:bg-rose-400 border-none shadow-md text-white font-bold px-6 disabled:bg-slate-200 disabled:text-slate-400"
                    >
                        <RotateCcw size={14} className="mr-2" /> Вернуть менеджеру
                    </Button>
                </div>
            </div>
        </div>
    );
};
