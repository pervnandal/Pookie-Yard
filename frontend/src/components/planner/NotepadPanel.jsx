import React from 'react';
import { Icons } from '../common/Icons';

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
  onDeleteCurrentPlan
}) => {
  return (
    <div className="flex-1 flex flex-col md:flex-row bg-white/50 backdrop-blur-2xl rounded-[2rem] shadow-xl border border-white/60 h-[600px] md:h-full overflow-hidden">
      {/* Saved Plans Sidebar */}
      <div className="flex flex-col w-full md:w-44 lg:w-52 shrink-0 bg-white/30 border-b md:border-b-0 md:border-r border-white/40 h-[25vh] md:h-full min-h-0 min-w-0">
        <div className="h-[76px] shrink-0 p-5 border-b border-stone-200 flex justify-between items-center bg-white/50">
          <span className="font-bold text-stone-800 font-sans text-xs tracking-widest uppercase">Saved Plans</span>
          <button
            onClick={onCreateNewPlan}
            className="text-rose-500 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors border border-rose-100"
            title="New Plan"
          >
            <Icons.Plus />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {itineraries.length === 0 ? (
            <div className="text-center p-6 text-sm font-sans text-stone-400 opacity-80">
              No plans yet.<br />Click + to start!
            </div>
          ) : (
            itineraries.map((doc) => (
              <div
                key={doc.id}
                className={`w-full rounded-xl flex items-center justify-between p-3 font-sans text-sm transition-all duration-200 cursor-pointer ${
                  activeDocId === doc.id
                    ? 'bg-white shadow-sm border border-stone-200 font-bold text-rose-600 transform scale-[1.02]'
                    : 'hover:bg-stone-50 text-stone-600 border border-transparent'
                }`}
                onClick={() => {
                  setActiveDocId(doc.id);
                  setActiveContent(doc.content || '');
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={activeDocId === doc.id ? "text-rose-500" : "text-stone-400"}>
                    <Icons.FileText />
                  </span>
                  <span className="truncate">{doc.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRenamePlan(doc);
                  }}
                  className="shrink-0 p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-md transition-colors ml-2"
                  title="Rename Plan"
                >
                  <Icons.Edit />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Notepad Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-transparent">
        {activeDocId ? (
          <>
            <div className="h-[76px] shrink-0 bg-white/40 backdrop-blur-sm border-b border-stone-200 p-5 flex items-center justify-between z-10">
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-2xl shrink-0">📝</span>
                <h2 className="font-bold text-stone-800 text-2xl tracking-tight truncate max-w-[200px] sm:max-w-md">
                  {itineraries.find((i) => i.id === activeDocId)?.title}
                </h2>
                {partnerEditing && (
                  <span className="shrink-0 text-xs font-sans text-rose-500 font-medium animate-pulse ml-2 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100 whitespace-nowrap shadow-sm">
                    ✨ Partner is typing...
                  </span>
                )}
              </div>

              <button
                onClick={onDeleteCurrentPlan}
                className="shrink-0 text-stone-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-full transition-colors"
                title="Delete Plan"
              >
                <Icons.Trash />
              </button>
            </div>

            <textarea
              value={activeContent}
              onChange={onItineraryChange}
              className="flex-1 w-full p-6 sm:p-10 resize-none outline-none bg-transparent overflow-y-auto custom-scrollbar text-stone-700 leading-relaxed text-lg sm:text-xl"
              placeholder="Start typing your plans, timeline, and ideas here..."
              style={{
                lineHeight: '2.5rem',
                backgroundImage: 'linear-gradient(transparent, transparent calc(2.5rem - 1px), #e5e5e5 calc(2.5rem - 1px))',
                backgroundSize: '100% 2.5rem'
              }}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400 opacity-60">
            <div className="transform scale-150 mb-4 opacity-50">
              <Icons.FileText />
            </div>
            <p className="font-sans font-medium text-lg text-center px-4">
              Select or create a plan to start typing
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotepadPanel;
