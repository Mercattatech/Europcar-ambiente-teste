"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

function generateMathChallenge() {
  const a = Math.floor(Math.random() * 20) + 3;
  const b = Math.floor(Math.random() * 15) + 2;
  const ops = ['+', '-', '×'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer: number;
  switch (op) {
    case '+': answer = a + b; break;
    case '-': answer = a - b; break;
    case '×': answer = a * b; break;
  }
  return { question: `${a} ${op} ${b}`, answer };
}

export default function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Math CAPTCHA
  const [challenge, setChallenge] = useState<{ question: string; answer: number } | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");

  // Rate limiting (client-side)
  const [attempts, setAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number>(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  const newChallenge = useCallback(() => {
    setChallenge(generateMathChallenge());
    setCaptchaInput("");
  }, []);

  useEffect(() => { newChallenge(); }, [newChallenge]);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockUntil <= Date.now()) { setLockCountdown(0); return; }
    const interval = setInterval(() => {
      const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
      if (remaining <= 0) { setLockCountdown(0); setLockUntil(0); clearInterval(interval); }
      else setLockCountdown(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Check lockout
    if (lockUntil > Date.now()) {
      setError(`Muitas tentativas. Aguarde ${Math.ceil((lockUntil - Date.now()) / 1000)}s.`);
      return;
    }

    // Validate CAPTCHA
    if (!challenge || parseInt(captchaInput) !== challenge.answer) {
      setError("Resposta da verificação matemática incorreta.");
      newChallenge();
      return;
    }

    setLoading(true);
    
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        // Progressive lockout: 3 erros = 30s, 5 erros = 60s, 7+ = 120s
        if (newAttempts >= 7) {
          setLockUntil(Date.now() + 120_000);
        } else if (newAttempts >= 5) {
          setLockUntil(Date.now() + 60_000);
        } else if (newAttempts >= 3) {
          setLockUntil(Date.now() + 30_000);
        }

        setError("E-mail ou senha incorretos.");
        newChallenge();
        setLoading(false);
      } else {
        setAttempts(0);
        window.location.assign(window.location.origin + "/painel");
      }
    } catch (err: any) {
      setError("Erro ao tentar fazer login. Tente novamente.");
      newChallenge();
      setLoading(false);
    }
  };

  const isLocked = lockUntil > Date.now();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-8">
         <div className="text-center mb-8">
            <h1 className="text-2xl font-black text-[#008d36] italic tracking-tight mb-2">Europcar <span className="text-gray-900 not-italic font-bold">Admin</span></h1>
            <p className="text-sm text-gray-500 font-bold">Faça login para acessar o painel</p>
         </div>

         {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded text-sm mb-4 font-bold text-center">
               {error}
            </div>
         )}

         {isLocked && (
            <div className="bg-amber-50 text-amber-700 border border-amber-200 p-3 rounded text-sm mb-4 font-bold text-center">
               🔒 Bloqueado por {lockCountdown}s após {attempts} tentativas inválidas
            </div>
         )}

        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">E-mail</label>
            <input 
              type="email" 
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-4 py-3 outline-none focus:border-[#008d36] text-gray-900" 
              placeholder="admin@email.com" 
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
            <input 
              type="password" 
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-4 py-3 outline-none focus:border-[#008d36] text-gray-900" 
              placeholder="••••••••" 
            />
          </div>

          {/* Math CAPTCHA */}
          <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Verificação de segurança</label>
            <div className="flex items-center gap-3">
              <div className="bg-gray-900 text-white font-mono font-bold px-4 py-2.5 rounded text-lg tracking-widest select-none">
                {challenge?.question || '...'}
              </div>
              <span className="text-gray-400 font-bold">=</span>
              <input
                type="number"
                required
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="w-20 border border-gray-300 rounded px-3 py-2.5 outline-none focus:border-[#008d36] text-center font-bold text-lg text-gray-900"
                placeholder="?"
              />
              <button
                type="button"
                onClick={newChallenge}
                className="p-2 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
                title="Nova conta"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
            </div>
          </div>

          <button 
             type="submit" 
             disabled={loading || isLocked}
             className="w-full bg-[#008d36] hover:bg-[#007a2d] text-white font-bold py-4 rounded transition-colors text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
             {loading ? 'Validando...' : isLocked ? `Bloqueado (${lockCountdown}s)` : 'Acessar Painel'}
          </button>
        </form>
        <div className="mt-4 text-center">
           <a href="/" className="text-sm font-bold text-gray-500 hover:text-gray-800">← Voltar ao site principal</a>
        </div>
      </div>
    </div>
  );
}
