import React, { useState, useMemo } from 'react';
import { Icons } from '../common/Icons';
import { parseMediaUrl } from '../../utils/mediaParser';
import { extractVaultMeta } from '../../utils/vaultMetaUtils';
import SmartSearchFilterBar from '../common/SmartSearchFilterBar';
import MemoryCard from './MemoryCard';
import VaultPinPad from './VaultPinPad';

export const VaultView = ({
    memories,
    isLoading,
    vaultCategory,
    setVaultCategory,
    isPrivateUnlocked,
    setIsPrivateUnlocked,
    selectedDateFilter,
    setSelectedDateFilter,
    hasMore,
    onLoadMore,
    onOpenAddModal,
    onOpenMemory,
    onRenameAlbum,
    onToggleConstant,
    onTogglePrivate,
    onCycleTheme,
    onSetTimeCapsule,
    onDeleteAlbum,
    showDialog
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState(null);
    const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
    const [showSearchBar, setShowSearchBar] = useState(false);

    const matchesSearchAndFilters = (m) => {
        const { cleanDescription, meta } = extractVaultMeta(m);

        if (selectedTag) {
            const normalized = selectedTag.toLowerCase();
            const hasTag = (meta.tags || []).some((t) => t.toLowerCase() === normalized);
            if (!hasTag) return false;
        }

        if (mediaTypeFilter !== 'all') {
            const mediaList = m.memory_media || [];
            const hasMatch = mediaList.some((item) => {
                const p = parseMediaUrl(item.file_url);
                if (mediaTypeFilter === 'voice') return p.isVoice;
                if (mediaTypeFilter === 'video') return p.isYoutube || p.isLegacyVideo;
                if (mediaTypeFilter === 'photo') return !p.isVoice && !p.isYoutube && !p.isLegacyVideo;
                return true;
            });
            if (!hasMatch) return false;
        }

        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            const captionsText = Object.values(meta.captions || {}).join(' ');
            const haystack = `${m.title || ''} ${cleanDescription} ${meta.hisPov || ''} ${meta.herPov || ''} ${(meta.tags || []).join(' ')} ${captionsText} ${m.formattedDate || ''}`.toLowerCase();
            if (!haystack.includes(q)) return false;
        }

        return true;
    };

    const categorizedMemories = useMemo(() => {
        const timeline = [];
        const constant = [];
        const priv = [];

        (memories || []).forEach((m) => {
            if (!matchesSearchAndFilters(m)) return;
            const { meta } = extractVaultMeta(m);
            if (meta.isPrivate) {
                priv.push(m);
            } else if (meta.isConstant) {
                constant.push(m);
            } else {
                timeline.push(m);
            }
        });

        return { timeline, constant, priv };
    }, [memories, searchQuery, selectedTag, mediaTypeFilter]);

    const displayedTimelineMemories = useMemo(() => {
        const base = categorizedMemories.timeline;
        if (!selectedDateFilter) return base;
        return base.filter((m) => m.memory_date && m.memory_date.startsWith(selectedDateFilter));
    }, [categorizedMemories.timeline, selectedDateFilter]);

    const memoriesGroupedByYear = useMemo(() => {
        const groups = new Map();
        displayedTimelineMemories.forEach((mem) => {
            const yr = mem.memory_date ? mem.memory_date.slice(0, 4) : 'Timeless';
            if (!groups.has(yr)) groups.set(yr, []);
            groups.get(yr).push(mem);
        });

        return Array.from(groups.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([yr, list]) => {
                const sortedDecToJan = [...list].sort((a, b) =>
                    String(b.memory_date || '').localeCompare(String(a.memory_date || ''))
                );

                let photos = 0;
                let videos = 0;
                let voices = 0;
                sortedDecToJan.forEach((album) => {
                    (album.memory_media || []).forEach((item) => {
                        const p = parseMediaUrl(item.file_url);
                        if (p.isVoice) voices += 1;
                        else if (p.isYoutube || p.isLegacyVideo) videos += 1;
                        else photos += 1;
                    });
                });

                return {
                    year: yr,
                    albums: sortedDecToJan,
                    stats: { albumsCount: sortedDecToJan.length, photos, videos, voices }
                };
            });
    }, [displayedTimelineMemories]);

    const handleMemoryRoulette = () => {
        const pool =
            vaultCategory === 'private' && isPrivateUnlocked
                ? categorizedMemories.priv
                : vaultCategory === 'constant'
                    ? categorizedMemories.constant
                    : categorizedMemories.timeline;

        const nonEmpty = pool.filter((m) => m.memory_media && m.memory_media.length > 0);
        const targetPool = nonEmpty.length > 0 ? nonEmpty : pool;
        if (targetPool.length === 0) return;

        const randomAlbum = targetPool[Math.floor(Math.random() * targetPool.length)];
        const mediaCount = randomAlbum.memory_media?.length || 0;
        const randomIdx = mediaCount > 0 ? Math.floor(Math.random() * mediaCount) : 0;

        onOpenMemory(
            { ...randomAlbum, initialMediaIndex: randomIdx, _openTrigger: Date.now() },
            randomIdx
        );
    };

    const hasActiveSearch = Boolean(searchQuery.trim() || selectedTag || mediaTypeFilter !== 'all');

    return (
        <div className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8 py-5 sm:py-8 pb-32">
            {/* Compact, High-Vibe Vault Header */}
            <div className="text-center mb-7 relative z-10">
                <h2 className="text-3xl sm:text-5xl font-serif text-stone-800 mb-1.5 tracking-tight drop-shadow-xs">
                    Our Memory Vault
                </h2>
                <p className="text-stone-600 max-w-xl mx-auto text-xs sm:text-base">
                    A secure collection of our favorite days, biggest adventures, and quietest moments.
                </p>

                {/* Single Sleek Control Row: Category Switcher + Compact Search Icon + Roulette Dice */}
                <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                    <div className="vault-surface inline-grid grid-cols-3 bg-white/80 backdrop-blur-xl p-1 rounded-full border border-white/85 shadow-sm w-full max-w-[370px] sm:max-w-[420px]">
                        {[
                            { id: 'timeline', label: '🗓️ Timeline', count: categorizedMemories.timeline.length },
                            { id: 'constant', label: '📌 Constant', count: categorizedMemories.constant.length },
                            {
                                id: 'private',
                                label: '🔒 Private',
                                count: isPrivateUnlocked ? categorizedMemories.priv.length : '•'
                            }
                        ].map((tab) => {
                            const active = vaultCategory === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setVaultCategory(tab.id)}
                                    className={`px-2 py-1.5 rounded-full text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer whitespace-nowrap ${active
                                            ? 'bg-rose-500 text-white shadow-xs'
                                            : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={`text-[10px] min-w-[18px] px-1 rounded-full text-center ${active ? 'bg-white/25 text-white' : 'bg-stone-200/70 text-stone-600'
                                            }`}
                                    >
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Compact Search Toggle Button */}
                    <button
                        type="button"
                        onClick={() => setShowSearchBar((prev) => !prev)}
                        title="Search & Filter Albums"
                        className={`h-9 px-3 rounded-full text-xs font-bold border shadow-sm transition-all flex items-center gap-1 cursor-pointer ${showSearchBar || hasActiveSearch
                                ? 'bg-rose-500 text-white border-rose-500'
                                : 'vault-surface bg-white/80 hover:bg-white text-stone-700 border-white/85'
                            }`}
                    >
                        <span>🔍</span>
                        <span className="hidden sm:inline">Search</span>
                    </button>

                    {/* Memory Roulette Button */}
                    <button
                        type="button"
                        onClick={handleMemoryRoulette}
                        title="Memory Roulette: Open a random memory!"
                        className="vault-surface h-9 bg-white/80 hover:bg-rose-500 text-stone-700 hover:text-white backdrop-blur-xl border border-white/85 px-3 rounded-full text-xs font-bold shadow-sm transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                        <span>🎲</span>
                        <span className="hidden sm:inline">Surprise Us</span>
                    </button>
                </div>

                {/* Collapsible Smart Search & Filter Bar */}
                {(showSearchBar || hasActiveSearch) && (
                    <SmartSearchFilterBar
                        memories={memories}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        selectedTag={selectedTag}
                        setSelectedTag={setSelectedTag}
                        mediaTypeFilter={mediaTypeFilter}
                        setMediaTypeFilter={setMediaTypeFilter}
                    />
                )}

                {selectedDateFilter && vaultCategory === 'timeline' && (
                    <div className="mt-3 flex justify-center">
                        <button
                            type="button"
                            onClick={() => setSelectedDateFilter(null)}
                            className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-1 rounded-full text-xs font-bold shadow-md transition-all flex items-center gap-2"
                        >
                            <span>
                                {selectedDateFilter.length === 4
                                    ? `Showing Year: ${selectedDateFilter}`
                                    : `Showing Date: ${selectedDateFilter}`}
                            </span>
                            <span>✕ Clear</span>
                        </button>
                    </div>
                )}
            </div>

            {/* TAB 1: TIMELINE VIEW */}
            {vaultCategory === 'timeline' && (
                <div className="w-full min-h-[55vh] relative z-10">
                    {isLoading && memories.length === 0 ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
                        </div>
                    ) : memoriesGroupedByYear.length === 0 ? (
                        <div className="vault-surface text-center py-20 text-stone-500 bg-white/50 backdrop-blur-md rounded-3xl border border-white/60 p-12 shadow-lg max-w-2xl mx-auto">
                            <span className="text-6xl mb-4 block">📸</span>
                            <p className="text-xl font-medium text-stone-700">Your timeline is waiting.</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-14">
                                {memoriesGroupedByYear.map(({ year: yearLabel, albums: yearMemories, stats }) => (
                                    <section key={yearLabel} className="w-full">
                                        <div className="mb-6 px-2">
                                            <div className="flex items-center gap-4">
                                                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-800 tracking-tight shrink-0">
                                                    {yearLabel}
                                                </h3>
                                                <div className="h-[2px] flex-1 bg-gradient-to-r from-stone-400/70 via-stone-300/50 to-transparent rounded-full" />
                                                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 hidden sm:inline">
                                                    Dec → Jan
                                                </span>
                                            </div>

                                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-500 font-medium">
                                                <span className="vault-surface bg-white/70 backdrop-blur-sm border border-stone-200/70 px-3 py-0.5 rounded-full shadow-2xs">
                                                    ✨ {stats.albumsCount} {stats.albumsCount === 1 ? 'Album' : 'Albums'}
                                                </span>
                                                {stats.photos > 0 && (
                                                    <span className="vault-surface bg-white/70 backdrop-blur-sm border border-stone-200/70 px-3 py-0.5 rounded-full shadow-2xs">
                                                        📸 {stats.photos} {stats.photos === 1 ? 'Photo' : 'Photos'}
                                                    </span>
                                                )}
                                                {stats.videos > 0 && (
                                                    <span className="vault-surface bg-white/70 backdrop-blur-sm border border-stone-200/70 px-3 py-0.5 rounded-full shadow-2xs">
                                                        🎬 {stats.videos} {stats.videos === 1 ? 'Video' : 'Videos'}
                                                    </span>
                                                )}
                                                {stats.voices > 0 && (
                                                    <span className="vault-surface bg-white/70 backdrop-blur-sm border border-stone-200/70 px-3 py-0.5 rounded-full shadow-2xs">
                                                        🎤 {stats.voices} {stats.voices === 1 ? 'Voice Note' : 'Voice Notes'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-10 gap-y-12 justify-items-center">
                                            {yearMemories.map((memory, idx) => (
                                                <MemoryCard
                                                    key={memory.id}
                                                    index={idx}
                                                    memory={memory}
                                                    onClick={(mem, fileIdx) => onOpenMemory(mem, fileIdx)}
                                                    onRenameClick={onRenameAlbum}
                                                    onToggleConstant={onToggleConstant}
                                                    onTogglePrivate={onTogglePrivate}
                                                    onCycleTheme={onCycleTheme}
                                                    onSetTimeCapsule={onSetTimeCapsule}
                                                    onDeleteClick={onDeleteAlbum}
                                                />
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>

                            {hasMore && !selectedDateFilter && (
                                <div className="flex justify-center mt-14">
                                    <button
                                        onClick={onLoadMore}
                                        className="vault-surface bg-white/70 backdrop-blur-md hover:bg-white text-stone-800 border border-white/60 px-8 py-3 rounded-full font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                                    >
                                        <Icons.Refresh /> Load More Memories
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* TAB 2: CONSTANT ALBUMS VIEW */}
            {vaultCategory === 'constant' && (
                <div className="w-full min-h-[55vh] relative z-10">
                    <div className="mb-8 px-2 flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-800 tracking-tight">
                                Constant Collections 📌
                            </h3>
                            <p className="text-xs text-stone-500 mt-1">
                                Timeless folders like Daily Widget Snaps and Favorites not tied to a single month.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onOpenAddModal}
                            className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md transition-all shrink-0 cursor-pointer"
                        >
                            + New Constant Folder
                        </button>
                    </div>

                    {categorizedMemories.constant.length === 0 ? (
                        <div className="vault-surface text-center py-16 text-stone-500 bg-white/50 backdrop-blur-md rounded-3xl border border-white/60 p-10 shadow-lg max-w-xl mx-auto">
                            <span className="text-5xl mb-3 block">📌</span>
                            <p className="text-lg font-serif font-bold text-stone-700">No Constant Folders Yet</p>
                            <p className="text-xs text-stone-500 mt-1 mb-5">
                                Create a Constant Folder or click the ··· menu on any existing folder and select "Make Constant Album 📌".
                            </p>
                            <button
                                type="button"
                                onClick={onOpenAddModal}
                                className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-md transition-all"
                            >
                                + Create First Constant Folder
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-10 gap-y-12 justify-items-center">
                            {categorizedMemories.constant.map((memory, idx) => (
                                <MemoryCard
                                    key={memory.id}
                                    index={idx}
                                    memory={memory}
                                    onClick={(mem, fileIdx) => onOpenMemory(mem, fileIdx)}
                                    onRenameClick={onRenameAlbum}
                                    onToggleConstant={onToggleConstant}
                                    onTogglePrivate={onTogglePrivate}
                                    onCycleTheme={onCycleTheme}
                                    onSetTimeCapsule={onSetTimeCapsule}
                                    onDeleteClick={onDeleteAlbum}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: PRIVATE VAULT VIEW */}
            {vaultCategory === 'private' && (
                <div className="w-full min-h-[55vh] relative z-10">
                    <div className="mb-8 px-2 flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-800 tracking-tight">
                                Private Sanctuary 🔒
                            </h3>
                            <p className="text-xs text-stone-500 mt-1">
                                Protected by your 4-digit secret PIN.
                            </p>
                        </div>
                        {isPrivateUnlocked && (
                            <button
                                type="button"
                                onClick={() => setIsPrivateUnlocked(false)}
                                className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md transition-all shrink-0 cursor-pointer"
                            >
                                🔒 Lock Sanctuary
                            </button>
                        )}
                    </div>

                    {!isPrivateUnlocked ? (
                        <VaultPinPad
                            onUnlock={() => setIsPrivateUnlocked(true)}
                            showDialog={showDialog}
                        />
                    ) : categorizedMemories.priv.length === 0 ? (
                        <div className="vault-surface text-center py-16 text-stone-500 bg-white/50 backdrop-blur-md rounded-3xl border border-white/60 p-10 shadow-lg max-w-xl mx-auto">
                            <span className="text-5xl mb-3 block">🔒</span>
                            <p className="text-lg font-serif font-bold text-stone-700">Your Private Sanctuary is Empty</p>
                            <p className="text-xs text-stone-500 mt-1 mb-5">
                                Create a Private Album or use the ··· menu on any folder to move it into your PIN-protected sanctuary.
                            </p>
                            <button
                                type="button"
                                onClick={onOpenAddModal}
                                className="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-md transition-all"
                            >
                                + Add Private Memory
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-10 gap-y-12 justify-items-center">
                            {categorizedMemories.priv.map((memory, idx) => (
                                <MemoryCard
                                    key={memory.id}
                                    index={idx}
                                    memory={memory}
                                    onClick={(mem, fileIdx) => onOpenMemory(mem, fileIdx)}
                                    onRenameClick={onRenameAlbum}
                                    onToggleConstant={onToggleConstant}
                                    onTogglePrivate={onTogglePrivate}
                                    onCycleTheme={onCycleTheme}
                                    onSetTimeCapsule={onSetTimeCapsule}
                                    onDeleteClick={onDeleteAlbum}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VaultView;