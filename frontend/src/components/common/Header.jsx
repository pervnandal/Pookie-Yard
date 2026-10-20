import React from 'react';
import { Icons } from './Icons';
import ThemeMoodSwitcher from './ThemeMoodSwitcher';
import { getPartnerNames } from '../../utils/userIdentity';

export const Header = ({
  onAddClick,
  activeTab,
  setActiveTab,
  onLogout,
  themeKey,
  onChangeTheme,
  partnerRole,
  onTogglePartnerRole
}) => {
  const ANNIVERSARY_DATE = '2026-05-04';
  const names = getPartnerNames();

  const calculateDaysTogether = () => {
    const start = new Date(ANNIVERSARY_DATE);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const isHis = partnerRole === 'partner_his';

  return (
    <header className="sticky top-0 z-[100] w-full bg-white/60 backdrop-blur-2xl border-b border-white/60 shadow-xs transition-colors">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 sm:h-20 gap-2">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span className="text-2xl sm:text-3xl drop-shadow-sm">🌸</span>
            <h1 className="text-2xl font-serif font-bold text-stone-800 tracking-tight hidden lg:block drop-shadow-sm">
              The <span className="text-rose-500 italic">Us</span> Space
            </h1>
          </div>

          {/* 4 Main Tabs: Home · Vault · Chronicle · Planner */}
          <nav className="flex items-center space-x-3.5 sm:space-x-7">
            {[
              { id: 'home', label: 'Home' },
              { id: 'vault', label: 'Vault', desktopPrefix: 'Memory ' },
              { id: 'chronicle', label: 'Chronicle' },
              { id: 'planner', label: 'Planner' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`text-xs sm:text-base font-medium pb-1 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${activeTab === t.id
                    ? 'text-rose-600 border-rose-500 font-bold'
                    : 'text-stone-600 border-transparent hover:text-stone-900'
                  }`}
              >
                {t.desktopPrefix && <span className="hidden sm:inline">{t.desktopPrefix}</span>}
                {t.label}
              </button>
            ))}
          </nav>

          {/* Right Corner Controls: Partner Badge + Days + Add (Desktop) + Theme Switcher (Both) + Lock */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Active Partner Identity Pill (Click to switch between Him & Her) */}
            <button
              type="button"
              onClick={onTogglePartnerRole}
              title="Click to switch active partner on this device (syncs Chat, POVs & Widget)"
              className="flex items-center gap-1 bg-white/75 hover:bg-rose-50 px-2.5 py-1.5 rounded-full border border-stone-200/80 shadow-2xs text-xs font-bold text-stone-700 cursor-pointer transition-all"
            >
              <span>{isHis ? '🤵' : '👰'}</span>
              <span className="hidden sm:inline max-w-[70px] truncate">
                {names[partnerRole] || (isHis ? 'Him' : 'Her')}
              </span>
            </button>

            <div className="hidden md:flex items-center gap-1.5 bg-white/70 backdrop-blur-sm px-3.5 py-1.5 rounded-full border border-white/80 shadow-2xs">
              <span className="text-rose-500 animate-pulse text-xs">❤️</span>
              <span className="text-xs font-bold text-rose-600 font-sans whitespace-nowrap">
                {calculateDaysTogether()} Days
              </span>
            </div>

            <button
              type="button"
              onClick={onAddClick}
              className="hidden md:flex bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-md items-center gap-1.5 cursor-pointer"
            >
              <Icons.Plus /> <span>Add</span>
            </button>

            {/* Theme Change Option at Right Corner of Top Dock for BOTH Laptop & Mobile */}
            <ThemeMoodSwitcher
              themeKey={themeKey}
              onChangeTheme={onChangeTheme}
              compact
            />

            <button
              type="button"
              onClick={onLogout}
              className="text-stone-500 hover:text-rose-500 transition-colors p-1.5 cursor-pointer"
              title="Lock Vault / Switch User"
            >
              <Icons.Lock />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;