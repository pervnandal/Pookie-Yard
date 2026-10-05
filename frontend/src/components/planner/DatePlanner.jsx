import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL, WS_BASE_URL } from '../../utils/apiUtils';

export const DatePlanner = ({ showDialog }) => {
  const [userId] = useState(() => {
    let stored = localStorage.getItem('us_planner_id');
    if (!stored) {
      stored = `user_${Math.floor(Math.random() * 10000)}`;
      localStorage.setItem('us_planner_id', stored);
    }
    return stored;
  });

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerEditing, setPartnerEditing] = useState(false);
  
  const [itineraries, setItineraries] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeContent, setActiveContent] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const ws = useRef(null);
  const chatContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const padTypingTimeoutRef = useRef(null);

  const safeSend = (payload) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload));
    }
  };

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/chats`)
      .then(res => res.json())
      .then(data => setMessages(data || []))
      .catch(err => console.error("Chat load failed", err));

    fetch(`${API_BASE_URL}/api/itineraries`)
      .then(res => res.json())
      .then(data => {
         setItineraries(data || []);
         if(data && data.length > 0) {
            setActiveDocId(data[0].id);
            setActiveContent(data[0].content || "");
         }
      })
      .catch(err => console.error("Itinerary load failed", err));
  }, []);

  useEffect(() => {
    if (activeDocId) {
      const doc = itineraries.find(i => i.id === activeDocId);
      if (doc) setActiveContent(doc.content || "");
    }
  }, [activeDocId]);

  useEffect(() => {
    let reconnectTimer;
    const connectWS = () => {
      ws.current = new WebSocket(`${WS_BASE_URL}/ws/chat`);
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'refresh_plans') {
           fetch(`${API_BASE_URL}/api/itineraries`)
             .then(res => res.json())
             .then(fetchedDocs => setItineraries(fetchedDocs || []));
           return;
        }

        if (data.senderId === userId) return;

        if (data.type === 'chat') {
          setMessages((prev) => [...prev, data]);
          safeSend({ type: 'read_receipt', senderId: userId });
        } 
        else if (data.type === 'read_receipt') {
          setMessages((prev) => prev.map(m => m.senderId === userId ? { ...m, status: 'read' } : m));
        }
        else if (data.type === 'typing') {
          if (data.field === 'chat') setPartnerTyping(data.isTyping);
          else if (data.field === 'pad') {
             if (data.docId === activeDocId) setPartnerEditing(data.isTyping);
          }
        } 
        else if (data.type === 'itinerary') {
          setItineraries(prev => prev.map(doc => doc.id === data.docId ? { ...doc, content: data.text } : doc));
          if (activeDocId === data.docId) setActiveContent(data.text);
        }
      };

      ws.current.onclose = () => {
        reconnectTimer = setTimeout(connectWS, 3000);
      };
    };

    connectWS();
    return () => { clearTimeout(reconnectTimer); if (ws.current) ws.current.close(); };
  }, [userId, activeDocId]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, partnerTyping]);

  useEffect(() => {
    const timer = setTimeout(() => {
       if (activeDocId) {
         fetch(`${API_BASE_URL}/api/itineraries/${activeDocId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ content: activeContent })
         }).catch(err => console.error("Auto-save failed", err));
       }
    }, 1500);
    return () => clearTimeout(timer);
  }, [activeContent, activeDocId]);

  const handleSend = (e) => {
    e.preventDefault();
    if (input.trim()) {
      const msgObj = { type: 'chat', text: input, senderId: userId, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent', id: Date.now() };
      safeSend(msgObj);
      setMessages((prev) => [...prev, msgObj]);
      setInput('');
      safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'chat' });
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    safeSend({ type: 'typing', senderId: userId, isTyping: true, field: 'chat' });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'chat' }), 1500);
  };

  const handleItineraryChange = (e) => {
    const newText = e.target.value;
    setActiveContent(newText);
    setItineraries(prev => prev.map(doc => doc.id === activeDocId ? { ...doc, content: newText } : doc));
    
    safeSend({ type: 'itinerary', docId: activeDocId, text: newText, senderId: userId });
    safeSend({ type: 'typing', senderId: userId, isTyping: true, field: 'pad', docId: activeDocId });
    clearTimeout(padTypingTimeoutRef.current);
    padTypingTimeoutRef.current = setTimeout(() => safeSend({ type: 'typing', senderId: userId, isTyping: false, field: 'pad' }), 1500);
  };

  const startVoiceMessage = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const msgObj = { type: 'chat', text: '', audio: reader.result, senderId: userId, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent', id: Date.now() };
          safeSend(msgObj);
          setMessages(prev => [...prev, msgObj]);
        };
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
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
        try {
          const res = await fetch(`${API_BASE_URL}/api/itineraries`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title })
          });
          const newDoc = await res.json();
          setItineraries(prev => [newDoc, ...prev]);
          setActiveDocId(newDoc.id);
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
        if (!newTitle.trim()) return;
        try {
          const res = await fetch(`${API_BASE_URL}/api/itineraries/${doc.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle.trim() })
          });
          if (res.ok) {
            setItineraries(prev => prev.map(i => i.id === doc.id ? { ...i, title: newTitle.trim() } : i));
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
          const remaining = itineraries.filter(i => i.id !== activeDocId);
          setItineraries(remaining);
          if (remaining.length > 0) setActiveDocId(remaining[0].id);
          else setActiveDocId(null);
          safeSend({ type: 'refresh_plans' });
        } catch (e) {
          console.error("Failed to delete plan", e);
        }
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-6 w-full h-full">
      <div className="w-full md:w-[35%] lg:w-[30%] flex flex-col bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden h-[500px] md:h-full shrink-0">
        <div className="bg-stone-50 border-b border-stone-100 p-5 shrink-0 flex items-center justify-between">
           <div>
             <h3 className="font-serif font-bold text-lg text-stone-800">Live Planner</h3>
             <div className="flex items-center gap-1.5 mt-1">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <p className="text-xs text-stone-500 font-medium">Connected</p>
             </div>
           </div>
           <span className="text-2xl">💬</span>
        </div>
        
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/30 custom-scrollbar">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2 opacity-70">
              <span className="text-4xl">👋</span>
              <p className="text-sm font-medium">Say hello!</p>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === userId || msg.senderId === userId;
            return (
              <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                 <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-rose-500 text-white rounded-br-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'}`}>
                    {msg.audio ? (
                       <audio src={msg.audio} controls className={`h-10 max-w-[200px] sm:max-w-[240px] outline-none ${isMe ? 'opacity-90 invert grayscale' : ''}`} />
                    ) : (
                       msg.text
                    )}
                 </div>
                 <div className="flex items-center gap-1 mt-1.5 px-1">
                     <span className="text-[10px] text-stone-400 font-medium">{msg.timestamp}</span>
                     {isMe && (
                         <Icons.CheckAll className={`w-[14px] h-[14px] transition-colors duration-300 ${msg.status === 'read' ? 'text-blue-500' : 'text-stone-300'}`} />
                     )}
                 </div>
              </div>
            )
          })}
          {partnerTyping && (
            <div className="flex justify-start animate-pulse">
              <div className="bg-white border border-stone-200 px-3 py-2 rounded-2xl text-xs text-stone-400 shadow-sm flex items-center gap-1">
                <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                <div className="w-1 h-1 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-100 flex gap-2 shrink-0 items-center">
            {isRecording ? (
                <div className="flex-1 flex items-center justify-between bg-rose-50 border border-rose-200 rounded-full px-4 py-2.5">
                    <div className="flex items-center gap-2 text-rose-500 font-medium text-sm">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span> Recording...
                    </div>
                    <button type="button" onClick={stopVoiceMessage} className="p-2 bg-rose-500 md:hover:bg-rose-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-sm transition-colors"><Icons.Send /></button>
                </div>
            ) : (
                <>
                   <input type="text" value={input} onChange={handleInputChange} placeholder="Type a message..." className="flex-1 bg-stone-100/50 border border-stone-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 placeholder:text-stone-400" />
                   {input.trim() ? (
                       <button type="submit" className="p-2.5 bg-stone-900 md:hover:bg-stone-800 text-white rounded-full flex items-center justify-center w-11 h-11 shrink-0"><Icons.Send /></button>
                   ) : (
                       <button type="button" onClick={startVoiceMessage} className="p-2.5 bg-rose-50 md:hover:bg-rose-100 text-rose-500 border border-rose-200 rounded-full flex items-center justify-center w-11 h-11 shrink-0 transition-colors"><Icons.Mic /></button>
                   )}
                </>
            )}
        </form>
      </div>

      <div className="w-full md:w-[65%] lg:w-[70%] flex flex-col md:flex-row bg-[#fdfbf7] rounded-3xl shadow-sm border border-stone-200 overflow-hidden font-serif h-[600px] md:h-full shrink-0">
         <div className="w-full md:w-48 lg:w-56 bg-stone-50/50 border-r border-stone-200 flex flex-col shrink-0 h-40 md:h-full">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-white/50 shrink-0">
               <span className="font-bold text-stone-700 font-sans text-sm tracking-wide uppercase">Plans</span>
               <button onClick={createNewPlan} className="text-rose-500 md:hover:bg-rose-100 p-1.5 rounded-md transition-colors" title="New Plan"><Icons.Plus /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
               {itineraries.length === 0 ? (
                 <div className="text-center p-4 text-xs font-sans text-stone-400">No plans yet. Click + to start!</div>
               ) : (
                 itineraries.map(doc => (
                   <div 
                     key={doc.id} 
                     className={`w-full rounded-xl flex items-center justify-between p-2 font-sans text-sm transition-all duration-200 ${activeDocId === doc.id ? 'bg-white shadow-sm border border-stone-200 font-bold text-rose-600' : 'md:hover:bg-stone-100 text-stone-600 border border-transparent'}`}
                   >
                     <button 
                       onClick={() => setActiveDocId(doc.id)}
                       className="flex items-center gap-2 flex-1 text-left min-w-0"
                     >
                       <Icons.FileText /> <span className="truncate">{doc.title}</span>
                     </button>
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         renamePlan(doc);
                       }}
                       className="p-1.5 text-stone-400 md:hover:text-stone-700 md:hover:bg-stone-200 rounded-md transition-colors shrink-0 ml-1"
                       title="Rename Plan"
                     >
                       <Icons.Edit />
                     </button>
                   </div>
                 ))
               )}
            </div>
         </div>

         <div className="flex-1 flex flex-col relative min-w-0 h-full">
             {activeDocId ? (
                <>
                   <div className="bg-white border-b border-stone-100 p-4 shrink-0 flex items-center justify-between z-10 shadow-sm relative">
                      <div className="flex items-center gap-3">
                        <h2 className="font-bold text-stone-800 text-xl tracking-tight truncate max-w-[200px] sm:max-w-xs">{itineraries.find(i=>i.id===activeDocId)?.title}</h2>
                        {partnerEditing && <span className="text-xs font-sans text-rose-500 font-medium animate-pulse ml-2 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 whitespace-nowrap">✨ Partner is typing...</span>}
                      </div>
                      
                      <div className="flex gap-2">
                        <button onClick={deleteCurrentPlan} className="text-stone-400 md:hover:text-red-500 md:hover:bg-red-50 p-2 rounded-full transition-colors" title="Delete Plan"><Icons.Trash /></button>
                      </div>
                   </div>
                   
                   <textarea
                      value={activeContent}
                      onChange={handleItineraryChange}
                      className="flex-1 w-full bg-transparent p-6 sm:p-8 resize-none focus:outline-none text-stone-700 leading-relaxed text-lg custom-scrollbar overflow-y-auto"
                      placeholder="Jot down your plans, timeline, and ideas here..."
                      style={{ backgroundImage: 'linear-gradient(transparent, transparent 31px, #e5e5e5 31px)', backgroundSize: '100% 32px', lineHeight: '32px' }}
                   />
                </>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-stone-400 opacity-60">
                   <Icons.FileText />
                   <p className="mt-2 font-sans font-medium">Select or create a plan</p>
                </div>
             )}
         </div>
      </div>
    </div>
  );
};

export default DatePlanner;