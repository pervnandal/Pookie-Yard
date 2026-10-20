import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../common/Icons';

const MYSTERY_DATES = [
    { title: 'Late-Night Dessert & Playlist Drive 🍦🚗', vibe: 'Cozy & Spontaneous', cost: '₹400', tip: 'Each of you queues 5 secret songs that remind you of each other.' },
    { title: 'Sunset Rooftop Coffee & Polaroid Walk ☕📸', vibe: 'Golden Hour Romance', cost: '₹600', tip: 'Take 3 candid photos of each other without posing!' },
    { title: 'Synced Cook-Off & Candlelight Video Date 🍝🕯️', vibe: 'LDR Special Night', cost: '₹500', tip: 'Order or cook the exact same dish and rate each other’s plating.' },
    { title: 'Street Food Tour & Ice Cream Challenge 🥟🍨', vibe: 'Fun & playful', cost: '₹350', tip: 'Winner of rock-paper-scissors picks the next stall!' }
];

export const MysteryDateAndReceiptModal = ({ isOpen, onClose, activePlanTitle, activePlanContent }) => {
    const [tab, setTab] = useState('scratch'); // 'scratch' | 'receipt'
    const [cardIdx, setCardIdx] = useState(0);
    const [scratchedPercent, setScratchedPercent] = useState(0);
    const canvasRef = useRef(null);
    const isDrawingRef = useRef(false);

    const currentMystery = MYSTERY_DATES[cardIdx % MYSTERY_DATES.length];

    const initFoilCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'source-over';

        // Metallic Rose-Gold Foil Gradient
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, '#f43f5e');
        grad.addColorStop(0.5, '#fbbf24');
        grad.addColorStop(1, '#ec4899');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('✨ SCRATCH FOIL WITH FINGER OR MOUSE ✨', canvas.width / 2, canvas.height / 2 - 6);
        ctx.font = '12px sans-serif';
        ctx.fillText('Reveal Tonight’s Mystery Date Card', canvas.width / 2, canvas.height / 2 + 18);
        setScratchedPercent(0);
    };

    useEffect(() => {
        if (isOpen && tab === 'scratch') {
            setTimeout(initFoilCanvas, 50);
        }
    }, [isOpen, tab, cardIdx]);

    if (!isOpen) return null;

    const scratchAt = (clientX, clientY) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * canvas.width;
        const y = ((clientY - rect.top) / rect.height) * canvas.height;

        const ctx = canvas.getContext('2d');
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(x, y, 26, 0, Math.PI * 2);
        ctx.fill();
        setScratchedPercent((p) => Math.min(100, p + 2));
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-white/95 backdrop-blur-2xl rounded-[2.25rem] max-w-md w-full p-6 shadow-2xl border border-white/80 text-stone-800">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-1.5 bg-stone-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setTab('scratch')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${tab === 'scratch' ? 'bg-stone-900 text-white' : 'text-stone-600'
                                }`}
                        >
                            🪙 Scratch-Off Date
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('receipt')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${tab === 'receipt' ? 'bg-stone-900 text-white' : 'text-stone-600'
                                }`}
                        >
                            🧾 Date Night Receipt
                        </button>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full">
                        <Icons.X />
                    </button>
                </div>

                {tab === 'scratch' ? (
                    <div className="space-y-4 text-center">
                        <div className="relative w-full h-52 rounded-3xl overflow-hidden border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-amber-50 p-6 flex flex-col items-center justify-center shadow-inner select-none">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500">
                                {currentMystery.vibe} · Est. {currentMystery.cost}
                            </span>
                            <h3 className="text-xl font-serif font-bold text-stone-800 mt-1">
                                {currentMystery.title}
                            </h3>
                            <p className="text-xs text-stone-600 mt-2 max-w-xs">{currentMystery.tip}</p>

                            {/* Interactive Foil Canvas Overlay */}
                            <canvas
                                ref={canvasRef}
                                width={380}
                                height={210}
                                onMouseDown={() => { isDrawingRef.current = true; }}
                                onMouseUp={() => { isDrawingRef.current = false; }}
                                onMouseMove={(e) => {
                                    if (isDrawingRef.current) scratchAt(e.clientX, e.clientY);
                                }}
                                onTouchStart={(e) => {
                                    isDrawingRef.current = true;
                                    const t = e.touches[0];
                                    if (t) scratchAt(t.clientX, t.clientY);
                                }}
                                onTouchMove={(e) => {
                                    const t = e.touches[0];
                                    if (t) scratchAt(t.clientX, t.clientY);
                                }}
                                onTouchEnd={() => { isDrawingRef.current = false; }}
                                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
                            />
                        </div>

                        <div className="flex justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCardIdx((c) => c + 1)}
                                className="bg-stone-900 hover:bg-rose-600 text-white px-5 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer"
                            >
                                🎲 Deal New Mystery Foil Card
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Date Night Thermal Receipt Ticket */
                    <div className="bg-[#faf8f5] border border-stone-300 rounded-2xl p-5 font-mono text-xs text-stone-800 shadow-inner space-y-3">
                        <div className="text-center border-b border-dashed border-stone-400 pb-3">
                            <div className="font-bold text-sm uppercase">THE US SPACE · DATE TICKET</div>
                            <div className="text-[10px] text-stone-500">
                                ISSUED: {new Date().toLocaleDateString()} · ADMIT TWO 💖
                            </div>
                        </div>

                        <div className="space-y-1.5 py-1">
                            <div className="flex justify-between font-bold">
                                <span>EVENT:</span>
                                <span>{activePlanTitle || 'Our Special Date Night'}</span>
                            </div>
                            <div className="flex justify-between text-stone-600">
                                <span>DRESS CODE:</span>
                                <span>Cute & Comfy ✨</span>
                            </div>
                            <div className="flex justify-between text-stone-600">
                                <span>PRICE:</span>
                                <span>Unlimited Kisses & Hugs</span>
                            </div>
                        </div>

                        {activePlanContent && (
                            <div className="border-t border-dashed border-stone-400 pt-2 text-[11px] whitespace-pre-wrap max-h-36 overflow-y-auto custom-scrollbar">
                                {activePlanContent.slice(0, 280)}
                            </div>
                        )}

                        <div className="border-t border-dashed border-stone-400 pt-3 text-center text-[10px] tracking-widest text-stone-500">
                            |||| |||| || ||||| |||| ||| ||||
                            <div className="mt-1 font-sans font-bold text-rose-500">THANK YOU FOR BEING MINE 🌸</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MysteryDateAndReceiptModal;