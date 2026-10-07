import React from 'react';

export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div role="alert" className="py-16 text-center">
      <p className="text-[13px] text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn btn-secondary mt-4">
          Try again
        </button>
      )}
    </div>
  );
}
