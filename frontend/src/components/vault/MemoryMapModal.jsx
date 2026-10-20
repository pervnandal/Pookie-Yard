import React, { useState, useMemo } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';
import { extractVaultMeta, serializeVaultDescription, saveLocalAlbumMeta } from '../../utils/vaultMetaUtils';

export const MemoryMapModal = ({ isOpen, onClose, memories = [], onOpenMemory, onMemoryUpdated }) => {
    const [selectedAlbumId, setSelectedAlbumId] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [hoveredPinId, setHoveredPinId] = useState(null);

    const publicAlbums = useMemo(
        () =>
            (memories || []).filter((m) => {
                const { meta } = extractVaultMeta(m);
                return !meta.isPrivate;
            }),
        [memories]
    );

    // Compute deterministic or geocoded map coordinates for pinned albums
    const pinnedAlbums = useMemo(() => {
        return publicAlbums
            .map((m, idx) => {
                const { meta } = extractVaultMeta(m);
                if (!meta.locationName) return null;
                // Map lat/lon or deterministic pastel canvas coordinates (15%..85%)
                let x = 22 + ((idx * 37 + m.title.length * 13) % 60);
                let y = 25 + ((idx * 53 + meta.locationName.length * 17) % 55);
                if (typeof meta.lat === 'number' && typeof meta.lon === 'number') {
                    x = Math.min(88, Math.max(12, ((meta.lon + 180) / 360) * 100));
                    y = Math.min(85, Math.max(15, ((90 - meta.lat) / 180) * 100));
                }
                return {
                    album: m,
                    locationName: meta.locationName,
                    x,
                    y
                };
            })
            .filter(Boolean);
    }, [publicAlbums]);

    if (!isOpen) return null;

    const handlePinAlbumLocation = async (e) => {
        e.preventDefault();
        const target = publicAlbums.find((m) => String(m.id) === String(selectedAlbumId)) || publicAlbums[0];
        if (!target || !locationInput.trim()) return;

        setIsSaving(true);
        try {
            let lat = null;
            let lon = null;
            try {
                const geo = await fetch(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationInput.trim())}&count=1`
                ).then((r) => r.json());
                if (geo?.results?.[0]) {
                    lat = geo.results[0].latitude;
                    lon = geo.results[0].longitude;
                }
            } catch { }

            const { cleanDescription, meta } = extractVaultMeta(target);
            const nextMeta = { ...meta, locationName: locationInput.trim(), lat, lon };
            saveLocalAlbumMeta(target.id, nextMeta);
            const serialized = serializeVaultDescription(cleanDescription, nextMeta);

            await fetch(`${API_BASE_URL}/api/memories/${target.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: serialized })
            });

            setLocationInput('');
            onMemoryUpdated?.();
        } catch { } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-2xl rounded-[2.25rem] max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-white/80 max-h-[90vh] overflow-y-auto custom-scrollbar text-stone-800">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-stone-800">
                            Where We’ve Been · Memory Map 🗺️💖
                        </h2>
                        <p className="text-xs text-stone-500">
                            Pin every cafe, park, city, and trip to your shared pastel map. Click any heart pin to open the album!
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-700 rounded-full">
                        <Icons.X />
                    </button>
                </div>

                {/* Add Location Pin Form */}
                <form onSubmit={handlePinAlbumLocation} className="flex flex-col sm:flex-row gap-2 mb-5 bg-rose-50/60 p-3 rounded-2xl border border-rose-200/70">
                    <select
                        value={selectedAlbumId}
                        onChange={(e) => setSelectedAlbumId(e.target.value)}
                        className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-700"
                    >
                        <option value="">Select Album to Pin...</option>
                        {publicAlbums.map((m) => (
                            <option key={m.id} value={m.id}>
                                📸 {m.title} ({m.memory_date?.slice(0, 4)})
                            </option>
                        ))}
                    </select>

                    <input
                        type="text"
                        required
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        placeholder="Place or City (e.g., Bistro Cafe Faridabad, Manali, CP Delhi)..."
                        className="flex-1 bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-rose-400"
                    />

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-stone-900 hover:bg-rose-600 text-white px-5 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                    >
                        {isSaving ? 'Pinning...' : '📍 Pin on Map'}
                    </button>
                </form>

                {/* Pastel Interactive Map Canvas */}
                <div className="relative w-full h-72 sm:h-80 rounded-3xl overflow-hidden border-2 border-rose-200/80 shadow-inner bg-gradient-to-br from-[#e0f2fe] via-[#fdf2f8] to-[#fef3c7]">
                    {/* Stylized Map Grid & Continents SVG */}
                    <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" viewBox="0 0 800 400">
                        <path d="M90,120 Q160,60 250,130 T420,110 T600,150 T720,100" fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="6 6" />
                        <circle cx="200" cy="180" r="95" fill="#fbcfe8" />
                        <circle cx="460" cy="160" r="120" fill="#fde68a" />
                        <circle cx="620" cy="240" r="85" fill="#bbf7d0" />
                    </svg>

                    {pinnedAlbums.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-stone-500 p-6 text-center">
                            <span className="text-4xl mb-2">📍</span>
                            <p className="text-sm font-serif font-bold">No albums pinned to the map yet</p>
                            <p className="text-xs text-stone-400 mt-0.5">
                                Pick an album above and type where it happened to drop your first glowing heart pin!
                            </p>
                        </div>
                    ) : (
                        pinnedAlbums.map(({ album, locationName, x, y }) => {
                            const isHovered = hoveredPinId === album.id;
                            return (
                                <div
                                    key={album.id}
                                    style={{ left: `${x}%`, top: `${y}%` }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                                    onMouseEnter={() => setHoveredPinId(album.id)}
                                    onMouseLeave={() => setHoveredPinId(null)}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onClose();
                                            onOpenMemory?.(album, 0);
                                        }}
                                        className="group relative flex flex-col items-center cursor-pointer"
                                    >
                                        <span className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center text-base shadow-lg ring-4 ring-white/80 hover:scale-125 transition-transform animate-bounce">
                                            💖
                                        </span>
                                        <span className="mt-1 bg-white/95 backdrop-blur-md text-stone-800 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md border border-rose-200 whitespace-nowrap">
                                            {locationName}
                                        </span>

                                        {isHovered && (
                                            <div className="absolute bottom-14 bg-stone-900 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-xl whitespace-nowrap z-30">
                                                📸 {album.title} →
                                            </div>
                                        )}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default MemoryMapModal;