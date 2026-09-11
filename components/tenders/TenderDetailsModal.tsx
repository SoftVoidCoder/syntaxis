import React, { useState, useEffect } from 'react';
import { X, Building2, Calendar, FileText, MapPin, ExternalLink, Loader2, UserCheck, Tag, MessageSquare, Send, HardHat } from 'lucide-react';
import { Button } from '../Button';
import { TenderFavorite, TenderWorkflowStatus, TenderComment, User } from '../../types';

interface TenderDetailsModalProps {
    tender: any;
    isOpen: boolean;
    onClose: () => void;
    isLoading?: boolean;
    favoriteInfo?: TenderFavorite;
    canManage?: boolean;
    currentUser?: User | null;
    allUsers?: User[];
    statusLabels?: Record<string, { label: string, color: string }>;
    onAssignResponsible?: (tenderId: string, userId: string) => void;
    onUpdateStatus?: (tenderId: string, status: TenderWorkflowStatus) => void;
    onUpdateContractor?: (tenderId: string, contractor: string) => void;
    comments?: TenderComment[];
    isLoadingComments?: boolean;
    onAddComment?: (tenderId: string, text: string) => void;
}

export const TenderDetailsModal: React.FC<TenderDetailsModalProps> = ({
    tender, isOpen, onClose, isLoading,
    favoriteInfo, canManage = false, currentUser, allUsers = [],
    statusLabels = {},
    onAssignResponsible, onUpdateStatus, onUpdateContractor,
    comments = [], isLoadingComments = false, onAddComment
}) => {
    const [commentText, setCommentText] = useState('');
    const [contractorValue, setContractorValue] = useState(favoriteInfo?.contractor || '');

    // Sync contractor value when favoriteInfo changes
    useEffect(() => {
        setContractorValue(favoriteInfo?.contractor || '');
    }, [favoriteInfo?.contractor]);

    if (!isOpen) return null;

    const handleSendComment = () => {
        if (!commentText.trim() || !tender?.id || !onAddComment) return;
        onAddComment(tender.id, commentText);
        setCommentText('');
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                        <FileText className="text-korda-500" /> Детали закупки
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <Loader2 size={32} className="animate-spin mb-4" />
                            <p>Загрузка данных...</p>
                        </div>
                    ) : tender ? (
                        <div className="space-y-6">
                            <div>
                                <div className="text-xs font-mono text-slate-500 mb-2">№ {tender.purchaseNumber || tender.id}</div>
                                <h3 className="text-xl font-medium text-slate-800 leading-snug">{tender.name}</h3>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Начальная цена</div>
                                    <div className="text-2xl font-bold text-slate-800">
                                        {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(tender.price || 0)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Статус</div>
                                    <div className="text-sm font-medium items-center flex h-8">
                                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">{tender.status}</span>
                                    </div>
                                </div>
                            </div>

                            {/* --- Workflow Management Section --- */}
                            {favoriteInfo && (
                                <div className="bg-gradient-to-br from-korda-50/50 to-indigo-50/30 p-5 rounded-xl border border-korda-100/50">
                                    <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-4">
                                        <Tag size={16} className="text-korda-500" /> Рабочий процесс
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Added By */}
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Добавил в работу</div>
                                            <div className="text-sm font-medium text-slate-700">
                                                {favoriteInfo.addedByName || '—'}
                                                <span className="text-xs text-slate-400 ml-2">
                                                    {favoriteInfo.addedAt ? new Date(favoriteInfo.addedAt).toLocaleDateString('ru-RU') : ''}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Responsible Person — only managers can assign */}
                                        <div>
                                            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-semibold">Ответственный</div>
                                            {canManage && onAssignResponsible ? (
                                                <select
                                                    value={favoriteInfo.assignedTo || ''}
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            onAssignResponsible(tender.id, e.target.value);
                                                        }
                                                    }}
                                                    className="w-full p-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-korda-500 outline-none cursor-pointer"
                                                >
                                                    <option value="">Не назначен</option>
                                                    {allUsers.map(u => (
                                                        <option key={u.id} value={u.id}>
                                                            {u.firstName} {u.lastName} ({u.role})
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                                    {favoriteInfo.assignedToName ? (
                                                        <><UserCheck size={14} className="text-korda-600" /> {favoriteInfo.assignedToName}</>
                                                    ) : (
                                                        <span className="text-slate-400">Не назначен</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Workflow Status — ANY user can change */}
                                        <div className="md:col-span-2">
                                            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Статус работы</div>
                                            {onUpdateStatus ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(TenderWorkflowStatus).map(([key, value]) => {
                                                        const info = statusLabels[value] || { label: value, color: 'bg-slate-100 text-slate-600' };
                                                        const isActive = favoriteInfo.workflowStatus === value;
                                                        return (
                                                            <button
                                                                key={key}
                                                                onClick={() => onUpdateStatus(tender.id, value)}
                                                                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all ${isActive
                                                                    ? `${info.color} border-current ring-2 ring-offset-1 ring-current/20 shadow-sm`
                                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                                                                }`}
                                                            >
                                                                {info.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div>
                                                    {favoriteInfo.workflowStatus ? (
                                                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-full ${statusLabels[favoriteInfo.workflowStatus]?.color || 'bg-slate-100 text-slate-600'}`}>
                                                            {statusLabels[favoriteInfo.workflowStatus]?.label || favoriteInfo.workflowStatus}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-slate-400">Не установлен</span>
                                                    )}
                                                </div>
                                            )}
                                            {favoriteInfo.statusChangedAt && (
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    Обновлено: {new Date(favoriteInfo.statusChangedAt).toLocaleString('ru-RU')}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contractor field — visible when CONTRACTOR stage is active */}
                                    {favoriteInfo.workflowStatus === TenderWorkflowStatus.CONTRACTOR && (
                                       <div className="mt-4 pt-4 border-t border-korda-100/50">
                                          <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold flex items-center gap-1">
                                             <HardHat size={12} /> Подрядчик
                                          </div>
                                          <input
                                             type="text"
                                             value={contractorValue}
                                             onChange={(e) => setContractorValue(e.target.value)}
                                             onBlur={() => {
                                                if (onUpdateContractor && tender?.id && contractorValue !== (favoriteInfo.contractor || '')) {
                                                   onUpdateContractor(tender.id, contractorValue);
                                                }
                                             }}
                                             onKeyDown={(e) => {
                                                if (e.key === 'Enter' && onUpdateContractor && tender?.id) {
                                                   onUpdateContractor(tender.id, contractorValue);
                                                   (e.target as HTMLInputElement).blur();
                                                }
                                             }}
                                             placeholder="Укажите подрядчика..."
                                             className="w-full p-2.5 text-sm border border-cyan-200 rounded-lg bg-cyan-50/50 focus:ring-2 focus:ring-cyan-500 outline-none placeholder-cyan-300 text-slate-800"
                                          />
                                       </div>
                                    )}

                                    {/* --- Comments Section --- */}
                                    <div className="mt-5 pt-4 border-t border-korda-100/50">
                                        <h5 className="flex items-center gap-2 font-bold text-slate-700 mb-3 text-sm">
                                            <MessageSquare size={14} className="text-korda-500" /> Комментарии
                                            {comments.length > 0 && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{comments.length}</span>}
                                        </h5>

                                        {isLoadingComments ? (
                                            <div className="flex items-center gap-2 text-slate-400 text-sm py-3">
                                                <Loader2 size={14} className="animate-spin" /> Загрузка...
                                            </div>
                                        ) : comments.length > 0 ? (
                                            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                                {comments.map(c => (
                                                    <div key={c.id} className={`p-2.5 rounded-lg text-sm ${c.userId === currentUser?.id ? 'bg-korda-50 border border-korda-100' : 'bg-white border border-slate-100'}`}>
                                                        <div className="flex justify-between items-center mb-1">
                                                            <span className="font-semibold text-xs text-slate-700">{c.userName}</span>
                                                            <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString('ru-RU')}</span>
                                                        </div>
                                                        <p className="text-slate-600 text-xs leading-relaxed">{c.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 mb-3">Комментариев пока нет</p>
                                        )}

                                        {/* Add Comment Input */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={commentText}
                                                onChange={e => setCommentText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                                                placeholder="Написать комментарий..."
                                                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-korda-500 outline-none bg-white placeholder-slate-400"
                                            />
                                            <button
                                                onClick={handleSendComment}
                                                disabled={!commentText.trim()}
                                                className="px-3 py-2 bg-korda-600 text-white rounded-lg hover:bg-korda-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3"><Building2 size={16} className="text-slate-400" /> Заказчик</h4>
                                <div className="text-sm text-slate-700 bg-white p-4 border border-slate-200 rounded-lg">
                                    <p className="font-medium mb-1">{tender.customer?.fullName || 'Не указан'}</p>
                                    <p className="text-slate-500 font-mono text-xs mb-3">ИНН: {tender.customer?.inn || '-'}</p>

                                    {tender.rawDetails?.ContactPerson && (
                                        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
                                            <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                                                <p className="font-medium text-slate-800">{tender.rawDetails.ContactPerson.Name || 'Контактное лицо'}</p>
                                                {tender.rawDetails.ContactPerson.Email && <p className="text-slate-600 mt-1 flex items-center gap-2"><span className="text-slate-400">@</span> {tender.rawDetails.ContactPerson.Email}</p>}
                                                {tender.rawDetails.ContactPerson.Phone && <p className="text-slate-600 mt-1 flex items-center gap-2"><span className="text-slate-400">📞</span> {tender.rawDetails.ContactPerson.Phone}</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {tender.rawDetails?.Docs?.length > 0 && (
                                <div>
                                    <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3"><FileText size={16} className="text-slate-400" /> Документы</h4>
                                    <div className="flex flex-col gap-2 bg-white p-4 border border-slate-200 rounded-lg">
                                        {tender.rawDetails.Docs.map((doc: any, idx: number) => (
                                            <a key={idx} href={doc.Url} target="_blank" rel="noreferrer" className="text-sm text-korda-600 hover:text-korda-700 hover:underline flex items-center gap-2">
                                                <FileText size={14} />
                                                {doc.FileName || 'Скачать документ'}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3"><FileText size={16} className="text-slate-400" /> Описание</h4>
                                <div className="text-sm text-slate-600 leading-relaxed bg-white p-4 border border-slate-200 rounded-lg whitespace-pre-wrap">
                                    {tender.description || 'Описание отсутствует или недоступно.'}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3"><MapPin size={16} className="text-slate-400" /> Место поставки</h4>
                                    <p className="text-sm text-slate-600 mb-4">{tender.deliveryPlace || 'Смотрите в документации'}</p>
                                    {tender.rawDetails?.ElectronicPlaceInfo?.Name && (
                                        <div className="mt-4">
                                            <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-2 text-xs uppercase tracking-wider">Электронная площадка</h4>
                                            <a href={tender.rawDetails.ElectronicPlaceInfo.Url} target="_blank" rel="noreferrer" className="text-sm font-medium text-korda-600 hover:text-korda-700 hover:underline flex items-center gap-1">{tender.rawDetails.ElectronicPlaceInfo.Name}</a>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h4 className="flex items-center gap-2 font-bold text-slate-800 mb-3"><Calendar size={16} className="text-slate-400" /> Сроки</h4>
                                    <div className="space-y-2 text-sm text-slate-600">
                                        <p>Окончание подачи: <strong className="text-slate-800">{tender.applicationEndDate ? new Date(tender.applicationEndDate).toLocaleDateString() : '-'}</strong></p>
                                        <p>Дата публикации: <strong className="text-slate-800">{tender.rawDetails?.PublishDate ? new Date(tender.rawDetails.PublishDate).toLocaleDateString() : '-'}</strong></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-slate-500">Данные не найдены</div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>Закрыть</Button>
                    <a
                        href={tender?.link || tender?.rawDetails?.Link || tender?.epUri || tender?.rawDetails?.EpUri || `https://zakupki.gov.ru/epz/order/notice/printForm/view.html?regNumber=${tender?.purchaseNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-korda-500 disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2 bg-korda-600 text-white shadow hover:bg-korda-700"
                    >
                        <ExternalLink size={16} className="mr-2" /> На сайт {tender?.sourceLabel || tender?.rawDetails?.Source || 'источника'}
                    </a>
                </div>
            </div>
        </div>
    );
};
