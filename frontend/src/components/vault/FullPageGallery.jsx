import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icons } from '../common/Icons';
import { parseMediaUrl, preloadHighResImage, captureVideoFrame } from '../../utils/mediaParser';
import { API_BASE_URL, uploadFilesWithProgress } from '../../utils/apiUtils';

const SmartThumb = React.memo(({ parsed, className = "w-full h-full object-cover" }) => {
  const [src, setSrc] = useState(parsed?.isLegacyVideo ? '' : (parsed?.thumbLow || parsed?.thumb || ''));

  useEffect(() => {
    let active = true;
    setSrc(parsed?.isLegacyVideo ? '' : (parsed?.thumbLow || parsed?.thumb || ''));
    if (parsed?.isLegacyVideo && parsed?.videoStreamUrl) {
      captureVideoFrame(parsed.videoStreamUrl).then((frame) => {
        if (active && frame) setSrc(frame);
      });
    }
    return () => { active = false; };
  }, [parsed?.thumbLow, parsed?.thumb, parsed?.isLegacyVideo, parsed?.videoStreamUrl]);

  const handleLoad = (e) => {
    if (parsed?.isYoutube && e.target.naturalWidth === 120 && parsed?.videoStreamUrl) {
      captureVideoFrame(parsed.videoStreamUrl).then((frame) => {
        if (frame) setSrc(frame);
      });
    }
  };

  const handleError = () => {
    if (parsed?.videoStreamUrl) {
      captureVideoFrame(parsed.videoStreamUrl).then((frame) => {
        if (frame) setSrc(frame);
      });
    }
  };

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-stone-900 text-rose-400 text-xs font-bold">
        🎬
      </div>
    );
  }

  return (
    <img
      src={src}
      loading="lazy"
      decoding="async"
      alt=""
      onLoad={handleLoad}
      onError={handleError}
      className={className}
    />
  );
});

