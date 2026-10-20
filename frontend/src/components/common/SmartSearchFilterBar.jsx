import React, { useState, useMemo } from 'react';
import { extractVaultMeta } from '../../utils/vaultMetaUtils';

const DEFAULT_QUICK_TAGS = ['#date', '#birthday', '#trip', '#food', '#ldr', '#anniversary'];

export const SmartSearchFilterBar = ({
    memories,
    searchQuery,
    setSearchQuery,
    selectedTag,
    setSelectedTag,
    mediaTypeFilter,
    setMediaTypeFilter
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const availableTags = useMemo(() => {
        const set = new Set(DEFAULT_QUICK_TAGS);
        (memories || []).forEach((m) => {
            const { meta } = extractVaultMeta(m);
            (meta.tags || []).forEach((t) => set.add(t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`));
        });
        return Array.from(set).slice(0, 12);
    }, [memories]);

    const hasActiveFilters = Boolean(searchQuery.trim() || selectedTag || mediaTypeFilter !== 'all');

    return (
        <div className="max-w-3xl mx-auto w-full mt-5 px-2 relative z-20">
            <div className="flex items-center justify-center gap-2">
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        value={searchQuery}
                        onFocus={() => setIsExpanded(true)}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="🔍 Search albums, His/Her POV, #tags, captions..."
                        className="w-full bg-white/80 focus:bg-white backdrop-blur-xl border border-white/90 focus:border-rose-400 rounded-full pl-4 pr-9 py-2 text-xs sm:text-sm text-stone-800 shadow-sm focus:outline-none transition-all"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className={`px-3.5 py-2 rounded-full text-xs font-bold border transition-all flex items-center gap-1 cursor-pointer ${isExpanded || hasActiveFilters
                            ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                            : 'bg-white/80 hover:bg-white text-stone-700 border-white/90 shadow-sm'
                        }`}
                >
                    <span>🏷️ Filters</span>
                    {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </button>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchQuery('');
                            setSelectedTag(null);
                            setMediaTypeFilter('all');
                        }}
                        className="px-3 py-2 rounded-full text-xs font-bold bg-stone-900 text-white hover:bg-stone-800 transition-all"
                    >
                        Reset
                    </button>
                )}
            </div>

            {isExpanded && (
                <div className="mt-3 bg-white/85 backdrop-blur-2xl border border-white/90 rounded-3xl p-3.5 shadow-lg space-y-3 animate-in fade-in duration-150">
                    {/* Media Type Filter Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mr-1">Media:</span>
                        {[
                            { id: 'all', label: '✨ All Albums' },
                            { id: 'photo', label: '📸 Has Photos' },
                            { id: 'video', label: '🎬 Has Videos' },
                            { id: 'voice', label: '🎤 Has Voice Notes' }
                        ].map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setMediaTypeFilter(m.id)}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${mediaTypeFilter === m.id
                                        ? 'bg-stone-900 text-white shadow-xs'
                                        : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                                    }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Smart Hashtag Filter Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mr-1">Tags:</span>
                        {availableTags.map((tag) => {
                            const active = selectedTag === tag;
                            return (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setSelectedTag(active ? null : tag)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${active
                                            ? 'bg-rose-500 text-white shadow-xs'
                                            : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/70'
                                        }`}
                                >
                                    {tag}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SmartSearchFilterBar;