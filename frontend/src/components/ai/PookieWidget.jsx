import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL } from '../../utils/apiUtils';

export const PookieWidget = ({ memories = [], onSelectMemory, isGalleryOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [coords, setCoords] = useState({ lat: null, lon: null });
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'pookie',
      text: "Hi love! 🌸 Ask me about our memories, the live weather anywhere, or cafes & date spots around any place!"
    }
  ]);

  const chatEndRef = useRef(null);

  // Acquire user GPS coordinates once for real-time local weather & map intelligence
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  // Hide widget when full-screen gallery is open so it doesn't overlap gallery buttons
  if (isGalleryOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg = { id: `u_${Date.now()}`, sender: 'user', text: trimmed };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/pookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          lat: coords.lat,
          lon: coords.lon,
          history: updatedHistory.slice(-6)
        })
      });

      if (response.ok) {
        const data = await response.json();
        const linkedMemory = data.memory_id
          ? memories.find((m) => m.id === data.memory_id)
          : null;

        setMessages((prev) => [
          ...prev,
          {
            id: `p_${Date.now()}`,
            sender: 'pookie',
            text: data.reply || "I'm right here with you! 💕",
            memory: linkedMemory || null
          }
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: 'pookie',
            text: "Oops, my connection fluttered for a second! Try asking me again? 🥺"
          }
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'pookie',
          text: "I couldn't reach the server right now. Check if the backend is running! 💭"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[90] font-sans">
      {isOpen ? (
        <div className="w-[calc(100vw-2.5rem)] sm:w-[380px] h-[520px] max-h-[80vh] bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/70 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🌸</span>
              <div>
                <h3 className="font-serif font-bold text-base leading-tight">Pookie AI</h3>
                <p className="text-[11px] text-rose-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  Memory, Weather & Map Guide
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white"
              title="Minimize"
            >
              <Icons.X />
            </button>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-stone-50/40">
            {messages.map((m) => {
              const isPookie = m.sender === 'pookie';
              return (
                <div key={m.id} className={`flex flex-col ${isPookie ? 'items-start' : 'items-end'}`}>
                  <div
                    className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap ${
                      isPookie
                        ? 'bg-white border border-stone-200/80 text-stone-800 rounded-bl-sm'
                        : 'bg-rose-500 text-white rounded-br-sm'
                    }`}
                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  >
                    {m.text}
                  </div>

                  {m.memory && onSelectMemory && (
                    <button
                      onClick={() => onSelectMemory(m.memory)}
                      className="mt-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold px-3 py-1.5 rounded-full shadow-sm transition-all flex items-center gap-1.5"
                    >
                      📸 Open "{m.memory.title}"
                    </button>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Bar */}
          <form onSubmit={handleSend} className="p-3 bg-white/90 border-t border-stone-200/70 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a place, weather, or memory..."
              className="flex-1 min-w-0 bg-stone-100 border border-stone-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 placeholder:text-stone-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white rounded-full flex items-center justify-center w-10 h-10 shrink-0 shadow-md transition-transform active:scale-95"
            >
              <Icons.Send />
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-stone-900/95 hover:bg-stone-800 backdrop-blur-xl text-white px-5 py-3.5 rounded-full shadow-xl hover:shadow-2xl border border-white/20 flex items-center gap-2.5 transition-all hover:scale-105 active:scale-95"
        >
          <span className="text-lg">💬</span>
          <span className="font-semibold text-sm tracking-wide">Pookie</span>
        </button>
      )}
    </div>
  );
};

export default PookieWidget;

// import React, { useState, useEffect, useRef } from 'react';
// import { Icons } from '../common/Icons';
// import { parseMediaUrl } from '../../utils/mediaParser';
// import { API_BASE_URL } from '../../utils/apiUtils';

// export const PookieWidget = ({ memories, onSelectMemory, isGalleryOpen }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const [messages, setMessages] = useState([{ text: "Hi! I'm Pookie 🎀 Your personal couple's concierge and date planner. Need a date idea or want to reminisce about a past memory?", sender: "pookie" }]);
//   const [input, setInput] = useState('');
//   const [isTyping, setIsTyping] = useState(false);
//   const pookieChatRef = useRef(null);

//   useEffect(() => {
//     if (isOpen && pookieChatRef.current) {
//       pookieChatRef.current.scrollTop = pookieChatRef.current.scrollHeight;
//     }
//   }, [messages, isOpen, isTyping]);

//   if (isGalleryOpen) return null; 

//   const handleSend = async (e) => {
//     e.preventDefault();
//     if (!input.trim() || isTyping) return;

//     const userMessage = { text: input, sender: 'user' };
//     const chatHistory = [...messages];
    
//     setMessages(prev => [...prev, userMessage]);
//     setInput('');
//     setIsTyping(true);

//     try {
//       const response = await fetch(`${API_BASE_URL}/api/pookie/chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ message: userMessage.text, history: chatHistory.slice(-6) })
//       });
//       if (response.ok) {
//         const data = await response.json();
//         setMessages(prev => [...prev, { text: data.reply, sender: 'pookie' }]);
//       } else setMessages(prev => [...prev, { text: "Oops, my brain is a little fuzzy right now. Try again?", sender: 'pookie' }]);
//     } catch (error) {
//       setMessages(prev => [...prev, { text: "I can't connect to the server! 😢", sender: 'pookie' }]);
//     } finally {
//       setIsTyping(false);
//     }
//   };

//   const renderMessageContent = (text) => {
//     const urlRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s]*)?)/gi;
//     const parts = text.split(urlRegex);

//     return parts.map((part, index) => {
//       if (urlRegex.test(part)) {
//         const matchingMemory = memories?.find(m => m.memory_media?.some(med => {
//             const parsed = parseMediaUrl(med.file_url);
//             return parsed.original === part || parsed.thumb === part || med.file_url === part;
//         }));
//         return (
//           <div key={index} className="mt-3 space-y-2">
//             <div className="rounded-xl overflow-hidden shadow-md bg-black max-h-56">
//               <img src={part} loading="lazy" alt="Memory preview" className="w-full h-full object-cover cursor-pointer md:hover:scale-105 transition-transform duration-300" onClick={() => window.open(part, '_blank')} />
//             </div>
//             {matchingMemory && (
//               <button onClick={() => { onSelectMemory(matchingMemory); setIsOpen(false); }} className="w-full bg-rose-50 md:hover:bg-rose-100 text-rose-600 text-xs font-bold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-rose-100 shadow-sm">
//                 ✨ Open "{matchingMemory.title}" Album
//               </button>
//             )}
//           </div>
//         );
//       }
//       return <span key={index} className="whitespace-pre-wrap break-words">{part}</span>;
//     });
//   };

//   return (
//     <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end pointer-events-none">
//       <div className={`mb-4 w-[90vw] sm:w-[380px] bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden transition-all duration-300 transform origin-bottom-right ${isOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-0 opacity-0 pointer-events-none'}`}>
//         <div className="bg-rose-500 p-4 flex items-center justify-between text-white shrink-0">
//           <div className="flex items-center gap-2">
//             <span className="text-2xl bg-white/20 p-1.5 rounded-full leading-none">🎀</span>
//             <div>
//               <h3 className="font-bold text-sm">Pookie</h3>
//               <p className="text-[10px] text-rose-100 font-medium tracking-wide uppercase">AI Concierge & Planner</p>
//             </div>
//           </div>
//           <button onClick={() => setIsOpen(false)} className="text-rose-100 hover:text-white transition-colors bg-rose-600/50 hover:bg-rose-600 p-1.5 rounded-full"><Icons.X /></button>
//         </div>

//         <div ref={pookieChatRef} className="h-[380px] p-4 overflow-y-auto bg-stone-50 flex flex-col gap-3 custom-scrollbar">
//           {messages.map((msg, idx) => (
//             <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in zoom-in-95 duration-200`}>
//               <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-stone-800 text-white rounded-br-sm' : 'bg-white border border-stone-200 text-stone-700 rounded-bl-sm'}`}>
//                 {renderMessageContent(msg.text)}
//               </div>
//             </div>
//           ))}
//           {isTyping && (
//             <div className="flex justify-start animate-in fade-in zoom-in-95 duration-200">
//                <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-1">
//                  <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce"></div>
//                  <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
//                  <div className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
//                </div>
//             </div>
//           )}
//         </div>

//         <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-100 flex gap-2 shrink-0">
//           <input type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={isTyping} placeholder="Ask Pookie anything..." className="flex-1 bg-stone-100 border border-stone-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400" />
//           <button type="submit" disabled={!input.trim() || isTyping} className="p-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white rounded-full flex items-center justify-center shadow-sm w-10 h-10 shrink-0"><Icons.Send /></button>
//         </form>
//       </div>

//       <button onClick={() => setIsOpen(!isOpen)} className="pointer-events-auto bg-stone-900 hover:bg-stone-800 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-stone-200">
//         {isOpen ? <Icons.X /> : <span className="flex items-center gap-2"><Icons.MessageCircle /> <span className="font-bold font-sans text-sm pr-1">Pookie</span></span>}
//       </button>
//     </div>
//   );
// };

// export default PookieWidget;