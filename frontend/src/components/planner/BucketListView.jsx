import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';
import { extractVaultMeta } from '../../utils/vaultMetaUtils';

export const GOAL_CATEGORIES = [
    { id: 'Date Dream', icon: '🌸', label: 'Date Dream', desc: 'Romantic date ideas', tint: 'from-rose-50 to-pink-50 border-rose-200 text-rose-700' },
    { id: 'Travel', icon: '✈️', label: 'Travel', desc: 'Trips & getaways', tint: 'from-sky-50 to-blue-50 border-sky-200 text-sky-700' },
    { id: 'LDR Night', icon: '💻', label: 'LDR Night', desc: 'Virtual date nights', tint: 'from-purple-50 to-indigo-50 border-purple-200 text-purple-700' },
    { id: 'Foodie', icon: '🍝', label: 'Foodie', desc: 'Cafes, street food & cooking', tint: 'from-amber-50 to-orange-50 border-amber-200 text-amber-700' },
    { id: 'Personal', icon: '🌟', label: 'Personal', desc: 'Everything else & personal goals', tint: 'from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700' }
];

export const BucketListView = ({ memories = [], onOpenMemory }) => {
    const [items, setItems] = useState([]);
    const [localAlbums, setLocalAlbums] = useState(() => {
        try {
            const cached = localStorage.getItem('us_memories_cache_v1');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [activeCategoryBox, setActiveCategoryBox] = useState('Date Dream');
    const [newGoalCategory, setNewGoalCategory] = useState('Date Dream');
    const [title, setTitle] = useState('');
    const [linkingItemId, setLinkingItemId] = useState(null);

    const fetchItems = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/ldr/status`);
            if (res.ok) {
                const data = await res.json();
                setItems(data.bucket_list || []);
            }
        } catch { }
    };

    // Guarantee albums are loaded even if user jumped straight to Planner -> Goals
    useEffect(() => {
        fetchItems();
        if (!memories || memories.length === 0) {
            fetch(`${API_BASE_URL}/api/memories?limit=50&offset=0`)
                .then((r) => r.json())
                .then((data) => {
                    if (Array.isArray(data) && data.length > 0) {
                        const formatted = data.map((item) => ({
                            ...item,
                            formattedDate: new Date(item.memory_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                timeZone: 'UTC'
                            })
                        }));
                        setLocalAlbums(formatted);
                    }
                })
                .catch(() => { });
        }
    }, [memories]);

    // Combine prop memories with fallback localAlbums and exclude Private albums
    const linkableAlbums = useMemo(() => {
        const source = memories && memories.length > 0 ? memories : localAlbums;
        return (source || []).filter((m) => {
            const { meta } = extractVaultMeta(m);
            return !meta.isPrivate;
        });
    }, [memories, localAlbums]);

    const handleSelectCategoryBox = (catId) => {
        setActiveCategoryBox(catId);
        setNewGoalCategory(catId);
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/ldr/bucket-list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim(), category: newGoalCategory })
            });
            if (res.ok) {
                const created = await res.json();
                setItems((prev) => [created, ...prev]);
                setActiveCategoryBox(newGoalCategory);
                setTitle('');
            }
        } catch { }
    };

    const handleToggle = async (item) => {
        const nextCompleted = !item.completed;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: nextCompleted } : i)));
        try {
            await fetch(`${API_BASE_URL}/api/ldr/bucket-list/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: nextCompleted })
            });
        } catch { }
    };

    const handleLinkAlbum = async (itemId, memoryId) => {
        setLinkingItemId(null);
        setItems((prev) =>
            prev.map((i) =>
                i.id === itemId
                    ? { ...i, completed: Boolean(memoryId), linked_memory_id: memoryId || null }
                    : i
            )
        );
        try {
            await fetch(`${API_BASE_URL}/api/ldr/bucket-list/${itemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    completed: Boolean(memoryId),
                    linked_memory_id: memoryId ? String(memoryId) : ''
                })
            });
        } catch { }
    };

    const handleDelete = async (id) => {
        setItems((prev) => prev.filter((i) => i.id !== id));
        try {
            await fetch(`${API_BASE_URL}/api/ldr/bucket-list/${id}`, { method: 'DELETE' });
        } catch { }
    };

    const normalizeCategory = (cat) => {
        const found = GOAL_CATEGORIES.find((c) => c.id.toLowerCase() === String(cat || '').toLowerCase());
        return found ? found.id : 'Personal';
    };

    const countsByCategory = useMemo(() => {
        const map = {};
        GOAL_CATEGORIES.forEach((c) => {
            map[c.id] = { total: 0, done: 0 };
        });
        items.forEach((item) => {
            const key = normalizeCategory(item.category);
            map[key].total += 1;
            if (item.completed) map[key].done += 1;
        });
        return map;
    }, [items]);

    const filteredItems = useMemo(
        () => items.filter((item) => normalizeCategory(item.category) === activeCategoryBox),
        [items, activeCategoryBox]
    );

    const activeBoxMeta = GOAL_CATEGORIES.find((c) => c.id === activeCategoryBox) || GOAL_CATEGORIES[0];

    return (
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
            {/* 1. FIXED FULL-WIDTH TOP "ADD GOAL" BAR */}
            <form
                onSubmit={handleAdd}
                className="w-full shrink-0 bg-white/75 backdrop-blur-md border-b border-stone-200/80 px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 z-10"
            >
                <select
                    value={newGoalCategory}
                    onChange={(e) => setNewGoalCategory(e.target.value)}
                    className="bg-white border border-stone-200/90 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-600 focus:outline-none focus:border-rose-400 shrink-0 cursor-pointer shadow-2xs"
                >
                    {GOAL_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.icon} {c.label}
                        </option>
                    ))}
                </select>

                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Add a new goal to ${newGoalCategory}...`}
                    className="flex-1 min-w-0 bg-white border border-stone-200/90 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-rose-400 shadow-inner"
                />

                <button
                    type="submit"
                    className="bg-stone-900 hover:bg-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer active:scale-95"
                >
                    + Add Goal
                </button>
            </form>

            {/* 2. BELOW TOP BAR: LEFT SIDE PANEL (5 CATEGORY BOXES) + RIGHT VIEWING AREA */}
            <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 overflow-hidden">

                {/* Left Side Panel: 5 Category Boxes */}
                <div className="w-full md:w-52 lg:w-60 shrink-0 bg-white/35 border-b md:border-b-0 md:border-r border-stone-200/70 p-3 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-2.5 custom-scrollbar">
                    {GOAL_CATEGORIES.map((cat) => {
                        const isSelected = activeCategoryBox === cat.id;
                        const stat = countsByCategory[cat.id] || { total: 0, done: 0 };

                        return (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleSelectCategoryBox(cat.id)}
                                className={`text-left p-3 rounded-2xl border transition-all shrink-0 w-40 md:w-full flex flex-col justify-between cursor-pointer ${isSelected
                                        ? `bg-gradient-to-br ${cat.tint} shadow-md scale-[1.02] ring-1 ring-rose-300`
                                        : 'bg-white/70 hover:bg-white border-stone-200/80 text-stone-700'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span className="text-xl">{cat.icon}</span>
                                    <span
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/80 text-stone-800' : 'bg-stone-100 text-stone-500'
                                            }`}
                                    >
                                        {stat.done}/{stat.total}
                                    </span>
                                </div>
                                <div className="mt-2">
                                    <span className="font-serif font-bold text-sm block truncate">{cat.label}</span>
                                    <span className="text-[10px] opacity-75 block truncate">{cat.desc}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Right Viewing Area */}
                <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto custom-scrollbar min-w-0">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-200/70">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-2xl">{activeBoxMeta.icon}</span>
                            <div className="min-w-0">
                                <h3 className="font-serif font-bold text-lg sm:text-xl text-stone-800 truncate">
                                    {activeBoxMeta.label} Goals
                                </h3>
                                <p className="text-xs text-stone-500 truncate">
                                    {countsByCategory[activeCategoryBox]?.done || 0} of{' '}
                                    {countsByCategory[activeCategoryBox]?.total || 0} completed in this box
                                </p>
                            </div>
                        </div>
                    </div>

                    {filteredItems.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-stone-400">
                            <span className="text-4xl mb-2">{activeBoxMeta.icon}</span>
                            <p className="text-sm font-medium text-stone-600">No goals in "{activeBoxMeta.label}" yet</p>
                            <p className="text-xs text-stone-400 mt-0.5">
                                Use the top bar above to add your first {activeBoxMeta.label} goal!
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {filteredItems.map((item) => {
                                const linkedAlbum = linkableAlbums.find(
                                    (m) => String(m.id) === String(item.linked_memory_id)
                                );
                                return (
                                    <div
                                        key={item.id}
                                        className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2 ${item.completed
                                                ? 'bg-emerald-50/55 border-emerald-200/80'
                                                : 'bg-white/85 border-stone-200/80 shadow-2xs'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(item.completed)}
                                                    onChange={() => handleToggle(item)}
                                                    className="w-4 h-4 accent-rose-500 rounded cursor-pointer shrink-0"
                                                />
                                                <span
                                                    className={`text-sm font-medium break-words min-w-0 flex-1 ${item.completed ? 'line-through text-stone-400' : 'text-stone-800'
                                                        }`}
                                                >
                                                    {item.title}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {linkedAlbum ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenMemory?.(linkedAlbum, 0)}
                                                            className="bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-xs cursor-pointer"
                                                            title="Click to open linked album in Memory Vault"
                                                        >
                                                            📸 {linkedAlbum.title.slice(0, 16)}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setLinkingItemId(linkingItemId === item.id ? null : item.id)}
                                                            className="text-[10px] text-stone-400 hover:text-stone-700 px-1.5 py-1 rounded-full bg-stone-100 cursor-pointer"
                                                            title="Change or unlink album"
                                                        >
                                                            ✏️
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setLinkingItemId(linkingItemId === item.id ? null : item.id)}
                                                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${linkingItemId === item.id
                                                                ? 'bg-rose-500 text-white border-rose-500'
                                                                : 'bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-600 border-stone-200'
                                                            }`}
                                                    >
                                                        🔗 Link Album
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-1 text-stone-400 hover:text-red-500 cursor-pointer"
                                                    title="Delete Goal"
                                                >
                                                    <Icons.Trash />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Album Picker Drawer when "🔗 Link Album" is clicked */}
                                        {linkingItemId === item.id && (
                                            <div className="pt-2.5 mt-1 border-t border-stone-200/70 bg-stone-50/80 rounded-xl p-2.5 animate-in fade-in duration-150">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[11px] font-bold text-stone-600">
                                                        Select a Memory Vault Album to Link:
                                                    </span>
                                                    {item.linked_memory_id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLinkAlbum(item.id, null)}
                                                            className="text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                                                        >
                                                            Unlink Album ✕
                                                        </button>
                                                    )}
                                                </div>

                                                {linkableAlbums.length === 0 ? (
                                                    <p className="text-xs text-stone-400 italic py-1">
                                                        No Timeline or Constant albums found in your Vault yet. Create an album in the Memory Vault first!
                                                    </p>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 flex-wrap max-h-32 overflow-y-auto custom-scrollbar">
                                                        {linkableAlbums.map((m) => {
                                                            const isCurrent = String(m.id) === String(item.linked_memory_id);
                                                            return (
                                                                <button
                                                                    key={m.id}
                                                                    type="button"
                                                                    onClick={() => handleLinkAlbum(item.id, m.id)}
                                                                    className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${isCurrent
                                                                            ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-xs'
                                                                            : 'bg-white hover:bg-rose-500 hover:text-white text-stone-700 border-stone-200'
                                                                        }`}
                                                                >
                                                                    <span>📸 {m.title}</span>
                                                                    {m.memory_date && (
                                                                        <span className="text-[10px] opacity-70">({m.memory_date.slice(0, 4)})</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BucketListView;