import React, { useMemo, useState, useEffect } from 'react';
import GlassFolder from '../ui/glass-folder-cards';
import { parseMediaUrl, captureVideoFrame, preloadHighResImage } from '../../utils/mediaParser';
import { extractVaultMeta } from '../../utils/vaultMetaUtils';

export const ART_PRESETS_CYCLE = ['aurora', 'ember', 'dusk', 'glacier', 'verdant'];

const GLASS_TINT_STYLES = {
  aurora: {
    ring: 'ring-2 ring-rose-300/70 rounded-[28px]',
    badge: '🌸 Rose Glass',
    overlay: 'linear-gradient(135deg, rgba(244,63,94,0.18) 0%, rgba(251,113,133,0.06) 100%)'
  },
  ember: {
    ring: 'ring-2 ring-stone-700/80 rounded-[28px]',
    badge: '🖤 Obsidian Glass',
    overlay: 'linear-gradient(135deg, rgba(15,23,42,0.45) 0%, rgba(244,63,94,0.18) 100%)'
  },
  dusk: {
    ring: 'ring-2 ring-purple-400/75 rounded-[28px]',
    badge: '🔮 Violet Dusk',
    overlay: 'linear-gradient(135deg, rgba(168,85,247,0.28) 0%, rgba(99,102,241,0.14) 100%)'
  },
  glacier: {
    ring: 'ring-2 ring-sky-400/75 rounded-[28px]',
    badge: '🧊 Glacier Blue',
    overlay: 'linear-gradient(135deg, rgba(14,165,233,0.28) 0%, rgba(56,189,248,0.12) 100%)'
  },
  verdant: {
    ring: 'ring-2 ring-emerald-400/75 rounded-[28px]',
    badge: '🌿 Emerald Glass',
    overlay: 'linear-gradient(135deg, rgba(16,185,129,0.28) 0%, rgba(250,204,21,0.14) 100%)'
  }
};

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

export const MemoryCard = React.memo(({
  memory,
  onClick,
  onRenameClick,
  onToggleConstant,
  onTogglePrivate,
  onCycleTheme,
  onSetTimeCapsule,
  onDeleteClick,
  index = 0
}) => {
  if (!memory) return null;

  const mediaList = Array.isArray(memory.memory_media) ? memory.memory_media : [];
  const safeIndex = typeof index === 'number' && !isNaN(index) ? index : 0;
  const [resolvedThumbs, setResolvedThumbs] = useState({});

  const { meta } = useMemo(() => extractVaultMeta(memory), [memory]);

  const capsuleStatus = useMemo(() => {
    if (!meta.unlockDate) return { isLocked: false, daysLeft: 0 };
    const unlockMs = new Date(`${meta.unlockDate}T00:00:00`).getTime();
    const nowMs = Date.now();
    if (isNaN(unlockMs) || unlockMs <= nowMs) return { isLocked: false, daysLeft: 0 };
    const daysLeft = Math.ceil((unlockMs - nowMs) / (1000 * 60 * 60 * 24));
    return { isLocked: true, daysLeft };
  }, [meta.unlockDate]);

  useEffect(() => {
    if (capsuleStatus.isLocked) return;
    let active = true;
    mediaList.slice(0, 6).forEach((item, idx) => {
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
  }, [mediaList, capsuleStatus.isLocked]);

  const shortMonthDay = useMemo(() => {
    if (capsuleStatus.isLocked) {
      return `⏳ UNLOCKS IN ${capsuleStatus.daysLeft}D`;
    }
    if (meta.isConstant) return '📌 CONSTANT';
    if (!memory.memory_date) return '';
    try {
      const d = new Date(memory.memory_date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();
    } catch {
      return memory.formattedDate || '';
    }
  }, [memory.memory_date, memory.formattedDate, meta.isConstant, capsuleStatus]);

  const activeArt = capsuleStatus.isLocked
    ? 'dusk'
    : meta.artPreset || ART_PRESETS_CYCLE[safeIndex % ART_PRESETS_CYCLE.length];

  const activeTone =
    capsuleStatus.isLocked || meta.isPrivate || activeArt === 'ember' || activeArt === 'dusk'
      ? 'dark'
      : 'light';

  const tintConfig = GLASS_TINT_STYLES[activeArt] || GLASS_TINT_STYLES.aurora;

  const folderFiles = useMemo(() => {
    if (capsuleStatus.isLocked) {
      return [
        {
          name: `⏳ Sealed Time Capsule`,
          meta: `Unlocks on ${meta.unlockDate} (${capsuleStatus.daysLeft} days left)`,
          art: 'dusk'
        }
      ];
    }

    if (mediaList.length === 0) {
      return [
        {
          name: memory.title || 'Story Note',
          meta: shortMonthDay,
          art: activeArt
        }
      ];
    }

    return mediaList.slice(0, 4).map((item, idx) => {
      const parsed = parseMediaUrl(item?.file_url || '');
      const customFrame = resolvedThumbs[idx];
      const thumbUrl = customFrame || (parsed.isLegacyVideo ? '' : (parsed.thumbLow || ''));
      const captionText = meta.captions?.[String(item.id)];
      const kind = captionText
        ? `💬 ${captionText.slice(0, 18)}`
        : parsed.isVoice
          ? '🎤 Voice Note'
          : parsed.isYoutube || parsed.isLegacyVideo
            ? '🎬 Video Clip'
            : `Photo #${idx + 1}`;

      return {
        name: `${memory.title || 'Memory'} — ${idx + 1}`,
        meta: `${kind} · ${shortMonthDay}`,
        image: parsed.isVoice ? undefined : (thumbUrl || undefined),
        art: parsed.isVoice || !thumbUrl ? activeArt : undefined
      };
    });
  }, [mediaList, memory.title, shortMonthDay, resolvedThumbs, meta, capsuleStatus, activeArt]);

  const coverImage = useMemo(() => {
    if (capsuleStatus.isLocked) return undefined;
    if (meta.coverMediaId) {
      const targetIdx = mediaList.findIndex((m) => String(m.id) === String(meta.coverMediaId));
      if (targetIdx !== -1) {
        if (resolvedThumbs[targetIdx]) return resolvedThumbs[targetIdx];
        const parsed = parseMediaUrl(mediaList[targetIdx]?.file_url || '');
        if (!parsed.isVoice && parsed.thumbLow) return parsed.thumbLow;
      }
    }
    for (let i = 0; i < Math.min(mediaList.length, 4); i++) {
      if (resolvedThumbs[i]) return resolvedThumbs[i];
      const parsed = parseMediaUrl(mediaList[i]?.file_url || '');
      if (!parsed.isVoice && !parsed.isLegacyVideo && parsed.thumbLow) return parsed.thumbLow;
    }
    return undefined;
  }, [mediaList, resolvedThumbs, meta.coverMediaId, capsuleStatus.isLocked]);

  const seed = useMemo(() => {
    const str = String(memory.id || memory.title || safeIndex);
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997;
    return h || 3;
  }, [memory.id, memory.title, safeIndex]);

  const warmAlbumPreviews = () => {
    if (capsuleStatus.isLocked) return;
    mediaList.slice(0, 3).forEach((m) => {
      const parsed = parseMediaUrl(m?.file_url || '');
      if (!parsed.isVoice && !parsed.isYoutube && !parsed.isLegacyVideo && parsed.thumb) {
        preloadHighResImage(parsed.thumb);
      }
    });
  };

  const folderLabel = capsuleStatus.isLocked
    ? `⏳ ${memory.title || 'Time Capsule'}`
    : meta.isPrivate
      ? `🔒 ${memory.title || 'Memory'}`
      : meta.isConstant
        ? `📌 ${memory.title || 'Memory'}`
        : memory.title || 'Memory';

  const fallbackCard = (
    <div
      onClick={() => onClick(memory, 0)}
      className="bg-white/60 backdrop-blur-xl rounded-3xl p-6 shadow-lg border border-white/60 cursor-pointer w-full max-w-[330px]"
    >
      <h3 className="text-xl font-serif font-bold text-stone-800">{folderLabel}</h3>
      <p className="text-xs text-stone-500 mt-1">{shortMonthDay}</p>
    </div>
  );

  return (
    <FolderErrorBoundary fallback={fallbackCard}>
      <div
        className="flex flex-col items-center justify-end group relative select-none"
        onMouseEnter={warmAlbumPreviews}
      >
        {/* Visible Glass Theme Tint Overlay + Ring so every click of 'Change Glass Theme' visibly changes the folder */}
        <div className={`relative transition-all duration-300 ${meta.artPreset ? tintConfig.ring : ''}`}>
          {meta.artPreset && (
            <div
              style={{ background: tintConfig.overlay }}
              className="absolute inset-0 rounded-[28px] pointer-events-none z-10 mix-blend-overlay transition-all duration-300"
            />
          )}

          <GlassFolder
            label={folderLabel}
            meta={`${shortMonthDay} · ${mediaList.length} ${mediaList.length === 1 ? 'item' : 'items'}`}
            tone={activeTone}
            art={activeArt}
            seed={seed}
            image={coverImage}
            files={folderFiles}
            action="more"
            labelPlacement="bottom-left"
            width={330}
            appear={false}
            onFileSelect={(_, fileIdx) =>
              onClick({ ...memory, initialMediaIndex: fileIdx, _openTrigger: Date.now() }, fileIdx)
            }
            menu={[
              {
                label: capsuleStatus.isLocked
                  ? `Sealed Until ${meta.unlockDate} ⏳`
                  : 'Open Album Gallery ✨',
                onSelect: () => onClick(memory, 0)
              },
              { label: 'Edit Album Name ✏️', onSelect: () => onRenameClick && onRenameClick(memory) },
              {
                label: meta.isConstant ? 'Move to Timeline 📅' : 'Make Constant Album 📌',
                onSelect: () => onToggleConstant && onToggleConstant(memory)
              },
              {
                label: meta.isPrivate ? 'Make Standard (Public) 🌸' : 'Move to Private Vault 🔒',
                onSelect: () => onTogglePrivate && onTogglePrivate(memory)
              },
              {
                label: meta.unlockDate ? 'Edit / Unlock Time Capsule ⏳' : 'Lock as Time Capsule ⏳',
                onSelect: () => onSetTimeCapsule && onSetTimeCapsule(memory)
              },
              {
                label: `Glass Theme: ${tintConfig.badge} 🎨`,
                onSelect: () => onCycleTheme && onCycleTheme(memory, activeArt)
              },
              { label: 'Delete Entire Album', danger: true, onSelect: () => onDeleteClick(memory) }
            ]}
          />
        </div>

        <button
          type="button"
          onClick={() => onClick(memory, 0)}
          className="vault-surface mt-2.5 px-4 py-1.5 rounded-full bg-white/60 hover:bg-white/95 backdrop-blur-md border border-white/75 text-xs font-medium text-stone-600 hover:text-rose-600 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          {capsuleStatus.isLocked ? (
            <span className="font-semibold text-amber-700">
              ⏳ Time Capsule · Unlocks {meta.unlockDate}
            </span>
          ) : (
            <>
              <span>Click folder to fan files</span>
              <span className="text-stone-300">•</span>
              <span className="font-semibold underline decoration-rose-400/60 underline-offset-2">
                Open Album →
              </span>
            </>
          )}
        </button>
      </div>
    </FolderErrorBoundary>
  );
});

export default MemoryCard;