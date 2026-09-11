import React from 'react';
import { ConveyorRequest, ConveyorStatus, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Clock, CheckCircle, Send, RotateCcw, Play, Paperclip, AlertTriangle, Trash2, Sparkles } from 'lucide-react';
import { REJECTION_CATEGORY_LABELS } from './ReturnRequestModal';
import { formatTokenCost } from '../../utils/costUtils';

interface ConveyorKanbanProps {
    requests: ConveyorRequest[];
    onOpenRequest: (request: ConveyorRequest) => void;
    onTakeInWork: (request: ConveyorRequest) => void;
    onSendToVerification: (request: ConveyorRequest) => void;
    onDelete?: (requestId: string) => void;
}

interface KanbanColumn {
    id: ConveyorStatus;
    title: string;
    accent: string;
    badgeBg: string;
    headerBorder: string;
    /** IDs of statuses to include in this column (for merging REJECTED into NEW) */
    includeStatuses?: ConveyorStatus[];
}

const SHARED_COLUMNS: KanbanColumn[] = [
    { id: ConveyorStatus.NEW, title: 'Черновик', accent: 'text-slate-600', badgeBg: 'bg-slate-100 text-slate-700', headerBorder: 'border-slate-300', includeStatuses: [ConveyorStatus.NEW, ConveyorStatus.REJECTED] },
    { id: ConveyorStatus.PENDING_VERIFICATION, title: 'Верификация', accent: 'text-blue-600', badgeBg: 'bg-blue-100 text-blue-700', headerBorder: 'border-blue-400' },
    { id: ConveyorStatus.VERIFIED, title: 'КП Готово', accent: 'text-emerald-600', badgeBg: 'bg-emerald-100 text-emerald-700', headerBorder: 'border-emerald-400' },
    { id: ConveyorStatus.COMPLETED, title: 'Завершено', accent: 'text-violet-600', badgeBg: 'bg-violet-100 text-violet-700', headerBorder: 'border-violet-400' },
];

