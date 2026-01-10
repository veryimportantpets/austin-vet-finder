'use client';

import type { SetupState } from '@/app/page';

interface Props {
  state: SetupState;
  updateState: (updates: Partial<SetupState>) => void;
}

export function CompleteStep({ state }: Props) {
  const systemNames: Record<string, string> = {
    avimark: 'AVImark',
    cornerstone: 'Cornerstone',
    pulse: 'Pulse',
    ezyvet: 'ezyVet',
    export_drop: 'Export Drop',
    demo: 'Demo System',
  };

  return (
    <div className="space-y-6 text-center">
      <div className="flex justify-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">You're All Set!</h2>
        <p className="mt-2 text-gray-600">
          DE Connect is now configured and ready to sync your data.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 text-left">
        <h3 className="font-medium text-gray-900 mb-4">Configuration Summary</h3>
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-gray-500">System</dt>
            <dd className="text-gray-900 font-medium">
              {systemNames[state.selectedSystem ?? ''] ?? 'Unknown'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Mode</dt>
            <dd className="text-gray-900 font-medium">
              {state.acquisitionMode === 'direct'
                ? 'Direct Access'
                : state.acquisitionMode === 'export_automation'
                ? 'Export Automation'
                : 'Export Drop'}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Sync Schedule</dt>
            <dd className="text-gray-900 font-medium">Daily at 2:00 AM</dd>
          </div>
        </dl>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 text-left">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">What happens next</p>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>The sync service is now running in the background</li>
              <li>Your first sync will start at the next scheduled time</li>
              <li>You'll receive an email if we need you to reconnect</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={() => window.close()}
          className="rounded-lg bg-blue-600 px-8 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Close Setup
        </button>
      </div>

      <p className="text-sm text-gray-500">
        You can access settings anytime from the system tray icon.
      </p>
    </div>
  );
}
