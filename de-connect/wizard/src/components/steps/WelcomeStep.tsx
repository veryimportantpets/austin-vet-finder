'use client';

import type { SetupState } from '@/app/page';

interface Props {
  state: SetupState;
  updateState: (updates: Partial<SetupState>) => void;
  onNext: () => void;
}

export function WelcomeStep({ state, updateState, onNext }: Props) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.activationToken.trim()) {
      onNext();
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to DE Connect</h2>
        <p className="mt-2 text-gray-600">
          Let's get your veterinary practice connected in just a few minutes.
        </p>
      </div>

      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="text-sm text-blue-800">
            <p className="font-medium">What happens next:</p>
            <ol className="mt-2 list-decimal list-inside space-y-1">
              <li>We'll detect your practice management system</li>
              <li>You'll log in once to authorize data sync</li>
              <li>Syncs will run automatically every night</li>
            </ol>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="token" className="block text-sm font-medium text-gray-700">
            Activation Token
          </label>
          <p className="mt-1 text-sm text-gray-500">
            Enter the activation token you received from your administrator.
          </p>
          <input
            type="text"
            id="token"
            value={state.activationToken}
            onChange={(e) => updateState({ activationToken: e.target.value })}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={!state.activationToken.trim()}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Get Started
        </button>
      </form>

      <p className="text-center text-sm text-gray-500">
        Don't have an activation token?{' '}
        <a href="#" className="text-blue-600 hover:underline">
          Contact your administrator
        </a>
      </p>
    </div>
  );
}
