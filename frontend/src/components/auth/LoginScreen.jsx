import React, { useState } from 'react';
import {
  getCurrentPartnerRole,
  setCurrentPartnerRole,
  getPartnerNames,
  setPartnerNames
} from '../../utils/userIdentity';

export const LoginScreen = ({ onLogin, showDialog }) => {
  const [passcode, setPasscode] = useState('');
  const [selectedRole, setSelectedRole] = useState(() => getCurrentPartnerRole());
  const [names, setNames] = useState(() => getPartnerNames());

  const SECRET_PASSCODE = import.meta.env.VITE_VAULT_PASSCODE || '0504';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (passcode === SECRET_PASSCODE) {
      setPartnerNames(names);
      setCurrentPartnerRole(selectedRole);
      onLogin(selectedRole);
    } else {
      showDialog({
        type: 'alert',
        title: 'Access Denied',
        message: 'Incorrect passcode. Only the two of us know the key to this space! 💕'
      });
      setPasscode('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#fdfcfb] flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(254, 205, 211, 0.6) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(251, 207, 232, 0.55) 0%, transparent 50%)'
        }}
      />

      <div className="bg-white/85 backdrop-blur-2xl border border-white/90 rounded-[2.5rem] p-8 sm:p-10 max-w-md w-full shadow-2xl text-center relative z-10">
        <span className="text-5xl block mb-3">🌸</span>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-800">
          The <span className="text-rose-500 italic">Us</span> Space
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1 mb-6">
          Choose who is logging in on this device so your chats, POVs, and widget sync to you.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Partner Identity Selector (Syncs Phone & Laptop) */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">
              Who is using this device?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'partner_his', icon: '🤵', defaultLabel: 'Him' },
                { id: 'partner_her', icon: '👰', defaultLabel: 'Her' }
              ].map((p) => {
                const active = selectedRole === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedRole(p.id)}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center gap-1.5 ${active
                        ? 'bg-rose-50/90 border-rose-500 shadow-md scale-[1.02]'
                        : 'bg-white/70 border-stone-200/80 opacity-75 hover:opacity-100'
                      }`}
                  >
                    <span className="text-2xl">{p.icon}</span>
                    <input
                      type="text"
                      value={names[p.id] || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setSelectedRole(p.id);
                        setNames((prev) => ({ ...prev, [p.id]: e.target.value }));
                      }}
                      placeholder={p.defaultLabel}
                      className="w-full text-center font-serif font-bold text-sm text-stone-800 bg-transparent border-b border-transparent focus:border-rose-400 focus:outline-none"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">
                      {active ? '✓ Selected' : 'Tap to select'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1.5">
              Secret Vault Passcode
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode..."
              autoFocus
              className="w-full bg-white border border-stone-200 rounded-2xl px-4 py-3.5 text-center text-lg tracking-widest focus:outline-none focus:border-rose-400 shadow-inner"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-stone-900 hover:bg-rose-600 text-white font-bold text-sm shadow-lg transition-all cursor-pointer"
          >
            Unlock As {names[selectedRole] || (selectedRole === 'partner_his' ? 'Him' : 'Her')} →
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;