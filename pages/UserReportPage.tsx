import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Button } from '../components/Button';
import { ArrowLeft, FileText } from 'lucide-react';
import { getDailyReportsFromFirebase, getUserById } from '../services/firebaseService';
import { ReportRow } from '../components/reports/ReportRow';

interface UserReportPageProps {
    userId: string;
    onBack: () => void;
}

export const UserReportPage: React.FC<UserReportPageProps> = ({ userId, onBack }) => {
    const [user, setUser] = useState<User | null>(null);
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

    const loadData = async () => {
        setIsLoading(true);
        try {
            const userData = await getUserById(userId);
            setUser(userData);

            const allReports = await getDailyReportsFromFirebase();
            if (userData) {
                const uFirst = (userData.firstName || "").toLowerCase();
                const uLast = (userData.lastName || "").toLowerCase();
                const targetBitrixId = userData.bitrixUserId ? String(userData.bitrixUserId) : null;

                const userReports = allReports.filter((r: any) => {
                    const reportBitrixId = r.bitrixId || r.userId;
                    if (targetBitrixId && reportBitrixId) return String(reportBitrixId) === targetBitrixId;
                    const reportName = (r.name || "").toLowerCase();
                    return reportName.includes(uLast) || (uFirst && reportName.includes(uFirst));
                }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

                setReports(userReports);
                if (userReports.length > 0) setSelectedMonth(userReports[0].date.slice(0, 7));
            }
        } catch (err) { console.error("Failed to load report data:", err); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { if (userId) loadData(); }, [userId]);

    const availableMonths = React.useMemo(() => {
        const months = new Set<string>();
        reports.forEach(r => months.add(r.date.slice(0, 7)));
        return Array.from(months).sort().reverse();
    }, [reports]);

    const filteredReports = React.useMemo(() => reports.filter(r => r.date.startsWith(selectedMonth)), [reports, selectedMonth]);

    const formatMonth = (yyyy_mm: string) => {
        const [y, m] = yyyy_mm.split('-');
        return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
    };

    const handleForceUpdate = async () => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/force-report', { method: 'POST' });
            if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(errData.error || "Server error"); }
            await loadData();
        } catch (err: any) {
            console.error("Force update failed:", err);
            alert(`Ошибка обновления отчетов:\n${err.message}`);
        } finally { setIsGenerating(false); }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-korda-500" /></div>;
    }

    if (!user) {
        return <div className="p-8 text-center text-slate-500"><p>Пользователь не найден</p><Button onClick={onBack} className="mt-4">Вернуться</Button></div>;
    }

    return (
        <div className="absolute inset-0 overflow-y-auto bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Button variant="secondary" onClick={onBack} className="flex items-center gap-2"><ArrowLeft size={16} /> Назад</Button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="text-korda-500" /> Отчетность: {user.lastName} {user.firstName}
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">Данные из Bitrix24 (обновляются ежедневно в 20:00)</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {availableMonths.length > 0 && (
                            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-korda-500 font-bold">
                                {availableMonths.map(m => <option key={m} value={m}>{formatMonth(m)}</option>)}
                            </select>
                        )}
                        <Button variant="secondary" onClick={handleForceUpdate} disabled={isGenerating} className="flex items-center gap-2 border border-slate-300">
                            <div className={`transition-transform duration-700 ${isGenerating ? 'animate-spin' : ''}`}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" />
                                </svg>
                            </div>
                            {isGenerating ? 'В процессе...' : 'Обновить'}
                        </Button>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    {reports.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <FileText size={64} className="mx-auto mb-4 opacity-50" />
                            <p className="text-lg">Нет отчетов для этого пользователя.</p>
                            <p className="text-sm mt-2 text-rose-500 font-bold">ОБЯЗАТЕЛЬНО: Убедитесь, что ID Bitrix24 указан в настройках профиля сотрудника.</p>
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="text-center py-20 text-slate-400"><p className="text-lg">Нет данных за выбранный месяц.</p></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Дата</th>
                                        <th className="px-6 py-4">Bitrix Имя</th>
                                        <th className="px-6 py-4 text-center">Звонки (CRM)</th>
                                        <th className="px-6 py-4 text-center">Телефония</th>
                                        <th className="px-6 py-4 text-center">Письма</th>
                                        <th className="px-6 py-4 text-right">Сделки (шт)</th>
                                        <th className="px-6 py-4 text-right">Сумма</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredReports.map((report, idx) => <ReportRow key={idx} report={report} />)}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
