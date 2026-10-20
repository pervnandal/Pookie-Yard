import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';

export const DualPovStoryNotes = ({
    cleanDescription,
    meta,
    isEditing,
    setIsEditing,
    onSaveStories
}) => {
    const [activePov, setActivePov] = useState('shared'); // 'shared' | 'his' | 'her'
    const [isExpanded, setIsExpanded] = useState(false);

    const [sharedDraft, setSharedDraft] = useState(cleanDescription || '');
    const [hisDraft, setHisDraft] = useState(meta?.hisPov || '');
    const [herDraft, setHerDraft] = useState(meta?.herPov || '');
    const [tagsDraft, setTagsDraft] = useState((meta?.tags || []).join(' '));

    useEffect(() => {
        setSharedDraft(cleanDescription || '');
        setHisDraft(meta?.hisPov || '');
        setHerDraft(meta?.herPov || '');
        setTagsDraft((meta?.tags || []).join(' '));
    }, [cleanDescription, meta?.hisPov, meta?.herPov, meta?.tags]);

    const currentDisplayText =
        activePov === 'his'
            ? meta?.hisPov || ''
            : activePov === 'her'
                ? meta?.herPov || ''
                : cleanDescription || '';

    const handleSave = () => {
        const parsedTags = (tagsDraft.match(/#[a-zA-Z0-9_]+/g) || []).map((t) => t.toLowerCase());
        onSaveStories(sharedDraft, {
            hisPov: hisDraft.trim(),
            herPov: herDraft.trim(),
            tags: parsedTags
        });
        setIsEditing(false);
    };

    return (
        <div className="mt-1.5 w-full">
            {/* POV Switcher Pills */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {[
                    { id: 'shared', label: '📖 Shared Story', hasContent: Boolean(cleanDescription) },
                    { id: 'his', label: '🤵 His POV', hasContent: Boolean(meta?.hisPov) },
                    { id: 'her', label: '👰 Her POV', hasContent: Boolean(meta?.herPov) }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setActivePov(tab.id);
                        }}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${activePov === tab.id
                                ? 'bg-rose-500 text-white shadow-xs'
                                : 'bg-stone-800/90 hover:bg-stone-700 text-stone-300'
                            }`}
                    >
                        <span>{tab.label}</span>
                        {tab.hasContent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>
                ))}

                {(meta?.tags || []).map((t) => (
                    <span
                        key={t}
                        className="text-[10px] font-mono bg-white/10 text-rose-300 px-2 py-0.5 rounded-full"
                    >
                        {t}
                    </span>
                ))}
            </div>

            {isEditing ? (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-stone-900/95 backdrop-blur-xl p-3.5 rounded-2xl border border-stone-700 space-y-2.5"
                >
                    {activePov === 'shared' && (
                        <textarea
                            value={sharedDraft}
                            onChange={(e) => setSharedDraft(e.target.value)}
                            className="w-full bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-none min-h-[80px] custom-scrollbar"
                            placeholder="Write the main story of this day..."
                            autoFocus
                        />
                    )}
                    {activePov === 'his' && (
                        <textarea
                            value={hisDraft}
                            onChange={(e) => setHisDraft(e.target.value)}
                            className="w-full bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-none min-h-[80px] custom-scrollbar"
                            placeholder="🤵 Write His POV: How did this day feel through your eyes?"
                            autoFocus
                        />
                    )}
                    {activePov === 'her' && (
                        <textarea
                            value={herDraft}
                            onChange={(e) => setHerDraft(e.target.value)}
                            className="w-full bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-none min-h-[80px] custom-scrollbar"
                            placeholder="👰 Write Her POV: How did this day feel through your eyes?"
                            autoFocus
                        />
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                        <input
                            type="text"
                            value={tagsDraft}
                            onChange={(e) => setTagsDraft(e.target.value)}
                            placeholder="Tags: #date #birthday #trip"
                            className="flex-1 bg-stone-950/70 border border-stone-800 rounded-full px-3 py-1.5 text-xs text-rose-300 focus:outline-none focus:border-rose-500"
                        />
                        <button
                            type="button"
                            onClick={handleSave}
                            className="text-xs px-4 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 transition font-bold text-white shrink-0 flex items-center gap-1 cursor-pointer"
                        >
                            <Icons.CheckAll className="w-3.5 h-3.5" /> Save POV & Tags
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        if (currentDisplayText) setIsExpanded((prev) => !prev);
                        else setIsEditing(true);
                    }}
                    className={`cursor-pointer rounded-xl transition-all ${isExpanded
                            ? 'bg-stone-900/90 backdrop-blur-md p-3 border border-white/15 max-h-44 overflow-y-auto custom-scrollbar'
                            : ''
                        }`}
                >
                    <p
                        className={`text-stone-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed ${isExpanded ? '' : 'line-clamp-2'
                            }`}
                    >
                        {currentDisplayText || (
                            <span className="italic opacity-60">
                                {activePov === 'his'
                                    ? "No 'His POV' written yet — tap to add his perspective ✍️"
                                    : activePov === 'her'
                                        ? "No 'Her POV' written yet — tap to add her perspective ✍️"
                                        : 'No story written yet — tap to add.'}
                            </span>
                        )}
                    </p>
                    {currentDisplayText && currentDisplayText.length > 90 && (
                        <span className="inline-block text-[11px] font-bold text-rose-400 mt-1">
                            {isExpanded ? 'Show less ↑' : 'Tap to read full perspective ↓'}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default DualPovStoryNotes;