import React from 'react';
import { Calendar, CheckCircle, Lightbulb, Clock, ShieldAlert, ShieldCheck, Info } from 'lucide-react';

interface ChangelogEntry {
   id: string;
   date: string;
   title: string;
   version: string;
   content: React.ReactNode;
}

const entries: ChangelogEntry[] = [
   {
      id: '9',
      date: '2026-05-27',
      title: 'Детерминированная номенклатура, НДС-разбивка КП и оптимизация бизнес-логики',
      version: 'v0.9.98',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               Масштабный рефакторинг: замена AI-генерации названий на детерминированную формулу по стандарту ТУ,
               полная переработка таблицы КП с НДС-разбивкой, новые поля заявки, поиск по справочникам
               и исправление бизнес-логики расчётов.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-emerald-500"/>
                  Детерминированная номенклатура по ТУ
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Разделение на два этапа:</strong> Старый агент <code>generate_tu_name</code> (который «фантазировал» названия через AI) разделён на два: <code>extract_positions</code> (AI извлекает факты: тип оборудования, DN, модель, температуру) и <code>build_tu_name</code> (чистая формула без AI).</li>
                  <li><strong>Формула по стандарту ТУ:</strong> Название собирается строго по формуле: <code>Термочехол КОРДА ЧСТЭ-&#123;t&#125; &#123;серия&#125; &#123;аббр&#125;-&#123;DN&#125;-&#123;толщина&#125;</code>. Поддержка всех серий: ТА (арматура), У (стандарт), КИП (приборы), ТО (теплообменники), СК (сложная конфигурация).</li>
                  <li><strong>Поддержка КЗХ:</strong> Для защитных кожухов формула: <code>Кожух защитный химстойкий КЗХ-С-&#123;DN&#125; для &#123;тип&#125;</code>.</li>
                  <li><strong>Толщина из базы:</strong> Агент <code>select_materials</code> теперь извлекает <code>insulation_thickness</code> (мм) из колонки «Толщина, мм» таблицы материалов Google Sheets.</li>
                  <li><strong>Встроенный справочник:</strong> 27 типов оборудования с аббревиатурами (З, Ф, КШ, ЗД, ОКП, ОКМ, ФС, РС, КБ, КО, КТ, КС, КП, РД) и автоматическим определением серии — работает без ручной настройки.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-amber-500"/>
                  Новый пайплайн (8 этапов)
               </h4>
               <div className="bg-white border border-slate-100 rounded-lg p-3 font-mono text-xs text-slate-600 mt-1">
                  extract_positions → select_materials → resolve_parameters → resolve_dimensions → calculate_geometry → <span className="text-emerald-600 font-bold">build_tu_name</span> → calculate_cost → calculate_commercial
               </div>
               <p className="mt-2 text-xs text-slate-500">
                  Ключевое: <code>build_tu_name</code> стоит ПОСЛЕ сбора всех данных (DN, площадь, толщина), поэтому название формируется из фактов, а не из фантазий AI.
               </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-blue-500"/>
                  НДС-разбивка в Коммерческом Предложении (КП)
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Новые колонки КП:</strong> Цена/шт (без НДС), Цена/шт (с НДС), Сумма (без НДС), Сумма (с НДС) — 4 столбца вместо 2.</li>
                  <li><strong>Итоговая строка:</strong> ИТОГО с тремя показателями: Итого без НДС, Сумма НДС (22%), Итого с НДС.</li>
                  <li><strong>Заголовок спецификации:</strong> Над таблицей КП выводится: «Данная спецификация является приложением к коммерческому предложению №[номер]» (если заполнен номер КП).</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-amber-500"/>
                  Модалка заявки и бизнес-логика
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Номер КП:</strong> Добавлено поле «Номер коммерческого предложения» (например: КП-2026-0142).</li>
                  <li><strong>Название организации:</strong> Автозаполняется из контекста сделки Bitrix24.</li>
                  <li><strong>Погрешность вместо точности:</strong> Система отображает «Погрешность» в процентах с инвертированными цветами (низкая погрешность = зелёный, высокая = красный). Значения: Поиск 2%, Поиск+Знания 5%, Знания 10%, DN 30%, Ручное 0%.</li>
                  <li><strong>Распределение эскиза:</strong> Стоимость эскиза (350₽) размазывается по ВСЕМ позициям заявки (350/76 ≈ 4.61₽ каждая), а не дублируется.</li>
                  <li><strong>Разделение имён:</strong> Внутренний расчёт показывает только <code>tu_name</code>, КП показывает <code>tu_name</code> + серая подпись <code>raw_name</code> (имя заказчика).</li>
                  <li><strong>Убрана масса:</strong> Столбец массы удалён из базы размеров и кэша — неактуален для расчётов.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-indigo-500"/>
                  Поиск и Админка
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Поиск по базе размеров:</strong> Строка поиска в кэше (по raw_name, query, id). Счётчики фильтруются вместе с таблицей.</li>
                  <li><strong>Поиск по коэффициентам:</strong> Строка поиска по типу арматуры.</li>
                  <li><strong>Новые поля коэффициентов:</strong> В таблицу коэффициентов покрытия добавлены колонки «Аббревиатура ТУ» (текст) и «Серия» (выпадающий список: ТА, У, КИП, ТО, СК) — для переопределения встроенных значений.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Info size={16} className="text-slate-500"/>
                  Затронутые файлы (9)
               </h4>
               <div className="text-xs text-slate-500 font-mono space-y-0.5 ml-1">
                  <div>• api/agentTools.js — extract_positions, build_tu_name, insulation_thickness</div>
                  <div>• api/proxy.js — новый пайплайн 8 этапов</div>
                  <div>• services/geminiChat.ts — обновлён список инструментов</div>
                  <div>• components/ChatMessageBubble.tsx — НДС-колонки, итого, заголовок КП, имена</div>
                  <div>• components/conveyor/ConveyorChat.tsx — проброс orderNumber</div>
                  <div>• components/conveyor/CreateRequestModal.tsx — номер КП, организация</div>
                  <div>• components/conveyor/ConveyorApp.tsx — новые поля в handler</div>
                  <div>• pages/admin/AdminConveyorSettings.tsx — поиск + аббр./серия</div>
                  <div>• types.ts — abbreviation, series в CoverageCoefficient</div>
               </div>
            </div>
         </div>
      )
   },
   {
      id: '8',
      date: '2026-05-26',
      title: 'Рефакторинг Дашборда, Батчинг Конвейера и Детализация Расчётов',
      version: 'v0.9.75',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               Масштабное обновление: упрощение бизнес-логики конвейера, решение проблемы потери позиций при больших спецификациях, полная детализация внутренней таблицы расчётов и корректировка финансовых итогов.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-emerald-500"/>
                  Рефакторинг Дашборда и Канбана
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Удалён этап «Коммерческое»:</strong> Колонка и карточка «Коммерческое предложение» полностью убраны из дашборда и канбан-доски. В Firebase эта колонка была пуста — мёртвый код ликвидирован.</li>
                  <li><strong>Переименование «Доработка» → «Верификация»:</strong> Этап проверки расчёта переименован на всех экранах: дашборд, канбан, чат, кнопки действий. Отражает реальный бизнес-процесс.</li>
                  <li><strong>Объединение промптов:</strong> Два базовых промпта конвейера (<code>conveyor_calculation</code> + <code>conveyor_commercial</code>) объединены в один <code>conveyor</code>. Одна текстовая область в админке вместо двух. Обратная совместимость: при чтении из Firebase система подхватывает старый ключ.</li>
                  <li><strong>Упрощение статусов:</strong> Удалён <code>IN_PROGRESS</code> из конвейерного workflow. Кнопка «Взять в работу» теперь сразу ставит статус <code>VERIFIED</code>. Поток: Новая → На верификации → Верифицирована → Завершена.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-blue-500"/>
                  Батчинг Конвейера и Защита от Фантомов
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Батчинг по 20 позиций:</strong> Агент <code>generate_tu_name</code> теперь автоматически разбивает спецификации на батчи по ~20 строк. Это решило критический баг: при 49+ позициях агент терял 8 последних из-за лимита токенов. Поддерживается любое количество позиций (хоть 1000).</li>
                  <li><strong>Батчинг <code>select_materials</code>:</strong> Аналогичная логика для агента материалов — чанки по 20 элементов masterJson.</li>
                  <li><strong>Фильтр фантомных позиций:</strong> При батчинге ИИ иногда галлюцинировал лишние элементы (49 → 69). Внедрён строгий фильтр: после первого агента принимаются только элементы с ID из существующего masterJson. Фантомы отбрасываются с логированием.</li>
                  <li><strong>Телеметрия батчей:</strong> В логах отображается прогресс: «Батч 2/3 generate_tu_name...», что упрощает диагностику.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-amber-500"/>
                  Детализация Внутреннего Расчёта
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Расширенная таблица:</strong> Вкладка «Внутренний расчёт» теперь показывает 10 столбцов: №, Наименование, Кол-во, S м², Материалы, Работа, Нитки, Эскиз, Себес/шт, Итого (без НДС). Каждый столбец имеет свой цветовой акцент.</li>
                  <li><strong>Строка ИТОГО:</strong> Добавлены итоговые суммы по каждому столбцу расходов во внутренней таблице. Во вкладке «Спецификация КП» также добавлена строка ИТОГО с общей суммой (с НДС).</li>
                  <li><strong>Адаптивная ширина:</strong> Бабл чата с таблицей теперь растягивается на 100% ширины (вместо 75%), чтобы все 10 столбцов помещались.</li>
                  <li><strong>Корректные итоги в отчёте:</strong> Синтезатор получает точные суммы по статьям расходов (материалы, работа, нитки, эскизы) вместо ошибочного <code>row_total_no_vat</code>. Также передаются формулы расчёта с числами на примере первой позиции.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Info size={16} className="text-slate-500"/>
                  Затронутые файлы (11)
               </h4>
               <div className="text-xs text-slate-500 font-mono space-y-0.5 ml-1">
                  <div>• types.ts — убран IN_PROGRESS, unified ModePrompts</div>
                  <div>• prompts.ts, constants.ts, storage.ts — один промпт</div>
                  <div>• geminiChat.ts — без фаз</div>
                  <div>• ConveyorDashboard.tsx, ConveyorKanban.tsx — убрана колонка</div>
                  <div>• AdminConveyorSettings.tsx — один textarea</div>
                  <div>• ConveyorChat.tsx, ConveyorApp.tsx — кнопки и статусы</div>
                  <div>• NavigationContext.tsx — уведомления</div>
                  <div>• proxy.js — батчинг + фильтр фантомов</div>
                  <div>• agentTools.js — формулы + корректные итоги</div>
                  <div>• ChatMessageBubble.tsx — 10 столбцов + ИТОГО + ширина</div>
               </div>
            </div>
         </div>
      )
   },
   {
      id: '7',
      date: '2026-05-21',
      title: 'Поддержка Word-документов, умные Правила и бронебойный Синтезатор',
      version: 'v0.9.31',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               Глобальное обновление отказоустойчивости ИИ-конвейера: поддержка загрузки .docx файлов, улучшенная админка правил и исправление критических багов генерации больших ответов.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-emerald-500"/>
                  Интеграция .DOCX и стабильность генерации
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Распознавание Word-файлов:</strong> Внедрен алгоритм `mammoth.js`, который на лету извлекает сырой текст из загружаемых в заявку `.docx` файлов. Это решило давнюю проблему с падением ИИ (Vertex AI Error 400), который отказывался "читать" такие файлы.</li>
                  <li><strong>Отказоустойчивый Синтезатор:</strong> Полностью переписан алгоритм извлечения текста из сырых ответов нейросети. Теперь при создании гигантских КП, если ИИ утыкается в жесткие лимиты токенов, сервер не падает, а безопасно склеивает чанки и заставляет ИИ продолжить генерацию.</li>
                  <li><strong>Рендеринг интерфейса:</strong> Устранены баги с "белым экраном смерти" при открытии карточек и исправлены права видимости кнопок действий для администраторов.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-amber-500"/>
                  Умные Правила и Телеметрия
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Визуализация категорий:</strong> В админ-панели Конвейера (Дерево правил) внедрена цветовая маркировка. Зеленые маркеры обозначают правила для "Расчетов", желтые — для "Коммерческого". Иерархия (материнские и дочерние папки) стала интуитивно понятной.</li>
                  <li><strong>Прозрачность агентов:</strong> Логи телеметрии в чате обзавелись красивыми иконками для каждого агента. Теперь ИИ также указывает конкретные файлы и документы, к которым он обращался при поиске информации.</li>
                  <li><strong>Логика подбора материалов:</strong> Улучшены базовые правила: агенты научились четко различать однослойные (Кожух Защитный - КЗХ) и трехслойные (Термочехлы) изделия при подборе материалов.</li>
               </ul>
            </div>
         </div>
      )
   },
   {
      id: '6',
      date: '2026-05-21',
      title: 'Строгий Агентный Конвейер и Апгрейд Интеллекта',
      version: 'v9.1.3',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               Глобальный рефакторинг архитектуры ИИ-агентов. Переход от хаотичных вызовов функций (Parallel Router) к строгому последовательному Конвейеру (Pipeline).
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-emerald-500"/>
                  Архитектура Строгого Конвейера
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Каскадная передача:</strong> Агенты выстроены в строгую логическую цепочку: ТУ ➔ Материалы ➔ Геометрия ➔ Себестоимость ➔ КП ➔ Синтезатор.</li>
                  <li><strong>Изоляция спецификации:</strong> Внедрен перехват оригинального запроса пользователя. Теперь каждый агент в конвейере получает чистый исходный запрос, что исключило риск каскадного обрушения (эффект сломанного телефона).</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-amber-500"/>
                  Апгрейд Моделей и Токенов
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Pro-модели для Агентов:</strong> Базовые агенты (ТУ и Материалы) переведены со слабой Flash-модели на мощную Pro-модель (<code>gemini-3.1-pro-preview</code>). Теперь они без ошибок обрабатывают массивы по 100 позиций, сверяя их с гигантскими файлами правил ТУ.</li>
                  <li><strong>Расширение памяти:</strong> Лимит выходных токенов (<code>maxOutputTokens</code>) увеличен в 4 раза (до 8192) абсолютно везде. Система больше не "обрезает" огромные многостраничные расчеты.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-indigo-500"/>
                  Инъекция контекста и обход SDK
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Отказ от synthetic functionCall:</strong> Чтобы обойти баг строгой валидации <code>thought_signature</code> в новом SDK от Google, результаты работы агентов теперь добавляются в историю как текстовые системные логи, что сделало контекст понятнее и сэкономило токены.</li>
                  <li><strong>Скрытые инъекции:</strong> Внедрена система скрытого дописывания промптов для Синтезатора прямо перед генерацией (вынуждает его принудительно выводить сгенерированные ТУ-названия в итоговом ответе).</li>
                  <li><strong>Надежный экстрактор:</strong> Написан "пуленепробиваемый" алгоритм извлечения текста (Chunk Extraction), который корректно парсит данные от новой структуры API.</li>
               </ul>
            </div>
         </div>
      )
   },
   {
      id: '5',
      date: '2026-05-20',
      title: 'Объединение ролей в Конвейере и улучшение интерфейса',
      version: 'v7.4.5',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               Снятие жестких ролевых ограничений между менеджерами и сметчиками. Оптимизация интерфейса чата заявок для повышения удобства работы.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-emerald-500"/>
                  Универсальная Kanban-доска
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Единые колонки:</strong> Для менеджеров и сметчиков внедрена единая структура колонок: "Черновик", "Коммерческое" (вместо "На верификации/Ожидание"), "В работе", "КП Готово", "Завершено".</li>
                  <li><strong>Общие заявки:</strong> И менеджеры, и сметчики могут брать новые коммерческие запросы в работу без дополнительных ограничений.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-amber-500"/>
                  Улучшенный интерфейс (UI/UX)
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Разблокировка поля ввода:</strong> Снята жесткая блокировка чата для менеджеров. Теперь любая роль может отправлять сообщения в заявку на любом этапе.</li>
                  <li><strong>Нижняя панель действий:</strong> Кнопки изменения статусов ("В коммерческое", "Взять в работу", "Возврат", "Документы") перенесены из правого верхнего угла в удобную панель прямо над полем ввода.</li>
               </ul>
            </div>
         </div>
      )
   },
   {
      id: '4',
      date: '2026-05-19',
      title: 'Устранение критической уязвимости, ренейминг и UI/UX',
      version: 'v7.4.4',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               Срочный хотфикс системы безопасности, адаптация терминологии файлового аудита и унификация интерфейса.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <ShieldAlert size={16} className="text-red-500"/>
                  Безопасность и Доступ
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Заплатка для системы блокировок:</strong> Ранее статус "Заблокирован" игнорировался на уровне API. Теперь сервер (<code>api/db.js</code>) жестко проверяет статус <code>isBlocked</code> и запрещает авторизацию (статус 403).</li>
                  <li><strong>Фоновый сброс сессий:</strong> Если сотрудника блокируют во время активной работы, ядро приложения (<code>AuthContext</code>) распознает это при следующей фоновой синхронизации, стирает локальную сессию и принудительно выбрасывает пользователя.</li>
                  <li><strong>Скрытие функционала:</strong> Из интерфейса убраны модули "Внутренний чат" и "Настольное приложение" (до их полномасштабного релиза).</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-indigo-500"/>
                  UI/UX и Ренейминг
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>"Чтения" вместо "Уникальные":</strong> Протокол Windows SMB генерирует логи не только при первом открытии, но и при каждом переключении между открытыми документами. Метрика в Дашборде переименована в «Чтений файлов» для точного отражения интенсивности реальной работы.</li>
                  <li><strong>Иконки Конвейера:</strong> Во всех разделах (главное меню, админ-панель и шапка самого модуля) стандартные папки и слои заменены на кастомный контур Заводика (Factory) для повышения узнаваемости.</li>
                  <li><strong>Унификация подсветки:</strong> Стиль выделения активной вкладки в левом меню теперь приведен к единому премиум-дизайну (тёмно-бирюзовый фон, светящаяся иконка) для всех разделов платформы.</li>
               </ul>
            </div>
         </div>
      )
   },
   {
      id: '3',
      date: '2026-05-19',
      title: 'Удаление метрики "Кликов" и точная фильтрация папок (Server & Client)',
      version: 'v7.3.7',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               Полный рефакторинг логики сбора и отображения статистики файлового сервера. Система переведена с 
               подсчета "грязных кликов" на строгий учет взаимодействия исключительно с уникальными рабочими файлами.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-emerald-500"/>
                  Физическая фильтрация папок (Server-Side)
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Проверка через Test-Path:</strong> Серверный скрипт (<code>update_service.exe</code>) теперь аппаратно опрашивает жесткий диск сервера. Если лог ссылается на папку (даже с точкой в названии, например <code>.000</code>), лог моментально отбрасывается.</li>
                  <li><strong>Отказ от кликов:</strong> Метрика "Всего кликов" и "Всего открытий" навсегда вырезана из интерфейса системы (главные карточки, сетка сотрудников, модальное окно).</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-blue-500"/>
                  Исправление багов UI и анти-спама
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Отключение Anti-Burst фильтра:</strong> Ранее UI ошибочно удалял реальные файлы, если сотрудник открывал более 5 файлов за минуту (или если Проводник генерировал миниатюры). Теперь отображается 100% реальных рабочих файлов.</li>
                  <li><strong>Очистка форматов:</strong> Исправлен баг, из-за которого старые папки с точками (в базе данных) создавали огромную простыню фейковых "форматов" в модальном окне. Теперь форматы проходят строгую валидацию.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <ShieldAlert size={16} className="text-amber-500"/>
                  Оптимизация ядра сервера
               </h4>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Предотвращение коллапса (Timestamp Overflow):</strong> Исправлена критическая ошибка архивирования времени (переполнение 32-битного числа <code>[int]</code> при конвертации миллисекунд). Заменено на <code>[long]</code>, что спасло агента от фатальных сбоев.</li>
                  <li><strong>Снижение нагрузки на Firebase (-80%):</strong> За счет отсечения фонового шума ОС (<code>~$...</code>, <code>.tmp</code>, <code>.lnk</code>, <code>thumbs.db</code>) и папок прямо на уровне сервера, объем отправляемых данных в базу снизился на 80%.</li>
               </ul>
            </div>
         </div>
      )
   },
   {
      id: '2',
      date: '2026-05-18',
      title: 'Интеграция ИИ Аналитики Поведения (Файловый сервер)',
      version: 'v7.2.2',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               В модуль «Файловый сервер» внедрена продвинутая поведенческая аналитика на базе нейросети Gemini. 
               Система теперь не только собирает сырые логи кликов, но и формирует полноценный контекстный портрет 
               рабочего дня сотрудника для руководителя.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Lightbulb size={16} className="text-amber-500"/>
                  Глубокий анализ перерывов
               </h4>
               <p className="mb-2">
                  При оценке перерывов нейросеть получает список из <strong>3-х последних файлов</strong>, с которыми 
                  сотрудник взаимодействовал перед уходом. Это позволяет ИИ с высокой точностью отличать долгий 
                  перерыв для проектирования/чтения чертежа от реального простоя.
               </p>
               <ul className="list-disc list-inside space-y-1 ml-1 mt-2">
                  <li><strong>Определение артефактов поведения:</strong> Поиск аномалий на основе паттернов кликов.</li>
                  <li><strong>Полные пути файлов:</strong> ИИ выводит полные директории в конце отчета для точной верификации.</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-indigo-500"/>
                  Сессионное кэширование и Markdown
               </h4>
               <p className="mb-2">
                  Внедрена система кэширования истории диалога с ИИ в рамках сессии. При закрытии карточки сотрудника 
                  диалог не сбрасывается. Также добавлен полноценный рендер <strong>Markdown</strong> для 
                  форматирования отчетов (жирный текст, списки, таблицы).
               </p>
            </div>
         </div>
      )
   },
   {
      id: '1',
      date: '2026-05-18',
      title: 'Аналитика времени и перерывов (Файловый сервер)',
      version: 'v7.1.9',
      content: (
         <div className="space-y-4 text-slate-600 text-sm">
            <p>
               Полностью переработана логика подсчета рабочего времени сотрудников в модуле «Файловый сервер». 
               Ранее система считала грязный интервал (от первого до последнего клика за день), что приводило к искажению 
               данных, если сотрудник открыл файл утром, ушел по делам и открыл файл вечером.
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-indigo-500"/>
                  Алгоритм «Чистого времени» (Правило 30 минут)
               </h4>
               <p className="mb-2">
                  Теперь при расчете длительности работы скрипт анализирует паузу между каждыми двумя кликами. 
                  Если пауза превышает <strong>30 минут</strong>, этот отрезок вычитается из общего рабочего времени.
               </p>
               <ul className="list-disc list-inside space-y-1 ml-1">
                  <li><strong>Зеленая зона:</strong> Чистое время {`>=`} 6.5 часов (норма).</li>
                  <li><strong>Желтая зона:</strong> Чистое время от 4.5 до 6.5 часов.</li>
                  <li><strong>Красная зона:</strong> Чистое время {`<`} 4.5 часов (критично).</li>
               </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4">
               <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-emerald-500"/>
                  Аналитика перерывов
               </h4>
               <p className="mb-2">
                  Добавлен трекинг отлучек. Система фиксирует паузы от 15 минут в рабочее окно (строго с 09:00 до 18:00) и классифицирует их:
               </p>
               <ul className="space-y-2 ml-1 mt-3">
                  <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-300"></div> <strong>Короткие (15–30 мин):</strong> Разминка, перекур.</li>
                  <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400"></div> <strong>Средние (30–60 мин):</strong> Обед, совещания.</li>
                  <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> <strong>Долгие ({`>`} 60 мин):</strong> Длительное отсутствие.</li>
               </ul>
            </div>

            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-4 text-red-800">
               <h4 className="font-bold flex items-center gap-2 mb-1">
                  <ShieldAlert size={16} className="text-red-600"/>
                  Алерты в карточках
               </h4>
               <p>
                  Если у сотрудника зафиксирован «Долгий перерыв» ({`>`} 1 часа), на его карточке в главном списке автоматически 
                  появляется красный бейдж-уведомление для привлечения внимания руководства.
               </p>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4 text-blue-800">
               <h4 className="font-bold flex items-center gap-2 mb-1">
                  <Lightbulb size={16} className="text-blue-600"/>
                  Исправление багов навигации
               </h4>
               <p>
                  Устранена проблема со сдвигом дат. Ранее браузер автоматически конвертировал дату в локальный часовой пояс, 
                  из-за чего клик по кнопке «Вчера» мог перескочить день. Теперь навигация жестко привязана к формату YYYY-MM-DD.
               </p>
            </div>
         </div>
      )
   }
];

export const AdminChangelog: React.FC = () => {
   return (
      <div className="w-full max-w-4xl mx-auto pb-12 animate-in fade-in duration-300">
         <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Отчеты по проекту</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">Журнал обновлений и архитектурных решений</p>
         </div>

         <div className="relative border-l-2 border-slate-100 ml-4 space-y-12 pb-8">
            {entries.map((entry, index) => (
               <div key={entry.id} className="relative pl-8">
                  {/* Timeline dot */}
                  <div className="absolute -left-[11px] top-1.5 w-5 h-5 rounded-full bg-indigo-100 border-4 border-white flex items-center justify-center shadow-sm">
                     <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                        <div>
                           <div className="flex items-center gap-3 mb-1">
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-md">
                                 {entry.version}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                                 <Calendar size={14} />
                                 {entry.date}
                              </div>
                           </div>
                           <h3 className="text-xl font-bold text-slate-800">{entry.title}</h3>
                        </div>
                     </div>
                     
                     <div>
                        {entry.content}
                     </div>
                  </div>
               </div>
            ))}
         </div>
         
         <div className="text-center text-slate-400 text-sm font-medium pt-8 border-t border-slate-100 mt-8">
            Записи формируются командой разработки и доступны только руководителям.
         </div>
      </div>
   );
};
