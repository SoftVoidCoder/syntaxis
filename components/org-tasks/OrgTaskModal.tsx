import React, { useState, useEffect } from 'react';
import { OrgTask, OrgTaskStatus, OrgTaskType, User } from '../../types';
import { Button } from '../Button';
import { X } from 'lucide-react';

interface OrgTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<OrgTask>) => Promise<void>;
  task?: OrgTask; // if provided, we are editing
  users: User[];
  currentUserId: string;
}

export const OrgTaskModal: React.FC<OrgTaskModalProps> = ({ isOpen, onClose, onSave, task, users, currentUserId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [type, setType] = useState<OrgTaskType>(OrgTaskType.TOP_DOWN);
  const [priority, setPriority] = useState<'LOW'|'MEDIUM'|'HIGH'>('MEDIUM');
  const [status, setStatus] = useState<OrgTaskStatus>(OrgTaskStatus.TODO);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description);
        setAssigneeId(task.assigneeId);
        setType(task.type);
        setPriority(task.priority || 'MEDIUM');
        setStatus(task.status);
      } else {
        setTitle('');
        setDescription('');
        setAssigneeId(currentUserId);
        setType(OrgTaskType.TOP_DOWN);
        setPriority('MEDIUM');
        setStatus(OrgTaskStatus.TODO);
      }
    }
  }, [isOpen, task, currentUserId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !assigneeId) return;

    setIsSubmitting(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        assigneeId,
        type,
        priority,
        status,
        ...(task ? {} : { creatorId: currentUserId }) // set creator only on create
      });
      onClose();
    } catch (err) {
      console.error("Failed to save task:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">{task ? 'Редактировать задачу' : 'Новая задача'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Название <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-korda-500 outline-none"
              placeholder="Краткое название задачи"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Описание</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-korda-500 outline-none resize-none min-h-[100px]"
              placeholder="Подробности задачи..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Исполнитель <span className="text-red-500">*</span></label>
              <select 
                value={assigneeId} 
                onChange={e => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-korda-500 outline-none"
                required
              >
                <option value="" disabled>Выберите...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Тип задачи</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as OrgTaskType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-korda-500 outline-none"
              >
                <option value={OrgTaskType.TOP_DOWN}>Нисходящая</option>
                <option value={OrgTaskType.BOTTOM_UP}>Восходящая</option>
                <option value={OrgTaskType.PARALLEL}>Параллельная</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Приоритет</label>
              <select 
                value={priority} 
                onChange={e => setPriority(e.target.value as 'LOW'|'MEDIUM'|'HIGH')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-korda-500 outline-none"
              >
                <option value="LOW">Низкий</option>
                <option value="MEDIUM">Средний</option>
                <option value="HIGH">Высокий</option>
              </select>
            </div>

            {task && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Статус</label>
                <select 
                  value={status} 
                  onChange={e => setStatus(e.target.value as OrgTaskStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-korda-500 outline-none"
                >
                  <option value={OrgTaskStatus.TODO}>Нужно сделать</option>
                  <option value={OrgTaskStatus.IN_PROGRESS}>В работе</option>
                  <option value={OrgTaskStatus.REVIEW}>На проверке</option>
                  <option value={OrgTaskStatus.DONE}>Готово</option>
                </select>
              </div>
            )}
          </div>
        </form>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !title.trim() || !assigneeId}>
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>
    </div>
  );
};
