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

  // Synchronous ref lock to block fast double-clicks before React re-renders
  const isSubmittingRef = useRef(false);

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
    if (isSubmittingRef.current || isSubmitting) return;

    if (!title.trim() || !memoryDate) {
      showDialog({ type: 'alert', title: 'Missing Info', message: 'Please provide a title and date for this memory.' });
      return;
    }

    isSubmittingRef.current = true;
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
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        setTitle('');
        setDescription('');
        setFiles([]);
        setIsPrivate(false);
        onMemoryAdded();
        onClose();
      },
      (err) => {
        isSubmittingRef.current = false;
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
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
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
              disabled={isSubmitting}
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
                disabled={isSubmitting}
                value={memoryDate}
                onChange={(e) => setMemoryDate(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                disabled={isSubmitting}
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
              disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
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
                    {!isSubmitting && (
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-stone-400 hover:text-red-500 font-bold ml-2"
                      >
                        ✕
                      </button>
                    )}
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
                Uploading media ({uploadProgress}%)...
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