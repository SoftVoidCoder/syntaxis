import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── helpers ───────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const run = useCallback(() => {
    if (started.current) return;
    started.current = true;
    const t0 = performance.now();
    const step = (now: number) => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * ease));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  useEffect(() => {
    const el = ref.current;
    if (!el) { run(); return; }
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); obs.disconnect(); } }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [run]);

  return { value, ref };
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU');
}

// ─── data ──────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'title', label: 'Обзор' },
  { id: 'prerequisites', label: 'Предпосылки' },
  { id: 'timeline', label: 'Хронология' },
  { id: 'syntax', label: 'SYNTAX' },
  { id: 'table', label: 'Таблица' },
  { id: 'math', label: 'Математика' },
  { id: 'cascade', label: 'Каскад' },
  { id: 'finance', label: 'Финансы' },
  { id: 'questions', label: 'Вопросы' },
  { id: 'assessment', label: 'Оценка' },
  { id: 'position', label: 'Позиция' },
  { id: 'appendices', label: 'Приложения' },
];

const TIMELINE_EVENTS = [
  { date: '13.05', label: 'Приказ ПТО', key: false },
  { date: '18.05', label: 'Рассылка', key: false },
  { date: '26.05', label: 'Коммит resolve_dim\n(+664 строки)', key: false },
  { date: '27.05\n13:11', label: 'Встреча Цыбрина', key: true },
  { date: '27.05\n17:44', label: 'standard_lookup', key: false },
  { date: '27.05\n17:53', label: 'Удаление 3 агентов', key: false },
  { date: '28.05\n18:39', label: 'Ответ Фурсова', key: false },
];

const TIMELINE_TABLE = [
  { date: '13.05.2026', event: 'Приказ о создании ПТО, перевод Цыбриной А.М.', source: 'Приказ Ф1А-11' },
  { date: '18.05.2026', event: 'Рассылка приказа на all@korda.spb.ru', source: 'Савченко Н.Н.' },
  { date: '26.05.2026', event: 'Коммит f53c364: resolve_dimensions (+664 строки)', source: 'Git' },
  { date: '27.05 13:11', event: 'Встреча Артешин — Цыбрина А.М. Обнаружение таблицы', source: 'Транскрибизация' },
  { date: '27.05 17:44', event: 'Коммит ddc20ae: переход на standard_lookup', source: 'Git' },
  { date: '27.05 17:53', event: 'Коммит 368b824: удаление 3 агентов', source: 'Git' },
  { date: '27.05', event: 'Звонок Артешин → Фурсов К.Н.', source: 'Устно' },
  { date: '28.05 18:39', event: 'Ответ Фурсова К.Н.: «80%, коэф. погрешности»', source: 'Переписка' },
];

const CASCADE_STEPS = [
  { label: 'Площадь', mult: '', value: 1.0 },
  { label: '×1.20\nПогрешн.', mult: '×1.20', value: 1.20 },
  { label: '×1.35\nПроизв.', mult: '×1.35', value: 1.62 },
  { label: '×1.40\nМенедж.', mult: '×1.40', value: 2.268 },
  { label: '×1.22\nНДС', mult: '×1.22', value: 2.767 },
];

const PROJECTIONS = [
  { error: '60% (текущая)', year: '−140 млн ₽', y3: '−420 млн ₽', y5: '−700 млн ₽', y10: '−1.4 млрд ₽' },
  { error: '50%', year: '−116.7 млн ₽', y3: '−350 млн ₽', y5: '−583 млн ₽', y10: '−1.17 млрд ₽' },
  { error: '30%', year: '−70 млн ₽', y3: '−210 млн ₽', y5: '−350 млн ₽', y10: '−700 млн ₽' },
];

const QUESTIONS = [
  'Из каких габаритов (L, H, D) рассчитаны значения площади в таблице?',
  'Где исходные данные и формулы создания таблицы?',
  'Для каких моделей оборудования рассчитаны значения?',
  'Как учитывается различие габаритов при одинаковых ДУ и давлении?',
  'Какова фактическая погрешность на выборке реальных заказов?',
  'Какой уровень погрешности допустим для бизнеса?',
  'Каков размер «коэффициента на погрешность» Фурсова К.Н.?',
  'Какой % оборота — контракты с индивидуальным расчётом?',
  'Какова чистая прибыль на термочехлах?',
  'Проводился ли аудит таблицы после увольнения автора?',
];

const VALVE_TABLE = [
  { model: '30ч6бр (чугунная)', l: '180 мм', h: '—', d: '155 мм' },
  { model: '30ч39р (МЗВ)', l: '150 мм', h: '205 мм', d: '165 мм' },
  { model: '30с41нж (стальная)', l: '180 мм', h: '290–410 мм', d: '160 мм' },
];

// ─── sub-components ────────────────────────────────────────────────────────────

