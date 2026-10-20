import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';

export const MeetupBoardingPass = ({ isOpen, onClose, meetup, sky, onConfigUpdated }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [targetDate, setTargetDate] = useState(meetup?.target_date || '2026-11-14T18:00');
    const [destination, setDestination] = useState(meetup?.destination || 'Our Next Meetup ✨');
    const [flightCode, setFlightCode] = useState(meetup?.flight_code || 'US-0504');
    const [notes, setNotes] = useState(meetup?.notes || '');
    const [nowMs, setNowMs] = useState(Date.now());

    useEffect(() => {
        if (!isOpen) return;
        const t = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(t);
    }, [isOpen]);

    useEffect(() => {
        if (meetup) {
            setTargetDate(meetup.target_date || '2026-11-14T18:00');
            setDestination(meetup.destination || 'Our Next Meetup ✨');
            setFlightCode(meetup.flight_code || 'US-0504');
            setNotes(meetup.notes || '');
        }
    }, [meetup]);

    if (!isOpen) return null;

    const targetMs = new Date(meetup?.target_date || targetDate).getTime();
    const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
    const isReunited = diffSec <= 0;

    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/api/ldr/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target_date: targetDate,
                    destination,
                    flight_code: flightCode,
                    notes
                })
            });
            if (res.ok) {
                const data = await res.json();
                onConfigUpdated?.(data);
                setIsEditing(false);
            }
        } catch { }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-2xl rounded-[2.25rem] max-w-md w-full overflow-hidden shadow-2xl border border-white/80">
                {/* Boarding Pass Top Header */}
                <div
                    className={`p-6 text-white flex items-center justify-between ${isReunited
                            ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500'
                            : 'bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900'
                        }`}
                >
                    <div>
                        <span className="text-[10px] font-mono uppercase tracking-widest opacity-75 block">
                            {isReunited ? '★ REUNITED / TOGETHER MODE ACTIVE ★' : `BOARDING PASS · ${meetup?.flight_code || 'US-0504'}`}
                        </span>
                        <h3 className="text-xl font-serif font-bold mt-0.5">
                            {isReunited ? 'In Each Other’s Arms 💖' : 'Until I Hold You Again'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-1.5 bg-white/15 hover:bg-white/25 rounded-full">
                        <Icons.X />
                    </button>
                </div>

                <div className="p-6">
                    {/* Route Strip */}
                    <div className="flex items-center justify-between bg-stone-50 border border-stone-200/80 rounded-2xl p-4 mb-5">
                        <div className="text-left">
                            <span className="text-[10px] font-mono uppercase text-stone-400 block">FROM</span>
                            <span className="text-base font-serif font-bold text-stone-800">{sky?.city_a?.city || 'City A'}</span>
                        </div>
                        <div className="flex flex-col items-center px-3">
                            <span className="text-lg">✈️</span>
                            <span className="text-[10px] font-mono text-rose-500 font-bold">{sky?.distance_km || '--'} km</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-mono uppercase text-stone-400 block">TO</span>
                            <span className="text-base font-serif font-bold text-stone-800">{sky?.city_b?.city || 'City B'}</span>
                        </div>
                    </div>

                    {isEditing ? (
                        <form onSubmit={handleSave} className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-stone-500 uppercase text-[10px] mb-1">Next Meetup Date & Time</label>
                                <input
                                    type="datetime-local"
                                    value={targetDate}
                                    onChange={(e) => setTargetDate(e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block font-bold text-stone-500 uppercase text-[10px] mb-1">Occasion / Place</label>
                                    <input
                                        type="text"
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value)}
                                        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-stone-500 uppercase text-[10px] mb-1">Flight / Train Code</label>
                                    <input
                                        type="text"
                                        value={flightCode}
                                        onChange={(e) => setFlightCode(e.target.value)}
                                        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block font-bold text-stone-500 uppercase text-[10px] mb-1">Sweet Note</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-full bg-stone-100">
                                    Cancel
                                </button>
                                <button type="submit" className="px-5 py-2 rounded-full bg-stone-900 text-white font-bold">
                                    Save Ticket
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            {isReunited ? (
                                <div className="text-center py-6 bg-amber-50/80 border border-amber-200 rounded-2xl mb-4">
                                    <span className="text-4xl block mb-2">🥂✨</span>
                                    <h4 className="font-serif font-bold text-lg text-stone-800">The Distance Is Zero!</h4>
                                    <p className="text-xs text-stone-600 mt-1 px-4">
                                        Enjoy every second together and remember to dump all your new photos into the Memory Vault!
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-2 text-center mb-5">
                                    {[
                                        { val: days, label: 'Days' },
                                        { val: hours, label: 'Hours' },
                                        { val: mins, label: 'Mins' },
                                        { val: secs, label: 'Secs' }
                                    ].map((unit) => (
                                        <div key={unit.label} className="bg-rose-50/70 border border-rose-200/70 rounded-2xl py-3">
                                            <span className="text-2xl font-serif font-bold text-rose-600 block">{unit.val}</span>
                                            <span className="text-[10px] uppercase tracking-wider text-stone-500 font-bold">{unit.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="border-t border-dashed border-stone-300 pt-4 flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-bold text-stone-800 block">{meetup?.destination}</span>
                                    <span className="text-stone-500 text-[11px]">{meetup?.notes}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="px-3.5 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold shrink-0"
                                >
                                    ✏️ Edit Date
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MeetupBoardingPass;