'use client';

import { cn } from '@/lib/utils';

interface OfficialBadgeProps {
  color?: 'blue' | 'gold' | 'green' | 'red' | 'pink';
  className?: string;
}

export function OfficialBadge({ color = 'gold', className }: OfficialBadgeProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-500',
      text: 'text-white',
      circle: 'bg-blue-400',
    },
    gold: {
      bg: 'bg-yellow-500',
      text: 'text-white',
      circle: 'bg-yellow-400',
    },
    green: {
      bg: 'bg-green-500',
      text: 'text-white',
      circle: 'bg-green-400',
    },
    red: {
      bg: 'bg-red-500',
      text: 'text-white',
      circle: 'bg-red-400',
    },
    pink: {
      bg: 'bg-pink-500',
      text: 'text-white',
      circle: 'bg-pink-400',
    },
  };

  const selectedColor = colorClasses[color] || colorClasses.gold;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
        selectedColor.bg,
        selectedColor.text,
        className
      )}
    >
      <div
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full',
          selectedColor.circle
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3 w-3 text-white"
        >
          <path
            fillRule="evenodd"
            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <span>Official</span>
    </div>
  );
}
