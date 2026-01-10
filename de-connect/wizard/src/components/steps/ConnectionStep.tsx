'use client';

import { useState } from 'react';
import type { SetupState, AcquisitionMode } from '@/app/page';

interface Props {
  state: SetupState;
  updateState: (updates: Partial<SetupState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ConnectionStep({ state, updateState, onNext, onBack }: Props) {
  const [config, setConfig] = useState<Record<string, string>>(state.connectionConfig);

  const handleConfigChange = (key: string, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleModeChange = (mode: AcquisitionMode) => {
    updateState({ acquisitionMode: mode });
  };

  const handleContinue = () => {
    updateState({ connectionConfig: config });
    onNext();
  };

  const renderOnPremConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Data Directory Path
        </label>
        <input
          type="text"
          value={config.dataPath ?? ''}
          onChange={(e) => handleConfigChange('dataPath', e.target.value)}
          placeholder={
            state.selectedSystem === 'avimark'
              ? 'C:\\AVImark'
              : 'C:\\Cornerstone'
          }
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          The folder where your practice management data is stored
        </p>
      </div>

      {state.selectedSystem === 'cornerstone' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Server Name (optional)
          </label>
          <input
            type="text"
            value={config.serverName ?? ''}
            onChange={(e) => handleConfigChange('serverName', e.target.value)}
            placeholder="localhost\\SQLEXPRESS"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            SQL Server name if using server-based installation
          </p>
        </div>
      )}
    </div>
  );

  const renderCloudConfig = () => (
    <div className="space-y-4">
      <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-amber-800">
            <p className="font-medium">Browser login required</p>
            <p className="mt-1">
              You'll need to log in to {state.selectedSystem === 'pulse' ? 'Pulse' : 'ezyVet'} once.
              After that, syncs will run automatically.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Connection Mode
        </label>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="mode"
              value="export_automation"
              checked={state.acquisitionMode === 'export_automation'}
              onChange={() => handleModeChange('export_automation')}
              className="text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="font-medium text-gray-900">Export Automation</p>
              <p className="text-sm text-gray-500">
                Automatically download exports (recommended)
              </p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="mode"
              value="export_drop"
              checked={state.acquisitionMode === 'export_drop'}
              onChange={() => handleModeChange('export_drop')}
              className="text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="font-medium text-gray-900">Export Drop</p>
              <p className="text-sm text-gray-500">
                Manually export files to a folder
              </p>
            </div>
          </label>
        </div>
      </div>

      {state.acquisitionMode === 'export_drop' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Watch Folder
          </label>
          <input
            type="text"
            value={config.watchFolder ?? ''}
            onChange={(e) => handleConfigChange('watchFolder', e.target.value)}
            placeholder="C:\\DEConnect\\Exports"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-sm text-gray-500">
            Drop your exported CSV files in this folder
          </p>
        </div>
      )}
    </div>
  );

  const renderExportDropConfig = () => (
    <div className="space-y-4">
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium">How Export Drop works</p>
            <ol className="mt-2 list-decimal list-inside space-y-1">
              <li>Export data from your system as CSV files</li>
              <li>Drop the files in the watch folder</li>
              <li>DE Connect automatically processes them</li>
            </ol>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Watch Folder
        </label>
        <input
          type="text"
          value={config.watchFolder ?? ''}
          onChange={(e) => handleConfigChange('watchFolder', e.target.value)}
          placeholder="C:\\DEConnect\\Exports"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          Create this folder and drop your exported CSV files here
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Source System Name
        </label>
        <input
          type="text"
          value={config.sourceSystem ?? ''}
          onChange={(e) => handleConfigChange('sourceSystem', e.target.value)}
          placeholder="my_pims"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
        />
        <p className="mt-1 text-sm text-gray-500">
          A name to identify your system (optional)
        </p>
      </div>
    </div>
  );

  const renderDemoConfig = () => (
    <div className="space-y-4">
      <div className="bg-green-50 rounded-lg p-4 border border-green-100">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-green-800">
            <p className="font-medium">Demo Mode</p>
            <p className="mt-1">
              The demo adapter will generate sample veterinary data for testing.
              No configuration needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Configure Connection</h2>
        <p className="mt-2 text-gray-600">
          Set up how DE Connect will access your data.
        </p>
      </div>

      {state.selectedSystem === 'demo' && renderDemoConfig()}
      {state.selectedSystem === 'export_drop' && renderExportDropConfig()}
      {(state.selectedSystem === 'avimark' || state.selectedSystem === 'cornerstone') &&
        renderOnPremConfig()}
      {(state.selectedSystem === 'pulse' || state.selectedSystem === 'ezyvet') &&
        renderCloudConfig()}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Validate Connection
        </button>
      </div>
    </div>
  );
}
