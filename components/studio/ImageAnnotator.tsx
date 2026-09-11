/**
 * ImageAnnotator — canvas-based annotation overlay for generated images.
 * Tools: freehand brush, text, arrow, rectangle.
 * Supports undo, color selection, and exporting merged image+annotations.
 */
import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Pencil, Type, ArrowUpRight, Square, Undo2, Eraser } from 'lucide-react';

type Tool = 'brush' | 'text' | 'arrow' | 'rect' | 'eraser';

interface Action {
  type: Tool;
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];     // brush / eraser
  start?: { x: number; y: number };         // arrow / rect
  end?: { x: number; y: number };           // arrow / rect
  text?: string;                            // text
  pos?: { x: number; y: number };           // text position
  fontSize?: number;
}

export interface ImageAnnotatorRef {
  getAnnotatedImage: () => string | null;
}

const COLORS = [
  { label: 'Красный', value: '#ef4444' },
  { label: 'Синий', value: '#3b82f6' },
  { label: 'Зелёный', value: '#22c55e' },
  { label: 'Жёлтый', value: '#eab308' },
  { label: 'Белый', value: '#ffffff' },
  { label: 'Чёрный', value: '#000000' },
];

const TOOLS: { tool: Tool; icon: React.ReactNode; label: string }[] = [
  { tool: 'brush', icon: <Pencil size={18} />, label: 'Кисть' },
  { tool: 'text', icon: <Type size={18} />, label: 'Текст' },
  { tool: 'arrow', icon: <ArrowUpRight size={18} />, label: 'Стрелка' },
  { tool: 'rect', icon: <Square size={18} />, label: 'Рамка' },
  { tool: 'eraser', icon: <Eraser size={18} />, label: 'Ластик' },
];

interface Props {
  imageSrc: string;
}

