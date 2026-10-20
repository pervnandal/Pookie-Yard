import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';

export const PookieConciergeModal = ({ isOpen, onClose, currentContent, onApplyItinerary }) => {
    const [roughNotes, setRoughNotes] = useState('');
    const [city, setCity] = useState(() => localStorage.getItem('us_locket_city') || 'Faridabad');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleGenerate = async (e) => {
        e.preventDefault();
        if (!roughNotes.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/ldr/concierge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rough_notes: roughNotes,
                    city,
                    current_content: currentContent
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.itinerary) {
                    onApplyItinerary(data.itinerary);
                    onClose();
                }
            }
        } catch { } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-md animate-in fade-in duration-150">
            <div className="bg-white/95 backdrop-blur-2xl rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/80">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">✨</span>
                        <div>
                            <h3 className="font-serif font-bold text-lg text-stone-800">Pookie Date Concierge</h3>
                            <p className="text-[11px] text-stone-500">Live weather + real nearby spot itinerary builder</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full">
                        <Icons.X />
                    </button>
                </div>

                <form onSubmit={handleGenerate} className="space-y-3.5 text-xs">
                    <div>
                        <label className="block font-bold uppercase text-[10px] text-stone-500 mb-1">City / Area</label>
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="e.g., Faridabad, Sector 15, Delhi..."
                            className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2"
                        />
                    </div>
                    <div>
                        <label className="block font-bold uppercase text-[10px] text-stone-500 mb-1">
                            Your Rough Date Ideas or Vibe
                        </label>
                        <textarea
                            rows={3}
                            required
                            value={roughNotes}
                            onChange={(e) => setRoughNotes(e.target.value)}
                            placeholder="e.g., Saturday 5pm, iced coffee, sunset walk in a park, and pasta dinner..."
                            className="w-full bg-white border border-stone-200 rounded-xl p-3 resize-none"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold rounded-2xl shadow-md cursor-pointer disabled:opacity-50"
                    >
                        {loading ? 'Pookie is checking the weather & cafes...' : '✨ Format & Plan Our Date'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PookieConciergeModal;