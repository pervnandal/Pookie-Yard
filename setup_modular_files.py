import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

# =====================================================================
# 1. ACTIVE FILES WITH FULL WORKING CODE
# =====================================================================
ACTIVE_FILES = {
    "backend/routers/planner.py": r'''import gc
import os
import asyncio
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from typing import Optional

try:
    from backend.config import supabase
except ImportError:
    try:
        from config import supabase
    except ImportError:
        from supabase import create_client
        supabase = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_KEY", ""))

try:
    from backend.services.google_cloud import get_drive_service, upload_to_drive, upload_to_youtube
except ImportError:
    from services.google_cloud import get_drive_service, upload_to_drive, upload_to_youtube

router = APIRouter(prefix="/api")

class CreateItineraryRequest(BaseModel):
    title: str

class UpdateItineraryRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


def _upload_chat_media_sync(f: UploadFile) -> dict:
    mime = (f.content_type or "").lower()
    fname = f.filename or "chat_media"
    is_video = mime.startswith("video/") or fname.lower().endswith((".mp4", ".mov", ".webm", ".mkv", ".avi"))
    is_audio = mime.startswith("audio/") or fname.lower().endswith((".mp3", ".wav", ".ogg", ".m4a", ".aac"))

    if is_video:
        file_url = upload_to_youtube(
            f.file,
            title=f"Chat Video - {fname}",
            description="Shared in The Us Space Live Chat",
            mime_type=mime or "video/mp4"
        )
        media_type = "video"
    else:
        drive_service = get_drive_service()
        file_url = upload_to_drive(
            f.file,
            filename=fname,
            mime_type=mime or ("audio/webm" if is_audio else "image/jpeg"),
            drive_service=drive_service
        )
        media_type = "audio" if is_audio else "image"

    return {
        "file_url": file_url,
        "media_type": media_type,
        "name": fname
    }


@router.post("/chats/upload")
async def upload_chat_media(file: UploadFile = File(...)):
    """Uploads an image, video, or audio attachment for Live Planner chat."""
    try:
        result = await asyncio.to_thread(_upload_chat_media_sync, file)
        await file.close()
        gc.collect()
        return result
    except Exception as e:
        print(f"Chat media upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Chat media upload failed: {str(e)}")


@router.get("/chats")
def get_chats(
    limit: int = Query(25, ge=1, le=100),
    before_id: Optional[int] = Query(None, description="Fetch chunk of messages older than this message ID")
):
    if not supabase:
        return []
    try:
        query = supabase.table("chat_messages").select("*")
        if before_id is not None:
            query = query.lt("id", before_id)

        resp = query.order("id", desc=True).limit(limit).execute()
        rows = resp.data or []
        rows.reverse()
        return rows
    except Exception as e:
        print(f"Error fetching chats chunk: {e}")
        return []


@router.get("/itineraries")
def get_itineraries():
    if not supabase:
        return []
    try:
        resp = supabase.table("itineraries").select("*").order("id", desc=True).execute()
        return resp.data or []
    except Exception as e:
        print(f"Error fetching itineraries: {e}")
        return []


@router.post("/itineraries")
def create_itinerary(req: CreateItineraryRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    resp = supabase.table("itineraries").insert({
        "title": req.title,
        "content": ""
    }).execute()
    return resp.data[0] if resp.data else {}


@router.put("/itineraries/{doc_id}")
def update_itinerary(doc_id: str, req: UpdateItineraryRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    update_data = req.model_dump(exclude_none=True) if hasattr(req, "model_dump") else req.dict(exclude_none=True)
    resp = supabase.table("itineraries").update(update_data).eq("id", doc_id).execute()
    return resp.data[0] if resp.data else {"status": "updated"}


@router.delete("/itineraries/{doc_id}")
def delete_itinerary(doc_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database not connected")
    supabase.table("itineraries").delete().eq("id", doc_id).execute()
    return {"status": "deleted"}
''',

    "frontend/src/utils/chatUtils.js": r'''import { parseMediaUrl } from './mediaParser';

export const CHAT_CHUNK_SIZE = 25;
export const CHATS_CACHE_KEY = 'us_planner_chats_chunk_v1';
export const ITINERARIES_CACHE_KEY = 'us_planner_itineraries_cache_v1';
export const ACTIVE_DOC_CACHE_KEY = 'us_planner_active_doc_v1';

const META_PREFIX = '__US_META__';
const META_SUFFIX = '__END_META__';

export const encodeMessageText = (cleanText, replyTo, media) => {
  if (!replyTo && !media) return cleanText || '';
  const metaPayload = {};
  if (replyTo) {
    metaPayload.reply = {
      id: replyTo.id,
      senderId: replyTo.senderId || replyTo.sender_id,
      text: (replyTo.cleanText || replyTo.text || '').slice(0, 120),
      mediaType: replyTo.media?.media_type || (replyTo.audio ? 'audio' : null),
      thumbUrl: replyTo.media?.thumbUrl || null
    };
  }
  if (media) {
    metaPayload.media = {
      file_url: media.file_url,
      media_type: media.media_type,
      name: media.name || ''
    };
  }
  return `${META_PREFIX}${JSON.stringify(metaPayload)}${META_SUFFIX}${cleanText || ''}`;
};

export const decodeMessage = (msg) => {
  if (!msg) return null;
  const rawText = msg.text || '';
  let cleanText = rawText;
  let reply = msg.reply || null;
  let media = msg.media || null;

  if (rawText.startsWith(META_PREFIX)) {
    const endIdx = rawText.indexOf(META_SUFFIX);
    if (endIdx !== -1) {
      const jsonStr = rawText.slice(META_PREFIX.length, endIdx);
      cleanText = rawText.slice(endIdx + META_SUFFIX.length);
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.reply) reply = parsed.reply;
        if (parsed.media) media = parsed.media;
      } catch {
        // Ignore malformed metadata
      }
    }
  }

  let parsedMedia = null;
  if (media && media.file_url) {
    const p = parseMediaUrl(media.file_url);
    parsedMedia = {
      ...media,
      ...p,
      thumbUrl: p.thumbLow || p.thumb || p.original
    };
  }

  return {
    ...msg,
    cleanText,
    reply,
    media: parsedMedia
  };
};

export const deduplicateMessages = (list) => {
  const seenIds = new Set();
  const result = [];
  for (let i = 0; i < list.length; i++) {
    const msg = list[i];
    if (!msg) continue;
    if (msg.id && seenIds.has(msg.id)) continue;

    if (result.length > 0) {
      const prev = result[result.length - 1];
      const sameSender = (msg.sender_id || msg.senderId) === (prev.sender_id || prev.senderId);
      if (sameSender && msg.text && msg.text === prev.text && msg.timestamp === prev.timestamp) {
        continue;
      }
    }
    if (msg.id) seenIds.add(msg.id);
    result.push(msg);
  }
  return result;
};

export const saveChatChunkToCache = (msgs) => {
  try {
    const recentChunk = msgs.slice(-CHAT_CHUNK_SIZE);
    localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(recentChunk));
  } catch {}
};
''',

    "frontend/src/components/planner/ChatBubbleItem.jsx": r'''import React, { useState, useRef } from 'react';
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
''',

    "frontend/src/components/planner/ChatMediaLightbox.jsx": r'''import React from 'react';
import { Icons } from '../common/Icons';

export const ChatMediaLightbox = ({ media, onClose }) => {
  if (!media) return null;

  return (
    <div
      className="fixed inset-0 z-[260] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        <a
          href={media.original}
          target="_blank"
          rel="noreferrer"
          download
          onClick={(e) => e.stopPropagation()}
          className="p-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-full"
          title="Open / Save Original"
        >
          <Icons.Download />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-full"
          title="Close"
        >
          <Icons.X />
        </button>
      </div>

      <div
        className="max-w-4xl max-h-[85vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {media.isYoutube ? (
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
            <iframe
              src={media.embedUrl}
              title="Chat Video"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : media.media_type === 'video' ? (
          <video src={media.original} controls autoPlay className="max-w-full max-h-[85vh] rounded-xl" />
        ) : (
          <img
            src={media.thumb || media.original}
            alt="Chat full view"
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};

export default ChatMediaLightbox;
''',

    "frontend/src/components/planner/ChatPanel.jsx": r'''import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';
import { encodeMessageText, decodeMessage, saveChatChunkToCache } from '../../utils/chatUtils';
import ChatBubbleItem from './ChatBubbleItem';
import ChatMediaLightbox from './ChatMediaLightbox';

export const ChatPanel = ({
  userId,
  messages,
  setMessages,
  partnerTyping,
  hasMoreOlderChats,
  isLoadingOlderChats,
  onLoadOlderChats,
  shouldScrollToBottomRef,
  scrollRestoreRef,
  safeSend,
  showDialog
}) => {
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  const [viewportStyle, setViewportStyle] = useState(null);

  const [input, setInput] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [stagedFile, setStagedFile] = useState(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState('');
  const [isUploadingChatMedia, setIsUploadingChatMedia] = useState(false);
  const [chatUploadProgress, setChatUploadProgress] = useState(0);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isChatFullscreen) {
      document.body.style.overflow = '';
      setViewportStyle(null);
      return;
    }

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsChatFullscreen(false);
        return;
      }
      if (window.visualViewport) {
        setViewportStyle({
          height: `${window.visualViewport.height}px`,
          top: `${window.visualViewport.offsetTop}px`
        });
      }
    };

    document.body.style.overflow = 'hidden';
    handleResize();

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, [isChatFullscreen]);

  const handleChatScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 25 && hasMoreOlderChats && !isLoadingOlderChats) {
      onLoadOlderChats(chatContainerRef.current);
    }
  };

  useLayoutEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;

    if (scrollRestoreRef.current) {
      const { prevScrollHeight, prevScrollTop } = scrollRestoreRef.current;
      const heightDiff = container.scrollHeight - prevScrollHeight;
      container.scrollTop = prevScrollTop + heightDiff;
      scrollRestoreRef.current = null;
      return;
    }

    if (shouldScrollToBottomRef.current) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, partnerTyping, isChatFullscreen]);

  const handleTriggerReply = useCallback((decodedMsg) => {
    setReplyingTo(decodedMsg);
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const handleScrollToMessage = useCallback((targetId) => {
    const el = document.getElementById(`chat-msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetId);
      setTimeout(() => setHighlightedMsgId(null), 1600);
    }
  }, []);

  const handleSelectChatMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStagedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setStagedPreviewUrl(URL.createObjectURL(file));
    } else {
      setStagedPreviewUrl('');
    }
    e.target.value = '';
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const clearStagedMedia = () => {
    if (stagedPreviewUrl) URL.revokeObjectURL(stagedPreviewUrl);
    setStagedFile(null);
    setStagedPreviewUrl('');
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    safeSend({ type: 'typing', senderId: userId, isTyping: true, field: 'chat' });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(
      () => safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'chat' }),
      1500
    );
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();

    inputRef.current?.focus({ preventScroll: true });

    const trimmedText = input.trim();
    if (!trimmedText && !stagedFile) return;

    const currentReply = replyingTo;
    const fileToUpload = stagedFile;

    setInput('');
    setReplyingTo(null);
    clearStagedMedia();
    safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'chat' });

    let uploadedMediaObj = null;

    if (fileToUpload) {
      setIsUploadingChatMedia(true);
      setChatUploadProgress(10);
      try {
        const formData = new FormData();
        formData.append('file', fileToUpload);

        uploadedMediaObj = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${API_BASE_URL}/api/chats/upload`, true);
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) {
              setChatUploadProgress(Math.round((ev.loaded / ev.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error('Upload failed'));
            }
          };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(formData);
        });
      } catch {
        showDialog({
          type: 'alert',
          title: 'Media Upload Failed',
          message: 'Could not upload media to chat. Please try again.'
        });
        setIsUploadingChatMedia(false);
        return;
      } finally {
        setIsUploadingChatMedia(false);
        setChatUploadProgress(0);
      }
    }

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const encodedText = encodeMessageText(trimmedText, currentReply, uploadedMediaObj);

    const msgObj = {
      type: 'chat',
      text: encodedText,
      senderId: userId,
      timestamp,
      status: 'sent',
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    };

    shouldScrollToBottomRef.current = true;
    safeSend(msgObj);
    setMessages((prev) => {
      const next = [...prev, msgObj];
      saveChatChunkToCache(next);
      return next;
    });

    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const startVoiceMessage = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        const reader = new FileReader();
        reader.readAsDataURL(blob);

        reader.onloadend = () => {
          const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const encodedText = encodeMessageText('', replyingTo, null);
          setReplyingTo(null);

          const msgObj = {
            type: 'chat',
            text: encodedText,
            audio: reader.result,
            senderId: userId,
            timestamp,
            status: 'sent',
            id: `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          };

          shouldScrollToBottomRef.current = true;
          safeSend(msgObj);
          setMessages((prev) => {
            const next = [...prev, msgObj];
            saveChatChunkToCache(next);
            return next;
          });
        };
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch {
      showDialog({ type: 'alert', title: 'Mic Access', message: 'Please allow microphone access to record.' });
    }
  };

  const stopVoiceMessage = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const decodedMessages = messages.map(decodeMessage).filter(Boolean);
  const hasSendableContent = Boolean(input.trim() || stagedFile);

  return (
    <>
      <div
        style={isChatFullscreen && viewportStyle ? viewportStyle : undefined}
        className={
          isChatFullscreen
            ? 'fixed inset-x-0 top-0 z-[220] w-screen h-[100dvh] bg-[#f8f5f2] flex flex-col overflow-hidden shadow-2xl md:relative md:inset-auto md:z-auto md:w-[350px] lg:w-[380px] md:h-full md:rounded-[2rem]'
            : 'flex flex-col w-full md:w-[350px] lg:w-[380px] shrink-0 h-[520px] md:h-full bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-xl border border-white/60 overflow-hidden'
        }
      >
        {/* Chat Header — Mobile-Only Fullscreen Toggle & Clear Exit Button */}
        <div className="h-[58px] shrink-0 px-3.5 border-b border-stone-200/80 flex items-center justify-between bg-white/95 backdrop-blur-md z-20">
          <div className="flex items-center gap-2 min-w-0">
            {isChatFullscreen && (
              <button
                type="button"
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => setIsChatFullscreen(false)}
                className="md:hidden p-2 -ml-1 bg-stone-100 hover:bg-stone-200 active:scale-95 rounded-full text-stone-800 shrink-0"
                title="Exit Fullscreen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
            )}

            <div className="min-w-0">
              <h3 className="font-serif font-bold text-base text-stone-800 leading-tight truncate">
                Live Planner Chat
              </h3>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                <p className="text-[11px] text-stone-500 font-medium truncate">
                  {partnerTyping ? 'Partner is typing...' : 'Online · Slide bubble to reply'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden md:inline-block text-2xl opacity-80">💬</span>

            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setIsChatFullscreen((prev) => !prev)}
              className={`md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 shadow-xs ${
                isChatFullscreen
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : 'bg-stone-900 text-white hover:bg-stone-800'
              }`}
              title={isChatFullscreen ? 'Exit Full Screen' : 'Full Screen Chat'}
            >
              {isChatFullscreen ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                    <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                    <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                    <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
                  </svg>
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
                  <span>Full Screen</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div
          ref={chatContainerRef}
          onScroll={handleChatScroll}
          className="flex-1 overflow-y-auto px-3 py-2.5 bg-stone-100/45 custom-scrollbar flex flex-col"
        >
          {isLoadingOlderChats && (
            <div className="flex justify-center py-1.5">
              <span className="text-[11px] font-medium text-stone-500 bg-white/90 px-3 py-0.5 rounded-full shadow-xs border border-stone-200/60 animate-pulse">
                Loading older messages...
              </span>
            </div>
          )}

          {decodedMessages.length === 0 && !isLoadingOlderChats && (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-1.5 opacity-70">
              <span className="text-3xl animate-bounce">👋</span>
              <p className="text-xs font-medium">Say hello or swipe any message to reply!</p>
            </div>
          )}

          {decodedMessages.map((msg, idx) => {
            const sender = msg.sender_id || msg.senderId;
            const isMe = sender === userId;
            const prevSender = idx > 0 ? (decodedMessages[idx - 1].sender_id || decodedMessages[idx - 1].senderId) : null;
            const isSameSenderAsPrev = prevSender === sender;

            return (
              <ChatBubbleItem
                key={msg.id || idx}
                msg={msg}
                isMe={isMe}
                isSameSenderAsPrev={isSameSenderAsPrev}
                onTriggerReply={handleTriggerReply}
                onScrollToMessage={handleScrollToMessage}
                onOpenMediaLightbox={(media) => setLightboxMedia(media)}
                highlightedId={highlightedMsgId}
              />
            );
          })}

          {partnerTyping && (
            <div className="flex justify-start mt-1.5 animate-in fade-in duration-200">
              <div className="bg-white border border-stone-200 px-3 py-2 rounded-xl rounded-tl-xs text-xs text-stone-400 shadow-xs flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Reply & Staged Attachment Bar */}
        {(replyingTo || stagedFile || isUploadingChatMedia) && (
          <div className="px-3 pt-2 pb-1 bg-white/95 border-t border-stone-200/80 flex flex-col gap-1.5 z-10 animate-in slide-in-from-bottom-2 duration-150">
            {replyingTo && (
              <div className="flex items-center justify-between bg-stone-100 border-l-4 border-rose-500 rounded-lg px-2.5 py-1.5 text-xs">
                <div className="min-w-0 flex-1 pr-2">
                  <span className="font-bold text-rose-600 block text-[11px]">
                    Replying to {(replyingTo.sender_id || replyingTo.senderId) === userId ? 'Yourself' : 'Partner'}
                  </span>
                  <span className="text-stone-600 truncate block text-[11.5px]">
                    {replyingTo.media?.media_type === 'image'
                      ? '📷 Photo'
                      : replyingTo.media?.media_type === 'video'
                      ? '🎬 Video'
                      : replyingTo.audio
                      ? '🎤 Voice Note'
                      : replyingTo.cleanText || 'Message'}
                  </span>
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => setReplyingTo(null)}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-full"
                >
                  ✕
                </button>
              </div>
            )}

            {stagedFile && (
              <div className="flex items-center justify-between bg-rose-50/70 border border-rose-200/80 rounded-lg px-2.5 py-1.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  {stagedPreviewUrl && stagedFile.type.startsWith('image/') ? (
                    <img src={stagedPreviewUrl} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
                  ) : (
                    <span className="text-lg">
                      {stagedFile.type.startsWith('video/') ? '🎬' : '📎'}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="font-semibold text-stone-700 truncate block max-w-[190px]">
                      {stagedFile.name}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {(stagedFile.size / (1024 * 1024)).toFixed(1)} MB · Ready to send
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={clearStagedMedia}
                  className="p-1 text-stone-400 hover:text-red-500 rounded-full"
                >
                  ✕
                </button>
              </div>
            )}

            {isUploadingChatMedia && (
              <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full transition-all duration-200"
                  style={{ width: `${Math.max(10, chatUploadProgress)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Input Form (Keeps Mobile Keyboard Open on Send) */}
        <form
          onSubmit={handleSend}
          className="shrink-0 px-2.5 py-2 bg-white/95 border-t border-stone-200/70 flex gap-2 items-center z-10"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            onChange={handleSelectChatMedia}
            className="hidden"
          />

          {isRecording ? (
            <div className="flex-1 flex items-center justify-between bg-rose-50 border border-rose-200 rounded-full px-4 py-2">
              <div className="flex items-center gap-2 text-rose-500 font-medium text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> Recording voice...
              </div>
              <button
                type="button"
                onClick={stopVoiceMessage}
                className="p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-xs"
              >
                <Icons.Send />
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0 flex items-center bg-stone-100 border border-stone-200/90 rounded-full px-3 py-1.5 shadow-inner focus-within:border-rose-400">
                <input
                  ref={inputRef}
                  type="text"
                  enterKeyHint="send"
                  value={input}
                  onChange={handleInputChange}
                  placeholder={stagedFile ? "Add a caption..." : "Message"}
                  className="flex-1 min-w-0 bg-transparent text-[14px] text-stone-800 py-1 px-1 focus:outline-none placeholder:text-stone-400"
                />

                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingChatMedia}
                  title="Attach Photo or Video"
                  className="p-1.5 text-stone-500 hover:text-rose-500 transition-colors shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
              </div>

              <button
                type={hasSendableContent ? "submit" : "button"}
                disabled={isUploadingChatMedia}
                onPointerDown={(e) => e.preventDefault()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  if (hasSendableContent) {
                    handleSend(e);
                  } else {
                    startVoiceMessage();
                  }
                }}
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-all active:scale-95 ${
                  hasSendableContent
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-stone-900 hover:bg-stone-800 text-white'
                }`}
              >
                {hasSendableContent ? <Icons.Send /> : <Icons.Mic />}
              </button>
            </>
          )}
        </form>
      </div>

      <ChatMediaLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
    </>
  );
};

export default ChatPanel;
''',

    "frontend/src/components/planner/NotepadPanel.jsx": r'''import React from 'react';
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
''',

    "frontend/src/components/planner/DatePlanner.jsx": r'''import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL, WS_BASE_URL } from '../../utils/apiUtils';
import {
  CHAT_CHUNK_SIZE,
  CHATS_CACHE_KEY,
  ITINERARIES_CACHE_KEY,
  ACTIVE_DOC_CACHE_KEY,
  deduplicateMessages,
  saveChatChunkToCache
} from '../../utils/chatUtils';
import ChatPanel from './ChatPanel';
import NotepadPanel from './NotepadPanel';

export const DatePlanner = ({ showDialog }) => {
  const [userId] = useState(() => {
    let stored = localStorage.getItem('us_planner_id');
    if (!stored) {
      stored = `user_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem('us_planner_id', stored);
    }
    return stored;
  });

  const [messages, setMessages] = useState(() => {
    try {
      const cached = localStorage.getItem(CHATS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [hasMoreOlderChats, setHasMoreOlderChats] = useState(true);
  const [isLoadingOlderChats, setIsLoadingOlderChats] = useState(false);

  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerEditing, setPartnerEditing] = useState(false);

  const [itineraries, setItineraries] = useState(() => {
    try {
      const cached = localStorage.getItem(ITINERARIES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [activeDocId, setActiveDocId] = useState(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_DOC_CACHE_KEY);
      const cachedList = JSON.parse(localStorage.getItem(ITINERARIES_CACHE_KEY) || '[]');
      if (savedId && cachedList.some((d) => String(d.id) === String(savedId))) {
        const match = cachedList.find((d) => String(d.id) === String(savedId));
        return match.id;
      }
      return cachedList.length > 0 ? cachedList[0].id : null;
    } catch {
      return null;
    }
  });

  const [activeContent, setActiveContent] = useState(() => {
    try {
      const cachedList = JSON.parse(localStorage.getItem(ITINERARIES_CACHE_KEY) || '[]');
      const savedId = localStorage.getItem(ACTIVE_DOC_CACHE_KEY);
      const doc = cachedList.find((d) => String(d.id) === String(savedId)) || cachedList[0];
      return doc ? doc.content || '' : '';
    } catch {
      return '';
    }
  });

  const ws = useRef(null);
  const shouldScrollToBottomRef = useRef(true);
  const scrollRestoreRef = useRef(null);
  const isDirtyPlanRef = useRef(false);
  const activeContentRef = useRef(activeContent);
  const activeDocIdRef = useRef(activeDocId);

  const padTypingTimeoutRef = useRef(null);
  const chatTypingFallback = useRef(null);
  const padTypingFallback = useRef(null);

  useEffect(() => {
    activeContentRef.current = activeContent;
  }, [activeContent]);

  useEffect(() => {
    activeDocIdRef.current = activeDocId;
    if (activeDocId !== null && activeDocId !== undefined) {
      try {
        localStorage.setItem(ACTIVE_DOC_CACHE_KEY, String(activeDocId));
      } catch {}
    }
    setPartnerEditing(false);
    clearTimeout(padTypingFallback.current);
  }, [activeDocId]);

  useEffect(() => {
    try {
      localStorage.setItem(ITINERARIES_CACHE_KEY, JSON.stringify(itineraries));
    } catch {}
  }, [itineraries]);

  const safeSend = useCallback((payload) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/chats?limit=${CHAT_CHUNK_SIZE}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const cleaned = deduplicateMessages(data);
          shouldScrollToBottomRef.current = true;
          setMessages(cleaned);
          saveChatChunkToCache(cleaned);
          setHasMoreOlderChats(data.length >= CHAT_CHUNK_SIZE);
        }
      })
      .catch((err) => console.error("Chat sync failed", err));

    fetch(`${API_BASE_URL}/api/itineraries`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && !isDirtyPlanRef.current) {
          setItineraries(data);
          try {
            localStorage.setItem(ITINERARIES_CACHE_KEY, JSON.stringify(data));
          } catch {}
          if (data.length > 0 && !activeDocIdRef.current) {
            setActiveDocId(data[0].id);
            setActiveContent(data[0].content || '');
          } else if (activeDocIdRef.current) {
            const currentDoc = data.find((d) => d.id === activeDocIdRef.current);
            if (currentDoc) setActiveContent(currentDoc.content || '');
          }
        }
      })
      .catch((err) => console.error("Itinerary sync failed", err));
  }, []);

  const loadOlderChatsChunk = useCallback(async (containerEl) => {
    if (isLoadingOlderChats || !hasMoreOlderChats || messages.length === 0) return;

    const oldestDbMsg = messages.find((m) => typeof m.id === 'number' || /^\d+$/.test(String(m.id)));
    if (!oldestDbMsg) {
      setHasMoreOlderChats(false);
      return;
    }

    setIsLoadingOlderChats(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/chats?limit=${CHAT_CHUNK_SIZE}&before_id=${oldestDbMsg.id}`
      );
      if (res.ok) {
        const olderChunk = await res.json();
        if (!Array.isArray(olderChunk) || olderChunk.length === 0) {
          setHasMoreOlderChats(false);
        } else {
          if (olderChunk.length < CHAT_CHUNK_SIZE) {
            setHasMoreOlderChats(false);
          }
          if (containerEl) {
            scrollRestoreRef.current = {
              prevScrollHeight: containerEl.scrollHeight,
              prevScrollTop: containerEl.scrollTop
            };
          }
          shouldScrollToBottomRef.current = false;
          setMessages((prev) => deduplicateMessages([...olderChunk, ...prev]));
        }
      }
    } catch (err) {
      console.error("Failed to fetch older chat chunk", err);
    } finally {
      setIsLoadingOlderChats(false);
    }
  }, [isLoadingOlderChats, hasMoreOlderChats, messages]);

  useEffect(() => {
    if (activeDocId) {
      const doc = itineraries.find((i) => i.id === activeDocId);
      if (doc && !isDirtyPlanRef.current) {
        setActiveContent(doc.content || '');
      }
    }
  }, [activeDocId]);

  useEffect(() => {
    let reconnectTimer;
    let isMounted = true;

    const connectWS = () => {
      if (!isMounted) return;
      if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      const socket = new WebSocket(`${WS_BASE_URL}/ws/chat`);
      ws.current = socket;

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'refresh_plans') {
          fetch(`${API_BASE_URL}/api/itineraries`)
            .then((res) => res.json())
            .then((fetchedDocs) => {
              if (Array.isArray(fetchedDocs)) setItineraries(fetchedDocs);
            });
          return;
        }

        if (data.senderId === userId) return;

        if (data.type === 'chat') {
          shouldScrollToBottomRef.current = true;
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            const next = [...prev, data];
            saveChatChunkToCache(next);
            return next;
          });
          safeSend({ type: 'read_receipt', senderId: userId });
        } else if (data.type === 'read_receipt') {
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.senderId === userId || m.sender_id === userId ? { ...m, status: 'read' } : m
            );
            saveChatChunkToCache(next);
            return next;
          });
        } else if (data.type === 'typing') {
          if (data.field === 'chat') {
            shouldScrollToBottomRef.current = true;
            setPartnerTyping(data.isTyping);
            clearTimeout(chatTypingFallback.current);
            if (data.isTyping) chatTypingFallback.current = setTimeout(() => setPartnerTyping(false), 3000);
          } else if (data.field === 'pad' && data.docId === activeDocIdRef.current) {
            setPartnerEditing(data.isTyping);
            clearTimeout(padTypingFallback.current);
            if (data.isTyping) padTypingFallback.current = setTimeout(() => setPartnerEditing(false), 3000);
          }
        } else if (data.type === 'itinerary') {
          setItineraries((prev) =>
            prev.map((doc) => (doc.id === data.docId ? { ...doc, content: data.text } : doc))
          );
          if (activeDocIdRef.current === data.docId) setActiveContent(data.text);
        }
      };

      socket.onclose = () => {
        if (isMounted) reconnectTimer = setTimeout(connectWS, 2500);
      };
    };

    connectWS();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (ws.current) {
        ws.current.onclose = null;
        ws.current.close();
        ws.current = null;
      }
    };
  }, [userId, safeSend]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeDocId && isDirtyPlanRef.current) {
        isDirtyPlanRef.current = false;
        fetch(`${API_BASE_URL}/api/itineraries/${activeDocId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: activeContent })
        }).catch((err) => console.error("Auto-save failed", err));
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [activeContent, activeDocId]);

  useEffect(() => {
    return () => {
      if (isDirtyPlanRef.current && activeDocIdRef.current) {
        isDirtyPlanRef.current = false;
        fetch(`${API_BASE_URL}/api/itineraries/${activeDocIdRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: activeContentRef.current }),
          keepalive: true
        }).catch(() => {});
      }
    };
  }, []);

  const handleItineraryChange = (e) => {
    const newText = e.target.value;
    isDirtyPlanRef.current = true;
    setActiveContent(newText);
    setItineraries((prev) =>
      prev.map((doc) => (doc.id === activeDocId ? { ...doc, content: newText } : doc))
    );

    safeSend({ type: 'itinerary', docId: activeDocId, text: newText, senderId: userId });
    safeSend({ type: 'typing', senderId: userId, isTyping: true, field: 'pad', docId: activeDocId });
    clearTimeout(padTypingTimeoutRef.current);
    padTypingTimeoutRef.current = setTimeout(
      () => safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'pad' }),
      1500
    );
  };

  const createNewPlan = () => {
    showDialog({
      type: 'confirm',
      title: 'New Date Plan',
      message: 'Give your new adventure a title:',
      showInput: true,
      inputValue: '',
      onConfirm: async (title) => {
        if (!title || !title.trim()) return;
        try {
          const res = await fetch(`${API_BASE_URL}/api/itineraries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title.trim() })
          });
          const newDoc = await res.json();
          setItineraries((prev) => [newDoc, ...prev]);
          setActiveDocId(newDoc.id);
          setActiveContent('');
          safeSend({ type: 'refresh_plans' });
        } catch (e) {
          console.error("Failed to create plan", e);
        }
      }
    });
  };

  const renamePlan = (doc) => {
    showDialog({
      type: 'confirm',
      title: 'Rename Plan',
      message: 'Enter a new title for this plan:',
      showInput: true,
      inputValue: doc.title,
      onConfirm: async (newTitle) => {
        if (!newTitle || !newTitle.trim()) return;
        try {
          const res = await fetch(`${API_BASE_URL}/api/itineraries/${doc.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle.trim() })
          });
          if (res.ok) {
            setItineraries((prev) =>
              prev.map((i) => (i.id === doc.id ? { ...i, title: newTitle.trim() } : i))
            );
            safeSend({ type: 'refresh_plans' });
          }
        } catch (e) {
          console.error("Failed to rename plan", e);
        }
      }
    });
  };

  const deleteCurrentPlan = () => {
    if (!activeDocId) return;
    showDialog({
      type: 'confirm',
      title: 'Delete Plan',
      message: 'Are you sure you want to delete this plan forever?',
      onConfirm: async () => {
        try {
          await fetch(`${API_BASE_URL}/api/itineraries/${activeDocId}`, { method: 'DELETE' });
          const remaining = itineraries.filter((i) => i.id !== activeDocId);
          setItineraries(remaining);
          if (remaining.length > 0) {
            setActiveDocId(remaining[0].id);
            setActiveContent(remaining[0].content || '');
          } else {
            setActiveDocId(null);
            setActiveContent('');
          }
          safeSend({ type: 'refresh_plans' });
        } catch (e) {
          console.error("Failed to delete plan", e);
        }
      }
    });
  };

  return (
    <div className="w-full flex-1 relative flex flex-col md:block">
      <div className="w-full h-full md:absolute md:inset-0 flex flex-col md:flex-row gap-6">
        <ChatPanel
          userId={userId}
          messages={messages}
          setMessages={setMessages}
          partnerTyping={partnerTyping}
          hasMoreOlderChats={hasMoreOlderChats}
          isLoadingOlderChats={isLoadingOlderChats}
          onLoadOlderChats={loadOlderChatsChunk}
          shouldScrollToBottomRef={shouldScrollToBottomRef}
          scrollRestoreRef={scrollRestoreRef}
          safeSend={safeSend}
          showDialog={showDialog}
        />

        <NotepadPanel
          itineraries={itineraries}
          activeDocId={activeDocId}
          setActiveDocId={setActiveDocId}
          activeContent={activeContent}
          setActiveContent={setActiveContent}
          partnerEditing={partnerEditing}
          onItineraryChange={handleItineraryChange}
          onCreateNewPlan={createNewPlan}
          onRenamePlan={renamePlan}
          onDeleteCurrentPlan={deleteCurrentPlan}
        />
      </div>
    </div>
  );
};

export default DatePlanner;
'''
}