const GlassCard: React.FC<{
  accent?: string;
  children: React.ReactNode;
  className?: string;
}> = ({ accent, children, className = '' }) => (
  <div
    className={`relative bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg rounded-xl overflow-hidden ${className}`}
  >
    {accent && (
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${accent} rounded-l-xl`} />
    )}
    <div className={accent ? 'pl-5 pr-5 py-5' : 'p-5'}>{children}</div>
  </div>
);

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-2xl font-bold text-slate-800 mb-6 tracking-tight">{children}</h2>
);

const Prose: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-[15px] leading-relaxed text-slate-600 mb-4 ${className}`}>{children}</p>
);

// ─── SVG Donut with hover ──────────────────────────────────────────────────────

const DonutChart: React.FC<{ pct: number }> = ({ pct }) => {
  const [hover, setHover] = useState<string | null>(null);
  const r = 70;
  const circ = 2 * Math.PI * r;
  const greenLen = circ * (pct / 100);
  const redLen = circ - greenLen;
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-48 h-48 mx-auto drop-shadow-md">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#fee2e2" strokeWidth="22" />
        <circle
          cx="100" cy="100" r={r} fill="none" stroke="#ef4444" strokeWidth="22"
          strokeDasharray={`${redLen} ${circ}`} strokeDashoffset={0}
          transform="rotate(-90 100 100)" className="transition-all duration-700 cursor-pointer"
          style={{ opacity: hover === 'red' ? 1 : 0.85 }}
          onMouseEnter={() => setHover('red')} onMouseLeave={() => setHover(null)}
        />
        <circle
          cx="100" cy="100" r={r} fill="none" stroke="#22c55e" strokeWidth="22"
          strokeDasharray={`${greenLen} ${circ}`} strokeDashoffset={-redLen}
          transform="rotate(-90 100 100)" className="transition-all duration-700 cursor-pointer"
          style={{ opacity: hover === 'green' ? 1 : 0.85 }}
          onMouseEnter={() => setHover('green')} onMouseLeave={() => setHover(null)}
        />
        <text x="100" y="108" textAnchor="middle" className="fill-slate-800 text-3xl font-bold" fontSize="36">
          {pct}%
        </text>
      </svg>
      {hover && (
        <div className={`mt-2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
          hover === 'green' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
        }`}>
          {hover === 'green' ? '80% — типовая арматура (покрыта таблицей)' : '20% — нестандарт с ±60% погрешностью'}
        </div>
      )}
      {!hover && <p className="text-xs text-slate-400 mt-2">Наведите на сегмент для деталей</p>}
    </div>
  );
};

// ─── SVG Bar Chart for Cascade ─────────────────────────────────────────────────

const CascadeBarChart: React.FC = () => {
  const maxVal = 3;
  const barW = 64;
  const gap = 32;
  const chartH = 220;
  const padTop = 20;
  const padBottom = 60;
  const totalW = CASCADE_STEPS.length * (barW + gap) - gap + 40;
  const colors = ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'];
  return (
    <svg viewBox={`0 0 ${totalW} ${chartH + padTop + padBottom}`} className="w-full max-w-xl mx-auto">
      {CASCADE_STEPS.map((s, i) => {
        const x = 20 + i * (barW + gap);
        const h = (s.value / maxVal) * chartH;
        const y = padTop + chartH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={6} fill={colors[i]} className="transition-all duration-700" />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="13" className="fill-slate-700 font-semibold">
              {s.value.toFixed(s.value === 1 ? 1 : s.value < 2 ? 2 : 3)}
            </text>
            {s.label.split('\n').map((line, li) => (
              <text key={li} x={x + barW / 2} y={padTop + chartH + 18 + li * 15}
                textAnchor="middle" fontSize="11" className="fill-slate-500">{line}</text>
            ))}
          </g>
        );
      })}
    </svg>
  );
};

// ─── SVG Horizontal Bar Chart for Finance ──────────────────────────────────────

