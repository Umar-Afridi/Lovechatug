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
        fill="currentColor"
        viewBox="0 0 22 22"
        className={cn("absolute inset-0 h-full w-full", colorClasses[color])}
        aria-hidden="true"
      >
        <path d="M20.395 8.395l-1.107 3.328a.5.5 0 01-.482.348h-3.328a.5.5 0 01-.483-.348L13.888 8.39a.5.5 0 01.348-.483l3.328-1.107a.5.5 0 01.482.348l1.107 3.328a.5.5 0 01-.348.482zM10.002 1.605a.5.5 0 01.483.348l1.107 3.328a.5.5 0 01-.348.483l-3.328 1.107a.5.5 0 01-.483-.348L6.326 3.196a.5.5 0 01.348-.483l3.328-1.108zM10 12.5a.5.5 0 01.5.5v8.5a.5.5 0 01-1 0v-8.5a.5.5 0 01.5-.5z" opacity="0.4"></path>
        <path d="M19.348 7.29l-2.215-2.214a.5.5 0 00-.707 0L9.354 12.148a.5.5 0 01-.707 0L6.432 9.932a.5.5 0 00-.707 0L3.51 12.148a.5.big 0 000 .707l2.215 2.215a.5.5 0 00.707 0l2.922-2.922a.5.5 0 01.707 0l2.922 2.922a.5.5 0 00.707 0l2.215-2.215a.5.5 0 000-.707z"></path>
      </svg>
       <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("absolute inset-0 h-full w-full", colorClasses[color])}
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm6.53 8.03l-7.25 7.25a.75.75 0 01-1.06 0l-3.5-3.5a.75.75 0 011.06-1.06l2.97 2.97 6.72-6.72a.75.75 0 011.06 1.06z"
          clipRule="evenodd"
        ></path>
      </svg>
    </div>
  );
}
