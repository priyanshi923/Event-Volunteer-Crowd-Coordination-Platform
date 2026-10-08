import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, subtitle, onClose, children, footer, size = 'md' }) {
  const width = size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${width} max-h-[85vh] flex flex-col`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="modal-title">{title}</h3>
            {subtitle && <p className="text-[13px] text-neutral-600 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="btn btn-ghost w-8 px-0 -mr-2 -mt-1 shrink-0" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto mt-4 -mx-6 px-6 pb-1">{children}</div>
        {footer && <div className="pt-4 mt-2 border-t-2 border-white/60 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
