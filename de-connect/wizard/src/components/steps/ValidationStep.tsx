'use client';

import { useEffect, useState } from 'react';
import type { SetupState } from '@/app/page';

interface Props {
  state: SetupState;
  updateState: (updates: Partial<SetupState>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface ValidationResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'warning' | 'error';
  message: string;
}

const VALIDATION_STEPS = [
  { key: 'connection', label: 'Testing connection' },
  { key: 'authentication', label: 'Verifying access' },
  { key: 'data_access', label: 'Checking data access' },
  { key: 'permissions', label: 'Validating permissions' },
];

export function ValidationStep({ state, updateState, onNext, onBack }: Props) {
  const [results, setResults] = useState<ValidationResult[]>(
    VALIDATION_STEPS.map(step => ({
      step: step.key,
      status: 'pending',
      message: step.label,
    }))
  );
  const [isValidating, setIsValidating] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Simulate validation process
    const runValidation = async () => {
      for (let i = 0; i < VALIDATION_STEPS.length; i++) {
        setCurrentStep(i);

        // Update current step to running
        setResults(prev =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: 'running' } : r
          )
        );

        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

        // Update step result
        const isDemo = state.selectedSystem === 'demo';
        const success = isDemo || Math.random() > 0.1; // Demo always succeeds

        setResults(prev =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  status: success ? 'success' : i === 3 ? 'warning' : 'error',
                  message: success
                    ? `${VALIDATION_STEPS[i]!.label} - OK`
                    : i === 3
                    ? `${VALIDATION_STEPS[i]!.label} - Limited access (proceeding anyway)`
                    : `${VALIDATION_STEPS[i]!.label} - Failed`,
                }
              : r
          )
        );

        if (!success && i !== 3) {
          setIsValidating(false);
          return;
        }
      }

      setIsValidating(false);
    };

    runValidation();
  }, [state.selectedSystem]);

  const allPassed = results.every(r => r.status === 'success' || r.status === 'warning');
  const hasFailed = results.some(r => r.status === 'error');

  const handleContinue = () => {
    updateState({
      validationResults: results.map(r => ({
        step: r.step,
        status: r.status as 'success' | 'warning' | 'error',
        message: r.message,
      })),
    });
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Validating Connection</h2>
        <p className="mt-2 text-gray-600">
          Checking that everything is set up correctly...
        </p>
      </div>

      <div className="space-y-3">
        {results.map((result, idx) => (
          <div
            key={result.step}
            className={`flex items-center gap-4 p-4 rounded-lg border ${
              result.status === 'error'
                ? 'border-red-200 bg-red-50'
                : result.status === 'warning'
                ? 'border-amber-200 bg-amber-50'
                : result.status === 'success'
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex-shrink-0">
              {result.status === 'pending' && (
                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
              )}
              {result.status === 'running' && (
                <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              )}
              {result.status === 'success' && (
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {result.status === 'warning' && (
                <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {result.status === 'error' && (
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span
              className={`${
                result.status === 'error'
                  ? 'text-red-800'
                  : result.status === 'warning'
                  ? 'text-amber-800'
                  : result.status === 'success'
                  ? 'text-green-800'
                  : result.status === 'running'
                  ? 'text-blue-800'
                  : 'text-gray-500'
              }`}
            >
              {result.message}
            </span>
          </div>
        ))}
      </div>

      {!isValidating && hasFailed && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-100">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-red-800">
              <p className="font-medium">Validation failed</p>
              <p className="mt-1">
                Please check your configuration and try again.
                You can also try Export Drop mode as a fallback.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={isValidating}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={isValidating || hasFailed}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-white font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isValidating ? 'Validating...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
}
