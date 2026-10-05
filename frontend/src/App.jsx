import React, { useState, useEffect } from 'react';

import { API_BASE_URL } from './utils/apiUtils';
import { Icons } from './components/common/Icons';
import Header from './components/common/Header';
import CustomDialog from './components/common/CustomDialog';
import LoginScreen from './components/auth/LoginScreen';
import MemoryCard from './components/vault/MemoryCard';
import FullPageGallery from './components/vault/FullPageGallery';
import AddMemoryModal from './components/vault/AddMemoryModal';
import ChronicleView from './components/chronicle/ChronicleView';
import DatePlanner from './components/planner/DatePlanner';
import PookieWidget from './components/ai/PookieWidget';

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
      <div className="fixed top-[-10%] left-[-10%] rounded-full mix-blend-multiply opacity-60 z-[-1] pointer-events-none" style={{ backgroundColor: '#fecdd3', width: '500px', height: '500px', filter: 'blur(100px)' }}></div>
      <div className="fixed top-[20%] right-[-10%] rounded-full mix-blend-multiply opacity-60 z-[-1] pointer-events-none" style={{ backgroundColor: '#ffedd5', width: '400px', height: '400px', filter: 'blur(100px)' }}></div>
      <div className="fixed bottom-[-10%] left-[20%] rounded-full mix-blend-multiply opacity-50 z-[-1] pointer-events-none" style={{ backgroundColor: '#fbcfe8', width: '600px', height: '600px', filter: 'blur(120px)' }}></div>
      <div className="fixed inset-0 z-[-1] pointer-events-none" style={{ opacity: 0.4, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(0,0,0,0.08) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>

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
                      className="bg-white md:hover:bg-stone-50 text-stone-800 border border-stone-200 px-8 py-3 rounded-full font-medium transition-all shadow-sm md:hover:shadow-md flex items-center gap-2"
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

        {activeTab === 'planner' && (
           <div className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 lg:p-8 flex flex-col h-auto md:h-[calc(100vh-6rem)] gap-6 pb-32 md:pb-8">
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