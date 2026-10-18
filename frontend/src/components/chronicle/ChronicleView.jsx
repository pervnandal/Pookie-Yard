import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { parseMediaUrl } from '../../utils/mediaParser';
import { API_BASE_URL } from '../../utils/apiUtils';

export const ChronicleView = ({ showDialog, onOpenMemory, onSelectMemory, activeOccasion }) => {
  const [chronicle, setChronicle] = useState(null);
  const [selectedPics, setSelectedPics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState({ temp: '--', desc: 'Checking skies...' });

  const getWeatherDesc = (code) => {
    if (code === 0) return 'Clear Skies';
    if (code >= 1 && code <= 3) return 'Partly Cloudy';
    if (code >= 45 && code <= 48) return 'Foggy';
    if (code >= 51 && code <= 67) return 'Raining';
    if (code >= 71 && code <= 82) return 'Snowing';
    if (code >= 95) return 'Thunderstorms';
    return 'Fair';
  };

  // Pick up to 2 random visual images from the album while preserving their exact index in memory_media
  const pickRandomImagesFromAlbum = (memoryObj) => {
    const mediaList = memoryObj?.memory_media || [];
    const visualCandidates = [];
    mediaList.forEach((m, exactIdx) => {
      const parsed = parseMediaUrl(m.file_url);
      if (!parsed.isVoice) {
        visualCandidates.push({
          exactIndex: exactIdx,
          parsed
        });
      }
    });

    if (visualCandidates.length === 0) return [];
    if (visualCandidates.length === 1) return [visualCandidates[0]];

    const shuffled = [...visualCandidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 2);
  };

  // Opens the FullPageGallery modal directly at the exact image index that was clicked
  const handleOpenExactImage = (exactIndex) => {
    if (!chronicle?.memory) return;
    const openFn = onOpenMemory || onSelectMemory;
    if (!openFn) return;

    const formattedDate =
      chronicle.memory.formattedDate ||
      new Date(chronicle.memory.memory_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });

    const memoryWithExactIndex = {
      ...chronicle.memory,
      formattedDate,
      initialMediaIndex: exactIndex,
      _openTrigger: Date.now()
    };

    openFn(memoryWithExactIndex, exactIndex);
  };

  const fetchChronicle = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeOccasion?.title) {
        params.set('occasion_title', activeOccasion.title);
        if (activeOccasion.date) params.set('occasion_date', activeOccasion.date);
        if (activeOccasion.notes) params.set('occasion_notes', activeOccasion.notes);
      }
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${API_BASE_URL}/api/chronicle${queryStr}`);
      if (response.ok) {
        const data = await response.json();
        setChronicle(data);
        if (data?.memory) {
          setSelectedPics(pickRandomImagesFromAlbum(data.memory));
        } else {
          setSelectedPics([]);
        }
      } else {
        showDialog({ type: 'alert', title: 'Error', message: 'Failed to fetch the morning paper.' });
      }
    } catch {
      showDialog({ type: 'alert', title: 'Error', message: 'Could not connect to the printing press.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)
            .then((res) => res.json())
            .then((data) => {
              if (data.current_weather) {
                setWeather({
                  temp: Math.round(data.current_weather.temperature),
                  desc: getWeatherDesc(data.current_weather.weathercode)
                });
              }
            })
            .catch(() => setWeather({ temp: '--', desc: 'Beautiful Day' }));
        },
        () => setWeather({ temp: '--', desc: 'Beautiful Day' })
      );
    } else {
      setWeather({ temp: '--', desc: 'Beautiful Day' });
    }
  }, []);

  useEffect(() => {
    fetchChronicle();
  }, [activeOccasion?.id, activeOccasion?.title]);

  const renderNewspaperBody = () => {
    if (!chronicle?.memory) return null;

    const text = chronicle.article || "";
    const pic1 = selectedPics[0] || null;
    const pic2 = selectedPics[1] || null;

    const renderMediaCard = (picObj, rotateClass) => {
      if (!picObj || !picObj.parsed) return null;
      const { parsed, exactIndex } = picObj;
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            handleOpenExactImage(exactIndex);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenExactImage(exactIndex);
            }
          }}
          className={`bg-white/90 backdrop-blur-sm p-3 shadow-lg ${rotateClass} transition-transform duration-500 ease-out border border-white/80 relative z-30 pointer-events-auto group cursor-pointer block w-full mb-6 rounded-xl text-left`}
          title={`Click to open Photo #${exactIndex + 1} in album`}
        >
          <div className="relative overflow-hidden rounded-lg">
            <img
              src={parsed.thumb || parsed.thumbLow}
              loading="lazy"
              decoding="async"
              className="w-full h-auto grayscale md:group-hover:grayscale-0 transition-all duration-700 block"
              alt="Memory snapshot"
            />
            {/* Interactive Hover Overlay on Laptop/Desktop */}
            <div className="absolute inset-0 bg-stone-900/0 md:group-hover:bg-stone-900/25 transition-all duration-300 flex items-center justify-center opacity-0 md:group-hover:opacity-100 pointer-events-none">
              <span className="bg-white/95 text-stone-900 px-4 py-2 rounded-full font-sans text-xs font-bold shadow-xl transform translate-y-2 md:group-hover:translate-y-0 transition-all duration-300">
                📸 Open Photo #{exactIndex + 1} in Album
              </span>
            </div>
          </div>

          {/* Caption + Explicit Action Button (Works on both Mobile & Desktop) */}
          <div className="mt-3 flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] italic text-stone-600 font-sans font-medium truncate">
              Archived {new Date(chronicle.memory.memory_date).toLocaleDateString()} · Photo #{exactIndex + 1}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenExactImage(exactIndex);
              }}
              className="shrink-0 bg-stone-900 hover:bg-rose-600 active:scale-95 text-white font-sans text-[11px] font-bold px-3 py-1.5 rounded-full shadow-sm transition-all flex items-center gap-1 cursor-pointer"
            >
              <span>Open in Album</span>
              <span>→</span>
            </button>
          </div>
        </div>
      );
    };

    const paragraphs = text.split(/\n+/).filter((p) => p.trim().length > 0);
    const splitPoint = Math.max(1, Math.ceil(paragraphs.length / 2));
    const firstHalf = paragraphs.slice(0, splitPoint);
    const secondHalf = paragraphs.slice(splitPoint);
    const parseText = (content) =>
      content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');

    return (
      <div className="w-full">
        <div className="flow-root w-full">
          {pic1 && (
            <div className="w-full sm:w-1/2 md:w-5/12 float-left sm:pr-6 pb-4 relative z-30 pointer-events-auto">
              {renderMediaCard(pic1, 'rotate-1 md:hover:rotate-0')}
            </div>
          )}
          {/* Note: No CSS filter (drop-shadow) on this text container so it never creates a stacking context over the floats */}
          <div className="text-lg text-stone-900 font-medium leading-relaxed text-justify space-y-6 pb-6">
            {firstHalf.map((p, idx) => (
              <p
                key={idx}
                className={
                  idx === 0
                    ? "first-letter:text-7xl first-letter:font-serif first-letter:font-bold first-letter:text-stone-900 first-letter:float-left first-letter:mr-3 first-letter:mt-[-8px]"
                    : "indent-6"
                }
                dangerouslySetInnerHTML={{ __html: parseText(p) }}
              />
            ))}
          </div>
        </div>

        {(secondHalf.length > 0 || pic2) && (
          <div className="flow-root w-full mt-4">
            {pic2 && (
              <div className="w-full sm:w-1/2 md:w-5/12 float-right sm:pl-6 pb-4 relative z-30 pointer-events-auto">
                {renderMediaCard(pic2, '-rotate-1 md:hover:rotate-0')}
              </div>
            )}
            <div className="text-lg text-stone-900 font-medium leading-relaxed text-justify space-y-6">
              {secondHalf.map((p, idx) => (
                <p key={idx} className="indent-6" dangerouslySetInnerHTML={{ __html: parseText(p) }} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto bg-white/50 backdrop-blur-2xl p-6 sm:p-12 shadow-2xl rounded-3xl text-stone-900 font-serif relative border border-white/60 min-h-[70vh]">
      {chronicle?.occasion && (
        <div className="mb-6 bg-gradient-to-r from-rose-500/15 via-amber-500/15 to-rose-500/15 border border-rose-300/60 rounded-2xl p-3.5 text-center font-sans shadow-sm">
          <span className="text-xs font-extrabold uppercase tracking-widest text-rose-600 block">
            ★ Commemorative Special Issue — {chronicle.occasion.title} ★
          </span>
          <span className="text-xs text-stone-700 font-medium">{chronicle.occasion.desc}</span>
        </div>
      )}

      <div className="text-center border-b-[6px] border-double border-stone-900/80 pb-6 mb-8 relative">
        <h1
          className="text-4xl sm:text-7xl font-bold tracking-tighter uppercase mb-4 text-stone-900 drop-shadow-sm"
          style={{ fontFamily: '"Playfair Display", Georgia, serif' }}
        >
          The Daily Chronicle
        </h1>
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs sm:text-sm font-bold uppercase tracking-widest border-t border-b border-stone-900/80 py-2 gap-2 sm:gap-0">
          <span>Vol 1. No. {Math.floor(Math.random() * 500) + 100}</span>
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span>{weather.temp}°C | {weather.desc}</span>
          <span className="flex items-center gap-2">Price: 1 Kiss</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-600">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-800 mb-4"></div>
          <p className="italic text-lg font-medium">The journalists are writing your 4-paragraph story...</p>
        </div>
      ) : chronicle?.memory ? (
        <div>
          <h2 className="text-3xl sm:text-5xl font-bold text-center mb-10 leading-tight px-4 drop-shadow-md">
            {chronicle.memory.title}
          </h2>
          {renderNewspaperBody()}
          <div className="mt-12 flex justify-center border-t border-stone-400/50 pt-8">
            <button
              onClick={fetchChronicle}
              className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors uppercase tracking-widest text-sm font-bold bg-white/40 px-6 py-3 rounded-full border border-white/50 shadow-sm hover:shadow-md cursor-pointer"
            >
              <Icons.Refresh /> Print New Edition
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 italic text-stone-700 text-xl flex flex-col items-center gap-4">
          <p className="font-medium drop-shadow-sm">{chronicle?.article || "The printing press is quiet."}</p>
          <button
            onClick={fetchChronicle}
            className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors uppercase tracking-widest text-sm font-bold bg-white/40 border border-white/50 px-6 py-3 rounded-full mt-4 shadow-sm hover:shadow-md cursor-pointer"
          >
            <Icons.Refresh /> Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default ChronicleView;