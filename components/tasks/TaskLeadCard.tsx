/**
 * Single lead card row within an active task.
 */
import React from 'react';
import { Button } from '../Button';
import { Lead, ChatMode, ChatSession } from '../../types';
import { Building2, Play, Search, Ban, Loader2 } from 'lucide-react';

interface TaskLeadCardProps {
  lead: Lead;
  leadIndex: number;
  taskId: string;
  existingChat?: ChatSession;
  readOnly: boolean;
  creatingChatForLead: string | null;
  cooldownLeft: number;
  onSelectChat?: (id: string) => void;
  onNavigateChat?: () => void;
  onCreateChat?: (mode: ChatMode, title: string, initialMessage?: string, skipNavigation?: boolean) => void;
  onIgnore: (taskId: string, leadIndex: number) => void;
  onChatCreating: (name: string | null) => void;
  onCooldownStart: () => void;
}

export const TaskLeadCard: React.FC<TaskLeadCardProps> = ({
  lead, leadIndex, taskId, existingChat, readOnly,
  creatingChatForLead, cooldownLeft,
  onSelectChat, onNavigateChat, onCreateChat,
  onIgnore, onChatCreating, onCooldownStart
}) => {
  return (
    <div className="p-4 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={18} className="text-slate-400" />
          <h3 className="font-bold text-lg">{lead.companyName}</h3>
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-mono">ИНН: {lead.inn}</span>
        </div>
        <p className="text-sm text-slate-600 mb-2">{lead.reason}</p>
        <a
          href={`https://yandex.ru/search/?text=${encodeURIComponent(lead.companyName + ' ' + (lead.inn || '') + ' официальный сайт')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 px-3 py-1.5 rounded-md transition-colors border border-slate-200 hover:border-blue-200"
        >
          <Search size={13} /> Найти в Яндекс
        </a>
      </div>
      <div className="flex items-center gap-2">
        {(lead.status === 'FAIL' || lead.status === 'IGNORED') ? (
          <span className="text-xs text-slate-500 border border-slate-200 bg-slate-50 px-3 py-1.5 rounded font-medium flex items-center gap-1"><Ban size={12} /> В игноре</span>
        ) : existingChat ? (
          readOnly ? (
            <span className="text-xs text-slate-400 border border-slate-200 px-2 py-1 rounded">Диалог начат</span>
          ) : (
            <Button
              size="sm"
              variant="primary"
              className="bg-korda-100 text-korda-700 hover:bg-korda-200 border-korda-200"
              onClick={() => {
                if (onSelectChat && onNavigateChat) {
                  onSelectChat(existingChat.id);
                  onNavigateChat();
                }
              }}
            >
              <Play size={16} className="fill-current mr-2" /> Продолжить
            </Button>
          )
        ) : (
          !readOnly && (
            <>
              {onCreateChat && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!!creatingChatForLead || cooldownLeft > 0}
                  onClick={async () => {
                    onChatCreating(lead.companyName);
                    try {
                      navigator.clipboard.writeText(`Компания: ${lead.companyName}\nИНН: ${lead.inn}\nСайт: ${lead.url || '-'}`);
                      await onCreateChat(ChatMode.SALES, lead.companyName, `Проверь контрагента: ${lead.companyName} (ИНН: ${lead.inn})`, true);
                      onCooldownStart();
                    } finally {
                      onChatCreating(null);
                    }
                  }}
                >
                  {creatingChatForLead === lead.companyName ? (
                    <><Loader2 size={16} className="animate-spin mr-2" /> Создаю...</>
                  ) : cooldownLeft > 0 ? (
                    <>⏳ {Math.floor(cooldownLeft / 60)}:{String(cooldownLeft % 60).padStart(2, '0')}</>
                  ) : (
                    <><Play size={16} className="text-korda-600 mr-2" /> Начать работу</>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onIgnore(taskId, leadIndex)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 gap-1"
                title="Добавить в персональный игнор-лист"
              >
                <Ban size={14} /> В игнор
              </Button>
            </>
          )
        )}
      </div>
    </div>
  );
};
