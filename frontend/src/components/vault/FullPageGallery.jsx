import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icons } from '../common/Icons';
import { parseMediaUrl, preloadHighResImage, captureVideoFrame } from '../../utils/mediaParser';
import { API_BASE_URL, uploadFilesWithProgress } from '../../utils/apiUtils';
import { extractVaultMeta, serializeVaultDescription, saveLocalAlbumMeta } from '../../utils/vaultMetaUtils';
import AlbumVinylSoundtrack from './AlbumVinylSoundtrack';
import DualPovStoryNotes from './DualPovStoryNotes';

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

export const FullPageGallery = ({
  isOpen,
  onClose,
  memory,
  initialIndex = 0,
  memories,
  onSelectMemory,
  onMemoryUpdated,
  showDialog
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const [openSidebarSection, setOpenSidebarSection] = useState('timeline');
  const [expandedAlbumId, setExpandedAlbumId] = useState(null);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const containerRef = useRef(null);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const { cleanDescription, meta } = useMemo(() => extractVaultMeta(memory), [memory]);

  useEffect(() => {
    if (isOpen && memory) {
      const startIdx =
        typeof memory.initialMediaIndex === 'number' && memory.initialMediaIndex >= 0
          ? memory.initialMediaIndex
          : typeof initialIndex === 'number' && initialIndex >= 0
            ? initialIndex
            : 0;
      setCurrentIndex(startIdx);
      setExpandedAlbumId(memory.id);

      const { meta: currentMeta } = extractVaultMeta(memory);
      if (currentMeta.isPrivate) {
        setOpenSidebarSection('private');
      } else if (currentMeta.isConstant) {
        setOpenSidebarSection('constant');
      } else {
        setOpenSidebarSection('timeline');
      }

      setIsEditingDesc(false);
      setIsCinemaMode(false);
      setShowMoveMenu(false);
      setIsMobileSidebarOpen(false);
    }
  }, [isOpen, memory?.id, memory?._openTrigger, memory?.initialMediaIndex, initialIndex]);

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const { timelineAlbums, constantAlbums, privateAlbums } = useMemo(() => {
    const list = Array.isArray(memories) ? [...memories] : [];
    if (memory && !list.some((m) => m.id === memory.id)) {
      list.unshift(memory);
    }

    const timeline = [];
    const constant = [];
    const priv = [];

    list.forEach((m) => {
      const { meta: mMeta } = extractVaultMeta(m);
      if (mMeta.unlockDate && new Date(mMeta.unlockDate) > new Date() && m.id !== memory?.id) {
        return;
      }
      if (mMeta.isPrivate) {
        priv.push(m);
      } else if (mMeta.isConstant) {
        constant.push(m);
      } else {
        timeline.push(m);
      }
    });

    return {
      timelineAlbums: timeline,
      constantAlbums: constant,
      privateAlbums: priv
    };
  }, [memories, memory]);

  // IMPORTANT: Keep this useMemo BEFORE the early return so React Hook order never changes!
  const moveTargetAlbums = useMemo(() => {
    const allowed = meta.isPrivate
      ? [...privateAlbums, ...timelineAlbums, ...constantAlbums]
      : [...timelineAlbums, ...constantAlbums];
    return allowed.filter((m) => m.id !== memory?.id);
  }, [meta.isPrivate, privateAlbums, timelineAlbums, constantAlbums, memory?.id]);

  const mediaList = memory?.memory_media || [];
  const parsedMediaList = useMemo(
    () =>
      mediaList.map((m) => {
        const parsed = parseMediaUrl(m.file_url);
        return {
          ...parsed,
          ...m,
          id: m.id,
          cloudId: parsed.cloudId
        };
      }),
    [mediaList]
  );

  const safeIndex = Math.min(currentIndex, Math.max(0, parsedMediaList.length - 1));
  const activeMedia = parsedMediaList[safeIndex] || null;
  const activePhotoCaption = activeMedia ? meta.captions?.[String(activeMedia.id)] || '' : '';
  const isCurrentCover = Boolean(activeMedia && String(meta.coverMediaId) === String(activeMedia.id));

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

  useEffect(() => {
    if (!isCinemaMode || parsedMediaList.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % parsedMediaList.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isCinemaMode, parsedMediaList.length]);

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
        if (isCinemaMode) setIsCinemaMode(false);
        else if (document.fullscreenElement) document.exitFullscreen();
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
  }, [isOpen, isEditingDesc, parsedMediaList.length, isCinemaMode]);

  // Early return AFTER all Hooks have been called
  if (!isOpen || !memory) return null;

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) await containerRef.current.requestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
    }
  };

  const persistMetaPatch = async (newCleanDesc, metaPatch) => {
    const mergedMeta = { ...meta, ...metaPatch };
    saveLocalAlbumMeta(memory.id, mergedMeta);
    const serialized = serializeVaultDescription(newCleanDesc, mergedMeta);

    try {
      await fetch(`${API_BASE_URL}/api/memories/${memory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: serialized })
      });
      onMemoryUpdated();
    } catch {
      showDialog({ type: 'alert', title: 'Error', message: 'Failed to sync album metadata.' });
    }
  };

  const handleSetAsFolderCover = () => {
    if (!activeMedia) return;
    persistMetaPatch(cleanDescription, { coverMediaId: activeMedia.id });
  };

  const handleEditPhotoCaption = () => {
    if (!activeMedia) return;
    showDialog({
      type: 'confirm',
      title: 'Photo Micro-Caption 💬',
      message: 'Add a short optional caption or memory note for this specific photo (leave blank to remove):',
      showInput: true,
      inputValue: activePhotoCaption,
      onConfirm: (val) => {
        const nextCaptions = { ...(meta.captions || {}) };
        const trimmed = (val || '').trim();
        if (trimmed) {
          nextCaptions[String(activeMedia.id)] = trimmed;
        } else {
          delete nextCaptions[String(activeMedia.id)];
        }
        persistMetaPatch(cleanDescription, { captions: nextCaptions });
      }
    });
  };

  const handleMoveMediaToAlbum = async (targetAlbum) => {
    if (!activeMedia || !targetAlbum || targetAlbum.id === memory.id) return;
    setShowMoveMenu(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/media/${activeMedia.id}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_memory_id: String(targetAlbum.id) })
      });
      if (res.ok) {
        onMemoryUpdated();
        if (safeIndex >= parsedMediaList.length - 1) {
          setCurrentIndex(Math.max(0, parsedMediaList.length - 2));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showDialog({ type: 'alert', title: 'Move Failed', message: err.detail || 'Could not move clip.' });
      }
    } catch {
      showDialog({ type: 'alert', title: 'Error', message: 'Network error while moving clip.' });
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

  const renderAlbumList = (albumArray) => {
    if (albumArray.length === 0) {
      return (
        <p className="text-xs text-stone-500 italic px-3 py-2">
          No albums in this section.
        </p>
      );
    }

    return albumArray.map((m) => {
      const isExpanded = expandedAlbumId === m.id;
      const displayMediaRaw = m.memory_media?.length > 0 ? m.memory_media[0].file_url : '';
      const parsedThumb = displayMediaRaw ? parseMediaUrl(displayMediaRaw) : null;

      return (
        <div key={m.id} className="flex flex-col">
          <button
            type="button"
            onClick={() => {
              if (isExpanded) {
                setExpandedAlbumId(null);
              } else {
                setExpandedAlbumId(m.id);
                if (m.id !== memory.id) {
                  setCurrentIndex(0);
                  onSelectMemory({ ...m, initialMediaIndex: 0 }, 0);
                }
              }
            }}
            className={`w-full text-left p-2 rounded-xl flex items-center gap-3 transition-colors duration-150 cursor-pointer ${isExpanded
                ? 'bg-stone-800 shadow-inner'
                : 'hover:bg-stone-900 opacity-80 hover:opacity-100'
              }`}
          >
            <div className="w-11 h-11 rounded-lg bg-black shrink-0 overflow-hidden relative flex items-center justify-center border border-stone-700/60">
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
                <div className={`text-xs sm:text-sm font-medium truncate ${isExpanded ? 'text-white font-bold' : 'text-stone-300'}`}>
                  {m.title}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">{m.formattedDate}</div>
              </div>
              <span className="text-[10px] text-stone-500 ml-2 shrink-0">
                {isExpanded ? '▲' : '▼'}
              </span>
            </div>
          </button>

          {isExpanded && (
            <div
              className="pl-12 pr-2 grid grid-cols-3 gap-1.5 pb-2.5 pt-2 overflow-y-auto custom-scrollbar"
              style={{ maxHeight: '300px' }}
            >
              {m.memory_media?.map((media, idx) => {
                const parsed = parseMediaUrl(media.file_url);
                return (
                  <button
                    key={media.id || idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (m.id !== memory.id) {
                        onSelectMemory({ ...m, initialMediaIndex: idx, _openTrigger: Date.now() }, idx);
                      }
                      setCurrentIndex(idx);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`relative aspect-square rounded-md overflow-hidden bg-stone-900 transition-transform flex items-center justify-center cursor-pointer ${m.id === memory.id && safeIndex === idx
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
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-stone-950 text-white animate-in fade-in duration-150 overflow-hidden">

      {isMobileSidebarOpen && !isFullscreen && !isCinemaMode && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[105] md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Retractable Accordion Sidebar */}
      {!isFullscreen && !isCinemaMode && (
        <div
          className={`fixed inset-y-0 left-0 w-80 bg-stone-950 border-r border-stone-800 flex-col shrink-0 z-[110] transform transition-transform duration-200 ease-out md:relative md:translate-x-0 md:flex ${isMobileSidebarOpen ? 'translate-x-0 flex' : '-translate-x-full hidden md:flex'
            }`}
        >
          <div className="p-5 border-b border-stone-800 flex items-center justify-between shrink-0">
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-stone-400 hover:text-white cursor-pointer"
              title="Close Gallery (Esc)"
            >
              <Icons.ArrowLeft />
            </button>
            <h2 className="text-lg font-serif font-bold text-stone-200">
              {meta.isPrivate ? '🔒 Private Vault' : 'Vault Albums'}
            </h2>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-white/10 rounded-full transition-colors text-stone-400 hover:text-white"
            >
              <Icons.X />
            </button>
            <div className="w-8 hidden md:block"></div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {meta.isPrivate ? (
              <div className="space-y-1.5">
                <div className="px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-between text-xs font-bold text-rose-300">
                  <span>🔒 Private Sanctuary Albums</span>
                  <span>{privateAlbums.length}</span>
                </div>
                <div className="space-y-1 pt-1">{renderAlbumList(privateAlbums)}</div>
              </div>
            ) : (
              <>
                {/* 1. TIMELINE RETRACTABLE ACCORDION */}
                <div className="rounded-2xl border border-stone-800/90 bg-stone-900/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSidebarSection((prev) => (prev === 'timeline' ? 'constant' : 'timeline'))
                    }
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${openSidebarSection === 'timeline'
                        ? 'bg-stone-800 text-rose-400 border-b border-stone-700/80'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🗓️ Timeline Albums</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-700 text-stone-300">
                        {timelineAlbums.length}
                      </span>
                    </span>
                    <span>{openSidebarSection === 'timeline' ? '▲' : '▼'}</span>
                  </button>

                  {openSidebarSection === 'timeline' && (
                    <div className="p-2 space-y-1">{renderAlbumList(timelineAlbums)}</div>
                  )}
                </div>

                {/* 2. CONSTANT ALBUMS RETRACTABLE ACCORDION */}
                <div className="rounded-2xl border border-stone-800/90 bg-stone-900/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSidebarSection((prev) => (prev === 'constant' ? 'timeline' : 'constant'))
                    }
                    className={`w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${openSidebarSection === 'constant'
                        ? 'bg-stone-800 text-amber-400 border-b border-stone-700/80'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>📌 Constant Albums</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-700 text-stone-300">
                        {constantAlbums.length}
                      </span>
                    </span>
                    <span>{openSidebarSection === 'constant' ? '▲' : '▼'}</span>
                  </button>

                  {openSidebarSection === 'constant' && (
                    <div className="p-2 space-y-1">{renderAlbumList(constantAlbums)}</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Viewer Stage */}
      <div ref={containerRef} className="flex-1 relative flex flex-col overflow-hidden bg-stone-950 group">

        {/* Top Floating Control Bar */}
        <div
          className={`absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent z-50 transition-opacity pointer-events-none ${isFullscreen ? 'opacity-0 hover:opacity-100' : 'opacity-100'
            }`}
        >
          <div className="flex items-center gap-2.5 pointer-events-auto min-w-0">
            <button onClick={onClose} className="md:hidden p-2 bg-stone-800/90 hover:bg-stone-700 rounded-full transition-colors shrink-0">
              <Icons.ArrowLeft />
            </button>
            {!isCinemaMode && (
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
            )}

            <AlbumVinylSoundtrack memory={memory} forcePlay={isCinemaMode} />
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            {parsedMediaList.length > 1 && (
              <button
                type="button"
                onClick={() => setIsCinemaMode((prev) => !prev)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg cursor-pointer ${isCinemaMode
                    ? 'bg-rose-500 text-white ring-2 ring-rose-300 animate-pulse'
                    : 'bg-stone-800/90 hover:bg-stone-700 text-stone-200'
                  }`}
                title="1-Click Cinema Slideshow Mode"
              >
                <span>{isCinemaMode ? '⏹ Exit Cinema' : '▶ Cinema Reel'}</span>
              </button>
            )}

            {parsedMediaList.length > 1 && (
              <span className="hidden sm:inline-block text-xs font-mono bg-stone-800/80 px-3 py-1.5 rounded-full text-stone-300">
                {safeIndex + 1} / {parsedMediaList.length}
              </span>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2.5 bg-stone-800/90 hover:bg-stone-700 text-white rounded-full transition-all"
              title="Toggle Fullscreen (F)"
            >
              {isFullscreen ? <Icons.Minimize /> : <Icons.Maximize />}
            </button>
          </div>
        </div>

        {/* Media Stage */}
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
                    key={activeMedia.cloudId || activeMedia.id}
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
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  {!previewLoaded && (
                    <img
                      src={activeMedia.thumbLow}
                      alt=""
                      className="absolute w-full h-full object-contain select-none"
                      draggable="false"
                    />
                  )}
                  <img
                    key={activeMedia.thumb}
                    src={activeMedia.thumb}
                    alt={memory.title}
                    decoding="async"
                    fetchPriority="high"
                    onLoad={() => setPreviewLoaded(true)}
                    className={`w-full h-full object-contain z-10 relative select-none transition-all ${previewLoaded ? 'opacity-100' : 'opacity-0'
                      } ${isCinemaMode
                        ? 'scale-105 duration-[4500ms] ease-out'
                        : 'scale-100 duration-150'
                      }`}
                    draggable="false"
                  />
                </div>
              )}

              {activePhotoCaption && (
                <div
                  onClick={handleEditPhotoCaption}
                  className="absolute bottom-32 sm:bottom-36 left-1/2 -translate-x-1/2 z-40 bg-black/75 hover:bg-black/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium border border-white/20 shadow-xl cursor-pointer max-w-[90vw] truncate"
                  title="Click to edit photo caption"
                >
                  💬 {activePhotoCaption}
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
          className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-5 sm:p-6 z-50 transition-opacity flex flex-col md:flex-row items-end justify-between gap-4 pointer-events-none ${isFullscreen || isCinemaMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'
            }`}
        >
          <div className="max-w-xl w-full pointer-events-auto">
            {!isFullscreen && (
              <>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mb-1 drop-shadow-md flex items-center gap-2">
                  {memory.title}
                  {meta.isPrivate && (
                    <span className="text-rose-400 bg-black/30 p-1 rounded-md" title="Private Memory">
                      <Icons.Lock />
                    </span>
                  )}
                  {meta.locationName && (
                    <span className="text-xs font-sans font-normal bg-white/10 text-rose-200 px-2.5 py-0.5 rounded-full">
                      📍 {meta.locationName}
                    </span>
                  )}
                </h2>

                <div className="text-stone-300 text-xs sm:text-sm mb-2 font-medium flex items-center gap-2.5 flex-wrap">
                  <span>{memory.formattedDate}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownloadAlbum(); }}
                    className="hover:text-rose-400 transition-colors flex items-center gap-1 bg-stone-800 hover:bg-stone-700 px-3 py-1 rounded-full text-xs cursor-pointer"
                  >
                    <Icons.Download /> Zip Album
                  </button>
                  <button
                    onClick={() => setIsEditingDesc(!isEditingDesc)}
                    className={`transition-colors flex items-center gap-1 px-3 py-1 rounded-full text-xs border cursor-pointer ${isEditingDesc
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/20'
                        : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-transparent'
                      }`}
                  >
                    <Icons.Edit /> {isEditingDesc ? 'Cancel Edit' : 'Edit POV / Story'}
                  </button>

                  {activeMedia && (
                    <>
                      <button
                        type="button"
                        onClick={handleEditPhotoCaption}
                        className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1 rounded-full text-xs transition-colors cursor-pointer"
                      >
                        💬 {activePhotoCaption ? 'Edit Caption' : '+ Photo Caption'}
                      </button>

                      {!activeMedia.isVoice && (
                        <button
                          type="button"
                          onClick={handleSetAsFolderCover}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer ${isCurrentCover
                              ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                              : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                            }`}
                        >
                          {isCurrentCover ? '⭐ Folder Cover' : '☆ Set as Cover'}
                        </button>
                      )}
                    </>
                  )}
                </div>

                <DualPovStoryNotes
                  cleanDescription={cleanDescription}
                  meta={meta}
                  isEditing={isEditingDesc}
                  setIsEditing={setIsEditingDesc}
                  onSaveStories={(newSharedDesc, patch) => persistMetaPatch(newSharedDesc, patch)}
                />
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end z-[60] pointer-events-auto w-full md:w-auto relative">
            {activeMedia && moveTargetAlbums.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveMenu((prev) => !prev);
                  }}
                  className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-full text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Move this clip to another album"
                >
                  <span>📁 Move</span>
                </button>

                {showMoveMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-14 right-0 w-64 bg-stone-900/95 backdrop-blur-xl border border-stone-700 rounded-2xl p-2 shadow-2xl z-[80] max-h-60 overflow-y-auto custom-scrollbar"
                  >
                    <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-800 mb-1">
                      Move Clip to Album:
                    </div>
                    {moveTargetAlbums.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => handleMoveMediaToAlbum(target)}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs text-stone-200 hover:bg-rose-500/20 hover:text-rose-300 transition-colors truncate flex items-center justify-between cursor-pointer"
                      >
                        <span className="truncate">{target.title}</span>
                        <span className="text-[10px] opacity-60 ml-2 shrink-0">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                  <Icons.Download /> <span className="hidden sm:inline">Save</span>
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