import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL, WS_BASE_URL } from '../../utils/apiUtils';

const CHAT_CHUNK_SIZE = 25;
const CHATS_CACHE_KEY = 'us_planner_chats_chunk_v1';
const ITINERARIES_CACHE_KEY = 'us_planner_itineraries_cache_v1';
const ACTIVE_DOC_CACHE_KEY = 'us_planner_active_doc_v1';

// Deduplicates adjacent or identical messages
const deduplicateMessages = (list) => {
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

// Saves only the latest chunk of 25 messages to localStorage so it stays fast and lightweight
const saveChatChunkToCache = (msgs) => {
  try {
    const recentChunk = msgs.slice(-CHAT_CHUNK_SIZE);
    localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(recentChunk));
  } catch {
    // Ignore storage quota warnings if audio notes are large
  }
};

export const DatePlanner = ({ showDialog }) => {
  const [userId] = useState(() => {
    let stored = localStorage.getItem('us_planner_id');
    if (!stored) {
      stored = `user_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem('us_planner_id', stored);
    }
    return stored;
  });

  // 1. Instant 0ms load of recent chat chunk from localStorage
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

  const [input, setInput] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerEditing, setPartnerEditing] = useState(false);

  // 2. Instant 0ms load of Date Planner Itineraries & Active Plan from localStorage
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

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const ws = useRef(null);
  const chatContainerRef = useRef(null);

  // Scroll management refs so prepending older chat chunks never jumps the viewport
  const shouldScrollToBottomRef = useRef(true);
  const scrollRestoreRef = useRef(null);
  const isDirtyPlanRef = useRef(false);
  const activeContentRef = useRef(activeContent);
  const activeDocIdRef = useRef(activeDocId);

  const typingTimeoutRef = useRef(null);
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

  // Write-through cache for itineraries
  useEffect(() => {
    try {
      localStorage.setItem(ITINERARIES_CACHE_KEY, JSON.stringify(itineraries));
    } catch {}
  }, [itineraries]);

  const safeSend = (payload) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
    }
  };

  // --- INITIAL STALE-WHILE-REVALIDATE SYNC ---
  useEffect(() => {
    // Fetch only the latest chunk of chats (25 items)
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

    // Revalidate itineraries in background
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

  // --- SCROLL-UP CHUNK PAGINATION FOR OLDER CHATS ---
  const loadOlderChatsChunk = useCallback(async () => {
    if (isLoadingOlderChats || !hasMoreOlderChats || messages.length === 0) return;

    // Find the earliest numeric database ID in the currently loaded messages
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
          if (chatContainerRef.current) {
            scrollRestoreRef.current = {
              prevScrollHeight: chatContainerRef.current.scrollHeight,
              prevScrollTop: chatContainerRef.current.scrollTop
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

  const handleChatScroll = (e) => {
    const el = e.currentTarget;
    if (el.scrollTop <= 25 && hasMoreOlderChats && !isLoadingOlderChats) {
      loadOlderChatsChunk();
    }
  };

  // Restore exact scroll offset after prepending older messages at the top
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
  }, [messages, partnerTyping]);

  useEffect(() => {
    if (activeDocId) {
      const doc = itineraries.find((i) => i.id === activeDocId);
      if (doc && !isDirtyPlanRef.current) {
        setActiveContent(doc.content || '');
      }
    }
  }, [activeDocId]);

  // --- LIVE WEBSOCKET ENGINE ---
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
              if (Array.isArray(fetchedDocs)) {
                setItineraries(fetchedDocs);
              }
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
          } else if (data.field === 'pad') {
            if (data.docId === activeDocIdRef.current) {
              setPartnerEditing(data.isTyping);
              clearTimeout(padTypingFallback.current);
              if (data.isTyping) padTypingFallback.current = setTimeout(() => setPartnerEditing(false), 3000);
            }
          }
        } else if (data.type === 'itinerary') {
          setItineraries((prev) =>
            prev.map((doc) => (doc.id === data.docId ? { ...doc, content: data.text } : doc))
          );
          if (activeDocIdRef.current === data.docId) setActiveContent(data.text);
        }
      };

      socket.onclose = () => {
        if (isMounted) {
          reconnectTimer = setTimeout(connectWS, 2500);
        }
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
  }, [userId]);

  // Debounced auto-save to Supabase + flush on unmount if user switches tabs quickly
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

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const msgObj = {
        type: 'chat',
        text: input,
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
      setInput('');
      safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'chat' });
    }
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
          const msgObj = {
            type: 'chat',
            text: '',
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
        
        {/* CHAT BOX */}
        <div className="flex flex-col w-full md:w-[350px] lg:w-[380px] shrink-0 h-[500px] md:h-full bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-xl border border-white/60 overflow-hidden">
          
          <div className="h-[76px] shrink-0 p-5 border-b border-stone-100 flex items-center justify-between bg-white/50 z-10">
            <div>
              <h3 className="font-serif font-bold text-xl text-stone-800 tracking-tight">Live Planner</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-xs text-stone-500 font-medium">Connected</p>
              </div>
            </div>
            <span className="text-3xl opacity-80">💬</span>
          </div>
          
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto p-4 space-y-5 bg-stone-50/40 custom-scrollbar"
          >
            {/* Indicator when loading older chunks on scroll-up */}
            {isLoadingOlderChats && (
              <div className="flex justify-center py-2">
                <span className="text-[11px] font-medium text-stone-500 bg-white/80 px-3 py-1 rounded-full shadow-sm border border-stone-200/60 animate-pulse">
                  Loading older messages...
                </span>
              </div>
            )}

            {messages.length === 0 && !isLoadingOlderChats && (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2 opacity-70">
                <span className="text-4xl animate-bounce">👋</span>
                <p className="text-sm font-medium">Say hello!</p>
              </div>
            )}

            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === userId || msg.senderId === userId;
              return (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col w-full ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm ${
                      isMe
                        ? 'bg-rose-500 text-white rounded-br-sm'
                        : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                    }`}
                    style={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}
                  >
                    {msg.audio ? (
                      <audio
                        src={msg.audio}
                        controls
                        className={`h-10 max-w-[200px] sm:max-w-[240px] outline-none ${
                          isMe ? 'opacity-90 invert grayscale' : ''
                        }`}
                      />
                    ) : (
                      msg.text
                    )}
                  </div>

                  <div className="flex items-center gap-1 mt-1.5 px-1">
                    <span className="text-[10px] text-stone-400 font-medium tracking-wide">{msg.timestamp}</span>
                    {isMe && (
                      <Icons.CheckAll
                        className={`w-[14px] h-[14px] transition-colors duration-300 ${
                          msg.status === 'read' ? 'text-blue-500' : 'text-stone-300'
                        }`}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {partnerTyping && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
                <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl text-xs text-stone-400 shadow-sm flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="h-[84px] shrink-0 p-4 bg-white/50 border-t border-stone-100 flex gap-3 items-center z-10">
            {isRecording ? (
              <div className="flex-1 flex items-center justify-between bg-rose-50 border border-rose-200 rounded-full px-4 py-3">
                <div className="flex items-center gap-2 text-rose-500 font-medium text-sm">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span> Recording...
                </div>
                <button
                  type="button"
                  onClick={stopVoiceMessage}
                  className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors"
                >
                  <Icons.Send />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Type a message..."
                  className="flex-1 min-w-0 bg-stone-100 border border-stone-200 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 placeholder:text-stone-400 shadow-inner"
                />
                {input.trim() ? (
                  <button
                    type="submit"
                    className="shrink-0 p-3 bg-stone-900 hover:bg-stone-800 text-white rounded-full flex items-center justify-center w-[52px] h-[52px] shadow-md transition-transform active:scale-95"
                  >
                    <Icons.Send />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startVoiceMessage}
                    className="shrink-0 p-3 bg-rose-50 hover:bg-rose-100 text-rose-500 border border-rose-200 rounded-full flex items-center justify-center w-[52px] h-[52px] transition-colors shadow-sm"
                  >
                    <Icons.Mic />
                  </button>
                )}
              </>
            )}
          </form>
        </div>

        {/* NOTEPAD PANEL */}
        <div className="flex-1 flex flex-col md:flex-row bg-white/50 backdrop-blur-2xl rounded-[2rem] shadow-xl border border-white/60 h-[600px] md:h-full overflow-hidden">
          
          {/* Navigation Sidebar */}
          <div className="flex flex-col w-full md:w-44 lg:w-52 shrink-0 bg-white/30 border-b md:border-b-0 md:border-r border-white/40 h-[25vh] md:h-full min-h-0 min-w-0">
            <div className="h-[76px] shrink-0 p-5 border-b border-stone-200 flex justify-between items-center bg-white/50">
              <span className="font-bold text-stone-800 font-sans text-xs tracking-widest uppercase">Saved Plans</span>
              <button
                onClick={createNewPlan}
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
                        renamePlan(doc);
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
                    onClick={deleteCurrentPlan}
                    className="shrink-0 text-stone-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-full transition-colors"
                    title="Delete Plan"
                  >
                    <Icons.Trash />
                  </button>
                </div>

                <textarea
                  value={activeContent}
                  onChange={handleItineraryChange}
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

      </div>
    </div>
  );
};

export default DatePlanner;