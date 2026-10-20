import React, { useState, useEffect, useMemo } from 'react';
import { Icons } from '../common/Icons';
import { parseMediaUrl } from '../../utils/mediaParser';
import { API_BASE_URL } from '../../utils/apiUtils';
import { extractVaultMeta } from '../../utils/vaultMetaUtils';

const SCRAPBOOK_STORAGE_KEY = 'us_chronicle_scrapbook_v1';

export const ChronicleView = ({
  showDialog,
  onOpenMemory,
  onSelectMemory,
  activeOccasion,
  memories = []
}) => {
  const [chronicle, setChronicle] = useState(null);
  const [selectedPics, setSelectedPics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState({ temp: '--', desc: 'Checking skies...' });

  // Phase 4 Item 20: Saved Clippings Scrapbook State
  const [viewMode, setViewMode] = useState('today'); // 'today' | 'scrapbook'
  const [scrapbook, setScrapbook] = useState(() => {
    try {
      const saved = localStorage.getItem(SCRAPBOOK_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SCRAPBOOK_STORAGE_KEY, JSON.stringify(scrapbook));
    } catch { }
  }, [scrapbook]);

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

  // Opens FullPageGallery directly at the exact image index that was clicked
  const handleOpenExactImage = (targetMemory, exactIndex = 0) => {
    const mem = targetMemory || chronicle?.memory;
    if (!mem) return;
    const openFn = onOpenMemory || onSelectMemory;
    if (!openFn) return;

    const formattedDate =
      mem.formattedDate ||
      new Date(mem.memory_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });

    const memoryWithExactIndex = {
      ...mem,
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

  // Save current newspaper edition to Scrapbook
  const isCurrentSaved = useMemo(() => {
    if (!chronicle?.article || !chronicle?.memory) return false;
    return scrapbook.some(
      (c) => c.memory?.id === chronicle.memory.id && c.article === chronicle.article
    );
  }, [scrapbook, chronicle]);

  const handleSaveToScrapbook = () => {
    if (!chronicle?.memory || !chronicle?.article || isCurrentSaved) return;
    const clipping = {
      id: `clip_${Date.now()}`,
      savedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      memory: chronicle.memory,
      article: chronicle.article,
      occasion: chronicle.occasion || null,
      selectedPics
    };
    setScrapbook((prev) => [clipping, ...prev]);
  };

  const handleDeleteClipping = (id) => {
    setScrapbook((prev) => prev.filter((c) => c.id !== id));
  };

  // Phase 4 Item 20: "On This Month" Throwback Strip
  const throwbackMemories = useMemo(() => {
    let source = memories;
    if (!source || source.length === 0) {
      try {
        source = JSON.parse(localStorage.getItem('us_memories_cache_v1') || '[]');
      } catch {
        source = [];
      }
    }

    const currentMonth = new Date().getMonth() + 1;
    const eligible = (source || []).filter((m) => {
      if (m.id === chronicle?.memory?.id) return false;
      const { meta } = extractVaultMeta(m);
      if (meta.isPrivate) return false;
      if (meta.unlockDate && new Date(meta.unlockDate) > new Date()) return false;
      return m.memory_media && m.memory_media.length > 0;
    });

    // Prioritize memories from the current calendar month, then fill with other flashbacks
    const sameMonth = eligible.filter((m) => {
      const mNum = parseInt((m.memory_date || '').slice(5, 7), 10);
      return mNum === currentMonth;
    });
    const others = eligible.filter((m) => !sameMonth.includes(m));
    return [...sameMonth, ...others].slice(0, 3);
  }, [memories, chronicle?.memory?.id]);

  const renderNewspaperBody = () => {
    if (!chronicle?.memory) return null;

    const text = chronicle.article || '';
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
            handleOpenExactImage(chronicle.memory, exactIndex);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenExactImage(chronicle.memory, exactIndex);
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
            <div className="absolute inset-0 bg-stone-900/0 md:group-hover:bg-stone-900/25 transition-all duration-300 flex items-center justify-center opacity-0 md:group-hover:opacity-100 pointer-events-none">
              <span className="bg-white/95 text-stone-900 px-4 py-2 rounded-full font-sans text-xs font-bold shadow-xl transform translate-y-2 md:group-hover:translate-y-0 transition-all duration-300">
                📸 Open Photo #{exactIndex + 1} in Album
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] italic text-stone-600 font-sans font-medium truncate">
              Archived {new Date(chronicle.memory.memory_date).toLocaleDateString()} · Photo #{exactIndex + 1}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenExactImage(chronicle.memory, exactIndex);
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
          <div className="text-lg text-stone-900 font-medium leading-relaxed text-justify space-y-6 pb-6">
            {firstHalf.map((p, idx) => (
              <p
                key={idx}
                className={
                  idx === 0
                    ? 'first-letter:text-7xl first-letter:font-serif first-letter:font-bold first-letter:text-stone-900 first-letter:float-left first-letter:mr-3 first-letter:mt-[-8px]'
                    : 'indent-6'
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

      {/* Top Bar: Today's Edition vs. Saved Clippings Scrapbook */}
      <div className="flex justify-center mb-6 font-sans">
        <div className="inline-flex bg-white/80 backdrop-blur-md p-1 rounded-full border border-stone-300/80 shadow-xs">
          <button
            type="button"
            onClick={() => setViewMode('today')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${viewMode === 'today' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
              }`}
          >
            📰 Today’s Front Page
          </button>
          <button
            type="button"
            onClick={() => setViewMode('scrapbook')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'scrapbook' ? 'bg-rose-500 text-white' : 'text-stone-600 hover:text-stone-900'
              }`}
          >
            <span>📌 Saved Clippings</span>
            {scrapbook.length > 0 && (
              <span
                className={`text-[10px] px-1.5 rounded-full ${viewMode === 'scrapbook' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-700'
                  }`}
              >
                {scrapbook.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {chronicle?.occasion && viewMode === 'today' && (
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
          <span>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          <span>
            {weather.temp}°C | {weather.desc}
          </span>
          <span className="flex items-center gap-2">Price: 1 Kiss</span>
        </div>
      </div>

      {viewMode === 'scrapbook' ? (
        /* SAVED CLIPPINGS SCRAPBOOK VIEW */
        <div className="space-y-6 font-sans">
          {scrapbook.length === 0 ? (
            <div className="text-center py-16 text-stone-500">
              <span className="text-4xl block mb-2">📌</span>
              <p className="font-serif text-lg font-bold text-stone-700">No Saved Clippings Yet</p>
              <p className="text-xs text-stone-500 mt-1">
                Click "📌 Save to Scrapbook" on any front page article to bookmark your favorite editions forever!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {scrapbook.map((clip) => (
                <div
                  key={clip.id}
                  className="bg-white/80 border border-stone-200 rounded-2xl p-5 shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-rose-500 mb-1">
                      <span>Clipped on {clip.savedAt}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteClipping(clip.id)}
                        className="text-stone-400 hover:text-red-500 cursor-pointer"
                        title="Remove Clipping"
                      >
                        ✕
                      </button>
                    </div>
                    <h3 className="font-serif font-bold text-xl text-stone-800 mb-2">
                      {clip.memory?.title}
                    </h3>
                    <p className="font-serif text-xs sm:text-sm text-stone-600 line-clamp-4 leading-relaxed">
                      {clip.article}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-stone-200/70 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setChronicle({
                          memory: clip.memory,
                          article: clip.article,
                          occasion: clip.occasion
                        });
                        setSelectedPics(
                          clip.selectedPics?.length
                            ? clip.selectedPics
                            : pickRandomImagesFromAlbum(clip.memory)
                        );
                        setViewMode('today');
                      }}
                      className="text-xs font-bold text-stone-900 hover:text-rose-600 underline cursor-pointer"
                    >
                      Read Full Edition →
                    </button>
                    {clip.memory && (
                      <button
                        type="button"
                        onClick={() => handleOpenExactImage(clip.memory, 0)}
                        className="bg-stone-900 hover:bg-rose-600 text-white text-[11px] font-bold px-3 py-1 rounded-full cursor-pointer"
                      >
                        📸 Open Album
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : loading ? (
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

          {/* Action Buttons: Save to Scrapbook + Print New Edition */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-stone-400/50 pt-8 font-sans">
            <button
              type="button"
              onClick={handleSaveToScrapbook}
              disabled={isCurrentSaved}
              className={`flex items-center gap-2 uppercase tracking-widest text-xs sm:text-sm font-bold px-6 py-3 rounded-full border shadow-sm transition-all cursor-pointer ${isCurrentSaved
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500'
                }`}
            >
              <span>{isCurrentSaved ? '✓ Saved in Scrapbook' : '📌 Save to Scrapbook'}</span>
            </button>

            <button
              type="button"
              onClick={fetchChronicle}
              className="flex items-center gap-2 text-stone-700 hover:text-stone-950 transition-colors uppercase tracking-widest text-xs sm:text-sm font-bold bg-white/60 hover:bg-white px-6 py-3 rounded-full border border-white/70 shadow-sm hover:shadow-md cursor-pointer"
            >
              <Icons.Refresh /> Print New Edition
            </button>
          </div>

          {/* Phase 4 Item 20: "On This Month" Throwback Strip */}
          {throwbackMemories.length > 0 && (
            <div className="mt-10 pt-6 border-t-2 border-double border-stone-800/40 font-sans">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-extrabold uppercase tracking-widest text-stone-700">
                  🎞️ On This Month & Flashback Corner
                </span>
                <span className="text-[11px] text-stone-500 italic">
                  Tap any snapshot to jump straight into that album
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {throwbackMemories.map((tb) => {
                  const firstVisual = (tb.memory_media || []).find(
                    (m) => !String(m.file_url || '').startsWith('voice#')
                  );
                  const parsed = firstVisual ? parseMediaUrl(firstVisual.file_url) : null;
                  return (
                    <div
                      key={tb.id}
                      onClick={() => handleOpenExactImage(tb, 0)}
                      className="bg-white/75 hover:bg-white border border-stone-200/90 rounded-2xl p-2.5 flex items-center gap-3 shadow-xs hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-900 shrink-0">
                        {parsed && (
                          <img
                            src={parsed.thumbLow || parsed.thumb}
                            alt={tb.title}
                            loading="lazy"
                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-serif font-bold text-xs sm:text-sm text-stone-800 truncate group-hover:text-rose-600">
                          {tb.title}
                        </h4>
                        <span className="text-[10px] text-stone-500 block">{tb.memory_date}</span>
                        <span className="text-[10px] font-bold text-rose-500">Open Album →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-20 italic text-stone-700 text-xl flex flex-col items-center gap-4">
          <p className="font-medium drop-shadow-sm">{chronicle?.article || 'The printing press is quiet.'}</p>
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