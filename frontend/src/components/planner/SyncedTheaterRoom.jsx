import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../../utils/apiUtils';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const parseUniversalMedia = (rawUrl) => {
    const url = String(rawUrl || '').trim();
    if (!url) {
        return {
            kind: 'youtube',
            id: 'jfKfPfyJRdk',
            embedUrl: 'https://www.youtube.com/embed/jfKfPfyJRdk?enablejsapi=1&playsinline=1&rel=0&modestbranding=1',
            raw: 'https://www.youtube.com/watch?v=jfKfPfyJRdk'
        };
    }

    // 1. YouTube
    const ytMatch = url.match(
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/|^yt:)([a-zA-Z0-9_-]{11})/
    );
    if (ytMatch) {
        const id = ytMatch[1];
        return {
            kind: 'youtube',
            id,
            embedUrl: `https://www.youtube.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1`,
            raw: url
        };
    }

    // 2. Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch) {
        const id = vimeoMatch[1];
        return {
            kind: 'vimeo',
            id,
            embedUrl: `https://player.vimeo.com/video/${id}?api=1`,
            raw: url
        };
    }

    // 3. Google Drive Video
    const driveMatch = url.match(/(?:id=|\/d\/|drive-image\/)([a-zA-Z0-9_-]{15,})/);
    if (driveMatch && (url.includes('drive.google.com') || url.includes('drive-image'))) {
        const id = driveMatch[1];
        return {
            kind: 'video',
            streamUrl: `${API_BASE_URL}/api/drive-image/${id}?size=original`,
            raw: url
        };
    }

    // 4. Direct HTML5 Video File (.mp4, .webm, .ogg, .mov, .m4v)
    if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url)) {
        return {
            kind: 'video',
            streamUrl: url,
            raw: url
        };
    }

    // 5. X.com / Twitter, Instagram, Reddit, Hotstar, or any other URL -> resolve via backend
    return {
        kind: 'unknown',
        raw: url
    };
};

