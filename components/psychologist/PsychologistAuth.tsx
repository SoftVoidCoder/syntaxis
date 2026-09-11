import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '../Button';
import { hasPinSet, validatePin, setInitialPin, resetAllPsychologistData } from '../../services/psychologistStorage';

interface PsychologistAuthProps {
   onAuthenticated: (pin: string) => void;
}

export const PsychologistAuth: React.FC<PsychologistAuthProps> = ({ onAuthenticated }) => {
   const [isSetup, setIsSetup] = useState(false);
   const [pin, setPin] = useState('');
   const [confirmPin, setConfirmPin] = useState('');
   const [error, setError] = useState('');
   const [isLoading, setIsLoading] = useState(false);
   const [showResetConfirm, setShowResetConfirm] = useState(false);

   useEffect(() => {
      setIsSetup(!hasPinSet());
   }, []);

   const handleSetup = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (pin.length !== 4 || !/^\d+$/.test(pin)) {
         setError('ПИН-код должен состоять из 4 цифр');
         return;
      }
      if (pin !== confirmPin) {
         setError('ПИН-коды не совпадают');
         return;
      }

      setIsLoading(true);
      try {
         await setInitialPin(pin);
         onAuthenticated(pin);
      } catch (err: any) {
         setError(err.message || 'Ошибка при сохранении ПИН-кода');
      } finally {
         setIsLoading(false);
      }
   };

   const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (pin.length !== 4 || !/^\d+$/.test(pin)) {
         setError('ПИН-код должен состоять из 4 цифр');
         return;
      }

      setIsLoading(true);
      try {
         const isValid = await validatePin(pin);
         if (isValid) {
            onAuthenticated(pin);
         } else {
            setError('Неверный ПИН-код');
         }
      } catch (err) {
         setError('Ошибка при проверке ПИН-кода');
      } finally {
         setIsLoading(false);
      }
   };

   const handleReset = () => {
      resetAllPsychologistData();
      setIsSetup(true);
      setPin('');
      setConfirmPin('');
      setShowResetConfirm(false);
      setError('');
   };

   if (isSetup) {
      return (
         <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
               <Shield size={32} />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">Нейроментор Korda</h2>
            
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 shadow-sm">
               <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2 text-sm">
                  <ShieldAlert size={16} /> Полная конфиденциальность
               </h4>
               <p className="text-xs text-amber-700 leading-relaxed mb-2">
                  Ввиду психологической этики мы <strong>не сохраняем</strong> ваши переписки на наших серверах. Все диалоги хранятся исключительно локально в вашем браузере в надежно зашифрованном виде.
               </p>
               <div className="bg-amber-100/50 p-2 rounded border border-amber-200 mt-3 text-amber-800 text-xs">
                  <strong>Как проверить?</strong> Авторизуйтесь в Korda Syntax с другого браузера или устройства — ваших диалогов там не будет. Это 100% локальное хранилище.
               </div>
               <div className="bg-red-50 p-2 rounded border border-red-200 mt-2 text-red-700 text-xs flex items-start gap-2">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span><strong>Внимание:</strong> Если вы забудете свой ПИН-код, восстановить переписки будет <span className="underline">невозможно</span>. При сбросе ПИН-кода все данные безвозвратно удаляются.</span>
               </div>
            </div>

            <form onSubmit={handleSetup} className="w-full space-y-4">
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Придумайте ПИН-код (4 цифры)</label>
                  <input
                     type="text"
                     inputMode="numeric"
                     autoComplete="off"
                     data-lpignore="true"
                     data-form-type="other"
                     style={{ WebkitTextSecurity: 'disc' } as any}
                     maxLength={4}
                     className="w-full text-center tracking-[1em] font-mono text-2xl bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                     value={pin}
                     onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                     placeholder="••••"
                     required
                  />
               </div>
               <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Повторите ПИН-код</label>
                  <input
                     type="text"
                     inputMode="numeric"
                     autoComplete="off"
                     data-lpignore="true"
                     data-form-type="other"
                     style={{ WebkitTextSecurity: 'disc' } as any}
                     maxLength={4}
                     className="w-full text-center tracking-[1em] font-mono text-2xl bg-white border border-slate-300 rounded-lg p-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                     value={confirmPin}
                     onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                     placeholder="••••"
                     required
                  />
               </div>
               
               {error && <div className="text-red-500 text-sm font-bold text-center bg-red-50 p-2 rounded-lg">{error}</div>}
               
               <Button type="submit" disabled={isLoading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-lg py-3 shadow-lg shadow-indigo-500/30">
                  {isLoading ? 'Настройка...' : 'Начать работу'}
               </Button>
            </form>
         </div>
      );
   }

   // Login View
   return (
      <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto p-6 animate-in fade-in zoom-in-95 duration-300">
         <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-white">
            <KeyRound size={32} />
         </div>
         
         <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">Вход в кабинет</h2>
         <p className="text-sm text-slate-500 text-center mb-8">Введите ваш локальный ПИН-код для расшифровки локальных диалогов.</p>

         <form onSubmit={handleLogin} className="w-full space-y-6">
            <div>
               <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                  style={{ WebkitTextSecurity: 'disc' } as any}
                  maxLength={4}
                  className="w-full text-center tracking-[1em] font-mono text-3xl bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all"
                  value={pin}
                  onChange={(e) => {
                     const val = e.target.value.replace(/\D/g, '');
                     setPin(val);
                     if (val.length === 4 && !error) {
                        // Optional auto-submit
                     }
                  }}
                  placeholder="••••"
                  autoFocus
                  required
               />
               {error && <div className="text-red-500 text-sm font-bold text-center mt-3 bg-red-50 py-2 rounded-lg animate-in shake">{error}</div>}
            </div>
            
            <Button type="submit" disabled={isLoading || pin.length !== 4} className="w-full bg-slate-800 hover:bg-slate-900 text-lg py-3 shadow-xl shadow-slate-900/10">
               {isLoading ? 'Расшифровка...' : 'Войти'}
            </Button>
         </form>

         <div className="mt-8 text-center">
            {!showResetConfirm ? (
               <button onClick={() => setShowResetConfirm(true)} className="text-sm text-slate-400 hover:text-red-500 transition-colors underline underline-offset-4">
                  Забыли ПИН-код?
               </button>
            ) : (
               <div className="bg-red-50 p-4 rounded-xl border border-red-200 animate-in fade-in zoom-in relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                  <h4 className="font-bold text-red-800 text-sm mb-2">Сбросить ПИН-код?</h4>
                  <p className="text-xs text-red-700 mb-4 opacity-90">Внимание: это действие безвозвратно удалит все ваши локальные зашифрованные переписки.</p>
                  <div className="flex gap-2">
                     <Button variant="secondary" onClick={() => setShowResetConfirm(false)} className="flex-1 text-xs py-1.5 bg-white">Отмена</Button>
                     <Button onClick={handleReset} className="flex-1 text-xs py-1.5 bg-red-600 hover:bg-red-700 border-none">Удалить всё</Button>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
};
