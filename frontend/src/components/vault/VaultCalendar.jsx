import React, { useState, useMemo } from 'react';
import { Icons } from '../common/Icons';

export const VaultCalendar = ({ memories, selectedDate, onSelectDate, onOpenMemory }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Map YYYY-MM-DD -> array of memories on that date
  const memoriesByDate = useMemo(() => {
    const map = {};
    (memories || []).forEach((m) => {
      if (!m.memory_date) return;
      const dateStr = m.memory_date.slice(0, 10);
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(m);
    });
    return map;
  }, [memories]);

  const activeDates = useMemo(() => Object.keys(memoriesByDate).sort().reverse(), [memoriesByDate]);

  // Default calendar view to the most recent memory's month, or current month
  const initialDate = useMemo(() => {
    if (activeDates.length > 0) {
      const [y, m] = activeDates[0].split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  }, [activeDates.length]);

  const [viewDate, setViewDate] = useState(initialDate);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const monthName = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const handleDateClick = (dateStr) => {
    const dayMemories = memoriesByDate[dateStr];
    if (!dayMemories || dayMemories.length === 0) return;

    if (selectedDate === dateStr) {
      onSelectDate(null);
    } else {
      onSelectDate(dateStr);
      // If there's 1 album on that day, open it directly in the gallery viewer as well
      if (dayMemories.length === 1 && onOpenMemory) {
        onOpenMemory(dayMemories[0]);
      }
    }
  };

  return (
    <div className="max-w-xl mx-auto mb-10 relative z-20">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-white/70 backdrop-blur-xl hover:bg-white text-stone-800 border border-white/70 px-5 py-2.5 rounded-full font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2.5 text-sm"
        >
          <span>📅</span>
          <span>{isOpen ? 'Hide Memory Calendar' : 'Jump to Date in Calendar'}</span>
          <span className="text-xs bg-rose-100 text-rose-600 font-bold px-2 py-0.5 rounded-full">
            {activeDates.length} Days
          </span>
        </button>

        {selectedDate && (
          <button
            onClick={() => onSelectDate(null)}
            className="bg-rose-500 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-md hover:bg-rose-600 transition-all flex items-center gap-1.5"
          >
            Showing: {selectedDate} ✕
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-4 bg-white/80 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-white/70 animate-in fade-in slide-in-from-top-3 duration-200">
          {/* Month / Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-stone-200/50 rounded-full transition-colors text-stone-700">
              <Icons.Left />
            </button>
            <h3 className="font-serif font-bold text-lg text-stone-800">{monthName}</h3>
            <button onClick={nextMonth} className="p-2 hover:bg-stone-200/50 rounded-full transition-colors text-stone-700">
              <Icons.Right />
            </button>
          </div>

          {/* Quick Jump Pills for Months with Memories */}
          {activeDates.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-stone-200/60 custom-scrollbar">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 shrink-0 mr-1">Active:</span>
              {Array.from(new Set(activeDates.map(d => d.slice(0, 7)))).slice(0, 8).map(ym => {
                const [y, m] = ym.split('-').map(Number);
                const label = new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' });
                const isCurrent = year === y && month === m - 1;
                return (
                  <button
                    key={ym}
                    onClick={() => setViewDate(new Date(y, m - 1, 1))}
                    className={`text-xs px-2.5 py-1 rounded-full shrink-0 transition-all ${
                      isCurrent ? 'bg-stone-900 text-white font-bold' : 'bg-stone-100 hover:bg-rose-100 text-stone-600'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayMemories = memoriesByDate[dateStr];
              const hasMemory = Boolean(dayMemories && dayMemories.length > 0);
              const isSelected = selectedDate === dateStr;

              return (
                <button
                  key={dateStr}
                  disabled={!hasMemory}
                  onClick={() => handleDateClick(dateStr)}
                  title={hasMemory ? `${dayMemories.map(m => m.title).join(', ')}` : 'No album on this day'}
                  className={`h-10 rounded-xl flex flex-col items-center justify-center relative text-sm transition-all ${
                    !hasMemory
                      ? 'text-stone-300 opacity-40 cursor-not-allowed select-none'
                      : isSelected
                      ? 'bg-rose-600 text-white font-bold shadow-lg scale-105 ring-2 ring-rose-300 cursor-pointer'
                      : 'bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white font-bold shadow-sm border border-rose-200/80 cursor-pointer hover:scale-105'
                  }`}
                >
                  <span>{dayNum}</span>
                  {hasMemory && (
                    <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VaultCalendar;