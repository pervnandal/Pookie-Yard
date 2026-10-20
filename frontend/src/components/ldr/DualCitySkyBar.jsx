import React, { useState } from 'react';
import { API_BASE_URL } from '../../utils/apiUtils';

export const DualCitySkyBar = ({ sky, onOpenBoardingPass, onOpenEnvelopes, onConfigUpdated }) => {
    const [isEditingCities, setIsEditingCities] = useState(false);
    const [cityA, setCityA] = useState(sky?.city_a?.city || 'Faridabad');
    const [cityB, setCityB] = useState(sky?.city_b?.city || 'Delhi');

    if (!sky) return null;

    const handleSaveCities = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/api/ldr/config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ city_a: cityA, city_b: cityB })
            });
            if (res.ok) {
                const data = await res.json();
                onConfigUpdated?.(data);
                setIsEditingCities(false);
            }
        } catch { }
    };

    return (
        <div className="max-w-4xl mx-auto w-full px-4 pt-3 z-20">
            <div className="bg-white/65 backdrop-blur-xl border border-white/80 rounded-full px-4 py-2 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs text-stone-700">
                {isEditingCities ? (
                    <form onSubmit={handleSaveCities} className="flex items-center gap-2 w-full justify-center">
                        <input
                            type="text"
                            value={cityA}
                            onChange={(e) => setCityA(e.target.value)}
                            placeholder="Your City"
                            className="bg-white border border-stone-200 rounded-full px-3 py-1 text-xs w-28 sm:w-36"
                        />
                        <span className="text-rose-500 font-bold">✈️</span>
                        <input
                            type="text"
                            value={cityB}
                            onChange={(e) => setCityB(e.target.value)}
                            placeholder="Partner's City"
                            className="bg-white border border-stone-200 rounded-full px-3 py-1 text-xs w-28 sm:w-36"
                        />
                        <button type="submit" className="bg-stone-900 text-white px-3 py-1 rounded-full font-bold">
                            Save
                        </button>
                        <button type="button" onClick={() => setIsEditingCities(false)} className="text-stone-400 px-1">
                            ✕
                        </button>
                    </form>
                ) : (
                    <>
                        {/* Dual City Weather & Flight Path */}
                        <div
                            onClick={() => {
                                setCityA(sky.city_a?.city || 'Faridabad');
                                setCityB(sky.city_b?.city || 'Delhi');
                                setIsEditingCities(true);
                            }}
                            title="Click to customize cities"
                            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity mx-auto sm:mx-0"
                        >
                            <span className="font-semibold flex items-center gap-1">
                                <span>{sky.city_a?.icon}</span>
                                <span>{sky.city_a?.city}</span>
                                <span className="text-rose-600 font-bold">{sky.city_a?.temp}°C</span>
                            </span>

                            <span className="flex items-center gap-1 text-[10px] font-mono text-stone-400">
                                <span className="hidden sm:inline">····</span>
                                <span>✈️ {sky.distance_km} km</span>
                                <span className="hidden sm:inline">····</span>
                            </span>

                            <span className="font-semibold flex items-center gap-1">
                                <span>{sky.city_b?.icon}</span>
                                <span>{sky.city_b?.city}</span>
                                <span className="text-rose-600 font-bold">{sky.city_b?.temp}°C</span>
                            </span>
                        </div>

                        {/* Quick LDR Action Pills */}
                        <div className="flex items-center gap-1.5 mx-auto sm:mx-0">
                            <button
                                type="button"
                                onClick={onOpenBoardingPass}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer"
                            >
                                🎫 Next Meetup
                            </button>
                            <button
                                type="button"
                                onClick={onOpenEnvelopes}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer"
                            >
                                💌 Open When...
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default DualCitySkyBar;