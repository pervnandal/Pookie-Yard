import React, { useState, useMemo } from 'react';
import { Icons } from '../common/Icons';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const VaultCalendar = ({ memories, selectedDate, onSelectDate, onOpenMemory }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showYearGrid, setShowYearGrid] = useState(false);
  const [customYearInput, setCustomYearInput] = useState('');

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

  const yearsWithAlbumsSet = useMemo(() => {
    const set = new Set();
    activeDates.forEach((d) => {
      const y = d.slice(0, 4);
      if (y) set.add(y);
    });
    return set;
  }, [activeDates]);

  const yearsWithAlbums = useMemo(
    () => Array.from(yearsWithAlbumsSet).sort((a, b) => b.localeCompare(a)),
    [yearsWithAlbumsSet]
  );

  const initialDate = useMemo(() => {
    if (activeDates.length > 0) {
      const [y, m] = activeDates[0].split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  }, [activeDates.length]);

  const [viewDate, setViewDate] = useState(initialDate);
  const [yearPageStart, setYearPageStart] = useState(() => initialDate.getFullYear() - 7);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevYear = () => setViewDate(new Date(year - 1, month, 1));
  const nextYear = () => setViewDate(new Date(year + 1, month, 1));

  const handleDateClick = (dateStr) => {
    const dayMemories = memoriesByDate[dateStr];
    if (!dayMemories || dayMemories.length === 0) return;

    if (selectedDate === dateStr) {
      onSelectDate(null);
    } else {
      onSelectDate(dateStr);
      setIsOpen(false);
      if (dayMemories.length === 1 && onOpenMemory) {
        onOpenMemory(dayMemories[0], 0);
      }
    }
  };

  const handleSelectYearOnly = (yrStr) => {
    if (selectedDate === yrStr) {
      onSelectDate(null);
    } else {
      onSelectDate(yrStr);
      setViewDate(new Date(Number(yrStr), month, 1));
      setIsOpen(false);
    }
  };

  const handleCustomYearSubmit = (e) => {
    e.preventDefault();
    const parsed = parseInt(customYearInput, 10);
    if (!isNaN(parsed) && parsed >= 1000 && parsed <= 9999) {
      setViewDate(new Date(parsed, month, 1));
      setYearPageStart(parsed - 7);
      setShowYearGrid(false);
      setCustomYearInput('');
    }
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Simple Round Icon Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Search by Year or Date in Calendar"
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 border relative ${
          selectedDate
            ? 'bg-rose-500 text-white border-rose-300'
            : 'bg-white/80 backdrop-blur-xl hover:bg-white text-stone-800 border-white/80'
        }`}
      >
        <span className="text-lg">📅</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[115]" onClick={() => setIsOpen(false)} />
          <div className="fixed left-4 right-4 top-20 sm:left-20 sm:right-auto sm:top-24 sm:w-[395px] z-[120] bg-white/95 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl border border-white/80 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Filter Entire Vault by Year Only */}
            <div className="mb-4 pb-3 border-b border-stone-200/70">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Filter Vault by Year Only
                </span>
                {selectedDate && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate(null);
                      setIsOpen(false);
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:underline"
                  >
                    Show All Years ✕
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    onSelectDate(null);
                    setIsOpen(false);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full shrink-0 font-bold transition-all ${
                    !selectedDate
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                  }`}
                >
                  All Years
                </button>

                {yearsWithAlbums.map((yrStr) => {
                  const isYearSelected = selectedDate === yrStr;
                  return (
                    <button
                      key={yrStr}
                      type="button"
                      onClick={() => handleSelectYearOnly(yrStr)}
                      className={`text-xs px-3.5 py-1.5 rounded-full shrink-0 font-bold transition-all ${
                        isYearSelected
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200/80'
                      }`}
                    >
                      {yrStr}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Header: Month Dropdown + Infinite 100-Year Picker Toggle */}
            <div className="flex items-center justify-between gap-1 mb-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevYear}
                  title="Previous Year"
                  className="px-2 py-1 hover:bg-stone-200/60 rounded-lg text-stone-600 font-bold text-xs"
                >
                  « Yr
                </button>
                <button
                  type="button"
                  onClick={prevMonth}
                  title="Previous Month"
                  className="p-1.5 hover:bg-stone-200/60 rounded-full text-stone-700"
                >
                  <Icons.Left />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={month}
                  onChange={(e) => {
                    setViewDate(new Date(year, Number(e.target.value), 1));
                    setShowYearGrid(false);
                  }}
                  className="bg-white border border-stone-200 rounded-xl px-2.5 py-1 font-serif font-bold text-xs sm:text-sm text-stone-800 focus:outline-none focus:border-rose-400 cursor-pointer"
                >
                  {MONTHS.map((mName, idx) => (
                    <option key={mName} value={idx}>{mName}</option>
                  ))}
                </select>

                {/* Tapping Year opens the Infinite / 100+ Year Grid */}
                <button
                  type="button"
                  onClick={() => {
                    setYearPageStart(year - 7);
                    setShowYearGrid((prev) => !prev);
                  }}
                  className={`px-3 py-1 rounded-xl font-serif font-bold text-xs sm:text-sm border transition-all flex items-center gap-1 ${
                    showYearGrid
                      ? 'bg-rose-500 text-white border-rose-500'
                      : 'bg-white border-stone-200 text-rose-600 hover:border-rose-400'
                  }`}
                  title="Click to browse any year (100+ years)"
                >
                  <span>{year}</span>
                  <span className="text-[10px]">{showYearGrid ? '▲' : '▼'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={nextMonth}
                  title="Next Month"
                  className="p-1.5 hover:bg-stone-200/60 rounded-full text-stone-700"
                >
                  <Icons.Right />
                </button>
                <button
                  type="button"
                  onClick={nextYear}
                  title="Next Year"
                  className="px-2 py-1 hover:bg-stone-200/60 rounded-lg text-stone-600 font-bold text-xs"
                >
                  Yr »
                </button>
              </div>
            </div>

            {/* INFINITE / 100-YEAR GRID VIEW */}
            {showYearGrid ? (
              <div className="bg-stone-50/90 border border-stone-200/80 rounded-2xl p-3 mb-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-2.5">
                  <button
                    type="button"
                    onClick={() => setYearPageStart((p) => p - 16)}
                    className="px-2.5 py-1 bg-white hover:bg-stone-100 rounded-lg border border-stone-200 text-xs font-bold text-stone-700"
                  >
                    « -16 Yrs
                  </button>
                  <span className="text-xs font-bold text-stone-600 font-mono">
                    {yearPageStart} – {yearPageStart + 15}
                  </span>
                  <button
                    type="button"
                    onClick={() => setYearPageStart((p) => p + 16)}
                    className="px-2.5 py-1 bg-white hover:bg-stone-100 rounded-lg border border-stone-200 text-xs font-bold text-stone-700"
                  >
                    +16 Yrs »
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const yVal = yearPageStart + i;
                    const yStr = String(yVal);
                    const hasAlbums = yearsWithAlbumsSet.has(yStr);
                    const isCurrent = yVal === year;

                    return (
                      <button
                        key={yVal}
                        type="button"
                        onClick={() => {
                          setViewDate(new Date(yVal, month, 1));
                          setShowYearGrid(false);
                        }}
                        className={`py-2 rounded-xl text-xs font-bold relative flex flex-col items-center justify-center transition-all ${
                          isCurrent
                            ? 'bg-rose-600 text-white shadow-sm'
                            : hasAlbums
                            ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-500 hover:text-white'
                            : 'bg-white text-stone-700 hover:bg-stone-200/70 border border-stone-200/60'
                        }`}
                      >
                        <span>{yVal}</span>
                        {hasAlbums && (
                          <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isCurrent ? 'bg-white' : 'bg-rose-500'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Type Any Year Directly (Infinite Range) */}
                <form onSubmit={handleCustomYearSubmit} className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1000"
                    max="9999"
                    value={customYearInput}
                    onChange={(e) => setCustomYearInput(e.target.value)}
                    placeholder="Type any year (e.g. 1998 or 2075)..."
                    className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-rose-400"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-stone-800"
                  >
                    Go
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* Quick Button to View All Albums of the Currently Viewed Year */}
                <div className="mb-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleSelectYearOnly(String(year))}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedDate === String(year)
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-stone-50 hover:bg-rose-50 text-stone-700 hover:text-rose-600 border-stone-200/80'
                    }`}
                  >
                    {selectedDate === String(year)
                      ? `✓ Showing All Albums from ${year}`
                      : `Filter Vault: Show All ${year} Albums Only`}
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-9" />
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
                        type="button"
                        disabled={!hasMemory}
                        onClick={() => handleDateClick(dateStr)}
                        title={hasMemory ? dayMemories.map((m) => m.title).join(', ') : 'No album on this day'}
                        className={`h-9 rounded-xl flex flex-col items-center justify-center relative text-xs transition-all ${
                          !hasMemory
                            ? 'text-stone-300 opacity-40 cursor-not-allowed select-none'
                            : isSelected
                            ? 'bg-rose-600 text-white font-bold shadow-md scale-105 cursor-pointer'
                            : 'bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white font-bold border border-rose-200/80 cursor-pointer hover:scale-105'
                        }`}
                      >
                        <span>{dayNum}</span>
                        {hasMemory && (
                          <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-rose-500'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VaultCalendar;