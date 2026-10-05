import React from 'react';
import { Icons } from '../common/Icons';
import { parseMediaUrl } from '../../utils/mediaParser';

export const MemoryCard = ({ memory, onClick, onDeleteClick }) => {
  const displayMediaRaw = memory.memory_media?.length > 0 ? memory.memory_media[0].file_url : '';
  const mediaObj = displayMediaRaw ? parseMediaUrl(displayMediaRaw) : { thumb: 'https://images.unsplash.com/photo-1518199268815-95a17b8f6459?auto=format&fit=crop&q=80&w=800' };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm md:hover:shadow-xl transition-all duration-300 border border-stone-100 group cursor-pointer flex flex-col h-full relative"
         tabIndex="0" 
         onClick={() => onClick(memory)}
         onKeyDown={(e) => { if (e.key === 'Enter') onClick(memory); }}
    >
      <div className="relative h-64 overflow-hidden bg-stone-900 flex items-center justify-center">
        {mediaObj.isVoice ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-stone-800 text-rose-400">
               <Icons.Mic />
               <span className="text-xs font-medium mt-2">Audio Note</span>
            </div>
        ) : mediaObj.isYoutube || mediaObj.isLegacyVideo ? (
            <>
               <img src={mediaObj.thumb} loading="lazy" className="w-full h-full object-cover transform md:group-hover:scale-105 transition-transform duration-700 ease-in-out opacity-80" />
               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                     ▶
                  </div>
               </div>
            </>
        ) : (
            <img src={mediaObj.thumb} loading="lazy" alt={memory.title} className="w-full h-full object-cover transform md:group-hover:scale-105 transition-transform duration-700 ease-in-out" />
        )}
        
        <button 
          onClick={(e) => { e.stopPropagation(); onDeleteClick(memory); }}
          className="absolute top-4 left-4 p-2.5 bg-white/90 text-stone-500 md:hover:text-red-500 md:hover:bg-white rounded-full transition-colors z-30 shadow-md focus:outline-none focus:ring-2 focus:ring-red-500"
          title="Delete entire memory album"
        >
          <Icons.Trash />
        </button>
        
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-stone-700 shadow-sm z-20 flex items-center gap-1.5">
          {memory.is_private && <span className="text-rose-500"><Icons.Lock /></span>}
          {memory.formattedDate}
        </div>
        
        {memory.memory_media && memory.memory_media.length > 1 && (
          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium text-white shadow-md z-20 flex items-center gap-1.5">
            +{memory.memory_media.length - 1} media
          </div>
        )}
      </div>
      
      <div className="p-6 flex flex-col flex-grow relative">
        <h3 className="text-xl font-serif font-semibold text-stone-800 mb-2 md:group-hover:text-rose-600 transition-colors flex items-center gap-2">
          {memory.title}
        </h3>
        <p className="text-stone-600 line-clamp-3 leading-relaxed whitespace-pre-wrap">
          {memory.description || "No description provided."}
        </p>
      </div>
    </div>
  );
};

export default MemoryCard;