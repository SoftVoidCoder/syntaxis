import React from 'react';
import { Building2, Calendar, FileText, Bookmark, BookmarkX, UserCheck } from 'lucide-react';
import { SharedTenderScore, TenderFavorite, TenderWorkflowStatus } from '../../types';

interface TendersTableProps {
    tenders: any[];
    isLoading: boolean;
    onRowClick: (tender: any) => void;
    savedTenders?: string[];
    onToggleSave?: (id: string, isSaved: boolean) => void;
    aiScores?: Record<string, SharedTenderScore>;
    sharedFavorites?: TenderFavorite[];
    statusLabels?: Record<string, { label: string, color: string }>;
    canRemoveFavorite?: boolean; // only managers can remove
    canPermanentlyRemove?: boolean; // only admin/director can permanently delete
}

export const TendersTable: React.FC<TendersTableProps> = ({
    tenders, isLoading, onRowClick, savedTenders = [], onToggleSave,
    aiScores = {}, sharedFavorites = [], statusLabels = {},
    canRemoveFavorite = false, canPermanentlyRemove = false
}) => {
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ApplicationSubmission':
                return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 rounded-full whitespace-nowrap">Подача</span>;
            case 'CommissionWork':
                return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded-full whitespace-nowrap">Комиссия</span>;
            case 'Completed':
                return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded-full whitespace-nowrap">Завершена</span>;
            default:
                return <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded-full whitespace-nowrap">{status}</span>;
        }
    };

    const renderDaysLeft = (endDateStr: string) => {
        if (!endDateStr) return null;
        
        const endDate = new Date(endDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const targetDate = new Date(endDate);
        targetDate.setHours(0, 0, 0, 0);
        
        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) {
            return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white ml-2 whitespace-nowrap">0 дней</span>;
        } else if (diffDays <= 5) {
            return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 ml-2 whitespace-nowrap">{diffDays} дн.</span>;
        } else if (diffDays <= 10) {
            return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 ml-2 whitespace-nowrap">{diffDays} дн.</span>;
        } else {
            return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 ml-2 whitespace-nowrap">{diffDays} дн.</span>;
        }
    };

    const renderAiScore = (scoreInfo?: SharedTenderScore) => {
        if (!scoreInfo) return <span className="text-slate-300 text-xs">—</span>;

        let colorClass = 'text-slate-400';
        if (scoreInfo.score === 1) colorClass = 'text-slate-800';
        else if (scoreInfo.score === 2) colorClass = 'text-red-500';
        else if (scoreInfo.score === 3) colorClass = 'text-orange-500';
        else if (scoreInfo.score >= 4) colorClass = 'text-yellow-500';

        const stars = '★'.repeat(scoreInfo.score) + '☆'.repeat(5 - scoreInfo.score);

        return (
            <div className="flex flex-col items-center" title={scoreInfo.reason}>
                <div className={`text-sm tracking-wider ${colorClass}`}>
                    {stars}
                </div>
            </div>
        );
    };

    const getFavoriteInfo = (tenderId: string): TenderFavorite | undefined => {
        return sharedFavorites.find(f => f.tenderId === tenderId);
    };

    const renderWorkflowBadge = (favInfo?: TenderFavorite) => {
        if (!favInfo?.workflowStatus) return null;
        const info = statusLabels[favInfo.workflowStatus];
        if (!info) return null;
        return (
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${info.color}`}>
                {info.label}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-korda-600"></div>
            </div>
        );
    }

    if (!tenders || tenders.length === 0) {
        return (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                <p className="text-slate-500 mb-4">Тендеры не найдены. Попробуйте изменить фильтры.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse relative text-sm">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider">
                            <th className="px-3 py-3 font-medium">Объект закупки</th>
                            <th className="px-3 py-3 font-medium">Заказчик</th>
                            <th className="px-3 py-3 font-medium">НМЦК</th>
                            <th className="px-3 py-3 font-medium">Стадия</th>
                            <th className="px-3 py-3 font-medium">Срок</th>
                            <th className="px-3 py-3 font-medium text-center">ИИ</th>
                            <th className="px-3 py-3 font-medium">Работа</th>
                            <th className="px-2 py-3 font-medium w-10 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tenders.map((tender) => {
                            const favInfo = getFavoriteInfo(tender.id);
                            const isSaved = savedTenders.includes(tender.id);
                            return (
                                <tr
                                    key={tender.id}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => onRowClick(tender)}
                                >
                                    <td className="px-3 py-2.5 max-w-[220px]">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="font-mono text-[10px] text-slate-400">{tender.purchaseNumber}</span>
                                            {tender.sourceLabel && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[9px] font-semibold">{tender.sourceLabel}</span>}
                                        </div>
                                        <div className="font-medium text-slate-800 text-xs line-clamp-2 leading-tight" title={tender.name}>{tender.name}</div>
                                    </td>
                                    <td className="px-3 py-2.5 max-w-[160px]">
                                        <div className="text-xs text-slate-700 line-clamp-1" title={tender.customer?.fullName}>{tender.customer?.fullName}</div>
                                        <div className="text-[10px] text-slate-400 font-mono">{tender.customer?.inn}</div>
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        <div className="font-bold text-slate-800 text-xs">
                                            {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(tender.price || 0)}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        {getStatusBadge(tender.status)}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <span className="text-xs text-slate-600">
                                                {tender.applicationEndDate ? new Date(tender.applicationEndDate).toLocaleDateString('ru-RU') : 'Не указан'}
                                            </span>
                                            {renderDaysLeft(tender.applicationEndDate)}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {renderAiScore(aiScores[tender.id])}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        {favInfo ? (
                                            <div className="flex flex-col gap-0.5">
                                                {renderWorkflowBadge(favInfo)}
                                                <span className="text-[10px] text-slate-400 leading-tight" title={`Добавил: ${favInfo.addedByName}`}>
                                                    + {favInfo.addedByName?.split(' ')[0]}
                                                </span>
                                                {favInfo.assignedToName && (
                                                    <span className="flex items-center gap-0.5 text-[10px] text-korda-600 font-medium leading-tight">
                                                        <UserCheck size={10} />
                                                        {favInfo.assignedToName?.split(' ')[0]}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-2.5 text-center">
                                        {isSaved ? (
                                            // Show different states for the bookmark
                                            favInfo?.markedForRemoval ? (
                                                // Red flag — marked for removal by SUPERVISOR
                                                canPermanentlyRemove ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); if (onToggleSave) onToggleSave(tender.id, false); }}
                                                        className="p-1.5 rounded-lg transition-colors focus:outline-none bg-red-100 text-red-500 hover:bg-red-200 animate-pulse"
                                                        title="Отмечен на удаление — нажмите для удаления/восстановления"
                                                    >
                                                        <Bookmark size={16} className="fill-current" />
                                                    </button>
                                                ) : (
                                                    <div className="p-1.5 rounded-lg bg-red-100 text-red-500 cursor-default" title="Отмечен на удаление (ожидает подтверждения)">
                                                        <Bookmark size={16} className="fill-current" />
                                                    </div>
                                                )
                                            ) : canRemoveFavorite ? (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (onToggleSave) onToggleSave(tender.id, false); }}
                                                    className="p-1.5 rounded-lg transition-colors focus:outline-none bg-korda-100 text-korda-600 hover:bg-red-100 hover:text-red-500"
                                                    title="Убрать из работы"
                                                >
                                                    <Bookmark size={16} className="fill-current" />
                                                </button>
                                            ) : (
                                                <div className="p-1.5 rounded-lg bg-korda-100 text-korda-600 cursor-default" title="В работе (убрать может руководство)">
                                                    <Bookmark size={16} className="fill-current" />
                                                </div>
                                            )
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); if (onToggleSave) onToggleSave(tender.id, true); }}
                                                className="p-1.5 rounded-lg transition-colors focus:outline-none bg-slate-100 text-slate-400 hover:bg-slate-200"
                                                title="Взять в работу"
                                            >
                                                <Bookmark size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
