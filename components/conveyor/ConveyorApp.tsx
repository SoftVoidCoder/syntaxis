import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { ConveyorRequest, ConveyorStatus, UserRole, RejectionCategory, RevisionEntry } from '../../types';
import { Factory, Plus } from 'lucide-react';
import { ConveyorDashboard } from './ConveyorDashboard';
import { ConveyorKanban } from './ConveyorKanban';
import { ConveyorChat } from './ConveyorChat';
import { CreateRequestModal } from './CreateRequestModal';
import { getConveyorRequests, updateConveyorRequest, createConveyorRequest } from '../../services/firebaseService';
import { deleteConveyorRequest } from '../../services/fireConveyor';
import { Button } from '../Button';

export const ConveyorApp: React.FC = () => {
    const { user } = useAuth();
    const { conveyorRequests: requests, setConveyorRequests: setRequests } = useNavigation();
    const [view, setView] = useState<'dashboard' | 'kanban' | 'chat'>('kanban');
    const [activeRequest, setActiveRequest] = useState<ConveyorRequest | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const handleOpenRequest = async (request: ConveyorRequest) => {
        // Reload fresh data from Firestore to get latest files
        const freshRequests = await getConveyorRequests();
        setRequests(freshRequests);
        const fresh = freshRequests.find(r => r.id === request.id) || request;
        setActiveRequest(fresh);
        setView('chat');
    };

    const handleTakeInWork = async (request: ConveyorRequest) => {
        const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.DIRECTOR || user?.role === UserRole.SUPERVISOR;
        if (!user || (user.role !== UserRole.CONSTRUCTOR && !isAdmin)) return;
        if (request.status !== ConveyorStatus.PENDING_VERIFICATION) return;

        await updateConveyorRequest(request.id, {
            status: ConveyorStatus.VERIFIED,
            constructorId: user.id,
            constructorName: `${user.lastName} ${user.firstName}`.trim(),
            isManagerBlocked: false
        });
        const updated = { ...request, status: ConveyorStatus.VERIFIED, constructorId: user.id, constructorName: `${user.lastName} ${user.firstName}`.trim(), isManagerBlocked: false };
        setRequests(prev => prev.map(r => r.id === request.id ? updated : r));
        setActiveRequest(updated);
        setView('chat');
    };

    const handleCreateRequest = async (title: string, clientDescription: string, bitrixDealUrl?: string, bitrixDealId?: string, bitrixContext?: string, orderNumber?: string, orgName?: string) => {
        if (!user) return;
        const newRequest = {
            title,
            managerId: user.id,
            managerName: `${user.lastName} ${user.firstName}`.trim(),
            sourceChatId: '',
            isManagerBlocked: false,
            clientDescription: clientDescription || undefined,
            bitrixDealUrl,
            bitrixDealId,
            bitrixContext,
            orderNumber,
            orgName
        };
        await createConveyorRequest(newRequest);
        // The global 10s poll will pick it up, but we can also optimistically update or just let it be.
        // It's safer to just let the global poll or a manual refresh handle it, 
        // but let's fetch once to be instant:
        const fresh = await getConveyorRequests();
        setRequests(fresh);
        setShowCreateModal(false);
        setView('kanban');
    };

    const handleUpdateStatus = async (id: string, newStatus: ConveyorStatus, extraUpdates?: Partial<ConveyorRequest>) => {
        const updates: Partial<ConveyorRequest> = { status: newStatus, ...extraUpdates };

        if (newStatus === ConveyorStatus.PENDING_VERIFICATION) {
            updates.isManagerBlocked = true;
        }
        if (newStatus === ConveyorStatus.VERIFIED || newStatus === ConveyorStatus.COMPLETED) {
            updates.isManagerBlocked = false;
        }

        await updateConveyorRequest(id, updates);
        setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

        // Always navigate back to kanban after any status update
        setActiveRequest(null);
        setView('kanban');
    };

    const handleReturn = async (requestId: string, category: RejectionCategory, comment: string) => {
        const request = requests.find(r => r.id === requestId);
        if (!request || !user) return;

        const newRevision: RevisionEntry = {
            round: (request.revisions?.length || 0) + 1,
            returnedBy: user.id,
            returnedByName: `${user.lastName} ${user.firstName}`.trim(),
            category,
            comment,
            timestamp: Date.now()
        };

        const updates: Partial<ConveyorRequest> = {
            status: ConveyorStatus.NEW,
            isManagerBlocked: false,
            constructorId: undefined as any,
            constructorName: undefined as any,
            reverificationCount: (request.reverificationCount || 0) + 1,
            revisions: [...(request.revisions || []), newRevision]
        };

        await updateConveyorRequest(requestId, updates);
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updates } : r));
        setActiveRequest(null);
        setView('kanban');
    };

    const handleDelete = async (requestId: string) => {
        if (!confirm('Удалить заявку безвозвратно со всеми данными и диалогами?')) return;
        await deleteConveyorRequest(requestId);
        setRequests(prev => prev.filter(r => r.id !== requestId));
        if (activeRequest?.id === requestId) {
            setActiveRequest(null);
            setView('kanban');
        }
    };

    const handleReturnToNew = async (requestId: string) => {
        const updates: Partial<ConveyorRequest> = {
            status: ConveyorStatus.NEW,
            isManagerBlocked: false,
            constructorId: undefined as any,
            constructorName: undefined as any,
        };
        await updateConveyorRequest(requestId, updates);
        setRequests(prev => prev.map(r => r.id === requestId ? { ...r, ...updates } : r));
        setActiveRequest(null);
        setView('kanban');
    };

    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.DIRECTOR || user?.role === UserRole.SUPERVISOR;
    const isConstructor = user?.role === UserRole.CONSTRUCTOR;


    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header — hidden when chat is open */}
            {view !== 'chat' && (
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm shrink-0">
                    <h1 className="text-xl font-bold flex items-center gap-3 text-slate-800">
                        <Factory className="text-emerald-500" size={24} /> Конвейер
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <button onClick={() => { setView('dashboard'); setActiveRequest(null); }} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${view === 'dashboard' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Дашборд</button>
                            <button onClick={() => { setView('kanban'); setActiveRequest(null); }} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${view === 'kanban' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Канбан</button>
                        </div>
                        {!isConstructor && (
                            <Button onClick={() => setShowCreateModal(true)} className="bg-emerald-500 hover:bg-emerald-400 border-none shadow-md px-4 py-2 text-sm text-white font-bold">
                                <Plus size={16} className="mr-2" /> Новая заявка
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                {view === 'dashboard' && (
                    <div className="h-full overflow-y-auto p-6 bg-slate-50">
                        <ConveyorDashboard requests={requests} />
                    </div>
                )}
                {view === 'kanban' && (
                    <div className="h-full overflow-y-auto p-6 bg-slate-50">
                        <ConveyorKanban
                            requests={requests}
                            onOpenRequest={handleOpenRequest}
                            onTakeInWork={handleTakeInWork}
                            onSendToVerification={(req) => handleUpdateStatus(req.id, ConveyorStatus.PENDING_VERIFICATION)}
                            onDelete={handleDelete}
                        />
                    </div>
                )}
                {view === 'chat' && activeRequest && (
                    <div className="h-full overflow-hidden">
                        <ConveyorChat
                            request={activeRequest}
                            onClose={() => { setView('kanban'); setActiveRequest(null); }}
                            onUpdateStatus={handleUpdateStatus}
                            onReturn={handleReturn}
                            onReturnToNew={handleReturnToNew}
                            onRequestUpdate={(id, updates) => {
                                setRequests(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
                                setActiveRequest(prev => prev ? { ...prev, ...updates } : prev);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Create Request Modal */}
            {showCreateModal && (
                <CreateRequestModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateRequest}
                />
            )}
        </div>
    );
};
