import React from 'react';

export const CustomDialog = ({ isOpen, title, message, onConfirm, onCancel, isAlert = false, showInput = false, inputValue = '', onInputChange }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={onCancel || onConfirm}></div>
      <div className="relative bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center transform scale-100 animate-in fade-in zoom-in-95 duration-200">
        <h3 className="text-xl font-serif font-bold text-stone-800 mb-2">{title}</h3>
        <p className="text-stone-600 mb-4">{message}</p>
        
        {showInput && (
          <input 
            type="text" 
            autoFocus
            value={inputValue} 
            onChange={(e) => onInputChange(e.target.value)} 
            placeholder="Enter plan name..."
            className="w-full bg-stone-100 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-800 mb-6"
            onKeyDown={(e) => { if (e.key === 'Enter' && inputValue.trim()) onConfirm(); }}
          />
        )}

        <div className="flex justify-center gap-3">
          {!isAlert && (
            <button onClick={onCancel} className="px-5 py-2 rounded-full font-medium text-stone-600 md:hover:bg-stone-100 transition-colors">
              Cancel
            </button>
          )}
          <button onClick={onConfirm} disabled={showInput && !inputValue.trim()} className={`px-6 py-2 rounded-full font-medium transition-all shadow-sm md:hover:shadow-md text-white disabled:opacity-50 ${isAlert ? 'bg-stone-800 md:hover:bg-stone-900' : 'bg-red-500 md:hover:bg-red-600'}`}>
            {isAlert ? 'Okay' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomDialog;