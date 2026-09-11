
import React, { useState, useEffect } from 'react';
import { QuizDefinition, QuizSession, User, QuizQuestion, QuizDifficulty } from '../types';
import * as storage from '../services/storage';
import { getKnowledgeBaseFromFirebase, getQuizzesFromFirebase, getQuizSessionsFromFirebase, saveQuizSessionToFirebase } from '../services/firebaseService';
import { generateQuizQuestions, generateQuizExplanation } from '../services/geminiService';
import { Button } from '../components/Button';
import { ClipboardList, CheckCircle, Play, AlertTriangle, RotateCcw, Eye, ChevronDown, ChevronUp, Trophy, Target, Clock, HelpCircle, Loader2, Lightbulb, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type TestingTab = 'available' | 'history';

const DIFFICULTY_META: Record<QuizDifficulty, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  [QuizDifficulty.EASY]: { label: 'Базовый', emoji: '🟢', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  [QuizDifficulty.MEDIUM]: { label: 'Средний', emoji: '🟡', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
  [QuizDifficulty.HARD]: { label: 'Сложный', emoji: '🟠', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  [QuizDifficulty.EXTREME]: { label: 'Предельный', emoji: '🔴', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
};

const ALL_DIFFICULTIES: QuizDifficulty[] = [QuizDifficulty.EASY, QuizDifficulty.MEDIUM, QuizDifficulty.HARD, QuizDifficulty.EXTREME];

export const TestingZone: React.FC = () => {
  const { user } = useAuth();
  const [availableQuizzes, setAvailableQuizzes] = useState<QuizDefinition[]>([]);
  const [sessions, setSessions] = useState<QuizSession[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TestingTab>('available');

  // Active Session State
  const [activeSession, setActiveSession] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Difficulty picker state
  const [pickingDifficultyForQuiz, setPickingDifficultyForQuiz] = useState<string | null>(null);

  // Review state
  const [reviewSession, setReviewSession] = useState<QuizSession | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState<number | null>(null); // question index being explained



  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [cloudQuizzes, cloudSessions] = await Promise.all([
        getQuizzesFromFirebase(),
        getQuizSessionsFromFirebase()
      ]);

      setAvailableQuizzes(cloudQuizzes.filter(q => q.isActive));

      // Filter out broken sessions (no questions) caused by previous bug
      const validSessions = cloudSessions.filter(s => s.userId === user.id && s.questions && s.questions.length > 0);
      setSessions(validSessions);

    } catch (err: any) {
      console.error("Failed to load testing data:", err);
      setError("Ошибка загрузки тестов: " + err.message);
    }
  };

  const getSessionsForQuiz = (quizId: string) => {
    return sessions.filter(s => s.quizId === quizId && s.status === 'COMPLETED');
  };

  const getBestScoreForDifficulty = (quizId: string, difficulty: QuizDifficulty): QuizSession | null => {
    const diffSessions = sessions.filter(s => s.quizId === quizId && s.difficulty === difficulty && s.status === 'COMPLETED');
    if (diffSessions.length === 0) return null;
    return diffSessions.reduce((best, s) => {
      const bestPct = best.questions.length > 0 ? best.score / best.questions.length : 0;
      const sPct = s.questions.length > 0 ? s.score / s.questions.length : 0;
      return sPct > bestPct ? s : best;
    });
  };

  const isQuizFullyComplete = (quizId: string): boolean => {
    const extremeSession = getBestScoreForDifficulty(quizId, QuizDifficulty.EXTREME);
    return extremeSession !== null && extremeSession.score === extremeSession.questions.length;
  };

  const startQuiz = async (quiz: QuizDefinition, difficulty: QuizDifficulty) => {
    setIsLoading(true);
    setError('');
    setPickingDifficultyForQuiz(null);

    try {
      const knowledgeBase = await getKnowledgeBaseFromFirebase();

      // Generate questions with difficulty
      const questions = await generateQuizQuestions({
        topic: quiz.topic,
        questionCount: quiz.questionCount,
        category: quiz.category,
        difficulty,
        knowledgeBase
      });

      const newSession: QuizSession = {
        id: crypto.randomUUID(),
        quizId: quiz.id,
        userId: user!.id,
        username: user!.username,
        firstName: user!.firstName,
        lastName: user!.lastName,
        difficulty,
        startedAt: Date.now(),
        questions: questions,
        userAnswers: [],
        score: 0,
        status: 'IN_PROGRESS'
      };

      await saveQuizSessionToFirebase(newSession);
      setSessions(prev => [...prev, newSession]);
      setActiveSession(newSession);
      setCurrentQuestionIndex(0);
      setSelectedOption(null);

    } catch (e: any) {
      setError("Ошибка при создании теста. Попробуйте позже. " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = async () => {
    if (selectedOption === null || !activeSession) return;

    const updatedAnswers = [...activeSession.userAnswers];
    updatedAnswers[currentQuestionIndex] = selectedOption;

    const updatedSession = {
      ...activeSession,
      userAnswers: updatedAnswers
    };

    setActiveSession(updatedSession);
    await saveQuizSessionToFirebase(updatedSession);

    // If next question exists, move to it
    if (currentQuestionIndex < activeSession.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
    } else {
      // Finish quiz
      finishQuiz(updatedSession);
    }
  };

  const finishQuiz = async (session: QuizSession) => {
    let correctCount = 0;
    session.questions.forEach((q, idx) => {
      if (session.userAnswers[idx] === q.correctOptionIndex) {
        correctCount++;
      }
    });

    const completedSession: QuizSession = {
      ...session,
      completedAt: Date.now(),
      status: 'COMPLETED',
      score: correctCount
    };

    await saveQuizSessionToFirebase(completedSession);
    setActiveSession(null);
    setSessions(prev => prev.map(s => s.id === session.id ? completedSession : s));

    // Show review immediately
    setReviewSession(completedSession);
  };

  // ===== REVIEW SCREEN =====
  if (reviewSession) {
    const quiz = availableQuizzes.find(q => q.id === reviewSession.quizId);
    const percentage = reviewSession.questions.length > 0 ? Math.round((reviewSession.score / reviewSession.questions.length) * 100) : 0;
    const isPerfect = percentage === 100;
    const diffMeta = reviewSession.difficulty ? DIFFICULTY_META[reviewSession.difficulty] : null;

    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{quiz?.topic || 'Тест'}</h2>
              {diffMeta && (
                <span className={`inline-flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded mt-2 ${diffMeta.bgColor} ${diffMeta.color} border ${diffMeta.borderColor}`}>
                  {diffMeta.emoji} {diffMeta.label}
                </span>
              )}
            </div>
            <div className={`text-center p-4 rounded-xl ${isPerfect ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
              <div className={`text-3xl font-black ${isPerfect ? 'text-green-600' : percentage >= 70 ? 'text-korda-600' : 'text-red-500'}`}>{percentage}%</div>
              <div className="text-xs text-slate-500 font-medium mt-1">{reviewSession.score}/{reviewSession.questions.length} верных</div>
            </div>
          </div>
          {isPerfect && (
            <div className="bg-green-50 border border-green-200 p-3 rounded-xl text-green-700 font-medium flex items-center gap-2">
              <Trophy size={18} /> Идеальный результат! 🎉
            </div>
          )}
        </div>

        {/* Questions Review */}
        <div className="space-y-4 mb-8">
          {reviewSession.questions.map((q, idx) => {
            const userAns = reviewSession.userAnswers[idx];
            const isCorrect = userAns === q.correctOptionIndex;
            const existingExplanation = reviewSession.explanations?.[idx];
            const isDisputed = reviewSession.disputes?.[idx];
            const isLoadingThis = loadingExplanation === idx;

            const handleExplain = async () => {
              if (existingExplanation || isLoadingThis) return;
              setLoadingExplanation(idx);
              try {
                const explanation = await generateQuizExplanation(
                  q.questionText, q.options, q.correctOptionIndex, userAns
                );
                const updatedExplanations = { ...(reviewSession.explanations || {}), [idx]: explanation };
                const updatedSession = { ...reviewSession, explanations: updatedExplanations };
                setReviewSession(updatedSession);
                setSessions(prev => prev.map(s => s.id === reviewSession.id ? updatedSession : s));
                await saveQuizSessionToFirebase(updatedSession);
              } catch (e: any) {
                console.error('Explanation failed:', e);
              } finally {
                setLoadingExplanation(null);
              }
            };

            return (
              <div key={idx} className={`bg-white p-5 rounded-xl border-2 ${isCorrect ? 'border-green-200' : 'border-red-200'}`}>
                <p className="font-bold text-slate-800 mb-3 flex gap-2">
                  <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>{idx + 1}</span>
                  <span>{q.questionText}</span>
                </p>
                <ul className="space-y-2 ml-9">
                  {q.options.map((opt, oIdx) => (
                    <li key={oIdx} className={`px-3 py-2 rounded-lg border text-sm
                      ${oIdx === q.correctOptionIndex ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'border-transparent'}
                      ${oIdx === userAns && !isCorrect ? 'bg-red-50 border-red-200 text-red-800 line-through' : ''}
                      ${oIdx !== q.correctOptionIndex && oIdx !== userAns ? 'text-slate-500' : ''}
                    `}>
                      {opt}
                    </li>
                  ))}
                </ul>

                {/* Explanation for wrong answers */}
                {!isCorrect && (
                  <div className="ml-9 mt-3 space-y-2">
                    {existingExplanation ? (
                      <>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 flex gap-2">
                          <Lightbulb size={18} className="text-amber-500 shrink-0 mt-0.5" />
                          <span>{existingExplanation}</span>
                        </div>
                        {isDisputed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                            <Zap size={12} /> Оспорен
                          </span>
                        ) : (
                          <button
                            onClick={async () => {
                              const updatedDisputes = { ...(reviewSession.disputes || {}), [idx]: true };
                              const updatedSession = { ...reviewSession, disputes: updatedDisputes };
                              setReviewSession(updatedSession);
                              setSessions(prev => prev.map(s => s.id === reviewSession.id ? updatedSession : s));
                              await saveQuizSessionToFirebase(updatedSession);
                            }}
                            className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg border border-orange-200 transition-colors"
                          >
                            <Zap size={12} /> Оспорить
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={handleExplain}
                        disabled={isLoadingThis}
                        className="flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors disabled:opacity-50"
                      >
                        {isLoadingThis ? (
                          <><Loader2 size={14} className="animate-spin" /> Генерация...</>
                        ) : (
                          <><HelpCircle size={14} /> Почему?</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => setReviewSession(null)} className="gap-2">
            ← Назад к тестам
          </Button>
          {quiz && (
            <Button onClick={() => { setReviewSession(null); startQuiz(quiz, reviewSession.difficulty || QuizDifficulty.MEDIUM); }} className="gap-2">
              <RotateCcw size={16} /> Пересдать
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ===== ACTIVE TEST SCREEN =====
  if (activeSession) {
    const question = activeSession.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / activeSession.questions.length) * 100;
    const diffMeta = activeSession.difficulty ? DIFFICULTY_META[activeSession.difficulty] : null;

    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 m-6">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 text-sm font-medium">Вопрос {currentQuestionIndex + 1} из {activeSession.questions.length}</span>
              {diffMeta && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${diffMeta.bgColor} ${diffMeta.color} border ${diffMeta.borderColor}`}>
                  {diffMeta.emoji} {diffMeta.label}
                </span>
              )}
            </div>
            <span className="text-korda-600 font-bold bg-korda-50 px-2 py-1 rounded text-sm">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-korda-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-8 leading-relaxed">
            {question.questionText}
          </h2>

          <div className="space-y-4">
            {question.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOption(idx)}
                className={`w-full p-5 rounded-xl text-left border-2 transition-all ${selectedOption === idx
                  ? 'bg-korda-50 border-korda-500 text-korda-900 shadow-sm'
                  : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selectedOption === idx ? 'border-korda-500 bg-white' : 'border-slate-300'
                    }`}>
                    {selectedOption === idx && <div className="w-2.5 h-2.5 bg-korda-500 rounded-full" />}
                  </div>
                  <span className="font-medium text-lg">{opt}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
          <Button onClick={handleAnswer} disabled={selectedOption === null} className="w-full md:w-auto shadow-lg shadow-korda-500/10 py-3 px-8 text-lg">
            {currentQuestionIndex === activeSession.questions.length - 1 ? 'Завершить тест' : 'Следующий вопрос'}
          </Button>
        </div>
      </div>
    );
  }

  // ===== DASHBOARD VIEW =====

  const completedSessions = sessions
    .filter(s => s.status === 'COMPLETED')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto flex flex-col h-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-1">Центр тестирования</h1>
        <p className="text-slate-500 text-lg">Проверьте свои знания продуктов и стандартов Korda</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-6 flex items-center gap-2 font-medium">
          <AlertTriangle /> {error}
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-slate-200 flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-korda-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-800 font-bold">ИИ генерирует вопросы...</p>
            <p className="text-slate-500 text-sm mt-1">Это займет несколько секунд</p>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 shrink-0">
        <button
          onClick={() => setActiveTab('available')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'available'
              ? 'bg-white text-korda-700 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <Target size={18} />
          Доступные тесты
          {availableQuizzes.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'available' ? 'bg-korda-100 text-korda-700' : 'bg-slate-200 text-slate-500'
            }`}>
              {availableQuizzes.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-white text-korda-700 shadow-sm border border-slate-200'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
          }`}
        >
          <CheckCircle size={18} />
          История
          {completedSessions.length > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === 'history' ? 'bg-korda-100 text-korda-700' : 'bg-slate-200 text-slate-500'
            }`}>
              {completedSessions.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === 'available' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {availableQuizzes.length === 0 ? (
              <div className="md:col-span-2 text-slate-500 bg-white p-12 rounded-2xl text-center border border-dashed border-slate-200">
                <Target size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-medium text-slate-400">Нет назначенных тестов</p>
                <p className="text-sm text-slate-400 mt-1">Когда администратор создаст тесты, они появятся здесь</p>
              </div>
            ) : (
              availableQuizzes.map(quiz => {
                const fullyComplete = isQuizFullyComplete(quiz.id);
                const isPickingDifficulty = pickingDifficultyForQuiz === quiz.id;
                const inProgressSession = sessions.find(s => s.quizId === quiz.id && s.status === 'IN_PROGRESS');

                return (
                  <div key={quiz.id} className={`bg-white border-2 rounded-2xl p-6 transition-all ${fullyComplete ? 'border-green-200 bg-green-50/30' : 'border-slate-100 hover:border-slate-300 hover:shadow-lg'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1 min-w-0 mr-3">
                        <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                          <span className="truncate">{quiz.topic}</span>
                          {fullyComplete && <Trophy size={18} className="text-green-500 shrink-0" />}
                        </h4>
                        <p className="text-sm text-slate-500 font-medium bg-slate-50 inline-block px-2.5 py-1 rounded-lg border border-slate-200 mt-2">{quiz.questionCount} вопросов</p>
                      </div>
                      {inProgressSession ? (
                        <Button onClick={() => { setActiveSession(inProgressSession); setCurrentQuestionIndex(inProgressSession.userAnswers.length); setSelectedOption(null); }} className="shrink-0">
                          Продолжить
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setPickingDifficultyForQuiz(isPickingDifficulty ? null : quiz.id)}
                          variant={isPickingDifficulty ? 'secondary' : 'primary'}
                          className="gap-2 shrink-0"
                        >
                          {isPickingDifficulty ? 'Отмена' : <><Play size={16} /> Начать</>}
                        </Button>
                      )}
                    </div>

                    {/* Per-difficulty progress */}
                    <div className="flex gap-2 flex-wrap">
                      {ALL_DIFFICULTIES.map(d => {
                        const best = getBestScoreForDifficulty(quiz.id, d);
                        const meta = DIFFICULTY_META[d];
                        if (!best) return (
                          <span key={d} className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 border border-slate-200">
                            {meta.emoji} —
                          </span>
                        );
                        const pct = Math.round((best.score / best.questions.length) * 100);
                        const isPerfect = pct === 100;
                        return (
                          <span key={d} className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${isPerfect ? 'bg-green-100 text-green-700 border-green-200' : `${meta.bgColor} ${meta.color} ${meta.borderColor}`}`}>
                            {meta.emoji} {pct}%
                          </span>
                        );
                      })}
                    </div>

                    {/* Difficulty picker */}
                    {isPickingDifficulty && (
                      <div className="mt-5 pt-5 border-t border-slate-200 grid grid-cols-2 gap-2">
                        {ALL_DIFFICULTIES.map(d => {
                          const meta = DIFFICULTY_META[d];
                          const best = getBestScoreForDifficulty(quiz.id, d);
                          const bestPct = best ? Math.round((best.score / best.questions.length) * 100) : null;
                          return (
                            <button
                              key={d}
                              onClick={() => startQuiz(quiz, d)}
                              className={`p-3 rounded-xl border-2 text-left transition-all hover:shadow-md ${meta.borderColor} ${meta.bgColor} hover:scale-[1.02]`}
                            >
                              <div className={`font-bold ${meta.color} flex items-center gap-1`}>{meta.emoji} {meta.label}</div>
                              {bestPct !== null && (
                                <div className="text-xs text-slate-500 mt-1">Лучший: {bestPct}%</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-3">
            {completedSessions.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                <Clock size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-lg font-medium text-slate-400">История пуста</p>
                <p className="text-sm text-slate-400 mt-1">Пройдите тест, и результат появится здесь</p>
                <Button variant="secondary" onClick={() => setActiveTab('available')} className="mt-4 gap-2">
                  <Target size={16} /> Перейти к тестам
                </Button>
              </div>
            )}
            {completedSessions.map(session => {
              const quiz = availableQuizzes.find(q => q.id === session.quizId) || { topic: 'Удаленный тест' } as any;
              const percentage = Math.round((session.score / session.questions.length) * 100);
              const isPass = percentage >= 70;
              const isPerfect = percentage === 100;
              const diffMeta = session.difficulty ? DIFFICULTY_META[session.difficulty] : null;

              return (
                <div key={session.id} className={`bg-white border rounded-xl p-5 hover:shadow-md transition-all ${isPerfect ? 'border-green-200' : 'border-slate-200'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-800 text-lg truncate">{quiz.topic}</h4>
                        {isPerfect && <Trophy size={16} className="text-green-500 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {diffMeta && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${diffMeta.bgColor} ${diffMeta.color} border ${diffMeta.borderColor}`}>
                            {diffMeta.emoji} {diffMeta.label}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">{new Date(session.completedAt!).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="text-xs text-slate-400">{session.score}/{session.questions.length} верных</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xl font-black ${isPerfect ? 'text-green-600' : isPass ? 'text-korda-600' : 'text-red-500'}`}>
                        {percentage}%
                      </span>
                      <button
                        onClick={() => setReviewSession(session)}
                        className="text-korda-600 hover:text-korda-800 font-bold flex items-center gap-1.5 bg-korda-50 px-3 py-2 rounded-lg hover:bg-korda-100 transition-colors text-sm"
                      >
                        <Eye size={16} /> Ответы
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