export const SyncedTheaterRoom = ({ safeSend, incomingTheaterEvent }) => {
    const [videoInput, setVideoInput] = useState('');
    const [mediaState, setMediaState] = useState(() => {
        const saved = localStorage.getItem('us_theater_media_v2');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch { }
        }
        return parseUniversalMedia('https://www.youtube.com/watch?v=jfKfPfyJRdk');
    });

    const [isPlaying, setIsPlaying] = useState(false);
    const [isResolving, setIsResolving] = useState(false);
    const [hudToast, setHudToast] = useState(null);

    // WebRTC OTT Screen/Tab Share State (for Hotstar, Netflix, Prime Video, etc.)
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [isReceivingScreen, setIsReceivingScreen] = useState(false);
    const [showOttHelp, setShowOttHelp] = useState(false);

    const stageRef = useRef(null);
    const iframeRef = useRef(null);
    const htmlVideoRef = useRef(null);
    const screenVideoRef = useRef(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);

    const suppressBroadcastRef = useRef(false);
    const approxTimeRef = useRef(0);
    const isPlayingRef = useRef(isPlaying);
    const mediaStateRef = useRef(mediaState);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        mediaStateRef.current = mediaState;
    }, [mediaState]);

    // Track approximate playback time for iframe players (like YouTube) so Left/Right arrow seek works accurately
    useEffect(() => {
        const timer = setInterval(() => {
            if (isPlayingRef.current) {
                if (mediaStateRef.current.kind === 'video' && htmlVideoRef.current) {
                    approxTimeRef.current = htmlVideoRef.current.currentTime;
                } else {
                    approxTimeRef.current += 1;
                }
            }
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Listen to YouTube's postMessage currentTime updates
    useEffect(() => {
        const onMsg = (e) => {
            try {
                if (typeof e.data === 'string' && e.data.includes('infoDelivery')) {
                    const parsed = JSON.parse(e.data);
                    if (typeof parsed?.info?.currentTime === 'number') {
                        approxTimeRef.current = parsed.info.currentTime;
                    }
                }
            } catch { }
        };
        window.addEventListener('message', onMsg);
        return () => window.removeEventListener('message', onMsg);
    }, []);

    const showHud = (text) => {
        setHudToast(text);
        setTimeout(() => setHudToast(null), 1300);
    };

    // Applies play/pause and optional seekSeconds in-place WITHOUT reloading the player
    const applyPlayStateToPlayer = useCallback((playBool, seekSeconds = null) => {
        setIsPlaying(playBool);
        const currentMedia = mediaStateRef.current;

        if (typeof seekSeconds === 'number' && seekSeconds >= 0) {
            approxTimeRef.current = seekSeconds;
        }

        if (currentMedia.kind === 'youtube' && iframeRef.current?.contentWindow) {
            if (typeof seekSeconds === 'number') {
                iframeRef.current.contentWindow.postMessage(
                    JSON.stringify({ event: 'command', func: 'seekTo', args: [seekSeconds, true] }),
                    '*'
                );
            }
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({
                    event: 'command',
                    func: playBool ? 'playVideo' : 'pauseVideo',
                    args: []
                }),
                '*'
            );
        } else if (currentMedia.kind === 'vimeo' && iframeRef.current?.contentWindow) {
            if (typeof seekSeconds === 'number') {
                iframeRef.current.contentWindow.postMessage(
                    JSON.stringify({ method: 'setCurrentTime', value: seekSeconds }),
                    '*'
                );
            }
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ method: playBool ? 'play' : 'pause' }),
                '*'
            );
        } else if (currentMedia.kind === 'video' && htmlVideoRef.current) {
            if (
                typeof seekSeconds === 'number' &&
                Math.abs(htmlVideoRef.current.currentTime - seekSeconds) > 0.8
            ) {
                htmlVideoRef.current.currentTime = seekSeconds;
            }
            if (playBool) {
                htmlVideoRef.current.play().catch(() => { });
            } else {
                htmlVideoRef.current.pause();
            }
        }
    }, []);

    // --- WEBRTC LIVE TAB/SCREEN STREAMING FOR OTT (HOTSTAR, NETFLIX, PRIME VIDEO) ---
    const cleanupWebRtc = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        setIsSharingScreen(false);
        setIsReceivingScreen(false);
    }, []);

    const createPeerConnection = useCallback(() => {
        if (pcRef.current) pcRef.current.close();
        const pc = new RTCPeerConnection(ICE_SERVERS);

        pc.onicecandidate = (ev) => {
            if (ev.candidate) {
                safeSend?.({ type: 'theater_sync', rtcType: 'candidate', candidate: ev.candidate });
            }
        };

        pc.ontrack = (ev) => {
            setIsReceivingScreen(true);
            setTimeout(() => {
                if (screenVideoRef.current && ev.streams?.[0]) {
                    screenVideoRef.current.srcObject = ev.streams[0];
                    screenVideoRef.current.play().catch(() => { });
                }
            }, 50);
        };

        pcRef.current = pc;
        return pc;
    }, [safeSend]);

    const startOttTabShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { frameRate: { ideal: 30 } },
                audio: true
            });
            localStreamRef.current = stream;
            setIsSharingScreen(true);

            setTimeout(() => {
                if (screenVideoRef.current) {
                    screenVideoRef.current.srcObject = stream;
                    screenVideoRef.current.muted = true;
                    screenVideoRef.current.play().catch(() => { });
                }
            }, 50);

            const pc = createPeerConnection();
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            stream.getVideoTracks()[0].onended = () => {
                cleanupWebRtc();
                safeSend?.({ type: 'theater_sync', rtcType: 'stop_share' });
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            safeSend?.({ type: 'theater_sync', rtcType: 'offer', offer });
            showHud('📡 Streaming OTT Tab to Partner!');
        } catch {
            setIsSharingScreen(false);
        }
    };

    // Handle incoming WebSocket events (Video sync + WebRTC OTT stream signaling)
    useEffect(() => {
        if (!incomingTheaterEvent) return;

        const handleRtcSignaling = async () => {
            if (incomingTheaterEvent.rtcType === 'offer' && incomingTheaterEvent.offer) {
                const pc = createPeerConnection();
                await pc.setRemoteDescription(new RTCSessionDescription(incomingTheaterEvent.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                safeSend?.({ type: 'theater_sync', rtcType: 'answer', answer });
                return;
            }
            if (incomingTheaterEvent.rtcType === 'answer' && incomingTheaterEvent.answer && pcRef.current) {
                await pcRef.current.setRemoteDescription(new RTCSessionDescription(incomingTheaterEvent.answer));
                return;
            }
            if (incomingTheaterEvent.rtcType === 'candidate' && incomingTheaterEvent.candidate && pcRef.current) {
                try {
                    await pcRef.current.addIceCandidate(new RTCIceCandidate(incomingTheaterEvent.candidate));
                } catch { }
                return;
            }
            if (incomingTheaterEvent.rtcType === 'stop_share') {
                cleanupWebRtc();
                return;
            }
        };

        if (incomingTheaterEvent.rtcType) {
            handleRtcSignaling();
            return;
        }

        suppressBroadcastRef.current = true;
        if (incomingTheaterEvent.mediaState) {
            setMediaState(incomingTheaterEvent.mediaState);
            localStorage.setItem('us_theater_media_v2', JSON.stringify(incomingTheaterEvent.mediaState));
        }
        if (typeof incomingTheaterEvent.isPlaying === 'boolean') {
            if (incomingTheaterEvent.hudLabel) showHud(incomingTheaterEvent.hudLabel);
            setTimeout(() => {
                applyPlayStateToPlayer(incomingTheaterEvent.isPlaying, incomingTheaterEvent.currentTime);
                suppressBroadcastRef.current = false;
            }, 60);
        } else {
            suppressBroadcastRef.current = false;
        }
    }, [incomingTheaterEvent, applyPlayStateToPlayer, createPeerConnection, cleanupWebRtc, safeSend]);

    const handleTogglePlayForBoth = useCallback(() => {
        const nextPlay = !isPlayingRef.current;
        const currentSec =
            mediaStateRef.current.kind === 'video' && htmlVideoRef.current
                ? Math.floor(htmlVideoRef.current.currentTime)
                : Math.floor(approxTimeRef.current);

        const label = nextPlay ? '▶ Playing for Both' : '⏸ Paused for Both';
        showHud(label);
        applyPlayStateToPlayer(nextPlay, currentSec);

        safeSend?.({
            type: 'theater_sync',
            mediaState: mediaStateRef.current,
            isPlaying: nextPlay,
            currentTime: currentSec,
            hudLabel: label
        });
    }, [applyPlayStateToPlayer, safeSend]);

    const handleSeekByDelta = useCallback(
        (deltaSeconds) => {
            const baseTime =
                mediaStateRef.current.kind === 'video' && htmlVideoRef.current
                    ? htmlVideoRef.current.currentTime
                    : approxTimeRef.current;
            const targetSec = Math.max(0, Math.floor(baseTime + deltaSeconds));
            const label = deltaSeconds > 0 ? `⏩ +${deltaSeconds}s Synced` : `⏪ ${deltaSeconds}s Synced`;

            showHud(label);
            applyPlayStateToPlayer(isPlayingRef.current, targetSec);

            safeSend?.({
                type: 'theater_sync',
                mediaState: mediaStateRef.current,
                isPlaying: isPlayingRef.current,
                currentTime: targetSec,
                hudLabel: label
            });
        },
        [applyPlayStateToPlayer, safeSend]
    );

    // KEYBOARD SHORTCUTS: Spacebar (Play/Pause), Left Arrow (-10s), Right Arrow (+10s)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const tag = (e.target?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
                return;
            }

            if (e.code === 'Space') {
                e.preventDefault();
                handleTogglePlayForBoth();
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                handleSeekByDelta(-10);
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                handleSeekByDelta(10);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleTogglePlayForBoth, handleSeekByDelta]);

    const handleLoadUrl = async (e) => {
        e.preventDefault();
        const raw = videoInput.trim();
        if (!raw) return;

        // Check if user pasted a DRM OTT platform link (Hotstar, Netflix, Prime Video, JioCinema)
        if (/hotstar\.com|netflix\.com|primevideo\.com|jiocinema\.com|sonyliv\.com|zee5\.com/i.test(raw)) {
            setShowOttHelp(true);
            setVideoInput('');
            return;
        }

        let parsed = parseUniversalMedia(raw);

        if (parsed.kind === 'unknown') {
            setIsResolving(true);
            try {
                const res = await fetch(`${API_BASE_URL}/api/ldr/resolve-video?url=${encodeURIComponent(raw)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.resolved_type === 'video' && data.stream_url) {
                        const proxiedUrl = `${API_BASE_URL}/api/ldr/proxy-video?url=${encodeURIComponent(data.stream_url)}`;
                        parsed = { kind: 'video', streamUrl: proxiedUrl, raw, title: data.title };
                    } else {
                        parsed = { kind: 'iframe', embedUrl: data.stream_url || raw, raw };
                    }
                } else {
                    parsed = { kind: 'iframe', embedUrl: raw, raw };
                }
            } catch {
                parsed = { kind: 'iframe', embedUrl: raw, raw };
            } finally {
                setIsResolving(false);
            }
        }

        approxTimeRef.current = 0;
        setMediaState(parsed);
        setIsPlaying(true);
        localStorage.setItem('us_theater_media_v2', JSON.stringify(parsed));
        setVideoInput('');

        safeSend?.({
            type: 'theater_sync',
            mediaState: parsed,
            isPlaying: true,
            currentTime: 0,
            hudLabel: '📺 Loaded New Video'
        });
    };

    return (
        <div
            ref={stageRef}
            tabIndex={-1}
            className="flex-1 flex flex-col p-4 sm:p-6 bg-stone-950 text-white overflow-y-auto min-w-0 outline-none"
        >
            {/* Top Bar: Universal URL Input + OTT Live Tab Streamer + Controls */}
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 mb-3">
                <form onSubmit={handleLoadUrl} className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={videoInput}
                        onChange={(e) => setVideoInput(e.target.value)}
                        placeholder="Paste YouTube, X.com, Instagram, MP4, Drive, or click '📡 Stream OTT Tab' for Hotstar..."
                        className="flex-1 min-w-0 bg-stone-900 border border-stone-800 rounded-xl px-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
                    />
                    <button
                        type="submit"
                        disabled={isResolving}
                        className="bg-white text-stone-900 hover:bg-rose-100 disabled:opacity-50 px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition-colors"
                    >
                        {isResolving ? 'Extracting...' : 'Load Link 📺'}
                    </button>
                </form>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => handleSeekByDelta(-10)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
                        title="Rewind 10s for Both (Left Arrow Key)"
                    >
                        ⏪ -10s
                    </button>

                    <button
                        type="button"
                        onClick={handleTogglePlayForBoth}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${isPlaying
                                ? 'bg-amber-500 hover:bg-amber-600 text-stone-950'
                                : 'bg-rose-500 hover:bg-rose-600 text-white'
                            }`}
                        title="Play/Pause for Both (Spacebar)"
                    >
                        {isPlaying ? '⏸ Pause' : '▶ Play'}
                    </button>

                    <button
                        type="button"
                        onClick={() => handleSeekByDelta(10)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
                        title="Forward 10s for Both (Right Arrow Key)"
                    >
                        +10s ⏩
                    </button>

                    {/* OTT Live Screen/Tab Streamer Button for Hotstar, Netflix, Prime Video */}
                    {isSharingScreen ? (
                        <button
                            type="button"
                            onClick={() => {
                                cleanupWebRtc();
                                safeSend?.({ type: 'theater_sync', rtcType: 'stop_share' });
                            }}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                        >
                            ⏹ Stop OTT Stream
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={startOttTabShare}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer flex items-center gap-1 shadow-md"
                            title="Stream Hotstar, Netflix, Prime Video, or any Browser Tab with Audio to Partner"
                        >
                            <span>📡 Stream OTT Tab</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Keyboard Shortcuts Hint Strip */}
            <div className="flex items-center justify-between text-[11px] text-stone-400 mb-2 px-1">
                <span>
                    ⌨️ Shortcuts synced for both: <b className="text-stone-300">Spacebar</b> Play/Pause ·{' '}
                    <b className="text-stone-300">←</b> -10s · <b className="text-stone-300">→</b> +10s
                </span>
                <button
                    type="button"
                    onClick={() => setShowOttHelp((prev) => !prev)}
                    className="text-rose-400 hover:underline font-semibold cursor-pointer"
                >
                    {showOttHelp ? 'Hide Hotstar/OTT Tip ▲' : 'How to Watch Hotstar / Netflix? ▼'}
                </button>
            </div>

            {/* Hotstar / OTT Streaming Guide Banner */}
            {showOttHelp && (
                <div className="mb-3 bg-indigo-950/70 border border-indigo-500/40 rounded-2xl p-3.5 text-xs text-indigo-100 space-y-1.5 animate-in fade-in duration-150">
                    <div className="font-bold text-indigo-300 flex items-center justify-between">
                        <span>🍿 How to Watch Hotstar, Netflix, or Prime Video Together:</span>
                        <button onClick={() => setShowOttHelp(false)} className="text-indigo-300 hover:text-white">✕</button>
                    </div>
                    <p>
                        1. Open your movie on <b>Hotstar / Netflix</b> in another browser tab on your laptop.<br />
                        2. Click the purple <b>📡 Stream OTT Tab</b> button above, select that browser tab, and check <b>"Also share tab audio"</b>.<br />
                        3. <b>Pro Tip (If Hotstar shows a black screen):</b> Open Chrome/Edge Settings → <b>System</b> → turn OFF <i>"Use graphics acceleration when available"</i>. That disables DRM black-out so the movie streams crystal clear!
                    </p>
                </div>
            )}

            {/* Full-Width Cinema Stage */}
            <div
                onClick={() => stageRef.current?.focus()}
                className="flex-1 w-full rounded-2xl overflow-hidden border border-stone-800 bg-black shadow-2xl flex items-center justify-center relative min-h-[280px]"
            >
                {/* On-Screen Keyboard Action Toast (OSD) */}
                {hudToast && (
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-md text-white px-5 py-2 rounded-full text-xs sm:text-sm font-bold border border-white/20 shadow-2xl pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                        {hudToast}
                    </div>
                )}

                {/* Live WebRTC OTT Stream View (When Streaming Hotstar / Netflix Tab) */}
                {isSharingScreen || isReceivingScreen ? (
                    <video
                        ref={screenVideoRef}
                        autoPlay
                        playsInline
                        controls
                        className="w-full h-full max-h-[460px] object-contain"
                    />
                ) : mediaState.kind === 'video' ? (
                    <video
                        ref={htmlVideoRef}
                        key={mediaState.streamUrl}
                        src={mediaState.streamUrl}
                        controls
                        playsInline
                        onTimeUpdate={() => {
                            if (htmlVideoRef.current) {
                                approxTimeRef.current = htmlVideoRef.current.currentTime;
                            }
                        }}
                        onPlay={() => {
                            setIsPlaying(true);
                            if (!suppressBroadcastRef.current) {
                                safeSend?.({
                                    type: 'theater_sync',
                                    mediaState,
                                    isPlaying: true,
                                    currentTime: Math.floor(htmlVideoRef.current?.currentTime || 0)
                                });
                            }
                        }}
                        onPause={() => {
                            setIsPlaying(false);
                            if (!suppressBroadcastRef.current) {
                                safeSend?.({
                                    type: 'theater_sync',
                                    mediaState,
                                    isPlaying: false,
                                    currentTime: Math.floor(htmlVideoRef.current?.currentTime || 0)
                                });
                            }
                        }}
                        className="w-full h-full max-h-[460px] object-contain"
                    />
                ) : (
                    <div className="relative w-full h-full min-h-[300px] sm:min-h-[430px]">
                        <iframe
                            ref={iframeRef}
                            key={mediaState.embedUrl}
                            src={mediaState.embedUrl}
                            title="Universal Watch Together Player"
                            onLoad={() => {
                                // Subscribe to YouTube currentTime delivery
                                iframeRef.current?.contentWindow?.postMessage(
                                    JSON.stringify({ event: 'listening', id: 1 }),
                                    '*'
                                );
                            }}
                            className="w-full h-full min-h-[300px] sm:min-h-[430px]"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                        />
                        {/* Transparent Top Focus Strip: Clicking video stage keeps keyboard focus on Watch Room so Spacebar & Arrows always work */}
                        <div
                            onClick={() => {
                                stageRef.current?.focus();
                                handleTogglePlayForBoth();
                            }}
                            title="Click to Play/Pause for Both (or press Spacebar / Arrow keys)"
                            className="absolute inset-x-0 top-0 bottom-12 z-20 cursor-pointer"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default SyncedTheaterRoom;