# =====================================================================
# 2. EMPTY PLACEHOLDER FILES FOR UPCOMING ROADMAP FEATURES
# =====================================================================
EMPTY_PLACEHOLDER_FILES = [
    "frontend/src/utils/pwaPushUtils.js",
    "frontend/src/components/common/SmartSearchFilterBar.jsx",
    "frontend/src/components/common/ThemeMoodSwitcher.jsx",
    "frontend/src/components/vault/DualPovStoryNotes.jsx",
    "frontend/src/components/vault/AlbumVinylSoundtrack.jsx",
    "frontend/src/components/vault/MemoryMapModal.jsx",
    "frontend/src/components/planner/BucketListView.jsx",
    "frontend/src/components/planner/PookieConciergeModal.jsx",
    "frontend/src/components/planner/SyncedTheaterRoom.jsx",
    "frontend/src/components/ldr/DualCitySkyBar.jsx",
    "frontend/src/components/ldr/MeetupBoardingPass.jsx",
    "frontend/src/components/ldr/OpenWhenEnvelopes.jsx",
    "frontend/src/components/ldr/TouchAcrossMilesBtn.jsx",
    "frontend/src/components/widget/PocketLocketQuickDrop.jsx",
    "backend/routers/widget.py",
    "backend/routers/ldr.py",
]


def main():
    print("🌸 Setting up modular architecture for 'The Us Space'...\n")

    # 1. Write the active modular files
    for rel_path, code in ACTIVE_FILES.items():
        file_path = ROOT_DIR / rel_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(code.lstrip("\n"), encoding="utf-8")
        print(f"  ✅ Wrote active file:      {rel_path}")

    print()

    # 2. Create empty placeholder files (only if they don't already have content)
    for rel_path in EMPTY_PLACEHOLDER_FILES:
        file_path = ROOT_DIR / rel_path
        file_path.parent.mkdir(parents=True, exist_ok=True)
        if not file_path.exists():
            file_path.write_text("", encoding="utf-8")
            print(f"  📁 Created placeholder:    {rel_path}")
        else:
            print(f"  ⏭️  Placeholder exists:     {rel_path}")

    print("\n🎉 All modular folders, active Planner/Chat files, and roadmap placeholders are ready!")


if __name__ == "__main__":
    main()