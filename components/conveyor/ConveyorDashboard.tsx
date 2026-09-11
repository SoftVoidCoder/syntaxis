import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ConveyorRequest, ConveyorStatus, UserRole } from '../../types';
import { Clock, CheckCircle, ListTodo, Send, RotateCcw, CircleCheck } from 'lucide-react';

interface ConveyorDashboardProps {
    requests: ConveyorRequest[];
}

const STATUS_LABELS: Record<string, string> = {
    [ConveyorStatus.NEW]: 'Черновик',
    [ConveyorStatus.PENDING_VERIFICATION]: 'Верификация',
    [ConveyorStatus.VERIFIED]: 'КП Готово',
    [ConveyorStatus.REJECTED]: 'Возврат',
};

const getRoleLabel = (role?: UserRole): string => {
    switch (role) {
        case UserRole.ADMIN: return 'Администратор';
        case UserRole.DIRECTOR: return 'Генеральный Директор';
        case UserRole.SUPERVISOR: return 'Управляющий';
        case UserRole.MANAGER: return 'Менеджер';
        case UserRole.CONSTRUCTOR: return 'Инженер-Сметчик';
        default: return 'Сотрудник';
    }
};

export const ConveyorDashboard: React.FC<ConveyorDashboardProps> = ({ requests }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === UserRole.ADMIN || user?.role === UserRole.DIRECTOR || user?.role === UserRole.SUPERVISOR;
    const isConstructor = user?.role === UserRole.CONSTRUCTOR;

    // Админ/Директор видит ВСЕ заявки. Сметчик — свои + нераспределённые. Менеджер — только свои.
    const relevantRequests = isAdmin
        ? requests
        : isConstructor
            ? requests.filter(r => r.constructorId === user?.id || !r.constructorId)
            : requests.filter(r => r.managerId === user?.id);

    const drafts = relevantRequests.filter(r => r.status === ConveyorStatus.NEW || r.status === ConveyorStatus.REJECTED).length;
    const pending = relevantRequests.filter(r => r.status === ConveyorStatus.PENDING_VERIFICATION).length;
    const verified = relevantRequests.filter(r => r.status === ConveyorStatus.VERIFIED).length;
    const completed = relevantRequests.filter(r => r.status === ConveyorStatus.COMPLETED).length;
    const totalRevisions = relevantRequests.reduce((sum, r) => sum + (r.revisions?.length || 0), 0);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Сводка показателей</h2>
                        <p className="text-emerald-600 font-semibold text-sm mt-1">
                            {getRoleLabel(user?.role)} / {user?.lastName} {user?.firstName}
                        </p>
                    </div>
                    {isAdmin && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
                            Все заявки
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <StatCard icon={<ListTodo size={18} />} label="Черновики" value={drafts} color="text-slate-600" bg="bg-slate-50 border-slate-200" />
                    <StatCard icon={<Send size={18} />} label="Верификация" value={pending} color="text-blue-600" bg="bg-blue-50 border-blue-200" />
                    <StatCard icon={<CheckCircle size={18} />} label="КП Готово" value={verified} color="text-emerald-600" bg="bg-emerald-50 border-emerald-200" />
                    <StatCard icon={<CircleCheck size={18} />} label="Завершено" value={completed} color="text-violet-600" bg="bg-violet-50 border-violet-200" />
                    <StatCard icon={<RotateCcw size={18} />} label="Возвраты" value={totalRevisions} color="text-rose-600" bg="bg-rose-50 border-rose-200" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* KPI */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">KPI</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">План завершённых заявок</span>
                                <span className="text-slate-800 font-bold">{completed} / 10</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, (completed / 10) * 100)}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-500">Возвраты</span>
                                <span className="text-slate-800 font-bold">{totalRevisions}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500 rounded-full transition-all" style={{ width: `${Math.min(100, totalRevisions * 10)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Недавняя активность</h3>
                    <div className="space-y-2 text-sm">
                        {relevantRequests.slice(0, 6).map(req => (
                            <div key={req.id} className="flex justify-between items-center p-2.5 hover:bg-slate-50 rounded-lg transition-colors">
                                <div className="flex flex-col min-w-0 mr-4">
                                    <div className="truncate font-medium text-slate-700">{req.title}</div>
                                    <div className="text-xs text-slate-400">{req.managerName}</div>
                                </div>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap border ${
                                    req.status === ConveyorStatus.NEW ? 'bg-slate-50 text-slate-600 border-slate-200' :
                                    req.status === ConveyorStatus.PENDING_VERIFICATION ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                    req.status === ConveyorStatus.VERIFIED ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                    'bg-rose-50 text-rose-600 border-rose-200'
                                }`}>
                                    {STATUS_LABELS[req.status] || req.status}
                                </span>
                            </div>
                        ))}
                        {relevantRequests.length === 0 && (
                            <div className="text-slate-400 text-center py-4">Нет активности</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Stat Card Component
const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string; bg: string }> = ({ icon, label, value, color, bg }) => (
    <div className={`${bg} border p-4 rounded-xl flex flex-col`}>
        <div className={`flex items-center gap-2 ${color} font-semibold mb-2 text-sm`}>
            {icon}
            <span>{label}</span>
        </div>
        <span className={`text-3xl font-black ${color}`}>{value}</span>
    </div>
);
