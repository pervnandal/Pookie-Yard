import React, { useState } from 'react';
import { API_BASE_URL } from '../../utils/apiUtils';

export const LoginScreen = ({ onLogin, showDialog }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (response.ok) {
        onLogin();
      } else {
        showDialog({ type: 'alert', title: 'Access Denied', message: 'Incorrect credentials. This space is private.' });
      }
    } catch (error) {
      showDialog({ type: 'alert', title: 'Connection Error', message: 'Cannot reach the server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#faf9f8] font-sans flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute top-[-10%] left-[-10%] rounded-full mix-blend-multiply opacity-60 pointer-events-none z-[-1]" style={{ backgroundColor: '#fecdd3', width: '500px', height: '500px', filter: 'blur(100px)' }}></div>
      <div className="absolute bottom-[-10%] right-[-10%] rounded-full mix-blend-multiply opacity-60 pointer-events-none z-[-1]" style={{ backgroundColor: '#ffedd5', width: '400px', height: '400px', filter: 'blur(100px)' }}></div>
      <div className="absolute inset-0 pointer-events-none z-[-1]" style={{ opacity: 0.4, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.08) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>

      <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 sm:p-12 shadow-2xl border border-white max-w-md w-full z-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="text-5xl block mb-4 animate-bounce">🌸</span>
        <h1 className="text-3xl font-serif font-bold text-stone-800 tracking-tight mb-2">
          The <span className="text-rose-500 italic">Us</span> Space
        </h1>
        <p className="text-stone-500 mb-8 font-medium">Please enter your credentials to unlock the vault.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 transition-all text-stone-800 placeholder:text-stone-400"
              required
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 transition-all text-stone-800 placeholder:text-stone-400"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-stone-900 md:hover:bg-stone-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-md md:hover:shadow-lg disabled:opacity-70 mt-2 flex justify-center"
          >
            {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/40 border-t-white rounded-full"></span> : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;