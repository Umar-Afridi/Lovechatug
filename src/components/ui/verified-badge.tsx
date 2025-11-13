'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  color?: 'blue' | 'gold' | 'green' | 'red' | 'pink';
  className?: string;
}

export function VerifiedBadge({ color = 'blue', className }: VerifiedBadgeProps) {
  const colorClasses = {
    blue: 'text-[#1877F2]',
    gold: 'text-[#FFD700]',
    green: 'text-[#07F26C]',
    red: 'text-[#FF0000]',
    pink: 'text-[#EC4899]',
  };

  return (
    <div className={cn("relative h-4 w-4", className)}>
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={cn("absolute inset-0 h-full w-full", colorClasses[color])}
            aria-hidden="true"
        >
            <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.27 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.33-2.19c1.4.46 2.91.2 3.92-.81s1.27-2.52.8-3.91c1.31-.67 2.2-1.91 2.2-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-4.8 1.41 1.42-6.21 6.22z"></path>
        </svg>
    </div>
  );
}
