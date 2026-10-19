import React from 'react';
import { Icons } from '../common/Icons';

export const ChatMediaLightbox = ({ media, onClose }) => {
  if (!media) return null;

  return (
    <div
      className="fixed inset-0 z-[260] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        <a
          href={media.original}
          target="_blank"
          rel="noreferrer"
          download
          onClick={(e) => e.stopPropagation()}
          className="p-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-full"
          title="Open / Save Original"
        >
          <Icons.Download />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 bg-stone-800 hover:bg-stone-700 text-white rounded-full"
          title="Close"
        >
          <Icons.X />
        </button>
      </div>

      <div
        className="max-w-4xl max-h-[85vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {media.isYoutube ? (
          <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl">
            <iframe
              src={media.embedUrl}
              title="Chat Video"
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : media.media_type === 'video' ? (
          <video src={media.original} controls autoPlay className="max-w-full max-h-[85vh] rounded-xl" />
        ) : (
          <img
            src={media.thumb || media.original}
            alt="Chat full view"
            className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
          />
        )}
      </div>
    </div>
  );
};

export default ChatMediaLightbox;