export const ConveyorKanban: React.FC<ConveyorKanbanProps> = ({ requests, onOpenRequest, onTakeInWork, onSendToVerification, onDelete }) => {
    const { user } = useAuth();
    const [showAllAdmin, setShowAllAdmin] = React.useState(true);
    const isConstructor = user?.role === UserRole.CONSTRUCTOR;
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.DIRECTOR || user?.role === UserRole.SUPERVISOR;

    const columns = SHARED_COLUMNS;

    // Filter requests based on role
    const visibleRequests = (isAdmin && showAllAdmin)
        ? requests
        : requests.filter(r =>
            r.managerId === user?.id ||
            r.constructorId === user?.id ||
            r.status === ConveyorStatus.PENDING_VERIFICATION
        );

    const renderCard = (req: ConveyorRequest, col: KanbanColumn) => {
        const isReadOnly = false;
        const canSendToVerify = (col.id === ConveyorStatus.NEW) && (req.status === ConveyorStatus.NEW || req.status === ConveyorStatus.REJECTED);
        const canTakeInWork = col.id === ConveyorStatus.PENDING_VERIFICATION && (user?.role === UserRole.CONSTRUCTOR || isAdmin);
        const canDelete = !!onDelete && (isAdmin || (req.managerId === user?.id && (req.status === ConveyorStatus.NEW || req.status === ConveyorStatus.REJECTED)));

        // Check if this request was returned (has revisions)
        const hasRevisions = req.revisions && req.revisions.length > 0;
        const lastRevision = hasRevisions ? req.revisions![req.revisions!.length - 1] : null;
        const isReturnedCard = hasRevisions && (req.status === ConveyorStatus.NEW || req.status === ConveyorStatus.REJECTED);
        const isResubmitted = hasRevisions && req.status === ConveyorStatus.PENDING_VERIFICATION;

        return (
            <div
                key={req.id}
                onClick={() => !isReadOnly && onOpenRequest(req)}
                className={`bg-white border rounded-xl p-3.5 shadow-sm transition-all group ${
                    isReturnedCard ? 'border-l-4 border-l-rose-400 border-slate-200' : 'border-slate-200'
                } ${
                    isReadOnly ? 'opacity-70 cursor-default' : 'hover:shadow-md hover:border-emerald-300 cursor-pointer hover:-translate-y-0.5'
                }`}
            >
                {/* Return badge */}
                {isReturnedCard && lastRevision && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold mb-2 bg-rose-50 -mx-3.5 -mt-3.5 px-3.5 py-2 rounded-t-lg border-b border-rose-100">
                        <AlertTriangle size={12} />
                        <span>↩ Возврат #{lastRevision.round}</span>
                    </div>
                )}

                {/* Resubmitted badge (for constructor in PENDING column) */}
                {isResubmitted && lastRevision && (
                    <div className="flex items-center gap-1.5 text-xs text-purple-600 font-semibold mb-2 bg-purple-50 -mx-3.5 -mt-3.5 px-3.5 py-2 rounded-t-lg border-b border-purple-100">
                        <RotateCcw size={12} />
                        <span>Ревизия #{lastRevision.round} — повторная</span>
                    </div>
                )}

                <div className="font-semibold text-slate-800 mb-1.5 line-clamp-2 text-sm group-hover:text-emerald-700 transition-colors">
                    {req.title}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <span>{req.managerName}</span>
                    {req.constructorName && (
                        <>
                            <span>→</span>
                            <span className="text-amber-600 font-medium">{req.constructorName}</span>
                        </>
                    )}
                </div>

                {req.attachments && req.attachments.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                        <Paperclip size={10} />
                        <span>{req.attachments.length} файл(ов)</span>
                    </div>
                )}

                {/* Last revision comment (truncated) */}
                {isReturnedCard && lastRevision && (
                    <div className="text-xs text-rose-600 mb-2 line-clamp-2 bg-rose-50/50 rounded-lg px-2 py-1.5 border border-rose-100">
                        «{lastRevision.comment}»
                    </div>
                )}

                {(req.reverificationCount || 0) > 0 && !isReturnedCard && (
                    <div className="flex items-center gap-1 text-xs text-purple-500 font-medium mb-2">
                        <RotateCcw size={10} />
                        <span>Ревизий: {req.reverificationCount}</span>
                    </div>
                )}

                <div className="flex justify-between items-center text-[10px] text-slate-400 mb-2">
                    <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                    {req.totalTokensUsed ? (
                        <span className="flex items-center gap-1 bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-mono border border-indigo-100" title={`Токенов использовано: ${req.totalTokensUsed.toLocaleString()}`}>
                            <Sparkles size={10} /> {formatTokenCost(req.totalTokensUsed)}
                        </span>
                    ) : null}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    {canDelete && (
                        <button
                            onClick={() => onDelete(req.id)}
                            className="flex items-center justify-center gap-1 text-xs font-semibold bg-red-50 text-red-500 border border-red-200 rounded-lg px-2 py-1.5 hover:bg-red-500 hover:text-white transition-colors"
                            title="Удалить заявку"
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold text-slate-800">Доска заявок</h2>
                {isAdmin && (
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => setShowAllAdmin(false)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${!showAllAdmin ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Мои заявки
                        </button>
                        <button
                            onClick={() => setShowAllAdmin(true)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${showAllAdmin ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Все заявки
                        </button>
                    </div>
                )}
            </div>
            <div className={`flex-1 grid gap-5 overflow-x-auto pb-4`} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))` }}>
                {columns.map(col => {
                    // Use includeStatuses to merge REJECTED into NEW column
                    const statusFilter = col.includeStatuses || [col.id];
                    const colRequests = visibleRequests.filter(r => statusFilter.includes(r.status));
                    return (
                        <div key={col.id} className="flex flex-col rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                            <div className={`px-4 py-3 border-b-2 ${col.headerBorder} flex justify-between items-center bg-white`}>
                                <h3 className={`font-bold text-sm ${col.accent}`}>
                                    {col.title}
                                </h3>
                                <span className={`${col.badgeBg} px-2 py-0.5 rounded-full text-xs font-bold`}>
                                    {colRequests.length}
                                </span>
                            </div>

                            <div className="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                {colRequests.length === 0 ? (
                                    <div className="h-20 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg text-slate-300 text-sm font-medium">
                                        Пусто
                                    </div>
                                ) : (
                                    colRequests.map(req => renderCard(req, col))
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
