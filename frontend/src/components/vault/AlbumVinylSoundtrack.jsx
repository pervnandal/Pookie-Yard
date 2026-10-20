import React, { useState, useEffect, useRef, useMemo } from 'react';
import { API_BASE_URL } from '../../utils/apiUtils';
import { extractVaultMeta } from '../../utils/vaultMetaUtils';

const VIBE_PROFILES = {
    romance: {
        defaultLabel: 'Velvet Rose · Music Box',
        chords: [
            [261.63, 329.63, 392.00, 493.88], // Cmaj7
            [220.00, 261.63, 329.63, 392.00], // Am7
            [174.61, 220.00, 261.63, 349.23], // Fmaj7
            [196.00, 246.94, 293.66, 392.00]  // G6
        ],
        tempoMs: 1100
    },
    celebration: {
        defaultLabel: 'Golden Sparkle · Celebration',
        chords: [
            [293.66, 369.99, 440.00, 587.33], // Dmaj
            [220.00, 277.18, 329.63, 440.00], // Amaj
            [246.94, 293.66, 369.99, 493.88], // Bm7
            [196.00, 246.94, 293.66, 392.00]  // Gmaj
        ],
        tempoMs: 820
    },
    cozy: {
        defaultLabel: 'Midnight Rain · Lo-Fi Calm',
        chords: [
            [220.00, 261.63, 329.63, 392.00], // Am7
            [146.83, 220.00, 261.63, 349.23], // Dm7
            [196.00, 246.94, 293.66, 349.23], // G7
            [174.61, 220.00, 261.63, 329.63]  // Fmaj7
        ],
        tempoMs: 1350
    },
    adventure: {
        defaultLabel: 'Sunset Horizon · Acoustic',
        chords: [
            [349.23, 440.00, 523.25, 659.25],
            [261.63, 329.63, 392.00, 523.25],
            [293.66, 349.23, 440.00, 587.33],
            [220.00, 261.63, 329.63, 440.00]
        ],
        tempoMs: 920
    },
    nostalgia: {
        defaultLabel: 'Starlight Lullaby · Memories',
        chords: [
            [174.61, 220.00, 261.63, 329.63],
            [196.00, 246.94, 293.66, 392.00],
            [220.00, 261.63, 329.63, 440.00],
            [164.81, 246.94, 329.63, 392.00]
        ],
        tempoMs: 1250
    }
};

const extractYoutubeId = (url) => {
    if (!url) return null;
    const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
};

