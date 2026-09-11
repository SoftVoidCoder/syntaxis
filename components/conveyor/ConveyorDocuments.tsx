import React, { useState, useRef, useEffect } from 'react';
import { ConveyorRequest, ConveyorFile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { uploadConveyorFile, deleteConveyorFile, getConveyorFileUrl } from '../../services/conveyorFiles';
import { updateConveyorRequest } from '../../services/fireConveyor';
import { X, Upload, Trash2, FileText, FileSpreadsheet, Image as ImageIcon, File, ExternalLink, Save, Plus, Loader2 } from 'lucide-react';

interface ConveyorDocumentsProps {
    request: ConveyorRequest;
    onClose: () => void;
    onRequestUpdate: (updates: Partial<ConveyorRequest>) => void;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
    'application/pdf': <FileText size={20} className="text-red-500" />,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileSpreadsheet size={20} className="text-green-600" />,
    'application/vnd.ms-excel': <FileSpreadsheet size={20} className="text-green-600" />,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': <FileText size={20} className="text-blue-500" />,
    'application/msword': <FileText size={20} className="text-blue-500" />,
};

function getFileIcon(mimeType: string): React.ReactNode {
    if (mimeType.startsWith('image/')) return <ImageIcon size={20} className="text-purple-500" />;
    return FILE_ICONS[mimeType] || <File size={20} className="text-slate-400" />;
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ConveyorDocuments: React.FC<ConveyorDocumentsProps> = ({ request, onClose, onRequestUpdate }) => {
    const { user } = useAuth();
    const [files, setFiles] = useState<ConveyorFile[]>(request.files || []);
    const [description, setDescription] = useState(request.clientDescription || '');
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [deletingPath, setDeletingPath] = useState<string | null>(null);
    const [openingPath, setOpeningPath] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragCounterRef = useRef(0);

    // Sync with request prop when it changes (e.g. reopening panel)
    useEffect(() => {
        setFiles(request.files || []);
        setDescription(request.clientDescription || '');
    }, [request.id, request.files?.length]);

    const handleUpload = async (inputFiles: FileList | File[]) => {
        if (!user) return;
        const fileArray = Array.from(inputFiles);
        
        if (fileArray.some(f => f.name.toLowerCase().endsWith('.doc') || f.type === 'application/msword')) {
            alert("Файлы старого формата .doc не поддерживаются искусственным интеллектом. Пожалуйста, пересохраните файл в формате .docx или .pdf.");
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsUploading(true);
        setUploadProgress({ current: 0, total: fileArray.length });

        const newFiles: ConveyorFile[] = [];
        try {
            for (let i = 0; i < fileArray.length; i++) {
                setUploadProgress({ current: i + 1, total: fileArray.length });
                try {
                    const uploadPromise = uploadConveyorFile(request.id, fileArray[i], user.id);
                    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout: 60s')), 60000));
                    const cf = await Promise.race([uploadPromise, timeoutPromise]);
                    newFiles.push(cf);
                } catch (err: any) {
                    console.error(`Upload failed: ${fileArray[i].name}`, err?.message || err);
                }
            }

            if (newFiles.length > 0) {
                const updated = [...files, ...newFiles];
                setFiles(updated);
                try {
                    await updateConveyorRequest(request.id, { files: updated });
                } catch (e) { console.error('DB update failed:', e); }
                onRequestUpdate({ files: updated });
            }
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    const handleDelete = async (file: ConveyorFile) => {
        if (!confirm(`Удалить файл "${file.name}"?`)) return;
        setDeletingPath(file.gcsPath);
        try {
            await deleteConveyorFile(file.gcsPath);
            const updated = files.filter(f => f.gcsPath !== file.gcsPath);
            setFiles(updated);
            await updateConveyorRequest(request.id, { files: updated });
            onRequestUpdate({ files: updated });
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Не удалось удалить файл.');
        }
        setDeletingPath(null);
    };

    const handleSaveDescription = async () => {
        setIsSaving(true);
        try {
            await updateConveyorRequest(request.id, { clientDescription: description });
            onRequestUpdate({ clientDescription: description });
        } catch (err) { console.error('Save failed:', err); }
        setIsSaving(false);
    };

    // Drag & Drop
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setIsDragging(false);
        dragCounterRef.current = 0;
        if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}>

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Документы заявки</h2>
                        <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[400px]">{request.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Description */}
                    <div>
                        <label className="text-sm font-semibold text-slate-700 mb-2 block">Требования заказчика</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Требования заказчика: устные договорённости, особые условия, дополнительные комментарии..."
                            rows={4}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent resize-none"
                        />
                        <div className="flex justify-end mt-2">
                            <button onClick={handleSaveDescription}
                                disabled={isSaving || description === (request.clientDescription || '')}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 disabled:bg-slate-200 disabled:text-slate-400 transition-colors">
                                {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                Сохранить
                            </button>
                        </div>
                    </div>

                    {/* Files List */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-slate-700">
                                    Файлы ({files.length})
                                </span>
                                <span className="text-xs text-slate-500 mt-1 max-w-[400px]">
                                    Обязательно прикрепите: карточка организации заказчика, реквизиты, аудиозаписи разговоров, документация с требованиями заказчика, изображения.
                                </span>
                            </div>
                            <button onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50">
                                <Plus size={12} /> Добавить
                            </button>
                        </div>

                        <input type="file" multiple ref={fileInputRef} className="hidden"
                            onChange={e => { if (e.target.files?.length) handleUpload(e.target.files); e.target.value = ''; }} />

                        {/* Upload progress */}
                        {uploadProgress && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                                <Loader2 size={16} className="animate-spin text-blue-500" />
                                <span className="text-sm text-blue-700 font-medium">
                                    Загрузка {uploadProgress.current} из {uploadProgress.total}...
                                </span>
                            </div>
                        )}

                        {/* Drag overlay */}
                        {isDragging && (
                            <div className="mb-3 p-8 border-2 border-dashed border-emerald-400 bg-emerald-50 rounded-xl text-center">
                                <Upload size={32} className="mx-auto text-emerald-500 mb-2" />
                                <p className="text-sm font-semibold text-emerald-700">Перетащите файлы сюда</p>
                            </div>
                        )}

                        {files.length === 0 && !isDragging && (
                            <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
                                onClick={() => fileInputRef.current?.click()}>
                                <Upload size={28} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-sm text-slate-400">Нет файлов. Нажмите или перетащите для загрузки.</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            {files.map((file) => (
                                <div key={file.gcsPath}
                                    className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors group">
                                    <div className="shrink-0">{getFileIcon(file.mimeType)}</div>
                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={async () => {
                                        setOpeningPath(file.gcsPath);
                                        try {
                                            const url = await getConveyorFileUrl(file.gcsPath);
                                            window.open(url, '_blank');
                                        } catch (e) { console.error('Open failed:', e); alert('Не удалось открыть файл'); }
                                        setOpeningPath(null);
                                    }}>
                                        <div className="text-sm font-medium text-slate-700 truncate hover:text-blue-600 transition-colors">
                                            {openingPath === file.gcsPath ? (
                                                <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Открытие...</span>
                                            ) : file.name}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString('ru-RU')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={async () => {
                                            try {
                                                const url = await getConveyorFileUrl(file.gcsPath);
                                                window.open(url, '_blank');
                                            } catch (e) { alert('Ошибка'); }
                                        }}
                                            className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Открыть">
                                            <ExternalLink size={14} />
                                        </button>
                                        <button onClick={() => handleDelete(file)}
                                            disabled={deletingPath === file.gcsPath}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            {deletingPath === file.gcsPath
                                                ? <Loader2 size={14} className="animate-spin" />
                                                : <Trash2 size={14} />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
