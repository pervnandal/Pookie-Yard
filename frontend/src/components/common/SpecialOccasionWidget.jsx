import React, { useState } from 'react';
import { Icons } from './Icons';

const MONTHS = [
  { num: '01', name: 'January', days: 31 },
  { num: '02', name: 'February', days: 29 },
  { num: '03', name: 'March', days: 31 },
  { num: '04', name: 'April', days: 30 },
  { num: '05', name: 'May', days: 31 },
  { num: '06', name: 'June', days: 30 },
  { num: '07', name: 'July', days: 31 },
  { num: '08', name: 'August', days: 31 },
  { num: '09', name: 'September', days: 30 },
  { num: '10', name: 'October', days: 31 },
  { num: '11', name: 'November', days: 30 },
  { num: '12', name: 'December', days: 31 }
];

const formatMonthDayLabel = (dateOrMmDd) => {
  if (!dateOrMmDd) return '';
  const mmdd = dateOrMmDd.length >= 5 ? dateOrMmDd.slice(-5) : dateOrMmDd;
  const [mStr, dStr] = mmdd.split('-');
  const monthObj = MONTHS.find((m) => m.num === mStr);
  const dayNum = parseInt(dStr, 10);
  if (!monthObj || isNaN(dayNum)) return mmdd;
  return `${monthObj.name} ${dayNum}`;
};

export const SpecialOccasionWidget = ({
  occasions,
  activeOccasion,
  onAddOccasion,
  onDeleteOccasion
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() =>
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [selectedDay, setSelectedDay] = useState(() =>
    String(new Date().getDate()).padStart(2, '0')
  );
  const [notes, setNotes] = useState('');

  const currentMonthObj = MONTHS.find((m) => m.num === selectedMonth) || MONTHS[0];
  const maxDays = currentMonthObj.days;

  const now = new Date();
  const todayMmDd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const safeDay = String(Math.min(parseInt(selectedDay, 10) || 1, maxDays)).padStart(2, '0');
    const mmdd = `${selectedMonth}-${safeDay}`;

    const newOcc = {
      id: `occ_${Date.now()}`,
      title: title.trim(),
      mmdd,
      date: mmdd, // Month & Day only (celebrated every year)
      notes: notes.trim()
    };
    onAddOccasion(newOcc);
    setTitle('');
    setNotes('');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Annual Special Occasions"
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 border relative ${activeOccasion
            ? 'bg-gradient-to-tr from-rose-500 to-amber-500 text-white border-white/70'
            : 'bg-white/80 backdrop-blur-xl hover:bg-white text-stone-800 border-white/80'
          }`}
      >
        <span className="text-lg">🎉</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[115]" onClick={() => setIsOpen(false)} />
          <div className="fixed left-4 right-4 top-20 sm:left-20 sm:right-auto sm:top-24 sm:w-[410px] z-[120] bg-white/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-white/80 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-800">Annual Special Occasions ✨</h3>
                <p className="text-[11px] text-stone-500">
                  Saved by Month & Day. Automatically celebrates every year when that day arrives!
                </p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full">
                <Icons.X />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 bg-stone-50/80 p-3.5 rounded-2xl border border-stone-200/70 mb-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Occasion Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Her Birthday, Our Anniversary"
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                />
              </div>

              {/* Month & Day Selector Only (No Year) */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Month (Every Year)
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:border-rose-400 cursor-pointer"
                  >
                    {MONTHS.map((m) => (
                      <option key={m.num} value={m.num}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Day
                  </label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:border-rose-400 cursor-pointer"
                  >
                    {Array.from({ length: maxDays }).map((_, idx) => {
                      const dVal = String(idx + 1).padStart(2, '0');
                      return (
                        <option key={dVal} value={dVal}>
                          {idx + 1}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                  Story Keywords for AI Context (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Cake cutting, cafe dinner, trip..."
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
              >
                + Save Occasion
              </button>
            </form>

            <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {occasions.length === 0 ? (
                <p className="text-center text-xs text-stone-400 py-3 italic">No annual occasions saved yet.</p>
              ) : (
                occasions.map((occ) => {
                  const occMmDd = (occ.mmdd || occ.date || '').slice(-5);
                  const isToday = occMmDd === todayMmDd;
                  return (
                    <div
                      key={occ.id}
                      className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${isToday ? 'bg-rose-50/90 border-rose-300' : 'bg-white/70 border-stone-200/70'
                        }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-serif font-bold text-xs text-stone-800 truncate flex items-center gap-1.5">
                          <span>🎊 {occ.title}</span>
                          <span className="font-sans font-semibold text-[11px] text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            {formatMonthDayLabel(occMmDd)}
                          </span>
                          {isToday && (
                            <span className="bg-rose-600 text-white text-[10px] font-sans font-bold px-2 py-0.5 rounded-full">
                              Today! ✨
                            </span>
                          )}
                        </div>
                        {occ.notes && <p className="text-[11px] text-stone-500 truncate mt-0.5">{occ.notes}</p>}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteOccasion(occ.id)}
                        className="p-1.5 text-stone-400 hover:text-red-500 rounded-full shrink-0"
                        title="Delete Occasion"
                      >
                        <Icons.Trash />
                      </button>
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