import { parseMediaUrl } from './mediaParser';

export const CHAT_CHUNK_SIZE = 25;
export const CHATS_CACHE_KEY = 'us_planner_chats_chunk_v1';
export const ITINERARIES_CACHE_KEY = 'us_planner_itineraries_cache_v1';
export const ACTIVE_DOC_CACHE_KEY = 'us_planner_active_doc_v1';

const META_PREFIX = '__US_META__';
const META_SUFFIX = '__END_META__';

export const encodeMessageText = (cleanText, replyTo, media) => {
  if (!replyTo && !media) return cleanText || '';
  const metaPayload = {};
  if (replyTo) {
    metaPayload.reply = {
      id: replyTo.id,
      senderId: replyTo.senderId || replyTo.sender_id,
      text: (replyTo.cleanText || replyTo.text || '').slice(0, 120),
      mediaType: replyTo.media?.media_type || (replyTo.audio ? 'audio' : null),
      thumbUrl: replyTo.media?.thumbUrl || null
    };
  }
  if (media) {
    metaPayload.media = {
      file_url: media.file_url,
      media_type: media.media_type,
      name: media.name || ''
    };
  }
  return `${META_PREFIX}${JSON.stringify(metaPayload)}${META_SUFFIX}${cleanText || ''}`;
};

export const decodeMessage = (msg) => {
  if (!msg) return null;
  const rawText = msg.text || '';
  let cleanText = rawText;
  let reply = msg.reply || null;
  let media = msg.media || null;

  if (rawText.startsWith(META_PREFIX)) {
    const endIdx = rawText.indexOf(META_SUFFIX);
    if (endIdx !== -1) {
      const jsonStr = rawText.slice(META_PREFIX.length, endIdx);
      cleanText = rawText.slice(endIdx + META_SUFFIX.length);
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.reply) reply = parsed.reply;
        if (parsed.media) media = parsed.media;
      } catch {
        // Ignore malformed metadata
      }
    }
  }

  let parsedMedia = null;
  if (media && media.file_url) {
    const p = parseMediaUrl(media.file_url);
    parsedMedia = {
      ...media,
      ...p,
      thumbUrl: p.thumbLow || p.thumb || p.original
    };
  }

  return {
    ...msg,
    cleanText,
    reply,
    media: parsedMedia
  };
};

export const deduplicateMessages = (list) => {
  const seenIds = new Set();
  const result = [];
  for (let i = 0; i < list.length; i++) {
    const msg = list[i];
    if (!msg) continue;
    if (msg.id && seenIds.has(msg.id)) continue;

    if (result.length > 0) {
      const prev = result[result.length - 1];
      const sameSender = (msg.sender_id || msg.senderId) === (prev.sender_id || prev.senderId);
      if (sameSender && msg.text && msg.text === prev.text && msg.timestamp === prev.timestamp) {
        continue;
      }
    }
    if (msg.id) seenIds.add(msg.id);
    result.push(msg);
  }
  return result;
};

export const saveChatChunkToCache = (msgs) => {
  try {
    const recentChunk = msgs.slice(-CHAT_CHUNK_SIZE);
    localStorage.setItem(CHATS_CACHE_KEY, JSON.stringify(recentChunk));
  } catch {}
};
