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
            <Crown className={cn("h-3 w-3", colorClass)} />
        ) : (
            <span className={cn('text-sm font-bold', colorClass)}>V</span>
        )}
      </div>
      {size !== 'icon' && <span>{badgeText}</span>}
    </div>
  );
}
