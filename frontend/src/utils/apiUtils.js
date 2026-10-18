export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || API_BASE_URL.replace(/^http/, 'ws');

const sendSingleFormData = (url, formData, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.timeout = 15 * 60 * 1000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({});
        }
      } else {
        try {
          reject(JSON.parse(xhr.responseText));
        } catch {
          reject({ detail: `Server error (${xhr.status}). Please try again.` });
        }
      }
    };

    xhr.ontimeout = () => reject({ detail: 'Upload timed out. Please check your internet connection.' });
    xhr.onerror = () => reject({ detail: 'Connection interrupted during upload. Retrying...' });

    xhr.send(formData);
  });
};

/**
 * Automatically splits multi-file uploads into sequential 1-file requests with auto-retry.
 * Prevents Render 512MB RAM OOM crashes and 100s Cloudflare/Render HTTP timeouts when uploading many files at once.
 */
export const uploadFilesWithProgress = async (url, formData, onProgress, onSuccess, onError) => {
  try {
    const allFiles = formData.getAll('files').filter((f) => f && f.size !== undefined);

    // Case 1: 0 or 1 file -> send directly (with 1 automatic retry on transient network drop)
    if (allFiles.length <= 1) {
      let lastErr;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await sendSingleFormData(url, formData, (fraction) => {
            if (onProgress) onProgress(Math.round(fraction * 100));
          });
          onSuccess(res);
          return;
        } catch (err) {
          lastErr = err;
        }
      }
      onError(lastErr);
      return;
    }

    // Case 2: Multiple files -> sequential upload so Render only processes 1 file in RAM at a time
    let targetMediaUrl = url;
    let createdMemory = null;

    // If creating a new album (/api/memories), create the album metadata first, then upload each file to /api/memories/{id}/media
    if (url.endsWith('/api/memories')) {
      const initForm = new FormData();
      for (const [key, val] of formData.entries()) {
        if (key !== 'files') initForm.append(key, val);
      }
      createdMemory = await sendSingleFormData(url, initForm, null);
      if (!createdMemory || !createdMemory.id) {
        throw { detail: 'Failed to initialize album before uploading files.' };
      }
      targetMediaUrl = `${url}/${createdMemory.id}/media`;
    }

    const totalFiles = allFiles.length;
    for (let i = 0; i < totalFiles; i++) {
      const singleForm = new FormData();
      singleForm.append('files', allFiles[i]);

      let uploaded = false;
      let lastErr = null;

      // Up to 2 attempts per individual file
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await sendSingleFormData(targetMediaUrl, singleForm, (fileFraction) => {
            if (onProgress) {
              const overallPercent = Math.round(((i + fileFraction) / totalFiles) * 100);
              onProgress(Math.min(99, overallPercent));
            }
          });
          uploaded = true;
          break;
        } catch (err) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      if (!uploaded) {
        throw lastErr || { detail: `Failed while uploading file ${i + 1} of ${totalFiles}.` };
      }
    }

    if (onProgress) onProgress(100);
    onSuccess(createdMemory || { status: 'success', added: totalFiles });
  } catch (err) {
    onError(err || { detail: 'Upload failed. Please try again.' });
  }
};