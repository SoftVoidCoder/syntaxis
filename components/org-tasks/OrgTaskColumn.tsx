import React from 'react';
import { OrgTaskStatus } from '../../types';

interface OrgTaskColumnProps {
  status: OrgTaskStatus;
  title: string;
  children: React.ReactNode;
  count: number;
  onDropTask: (taskId: string, newStatus: OrgTaskStatus) => void;
}

export const OrgTaskColumn: React.FC<OrgTaskColumnProps> = ({ status, title, children, count, onDropTask }) => {
  const [isOver, setIsOver] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onDropTask(taskId, status);
    }
  };

  const getColumnColors = () => {
    switch (status) {
      case OrgTaskStatus.TODO: return 'bg-slate-100 border-slate-200';
      case OrgTaskStatus.IN_PROGRESS: return 'bg-blue-50 border-blue-200';
      case OrgTaskStatus.REVIEW: return 'bg-purple-50 border-purple-200';
      case OrgTaskStatus.DONE: return 'bg-green-50 border-green-200';
      default: return 'bg-slate-100 border-slate-200';
    }
  };

  return (
    <div 
      className={`flex flex-col w-[320px] shrink-0 rounded-2xl border ${getColumnColors()} overflow-hidden transition-colors ${isOver ? 'ring-2 ring-korda-400 ring-offset-2' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-4 flex items-center justify-between border-b border-black/5 bg-white/50 backdrop-blur-sm">
        <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm">{title}</h3>
        <span className="w-6 h-6 rounded-full bg-white text-slate-600 text-xs font-bold flex items-center justify-center shadow-sm">
          {count}
        </span>
      </div>
      
      <div className="flex-1 p-3 overflow-y-auto flex flex-col gap-3 min-h-[150px]">
        {children}
        {React.Children.count(children) === 0 && (
          <div className="h-full flex items-center justify-center border-2 border-dashed border-black/10 rounded-xl text-black/30 text-sm font-medium">
            Перетащите сюда
          </div>
        )}
      </div>
    </div>
  );
};
