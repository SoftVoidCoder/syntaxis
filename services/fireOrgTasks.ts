import { OrgTask } from "../types";
import { callDbProxy } from "./dbProxy";

const ORG_TASKS_COLLECTION = "org_tasks";

export const createOrgTask = async (task: Omit<OrgTask, "id" | "createdAt" | "updatedAt">): Promise<void> => {
  const newId = crypto.randomUUID();
  const newTask: OrgTask = {
    ...task,
    id: newId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await callDbProxy("set", { collectionName: ORG_TASKS_COLLECTION, docId: newId, data: newTask });
};

export const updateOrgTask = async (taskId: string, updates: Partial<Omit<OrgTask, "id" | "createdAt">>): Promise<void> => {
  const dataToUpdate = { ...updates, updatedAt: Date.now() };
  await callDbProxy("set", { collectionName: ORG_TASKS_COLLECTION, docId: taskId, data: dataToUpdate });
};

export const deleteOrgTask = async (taskId: string): Promise<void> => {
  await callDbProxy("delete", { collectionName: ORG_TASKS_COLLECTION, docId: taskId });
};

export const getOrgTasks = async (): Promise<OrgTask[]> => {
  try {
    const allTasks = await callDbProxy("list", { collectionName: ORG_TASKS_COLLECTION });
    return (allTasks as OrgTask[]).sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error("Failed to fetch org tasks:", err);
    return [];
  }
};
