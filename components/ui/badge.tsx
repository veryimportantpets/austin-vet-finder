import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-sage-600 text-white hover:bg-sage-700',
        secondary:
          'border-transparent bg-sage-100 text-sage-800 hover:bg-sage-200',
        destructive:
          'border-transparent bg-red-500 text-white hover:bg-red-600',
        outline: 'text-sage-700 border-sage-300',
        // Nonprofit (amber) and Low-Cost (sky blue) - distinct colors
        nonprofit: 'border-amber-300 bg-amber-100 text-amber-800',
        lowcost: 'border-sky-300 bg-sky-100 text-sky-800',
        // Financing tier variants (new 1/2/N system)
        tier1: 'border-emerald-200 bg-emerald-100 text-emerald-800',
        tier2: 'border-orange-200 bg-orange-100 text-orange-800',
        // Legacy financing tier variants (A-E system)
        tierA: 'border-transparent bg-emerald-500 text-white',
        tierB: 'border-transparent bg-teal-500 text-white',
        tierC: 'border-transparent bg-amber-500 text-amber-950',
        tierD: 'border-transparent bg-orange-500 text-white',
        tierE: 'border-transparent bg-gray-400 text-white',
        // Transparency variants
        transparent: 'border-transparent bg-sky-500 text-white',
        partial: 'border-transparent bg-sky-300 text-sky-900',
        none: 'border-transparent bg-gray-300 text-gray-700',
        // Confidence
        high: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        medium: 'border-amber-200 bg-amber-50 text-amber-700',
        low: 'border-gray-200 bg-gray-50 text-gray-600',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