export const FullPageGallery = ({ isOpen, onClose, memory, memories, onSelectMemory, onMemoryUpdated, showDialog }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedAlbumId, setExpandedAlbumId] = useState(null);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descText, setDescText] = useState("");
  const containerRef = useRef(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  useEffect(() => {
    if (isOpen && memory) {
      setCurrentIndex(0);
      setExpandedAlbumId(memory.id);
      setDescText(memory.description || "");
      setIsEditingDesc(false);
      setIsMobileSidebarOpen(false);
    }
  }, [isOpen, memory?.id]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const mediaList = memory?.memory_media || [];
  const parsedMediaList = useMemo(
    () => mediaList.map((m) => ({ ...m, ...parseMediaUrl(m.file_url) })),
    [mediaList]
  );

  const safeIndex = Math.min(currentIndex, Math.max(0, parsedMediaList.length - 1));
  const activeMedia = parsedMediaList[safeIndex] || null;

  // Preload neighboring 3 slides (+1, +2, -1) so clicking Next/Prev is instantaneous
  useEffect(() => {
    setPreviewLoaded(false);
    const total = parsedMediaList.length;
    if (total > 1) {
      [1, 2, -1].forEach((offset) => {
        const neighbor = parsedMediaList[(safeIndex + offset + total) % total];
        if (neighbor && !neighbor.isYoutube && !neighbor.isLegacyVideo && !neighbor.isVoice) {
          preloadHighResImage(neighbor.thumb);
        }
      });
    }
  }, [safeIndex, memory?.id, parsedMediaList]);

  const handleNext = () => {
    if (parsedMediaList.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % parsedMediaList.length);
    }
  };

  const handlePrev = () => {
    if (parsedMediaList.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + parsedMediaList.length) % parsedMediaList.length);
    }
  };

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (distance > 50) handleNext();
    if (distance < -50) handlePrev();
    setTouchStart(null);
    setTouchEnd(null);
  };

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
        if (!document.fullscreenElement) {
          if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
        } else {
          if (document.exitFullscreen) await document.exitFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditingDesc, parsedMediaList.length]);

  if (!isOpen || !memory) return null;

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
    }
  };

  const handleAddMedia = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    uploadFilesWithProgress(
      `${API_BASE_URL}/api/memories/${memory.id}/media`,
      formData,
      (percent) => setUploadProgress(percent),
      () => {
        setIsUploading(false);
        onMemoryUpdated();
      },
      (error) => {
        setIsUploading(false);
        showDialog({
          type: 'alert',
          title: 'Upload Failed',
          message: error.detail || 'Could not upload media file.'
        });
      }
    );
  };

  const handleDeleteActiveMedia = () => {
    if (!activeMedia) return;
    showDialog({
      type: 'confirm',
      title: 'Delete Media',
      message: 'Are you sure you want to permanently delete this file from the album and cloud storage?',
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/media/${activeMedia.id}`, { method: 'DELETE' });
          if (response.ok) {
            onMemoryUpdated();
            if (safeIndex >= parsedMediaList.length - 1) {
              setCurrentIndex(Math.max(0, parsedMediaList.length - 2));
            }
          } else {
            const err = await response.json();
            showDialog({ type: 'alert', title: 'Delete Failed', message: err.detail || 'Error deleting file.' });
          }
        } catch {
          showDialog({ type: 'alert', title: 'Error', message: 'Could not connect to backend.' });
        }
      }
    });
  };

  const handleDownloadAlbum = () => {
    window.location.href = `${API_BASE_URL}/api/memories/${memory.id}/download`;
  };

  const handleDownloadSingle = () => {
    if (!activeMedia || !activeMedia.id) return;
    window.location.href = `${API_BASE_URL}/api/media/${activeMedia.id}/download`;
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
    } catch {
      showDialog({ type: 'alert', title: 'Error', message: 'Network error.' });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-stone-950 text-white animate-in fade-in duration-150 overflow-hidden">
      
      {isMobileSidebarOpen && !isFullscreen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[105] md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Retractable Mobile Drawer & Desktop Sidebar */}
      {!isFullscreen && (
        <div
          className={`fixed inset-y-0 left-0 w-80 bg-stone-950 border-r border-stone-800 flex-col shrink-0 z-[110] transform transition-transform duration-200 ease-out md:relative md:translate-x-0 md:flex ${
            isMobileSidebarOpen ? 'translate-x-0 flex' : '-translate-x-full hidden md:flex'
          }`}
        >
          <div className="p-5 border-b border-stone-800 flex items-center justify-between shrink-0">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-stone-400 hover:text-white"
              title="Close Gallery (Esc)"
            >
              <Icons.ArrowLeft />
            </button>
            <h2 className="text-lg font-serif font-bold text-stone-200">Vault Albums</h2>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-white/10 rounded-full transition-colors text-stone-400 hover:text-white"
            >
              <Icons.X />
            </button>
            <div className="w-8 hidden md:block"></div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {memories.map((m) => {
              const isExpanded = expandedAlbumId === m.id;
              const displayMediaRaw = m.memory_media?.length > 0 ? m.memory_media[0].file_url : '';
              const parsedThumb = displayMediaRaw ? parseMediaUrl(displayMediaRaw) : null;
              
              return (
                <div key={m.id} className="flex flex-col">
                  <button
                    onClick={() => { 
                      if (isExpanded) {
                        setExpandedAlbumId(null);
                      } else { 
                        setExpandedAlbumId(m.id); 
                        if (m.id !== memory.id) { 
                          setCurrentIndex(0); 
                          onSelectMemory(m); 
                        } 
                      }
                    }}
                    className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors duration-150 ${
                      isExpanded ? 'bg-stone-800 shadow-inner' : 'hover:bg-stone-800/50 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-black shrink-0 overflow-hidden relative flex items-center justify-center">
                      {parsedThumb?.isVoice ? (
                        <Icons.Mic />
                      ) : parsedThumb ? (
                        <SmartThumb parsed={parsedThumb} />
                      ) : (
                        <span className="text-xs">📸</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className={`text-sm font-medium truncate ${isExpanded ? 'text-white' : 'text-stone-300'}`}>
                          {m.title}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5">{m.formattedDate}</div>
                      </div>
                      {m.is_private && <span className="text-rose-500 opacity-80 shrink-0 ml-2"><Icons.Lock /></span>}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="pl-14 pr-2 grid grid-cols-3 gap-2 pb-3 pt-2 overflow-y-auto custom-scrollbar" style={{ maxHeight: "350px" }}>
                      {m.memory_media?.map((media, idx) => {
                        const parsed = parseMediaUrl(media.file_url);
                        return (
                          <button
                            key={media.id || idx}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (m.id !== memory.id) onSelectMemory(m); 
                              setCurrentIndex(idx); 
                              setIsMobileSidebarOpen(false);
                            }}
                            className={`relative aspect-square rounded-md overflow-hidden bg-stone-900 transition-transform flex items-center justify-center ${
                              m.id === memory.id && safeIndex === idx
                                ? 'ring-2 ring-rose-500 scale-105 z-10'
                                : 'opacity-75 hover:opacity-100'
                            }`}
                          >
                            {parsed.isVoice ? (
                              <Icons.Mic className="text-stone-400" />
                            ) : (
                              <>
                                <SmartThumb parsed={parsed} />
                                {(parsed.isYoutube || parsed.isLegacyVideo) && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white text-xs">
                                    ▶
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Viewer Stage */}
      <div ref={containerRef} className="flex-1 relative flex flex-col overflow-hidden bg-stone-950 group">
        
        {/* Top Floating Control Bar */}
        <div
          className={`absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-50 transition-opacity pointer-events-none ${
            isFullscreen ? 'opacity-0 hover:opacity-100' : 'opacity-100'
          }`}
        >
          <div className="flex items-center gap-2.5 pointer-events-auto min-w-0">
            <button onClick={onClose} className="md:hidden p-2 bg-stone-800/90 hover:bg-stone-700 rounded-full transition-colors shrink-0">
              <Icons.ArrowLeft />
            </button>
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 bg-stone-800/90 hover:bg-stone-700 rounded-full transition-colors flex items-center justify-center shrink-0"
              title="Open Albums Drawer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <div className="md:hidden font-serif font-bold truncate text-sm flex items-center gap-1.5">
              {memory.is_private && <span className="text-rose-400 shrink-0"><Icons.Lock /></span>}
              <span className="truncate">{memory.title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {parsedMediaList.length > 1 && (
              <span className="text-xs font-mono bg-stone-800/80 px-3 py-1.5 rounded-full text-stone-300">
                {safeIndex + 1} / {parsedMediaList.length}
              </span>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-3 bg-stone-800/90 hover:bg-stone-700 text-white rounded-full transition-all"
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Icons.Minimize /> : <Icons.Maximize />}
            </button>
          </div>
        </div>

        {/* Instant Media Stage: Shows RAM-cached thumbLow immediately, then snaps to 90KB preview */}
        <div 
          className="flex-1 relative flex items-center justify-center p-4 md:p-12 min-h-0 z-0"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {parsedMediaList.length > 0 && activeMedia ? (
            <>
              {activeMedia.isVoice ? (
                <div className="w-full max-w-md bg-stone-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 border border-stone-800">
                  <div className="w-24 h-24 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-400 animate-pulse">
                    <Icons.Mic />
                  </div>
                  <h3 className="font-serif font-bold text-xl text-stone-200">Voice Note</h3>
                  <audio key={activeMedia.original} src={activeMedia.original} controls className="w-full outline-none" autoPlay />
                </div>
              ) : activeMedia.isYoutube ? (
                <div className="w-full max-w-5xl aspect-video rounded-2xl overflow-hidden shadow-2xl border border-stone-800 z-10 relative bg-black">
                  <iframe
                    key={activeMedia.id}
                    src={activeMedia.embedUrl}
                    title="YouTube Memory Video"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : activeMedia.isLegacyVideo ? (
                <video
                  key={activeMedia.original}
                  src={activeMedia.original}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-full max-w-5xl object-contain rounded-xl z-10 relative shadow-2xl bg-black"
                />
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  {/* Layer 1: Instant already-cached 360px thumbnail (0ms display, no blank wait) */}
                  {!previewLoaded && (
                    <img
                      src={activeMedia.thumbLow}
                      alt=""
                      className="absolute w-full h-full object-contain select-none"
                      draggable="false"
                    />
                  )}
                  {/* Layer 2: Fast 1280px preview (~90KB) */}
                  <img
                    key={activeMedia.thumb}
                    src={activeMedia.thumb}
                    alt={memory.title}
                    decoding="async"
                    fetchPriority="high"
                    onLoad={() => setPreviewLoaded(true)}
                    className={`w-full h-full object-contain z-10 relative select-none transition-opacity duration-150 ${
                      previewLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    draggable="false"
                  />
                </div>
              )}
              
              {parsedMediaList.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                    className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-stone-800/80 hover:bg-stone-700 text-white rounded-full transition-all opacity-0 md:group-hover:opacity-100 z-50 focus:outline-none pointer-events-auto hidden md:block"
                  >
                    <Icons.Left />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-stone-800/80 hover:bg-stone-700 text-white rounded-full transition-all opacity-0 md:group-hover:opacity-100 z-50 focus:outline-none pointer-events-auto hidden md:block"
                  >
                    <Icons.Right />
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="text-center text-stone-500">
              <p className="text-xl mb-4">No media available in this album.</p>
            </div>
          )}
        </div>

        {/* Bottom Floating Information & Action Bar */}
        <div
          className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-5 sm:p-6 z-50 transition-opacity flex flex-col md:flex-row items-end justify-between gap-4 pointer-events-none ${
            isFullscreen ? 'opacity-0 hover:opacity-100' : 'opacity-100'
          }`}
        >
          <div className="max-w-xl w-full pointer-events-auto">
            {!isFullscreen && (
              <>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mb-1 drop-shadow-md flex items-center gap-2">
                  {memory.title}
                  {memory.is_private && (
                    <span className="text-rose-400 bg-black/30 p-1 rounded-md" title="Private Memory">
                      <Icons.Lock />
                    </span>
                  )}
                </h2>
                
                <div className="text-stone-300 text-xs sm:text-sm mb-3 font-medium flex items-center gap-3 flex-wrap">
                  <span>{memory.formattedDate}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadAlbum(); }}
                    className="hover:text-rose-400 transition-colors flex items-center gap-1 bg-stone-800 hover:bg-stone-700 px-3 py-1 rounded-full text-xs border border-transparent"
                  >
                    <Icons.Download /> Zip Album
                  </button>
                  <button
                    onClick={() => setIsEditingDesc(!isEditingDesc)}
                    className={`transition-colors flex items-center gap-1 px-3 py-1 rounded-full text-xs border ${
                      isEditingDesc
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/20'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-transparent'
                    }`}
                  >
                    <Icons.Edit /> {isEditingDesc ? 'Cancel Edit' : 'Edit Story'}
                  </button>
                </div>

                <div className="mt-2">
                  {isEditingDesc ? (
                    <div className="bg-stone-900 p-3 rounded-xl border border-stone-800">
                      <textarea 
                        value={descText} 
                        onChange={(e) => setDescText(e.target.value)}
                        className="w-full bg-transparent text-white text-sm focus:outline-none resize-none min-h-[90px] custom-scrollbar"
                        placeholder="Write your story..."
                        autoFocus
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleSaveDesc}
                          className="text-xs px-4 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 transition font-bold text-white"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-stone-300 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed line-clamp-2 sm:line-clamp-3 hover:line-clamp-none transition-all duration-300">
                      {memory.description || <span className="italic opacity-50">No description provided.</span>}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 justify-end z-[60] pointer-events-auto w-full md:w-auto">
            <div className="relative group cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                onChange={handleAddMedia}
                disabled={isUploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-not-allowed"
              />
              <button
                disabled={isUploading}
                className="px-4 sm:px-5 py-2.5 bg-stone-800 hover:bg-stone-700 rounded-full text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 relative overflow-hidden pointer-events-none"
              >
                {isUploading ? (
                  <>
                    <span className="relative z-10 text-xs font-bold">Uploading {uploadProgress}%</span>
                    <div className="absolute left-0 top-0 bottom-0 bg-rose-500/50 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
                  </>
                ) : (
                  <><Icons.Plus /> Add Media</>
                )}
              </button>
            </div>
            
            {activeMedia && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownloadSingle(); }}
                  className="px-4 py-2.5 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-full transition-colors flex items-center gap-2 z-20 cursor-pointer text-xs sm:text-sm"
                >
                  <Icons.Download /> <span className="hidden sm:inline">Save Original</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteActiveMedia(); }}
                  className="px-4 py-2.5 bg-red-900 hover:bg-red-800 text-red-200 rounded-full transition-colors flex items-center gap-2 z-20 cursor-pointer text-xs sm:text-sm"
                >
                  <Icons.Trash /> <span className="hidden sm:inline">Delete</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullPageGallery;