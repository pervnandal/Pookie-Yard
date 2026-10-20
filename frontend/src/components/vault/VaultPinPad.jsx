import React, { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';

const PIN_STORAGE_KEY = 'us_private_vault_pin_v1';
const DEFAULT_PIN = '0504'; // Default: Anniversary MMDD (May 4)

export const VaultPinPad = ({ onUnlock, showDialog }) => {
    const [enteredPin, setEnteredPin] = useState('');
    const [errorShake, setErrorShake] = useState(false);
    const [isChangingPin, setIsChangingPin] = useState(false);
    const [newPinInput, setNewPinInput] = useState('');

    const savedPin = localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;

    useEffect(() => {
        if (enteredPin.length === 4) {
            if (enteredPin === savedPin) {
                onUnlock();
            } else {
                setErrorShake(true);
                if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
                setTimeout(() => {
                    setEnteredPin('');
                    setErrorShake(false);
                }, 450);
            }
        }
    }, [enteredPin, savedPin, onUnlock]);

    // Support physical keyboard typing on laptop
    useEffect(() => {
        if (isChangingPin) return;
        const handleKey = (e) => {
            if (/^[0-9]$/.test(e.key)) {
                setEnteredPin((prev) => (prev.length < 4 ? prev + e.key : prev));
            } else if (e.key === 'Backspace') {
                setEnteredPin((prev) => prev.slice(0, -1));
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isChangingPin]);

    const handleDigitPress = (digit) => {
        if (enteredPin.length < 4) {
            setEnteredPin((prev) => prev + String(digit));
        }
    };

    const handleSaveNewPin = (e) => {
        e.preventDefault();
        if (!/^\d{4}$/.test(newPinInput)) {
            showDialog({
                type: 'alert',
                title: 'Invalid PIN',
                message: 'Please enter a 4-digit numeric PIN.'
            });
            return;
        }
        localStorage.setItem(PIN_STORAGE_KEY, newPinInput);
        setIsChangingPin(false);
        setNewPinInput('');
        onUnlock();
    };

    return (
        <div className="max-w-sm mx-auto my-8 bg-white/75 backdrop-blur-2xl rounded-[2.25rem] p-8 shadow-2xl border border-white/80 text-center relative z-10 animate-in fade-in zoom-in-95 duration-200 select-none">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-500/10 border border-rose-200 flex items-center justify-center text-rose-500 shadow-inner">
                <Icons.Lock />
            </div>

            <h3 className="text-2xl font-serif font-bold text-stone-800">Private Sanctuary</h3>
            <p className="text-xs text-stone-500 mt-1 mb-6">
                {isChangingPin
                    ? 'Enter a new 4-digit secret PIN for Private Albums'
                    : 'Enter your 4-digit PIN to view hidden memories'}
            </p>

            {isChangingPin ? (
                <form onSubmit={handleSaveNewPin} className="space-y-4">
                    <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder="••••"
                        autoFocus
                        className="w-40 mx-auto block text-center text-2xl tracking-[0.5em] bg-white border border-stone-200 rounded-2xl py-3 focus:outline-none focus:border-rose-400"
                    />
                    <div className="flex justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsChangingPin(false)}
                            className="px-4 py-2 rounded-full text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-full text-xs font-bold bg-stone-900 text-white hover:bg-stone-800"
                        >
                            Save PIN
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    {/* 4-Dot PIN Indicator */}
                    <div
                        className={`flex justify-center gap-4 mb-7 transition-transform ${errorShake ? 'translate-x-2 bg-red-50/50 py-1 rounded-full' : ''
                            }`}
                    >
                        {[0, 1, 2, 3].map((i) => {
                            const filled = enteredPin.length > i;
                            return (
                                <div
                                    key={i}
                                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${errorShake
                                            ? 'bg-red-500 scale-110'
                                            : filled
                                                ? 'bg-rose-500 scale-110 shadow-sm shadow-rose-300'
                                                : 'bg-stone-200 border border-stone-300'
                                        }`}
                                />
                            );
                        })}
                    </div>

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                                key={num}
                                type="button"
                                onClick={() => handleDigitPress(num)}
                                className="h-14 rounded-2xl bg-white/90 hover:bg-rose-50 active:scale-95 border border-stone-200/80 font-serif font-bold text-xl text-stone-800 shadow-xs transition-all cursor-pointer"
                            >
                                {num}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => setEnteredPin('')}
                            className="h-14 rounded-2xl bg-stone-100/80 hover:bg-stone-200/70 active:scale-95 text-[11px] font-bold uppercase tracking-wider text-stone-500 transition-all"
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDigitPress(0)}
                            className="h-14 rounded-2xl bg-white/90 hover:bg-rose-50 active:scale-95 border border-stone-200/80 font-serif font-bold text-xl text-stone-800 shadow-xs transition-all cursor-pointer"
                        >
                            0
                        </button>
                        <button
                            type="button"
                            onClick={() => setEnteredPin((prev) => prev.slice(0, -1))}
                            className="h-14 rounded-2xl bg-stone-100/80 hover:bg-stone-200/70 active:scale-95 text-sm font-bold text-stone-600 transition-all"
                        >
                            ⌫
                        </button>
                    </div>

                    <div className="mt-6 pt-4 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-400">
                        <span>{savedPin === DEFAULT_PIN ? 'Default PIN: 0504' : 'Custom PIN Active'}</span>
                        <button
                            type="button"
                            onClick={() => {
                                if (enteredPin === savedPin || savedPin === DEFAULT_PIN) {
                                    setIsChangingPin(true);
                                } else {
                                    showDialog({
                                        type: 'confirm',
                                        title: 'Verify Current PIN',
                                        message: 'Enter your current 4-digit PIN to set a new one:',
                                        showInput: true,
                                        inputValue: '',
                                        onConfirm: (val) => {
                                            if (val === savedPin) setIsChangingPin(true);
                                            else showDialog({ type: 'alert', title: 'Wrong PIN', message: 'Current PIN did not match.' });
                                        }
                                    });
                                }
                            }}
                            className="text-rose-500 hover:underline font-semibold"
                        >
                            Change PIN
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default VaultPinPad;