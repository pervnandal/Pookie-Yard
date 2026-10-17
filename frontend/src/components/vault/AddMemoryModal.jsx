import React, { useState, useRef } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL, uploadFilesWithProgress } from '../../utils/apiUtils';

export const AddMemoryModal = ({ isOpen, onClose, onMemoryAdded, showDialog }) => {
  const [title, setTitle] = useState('');
  const [memoryDate, setMemoryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [files, setFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
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
        const voiceFile = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        setFiles((prev) => [...prev, voiceFile]);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch {
      showDialog({ type: 'alert', title: 'Microphone Access', message: 'Please allow microphone access to record a voice note.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !memoryDate) {
      showDialog({ type: 'alert', title: 'Missing Info', message: 'Please provide a title and date for this memory.' });
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('memory_date', memoryDate);
    formData.append('description', description);
    formData.append('is_private', String(isPrivate));
    files.forEach((file) => formData.append('files', file));

    uploadFilesWithProgress(
      `${API_BASE_URL}/api/memories`,
      formData,
      (percent) => setUploadProgress(percent),
      () => {
        setIsSubmitting(false);
        setTitle('');
        setDescription('');
        setFiles([]);
        setIsPrivate(false);
        onMemoryAdded();
        onClose();
      },
      (err) => {
        setIsSubmitting(false);
        showDialog({
          type: 'alert',
          title: 'Save Failed',
          message: err?.detail || 'Could not upload memory. Please try again.'
        });
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/90 backdrop-blur-2xl border border-white/70 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-stone-800">Add New Memory</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors"
          >
            <Icons.X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">Memory Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sunset Coffee Date"
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">Date</label>
              <input
                type="date"
                required
                value={memoryDate}
                onChange={(e) => setMemoryDate(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setIsPrivate(!isPrivate)}
                className={`w-full py-3 px-4 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                  isPrivate
                    ? 'bg-rose-50 border-rose-300 text-rose-600'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Icons.Lock />
                <span>{isPrivate ? 'Private Memory' : 'Standard Memory'}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">The Story</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Write down every little detail you want to remember..."
              className="w-full bg-white border border-stone-200 rounded-xl p-4 text-sm focus:outline-none focus:border-rose-400 resize-none custom-scrollbar"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Photos, Videos & Voice Notes</label>
            <div className="flex flex-wrap gap-2">
              <label className="flex-1 cursor-pointer bg-stone-100 hover:bg-stone-200/70 border border-dashed border-stone-300 rounded-2xl p-4 text-center transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="text-xs font-semibold text-stone-600 block">📎 Select Photos or Videos</span>
              </label>

              {isRecording ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-4 py-3 bg-rose-500 text-white rounded-2xl text-xs font-bold flex items-center gap-2 animate-pulse"
                >
                  ⏹ Stop Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-2xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Icons.Mic /> Record Voice
                </button>
              )}
            </div>

            {files.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-stone-50 border border-stone-200/80 px-3 py-2 rounded-xl text-xs">
                    <span className="truncate max-w-[240px] font-medium text-stone-700">
                      {f.type.startsWith('video/') ? '🎬 ' : f.type.startsWith('audio/') ? '🎤 ' : '🖼️ '}
                      {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="text-stone-400 hover:text-red-500 font-bold ml-2"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isSubmitting && (
            <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden border border-stone-200">
              <div
                className="bg-gradient-to-r from-rose-500 to-pink-500 h-full transition-all duration-300"
                style={{ width: `${Math.max(8, uploadProgress)}%` }}
              />
              <p className="text-[11px] text-center text-stone-500 mt-1 font-medium">
                Uploading media ({uploadProgress}%)... Videos may take a moment to process.
              </p>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-full text-sm font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-lg transition-all disabled:opacity-50"
            >
              {isSubmitting ? `Saving (${uploadProgress}%)...` : 'Save Memory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemoryModal;

// import React, { useState, useRef } from 'react';
// import { Icons } from '../common/Icons';
// import { API_BASE_URL, uploadFilesWithProgress } from '../../utils/apiUtils';

// export const AddMemoryModal = ({ isOpen, onClose, onMemoryAdded, showDialog }) => {
//   const [files, setFiles] = useState([]);
//   const [previewUrls, setPreviewUrls] = useState([]);
//   const [date, setDate] = useState('');
//   const [title, setTitle] = useState('');
//   const [description, setDescription] = useState('');
//   const [isPrivate, setIsPrivate] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [uploadProgress, setUploadProgress] = useState(0);

//   const [isRecording, setIsRecording] = useState(false);
//   const mediaRecorderRef = useRef(null);
//   const audioChunksRef = useRef([]);

//   if (!isOpen) return null;

//   const handleFileChange = (e) => {
//     const selectedFiles = Array.from(e.target.files);
//     if (selectedFiles.length > 0) {
//       setFiles(prev => [...prev, ...selectedFiles]);
//       const newUrls = selectedFiles.map(file => URL.createObjectURL(file));
//       setPreviewUrls(prev => [...prev, ...newUrls]);
//     }
//   };

//   const removeFile = (indexToRemove) => {
//     setFiles(files.filter((_, index) => index !== indexToRemove));
//     setPreviewUrls(previewUrls.filter((_, index) => index !== indexToRemove));
//   };

//   const startRecording = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//       mediaRecorderRef.current = new MediaRecorder(stream);
//       audioChunksRef.current = [];
//       mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
//       mediaRecorderRef.current.onstop = () => {
//         const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
//         const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
//         setFiles(prev => [...prev, file]);
//         setPreviewUrls(prev => [...prev, URL.createObjectURL(blob)]);
//         stream.getTracks().forEach(track => track.stop());
//       };
//       mediaRecorderRef.current.start();
//       setIsRecording(true);
//     } catch (err) {
//       showDialog({ type: 'alert', title: 'Mic Access', message: 'Please allow microphone access to record.' });
//     }
//   };

//   const stopRecording = () => {
//     if (mediaRecorderRef.current && isRecording) {
//       mediaRecorderRef.current.stop();
//       setIsRecording(false);
//     }
//   };

//   const handleSubmit = () => {
//     if (files.length === 0 || !date || !title) {
//       showDialog({ type: 'alert', title: 'Missing Info', message: 'Please provide at least one photo/audio, a date, and a title!' });
//       return;
//     }
//     setIsSubmitting(true);
//     setUploadProgress(0);
    
//     const formData = new FormData();
//     formData.append('date', date);
//     formData.append('title', title);
//     formData.append('description', description);
//     formData.append('is_private', isPrivate.toString()); 
//     files.forEach(file => formData.append('files', file));

//     uploadFilesWithProgress(
//       `${API_BASE_URL}/api/memories`,
//       formData,
//       (percent) => setUploadProgress(percent),
//       (response) => {
//         setFiles([]); setPreviewUrls([]); setDate(''); setTitle(''); setDescription(''); setIsPrivate(false);
//         setIsSubmitting(false);
//         onMemoryAdded(); 
//         onClose();
//       },
//       (error) => {
//         setIsSubmitting(false);
//         showDialog({ type: 'alert', title: 'Save Failed', message: error.detail || 'Unknown error' });
//       }
//     );
//   };

//   return (
//     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
//       <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && onClose()}></div>
//       <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl transform transition-all max-h-[90vh] flex flex-col">
//         <div className="bg-[#faf9f8] px-6 py-4 border-b border-stone-100 flex justify-between items-center shrink-0">
//           <h3 className="text-xl font-serif font-bold text-stone-800">Vault a New Memory</h3>
//           <button onClick={() => !isSubmitting && onClose()} className="text-stone-400 md:hover:text-stone-600 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-200 rounded-full"><Icons.X /></button>
//         </div>

//         <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
//           <div className="relative border-2 border-dashed border-rose-200 rounded-2xl bg-rose-50/50 p-6 text-center transition-colors group overflow-hidden min-h-[160px] flex flex-col items-center justify-center">
//             <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" disabled={isSubmitting} />
//             {previewUrls.length > 0 ? (
//               <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full z-30 relative pointer-events-none">
//                 {previewUrls.map((url, index) => (
//                   <div key={index} className="relative aspect-square rounded-lg overflow-hidden shadow-sm pointer-events-auto bg-black group/item flex items-center justify-center">
//                     {/\.(webm|mp3|wav|ogg)$/i.test(files[index].name) && files[index].name.includes('voice_note') ? (
//                        <div className="text-rose-400 bg-rose-500/20 w-full h-full flex flex-col items-center justify-center gap-2"><Icons.Mic /><span className="text-[10px] uppercase font-bold">Audio</span></div>
//                     ) : /\.(mp4|webm|mov|ogg)$/i.test(files[index].name) ? (
//                        <video src={url} className="w-full h-full object-cover opacity-70" />
//                     ) : (
//                        <img src={url} alt="Preview" loading="lazy" className="w-full h-full object-cover" />
//                     )}
//                     <button onClick={(e) => { e.stopPropagation(); removeFile(index); }} disabled={isSubmitting} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md md:hover:bg-red-600 scale-0 group-hover/item:scale-100 transition-transform">
//                       <Icons.X />
//                     </button>
//                   </div>
//                 ))}
//                 <div className="aspect-square rounded-lg border-2 border-dashed border-rose-300 flex flex-col items-center justify-center text-rose-400 md:hover:bg-rose-100 transition-colors cursor-pointer pointer-events-auto">
//                   <Icons.Plus />
//                   <span className="text-xs font-medium mt-1">Add More</span>
//                 </div>
//               </div>
//             ) : (
//               <div className="pointer-events-none">
//                 <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📸</div>
//                 <p className="text-sm font-medium text-rose-600">Click or drag photos/videos here</p>
//                 <p className="text-xs text-stone-400 mt-1">Select multiple files at once</p>
//               </div>
//             )}
//           </div>
          
//           <div className="flex justify-center">
//              {isRecording ? (
//                 <button onClick={stopRecording} disabled={isSubmitting} className="bg-red-500 md:hover:bg-red-600 text-white px-6 py-2.5 rounded-full font-bold shadow-md animate-pulse flex items-center gap-2">
//                    <div className="w-2 h-2 bg-white rounded-full"></div> Stop Recording
//                 </button>
//              ) : (
//                 <button onClick={startRecording} disabled={isSubmitting} className="bg-rose-50 md:hover:bg-rose-100 text-rose-600 border border-rose-200 px-6 py-2.5 rounded-full font-bold shadow-sm flex items-center gap-2 transition-colors">
//                    <Icons.Mic /> Record Voice Note
//                 </button>
//              )}
//           </div>

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
//             <div>
//               <label className="block text-sm font-medium text-stone-700 mb-1">When did this happen?</label>
//               <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSubmitting} className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-600 bg-[#faf9f8]" />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-stone-700 mb-1">Headline / Title</label>
//               <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSubmitting} placeholder="e.g., Coffee Shop Date" className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-800 placeholder-stone-400 bg-[#faf9f8]" />
//             </div>
//           </div>
//           <div>
//             <label className="block text-sm font-medium text-stone-700 mb-1">The Story</label>
//             <textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} placeholder="Write the details here..." className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-800 placeholder-stone-400 bg-[#faf9f8] resize-none custom-scrollbar" ></textarea>
//           </div>
          
//           <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer" onClick={() => !isSubmitting && setIsPrivate(!isPrivate)}>
//              <input type="checkbox" checked={isPrivate} readOnly className="w-5 h-5 accent-rose-500 rounded focus:ring-rose-500 cursor-pointer pointer-events-none" />
//              <div className="flex-1 select-none">
//                <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">Keep this Memory Private <Icons.Lock /></h4>
//                <p className="text-xs text-stone-500 mt-0.5">Hide this from the Daily Chronicle and Pookie's memory bank.</p>
//              </div>
//           </div>
//         </div>

//         <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3 shrink-0 relative overflow-hidden">
//           {isSubmitting && (
//             <div className="absolute top-0 left-0 h-1 bg-rose-200 w-full">
//               <div className="h-full bg-rose-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
//             </div>
//           )}
//           <button onClick={onClose} disabled={isSubmitting} className="px-5 py-2 rounded-full font-medium text-stone-600 md:hover:bg-stone-200 transition-colors">Cancel</button>
//           <button onClick={handleSubmit} disabled={isSubmitting} className="bg-rose-500 md:hover:bg-rose-600 disabled:bg-rose-400 text-white px-6 py-2 rounded-full font-medium transition-all shadow-sm flex items-center gap-2 min-w-[140px] justify-center">
//             {isSubmitting ? (
//                <span className="flex items-center gap-2">
//                  <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full"></span>
//                  Saving ({uploadProgress}%)
//                </span>
//             ) : 'Save to Vault'}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default AddMemoryModal;