import React, { useState } from 'react';
import { User } from '../types';
import { Button } from './Button';
import { X, Save, Eye, EyeOff, RefreshCw, MonitorSmartphone } from 'lucide-react';
import { updateUserProfile, getUserById, getSystemSettings } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
    const { user, updateUser } = useAuth();
    const [firstName, setFirstName] = useState(user?.firstName || '');
    const [lastName, setLastName] = useState(user?.lastName || '');
    const [bitrixUrl, setBitrixUrl] = useState(user?.bitrixWebhookUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    const [showUrl, setShowUrl] = useState(false);
    const [bitrixCheck, setBitrixCheck] = useState<{ ok: boolean; message: string } | null>(null);
    const [isCheckingBitrix, setIsCheckingBitrix] = useState(false);

    if (!isOpen || !user) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const updates = {
                firstName,
                lastName,
                bitrixWebhookUrl: bitrixUrl.trim()
            };

            // 1. Update in Firestore
            await updateUserProfile(user.id, updates);

            // 1.5 VERIFY PERSISTENCE (Double-Check)
            const freshUser = await getUserById(user.id);
            if (!freshUser) throw new Error("Verification failed: User not found");

            // Debug check for the user
            if (updates.bitrixWebhookUrl && !freshUser.bitrixWebhookUrl) {
                console.error("Critical: Data was sent but not retrieved!", updates, freshUser);
                throw new Error("Внимание: Данные отправлены, но база данных их не вернула. Попробуйте еще раз.");
            }

            // 2. Update Local Context (use fresh data)
            updateUser(freshUser);

            onClose();
            alert(`✅ Профиль обновлен и проверен! Вебхук: ${freshUser.bitrixWebhookUrl ? 'СОХРАНЕН В БАЗЕ' : 'ОТСУТСТВУЕТ'}`);
        } catch (error: any) {
            console.error("Profile update failed:", error);
            alert("Ошибка сохранения: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Настройки профиля</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSave} className="p-6 space-y-4">

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Имя</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-korda-500"
                                placeholder="Иван"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Фамилия</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-korda-500"
                                placeholder="Иванов"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-2">
                            Персональный Bitrix Webhook
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-auto">PRO</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showUrl ? "text" : "password"}
                                value={bitrixUrl}
                                onChange={e => setBitrixUrl(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-korda-500 pr-10 text-sm font-mono"
                                placeholder="https://portal.bitrix24.ru/rest/1/..."
                                autoComplete="new-password"
                                name="bitrix_webhook_no_autofill"
                            />
                            <button
                                type="button"
                                onClick={() => setShowUrl(!showUrl)}
                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                                {showUrl ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                            Вставьте сюда ваш личный вебхук для доступа к CRM от вашего имени.
                            Если поле пустое, будет использоваться системный ключ (если разрешено).
                        </p>
                    </div>

                    {/* Test Connection Button */}
                    <div>
                        <Button
                            type="button"
                            onClick={async () => {
                                 setBitrixCheck(null);
                                 setIsCheckingBitrix(true);
                                 try {
                                     const settings = await getSystemSettings();
                                     const personalWebhook = bitrixUrl.trim();
                                     const systemWebhook = (settings?.bitrixWebhook || '').trim();
                                     const candidates = [
                                         ...(personalWebhook ? [{ url: personalWebhook, label: 'персональный' }] : []),
                                         ...(systemWebhook && systemWebhook !== personalWebhook ? [{ url: systemWebhook, label: 'системный' }] : [])
                                     ];
                                     if (!candidates.length) throw new Error('в системе не указан ни персональный, ни общий webhook');

                                     const validate = async (webhook: string) => {
                                     const baseUrl = webhook.endsWith('/') ? webhook : `${webhook}/`;
                                     const callBitrix = async (method: string, body = '') => {
                                         const controller = new AbortController();
                                         const timeout = window.setTimeout(() => controller.abort(), 15000);
                                         try {
                                             const res = await fetch(`${baseUrl}${method}.json`, {
                                                 method: 'POST',
                                                 headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                                                 body,
                                                 signal: controller.signal
                                             });
                                             if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
                                             const data = await res.json();
                                             if (data.error) throw new Error(`${method}: ${data.error_description || data.error}`);
                                             return data;
                                         } finally {
                                             window.clearTimeout(timeout);
                                         }
                                     };

                                     const scopeData = await callBitrix('scope', '');
                                     const scopes: string[] = Array.isArray(scopeData.result) ? scopeData.result : [];
                                     const missingScopes = ['crm', 'telephony', 'user'].filter(scope => !scopes.includes(scope));
                                     if (missingScopes.length) {
                                         throw new Error(`не хватает прав: ${missingScopes.join(', ')}`);
                                     }

                                     const commands: Record<string, string> = {
                                         users: 'user.get?FILTER[ACTIVE]=Y&start=0',
                                         companies: 'crm.company.list?select[]=ID&start=0',
                                         contacts: 'crm.contact.list?select[]=ID&start=0',
                                         leads: 'crm.lead.list?select[]=ID&start=0',
                                         deals: 'crm.deal.list?select[]=ID&start=0',
                                         activities: 'crm.activity.list?select[]=ID&start=0',
                                         calls: 'voximplant.statistic.get?start=0'
                                     };
                                     const batchBody = new URLSearchParams({ halt: '0' });
                                     Object.entries(commands).forEach(([key, command]) => batchBody.set(`cmd[${key}]`, command));
                                     const batchData = await callBitrix('batch', batchBody.toString());
                                     const batchErrors = batchData.result?.result_error || {};
                                     if (Object.keys(batchErrors).length) {
                                         const firstError: any = Object.values(batchErrors)[0];
                                         throw new Error(firstError?.error_description || firstError?.error || 'ошибка пакетной проверки');
                                     }

                                     const deals = batchData.result?.result?.deals;
                                     if (Array.isArray(deals) && deals[0]?.ID) {
                                         await callBitrix('crm.deal.get', `id=${encodeURIComponent(deals[0].ID)}`);
                                     }

                                     };

                                     let connectedVia = '';
                                     let lastError: unknown;
                                     for (const candidate of candidates) {
                                         try {
                                             await validate(candidate.url);
                                             connectedVia = candidate.label;
                                             break;
                                         } catch (error) {
                                             lastError = error;
                                         }
                                     }
                                     if (!connectedVia) throw lastError || new Error('подключение недоступно');

                                     setBitrixCheck({
                                         ok: true,
                                         message: `Битрикс24 полностью подключён через ${connectedVia} webhook: сотрудники, компании, контакты, лиды, сделки и их карточки, активности, звонки.`
                                     });
                                 } catch (e: any) {
                                     const message = e?.name === 'AbortError' ? 'Bitrix24 не ответил за 15 секунд.' : e.message;
                                     setBitrixCheck({ ok: false, message: `Ошибка: ${message}` });
                                 } finally {
                                     setIsCheckingBitrix(false);
                                 }
                             }}
                             disabled={isCheckingBitrix}
                             variant="secondary"
                             className="w-full text-xs py-2 border border-slate-200"
                         >
                             <RefreshCw size={14} className={`mr-2 ${isCheckingBitrix ? 'animate-spin' : ''}`} />
                             {isCheckingBitrix ? 'Проверяю все разделы Bitrix24…' : 'Проверить подключение'}
                         </Button>
                         {isCheckingBitrix && (
                             <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700">
                                 Запрашиваю сотрудников, CRM, активности и телефонию…
                             </p>
                         )}
                        {bitrixCheck && (
                            <p className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${bitrixCheck.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                {bitrixCheck.ok ? '✅ ' : '❌ '}{bitrixCheck.message}
                            </p>
                        )}
                    </div>

                    {/* Скрыто по просьбе пользователя
                    <div className="pt-4 border-t border-slate-100 pb-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Настольное приложение</label>
                        <Button
                            type="button"
                            variant="primary"
                            className="w-full text-xs py-2 flex justify-center items-center gap-2 bg-slate-800 hover:bg-slate-900 border-none"
                            onClick={() => {
                                // Launch syntax-notify with token
                                window.location.href = `syntax-notify://auth?token=${user.id}`;
                                setTimeout(() => {
                                    alert("Если ничего не произошло, убедитесь, что приложение Korda Notifier установлено и запущено на вашем ПК.");
                                }, 1500);
                            }}
                        >
                            <MonitorSmartphone size={14} /> Подключить уведомления на ПК
                        </Button>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed text-center">
                            Включает всплывающие уведомления о новых сообщениях поверх других окон
                        </p>
                    </div>
                    */}

                    <div className="pt-4 flex gap-3">
                        <Button variant="secondary" className="w-full" onClick={onClose} type="button">
                            Отмена
                        </Button>
                        <Button variant="primary" className="w-full" disabled={isSaving} type="submit">
                            {isSaving ? "Сохранение..." : "Сохранить"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
