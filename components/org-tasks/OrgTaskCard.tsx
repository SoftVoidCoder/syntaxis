import React from 'react';
import { OrgTask, OrgTaskType, User } from '../../types';
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Clock, AlertCircle } from 'lucide-react';

interface OrgTaskCardProps {
  task: OrgTask;
  onClick: () => void;
  users: User[];
}

export const OrgTaskCard: React.FC<OrgTaskCardProps> = ({ task, onClick, users }) => {
  const assignee = users.find(u => u.id === task.assigneeId);
  const creator = users.find(u => u.id === task.creatorId);

  const getPriorityColor = () => {
    switch (task.priority) {
      case 'HIGH': return 'bg-red-100 text-red-600 border-red-200';
      case 'MEDIUM': return 'bg-amber-100 text-amber-600 border-amber-200';
      case 'LOW': return 'bg-green-100 text-green-600 border-green-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getTypeIcon = () => {
    switch (task.type) {
      case OrgTaskType.TOP_DOWN: return <ArrowDownRight size={14} className="text-blue-500" />;
      case OrgTaskType.BOTTOM_UP: return <ArrowUpRight size={14} className="text-purple-500" />;
      case OrgTaskType.PARALLEL: return <ArrowRightLeft size={14} className="text-amber-500" />;
      default: return null;
    }
  };

  const getTypeLabel = () => {
    switch (task.type) {
      case OrgTaskType.TOP_DOWN: return "Нисходящая";
      case OrgTaskType.BOTTOM_UP: return "Восходящая";
      case OrgTaskType.PARALLEL: return "Параллельная";
      default: return "Задача";
    }
  };

  return (
    <div 
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        // Optional styling on drag start
      }}
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing hover:border-korda-400 hover:shadow-md transition-all flex flex-col gap-3 group"
    >
      <div className="flex justify-between items-start gap-2">
        <h4 className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2 group-hover:text-korda-600 transition-colors">
          {task.title}
        </h4>
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getPriorityColor()}`}>
          {task.priority === 'HIGH' ? 'ВЫСОКИЙ' : task.priority === 'MEDIUM' ? 'СРЕДНИЙ' : 'НИЗКИЙ'}
        </div>
      </div>

      <p className="text-xs text-slate-500 line-clamp-2">{task.description}</p>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
          {getTypeIcon()}
          <span className="truncate max-w-[80px]" title={getTypeLabel()}>{getTypeLabel()}</span>
        </div>
        
        <div className="flex items-center gap-2">
           {assignee ? (
             <div className="w-6 h-6 rounded-full bg-gradient-to-br from-korda-100 to-indigo-100 text-korda-700 flex items-center justify-center text-[10px] font-bold border border-korda-200" title={`Исполнитель: ${assignee.firstName} ${assignee.lastName}`}>
               {assignee.firstName[0]}{assignee.lastName?.[0]}
             </div>
           ) : (
             <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-[10px] border border-slate-200" title="Нет исполнителя">
               ?
             </div>
           )}
        </div>
      </div>
      
      <div className="flex justify-between text-[10px] text-slate-400 px-1">
         <span>Создал: {creator?.firstName || 'Неизвестно'}</span>
         <span>{new Date(task.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
};
