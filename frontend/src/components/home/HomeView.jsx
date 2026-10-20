import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../utils/apiUtils';
import { parseMediaUrl } from '../../utils/mediaParser';
import { getPartnerNames } from '../../utils/userIdentity';
import DualCitySkyBar from '../ldr/DualCitySkyBar';

export const HomeView = ({
    daysTogether,
    ldrStatus,
    onLdrConfigUpdated,
    moods,
    partnerRole,
    onOpenBoardingPass,
    onOpenEnvelopes,
    onOpenConnectionHub,
    onOpenLocket,
    onNavigateTab
}) => {
    const [widgetState, setWidgetState] = useState(null);
    const names = getPartnerNames();
    const myName = names[partnerRole] || (partnerRole === 'partner_his' ? 'Parv' : 'Pookie');
    const partnerName =
        names[partnerRole === 'partner_his' ? 'partner_her' : 'partner_his'] ||
        (partnerRole === 'partner_his' ? 'Her' : 'Him');

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/widget/state?viewer_role=${partnerRole}`)
            .then((r) => r.json())
            .then((data) => setWidgetState(data))
            .catch(() => { });
    }, [partnerRole]);

    const activeCard = widgetState?.card;
    const parsedCardImg = activeCard?.image_url ? parseMediaUrl(activeCard.image_url) : null;

    return (
        <div className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8 py-6 sm:py-10 pb-32 space-y-8">
            {/* 1. Hero Welcome Banner */}
            <div className="text-center space-y-3">
                <div className="inline-flex items-center gap-2 bg-white/80 vault-surface backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/80 shadow-xs">
                    <span className="text-rose-500 animate-pulse text-xs">❤️</span>
                    <span className="text-xs font-bold text-rose-600 tracking-wide">
                        {daysTogether} Days Together · Welcome back, {myName}
                    </span>
                </div>

                <h2 className="text-4xl sm:text-6xl font-serif font-bold text-stone-800 tracking-tight">
                    Our Shared Sanctuary
                </h2>
                <p className="text-stone-600 max-w-xl mx-auto text-sm sm:text-base">
                    Even across the miles, under the exact same sky.
                </p>
            </div>

            {/* 2. Dual-City Sky Bar & Live Mood Strip */}
            <div className="space-y-3">
                <DualCitySkyBar
                    sky={ldrStatus?.sky}
                    onOpenBoardingPass={onOpenBoardingPass}
                    onOpenEnvelopes={onOpenEnvelopes}
                    onConfigUpdated={onLdrConfigUpdated}
                />

                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={onOpenConnectionHub}
                        className="vault-surface bg-white/80 hover:bg-white backdrop-blur-xl border border-white/85 rounded-full px-5 py-2 text-xs font-bold text-stone-700 shadow-sm flex flex-wrap items-center justify-center gap-2.5 cursor-pointer transition-all hover:scale-[1.01]"
                    >
                        <span>🤵 {names.partner_his}: {moods.hisMood}</span>
                        <span className="text-stone-300">•</span>
                        <span>👰 {names.partner_her}: {moods.herMood}</span>
                        <span className="text-rose-500 font-extrabold ml-1">🔐 Daily Question & Corkboard →</span>
                    </button>
                </div>
            </div>

            {/* 3. Main Dashboard Grid: 4x4 Live Partner Widget Card + Quick Portals */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                {/* Left: Live 4x4 Pocket Locket Widget Card (Shows what your partner uploaded for you, or Pookie's note) */}
                <div className="lg:col-span-5 flex flex-col">
                    <div
                        onClick={onOpenLocket}
                        style={{
                            backgroundColor: activeCard?.color || '#fff1f2',
                            color: activeCard?.textColor || '#1c1917'
                        }}
                        className="w-full aspect-square max-w-[380px] mx-auto rounded-[2.5rem] p-6 shadow-2xl border-4 border-white/90 flex flex-col justify-between cursor-pointer hover:scale-[1.01] transition-all relative overflow-hidden"
                    >
                        <div className="flex items-center justify-between gap-2 z-10">
                            <span className="text-xs font-extrabold px-3.5 py-1 rounded-full bg-black/10 backdrop-blur-xs">
                                {activeCard?.badge || `💌 ${partnerName}'s Locket`}
                            </span>
                            <span className="text-[11px] font-mono opacity-75">
                                {activeCard?.updated_at || 'Live 4x4'}
                            </span>
                        </div>

                        {parsedCardImg ? (
                            <div className="my-3 flex-1 min-h-0 bg-white p-2 rounded-3xl shadow-lg rotate-1 overflow-hidden flex items-center justify-center">
                                <img
                                    src={parsedCardImg.thumb || parsedCardImg.original}
                                    alt="Partner Widget Drop"
                                    className="w-full h-full object-cover rounded-2xl"
                                />
                            </div>
                        ) : (
                            <div className="my-auto py-4 text-center space-y-2">
                                <span className="text-5xl block">🌸</span>
                            </div>
                        )}

                        <div className="z-10">
                            <h3 className="font-serif font-bold text-xl leading-snug">
                                {activeCard?.title || `Note for ${myName}`}
                            </h3>
                            <p className="text-xs sm:text-sm opacity-90 line-clamp-2 mt-1">
                                {activeCard?.note || 'Tap to drop a photo or sticky note onto your partner’s 4x4 widget!'}
                            </p>
                            <div className="mt-3 pt-2.5 border-t border-black/10 flex items-center justify-between text-[11px] font-bold">
                                <span>📱 Pookie’s 4×4 Pocket Locket</span>
                                <span className="underline">Post / Setup →</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Quick Sanctuary Portals */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div
                        onClick={() => onNavigateTab('vault')}
                        className="vault-surface bg-white/75 hover:bg-white backdrop-blur-2xl rounded-3xl p-6 border border-white/80 shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
                    >
                        <div>
                            <span className="text-3xl block mb-2">📸</span>
                            <h3 className="font-serif font-bold text-xl text-stone-800">Our Memory Vault</h3>
                            <p className="text-xs text-stone-500 mt-1">
                                Browse our timeline from December to January, Constant Albums, and PIN-locked sanctuary.
                            </p>
                        </div>
                        <span className="text-xs font-bold text-rose-500 mt-4 inline-block">Open Vault →</span>
                    </div>

                    <div
                        onClick={() => onNavigateTab('planner')}
                        className="vault-surface bg-white/75 hover:bg-white backdrop-blur-2xl rounded-3xl p-6 border border-white/80 shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
                    >
                        <div>
                            <span className="text-3xl block mb-2">💬</span>
                            <h3 className="font-serif font-bold text-xl text-stone-800">Live Chat, Goals & Watch</h3>
                            <p className="text-xs text-stone-500 mt-1">
                                Chat in real time, check off our 5 Bucket List boxes, or watch movies together.
                            </p>
                        </div>
                        <span className="text-xs font-bold text-rose-500 mt-4 inline-block">Open Planner →</span>
                    </div>

                    <div
                        onClick={onOpenBoardingPass}
                        className="vault-surface bg-white/75 hover:bg-white backdrop-blur-2xl rounded-3xl p-6 border border-white/80 shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
                    >
                        <div>
                            <span className="text-3xl block mb-2">🎫</span>
                            <h3 className="font-serif font-bold text-xl text-stone-800">Next Meetup Ticket</h3>
                            <p className="text-xs text-stone-500 mt-1">
                                Live countdown to the exact hour we hold each other again.
                            </p>
                        </div>
                        <span className="text-xs font-bold text-rose-500 mt-4 inline-block">View Boarding Pass →</span>
                    </div>

                    <div
                        onClick={onOpenEnvelopes}
                        className="vault-surface bg-white/75 hover:bg-white backdrop-blur-2xl rounded-3xl p-6 border border-white/80 shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
                    >
                        <div>
                            <span className="text-3xl block mb-2">💌</span>
                            <h3 className="font-serif font-bold text-xl text-stone-800">“Open When…” Letters</h3>
                            <p className="text-xs text-stone-500 mt-1">
                                Wax-sealed digital envelopes for late nights and quiet moments.
                            </p>
                        </div>
                        <span className="text-xs font-bold text-rose-500 mt-4 inline-block">Open Envelopes →</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HomeView;