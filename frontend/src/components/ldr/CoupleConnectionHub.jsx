import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';

const MOOD_PRESETS = [
    '🥺 Missing you',
    '🧋 Craving boba',
    '☕ Need chai/coffee',
    '💻 Deep in work/study',
    '😴 Sleepy pookie',
    '🥰 Feeling extra in love'
];

const DAILY_QUESTIONS = [
    'Which memory in our vault would you relive tomorrow if you could?',
    'What is the very first thing you want to do the moment we reunite?',
    'What small habit of mine secretly makes you smile the most?',
    'If we could teleport anywhere for dinner tonight, where are we going?',
    'Which song reminds you of us right now?'
];

const CORKBOARD_STORAGE_KEY = 'us_phase4_corkboard_v1';
const DAILY_Q_STORAGE_KEY = 'us_phase4_daily_question_v1';
const MOOD_STORAGE_KEY = 'us_phase4_moods_v1';

export const CoupleConnectionHub = ({ isOpen, onClose, moods, onUpdateMoods }) => {
    const [activeTab, setActiveTab] = useState('question'); // 'question' | 'corkboard' | 'mood'

    // Simultaneous Daily Question State
    const todayQuestion = DAILY_QUESTIONS[new Date().getDate() % DAILY_QUESTIONS.length];
    const [qaState, setQaState] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(DAILY_Q_STORAGE_KEY) || '{}');
            if (saved.question === todayQuestion) return saved;
        } catch { }
        return { question: todayQuestion, hisAnswer: '', herAnswer: '' };
    });
    const [hisDraft, setHisDraft] = useState(qaState.hisAnswer || '');
    const [herDraft, setHerDraft] = useState(qaState.herAnswer || '');

    // Corkboard Sticky Notes State
    const [stickyNotes, setStickyNotes] = useState(() => {
        try {
            const saved = localStorage.getItem(CORKBOARD_STORAGE_KEY);
            return saved
                ? JSON.parse(saved)
                : [
                    {
                        id: 'note_1',
                        author: 'Pookie 💖',
                        text: 'Pin surprise love notes, reminders, or sweet letters here for each other!',
                        color: '#fef9c3',
                        date: 'Today'
                    }
                ];
        } catch {
            return [];
        }
    });
    const [newNoteText, setNewNoteText] = useState('');
    const [newNoteAuthor, setNewNoteAuthor] = useState(() => localStorage.getItem('us_locket_sender') || 'Me');
    const [newNoteColor, setNewNoteColor] = useState('#fff1f2');

    useEffect(() => {
        localStorage.setItem(DAILY_Q_STORAGE_KEY, JSON.stringify(qaState));
    }, [qaState]);

    useEffect(() => {
        localStorage.setItem(CORKBOARD_STORAGE_KEY, JSON.stringify(stickyNotes));
    }, [stickyNotes]);

    if (!isOpen) return null;

    const bothAnswered = Boolean(qaState.hisAnswer.trim() && qaState.herAnswer.trim());

    const handleAddCorkboardNote = (e) => {
        e.preventDefault();
        if (!newNoteText.trim()) return;
        const note = {
            id: `cn_${Date.now()}`,
            author: newNoteAuthor.trim() || 'Your Love',
            text: newNoteText.trim(),
            color: newNoteColor,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        };
        setStickyNotes((prev) => [note, ...prev]);
        setNewNoteText('');
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-2xl rounded-[2.25rem] max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-white/80 max-h-[90vh] overflow-y-auto custom-scrollbar text-stone-800">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-stone-800">
                            Our Daily Connection & Corkboard 💌
                        </h2>
                        <p className="text-xs text-stone-500">
                            Simultaneous Daily Question · Love Note Corkboard · Live Mood & Craving Pills
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-700 rounded-full">
                        <Icons.X />
                    </button>
                </div>

                {/* 3-Tab Switcher */}
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200 mb-6">
                    {[
                        { id: 'question', label: '🔐 Daily Question' },
                        { id: 'corkboard', label: '📌 Love Corkboard' },
                        { id: 'mood', label: '🧋 Mood & Craving' }
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === t.id ? 'bg-white text-rose-600 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* TAB 1: SIMULTANEOUS DAILY QUESTION REVEAL */}
                {activeTab === 'question' && (
                    <div className="space-y-5">
                        <div className="bg-gradient-to-r from-rose-50 via-pink-50 to-amber-50 border border-rose-200 rounded-3xl p-5 text-center">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500 block mb-1">
                                Pookie’s Question of the Day ✨
                            </span>
                            <h3 className="text-lg sm:text-xl font-serif font-bold text-stone-800">
                                “{todayQuestion}”
                            </h3>
                            <p className="text-[11px] text-stone-500 mt-1">
                                {bothAnswered
                                    ? '🔓 Both answers submitted! Unlocked below:'
                                    : '🔒 Answers stay blurred until BOTH of you submit your answer!'}
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* His Answer Box */}
                            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col justify-between">
                                <div>
                                    <span className="text-xs font-bold text-stone-700 block mb-2">🤵 His Answer</span>
                                    {qaState.hisAnswer ? (
                                        <div className="p-3 rounded-xl bg-white border border-stone-200 min-h-[70px]">
                                            <p
                                                className={`text-sm text-stone-800 transition-all duration-500 ${bothAnswered ? 'blur-none' : 'blur-md select-none'
                                                    }`}
                                            >
                                                {qaState.hisAnswer}
                                            </p>
                                        </div>
                                    ) : (
                                        <textarea
                                            rows={3}
                                            value={hisDraft}
                                            onChange={(e) => setHisDraft(e.target.value)}
                                            placeholder="Type His answer..."
                                            className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-xs resize-none"
                                        />
                                    )}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    {qaState.hisAnswer ? (
                                        <button
                                            type="button"
                                            onClick={() => setQaState((p) => ({ ...p, hisAnswer: '' }))}
                                            className="text-[11px] text-stone-400 hover:text-rose-500"
                                        >
                                            Edit His Answer
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setQaState((p) => ({ ...p, hisAnswer: hisDraft.trim() }))}
                                            className="bg-stone-900 text-white px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                                        >
                                            Lock In Answer 🔒
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Her Answer Box */}
                            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col justify-between">
                                <div>
                                    <span className="text-xs font-bold text-stone-700 block mb-2">👰 Her Answer</span>
                                    {qaState.herAnswer ? (
                                        <div className="p-3 rounded-xl bg-white border border-stone-200 min-h-[70px]">
                                            <p
                                                className={`text-sm text-stone-800 transition-all duration-500 ${bothAnswered ? 'blur-none' : 'blur-md select-none'
                                                    }`}
                                            >
                                                {qaState.herAnswer}
                                            </p>
                                        </div>
                                    ) : (
                                        <textarea
                                            rows={3}
                                            value={herDraft}
                                            onChange={(e) => setHerDraft(e.target.value)}
                                            placeholder="Type Her answer..."
                                            className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-xs resize-none"
                                        />
                                    )}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    {qaState.herAnswer ? (
                                        <button
                                            type="button"
                                            onClick={() => setQaState((p) => ({ ...p, herAnswer: '' }))}
                                            className="text-[11px] text-stone-400 hover:text-rose-500"
                                        >
                                            Edit Her Answer
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setQaState((p) => ({ ...p, herAnswer: herDraft.trim() }))}
                                            className="bg-rose-500 text-white px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                                        >
                                            Lock In Answer 🔒
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: LOVE LETTER / STICKY NOTE CORKBOARD DRAWER */}
                {activeTab === 'corkboard' && (
                    <div className="space-y-4">
                        <form onSubmit={handleAddCorkboardNote} className="flex flex-col sm:flex-row gap-2 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                            <input
                                type="text"
                                value={newNoteAuthor}
                                onChange={(e) => setNewNoteAuthor(e.target.value)}
                                placeholder="From..."
                                className="sm:w-28 bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold"
                            />
                            <input
                                type="text"
                                required
                                value={newNoteText}
                                onChange={(e) => setNewNoteText(e.target.value)}
                                placeholder="Write a sticky note or mini love letter to pin on the board..."
                                className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs"
                            />
                            <div className="flex items-center gap-1.5">
                                {['#fff1f2', '#fef9c3', '#dcfce7', '#f3e8ff'].map((hex) => (
                                    <button
                                        key={hex}
                                        type="button"
                                        onClick={() => setNewNoteColor(hex)}
                                        style={{ backgroundColor: hex }}
                                        className={`w-6 h-6 rounded-full border ${newNoteColor === hex ? 'ring-2 ring-rose-500 scale-110' : 'border-stone-300'
                                            }`}
                                    />
                                ))}
                                <button
                                    type="submit"
                                    className="bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                                >
                                    📌 Pin
                                </button>
                            </div>
                        </form>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-72 overflow-y-auto p-1 custom-scrollbar">
                            {stickyNotes.map((n, idx) => (
                                <div
                                    key={n.id}
                                    style={{ backgroundColor: n.color || '#fff1f2' }}
                                    className={`p-4 rounded-2xl shadow-md border border-black/5 relative flex flex-col justify-between min-h-[110px] ${idx % 2 === 0 ? 'rotate-[0.5deg]' : '-rotate-[0.5deg]'
                                        }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setStickyNotes((prev) => prev.filter((item) => item.id !== n.id))}
                                        className="absolute top-2.5 right-2.5 text-stone-400 hover:text-red-500 text-xs"
                                    >
                                        ✕
                                    </button>
                                    <p className="font-serif text-sm text-stone-800 pr-4 whitespace-pre-wrap">{n.text}</p>
                                    <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-[10px] font-bold text-stone-500">
                                        <span>— {n.author}</span>
                                        <span>{n.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 3: PARTNER MOOD & CRAVING PILL */}
                {activeTab === 'mood' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {['hisMood', 'herMood'].map((key) => {
                                const isHis = key === 'hisMood';
                                return (
                                    <div key={key} className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                                        <span className="text-xs font-bold text-stone-700 block mb-2">
                                            {isHis ? '🤵 His Current Mood / Craving' : '👰 Her Current Mood / Craving'}
                                        </span>
                                        <input
                                            type="text"
                                            value={moods[key] || ''}
                                            onChange={(e) => onUpdateMoods({ ...moods, [key]: e.target.value })}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-rose-600 mb-2.5"
                                        />
                                        <div className="flex flex-wrap gap-1.5">
                                            {MOOD_PRESETS.map((preset) => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => onUpdateMoods({ ...moods, [key]: preset })}
                                                    className="text-[11px] bg-white hover:bg-rose-500 hover:text-white border border-stone-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                                                >
                                                    {preset}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CoupleConnectionHub;