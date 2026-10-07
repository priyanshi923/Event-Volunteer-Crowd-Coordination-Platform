import React from 'react';

export default function EmptyState({ title, description, action }) {
  return (
    <div className="py-16 text-center">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-[13px] text-neutral-600 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
