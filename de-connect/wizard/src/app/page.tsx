'use client';

import { useState } from 'react';
import { WelcomeStep } from '@/components/steps/WelcomeStep';
import { SystemSelectStep } from '@/components/steps/SystemSelectStep';
import { ConnectionStep } from '@/components/steps/ConnectionStep';
import { ValidationStep } from '@/components/steps/ValidationStep';
import { CompleteStep } from '@/components/steps/CompleteStep';

export type PimsKind = 'avimark' | 'cornerstone' | 'pulse' | 'ezyvet' | 'export_drop' | 'demo';
export type AcquisitionMode = 'direct' | 'export_automation' | 'export_drop';

export interface SetupState {
  step: number;
  activationToken: string;
  selectedSystem: PimsKind | null;
  acquisitionMode: AcquisitionMode | null;
  connectionConfig: Record<string, string>;
  validationResults: Array<{
    step: string;
    status: 'success' | 'warning' | 'error';
    message: string;
  }>;
  isComplete: boolean;
}

const TOTAL_STEPS = 5;

export default function SetupWizard() {
  const [state, setState] = useState<SetupState>({
    step: 1,
    activationToken: '',
    selectedSystem: null,
    acquisitionMode: null,
    connectionConfig: {},
    validationResults: [],
    isComplete: false,
  });

  const updateState = (updates: Partial<SetupState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    setState(prev => ({ ...prev, step: Math.min(prev.step + 1, TOTAL_STEPS) }));
  };

  const prevStep = () => {
    setState(prev => ({ ...prev, step: Math.max(prev.step - 1, 1) }));
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4, 5].map((stepNum) => (
          <div key={stepNum} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                stepNum < state.step
                  ? 'bg-blue-600 text-white'
                  : stepNum === state.step
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {stepNum < state.step ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                stepNum
              )}
            </div>
            {stepNum < 5 && (
              <div
                className={`w-16 h-1 mx-2 ${
                  stepNum < state.step ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {state.step === 1 && (
          <WelcomeStep
            state={state}
            updateState={updateState}
            onNext={nextStep}
          />
        )}
        {state.step === 2 && (
          <SystemSelectStep
            state={state}
            updateState={updateState}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {state.step === 3 && (
          <ConnectionStep
            state={state}
            updateState={updateState}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {state.step === 4 && (
          <ValidationStep
            state={state}
            updateState={updateState}
            onNext={nextStep}
            onBack={prevStep}
          />
        )}
        {state.step === 5 && (
          <CompleteStep
            state={state}
            updateState={updateState}
          />
        )}
      </div>
    </div>
  );
}
