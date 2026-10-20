import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';

export const OpenWhenEnvelopes = ({ isOpen, onClose, envelopes = [], onUpdated, showDialog }) => {
    const [selectedEnv, setSelectedEnv] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [sender, setSender] = useState(() => localStorage.getItem('us_locket_sender') || 'Your Love');
    const [letter, setLetter] = useState('');

    if (!isOpen) return null;

    const handleOpenEnvelope = async (env) => {
        setSelectedEnv(env);
        if (!env.is_opened) {
            try {
                const res = await fetch(`${API_BASE_URL}/api/ldr/envelopes/${env.id}/open`, { method: 'POST' });
                if (res.ok) onUpdated?.();
            } catch { }
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!prompt.trim() || !letter.trim()) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/ldr/envelopes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, sender, letter })
            });
            if (res.ok) {
                setPrompt('');
                setLetter('');
                setIsCreating(false);
                onUpdated?.();
            }
        } catch { }
    };

    const handleDelete = async (id) => {
        try {
            await fetch(`${API_BASE_URL}/api/ldr/envelopes/${id}`, { method: 'DELETE' });
            setSelectedEnv(null);
            onUpdated?.();
        } catch { }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-2xl rounded-[2.25rem] max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-white/80 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-stone-800">“Open When…” Envelopes 💌</h2>
                        <p className="text-xs text-stone-500">
                            Sealed letters for the moments when distance feels heavy.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedEnv(null);
                                setIsCreating((prev) => !prev);
                            }}
                            className="bg-stone-900 hover:bg-rose-600 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors"
                        >
                            {isCreating ? 'Cancel' : '+ Seal New Envelope'}
                        </button>
                        <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-700 rounded-full">
                            <Icons.X />
                        </button>
                    </div>
                </div>

                {isCreating ? (
                    <form onSubmit={handleCreate} className="space-y-4 bg-rose-50/50 border border-rose-200/70 rounded-3xl p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">
                                    Envelope Rule (“Open when…”)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="e.g., Open when you feel stressed about exams"
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">From</label>
                                <input
                                    type="text"
                                    value={sender}
                                    onChange={(e) => setSender(e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-stone-500 mb-1">Secret Letter Inside</label>
                            <textarea
                                rows={5}
                                required
                                value={letter}
                                onChange={(e) => setLetter(e.target.value)}
                                placeholder="Write the hug and words your partner will need in that moment..."
                                className="w-full bg-white border border-stone-200 rounded-xl p-3.5 text-sm resize-none"
                            />
                        </div>
                        <button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 rounded-2xl text-xs shadow-md">
                            🕯️ Wax-Seal This Envelope
                        </button>
                    </form>
                ) : selectedEnv ? (
                    <div className="bg-[#fffdf9] border border-amber-200/80 rounded-3xl p-6 sm:p-8 shadow-inner relative">
                        <div className="flex items-center justify-between border-b border-stone-200 pb-3 mb-4">
                            <div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500 block">
                                    From {selectedEnv.sender} · {selectedEnv.created_at}
                                </span>
                                <h3 className="text-xl font-serif font-bold text-stone-800">{selectedEnv.prompt}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleDelete(selectedEnv.id)}
                                    className="p-2 text-stone-400 hover:text-red-500 rounded-full"
                                    title="Delete Envelope"
                                >
                                    <Icons.Trash />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedEnv(null)}
                                    className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-full text-xs font-bold text-stone-700"
                                >
                                    ← Back
                                </button>
                            </div>
                        </div>
                        <p className="font-serif text-base sm:text-lg text-stone-800 leading-relaxed whitespace-pre-wrap">
                            {selectedEnv.letter}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {envelopes.map((env) => (
                            <div
                                key={env.id}
                                onClick={() => handleOpenEnvelope(env)}
                                className="group cursor-pointer bg-gradient-to-br from-rose-50/90 via-white to-amber-50/70 hover:from-rose-100/80 border border-rose-200/80 rounded-3xl p-5 shadow-md hover:shadow-xl transition-all relative flex flex-col justify-between min-h-[140px]"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <span className="text-2xl">{env.is_opened ? '💌' : '✉️'}</span>
                                    <span
                                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${env.is_opened
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-rose-500 text-white shadow-xs'
                                            }`}
                                    >
                                        {env.is_opened ? `Opened ${env.opened_at || ''}` : 'Wax Sealed 🔒'}
                                    </span>
                                </div>
                                <div className="mt-4">
                                    <h4 className="font-serif font-bold text-base text-stone-800 group-hover:text-rose-600 transition-colors">
                                        {env.prompt}
                                    </h4>
                                    <p className="text-[11px] text-stone-400 mt-1">Sealed by {env.sender}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpenWhenEnvelopes;