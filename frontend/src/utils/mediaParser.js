import { API_BASE_URL } from './apiUtils';

export const parseMediaUrl = (rawUrl) => {
  if (!rawUrl) return { provider: 'unknown', thumb: '', original: '', isYoutube: false, isDrive: false, isVoice: false };
  try {
    let parsedData = rawUrl;
    while (typeof parsedData === 'string' && (parsedData.startsWith('{') || parsedData.startsWith('"') || parsedData.startsWith("'"))) {
      try { parsedData = JSON.parse(parsedData); } catch (e) { break; }
    }

    if (typeof parsedData === 'object' && parsedData !== null) {
      const provider = parsedData.provider || 'unknown';
      const fileId = parsedData.id;

      if (provider === 'youtube') {
        return {
          provider: 'youtube',
          id: fileId,
          thumb: `https://img.youtube.com/vi/${fileId}/maxresdefault.jpg`,
          original: `https://www.youtube.com/embed/${fileId}`,
          isYoutube: true,
          isDrive: false,
          isVoice: false
        };
      }

      if (provider === 'drive' && fileId) {
        const proxyUrl = `${API_BASE_URL}/api/media/proxy/${fileId}`;
        return {
          provider: 'drive',
          id: fileId,
          thumb: proxyUrl,
          original: proxyUrl,
          isYoutube: false,
          isDrive: true,
          isVoice: false
        };
      }
    }

    // Fallback string evaluation
    const urlStr = String(rawUrl);
    const isVoice = urlStr.includes('voice_note');
    const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(urlStr.split('?')[0]);
    let proxyUrl = urlStr;

    if (urlStr.includes('drive.google.com')) {
      const idMatch = urlStr.match(/id=([^&]+)/) || urlStr.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        proxyUrl = `${API_BASE_URL}/api/media/proxy/${idMatch[1]}`;
      }
    }

    return {
      provider: 'supabase',
      thumb: proxyUrl,
      original: proxyUrl,
      isYoutube: false,
      isDrive: urlStr.includes('drive.google.com'),
      isLegacyVideo: isVideo,
      isVoice: isVoice
    };
  } catch (e) {
    return { provider: 'fallback', thumb: rawUrl, original: rawUrl, isYoutube: false, isDrive: false, isVoice: false };
  }
};