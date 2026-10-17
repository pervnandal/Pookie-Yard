export const parseMediaUrl = (rawUrl) => {
  if (!rawUrl) return { original: '', thumb: '', isYoutube: false, isLegacyVideo: false, isVoice: false };

  const isVoice = rawUrl.startsWith('voice#');
  const isVideoPrefix = rawUrl.startsWith('video#');
  const cleanUrl = rawUrl.replace(/^(voice#|video#)/, '');

  // Match all YouTube URL formats (watch?v=, youtu.be/, embed/, shorts/)
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/|^yt:)([a-zA-Z0-9_-]{11})/;
  const ytMatch = cleanUrl.match(ytRegex);

  if (ytMatch && !cleanUrl.includes('drive.google.com')) {
    const videoId = ytMatch[1];
    return {
      id: videoId,
      original: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      thumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      isYoutube: true,
      isLegacyVideo: false,
      isVoice: false
    };
  }

  // Handle Google Drive files (Images, Videos fallback, Audio)
  const driveMatch = cleanUrl.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  const driveId = driveMatch ? driveMatch[1] : null;

  const isLegacyVideo = isVideoPrefix || /\.(mp4|mov|webm|mkv)(\?.*)?$/i.test(cleanUrl);

  if (driveId) {
    return {
      id: driveId,
      original: isLegacyVideo || isVoice
        ? `https://drive.google.com/uc?id=${driveId}&export=download`
        : `https://lh3.googleusercontent.com/d/${driveId}=w1600`,
      drivePreviewUrl: `https://drive.google.com/file/d/${driveId}/preview`,
      thumb: `https://lh3.googleusercontent.com/d/${driveId}=w600`,
      isYoutube: false,
      isLegacyVideo,
      isDriveVideo: isLegacyVideo,
      isVoice
    };
  }

  return {
    original: cleanUrl,
    thumb: cleanUrl,
    isYoutube: false,
    isLegacyVideo,
    isDriveVideo: false,
    isVoice
  };
};

// import { API_BASE_URL } from './apiUtils';

// export const parseMediaUrl = (rawUrl) => {
//   if (!rawUrl) return { provider: 'unknown', thumb: '', original: '', isYoutube: false, isDrive: false, isVoice: false };
//   try {
//     let parsedData = rawUrl;
//     while (typeof parsedData === 'string' && (parsedData.startsWith('{') || parsedData.startsWith('"') || parsedData.startsWith("'"))) {
//       try { parsedData = JSON.parse(parsedData); } catch (e) { break; }
//     }

//     if (typeof parsedData === 'object' && parsedData !== null) {
//       const provider = parsedData.provider || 'unknown';
//       const fileId = parsedData.id;

//       if (provider === 'youtube') {
//         return {
//           provider: 'youtube',
//           id: fileId,
//           thumb: `https://img.youtube.com/vi/${fileId}/maxresdefault.jpg`,
//           original: `https://www.youtube.com/embed/${fileId}`,
//           isYoutube: true,
//           isDrive: false,
//           isVoice: false
//         };
//       }

//       if (provider === 'drive' && fileId) {
//         const proxyUrl = `${API_BASE_URL}/api/media/proxy/${fileId}`;
//         return {
//           provider: 'drive',
//           id: fileId,
//           thumb: proxyUrl,
//           original: proxyUrl,
//           isYoutube: false,
//           isDrive: true,
//           isVoice: false
//         };
//       }
//     }

//     // Fallback string evaluation
//     const urlStr = String(rawUrl);
//     const isVoice = urlStr.includes('voice_note');
//     const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(urlStr.split('?')[0]);
//     let proxyUrl = urlStr;

//     if (urlStr.includes('drive.google.com')) {
//       const idMatch = urlStr.match(/id=([^&]+)/) || urlStr.match(/\/d\/([a-zA-Z0-9_-]+)/);
//       if (idMatch && idMatch[1]) {
//         proxyUrl = `${API_BASE_URL}/api/media/proxy/${idMatch[1]}`;
//       }
//     }

//     return {
//       provider: 'supabase',
//       thumb: proxyUrl,
//       original: proxyUrl,
//       isYoutube: false,
//       isDrive: urlStr.includes('drive.google.com'),
//       isLegacyVideo: isVideo,
//       isVoice: isVoice
//     };
//   } catch (e) {
//     return { provider: 'fallback', thumb: rawUrl, original: rawUrl, isYoutube: false, isDrive: false, isVoice: false };
//   }
// };