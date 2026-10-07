import React from 'react';

export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div role="status" className="py-16 text-center text-[13px] text-neutral-600">
      {label}
    </div>
  );
}
