'use client';

import { cn } from '@/lib/utils';
import { VariantProps, cva } from 'class-variance-authority';
import { Crown } from 'lucide-react';

const badgeVariants = cva(
  'inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold',
  {
    variants: {
      color: {
        blue: 'bg-blue-500 text-white',
        gold: 'bg-yellow-500 text-white',
        green: 'bg-green-500 text-white',
        red: 'bg-red-500 text-white',
        pink: 'bg-pink-500 text-white',
      },
      size: {
        default: 'px-3 py-1 text-sm',
        icon: 'p-0 justify-center',
      },
    },
    defaultVariants: {
      color: 'gold',
      size: 'default',
    },
  }
);

interface OfficialBadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  isOwner?: boolean;
}

export function OfficialBadge({ color, size, className, isOwner = false }: OfficialBadgeProps) {
    
  const colorClass = {
    blue: 'text-blue-500',
    gold: 'text-yellow-500',
    green: 'text-green-500',
    red: 'text-red-500',
    pink: 'text-pink-500',
  }[color || 'gold'];

  if (isOwner && size === 'icon') {
     return (
        <div className={cn("relative", className)}>
            <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="official-badge-circle-animation"
            >
            <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="url(#official-gradient)"
                strokeWidth="5"
                strokeDasharray="282.74"
                strokeDashoffset="0"
                pathLength="1"
                style={{ strokeDasharray: '10 18.27' }}
            ></circle>
            <defs>
                <linearGradient
                id="official-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
                >
                <stop offset="0%" stopColor="#8A2BE2" />
                <stop offset="50%" stopColor="#FF1493" />
                <stop offset="100%" stopColor="#00BFFF" />
                </linearGradient>
            </defs>
            </svg>
            <div className="official-badge-owner-icon absolute inset-0 flex items-center justify-center text-[60%]">
                👑
            </div>
        </div>
     );
  }

  const badgeText = isOwner ? 'Owner' : 'Official';

  return (
    <div className={cn(badgeVariants({ color, size }), className)}>
      <div
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full bg-white font-bold',
           size === 'icon' ? 'h-full w-full' : 'h-5 w-5'
        )}
      >
        {isOwner ? (
            <span className="text-base" role="img" aria-label="crown">👑</span>
        ) : (
            <span className={cn('text-sm font-bold', colorClass)}>V</span>
        )}
      </div>
      {size !== 'icon' && <span>{badgeText}</span>}
    </div>
  );
}
