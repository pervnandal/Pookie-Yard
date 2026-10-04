import React, { useState, useEffect, useRef } from 'react';

// Dynamic API URLs based on environment (Local vs Production)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

const Icons = {
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
    </svg>
  ),
  Maximize: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M21 8V5a2 2 0 0 0-2-2h-3"></path><path d="M3 16v3a2 2 0 0 0 2 2h3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
    </svg>
  ),
  Minimize: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v3a2 2 0 0 1-2 2H3"></path><path d="M21 8h-3a2 2 0 0 1-2-2V3"></path><path d="M3 16h3a2 2 0 0 1 2 2v3"></path><path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>
    </svg>
  ),
  Left: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6"></path>
    </svg>
  ),
  Right: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"></path>
    </svg>
  ),
  X: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>
    </svg>
  ),
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"></path><path d="M12 5v14"></path>
    </svg>
  ),
  ArrowLeft: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path>
    </svg>
  ),
  Download: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  ),
  Refresh: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path>
    </svg>
  ),
  Send: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  ),
  Save: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>
    </svg>
  ),
  MessageCircle: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
    </svg>
  ),
  ExternalLink: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  ),
  Lock: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  ),
  Edit: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
  ),
  Mic: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line>
    </svg>
  ),
  CheckAll: ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 12l5 5L22 7"></path>
      <path d="M2 12l5 5 1.5-1.5"></path>
    </svg>
  ),
  FileText: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  )
};

const uploadFilesWithProgress = (url, formData, setProgress, onSuccess, onError) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      setProgress(percent);
    }
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      onSuccess(JSON.parse(xhr.responseText));
    } else {
      try {
        onError(JSON.parse(xhr.responseText));
      } catch (e) {
        onError({ detail: "Upload failed" });
      }
    }
  };
  xhr.onerror = () => onError({ detail: "Network error occurred." });
  xhr.send(formData);
};

