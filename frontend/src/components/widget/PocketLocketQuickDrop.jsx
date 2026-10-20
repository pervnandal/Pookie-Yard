import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';
import { parseMediaUrl } from '../../utils/mediaParser';
import { requestLockScreenNotifications, triggerLocalLockScreenAlert } from '../../utils/pwaPushUtils';

const STICKY_COLORS = [
    { name: 'Rose Quartz', hex: '#fff1f2', border: 'border-rose-200' },
    { name: 'Buttercup Gold', hex: '#fef9c3', border: 'border-amber-200' },
    { name: 'Matcha Mint', hex: '#dcfce7', border: 'border-emerald-200' },
    { name: 'Lavender Dusk', hex: '#f3e8ff', border: 'border-purple-200' }
];

export const PocketLocketQuickDrop = ({ isOpen, onClose, onSavedToVault, showDialog }) => {
    const [activeTab, setActiveTab] = useState('locket'); // 'locket' | 'drop' | 'setup'
    const [widgetData, setWidgetData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Drop Form State
    const [senderName, setSenderName] = useState(() => localStorage.getItem('us_locket_sender') || 'Your Pookie');
    const [partnerCity, setPartnerCity] = useState(() => localStorage.getItem('us_locket_city') || 'Faridabad');
    const [noteText, setNoteText] = useState('');
    const [selectedColor, setSelectedColor] = useState(STICKY_COLORS[0].hex);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSavingToVault, setIsSavingToVault] = useState(false);
    const [notifEnabled, setNotifEnabled] = useState(
        typeof Notification !== 'undefined' && Notification.permission === 'granted'
    );

    // Live Camera Capture State
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const fetchWidgetState = async (forceIdle = false) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/widget/state${forceIdle ? '?force_idle=true' : ''}`);
            if (res.ok) {
                const data = await res.json();
                setWidgetData(data);
            }
        } catch (e) {
            console.error('Widget fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchWidgetState(false);
        } else {
            stopCamera();
        }
    }, [isOpen]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
                audio: false
            });
            streamRef.current = stream;
            setIsCameraOpen(true);
            setTimeout(() => {
                if (videoRef.current) videoRef.current.srcObject = stream;
            }, 50);
        } catch {
            showDialog({
                type: 'alert',
                title: 'Camera Access',
                message: 'Could not access camera. You can still pick any photo from your gallery!'
            });
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
    };

    const captureSelfie = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 600;
        canvas.height = videoRef.current.videoHeight || 600;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
                setPhotoFile(file);
                setPhotoPreview(URL.createObjectURL(blob));
                stopCamera();
            }
        }, 'image/jpeg', 0.88);
    };

    const handleFileSelect = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setPhotoFile(f);
        setPhotoPreview(URL.createObjectURL(f));
    };

    const handleSendDrop = async (e) => {
        e.preventDefault();
        if (!noteText.trim() && !photoFile) return;

        setIsSending(true);
        localStorage.setItem('us_locket_sender', senderName);
        localStorage.setItem('us_locket_city', partnerCity);

        try {
            const formData = new FormData();
            formData.append('note', noteText.trim());
            formData.append('sender_name', senderName.trim() || 'Your Love');
            formData.append('color', selectedColor);
            formData.append('partner_city', partnerCity.trim() || 'Faridabad');
            if (photoFile) formData.append('file', photoFile);

            const res = await fetch(`${API_BASE_URL}/api/widget/drop`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                setNoteText('');
                setPhotoFile(null);
                setPhotoPreview('');
                setActiveTab('locket');
                fetchWidgetState(false);

                if (notifEnabled) {
                    triggerLocalLockScreenAlert(
                        `📱 Pocket Locket Updated!`,
                        data.card?.note || 'New Polaroid dropped onto your home screen 💕'
                    );
                }
            }
        } catch {
            showDialog({ type: 'alert', title: 'Error', message: 'Failed to send drop to Pocket Locket.' });
        } finally {
            setIsSending(false);
        }
    };

    const handleSaveToVault = async () => {
        setIsSavingToVault(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/widget/save-to-vault`, { method: 'POST' });
            if (res.ok) {
                showDialog({
                    type: 'alert',
                    title: 'Saved to Constant Albums 📌',
                    message: 'This photo has been permanently archived into your "Daily Widget Snaps 📱" folder!'
                });
                fetchWidgetState(false);
                onSavedToVault?.();
            }
        } catch {
            showDialog({ type: 'alert', title: 'Error', message: 'Could not archive photo to Vault.' });
        } finally {
            setIsSavingToVault(false);
        }
    };

    if (!isOpen) return null;

    const currentCard = widgetData?.card;
    const parsedCardImg = currentCard?.image_url ? parseMediaUrl(currentCard.image_url) : null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-2xl border border-white/80 rounded-[2.25rem] max-w-lg w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar">

                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <span className="text-2xl">📱</span>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-800 leading-tight">
                                Pookie’s Pocket Locket
                            </h2>
                            <p className="text-[11px] text-stone-500">
                                AI-Smart Home Screen Widget · Polaroid & Sticky Note Drops
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full"
                    >
                        <Icons.X />
                    </button>
                </div>

                {/* Navigation Pills */}
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200 mb-6">
                    {[
                        { id: 'locket', label: '✨ Live Widget' },
                        { id: 'drop', label: '📸 Send Drop' },
                        { id: 'setup', label: '🔔 Phone Setup' }
                    ].map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id)}
                            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === t.id ? 'bg-white text-rose-600 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                                }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* TAB 1: LIVE WIDGET PREVIEW (Shows Partner Drop OR Pookie's Idle Magic) */}
                {activeTab === 'locket' && (
                    <div className="space-y-5">
                        {loading || !currentCard ? (
                            <div className="h-64 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
                            </div>
                        ) : (
                            <div
                                style={{ backgroundColor: currentCard.color || '#fff1f2', color: currentCard.textColor || '#1c1917' }}
                                className="w-full max-w-[330px] mx-auto rounded-[2rem] p-5 shadow-xl border-2 border-white relative overflow-hidden transition-all"
                            >
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-black/10 backdrop-blur-xs">
                                        {currentCard.badge}
                                    </span>
                                    <span className="text-[10px] font-mono opacity-65">{currentCard.updated_at}</span>
                                </div>

                                {parsedCardImg && (
                                    <div className="bg-white p-2 pb-4 rounded-2xl shadow-md mb-3.5 rotate-1">
                                        <img
                                            src={parsedCardImg.thumb || parsedCardImg.original}
                                            alt="Pocket Locket Polaroid"
                                            className="w-full h-48 object-cover rounded-xl"
                                        />
                                    </div>
                                )}

                                <h3 className="font-serif font-bold text-lg leading-snug mb-1">{currentCard.title}</h3>
                                <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{currentCard.note}</p>

                                {/* 1-Tap Save to Daily Snaps Constant Album */}
                                {currentCard.image_url && widgetData?.status === 'active' && (
                                    <div className="mt-4 pt-3 border-t border-black/10 flex justify-end">
                                        <button
                                            type="button"
                                            disabled={isSavingToVault || currentCard.saved_to_vault}
                                            onClick={handleSaveToVault}
                                            className="bg-stone-900 hover:bg-rose-600 disabled:bg-emerald-600 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-sm transition-colors cursor-pointer"
                                        >
                                            {currentCard.saved_to_vault
                                                ? '✓ Saved in Constant Albums'
                                                : isSavingToVault
                                                    ? 'Saving...'
                                                    : '📌 Save to Daily Snaps Album'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('drop')}
                                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-md transition-all cursor-pointer"
                            >
                                📸 Drop New Selfie or Note
                            </button>
                            <button
                                type="button"
                                onClick={() => fetchWidgetState(true)}
                                className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold px-4 py-2.5 rounded-full transition-all cursor-pointer"
                                title="Preview what Pookie shows when neither of you posts for 8 hours"
                            >
                                ✨ Preview Pookie Idle Magic
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 2: SEND A POLAROID SELFIE OR STICKY NOTE DROP */}
                {activeTab === 'drop' && (
                    <form onSubmit={handleSendDrop} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                    Your Nickname
                                </label>
                                <input
                                    type="text"
                                    value={senderName}
                                    onChange={(e) => setSenderName(e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                    Partner's City (Weather Magic)
                                </label>
                                <input
                                    type="text"
                                    value={partnerCity}
                                    onChange={(e) => setPartnerCity(e.target.value)}
                                    placeholder="e.g., Faridabad, Delhi..."
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
                                />
                            </div>
                        </div>

                        {/* Camera / Photo Picker */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                                1-Tap Polaroid Selfie (Optional)
                            </label>

                            {isCameraOpen ? (
                                <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-[260px] mx-auto mb-2 shadow-lg">
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                    <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={captureSelfie}
                                            className="bg-rose-500 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md"
                                        >
                                            📸 Snap
                                        </button>
                                        <button
                                            type="button"
                                            onClick={stopCamera}
                                            className="bg-stone-800/80 text-white px-3 py-1.5 rounded-full text-xs"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : photoPreview ? (
                                <div className="relative w-36 h-36 mx-auto mb-2 rounded-2xl overflow-hidden shadow-md border border-stone-200">
                                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPhotoFile(null);
                                            setPhotoPreview('');
                                        }}
                                        className="absolute top-1.5 right-1.5 bg-black/70 text-white w-6 h-6 rounded-full text-xs"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={startCamera}
                                        className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors"
                                    >
                                        📷 Open Live Camera
                                    </button>
                                    <label className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold text-center cursor-pointer transition-colors">
                                        🖼️ Pick Photo
                                        <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* Sticky Note Text */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                Sticky Note / Polaroid Caption
                            </label>
                            <textarea
                                rows={3}
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Write a cute note for your partner's phone home screen..."
                                className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:border-rose-400 resize-none"
                            />
                        </div>

                        {/* Pastel Color Picker */}
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                                Card Pastel Tint
                            </label>
                            <div className="flex items-center gap-2.5">
                                {STICKY_COLORS.map((c) => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        onClick={() => setSelectedColor(c.hex)}
                                        style={{ backgroundColor: c.hex }}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold text-stone-700 border transition-all ${selectedColor === c.hex ? 'ring-2 ring-rose-500 scale-105' : c.border
                                            }`}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSending || (!noteText.trim() && !photoFile)}
                            className="w-full py-3 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg transition-all cursor-pointer"
                        >
                            {isSending ? 'Pinning to Home Screen...' : '🚀 Send to Partner’s Pocket Locket'}
                        </button>
                    </form>
                )}

                {/* TAB 3: PHONE HOME SCREEN & LOCK SCREEN NOTIFICATION SETUP */}
                {activeTab === 'setup' && (
                    <div className="space-y-4 text-xs text-stone-600 leading-relaxed">
                        <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4">
                            <h4 className="font-serif font-bold text-sm text-stone-800 mb-1">
                                1. Enable Rich Lock Screen Alerts 🔔
                            </h4>
                            <p className="mb-3">
                                Get instant lock-screen banners with heartbeat vibration whenever your partner drops a new Polaroid or note.
                            </p>
                            <button
                                type="button"
                                onClick={async () => {
                                    const granted = await requestLockScreenNotifications();
                                    setNotifEnabled(granted);
                                    if (granted) {
                                        triggerLocalLockScreenAlert(
                                            '🌸 Lock Screen Alerts Active!',
                                            'You will now receive Pookie’s Pocket Locket drops right on your lock screen.'
                                        );
                                    }
                                }}
                                className={`px-4 py-2 rounded-full font-bold text-xs shadow-sm transition-all ${notifEnabled
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-stone-900 hover:bg-rose-600 text-white'
                                    }`}
                            >
                                {notifEnabled ? '✓ Lock Screen Alerts Enabled' : '🔔 Enable Lock Screen Alerts'}
                            </button>
                        </div>

                        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                            <h4 className="font-serif font-bold text-sm text-stone-800 mb-1">
                                2. Install as Full-Screen Phone App (PWA) 📲
                            </h4>
                            <p>
                                • <b>iPhone (Safari):</b> Tap <b>Share</b> → <b>Add to Home Screen</b>.<br />
                                • <b>Android (Chrome/Edge):</b> Tap the browser menu <b>⋮</b> → <b>Install App / Add to Home Screen</b>.
                            </p>
                        </div>

                        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                            <h4 className="font-serif font-bold text-sm text-stone-800 mb-1">
                                3. Live Home Screen Widget URL 🖼️
                            </h4>
                            <p className="mb-2">
                                Use this live image URL in <b>Web Widget / KWGT</b> (Android) or <b>Scriptable</b> (iOS) to display the live card right on your wallpaper:
                            </p>
                            <div className="bg-white border border-stone-200 rounded-xl p-2 font-mono text-[11px] text-rose-600 select-all break-all">
                                {`${API_BASE_URL}/api/widget/card.svg`}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PocketLocketQuickDrop;