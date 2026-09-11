import React from 'react';

/**
 * A safe, dependency-free component to block Sales Mode access.
 * Uses only standard HTML/CSS/UTF-8 emojis to avoid bundling crashes.
 */
export const SalesModeBlocker: React.FC<{ onToggleSidebar: () => void }> = ({ onToggleSidebar }) => {
    return (
        <div className="flex-1 flex flex-col h-screen bg-slate-50 relative overflow-hidden">
            {/* Mobile Header */}
            <div className="flex-none p-4 md:hidden flex items-center gap-3 bg-white/80 backdrop-blur-md border-b border-slate-200 z-10 sticky top-0">
                <button
                    onClick={onToggleSidebar}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100/50 text-slate-800 hover:bg-white border border-transparent shadow-sm transition-all active:scale-95"
                >
                    <span className="text-xl">☰</span>
                </button>
                <span className="font-bold text-slate-800 truncate">Доступ ограничен</span>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-600 font-bold text-3xl select-none">
                        💼
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-3">Режим продаж недоступен</h2>
                    <p className="text-slate-600 mb-6 leading-relaxed">
                        Этот чат находится в режиме <b>Sales</b>.<br />
                        Для продолжения работы настройте интеграцию с Bitrix24 в профиле.
                    </p>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 text-sm text-slate-500">
                        <p className="mb-2">Если у вас нет вебхука, обратитесь к администратору:</p>
                        <a
                            href="https://t.me/iartapel"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-korda-600 font-bold hover:underline flex items-center justify-center gap-2"
                        >
                            <span>✉️</span> @iartapel
                        </a>
                    </div>

                    <p className="text-xs text-slate-400">
                        Настройки профиля доступны в меню слева.
                    </p>
                </div>
            </div>
        </div>
    );
};