export const ImageAnnotator = forwardRef<ImageAnnotatorRef, Props>(({ imageSrc }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth] = useState(3);
  const [actions, setActions] = useState<Action[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAction, setCurrentAction] = useState<Action | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState('');
  const textInputRef = useRef<HTMLInputElement>(null);

  // Resize canvas to match image
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const handleLoad = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // Fit image within container
      const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight, 1);
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      setCanvasSize({ width: w, height: h });
    };
    if (img.complete) handleLoad();
    else img.addEventListener('load', handleLoad);
    return () => img.removeEventListener('load', handleLoad);
  }, [imageSrc]);

  // Redraw all actions whenever actions change
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawAction = (a: Action) => {
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if ((a.type === 'brush' || a.type === 'eraser') && a.points && a.points.length > 0) {
        ctx.globalCompositeOperation = a.type === 'eraser' ? 'destination-out' : 'source-over';
        ctx.beginPath();
        ctx.moveTo(a.points[0].x, a.points[0].y);
        for (let i = 1; i < a.points.length; i++) {
          ctx.lineTo(a.points[i].x, a.points[i].y);
        }
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (a.type === 'arrow' && a.start && a.end) {
        drawArrow(ctx, a.start.x, a.start.y, a.end.x, a.end.y, a.lineWidth);
      } else if (a.type === 'rect' && a.start && a.end) {
        ctx.strokeRect(a.start.x, a.start.y, a.end.x - a.start.x, a.end.y - a.start.y);
      } else if (a.type === 'text' && a.text && a.pos) {
        ctx.font = `bold ${a.fontSize || 18}px Inter, sans-serif`;
        // Text shadow for readability
        ctx.strokeStyle = a.color === '#ffffff' || a.color === '#eab308' ? '#000000' : '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeText(a.text, a.pos.x, a.pos.y);
        ctx.fillText(a.text, a.pos.x, a.pos.y);
      }
    };

    actions.forEach(drawAction);
    if (currentAction) drawAction(currentAction);
  }, [actions, currentAction]);

  useEffect(() => { redraw(); }, [redraw]);

  // Get cursor pos relative to canvas
  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'text') {
      const pos = getPos(e);
      setTextPos(pos);
      setTextValue('');
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }
    setIsDrawing(true);
    const pos = getPos(e);
    if (tool === 'brush' || tool === 'eraser') {
      setCurrentAction({ type: tool, color, lineWidth: tool === 'eraser' ? 20 : lineWidth, points: [pos] });
    } else {
      setCurrentAction({ type: tool, color, lineWidth, start: pos, end: pos });
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentAction) return;
    const pos = getPos(e);
    if (currentAction.type === 'brush' || currentAction.type === 'eraser') {
      setCurrentAction(prev => prev ? { ...prev, points: [...(prev.points || []), pos] } : null);
    } else {
      setCurrentAction(prev => prev ? { ...prev, end: pos } : null);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentAction) { setIsDrawing(false); return; }
    setActions(prev => [...prev, currentAction]);
    setCurrentAction(null);
    setIsDrawing(false);
  };

  const handleTextSubmit = () => {
    if (textValue.trim() && textPos) {
      setActions(prev => [...prev, {
        type: 'text' as Tool, color, lineWidth, text: textValue,
        pos: textPos,
        fontSize: 18,
      }]);
    }
    setTextPos(null);
    setTextValue('');
  };

  const undo = () => setActions(prev => prev.slice(0, -1));

  // Expose merged image export
  useImperativeHandle(ref, () => ({
    getAnnotatedImage: () => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return null;

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = img.naturalWidth;
      exportCanvas.height = img.naturalHeight;
      const ctx = exportCanvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      // Scale annotation canvas to natural image size
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, img.naturalWidth, img.naturalHeight);
      return exportCanvas.toDataURL('image/png');
    },
  }));

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 px-3 py-2 z-10">
        {TOOLS.map(t => (
          <button key={t.tool} onClick={() => setTool(t.tool)} title={t.label}
            className={`p-2 rounded-lg transition-all ${tool === t.tool
              ? 'bg-korda-500 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
            {t.icon}
          </button>
        ))}
        <div className="w-px h-6 bg-slate-200 mx-1" />
        {COLORS.map(c => (
          <button key={c.value} onClick={() => setColor(c.value)} title={c.label}
            className={`w-6 h-6 rounded-full border-2 transition-all ${color === c.value
              ? 'border-korda-500 scale-125 shadow-md'
              : 'border-slate-300 hover:scale-110'}`}
            style={{ backgroundColor: c.value }} />
        ))}
        <div className="w-px h-6 bg-slate-200 mx-1" />
        <button onClick={undo} disabled={actions.length === 0} title="Отменить"
          className={`p-2 rounded-lg transition-all ${actions.length > 0
            ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            : 'text-slate-300 cursor-not-allowed'}`}>
          <Undo2 size={18} />
        </button>
      </div>

      {/* Text input bar */}
      {tool === 'text' && (
        <div className="flex items-center gap-2 w-full max-w-lg">
          <div className={`flex-1 flex items-center gap-2 bg-white rounded-lg border-2 ${textPos ? 'border-korda-500' : 'border-slate-200'} shadow-md px-3 py-2`}>
            <Type size={16} className="text-slate-400 shrink-0" />
            <input ref={textInputRef} type="text" value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              className="flex-1 outline-none text-sm font-bold" style={{ color }}
              placeholder={textPos ? 'Введите текст и нажмите Enter...' : 'Кликните на изображение чтобы указать место...'}
              disabled={!textPos}
              onKeyDown={(e) => { if (e.key === 'Enter') handleTextSubmit(); }} />
            {textPos && (
              <button onClick={handleTextSubmit}
                className="bg-korda-500 text-white px-3 py-1 rounded text-xs font-bold hover:bg-korda-600 transition-colors">
                Добавить
              </button>
            )}
          </div>
        </div>
      )}

      {/* Canvas + Image */}
      <div ref={containerRef} className="relative flex-1 w-full flex items-center justify-center overflow-hidden">
        <div className="relative" style={{ width: canvasSize.width || 'auto', height: canvasSize.height || 'auto' }}>
          <img ref={imgRef} src={imageSrc} alt="Generated"
            className="block rounded-lg shadow-2xl border border-white"
            style={{ width: canvasSize.width || 'auto', height: canvasSize.height || 'auto' }}
            crossOrigin="anonymous" draggable={false} />
          <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height}
            className="absolute inset-0 rounded-lg"
            style={{ cursor: tool === 'text' ? 'text' : 'crosshair', touchAction: 'none' }}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} />

          {/* Text placement marker */}
          {tool === 'text' && textPos && canvasSize.width > 0 && (
            <div className="absolute w-4 h-4 border-2 border-korda-500 bg-korda-500/20 rounded-full animate-pulse pointer-events-none"
              style={{
                left: `${(textPos.x / canvasSize.width) * 100}%`,
                top: `${(textPos.y / canvasSize.height) * 100}%`,
                transform: 'translate(-50%, -50%)',
              }} />
          )}
        </div>
      </div>
    </div>
  );
});

ImageAnnotator.displayName = 'ImageAnnotator';

// --- Helper: draw arrow with head ---
function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, lineWidth: number) {
  const headLen = Math.max(15, lineWidth * 5);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}
