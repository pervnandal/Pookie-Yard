import React, { useState } from 'react';
import { Icons } from '../common/Icons';
import BucketListView from './BucketListView';
import PookieConciergeModal from './PookieConciergeModal';
import SyncedTheaterRoom from './SyncedTheaterRoom';
import MysteryDateAndReceiptModal from './MysteryDateAndReceiptModal';

export const NotepadPanel = ({
  itineraries,
  activeDocId,
  setActiveDocId,
  activeContent,
  setActiveContent,
  partnerEditing,
  onItineraryChange,
  onCreateNewPlan,
  onRenamePlan,
  onDeleteCurrentPlan,
  memories = [],
  onOpenMemory,
  safeSend,
  incomingTheaterEvent
}) => {
  const [plannerTab, setPlannerTab] = useState('notepad'); // 'notepad' | 'bucket' | 'theater'
  const [isConciergeOpen, setIsConciergeOpen] = useState(false);
  const [isMysteryOpen, setIsMysteryOpen] = useState(false);

  const handleApplyConcierge = (generatedText) => {
    const combined = activeContent
      ? `${activeContent.trim()}\n\n${generatedText}`
      : generatedText;
    onItineraryChange({ target: { value: combined } });
  };

  const activePlanTitle = itineraries.find((i) => i.id === activeDocId)?.title || '';

  return (
    <div className="flex-1 flex flex-col bg-white/50 backdrop-blur-2xl rounded-[2rem] shadow-xl border border-white/60 h-[620px] md:h-full overflow-hidden min-w-0">

      {/* TOP UNIFIED MODE BAR (Always visible across Plans, Goals, and Watch) */}
      <div
        className={`h-[64px] shrink-0 px-4 sm:px-6 border-b flex items-center justify-between gap-2 z-20 ${plannerTab === 'theater'
            ? 'bg-stone-950 border-stone-800 text-white'
            : 'bg-white/65 backdrop-blur-md border-stone-200/80 text-stone-800'
          }`}
      >
        {/* 3-Mode Pill Switcher */}
        <div
          className={`inline-grid grid-cols-3 p-1 rounded-2xl border shrink-0 ${plannerTab === 'theater'
              ? 'bg-stone-900 border-stone-800'
              : 'bg-stone-100 border-stone-200/80'
            }`}
        >
          {[
            { id: 'notepad', label: '📝 Plans' },
            { id: 'bucket', label: '🪣 Goals' },
            { id: 'theater', label: '🍿 Watch' }
          ].map((t) => {
            const active = plannerTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPlannerTab(t.id)}
                className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${active
                    ? 'bg-rose-500 text-white shadow-xs'
                    : plannerTab === 'theater'
                      ? 'text-stone-400 hover:text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Context-Aware Right Header Controls */}
        {plannerTab === 'notepad' && (
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {partnerEditing && (
              <span className="hidden lg:inline-block text-xs font-sans text-rose-500 font-medium animate-pulse bg-rose-50 px-3 py-1 rounded-full border border-rose-100 whitespace-nowrap">
                ✨ Partner is typing...
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsMysteryOpen(true)}
              className="bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold px-3 py-2 rounded-full shadow-sm transition-all cursor-pointer shrink-0"
              title="Scratch-Off Mystery Date Cards & Date Night Receipt"
            >
              🪙 <span className="hidden sm:inline">Scratch & Receipt</span>
            </button>

            {activeDocId && (
              <>
                <button
                  type="button"
                  onClick={() => setIsConciergeOpen(true)}
                  className="bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 text-white text-xs font-bold px-3 sm:px-3.5 py-2 rounded-full shadow-sm transition-all cursor-pointer shrink-0"
                >
                  ✨ <span className="hidden sm:inline">Pookie Concierge</span>
                </button>
                <button
                  onClick={onDeleteCurrentPlan}
                  className="text-stone-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors shrink-0 cursor-pointer"
                  title="Delete Plan"
                >
                  <Icons.Trash />
                </button>
              </>
            )}
          </div>
        )}

        {plannerTab === 'bucket' && (
          <span className="hidden sm:inline-block text-xs font-serif italic text-stone-500 truncate">
            5 Category Boxes · Link completed dreams to Vault Albums ✨
          </span>
        )}

        {plannerTab === 'theater' && (
          <span className="hidden sm:inline-block text-xs font-mono text-rose-400 truncate">
            ● Universal Synced Screening Room
          </span>
        )}
      </div>

      {/* MODE 1: SAVED PLANS + LINED NOTEPAD */}
      {plannerTab === 'notepad' && (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 min-w-0 overflow-hidden">
          {/* Left Saved Plans Sidebar */}
          <div className="flex flex-col w-full md:w-48 lg:w-56 shrink-0 bg-white/35 border-b md:border-b-0 md:border-r border-stone-200/70 h-[175px] md:h-full min-h-0 min-w-0">
            <div className="px-4 py-3 border-b border-stone-200/70 flex justify-between items-center bg-white/40">
              <span className="font-bold text-stone-700 font-sans text-[11px] tracking-widest uppercase">
                Saved Plans
              </span>
              <button
                onClick={onCreateNewPlan}
                className="text-rose-500 bg-rose-50 hover:bg-rose-100 p-1.5 rounded-lg transition-colors border border-rose-200/70 cursor-pointer"
                title="New Plan"
              >
                <Icons.Plus />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
              {itineraries.length === 0 ? (
                <div className="text-center p-5 text-xs font-sans text-stone-400">
                  No plans yet.<br />Click + to start!
                </div>
              ) : (
                itineraries.map((doc) => (
                  <div
                    key={doc.id}
                    className={`w-full rounded-xl flex items-center justify-between p-2.5 font-sans text-xs sm:text-sm transition-all cursor-pointer ${activeDocId === doc.id
                        ? 'bg-white shadow-xs border border-stone-200 font-bold text-rose-600'
                        : 'hover:bg-white/60 text-stone-600 border border-transparent'
                      }`}
                    onClick={() => {
                      setActiveDocId(doc.id);
                      setActiveContent(doc.content || '');
                    }}
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className={activeDocId === doc.id ? 'text-rose-500' : 'text-stone-400'}>
                        <Icons.FileText />
                      </span>
                      <span className="truncate">{doc.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRenamePlan(doc);
                      }}
                      className="shrink-0 p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-md transition-colors ml-1"
                      title="Rename Plan"
                    >
                      <Icons.Edit />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Notepad Editor */}
          <div className="flex-1 flex flex-col min-w-0 h-full bg-transparent">
            {activeDocId ? (
              <>
                <div className="px-6 py-3 bg-white/30 border-b border-stone-200/60 flex items-center gap-2">
                  <span className="text-lg">📝</span>
                  <h3 className="font-serif font-bold text-lg text-stone-800 truncate">
                    {activePlanTitle}
                  </h3>
                </div>
                <textarea
                  value={activeContent}
                  onChange={onItineraryChange}
                  className="flex-1 w-full p-6 sm:p-8 resize-none outline-none bg-transparent overflow-y-auto custom-scrollbar text-stone-700 leading-relaxed text-base sm:text-lg"
                  placeholder="Start typing your plans, or click '✨ Pookie Concierge' above to generate a weather-smart itinerary..."
                  style={{
                    lineHeight: '2.5rem',
                    backgroundImage:
                      'linear-gradient(transparent, transparent calc(2.5rem - 1px), #e5e5e5 calc(2.5rem - 1px))',
                    backgroundSize: '100% 2.5rem'
                  }}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-stone-400 opacity-60">
                <Icons.FileText />
                <p className="font-sans font-medium text-sm mt-2 text-center px-4">
                  Select or create a plan on the left to start typing
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: GOALS (Top Fixed Add Bar + 5 Category Boxes Side Panel + Goals List) */}
      {plannerTab === 'bucket' && (
        <BucketListView memories={memories} onOpenMemory={onOpenMemory} />
      )}

      {/* MODE 3: WATCH ROOM (Full-Width Cinema Window, NO Side Panel) */}
      {plannerTab === 'theater' && (
        <SyncedTheaterRoom safeSend={safeSend} incomingTheaterEvent={incomingTheaterEvent} />
      )}

      <PookieConciergeModal
        isOpen={isConciergeOpen}
        onClose={() => setIsConciergeOpen(false)}
        currentContent={activeContent}
        onApplyItinerary={handleApplyConcierge}
      />

      <MysteryDateAndReceiptModal
        isOpen={isMysteryOpen}
        onClose={() => setIsMysteryOpen(false)}
        activePlanTitle={activePlanTitle}
        activePlanContent={activeContent}
      />
    </div>
  );
};

export default NotepadPanel;