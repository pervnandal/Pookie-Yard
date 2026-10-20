import React, { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from './utils/apiUtils';
import { parseMediaUrl, preloadAndCacheMedia } from './utils/mediaParser';
import { extractVaultMeta, serializeVaultDescription, saveLocalAlbumMeta } from './utils/vaultMetaUtils';
import { registerPwaAndServiceWorker } from './utils/pwaPushUtils';
import { Icons } from './components/common/Icons';
import Header from './components/common/Header';
import CustomDialog from './components/common/CustomDialog';
import SpecialOccasionWidget from './components/common/SpecialOccasionWidget';
import ThemeMoodSwitcher, { THEME_MOODS } from './components/common/ThemeMoodSwitcher';
import LoginScreen from './components/auth/LoginScreen';
import VaultView from './components/vault/VaultView';
import VaultCalendar from './components/vault/VaultCalendar';
import FullPageGallery from './components/vault/FullPageGallery';
import AddMemoryModal from './components/vault/AddMemoryModal';
import MemoryMapModal from './components/vault/MemoryMapModal';
import ChronicleView from './components/chronicle/ChronicleView';
import DatePlanner from './components/planner/DatePlanner';
import PookieWidget from './components/ai/PookieWidget';
import PocketLocketQuickDrop from './components/widget/PocketLocketQuickDrop';
import DualCitySkyBar from './components/ldr/DualCitySkyBar';
import MeetupBoardingPass from './components/ldr/MeetupBoardingPass';
import OpenWhenEnvelopes from './components/ldr/OpenWhenEnvelopes';
import TouchAcrossMilesBtn from './components/ldr/TouchAcrossMilesBtn';
import CoupleConnectionHub from './components/ldr/CoupleConnectionHub';

const MEMORIES_CACHE_KEY = 'us_memories_cache_v1';
const ANNIVERSARY_DATE = '2026-05-04';
const ART_PRESETS_CYCLE = ['aurora', 'dusk', 'ember', 'glacier', 'verdant'];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('us_auth') === 'true');
  const [activeTab, setActiveTab] = useState('vault');
  const [vaultCategory, setVaultCategory] = useState('timeline');
  const [isPrivateUnlocked, setIsPrivateUnlocked] = useState(false);

  // Phase 4: Ambient Theme Switcher ('rose' | 'golden' | 'midnight')
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem('us_theme_mood_v1') || 'rose');
  const activeTheme = THEME_MOODS[themeKey] || THEME_MOODS.rose;

  // Phase 4: Partner Mood & Craving State
  const [moods, setMoods] = useState(() => {
    try {
      const saved = localStorage.getItem('us_phase4_moods_v1');
      return saved ? JSON.parse(saved) : { hisMood: '🥺 Missing you', herMood: '🧋 Craving boba' };
    } catch {
      return { hisMood: '🥺 Missing you', herMood: '🧋 Craving boba' };
    }
  });

  // Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMemoryMapOpen, setIsMemoryMapOpen] = useState(false);
  const [isConnectionHubOpen, setIsConnectionHubOpen] = useState(false);
  const [isBoardingPassOpen, setIsBoardingPassOpen] = useState(false);
  const [isEnvelopesOpen, setIsEnvelopesOpen] = useState(false);
  const [isLocketOpen, setIsLocketOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('widget') === 'drop';
  });

  const [ldrStatus, setLdrStatus] = useState(null);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);

  const [memories, setMemories] = useState(() => {
    try {
      const cached = localStorage.getItem(MEMORIES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [selectedDateFilter, setSelectedDateFilter] = useState(null);
  const [isLoading, setIsLoading] = useState(() => !localStorage.getItem(MEMORIES_CACHE_KEY));
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
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    document.title = 'The Us Space';
    registerPwaAndServiceWorker();
  }, []);

  const handleThemeChange = (nextKey) => {
    setThemeKey(nextKey);
    localStorage.setItem('us_theme_mood_v1', nextKey);
  };

  const handleUpdateMoods = (nextMoods) => {
    setMoods(nextMoods);
    localStorage.setItem('us_phase4_moods_v1', JSON.stringify(nextMoods));
  };

  const fetchLdrStatus = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ldr/status`);
      if (res.ok) {
        const data = await res.json();
        setLdrStatus(data);
      }
    } catch { }
  };

  useEffect(() => {
    if (isAuthenticated) fetchLdrStatus();
  }, [isAuthenticated]);

  const daysTogether = useMemo(() => {
    const start = new Date(ANNIVERSARY_DATE);
    const today = new Date();
    return Math.ceil(Math.abs(today - start) / (1000 * 60 * 60 * 24));
  }, []);

  const showDialog = (config) => setDialogConfig({ ...config, isOpen: true });
  const closeDialog = () => setDialogConfig((prev) => ({ ...prev, isOpen: false }));
  const handleDialogInput = (val) => setDialogConfig((prev) => ({ ...prev, inputValue: val }));

  const handleOpenMemory = (mem, mediaIdx = 0) => {
    if (!mem) return;
    const { meta } = extractVaultMeta(mem);
    if (meta.unlockDate && new Date(meta.unlockDate) > new Date()) {
      showDialog({
        type: 'alert',
        title: '⏳ Time Capsule Locked',
        message: `This Time Capsule album is sealed until ${meta.unlockDate}! Neither partner can peek inside until that day arrives 💖`
      });
      return;
    }
    setSelectedMediaIndex(typeof mediaIdx === 'number' && mediaIdx >= 0 ? mediaIdx : 0);
    setSelectedMemory(mem);
  };

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
    return occasions.find((o) => o.date && o.date.slice(5, 10) === todayMmDd) || null;
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
          } catch { }
        } else {
          setMemories((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const merged = [...prev, ...formattedData.filter((m) => !existingIds.has(m.id))];
            try {
              localStorage.setItem(MEMORIES_CACHE_KEY, JSON.stringify(merged));
            } catch { }
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

  const updateAlbumMeta = async (memory, metaPatch, extraColumns = {}) => {
    const { cleanDescription, meta } = extractVaultMeta(memory);
    const nextMeta = { ...meta, ...metaPatch };
    saveLocalAlbumMeta(memory.id, nextMeta);
    const serializedDesc = serializeVaultDescription(cleanDescription, nextMeta);

    setMemories((prev) =>
      prev.map((m) => (m.id === memory.id ? { ...m, description: serializedDesc, ...extraColumns } : m))
    );

    try {
      await fetch(`${API_BASE_URL}/api/memories/${memory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: serializedDesc, ...extraColumns })
      });
      handleRefreshMemories();
    } catch { }
  };

  const handleToggleConstant = (memory) => {
    const { meta } = extractVaultMeta(memory);
    updateAlbumMeta(memory, { isConstant: !meta.isConstant, isPrivate: false }, { is_private: false });
  };

  const handleTogglePrivate = (memory) => {
    const { meta } = extractVaultMeta(memory);
    const nextPriv = !meta.isPrivate;
    updateAlbumMeta(memory, { isPrivate: nextPriv, isConstant: false }, { is_private: nextPriv });
  };

  const handleCycleTheme = (memory) => {
    const { meta } = extractVaultMeta(memory);
    const currIdx = ART_PRESETS_CYCLE.indexOf(meta.artPreset || 'aurora');
    const nextArt = ART_PRESETS_CYCLE[(currIdx + 1) % ART_PRESETS_CYCLE.length];
    const nextTone = nextArt === 'ember' && meta.tone === 'light' ? 'dark' : 'light';
    updateAlbumMeta(memory, { artPreset: nextArt, tone: nextTone });
  };

  const handleSetTimeCapsule = (memory) => {
    const { meta } = extractVaultMeta(memory);
    showDialog({
      type: 'confirm',
      title: '⏳ Lock as Time Capsule Album',
      message: 'Enter a future unlock date (YYYY-MM-DD), e.g., 2027-05-04 (leave blank to unlock now):',
      showInput: true,
      inputValue: meta.unlockDate || '2027-05-04',
      onConfirm: (dateVal) => {
        const cleaned = (dateVal || '').trim();
        updateAlbumMeta(memory, { unlockDate: cleaned || null });
      }
    });
  };

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
            setMemories((prev) => prev.map((m) => (m.id === memory.id ? { ...m, title: trimmed } : m)));
          }
        } catch { }
      }
    });
  };

  const handleDeleteAlbum = (memory) => {
    showDialog({
      type: 'confirm',
      title: 'Delete Entire Memory',
      message: `Permanently delete "${memory.title}" and all its photos/videos from cloud storage?`,
      onConfirm: async () => {
        const response = await fetch(`${API_BASE_URL}/api/memories/${memory.id}`, { method: 'DELETE' });
        if (response.ok) handleRefreshMemories();
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
            dialogConfig.onConfirm?.(dialogConfig.inputValue);
            closeDialog();
          }}
          onInputChange={handleDialogInput}
        />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen w-full ${activeTheme.bgClass} font-sans selection:bg-rose-200 selection:text-rose-900 flex flex-col relative z-0 overflow-x-hidden transition-colors duration-500`}
    >
      {/* Dynamic Ambient Orbs */}
      <div
        className="fixed inset-0 z-[-1] pointer-events-none transition-all duration-700"
        style={{ background: activeTheme.orbs }}
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

      {/* Phase 3 & 4: Dual-City Sky Bar + Live Partner Mood Pill */}
      {activeTab === 'vault' && (
        <>
          <DualCitySkyBar
            sky={ldrStatus?.sky}
            onOpenBoardingPass={() => setIsBoardingPassOpen(true)}
            onOpenEnvelopes={() => setIsEnvelopesOpen(true)}
            onConfigUpdated={(updated) => setLdrStatus(updated)}
          />

          <div className="max-w-4xl mx-auto w-full px-4 pt-2 flex justify-center z-20">
            <button
              type="button"
              onClick={() => setIsConnectionHubOpen(true)}
              className="bg-white/75 hover:bg-white backdrop-blur-xl border border-white/80 rounded-full px-4 py-1 text-[11px] font-bold text-stone-700 shadow-xs flex items-center gap-2 cursor-pointer transition-all"
            >
              <span>🤵 {moods.hisMood}</span>
              <span className="text-stone-300">•</span>
              <span>👰 {moods.herMood}</span>
              <span className="text-rose-500 ml-1">🔐 Daily Question & Corkboard →</span>
            </button>
          </div>
        </>
      )}

      {/* Side Floating Dock */}
      {activeTab === 'vault' && (
        <div className="fixed left-4 sm:left-6 bottom-5 sm:bottom-auto sm:top-28 z-40 flex flex-row sm:flex-col items-center gap-2.5">
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
            onSelectDate={(dateVal) => {
              setSelectedDateFilter(dateVal);
              if (dateVal) setVaultCategory('timeline');
            }}
            onOpenMemory={(mem, idx) => handleOpenMemory(mem, idx)}
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

          {/* Phase 2: Pocket Locket Home Screen Widget */}
          <button
            type="button"
            onClick={() => setIsLocketOpen(true)}
            title="Pookie's Pocket Locket (Phone Home Screen Widget)"
            className="w-11 h-11 rounded-full bg-white/85 backdrop-blur-xl hover:bg-rose-50 text-stone-800 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 border border-white/80 flex items-center justify-center cursor-pointer"
          >
            <span className="text-lg">📱</span>
          </button>

          {/* Phase 4: Interactive "Where We've Been" Memory Map */}
          <button
            type="button"
            onClick={() => setIsMemoryMapOpen(true)}
            title="Where We've Been · Memory Map"
            className="w-11 h-11 rounded-full bg-white/85 backdrop-blur-xl hover:bg-rose-50 text-stone-800 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 border border-white/80 flex items-center justify-center cursor-pointer"
          >
            <span className="text-lg">🗺️</span>
          </button>

          {/* Phase 3: Touch Across the Miles (Live Hug Button) */}
          <TouchAcrossMilesBtn />

          {/* Phase 4: Custom Ambient Theme Switcher */}
          <ThemeMoodSwitcher themeKey={themeKey} onChangeTheme={handleThemeChange} />
        </div>
      )}

      {activeOccasion && showCelebrationBanner && (
        <div className="max-w-5xl mx-auto w-full px-4 pt-6 z-20 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-gradient-to-r from-rose-500/90 via-pink-500/90 to-amber-500/90 backdrop-blur-xl text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-white/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl animate-bounce">🎉</div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-white/25 px-2.5 py-0.5 rounded-full">
                  Special Celebration · {activeOccasion.date}
                </span>
                <h3 className="text-xl sm:text-2xl font-serif font-bold mt-1">{activeOccasion.title}</h3>
                <p className="text-sm text-white/90">
                  {activeOccasion.notes || 'Today is a special milestone in our story!'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('chronicle')}
                className="bg-white text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-full text-xs font-bold shadow-md"
              >
                Read Special Chronicle 📰
              </button>
              <button
                onClick={() => {
                  setShowCelebrationBanner(false);
                  setManualOccasion(null);
                }}
                className="p-2 hover:bg-white/20 rounded-full text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full relative z-10 flex flex-col min-h-0">
        {activeTab === 'vault' && (
          <VaultView
            memories={memories}
            isLoading={isLoading}
            vaultCategory={vaultCategory}
            setVaultCategory={setVaultCategory}
            isPrivateUnlocked={isPrivateUnlocked}
            setIsPrivateUnlocked={setIsPrivateUnlocked}
            selectedDateFilter={selectedDateFilter}
            setSelectedDateFilter={setSelectedDateFilter}
            daysTogether={daysTogether}
            hasMore={hasMore}
            onLoadMore={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchMemories(nextPage, false);
            }}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenMemory={handleOpenMemory}
            onRenameAlbum={handleRenameAlbum}
            onToggleConstant={handleToggleConstant}
            onTogglePrivate={handleTogglePrivate}
            onCycleTheme={handleCycleTheme}
            onSetTimeCapsule={handleSetTimeCapsule}
            onDeleteAlbum={handleDeleteAlbum}
            showDialog={showDialog}
          />
        )}

        {activeTab === 'chronicle' && (
          <div className="flex-1 max-w-6xl mx-auto w-full p-4 sm:p-6 lg:p-8 py-12 pb-32">
            <ChronicleView
              showDialog={showDialog}
              onOpenMemory={(mem, exactIdx) => handleOpenMemory(mem, exactIdx)}
              activeOccasion={activeOccasion}
              memories={memories}
            />
          </div>
        )}

        {activeTab === 'planner' && (
          <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 lg:p-8 flex flex-col h-auto md:h-[calc(100vh-6rem)] gap-6 pb-32 md:pb-8">
            <DatePlanner
              showDialog={showDialog}
              memories={memories}
              onOpenMemory={(mem, idx) => handleOpenMemory(mem, idx)}
            />
          </div>
        )}
      </main>

      <AddMemoryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onMemoryAdded={handleRefreshMemories}
        showDialog={showDialog}
        defaultCategory={vaultCategory}
      />
      <PocketLocketQuickDrop
        isOpen={isLocketOpen}
        onClose={() => setIsLocketOpen(false)}
        onSavedToVault={() => {
          handleRefreshMemories();
          setVaultCategory('constant');
        }}
        showDialog={showDialog}
      />
      <MemoryMapModal
        isOpen={isMemoryMapOpen}
        onClose={() => setIsMemoryMapOpen(false)}
        memories={memories}
        onOpenMemory={handleOpenMemory}
        onMemoryUpdated={handleRefreshMemories}
      />
      <CoupleConnectionHub
        isOpen={isConnectionHubOpen}
        onClose={() => setIsConnectionHubOpen(false)}
        moods={moods}
        onUpdateMoods={handleUpdateMoods}
      />
      <MeetupBoardingPass
        isOpen={isBoardingPassOpen}
        onClose={() => setIsBoardingPassOpen(false)}
        meetup={ldrStatus?.meetup}
        sky={ldrStatus?.sky}
        onConfigUpdated={(updated) => setLdrStatus(updated)}
      />
      <OpenWhenEnvelopes
        isOpen={isEnvelopesOpen}
        onClose={() => setIsEnvelopesOpen(false)}
        envelopes={ldrStatus?.envelopes || []}
        onUpdated={fetchLdrStatus}
        showDialog={showDialog}
      />
      <FullPageGallery
        isOpen={!!selectedMemory}
        onClose={() => setSelectedMemory(null)}
        memory={selectedMemory}
        initialIndex={selectedMediaIndex}
        memories={memories}
        onSelectMemory={(mem, idx) => handleOpenMemory(mem, idx)}
        onMemoryUpdated={handleRefreshMemories}
        showDialog={showDialog}
      />
      <CustomDialog
        {...dialogConfig}
        onCancel={closeDialog}
        onConfirm={() => {
          dialogConfig.onConfirm?.(dialogConfig.inputValue);
          closeDialog();
        }}
        onInputChange={handleDialogInput}
      />
      <PookieWidget
        memories={memories}
        onSelectMemory={(mem) => handleOpenMemory(mem, 0)}
        isGalleryOpen={!!selectedMemory}
      />
    </div>
  );
}