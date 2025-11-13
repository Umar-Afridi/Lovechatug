'use client';

import { cn } from '@/lib/utils';

interface OfficialBadgeProps {
  color?: 'blue' | 'gold' | 'green' | 'red' | 'pink';
  className?: string;
}

export function OfficialBadge({ color = 'gold', className }: OfficialBadgeProps) {
  const colorClasses = {
    blue: 'text-[#1877F2]',
    gold: 'text-[#FFD700]',
    green: 'text-[#07F26C]',
    red: 'text-[#FF0000]',
    pink: 'text-[#EC4899]',
  };

  return (
    <div className={cn("relative h-6 w-6", className)}>
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={cn("absolute inset-0 h-full w-full", colorClasses[color])}
            aria-hidden="true"
        >
            <path d="M12 1L9 9H1l7.5 5.5L6 23l6-4.5L18 23l-2.5-8.5L23 9h-8z"></path>
        </svg>
         <span 
            className="absolute inset-0 flex items-center justify-center text-white font-bold text-[10px]"
            style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)'}}
        >
            V
        </span>
    </div>
  );
}
