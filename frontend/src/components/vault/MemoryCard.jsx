import React, { useMemo, useState, useEffect } from 'react';
import GlassFolder from '../ui/glass-folder-cards';
import { parseMediaUrl, captureVideoFrame, preloadHighResImage } from '../../utils/mediaParser';

const ART_PRESETS_CYCLE = ['aurora', 'dusk', 'ember', 'glacier', 'verdant'];

class FolderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export const MemoryCard = React.memo(({ memory, onClick, onRenameClick, onDeleteClick, index = 0 }) => {
  if (!memory) return null;

  const mediaList = Array.isArray(memory.memory_media) ? memory.memory_media : [];
  const safeIndex = typeof index === 'number' && !isNaN(index) ? index : 0;
  const [resolvedThumbs, setResolvedThumbs] = useState({});

  useEffect(() => {
    let active = true;
    mediaList.slice(0, 4).forEach((item, idx) => {
      const parsed = parseMediaUrl(item?.file_url || '');
      if (parsed.isLegacyVideo && parsed.videoStreamUrl) {
        captureVideoFrame(parsed.videoStreamUrl).then((frame) => {
          if (active && frame) setResolvedThumbs((prev) => ({ ...prev, [idx]: frame }));
        });
      } else if (parsed.isYoutube && parsed.thumbLow) {
        const testImg = new Image();
        testImg.onload = () => {
          if (testImg.naturalWidth === 120 && parsed.videoStreamUrl) {
            captureVideoFrame(parsed.videoStreamUrl).then((frame) => {
              if (active && frame) setResolvedThumbs((prev) => ({ ...prev, [idx]: frame }));
            });
          }
        };
        testImg.src = parsed.thumbLow;
      }
    });
    return () => { active = false; };
  }, [mediaList]);

  const folderFiles = useMemo(() => {
    if (mediaList.length === 0) {
      return [
        {
          name: memory.title || 'Story Note',
          meta: memory.formattedDate || '',
          art: ART_PRESETS_CYCLE[safeIndex % ART_PRESETS_CYCLE.length]
        }
      ];
    }

    return mediaList.slice(0, 4).map((item, idx) => {
      const parsed = parseMediaUrl(item?.file_url || '');
      const customFrame = resolvedThumbs[idx];
      const thumbUrl = customFrame || (parsed.isLegacyVideo ? '' : (parsed.thumbLow || ''));
      const kind = parsed.isVoice
        ? 'Voice Note'
        : parsed.isYoutube || parsed.isLegacyVideo
        ? '🎬 Video Clip'
        : `Photo #${idx + 1}`;

      return {
        name: `${memory.title || 'Memory'} — ${idx + 1}`,
        meta: `${kind} · ${memory.formattedDate || ''}`,
        image: parsed.isVoice ? undefined : (thumbUrl || undefined),
        art: parsed.isVoice || !thumbUrl ? 'ember' : undefined
      };
    });
  }, [mediaList, memory.title, memory.formattedDate, safeIndex, resolvedThumbs]);

  const coverImage = useMemo(() => {
    for (let i = 0; i < Math.min(mediaList.length, 4); i++) {
      if (resolvedThumbs[i]) return resolvedThumbs[i];
      const parsed = parseMediaUrl(mediaList[i]?.file_url || '');
      if (!parsed.isVoice && !parsed.isLegacyVideo && parsed.thumbLow) return parsed.thumbLow;
    }
    return undefined;
  }, [mediaList, resolvedThumbs]);

  const seed = useMemo(() => {
    const str = String(memory.id || memory.title || safeIndex);
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997;
    return h || 3;
  }, [memory.id, memory.title, safeIndex]);

  const warmAlbumPreviews = () => {
    mediaList.slice(0, 3).forEach((m) => {
      const parsed = parseMediaUrl(m?.file_url || '');
      if (!parsed.isVoice && !parsed.isYoutube && !parsed.isLegacyVideo && parsed.thumb) {
        preloadHighResImage(parsed.thumb);
      }
    });
  };

  const fallbackCard = (
    <div
      onClick={() => onClick(memory, 0)}
      className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/60 cursor-pointer w-full max-w-[330px]"
    >
      <h3 className="text-xl font-serif font-bold text-stone-800">{memory.title}</h3>
      <p className="text-xs text-stone-500 mt-1">{memory.formattedDate}</p>
    </div>
  );

  return (
    <FolderErrorBoundary fallback={fallbackCard}>
      <div
        className="flex flex-col items-center justify-end group relative select-none"
        onMouseEnter={warmAlbumPreviews}
      >
        <GlassFolder
          label={memory.is_private ? `🔒 ${memory.title || 'Memory'}` : (memory.title || 'Memory')}
          meta={`${memory.formattedDate || ''} · ${mediaList.length} ${mediaList.length === 1 ? 'item' : 'items'}`}
          tone="light"
          art={ART_PRESETS_CYCLE[safeIndex % ART_PRESETS_CYCLE.length]}
          seed={seed}
          image={coverImage}
          files={folderFiles}
          action="more"
          labelPlacement="bottom-left"
          width={330}
          appear={false}
          onFileSelect={(_, fileIdx) => onClick(memory, fileIdx)}
          menu={[
            { label: 'Open Album Gallery ✨', onSelect: () => onClick(memory, 0) },
            { label: 'Edit Album Name ✏️', onSelect: () => onRenameClick && onRenameClick(memory) },
            { label: 'Delete Entire Album', danger: true, onSelect: () => onDeleteClick(memory) }
          ]}
        />

        <button
          type="button"
          onClick={() => onClick(memory, 0)}
          className="mt-2.5 px-4 py-1.5 rounded-full bg-white/50 hover:bg-white/90 backdrop-blur-md border border-white/70 text-xs font-medium text-stone-600 hover:text-rose-600 shadow-sm transition-all flex items-center gap-1.5"
        >
          <span>Click folder to fan files</span>
          <span className="text-stone-300">•</span>
          <span className="font-semibold underline decoration-rose-400/60 underline-offset-2">
            Open Album →
          </span>
        </button>
      </div>
    </FolderErrorBoundary>
  );
});

export default MemoryCard;