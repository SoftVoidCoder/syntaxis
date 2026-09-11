/**
 * Left panel controls for Design Studio (file upload, prompt, ratios, resolutions).
 */
import React, { useRef } from 'react';
import { Attachment } from '../../types';
import { Button } from '../Button';
import { Upload, X, Image as ImageIcon, Sparkles, AlertCircle, Video, Monitor } from 'lucide-react';

const IMAGE_ASPECT_RATIOS = [
  { label: 'Квадрат (1:1)', value: '1:1' },
  { label: 'Широкий (16:9)', value: '16:9' },
  { label: 'Портрет (9:16)', value: '9:16' },
  { label: 'Ландшафт (4:3)', value: '4:3' },
  { label: 'Вертикаль (3:4)', value: '3:4' },
];

const VIDEO_ASPECT_RATIOS = [
  { label: 'Широкий (16:9)', value: '16:9' },
  { label: 'Портрет (9:16)', value: '9:16' },
];

const IMAGE_RESOLUTIONS = [
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
];

const IMAGE_MODELS = [
  { label: '⚡ Flash', value: 'flash', desc: 'Быстрый' },
  { label: '💎 Pro', value: 'pro', desc: 'Качество' },
];

const VIDEO_RESOLUTIONS = [
  { label: 'HD (720p)', value: '720p' },
  { label: 'FHD (1080p)', value: '1080p' },
];

interface StudioControlsProps {
  mode: 'image' | 'video';
  setMode: (m: 'image' | 'video') => void;
  prompt: string;
  setPrompt: (v: string) => void;
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  imageSize: string;
  setImageSize: (v: any) => void;
  imageModel: string;
  setImageModel: (v: string) => void;
  videoResolution: string;
  setVideoResolution: (v: any) => void;
  images: Attachment[];
  setImages: React.Dispatch<React.SetStateAction<Attachment[]>>;
  isGenerating: boolean;
  error: string | null;
  canGenerateImages: boolean;
  canGenerateVideos: boolean;
  onGenerate: () => void;
  onReset: () => void;
}

