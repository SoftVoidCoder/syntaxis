
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';

const KordaLogoLarge = () => (
  <img src="/logo.png" alt="Korda Logo" className="w-20 h-20 object-contain" />
);

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const resultError = await login(username, password);
    if (resultError) {
      setError(resultError);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-korda-200/30 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-10 relative z-10">

        <div className="flex flex-col items-center mb-8">
          <div className="w-28 h-28 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-lg border border-slate-100">
            <KordaLogoLarge />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Korda Syntax</h1>
          <p className="text-slate-500 mt-2 text-center">
            Интеллектуальная система управления
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Логин</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none transition-all placeholder-slate-400"
              placeholder=""
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-slate-900 focus:ring-2 focus:ring-korda-500 outline-none transition-all placeholder-slate-400"
              placeholder=""
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg text-center font-medium">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full py-3 text-lg font-bold shadow-lg shadow-korda-500/20 mt-2"
            isLoading={isLoading}
          >
            Войти
          </Button>
        </form>

        <div className="mt-10 pt-6 border-t border-slate-100/60 text-center opacity-60 hover:opacity-100 transition-opacity duration-500">
          <p className="text-[13px] font-serif italic text-slate-500 leading-relaxed px-4">
            «Когда мера становится целью, она перестает быть хорошей мерой»
          </p>
          <p className="text-[10px] text-slate-400 mt-2 font-medium tracking-widest uppercase">
            — Закон Гудхарта
          </p>
        </div>
      </div >
    </div >
  );
};
