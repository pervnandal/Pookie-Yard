import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';
import { parseMediaUrl } from '../../utils/mediaParser';
import { getCurrentPartnerRole, getPartnerNames } from '../../utils/userIdentity';
import { requestLockScreenNotifications, triggerLocalLockScreenAlert } from '../../utils/pwaPushUtils';

const STICKY_COLORS = [
    { name: 'Rose Quartz', hex: '#fff1f2', border: 'border-rose-200' },
    { name: 'Buttercup Gold', hex: '#fef9c3', border: 'border-amber-200' },
    { name: 'Matcha Mint', hex: '#dcfce7', border: 'border-emerald-200' },
    { name: 'Lavender Dusk', hex: '#f3e8ff', border: 'border-purple-200' }
];

export const PocketLocketQuickDrop = ({ isOpen, onClose, onSavedToVault, showDialog }) => {
    const [activeTab, setActiveTab] = useState('locket'); // 'locket' | 'drop' | 'setup'
    const [previewPerspective, setPreviewPerspective] = useState('partner'); // 'partner' | 'mine' | 'pookie'
    const [widgetData, setWidgetData] = useState(null);
    const [loading, setLoading] = useState(false);

    const partnerRole = getCurrentPartnerRole();
    const names = getPartnerNames();
    const myName = names[partnerRole] || (partnerRole === 'partner_his' ? 'Parv' : 'Pookie');
    const partnerName =
        names[partnerRole === 'partner_his' ? 'partner_her' : 'partner_his'] ||
        (partnerRole === 'partner_his' ? 'Her' : 'Him');

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

    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const fetchWidgetState = async (forceIdle = false) => {
        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/widget/state?viewer_role=${partnerRole}${forceIdle ? '&force_idle=true' : ''}`
            );
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
    }, [isOpen, partnerRole]);

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
        localStorage.setItem('us_locket_city', partnerCity);

        try {
            const formData = new FormData();
            formData.append('note', noteText.trim());
            formData.append('sender_name', myName);
            formData.append('sender_role', partnerRole);
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
                setPreviewPerspective('mine');
                setActiveTab('locket');
                fetchWidgetState(false);

                if (notifEnabled) {
                    triggerLocalLockScreenAlert(
                        `📱 Sent to ${partnerName}'s 4×4 Widget!`,
                        data.card?.note || 'Your Polaroid is now live on their widget 💕'
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
            const res = await fetch(
                `${API_BASE_URL}/api/widget/save-to-vault?viewer_role=${partnerRole}`,
                { method: 'POST' }
            );
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

    // Select which card to display in the preview based on perspective toggle
    const partnerDrop =
        partnerRole === 'partner_his' ? widgetData?.her_drop : widgetData?.his_drop;
    const mySentDrop =
        partnerRole === 'partner_his' ? widgetData?.his_drop : widgetData?.her_drop;

    const displayedCard =
        previewPerspective === 'mine' && mySentDrop
            ? mySentDrop
            : previewPerspective === 'partner' && partnerDrop
                ? partnerDrop
                : widgetData?.card;

    const parsedCardImg = displayedCard?.image_url ? parseMediaUrl(displayedCard.image_url) : null;
    const myWidgetSvgUrl = `${API_BASE_URL}/api/widget/card.svg?for=${partnerRole}`;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-950/65 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-2xl border border-white/80 rounded-[2.25rem] max-w-lg w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto custom-scrollbar text-stone-800">

                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                        <span className="text-2xl">📱</span>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-800 leading-tight">
                                Pookie’s 4×4 Pocket Locket
                            </h2>
                            <p className="text-[11px] text-stone-500">
                                Viewing as <b>{myName}</b> · You see what <b>{partnerName}</b> uploads for you!
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

                {/* Main Modal Tabs */}
                <div className="grid grid-cols-3 gap-1.5 bg-stone-100 p-1 rounded-2xl border border-stone-200 mb-5">
                    {[
                        { id: 'locket', label: '🖼️ 4×4 Widget' },
                        { id: 'drop', label: `📤 Send to ${partnerName}` },
                        { id: 'setup', label: '📲 4×4 Wallpaper Setup' }
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

                {/* TAB 1: 4x4 LIVE WIDGET DISPLAY */}
                {activeTab === 'locket' && (
                    <div className="space-y-4">
                        {/* Perspective Switcher: What Partner Sent Me vs What I Sent Partner vs Pookie Idle Note */}
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => {
                                    setPreviewPerspective('partner');
                                    fetchWidgetState(false);
                                }}
                                className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${previewPerspective === 'partner'
                                        ? 'bg-rose-500 text-white'
                                        : 'bg-stone-100 text-stone-600'
                                    }`}
                            >
                                💌 From {partnerName} {partnerDrop ? '●' : '(None yet)'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPreviewPerspective('mine');
                                    fetchWidgetState(false);
                                }}
                                className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${previewPerspective === 'mine'
                                        ? 'bg-stone-900 text-white'
                                        : 'bg-stone-100 text-stone-600'
                                    }`}
                            >
                                📤 Sent by Me ({myName}) {mySentDrop ? '●' : ''}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPreviewPerspective('pookie');
                                    fetchWidgetState(true);
                                }}
                                className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${previewPerspective === 'pookie'
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-stone-100 text-stone-600'
                                    }`}
                            >
                                🌸 Pookie’s Shared Note
                            </button>
                        </div>

                        {loading || !displayedCard ? (
                            <div className="h-72 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500" />
                            </div>
                        ) : (
                            /* 4x4 Square Duolingo-Style Graphic Widget Card */
                            <div
                                style={{
                                    backgroundColor: displayedCard.color || '#fff1f2',
                                    color: displayedCard.textColor || '#1c1917'
                                }}
                                className="w-full aspect-square max-w-[360px] mx-auto rounded-[2.5rem] p-6 shadow-2xl border-4 border-white flex flex-col justify-between relative overflow-hidden transition-all"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-extrabold px-3.5 py-1 rounded-full bg-black/10 backdrop-blur-xs">
                                        {displayedCard.badge}
                                    </span>
                                    <span className="text-[11px] font-mono opacity-70">{displayedCard.updated_at}</span>
                                </div>

                                {parsedCardImg ? (
                                    <div className="my-2.5 flex-1 min-h-0 bg-white p-2 rounded-3xl shadow-md rotate-1 overflow-hidden flex items-center justify-center">
                                        <img
                                            src={parsedCardImg.thumb || parsedCardImg.original}
                                            alt="Pocket Locket Polaroid"
                                            className="w-full h-full object-cover rounded-2xl"
                                        />
                                    </div>
                                ) : (
                                    <div className="my-auto text-center">
                                        <span className="text-6xl block mb-2">🌸</span>
                                    </div>
                                )}

                                <div>
                                    <h3 className="font-serif font-bold text-xl leading-snug mb-1">{displayedCard.title}</h3>
                                    <p className="text-sm leading-relaxed opacity-90 line-clamp-3 whitespace-pre-wrap">
                                        {displayedCard.note}
                                    </p>

                                    {displayedCard.image_url && (
                                        <div className="mt-3 pt-2.5 border-t border-black/10 flex justify-end">
                                            <button
                                                type="button"
                                                disabled={isSavingToVault || displayedCard.saved_to_vault}
                                                onClick={handleSaveToVault}
                                                className="bg-stone-900 hover:bg-rose-600 disabled:bg-emerald-600 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full shadow-sm transition-colors cursor-pointer"
                                            >
                                                {displayedCard.saved_to_vault
                                                    ? '✓ Saved in Constant Albums'
                                                    : isSavingToVault
                                                        ? 'Saving...'
                                                        : '📌 Save to Daily Snaps Album'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-center pt-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('drop')}
                                className="bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold px-6 py-3 rounded-full shadow-md transition-all cursor-pointer"
                            >
                                📸 Upload Photo / Note for {partnerName}’s Widget
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 2: UPLOAD PHOTO OR NOTE FOR PARTNER */}
                {activeTab === 'drop' && (
                    <form onSubmit={handleSendDrop} className="space-y-4">
                        <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3 text-xs text-rose-800 font-medium">
                            ✨ Uploading as <b>{myName}</b> — this will appear directly on <b>{partnerName}’s 4×4 widget</b>!
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                                1-Tap Polaroid Selfie or Photo
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
                                <div className="relative w-40 h-40 mx-auto mb-2 rounded-2xl overflow-hidden shadow-md border border-stone-200">
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
                                        className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                                Note for {partnerName}’s Home Screen
                            </label>
                            <textarea
                                rows={3}
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder={`Write a sweet note for ${partnerName}...`}
                                className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:border-rose-400 resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                                4×4 Card Background Tint
                            </label>
                            <div className="flex items-center gap-2 flex-wrap">
                                {STICKY_COLORS.map((c) => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        onClick={() => setSelectedColor(c.hex)}
                                        style={{ backgroundColor: c.hex }}
                                        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold text-stone-700 border transition-all cursor-pointer ${selectedColor === c.hex ? 'ring-2 ring-rose-500 scale-105' : c.border
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
                            className="w-full py-3 bg-stone-900 hover:bg-rose-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg transition-all cursor-pointer"
                        >
                            {isSending ? 'Updating Widget...' : `🚀 Pin to ${partnerName}’s 4×4 Widget`}
                        </button>
                    </form>
                )}

                {/* TAB 3: HOW TO ADD AS A 4x4 WALLPAPER WIDGET (LIKE DUOLINGO) WITHOUT REDIRECTING */}
                {activeTab === 'setup' && (
                    <div className="space-y-4 text-xs text-stone-600 leading-relaxed">
                        <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4">
                            <h4 className="font-serif font-bold text-sm text-stone-800 mb-1">
                                Why Browser “Install App” Created a 1×1 Icon (And How to Get the 4×4 Wallpaper Card!)
                            </h4>
                            <p>
                                Chrome’s <i>“Add to Home Screen”</i> only creates a 1×1 app launcher icon. To put a <b>large 4×4 live graphic card on your wallpaper</b> (like Duolingo) that shows {partnerName}’s photos & notes live <b>without opening the browser</b>:
                            </p>
                        </div>

                        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2">
                            <h4 className="font-serif font-bold text-sm text-stone-800">
                                Your Personal 4×4 Live Graphic Feed URL (Shows {partnerName}’s Drops):
                            </h4>
                            <div className="bg-white border border-stone-200 rounded-xl p-2.5 font-mono text-[11px] text-rose-600 select-all break-all">
                                {myWidgetSvgUrl}
                            </div>
                            <p className="text-[11px] text-stone-500">
                                • <b>Android (4×4 Wallpaper Card):</b> Install the free <b>KWGT</b> or <b>Widgeet / Image Widget</b> app → Add a <b>4×4 Widget</b> on your home screen → Paste the URL above as the Image URL and set Touch Action to <b>None / Refresh</b> (so tapping refreshes the image in place without opening the browser!).<br />
                                • <b>iPhone (4×4 Large Scriptable Widget):</b> Install the free <b>Scriptable</b> app, add a Large (4×4) Scriptable widget to your home screen, and paste this 6-line script:
                            </p>
                            <pre className="bg-stone-900 text-rose-200 p-3 rounded-xl text-[10px] overflow-x-auto select-all">
                                {`const req = new Request("${API_BASE_URL}/api/widget/state?viewer_role=${partnerRole}");
const res = await req.loadJSON();
const w = new ListWidget();
w.backgroundColor = new Color(res.card.color || "#fff1f2");
const t = w.addText(res.card.badge + "\\n\\n" + res.card.title + "\\n" + res.card.note);
t.textColor = new Color("#1c1917");
Script.setWidget(w);`}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PocketLocketQuickDrop;