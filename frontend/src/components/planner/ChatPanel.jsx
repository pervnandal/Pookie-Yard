import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  showDialog,
  isChatFullscreen,
  setIsChatFullscreen
}) => {
  const [viewportRect, setViewportRect] = useState(null);

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

  // Lock page scroll & track visualViewport so the chat header is never cut off
  // and the typing bar sits 0px flush on top of the mobile keyboard
  useEffect(() => {
    if (!isChatFullscreen) {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      setViewportRect(null);
      return;
    }

    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = '0px';

    const syncViewport = () => {
      if (window.innerWidth >= 768) {
        setIsChatFullscreen(false);
        return;
      }
      if (window.visualViewport) {
        setViewportRect({
          top: Math.max(0, Math.round(window.visualViewport.offsetTop)),
          height: Math.round(window.visualViewport.height)
        });
      } else {
        setViewportRect({
          top: 0,
          height: window.innerHeight
        });
      }
      // Keep bottom messages visible right above the input bar when keyboard opens
      requestAnimationFrame(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      });
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('resize', syncViewport);
    window.visualViewport?.addEventListener('scroll', syncViewport);

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('resize', syncViewport);
      window.visualViewport?.removeEventListener('scroll', syncViewport);
    };
  }, [isChatFullscreen, setIsChatFullscreen]);

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

  const chatCardUI = (
    <div
      style={
        isChatFullscreen
          ? {
              position: 'fixed',
              left: 0,
              right: 0,
              top: viewportRect ? `${viewportRect.top}px` : '0px',
              height: viewportRect ? `${viewportRect.height}px` : '100dvh',
              zIndex: 9999
            }
          : undefined
      }
      className={
        isChatFullscreen
          ? 'w-screen bg-[#f8f5f2] flex flex-col overflow-hidden shadow-2xl'
          : 'flex flex-col w-full md:w-[350px] lg:w-[380px] shrink-0 h-[520px] md:h-full bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-xl border border-white/60 overflow-hidden'
      }
    >
      {/* Chat Header — Never Cut Off, Always Above Navbar */}
      <div className="h-[60px] shrink-0 px-3.5 border-b border-stone-200/90 flex items-center justify-between bg-white shadow-2xs z-20">
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
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
              <p className="text-[11px] text-stone-500 font-medium truncate">
                {partnerTyping ? 'Partner is typing...' : 'Online · Slide bubble to reply'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="hidden md:inline-block text-2xl opacity-80">💬</span>

          {/* Mobile-Only Fullscreen / Exit Fullscreen Button */}
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
                <span>Exit</span>
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
        className="flex-1 overflow-y-auto px-3 py-2.5 bg-[#f5f2ee] custom-scrollbar flex flex-col min-h-0"
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
        <div className="px-3 pt-2 pb-1 bg-white border-t border-stone-200/80 flex flex-col gap-1.5 z-10 shrink-0">
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

      {/* Input Form — Flush with Keyboard */}
      <form
        onSubmit={handleSend}
        className="shrink-0 px-2.5 py-2 bg-white border-t border-stone-200/80 flex gap-2 items-center z-10"
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
                onFocus={() => {
                  if (isChatFullscreen) {
                    window.scrollTo(0, 0);
                    setTimeout(() => {
                      if (chatContainerRef.current) {
                        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                      }
                    }, 100);
                  }
                }}
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
  );

  return (
    <>
      {/* Render via Portal on document.body when Fullscreen so Header and Pookie NEVER cover it */}
      {isChatFullscreen && typeof document !== 'undefined'
        ? createPortal(chatCardUI, document.body)
        : chatCardUI}

      <ChatMediaLightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
    </>
  );
};

export default ChatPanel;