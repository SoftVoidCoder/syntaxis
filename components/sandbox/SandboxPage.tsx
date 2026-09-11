/**
 * Sandbox Page — launcher for isolated enterprise apps.
 * Each app is gated by user.permissions.sandboxApps[].
 */
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FlaskConical, ArrowLeft, FileText, Lock } from 'lucide-react';
import ConsiliumApp from './apps/ConsiliumApp';

interface SandboxAppDef {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  component: React.FC;
  accentColor: string; // tailwind color prefix
}

const SANDBOX_APPS: SandboxAppDef[] = [
  {
    id: 'consilium',
    title: 'Консилиум',
    description: 'Площадь Шрёдингера — система ценообразования термочехлов',
    icon: FileText,
    component: ConsiliumApp,
    accentColor: 'emerald',
  },
];

export const SandboxPage: React.FC = () => {
  const { user } = useAuth();
  const [activeAppId, setActiveAppId] = useState<string | null>(null);

  const allowedApps = user?.permissions?.sandboxApps || [];

  const activeApp = SANDBOX_APPS.find(a => a.id === activeAppId);

  if (activeApp) {
    const AppComponent = activeApp.component;
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* App Header */}
        <div className="shrink-0 flex items-center gap-3 px-6 py-3 bg-white border-b border-slate-200 shadow-sm">
          <button
            onClick={() => setActiveAppId(null)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
            title="Назад к Лабе"
          >
            <ArrowLeft size={20} />
          </button>
          <activeApp.icon size={20} className="text-emerald-600" />
          <h2 className="text-lg font-bold text-slate-800">{activeApp.title}</h2>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Enterprise</span>
        </div>
        {/* App Content */}
        <div className="flex-1 overflow-y-auto">
          <AppComponent />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <FlaskConical size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Лаба</h1>
            <p className="text-sm text-slate-500">Изолированные корпоративные приложения</p>
          </div>
        </div>

        {/* App Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SANDBOX_APPS.map(app => {
            const isAllowed = allowedApps.includes(app.id);
            return (
              <button
                key={app.id}
                onClick={() => isAllowed && setActiveAppId(app.id)}
                disabled={!isAllowed}
                className={`
                  group relative flex flex-col p-6 rounded-2xl border-2 transition-all text-left
                  ${isAllowed
                    ? 'bg-white border-slate-100 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 cursor-pointer'
                    : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                  }
                `}
              >
                {/* Icon */}
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110
                  ${isAllowed
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-slate-200 text-slate-400'
                  }
                `}>
                  {isAllowed ? <app.icon size={24} /> : <Lock size={24} />}
                </div>

                {/* Title */}
                <h3 className={`text-lg font-bold mb-2 ${isAllowed ? 'text-slate-800' : 'text-slate-500'}`}>
                  {app.title}
                </h3>

                {/* Description */}
                <p className={`text-sm leading-relaxed ${isAllowed ? 'text-slate-600' : 'text-slate-400'}`}>
                  {app.description}
                </p>

                {/* Status badge */}
                <div className="mt-4">
                  {isAllowed ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                      Доступно
                    </span>
                  ) : (
                    <span className="text-xs bg-slate-200 text-slate-500 px-2.5 py-1 rounded-full font-medium">
                      Нет доступа
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Future placeholder */}
          <div className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-slate-200 min-h-[200px]">
            <FlaskConical size={32} className="text-slate-300 mb-3" />
            <p className="text-sm text-slate-400 text-center">Новые приложения<br/>появятся здесь</p>
          </div>
        </div>
      </div>
    </div>
  );
};
