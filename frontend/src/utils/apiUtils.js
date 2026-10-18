export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^http/, 'ws');

export const uploadFilesWithProgress = (url, formData, onProgress, onSuccess, onError) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.timeout = 15 * 60 * 1000;

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && onProgress) {
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress(percent);
    }
  };

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        onSuccess(JSON.parse(xhr.responseText));
      } catch {
        onSuccess({});
      }
    } else {
      try {
        const err = JSON.parse(xhr.responseText);
        onError(err);
      } catch {
        onError({ detail: `Server error (${xhr.status}). Please try again.` });
      }
    }
  };

  xhr.ontimeout = () => {
    onError({ detail: 'Upload timed out. Please check your internet connection.' });
  };

  xhr.onerror = () => {
    onError({ detail: 'Connection interrupted during upload. Check backend terminal for details.' });
  };

  xhr.send(formData);
};