const CustomDialog = ({ isOpen, title, message, onConfirm, onCancel, isAlert = false, showInput = false, inputValue = '', onInputChange }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onCancel || onConfirm}></div>
      <div className="relative bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center transform scale-100 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">{title}</h3>
        <p className="text-stone-600 mb-4">{message}</p>
        
        {showInput && (
          <input 
            type="text" 
            autoFocus
            value={inputValue} 
            onChange={(e) => onInputChange(e.target.value)} 
            placeholder="Enter plan name..."
            className="w-full bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-800 mb-6"
            onKeyDown={(e) => { if (e.key === 'Enter' && inputValue.trim()) onConfirm(); }}
          />
        )}

        <div className="flex justify-center gap-3">
          {!isAlert && (
            <button onClick={onCancel} className="px-5 py-2 rounded-full font-medium text-stone-600 hover:bg-stone-100 transition-colors">
              Cancel
            </button>
          )}
          <button onClick={onConfirm} disabled={showInput && !inputValue.trim()} className={`px-6 py-2 rounded-full font-medium transition-all shadow-sm hover:shadow-md text-white disabled:opacity-50 ${isAlert ? 'bg-stone-800 hover:bg-stone-900' : 'bg-red-500 hover:bg-red-600'}`}>
            {isAlert ? 'Okay' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const LoginScreen = ({ onLogin, showDialog }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (response.ok) {
        onLogin();
      } else {
        showDialog({ type: 'alert', title: 'Access Denied', message: 'Incorrect credentials. This space is private.' });
      }
    } catch (error) {
      showDialog({ type: 'alert', title: 'Connection Error', message: 'Cannot reach the server.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#faf9f8] font-sans flex items-center justify-center relative overflow-hidden p-4">
      <div className="absolute top-[-10%] left-[-10%] rounded-full mix-blend-multiply opacity-60 pointer-events-none" style={{ backgroundColor: '#fecdd3', width: '500px', height: '500px', filter: 'blur(100px)' }}></div>
      <div className="absolute bottom-[-10%] right-[-10%] rounded-full mix-blend-multiply opacity-60 pointer-events-none" style={{ backgroundColor: '#ffedd5', width: '400px', height: '400px', filter: 'blur(100px)' }}></div>
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.4, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.08) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>

      <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 sm:p-12 shadow-2xl border border-white max-w-md w-full z-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="text-5xl block mb-4 animate-bounce">🌸</span>
        <h1 className="text-3xl font-serif font-bold text-stone-800 tracking-tight mb-2">
          The <span className="text-rose-500 italic">Us</span> Space
        </h1>
        <p className="text-stone-500 mb-8 font-medium">Please enter your credentials to unlock the vault.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input 
              type="text" 
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 transition-all text-stone-800 placeholder:text-stone-400"
              required
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 transition-all text-stone-800 placeholder:text-stone-400"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 mt-2 flex justify-center"
          >
            {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/40 border-t-white rounded-full"></span> : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
};

const Header = ({ onAddClick, activeTab, setActiveTab, onLogout }) => {
  const ANNIVERSARY_DATE = "2026-05-04"; 
  
  const calculateDaysTogether = () => {
    const start = new Date(ANNIVERSARY_DATE); 
    const today = new Date();
    const diffTime = Math.abs(today - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <header className="sticky top-0 z-[100] w-full bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🌸</span>
            <h1 className="text-2xl font-serif font-bold text-stone-800 tracking-tight hidden lg:block">
              The <span className="text-rose-500 italic">Us</span> Space
            </h1>
          </div>
          
          <nav className="flex items-center space-x-3 sm:space-x-8">
            <button onClick={() => setActiveTab('vault')} className={`text-sm sm:text-base font-medium pb-1 whitespace-nowrap transition-colors ${activeTab === 'vault' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-stone-500 hover:text-stone-800'}`}>
              <span className="hidden sm:inline">Memory </span>Vault
            </button>
            <button onClick={() => setActiveTab('chronicle')} className={`text-sm sm:text-base font-medium pb-1 whitespace-nowrap transition-colors ${activeTab === 'chronicle' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-stone-500 hover:text-stone-800'}`}>
              Chronicle
            </button>
            <button onClick={() => setActiveTab('planner')} className={`text-sm sm:text-base font-medium pb-1 whitespace-nowrap transition-colors ${activeTab === 'planner' ? 'text-rose-500 border-b-2 border-rose-500' : 'text-stone-500 hover:text-stone-800'}`}>
              Planner
            </button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden md:flex items-center gap-2 bg-rose-50 px-4 py-1.5 rounded-full border border-rose-100 shadow-sm mr-1">
               <span className="text-rose-500 animate-pulse text-xs">❤️</span>
               <span className="text-xs font-bold text-rose-600 font-sans whitespace-nowrap">{calculateDaysTogether()} Days</span>
            </div>
            <button 
              onClick={onAddClick}
              className="bg-stone-900 hover:bg-stone-800 text-white p-2 sm:px-5 sm:py-2.5 rounded-full font-medium transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <Icons.Plus /> <span className="hidden sm:inline">Add</span>
            </button>
            <button onClick={onLogout} className="text-stone-400 hover:text-rose-500 transition-colors p-2 hidden sm:block" title="Lock Vault">
              <Icons.Lock />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

const MemoryCard = ({ memory, onClick, onDeleteClick }) => {
  const coverImage = memory.memory_media && memory.memory_media.length > 0 
    ? memory.memory_media[0].file_url 
    : 'https://images.unsplash.com/photo-1518199268815-95a17b8f6459?auto=format&fit=crop&q=80&w=800';

  const isVideo = (url) => /\.(mp4|webm|mov|ogg)$/i.test(url.split('?')[0]);
  const isAudio = (url) => /\.(webm|mp3|wav|ogg)$/i.test(url.split('?')[0]) && url.includes('voice_note');

  const displayMedia = memory.memory_media?.find(m => !isAudio(m.file_url)) || memory.memory_media?.[0];
  const actualCover = displayMedia ? displayMedia.file_url : coverImage;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-stone-100 group cursor-pointer flex flex-col h-full relative"
         tabIndex="0" 
         onClick={() => onClick(memory)}
         onKeyDown={(e) => { if (e.key === 'Enter') onClick(memory); }}
    >
      {/* MOBILE BUG FIX: Replaced hover states with md:group-hover to completely eliminate the double-tap bug on phones */}
      <div className="relative h-64 overflow-hidden bg-stone-900">
        {isVideo(actualCover) ? (
          <video src={actualCover} className="relative z-10 w-full h-full object-cover transform md:group-hover:scale-105 transition-transform duration-700 ease-in-out" muted loop playsInline preload="metadata" onMouseEnter={(e)=>e.target.play()} onMouseLeave={(e)=>e.target.pause()} />
        ) : (
          <img src={actualCover} loading="lazy" alt={memory.title} className="relative z-10 w-full h-full object-cover transform md:group-hover:scale-105 transition-transform duration-700 ease-in-out" />
        )}
        
        {/* MOBILE BUG FIX: Trash Can permanently moved to Top-Left. Pookie can never overlap this. */}
        <button 
          onClick={(e) => { e.stopPropagation(); onDeleteClick(memory); }}
          className="absolute top-4 left-4 p-2.5 bg-white/90 text-stone-500 hover:text-red-500 hover:bg-white rounded-full transition-colors z-30 shadow-md focus:outline-none focus:ring-2 focus:ring-red-500"
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
            {memory.memory_media.some(m => isAudio(m.file_url)) && <Icons.Mic />}
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

const FullPageGallery = ({ isOpen, onClose, memory, memories, onSelectMemory, onMemoryUpdated, showDialog }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedAlbumId, setExpandedAlbumId] = useState(null);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descText, setDescText] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen && memory) {
      setCurrentIndex(0);
      setExpandedAlbumId(memory.id);
      setDescText(memory.description || "");
      setIsEditingDesc(false);
    }
  }, [isOpen, memory]);

  const mediaList = memory?.memory_media || [];
  const activeMedia = mediaList[currentIndex];
  const isVideo = (url) => /\.(mp4|webm|mov|ogg)$/i.test(url.split('?')[0]);
  const isAudio = (url) => /\.(webm|mp3|wav|ogg)$/i.test(url.split('?')[0]) && url.includes('voice_note');

  const handleNext = () => { if (mediaList.length > 1) setCurrentIndex((prev) => (prev + 1) % mediaList.length); };
  const handlePrev = () => { if (mediaList.length > 1) setCurrentIndex((prev) => (prev - 1 + mediaList.length) % mediaList.length); };

  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (!isOpen || isEditingDesc) return;
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        else onClose();
      }
      if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) { if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen(); }
        else { if (document.exitFullscreen) await document.exitFullscreen(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditingDesc, mediaList.length]);

  if (!isOpen || !memory) return null;

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) { if (containerRef.current.requestFullscreen) await containerRef.current.requestFullscreen(); }
    else { if (document.exitFullscreen) await document.exitFullscreen(); }
  };

  const handleAddMedia = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    uploadFilesWithProgress(
      `${API_BASE_URL}/api/memories/${memory.id}/media`,
      formData,
      (percent) => setUploadProgress(percent),
      (response) => { setIsUploading(false); onMemoryUpdated(); },
      (error) => { setIsUploading(false); showDialog({ type: 'alert', title: 'Upload Failed', message: error.detail || 'Unknown error' }); }
    );
  };

  const handleDeleteActiveMedia = () => {
    if (!activeMedia) return;
    showDialog({
      type: 'confirm',
      title: 'Delete Media',
      message: 'Are you sure you want to permanently delete this file?',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/media/${activeMedia.id}`, { method: 'DELETE' });
          if (response.ok) {
            onMemoryUpdated(); 
            if (currentIndex >= mediaList.length - 1) setCurrentIndex(Math.max(0, mediaList.length - 2));
          } else {
            const err = await response.json();
            showDialog({ type: 'alert', title: 'Delete Failed', message: err.detail });
          }
        } catch (error) {
          showDialog({ type: 'alert', title: 'Error', message: 'Could not connect to backend.' });
        }
      }
    });
  };

  const handleDownloadAlbum = () => { window.location.href = `${API_BASE_URL}/api/memories/${memory.id}/download`; };

  const handleDownloadSingle = async () => {
    if (!activeMedia) return;
    try {
      const res = await fetch(activeMedia.file_url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `memory_media_${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.open(activeMedia.file_url, '_blank');
    }
  };

  const handleSaveDesc = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/memories/${memory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: descText })
      });
      if (res.ok) {
        setIsEditingDesc(false);
        onMemoryUpdated();
      } else {
        showDialog({ type: 'alert', title: 'Error', message: 'Failed to update description.' });
      }
    } catch (e) {
      showDialog({ type: 'alert', title: 'Error', message: 'Network error.' });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-stone-950 text-white animate-in fade-in duration-300">
      {!isFullscreen && (
        <div className="w-80 bg-stone-950 border-r border-stone-800 flex-col hidden md:flex shrink-0 z-50">
          <div className="p-5 border-b border-stone-800 flex items-center justify-between">
            <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded-full transition-colors text-stone-400 hover:text-white" title="Close Gallery (Esc)"><Icons.ArrowLeft /></button>
            <h2 className="text-lg font-serif font-bold text-stone-200">Vault Albums</h2>
            <div className="w-8"></div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {memories.map((m) => {
              const isExpanded = expandedAlbumId === m.id;
              const displayMedia = m.memory_media?.find(med => !isAudio(med.file_url)) || m.memory_media?.[0];
              const thumb = displayMedia ? displayMedia.file_url : '';
              
              return (
                <div key={m.id} className="flex flex-col">
                  <button onClick={() => { 
                      if (isExpanded) setExpandedAlbumId(null);
                      else { setExpandedAlbumId(m.id); if (m.id !== memory.id) { setCurrentIndex(0); onSelectMemory(m); } }
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-all duration-200 ${isExpanded ? 'bg-stone-800 shadow-inner' : 'hover:bg-stone-800/50 opacity-70 hover:opacity-100'}`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-black shrink-0 overflow-hidden relative flex items-center justify-center">
                      {isAudio(thumb) ? <Icons.Mic /> : isVideo(thumb) ? <video src={thumb} className="w-full h-full object-cover opacity-80" preload="metadata" /> : <img src={thumb} loading="lazy" className="w-full h-full object-cover opacity-80" />}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div>
                        <div className={`text-sm font-medium truncate ${isExpanded ? 'text-white' : 'text-stone-300'}`}>{m.title}</div>
                        <div className="text-xs text-stone-500 mt-0.5">{m.formattedDate}</div>
                      </div>
                      {m.is_private && <span className="text-rose-500 opacity-80"><Icons.Lock /></span>}
                    </div>
                  </button>
                  <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-2 grid grid-cols-3 gap-2 pb-3 pt-2 overflow-y-auto custom-scrollbar" style={{maxHeight: "350px"}}>
                      {m.memory_media?.map((media, idx) => (
                        <button key={media.id} onClick={(e) => { e.stopPropagation(); if(m.id !== memory.id) onSelectMemory(m); setCurrentIndex(idx); }}
                          className={`relative aspect-square rounded-md overflow-hidden bg-black transition-all flex items-center justify-center ${m.id === memory.id && currentIndex === idx ? 'ring-2 ring-rose-500 scale-105 z-10' : 'opacity-60 hover:opacity-100'}`}>
                          {isAudio(media.file_url) ? <Icons.Mic className="text-stone-400" /> : isVideo(media.file_url) ? <video src={media.file_url} className="w-full h-full object-cover" preload="metadata" /> : <img src={media.file_url} loading="lazy" className="w-full h-full object-cover" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div ref={containerRef} className="flex-1 relative flex flex-col overflow-hidden bg-stone-950 group">
        <div className={`absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-50 transition-opacity ${isFullscreen ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
           <div className="flex items-center gap-3 md:hidden">
              <button onClick={onClose} className="p-2 bg-stone-800 hover:bg-stone-700 rounded-full transition-colors"><Icons.ArrowLeft /></button>
              <div className="font-serif font-bold truncate text-sm flex items-center gap-2">
                {memory.is_private && <span className="text-rose-400"><Icons.Lock /></span>}
                {memory.title}
              </div>
           </div>
           <div className="hidden md:block"></div>
           <button onClick={toggleFullscreen} className="p-3 bg-stone-800 hover:bg-stone-700 text-white rounded-full transition-all z-50" title="Toggle Fullscreen (F)">
              {isFullscreen ? <Icons.Minimize /> : <Icons.Maximize />}
           </button>
        </div>

        <div className="flex-1 relative flex items-center justify-center p-4 md:p-12 min-h-0">
          {mediaList.length > 0 ? (
            <>
              {isAudio(activeMedia.file_url) ? (
                <div className="w-full max-w-md bg-stone-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 border border-stone-800">
                   <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-400 animate-pulse">
                      <Icons.Mic />
                   </div>
                   <h3 className="font-serif font-bold text-xl text-stone-200">Voice Note</h3>
                   <audio src={activeMedia.file_url} controls className="w-full outline-none" autoPlay />
                </div>
              ) : isVideo(activeMedia.file_url) ? (
                <video src={activeMedia.file_url} controls autoPlay className="w-full h-full object-contain shadow-2xl rounded-sm" />
              ) : (
                <img src={activeMedia.file_url} alt="Memory Viewer" className="w-full h-full object-contain shadow-2xl transition-transform duration-300" />
              )}
              {mediaList.length > 1 && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-stone-800/80 hover:bg-stone-700 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 z-50 focus:outline-none"><Icons.Left /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-stone-800/80 hover:bg-stone-700 text-white rounded-full transition-all opacity-0 group-hover:opacity-100 z-50 focus:outline-none"><Icons.Right /></button>
                </>
              )}
            </>
          ) : (
            <div className="text-center text-stone-500"><p className="text-xl mb-4">No media available.</p></div>
          )}
        </div>

        <div className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 z-50 transition-opacity flex flex-col md:flex-row items-end justify-between gap-4 ${isFullscreen ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
            <div className="max-w-xl w-full">
               {!isFullscreen && (
                 <>
                   <h2 className="text-2xl font-serif font-bold text-white mb-1 drop-shadow-md flex items-center gap-2">
                     {memory.title}
                     {memory.is_private && <span className="text-rose-400 bg-black/30 p-1 rounded-md" title="Private Memory"><Icons.Lock /></span>}
                   </h2>
                   
                   <div className="text-stone-300 text-sm mb-3 font-medium flex items-center gap-4 flex-wrap">
                     {memory.formattedDate}
                     <button onClick={(e) => { e.stopPropagation(); handleDownloadAlbum(); }} className="hover:text-rose-400 transition-colors flex items-center gap-1 bg-stone-800 hover:bg-stone-700 px-3 py-1 rounded-full text-xs border border-transparent">
                       <Icons.Download /> Zip Album
                     </button>
                     <button onClick={() => setIsEditingDesc(!isEditingDesc)} className={`transition-colors flex items-center gap-1 px-3 py-1 rounded-full text-xs border ${isEditingDesc ? 'bg-rose-500/20 text-rose-400 border-rose-500/20' : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-transparent'}`}>
                       <Icons.Edit /> {isEditingDesc ? 'Cancel Edit' : 'Edit Story'}
                     </button>
                   </div>
                 </>
               )}
               {!isFullscreen && (
                 <div className="mt-2">
                   {isEditingDesc ? (
                     <div className="bg-stone-900 p-3 rounded-xl border border-stone-800">
                       <textarea 
                         value={descText} 
                         onChange={(e) => setDescText(e.target.value)}
                         className="w-full bg-transparent text-white text-sm focus:outline-none resize-none min-h-[100px] custom-scrollbar"
                         placeholder="Write your story..."
                         autoFocus
                       />
                       <div className="flex justify-end mt-2">
                         <button onClick={handleSaveDesc} className="text-xs px-4 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 transition font-bold text-white">Save Changes</button>
                       </div>
                     </div>
                   ) : (
                     <p className="text-stone-300 text-sm whitespace-pre-wrap leading-relaxed line-clamp-3 hover:line-clamp-none transition-all duration-300">
                       {memory.description || <span className="italic opacity-50">No description provided. Add one?</span>}
                     </p>
                   )}
                 </div>
               )}
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0 justify-end z-[60]">
               <div className="relative group cursor-pointer">
                 <input type="file" multiple accept="image/*,video/*,audio/*" onChange={handleAddMedia} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed" />
                 <button disabled={isUploading} className="px-5 py-2.5 bg-stone-800 hover:bg-stone-700 rounded-full text-sm font-medium transition-colors flex items-center gap-2 relative overflow-hidden pointer-events-none">
                   {isUploading ? (
                     <>
                       <span className="relative z-10 text-xs font-bold">{uploadProgress}%</span>
                       <div className="absolute left-0 top-0 bottom-0 bg-rose-500/50 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                     </>
                   ) : (
                     <><Icons.Plus /> Add More</>
                   )}
                 </button>
               </div>
               
               {activeMedia && (
                 <>
                   <button onClick={(e) => { e.stopPropagation(); handleDownloadSingle(); }} className="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-full transition-colors flex items-center gap-2 z-20 cursor-pointer">
                     <Icons.Download /> <span className="text-sm font-medium hidden sm:inline">Save</span>
                   </button>
                   <button onClick={(e) => { e.stopPropagation(); handleDeleteActiveMedia(); }} className="px-4 py-2.5 bg-red-900 hover:bg-red-800 text-red-200 rounded-full transition-colors flex items-center gap-2 z-20 cursor-pointer">
                     <Icons.Trash /> <span className="text-sm font-medium hidden sm:inline">Delete</span>
                   </button>
                 </>
               )}
            </div>
        </div>
      </div>
    </div>
  );
};

const AddMemoryModal = ({ isOpen, onClose, onMemoryAdded, showDialog }) => {
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      const newUrls = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newUrls]);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
    setPreviewUrls(previewUrls.filter((_, index) => index !== indexToRemove));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        setFiles(prev => [...prev, file]);
        setPreviewUrls(prev => [...prev, URL.createObjectURL(blob)]);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      showDialog({ type: 'alert', title: 'Mic Access', message: 'Please allow microphone access to record.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    if (files.length === 0 || !date || !title) {
      showDialog({ type: 'alert', title: 'Missing Info', message: 'Please provide at least one photo/audio, a date, and a title!' });
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('date', date);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('is_private', isPrivate.toString()); 
    files.forEach(file => formData.append('files', file));

    uploadFilesWithProgress(
      `${API_BASE_URL}/api/memories`,
      formData,
      (percent) => setUploadProgress(percent),
      (response) => {
        setFiles([]); setPreviewUrls([]); setDate(''); setTitle(''); setDescription(''); setIsPrivate(false);
        setIsSubmitting(false);
        onMemoryAdded(); 
        onClose();
      },
      (error) => {
        setIsSubmitting(false);
        showDialog({ type: 'alert', title: 'Save Failed', message: error.detail || 'Unknown error' });
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && onClose()}></div>
      <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl transform transition-all max-h-[90vh] flex flex-col">
        <div className="bg-[#faf9f8] px-6 py-4 border-b border-stone-100 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-serif font-bold text-stone-800">Vault a New Memory</h3>
          <button onClick={() => !isSubmitting && onClose()} className="text-stone-400 hover:text-stone-600 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-200 rounded-full"><Icons.X /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          <div className="relative border-2 border-dashed border-rose-200 rounded-2xl bg-rose-50/50 p-6 text-center transition-colors group overflow-hidden min-h-[160px] flex flex-col items-center justify-center">
            <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" disabled={isSubmitting} />
            {previewUrls.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full z-30 relative pointer-events-none">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden shadow-sm pointer-events-auto bg-black group/item flex items-center justify-center">
                    {/\.(webm|mp3|wav|ogg)$/i.test(files[index].name) && files[index].name.includes('voice_note') ? (
                       <div className="text-rose-400 bg-rose-500/20 w-full h-full flex flex-col items-center justify-center gap-2"><Icons.Mic /><span className="text-[10px] uppercase font-bold">Audio</span></div>
                    ) : /\.(mp4|webm|mov|ogg)$/i.test(files[index].name) ? (
                       <video src={url} className="w-full h-full object-cover opacity-70" />
                    ) : (
                       <img src={url} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeFile(index); }} disabled={isSubmitting} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 scale-0 group-hover/item:scale-100 transition-transform">
                      <Icons.X />
                    </button>
                  </div>
                ))}
                <div className="aspect-square rounded-lg border-2 border-dashed border-rose-300 flex flex-col items-center justify-center text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer pointer-events-auto">
                  <Icons.Plus />
                  <span className="text-xs font-medium mt-1">Add More</span>
                </div>
              </div>
            ) : (
              <div className="pointer-events-none">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📸</div>
                <p className="text-sm font-medium text-rose-600">Click or drag photos/videos here</p>
                <p className="text-xs text-stone-400 mt-1">Select multiple files at once</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-center">
             {isRecording ? (
                <button onClick={stopRecording} disabled={isSubmitting} className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-full font-bold shadow-md animate-pulse flex items-center gap-2">
                   <div className="w-2 h-2 bg-white rounded-full"></div> Stop Recording
                </button>
             ) : (
                <button onClick={startRecording} disabled={isSubmitting} className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-6 py-2.5 rounded-full font-bold shadow-sm flex items-center gap-2 transition-colors">
                   <Icons.Mic /> Record Voice Note
                </button>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">When did this happen?</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSubmitting} className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-600 bg-[#faf9f8]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Headline / Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSubmitting} placeholder="e.g., Coffee Shop Date" className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-800 placeholder-stone-400 bg-[#faf9f8]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">The Story</label>
            <textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} placeholder="Write the details here..." className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-800 placeholder-stone-400 bg-[#faf9f8] resize-none custom-scrollbar" ></textarea>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer" onClick={() => !isSubmitting && setIsPrivate(!isPrivate)}>
             <input type="checkbox" checked={isPrivate} readOnly className="w-5 h-5 accent-rose-500 rounded focus:ring-rose-500 cursor-pointer pointer-events-none" />
             <div className="flex-1 select-none">
               <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">Keep this Memory Private <Icons.Lock /></h4>
               <p className="text-xs text-stone-500 mt-0.5">Hide this from the Daily Chronicle and Pookie's memory bank.</p>
             </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3 shrink-0 relative overflow-hidden">
          {isSubmitting && (
            <div className="absolute top-0 left-0 h-1 bg-rose-200 w-full">
              <div className="h-full bg-rose-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}
          <button onClick={onClose} disabled={isSubmitting} className="px-5 py-2 rounded-full font-medium text-stone-600 hover:bg-stone-200 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="bg-rose-500 hover:bg-rose-600 disabled:bg-rose-400 text-white px-6 py-2 rounded-full font-medium transition-all shadow-sm flex items-center gap-2 min-w-[140px] justify-center">
            {isSubmitting ? (
               <span className="flex items-center gap-2">
                 <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full"></span>
                 Saving ({uploadProgress}%)
               </span>
            ) : 'Save to Vault'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ChronicleView = ({ showDialog, onOpenMemory }) => {
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
    
    const visualMedia = mediaList.filter(m => !m.file_url.includes('voice_note'));
    const img1 = visualMedia.length > 0 ? visualMedia[0] : null;
    const img2 = visualMedia.length > 1 ? visualMedia[1] : null;

    const renderMedia = (m, rotateClass) => {
      if (!m) return null;
      return (
        <div className={`bg-white p-3 shadow-md ${rotateClass} transition-transform duration-500 ease-out border border-stone-200 relative group cursor-pointer block w-full mb-6`} onClick={() => onOpenMemory(chronicle.memory)} title="Click to view full album">
          {/\.(mp4|webm|mov|ogg)$/i.test(m.file_url) ? (
            <video src={m.file_url} className="w-full h-auto grayscale group-hover:grayscale-0 transition-all duration-700" autoPlay muted loop playsInline />
          ) : (
            <img src={m.file_url} loading="lazy" className="w-full h-auto grayscale group-hover:grayscale-0 transition-all duration-700" alt="Memory snapshot" />
          )}
          <p className="text-center text-xs italic mt-3 text-stone-500 font-sans">Archived on {new Date(chronicle.memory.memory_date).toLocaleDateString()}</p>
          <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
             <span className="bg-white/95 text-stone-900 px-5 py-2.5 rounded-full font-sans text-sm font-bold shadow-xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">View in Album</span>
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
          {img1 && <div className="w-full sm:w-1/2 md:w-5/12 float-left pr-6 pb-4">{renderMedia(img1, 'rotate-1 hover:rotate-0')}</div>}
          <div className="text-lg text-stone-800 leading-relaxed text-justify space-y-6 pb-6">
             {firstHalf.map((p, idx) => (
                <p key={idx} className={idx === 0 ? "first-letter:text-7xl first-letter:font-serif first-letter:font-bold first-letter:text-stone-900 first-letter:float-left first-letter:mr-3 first-letter:mt-[-8px]" : "indent-6"} dangerouslySetInnerHTML={{__html: parseText(p)}} />
             ))}
          </div>
        </div>
        {(secondHalf.length > 0 || img2) && (
          <div className="flow-root w-full mt-4">
            {img2 && <div className="w-full sm:w-1/2 md:w-5/12 float-right pl-6 pb-4">{renderMedia(img2, '-rotate-1 hover:rotate-0')}</div>}
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
            <button onClick={fetchChronicle} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors uppercase tracking-widest text-sm font-bold">
              <Icons.Refresh /> Print New Edition
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 italic text-stone-600 text-xl flex flex-col items-center gap-4">
          <p>{chronicle?.article || "The printing press is quiet."}</p>
          <button onClick={fetchChronicle} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors uppercase tracking-widest text-sm font-bold border border-stone-300 px-4 py-2 rounded-full mt-4">
             <Icons.Refresh /> Try Again
          </button>
        </div>
      )}
    </div>
  );
};

const DatePlanner = ({ showDialog }) => {
  const [userId] = useState(() => {
    let stored = localStorage.getItem('us_planner_id');
    if (!stored) {
      stored = `user_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem('us_planner_id', stored);
    }
    return stored;
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerEditing, setPartnerEditing] = useState(false);
  
  const [itineraries, setItineraries] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeContent, setActiveContent] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const padTypingTimeoutRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/chats`)
      .then(res => res.json())
      .then(data => setMessages(data || []))
      .catch(err => console.error("Chat load failed", err));

    fetch(`${API_BASE_URL}/api/itineraries`)
      .then(res => res.json())
      .then(data => {
         setItineraries(data || []);
         if(data && data.length > 0) {
            setActiveDocId(data[0].id);
            setActiveContent(data[0].content || "");
         }
      })
      .catch(err => console.error("Itinerary load failed", err));
  }, []);

  useEffect(() => {
    if (activeDocId) {
      const doc = itineraries.find(i => i.id === activeDocId);
      if (doc) setActiveContent(doc.content || "");
    }
  }, [activeDocId]);

  /* MOBILE BUG FIX: Auto-reconnect WebSockets if the mobile browser puts them to sleep. */
  useEffect(() => {
    let reconnectTimer;
    const connectWS = () => {
      ws.current = new WebSocket(`${WS_BASE_URL}/ws/chat`);
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'refresh_plans') {
           fetch(`${API_BASE_URL}/api/itineraries`)
             .then(res => res.json())
             .then(fetchedDocs => setItineraries(fetchedDocs || []));
           return;
        }

        if (data.senderId === userId) return;

        if (data.type === 'chat') {
          setMessages((prev) => [...prev, data]);
          safeSend({ type: 'read_receipt', senderId: userId });
        } 
        else if (data.type === 'read_receipt') {
          setMessages((prev) => prev.map(m => m.senderId === userId ? { ...m, status: 'read' } : m));
        }
        else if (data.type === 'typing') {
          if (data.field === 'chat') setPartnerTyping(data.isTyping);
          else if (data.field === 'pad') {
             if (data.docId === activeDocId) setPartnerEditing(data.isTyping);
          }
        } 
        else if (data.type === 'itinerary') {
          setItineraries(prev => prev.map(doc => doc.id === data.docId ? { ...doc, content: data.text } : doc));
          if (activeDocId === data.docId) setActiveContent(data.text);
        }
      };

      ws.current.onclose = () => {
        // If connection drops on mobile, try to reconnect after 3 seconds
        reconnectTimer = setTimeout(connectWS, 3000);
      };
    };

    connectWS();
    return () => { clearTimeout(reconnectTimer); if (ws.current) ws.current.close(); };
  }, [userId, activeDocId]);

  /* MOBILE BUG FIX: Safe WebSocket Sender. Prevents the app from crashing if connection drops. */
  const safeSend = (msgObj) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msgObj));
    }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, partnerTyping]);

  useEffect(() => {
    const timer = setTimeout(() => {
       if (activeDocId) {
         fetch(`${API_BASE_URL}/api/itineraries/${activeDocId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ content: activeContent })
         }).catch(err => console.error("Auto-save failed", err));
       }
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeContent, activeDocId]);

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      const msgObj = { type: 'chat', text: input, senderId: userId, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent', id: Date.now() };
      safeSend(msgObj);
      setMessages((prev) => [...prev, msgObj]);
      setInput('');
      safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'chat' });
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    safeSend({ type: 'typing', senderId: userId, isTyping: true, field: 'chat' });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'chat' }), 1500);
  };

  const handleItineraryChange = (e) => {
    const newText = e.target.value;
    setActiveContent(newText);
    setItineraries(prev => prev.map(doc => doc.id === activeDocId ? { ...doc, content: newText } : doc));
    
    safeSend({ type: 'itinerary', docId: activeDocId, text: newText, senderId: userId });
    safeSend({ type: 'typing', senderId: userId, isTyping: true, field: 'pad', docId: activeDocId });
    clearTimeout(padTypingTimeoutRef.current);
    padTypingTimeoutRef.current = setTimeout(() => safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'pad' }), 1500);
  };

  const startVoiceMessage = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const msgObj = { type: 'chat', text: '', audio: reader.result, senderId: userId, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent', id: Date.now() };
          safeSend(msgObj);
          setMessages(prev => [...prev, msgObj]);
        };
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      showDialog({ type: 'alert', title: 'Mic Access', message: 'Please allow microphone access to record.' });
    }
  };

  const stopVoiceMessage = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const createNewPlan = () => {
    showDialog({
      type: 'confirm',
      title: 'New Date Plan',
      message: 'Give your new adventure a title:',
      showInput: true,
      inputValue: '',
      onConfirm: async (title) => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/itineraries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title })
          });
          const newDoc = await res.json();
          setItineraries(prev => [newDoc, ...prev]);
          setActiveDocId(newDoc.id);
          safeSend({ type: 'refresh_plans' });
        } catch (e) {
          console.error("Failed to create plan", e);
        }
      }
    });
  };

  const renamePlan = (doc) => {
    showDialog({
      type: 'confirm',
      title: 'Rename Plan',
      message: 'Enter a new title for this plan:',
      showInput: true,
      inputValue: doc.title,
      onConfirm: async (newTitle) => {
        if (!newTitle.trim()) return;
        try {
          const res = await fetch(`${API_BASE_URL}/api/itineraries/${doc.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle.trim() })
          });
          if (res.ok) {
            setItineraries(prev => prev.map(i => i.id === doc.id ? { ...i, title: newTitle.trim() } : i));
            safeSend({ type: 'refresh_plans' });
          }
        } catch (e) {
          console.error("Failed to rename plan", e);
        }
      }
    });
  };

  const deleteCurrentPlan = () => {
    if (!activeDocId) return;
    showDialog({
      type: 'confirm',
      title: 'Delete Plan',
      message: 'Are you sure you want to delete this plan forever?',
      onConfirm: async () => {
        try {
          await fetch(`${API_BASE_URL}/api/itineraries/${activeDocId}`, { method: 'DELETE' });
          const remaining = itineraries.filter(i => i.id !== activeDocId);
          setItineraries(remaining);
          if (remaining.length > 0) setActiveDocId(remaining[0].id);
          else setActiveDocId(null);
          safeSend({ type: 'refresh_plans' });
        } catch (e) {
          console.error("Failed to delete plan", e);
        }
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 w-full h-full">
      <div className="w-full md:w-[35%] lg:w-[30%] flex flex-col bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden h-[500px] md:h-full shrink-0">
        <div className="bg-stone-50 border-b border-stone-100 p-5 shrink-0 flex items-center justify-between">
           <div>
             <h3 className="font-serif font-bold text-lg text-stone-800">Live Planner</h3>
             <div className="flex items-center gap-1.5 mt-1">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <p className="text-xs text-stone-500 font-medium">Connected</p>
             </div>
           </div>
           <span className="text-2xl">💬</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/30 custom-scrollbar min-h-0">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2 opacity-70">
              <span className="text-4xl">👋</span>
              <p className="text-sm font-medium">Say hello!</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === userId || msg.senderId === userId;
            return (
              <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                 <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-rose-500 text-white rounded-br-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'}`}>
                    {msg.audio ? (
                       <audio src={msg.audio} controls className={`h-10 max-w-[200px] sm:max-w-[240px] outline-none ${isMe ? 'opacity-90 invert grayscale' : ''}`} />
                    ) : (
                       msg.text
                    )}
                 </div>
                 <div className="flex items-center gap-1 mt-1.5 px-1">
                     <span className="text-[10px] text-stone-400 font-medium">{msg.timestamp}</span>
                     {isMe && (
                         <Icons.CheckAll className={`w-[14px] h-[14px] transition-colors duration-300 ${msg.status === 'read' ? 'text-blue-500' : 'text-stone-300'}`} />
                     )}
                 </div>
              </div>
            )
          })}
          {partnerTyping && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-white border border-stone-200 px-3 py-2 rounded-2xl text-xs text-stone-400 shadow-sm flex items-center gap-1">
                <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-100 flex gap-2 shrink-0 items-center">
            {isRecording ? (
                <div className="flex-1 flex items-center justify-between bg-rose-50 border border-rose-200 rounded-full px-4 py-2.5">
                    <div className="flex items-center gap-2 text-rose-500 font-medium text-sm">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> Recording...
                    </div>
                    <button type="button" onClick={stopVoiceMessage} className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors"><Icons.Send /></button>
                </div>
            ) : (
                <>
                   <input type="text" value={input} onChange={handleInputChange} placeholder="Type a message..." className="flex-1 bg-stone-100/50 border border-stone-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 placeholder:text-stone-400" />
                   {input.trim() ? (
                       <button type="submit" className="p-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-full flex items-center justify-center w-11 h-11 shrink-0"><Icons.Send /></button>
                   ) : (
                       <button type="button" onClick={startVoiceMessage} className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 rounded-full flex items-center justify-center w-11 h-11 shrink-0 transition-colors"><Icons.Mic /></button>
                   )}
                </>
            )}
        </form>
      </div>

      <div className="w-full md:w-[65%] lg:w-[70%] flex flex-col md:flex-row bg-[#fdfbf7] rounded-3xl shadow-sm border border-stone-200 overflow-hidden font-serif h-[600px] md:h-full shrink-0">
         <div className="w-full md:w-48 lg:w-56 bg-stone-50/50 border-r border-stone-200 flex flex-col shrink-0 h-40 md:h-full">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-white/50 shrink-0">
               <span className="font-bold text-stone-700 font-sans text-sm tracking-wide uppercase">Plans</span>
               <button onClick={createNewPlan} className="text-rose-500 hover:bg-rose-100 p-1.5 rounded-md transition-colors" title="New Plan"><Icons.Plus /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-0">
               {itineraries.length === 0 ? (
                 <div className="text-center p-4 text-xs font-sans text-stone-400">No plans yet. Click + to start!</div>
               ) : (
                 itineraries.map(doc => (
                   <div 
                     key={doc.id} 
                     className={`w-full rounded-xl flex items-center justify-between p-2 font-sans text-sm transition-all duration-200 ${activeDocId === doc.id ? 'bg-white shadow-sm border border-stone-200 font-bold text-rose-600' : 'hover:bg-stone-100 text-stone-600 border border-transparent'}`}
                   >
                     <button 
                       onClick={() => setActiveDocId(doc.id)}
                       className="flex items-center gap-2 flex-1 text-left min-w-0"
                     >
                       <Icons.FileText /> <span className="truncate">{doc.title}</span>
                     </button>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         renamePlan(doc);
                       }}
                       className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-md transition-colors shrink-0 ml-1"
                       title="Rename Plan"
                     >
                       <Icons.Edit />
                     </button>
                   </div>
                 ))
               )}
            </div>
         </div>

         <div className="flex-1 flex flex-col relative min-w-0 h-full min-h-0">
             {activeDocId ? (
                <>
                   <div className="bg-white border-b border-stone-100 p-4 shrink-0 flex items-center justify-between z-10 shadow-sm relative">
                      <div className="flex items-center gap-3">
                        <h2 className="font-bold text-stone-800 text-xl tracking-tight truncate max-w-[200px] sm:max-w-xs">{itineraries.find(i=>i.id===activeDocId)?.title}</h2>
                        {partnerEditing && <span className="text-xs font-sans text-rose-500 font-medium animate-pulse ml-2 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 whitespace-nowrap">✨ Partner is typing...</span>}
                      </div>
                      
                      <div className="flex gap-2">
                        <button onClick={deleteCurrentPlan} className="text-stone-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors" title="Delete Plan"><Icons.Trash /></button>
                      </div>
                   </div>
                   
                   <textarea
                      value={activeContent}
                      onChange={handleItineraryChange}
                      className="flex-1 w-full bg-transparent p-6 sm:p-8 resize-none focus:outline-none text-stone-700 leading-relaxed text-lg custom-scrollbar z-0 overflow-y-auto min-h-0"
                      placeholder="Jot down your plans, timeline, and ideas here..."
                      style={{ backgroundImage: 'linear-gradient(transparent, transparent 31px, #e5e5e5 31px)', backgroundSize: '100% 32px', lineHeight: '32px' }}
                   />
                </>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-stone-400 opacity-60">
                   <Icons.FileText />
                   <p className="mt-2 font-sans font-medium">Select or create a plan</p>
                </div>
             )}
         </div>
      </div>
    </div>
  );
};

const PookieWidget = ({ memories, onSelectMemory, isGalleryOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ text: "Hi! I'm Pookie 🎀 Your personal couple's concierge and date planner. Need a date idea or want to reminisce about a past memory?", sender: "pookie" }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => { if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isOpen, isTyping]);

  if (isGalleryOpen) return null; 

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage = { text: input, sender: 'user' };
    const chatHistory = [...messages];
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/pookie/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.text, history: chatHistory.slice(-6) })
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { text: data.reply, sender: 'pookie' }]);
      } else setMessages(prev => [...prev, { text: "Oops, my brain is a little fuzzy right now. Try again?", sender: 'pookie' }]);
    } catch (error) {
      setMessages(prev => [...prev, { text: "I can't connect to the server! 😢", sender: 'pookie' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessageContent = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s]*)?)/gi;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        const matchingMemory = memories?.find(m => m.memory_media?.some(med => med.file_url === part));
        return (
          <div key={index} className="mt-3 space-y-2">
            <div className="rounded-xl overflow-hidden shadow-md bg-black max-h-56">
              <img src={part} loading="lazy" alt="Memory preview" className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300" onClick={() => window.open(part, '_blank')} />
            </div>
            {matchingMemory && (
              <button onClick={() => { onSelectMemory(matchingMemory); setIsOpen(false); }} className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-rose-100 shadow-sm">
                ✨ Open "{matchingMemory.title}" Album
              </button>
            )}
          </div>
        );
      }
      return <span key={index} className="whitespace-pre-wrap break-words">{part}</span>;
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end">
      <div className={`mb-4 w-[90vw] sm:w-[380px] bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
        <div className="bg-rose-500 p-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl bg-white/20 p-1.5 rounded-full leading-none">🎀</span>
            <div>
              <h3 className="font-bold text-sm">Pookie</h3>
              <p className="text-[10px] text-rose-100 font-medium tracking-wide uppercase">AI Concierge & Planner</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-rose-100 hover:text-white transition-colors bg-rose-600/50 hover:bg-rose-600 p-1.5 rounded-full"><Icons.X /></button>
        </div>

        <div className="h-[380px] p-4 overflow-y-auto bg-stone-50 flex flex-col gap-3 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in zoom-in-95 duration-200`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-stone-800 text-white rounded-br-sm' : 'bg-white border border-stone-200 text-stone-700 rounded-bl-sm'}`}>
                {renderMessageContent(msg.text)}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start animate-in fade-in zoom-in-95 duration-200">
               <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
                 <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></div>
                 <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                 <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-100 flex gap-2 shrink-0">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={isTyping} placeholder="Ask Pookie anything..." className="flex-1 bg-stone-100 border border-stone-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400" />
          <button type="submit" disabled={!input.trim() || isTyping} className="p-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white rounded-full flex items-center justify-center shadow-sm w-10 h-10 shrink-0"><Icons.Send /></button>
        </form>
      </div>

      <button onClick={() => setIsOpen(!isOpen)} className="bg-stone-900 hover:bg-stone-800 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-stone-200">
        {isOpen ? <Icons.X /> : <span className="flex items-center gap-2"><Icons.MessageCircle /> <span className="font-bold font-sans text-sm pr-1">Pookie</span></span>}
      </button>
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('us_auth') === 'true');
  const [activeTab, setActiveTab] = useState('vault');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [memories, setMemories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [dialogConfig, setDialogConfig] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null, showInput: false, inputValue: '' });
  const ITEMS_PER_PAGE = 12;

  const showDialog = (config) => setDialogConfig({ ...config, isOpen: true });
  const closeDialog = () => setDialogConfig(prev => ({ ...prev, isOpen: false }));
  const handleDialogInput = (val) => setDialogConfig(prev => ({ ...prev, inputValue: val }));

  const fetchMemories = async (pageNum = 0, isRefresh = false) => {
    if (isRefresh) {
      setIsLoading(true);
      setPage(0);
    }
    try {
      const offset = pageNum * ITEMS_PER_PAGE;
      const response = await fetch(`${API_BASE_URL}/api/memories?limit=${ITEMS_PER_PAGE}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map(item => ({ ...item, formattedDate: new Date(item.memory_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) }));
        
        if (data.length < ITEMS_PER_PAGE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (isRefresh || pageNum === 0) {
          setMemories(formattedData);
        } else {
          setMemories(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newItems = formattedData.filter(m => !existingIds.has(m.id));
            return [...prev, ...newItems];
          });
        }

        if (selectedMemory) {
          const updatedMemory = formattedData.find(m => m.id === selectedMemory.id);
          if (updatedMemory && updatedMemory.memory_media.length > 0) setSelectedMemory(updatedMemory);
          else setSelectedMemory(null);
        }
      }
    } catch (error) {
      showDialog({ type: 'alert', title: 'Connection Error', message: 'Failed to fetch memories from the server.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshMemories = () => {
    fetchMemories(0, true);
  };

  useEffect(() => { if (isAuthenticated) handleRefreshMemories(); }, [isAuthenticated]);

  const handleDeleteAlbum = (memory) => {
    showDialog({
      type: 'confirm',
      title: 'Delete Entire Memory',
      message: `Are you sure you want to permanently delete "${memory.title}" and all its photos? This cannot be undone.`,
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/memories/${memory.id}`, { method: 'DELETE' });
          if (response.ok) handleRefreshMemories();
          else {
            const err = await response.json();
            showDialog({ type: 'alert', title: 'Delete Failed', message: err.detail });
          }
        } catch (error) {
          showDialog({ type: 'alert', title: 'Error', message: 'Could not connect to backend.' });
        }
      }
    });
  };

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen onLogin={() => { localStorage.setItem('us_auth', 'true'); setIsAuthenticated(true); }} showDialog={showDialog} />
        <CustomDialog {...dialogConfig} onCancel={closeDialog} onConfirm={() => { dialogConfig.onConfirm(dialogConfig.inputValue); closeDialog(); }} onInputChange={handleDialogInput} />
      </>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#faf9f8] font-sans selection:bg-rose-200 selection:text-rose-900 flex flex-col relative">
      <div className="fixed top-[-10%] left-[-10%] rounded-full mix-blend-multiply opacity-60 z-0 pointer-events-none" style={{ backgroundColor: '#fecdd3', width: '500px', height: '500px', filter: 'blur(100px)' }}></div>
      <div className="fixed top-[20%] right-[-10%] rounded-full mix-blend-multiply opacity-60 z-0 pointer-events-none" style={{ backgroundColor: '#ffedd5', width: '400px', height: '400px', filter: 'blur(100px)' }}></div>
      <div className="fixed bottom-[-10%] left-[20%] rounded-full mix-blend-multiply opacity-50 z-0 pointer-events-none" style={{ backgroundColor: '#fbcfe8', width: '600px', height: '600px', filter: 'blur(120px)' }}></div>
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.4, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.08) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>

      <Header onAddClick={() => setIsAddModalOpen(true)} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={() => { localStorage.removeItem('us_auth'); setIsAuthenticated(false); }} />
      
      <main className="flex-1 w-full relative z-10 flex flex-col min-h-0">
        {activeTab === 'vault' && (
          <div className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8 py-12 pb-32">
            <div className="text-center mb-16 relative z-10">
              <h2 className="text-5xl font-serif text-stone-800 mb-4 tracking-tight drop-shadow-sm">Our Memory Vault</h2>
              <p className="text-stone-600 max-w-2xl mx-auto text-lg">
                A secure collection of our favorite days, biggest adventures, and quietest moments. 
                Click any memory to dive into the gallery.
              </p>
            </div>

            {isLoading && page === 0 ? (
              <div className="flex justify-center items-center py-20 relative z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
              </div>
            ) : memories.length === 0 ? (
              <div className="text-center py-20 text-stone-500 bg-white/50 backdrop-blur-sm rounded-3xl border border-stone-100 p-12 shadow-sm max-w-2xl mx-auto relative z-10">
                <span className="text-6xl mb-4 block">📸</span>
                <p className="text-xl font-medium text-stone-700">Your vault is waiting.</p>
                <p className="mt-2 text-stone-500">Click "+ Add Memory" to create your first smart album.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
                  {memories.map((memory) => <MemoryCard key={memory.id} memory={memory} onClick={(mem) => setSelectedMemory(mem)} onDeleteClick={handleDeleteAlbum} />)}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-12 relative z-10">
                    <button 
                      onClick={() => {
                        const nextPage = page + 1;
                        setPage(nextPage);
                        fetchMemories(nextPage, false);
                      }}
                      className="bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 px-8 py-3 rounded-full font-medium transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                    >
                      <Icons.Refresh /> Load More Memories
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'chronicle' && (
           <div className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8 py-12 pb-32">
              <ChronicleView showDialog={showDialog} onOpenMemory={setSelectedMemory} />
           </div>
        )}

        {/* Mobile UI Fix: Allows the content to stack gracefully and scroll on mobile, while filling full screen dynamically on desktop */}
        {activeTab === 'planner' && (
           <div className="w-full max-w-6xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col md:flex-row gap-6 md:h-[calc(100vh-6rem)] pb-32 md:pb-8">
              <DatePlanner showDialog={showDialog} />
           </div>
        )}
      </main>

      <AddMemoryModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onMemoryAdded={handleRefreshMemories} showDialog={showDialog} />
      
      <FullPageGallery 
         isOpen={!!selectedMemory} 
         onClose={() => setSelectedMemory(null)} 
         memory={selectedMemory} 
         memories={memories}
         onSelectMemory={setSelectedMemory}
         onMemoryUpdated={handleRefreshMemories} 
         showDialog={showDialog} 
      />
      
      <CustomDialog {...dialogConfig} onCancel={closeDialog} onConfirm={() => { dialogConfig.onConfirm(dialogConfig.inputValue); closeDialog(); }} onInputChange={handleDialogInput} />
      <PookieWidget memories={memories} onSelectMemory={setSelectedMemory} isGalleryOpen={!!selectedMemory} />
    </div>
  );
}