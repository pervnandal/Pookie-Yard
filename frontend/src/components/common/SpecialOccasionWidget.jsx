import React, { useState } from 'react';
import { Icons } from './Icons';

export const SpecialOccasionWidget = ({
  occasions,
  activeOccasion,
  onAddOccasion,
  onDeleteOccasion,
  onSelectOccasion,
  onOpenChronicle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const newOcc = {
      id: `occ_${Date.now()}`,
      title: title.trim(),
      date,
      notes: notes.trim()
    };
    onAddOccasion(newOcc);
    setTitle('');
    setNotes('');
  };

  return (
    <div className="relative">
      {/* Simple Round Icon Button (No Number Badge) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Set / Manage Special Occasions"
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 border relative ${
          activeOccasion
            ? 'bg-gradient-to-tr from-rose-500 to-amber-500 text-white border-white/70'
            : 'bg-white/80 backdrop-blur-xl hover:bg-white text-stone-800 border-white/80'
        }`}
      >
        <span className="text-lg">🎉</span>
      </button>

      {/* Popover Modal */}
      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[115]" onClick={() => setIsOpen(false)} />
          <div className="fixed left-4 right-4 top-20 sm:left-20 sm:right-auto sm:top-24 sm:w-[420px] z-[120] bg-white/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-white/80 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-800">Special Occasions ✨</h3>
                <p className="text-[11px] text-stone-500">
                  AI matches albums by both date and story context.
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full">
                <Icons.X />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/70 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Occasion Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Her Birthday"
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Story Keywords (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Cake cutting, trip, dinner..."
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm transition-all"
              >
                + Save & Celebrate
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {occasions.length === 0 ? (
                <p className="text-center text-xs text-stone-400 py-3 italic">No custom occasions saved yet.</p>
              ) : (
                occasions.map((occ) => {
                  const isSelected = activeOccasion?.id === occ.id;
                  return (
                    <div
                      key={occ.id}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                        isSelected ? 'bg-rose-50/90 border-rose-300' : 'bg-white/70 border-stone-200/70'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-serif font-bold text-xs text-stone-800 truncate">
                          🎊 {occ.title} <span className="font-sans font-normal text-stone-400">({occ.date})</span>
                        </div>
                        {occ.notes && <p className="text-[11px] text-stone-500 truncate">{occ.notes}</p>}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onSelectOccasion(isSelected ? null : occ)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                            isSelected ? 'bg-rose-600 text-white' : 'bg-stone-100 hover:bg-rose-100 text-stone-700'
                          }`}
                        >
                          {isSelected ? 'Active ✨' : 'Celebrate'}
                        </button>
                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onOpenChronicle();
                            }}
                            className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-white"
                          >
                            📰
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteOccasion(occ.id)}
                          className="p-1 text-stone-400 hover:text-red-500 rounded-full"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SpecialOccasionWidget;