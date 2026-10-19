import React, { useState, useRef } from 'react';
import { Icons } from '../common/Icons';

export const ChatBubbleItem = React.memo(({
  msg,
  isMe,
  isSameSenderAsPrev,
  onTriggerReply,
  onScrollToMessage,
  onOpenMediaLightbox,
  highlightedId
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartRef = useRef({ x: 0, y: 0, swiping: false });

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, swiping: false };
  };

  const handleTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = Math.abs(t.clientY - touchStartRef.current.y);

    if (dx > 10 && dx > dy * 1.2) {
      touchStartRef.current.swiping = true;
      const damped = Math.min(64, (dx - 10) * 0.75);
      setSwipeOffset(damped);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset >= 42) {
      if (navigator.vibrate) navigator.vibrate(15);
      onTriggerReply(msg);
    }
    setSwipeOffset(0);
    touchStartRef.current.swiping = false;
  };

  const isHighlighted = highlightedId && String(highlightedId) === String(msg.id);
  const hasMedia = Boolean(msg.media && msg.media.file_url);
  const hasAudio = Boolean(msg.audio || (hasMedia && msg.media.media_type === 'audio'));

  return (
    <div
      id={`chat-msg-${msg.id}`}
      className={`group relative flex items-center w-full select-none ${
        isMe ? 'justify-end' : 'justify-start'
      } ${isSameSenderAsPrev ? 'mt-[2px]' : 'mt-1.5'} ${
        isHighlighted ? 'animate-pulse ring-2 ring-rose-400 rounded-xl' : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide-to-Reply Indicator Icon */}
      <div
        className="absolute left-2 flex items-center justify-center w-7 h-7 rounded-full bg-stone-800/80 text-white shadow-sm pointer-events-none transition-opacity duration-150"
        style={{
          opacity: swipeOffset > 8 ? Math.min(1, swipeOffset / 42) : 0,
          transform: `scale(${swipeOffset >= 42 ? 1.1 : 0.85})`
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 17 4 12 9 7" />
          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
        </svg>
      </div>

      {/* Desktop Hover Reply Button (Left of sent bubble) */}
      {isMe && (
        <button
          type="button"
          onClick={() => onTriggerReply(msg)}
          title="Reply"
          className="hidden md:flex opacity-0 group-hover:opacity-100 mr-1.5 p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
      )}

      {/* Compact WhatsApp-Style Bubble */}
      <div
        style={{
          transform: swipeOffset ? `translateX(${swipeOffset}px)` : 'none',
          transition: swipeOffset ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}
        className={`relative max-w-[78%] sm:max-w-[75%] px-2.5 py-1 text-[13.5px] leading-[1.35] shadow-xs ${
          isMe
            ? `bg-rose-500 text-white rounded-xl ${!isSameSenderAsPrev ? 'rounded-tr-xs' : ''}`
            : `bg-white border border-stone-200/90 text-stone-800 rounded-xl ${!isSameSenderAsPrev ? 'rounded-tl-xs' : ''}`
        }`}
      >
        {/* Quoted Reply Block inside Bubble */}
        {msg.reply && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (msg.reply.id) onScrollToMessage(msg.reply.id);
            }}
            className={`mb-1 px-2 py-1 rounded-md text-[11.5px] leading-tight cursor-pointer border-l-[3px] flex items-center justify-between gap-2 ${
              isMe
                ? 'bg-rose-600/75 border-white/90 text-white/95'
                : 'bg-stone-100 border-rose-500 text-stone-700'
            }`}
          >
            <div className="min-w-0 flex-1 truncate">
              <span className="font-bold block text-[10.5px] opacity-90">
                {msg.reply.senderId === (msg.sender_id || msg.senderId) ? 'You' : 'Partner'}
              </span>
              <span className="truncate block opacity-85">
                {msg.reply.mediaType === 'image'
                  ? '📷 Photo'
                  : msg.reply.mediaType === 'video'
                  ? '🎬 Video'
                  : msg.reply.mediaType === 'audio'
                  ? '🎤 Voice note'
                  : msg.reply.text || 'Message'}
              </span>
            </div>
            {msg.reply.thumbUrl && (
              <img src={msg.reply.thumbUrl} alt="" className="w-7 h-7 rounded-xs object-cover shrink-0" />
            )}
          </div>
        )}

        {/* Attached Image */}
        {hasMedia && msg.media.media_type === 'image' && (
          <div
            onClick={() => onOpenMediaLightbox(msg.media)}
            className="mb-1 -mx-1 -mt-0.5 rounded-lg overflow-hidden cursor-pointer bg-black/10 max-w-[220px] max-h-[250px]"
          >
            <img
              src={msg.media.thumb || msg.media.original}
              alt="Chat attachment"
              loading="lazy"
              className="w-full h-full object-cover max-h-[250px] hover:scale-[1.02] transition-transform"
            />
          </div>
        )}

        {/* Attached Video */}
        {hasMedia && msg.media.media_type === 'video' && (
          <div
            onClick={() => onOpenMediaLightbox(msg.media)}
            className="mb-1 -mx-1 -mt-0.5 rounded-lg overflow-hidden cursor-pointer relative bg-black max-w-[220px] aspect-video flex items-center justify-center"
          >
            <img
              src={msg.media.thumbLow || msg.media.thumb}
              alt="Video attachment"
              className="w-full h-full object-cover opacity-85"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="w-9 h-9 rounded-full bg-white/90 text-stone-900 flex items-center justify-center text-xs shadow-md">
                ▶
              </span>
            </div>
          </div>
        )}

        {/* Voice Note */}
        {hasAudio ? (
          <div className="flex items-center gap-1.5 py-0.5">
            <audio
              src={msg.audio || msg.media?.original}
              controls
              className={`h-8 max-w-[185px] sm:max-w-[210px] outline-none ${
                isMe ? 'opacity-95 invert grayscale' : ''
              }`}
            />
          </div>
        ) : null}

        {/* Text + Inline Floating Timestamp & Checkmarks */}
        <div className="relative">
          {msg.cleanText && (
            <span className="whitespace-pre-wrap">{msg.cleanText}</span>
          )}
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] leading-none select-none float-right ml-2 mt-1.5 ${
              isMe ? 'text-rose-100/90' : 'text-stone-400'
            }`}
          >
            <span>{msg.timestamp}</span>
            {isMe && (
              <Icons.CheckAll
                className={`w-[13px] h-[13px] -mr-0.5 transition-colors ${
                  msg.status === 'read' ? 'text-sky-200' : 'text-rose-200/70'
                }`}
              />
            )}
          </span>
        </div>
      </div>

      {/* Desktop Hover Reply Button (Right of received bubble) */}
      {!isMe && (
        <button
          type="button"
          onClick={() => onTriggerReply(msg)}
          title="Reply"
          className="hidden md:flex opacity-0 group-hover:opacity-100 ml-1.5 p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-full transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
      )}
    </div>
  );
});

export default ChatBubbleItem;