export const AlbumVinylSoundtrack = ({ memory, forcePlay = false, onSaveCustomSong }) => {
    const { meta } = useMemo(() => extractVaultMeta(memory), [memory]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [aiVibe, setAiVibe] = useState({
        key: meta.vibeKey || '',
        label: meta.vibeLabel || ''
    });
    const [showSongPopover, setShowSongPopover] = useState(false);
    const [songUrlInput, setSongUrlInput] = useState(meta.customSongUrl || '');
    const [songTitleInput, setSongTitleInput] = useState(meta.customSongTitle || '');

    const audioCtxRef = useRef(null);
    const intervalRef = useRef(null);
    const stepRef = useRef(0);
    const customAudioRef = useRef(null);

    // Local instant heuristic fallback while Pookie AI analyzes the album
    const localHeuristicKey = useMemo(() => {
        const text = `${memory?.title || ''} ${memory?.description || ''} ${meta.hisPov || ''} ${meta.herPov || ''}`.toLowerCase();
        if (/birthday|anniversary|party|celebrat|cake|gift|new year/.test(text)) return 'celebration';
        if (/rain|night|coffee|chai|cozy|winter|sleep|home|movie/.test(text)) return 'cozy';
        if (/trip|drive|hill|beach|flight|travel|walk|park|nursery|sunset/.test(text)) return 'adventure';
        if (/miss|distance|far|letter|throwback|old/.test(text)) return 'nostalgia';
        return 'romance';
    }, [memory?.title, memory?.description, meta.hisPov, meta.herPov]);

    // Ask Pookie AI for the album's emotional vibe
    useEffect(() => {
        if (!memory?.id) return;
        setSongUrlInput(meta.customSongUrl || '');
        setSongTitleInput(meta.customSongTitle || '');

        if (meta.vibeKey && meta.vibeLabel) {
            setAiVibe({ key: meta.vibeKey, label: meta.vibeLabel });
            return;
        }

        let live = true;
        fetch(`${API_BASE_URL}/api/album-vibe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                memory_id: String(memory.id),
                title: memory.title || '',
                memory_date: memory.memory_date || '',
                description: memory.description || ''
            })
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                if (live && data?.vibe_key) {
                    setAiVibe({ key: data.vibe_key, label: data.vibe_label || '' });
                }
            })
            .catch(() => { });

        return () => {
            live = false;
        };
    }, [memory?.id]);

    useEffect(() => {
        if (forcePlay) setIsPlaying(true);
    }, [forcePlay]);

    const activeVibeKey = aiVibe.key || localHeuristicKey;
    const profile = VIBE_PROFILES[activeVibeKey] || VIBE_PROFILES.romance;
    const customYtId = extractYoutubeId(meta.customSongUrl);
    const hasCustomDirectAudio = Boolean(meta.customSongUrl && !customYtId);

    const displayLabel = meta.customSongTitle
        ? `📌 ${meta.customSongTitle}`
        : meta.customSongUrl
            ? '📌 Our Pinned Song'
            : aiVibe.label || profile.defaultLabel;

    // Web Audio API Polyphonic Music-Box & Warm Pad Synthesizer (when no custom external song is pinned)
    useEffect(() => {
        if (!isPlaying || customYtId || hasCustomDirectAudio) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const playWarmChordNote = () => {
            try {
                const chordIdx = Math.floor(stepRef.current / 4) % profile.chords.length;
                const noteIdx = stepRef.current % 4;
                const chord = profile.chords[chordIdx];
                const freq = chord[noteIdx];
                stepRef.current += 1;

                const now = ctx.currentTime;

                // Soft warm sine + triangle harmonic
                const osc = ctx.createOscillator();
                const subOsc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);

                subOsc.type = 'triangle';
                subOsc.frequency.setValueAtTime(freq * 0.5, now);

                gain.gain.setValueAtTime(0.001, now);
                gain.gain.exponentialRampToValueAtTime(0.045, now + 0.12);
                gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.1);

                osc.connect(gain);
                subOsc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now);
                subOsc.start(now);
                osc.stop(now + 2.15);
                subOsc.stop(now + 2.15);
            } catch { }
        };

        playWarmChordNote();
        intervalRef.current = setInterval(playWarmChordNote, profile.tempoMs);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, profile, customYtId, hasCustomDirectAudio]);

    // Control direct audio element if a direct audio URL is pinned
    useEffect(() => {
        if (!customAudioRef.current) return;
        if (isPlaying && hasCustomDirectAudio) {
            customAudioRef.current.play().catch(() => { });
        } else {
            customAudioRef.current.pause();
        }
    }, [isPlaying, hasCustomDirectAudio, meta.customSongUrl]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (audioCtxRef.current) {
                audioCtxRef.current.close().catch(() => { });
                audioCtxRef.current = null;
            }
        };
    }, []);

    const handleSaveSong = (e) => {
        e.preventDefault();
        onSaveCustomSong?.({
            customSongUrl: songUrlInput.trim(),
            customSongTitle: songTitleInput.trim()
        });
        setShowSongPopover(false);
    };

    return (
        <div className="relative flex items-center gap-1.5 pointer-events-auto">
            {/* Main Spinning Vinyl Button */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying((prev) => !prev);
                }}
                title={isPlaying ? 'Pause Album Soundtrack' : 'Play AI Vibe Soundtrack'}
                className="flex items-center gap-2.5 bg-stone-900/90 hover:bg-stone-800 backdrop-blur-md border border-white/15 pl-1.5 pr-3.5 py-1 rounded-full shadow-lg transition-all cursor-pointer"
            >
                <div
                    className={`w-7 h-7 rounded-full bg-gradient-to-tr from-stone-950 via-stone-700 to-stone-950 border border-white/25 flex items-center justify-center shadow-inner ${isPlaying ? 'animate-spin' : ''
                        }`}
                    style={{ animationDuration: '3.5s' }}
                >
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-white/60" />
                </div>

                <div className="text-left">
                    <span className="block text-[10px] font-bold text-rose-400 leading-none">
                        {isPlaying ? '♫ Playing Vibe' : '♫ Vinyl Off'}
                    </span>
                    <span className="block text-[10px] text-stone-300 truncate max-w-[130px] leading-tight mt-0.5">
                        {displayLabel}
                    </span>
                </div>
            </button>

            {/* Pin "Our Song" Button */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    setShowSongPopover((prev) => !prev);
                }}
                title="Pin 'Our Song' (YouTube or Audio Link) to this Album"
                className={`w-8 h-8 rounded-full flex items-center justify-center border text-xs transition-all cursor-pointer ${meta.customSongUrl
                        ? 'bg-rose-500/30 border-rose-400 text-rose-200'
                        : 'bg-stone-900/80 hover:bg-stone-800 border-white/15 text-stone-300'
                    }`}
            >
                🎵
            </button>

            {/* Hidden YouTube Audio Player when a YouTube Song is Pinned and Playing */}
            {isPlaying && customYtId && (
                <iframe
                    src={`https://www.youtube.com/embed/${customYtId}?autoplay=1&loop=1&playlist=${customYtId}`}
                    title="Pinned Album Song"
                    allow="autoplay"
                    className="w-0 h-0 opacity-0 pointer-events-none absolute"
                />
            )}

            {/* Hidden Direct Audio Element if MP3/Audio URL is Pinned */}
            {hasCustomDirectAudio && (
                <audio ref={customAudioRef} src={meta.customSongUrl} loop className="hidden" />
            )}

            {/* Popover to Pin or Clear "Our Song" for this Album */}
            {showSongPopover && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-11 left-0 w-72 bg-stone-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl z-[90] text-white"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-serif font-bold text-rose-300">🎵 Pin &ldquo;Our Song&rdquo; to Album</span>
                        <button
                            type="button"
                            onClick={() => setShowSongPopover(false)}
                            className="text-stone-400 hover:text-white text-xs"
                        >
                            ✕
                        </button>
                    </div>
                    <p className="text-[11px] text-stone-400 mb-3">
                        Paste a YouTube song link (or leave blank to let Pookie AI play a soothing vibe melody).
                    </p>
                    <form onSubmit={handleSaveSong} className="space-y-2.5">
                        <input
                            type="text"
                            value={songTitleInput}
                            onChange={(e) => setSongTitleInput(e.target.value)}
                            placeholder="Song Title (e.g., Kesariya / Until I Found You)"
                            className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                        />
                        <input
                            type="url"
                            value={songUrlInput}
                            onChange={(e) => setSongUrlInput(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-400"
                        />
                        <div className="flex justify-between gap-2 pt-1">
                            {meta.customSongUrl && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSongUrlInput('');
                                        setSongTitleInput('');
                                        onSaveCustomSong?.({ customSongUrl: '', customSongTitle: '' });
                                        setShowSongPopover(false);
                                    }}
                                    className="text-[11px] text-red-400 hover:underline"
                                >
                                    Use AI Vibe Instead
                                </button>
                            )}
                            <button
                                type="submit"
                                className="ml-auto bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl cursor-pointer"
                            >
                                Save Song
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AlbumVinylSoundtrack;