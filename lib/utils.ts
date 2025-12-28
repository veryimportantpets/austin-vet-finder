import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date for display
export function formatDate(date: Date | string | null): string {
  if (!date) return 'Unknown';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format relative time
export function formatRelativeTime(date: Date | string | null): string {
  if (!date) return 'Unknown';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
}

// Get tier label with description
export function getTierInfo(tier: string | null): { label: string; description: string; className: string } {
  const tiers: Record<string, { label: string; description: string; className: string }> = {
    // New tier structure
    '1': {
      label: 'Best BNPL',
      description: 'No deferred interest, transparent fixed payments',
      className: 'tier-1',
    },
    '2': {
      label: 'Use Caution',
      description: 'May have deferred interest - confirm terms',
      className: 'tier-2',
    },
    'N': {
      label: 'No Financing',
      description: 'No BNPL options detected',
      className: 'tier-n',
    },
    // Legacy tiers (for backwards compatibility during migration)
    A: {
      label: 'Tier A',
      description: 'No/Low interest, no gotchas',
      className: 'tier-a',
    },
    B: {
      label: 'Tier B',
      description: 'Fixed APR, transparent',
      className: 'tier-b',
    },
    C: {
      label: 'Tier C',
      description: 'High APR possible or unclear',
      className: 'tier-c',
    },
    D: {
      label: 'Tier D',
      description: 'Deferred interest risk',
      className: 'tier-d',
    },
    E: {
      label: 'Tier E',
      description: 'None detected',
      className: 'tier-e',
    },
  };

  return tiers[tier || 'N'] || tiers.N;
}

// Get transparency badge info
export function getTransparencyInfo(score: number | null): { label: string; description: string } {
  const s = score || 0;
  if (s >= 60) return { label: 'Published prices', description: 'Price list or fee table found' };
  if (s >= 30) return { label: 'Exam fee listed', description: 'At least one concrete price disclosed' };
  if (s >= 20) return { label: 'Written estimates', description: 'Commits to providing written estimates' };
  if (s >= 10) return { label: 'Some signals', description: 'Mentions transparent pricing' };
  return { label: 'No signals', description: 'No transparency signals found' };
}

// Generate "what to ask" questions
export function getQuestionsToAsk(
  financingProviders: string[],
  hasEstimatePromise: boolean,
  hasPriceList: boolean
): string[] {
  const questions: string[] = [];
  
  if (!hasPriceList) {
    questions.push('Can you provide me with a written estimate before any treatment?');
    questions.push('What is your exam fee for a new patient?');
  }
  
  if (financingProviders.length > 0) {
    questions.push(`I see you accept ${financingProviders.join(' and ')}. What are the current promotional terms?`);
    questions.push('Are there any lower-cost treatment alternatives I should know about?');
  } else {
    questions.push('Do you offer any payment plans or financing options?');
    questions.push('Do you offer any discounts for paying in full or for multiple pets?');
  }
  
  if (!hasEstimatePromise) {
    questions.push('Will I receive an itemized breakdown of all charges?');
  }
  
  questions.push('What is your policy if unexpected costs arise during treatment?');
  
  return questions.slice(0, 5); // Max 5 questions
}

// Financing provider display names
// Tier 1: Best BNPL (no deferred interest)
// Tier 2: Use Caution (may have deferred interest)
export const FINANCING_PROVIDERS: Record<string, { name: string; tier: string; risk?: string }> = {
  // Tier 1 - Best BNPL (no deferred interest, transparent fixed payments)
  CHERRY: { name: 'Cherry', tier: '1' },
  SUNBIT: { name: 'Sunbit', tier: '1' },
  AFFIRM: { name: 'Affirm', tier: '1' },
  VETBILLING: { name: 'VetBilling', tier: '1' },
  IN_HOUSE_PAYMENT_PLAN: { name: 'In-house payment plan', tier: '1' },

  // Affordability signals (not BNPL, but indicates affordability focus)
  WELLNESS_PLAN: { name: 'Wellness Plan', tier: 'affordability' },

  // Tier 2 - Use Caution (deferred interest risk)
  SCRATCHPAY: {
    name: 'Scratchpay',
    tier: '2',
    risk: 'May use deferred interest - confirm terms before signing',
  },
  CARECREDIT: {
    name: 'CareCredit',
    tier: '2',
    risk: 'Often uses deferred interest (interest accrues from day 1 and charged retroactively if not paid in full)',
  },
  OTHER_FINANCING: {
    name: 'Other financing',
    tier: '2',
    risk: 'Terms unclear - ask about interest and payment structure',
  },
};

// Truncate text with ellipsis
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trim() + '...';
}

// Calculate distance (simplified, for display)
export function calculateDistance(
  lat1: number | null,
  lng1: number | null,
  lat2: number,
  lng2: number
): number | null {
  if (lat1 === null || lng1 === null) return null;
  
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
