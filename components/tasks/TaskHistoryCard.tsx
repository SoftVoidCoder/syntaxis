/**
 * Completed task card with summary rendered as Markdown.
 */
import React, { useState } from 'react';
import { SalesTask } from '../../types';
import { Loader2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TaskHistoryCardProps {
  task: SalesTask;
  onDeleteTask?: (taskId: string) => Promise<void>;
}

export const TaskHistoryCard: React.FC<TaskHistoryCardProps> = ({ task, onDeleteTask }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-bold text-slate-700">Задача от {new Date(task.createdAt).toLocaleDateString()}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Выполнена</span>
          {onDeleteTask && (
            <button
              onClick={async () => {
                if (!confirm('Удалить эту задачу? Лиды из неё будут снова доступны для поиска.')) return;
                setIsDeleting(true);
                try { await onDeleteTask(task.id); }
                finally { setIsDeleting(false); }
              }}
              disabled={isDeleting}
              className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
              title="Удалить задачу"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
        </div>
      </div>
      <div className="text-sm text-slate-600 bg-white p-3 rounded border border-slate-100">
        <strong className="block mb-1 text-slate-800">Итог:</strong>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg" {...props} /></div>,
            thead: ({ node, ...props }) => <thead className="bg-slate-50" {...props} />,
            th: ({ node, ...props }) => <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-200 last:border-r-0" {...props} />,
            td: ({ node, ...props }) => <td className="px-4 py-3 text-sm text-slate-700 border-r border-slate-200 last:border-r-0 border-t border-slate-100" {...props} />,
            a: ({ node, ...props }) => <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
            h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-slate-800 mt-6 mb-3" {...props} />,
          }}
        >
          {task.summary || "Нет описания"}
        </ReactMarkdown>
      </div>
      <div className="mt-2 text-xs text-slate-400">
        Лидов обработано: {task.leads.length}
      </div>
    </div>
  );
};
