import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { parseMediaUrl } from '../../utils/mediaParser';
import { API_BASE_URL } from '../../utils/apiUtils';

export const ChronicleView = ({ showDialog, onOpenMemory }) => {
  const [chronicle, setChronicle] = useState(null);
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

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)
            .then(res => res.json())
            .then(data => { if (data.current_weather) setWeather({ temp: Math.round(data.current_weather.temperature), desc: getWeatherDesc(data.current_weather.weathercode) }); })
            .catch(() => setWeather({ temp: '--', desc: 'Beautiful Day' }));
        },
        () => setWeather({ temp: '--', desc: 'Beautiful Day' })
      );
    } else {
      setWeather({ temp: '--', desc: 'Beautiful Day' });
    }
    fetchChronicle();
  }, []);

  const fetchChronicle = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chronicle`);
      if (response.ok) {
        const data = await response.json();
        setChronicle(data);
      } else {
        showDialog({ type: 'alert', title: 'Error', message: 'Failed to fetch the morning paper.' });
      }
    } catch (error) {
      showDialog({ type: 'alert', title: 'Error', message: 'Could not connect to the printing press.' });
    } finally {
      setLoading(false);
    }
  };

  const renderNewspaperBody = () => {
    if (!chronicle?.memory) return null;

    const mediaList = chronicle.memory.memory_media || [];
    const text = chronicle.article || "";
    
    const visualMedia = mediaList.filter(m => {
       const parsed = parseMediaUrl(m.file_url);
       return !parsed.isVoice;
    });
    const img1 = visualMedia.length > 0 ? parseMediaUrl(visualMedia[0].file_url) : null;
    const img2 = visualMedia.length > 1 ? parseMediaUrl(visualMedia[1].file_url) : null;

    const renderMedia = (parsed, rotateClass) => {
      if (!parsed) return null;
      return (
        <div className={`bg-white p-3 shadow-md ${rotateClass} transition-transform duration-500 ease-out border border-stone-200 relative group cursor-pointer block w-full mb-6`} onClick={() => onOpenMemory(chronicle.memory)} title="Click to view full album">
          {parsed.isYoutube ? (
            <img src={parsed.thumb} loading="lazy" className="w-full h-auto grayscale md:group-hover:grayscale-0 transition-all duration-700" alt="Memory snapshot" />
          ) : (
            <img src={parsed.thumb} loading="lazy" className="w-full h-auto grayscale md:group-hover:grayscale-0 transition-all duration-700" alt="Memory snapshot" />
          )}
          <p className="text-center text-xs italic mt-3 text-stone-500 font-sans">Archived on {new Date(chronicle.memory.memory_date).toLocaleDateString()}</p>
          <div className="absolute inset-0 bg-stone-900/0 md:group-hover:bg-stone-900/10 transition-all duration-300 flex items-center justify-center opacity-0 md:group-hover:opacity-100 z-10">
             <span className="bg-white/95 text-stone-900 px-5 py-2.5 rounded-full font-sans text-sm font-bold shadow-xl flex items-center gap-2 transform translate-y-4 md:group-hover:translate-y-0 transition-all duration-300">View in Album</span>
          </div>
        </div>
      );
    };

    const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
    
    let midIndex = 0;
    let currentChars = 0;
    const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
    
    for (let i = 0; i < paragraphs.length; i++) {
      currentChars += paragraphs[i].length;
      if (currentChars >= totalChars / 2) {
        midIndex = i + 1;
        break;
      }
    }
    
    const firstHalf = paragraphs.slice(0, midIndex);
    const secondHalf = paragraphs.slice(midIndex);
    const parseText = (content) => content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');

    return (
      <div className="w-full">
        <div className="flow-root w-full">
          {img1 && <div className="w-full sm:w-1/2 md:w-5/12 float-left pr-6 pb-4">{renderMedia(img1, 'rotate-1 md:hover:rotate-0')}</div>}
          <div className="text-lg text-stone-800 leading-relaxed text-justify space-y-6 pb-6">
             {firstHalf.map((p, idx) => (
                <p key={idx} className={idx === 0 ? "first-letter:text-7xl first-letter:font-serif first-letter:font-bold first-letter:text-stone-900 first-letter:float-left first-letter:mr-3 first-letter:mt-[-8px]" : "indent-6"} dangerouslySetInnerHTML={{__html: parseText(p)}} />
             ))}
          </div>
        </div>
        {(secondHalf.length > 0 || img2) && (
          <div className="flow-root w-full mt-4">
            {img2 && <div className="w-full sm:w-1/2 md:w-5/12 float-right pl-6 pb-4">{renderMedia(img2, '-rotate-1 md:hover:rotate-0')}</div>}
            <div className="text-lg text-stone-800 leading-relaxed text-justify space-y-6">
              {secondHalf.map((p, idx) => <p key={idx} className="indent-6" dangerouslySetInnerHTML={{__html: parseText(p)}} />)}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto bg-[#f9f7f1] p-6 sm:p-12 shadow-2xl text-stone-900 font-serif relative border border-stone-300 min-h-[70vh]">
      <div className="text-center border-b-[6px] border-double border-stone-900 pb-6 mb-8 relative">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter uppercase mb-4 text-stone-900" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>
          The Daily Chronicle
        </h1>
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs sm:text-sm font-semibold uppercase tracking-widest border-t border-b border-stone-900 py-2 gap-2 sm:gap-0">
          <span>Vol 1. No. {Math.floor(Math.random() * 500) + 100}</span>
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <span>{weather.temp}°C | {weather.desc}</span>
          <span className="flex items-center gap-2">Price: 1 Kiss</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-800 mb-4"></div>
          <p className="italic text-lg">The journalists are writing your story...</p>
        </div>
      ) : chronicle?.memory ? (
        <div>
          <h2 className="text-3xl sm:text-5xl font-bold text-center mb-10 leading-tight px-4">{chronicle.memory.title}</h2>
          {renderNewspaperBody()}
          <div className="mt-12 flex justify-center border-t border-stone-300 pt-8">
            <button onClick={fetchChronicle} className="flex items-center gap-2 text-stone-500 md:hover:text-stone-900 transition-colors uppercase tracking-widest text-sm font-bold">
              <Icons.Refresh /> Print New Edition
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 italic text-stone-600 text-xl flex flex-col items-center gap-4">
          <p>{chronicle?.article || "The printing press is quiet."}</p>
          <button onClick={fetchChronicle} className="flex items-center gap-2 text-stone-500 md:hover:text-stone-900 transition-colors uppercase tracking-widest text-sm font-bold border border-stone-300 px-4 py-2 rounded-full mt-4">
             <Icons.Refresh /> Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default ChronicleView;