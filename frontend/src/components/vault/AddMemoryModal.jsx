import React, { useState, useRef } from 'react';
import { Icons } from '../common/Icons';
import { API_BASE_URL, uploadFilesWithProgress } from '../../utils/apiUtils';

export const AddMemoryModal = ({ isOpen, onClose, onMemoryAdded, showDialog }) => {
  const [files, setFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      setFiles(prev => [...prev, ...selectedFiles]);
      const newUrls = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newUrls]);
    }
  };

  const removeFile = (indexToRemove) => {
    setFiles(files.filter((_, index) => index !== indexToRemove));
    setPreviewUrls(previewUrls.filter((_, index) => index !== indexToRemove));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        setFiles(prev => [...prev, file]);
        setPreviewUrls(prev => [...prev, URL.createObjectURL(blob)]);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      showDialog({ type: 'alert', title: 'Mic Access', message: 'Please allow microphone access to record.' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = () => {
    if (files.length === 0 || !date || !title) {
      showDialog({ type: 'alert', title: 'Missing Info', message: 'Please provide at least one photo/audio, a date, and a title!' });
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    formData.append('date', date);
    formData.append('title', title);
    formData.append('description', description);
    formData.append('is_private', isPrivate.toString()); 
    files.forEach(file => formData.append('files', file));

    uploadFilesWithProgress(
      `${API_BASE_URL}/api/memories`,
      formData,
      (percent) => setUploadProgress(percent),
      (response) => {
        setFiles([]); setPreviewUrls([]); setDate(''); setTitle(''); setDescription(''); setIsPrivate(false);
        setIsSubmitting(false);
        onMemoryAdded(); 
        onClose();
      },
      (error) => {
        setIsSubmitting(false);
        showDialog({ type: 'alert', title: 'Save Failed', message: error.detail || 'Unknown error' });
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && onClose()}></div>
      <div className="relative bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl transform transition-all max-h-[90vh] flex flex-col">
        <div className="bg-[#faf9f8] px-6 py-4 border-b border-stone-100 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-serif font-bold text-stone-800">Vault a New Memory</h3>
          <button onClick={() => !isSubmitting && onClose()} className="text-stone-400 md:hover:text-stone-600 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-200 rounded-full"><Icons.X /></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          <div className="relative border-2 border-dashed border-rose-200 rounded-2xl bg-rose-50/50 p-6 text-center transition-colors group overflow-hidden min-h-[160px] flex flex-col items-center justify-center">
            <input type="file" multiple accept="image/*,video/*" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" disabled={isSubmitting} />
            {previewUrls.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 w-full z-30 relative pointer-events-none">
                {previewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden shadow-sm pointer-events-auto bg-black group/item flex items-center justify-center">
                    {/\.(webm|mp3|wav|ogg)$/i.test(files[index].name) && files[index].name.includes('voice_note') ? (
                       <div className="text-rose-400 bg-rose-500/20 w-full h-full flex flex-col items-center justify-center gap-2"><Icons.Mic /><span className="text-[10px] uppercase font-bold">Audio</span></div>
                    ) : /\.(mp4|webm|mov|ogg)$/i.test(files[index].name) ? (
                       <video src={url} className="w-full h-full object-cover opacity-70" />
                    ) : (
                       <img src={url} alt="Preview" loading="lazy" className="w-full h-full object-cover" />
                    )}
                    <button onClick={(e) => { e.stopPropagation(); removeFile(index); }} disabled={isSubmitting} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md md:hover:bg-red-600 scale-0 group-hover/item:scale-100 transition-transform">
                      <Icons.X />
                    </button>
                  </div>
                ))}
                <div className="aspect-square rounded-lg border-2 border-dashed border-rose-300 flex flex-col items-center justify-center text-rose-400 md:hover:bg-rose-100 transition-colors cursor-pointer pointer-events-auto">
                  <Icons.Plus />
                  <span className="text-xs font-medium mt-1">Add More</span>
                </div>
              </div>
            ) : (
              <div className="pointer-events-none">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">📸</div>
                <p className="text-sm font-medium text-rose-600">Click or drag photos/videos here</p>
                <p className="text-xs text-stone-400 mt-1">Select multiple files at once</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-center">
             {isRecording ? (
                <button onClick={stopRecording} disabled={isSubmitting} className="bg-red-500 md:hover:bg-red-600 text-white px-6 py-2.5 rounded-full font-bold shadow-md animate-pulse flex items-center gap-2">
                   <div className="w-2 h-2 bg-white rounded-full"></div> Stop Recording
                </button>
             ) : (
                <button onClick={startRecording} disabled={isSubmitting} className="bg-rose-50 md:hover:bg-rose-100 text-rose-600 border border-rose-200 px-6 py-2.5 rounded-full font-bold shadow-sm flex items-center gap-2 transition-colors">
                   <Icons.Mic /> Record Voice Note
                </button>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">When did this happen?</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={isSubmitting} className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-600 bg-[#faf9f8]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Headline / Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isSubmitting} placeholder="e.g., Coffee Shop Date" className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-800 placeholder-stone-400 bg-[#faf9f8]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">The Story</label>
            <textarea rows="3" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} placeholder="Write the details here..." className="w-full border border-stone-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 text-stone-800 placeholder-stone-400 bg-[#faf9f8] resize-none custom-scrollbar" ></textarea>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer" onClick={() => !isSubmitting && setIsPrivate(!isPrivate)}>
             <input type="checkbox" checked={isPrivate} readOnly className="w-5 h-5 accent-rose-500 rounded focus:ring-rose-500 cursor-pointer pointer-events-none" />
             <div className="flex-1 select-none">
               <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">Keep this Memory Private <Icons.Lock /></h4>
               <p className="text-xs text-stone-500 mt-0.5">Hide this from the Daily Chronicle and Pookie's memory bank.</p>
             </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-50 border-t border-stone-100 flex justify-end gap-3 shrink-0 relative overflow-hidden">
          {isSubmitting && (
            <div className="absolute top-0 left-0 h-1 bg-rose-200 w-full">
              <div className="h-full bg-rose-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }}></div>
            </div>
          )}
          <button onClick={onClose} disabled={isSubmitting} className="px-5 py-2 rounded-full font-medium text-stone-600 md:hover:bg-stone-200 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="bg-rose-500 md:hover:bg-rose-600 disabled:bg-rose-400 text-white px-6 py-2 rounded-full font-medium transition-all shadow-sm flex items-center gap-2 min-w-[140px] justify-center">
            {isSubmitting ? (
               <span className="flex items-center gap-2">
                 <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full"></span>
                 Saving ({uploadProgress}%)
               </span>
            ) : 'Save to Vault'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddMemoryModal;