import React from 'react';
import { Icons } from './Icons';

export const Header = ({ onAddClick, activeTab, setActiveTab, onLogout }) => {
  const ANNIVERSARY_DATE = "2026-05-04"; 
  
  const calculateDaysTogether = () => {
    const start = new Date(ANNIVERSARY_DATE); 
    const today = new Date();
    const diffTime = Math.abs(today - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <header className="sticky top-0 z-[100] w-full bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🌸</span>
            <h1 className="text-2xl font-serif font-bold text-stone-800 tracking-tight hidden lg:block">
              The <span className="text-rose-500 italic">Us</span> Space
            </h1>
          </div>
          
          <nav className="flex items-center space-x-3 sm:space-x-8">
            <button onClick={() => setActiveTab('vault')} className={`text-sm sm:text-base font-medium pb-1 whitespace-nowrap transition-colors ${activeTab === 'vault' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-stone-500 md:hover:text-stone-800'}`}>
              <span className="hidden sm:inline">Memory </span>Vault
            </button>
            <button onClick={() => setActiveTab('chronicle')} className={`text-sm sm:text-base font-medium pb-1 whitespace-nowrap transition-colors ${activeTab === 'chronicle' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-stone-500 md:hover:text-stone-800'}`}>
              Chronicle
            </button>
            <button onClick={() => setActiveTab('planner')} className={`text-sm sm:text-base font-medium pb-1 whitespace-nowrap transition-colors ${activeTab === 'planner' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-stone-500 md:hover:text-stone-800'}`}>
              Planner
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 bg-rose-50 px-4 py-1.5 rounded-full border border-rose-100 shadow-sm mr-1">
               <span className="text-rose-500 animate-pulse text-xs">❤️</span>
               <span className="text-xs font-bold text-rose-600 font-sans whitespace-nowrap">{calculateDaysTogether()} Days</span>
            </div>
            <button 
              onClick={onAddClick}
              className="bg-stone-900 md:hover:bg-stone-800 text-white p-2 sm:px-5 sm:py-2.5 rounded-full font-medium transition-all shadow-sm md:hover:shadow-md transform md:hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Icons.Plus /> <span className="hidden sm:inline">Add</span>
            </button>
            <button onClick={onLogout} className="text-stone-400 md:hover:text-rose-500 transition-colors p-2 hidden sm:block" title="Lock Vault">
              <Icons.Lock />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;