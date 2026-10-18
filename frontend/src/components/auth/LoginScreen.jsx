import React, { useState } from 'react';
import { API_BASE_URL } from '../../utils/apiUtils';
import { Icons } from '../common/Icons';

export const LoginScreen = ({ onLogin, showDialog }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showDialog({ type: 'alert', title: 'Missing Credentials', message: 'Please enter both username and password.' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      if (response.ok) {
        onLogin();
      } else {
        const err = await response.json().catch(() => ({}));
        showDialog({
          type: 'alert',
          title: 'Access Denied',
          message: err.detail || 'Invalid username or password.'
        });
      }
    } catch {
      showDialog({
        type: 'alert',
        title: 'Connection Error',
        message: 'Cannot reach the server.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fdfcfb] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-rose-200 selection:text-rose-900">
      
      {/* Warm Floating Glassmorphism Orbs */}
      <div className="fixed top-[-10%] left-[-10%] rounded-full mix-blend-multiply opacity-60 pointer-events-none animate-[pulse_8s_ease-in-out_infinite]" style={{ backgroundColor: '#fecdd3', width: '500px', height: '500px', filter: 'blur(100px)' }}></div>
      <div className="fixed top-[20%] right-[-10%] rounded-full mix-blend-multiply opacity-60 pointer-events-none animate-[pulse_10s_ease-in-out_infinite_alternate]" style={{ backgroundColor: '#ffedd5', width: '400px', height: '400px', filter: 'blur(100px)' }}></div>
      <div className="fixed bottom-[-10%] left-[20%] rounded-full mix-blend-multiply opacity-50 pointer-events-none animate-[pulse_12s_ease-in-out_infinite]" style={{ backgroundColor: '#fbcfe8', width: '600px', height: '600px', filter: 'blur(120px)' }}></div>
      <div className="fixed inset-0 pointer-events-none" style={{ opacity: 0.4, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.08) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>

      {/* Classic Frosted Glass Login Box */}
      <div className="bg-white/70 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl shadow-2xl border border-white/80 w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <span className="text-5xl mb-3 block drop-shadow-sm">🌸</span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-800 tracking-tight">
            The <span className="text-rose-500 italic">Us</span> Space
          </h1>
          <p className="text-stone-500 text-sm mt-2">Enter our private credentials to unlock the vault.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5 ml-1">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username..."
              autoFocus
              className="w-full bg-white/80 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 transition-all shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5 ml-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/80 border border-stone-200 rounded-2xl px-4 py-3.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 transition-all shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-stone-900 hover:bg-stone-800 text-white font-medium py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
          >
            <Icons.Lock />
            <span>{isLoading ? 'Unlocking Vault...' : 'Unlock Vault'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;