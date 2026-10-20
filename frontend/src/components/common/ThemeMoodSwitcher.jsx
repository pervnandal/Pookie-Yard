import React from 'react';

export const THEME_MOODS = {
    rose: {
        id: 'rose',
        icon: '🌸',
        label: 'Rose Quartz',
        bgClass: 'bg-[#fdfcfb] text-stone-800',
        orbs: 'radial-gradient(circle at 12% 15%, rgba(254, 205, 211, 0.55) 0%, transparent 45%), radial-gradient(circle at 88% 28%, rgba(255, 237, 213, 0.55) 0%, transparent 42%), radial-gradient(circle at 30% 88%, rgba(251, 207, 232, 0.48) 0%, transparent 50%)'
    },
    golden: {
        id: 'golden',
        icon: '🌅',
        label: 'Golden Hour',
        bgClass: 'bg-[#fffaf3] text-stone-800',
        orbs: 'radial-gradient(circle at 15% 18%, rgba(253, 186, 116, 0.55) 0%, transparent 48%), radial-gradient(circle at 85% 25%, rgba(253, 224, 71, 0.45) 0%, transparent 45%), radial-gradient(circle at 35% 85%, rgba(254, 205, 211, 0.5) 0%, transparent 50%)'
    },
    midnight: {
        id: 'midnight',
        icon: '🌙',
        label: 'Midnight Starlight',
        bgClass: 'bg-[#13111c] text-stone-100',
        orbs: 'radial-gradient(circle at 15% 18%, rgba(139, 92, 246, 0.28) 0%, transparent 48%), radial-gradient(circle at 85% 25%, rgba(244, 63, 94, 0.24) 0%, transparent 45%), radial-gradient(circle at 35% 85%, rgba(56, 189, 248, 0.2) 0%, transparent 50%)'
    }
};

export const ThemeMoodSwitcher = ({ themeKey, onChangeTheme }) => {
    const keys = Object.keys(THEME_MOODS);
    const current = THEME_MOODS[themeKey] || THEME_MOODS.rose;

    const handleCycle = () => {
        const nextIdx = (keys.indexOf(current.id) + 1) % keys.length;
        onChangeTheme(keys[nextIdx]);
    };

    return (
        <button
            type="button"
            onClick={handleCycle}
            title={`Theme: ${current.label} (Click to switch mood)`}
            className="w-11 h-11 rounded-full bg-white/85 backdrop-blur-xl hover:bg-white text-stone-800 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 border border-white/80 flex items-center justify-center cursor-pointer"
        >
            <span className="text-lg">{current.icon}</span>
        </button>
    );
};

export default ThemeMoodSwitcher;