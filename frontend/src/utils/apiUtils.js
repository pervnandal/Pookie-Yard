export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export const uploadFilesWithProgress = (url, formData, setProgress, onSuccess, onError) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      const percent = Math.round((event.loaded / event.total) * 100);
      setProgress(percent);
    }
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      onSuccess(JSON.parse(xhr.responseText));
    } else {
      try {
        onError(JSON.parse(xhr.responseText));
      } catch (e) {
        onError({ detail: "Upload failed" });
      }
    }
  };
  xhr.onerror = () => onError({ detail: "Network error occurred." });
  xhr.send(formData);
};