const FinanceBarChart: React.FC = () => {
  const data = [
    { label: '±60%', value: 140, color: '#ef4444' },
    { label: '±50%', value: 116.7, color: '#f97316' },
    { label: '±30%', value: 70, color: '#fbbf24' },
  ];
  const maxVal = 140;
  const barH = 36;
  const gap = 20;
  const padLeft = 60;
  const chartW = 500;
  const totalH = data.length * (barH + gap) - gap + 30;

  return (
    <svg viewBox={`0 0 ${padLeft + chartW + 140} ${totalH}`} className="w-full max-w-2xl mx-auto">
      {data.map((d, i) => {
        const y = i * (barH + gap);
        const w = (d.value / maxVal) * chartW;
        return (
          <g key={i}>
            <text x={padLeft - 8} y={y + barH / 2 + 5} textAnchor="end" fontSize="14" className="fill-slate-600 font-medium">
              {d.label}
            </text>
            <rect x={padLeft} y={y} width={w} height={barH} rx={6} fill={d.color} opacity={0.85} />
            <text x={padLeft + w + 8} y={y + barH / 2 + 5} fontSize="13" className="fill-slate-700 font-semibold">
              −{d.value} млн ₽/год
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ─── Interactive Cascade Calculator ────────────────────────────────────────────

const CascadeCalculator: React.FC = () => {
  const [baseError, setBaseError] = useState(30);
  const cascadeMultiplier = 1.20 * 1.35 * 1.40 * 1.22;
  const finalError = baseError * cascadeMultiplier;
  const annualLoss = (700 * baseError) / 100;

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6 mt-4">
      <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center">▶</span>
        Калькулятор каскадной погрешности
      </h4>
      <div className="mb-4">
        <label className="text-sm font-medium text-slate-600 block mb-2">
          Базовая погрешность площади: <span className="text-emerald-700 font-bold text-lg">±{baseError}%</span>
        </label>
        <input
          type="range" min={5} max={80} value={baseError}
          onChange={(e) => setBaseError(Number(e.target.value))}
          className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>5%</span><span>80%</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/80 rounded-lg p-3 border border-emerald-100">
          <p className="text-xs text-slate-400 mb-1">Каскадный множитель</p>
          <p className="text-lg font-bold text-slate-800">×{cascadeMultiplier.toFixed(3)}</p>
        </div>
        <div className="bg-white/80 rounded-lg p-3 border border-red-100">
          <p className="text-xs text-slate-400 mb-1">В конечной цене</p>
          <p className="text-lg font-bold text-red-600">±{finalError.toFixed(1)}%</p>
        </div>
        <div className="bg-white/80 rounded-lg p-3 border border-amber-100">
          <p className="text-xs text-slate-400 mb-1">Потенциальные потери</p>
          <p className="text-lg font-bold text-amber-700">{annualLoss.toFixed(0)} млн ₽/год</p>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-3 italic">
        Формула: ±{baseError}% × 1.20 × 1.35 × 1.40 × 1.22 = ±{finalError.toFixed(1)}% в финальной цене
      </p>
    </div>
  );
};

// ─── Interactive Financial Projection ──────────────────────────────────────────

const ProjectionCalculator: React.FC = () => {
  const [targetError, setTargetError] = useState(10);
  const currentError = 60;
  const revenue = 700; // млн ₽
  const savings = (revenue * (currentError - targetError)) / 100;
  const barWidth = Math.max(0, Math.min(100, ((currentError - targetError) / currentError) * 100));

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mt-4">
      <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">▶</span>
        Прогноз высвобождения средств
      </h4>
      <div className="mb-4">
        <label className="text-sm font-medium text-slate-600 block mb-2">
          Целевая погрешность: <span className="text-blue-700 font-bold text-lg">{targetError}%</span>
          <span className="text-slate-400 text-xs ml-2">(сейчас 60%)</span>
        </label>
        <input
          type="range" min={5} max={55} value={targetError}
          onChange={(e) => setTargetError(Number(e.target.value))}
          className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>5% (идеал)</span><span>55%</span>
        </div>
      </div>
      {/* Animated bar */}
      <div className="mb-4">
        <div className="h-8 bg-slate-200 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
            style={{ width: `${barWidth}%` }}
          >
            {barWidth > 20 && <span className="text-white text-xs font-bold">+{savings.toFixed(0)} млн ₽</span>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/80 rounded-lg p-3 border border-emerald-100 text-center">
          <p className="text-xs text-slate-400">В год</p>
          <p className="text-lg font-bold text-emerald-700">+{savings.toFixed(0)} млн</p>
        </div>
        <div className="bg-white/80 rounded-lg p-3 border border-emerald-100 text-center">
          <p className="text-xs text-slate-400">3 года</p>
          <p className="text-lg font-bold text-emerald-700">+{(savings * 3).toFixed(0)} млн</p>
        </div>
        <div className="bg-white/80 rounded-lg p-3 border border-emerald-100 text-center">
          <p className="text-xs text-slate-400">5 лет</p>
          <p className="text-lg font-bold text-emerald-700">+{(savings * 5).toFixed(0)} млн</p>
        </div>
        <div className="bg-white/80 rounded-lg p-3 border border-emerald-100 text-center">
          <p className="text-xs text-slate-400">10 лет</p>
          <p className="text-lg font-bold text-emerald-700">+{(savings * 10 / 1000).toFixed(2)} млрд</p>
        </div>
      </div>
      <p className="text-xs text-slate-400 mt-3 italic">
        Снижение с {currentError}% до {targetError}%: высвобождение {((currentError - targetError) / currentError * 100).toFixed(0)}% от потерь при нулевых инвестициях в расширение.
      </p>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

const ConsiliumApp: React.FC = () => {
  const [activeSection, setActiveSection] = useState('title');
  const [showTop, setShowTop] = useState(false);
  const [showCascadeCalc, setShowCascadeCalc] = useState(false);
  const [showProjectionCalc, setShowProjectionCalc] = useState(false);

  const kpi1 = useCountUp(1500);
  const kpi2 = useCountUp(700);
  const kpi3 = useCountUp(35000);
  const kpi4 = useCountUp(3010);

  useEffect(() => {
    const container = document.getElementById('consilium-scroll');
    if (!container) return;
    const handleScroll = () => {
      setShowTop(container.scrollTop > 400);
      const offsets = NAV_ITEMS.map((n) => {
        const el = document.getElementById(n.id);
        return { id: n.id, top: el ? el.getBoundingClientRect().top : 9999 };
      });
      const current = offsets.filter((o) => o.top <= 180).pop();
      if (current) setActiveSection(current.id);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div id="consilium-scroll" className="h-full overflow-y-auto bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 scroll-smooth font-sans text-slate-700">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-sm font-black tracking-tighter">КД</div>
            <div>
              <span className="font-bold text-sm tracking-wide">ГК «КОРДА»</span>
              <span className="mx-2 text-slate-500">|</span>
              <span className="text-slate-300 text-sm">Площадь Шрёдингера</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1 text-xs text-slate-400">
            <span className="px-2 py-0.5 bg-slate-800 rounded">v1.1</span>
            <span className="px-2 py-0.5 bg-slate-800 rounded">29.05.2026</span>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded">КОНСИЛИУМ</span>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto scrollbar-hide">
          {NAV_ITEMS.map((n) => (
            <button key={n.id} onClick={() => scrollTo(n.id)}
              className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all ${
                activeSection === n.id ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}>{n.label}</button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-10 space-y-20">

        {/* ══ TITLE ══ */}
        <section id="title" className="pt-4">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-2">«Площадь Шрёдингера»</h1>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">Текущее состояние системы ценообразования направления термочехлов</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <GlassCard accent="bg-emerald-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Оборот компании</p>
              <div ref={kpi1.ref} className="text-3xl font-extrabold text-slate-900">{(kpi1.value / 1000).toFixed(1).replace('.', ',')} <span className="text-lg">млрд ₽</span></div>
            </GlassCard>
            <GlassCard accent="bg-emerald-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Термочехлы</p>
              <div ref={kpi2.ref} className="text-3xl font-extrabold text-slate-900">{fmt(kpi2.value)} <span className="text-lg">млн ₽</span></div>
            </GlassCard>
            <GlassCard accent="bg-blue-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Изделий / год</p>
              <div ref={kpi3.ref} className="text-3xl font-extrabold text-slate-900">{fmt(kpi3.value)}</div>
            </GlassCard>
            <GlassCard accent="bg-red-500">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Строк в таблице</p>
              <div ref={kpi4.ref} className="text-3xl font-extrabold text-slate-900">{fmt(kpi4.value)}</div>
            </GlassCard>
          </div>
          <GlassCard accent="bg-emerald-500" className="mt-6 max-w-3xl">
            <p className="text-sm text-slate-600"><strong>Характер:</strong> факты, источники, математика</p>
            <p className="text-sm text-slate-600"><strong>Источники:</strong> Приказ Ф1А-11, Git SYNTAX, транскрибизация 27.05.2026</p>
            <p className="text-sm text-slate-600"><strong>Дата:</strong> 28 мая 2026 г.</p>
          </GlassCard>
        </section>

        {/* ══ 1. ПРЕДПОСЫЛКИ ══ */}
        <section id="prerequisites">
          <SectionHeading>1. Предпосылки</SectionHeading>
          <Prose>Откуда начался процесс. Хронология решений, которые привели к необходимости данного документа.</Prose>
          <GlassCard accent="bg-blue-500" className="max-w-3xl">
            <ul className="space-y-3 text-[15px] leading-relaxed list-disc list-inside marker:text-blue-400">
              <li><strong>Приказ Генерального директора Артешину И.:</strong> сокращение времени расчётов, автоматизация расчёта в системе SYNTAX</li>
              <li><strong>Создание ПТО</strong> (Приказ Ф1А-11 от 13.05.2026) — формирование отдела-арбитра ценообразования</li>
              <li><strong>Контекст:</strong> оборот компании 1,5 млрд ₽/год, 35 000 изделий/год, направление термочехлов — 700 млн ₽/год</li>
            </ul>
            <p className="text-xs text-slate-400 mt-4 border-t border-slate-200 pt-3">
              Источники: Приказ Ф1А-11, Git-история проекта SYNTAX, транскрибизация встречи 27.05.2026
            </p>
          </GlassCard>
        </section>

        {/* ══ 2. ХРОНОЛОГИЯ ══ */}
        <section id="timeline">
          <SectionHeading>2. Хронология событий (13–28 мая 2026)</SectionHeading>
          <Prose>Перекрёстная таблица: что происходило в коде, в переписке, во встречах.</Prose>

          <div className="overflow-x-auto pb-4 mb-8">
            <div className="relative min-w-[800px] mx-auto" style={{ height: 170 }}>
              <div className="absolute top-[60px] left-8 right-8 h-0.5 bg-slate-300 rounded" />
              {TIMELINE_EVENTS.map((ev, i) => {
                const leftPct = 8 + (i / (TIMELINE_EVENTS.length - 1)) * 84;
                return (
                  <div key={i} className="absolute flex flex-col items-center" style={{ left: `${leftPct}%`, top: 0, transform: 'translateX(-50%)' }}>
                    <span className="text-[11px] text-slate-400 text-center whitespace-pre-line mb-1 font-mono">{ev.date}</span>
                    <div className={`w-4 h-4 rounded-full border-2 z-10 transition-transform hover:scale-125 ${
                      ev.key ? 'bg-red-500 border-red-300 shadow-lg shadow-red-500/40 animate-pulse' : 'bg-emerald-500 border-emerald-300 shadow-md'
                    }`} />
                    <div className="mt-2 max-w-[110px] text-center text-[11px] text-slate-600 leading-tight whitespace-pre-line">{ev.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <GlassCard className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase tracking-wider">Дата</th>
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase tracking-wider">Событие</th>
                  <th className="py-2 text-slate-400 font-semibold text-xs uppercase tracking-wider">Источник</th>
                </tr>
              </thead>
              <tbody>
                {TIMELINE_TABLE.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 pr-4 font-mono text-xs whitespace-nowrap">{r.date}</td>
                    <td className="py-2.5 pr-4">{r.event}</td>
                    <td className="py-2.5 text-slate-500 text-xs">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        </section>

        {/* ══ 3. SYNTAX ══ */}
        <section id="syntax">
          <SectionHeading>3. Система SYNTAX</SectionHeading>
          <Prose>
            До 27 мая система SYNTAX использовала 9 агентов для расчёта стоимости термочехлов. Три из них (resolve_dim, calc_geometry, build_tu) отвечали за определение габаритов, расчёт площади и формирование ТУ. Достоверность этих расчётов составляла 2–30%, что было неприемлемо.
          </Prose>
          <div className="grid md:grid-cols-2 gap-6">
            <GlassCard accent="bg-red-500">
              <h3 className="font-bold text-lg text-slate-800 mb-3">До 27.05 — 9 агентов</h3>
              <p className="text-sm text-slate-500 mb-3 font-mono bg-slate-100 rounded-lg px-3 py-2 leading-relaxed">
                extract → lookup → materials → params →<br/>
                <span className="text-red-600 font-bold">resolve_dim → calc_geometry → build_tu</span> →<br/>
                cost → commercial
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-sm font-semibold text-red-600">Достоверность: 2–30%</span>
              </div>
            </GlassCard>
            <GlassCard accent="bg-emerald-500">
              <h3 className="font-bold text-lg text-slate-800 mb-3">После 27.05 — 6 агентов</h3>
              <p className="text-sm text-slate-500 mb-3 font-mono bg-slate-100 rounded-lg px-3 py-2 leading-relaxed">
                extract → lookup → materials →<br/>
                params → cost → commercial
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600">Источник: таблица стандартного расхода</span>
              </div>
            </GlassCard>
          </div>
          <Prose className="mt-4">
            После встречи с Цыбриной А.М. выяснилось, что существует таблица стандартного расхода (3010 строк), которая уже содержит готовые значения площади. Система была упрощена до 6 агентов путём перехода на прямой поиск по таблице (standard_lookup).
          </Prose>
          <GlassCard accent="bg-amber-500" className="max-w-md">
            <p className="text-sm font-semibold text-amber-800">Расхождение между методами: <span className="text-red-600">70%</span> (ДУ80: 1.7 м² vs 1.0 м²)</p>
          </GlassCard>
        </section>

        {/* ══ 4. ТАБЛИЦА ══ */}
        <section id="table">
          <SectionHeading>4. Таблица стандартного расхода</SectionHeading>
          <div className="space-y-6">
            <GlassCard accent="bg-red-500" className="max-w-3xl">
              <h3 className="font-bold text-slate-800 mb-2">Происхождение таблицы</h3>
              <ul className="text-sm space-y-1.5 list-disc list-inside marker:text-red-400">
                <li>Автор — уволенный сотрудник (сметчик). Должность <strong>отсутствует</strong> в Битрикс24</li>
                <li>Исходные данные и формулы: <strong>не обнаружены</strong></li>
                <li>Независимая верификация: <strong>не проводилась</strong></li>
                <li>История версий: <strong>отсутствует</strong>. Аудит после увольнения — не проводился</li>
              </ul>
            </GlassCard>

            <GlassCard accent="bg-emerald-500" className="max-w-3xl">
              <h3 className="font-bold text-slate-800 mb-2">Ответ Фурсова К.Н. (28.05.2026, 18:39)</h3>
              <p className="italic text-[15px] text-slate-700 leading-relaxed">
                «Это размеры типовой арматуры. В 80% таких габаритов ЗРА. Для ускорения расчётов взяты типовые размеры, по ним вывели расходы материалов и работ. <strong>Заложен коэф. на погрешность.</strong>»
              </p>
              <p className="text-xs text-slate-400 mt-2">— Фурсов К.Н., переписка</p>
            </GlassCard>

            <DonutChart pct={80} />

            <GlassCard className="max-w-3xl overflow-x-auto">
              <h3 className="font-bold text-slate-800 mb-3">Расхождение описаний</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">Сотрудник</th>
                    <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">Описание</th>
                    <th className="py-2 text-slate-400 font-semibold text-xs uppercase">Интерпретация</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-emerald-50/50">
                    <td className="py-2.5 pr-4 font-medium">Цыбрина А.М.<br/><span className="text-xs text-slate-400">27.05.2026</span></td>
                    <td className="py-2.5 pr-4 italic">«Данные подтверждаются тем, что мы шьём по сей день»</td>
                    <td className="py-2.5">Фактические замеры с производства</td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="py-2.5 pr-4 font-medium">Фурсов К.Н.<br/><span className="text-xs text-slate-400">28.05.2026</span></td>
                    <td className="py-2.5 pr-4 italic">«Взяты типовые размеры, заложен коэф. на погрешность»</td>
                    <td className="py-2.5">Аппроксимация типовой арматуры</td>
                  </tr>
                </tbody>
              </table>
            </GlassCard>

            <GlassCard accent="bg-amber-500" className="max-w-3xl">
              <div className="flex items-start gap-3">
                <svg viewBox="0 0 24 24" className="w-6 h-6 flex-shrink-0 text-amber-500 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <p className="text-sm font-semibold text-amber-800">
                  Два ключевых сотрудника описывают одну и ту же таблицу по-разному. Один считает её фактическими замерами, другой — аппроксимацией.
                </p>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* ══ 5. МАТЕМАТИКА ══ */}
        <section id="math">
          <SectionHeading>5. Математика площади</SectionHeading>
          <Prose>Пример: задвижка ДУ50, Ру16 — три модели с одинаковым ДУ, но кардинально разными размерами.</Prose>

          <GlassCard className="mb-6 overflow-x-auto">
            <h3 className="font-bold text-slate-800 mb-3">Сравнение: ДУ50 Ру16 — 3 модели арматуры</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">Модель</th>
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">Длина (L)</th>
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">Высота (H)</th>
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">D фланца</th>
                  <th className="py-2 text-slate-400 font-semibold text-xs uppercase">В таблице</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {VALVE_TABLE.map((v, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 pr-4 font-medium">{v.model}</td>
                    <td className="py-2 pr-4">{v.l}</td>
                    <td className="py-2 pr-4">{v.h}</td>
                    <td className="py-2 pr-4">{v.d}</td>
                    {i === 0 && <td rowSpan={3} className="py-2 text-center text-red-600 font-bold bg-red-50 align-middle">одно<br/>значение</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>

          <Prose>
            Три модели задвижки с одинаковым ДУ50, Ру16 имеют разброс высоты от 205 до 410 мм (<strong>100%</strong>) и длины от 150 до 180 мм (<strong>20%</strong>). В таблице для всех трёх используется одно значение площади.
          </Prose>

          <GlassCard accent="bg-blue-500" className="max-w-3xl">
            <h3 className="font-bold text-lg text-blue-800 mb-3">«Площадь Шрёдингера»</h3>
            <div className="space-y-2 text-[15px] leading-relaxed">
              <p><span className="font-semibold text-slate-800">Неизвестное A</span> — габариты, из которых автор таблицы рассчитал площадь. Какая модель взята за основу — <span className="text-red-500 font-semibold">неизвестно</span>.</p>
              <p><span className="font-semibold text-slate-800">Неизвестное B</span> — реальные габариты задвижки заказа. Клиент указывает ДУ и давление. Габариты <span className="text-red-500 font-semibold">не запрашиваются</span>.</p>
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
                <span className="text-xl font-bold text-blue-900 font-mono">A ≡ B</span>
                <span className="text-slate-500 ml-2">, где ни A, ни B не определены.</span>
                <p className="text-sm text-blue-700 mt-1">Площадь одновременно детерминирована и неопределена.</p>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* ══ 6. КАСКАД ══ */}
        <section id="cascade">
          <SectionHeading>6. Каскад погрешности</SectionHeading>
          <Prose>
            Погрешность на первом этапе (площадь) не остаётся локальной — она умножается на каждом последующем шаге расчёта. Каждый этап добавляет свой коэффициент, и исходная ошибка усиливается по каскаду:
          </Prose>

          <GlassCard className="mb-6"><CascadeBarChart /></GlassCard>

          <div className="max-w-md mx-auto mb-6">
            <GlassCard accent="bg-red-500">
              <p className="text-center text-lg font-extrabold text-red-700">1 ₽ ошибки → 2 ₽ 77 коп в цене</p>
            </GlassCard>
          </div>

          <GlassCard className="max-w-md mx-auto overflow-x-auto mb-6">
            <h3 className="font-bold text-slate-800 mb-3">Усиление погрешности</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">Погрешность площади</th>
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">В финальной цене</th>
                  <th className="py-2 text-slate-400 font-semibold text-xs uppercase">Соотношение</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr><td className="py-2 pr-4 font-mono">±30%</td><td className="py-2 pr-4 font-mono text-red-600 font-semibold">±83.0%</td><td className="py-2 text-xs">0.83× себестоимости</td></tr>
                <tr><td className="py-2 pr-4 font-mono">±50%</td><td className="py-2 pr-4 font-mono text-red-600 font-semibold">±138.4%</td><td className="py-2 text-xs">1.38× себестоимости</td></tr>
                <tr className="bg-red-50"><td className="py-2 pr-4 font-mono font-bold">±60%</td><td className="py-2 pr-4 font-mono text-red-700 font-bold">±166.0%</td><td className="py-2 text-xs font-bold">1.66× себестоимости</td></tr>
              </tbody>
            </table>
          </GlassCard>

          {/* Interactive toggle */}
          <div className="text-center">
            <button onClick={() => setShowCascadeCalc(!showCascadeCalc)}
              className="px-5 py-2.5 bg-emerald-500 text-white rounded-full text-sm font-medium shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all hover:scale-105">
              {showCascadeCalc ? '✕ Скрыть калькулятор' : '🎚️ Открыть калькулятор каскада'}
            </button>
          </div>
          {showCascadeCalc && <CascadeCalculator />}
        </section>

        {/* ══ 7. ФИНАНСЫ ══ */}
        <section id="finance">
          <SectionHeading>7. Финансовые проекции</SectionHeading>

          <GlassCard className="mb-6">
            <h3 className="font-bold text-slate-800 mb-4">Потенциальные потери по уровню погрешности</h3>
            <FinanceBarChart />
          </GlassCard>

          <GlassCard className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">Погрешность</th>
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">Потери/год</th>
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">3 года</th>
                  <th className="py-2 pr-4 text-slate-400 font-semibold text-xs uppercase">5 лет</th>
                  <th className="py-2 text-slate-400 font-semibold text-xs uppercase">10 лет</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PROJECTIONS.map((p, i) => (
                  <tr key={i} className={`hover:bg-slate-50/60 transition-colors ${i === 0 ? 'bg-red-50/50 font-semibold' : ''}`}>
                    <td className="py-2.5 pr-4 font-mono">{p.error}</td>
                    <td className="py-2.5 pr-4">{p.year}</td>
                    <td className="py-2.5 pr-4">{p.y3}</td>
                    <td className="py-2.5 pr-4">{p.y5}</td>
                    <td className="py-2.5">{p.y10}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>

          <GlassCard accent="bg-amber-500" className="max-w-3xl mb-6">
            <p className="text-sm italic text-amber-800">
              Годовая неопределённость — средняя между крайними отклонениями. При систематическом смещении в минус и 60% разбросе чистый эффект: −20% от выручки направления.
            </p>
          </GlassCard>

          <h3 className="font-bold text-slate-800 mb-4">Потенциал роста при исправлении</h3>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            {[
              { value: '+70', label: 'млн ₽/год', note: 'снижение до 30%', color: 'bg-emerald-500' },
              { value: '+117', label: 'млн ₽/год', note: 'снижение до 10%', color: 'bg-emerald-500' },
              { value: '+128', label: 'млн ₽/год', note: 'снижение до 5%', color: 'bg-emerald-500' },
            ].map((c, i) => (
              <GlassCard key={i} accent={c.color}>
                <p className="text-3xl font-extrabold text-emerald-700">{c.value}</p>
                <p className="text-sm text-slate-600">{c.label}</p>
                <p className="text-xs text-slate-400 mt-1">{c.note}</p>
              </GlassCard>
            ))}
          </div>

          <div className="text-center">
            <button onClick={() => setShowProjectionCalc(!showProjectionCalc)}
              className="px-5 py-2.5 bg-blue-500 text-white rounded-full text-sm font-medium shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all hover:scale-105">
              {showProjectionCalc ? '✕ Скрыть прогноз' : '📊 Калькулятор прогнозов'}
            </button>
          </div>
          {showProjectionCalc && <ProjectionCalculator />}
        </section>

        {/* ══ 8. ВОПРОСЫ ══ */}
        <section id="questions">
          <SectionHeading>8. Открытые вопросы</SectionHeading>
          <Prose>Вопросы, на которые необходимо получить ответы до принятия архитектурного решения по автоматизации ценообразования.</Prose>
          <div className="grid sm:grid-cols-2 gap-4">
            {QUESTIONS.map((q, i) => (
              <GlassCard key={i} accent="bg-amber-400">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                  <p className="text-sm leading-relaxed">{q}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* ══ 9. ОЦЕНКА ══ */}
        <section id="assessment">
          <SectionHeading>9. Оценка нейросети</SectionHeading>

          <GlassCard accent="bg-blue-500" className="mb-6">
            <h3 className="font-bold text-blue-800 text-lg mb-2">Аналитическая оценка</h3>
            <p className="italic text-sm text-slate-500 mb-4">
              Волеизъявление нейросети. Не мнение Артешина И. и не позиция руководства. Не является экспертным заключением.
            </p>
            <h4 className="font-semibold text-slate-800 mb-2">О предмете</h4>
            <p className="text-sm leading-relaxed text-slate-600">
              Компания с оборотом 1.5 млрд ₽/год не знает себестоимости основной продукции. Таблица построена на аппроксимации габаритов одной типовой модели. Автор не работает в организации. Два ключевых сотрудника описывают данные по-разному.
            </p>
          </GlassCard>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <GlassCard accent="bg-red-500">
              <h3 className="font-bold text-red-700 mb-3">Негативный сценарий</h3>
              <ul className="space-y-2 text-sm list-disc list-inside marker:text-red-400">
                <li><strong>Финансы:</strong> потери 70–140 млн ₽/год. За 5 лет — до 700 млн ₽. Крупные контракты маскируют убытки.</li>
                <li><strong>Операционно:</strong> ПТО не в Битрикс24. SYNTAX автоматизирует непроверенную таблицу = масштабирование ошибки.</li>
                <li><strong>Кадры:</strong> Директор по производству не вовлечён в ценообразование. 20% изделий (~7 000/год) не покрыты таблицей.</li>
                <li><strong>Репутация:</strong> завышение — клиенты уходят молча. Занижение — компания шьёт в убыток.</li>
              </ul>
            </GlassCard>

            <GlassCard accent="bg-emerald-500">
              <h3 className="font-bold text-emerald-700 mb-3">Позитивный сценарий</h3>
              <ul className="space-y-2 text-sm list-disc list-inside marker:text-emerald-400">
                <li>Ручной расчёт с запросом паспортов изделий → погрешность ниже 10%.</li>
                <li>SYNTAX способен не только автоматизировать расчёт, но и выявлять расхождения между различными источниками данных — при условии получения обратной связи с производства.</li>
                <li>Сокращение погрешности с 60% до 10% высвобождает <strong>~117 млн ₽/год</strong> при нулевых инвестициях в расширение — только за счёт точности.</li>
                <li>Фурсов К.Н. готов к диалогу. Цыбрина А.М. владеет контекстом.</li>
                <li>Генеральный директор инициировал встречу. Это означает, что окно для системных изменений открыто.</li>
              </ul>
            </GlassCard>
          </div>

          <GlassCard accent="bg-emerald-500" className="max-w-3xl">
            <p className="text-[15px] font-semibold text-slate-800 leading-relaxed">
              Компания растёт не благодаря системе ценообразования, а <span className="text-red-600">вопреки</span> ей. При устранении описанной погрешности рост станет управляемым.
            </p>
          </GlassCard>
        </section>

        {/* ══ ПОЗИЦИЯ ══ */}
        <section id="position">
          <SectionHeading>Позиция автора — Артешин И.</SectionHeading>
          <GlassCard accent="bg-emerald-500" className="max-w-3xl">
            <p className="text-[15px] leading-relaxed mb-4">
              Прежде чем приступать к разработке глобального решения в третий раз, данный вопрос необходимо вынести на{' '}
              <span className="font-bold text-emerald-700">консилиум</span>. Настоящий документ составлен для этой цели.
            </p>
            <p className="text-base font-bold text-slate-900">
              Лучше считать медленно, но точно — чем быстро, но с двумя неизвестными.
            </p>
          </GlassCard>
        </section>

        {/* ══ ПРИЛОЖЕНИЯ ══ */}
        <section id="appendices">
          <SectionHeading>Приложения</SectionHeading>
          <GlassCard className="max-w-2xl">
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
              <li>Таблица «Расход ткани и наполнителя для стандартных изделий» (xlsx, 3 010 строк)</li>
              <li>Заказ клиента «Этра» (xlsx, 76 позиций) — конкретный пример использования</li>
              <li>Транскрибизация встречи Артешин — Цыбрина А.М. (27.05.2026)</li>
              <li>Приказ Ф1А-11 (13.05.2026) — создание ПТО</li>
            </ol>
          </GlassCard>
        </section>
      </main>

      <footer className="mt-20 bg-slate-900 text-slate-500 text-xs py-6 text-center">
        <p>ГК «КОРДА» — Площадь Шрёдингера — Внутренний документ</p>
        <p className="mt-1">Версия 1.1 · 29.05.2026</p>
      </footer>

      {showTop && (
        <button onClick={() => document.getElementById('consilium-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-600 transition-all hover:scale-110"
          aria-label="Наверх">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default ConsiliumApp;