export const StudioControls: React.FC<StudioControlsProps> = ({
  mode, setMode, prompt, setPrompt, aspectRatio, setAspectRatio,
  imageSize, setImageSize, imageModel, setImageModel, videoResolution, setVideoResolution,
  images, setImages, isGenerating, error, canGenerateImages, canGenerateVideos,
  onGenerate, onReset
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const maxFiles = mode === 'image' ? 4 : 1;
    if (e.target.files && e.target.files.length > 0) {
      if (images.length + e.target.files.length > maxFiles) {
        alert(`Максимум ${maxFiles} изображений для этого режима.`);
        return;
      }
      const newImages: Attachment[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (!file.type.startsWith('image/')) continue;
        const reader = new FileReader();
        await new Promise<void>((resolve) => {
          reader.onload = (evt) => {
            if (evt.target?.result) {
              newImages.push({ name: file.name, mimeType: file.type, data: evt.target.result as string });
            }
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      setImages(prev => [...prev, ...newImages]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const currentRatios = mode === 'image' ? IMAGE_ASPECT_RATIOS : VIDEO_ASPECT_RATIOS;

  const OptionGrid: React.FC<{ items: { label: string; value: string }[]; selected: string; onSelect: (v: any) => void; cols?: string }> = ({
    items, selected, onSelect, cols = 'grid-cols-2'
  }) => (
    <div className={`grid ${cols} gap-2`}>
      {items.map(item => (
        <button key={item.value} onClick={() => onSelect(item.value)}
          className={`px-3 py-2 rounded-lg text-sm border transition-all ${selected === item.value
            ? 'bg-korda-500 border-korda-500 text-white font-bold shadow-md'
            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="w-full md:w-[400px] border-r border-slate-200 flex flex-col h-full bg-white overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="text-korda-500" /> Studio
          </h2>
          <div className="flex bg-slate-100 rounded-lg p-1">
            {canGenerateImages && (
              <button onClick={() => { setMode('image'); onReset(); setAspectRatio('1:1'); }}
                className={`p-2 rounded flex items-center gap-2 text-sm transition-colors ${mode === 'image' ? 'bg-white shadow text-korda-600' : 'text-slate-500 hover:text-slate-800'}`}
                title="Генерация изображений">
                <ImageIcon size={16} />
              </button>
            )}
            {canGenerateVideos && (
              <button onClick={() => { setMode('video'); onReset(); setAspectRatio('16:9'); }}
                className={`p-2 rounded flex items-center gap-2 text-sm transition-colors ${mode === 'video' ? 'bg-white shadow text-korda-600' : 'text-slate-500 hover:text-slate-800'}`}
                title="Генерация видео (Veo)">
                <Video size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-6 text-xs text-slate-500">
          {mode === 'image' ? "Создание и редактирование изображений по текстовому описанию и референсам." : "Оживление изображений. Загрузите 1 картинку и добавьте промт."}
        </div>

        {/* Reference Upload */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2 text-slate-700">
            {mode === 'image' ? "Референсы (до 4-х)" : "Исходное изображение (1 шт)"}
          </label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {images.map((img, idx) => (
              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                <img src={img.data} alt="ref" className="w-full h-full object-cover" />
                <button onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 right-1 bg-white hover:bg-red-50 text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                  <X size={14} />
                </button>
              </div>
            ))}
            {images.length < (mode === 'image' ? 4 : 1) && (
              <button onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-korda-500 hover:bg-slate-50 flex flex-col items-center justify-center transition-all text-slate-400 hover:text-korda-500">
                <Upload size={24} className="mb-1" />
                <span className="text-xs">Загрузить</span>
              </button>
            )}
          </div>
          <input type="file" accept="image/*" multiple={mode === 'image'} ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
        </div>

        {/* Prompt */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2 text-slate-700">Промт</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-slate-800 focus:ring-2 focus:ring-korda-500 outline-none resize-none h-32 placeholder-slate-400"
            placeholder={mode === 'image' ? "Что изменить или добавить..." : "Опишите движение, например: 'Камера наезжает, дым клубится'..."} />
        </div>

        {/* Controls */}
        <div className="mb-8 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-700">Формат</label>
            <OptionGrid items={currentRatios} selected={aspectRatio} onSelect={setAspectRatio} />
          </div>
          {mode === 'image' && (
            <>
              <div>
                <label className="block text-sm font-bold mb-2 text-slate-700 flex items-center gap-2">🤖 Модель</label>
                <div className="grid grid-cols-2 gap-2">
                  {IMAGE_MODELS.map(m => (
                    <button key={m.value} onClick={() => setImageModel(m.value)}
                      className={`px-3 py-2.5 rounded-lg text-sm border transition-all flex flex-col items-center ${imageModel === m.value
                        ? 'bg-korda-500 border-korda-500 text-white font-bold shadow-md'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                      <span>{m.label}</span>
                      <span className={`text-[10px] ${imageModel === m.value ? 'text-white/70' : 'text-slate-400'}`}>{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-slate-700 flex items-center gap-2"><Monitor size={14} /> Разрешение</label>
                <OptionGrid items={IMAGE_RESOLUTIONS} selected={imageSize} onSelect={setImageSize} />
              </div>
            </>
          )}
          {mode === 'video' && (
            <div>
              <label className="block text-sm font-bold mb-2 text-slate-700 flex items-center gap-2"><Monitor size={14} /> Качество видео</label>
              <OptionGrid items={VIDEO_RESOLUTIONS} selected={videoResolution} onSelect={setVideoResolution} />
            </div>
          )}
        </div>

        <Button onClick={onGenerate} disabled={isGenerating || (images.length === 0 && !prompt.trim())} className="w-full py-4 text-lg shadow-lg shadow-korda-500/20">
          {isGenerating ? (mode === 'image' ? 'Создание...' : 'Видео рендерится...') : 'Сгенерировать'}
        </Button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        )}
      </div>
    </div>
  );
};
