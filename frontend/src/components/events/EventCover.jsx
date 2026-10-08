import React, { useState } from 'react';
import { assetUrl } from '../../services/api';

// Flat placeholder colors, picked deterministically from the event's category/name
const PLACEHOLDER_COLORS = ['bg-brand-yellow', 'bg-brand-pink', 'bg-brand-blue', 'bg-brand-green', 'bg-brand-orange', 'bg-brand-violet'];

function placeholderColor(seed) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length];
}

// Event cover image, or a generated flat-color placeholder when the event has none.
export default function EventCover({ event, className = '', imgClassName = '', showInitial = true }) {
  const [failed, setFailed] = useState(false);
  const src = assetUrl(event.image_url);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover ${imgClassName} ${className}`}
      />
    );
  }

  const seed = (event.category || event.name || '?').trim();
  return (
    <div
      aria-hidden="true"
      className={`w-full h-full flex items-center justify-center ${placeholderColor(seed)} ${className}`}
      style={{ backgroundImage: 'radial-gradient(#11111122 1.5px, transparent 1.5px)', backgroundSize: '14px 14px' }}
    >
      {showInitial && (
        <span className="text-5xl font-bold text-slate-700 select-none">{seed.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
