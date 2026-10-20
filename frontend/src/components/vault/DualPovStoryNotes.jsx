import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { getCurrentPartnerRole, getPartnerNames } from '../../utils/userIdentity';

export const DualPovStoryNotes = ({
    cleanDescription,
    meta,
    isEditing,
    setIsEditing,
    onSaveStories
}) => {
    const [activePov, setActivePov] = useState('shared'); // 'shared' | 'his' | 'her'
    const [isExpanded, setIsExpanded] = useState(false);

    const partnerRole = getCurrentPartnerRole();
    const names = getPartnerNames();

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

    // Enforce POV ownership: Only Him can edit His POV; Only Her can edit Her POV
    const canEditActivePov =
        activePov === 'shared' ||
        (activePov === 'his' && partnerRole === 'partner_his') ||
        (activePov === 'her' && partnerRole === 'partner_her');

    const handleSave = () => {
        const parsedTags = (tagsDraft.match(/#[a-zA-Z0-9_]+/g) || []).map((t) => t.toLowerCase());
        onSaveStories(sharedDraft, {
            hisPov: partnerRole === 'partner_his' ? hisDraft.trim() : (meta?.hisPov || ''),
            herPov: partnerRole === 'partner_her' ? herDraft.trim() : (meta?.herPov || ''),
            tags: parsedTags
        });
        setIsEditing(false);
    };

    return (
        <div className="mt-1.5 w-full">
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                {[
                    { id: 'shared', label: '📖 Shared Story', hasContent: Boolean(cleanDescription) },
                    { id: 'his', label: `🤵 ${names.partner_his || 'His'} POV`, hasContent: Boolean(meta?.hisPov) },
                    { id: 'her', label: `👰 ${names.partner_her || 'Her'} POV`, hasContent: Boolean(meta?.herPov) }
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
                    {!canEditActivePov ? (
                        <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                            🔒 Only <b>{activePov === 'his' ? names.partner_his || 'Him' : names.partner_her || 'Her'}</b> can edit this perspective! Switch to your own POV tab or Shared Story to write.
                        </div>
                    ) : activePov === 'shared' ? (
                        <textarea
                            value={sharedDraft}
                            onChange={(e) => setSharedDraft(e.target.value)}
                            className="w-full bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-none min-h-[80px] custom-scrollbar"
                            placeholder="Write the shared story of this day..."
                            autoFocus
                        />
                    ) : activePov === 'his' ? (
                        <textarea
                            value={hisDraft}
                            onChange={(e) => setHisDraft(e.target.value)}
                            className="w-full bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-none min-h-[80px] custom-scrollbar"
                            placeholder={`🤵 Write ${names.partner_his || 'His'} POV: How did this day feel through your eyes?`}
                            autoFocus
                        />
                    ) : (
                        <textarea
                            value={herDraft}
                            onChange={(e) => setHerDraft(e.target.value)}
                            className="w-full bg-stone-950/70 border border-stone-800 rounded-xl p-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-none min-h-[80px] custom-scrollbar"
                            placeholder={`👰 Write ${names.partner_her || 'Her'} POV: How did this day feel through your eyes?`}
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
                        {canEditActivePov && (
                            <button
                                type="button"
                                onClick={handleSave}
                                className="text-xs px-4 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 transition font-bold text-white shrink-0 flex items-center gap-1 cursor-pointer"
                            >
                                <Icons.CheckAll className="w-3.5 h-3.5" /> Save POV
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        if (currentDisplayText) setIsExpanded((prev) => !prev);
                        else if (canEditActivePov) setIsEditing(true);
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
                                    ? canEditActivePov
                                        ? `Tap to write ${names.partner_his || 'His'} perspective ✍️`
                                        : `${names.partner_his || 'He'} hasn't written his POV yet.`
                                    : activePov === 'her'
                                        ? canEditActivePov
                                            ? `Tap to write ${names.partner_her || 'Her'} perspective ✍️`
                                            : `${names.partner_her || 'She'} hasn't written her POV yet.`
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