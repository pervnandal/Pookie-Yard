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
    xhr.onerror = () => reject({ detail: 'Connection interrupted during upload.' });

    xhr.send(formData);
  });
};

/**
 * 2-Phase Upload Pipeline:
 * 1. If creating a new album (/api/memories), creates the album row ONCE first.
 * 2. Uploads each file sequentially to /api/memories/{id}/media with per-file retry.
 * This guarantees a retry can NEVER create a duplicate album.
 */
export const uploadFilesWithProgress = async (url, formData, onProgress, onSuccess, onError) => {
  try {
    const allFiles = formData.getAll('files').filter((f) => f && f.size !== undefined && f.size > 0);
    const isCreatingAlbum = url.endsWith('/api/memories');

    let targetMediaUrl = url;
    let createdMemory = null;

    // Phase 1: Create the album metadata row ONCE (without files)
    if (isCreatingAlbum) {
      const initForm = new FormData();
      for (const [key, val] of formData.entries()) {
        if (key !== 'files') initForm.append(key, val);
      }
      createdMemory = await sendSingleFormData(url, initForm, null);
      if (!createdMemory || !createdMemory.id) {
        throw { detail: 'Failed to create album record.' };
      }
      if (allFiles.length === 0) {
        if (onProgress) onProgress(100);
        onSuccess(createdMemory);
        return;
      }
      targetMediaUrl = `${url}/${createdMemory.id}/media`;
    } else if (allFiles.length === 0) {
      onSuccess({});
      return;
    }

    // Phase 2: Upload each file sequentially to /api/memories/{id}/media
    const totalFiles = allFiles.length;
    for (let i = 0; i < totalFiles; i++) {
      const singleForm = new FormData();
      singleForm.append('files', allFiles[i]);

      let uploaded = false;
      let lastErr = null;

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