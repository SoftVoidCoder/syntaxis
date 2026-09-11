import React, { useState, useRef, useEffect } from 'react';
import { Attachment } from '../types';
import { generateDesignImage, generateDesignVideo } from '../services/geminiService';
import { logAnalyticsEvent } from '../services/firebaseService';
import { Image as ImageIcon, Download, Film, Clock, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StudioControls } from '../components/studio/StudioControls';
import { ImageAnnotator, ImageAnnotatorRef } from '../components/studio/ImageAnnotator';

const HISTORY_KEY = 'korda_studio_history';
const MAX_HISTORY = 10;

interface HistoryItem {
  id: string;
  src: string;
  prompt: string;
  timestamp: number;
}

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch (e) {
    console.warn('Failed to save studio history:', e);
  }
}

function dataUrlToObjectUrl(dataUrl: string) {
  const [header, base64] = dataUrl.split(',');
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

export const DesignStudio: React.FC = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState<'1K' | '2K'>('1K');
  const [imageModel, setImageModel] = useState<string>('flash');
  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('720p');
  const [images, setImages] = useState<Attachment[]>([]);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const annotatorRef = useRef<ImageAnnotatorRef>(null);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);

  // Save to history when a new image is generated
  const addToHistory = (src: string, usedPrompt: string) => {
    const newItem: HistoryItem = { id: Date.now().toString(), src, prompt: usedPrompt, timestamp: Date.now() };
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY);
      saveHistory(updated);
      return updated;
    });
  };

  const handleDownload = () => {
    if (!generatedResult) return;
    let dataUrl = generatedResult;
    if (mode === 'image' && annotatorRef.current) {
      const merged = annotatorRef.current.getAnnotatedImage();
      if (merged) dataUrl = merged;
    }
    const objectUrl = mode === 'video' ? dataUrlToObjectUrl(dataUrl) : null;
    const a = document.createElement('a');
    a.href = objectUrl || dataUrl;
    a.download = `korda-${mode}-${Date.now()}.${mode === 'image' ? 'png' : 'mp4'}`;
    a.click();
    if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  if (!user?.permissions.canGenerateImages && !user?.permissions.canGenerateVideos) {
    return <div className="flex h-full items-center justify-center bg-slate-50 text-slate-400">У вас нет доступа к Design Studio.</div>;
  }

  React.useEffect(() => {
    if (!user?.permissions.canGenerateImages && user?.permissions.canGenerateVideos) {
      setMode('video'); setAspectRatio('16:9');
    }
  }, [user]);

  const handleGenerate = async () => {
    setError(null); setGeneratedResult(null);

    if (mode === 'image') {
      if (!prompt.trim() && images.length === 0) { setError("Добавьте описание или изображения"); return; }
      setIsGenerating(true);
      try {
        const modelName = imageModel === 'flash' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image';
        const result = await generateDesignImage({ prompt, referenceImages: images, aspectRatio, imageSize, model: modelName });
        if (result) {
          setGeneratedResult(result);
          addToHistory(result, prompt || '(референсы)');
          if (user) logAnalyticsEvent(user, 'image');
        }
        else setError("Не удалось создать изображение.");
      } catch (err: any) { setError(err.message || "Ошибка генерации"); }
      finally { setIsGenerating(false); }
    } else {
      if (images.length === 0) { setError("Для генерации видео требуется 1 исходное изображение."); return; }
      setIsGenerating(true);
      try {
        const result = await generateDesignVideo({ prompt, image: images[0], aspectRatio, resolution: videoResolution });
        if (result) { setGeneratedResult(result); if (user) logAnalyticsEvent(user, 'video'); }
        else setError("Не удалось создать видео.");
      } catch (err: any) { setError(err.message || "Ошибка генерации видео"); }
      finally { setIsGenerating(false); }
    }
  };

  const handleReset = () => { setGeneratedResult(null); setImages([]); };

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-50 text-slate-800 overflow-y-auto md:overflow-hidden">
      <StudioControls
        mode={mode} setMode={setMode} prompt={prompt} setPrompt={setPrompt}
        aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
        imageSize={imageSize} setImageSize={setImageSize}
        imageModel={imageModel} setImageModel={setImageModel}
        videoResolution={videoResolution} setVideoResolution={setVideoResolution}
        images={images} setImages={setImages}
        isGenerating={isGenerating} error={error}
        canGenerateImages={user?.permissions.canGenerateImages || false}
        canGenerateVideos={user?.permissions.canGenerateVideos || false}
        onGenerate={handleGenerate} onReset={handleReset}
      />

      {/* Right Panel: Preview */}
      <div className="flex-1 bg-slate-100 flex flex-col relative overflow-y-auto min-h-[400px]">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="flex-1 flex items-center justify-center p-6">
          {generatedResult ? (
            <div className="relative w-full h-full flex flex-col items-center">
              {mode === 'image'
                ? <ImageAnnotator ref={annotatorRef} imageSrc={generatedResult} />
                : <video controls autoPlay loop className="max-w-full max-h-[80vh] rounded-lg shadow-2xl border border-white">
                    <source src={generatedResult} type="video/mp4" />
                    Ваш браузер не смог открыть MP4-видео.
                  </video>}
              <div className="mt-3 flex gap-2">
                <button onClick={handleDownload}
                  className="bg-korda-500 hover:bg-korda-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 font-bold transition-all transform hover:scale-105">
                  <Download size={18} /> Скачать
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 max-w-md">
              {isGenerating ? (
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 border-4 border-korda-500 border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-xl font-medium text-slate-700 animate-pulse">Анализ и генерация...</p>
                  <p className="text-sm mt-2 text-slate-500">{mode === 'video' ? 'Генерация видео может занять несколько минут' : 'Это может занять до 20 секунд'}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center opacity-60">
                  {mode === 'image' ? <ImageIcon size={64} className="mb-4 text-slate-300" /> : <Film size={64} className="mb-4 text-slate-300" />}
                  <h3 className="text-xl font-bold mb-2 text-slate-600">Область предпросмотра</h3>
                  <p>Загрузите файлы и нажмите "Сгенерировать".</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* History Strip */}
        {history.length > 0 && (
          <div className="border-t border-slate-200 bg-white/80 backdrop-blur px-4 py-3 z-10">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-500">Последние генерации</span>
              <span className="text-[10px] text-slate-400">({history.length}/{MAX_HISTORY})</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {history.map(item => (
                <button key={item.id}
                  onClick={() => setGeneratedResult(item.src)}
                  title={item.prompt}
                  className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-md ${
                    generatedResult === item.src ? 'border-korda-500 shadow-md' : 'border-slate-200'}`}>
                  <img src={item.src} alt={item.prompt} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
