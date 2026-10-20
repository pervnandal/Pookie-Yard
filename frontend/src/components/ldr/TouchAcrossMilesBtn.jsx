import React, { useState, useEffect } from 'react';
import { API_BASE_URL, WS_BASE_URL } from '../../utils/apiUtils';

export const TouchAcrossMilesBtn = () => {
    const [userId] = useState(() => {
        let s = localStorage.getItem('us_planner_id');
        if (!s) {
            s = `user_${Math.floor(Math.random() * 10000)}`;
            localStorage.setItem('us_planner_id', s);
        }
        return s;
    });

    const [burstBanner, setBurstBanner] = useState(null);
    const [petals, setPetals] = useState([]);

    const triggerBlossomShower = (messageText) => {
        if (navigator.vibrate) navigator.vibrate([120, 80, 180]);
        setBurstBanner(messageText);
        const generated = Array.from({ length: 18 }).map((_, idx) => ({
            id: `${Date.now()}_${idx}`,
            left: `${Math.floor(Math.random() * 92) + 4}%`,
            delay: `${(Math.random() * 1.2).toFixed(2)}s`,
            emoji: idx % 2 === 0 ? '🌸' : '💖'
        }));
        setPetals(generated);
        setTimeout(() => {
            setBurstBanner(null);
            setPetals([]);
        }, 5500);
    };

    // Claim any offline hugs queued while away + listen for live WebSocket hugs
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/ldr/hugs/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender_id: userId })
        })
            .then((r) => r.json())
            .then((data) => {
                if (data?.claimed_count > 0) {
                    triggerBlossomShower(
                        `🌸 Your partner sent you ${data.claimed_count} ${data.claimed_count === 1 ? 'hug' : 'hugs'
                        } while you were away!`
                    );
                }
            })
            .catch(() => { });

        let ws;
        try {
            ws = new WebSocket(`${WS_BASE_URL}/ws/chat`);
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'live_hug' && data.senderId !== userId) {
                        triggerBlossomShower(`💖 ${data.senderName || 'Your partner'} is thinking of you right now!`);
                    }
                } catch { }
            };
        } catch { }

        return () => {
            if (ws) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                } else if (ws.readyState === WebSocket.CONNECTING) {
                    ws.onopen = () => ws.close();
                }
            }
        };
    }, [userId]);

    const handleSendHug = async () => {
        const senderName = localStorage.getItem('us_locket_sender') || 'Your Partner';
        triggerBlossomShower('🌸 Sent a live hug across the miles!');
        try {
            await fetch(`${API_BASE_URL}/api/ldr/hug`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_id: userId, sender_name: senderName })
            });
        } catch { }
    };

    return (
        <>
            <button
                type="button"
                onClick={handleSendHug}
                title="Touch Across the Miles: Send a Live Hug 🌸"
                className="w-11 h-11 rounded-full bg-gradient-to-tr from-rose-500 to-pink-400 text-white shadow-lg hover:shadow-xl transition-all hover:scale-110 active:scale-90 border border-white/80 flex items-center justify-center cursor-pointer"
            >
                <span className="text-lg">🫂</span>
            </button>

            {/* Cherry Blossom & Heart Burst Overlay */}
            {burstBanner && (
                <div className="fixed inset-0 pointer-events-none z-[300] overflow-hidden flex justify-center">
                    <div className="mt-20 h-fit bg-stone-900/90 backdrop-blur-xl text-white px-6 py-3 rounded-full shadow-2xl border border-rose-300/40 text-xs sm:text-sm font-bold animate-bounce">
                        {burstBanner}
                    </div>
                    {petals.map((p) => (
                        <span
                            key={p.id}
                            style={{ left: p.left, animationDelay: p.delay }}
                            className="fixed top-[-10%] text-2xl animate-[ bounce_3.5s_infinite ] opacity-90"
                        >
                            {p.emoji}
                        </span>
                    ))}
                </div>
            )}
        </>
    );
};

export default TouchAcrossMilesBtn;