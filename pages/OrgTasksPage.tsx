import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { OrgTask, OrgTaskStatus, User } from '../types';
import { getOrgTasks, createOrgTask, updateOrgTask, deleteOrgTask, getAllUsersFromFirebase } from '../services/firebaseService';
import { OrgTaskColumn } from '../components/org-tasks/OrgTaskColumn';
import { OrgTaskCard } from '../components/org-tasks/OrgTaskCard';
import { OrgTaskModal } from '../components/org-tasks/OrgTaskModal';
import { Button } from '../components/Button';
import { Plus, Loader2 } from 'lucide-react';

export const OrgTasksPage: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<OrgTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OrgTask | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [fetchedTasks, fetchedUsers] = await Promise.all([
          getOrgTasks(),
          getAllUsersFromFirebase()
        ]);
        setUsers(fetchedUsers);
        
        // Filter "My tasks": user is either creator or assignee
        const myTasks = fetchedTasks.filter(t => t.creatorId === user.id || t.assigneeId === user.id);
        setTasks(myTasks);
      } catch (err) {
        console.error("Failed to load tasks", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleCreateOrUpdateTask = async (taskData: Partial<OrgTask>) => {
    if (editingTask) {
      await updateOrgTask(editingTask.id, taskData);
      setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...taskData, updatedAt: Date.now() } as OrgTask : t));
    } else {
      // It's created inside fireOrgTasks. We need the actual ID though.
      // So we fetch again or assume create returns it. But our createOrgTask returns void.
      // Easiest is to re-fetch "My tasks" or update createOrgTask to return id.
      // For now, let's just refetch to be safe.
      await createOrgTask(taskData as Omit<OrgTask, 'id' | 'createdAt' | 'updatedAt'>);
      const fetchedTasks = await getOrgTasks();
      setTasks(fetchedTasks.filter(t => t.creatorId === user?.id || t.assigneeId === user?.id));
    }
  };

  const handleDropTask = async (taskId: string, newStatus: OrgTaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic UI update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    
    try {
      await updateOrgTask(taskId, { status: newStatus });
    } catch (err) {
      console.error("Failed to move task", err);
      // Revert on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  };

  const openCreateModal = () => {
    setEditingTask(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (task: OrgTask) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const columns = useMemo(() => {
    const cols: Record<OrgTaskStatus, OrgTask[]> = {
      [OrgTaskStatus.TODO]: [],
      [OrgTaskStatus.IN_PROGRESS]: [],
      [OrgTaskStatus.REVIEW]: [],
      [OrgTaskStatus.DONE]: []
    };
    tasks.forEach(t => {
      if (cols[t.status]) cols[t.status].push(t);
    });
    return cols;
  }, [tasks]);

  if (!user) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="flex justify-between items-center px-8 py-6 shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Задачи (Kanban)</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Мои задачи: созданные мной и назначенные на меня</p>
        </div>
        <Button onClick={openCreateModal} className="shadow-sm hover:shadow-md transition-shadow gap-2">
          <Plus size={18} /> Новая задача
        </Button>
      </div>

      <div className="flex-1 overflow-x-auto p-8 relative">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-korda-500 animate-spin" />
          </div>
        ) : (
          <div className="flex gap-6 h-full items-start">
            <OrgTaskColumn status={OrgTaskStatus.TODO} title="Нужно сделать" count={columns[OrgTaskStatus.TODO].length} onDropTask={handleDropTask}>
              {columns[OrgTaskStatus.TODO].map(task => (
                <OrgTaskCard key={task.id} task={task} users={users} onClick={() => openEditModal(task)} />
              ))}
            </OrgTaskColumn>

            <OrgTaskColumn status={OrgTaskStatus.IN_PROGRESS} title="В работе" count={columns[OrgTaskStatus.IN_PROGRESS].length} onDropTask={handleDropTask}>
              {columns[OrgTaskStatus.IN_PROGRESS].map(task => (
                <OrgTaskCard key={task.id} task={task} users={users} onClick={() => openEditModal(task)} />
              ))}
            </OrgTaskColumn>

            <OrgTaskColumn status={OrgTaskStatus.REVIEW} title="На проверке" count={columns[OrgTaskStatus.REVIEW].length} onDropTask={handleDropTask}>
              {columns[OrgTaskStatus.REVIEW].map(task => (
                <OrgTaskCard key={task.id} task={task} users={users} onClick={() => openEditModal(task)} />
              ))}
            </OrgTaskColumn>

            <OrgTaskColumn status={OrgTaskStatus.DONE} title="Готово" count={columns[OrgTaskStatus.DONE].length} onDropTask={handleDropTask}>
              {columns[OrgTaskStatus.DONE].map(task => (
                <OrgTaskCard key={task.id} task={task} users={users} onClick={() => openEditModal(task)} />
              ))}
            </OrgTaskColumn>
          </div>
        )}
      </div>

      <OrgTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleCreateOrUpdateTask} 
        task={editingTask} 
        users={users} 
        currentUserId={user.id} 
      />
    </div>
  );
};
