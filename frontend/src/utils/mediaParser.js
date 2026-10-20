import { API_BASE_URL } from './apiUtils';

const VIDEO_THUMB_STORAGE_KEY = 'us_video_thumbs_v1';
const preloadedSet = new Set();

const videoFrameCache = new Map(
  (() => {
    try {
      const saved = localStorage.getItem(VIDEO_THUMB_STORAGE_KEY);
      return saved ? Object.entries(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  })()
);

const saveVideoFrameToStorage = (url, dataUrl) => {
  videoFrameCache.set(url, dataUrl);
  try {
    const obj = Object.fromEntries(videoFrameCache.entries());
    localStorage.setItem(VIDEO_THUMB_STORAGE_KEY, JSON.stringify(obj));
  } catch { }
};

export const preloadAndCacheMedia = (url) => {
  if (!url || typeof Image === 'undefined' || preloadedSet.has(url)) return;
  preloadedSet.add(url);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
};

export const preloadHighResImage = preloadAndCacheMedia;

export const captureVideoFrame = (videoUrl) => {
  if (!videoUrl) return Promise.resolve(null);
  if (videoFrameCache.has(videoUrl)) return Promise.resolve(videoFrameCache.get(videoUrl));

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 6000);

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) * 0.2);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = Math.round((video.videoHeight / (video.videoWidth || 1)) * 320) || 200;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        saveVideoFrameToStorage(videoUrl, dataUrl);
        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    };

    video.src = videoUrl;
  });
};

export const parseMediaUrl = (rawUrl) => {
  if (!rawUrl) {
    return {
      cloudId: '',
      original: '',
      thumb: '',
      thumbLow: '',
      videoStreamUrl: '',
      isYoutube: false,
      isLegacyVideo: false,
      isVoice: false
    };
  }

  const isVoice = rawUrl.startsWith('voice#');
  const isVideoPrefix = rawUrl.startsWith('video#');
  const cleanUrl = rawUrl.replace(/^(voice#|video#)/, '');

  // 1. YouTube Videos (Uses cloudId instead of id so database m.id is never overwritten;
  //    does NOT call /api/drive-image/ on old deleted drive_id backups)
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/|^yt:)([a-zA-Z0-9_-]{11})/;
  const ytMatch = cleanUrl.match(ytRegex);

  if (ytMatch && !cleanUrl.split('&drive_id=')[0].includes('drive.google.com')) {
    const videoId = ytMatch[1];
    return {
      cloudId: videoId,
      youtubeId: videoId,
      original: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      thumbLow: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      thumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      videoStreamUrl: '',
      isYoutube: true,
      isLegacyVideo: false,
      isVoice: false
    };
  }

  // 2. Google Drive Media (Photos, Voice Notes, or Drive-only Videos)
  const driveMatch = cleanUrl.match(/(?:id=|\/d\/|drive-image\/)([a-zA-Z0-9_-]+)/);
  const driveId = driveMatch ? driveMatch[1] : null;
  const isLegacyVideo = isVideoPrefix || /\.(mp4|mov|webm|mkv)(\?.*)?$/i.test(cleanUrl);

  if (driveId) {
    const base = `${API_BASE_URL}/api/drive-image/${driveId}`;
    return {
      cloudId: driveId,
      driveId,
      original: `${base}?size=original`,
      thumb: isLegacyVideo || isVoice ? `${base}?size=original` : `${base}?size=preview`,
      thumbLow: isLegacyVideo || isVoice ? `${base}?size=original` : `${base}?size=thumb`,
      videoStreamUrl: isLegacyVideo ? `${base}?size=original` : '',
      isYoutube: false,
      isLegacyVideo,
      isVoice
    };
  }

  return {
    cloudId: cleanUrl,
    original: cleanUrl,
    thumbLow: cleanUrl,
    thumb: cleanUrl,
    videoStreamUrl: isLegacyVideo ? cleanUrl : '',
    isYoutube: false,
    isLegacyVideo,
    isVoice
  };
};