import React, { useEffect, useRef } from 'react';
import { Bot, FileText, Calculator, BrainCircuit, TerminalSquare, Coins, FileSignature } from 'lucide-react';

interface AgentControlPanelProps {
    activeTools?: string[];
    completedTools?: string[];
    isGenerating?: boolean;
    telemetryLogs?: string[];
    currentPhase?: string;
    isStatic?: boolean; // For displaying past logs
}

export const AgentControlPanel: React.FC<AgentControlPanelProps> = ({ 
    activeTools = [], 
    completedTools = [], 
    isGenerating = false, 
    telemetryLogs = [], 
    currentPhase = '',
    isStatic = false 
}) => {
    
    // Config for active tools
    const toolsConfig = [
        { id: 'generate_tu_name', name: 'Ассистент ТУ', icon: FileText, color: 'sky' },
        { id: 'select_materials', name: 'Материалы', icon: BrainCircuit, color: 'fuchsia' },
        { id: 'calculate_geometry', name: 'Геометрия', icon: Calculator, color: 'emerald' },
        { id: 'calculate_cost', name: 'Себестоимость', icon: Coins, color: 'amber' },
        { id: 'calculate_commercial', name: 'КП', icon: FileSignature, color: 'indigo' }
    ];

    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isStatic && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [telemetryLogs, isStatic]);

    const isMasterActive = !isStatic && currentPhase === 'synthesizer';
    const isRouterActive = !isStatic && currentPhase === 'dispatcher';

    return (
        <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm flex flex-col mb-4 overflow-hidden text-slate-700 font-mono text-sm">
            {/* Header */}
            <div className="flex justify-between items-center bg-white px-4 py-2 border-b border-slate-200">
                <div className="flex items-center gap-2 text-slate-500">
                    <TerminalSquare size={16} className="text-indigo-500" />
                    <span className="text-xs font-bold tracking-widest uppercase">Логи Телеметрии</span>
                </div>
                {!isStatic && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Router</span>
                            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isRouterActive ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-slate-300'}`} />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Synth</span>
                            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isMasterActive ? 'bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.6)]' : 'bg-slate-300'}`} />
                        </div>
                    </div>
                )}
                {isStatic && (
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        ЗАВЕРШЕНО
                    </div>
                )}
            </div>

            {/* Terminal Body */}
            <div className={`p-4 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 text-xs bg-slate-100 shadow-inner ${isStatic ? 'max-h-64' : 'h-48'}`}>
                {telemetryLogs.map((log, i) => {
                    let logColor = 'text-slate-600';
                    if (log.includes('[ROUTER]')) logColor = 'text-amber-600 font-semibold';
                    if (log.includes('[WORKER]')) logColor = 'text-emerald-600 font-semibold';
                    if (log.includes('[SYNTHESIZER]')) logColor = 'text-indigo-600 font-semibold';
                    
                    return (
                        <div key={i} className={`flex gap-2 ${logColor}`}>
                            <span className="text-slate-400 select-none">{'>'}</span>
                            <span className="break-all">{log}</span>
                        </div>
                    );
                })}
                {isGenerating && !isStatic && (
                    <div className="flex gap-2 text-slate-400 mt-1 animate-pulse">
                        <span className="select-none">{'>'}</span>
                        <span>_</span>
                    </div>
                )}
                <div ref={logsEndRef} />
            </div>

            {/* Workers Status Footer */}
            {!isStatic && (
                <div className="flex gap-1 border-t border-slate-200 bg-white p-2 overflow-x-auto custom-scrollbar">
                    {toolsConfig.map(tool => {
                        const isActive = currentPhase === `worker_${tool.id}`;
                        const isCompleted = completedTools.includes(tool.id);
                        
                        let statusColor = 'text-slate-400 border-transparent bg-transparent';
                        let iconColor = 'text-slate-400';
                        
                        if (isActive) {
                            statusColor = 'text-slate-700 border-slate-300 bg-slate-50 shadow-inner';
                            if (tool.color === 'emerald') iconColor = 'text-emerald-500 animate-pulse';
                            if (tool.color === 'sky') iconColor = 'text-sky-500 animate-pulse';
                            if (tool.color === 'fuchsia') iconColor = 'text-fuchsia-500 animate-pulse';
                        } else if (isCompleted) {
                            statusColor = 'text-slate-500 border-slate-200 bg-slate-50';
                            if (tool.color === 'emerald') iconColor = 'text-emerald-600/50';
                            if (tool.color === 'sky') iconColor = 'text-sky-600/50';
                            if (tool.color === 'fuchsia') iconColor = 'text-fuchsia-600/50';
                        }

                        return (
                            <div key={tool.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold transition-all duration-300 ${statusColor}`}>
                                <tool.icon size={14} className={iconColor} />
                                <span>{tool.name}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
