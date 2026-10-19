import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  const [isChatFullscreen, setIsChatFullscreen] = useState(false);

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
          isChatFullscreen={isChatFullscreen}
          setIsChatFullscreen={setIsChatFullscreen}
        />

        {/* Hide Notepad on mobile when Chat is in Fullscreen so background page height doesn't scroll */}
        <div className={isChatFullscreen ? 'hidden md:flex flex-1 h-full min-w-0' : 'flex-1 flex h-[600px] md:h-full min-w-0'}>
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
    </div>
  );
};

export default DatePlanner;