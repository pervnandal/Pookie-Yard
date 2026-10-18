import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from './utils/apiUtils';
import { parseMediaUrl, preloadAndCacheMedia } from './utils/mediaParser';
import { Icons } from './components/common/Icons';
import Header from './components/common/Header';
import CustomDialog from './components/common/CustomDialog';
import SpecialOccasionWidget from './components/common/SpecialOccasionWidget';
import LoginScreen from './components/auth/LoginScreen';
import MemoryCard from './components/vault/MemoryCard';
import VaultCalendar from './components/vault/VaultCalendar';
import FullPageGallery from './components/vault/FullPageGallery';
import AddMemoryModal from './components/vault/AddMemoryModal';
import ChronicleView from './components/chronicle/ChronicleView';
import DatePlanner from './components/planner/DatePlanner';
import PookieWidget from './components/ai/PookieWidget';

const MEMORIES_CACHE_KEY = 'us_memories_cache_v1';
const ANNIVERSARY_DATE = '2026-05-04';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('us_auth') === 'true');
  const [activeTab, setActiveTab] = useState('vault');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);

  const [memories, setMemories] = useState(() => {
    try {
      const cached = localStorage.getItem(MEMORIES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [selectedDateFilter, setSelectedDateFilter] = useState(null);
  const [isLoading, setIsLoading] = useState(() => {
    try {
      return !localStorage.getItem(MEMORIES_CACHE_KEY);
    } catch {
      return true;
    }
  });
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [occasions, setOccasions] = useState(() => {
    try {
      const saved = localStorage.getItem('us_special_occasions');
      return saved
        ? JSON.parse(saved)
        : [{ id: 'default_anniv', title: 'Our Anniversary 💖', date: '2026-05-04', notes: 'Celebrating our love story' }];
    } catch {
      return [];
    }
  });
  const [manualOccasion, setManualOccasion] = useState(null);
  const [showCelebrationBanner, setShowCelebrationBanner] = useState(true);

  const [dialogConfig, setDialogConfig] = useState({
    isOpen: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: null,
    showInput: false,
    inputValue: ''
  });
  const ITEMS_PER_PAGE = 24;

  useEffect(() => {
    document.title = 'The Us Space';
    const flowerSvg =
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌸</text></svg>";
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = flowerSvg;
  }, []);

  const daysTogether = useMemo(() => {
    const start = new Date(ANNIVERSARY_DATE);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, []);

  const showDialog = (config) => setDialogConfig({ ...config, isOpen: true });
  const closeDialog = () => setDialogConfig((prev) => ({ ...prev, isOpen: false }));
  const handleDialogInput = (val) => setDialogConfig((prev) => ({ ...prev, inputValue: val }));

  const handleAddOccasion = (newOcc) => {
    const updated = [newOcc, ...occasions];
    setOccasions(updated);
    localStorage.setItem('us_special_occasions', JSON.stringify(updated));
    setManualOccasion(newOcc);
    setShowCelebrationBanner(true);
  };

  const handleDeleteOccasion = (id) => {
    const updated = occasions.filter((o) => o.id !== id);
    setOccasions(updated);
    localStorage.setItem('us_special_occasions', JSON.stringify(updated));
    if (manualOccasion?.id === id) setManualOccasion(null);
  };

  const activeOccasion = useMemo(() => {
    if (manualOccasion) return manualOccasion;
    const now = new Date();
    const todayMmDd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const matched = occasions.find((o) => o.date && o.date.slice(5, 10) === todayMmDd);
    return matched || null;
  }, [occasions, manualOccasion]);

  useEffect(() => {
    if (!memories.length) return;
    const timer = setTimeout(() => {
      memories.slice(0, 12).forEach((mem) => {
        (mem.memory_media || []).slice(0, 4).forEach((media) => {
          const parsed = parseMediaUrl(media.file_url);
          if (!parsed.isVoice && !parsed.isLegacyVideo && parsed.thumbLow) {
            preloadAndCacheMedia(parsed.thumbLow);
          }
        });
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [memories]);

  const fetchMemories = async (pageNum = 0, isRefresh = false) => {
    if (isRefresh && memories.length === 0) {
      setIsLoading(true);
      setPage(0);
    }
    try {
      const offset = pageNum * ITEMS_PER_PAGE;
      const response = await fetch(`${API_BASE_URL}/api/memories?limit=${ITEMS_PER_PAGE}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map((item) => ({
          ...item,
          formattedDate: new Date(item.memory_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
          })
        }));

        setHasMore(data.length >= ITEMS_PER_PAGE);

        if (isRefresh || pageNum === 0) {
          setMemories(formattedData);
          try {
            localStorage.setItem(MEMORIES_CACHE_KEY, JSON.stringify(formattedData));
          } catch {}
        } else {
          setMemories((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = formattedData.filter((m) => !existingIds.has(m.id));
            const merged = [...prev, ...newItems];
            try {
              localStorage.setItem(MEMORIES_CACHE_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }

        if (selectedMemory) {
          const updatedMemory = formattedData.find((m) => m.id === selectedMemory.id);
          if (updatedMemory && updatedMemory.memory_media.length > 0) setSelectedMemory(updatedMemory);
          else setSelectedMemory(null);
        }
      }
    } catch {
      if (memories.length === 0) {
        showDialog({ type: 'alert', title: 'Connection Error', message: 'Failed to fetch memories from the server.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshMemories = () => fetchMemories(0, true);

  useEffect(() => {
    if (isAuthenticated) handleRefreshMemories();
  }, [isAuthenticated]);

  const displayedMemories = useMemo(() => {
    if (!selectedDateFilter) return memories;
    return memories.filter((m) => m.memory_date && m.memory_date.startsWith(selectedDateFilter));
  }, [memories, selectedDateFilter]);

  const memoriesGroupedByYear = useMemo(() => {
    const groups = new Map();
    displayedMemories.forEach((mem) => {
      const yr = mem.memory_date ? mem.memory_date.slice(0, 4) : 'Timeless';
      if (!groups.has(yr)) groups.set(yr, []);
      groups.get(yr).push(mem);
    });
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [displayedMemories]);

  // Edit Album Name Handler
  const handleRenameAlbum = (memory) => {
    showDialog({
      type: 'confirm',
      title: 'Edit Album Name',
      message: 'Enter a new name for this album:',
      showInput: true,
      inputValue: memory.title || '',
      onConfirm: async (newTitle) => {
        const trimmed = (newTitle || '').trim();
        if (!trimmed || trimmed === memory.title) return;
        try {
          const response = await fetch(`${API_BASE_URL}/api/memories/${memory.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: trimmed })
          });
          if (response.ok) {
            setMemories((prev) => {
              const updated = prev.map((m) => (m.id === memory.id ? { ...m, title: trimmed } : m));
              try {
                localStorage.setItem(MEMORIES_CACHE_KEY, JSON.stringify(updated));
              } catch {}
              return updated;
            });
            if (selectedMemory?.id === memory.id) {
              setSelectedMemory((prev) => (prev ? { ...prev, title: trimmed } : null));
            }
          } else {
            const err = await response.json().catch(() => ({}));
            showDialog({ type: 'alert', title: 'Rename Failed', message: err.detail || 'Could not rename album.' });
          }
        } catch {
          showDialog({ type: 'alert', title: 'Error', message: 'Could not connect to backend.' });
        }
      }
    });
  };

  const handleDeleteAlbum = (memory) => {
    showDialog({
      type: 'confirm',
      title: 'Delete Entire Memory',
      message: `Are you sure you want to permanently delete "${memory.title}" and all its photos/videos from cloud storage? This cannot be undone.`,
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/memories/${memory.id}`, { method: 'DELETE' });
          if (response.ok) handleRefreshMemories();
          else {
            const err = await response.json();
            showDialog({ type: 'alert', title: 'Delete Failed', message: err.detail });
          }
        } catch {
          showDialog({ type: 'alert', title: 'Error', message: 'Could not connect to backend.' });
        }
      }
    });
  };

  if (!isAuthenticated) {
    return (
      <>
        <LoginScreen
          onLogin={() => {
            localStorage.setItem('us_auth', 'true');
            setIsAuthenticated(true);
          }}
          showDialog={showDialog}
        />
        <CustomDialog
          {...dialogConfig}
          onCancel={closeDialog}
          onConfirm={() => {
            dialogConfig.onConfirm(dialogConfig.inputValue);
            closeDialog();
          }}
          onInputChange={handleDialogInput}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#fdfcfb] font-sans selection:bg-rose-200 selection:text-rose-900 flex flex-col relative z-0 overflow-x-hidden">
      
      {/* GPU-ACCELERATED GLASSY ORBS */}
      <div
        className="fixed inset-0 z-[-1] pointer-events-none"
        style={{
          background: activeOccasion
            ? 'radial-gradient(circle at 12% 15%, rgba(253, 164, 175, 0.55) 0%, transparent 45%), radial-gradient(circle at 88% 28%, rgba(253, 224, 71, 0.45) 0%, transparent 42%), radial-gradient(circle at 30% 88%, rgba(251, 207, 232, 0.5) 0%, transparent 50%)'
            : 'radial-gradient(circle at 12% 15%, rgba(254, 205, 211, 0.55) 0%, transparent 45%), radial-gradient(circle at 88% 28%, rgba(255, 237, 213, 0.55) 0%, transparent 42%), radial-gradient(circle at 30% 88%, rgba(251, 207, 232, 0.48) 0%, transparent 50%)'
        }}
      />
      <div
        className="fixed inset-0 z-[-1] pointer-events-none"
        style={{
          opacity: 0.35,
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.08) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}
      />

      <Header
        onAddClick={() => setIsAddModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={() => {
          localStorage.removeItem('us_auth');
          setIsAuthenticated(false);
        }}
      />

      {/* Side Floating Dock */}
      {activeTab === 'vault' && (
        <div className="fixed left-4 sm:left-6 bottom-5 sm:bottom-auto sm:top-28 z-40 flex flex-row sm:flex-col items-center gap-3">
          {/* Mobile-Only + Add Memory Button */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            title="Add New Memory"
            className="md:hidden w-11 h-11 rounded-full bg-stone-900 hover:bg-stone-800 text-white shadow-lg flex items-center justify-center border border-white/20 active:scale-95 transition-transform"
          >
            <Icons.Plus />
          </button>

          <VaultCalendar
            memories={memories}
            selectedDate={selectedDateFilter}
            onSelectDate={setSelectedDateFilter}
            onOpenMemory={(mem) => setSelectedMemory(mem)}
          />

          <SpecialOccasionWidget
            occasions={occasions}
            activeOccasion={activeOccasion}
            onAddOccasion={handleAddOccasion}
            onDeleteOccasion={handleDeleteOccasion}
            onSelectOccasion={(occ) => {
              setManualOccasion(occ);
              if (occ) setShowCelebrationBanner(true);
            }}
            onOpenChronicle={() => setActiveTab('chronicle')}
          />
        </div>
      )}

      {/* Active Special Occasion Banner */}
      {activeOccasion && showCelebrationBanner && (
        <div className="max-w-5xl mx-auto w-full px-4 pt-6 z-20 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-gradient-to-r from-rose-500/90 via-pink-500/90 to-amber-500/90 backdrop-blur-xl text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-white/40 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden">
            <div className="flex items-center gap-4">
              <div className="text-4xl animate-bounce">🎉</div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/25 px-2.5 py-0.5 rounded-full">
                  Special Celebration · {activeOccasion.date}
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-bold mt-1">{activeOccasion.title}</h3>
                <p className="text-sm text-white/90">
                  {activeOccasion.notes || 'Today is a special milestone in our story! Check out The Daily Chronicle tribute.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('chronicle')}
                className="bg-white text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-full text-xs font-bold shadow-md transition-all"
              >
                Read Special Chronicle 📰
              </button>
              <button
                onClick={() => {
                  setShowCelebrationBanner(false);
                  setManualOccasion(null);
                }}
                className="p-2 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full relative z-10 flex flex-col min-h-0">
        {activeTab === 'vault' && (
          <div className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8 py-8 sm:py-10 pb-32">
            <div className="text-center mb-10 sm:mb-12 relative z-10">
              {/* Mobile-Only Days Together Pill */}
              <div className="md:hidden inline-flex items-center gap-1.5 bg-white/75 backdrop-blur-md px-3.5 py-1 rounded-full border border-white/80 shadow-sm mb-3">
                <span className="text-rose-500 animate-pulse text-xs">❤️</span>
                <span className="text-xs font-bold text-rose-600 font-sans tracking-wide">
                  {daysTogether} Days Together
                </span>
              </div>

              <h2 className="text-4xl sm:text-5xl font-serif text-stone-800 mb-3 tracking-tight drop-shadow-sm">
                Our Memory Vault
              </h2>
              <p className="text-stone-600 max-w-2xl mx-auto text-base sm:text-lg drop-shadow-sm">
                A secure collection of our favorite days, biggest adventures, and quietest moments.
              </p>

              {selectedDateFilter && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setSelectedDateFilter(null)}
                    className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md transition-all flex items-center gap-2"
                  >
                    <span>
                      {selectedDateFilter.length === 4
                        ? `Showing Year: ${selectedDateFilter}`
                        : `Showing Date: ${selectedDateFilter}`}
                    </span>
                    <span>✕ Clear Filter</span>
                  </button>
                </div>
              )}
            </div>

            {isLoading && memories.length === 0 ? (
              <div className="flex justify-center items-center py-20 relative z-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
              </div>
            ) : displayedMemories.length === 0 ? (
              <div className="text-center py-20 text-stone-500 bg-white/50 backdrop-blur-md rounded-3xl border border-white/60 p-12 shadow-lg max-w-2xl mx-auto relative z-10">
                <span className="text-6xl mb-4 block">📸</span>
                <p className="text-xl font-medium text-stone-700">Your vault is waiting.</p>
              </div>
            ) : (
              <>
                <div className="space-y-16 relative z-10">
                  {memoriesGroupedByYear.map(([yearLabel, yearMemories]) => (
                    <section key={yearLabel} className="w-full">
                      <div className="flex items-center gap-4 mb-8 px-2">
                        <h3 className="text-2xl sm:text-3xl font-serif font-bold text-stone-800 tracking-tight shrink-0">
                          {yearLabel}
                        </h3>
                        <div className="h-[2px] flex-1 bg-gradient-to-r from-stone-400/70 via-stone-300/50 to-transparent rounded-full" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-10 gap-y-12 justify-items-center">
                        {yearMemories.map((memory, idx) => (
                          <MemoryCard
                            key={memory.id}
                            index={idx}
                            memory={memory}
                            onClick={(mem) => setSelectedMemory(mem)}
                            onRenameClick={handleRenameAlbum}
                            onDeleteClick={handleDeleteAlbum}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                {hasMore && !selectedDateFilter && (
                  <div className="flex justify-center mt-14 relative z-10">
                    <button
                      onClick={() => {
                        const nextPage = page + 1;
                        setPage(nextPage);
                        fetchMemories(nextPage, false);
                      }}
                      className="bg-white/70 backdrop-blur-md hover:bg-white text-stone-800 border border-white/60 px-8 py-3 rounded-full font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2"
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
            <ChronicleView
              showDialog={showDialog}
              onOpenMemory={setSelectedMemory}
              activeOccasion={activeOccasion}
            />
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 lg:p-8 flex flex-col h-auto md:h-[calc(100vh-6rem)] gap-6 pb-32 md:pb-8">
            <DatePlanner showDialog={showDialog} />
          </div>
        )}
      </main>

      <AddMemoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onMemoryAdded={handleRefreshMemories}
        showDialog={showDialog}
      />
      <FullPageGallery
        isOpen={!!selectedMemory}
        onClose={() => setSelectedMemory(null)}
        memory={selectedMemory}
        memories={memories}
        onSelectMemory={setSelectedMemory}
        onMemoryUpdated={handleRefreshMemories}
        showDialog={showDialog}
      />
      <CustomDialog
        {...dialogConfig}
        onCancel={closeDialog}
        onConfirm={() => {
          dialogConfig.onConfirm(dialogConfig.inputValue);
          closeDialog();
        }}
        onInputChange={handleDialogInput}
      />
      <PookieWidget memories={memories} onSelectMemory={setSelectedMemory} isGalleryOpen={!!selectedMemory} />
    </div>
  );
}