import React from 'react';
import { ArrowRight } from 'lucide-react';

export default function LandingPage({ onSelectVolunteer, onSelectCoordinator }) {
  const options = [
    {
      id: 'role-btn-volunteer',
      title: 'Volunteer',
      description: 'Register, see your shifts and tasks, and check in on site.',
      color: 'bg-brand-blue',
      onClick: onSelectVolunteer,
    },
    {
      id: 'role-btn-coordinator',
      title: 'Coordinator',
      description: 'Staff shifts, track attendance, and respond to issues.',
      color: 'bg-brand-green',
      onClick: onSelectCoordinator,
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <span className="inline-block rounded-xl border-2 border-white/80 bg-brand-pink px-2.5 py-1 text-sm font-bold shadow-brutal-sm -rotate-2">
          CrowdCoord
        </span>
        <h1 className="mt-8 text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]">
          Volunteer &amp; crowd{' '}
          <span className="bg-brand-yellow px-1.5 border-2 border-white/80 inline-block -rotate-1">coordination</span>
        </h1>
        <p className="mt-5 text-base font-medium text-neutral-700">Choose how you want to continue.</p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              id={opt.id}
              onClick={opt.onClick}
              className={`group card-lift ${opt.color} p-5 text-left flex flex-col justify-between min-h-40`}
            >
              <div>
                <p className="text-xl font-bold">{opt.title}</p>
                <p className="mt-1.5 text-sm font-medium">{opt.description}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold">
                Continue <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </div>

        <p className="mt-8 text-xs font-medium text-neutral-600">Demo mode — no sign-in required.</p>
      </div>
    </div>
  );
}
