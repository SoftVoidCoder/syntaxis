import { ConveyorRequest, ConveyorStatus, ConveyorRuleCategory, ConveyorRule } from "../types";
import { callDbProxy } from "./dbProxy";

const COLLECTION_REQUESTS = 'conveyor_requests';
const COLLECTION_CATEGORIES = 'conveyor_rule_categories';
const COLLECTION_RULES = 'conveyor_rules';

export const getConveyorRequests = async (): Promise<ConveyorRequest[]> => {
    try {
        const data = await callDbProxy('list', { collectionName: COLLECTION_REQUESTS });
        return (data as ConveyorRequest[]).sort((a, b) => b.createdAt - a.createdAt);
    } catch (err) {
        console.error("Failed to fetch conveyor requests", err);
        return [];
    }
};

export const createConveyorRequest = async (request: Omit<ConveyorRequest, 'id' | 'createdAt' | 'status' | 'reverificationCount'>): Promise<string> => {
    const id = crypto.randomUUID();
    const newRequest: ConveyorRequest = {
        ...request,
        id,
        status: ConveyorStatus.NEW,
        createdAt: Date.now(),
        isManagerBlocked: false,
        reverificationCount: 0
    };
    await callDbProxy('set', { collectionName: COLLECTION_REQUESTS, docId: id, data: newRequest });
    return id;
};

export const updateConveyorRequest = async (id: string, updates: Partial<ConveyorRequest>) => {
    await callDbProxy('set', { collectionName: COLLECTION_REQUESTS, docId: id, data: { ...updates, updatedAt: Date.now() } });
};

export const deleteConveyorRequest = async (id: string) => {
    await callDbProxy('delete', { collectionName: COLLECTION_REQUESTS, docId: id });
};

// Rule Categories
export const getConveyorRuleCategories = async (): Promise<ConveyorRuleCategory[]> => {
    try {
        const data = await callDbProxy('list', { collectionName: COLLECTION_CATEGORIES });
        return data as ConveyorRuleCategory[];
    } catch (err) {
        console.error("Failed to fetch conveyor rule categories", err);
        return [];
    }
};

export const saveConveyorRuleCategory = async (category: ConveyorRuleCategory) => {
    await callDbProxy('set', { collectionName: COLLECTION_CATEGORIES, docId: category.id, data: category });
};

export const deleteConveyorRuleCategory = async (id: string) => {
    await callDbProxy('delete', { collectionName: COLLECTION_CATEGORIES, docId: id });
};

// Rules
export const getConveyorRules = async (): Promise<ConveyorRule[]> => {
    try {
        const data = await callDbProxy('list', { collectionName: COLLECTION_RULES });
        return data as ConveyorRule[];
    } catch (err) {
        console.error("Failed to fetch conveyor rules", err);
        return [];
    }
};

export const saveConveyorRule = async (rule: ConveyorRule) => {
    await callDbProxy('set', { collectionName: COLLECTION_RULES, docId: rule.id, data: rule });
};

export const deleteConveyorRule = async (id: string) => {
    await callDbProxy('delete', { collectionName: COLLECTION_RULES, docId: id });
};

// Agent Tools
const COLLECTION_AGENT_TOOLS = 'agent_tools';

export const getAgentTools = async (): Promise<any[]> => {
    try {
        const data = await callDbProxy('list', { collectionName: COLLECTION_AGENT_TOOLS });
        return data as any[];
    } catch (err) {
        console.error("Failed to fetch agent tools", err);
        return [];
    }
};

export const saveAgentTool = async (tool: any) => {
    await callDbProxy('set', { collectionName: COLLECTION_AGENT_TOOLS, docId: tool.id, data: tool });
};

export const deleteAgentTool = async (id: string) => {
    await callDbProxy('delete', { collectionName: COLLECTION_AGENT_TOOLS, docId: id });
};


