import React from 'react';
import { ArrowLeft } from 'lucide-react';

export default function CoordinatorAccess({ onContinue, onBack }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button id="coordinator-back-btn" onClick={onBack} className="btn btn-ghost -ml-3 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="panel bg-brand-green p-6">
          <h1 className="text-2xl font-bold tracking-tight">Coordinator access</h1>
          <p className="mt-2 text-sm font-medium">
            Continue to the coordination dashboard. Demo mode doesn't require a password.
          </p>
          <button id="coordinator-continue-btn" onClick={onContinue} className="btn btn-primary w-full h-10 mt-6">
            Continue as coordinator
          </button>
        </div>
      </div>
    </div>
  );
}
