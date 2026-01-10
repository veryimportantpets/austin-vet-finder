'use client';

import type { SetupState, PimsKind } from '@/app/page';

interface Props {
  state: SetupState;
  updateState: (updates: Partial<SetupState>) => void;
  onNext: () => void;
  onBack: () => void;
}

const SYSTEMS: Array<{
  id: PimsKind;
  name: string;
  description: string;
  icon: string;
  type: 'on-prem' | 'cloud';
}> = [
  {
    id: 'avimark',
    name: 'AVImark',
    description: 'Covetrus on-premise practice management',
    icon: '🏥',
    type: 'on-prem',
  },
  {
    id: 'cornerstone',
    name: 'Cornerstone',
    description: 'IDEXX on-premise practice management',
    icon: '🏥',
    type: 'on-prem',
  },
  {
    id: 'pulse',
    name: 'Pulse (Covetrus)',
    description: 'Covetrus cloud-based practice management',
    icon: '☁️',
    type: 'cloud',
  },
  {
    id: 'ezyvet',
    name: 'ezyVet',
    description: 'Cloud-based practice management',
    icon: '☁️',
    type: 'cloud',
  },
  {
    id: 'export_drop',
    name: 'Other / Export Drop',
    description: 'Manually export files from any system',
    icon: '📁',
    type: 'on-prem',
  },
  {
    id: 'demo',
    name: 'Demo System',
    description: 'Test with sample data',
    icon: '🧪',
    type: 'on-prem',
  },
];

export function SystemSelectStep({ state, updateState, onNext, onBack }: Props) {
  const handleSelect = (systemId: PimsKind) => {
    updateState({ selectedSystem: systemId });
  };

  const handleContinue = () => {
    if (state.selectedSystem) {
      // Set default acquisition mode based on system
      let mode: 'direct' | 'export_automation' | 'export_drop' = 'direct';
      if (state.selectedSystem === 'pulse') {
        mode = 'export_automation';
      } else if (state.selectedSystem === 'export_drop') {
        mode = 'export_drop';
      }
      updateState({ acquisitionMode: mode });
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Select Your System</h2>
        <p className="mt-2 text-gray-600">
          Which practice management system does your clinic use?
        </p>
      </div>

      <div className="grid gap-3">
        {SYSTEMS.map((system) => (
          <button
            key={system.id}
            onClick={() => handleSelect(system.id)}
            className={`flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
              state.selectedSystem === system.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="text-2xl">{system.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{system.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    system.type === 'cloud'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {system.type === 'cloud' ? 'Cloud' : 'On-Premise'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{system.description}</p>
            </div>
            {state.selectedSystem === system.id && (
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!state.selectedSystem}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
